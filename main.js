const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { getAllTableNames, 
        queryDB, 
        updateRecord,  
        insertRowInTable, 
        eraseRowFromDB, 
        closeDatabase, 
        insertSelection, 
        deleteTable, 
        startPythonScriptWithEvent, 
        handlePythonProgress, 
        insertCSParameter, 
        importExcelToSQLite, 
        runSQL,
        db,
        getAllRowsFromTable} = require('./main_fct');

const { formatColumns, formatDate} = require('./utils/main_format');

const {getExcelPath} = require('./main_path');

require('dotenv').config();

const { spawn } = require('child_process');

const XLSX = require('xlsx');

const sqlite3 = require('sqlite3').verbose();

let mainWindow;
let tableNames;



ipcMain.handle('import-excel-dialog', async (event, options = {}) => {
  try {
    // const sheetFilter = options.sheetFilter || null;  // z. B. ['EUSW']
        // ⚠️ geändert: sichere Prüfung, ob sheetFilter ein Array ist
    const sheetFilter = Array.isArray(options.sheetFilter) ? options.sheetFilter : null;
    const excelPath = getExcelPath();

    // Mapping der Sheets → Tabellen
    const mappings = [
      { 
        sheetName: 'INPUT_DEALS', 
        tableName: 'DealsMain',
        allowedColumns: [
          'INCLUDE', 'TRADE_ID', 'PROD_ID', 'CATEGORY', 'NOTIONAL',
          'PRICE_BUY', 'TRADE_DATE', 'Depotbank', 'port_name'
        ],
        deleteCondition: "port_name = 'UNI'" 
      },
      { 
        sheetName: 'INPUT_BONDS', 
        tableName: 'ProdAll', 
        allowedColumns: [
          'INCLUDE', 'PROD_ID', 'DESCRIPTION', 'START_DATE', 'MATURITY',
          'COUPON', 'SCHEDULE', 'GEARING', 'SPREADS', 'CAP', 'FLOOR', 'TENOR',
          'CouponType', 'ISSUER', 'TICKER', 'CS_Szenario', 'RATING_PROD', 'RANK'
        ],
        overwriteExisting: true
      },
      {
        sheetName: 'INPUT_ISSUER',
        tableName: 'Issuer',
        allowedColumns: [
          'INCLUDE', 'ISSUER', 'TICKER', 'RATING',
          'senior_secured', 'senior_preferred', 'senior_unsecured',
          'senior_subordinated', 'junior_subordinated'
        ],
        deleteCondition: "1 = 1"
      },
      { 
        sheetName: 'INPUT_RANK', 
        tableName: 'Rank', 
        allowedColumns: [
          'RANK', 'STEPS'
        ],
        deleteCondition: "1 = 1" 
      },
      { 
        sheetName: 'EUSW', 
        tableName: 'EUSW', 
        allowedColumns: [
          'instrument', 'YEAR', 'EUSWAP', 'EUSWAP_SZ1'
        ],
        deleteCondition: "1 = 1" 
      },
      {
        sheetName: 'INPUT_LGT',
        tableName: 'LGT',
        deleteCondition: "1 = 1"
      }
      
    ];

    for (const { sheetName, tableName, deleteCondition, allowedColumns, overwriteExisting } of mappings) {
      // Falls sheetFilter gesetzt ist → nur gefilterte Sheets importieren
      if (sheetFilter && !sheetFilter.includes(sheetName)) {
        console.log(`⏭️ Sheet ${sheetName} wird übersprungen (nicht im Filter enthalten).`);
        continue;
      }

      console.log(`🚀 Importiere ${sheetName} → ${tableName}`);
      await importExcelToSQLite(excelPath, sheetName, tableName, deleteCondition, allowedColumns, overwriteExisting);
    }

    // Tabellen nach dem Import aktualisieren
    const tablesToRefresh = ['DealsMain', 'ProdAll', 'EUSW', 'Issuer'];

    tablesToRefresh.forEach(table => {
      refreshTable(table, () => {
        console.log('Refreshed table:', table);
      });
    });

    return { success: true };

  } catch (err) {
    console.error('❌ Fehler beim Excel-Import:', err);
    return { success: false, error: err.message };
  }
});


