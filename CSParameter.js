import processData from './renderer/dataProcessor.js';
import { handleFormAction } from './renderer/FormButtonHandler.js';


export function handleCSParameterData(receivedData) {
  const CSPData = receivedData;
  const CSPDataContainer = document.getElementById('CSParameterDataContainer');

  // Create CSParameterTable element
  const CSParameterTable = document.createElement('table');
  CSParameterTable.classList.add('cs-parameter-table'); // Add class for styling

  // Update CSPDataContainer
  if (CSPDataContainer) {
    CSPDataContainer.innerHTML = ''; // Clear existing contents
    CSPDataContainer.appendChild(CSParameterTable); // Append the new table
  }

  // Update table body if data is available
  if (CSPDataContainer && CSPData) {
    const CSPDataHTML = processDataWithCheckbox(CSPData); // Process data with checkbox
    CSParameterTable.innerHTML = CSPDataHTML; // Set table content directly
  }

  // Edit Buttons
  const CSPEditButtons = document.querySelectorAll('#CSParameterDataContainer .edit-button');
  CSPEditButtons.forEach((button) => {
    button.addEventListener('click', (event) => {
      event.stopPropagation(); // Stop event propagation

      const tableName = 'CSParameter';
      const actionType = 'edit';
      const rowIndex = parseInt(button.getAttribute('data-row'), 10);

      // Use handleFormAction to handle add/edit logic
      handleFormAction(event, CSPData, rowIndex, tableName, actionType);
    });
  });

  // Add Button
  const csParameterAddButton = document.getElementById('CSParameterAddButton'); // Query add button
  csParameterAddButton.addEventListener('click', (event) => {
    const tableName = 'CSParameter';
    const actionType = 'add';
    handleFormAction(event, CSPData, null, tableName, actionType); // Call handleFormAction for add
  });
}

function processDataWithCheckbox(CSPData) {
  let tableHTML = '<thead><tr>';
  tableHTML += '<th>Select Scenario</th>'; // Add checkbox column header
  Object.keys(CSPData[0]).forEach((key) => {
    tableHTML += `<th>${key}</th>`;
  });
  tableHTML += '<th>Actions</th>'; // Add "Actions" column header for Edit-Button
  tableHTML += '</tr></thead><tbody>';

  CSPData.forEach((row, index) => {
    tableHTML += '<tr>';
    // Add checkbox and ensure the first one is checked
    tableHTML += `<td><input type="checkbox" class="select-scenario" data-row="${index}" ${index === 0 ? 'checked' : ''}></td>`;
    Object.values(row).forEach((value) => {
      tableHTML += `<td>${value}</td>`;
    });
    // Add the Edit button
    tableHTML += `<td><button class="edit-button" data-row="${index}">Edit</button></td>`;
    tableHTML += '</tr>';
  });

  tableHTML += '</tbody>';
  return tableHTML;
}













