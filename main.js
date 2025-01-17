const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { getAllTableNames, queryDB, updateRecord,  insertDeal, eraseRowFromDB, closeDatabase, insertSelection, deleteTable, startPythonScriptWithEvent, handlePythonProgress, insertCSParameter} = require('./main_fct');

require('dotenv').config();

const { spawn } = require('child_process');

let mainWindow;
let tableNames;

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

function formatColumns(rows) {
  const firstRow = rows[0];
  const formatColumns = [
    'TRADE_ID', 'RATES', 'NOTIONAL', 'NAV', 'COUPON', 'START_DATE', 'MATURITY', 'TRADE_DATE',
    'CS_Szenario', 'clean_price', 'GEARING', 'FLOOR', 'CAP', 'SPREADS',
    'DATE', 'EU_1Y', 'EU_5Y', 'EU_10Y', 'EU_20Y', 'EU_30Y', 'US_AAA', 'US_AA', 'US_A', 'US_BBB', 'US_BB',
    'VaR', 'ES'
  ];

  return rows.map(row => {
    const formattedRow = { ...row };
    
    formatColumns.forEach(column => {
      if (column in firstRow) {
        switch (column) {
          case 'NOTIONAL':
          case 'NAV':
          case 'LGD':
            const Value = Math.trunc(row[column]);
            formattedRow[column] = Value.toString();
            break; 
          case 'TRADE_ID':
            formattedRow[column] = row[column].toString();
            break;
          case 'START_DATE':
          case 'MATURITY':
          case 'TRADE_DATE':
          case 'DATE':
            const date = new Date(row[column]);
            const day = date.getDate().toString().padStart(2, '0');
            const month = (date.getMonth() + 1).toString().padStart(2, '0');
            const year = date.getFullYear();
            const formattedDate = `${day}-${month}-${year}`;
            formattedRow[column] = formattedDate;
            break;
          case 'CS_Szenario': 
            formattedRow[column] = row[column];
            break;
          case 'clean_price':
            // Display as an empty string if value is null or NaN
            formattedRow[column] = row[column] != null ? `<span style="color: orange; display: flex; justify-content: center;">${(row[column] * 100).toFixed(3)}%</span>` : "";
            break;
          case 'COUPON':
          case 'GEARING':
          case 'FLOOR':
          case 'CAP':
          case 'SPREADS':
          case 'RATES':
            // Display as an empty string if value is null or NaN
            formattedRow[column] = row[column] != null ? (row[column] * 100).toFixed(3) + '%' : "";
            break;
          case 'EU_1Y':
          case 'EU_5Y':
          case 'EU_10Y':
          case 'EU_20Y':
          case 'EU_30Y':
          case 'VaR':
          case 'ES':
            // Display as an empty string if value is null or NaN
            formattedRow[column] = row[column] != null ? row[column].toFixed(3) : "";
            break;
          default:
            break;
        }
      }
    });

    return formattedRow;
  });
}