ipcMain.handle('start-offer-import', async () => {
  try {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Excel-Datei für Portfolio auswählen',
      filters: [{ name: 'Excel Files', extensions: ['xlsx', 'xls'] }],
      properties: ['openFile']
    });

    if (canceled || filePaths.length === 0) {
      return { success: false, error: 'Keine Datei gewählt.' };
    }

    const filePath = filePaths[0];
    const fileName = path.basename(filePath, path.extname(filePath)); // z. B. "myportfolio"
    const workbook = XLSX.readFile(filePath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet);

    if (rows.length === 0) {
      return { success: false, error: 'Excel-Datei enthält keine Daten.' };
    }

    // Tabelle erstellen und Daten speichern
    await createTableFromRows(fileName, rows); // ← eigene Funktion, siehe unten

    // Spalten von DealsMain & der neuen Tabelle holen
    const dealsMainColumns = await getTableColumns('DealsMain');
    const tempTableColumns = await getTableColumns(fileName);

    return {
      success: true,
      tempTableName: fileName,
      dealsMainColumns,
      tempTableColumns
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// Temporäre Tabelle anlegen für Spaltenvergleich
async function createTableFromRows(tableName, rows) {
  const sample = rows[0];
  const columns = Object.keys(sample);

  const createSQL = `CREATE TABLE IF NOT EXISTS ${tableName} (${columns.map(c => `"${c}" TEXT`).join(", ")})`;
  await runSQL(createSQL);

  const insertSQL = `INSERT INTO ${tableName} (${columns.map(c => `"${c}"`).join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`;

  for (const row of rows) {
    const values = columns.map(c => row[c] ?? null);
    await runSQL(insertSQL, values);
  }
}

// Spalten einer Tabelle lesen
async function getTableColumns(tableName) {
  return new Promise((resolve, reject) => {
    db.all(`PRAGMA table_info(${tableName})`, [], (err, rows) => {
      if (err) reject(err);
      else resolve(rows.map(r => r.name));
    });
  });
}


ipcMain.on('import-matched-columns', async (event, { sourceTable, targetTable, columnMap, additionalFields }) => {
  const rows = await getAllRowsFromTable(sourceTable);
  for (const row of rows) {
    const newRow = {};
    columnMap.forEach(({ from, to }) => {
      newRow[to] = row[from];
    });
    Object.entries(additionalFields).forEach(([k, v]) => {
      newRow[k] = v;
    });
    await insertRowInTable(newRow, targetTable, (err) => {
  if (err) {
    console.error(`❌ Fehler beim Einfügen in ${targetTable}:`, err);
  } else {
    console.log(`✅ Eingefügt in ${targetTable}`);
  }
});

  }

  event.reply('import-matched-columns-complete', {
    success: true,
    message: `Import abgeschlossen für ${sourceTable}`
  });
});



// ipcMain.handle('import-excel-dialog-offers', async (event, options = {}) => {
//   try {
//     // Sichere Prüfung, ob sheetFilter ein Array ist
//     const sheetFilter = Array.isArray(options.sheetFilter) ? options.sheetFilter : null;

//     // 📂 Zeige Datei-Auswahldialog
//     const { canceled, filePaths } = await dialog.showOpenDialog({
//       title: 'Excel-Datei auswählen',
//       filters: [{ name: 'Excel Files', extensions: ['xlsx', 'xls'] }],
//       properties: ['openFile']
//     });

//     if (canceled || filePaths.length === 0) {
//       return { success: false, error: 'Import abgebrochen.' };
//     }

//     const excelPath = filePaths[0]; // ⬅️ gewählter Pfad statt getExcelPath()

//     // Mapping der Sheets → Tabellen
//     const mappings = [
//       { 
//         sheetName: 'INPUT_DEALS', 
//         tableName: 'DealsMain',
//         allowedColumns: [
//           'INCLUDE', 'TRADE_ID', 'PROD_ID', 'CATEGORY', 'NOTIONAL',
//           'PRICE_BUY', 'TRADE_DATE', 'Depotbank', 'port_name'
//         ],
//         deleteCondition: "port_name = 'UNI'" 
//       },
//       { 
//         sheetName: 'INPUT_BONDS', 
//         tableName: 'ProdAll', 
//         allowedColumns: [
//           'INCLUDE', 'PROD_ID', 'DESCRIPTION', 'START_DATE', 'MATURITY',
//           'COUPON', 'SCHEDULE', 'GEARING', 'SPREADS', 'CAP', 'FLOOR', 'TENOR',
//           'CouponType', 'ISSUER', 'TICKER', 'CS_Szenario', 'RATING_PROD', 'RANK'
//         ],
//         overwriteExisting: true
//       },
//       {
//         sheetName: 'INPUT_ISSUER',
//         tableName: 'Issuer',
//         allowedColumns: [
//           'INCLUDE', 'ISSUER', 'TICKER', 'RATING',
//           'senior_secured', 'senior_preferred', 'senior_unsecured',
//           'senior_subordinated', 'junior_subordinated'
//         ],
//         deleteCondition: "1 = 1"
//       },
//       { 
//         sheetName: 'INPUT_RANK', 
//         tableName: 'Rank', 
//         allowedColumns: [
//           'RANK', 'STEPS'
//         ],
//         deleteCondition: "1 = 1" 
//       },
//       { 
//         sheetName: 'EUSW', 
//         tableName: 'EUSW', 
//         allowedColumns: [
//           'instrument', 'YEAR', 'EUSWAP', 'EUSWAP_SZ1'
//         ],
//         deleteCondition: "1 = 1" 
//       },
//       {
//         sheetName: 'INPUT_LGT',
//         tableName: 'LGT',
//         deleteCondition: "1 = 1"
//       }
//     ];

//     for (const { sheetName, tableName, deleteCondition, allowedColumns, overwriteExisting } of mappings) {
//       // Falls sheetFilter gesetzt ist → nur gefilterte Sheets importieren
//       if (sheetFilter && !sheetFilter.includes(sheetName)) {
//         console.log(`⏭️ Sheet ${sheetName} wird übersprungen (nicht im Filter enthalten).`);
//         continue;
//       }

//       console.log(`🚀 Importiere ${sheetName} → ${tableName}`);
//       await importExcelToSQLite(excelPath, sheetName, tableName, deleteCondition, allowedColumns, overwriteExisting);
//     }

//     // Tabellen nach dem Import aktualisieren
//     const tablesToRefresh = ['DealsMain', 'ProdAll', 'EUSW', 'Issuer'];

//     tablesToRefresh.forEach(table => {
//       refreshTable(table, () => {
//         console.log('Refreshed table:', table);
//       });
//     });

//     return { success: true };

//   } catch (err) {
//     console.error('❌ Fehler beim Excel-Import:', err);
//     return { success: false, error: err.message };
//   }
// });



function createWindow() {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 800,
    height: 700,
    icon: path.join(__dirname, 'vXp.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      devTools: true,
    },
  });

  // and load the index.html of the app.
  mainWindow.loadFile('index.html');

  // Open the DevTools.
  mainWindow.webContents.openDevTools();
}

