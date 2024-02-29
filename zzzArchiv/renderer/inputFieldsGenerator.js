import { prodData } from '../PROD.js';

export function generateInputFields(rowData, form, uniqueIssuers, selectedTableName) {
  console.log('IFG generateInputFields:', selectedTableName);
  Object.keys(rowData).forEach((fieldName) => {
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
    } else if (fieldName === 'PROD_ID' && selectedTableName.startsWith('Deals')) {
      // For PROD_ID in DealsMain table, create a dropdown using data from prodData
      const dropdown = document.createElement('select');
      dropdown.id = 'prodIdSelect';
      dropdown.setAttribute('data-field', fieldName);
      dropdown.classList.add('input-field');
    
      // Populate the dropdown with product IDs and names from prodData
      //console.log('prodData:', prodData);
      prodData.forEach((item) => {
        
        const option = document.createElement('option');
        option.value = item.PROD_ID;
        option.textContent = item.PROD_ID;
        dropdown.appendChild(option);
      });
    
      // Set the selected option in the dropdown based on the value in rowData
      dropdown.value = rowData[fieldName];
    
      // Append the dropdown to the form row
      formRow.appendChild(label);
      formRow.appendChild(dropdown);
    }
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

  if (
    fieldName === 'START_DATE' ||
    fieldName === 'MATURITY' ||
    fieldName === 'TRADE_DATE'
  ) {
    const parts = formattedValue.split('-');
    formattedValue = `${parts[2]}-${parts[1]}-${parts[0]}`;
  }

  return formattedValue;
}