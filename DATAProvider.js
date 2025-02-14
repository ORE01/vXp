import processData from './renderer/dataProcessor.js';
import { handleFormAction } from './renderer/FormButtonHandler.js';

// Universal function to handle both ECB and Fed data and display in a table
export function handleProviderData(receivedData, tableName) {
    //console.log(`Received data for ${tableName}:`, receivedData);
  
    // ** Get the container for the provider (like ECB, Fed, Yahoo) **
    const container = document.getElementById(`input${tableName.charAt(0).toUpperCase() + tableName.slice(1)}-container`);
    if (!container) {
      console.error(`Error: container with id "input${tableName.charAt(0).toUpperCase() + tableName.slice(1)}-container" not found`);
      return;
    }
  
    // ** Replace container content using innerHTML **
    const tableHTML = processData(receivedData, { 
      tableName, 
      includeEditButton: true 
    });
    container.innerHTML = tableHTML; // Set innerHTML instead of appendChild
  
    // ** Attach event listeners for the edit buttons **
    const editButtons = container.querySelectorAll('.edit-button');
    editButtons.forEach((button) => {
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        const actionType = 'edit';
        const rowIndex = parseInt(button.getAttribute('data-row'), 10);
        handleFormAction(event, receivedData, rowIndex, tableName, actionType);
      });
    });
  
    // ** Attach event listener for the Add button **
    const addButton = document.getElementById(`${tableName}AddButton`);
    if (addButton) {
      addButton.addEventListener('click', (event) => {
        const actionType = 'add';
        handleFormAction(event, receivedData, null, tableName, actionType);
      });
    }
}
  
  



// Shared save function for ECB and Fed data
export function handleSaveData(tableType) {
    const editedData = extractEditedData(tableType);  // Extract edited data from the table
    const cleanTableName = tableType.toLowerCase();  // Convert table type to lowercase for table name

    editedData.forEach(row => {
        let uniqueIdentifier;

        if (!row['ID']) {
            console.error(`Missing ID for row, skipping:`, row);
            return;
        } else {
            uniqueIdentifier = { column: 'ID', value: row['ID'] };
            console.log(`Saving row with ID: ${row['ID']}`);
        }

        const newData = {
            INCLUDE: row['INCLUDE'] || '',
            FX: row['FX'] || '',
            FLOWREF: row['FLOWREF'] || '',
            NAME: row['NAME'] || '',
            SERIES_ID: row['SERIES_ID'] || '',
            ID: row['ID'],
        };

        saveEditedData(newData, cleanTableName, uniqueIdentifier);
    });

    updateTableAfterSave(editedData, tableType);
}

// Extract edited data for ECB or Fed
function extractEditedData(tableType) {
    const editedData = [];
    const table = document.getElementById(`input${tableType}-container`).querySelector('table');
    const rows = table.querySelectorAll('tr');

    for (let i = 1; i < rows.length; i++) {  // Skip the header row
        const row = rows[i];
        const cells = row.querySelectorAll('td');
        const rowData = {};

        for (let j = 0; j < cells.length; j++) {
            const header = table.querySelector('th:nth-child(' + (j + 1) + ')').textContent;
            rowData[header] = cells[j].textContent.trim();
        }

        if (rowData['ID']) {
            editedData.push(rowData);
        } else {
            console.log('Skipping row without ID:', rowData);
        }
    }

    return editedData;
}

// Save edited data for ECB or Fed
function saveEditedData(newData, cleanTableName, uniqueIdentifier) {
    console.log(`Saving ${cleanTableName} data:`, newData, uniqueIdentifier);

    // Send the data to the backend via IPC (Electron)
    window.api.send('update-data', { newData, cleanTableName, uniqueIdentifier });

    // Optionally, refresh the table content after saving
    const table = document.getElementById(`input${cleanTableName}-container`).querySelector('table');
    const processedData = processData(newData, cleanTableName);
    table.innerHTML = processedData;
}

// Update table UI after saving
function updateTableAfterSave(editedData, tableType) {
    const table = document.getElementById(`input${tableType}-container`);
    const rows = table.querySelectorAll('tr');

    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const cells = row.querySelectorAll('td');

        Object.keys(editedData[i - 1]).forEach((key, j) => {
            cells[j].textContent = editedData[i - 1][key];
        });
    }
}