function fetchDataAndSendEvent(query, event) {
  queryDB(query, (err, rows) => {
    if (err) {
      console.error("Error fetching data:", err.message);
      return;
    }

    if (rows.length === 0) {
      console.log("No data available.");
      return;
    }

    const formattedRows = formatColumns(rows);
    mainWindow.webContents.send(event, formattedRows);
  });
}


function sendDataToRenderer() {
  //console.log('tableNames:', tableNames);
  tableNames.forEach(tableName => {
    //console.log('query:', tableName);
    fetchDataAndSendEvent(tableName, `${tableName}Data`);
  });
}
// TABELLEN EINGABE: Loop mit fetchDataAndSendEvent
// Array of selected table names
getAllTableNames((err, receivedTableNames) => {
  if (err) {
    console.error('Error retrieving table names:', err.message);
  } else {
    //console.log('receivedTableNames:', receivedTableNames);

    // Filter out excluded table names
    const excludedTableNames = ['sqlite_sequence', 'Instruments', 'PDMain', 'MVaRMainDist' , 'sortedLossesIndicesMain']; // Add any other names you want to exclude
    tableNames = receivedTableNames.filter(tableName => !excludedTableNames.includes(tableName));
    
    sendDataToRenderer(tableNames);
  }
});

ipcMain.on('start-py-fairValue', async (event, args) => {
  //console.log('📥 start-py-fairValue: Received args:', args);

  const { tableName, CSSzenario, selectedCurve } = args;

  if (!tableName || !CSSzenario || !selectedCurve) {
    console.error('❌ Missing required arguments.');
    event.reply('py-fairValue-complete', {
      success: false,
      projectName: 'py-fairValue',
      message: 'Arguments "tableName", "CSSzenario" and "selectedCurve" are all required.'
    });
    event.reply('project-finished', {
      success: false,
      projectName: 'py-fairValue'
    });
    return;
  }

  try {
    const pythonArgs = ['--table', tableName, '--CSSzenario', CSSzenario, '--selectedCurve', selectedCurve];
    //console.log('🚀 Starting Python script with args:', pythonArgs);

    const result = await startPythonScriptWithEvent(event, 'fvo', 'py-fairValue', pythonArgs);
    //console.log('✅ Python script executed successfully:', result);

    // Tabelle nach Abschluss aktualisieren
    refreshTable('Portfolios', () => {
      //console.log('🔄 Refreshed table: Portfolios');
    });

    event.reply('py-fairValue-complete', {
      success: true,
      projectName: 'py-fairValue',
      tableName: tableName,
      result
    });

    event.reply('project-finished', {
      success: true,
      projectName: 'py-fairValue'
    });

  } catch (error) {
    console.error('❌ Error during fair value script:', error);

    event.reply('py-fairValue-complete', {
      success: false,
      projectName: 'py-fairValue',
      error: error.message || error.toString(),
      tableName
    });

    event.reply('project-finished', {
      success: false,
      projectName: 'py-fairValue'
    });
  }
});
ipcMain.on('start-py-MVaR', async (event, args) => {
  //console.log('start-py-MVaR:', args);

  const { tableName } = args;
  const tablesToRefresh = ['MarketVaR'];

  if (!tableName) {
    console.error('❌ Missing required argument: "tableName".');
    event.reply('py-mvar-complete', {
      success: false,
      projectName: 'py-MVaR',
      message: '"tableName" is required.',
    });
    return;
  }

  startPythonScriptWithEvent(event, 'mvar', 'py-MVaR', ['--table', tableName])
    .then(() => {
      //console.log('Python script executed successfully');

      // Non-blocking refresh like CVaR
      tablesToRefresh.forEach(table => {
        refreshTable(table, () => {
          //console.log('Refreshed table:', table);
        });
      });

      //console.log('All tables refresh initiated');
    })
    .catch(error => {
      console.error('❌ Python script execution failed:', error);
    })
    .finally(() => {
      event.reply('py-mvar-complete', { success: true, projectName: 'py-MVaR' });  // Add this line
      event.reply('project-finished', { success: true, projectName: 'py-MVaR' });  // Keep if needed for other handlers
    });
    
});
ipcMain.on('start-py-CVaR', async (event, args) => {
  //console.log('start-py-CVaR:', args);

  // Define the tables to be used in the script and for refreshing
  const tablesToRefresh = [
    'EAD', 
    'CreditVaR', 
    'sortedLossesMain',
    'sortedLossesIssuerMain',
    'sortedLossesIndicesMain'
  ];

  // Extract `tableName` and `CSSzenario` from arguments
  const { tableName, CSSzenario } = args; 

  if (!tableName || !CSSzenario) {
    console.error('❌ Missing required arguments: "tableName" or "CSSzenario".');
    event.reply('py-CVaR-complete', {
      success: false,
      projectName: 'py-CVaR',
      message: 'Both "tableName" and "CSSzenario" are required.',
    });
    return; // Exit if any argument is missing
  }

  const pythonArgs = ['--table', tableName, '--CSSzenario', CSSzenario];
  //console.log('Starting Python script with arguments:', pythonArgs);

  startPythonScriptWithEvent(event, 'cvar', 'py-CVaR', pythonArgs)
    .then(() => {
      //console.log('Python script executed successfully');

      // Refresh each table using a distinct variable name
      tablesToRefresh.forEach(table => {
        refreshTable(table, () => {
          //console.log('Refreshed table:', table);
        });
      });

      //console.log('All tables refreshed successfully');
    })
    .catch(error => {
      console.error('Python script execution failed:', error);
    })
    .finally(() => {
      event.reply('py-cvar-complete', { success: true, projectName: 'py-CVaR' });
      event.reply('project-finished', { success: true, projectName: 'py-CVaR' });
    });
});
ipcMain.on('start-py-excel', (event) => {
  // Define the tables to be used in the script and for refreshing
  const tablesToRefresh = ['Portfolios', 'DealsMain', 'ProdAll', 'Issuer'];

  // Start the Python script and pass the tables array
  startPythonScriptWithEvent(event, 'excel', 'py-excel')
  .then(() => {
    //console.log('Python script executed successfully_main');

        // Refresh each table
      tablesToRefresh.forEach(tableName => {
      refreshTable(tableName);
      //console.log('tableName:', tableName);
  })
    //console.log('Python script refreshed TABLES_main');
  })
  .catch(error => {
    console.error('Python script execution failed:', error);
  })
  .finally(() => {
    event.reply('project-finished', { success: true, projectName: 'py-excel' });

  });
});
ipcMain.on('start-py-historicData', async (event, args = {}) => {
  const api = args.api || ''; // z. B. "ECB"

  const scriptArgs = [];
  if (api) {
    scriptArgs.push('--api', api);
  }

  try {
    const result = await startPythonScriptWithEvent(event, 'hist', 'py-historicData', scriptArgs);

    const tableName = 'tblTS';
    refreshTable(tableName);

    event.reply('py-historicData-complete', {
      success: true,
      projectName: 'py-historicData',
      api,
      result
    });

    event.reply('project-finished', {
      success: true,
      projectName: 'py-hist',
      buttonId: args.buttonId || 'histButton'  // falls du das vom Frontend übergibst
    });
    

  } catch (error) {
    console.error('Python script execution failed:', error);

    event.reply('py-historicData-complete', {
      success: false,
      projectName: 'py-historicData',
      error: error.message || error.toString(),
      api
    });

    event.reply('project-finished', {
      success: false,
      projectName: 'py-historicData'
    });
  }
});

