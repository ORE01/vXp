// src/main/services/filePaths.service.js
'use strict';

const path = require('path');
const { app } = require('electron');

function getFilesBaseDir() {
  const packaged = app.isPackaged;

  const baseDir = packaged
    ? path.join(process.resourcesPath, 'files')
    : path.join(process.cwd(), 'files');

  // ✅ DEBUG LOGS
  console.log('-----------------------------');
  console.log('[paths] app.isPackaged:', packaged);
  console.log('[paths] process.resourcesPath:', process.resourcesPath);
  console.log('[paths] app.getAppPath():', app.getAppPath());
  console.log('[paths] process.cwd():', process.cwd());
  console.log('[paths] resolved files baseDir:', baseDir);
  console.log('-----------------------------');

  return baseDir;
}

function getDatabasePath() {
  const dbPath = path.join(getFilesBaseDir(), 'UNI.db');
  console.log('[paths] Database path:', dbPath);
  return dbPath;
}

function getExcelPath() {
  const excelPath = path.join(getFilesBaseDir(), 'UNI_DATA.xlsm');
  console.log('[paths] Excel path:', excelPath);
  return excelPath;
}

module.exports = {
  getFilesBaseDir,
  getDatabasePath,
  getExcelPath,
};

