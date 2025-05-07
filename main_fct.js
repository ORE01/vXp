const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { spawn } = require('child_process');
const electron = require('electron');
const app = electron.app || electron.remote.app;
require('dotenv').config();

const {getDatabasePath} = require('./main_path');

const XLSX = require('xlsx');

const { formatDate } = require('./utils/main_format'); 




// Function to determine if in development environment
function isDevelopmentEnvironment() {
  return process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'thomasdev';
}

// Define log file path depending on the environment
const logFilePath = isDevelopmentEnvironment()
  ? path.join(__dirname, 'logfile.txt')  // Use __dirname in development
  : path.join(app.getPath('userData'), 'logfile.txt');  // Use userData path in production

function logToFile(message) {
  fs.appendFileSync(logFilePath, new Date().toISOString() + ': ' + message + '\n');
}

// DATABASE path based on the environment
let dbPath;

if (isDevelopmentEnvironment()) {
  dbPath = getDatabasePath(); // ✅ Holt den Pfad aus getDatabasePath()
  console.log('dbPath:', dbPath);
} else {
  // Relativer Pfad für die compilierte Version
  dbPath = path.join(process.resourcesPath, 'app.asar.unpacked', 'files', 'UNI.db');
}


// console.log('main_fct: __dirname:', __dirname);
// console.log('main_fct: dbPath:', dbPath);
// console.log(app.getPath('userData'));

// Replace console.log and console.error with logToFile
logToFile('main_fct: __dirname: ' + __dirname);
logToFile('main_fct: dbPath: ' + dbPath);
logToFile('UserData Path: ' + app.getPath('userData'));


// Connect to the SQLite database
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error(err.message);
        // Replace console.error
        logToFile('Database connection error: ' + err.message);
  } else {
    console.log('Connected to database! READY to ROCK and ROLL');
        // Replace console.log
        logToFile('Connected to the database.');
  }
});
// query table Names
function getAllTableNames(callback) {
  const query = "SELECT name FROM sqlite_master WHERE type='table'";
  db.all(query, (err, rows) => {
    if (err) {
      console.error(err.message);
      callback(err, null);
    } else {
      const tableNames = rows.map(row => row.name);
      callback(null, tableNames);
    }
  });
}
// query table Data
function queryDB(tableName, callback) {
  const query = `SELECT * FROM ${tableName}`;
  db.all(query, (err, rows) => {
    if (err) {
      console.error(err.message);
      callback(err, null);
    } else {
      //console.log('main_fct: queryDB: DB_Data erhalten');
      //console.log('Retrieved rows:', rows);
      setTimeout(() => {
        callback(null, rows);
      }, 10);
    }
  });
}
// update a record in the specified table
function updateRecord(tableName, rowIndex, newData, uniqueIdentifier, callback) {


  const columnNames = Object.keys(newData);
  const setClause = columnNames

  .map(columnName => {
    return `${columnName} = '${newData[columnName]}'`;
  })
  .join(', ');


  const query = `
    UPDATE ${tableName}
    SET ${setClause}
    WHERE ${uniqueIdentifier.column} = '${uniqueIdentifier.value}'`;

  db.run(query, (err) => {
    if (err) {
      console.error(err.message);
      callback(err); // Call the callback with the error
    } else {
      console.log('main_fct: updateRecord.');
      callback(null); // Call the callback without an error to indicate success
    }
  });
}