ipcMain.on('start-py-cspar', async (event, args) => {
  //console.log('📥 Received arguments for py-cspar:', args);

  const { CSSzenario } = args; // Extract `name` directly
  if (!CSSzenario) {
    console.error('❌ Error: Missing CSSzenario argument.');
    event.reply('project-finished', {
      success: false,
      projectName: 'py-cspar',
      message: 'The "CSSzenario" argument is required.',
    });
    return; // Stop execution
  }

  try {
    // Call the Python script with the `CSSzenario` argument
    const pythonArgs = ['--CSSzenario', CSSzenario];
    //console.log('🚀 Starting Python CSPAR script with arguments:', pythonArgs);

    const result = await startPythonScriptWithEvent(event, 'cspar', 'py-csparData', pythonArgs);
    //console.log('✅ py-cspar executed successfully with result:', result);

    // Refresh the table
    const tableToRefresh = 'CSMatrix';
    refreshTable(tableToRefresh);
    //console.log(`🔄 Refreshed table: ${tableToRefresh}`);

    // Notify the renderer that the project is complete
    event.reply('project-finished', {
      success: true,
      projectName: 'py-cspar',
      data: result,
    });
  } catch (error) {
    console.error('❌ Python script execution failed:', error);
    event.reply('project-finished', {
      success: false,
      projectName: 'py-cspar',
      message: 'Python script execution failed.',
      error: error.message,
    });
  }
});
ipcMain.on('start-py-ml', async (event, args) => {
  const {
    tableName,
    target,
    newModel,
    modelName, 
    modelType, 
    epochs = 1,
    batch_size = 32,
    optimizer,
    loss,
    metrics,
  } = args;

  //console.log('📥 Received arguments for py-ml:', args);

  const resolvedTarget = target || 'NVDA'; // Default target

  // 🟢 **Determine final model type for a new model**
  if (newModel) {
    // 🚨 **If modelType is missing, throw an error (no default)**
    if (!modelType) {
      console.error('❌ Error: modelType is required for new models.');
      event.reply('project-finished', { 
        success: false, 
        message: 'modelType is required for new models.' 
      });
      return; // Stop execution
    }
  } else {
    // 🟢 If newModel is false, use the modelName
    if (!modelName) {
      console.error('❌ Error: modelName is required when using a pre-trained model.');
      event.reply('project-finished', { 
        success: false, 
        message: 'modelName is required for pre-trained models.' 
      });
      return; // Stop execution
    }
  }

  // 🟢 **Prepare arguments for the Python script**
  const pythonArgs = [
    '--table', tableName,
    '--target', resolvedTarget,
    '--epochs', epochs.toString(),
    '--batch_size', batch_size.toString(),
  ];

  if (newModel) {
    pythonArgs.push('--newModel'); // Include newModel flag
    pythonArgs.push('--modelType', modelType); // **Use modelType for new models**
  } else if (modelName) {
    pythonArgs.push('--modelName', modelName); // Include modelName for existing models
  }

  // 🟢 **Optional parameters**
  if (optimizer) {
    pythonArgs.push('--optimizer', JSON.stringify(optimizer)); 
  }
  if (loss) {
    pythonArgs.push('--loss', loss); 
  }
  if (metrics && metrics.length > 0) {
    pythonArgs.push('--metrics', Array.isArray(metrics) ? metrics.join(',') : metrics); 
  }

  //console.log('🚀 Starting Python ML script with arguments:', pythonArgs);

  // 🟢 **Tables to Refresh**
  const tablesToRefresh = ['ML_FuturePredictions', 'ML_MergedData', 'ML_TrainedModels'];

  try {
    const result = await startPythonScriptWithEvent(event, 'ml', 'py-ml', pythonArgs);
    //console.log('✅ Python script executed successfully with result:', result);
    
    // **🔄 Refresh each table**
    tablesToRefresh.forEach(tableName => {
      try {
        refreshTable(tableName);
        //console.log('🔄 Refreshed table:', tableName);
      } catch (error) {
        console.error(`❌ Error refreshing table ${tableName}:`, error);
      }
    });

    // **📢 Notify the renderer process that the process is complete**
    event.reply('project-finished', { success: true, projectName: 'py-ml', data: result });
  } catch (error) {
    console.error('❌ Python script execution failed:', error);
    event.reply('project-finished', { success: false, message: 'Python script execution failed.' });
  }
});

