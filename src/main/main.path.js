// src/main/services/main.path.js
'use strict';

const path = require('path');
const { app } = require('electron');
const { logger } = require('./utils/logger');

function getEnv() {
  return (process.env.NODE_ENV || '').trim().toLowerCase();
}

function getFilesBaseDir() {
  const env = getEnv();
  const packaged = app.isPackaged;

  let baseDir;

  if (env === 'thomasdev') {
    baseDir = path.join(process.cwd(), 'files');
  } else if (packaged) {
    baseDir = path.join(app.getPath('userData'), 'files');
  } else {
    baseDir = path.join(process.cwd(), 'files');
  }

  logger.debug('paths', `env: ${env || 'undefined'}`);
  logger.debug('paths', `app.isPackaged: ${packaged}`);
  logger.info('paths', `baseDir: ${baseDir}`);

  return baseDir;
}

function getDatabasePath() {
  const env = getEnv();

  if (env === 'thomasdev') {
    const dbPath = 'C:/Users/wendlert/Desktop/valueXpro_dev/resources/app.asar.unpacked/files/UNI.db';
    logger.info('DB', `THOMASDEV path: ${dbPath}`);
    return dbPath;
  }

  const dbPath = path.join(getFilesBaseDir(), 'UNI.db');
  logger.info('DB', `path: ${dbPath}`);
  return dbPath;
}

// 🔥 ZENTRALE FUNKTION (GENAU DAS IST DER GAMECHANGER)
function getExcelPath(fileName) {
  const env = getEnv();

  if (!fileName) {
    throw new Error('[getExcelPath] fileName is required');
  }

  if (env === 'thomasdev') {
    const excelPath = `C:/Users/wendlert/Desktop/valueXpro_dev/resources/app.asar.unpacked/files/${fileName}`;
    logger.info('EXCEL', `THOMASDEV path: ${excelPath}`);
    return excelPath;
  }

  const excelPath = path.join(getFilesBaseDir(), fileName);
  logger.info('EXCEL', `path: ${excelPath}`);
  return excelPath;
}

// 🔥 KLARE ENTRY POINTS (LESBAR + SICHER)
function getUniDataPath() {
  return getExcelPath('UNI_DATA.xlsm');
}

function getMarketDataPath() {
  return getExcelPath('MARKET_DATA.xlsm');
}

module.exports = {
  getFilesBaseDir,
  getDatabasePath,

  // neue Struktur
  getExcelPath,
  getUniDataPath,
  getMarketDataPath,

  // optional: legacy support
  getExcelPathLegacy: getUniDataPath,
};






// // src/main/services/main.path.js
// 'use strict';

// const path = require('path');
// const { app } = require('electron');
// const { logger } = require('./utils/logger');

// function getEnv() {
//   return (process.env.NODE_ENV || '').trim().toLowerCase();
// }

// function getFilesBaseDir() {
//   const env = getEnv();
//   const packaged = app.isPackaged;

//   let baseDir;

//   if (env === 'thomasdev') {
//     baseDir = path.join(process.cwd(), 'files');
//   } else if (packaged) {
//     baseDir = path.join(app.getPath('userData'), 'files');
//   } else {
//     baseDir = path.join(process.cwd(), 'files');
//   }

//   logger.debug('paths', `env: ${env || 'undefined'}`);
//   logger.debug('paths', `app.isPackaged: ${packaged}`);
//   logger.info('paths', `baseDir: ${baseDir}`);

//   return baseDir;
// }

// function getDatabasePath() {
//   const env = getEnv();

//   if (env === 'thomasdev') {
//     const dbPath = 'C:/Users/wendlert/Desktop/valueXpro_dev/resources/app.asar.unpacked/files/UNI.db';
//     logger.info('DB', `THOMASDEV path: ${dbPath}`);
//     return dbPath;
//   }

//   const dbPath = path.join(getFilesBaseDir(), 'UNI.db');
//   logger.info('DB', `path: ${dbPath}`);
//   return dbPath;
// }

// function getExcelPath() {
//   const env = getEnv();

//   if (env === 'thomasdev') {
//     const excelPath = 'C:/Users/wendlert/Desktop/valueXpro_dev/resources/app.asar.unpacked/files/UNI_DATA.xlsm';
//     logger.info('EXCEL', `THOMASDEV path: ${excelPath}`);
//     return excelPath;
//   }

//   const excelPath = path.join(getFilesBaseDir(), 'UNI_DATA.xlsm');
//   logger.info('EXCEL', `path: ${excelPath}`);
//   return excelPath;
// }

// module.exports = {
//   getFilesBaseDir,
//   getDatabasePath,
//   getExcelPath,
// };

