// src/main/services/main_path.js
'use strict';

const path = require('path');
const { app } = require('electron');

// function getFilesBaseDir() {
//   const packaged = app.isPackaged;

//   const baseDir = packaged
//     ? path.join(process.resourcesPath, 'files')
//     : path.join(process.cwd(), 'files');

//   // ✅ DEBUG LOGS
//   console.log('-----------------------------');
//   console.log('[paths] app.isPackaged:', packaged);
//   console.log('[paths] process.resourcesPath:', process.resourcesPath);
//   console.log('[paths] app.getAppPath():', app.getAppPath());
//   console.log('[paths] process.cwd():', process.cwd());
//   console.log('[paths] resolved files baseDir:', baseDir);
//   console.log('-----------------------------');

//   return baseDir;
// }

function getFilesBaseDir() {

  const env = (process.env.NODE_ENV || '').trim().toLowerCase();
  const packaged = app.isPackaged;

  let baseDir;

  if (env === 'thomasdev') {
    // bleibt wie bisher
    baseDir = path.join(process.cwd(), 'files');
  }
  else if (packaged) {
    // 🔥 NUR PRODUCTION FIX
    baseDir = path.join(app.getPath('userData'), 'files');
  }
  else {
    // development (dein aktuelles Verhalten)
    baseDir = path.join(process.cwd(), 'files');
  }

  console.log('-----------------------------');
  console.log('[ENV]', env);
  console.log('[paths] app.isPackaged:', packaged);
  console.log('[paths] baseDir:', baseDir);
  console.log('-----------------------------');

  return baseDir;
}

// function getDatabasePath() {
//   const dbPath = path.join(getFilesBaseDir(), 'UNI.db');
//   console.log('[paths] Database path:', dbPath);
//   return dbPath;
// }

// function getDatabasePath() {

//   const env = (process.env.NODE_ENV || '').trim().toLowerCase();

//   let dbFile = 'UNI.db';

//   if (env === 'thomasdev') {
//     dbFile = 'UNI_THOMAS.db';
//     console.log('THOMAS DEV DB AKTIV');
//   }

//   const dbPath = path.join(getFilesBaseDir(), dbFile);

//   console.log('[paths] Database path:', dbPath);

//   return dbPath;
// }


// function getExcelPath() {
//   const excelPath = path.join(getFilesBaseDir(), 'UNI_DATA.xlsm');
//   console.log('[paths] Excel path:', excelPath);
//   return excelPath;
// }

function getDatabasePath() {

  const env = (process.env.NODE_ENV || '').trim().toLowerCase();

  // 🔥 THOMAS DEV → FIXER PFAD (wie gewünscht)
  if (env === 'thomasdev') {
    const dbPath = 'C:/Users/wendlert/Desktop/valueXpro_dev/resources/app.asar.unpacked/files/UNI.db';
    console.log('[THOMASDEV] DB PATH:', dbPath);
    return dbPath;
  }

  // default (lass es erstmal wie es war)
  const dbPath = path.join(getFilesBaseDir(), 'UNI.db');
  console.log('[DEFAULT] DB PATH:', dbPath);
  return dbPath;
}


function getExcelPath() {

  const env = (process.env.NODE_ENV || '').trim().toLowerCase();

  if (env === 'thomasdev') {
    // const excelPath = '\\\\pers.ad.uni-graz.at\\fs\\ou\\811\\Banken_Finanzstatus\\_Veranlagungen_Riskmanagement\\vXp\\UNI_DATA.xlsm';
    const excelPath = 'C:/Users/wendlert/Desktop/valueXpro_dev/resources/app.asar.unpacked/files/UNI_DATA.xlsm';
    console.log('[THOMASDEV] EXCEL PATH:', excelPath);
    return excelPath;
  }

  const excelPath = path.join(getFilesBaseDir(), 'UNI_DATA.xlsm');
  console.log('[DEFAULT] EXCEL PATH:', excelPath);
  return excelPath;
}

module.exports = {
  getFilesBaseDir,
  getDatabasePath,
  getExcelPath,
};