// ipcMain.on('start-py-matchColumns', async (event, args) => {
//   const { inputColumns, productTargetColumns, offerTargetColumns } = args;

//   if (
//     !Array.isArray(inputColumns) ||
//     !Array.isArray(productTargetColumns) ||
//     !Array.isArray(offerTargetColumns)
//   ) {
//     console.log('📥 Received payload:', args);
//     console.error('❌ Missing or invalid arguments for matchColumns.');
//     event.reply('py-matchColumns-complete', {
//       success: false,
//       projectName: 'py-matchColumns',
//       message: 'Arguments "inputColumns", "productTargetColumns", and "offerTargetColumns" must be arrays.'
//     });
//     event.reply('project-finished', {
//       success: false,
//       projectName: 'py-matchColumns'
//     });
//     return;
//   }

//   try {
//     const pythonArgs = [
//       '--aicolumn_input', JSON.stringify(inputColumns),
//       '--product_targets', JSON.stringify(productTargetColumns),
//       '--offer_targets', JSON.stringify(offerTargetColumns)
//     ];

//     const result = await startPythonScriptWithEvent(event, 'aicolumn', 'py-matchColumns', pythonArgs);

//     event.reply('py-matchColumns-complete', {
//       success: true,
//       projectName: 'py-matchColumns',
//       result
//     });

