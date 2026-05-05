import net from 'net';
import { remoteStore } from './remoteStore';

let isServerStarted = false;

export function startRemoteServer() {
  if (isServerStarted) return;
  
  const port = 9001;
  const server = net.createServer((socket) => {
    console.log('[RemoteServer] Client connected');

    socket.on('data', (data) => {
      const hex = data.toString('hex');
      const input = data.toString().trim();
      console.log(`[RemoteServer] Incoming data: "${input}" (Hex: ${hex})`);

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
        console.log(`[RemoteServer] Sending status: ${status}`);
        socket.write(`${status}\r\n`);
      } else {
        socket.write('ERROR: UNKNOWN COMMAND (DAW REMOTE CONTROL READY)\r\n');
      }
    });

    socket.on('end', () => {
      console.log('[RemoteServer] Client disconnected');
    });

    socket.on('error', (err) => {
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
