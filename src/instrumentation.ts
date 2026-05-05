export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startRemoteServer } = await import('./lib/remoteServer');
    startRemoteServer();
  }
}
