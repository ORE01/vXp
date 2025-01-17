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
    


    function convertDateToISO(dateStr) {
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


// export function generateInputFields(rowData, form, uniqueIssuers, selectedTableName) {
//   console.log('IFG generateInputFields:', selectedTableName);
//   // Sort uniqueIssuers alphabetically
//   uniqueIssuers.sort();
//   Object.keys(rowData).forEach((fieldName) => {

//     // ISSUER field PROBLEM!!!!!!
//     const skipIssuerForTables = new Set(['ecb', 'fed', 'yahoo', 'CSParameter']);

//     // Check if the selected table name is in the set
//     if (fieldName === 'ISSUER' && skipIssuerForTables.has(selectedTableName)) {
//       return;  // Skip the iteration for the ISSUER field
//     }

//     const formRow = document.createElement('div');
//     formRow.classList.add('form-row');

//     const label = document.createElement('label');
//     label.textContent = fieldName;
//     label.classList.add('label');

//     // Deals; ProdAll :
//     if (fieldName === 'ISSUER' && selectedTableName !== 'Issuer' && !selectedTableName.startsWith('Deals')) {
//       // For the "ISSUER" field, create a dropdown (select) element instead of an input field
//       const dropdown = document.createElement('select');
//       dropdown.id = 'issuerSelect'; // Set the ID for the dropdown so that it can be populated later
//       dropdown.setAttribute('data-field', fieldName); // Add the data-field attribute for the dropdown
//       dropdown.classList.add('input-field');

//       // Populate the dropdown with issuer names
//       console.log('uniqueIssuers:', uniqueIssuers);

//       const issuerOptions = filteredIssuerData
//       .map(issuer => issuer.ISSUER)
//       .filter(Boolean) // Remove any undefined or null values first
//       .sort(); // Sort the values alphabetically

//       // Populate the dropdown with issuer names
//       issuerOptions.forEach((item) => {
//         const option = document.createElement('option');
//         option.value = item;
//         option.textContent = item;
//         dropdown.appendChild(option);
//       });

//       // Set the default value for the "ISSUER" field if it's not already set
//       if (!rowData['ISSUER']) {
//         rowData['ISSUER'] = uniqueIssuers.length > 0 ? uniqueIssuers[0] : '';
//       }
//       // Set the selected option in the dropdown based on the value in rowData
//       dropdown.value = rowData[fieldName];
    
//       // Append the dropdown to the form row
//       formRow.appendChild(label);
//       formRow.appendChild(dropdown);

//     } 
//     // Deals:
//     else if (fieldName === 'PROD_ID' && selectedTableName.startsWith('Deals')) {
//       // Extract product IDs from prodData
//       const productIDs = prodData.map(item => item.PROD_ID);
    
//       // Use the createDropdown function to create the dropdown for product IDs
//       const prodIdDropdown = createDropdown(fieldName, productIDs, rowData[fieldName]);
    
//       // Append the dropdown to the form row
//       formRow.appendChild(label);
//       formRow.appendChild(prodIdDropdown);
//     }
//     else if (fieldName === 'CATEGORY' && selectedTableName.startsWith('Deals')) {
//       // Define the category options
//       const categories = ['1_Kontokorrentkonten', '5_Termineinlagen', '2_lgfr_Anlagevermögen'];
    
//       // Use the createDropdown function to create the dropdown for categories
//       const categoryDropdown = createDropdown(fieldName, categories, rowData[fieldName]);
    
//       // Append the dropdown to the form row
//       formRow.appendChild(label);
//       formRow.appendChild(categoryDropdown);
//     }
//     else if (fieldName === 'TRADE_DATE' && selectedTableName.startsWith('Deals')) {
//       const tradeDateLabel = document.createElement('label');
//       tradeDateLabel.textContent = fieldName;
//       tradeDateLabel.classList.add('label');
//       tradeDateLabel.setAttribute('for', 'tradeDate');
  
//       const tradeDateInput = document.createElement('input');
//       tradeDateInput.type = 'date';
//       tradeDateInput.id = 'tradeDate';
//       tradeDateInput.classList.add('input-field');
  
//       // Function to convert date from 'DD-MM-YYYY' to 'YYYY-MM-DD'
//       function convertDateToISO(dateStr) {
//           const parts = dateStr.split('-');
//           if (parts.length === 3) {
//               return `${parts[2]}-${parts[1]}-${parts[0]}`;
//           }
//           return dateStr; // Return original string if format is not as expected
//       }
  
//       // Convert and set the date
//       const isoDate = rowData[fieldName] ? convertDateToISO(rowData[fieldName]) : '';
//       tradeDateInput.value = isoDate;
  
//       tradeDateInput.setAttribute('data-field', fieldName);
//       console.log("Date value for the field:", fieldName, "is:", isoDate);
  
//       formRow.appendChild(tradeDateLabel);
//       formRow.appendChild(tradeDateInput); 
//     }

//     // CSParameter:
//     else if (['a', 'b', 'c', 'd'].includes(fieldName) && selectedTableName.startsWith('CSParameter')) {
//       // Predefined values for the fields
//       const predefinedValues = {
//         a: '20',
//         b: '5',
//         c: '97',
//         d: '5',
//       };
    
//       // Create a disabled input field
//       const input = document.createElement('input');
//       input.type = 'text';
//       input.value = predefinedValues[fieldName]; // Set the predefined value
//       input.setAttribute('data-field', fieldName); // Optional: for reference
//       input.classList.add('input-field');
//       input.disabled = true; // Make the field uneditable
    
//       // Add label and input to the form row
//       formRow.appendChild(label);
//       formRow.appendChild(input);
//     }
//     else if (['e', 'f'].includes(fieldName) && selectedTableName.startsWith('CSParameter')) {
//       // Custom labels for e and f
//       const customLabels = {
//         e: 'relative Displacement in %',
//         f: 'absolute Displacement in bp',
//       };
    
//       // Update the label text
//       label.textContent = customLabels[fieldName];
    
//       // Create the input field as usual, keeping it editable
//       const input = document.createElement('input');
//       input.type = 'text';
//       input.value = rowData[fieldName] || ''; // Preserve existing functionality
//       input.setAttribute('data-field', fieldName);
//       input.classList.add('input-field');
    
//       // Append the updated label and input to the form row
//       formRow.appendChild(label);
//       formRow.appendChild(input);
//     }
    
    
    
    
    
    
//     // ProdAll:
//     else if (fieldName === 'RANK' && selectedTableName.startsWith('ProdAll')) {
//       const rankOptions = ['senior_secured', 'senior_preferred', 'senior_unsecured', 'senior_subordinated', 'junior_subordinated'];
//       const rankDropdown = createDropdown(fieldName, rankOptions, rowData[fieldName]);
//       formRow.appendChild(label);
//       formRow.appendChild(rankDropdown);
//     }
//     else if (fieldName === 'CouponType' && selectedTableName.startsWith('ProdAll')) {
//       const couponTypeOptions = ['FIX', 'FLOATER'];
//       const couponTypeDropdown = createDropdown(fieldName, couponTypeOptions, rowData[fieldName]);
//       formRow.appendChild(label);
//       formRow.appendChild(couponTypeDropdown);
//     }
//     else if (fieldName === 'MATURITY' && selectedTableName.startsWith('ProdAll')) {
//       const maturityLabel = document.createElement('label');
//       maturityLabel.textContent = fieldName;
//       maturityLabel.classList.add('label');
//       maturityLabel.setAttribute('for', 'maturityDate');
  
//       const maturityInput = document.createElement('input');
//       maturityInput.type = 'date';
//       maturityInput.id = 'maturityDate';
//       maturityInput.classList.add('input-field');
  
//       // Function to convert date from 'DD-MM-YYYY' to 'YYYY-MM-DD'
//       function convertDateToISO(dateStr) {
//           const parts = dateStr.split('-');
//           if (parts.length === 3) {
//               return `${parts[2]}-${parts[1]}-${parts[0]}`;
//           }
//           return dateStr; // Return original string if format is not as expected
//       }
  
//       // Convert and set the date
//       const isoDate = rowData[fieldName] ? convertDateToISO(rowData[fieldName]) : '';
//       maturityInput.value = isoDate;
  
//       maturityInput.setAttribute('data-field', fieldName);
//       console.log("Date value for the field:", fieldName, "is:", isoDate);
  
//       formRow.appendChild(maturityLabel);
//       formRow.appendChild(maturityInput); 
//     }
//     else if (fieldName === 'START_DATE' && selectedTableName.startsWith('ProdAll')) {
//       const startDateLabel = document.createElement('label');
//       startDateLabel.textContent = fieldName;
//       startDateLabel.classList.add('label');
//       startDateLabel.setAttribute('for', 'startDate');

//       const startDateInput = document.createElement('input');
//       startDateInput.type = 'date';
//       startDateInput.id = 'startDate';
//       startDateInput.classList.add('input-field');

//       // Function to convert date from 'DD-MM-YYYY' to 'YYYY-MM-DD'
//       function convertDateToISO(dateStr) {
//           const parts = dateStr.split('-');
//           if (parts.length === 3) {
//               return `${parts[2]}-${parts[1]}-${parts[0]}`;
//           }
//           return dateStr; // Return original string if format is not as expected
//       }

//       // Convert and set the date
//       const isoDate = rowData[fieldName] ? convertDateToISO(rowData[fieldName]) : '';
//       startDateInput.value = isoDate;

//       startDateInput.setAttribute('data-field', fieldName);
//       console.log("Date value for the field:", fieldName, "is:", isoDate);

//       formRow.appendChild(startDateLabel);
//       formRow.appendChild(startDateInput); 
//     }
//     else if (fieldName === 'TENOR' && selectedTableName.startsWith('ProdAll')) {
//       const tenorOptions = ['1', '2', '4'];
//       const tenorDropdown = createDropdown(fieldName, tenorOptions, rowData[fieldName]);
//       formRow.appendChild(label);
//       formRow.appendChild(tenorDropdown);
//     }
//     else if (fieldName === 'TICKER' && selectedTableName.startsWith('ProdAll')) {
//       // Extract TICKER values from filteredIssuerData and sort them alphabetically
//       const tickerOptions = filteredIssuerData
      
//         .map(issuer => issuer.TICKER)
//         .filter(Boolean) // Remove any undefined or null values first
//         .sort(); // Sort the values alphabetically
    
//       // Ensure there are no duplicates
//       const uniqueTickerOptions = [...new Set(tickerOptions)];
//       console.log('uniqueTickerOptions:', uniqueTickerOptions)
//       // Create the dropdown with these dynamically obtained and sorted options
//       const tickerDropdown = createDropdown(fieldName, uniqueTickerOptions, rowData[fieldName]);
//       formRow.appendChild(label);
//       formRow.appendChild(tickerDropdown);
//     }
//     // auch das ist für ProdAll:
//     else if (fieldName !== 'ISSUER' || (fieldName === 'ISSUER' && !selectedTableName.startsWith('Deals'))) {
//       // For other fields or for ISSUER in non-DealsMain tables, use the regular input field
//       const input = document.createElement('input');
//       input.type = 'text';
//       input.value = rowData[fieldName];
//       input.setAttribute('data-field', fieldName);
//       input.classList.add('input-field');
//       formRow.appendChild(label);
//       formRow.appendChild(input);
//     }

    

//     form.appendChild(formRow);
//   });
// }