// erase a row from table
async function eraseRowFromDB(tableName, uniqueIdentifier) {
  console.log('row erased from:', tableName);
  // Perform the necessary database operation to erase the row based on the provided parameters
  return new Promise((resolve, reject) => {
    const query = `DELETE FROM ${tableName} WHERE ${uniqueIdentifier.column} = ?`;
    db.run(query, [uniqueIdentifier.value], function (error) {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}
// close the database connection
function closeDatabase() {
  db.close((err) => {
    if (err) {
      console.error(err.message);
    } else {
      console.log('Database connection closed.');
    }
  });
}



// function insertRowInTable(data, tableName, callback) {
//   const dataWithoutTradeId = { ...data };
//   delete dataWithoutTradeId.TRADE_ID; // wichtig!
  
//   const columnNames = Object.keys(dataWithoutTradeId);
//   const columnValues = Object.values(dataWithoutTradeId);
//   const placeholders = columnNames.map(() => '?').join(', ');
  
//   const query = `
//     INSERT INTO ${tableName} (${columnNames.join(', ')}) 
//     VALUES (${placeholders})
//   `;
  
//   db.run(query, columnValues, function (err) {
//     if (err) return callback(err);
  
//     console.log('✅ Data inserted. New TRADE_ID:', this.lastID);
//     callback(null, this.lastID); // kannst du auch weiterverwenden
//   });
// }

function insertRowInTable(data, tableName, callback) {
  // ✨ FORMATIERUNG DER DATEN VORAB
  const formattedData = formatDate(data); // <- wandelt TRADE_DATE z.B. um

  const dataWithoutTradeId = { ...formattedData };
  delete dataWithoutTradeId.TRADE_ID; // wichtig!

  const columnNames = Object.keys(dataWithoutTradeId);
  const columnValues = Object.values(dataWithoutTradeId);
  const placeholders = columnNames.map(() => '?').join(', ');

  const query = `
    INSERT INTO ${tableName} (${columnNames.join(', ')}) 
    VALUES (${placeholders})
  `;

  db.run(query, columnValues, function (err) {
    if (err) return callback(err);

    console.log('✅ Data inserted. New TRADE_ID:', this.lastID);
    callback(null, this.lastID);
  });
}


function insertSelection(selectionName, selectedTradeIDs) {
  return new Promise((resolve, reject) => {
    if (!Array.isArray(selectedTradeIDs)) {
      try {
        if (typeof selectedTradeIDs === 'string') {
          selectedTradeIDs = JSON.parse(selectedTradeIDs.replace(/'/g, '"'));
        } else {
          throw new Error('selectedTradeIDs must be an array or valid JSON array string');
        }
      } catch (err) {
        console.error('❌ Error parsing selectedTradeIDs:', err.message);
        reject(new TypeError('selectedTradeIDs must be an array or a valid JSON array string'));
        return;
      }
    }

    const placeholders = selectedTradeIDs.map(() => '?').join(',');

    const insertQuery = `
    INSERT INTO DealsMain (
      INCLUDE, PROD_ID, TRADE_DATE, CATEGORY, NOTIONAL, PRICE_BUY, Depotbank, port_name
    )
    SELECT 
      INCLUDE, PROD_ID, TRADE_DATE, CATEGORY, NOTIONAL, PRICE_BUY, Depotbank, ?
    FROM DealsMain
    WHERE TRADE_ID IN (${placeholders})
  `;
  

    
    console.log('✅ Final Params:', [selectionName, ...selectedTradeIDs]);

    db.run(insertQuery, [selectionName, ...selectedTradeIDs], function (err) {
      if (err) {
        console.error('❌ Error inserting new deals:', err.message);
        reject(err);
      } else {
        console.log(`✅ ${this.changes} Success inserting new Portfolio in DealsMain with port_name = '${selectionName}'`);
        resolve();
      }
    });
  });
}

function deleteTable(selectedTableName, sender) {
  const tablesToClean = ['DealsMain', 'Portfolios', 'CreditVaR', 'MarketVaR', 'EAD', 'sortedLossesIndicesMain', 'sortedLossesIssuerMain', 'sortedLossesMain']; // du kannst hier jederzeit erweitern
  let completed = 0;
  let hasError = false;

  tablesToClean.forEach((table) => {
    const deleteQuery = `DELETE FROM ${table} WHERE port_name = ?`;

    db.run(deleteQuery, [selectedTableName], function (err) {
      if (err) {
        console.error(`❌ Fehler beim Löschen aus '${table}':`, err.message);
        if (!hasError) {
          hasError = true;
          sender.send('delete-table-response', {
            success: false,
            message: `Fehler beim Löschen aus '${table}': ${err.message}`
          });
        }
        return;
      }

      console.log(`✅ ${this.changes} Zeilen aus '${table}' mit port_name='${selectedTableName}' gelöscht.`);

      completed++;

      if (completed === tablesToClean.length && !hasError) {
        sender.send('delete-table-response', {
          success: true,
          message: `Alle Einträge mit port_name='${selectedTableName}' wurden gelöscht.`
        });
      }
    });
  });
}

function startPythonScriptWithEvent(event, scriptIdentifier, eventType, args = []) {
  console.log('main_fct: startPythonScriptWithEvent:', args);

  return new Promise((resolve, reject) => {
      let pythonExecutable;
      let pythonArgs = [scriptIdentifier, ...args];

      // Bestimme die Umgebung
      const env = process.env.NODE_ENV ? process.env.NODE_ENV.trim().toLowerCase() : 'production';

      if (env === 'development') {
        // Standard-Entwicklungsumgebung mit zwei möglichen Pfaden
        const defaultExecutable = 'C:\\Python312\\python.exe';
        const defaultScriptPath = 'C:/Users/Ronald/riskApp/PycharmProjects/Risk/main.py';
    
        pythonExecutable = defaultExecutable;
        pythonArgs.unshift(defaultScriptPath);
    
    } else if (env === 'thomasdev') {
        pythonExecutable = 'C:/Users/wendlert/Desktop/valueXpro_dev/resources/bin/main/main.exe';
    
    } else { 
        // Standardmäßig Production
        pythonExecutable = path.join(__dirname, '..', '..', 'resources', 'bin', 'main', 'main.exe');
    }
    
    

      try {
          const pythonProcess = spawn(pythonExecutable, pythonArgs);
          let scriptOutput = '';  // Variable to store the collected output

          // Collect stdout data
          pythonProcess.stdout.on('data', (data) => {
              console.log(`stdout: ${data}`);
              scriptOutput += data.toString();  // Append the data to scriptOutput
              event.sender.send(`${eventType}-output`, data.toString());
          });

          // Collect stderr data (for error logging)
          pythonProcess.stderr.on('data', (data) => {
              console.error(`stderr: ${data}`);
              event.sender.send(`${eventType}-error`, data.toString());
          });

          // Handle process close
          pythonProcess.on('close', (code) => {
            if (code === 0) {
              try {
                const parsedResult = JSON.parse(scriptOutput);
                resolve(parsedResult);  // ✅ sends full result from Python back to Electron
              } catch (err) {
                console.error('❌ Failed to parse Python output:', scriptOutput);
                reject(new Error('Failed to parse Python output.'));
              }
            } else {
              reject(new Error(`Python script failed with code ${code}`));
            }
          });
          
      } catch (error) {
          console.error(`Failed to start Python script: ${error.message}`);
          reject(error);
      }
  });
}

function insertCSParameter(data, tableName, callback) {
  const query = `INSERT INTO ${tableName} (CSSzenario, a, b, c, d, e, f) VALUES (?, ?, ?, ?, ?, ?, ?)`;
  const params = [data.CSSzenario, data.a, data.b, data.c, data.d, data.e, data.f];

  db.run(query, params, function (err) {
    callback(err); // Callback to handle the response
  });
}


async function importExcelToSQLite(excelPath, sheetName, tableName, deleteCondition = null, allowedColumns = null, overwriteExisting = false) {
  console.log(`[Import] Aktueller Datenbankpfad: ${db.filename}`);

  if (!fs.existsSync(excelPath)) {
    throw new Error('Excel-Datei nicht gefunden: ' + excelPath);
  }

  const workbook = XLSX.readFile(excelPath);
  if (!workbook.SheetNames.includes(sheetName)) {
    throw new Error(`Sheet "${sheetName}" wurde nicht gefunden.`);
  }

  const worksheet = workbook.Sheets[sheetName];
  let data = XLSX.utils.sheet_to_json(worksheet);

  // Fehlende Spalten durch NaN ergänzen
  data = data.map(row => {
    allowedColumns?.forEach(col => {
      if (!(col in row) || row[col] === '') {
        row[col] = NaN;
      }
    });
    return row;
  });

  if (data.length === 0) {
    throw new Error(`Keine Daten in Sheet "${sheetName}".`);
  }

  data = data.map(row => formatDate(row, allowedColumns));

  if (data.length === 0) {
    throw new Error(`Nach dem Filtern keine gültigen Daten mehr in Sheet "${sheetName}".`);
  }

  const columns = Object.keys(data[0]);
  const placeholders = columns.map(() => '?').join(',');
  const insertSQL = `INSERT INTO "${tableName}" (${columns.map(col => `"${col}"`).join(',')}) VALUES (${placeholders})`;

  return new Promise((resolve, reject) => {
    db.serialize(() => {

      // 🔍 Tabelle prüfen und ggf. erstellen
      db.get(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`, [tableName], (err, row) => {
        if (err) return reject(err);

        if (!row) {
          const columnDefs = columns.map(col => `"${col}" TEXT`).join(', ');
          const createSQL = `CREATE TABLE IF NOT EXISTS "${tableName}" (${columns.map(col => `"${col}" TEXT`).join(',')})`;


          db.run(createSQL, (err) => {
            if (err) return reject(err);
            console.log(`🆕 Tabelle "${tableName}" wurde erstellt.`);
            proceed();
          });
        } else {
          proceed();
        }
      });

      function proceed() {
        if (deleteCondition) {
          const deleteSQL = `DELETE FROM ${tableName} WHERE ${deleteCondition}`;
          db.run(deleteSQL, function (err) {
            if (err) {
              console.error(`❌ Fehler beim Löschen in "${tableName}":`, err.message);
              return reject(err);
            }
            console.log(`🧹 Gelöscht in "${tableName}" mit Bedingung: ${deleteCondition}`);
            startInsert();
          });
        } else {
          console.log(`ℹ️ Kein deleteCondition für "${tableName}". Direkt importieren.`);
          startInsert();
        }
      }

      function startInsert() {
        if (overwriteExisting) {
          data.forEach((row, index) => {
            const prodId = row['PROD_ID'];

            if (prodId) {
              db.run(`DELETE FROM ${tableName} WHERE PROD_ID = ?`, [prodId], function (deleteErr) {
                if (deleteErr) {
                  console.error(`❌ Fehler beim Löschen (PROD_ID: ${prodId}):`, deleteErr.message);
                  return;
                }
                console.log(`🧹 Alte Zeile mit PROD_ID ${prodId} gelöscht.`);
                db.run(insertSQL, columns.map(col => row[col]), function (insertErr) {
                  if (insertErr) {
                    console.error(`❌ Fehler beim Einfügen (PROD_ID: ${prodId}):`, insertErr.message);
                  } else {
                    console.log(`✅ Neue Zeile für PROD_ID ${prodId} erfolgreich eingefügt.`);
                  }
                });
              });
            } else {
              console.warn(`⚠️ Zeile ${index + 1} hat keine PROD_ID – wird übersprungen.`);
            }
          });

          console.log(`✅ Import abgeschlossen für "${sheetName}" in "${tableName}" (mit Overwrite).`);
          resolve();
        } else {
          const stmt = db.prepare(insertSQL);
          data.forEach((row, index) => {
            const values = columns.map(col => row[col]);
            stmt.run(values, function (err) {
              if (err) {
                console.error(`❌ Fehler beim Einfügen (Zeile ${index + 1}):`, err.message);
              } else {
                console.log(`✅ Zeile ${index + 1} erfolgreich importiert.`);
              }
            });
          });

          stmt.finalize(err => {
            if (err) {
              console.error('❌ Fehler beim Finalisieren:', err.message);
              reject(err);
            } else {
              console.log(`✅ Import abgeschlossen für "${sheetName}" in "${tableName}".`);
              resolve();
            }
          });
        }
      }
    });
  });
}


async function getAllRowsFromTable(tableName) {
  // Implementiere SQL SELECT * FROM ...
  // Beispiel mit sqlite3 (promisified):
  return new Promise((resolve, reject) => {
    db.all(`SELECT * FROM ${tableName}`, [], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}











module.exports = {
  getAllTableNames,
  queryDB,
  updateRecord,
  insertRowInTable,
  eraseRowFromDB,
  closeDatabase,
  insertSelection,
  deleteTable,
  startPythonScriptWithEvent,
  insertCSParameter,
  importExcelToSQLite,
  getAllRowsFromTable
};
