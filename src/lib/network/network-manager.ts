import net from 'net';
import dgram from 'dgram';
import { Server, Client } from 'node-osc';
import { exec } from 'child_process';
import util from 'util';
import { DeviceConfig, DataFormat, Terminator } from '../types';
import { remoteStore } from '../remoteStore';
import { startRemoteServer } from '../remoteServer';

const execAsync = util.promisify(exec);

type OscArg = string | number | boolean | Buffer;

export class NetworkManager {
  private static instance: NetworkManager;
  private tcpClients: Map<string, net.Socket> = new Map();
  private udpSocket: dgram.Socket;
  private oscClients: Map<string, Client> = new Map();
  private oscServer: Server | null = null;
  
  // Track the last time we confirmed the device was reachable
  private lastOnlineMap: Map<string, number> = new Map();

  private constructor() {
    this.udpSocket = dgram.createSocket('udp4');
  }

  public static getInstance(): NetworkManager {
    if (!NetworkManager.instance) {
      NetworkManager.instance = new NetworkManager();
      // Auto-start OSC server and Remote server on first access
      NetworkManager.instance.startOscServer(8000);
      startRemoteServer();
    }
    return NetworkManager.instance;
  }

  /**
   * Start OSC Server for remote transport control
   */
  public startOscServer(port: number = 8000) {
    if (this.oscServer) {
      try { this.oscServer.close(); } catch (e) {}
    }

    try {
      this.oscServer = new Server(port, '0.0.0.0', () => {
        console.log(`[OSC] Server listening on port ${port}`);
      });

      this.oscServer.on('message', (msg: OscArg[]) => {
        const [address, ...args] = msg as [string, ...OscArg[]];
        console.log(`[OSC] Received: ${address}`, args);
        this.handleRemoteCommand(address, args);
      });

      this.oscServer.on('error', (err) => {
        console.error(`[OSC Server Error]`, err);
      });
    } catch (err) {
      console.error(`[OSC Server Setup Error]`, err);
    }
  }

  private async handleRemoteCommand(address: string, args: OscArg[]) {
    // This will be handled via an internal event system or a callback 
    // to trigger Start/Stop/Pause in the UI.
    // Since this runs in the server process, we send it to the UI via SSE/Websocket if available.
    // In this app, we have /api/remote/status to sync status.
    // We can use the same mechanism to "push" commands to the UI.
    
    let command = '';
    if (address === '/transport/play') command = 'PLAY';
    else if (address === '/transport/stop') command = 'STOP';
    else if (address === '/transport/pause') command = 'PAUSE';
    
    if (command) {
      try {
        remoteStore.pushCommand(command as 'PLAY' | 'PAUSE' | 'STOP');
      } catch (e) {
        console.error(`[OSC] RemoteStore error:`, e);
      }
    }
  }

  /**
   * Enhanced health check with session persistence and grace periods.
   */
  public async pingDevice(device: DeviceConfig): Promise<boolean> {
    const key = `${device.ip}:${device.port}`;

    if (device.protocol === 'tcp') {
      let client = this.tcpClients.get(key);

      // If already connected and active, it's definitely online
      if (client && !client.destroyed && client.writable && (client as any).readyState === 'open') {
        this.lastOnlineMap.set(key, Date.now());
        return true;
      }

      // If not connected, try to establish/re-establish connection
      return new Promise((resolve) => {
        const socket = new net.Socket();
        socket.setTimeout(1500); // Slightly longer timeout for initial handshake
        
        let resolved = false;

        socket.on('connect', () => {
          if (resolved) return;
          resolved = true;
          this.lastOnlineMap.set(key, Date.now());
          
          // KEEP session alive instead of destroying
          this.tcpClients.set(key, socket);
          
          // Setup persistent listeners
          const cleanup = () => {
            if (this.tcpClients.get(key) === socket) {
              this.tcpClients.delete(key);
            }
          };
          socket.on('error', cleanup);
          socket.on('close', cleanup);
          
          resolve(true);
        });
        
        const handleError = () => {
          if (resolved) return;
          resolved = true;
          socket.destroy();

          // Check if we are within the "Grace Period" (e.g., 2 seconds)
          const lastSeen = this.lastOnlineMap.get(key) || 0;
          const isWithinGrace = (Date.now() - lastSeen) < 2000;
          
          resolve(isWithinGrace); // Still show as "Online" if it just disconnected
        };

        socket.on('error', handleError);
        socket.on('timeout', handleError);
        
        socket.connect(device.port, device.ip);
      });
    } else {
      // UDP uses ICMP Ping
      try {
        const cmd = process.platform === 'win32' 
          ? `ping -n 1 -w 1000 ${device.ip}` 
          : `ping -c 1 -W 1 ${device.ip}`;
        
        await execAsync(cmd);
        this.lastOnlineMap.set(key, Date.now());
        return true;
      } catch (error) {
        const lastSeen = this.lastOnlineMap.get(key) || 0;
        return (Date.now() - lastSeen) < 3000; // 3s grace for UDP
      }
    }
  }

