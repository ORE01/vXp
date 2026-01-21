import { getFormatRules } from '../../../utils/format.js';

// EDIT Column is in processData!!!

function processData(data, selectedTableName, columnLabelMap = {}) {
  let html = '';
  const formatRules = getFormatRules();

  // ================================
  // 💡 Konfiguration: Edit-Column
  // ================================
  const excludeEditColumnTables = [
    'tblTS', 'ProdAll', 'MVaRMain', 'CVaRMain', 'EADMain', 'Portfolios',
    'PortMain', 'MarketVaR', 'CreditVaR', 'PortMain', 'sortedLossesIssuerMain',
    'EAD', 'Portfolio', 'ProdALL', 'DealsMain', 'OFFERS_DATA', 'OFFERS_Anleihen_Karl_Franzens_Universität_150925',
  ];

  const excludePortTables = /^Port/;

  const includeEditColumn =
    !excludeEditColumnTables.includes(selectedTableName) &&
    !excludePortTables.test(selectedTableName);

  // ================================
  // 💡 Konfiguration: Radio-Select
  // ================================
  const radioTables = new Set(['MVaRInput', 'CreditVaRInput']);
  const includeRadioSelect = radioTables.has(selectedTableName);

  // ================================
  // 💡 Tabelle erstellen
  // ================================
  html += '<table id="dataTable">';

  if (!data || data.length === 0) {
    html += '<thead><tr><th>No data available</th></tr></thead><tbody></tbody></table>';
    return html;
  }

  let columnNames = Object.keys(data[0]);

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
    const label = columnLabelMap[columnName] || columnName; // sichtbarer Text
    html += `<th class="table-header" title="${label}">${label}</th>`;
  });

  if (includeEditColumn) {
    html += '<th class="table-header">Edit</th>';
  }

  html += '</tr></thead>';
  return html;
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

  const defaultInterval = 'STRESSED';

  // Für CreditVaRInput: Index der aktiven Konfiguration ermitteln
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
        isChecked = (item.INTERVAL_NAME === defaultInterval);
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

  // 🔹 MVaRInput – bestehendes Verhalten beibehalten
  if (selectedTableName === 'MVaRInput') {
    return `<td>
      <input 
        type="radio" 
        name="scenario-select"
        class="scenario-radio"
        data-interval="${item.INTERVAL_NAME}"
        data-id="${item.id ?? ''}"
        ${checkedAttr}>
    </td>`;
  }

  // 🔹 CreditVaRInput – NEU: CVaR-Konfiguration nach Name auswählen
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

  const rawValue = item[dataKey];          // ungefilterter Wert für Tooltip
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

export default processData;
export { filterColumnsInData };
