import { prodData } from '../FRONT_END/NEW_PRODUCTS/PROD.js';
import { convertDateToISO, formatDisplayValue } from '../utils/format.js';
import { handleProdAllFields } from '../FRONT_END/NEW_PRODUCTS/prodSimpleCoupon.js';


// ===================================GENERAL SETTINGS ================================================================


// mapping of tables to HANDLER:
const tableHandlers = {
  ProdAll: handleProdAllFields,
  Deals: handleDealsFields,
  CSParameter: handleCSParameterFields,
  CreditVaRInput: handleCreditVaRInputFields,
  MVaRInput: handleMVaRInputFields,
};

// Felder, die im Modal NICHT angezeigt werden sollen – je Tabelle
const hiddenFieldsByTable = {
  MVaRInput: new Set(['id']),  
  //CreditVaRInput: new Set(['is_active', 'updated_at']), bleibt als Beispiel stehen
  CreditVaRInput: new Set(['is_active', 'id']), 
};


// ==================================ISSUER FIELD PROBLEM =================================================================

// ISSUER-Feld PROBLEM:
export const skipIssuerForTables = new Set(['ecb', 'fed', 'yahoo', 'CSParameter','Portfolios', 'MVaRInput', 'PortfolioHistoryMetrics']);

// ISSUER-Feld PROBLEM:
export function shouldSkipTable(tableName) {
  return skipIssuerForTables.has(tableName) || (typeof tableName === 'string' && tableName.startsWith('Deals'));
}


// ===================================INPUT FIELD per TABLE===================================================================

export function generateInputFields(rowData, form, uniqueIssuers, selectedTableName) {
  uniqueIssuers.sort();

  const hiddenFields = hiddenFieldsByTable[selectedTableName];

  Object.keys(rowData).forEach((fieldName) => {
    if (hiddenFields && hiddenFields.has(fieldName)) return;        // 💡 generisches Hiding

    if (fieldName === 'ISSUER' && shouldSkipTable(selectedTableName)) return;

    const formRow = document.createElement('div');
    formRow.classList.add('form-row');

    const label = document.createElement('label');
    label.textContent = fieldName;
    label.classList.add('label');

    for (const [prefix, handler] of Object.entries(tableHandlers)) {
      if (selectedTableName.startsWith(prefix)) {
        if (handler(fieldName, rowData, formRow, label)) {
          form.appendChild(formRow);
          return;
        }
      }
    }

    const input = document.createElement('input');
    input.type = 'text';

    const rawValue = rowData[fieldName];
    input.value = formatDisplayValue(fieldName, rawValue); // z.B. 0.1 -> "10.00%"

    input.setAttribute('data-field', fieldName);
    input.classList.add('input-field');

    formRow.appendChild(label);
    formRow.appendChild(input);
    form.appendChild(formRow);

  });
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
        const input = document.createElement('input');
        input.type = 'text';

        const rawValue = rowData[fieldName];
        input.value = formatDisplayValue(fieldName, rawValue);

        input.setAttribute('data-field', fieldName);
        input.classList.add('input-field');

    
          // ❌ Remove this line to allow editing:
          // input.disabled = true;
    
          formRow.appendChild(label);
          formRow.appendChild(input);
          return true;
        }
        default:
          return false;
      }
    }

    function handleCreditVaRInputFields(fieldName, rowData, formRow, label) {
      switch (fieldName) {
        case 'cr_model': {
          const crModels = ['ASRF', 'MF_GC'];
          const crModelsDropdown = createDropdown(fieldName, crModels, rowData[fieldName]);
          formRow.appendChild(label);
          formRow.appendChild(crModelsDropdown);
          return true;
        }

        case 'updated_at': {
          // Kein Label anhängen, Feld unsichtbar halten
          const input = document.createElement('input');
          input.type = 'hidden';
          input.value = new Date().toISOString(); // aktueller Timestamp
          input.setAttribute('data-field', fieldName);

          formRow.appendChild(input);
          return true;
        }

        default:
          return false; // Standard-Input für andere Felder
      }
    }


    function handleMVaRInputFields(fieldName, rowData, formRow, label) {
  // Falls du MVAR_COLUMNS wirklich nutzen willst:
  // if (!MVAR_COLUMNS.includes(fieldName)) return false;

  // id wird bereits über hiddenFieldsByTable gefiltert, muss hier nicht mehr geprüft werden

  // Typ-Logik: typische numerische Felder als number-Input
  const numericFields = new Set([
    'conf_level',
    'n_simulations',
    'horizon_days',
    'holding_period',
    'lambda',
    'decay_factor',
  ]);

const input = document.createElement('input');
input.type = numericFields.has(fieldName) ? 'number' : 'text';

const rawValue = rowData[fieldName];
input.value = formatDisplayValue(fieldName, rawValue);

input.setAttribute('data-field', fieldName);
input.classList.add('input-field');


  formRow.appendChild(label);
  formRow.appendChild(input);
  return true;  // sagt dem Generator: "Ich habe dieses Feld behandelt."
}



    export function createDropdown(fieldName, options, selectedValue) {
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








