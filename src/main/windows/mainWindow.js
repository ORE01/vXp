'use strict';

const path = require('path');
const { BrowserWindow } = require('electron');

function createMainWindow({ ROOT, preloadPath, devTools = true }) {
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 700,
    icon: path.join(__dirname, '../vXp.ico'),
    webPreferences: {
      preload: preloadPath,
      devTools,
    },
  });

  mainWindow.loadFile(path.join(ROOT, 'index.html'));

  if (devTools) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    // wird in index.js über Rückgabe/Variable gehandhabt
  });

  return mainWindow;
}

module.exports = createMainWindow;