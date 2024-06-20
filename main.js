const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { getAllTableNames, queryDB, updateRecord,  insertDeal, eraseRowFromDB, closeDatabase, insertSelection, deleteTable, startPythonScriptWithEvent} = require('./main_fct');
require('dotenv').config();

//const { spawn } = require('child_process');

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
          //case 'VaR':
          //case 'ES':
            const Value = Math.trunc(row[column]);//row[column].toLocaleString('en-GB', { maximumFractionDigits: 0 }).replace(/,/g, ' ');
            formattedRow[column] = Value.toString(); // Store the formatted number as plain text
            //formattedRow[`_${column}_style`] = 'color: blue;';
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
              // const color = 'rgb(70, 192, 230)';
              //  const formattedValue = parseFloat(row[column]).toFixed(0);
              //  formattedRow[column] = formattedValue;
            break;
          case 'clean_price':
            formattedRow[column] = `<span style="color: orange; display: flex; justify-content: center;">${(row[column] * 100).toFixed(3)}%</span>`;
          break;
          case 'COUPON':
          case 'GEARING':
          case 'FLOOR':
          case 'CAP':
          case 'SPREADS':
          case 'RATES':
          // case 'VaR':
          // case 'ES':
            formattedRow[column] = (row[column] * 100).toFixed(3) + '%';
            break;
          case 'EU_1Y':
          case 'EU_5Y':
          case 'EU_10Y':
          case 'EU_20Y':
          case 'EU_30Y':
            case 'VaR':
              case 'ES':
            formattedRow[column] = (row[column]).toFixed(3);
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
  console.log('tableNames:', tableNames);
  tableNames.forEach(tableName => {
    console.log('query:', tableName);
    fetchDataAndSendEvent(tableName, `${tableName}Data`);
  });
}
// TABELLEN EINGABE: Loop mit fetchDataAndSendEvent
// Array of selected table names
getAllTableNames((err, receivedTableNames) => {
  if (err) {
    console.error('Error retrieving table names:', err.message);
  } else {
    console.log('receivedTableNames:', receivedTableNames);

    // Filter out excluded table names
    const excludedTableNames = ['sqlite_sequence', 'Instruments', 'PDMain', 'MVaRMainDist' , 'sortedLossesIndicesMain']; // Add any other names you want to exclude
    tableNames = receivedTableNames.filter(tableName => !excludedTableNames.includes(tableName));
    
    sendDataToRenderer(tableNames);
  }
});


// Event handlers komuniziert mit renderer
ipcMain.on('start-py-fairValue', async (event, selectedTableName) => {
  console.log('start-py-fairValue:', selectedTableName);

  try {
    // Ensure any synchronous code here is also wrapped in try-catch

    await startPythonScriptWithEvent(event, 'fvo', 'py-fairValue', ['--table', selectedTableName]);

    console.log('Python script executed successfully_main');
    console.log('Python script:', selectedTableName);

    // Transform selectedTableName from "DealsABC" to "PortABC"
    const newTableName = selectedTableName.replace('Deals', 'Port');

    console.log('Python script refreshed', newTableName);

    // Assuming refreshTable is a function you've defined that refreshes the data for the newTableName
    refreshTable(newTableName);
    
    // Send the new table name back to the renderer
    event.reply('py-fairValue-complete', { success: true, projectName: 'py-fairValue', tableName: newTableName });
  } catch (error) {
    console.error('Error during Python script execution or processing:', error);
    // This catch block now catches both synchronous errors and promise rejections
    event.reply('py-fairValue-complete', { success: false, projectName: 'py-fairValue', error: error.toString(), tableName: selectedTableName });
  }
});
ipcMain.on('start-py-MVaR', async (event,selectedTableName) => {
  console.log('start-py-MVaR:');
  //await startPythonScriptWithEvent(event, 'mvar', 'py-MVaR', ['MVaRMain']);
  const tableName = 'MVaRMain';
  startPythonScriptWithEvent(event, 'mvar', 'py-MVaR', ['--table', selectedTableName])
    .then(() => {
      console.log('Python script executed successfully_main');
      
      refreshTable(tableName); // Assuming refreshTable is a function you've defined
      console.log('Python script refreshed PortMain_main');
    })
    .catch(error => {
      console.error('Python script execution failed:', error);
    })
    .finally(() => {
      event.reply('project-finished', { success: true, projectName: 'py-MVaR' });

    });
  
});
ipcMain.on('start-py-CVaR', async (event, selectedTableName) => {
  console.log('start-py-CVaR:');

  // Define the tables to be used in the script and for refreshing
  const tablesToRefresh = ['EADMain', 'sortedLossesMain', 'sortedLossesIssuerMain', 'sortedLossesIndicesMain'];

  // Start the Python script and pass the tables array
  startPythonScriptWithEvent(event, 'cvar', 'py-CVaR', ['--table', selectedTableName])
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
ipcMain.on('start-py-cspar', (event) => {
  startPythonScriptWithEvent(event, 'cspar', 'py-csparData')
  .then(() => {
    console.log('py-cspar executed successfully');
    const tableName = 'CSMatrix';
    refreshTable(tableName);
    console.log('Python script refreshed CSMatrix');
  })
  .catch(error => {
    console.error('Python script execution failed:', error);
  })
  .finally(() => {
    event.reply('project-finished', { success: true, projectName: 'py-cspar' });

  });
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
  console.log('selectedTableName:', selectedTableName);
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
    console.log('REFRESHED:', eventIdentifier);

    // Call the callback function (if provided) after the refresh is completed
    if (typeof callback === 'function') {
      callback();
    }
  });
}