//     event.reply('project-finished', {
//       success: true,
//       projectName: 'py-matchColumns'
//     });

//   } catch (error) {
//     console.error('❌ Error during matchColumns script:', error);

//     event.reply('py-matchColumns-complete', {
//       success: false,
//       projectName: 'py-matchColumns',
//       error: error.message || error.toString()
//     });

//     event.reply('project-finished', {
//       success: false,
//       projectName: 'py-matchColumns'
//     });
//   }
// });

ipcMain.on('start-py-matchColumns', async (event, args) => {
  const { inputColumns, productTargetColumns, offerTargetColumns } = args;

  // 🛑 Validate inputs
  if (
    !Array.isArray(inputColumns) ||
    !Array.isArray(productTargetColumns) ||
    !Array.isArray(offerTargetColumns)
  ) {
    console.log('📥 Received payload (invalid):', args);
    console.error('❌ Missing or invalid arguments for matchColumns.');
    event.reply('py-matchColumns-complete', {
      success: false,
      projectName: 'py-matchColumns',
      message: 'Arguments "inputColumns", "productTargetColumns", and "offerTargetColumns" must be arrays.'
    });
    event.reply('project-finished', {
      success: false,
      projectName: 'py-matchColumns'
    });
    return;
  }

  try {
    // ✅ Prepare arguments for Python script
    const pythonArgs = [
      '--aicolumn_input', JSON.stringify(inputColumns),
      '--product_targets', JSON.stringify(productTargetColumns),
      '--offer_targets', JSON.stringify(offerTargetColumns)
    ];

    console.log('🚀 startPythonScriptWithEvent:', pythonArgs);

    // 🔁 Run Python script
    const result = await startPythonScriptWithEvent(event, 'aicolumn', 'py-matchColumns', pythonArgs);

    console.log('✅ Python result received:', result);

    // ✅ Reply with full match results directly
    event.reply('py-matchColumns-complete', {
      success: true,
      projectName: 'py-matchColumns',
      product_matches: result.product_matches,
      offer_matches: result.offer_matches
    });
    

    event.reply('project-finished', {
      success: true,
      projectName: 'py-matchColumns'
    });

  } catch (error) {
    console.error('❌ Error during matchColumns script:', error);

    event.reply('py-matchColumns-complete', {
      success: false,
      projectName: 'py-matchColumns',
      error: error.message || error.toString()
    });

    event.reply('project-finished', {
      success: false,
      projectName: 'py-matchColumns'
    });
  }
});










