import net from 'net';
import { remoteStore } from './remoteStore';

let isServerStarted = false;
const MAX_CONNECTIONS = 5;
let connectionCount = 0;

export function startRemoteServer() {
  if (isServerStarted) return;
  
  const port = 9001;
  const server = net.createServer((socket) => {
    if (connectionCount >= MAX_CONNECTIONS) {
      console.warn(`[RemoteServer] Connection rejected: Max connections reached (${MAX_CONNECTIONS})`);
      socket.write('ERROR: MAX CONNECTIONS REACHED\r\n');
      socket.destroy();
      return;
    }

    connectionCount++;
    console.log(`[RemoteServer] Client connected (${connectionCount}/${MAX_CONNECTIONS})`);

    let buffer = '';

    socket.on('data', (data) => {
      buffer += data.toString();
      
      // TCP Stream Handling: Split by newline or other delimiters if necessary
      // Here we assume commands might be separated by \n or just arrive in the same packet
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? ''; // Keep the last partial line in buffer

      for (const line of lines) {
        const input = line.trim();
        if (!input) continue;

        console.log(`[RemoteServer] Processing command: "${input}"`);

        if (input.includes('@play')) {
          remoteStore.pushCommand('PLAY');
          socket.write('@play@\r\n');
        } else if (input.includes('@pause')) {
          remoteStore.pushCommand('PAUSE');
          socket.write('@pause@\r\n');
        } else if (input.includes('@stop')) {
          remoteStore.pushCommand('STOP');
          socket.write('@stop@\r\n');
        } else if (input.includes('@status')) {
          const status = remoteStore.getStatus();
          socket.write(`${status}\r\n`);
        } else {
          socket.write('ERROR: UNKNOWN COMMAND\r\n');
        }
      }
    });

    socket.on('close', () => {
      connectionCount--;
      console.log(`[RemoteServer] Client disconnected (${connectionCount}/${MAX_CONNECTIONS})`);
    });

    socket.on('error', (err) => {
      // connectionCount decrement is handled by 'close'
      console.error('[RemoteServer] Socket error:', err);
    });
  });

  server.listen(port, '0.0.0.0', () => {
    console.log(`[RemoteServer] Standalone TCP Server listening on port ${port}`);
    isServerStarted = true;
  });

  server.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`[RemoteServer] Port ${port} already in use, skipping...`);
    } else {
      console.error('[RemoteServer] Server error:', err);
    }
  });
}
