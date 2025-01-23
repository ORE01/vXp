import { prodData } from '../PROD.js';
import { filteredIssuerData } from '../r_tab/ISSUER.js';


// mapping of tables to functions:
const tableHandlers = {
  ProdAll: handleProdAllFields,
  Deals: handleDealsFields,
  CSParameter: handleCSParameterFields,
};

// skip for the ISSUER field for tables listed:
export const skipIssuerForTables = new Set(['ecb', 'fed', 'yahoo', 'CSParameter']);





export function generateInputFields(rowData, form, uniqueIssuers, selectedTableName) {
  console.log('IFG generateInputFields:', selectedTableName);

  // Sort uniqueIssuers alphabetically
  uniqueIssuers.sort();

  Object.keys(rowData).forEach((fieldName) => {
    const formRow = document.createElement('div');
    formRow.classList.add('form-row');

    const label = document.createElement('label');
    label.textContent = fieldName;
    label.classList.add('label');

    // Handle ISSUER field problem
    if (fieldName === 'ISSUER' && skipIssuerForTables.has(selectedTableName)) {
      return; // Skip iteration for the ISSUER field
    }

    // Determine the appropriate handler based on the selected table name
    for (const [prefix, handler] of Object.entries(tableHandlers)) {
      if (selectedTableName.startsWith(prefix)) {
        if (handler(fieldName, rowData, formRow, label)) {
          form.appendChild(formRow);
          return; // Skip further processing for this field
        }
      }
    }

    // Default input field for all other cases
    const input = document.createElement('input');
    input.type = 'text';
    input.value = rowData[fieldName] || '';
    input.setAttribute('data-field', fieldName);
    input.classList.add('input-field');
    formRow.appendChild(label);
    formRow.appendChild(input);

    form.appendChild(formRow);
  });
}
    function handleProdAllFields(fieldName, rowData, formRow, label) {
      switch (fieldName) {
        case 'RANK': {
          const rankOptions = ['senior_secured', 'senior_preferred', 'senior_unsecured', 'senior_subordinated', 'junior_subordinated'];
          const rankDropdown = createDropdown(fieldName, rankOptions, rowData[fieldName]);
          formRow.appendChild(label);
          formRow.appendChild(rankDropdown);
          return true;
        }

        case 'CouponType': {
          const couponTypeOptions = ['FIX', 'FLOATER'];
          const couponTypeDropdown = createDropdown(fieldName, couponTypeOptions, rowData[fieldName]);
          formRow.appendChild(label);
          formRow.appendChild(couponTypeDropdown);
          return true;
        }

        case 'MATURITY':
        case 'START_DATE': {
          const dateInput = document.createElement('input');
          dateInput.type = 'date';
          dateInput.id = `${fieldName.toLowerCase()}Date`;
          dateInput.classList.add('input-field');

          const isoDate = rowData[fieldName]
            ? convertDateToISO(rowData[fieldName])
            : '';
          dateInput.value = isoDate;

          dateInput.setAttribute('data-field', fieldName);
          formRow.appendChild(label);
          formRow.appendChild(dateInput);
          return true;
        }

        case 'TENOR': {
          const tenorOptions = ['1', '2', '4'];
          const tenorDropdown = createDropdown(fieldName, tenorOptions, rowData[fieldName]);
          formRow.appendChild(label);
          formRow.appendChild(tenorDropdown);
          return true;
        }

        case 'TICKER': {
          const tickerOptions = filteredIssuerData
            .map((issuer) => issuer.TICKER)
            .filter(Boolean)
            .sort();
          const uniqueTickerOptions = [...new Set(tickerOptions)];
          const tickerDropdown = createDropdown(fieldName, uniqueTickerOptions, rowData[fieldName]);
          formRow.appendChild(label);
          formRow.appendChild(tickerDropdown);
          return true;
        }

        default:
          return false; // Return false if no case matches
      }
    }
    function handleDealsFields(fieldName, rowData, formRow, label) {
      switch (fieldName) {
        case 'PROD_ID': {
          const productIDs = prodData.map((item) => item.PROD_ID);
          const prodIdDropdown = createDropdown(fieldName, productIDs, rowData[fieldName]);
          formRow.appendChild(label);
          formRow.appendChild(prodIdDropdown);
          return true;
        }
    
        case 'CATEGORY': {
          const categories = ['1_Kontokorrentkonten', '5_Termineinlagen', '2_lgfr_Anlagevermögen'];
          const categoryDropdown = createDropdown(fieldName, categories, rowData[fieldName]);
          formRow.appendChild(label);
          formRow.appendChild(categoryDropdown);
          return true;
        }
    
        case 'TRADE_DATE': {
          const tradeDateInput = document.createElement('input');
          tradeDateInput.type = 'date';
          tradeDateInput.id = 'tradeDate';
          tradeDateInput.classList.add('input-field');
    
          const isoDate = rowData[fieldName]
            ? convertDateToISO(rowData[fieldName])
            : '';
          tradeDateInput.value = isoDate;
    
          tradeDateInput.setAttribute('data-field', fieldName);
          formRow.appendChild(label);
          formRow.appendChild(tradeDateInput);
          return true;
        }
    
        default:
          return false; // Return false if no case matches
      }
    }   
    function handleCSParameterFields(fieldName, rowData, formRow, label) {
      console.log('rowData', rowData);
      switch (true) {
        case ['a', 'b', 'c', 'd', 'Shift_%', 'Shift_bp'].includes(fieldName): {
          // Use the value from rowData or default to an empty string if undefined
          const input = document.createElement('input');
          input.type = 'text';
          input.value = rowData[fieldName] ?? ''; // Retain the value from rowData
          input.setAttribute('data-field', fieldName);
          input.classList.add('input-field');
          input.disabled = true; // Make the input uneditable
    
          formRow.appendChild(label);
          formRow.appendChild(input);
          return true;
        }
    
    
        default:
          return false; // Return false if no case matches
      }
    }
    


    export function convertDateToISO(dateStr) {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        return `${parts[2]}-${parts[1]}-${parts[0]}`;
      }
      return dateStr;
    }
    function createDropdown(fieldName, options, selectedValue) {
      const dropdown = document.createElement('select');
      dropdown.id = `${fieldName.toLowerCase()}Select`;
      dropdown.setAttribute('data-field', fieldName);
      dropdown.classList.add('input-field');

      options.forEach(optionValue => {
        const option = document.createElement('option');
        option.value = optionValue;
        option.textContent = optionValue;
        dropdown.appendChild(option);
      });

      dropdown.value = selectedValue;
      return dropdown;
    }


    export function generateCouponInputFields(dataArray, form) {
      console.log('Generating input fields for coupon data as columns:', dataArray);
    
      if (!dataArray || dataArray.length === 0) {
        form.innerHTML = '<p>No data available</p>';
        return;
      }
    
      // Create the table structure
      const table = document.createElement('table');
      table.classList.add('coupon-table');
    
      // Generate column headers
      const headerRow = document.createElement('tr');
      Object.keys(dataArray[0]).forEach((key) => {
        const headerCell = document.createElement('th');
        headerCell.textContent = key;
        headerRow.appendChild(headerCell);
      });
      table.appendChild(headerRow);
    
      // Generate rows of data
      dataArray.forEach((row, rowIndex) => {
        const dataRow = document.createElement('tr');
    
        Object.entries(row).forEach(([key, value]) => {
          const cell = document.createElement('td');
    
          // Create input fields for each data cell
          const input = document.createElement('input');
          if (key.toLowerCase().includes('date')) {
            // Parse date to the format "YYYY-MM-DD" for input[type="date"]
            const formattedDate = formatDateForInput(value);
            input.type = 'date';
            input.value = formattedDate || '';
          } else {
            input.type = determineInputType(key, value);
            input.value = value || '';
          }
    
          input.setAttribute('data-row', rowIndex); // To identify the row
          input.setAttribute('data-field', key); // To identify the field
          input.classList.add('input-field');
    
          cell.appendChild(input);
          dataRow.appendChild(cell);
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
    
    