// Startet die Anzeige der Fenster
app.whenReady().then(() => {
  createWindow();
  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});
// Close the database connection when the app is quitting
app.on('before-quit', () => {
  closeDatabase();
});

// Define the event listener function
const updateDataListener = async (event, { cleanTableName, rowIndex, newData, uniqueIdentifier }) => {
  try {
    // Call the updateRecord function with a callback
    updateRecord(cleanTableName, rowIndex, newData, uniqueIdentifier, (err) => {
      //console.log('updateRecord uniqueIdentifier:', uniqueIdentifier);
      //console.log('updateRecord cleanTableName:', cleanTableName);
      if (err) {
        // Handle the error when the updateRecord function reports an error
        console.error(err.message);
        event.reply('update-data-error', err.message);
      } else {
        // Handle the success when the updateRecord function completes successfully
        event.reply('update-data-success');
        //console.log('Update:', cleanTableName, newData, uniqueIdentifier);
        //console.log('Update success');
        refreshTable(cleanTableName);
      }
    });
  } catch (error) {
    console.error(error.message);
    event.reply('update-data-error', error.message);
  }
};

// Attach the event listener for the "update-data" event only once during initialization
ipcMain.on('update-data', updateDataListener);

ipcMain.on('add-new-row', (event, { newRowData, cleanTableName }) => {
  console.log('Event listener triggered in main.js');
  console.log('Received data:', newRowData);

  insertRowInTable(newRowData, cleanTableName, (err) => {
    if (err) {
      console.error('Error inserting row:', err.message);
      event.reply('add-new-row-error', err.message);
    } else {
      //console.log('Row added successfully:', newRowData);
      event.reply('add-new-row-success');
      refreshTable(cleanTableName);
      refreshTable('DealsMain');
    }
  });
});





app.on('browser-window-created', (event, window) => {
  window.webContents.on('did-finish-load', () => {
    sendDataToRenderer();
  });
});
app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});
// Handle erase data request from the renderer process
ipcMain.on('erase-data', async (event, {cleanTableName, uniqueIdentifier }) => {
  try {
    await eraseRowFromDB(cleanTableName, uniqueIdentifier);
    event.reply('erase-data-success');
    refreshTable(cleanTableName)
    //ipcMain.removeListener('erase-data', eraseRowFromDB);
  } catch (error) {
    console.error(error.message);
    event.reply('erase-data-error', error.message);
  }
  ipcMain.removeListener('erase-data', eraseRowFromDB);
  //ipcMain.addListener('erase-data', eraseRowFromDB);
});

// SAVE DEALS SELECTION

ipcMain.on('save-deals-selection', async (event, selectionData) => {
  //console.log('selectionData1:', selectionData);
  const {port_name, selectedTradeIDs } = selectionData;
  
  try {
    // Insert selection into DealsMain with the correct port_name
    await insertSelection(port_name, selectedTradeIDs);

    //console.log(`✅ Selection inserted for portfolio: ${port_name}`);

    // Refresh DealsMain after inserting new data
    refreshTable('DealsMain');
  } catch (error) {
    console.error('❌ Error handling selection:', error);
  }
});

