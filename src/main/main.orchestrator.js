// src/main/main.orchestrator.js
'use strict';

const { startPythonScript } = require('./services/python.service');
const { importExcelToSQLite } = require('./services/excel.service');



// ✅ DB API kommt jetzt aus db.service (nicht mehr sqlite3 hier!)
const db = require('./services/db.service');

const PY_DEBUG_LOGS = true; 

// ============================================
// Python (bleibt vorerst hier, Phase 3 später)
// ============================================
function startPythonScriptWithEvent(event, scriptIdentifier, eventType, args = []) {
  return startPythonScript({
    scriptIdentifier,
    args,

    // Progress weiter an UI schicken (aber NICHT in die Konsole spammen)
    onProgress: (msg) => {
      event.sender.send('py-progress', {
        script: scriptIdentifier,
        provider: msg.provider || 'GLOBAL',
        progress: msg.progress,
        message: msg.message || ''
      });
    },

    onStdout: (line) => {
      if (PY_DEBUG_LOGS) {
        console.log(`[PY:${scriptIdentifier}] ${line}`);
      }

      // UI bekommt es trotzdem
      event.sender.send(`${eventType}-output`, line + '\n');
    },

    onStderr: (line) => {
      if (PY_DEBUG_LOGS) {
        console.error(`[PYERR:${scriptIdentifier}] ${line}`);
      }

      // UI bekommt es trotzdem
      event.sender.send(`${eventType}-error`, line + '\n');
    },



    // wieder normal (Debug war 120s)
    timeoutMs: 5 * 60 * 1000,
  }).then((res) => {
    // ✅ NUR ein kompaktes "OK" (oder kurze Info) in die Konsole
    if (res && res.status === 'ok') {
      console.log(res.message || `OK (${scriptIdentifier})`);
    } else {
      // minimaler Fehlerhinweis (ohne riesige Dumps)
      console.warn(`Python result not ok (${scriptIdentifier})`, res?.status || res);
    }
    return res;
  }).catch((err) => {
    // kompakter Fehler
    console.error(`Python failed (${scriptIdentifier}):`, err?.message || err);
    throw err;
  });
}

function startPythonScriptWithCallbacks({
  scriptIdentifier,
  eventType,
  args = [],
  onProgress,
  onStdout,
  onStderr,
}) {
  return startPythonScript({
    scriptIdentifier,
    args,

    onProgress: (msg) => {
      if (typeof onProgress === 'function') {
        onProgress({
          script: scriptIdentifier,
          provider: msg.provider || 'GLOBAL',
          progress: msg.progress,
          message: msg.message || ''
        });
      }
    },

    onStdout: (line) => {
      if (typeof onStdout === 'function') onStdout(line);
    },

    onStderr: (line) => {
      if (typeof onStderr === 'function') onStderr(line);
    },

    timeoutMs: 5 * 60 * 1000,
  }).then((res) => {
    if (res && res.status === 'ok') console.log(res.message || `OK (${scriptIdentifier})`);
    else console.warn(`Python result not ok (${scriptIdentifier})`, res?.status || res);
    return res;
  }).catch((err) => {
    console.error(`Python failed (${scriptIdentifier}):`, err?.message || err);
    throw err;
  });
}




// ============================================
// Exports
// ============================================
// ✅ DB Funktionen werden aus db.service re-exportiert
module.exports = {
  // DB API
  getAllTableNames: db.getAllTableNames,
  queryDB: db.queryDB,
  updateRecord: db.updateRecord,
  eraseRowFromDB: db.eraseRowFromDB,
  closeDatabase: db.closeDatabase,
  runSQL: db.runSQL,
  getAllRowsFromTable: db.getAllRowsFromTable,
  insertRowInTable: db.insertRowInTable,
  insertSelection: db.insertSelection,
  deleteTable: db.deleteTable,
  updateCustomerTexts: db.updateCustomerTexts,
  selectAll: db.selectAll,


  insertCSParameter: db.insertCSParameter,


  // Python
  startPythonScriptWithEvent,
  startPythonScriptWithCallbacks,

  // Excel (Phase 2)
  importExcelToSQLite,
};

