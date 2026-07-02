import { prodData } from '../../../features/products/productTableController.js';
import { convertDateToISO, formatDisplayValue } from '../../../utils/tableCellFormats.js';
import { handleProductFields } from '../../../features/products/productFieldRenderer.js';
import { getFieldConfig } from '../../../features/products/productFieldConfig.js';
import { getTemplateFieldSection } from '../../../features/products/productTemplates.js';



// ===================================GENERAL SETTINGS ================================================================


// mapping of tables to HANDLER:
const tableHandlers = {
  v_PRODUCTS_APP: handleProductFields,
  v_PRODUCTS_CANONICAL: handleProductFields,
  PRODUCTS_MASTER: handleProductFields,

  Deals: handleDealsFields,
  CSParameter: handleCSParameterFields,
  CreditVaRInput: handleCreditVaRInputFields,
  MVaRInput: handleMVaRInputFields,
  Issuer: handleIssuerFields,
  CUSTOMER_PRODUCT_CATEGORY_SETUP: handleCustomerCategoryFields,
};

// Risk -> Market Risk -> Model Selection Edit (table MVaRInput): only model
// parameters are editable here. Legacy MVaRInput columns (red_threshold,
// yellow_threshold) and id are NOT shown. Customer warning limits live in
// CustomerMarketRiskThresholdSetting and are edited only in Customer Setup.
const MVAR_INPUT_EDIT_FIELDS = new Set([
  'INTERVAL_NAME',
  'START',
  'END',
]);

// Felder, die im Modal NICHT angezeigt werden sollen - je Tabelle
const hiddenFieldsByTable = {
  MVaRInput: new Set(['id']),
  //CreditVaRInput: new Set(['is_active', 'updated_at']), bleibt als Beispiel stehen
  CreditVaRInput: new Set(['is_active', 'id']),
  // Issuer: senior_unsecured == RATING (Notching-Anker), die übrigen Ränge
  // werden daraus abgeleitet -> nur RATING als Eingabe zeigen.
  Issuer: new Set([
    'senior_secured',
    'senior_preferred',
    'senior_unsecured',
    'senior_subordinated',
    'junior_subordinated',
  ]),
  // Customer category setup: technical columns are not user-editable.
  CUSTOMER_PRODUCT_CATEGORY_SETUP: new Set(['id', 'created_at', 'updated_at']),
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

  let lastSectionName = null;

  Object.keys(rowData).forEach((fieldName) => {
    if (String(fieldName).startsWith('__')) return;                // interne Felder (z.B. __rowid)
    if (hiddenFields && hiddenFields.has(fieldName)) return;        // generisches Hiding

    // MVaRInput edit drawer: allowlist of editable model parameters only.
    if (selectedTableName === 'MVaRInput' && !MVAR_INPUT_EDIT_FIELDS.has(fieldName)) return;

    if (fieldName === 'ISSUER' && shouldSkipTable(selectedTableName)) return;

    const formRow = document.createElement('div');
    formRow.classList.add('form-row');

    const label = document.createElement('label');
    label.textContent = fieldName;
    label.classList.add('label');

    const templateName = rowData.__PRODUCT_TEMPLATE__;
    const sectionName = getTemplateFieldSection(templateName, fieldName);

    if (sectionName && sectionName !== lastSectionName) {
      const sectionHeader = document.createElement('div');
      sectionHeader.classList.add('form-section-header');
      sectionHeader.textContent = formatSectionLabel(sectionName);

      form.appendChild(sectionHeader);
      lastSectionName = sectionName;
    }

    if (sectionName) {
      formRow.setAttribute('data-product-section', sectionName);
    }

    const fieldConfig = getFieldConfig(selectedTableName, fieldName, rowData);

    if (fieldConfig) {
      const handled = renderConfiguredField(
        fieldName,
        rowData,
        formRow,
        label,
        fieldConfig
      );

      if (handled) {
        form.appendChild(formRow);
        return;
      }
    }

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

    function formatSectionLabel(sectionName) {
      return String(sectionName || '')
        .replace(/_/g, ' ')
        .toLowerCase()
        .replace(/\b\w/g, (char) => char.toUpperCase());
    }

    function renderConfiguredField(fieldName, rowData, formRow, label, config) {
      if (config.type === 'select') {
        const options = Array.isArray(config.options) ? config.options : [];

        const selected =
          rowData[fieldName] ||
          rowData[config.defaultValueFrom] ||
          config.defaultValue ||
          '';

        const dropdown = createDropdown(fieldName, options, selected);

        formRow.appendChild(label);
        formRow.appendChild(dropdown);
        return true;
      }

      if (config.type === 'text' || config.type === 'number') {
        const input = document.createElement('input');
        input.type = config.type;
        input.value = rowData[fieldName] ?? config.defaultValue ?? '';
        input.setAttribute('data-field', fieldName);
        input.classList.add('input-field');

        formRow.appendChild(label);
        formRow.appendChild(input);
        return true;
      }

      return false;
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

    
          // âŒ Remove this line to allow editing:
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
          // Kein Label anhÃ¤ngen, Feld unsichtbar halten
          const input = document.createElement('input');
          input.type = 'hidden';
          input.value = new Date().toISOString(); // aktueller Timestamp
          input.setAttribute('data-field', fieldName);

          formRow.appendChild(input);
          return true;
        }

        default:
          return false; // Standard-Input fÃ¼r andere Felder
      }
    }


    function handleMVaRInputFields(fieldName, rowData, formRow, label) {
  // Falls du MVAR_COLUMNS wirklich nutzen willst:
  // if (!MVAR_COLUMNS.includes(fieldName)) return false;

  // id wird bereits Ã¼ber hiddenFieldsByTable gefiltert, muss hier nicht mehr geprÃ¼ft werden

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

function handleCustomerCategoryFields(fieldName, rowData, formRow, label) {
  // Only category_type is a dropdown; all other columns use the default input.
  if (fieldName !== 'category_type') return false;

  // value -> visible label. Business rule:
  //   ""          -> "Valuation active" (normal valuation)
  //   FIXED_VALUE  -> "No valuation"     (no valuation / fixed value override)
  const options = [
    { value: '', label: 'Valuation active' },
    { value: 'FIXED_VALUE', label: 'No valuation' },
  ];

  const select = document.createElement('select');
  select.id = `${fieldName.toLowerCase()}Select`;
  select.setAttribute('data-field', fieldName);
  select.classList.add('input-field');

  options.forEach(({ value, label: text }) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = text;
    select.appendChild(option);
  });

  // Only an explicit FIXED_VALUE means "no valuation". Empty / NULL / "" / anything
  // else maps to normal valuation (never treat empty as FIXED_VALUE).
  const current = String(rowData[fieldName] ?? '').trim().toUpperCase();
  select.value = current === 'FIXED_VALUE' ? 'FIXED_VALUE' : '';

  formRow.appendChild(label);
  formRow.appendChild(select);
  return true;
}

function handleIssuerFields(fieldName, rowData, formRow, label) {
  switch (fieldName) {

    case 'Country': {
      const countries = (appState.getCountryLookup?.() || appState.countryLookup || [])
        .filter(c => Number(c.is_active ?? 1) === 1)
        .map(c => c.code);

      // Fallback, falls Lookup noch nicht geladen ist
      if (!countries.length) countries.push('GENERAL');

      const selected = rowData[fieldName] ?? 'GENERAL';
      const dropdown = createDropdown(fieldName, countries, selected);

      formRow.appendChild(label);
      formRow.appendChild(dropdown);
      return true;
    }

    default:
      return false;
  }
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















