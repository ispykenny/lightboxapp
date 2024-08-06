const { app, BrowserWindow, Notification } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
// const fetch = require('node-fetch');
let win;
function createWindow() {
  win = new BrowserWindow({
    width: 200,
    height: 100,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      enableRemoteModule: false,
      nodeIntegration: false,
    },
  });

  win.loadFile('index.html');
}

let wasCameraActive = false;
let debounceTimer = null;

async function updateLights(isActive) {
  // const fetch = (await import('node-fetch')).default;

  const url = 'http://wled.local/json/state';
  const headers = { 'Content-Type': 'application/json' };
  win.setBackgroundColor(isActive ? '#ff0037' : '#00ff00');
  const body = isActive
    ? JSON.stringify({
        seg: [
          {
            col: [
              [255, 0, 55],
              [0, 0, 0],
              [0, 0, 0],
            ],
          },
        ],
      })
    : JSON.stringify({
        seg: [
          {
            col: [
              [0, 255, 0],
              [0, 0, 0],
              [0, 0, 0],
            ],
          },
        ],
      });

  await fetch(url, { method: 'POST', headers, body });
}

function checkCameraActivity(callback) {
  const logStreamCommand = `log stream --predicate 'eventMessage contains "Cameras changed to"'`;

  const logStream = spawn('sh', ['-c', logStreamCommand]);

  logStream.stdout.on('data', (data) => {
    if (debounceTimer) clearTimeout(debounceTimer);

    debounceTimer = setTimeout(() => {
      const dataString = data.toString();
      const lines = dataString.split('\n');
      lines.forEach((line) => {
        if (line.includes('Cameras changed to')) {
          const appEffectsMatch = line.match(/appEffects: \[(.*?)\]/);
          const appEffects = appEffectsMatch ? appEffectsMatch[1] : null;
          const isCameraActive =
            appEffects !== null && appEffects.trim() !== '';
          callback(isCameraActive);
        }
      });
    }, 500); // Adjust debounce delay as needed
  });

  logStream.stderr.on('data', (data) => {
    console.error(`log stream stderr: ${data}`);
  });

  logStream.on('close', (code) => {
    console.log(`log stream process exited with code ${code}`);
    checkCameraActivity(callback); // Restart the log stream process if it exits
  });
}

function notifyCameraStatus(isActive) {
  if (isActive !== wasCameraActive) {
    new Notification({
      title: 'Camera Alert',
      body: isActive ? 'Camera is currently active!' : 'Camera is not active.',
      icon: path.join(__dirname, 'icon.png'),
    }).show();
    updateLights(isActive);
    wasCameraActive = isActive;
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });

  // Start the log stream process
  checkCameraActivity((isCameraActive) => {
    console.log(`Initial camera status: ${isCameraActive}`);
    notifyCameraStatus(isCameraActive);
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
