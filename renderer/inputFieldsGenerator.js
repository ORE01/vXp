import { prodData } from '../PROD.js';
import { filteredIssuerData } from '../r_tab/ISSUER.js';
import { convertDateToISO } from '../utils/format.js';


// mapping of tables to functions:
const tableHandlers = {
  ProdAll: handleProdAllFields,
  Deals: handleDealsFields,
  CSParameter: handleCSParameterFields,
};

// ISSUER-Feld PROBLEM:
export const skipIssuerForTables = new Set(['ecb', 'fed', 'yahoo', 'CSParameter']);

// ISSUER-Feld PROBLEM:
export function shouldSkipTable(tableName) {
  return skipIssuerForTables.has(tableName) || (typeof tableName === 'string' && tableName.startsWith('Deals'));
}






// Generiert Eingabefelder für ein gegebenes `rowData`-Objekt
export function generateInputFields(rowData, form, uniqueIssuers, selectedTableName) {
  console.log('Generating input fields for:', selectedTableName);

  // Sortiere `uniqueIssuers` alphabetisch (optional)
  uniqueIssuers.sort();

  Object.keys(rowData).forEach((fieldName) => {
    // Falls das Feld `ISSUER` ist und es für diese Tabelle ignoriert werden soll → Überspringen
    if (fieldName === 'ISSUER' && shouldSkipTable(selectedTableName)) {
      console.log(`Skipping ISSUER field for table: ${selectedTableName}`);
      return;
    }

    // Erstelle eine Form-Row für das Feld
    const formRow = document.createElement('div');
    formRow.classList.add('form-row');

    // Label für das Feld erstellen
    const label = document.createElement('label');
    label.textContent = fieldName;
    label.classList.add('label');

    // Prüfe, ob eine spezielle Handler-Funktion für diese Tabelle existiert
    for (const [prefix, handler] of Object.entries(tableHandlers)) {
      if (selectedTableName.startsWith(prefix)) {
        if (handler(fieldName, rowData, formRow, label)) {
          form.appendChild(formRow);
          return; // Falls Spezialverarbeitung durchgeführt wurde → nächstes Feld
        }
      }
    }

    // Standardmäßiges Eingabefeld für alle anderen Fälle
    const input = document.createElement('input');
    input.type = 'text';
    input.value = rowData[fieldName] || '';
    input.setAttribute('data-field', fieldName);
    input.classList.add('input-field');

    // Feld dem Formular hinzufügen
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
        case 'ISSUER': {
          const issuerOptions = filteredIssuerData
            .map((issuer) => issuer.ISSUER)
            .filter(Boolean)
            .sort();
          const uniqueIssuerOptions = [...new Set(issuerOptions)];
          const issuerDropdown = createDropdown(fieldName, uniqueIssuerOptions, rowData[fieldName]);
        
          // Event Listener: Update Ticker when ISSUER changes
          issuerDropdown.addEventListener('change', function () {
            updateTickerDropdown(this.value);
          });
        
          formRow.appendChild(label);
          formRow.appendChild(issuerDropdown);
          return true;
        }
        
        case 'TICKER': {
          const tickerOptions = filteredIssuerData
            .map((issuer) => issuer.TICKER)
            .filter(Boolean)
            .sort();
          const uniqueTickerOptions = [...new Set(tickerOptions)];
          const tickerDropdown = createDropdown(fieldName, uniqueTickerOptions, rowData[fieldName]);
        
          // Event Listener: Update ISSUER when Ticker changes
          tickerDropdown.addEventListener('change', function () {
            updateIssuerDropdown(this.value);
          });
        
          formRow.appendChild(label);
          formRow.appendChild(tickerDropdown);
          return true;
        }
        

        default:
          return false; // Return false if no case matches
      }
    }
        function updateTickerDropdown(selectedIssuer) {
          const tickerDropdown = document.querySelector('[data-field="TICKER"]');
          if (!tickerDropdown) return;
        
          // Find the corresponding Ticker for the selected Issuer
          const matchedTicker = filteredIssuerData.find((item) => item.ISSUER === selectedIssuer)?.TICKER;
        
          // Update the Ticker dropdown
          tickerDropdown.innerHTML = '';
          if (matchedTicker) {
            const option = document.createElement('option');
            option.value = matchedTicker;
            option.textContent = matchedTicker;
            tickerDropdown.appendChild(option);
            tickerDropdown.value = matchedTicker; // Auto-select the value
          }
        }
        function updateIssuerDropdown(selectedTicker) {
          const issuerDropdown = document.querySelector('[data-field="ISSUER"]');
          if (!issuerDropdown) return;
        
          // Find the corresponding Issuer for the selected Ticker
          const matchedIssuer = filteredIssuerData.find((item) => item.TICKER === selectedTicker)?.ISSUER;
        
          // Update the Issuer dropdown
          issuerDropdown.innerHTML = '';
          if (matchedIssuer) {
            const option = document.createElement('option');
            option.value = matchedIssuer;
            option.textContent = matchedIssuer;
            issuerDropdown.appendChild(option);
            issuerDropdown.value = matchedIssuer; // Auto-select the value
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
