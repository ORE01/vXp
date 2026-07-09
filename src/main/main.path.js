// src/main/services/main.path.js
'use strict';

const path = require('path');
const fs = require('fs');
const { app } = require('electron');
const { logger } = require('./utils/logger');

// ── User-Settings (persistent, userData): Excel-Input-Overrides ──
// key -> Standard-Dateiname (Ableitung aus UNI_DB_PATH, wenn kein Override)
const EXCEL_KEY_FILE = { business: 'UNI_DATA.xlsm', market: 'MARKET_DATA.xlsm' };
// key -> Env-Name fuer den Python-Spawn (Override-Pfad ZUR DATEI)
const EXCEL_KEY_ENV = { business: 'UNI_DATA_PATH', market: 'MARKET_DATA_PATH' };

function getSettingsPath() {
  try { return path.join(app.getPath('userData'), 'valuexpro-settings.json'); } catch { return null; }
}
function readSettings() {
  const p = getSettingsPath();
  if (!p) return {};
  try { return JSON.parse(fs.readFileSync(p, 'utf8')) || {}; } catch { return {}; }
}
function writeSettings(obj) {
  const p = getSettingsPath();
  if (!p) return false;
  try { fs.writeFileSync(p, JSON.stringify(obj || {}, null, 2), 'utf8'); return true; }
  catch (e) { logger.info('settings', `write failed: ${e.message}`); return false; }
}
// Gesetzter Override-Pfad (Datei) fuer 'business' | 'market', oder null.
function getExcelOverride(key) {
  const v = readSettings()?.excelInputs?.[key];
  return (typeof v === 'string' && v.trim()) ? v.trim() : null;
}
function setExcelOverride(key, filePath) {
  if (!EXCEL_KEY_FILE[key]) return false;
  const s = readSettings();
  s.excelInputs = s.excelInputs || {};
  if (filePath) s.excelInputs[key] = String(filePath);
  else delete s.excelInputs[key];
  return writeSettings(s);
}
// Env-Overrides fuer den Python-Spawn (nur gesetzte Keys).
function getExcelEnvOverrides() {
  const env = {};
  for (const key of Object.keys(EXCEL_KEY_ENV)) {
    const ov = getExcelOverride(key);
    if (ov) env[EXCEL_KEY_ENV[key]] = ov;
  }
  return env;
}

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
    baseDir = path.join(process.resourcesPath, 'files');
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

// Effektiver Pfad einer Input-Datei fuer die UI-Anzeige: Override (falls gesetzt) oder
// die Standard-Ableitung aus dem files/-Ordner. key = 'business' | 'market'.
function getEffectiveExcelPath(key) {
  const ov = getExcelOverride(key);
  if (ov) return { path: ov, isOverride: true };
  const fname = EXCEL_KEY_FILE[key];
  return { path: fname ? getExcelPath(fname) : null, isOverride: false };
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

  // Excel-Input-Overrides (SETUP-Dialog)
  getExcelOverride,
  setExcelOverride,
  getExcelEnvOverrides,
  getEffectiveExcelPath,

  // optional: legacy support
  getExcelPathLegacy: getUniDataPath,
};