  private parseCommandData(data: string, format: DataFormat, terminator: Terminator): Buffer {
    let payload: Buffer;
    
    // Generate Terminator Buffer
    let termBuffer = Buffer.alloc(0);
    switch (terminator) {
      case 'cr': termBuffer = Buffer.from([0x0D]); break;
      case 'lf': termBuffer = Buffer.from([0x0A]); break;
      case 'crlf': termBuffer = Buffer.from([0x0D, 0x0A]); break;
    }

    if (format === 'hex') {
      const hex = data.replace(/[^0-9A-Fa-f]/g, '');
      const basePayload = Buffer.from(hex, 'hex');
      payload = Buffer.concat([basePayload, termBuffer]);
    } else {
      let text = data
        .replace(/\\r/g, '\r')
        .replace(/\\n/g, '\n')
        .replace(/\\t/g, '\t');
      
      const basePayload = Buffer.from(text, 'ascii');
      payload = Buffer.concat([basePayload, termBuffer]);
    }
    return payload;
  }

  public async sendCommand(
    device: DeviceConfig, 
    data: string, 
    format: DataFormat = 'ascii', 
    terminator: Terminator = 'none'
  ): Promise<string> {
    const payload = this.parseCommandData(data, format, terminator);

    if (device.protocol === 'tcp') {
      return await this.sendTcp(device, payload);
    } else if (device.protocol === 'osc') {
      return await this.sendOsc(device, data);
    } else {
      await this.sendUdp(device, payload);
      return 'UDP Sent (No Tally)';
    }
  }

  private async sendOsc(device: DeviceConfig, data: string): Promise<string> {
    const key = `${device.ip}:${device.port}`;
    let client = this.oscClients.get(key);

    if (!client) {
      client = new Client(device.ip, device.port);
      this.oscClients.set(key, client);
    }

    const { address, args } = this.parseOscMessage(data);

    return new Promise((resolve, reject) => {
      client!.send(address, ...args, (err: unknown) => {
        if (err) {
          // Cleanup on error to prevent stale clients
          client?.close();
          this.oscClients.delete(key);
          reject(err instanceof Error ? err : new Error(String(err)));
        } else {
          resolve(`OSC Sent: ${address} [${args.join(', ')}]`);
        }
      });
    });
  }

  private parseOscMessage(data: string): { address: string, args: OscArg[] } {
    const parts = data.trim().split(/\s+/);
    const address = parts[0];
    const args: OscArg[] = [];

    parts.slice(1).forEach(part => {
      if (part.startsWith('i:')) args.push(parseInt(part.substring(2)));
      else if (part.startsWith('f:')) args.push(parseFloat(part.substring(2)));
      else if (part.startsWith('d:')) args.push(Number(part.substring(2)));
      else if (part.startsWith('s:')) args.push(part.substring(2));
      else if (!isNaN(Number(part)) && part.trim() !== '') {
        if (part.includes('.')) args.push(parseFloat(part));
        else args.push(parseInt(part));
      } else {
        args.push(part);
      }
    });

    return { address, args };
  }

  private async sendTcp(device: DeviceConfig, payload: Buffer): Promise<string> {
    const key = `${device.ip}:${device.port}`;
    let client = this.tcpClients.get(key);

    // Reuse persistent connection if possible
    if (client && !client.destroyed && client.writable) {
      return this.writeAndRead(client, payload);
    }

    // Otherwise, create a new one (should have been handled by ping, but just in case)
    client = new net.Socket();
    this.tcpClients.set(key, client);

    const cleanup = () => { this.tcpClients.delete(key); };
    client.on('error', cleanup);
    client.on('close', cleanup);

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        client?.destroy();
        reject(new Error('TCP Connection Timeout'));
      }, 2000);

      client?.connect(device.port, device.ip, () => {
        clearTimeout(timeout);
        this.writeAndRead(client!, payload).then(resolve).catch(reject);
      });

      client?.on('error', (err: Error) => {
        clearTimeout(timeout);
        reject(err);
      });
    });
  }

  private async writeAndRead(client: net.Socket, payload: Buffer): Promise<string> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        client.removeAllListeners('data');
        resolve('TIMEOUT (No ACK)');
      }, 1000);

      client.once('data', (data) => {
        clearTimeout(timeout);
        resolve(data.toString('ascii').trim());
      });

      client.write(payload, (err: Error | null | undefined) => {
        if (err) {
          clearTimeout(timeout);
          reject(err);
        }
      });
    });
  }

  private async sendUdp(device: DeviceConfig, payload: Buffer): Promise<void> {
    return new Promise((resolve, reject) => {
      this.udpSocket.send(payload, device.port, device.ip, (err: Error | null) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
}
