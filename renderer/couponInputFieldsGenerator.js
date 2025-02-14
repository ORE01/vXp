import { formatInputFieldValue } from '../utils/format.js';

export function generateCouponInputFields(dataArray, form) {
    console.log('Generating input fields for coupon data as columns:', dataArray);
  
    if (!dataArray || dataArray.length === 0) {
      form.innerHTML = '<p>No data available</p>';
      return;
    }
  
    // Create the table structure
    const table = document.createElement('table');
    table.classList.add('coupon-table');
  
    // Excluded fields
    const excludedFields = ['ID', 'PROD_ID'];
  
    // Generate column headers
    const headerRow = document.createElement('tr');
    Object.keys(dataArray[0]).forEach((key) => {
      if (!excludedFields.includes(key)) {
        const headerCell = document.createElement('th');
        headerCell.textContent = key;
        headerRow.appendChild(headerCell);
      }
    });
    table.appendChild(headerRow);
  
    // Generate rows of data
    dataArray.forEach((row, rowIndex) => {
      const dataRow = document.createElement('tr');
  
      Object.entries(row).forEach(([key, value]) => {
        if (!excludedFields.includes(key)) {
          const cell = document.createElement('td');
  
          // Format the value before inserting it into the input field
          const formattedValue = formatInputFieldValue(key, value);
  
          // Create input fields for each data cell
          const input = document.createElement('input');
          if (key.toLowerCase().includes('date')) {
            // Parse date to the format "YYYY-MM-DD" for input[type="date"]
            const formattedDate = formatDateForInput(formattedValue);
            input.type = 'date';
            input.value = formattedDate || '';
          } else {
            input.type = determineInputType(key, formattedValue);
            input.value = formattedValue || '';
          }
  
          input.setAttribute('data-row', rowIndex); // To identify the row
          input.setAttribute('data-field', key); // To identify the field
          input.classList.add('input-field');
  
          cell.appendChild(input);
          dataRow.appendChild(cell);
        }
      });
  
      table.appendChild(dataRow);
    });
  
    // Append the table to the form
    form.appendChild(table);
  }
  
  
  
  // Helper function to format dates to "YYYY-MM-DD" for input[type="date"]
  function formatDateForInput(dateValue) {
    if (!dateValue) return '';
    const [day, month, year] = dateValue.split('-'); // Assuming "DD-MM-YYYY" format
    return `${year}-${month}-${day}`; // Convert to "YYYY-MM-DD"
  }
  
  // Helper function to determine input type
  function determineInputType(key, value) {
    if (typeof value === 'number') {
      return 'number';
    } else {
      return 'text';
    }
  }