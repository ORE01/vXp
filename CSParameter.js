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
    const CSPDataHTML = processData(CSPData);
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
          handleFormAction(event, CSPData, rowIndex, tableName, actionType);
        });
      });
}







