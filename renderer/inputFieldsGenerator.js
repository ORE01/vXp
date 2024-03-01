import { prodData } from '../PROD.js';
import { filteredIssuerData } from '../r_tab/ISSUER.js';

export function generateInputFields(rowData, form, uniqueIssuers, selectedTableName) {
  console.log('IFG generateInputFields:', selectedTableName);
  // Sort uniqueIssuers alphabetically
  uniqueIssuers.sort();
  Object.keys(rowData).forEach((fieldName) => {

    // TICKER wird nicht gezeigt
    // if (fieldName === 'TICKER' && selectedTableName.startsWith('ProdAll')) {
    //   return; // Skip the rest of this iteration
    // }

    const formRow = document.createElement('div');
    formRow.classList.add('form-row');

    const label = document.createElement('label');
    label.textContent = fieldName;
    label.classList.add('label');

    if (fieldName === 'ISSUER' && selectedTableName !== 'Issuer' && !selectedTableName.startsWith('Deals')) {
      // For the "ISSUER" field, create a dropdown (select) element instead of an input field
      const dropdown = document.createElement('select');
      dropdown.id = 'issuerSelect'; // Set the ID for the dropdown so that it can be populated later
      dropdown.setAttribute('data-field', fieldName); // Add the data-field attribute for the dropdown
      dropdown.classList.add('input-field');

      // Populate the dropdown with issuer names
      //console.log('uniqueIssuers:', uniqueIssuers);
      uniqueIssuers.forEach((item) => {
        const option = document.createElement('option');
        option.value = item;
        option.textContent = item;
        dropdown.appendChild(option);
      });

      // Set the default value for the "ISSUER" field if it's not already set
      if (!rowData['ISSUER']) {
        rowData['ISSUER'] = uniqueIssuers.length > 0 ? uniqueIssuers[0] : '';
      }
      // Set the selected option in the dropdown based on the value in rowData
      dropdown.value = rowData[fieldName];
    
      // Append the dropdown to the form row
      formRow.appendChild(label);
      formRow.appendChild(dropdown);

    } 
    // Deals:
    else if (fieldName === 'PROD_ID' && selectedTableName.startsWith('Deals')) {
      // Extract product IDs from prodData
      const productIDs = prodData.map(item => item.PROD_ID);
    
      // Use the createDropdown function to create the dropdown for product IDs
      const prodIdDropdown = createDropdown(fieldName, productIDs, rowData[fieldName]);
    
      // Append the dropdown to the form row
      formRow.appendChild(label);
      formRow.appendChild(prodIdDropdown);
    }
    else if (fieldName === 'CATEGORY' && selectedTableName.startsWith('Deals')) {
      // Define the category options
      const categories = ['1_Kontokorrentkonten', '5_Termineinlagen', '2_lgfr_Anlagevermögen'];
    
      // Use the createDropdown function to create the dropdown for categories
      const categoryDropdown = createDropdown(fieldName, categories, rowData[fieldName]);
    
      // Append the dropdown to the form row
      formRow.appendChild(label);
      formRow.appendChild(categoryDropdown);
    }
    else if (fieldName === 'TRADE_DATE' && selectedTableName.startsWith('Deals')) {
      const tradeDateLabel = document.createElement('label');
      tradeDateLabel.textContent = fieldName;
      tradeDateLabel.classList.add('label');
      tradeDateLabel.setAttribute('for', 'tradeDate');
  
      const tradeDateInput = document.createElement('input');
      tradeDateInput.type = 'date';
      tradeDateInput.id = 'tradeDate';
      tradeDateInput.classList.add('input-field');
  
      // Function to convert date from 'DD-MM-YYYY' to 'YYYY-MM-DD'
      function convertDateToISO(dateStr) {
          const parts = dateStr.split('-');
          if (parts.length === 3) {
              return `${parts[2]}-${parts[1]}-${parts[0]}`;
          }
          return dateStr; // Return original string if format is not as expected
      }
  
      // Convert and set the date
      const isoDate = rowData[fieldName] ? convertDateToISO(rowData[fieldName]) : '';
      tradeDateInput.value = isoDate;
  
      tradeDateInput.setAttribute('data-field', fieldName);
      console.log("Date value for the field:", fieldName, "is:", isoDate);
  
      formRow.appendChild(tradeDateLabel);
      formRow.appendChild(tradeDateInput); 
    }
    
    // ProdAll:
    else if (fieldName === 'RANK' && selectedTableName.startsWith('ProdAll')) {
      const rankOptions = ['senior secured', 'senior preferred', 'senior', 'senior unsecured', 'senior subordinated', 'subordinated', 'junior subordinated'];
      const rankDropdown = createDropdown(fieldName, rankOptions, rowData[fieldName]);
      formRow.appendChild(label);
      formRow.appendChild(rankDropdown);
    }
    else if (fieldName === 'CouponType' && selectedTableName.startsWith('ProdAll')) {
      const couponTypeOptions = ['FIX', 'FLOATER'];
      const couponTypeDropdown = createDropdown(fieldName, couponTypeOptions, rowData[fieldName]);
      formRow.appendChild(label);
      formRow.appendChild(couponTypeDropdown);
    }
    else if (fieldName === 'MATURITY' && selectedTableName.startsWith('ProdAll')) {
      const maturityLabel = document.createElement('label');
      maturityLabel.textContent = fieldName;
      maturityLabel.classList.add('label');
      maturityLabel.setAttribute('for', 'maturityDate');
  
      const maturityInput = document.createElement('input');
      maturityInput.type = 'date';
      maturityInput.id = 'maturityDate';
      maturityInput.classList.add('input-field');
  
      // Function to convert date from 'DD-MM-YYYY' to 'YYYY-MM-DD'
      function convertDateToISO(dateStr) {
          const parts = dateStr.split('-');
          if (parts.length === 3) {
              return `${parts[2]}-${parts[1]}-${parts[0]}`;
          }
          return dateStr; // Return original string if format is not as expected
      }
  
      // Convert and set the date
      const isoDate = rowData[fieldName] ? convertDateToISO(rowData[fieldName]) : '';
      maturityInput.value = isoDate;
  
      maturityInput.setAttribute('data-field', fieldName);
      console.log("Date value for the field:", fieldName, "is:", isoDate);
  
      formRow.appendChild(maturityLabel);
      formRow.appendChild(maturityInput); 
    }
    else if (fieldName === 'START_DATE' && selectedTableName.startsWith('ProdAll')) {
      const startDateLabel = document.createElement('label');
      startDateLabel.textContent = fieldName;
      startDateLabel.classList.add('label');
      startDateLabel.setAttribute('for', 'startDate');

      const startDateInput = document.createElement('input');
      startDateInput.type = 'date';
      startDateInput.id = 'startDate';
      startDateInput.classList.add('input-field');

      // Function to convert date from 'DD-MM-YYYY' to 'YYYY-MM-DD'
      function convertDateToISO(dateStr) {
          const parts = dateStr.split('-');
          if (parts.length === 3) {
              return `${parts[2]}-${parts[1]}-${parts[0]}`;
          }
          return dateStr; // Return original string if format is not as expected
      }

      // Convert and set the date
      const isoDate = rowData[fieldName] ? convertDateToISO(rowData[fieldName]) : '';
      startDateInput.value = isoDate;

      startDateInput.setAttribute('data-field', fieldName);
      console.log("Date value for the field:", fieldName, "is:", isoDate);

      formRow.appendChild(startDateLabel);
      formRow.appendChild(startDateInput); 
    }
    else if (fieldName === 'TENOR' && selectedTableName.startsWith('ProdAll')) {
      const tenorOptions = ['1', '2', '4'];
      const tenorDropdown = createDropdown(fieldName, tenorOptions, rowData[fieldName]);
      formRow.appendChild(label);
      formRow.appendChild(tenorDropdown);
    }
    else if (fieldName === 'TICKER' && selectedTableName.startsWith('ProdAll')) {
      // Extract TICKER values from filteredIssuerData and sort them alphabetically
      const tickerOptions = filteredIssuerData
        .map(issuer => issuer.TICKER)
        .filter(Boolean) // Remove any undefined or null values first
        .sort(); // Sort the values alphabetically
    
      // Ensure there are no duplicates
      const uniqueTickerOptions = [...new Set(tickerOptions)];
    
      // Create the dropdown with these dynamically obtained and sorted options
      const tickerDropdown = createDropdown(fieldName, uniqueTickerOptions, rowData[fieldName]);
      formRow.appendChild(label);
      formRow.appendChild(tickerDropdown);
    }
    
    
    // ???:
    else if (fieldName !== 'ISSUER' || (fieldName === 'ISSUER' && !selectedTableName.startsWith('Deals'))) {
      // For other fields or for ISSUER in non-DealsMain tables, use the regular input field
      const input = document.createElement('input');
      input.type = 'text';
      input.value = rowData[fieldName];
      input.setAttribute('data-field', fieldName);
      input.classList.add('input-field');
      formRow.appendChild(label);
      formRow.appendChild(input);
    }

    form.appendChild(formRow);
  });
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


// Format:
export function formatInputFieldValue(fieldName, value) {
  console.log('fieldNameFF:', fieldName)
  console.log('value', value)
  let formattedValue = value;

  if (
    fieldName === 'COUPON' ||
    fieldName === 'GEARING' ||
    fieldName === 'FLOOR' ||
    fieldName === 'CAP' ||
    fieldName === 'SPREADS' ||
    fieldName === 'clean_price'||
    fieldName === 'RATES'
  ) {
    formattedValue = parseFloat(formattedValue) / 100;
    console.log('formattedValue:', formattedValue)
  }

  return formattedValue;
}