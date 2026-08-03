import { getFormatRules, formatInputFieldValue } from '../../../utils/tableCellFormats.js';

// EDIT Column is in processData!!!

function processData(data, selectedTableName, columnLabelMap = {}, options = {}) {
  let html = '';
  const formatRules = getFormatRules();

  // ================================
  // Konfiguration: Edit-Column
  // ================================
const excludeEditColumnTables = [
  'tblTS',
  'v_PRODUCTS_APP',
  'v_PRODUCTS_CANONICAL',
  'PRODUCTS_MASTER',
  'MVaRMain',
  'CVaRMain',
  'EADMain',
  'Portfolios',
  'PortMain',
  'MarketVaR',
  'CreditVaR',
  'sortedLossesIssuerMain',
  'EAD',
  'Portfolio',
  'DealsMain',
  'OFFERS_DATA',
  'OFFERS_Anleihen_Karl_Franzens_UniversitÃ¤t_150925',
  'CPV01_Details',   // Sensitivities: CPV01-Details-Tabelle -> keine Edit-Spalte
  'Vega_Details',    // Sensitivities: Vega-Details-Tabelle -> keine Edit-Spalte
];

  const excludePortTables = /^Port/;

  const includeEditColumn =
    options.includeEditColumn !== false &&
    !excludeEditColumnTables.includes(selectedTableName) &&
    !excludePortTables.test(selectedTableName);

  // ================================
  // Konfiguration: Radio-Select
  // ================================
  const radioTables = new Set(['MVaRInput', 'CreditVaRInput']);
  const includeRadioSelect = radioTables.has(selectedTableName);

  // ================================
  // Tabelle erstellen
  // ================================
  html += '<table id="dataTable">';

  if (!data || data.length === 0) {
    html += '<thead><tr><th>No data available</th></tr></thead><tbody></tbody></table>';
    return html;
  }

  // Interne Felder (z.B. __rowid als Edit-Schlüssel) nicht als Spalte anzeigen.
  let columnNames = Object.keys(data[0]).filter((c) => !String(c).startsWith('__'));

  // EAD-Spezialfall: NOTIONAL als EAD labeln
  if (selectedTableName === 'EAD') {
    columnNames = columnNames.map(columnName =>
      columnName === 'NOTIONAL' ? 'EAD' : columnName
    );
  }

  html += generateTableHeader(
    columnNames,
    includeRadioSelect,
    includeEditColumn,
    columnLabelMap
  );
  html += generateTableData(
    data,
    columnNames,
    selectedTableName,
    includeRadioSelect,
    includeEditColumn,
    formatRules
  );

  html += '</table>';
  return html;
}

function generateTableHeader(columnNames, includeRadioSelect, includeEditColumn, columnLabelMap) {
  let html = '<thead><tr>';

  if (includeRadioSelect) {
    html += '<th class="table-header">Select</th>';
  }

  columnNames.forEach((columnName) => {
  const label = columnLabelMap[columnName] || columnName;

      html += `
        <th
          class="table-header sortable-header"
          data-column-key="${columnName}"
          title="${label}"
        >
          ${label}
        </th>
      `;
    });
    

  if (includeEditColumn) {
    html += '<th class="table-header">Edit</th>';
  }

  html += '</tr></thead>';
  return html;
}

// Market Risk radio default. Order:
//   CustomerMarketRiskSetting.default_mvar_interval_name (window-exposed)
//   -> ROLLING_1 -> STRESSED -> first MVaRInput row.
function resolveMvarDefaultIntervalName(data) {
  const rows = Array.isArray(data) ? data : [];
  const names = new Set(rows.map((r) => String(r.INTERVAL_NAME)));

  const candidates = [
    (typeof window !== 'undefined' ? window.__customerMarketRiskDefaultInterval : null),
    'ROLLING_1',
    'STRESSED',
  ];

  for (const c of candidates) {
    if (c && names.has(String(c))) return String(c);
  }

  return rows.length ? String(rows[0].INTERVAL_NAME) : null;
}

function generateTableData(
  data,
  columnNames,
  selectedTableName,
  includeRadioSelect,
  includeEditColumn,
  formatRules
) {
  let html = '<tbody>';

  // MVaRInput radio default is the customer-configured default
  // (CustomerMarketRiskSetting), not a hardcoded interval. See resolver below.
  const mvarDefaultInterval =
    selectedTableName === 'MVaRInput' ? resolveMvarDefaultIntervalName(data) : null;

  // FÃ¼r CreditVaRInput: Index der aktiven Konfiguration ermitteln
  let activeIndex = -1;
  if (selectedTableName === 'CreditVaRInput') {
    activeIndex = data.findIndex(row => row.is_active === 1 || row.is_active === true);
    if (activeIndex === -1 && data.length > 0) {
      activeIndex = data.length - 1; // Fallback: letzte Zeile
    }
  }

  data.forEach((item, rowIndex) => {
    html += '<tr>';

    if (includeRadioSelect) {
      let isChecked = false;

      if (selectedTableName === 'MVaRInput') {
        isChecked = (item.INTERVAL_NAME === mvarDefaultInterval);
      } else if (selectedTableName === 'CreditVaRInput') {
        isChecked = (rowIndex === activeIndex);
      }

      html += generateRadioCell(item, rowIndex, selectedTableName, isChecked);
    }

    columnNames.forEach((columnName) => {
      html += generateDataCell(item, columnName, selectedTableName, formatRules);
    });

    if (includeEditColumn) {
      html += generateEditCell(rowIndex);
    }

    html += '</tr>';
  });

  html += '</tbody>';
  return html;
}

