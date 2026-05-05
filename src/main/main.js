const { app, BrowserWindow } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

const isDev = !app.isPackaged;

let mainWindow;
let serverProcess;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    backgroundColor: '#050505',
    title: 'Event Sequencer v0.9.0',
    autoHideMenuBar: true, // プロフェッショナルなDAWらしくメニューを隠す
  });

  const port = isDev ? '3000' : '3001';
  const url = `http://localhost:${port}`;
  
  // サーバーが立ち上がるまで少し待機してから読み込む
  const startUrl = url;
  
  const loadPage = () => {
    mainWindow.loadURL(startUrl).catch(() => {
      console.log('Server not ready, retrying...');
      setTimeout(loadPage, 1000);
    });
  };

  loadPage();

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function startNextServer() {
  if (!isDev) {
    // サーバーの場所を自動判定（ステージング方式と標準方式の両方に対応）
    const rootServerPath = path.join(process.resourcesPath, 'app/server.js');
    const standaloneServerPath = path.join(process.resourcesPath, 'app/.next/standalone/server.js');
    
    const fs = require('fs');
    const serverPath = fs.existsSync(rootServerPath) ? rootServerPath : standaloneServerPath;
    const serverCwd = path.dirname(serverPath);

    serverProcess = spawn('node', [serverPath], {
      env: { ...process.env, PORT: '3001', NODE_ENV: 'production' },
      cwd: serverCwd
    });

    serverProcess.stdout.on('data', (data) => console.log(`[Server] ${data}`));
    serverProcess.stderr.on('data', (data) => console.error(`[Server Error] ${data}`));
  }
}

app.whenReady().then(() => {
  startNextServer();
  createWindow();
});

app.on('window-all-closed', () => {
  if (serverProcess) serverProcess.kill();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});