// Loop through the selected table names and fetch data
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
  console.log('main: Received arguments for py-fairValue:', args);

  const { tableName, CSSzenario } = args; // Extrahiere `tableName` und `name` aus den Argumenten

  if (!tableName || !CSSzenario) {
    console.error('❌ Missing required arguments: "tableName" or "CSSzenario".');
    event.reply('py-fairValue-complete', {
      success: false,
      projectName: 'py-fairValue',
      message: 'Both "tableName" and "scenarioName" are required.',
    });
    return; // Beende die Verarbeitung, wenn ein Argument fehlt
  }

  try {
    // Python-Skript ausführen mit `--table` und `--name` als Argumente
    const pythonArgs = ['--table', tableName, '--CSSzenario', CSSzenario];
    console.log('main: Starting Python script with arguments:', pythonArgs);

    const result = await startPythonScriptWithEvent(event, 'fvo', 'py-fairValue', pythonArgs);

    console.log('✅ Python script executed successfully:', result);

    // Transformation von `tableName` (optional)
    const newTableName = tableName.replace('Deals', 'Port');
    //console.log('🔄 Transformed tableName:', newTableName);

    // Tabelle aktualisieren (falls nötig)
    refreshTable(newTableName);

    // Antwort an Renderer senden
    event.reply('py-fairValue-complete', {
      success: true,
      projectName: 'py-fairValue',
      tableName: newTableName,
      result,
    });
  } catch (error) {
    console.error('❌ Error during Python script execution or processing:', error);
    event.reply('py-fairValue-complete', {
      success: false,
      projectName: 'py-fairValue',
      error: error.toString(),
      tableName,
    });
  }
});
ipcMain.on('start-py-MVaR', async (event,args) => {
  console.log('start-py-MVaR:', args);

  const { tableName} = args; 

  const tablesToRefresh = ['MVaRMain', ];

  if (!tableName) {
    console.error('❌ Missing required arguments: "tableName".');
    event.reply('py-MVaR-complete', {
      success: false,
      projectName: 'py-MVaR',
      // message: 'Both "tableName" and "scenarioName" are required.',
      message: '"tableName" is required.',
    });
    return; // Beende die Verarbeitung, wenn ein Argument fehlt
  }
  //await startPythonScriptWithEvent(event, 'mvar', 'py-MVaR', ['MVaRMain']);
  //tableName = 'MVaRMain';
  startPythonScriptWithEvent(event, 'mvar', 'py-MVaR', ['--table', tableName])
    .then(() => {
      console.log('Python script executed successfully_main');
      
      refreshTable(tablesToRefresh); // Assuming refreshTable is a function you've defined
      console.log('Python script refreshed PortMain_main');
    })
    .catch(error => {
      console.error('Python script execution failed:', error);
    })
    .finally(() => {
      event.reply('project-finished', { success: true, projectName: 'py-MVaR' });

    });
  
});
ipcMain.on('start-py-CVaR', async (event, args) => {
  console.log('start-py-CVaR:', args);

  // Define the tables to be used in the script and for refreshing
  const tablesToRefresh = [
    'EADMain_rating', 
    'sortedLossesMain_rating',
    'sortedLossesIssuerMain_rating',
    'sortedLossesIndicesMain_rating',
    'EADMain_market', 
    'sortedLossesMain_market',
    'sortedLossesIssuerMain_market',
    'sortedLossesIndicesMain_market',
    'EADMain_norm', 
    'sortedLossesMain_norm',
    'sortedLossesIssuerMain_norm',
    'sortedLossesIndicesMain_norm'
  ];

  // Start the Python script and pass the tables array
  const { tableName, CSSzenario } = args; // Extract `tableName` and `CSSzenario` from arguments

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
  console.log('🚀 Starting Python script with arguments:', pythonArgs);
  startPythonScriptWithEvent(event, 'cvar', 'py-CVaR', pythonArgs)
    .then(() => {
      console.log('Python script executed successfully_main');
      
        // Refresh each table
      tablesToRefresh.forEach(tableName => {
      refreshTable(tableName);
      console.log('tableName:', tableName);
  });
      console.log('Python script refreshed PortMain_main');
    })
    .catch(error => {
      console.error('Python script execution failed:', error);
    })
    .finally(() => {
      event.reply('project-finished', { success: true, projectName: 'py-CVaR' });

    });



});
ipcMain.on('start-py-excel', (event) => {
  // Define the tables to be used in the script and for refreshing
  const tablesToRefresh = ['PortMain', 'DealsMain', 'ProdAll', 'Issuer'];

  // Start the Python script and pass the tables array
  startPythonScriptWithEvent(event, 'excel', 'py-excel')
  .then(() => {
    console.log('Python script executed successfully_main');

        // Refresh each table
      tablesToRefresh.forEach(tableName => {
      refreshTable(tableName);
      console.log('tableName:', tableName);
  })
    console.log('Python script refreshed TABLES_main');
  })
  .catch(error => {
    console.error('Python script execution failed:', error);
  })
  .finally(() => {
    event.reply('project-finished', { success: true, projectName: 'py-excel' });

  });
});
ipcMain.on('start-py-historicData', (event) => {
  startPythonScriptWithEvent(event, 'hist', 'py-historicData')
  .then(() => {
    console.log('Python script executed successfully_main');
    const tableName = 'tblTS';
    refreshTable(tableName); // Assuming refreshTable is a function you've defined
    console.log('Python script refreshed_main');
  })
  .catch(error => {
    console.error('Python script execution failed:', error);
  })
  .finally(() => {
    event.reply('project-finished', { success: true, projectName: 'py-historicData' });

  });
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

  console.log('📥 Received arguments for py-ml:', args);

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

  console.log('🚀 Starting Python ML script with arguments:', pythonArgs);

  // 🟢 **Tables to Refresh**
  const tablesToRefresh = ['ML_FuturePredictions', 'ML_MergedData', 'ML_TrainedModels'];

  try {
    const result = await startPythonScriptWithEvent(event, 'ml', 'py-ml', pythonArgs);
    console.log('✅ Python script executed successfully with result:', result);
    
    // **🔄 Refresh each table**
    tablesToRefresh.forEach(tableName => {
      try {
        refreshTable(tableName);
        console.log('🔄 Refreshed table:', tableName);
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
ipcMain.on('start-py-cspar', async (event, args) => {
  console.log('📥 Received arguments for py-cspar:', args);

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
    console.log('🚀 Starting Python CSPAR script with arguments:', pythonArgs);

    const result = await startPythonScriptWithEvent(event, 'cspar', 'py-csparData', pythonArgs);
    console.log('✅ py-cspar executed successfully with result:', result);

    // Refresh the table
    const tableToRefresh = 'CSMatrix';
    refreshTable(tableToRefresh);
    console.log(`🔄 Refreshed table: ${tableToRefresh}`);

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
      console.log('updateRecord uniqueIdentifier:', uniqueIdentifier);
      console.log('updateRecord cleanTableName:', cleanTableName);
      if (err) {
        // Handle the error when the updateRecord function reports an error
        console.error(err.message);
        event.reply('update-data-error', err.message);
      } else {
        // Handle the success when the updateRecord function completes successfully
        event.reply('update-data-success');
        console.log('Update:', cleanTableName, newData, uniqueIdentifier);
        console.log('Update success');
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



// Define the event listener function and attach the event listener
const addNewRowListener = (event, { newRowData, cleanTableName }) => {
  console.log('Event listener triggered in main.js');

  // Remove the event listener to prevent further triggers
  ipcMain.removeListener('add-new-row', addNewRowListener);

  // Add your logic here to save the new row data in the database
  insertDeal(newRowData, cleanTableName, (err) => {
    if (err) {
      console.error(err.message);
      event.reply('add-new-row-error', err.message);
    } else {
      console.log('New row data:', newRowData);
      event.reply('add-new-row-success');

      // Clear the newRowData object if needed
      newRowData = {};
      ipcMain.removeListener('add-new-row', addNewRowListener);
      // Refresh the table
      refreshTable(cleanTableName);

      // Reattach the event listener
      ipcMain.on('add-new-row', addNewRowListener);
    }
  });
};

ipcMain.on('add-new-row', addNewRowListener);
// Trigger sending data to renderer after the page finishes loading


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
  console.log('selectionData1:', selectionData);
  const { selectionName, tagValues, selectedTradeIDs } = selectionData;

  try {
    // Wait for the selection to be inserted and the table to be created
    await insertSelection(selectionName, tagValues, selectedTradeIDs);
    console.log('Selection inserted and table created successfully');
    
    // Now that the table exists, refresh it
    refreshTable(selectionName);
  } catch (error) {
    console.error('Error handling selection:', error);
  }
});

// DELETE DEALS SELECTION
ipcMain.on('delete-selected-table', (event, selectedTableName) => {
  console.log('delete-selected-table:', selectedTableName);
  deleteTable(selectedTableName, event.sender);
});

// Display the selected Deals
ipcMain.on('fetch-table-data', (event, selectedTableName) => {
  // console.log('selectedTableName:', selectedTableName);
  refreshTable(selectedTableName, () => {
    // This callback will be called after the selected table refresh is completed
    // Now, you can safely refresh the "created tables" dropdown
    refreshTable('createdDeals');
    refreshTable('createdPort');
  });
});


function refreshTable(tableName, callback) {
  let eventIdentifier = tableName + 'Data';

  // Fetch new data and send event
  fetchDataAndSendEvent(tableName, eventIdentifier, () => {
    //console.log('REFRESHED:', eventIdentifier);

    // Call the callback function (if provided) after the refresh is completed
    if (typeof callback === 'function') {
      callback();
    }
  });
}

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
    console.log(`Python process exited with code ${code}`);
    event.sender.send('training-complete', { success: code === 0 });
  });
});


const handleCSParameterUpdate = (event, { newRowData, cleanTableName }) => {
  console.log('Event listener triggered for CSParameter update in main.js');

  // Insert the new row into the CSParameter table
  insertCSParameter(newRowData, cleanTableName, (err) => {
    if (err) {
      console.error('Error inserting CSParameter row:', err.message);
      event.reply('csparameter-update-error', err.message);
    } else {
      console.log('CSParameter row added successfully:', newRowData);
      event.reply('csparameter-update-success');

      // Refresh the table after successful insertion
      refreshTable(cleanTableName);
    }
  });
};

// Register the event listener
ipcMain.on('csparameter-update', handleCSParameterUpdate);

