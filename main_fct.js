const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { spawn } = require('child_process');
const electron = require('electron');
const app = electron.app || electron.remote.app;
require('dotenv').config();

const {getDatabasePath} = require('./main_path');



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
  console.log('tableName to erase row from:', tableName);
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

function insertDeal(data, tableName, callback) {
  const {
    INCLUDE,
    PROD_ID,
    TRADE_DATE,
    CATEGORY,
    NOTIONAL,
    PRICE_BUY,
    Depotbank,
    port_name
  } = data;

  const insertQuery = `
    INSERT INTO ${tableName} (
      INCLUDE, PROD_ID, TRADE_DATE, CATEGORY, NOTIONAL, PRICE_BUY, Depotbank, port_name
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `;

  db.run(insertQuery, [INCLUDE, PROD_ID, TRADE_DATE, CATEGORY, NOTIONAL, PRICE_BUY, Depotbank, port_name], callback);
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
                  resolve({ success: true, message: "Python script executed successfully." });
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


module.exports = { getAllTableNames, queryDB, updateRecord,  insertDeal, eraseRowFromDB, closeDatabase, insertSelection, deleteTable, startPythonScriptWithEvent, insertCSParameter};
