const path = require('path');
const { app } = require('electron');

function getFilesBaseDir() {
  // Packaged App: <install>\resources\files\...
  if (app.isPackaged) return path.join(process.resourcesPath, 'files');

  // Dev: <projectRoot>\files\...
  // app.getAppPath() zeigt in Dev i.d.R. auf electron_app (wo package.json liegt)
  return path.join(app.getAppPath(), 'files');
}

function getDatabasePath() {
  return path.join(getFilesBaseDir(), 'UNI.db');
}

function getExcelPath() {
  return path.join(getFilesBaseDir(), 'UNI_DATA.xlsm');
}

module.exports = { getDatabasePath, getExcelPath };