/**
 * Erzeugt die Radio-Zelle:
 * - MVaRInput: scenario-radio + data-interval
 * - CreditVaRInput: cvar-radio + data-name
 */
function generateRadioCell(item, rowIndex, selectedTableName, isChecked) {
  const checkedAttr = isChecked ? 'checked' : '';

  // ðŸ”¹ MVaRInput - Single-Select checkbox/tile group. UI style only; exactly one
  // interval stays selected (enforced in JS in mvarInputPanel.js). Class/data
  // attributes kept so existing selectors (.scenario-radio:checked, data-interval,
  // data-id) keep working.
  if (selectedTableName === 'MVaRInput') {
    return `<td>
      <input
        type="checkbox"
        name="scenario-select"
        class="scenario-radio scenario-checkbox"
        data-interval="${item.INTERVAL_NAME}"
        data-id="${item.id ?? ''}"
        ${checkedAttr}>
    </td>`;
  }

  // ðŸ”¹ CreditVaRInput - NEU: CVaR-Konfiguration nach Name auswÃ¤hlen
  if (selectedTableName === 'CreditVaRInput') {
    const name = item.name || item.NAME || '';
    return `<td>
      <input 
        type="radio"
        name="cvar-config"
        class="cvar-radio"
        data-name="${name}"
        data-id="${item.id ?? ''}"
        ${checkedAttr}>
    </td>`;
  }

  // Fallback (sollte bei unserer radioTables-Logik eigentlich nicht auftreten)
  return '<td></td>';
}

function generateDataCell(item, columnName, selectedTableName, formatRules) {
  const dataKey =
    (columnName === 'EAD' && selectedTableName === 'EAD')
      ? 'NOTIONAL'
      : columnName;

  const rawValue = item[dataKey];          // ungefilterter Wert fÃ¼r Tooltip
  let cellValue = rawValue;                // Anzeige-Wert

  if (formatRules[columnName]) {
    cellValue = formatRules[columnName](cellValue);
  }

  const displayValue = (cellValue ?? '').toString();
  const titleValue = escapeHtml(rawValue ?? displayValue);

  return `<td title="${titleValue}">${displayValue}</td>`;
}


function generateEditCell(rowIndex) {
  return `<td><button class="edit-button" data-row="${rowIndex}">Edit</button></td>`;
}

function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}


// Function to filter columns in the data array. Is used in PORT and PROD...
function filterColumnsInData(data, columnsToShow) {
  return data.map((row) => {
    return columnsToShow.reduce((obj, column) => {
      obj[column] = row[column];
      return obj;
    }, {});
  });
}


function gatherModalData(form) {
  if (!form) return {};

  const newRowData = {};
  const inputFields = form.querySelectorAll('input, select');
  const presentFields = new Set();

  inputFields.forEach((input) => {
    const fieldName = input.getAttribute('data-field');
    if (!fieldName) return;

    presentFields.add(fieldName);

    let rawVal;
    if (input.type === 'checkbox') rawVal = input.checked ? '1' : '0';
    else rawVal = (input.value ?? '').toString().trim();

    const value = formatInputFieldValue(fieldName, rawVal);
    newRowData[fieldName] = (value != null && String(value).toLowerCase() !== 'null') ? value : '';
  });

  const hasStart = presentFields.has('START_DATE');
  const hasMat = presentFields.has('MATURITY');

  const startToken = (hasStart ? (form.querySelector('#start_dateToken')?.value || '') : '').trim();
  const matToken = (hasMat ? (form.querySelector('#maturityToken')?.value || '') : '').trim();

  const startISO = (hasStart ? (form.querySelector('#start_dateDate')?.value || '') : '').trim();
  const matISO = (hasMat ? (form.querySelector('#maturityDate')?.value || '') : '').trim();

  if (hasStart) {
    if (startToken) newRowData.START_DATE = startToken;
    else if (startISO) newRowData.START_DATE = startISO;
  }

  if (hasMat) {
    if (matToken) newRowData.MATURITY = matToken;
    else if (matISO) newRowData.MATURITY = matISO;
  }

  return newRowData;
}



export { filterColumnsInData, gatherModalData };
export default processData;