// DELETE DEALS SELECTION
ipcMain.on('delete-selected-table', (event, selectedTableName) => {
  //console.log('delete-selected-table:', selectedTableName);
  deleteTable(selectedTableName, event.sender);
});




// GET THE DATA FROM ANY TABLE:
ipcMain.on('fetch-table-data', (event, selectedTableName) => {
  console.log('fetch-table-data:', selectedTableName);

  refreshTable(selectedTableName, (data) => {
    console.log(`Sende Daten für Tabelle "${selectedTableName}" zurück`, data);

    // Wichtig: Passender Channel-Name!
    event.reply(`${selectedTableName}`, data);
  });
});


ipcMain.on('start-training', (event) => {
  const pythonProcess = spawn('python', ['path/to/your_script.py']);

  pythonProcess.stdout.on('data', (data) => {
    try {
      const message = JSON.parse(data.toString());
      if (message.progress) {
        // Send progress updates to the renderer process
        event.sender.send('training-progress', message.progress);
      }
    } catch (err) {
      console.error('Error parsing progress data:', err);
    }
  });

  pythonProcess.stderr.on('data', (data) => {
    console.error(`Python error: ${data}`);
  });

  pythonProcess.on('close', (code) => {
    //console.log(`Python process exited with code ${code}`);
    event.sender.send('training-complete', { success: code === 0 });
  });
});


const handleCSParameterUpdate = (event, { newRowData, cleanTableName }) => {
  //console.log('Event listener triggered for CSParameter update in main.js');

  // Insert the new row into the CSParameter table
  insertCSParameter(newRowData, cleanTableName, (err) => {
    if (err) {
      console.error('Error inserting CSParameter row:', err.message);
      event.reply('csparameter-update-error', err.message);
    } else {
      //console.log('CSParameter row added successfully:', newRowData);
      event.reply('csparameter-update-success');

      // Refresh the table after successful insertion
      refreshTable(cleanTableName);
    }
  });
};

// Register the event listener
ipcMain.on('csparameter-update', handleCSParameterUpdate);


function refreshTable(tableName, callback) {
  let eventIdentifier = tableName + 'Data';
  // console.log(`🔄 [refreshTable] Starting refresh for table: ${tableName} (event: ${eventIdentifier})`);

  fetchDataAndSendEvent(tableName, eventIdentifier, () => {
    // console.log(`✅ [refreshTable] Data fetched for ${eventIdentifier}`);

    if (typeof callback === 'function') {
      // console.log(`➡️ [refreshTable] Executing callback for ${tableName}`);
      callback();  // Ensure this is being called
    } else {
      console.warn(`⚠️ [refreshTable] No callback provided for ${tableName}`);
    }
  });
}

// Import Columns
ipcMain.on('import-matched-columns', async (event, args) => {
  const { sourceTable, targetTable, columnMap, additionalFields = {} } = args;

  console.log(`📥 Import from ${sourceTable} → ${targetTable}`);
  console.log('🧭 Column map:', columnMap);
  console.log('🧩 Additional fields:', additionalFields);

  try {
    const rows = await getAllRowsFromTable(sourceTable);
    if (!rows || rows.length === 0) {
      return event.reply('import-matched-columns-complete', {
        success: false,
        message: `No data in source table: ${sourceTable}`
      });
    }

    let insertedCount = 0;
    for (const row of rows) {
      const newRow = {};

      // Mapping der Spalten
      columnMap.forEach(({ from, to }) => {
        if (row.hasOwnProperty(from)) {
          newRow[to] = row[from];
        }
      });

      // Füge zusätzliche Felder wie port_name hinzu
      Object.entries(additionalFields).forEach(([key, value]) => {
        newRow[key] = value;
      });

      // Nutze deine bestehende Insert-Logik
      insertRowInTable(newRow, targetTable, (err) => {
        if (err) {
          console.error(`❌ Failed to insert row in ${targetTable}:`, err.message);
        } else {
          insertedCount++;
        }
      });
    }

    // Erfolgsmeldung
    event.reply('import-matched-columns-complete', {
      success: true,
      message: `✅ Zeilen in "${targetTable}" eingefügt.`,
    });

    refreshTable(targetTable);

  } catch (err) {
    console.error('❌ Fehler beim Import:', err);
    event.reply('import-matched-columns-complete', {
      success: false,
      error: err.message || err.toString()
    });
  }
});













