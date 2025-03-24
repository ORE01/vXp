const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { getAllTableNames, queryDB, updateRecord,  insertDeal, eraseRowFromDB, closeDatabase, insertSelection, deleteTable, startPythonScriptWithEvent, handlePythonProgress, insertCSParameter} = require('./main_fct');
const { formatColumns} = require('./utils/main_format');

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

  const { tableName, CSSzenario, selectedCurve } = args; 

  if (!tableName || !CSSzenario || !selectedCurve) {
    console.error('❌ Missing required arguments: "tableName", "CSSzenario", or "selectedCurve".');
    event.reply('py-fairValue-complete', {
      success: false,
      projectName: 'py-fairValue',
      message: 'All three arguments ("tableName", "CSSzenario", "selectedCurve") are required.',
    });
    return;
  }

  try {
    // Python-Skript mit Argumenten starten
    const pythonArgs = ['--table', tableName, '--CSSzenario', CSSzenario, '--selectedCurve', selectedCurve];
    console.log('main: Starting Python script with arguments:', pythonArgs);

    const result = await startPythonScriptWithEvent(event, 'fvo', 'py-fairValue', pythonArgs);
    console.log('✅ Python script executed successfully:', result);

    // ✅ Aktualisiere "Portfolios"-Tabelle asynchron
    refreshTable('Portfolios', () => {
      console.log('✅ Refreshed table: Portfolios');
    });

    // ✅ Transformation von `tableName` falls nötig
    const newTableName = tableName.replace('Deals', 'Port');

    // ✅ Antwort an Renderer senden
    event.reply('py-fairValue-complete', {
      success: true,
      projectName: 'py-fairValue',
      tableName: newTableName,
      result
    });

  } catch (error) {
    console.error('❌ Error during Python script execution:', error);
    event.reply('py-fairValue-complete', {
      success: false,
      projectName: 'py-fairValue',
      error: error.toString(),
      tableName,
    });
  } finally {
    event.reply('project-finished', {
      success: true,
      projectName: 'py-fairValue'
    });
  }
});



ipcMain.on('start-py-MVaR', async (event, args) => {
  console.log('start-py-MVaR:', args);

  const { tableName } = args;
  const tablesToRefresh = ['MVaRMain', 'MVaRMain_rel'];

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
      console.log('Python script executed successfully');

      // Non-blocking refresh like CVaR
      tablesToRefresh.forEach(table => {
        refreshTable(table, () => {
          console.log('Refreshed table:', table);
        });
      });

      console.log('All tables refresh initiated');
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
  console.log('start-py-CVaR:', args);

  // Define the tables to be used in the script and for refreshing
  const tablesToRefresh = [
    'EADMain_rating', 
    'CVarMain_market_rel',
    'CVarMain_rating_rel',
    'CVarMain_norm_rel',
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
  console.log('Starting Python script with arguments:', pythonArgs);

  startPythonScriptWithEvent(event, 'cvar', 'py-CVaR', pythonArgs)
    .then(() => {
      console.log('Python script executed successfully');

      // Refresh each table using a distinct variable name
      tablesToRefresh.forEach(table => {
        refreshTable(table, () => {
          console.log('Refreshed table:', table);
        });
      });

      console.log('All tables refreshed successfully');
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

ipcMain.on('add-new-row', (event, { newRowData, cleanTableName }) => {
  console.log('Event listener triggered in main.js');
  console.log('Received data:', newRowData);

  insertDeal(newRowData, cleanTableName, (err) => {
    if (err) {
      console.error('Error inserting row:', err.message);
      event.reply('add-new-row-error', err.message);
    } else {
      console.log('Row added successfully:', newRowData);
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
  console.log('selectionData1:', selectionData);
  const {port_name, selectedTradeIDs } = selectionData;
  
  try {
    // Insert selection into DealsMain with the correct port_name
    await insertSelection(port_name, selectedTradeIDs);

    console.log(`✅ Selection inserted for portfolio: ${port_name}`);

    // Refresh DealsMain after inserting new data
    refreshTable('DealsMain');
  } catch (error) {
    console.error('❌ Error handling selection:', error);
  }
});


// DELETE DEALS SELECTION
ipcMain.on('delete-selected-table', (event, selectedTableName) => {
  console.log('delete-selected-table:', selectedTableName);
  deleteTable(selectedTableName, event.sender);
});




// Display the selected Deals
// ipcMain.on('fetch-table-data', (event, selectedTableName) => {
//   // console.log('selectedTableName:', selectedTableName);
//   refreshTable(selectedTableName, () => {
//     // This callback will be called after the selected table refresh is completed
//     // Now, you can safely refresh the "created tables" dropdown
//     refreshTable('createdDeals');
//     refreshTable('createdPort');
    
//   });
// });

ipcMain.on('fetch-portfolios-data', (event) => {
  console.log('🔍 Fetching portfolio data from "Portfolios" table.');

  refreshTable('Portfolios', () => {
    console.log('✅ Portfolios table refreshed successfully.');

    // Nach dem Laden auch die Dropdowns aktualisieren
    // refreshTable('createdDeals');
    // refreshTable('createdPort');
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





