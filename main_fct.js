const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { spawn } = require('child_process');
const electron = require('electron');
const app = electron.app || electron.remote.app;
require('dotenv').config();

// Function to determine if in development environment
function isDevelopmentEnvironment() {
  return process.env.NODE_ENV === 'development';
}

// Define log file path depending on the environment
const logFilePath = isDevelopmentEnvironment()
  ? path.join(__dirname, 'logfile.txt')  // Use __dirname in development
  : path.join(app.getPath('userData'), 'logfile.txt');  // Use userData path in production

function logToFile(message) {
  fs.appendFileSync(logFilePath, new Date().toISOString() + ': ' + message + '\n');
}

// Choose the correct database path based on the environment
let dbPath;
if (isDevelopmentEnvironment()) {
  // Absoluter Pfad: für die Entwicklung (nicht compelliert)
  //dbPath = 'C:/Users/wendlert/Desktop/valueXpro_dev/resources/app.asar.unpacked/files/UNI.db';
  dbPath = 'C:/Users/Ronald/riskApp/electron_app/files/UNI.db';
  console.log('dbPath:', dbPath);
} else {
  // Relativer Pfad für die compellierte Version:
  // dbPath = 'C:/Users/wendlert/Desktop/valueXpro_dev/resources/app.asar.unpacked/files/UNI.db';
  // dbPath = 'C:/Users/wendlert/AppData/Local/Programs/merciful-front-are-3a6cn/resources/app.asar.unpacked/files/UNI.db'
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
  //const columnNames = ['START', 'END', 'VaR_Days', 'Confidence'];

  // const setClause = columnNames
  // .filter(columnName => columnName !== uniqueIdentifier.column) // Exclude unique identifier column
  // .map(columnName => {
  //   return `${columnName} = '${newData[columnName]}'`;
  // })
  // .join(', ');

  const setClause = columnNames

  .map(columnName => {
    return `${columnName} = '${newData[columnName]}'`;
  })
  .join(', ');


  const query = `
    UPDATE ${tableName}
    SET ${setClause}
    WHERE ${uniqueIdentifier.column} = '${uniqueIdentifier.value}'`;


    // console.log('newData:', newData);
    // console.log('rowIndex:', rowIndex);
    // console.log('uniqueIdentifier.column:', uniqueIdentifier.column);
    // console.log('main_fct updateRecord cleanTableName:', tableName);
    // console.log('tableName:', tableName);
    // console.log('columnNames:', columnNames);
    // console.log('setClause:', setClause);
    // console.log('uniqueIdentifier.column:', uniqueIdentifier.column);
    // console.log('uniqueIdentifier.value:', uniqueIdentifier.value);
    // console.log('Query:', query);

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
  const columnNames = Object.keys(data);
  const columnValues = Object.values(data);

  const placeholders = columnNames.map(() => '?').join(', ');
  const query = `
  INSERT INTO ${tableName} (${columnNames.join(', ')}) 
  VALUES (${placeholders})`;

  db.run(query, columnValues, function (err) {
    if (err) {
      console.error(err.message);
      callback(err);
    } else {
      console.log('main_fct: insertDeal: Data inserted erfolgreich .');
      callback(null);
    }
  });
}
// CREATE new Portfolios in DEALS
function insertSelection(selectionName, tagValues, selectedTradeIDs) {
  return new Promise((resolve, reject) => {
    const createSelectionsTableQuery = `
      CREATE TABLE IF NOT EXISTS selections (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        selection_name TEXT,
        tags TEXT,
        trade_ids TEXT
      )`;

    db.run(createSelectionsTableQuery, [], function (err) {
      if (err) {
        console.error('Error creating selections table:', err.message);
        reject(err);
        return;
      }

      console.log('Selections table created or already exists');

      const createCreatedTablesTableQuery = `
        CREATE TABLE IF NOT EXISTS createdDeals (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          table_name TEXT
        )`;

      db.run(createCreatedTablesTableQuery, [], function (err) {
        if (err) {
          console.error('Error creating createdDeals table:', err.message);
          reject(err);
          return;
        }

        console.log('Created tables table created or already exists');

        const createNewTableQuery = `
          CREATE TABLE IF NOT EXISTS ${selectionName} AS
          SELECT *
          FROM DealsMain
          WHERE TRADE_ID IN (${selectedTradeIDs.join(',')})`;

        db.run(createNewTableQuery, [], function (err) {
          if (err) {
            console.error('Error creating new table:', err.message);
            reject(err);
            return;
          }

          console.log(`New table '${selectionName}' created successfully`);

          const insertTableNameQuery = `
            INSERT INTO createdDeals (table_name) 
            VALUES (?)`;

          db.run(insertTableNameQuery, [selectionName], function (err) {
            if (err) {
              console.error('Error inserting table name:', err.message);
              reject(err);
              return;
            }

            console.log(`Table name '${selectionName}' inserted into tracking table`);

            const tagsValue = tagValues.length > 0 ? tagValues.join(',') : null;
            const insertSelectionQuery = `
              INSERT INTO selections (selection_name, tags, trade_ids) 
              VALUES (?, ?, ?)`;

            db.run(insertSelectionQuery, [selectionName, tagsValue, selectedTradeIDs.join(',')], function (err) {
              if (err) {
                console.error('Error inserting selection:', err.message);
                reject(err);
              } else {
                console.log('Selection inserted successfully');
                resolve();
              }
            });
          });
        });
      });
    });
  });
}
// DELETE the created Portfolios in DEALS
function deleteTable(selectedTableName, sender) {
  console.log('deleteTable: selectedTableName', selectedTableName);

  // Function to delete a table entry from a specified auxiliary table
  function deleteTableEntry(auxTable, columnName, columnValue) {
    const query = `DELETE FROM ${auxTable} WHERE ${columnName} = ?`;
    db.run(query, [columnValue], (err) => {
      if (err) {
        console.error(`Error deleting entry with ${columnName} "${columnValue}" from "${auxTable}":`, err.message);
        sender.send('table-entry-deletion-error', { tableName: selectedTableName, auxTable, message: err.message });
      } else {
        console.log(`Entry with ${columnName} "${columnValue}" has been deleted from "${auxTable}".`);
      }
    });
  }

  // Delete the main table with prefix Deals
  const queryDeals = `DROP TABLE IF EXISTS ${selectedTableName}`;
  db.run(queryDeals, (err) => {
    if (err) {
      console.error(`Error deleting table "${selectedTableName}":`, err.message);
      sender.send('table-deletion-error', { tableName: selectedTableName, message: err.message });
    } else {
      console.log(`Table "${selectedTableName}" has been deleted.`);

      // Identify the corresponding Port table and delete it
      const portTableName = selectedTableName.replace(/^Deals/, 'Port');
      const queryPort = `DROP TABLE IF EXISTS ${portTableName}`;
      db.run(queryPort, (err) => {
        if (err) {
          console.error(`Error deleting table "${portTableName}":`, err.message);
          sender.send('table-deletion-error', { tableName: portTableName, message: err.message });
        } else {
          console.log(`Table "${portTableName}" has been deleted.`);

          // Assuming the correct column names in createdDeals, selections, and createdPort tables
          const dealsColumnName = 'table_name'; // Adjust if necessary
          const portColumnName = 'table_name'; // Adjust if necessary
          const selectionColumnName = 'selection_name'; // Adjust based on your schema

          // Delete entries from auxiliary tables
          deleteTableEntry('createdDeals', dealsColumnName, selectedTableName);
          deleteTableEntry('selections', selectionColumnName, selectedTableName);

          deleteTableEntry('createdPort', portColumnName, portTableName);

          // Identify the corresponding MVarPort tables and delete them
          const mvarTableName = selectedTableName.replace(/^Deals/, 'MVarPort').replace(/$/, 'Main');
          const queryMVar = `DROP TABLE IF EXISTS ${mvarTableName}`;
          db.run(queryMVar, (err) => {
            if (err) {
              console.error(`Error deleting table "${mvarTableName}":`, err.message);
              sender.send('table-deletion-error', { tableName: mvarTableName, message: err.message });
            } else {
              console.log(`Table "${mvarTableName}" has been deleted.`);

              const mvarRelTableName = selectedTableName.replace(/^Deals/, 'MVarPort').replace(/$/, 'Main_rel');
              const queryMVarRel = `DROP TABLE IF EXISTS ${mvarRelTableName}`;
              db.run(queryMVarRel, (err) => {
                if (err) {
                  console.error(`Error deleting table "${mvarRelTableName}":`, err.message);
                  sender.send('table-deletion-error', { tableName: mvarRelTableName, message: err.message });
                } else {
                  console.log(`Table "${mvarRelTableName}" has been deleted.`);

                  // Identify the corresponding CVarPort_rel table and delete it
                  const cvarRelTableName = `${selectedTableName.replace(/^Deals/, 'CVarPort')}Main_rel`;
                  const queryCVarRel = `DROP TABLE IF EXISTS ${cvarRelTableName}`;
                  db.run(queryCVarRel, (err) => {
                    if (err) {
                      console.error(`Error deleting table "${cvarRelTableName}":`, err.message);
                      sender.send('table-deletion-error', { tableName: cvarRelTableName, message: err.message });
                    } else {
                      console.log(`Table "${cvarRelTableName}" has been deleted.`);

                      // Notify about the successful deletion
                      sender.send('table-deleted-successfully', {
                        dealsTable: selectedTableName,
                        portTable: portTableName,
                        mvarTable: mvarTableName,
                        mvarRelTable: mvarRelTableName,
                        cvarRelTable: cvarRelTableName
                      });
                      console.log(`'table-deleted-successfully' "${selectedTableName}", "${portTableName}", "${mvarTableName}", "${mvarRelTableName}", and "${cvarRelTableName}"`);
                    }
                  });
                }
              });
            }
          });
        }
      });
    }
  });
}

// Generalized function to start Python scripts
function startPythonScriptWithEvent(event, scriptIdentifier, eventType, args = []) {
  console.log('main_fct: startPythonScriptWithEvent:', args);
  return new Promise((resolve, reject) => {
    let pythonExecutable;
    let pythonArgs = [scriptIdentifier, ...args];

    // Determine the Python executable based on the environment
    if (isDevelopmentEnvironment()) {
      pythonExecutable = 'C:\\Python312\\python.exe';  // Path to Python executable
      pythonArgs.unshift('C:/Users/wendlert/Desktop/valueXpro_dev/resources/bin/main/main.py');  // Full path to main.py
    } else {
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
        // console.log(`Python process exited with code_main_fct ${code}`);
        if (code === 0) {
          // console.log("Python script executed successfully.");
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
