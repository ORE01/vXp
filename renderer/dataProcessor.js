import { formatNumber, getFormatRules } from '../utils/format.js';

function processData(data, selectedTableName, columnLabelMap = {}) {
  //console.log(`🔍 selectedTableName: ${selectedTableName}`);
  let html = '';
  const formatRules = getFormatRules();

  // ================================
  // 💡 Alle Konfigurations-Abfragen gesammelt
  // ================================
  const excludeEditColumnTables = [
    'tblTS', 'MVaRMain', 'CVaRMain', 'EADMain', 'Portfolios',
    'PortMain', 'MarketVaR', 'CreditVaR', 'PortMain', 'sortedLossesIssuerMain',
    'EAD', 'Portfolio',
  ];

  const excludePortTables = /^Port/;

  const includeEditColumn = !excludeEditColumnTables.includes(selectedTableName) && !excludePortTables.test(selectedTableName);
  // INCLUDE RADIO CELL
  const includeRadioSelect = selectedTableName === 'MVaRInput_2'; // z.B. nur für MVaRInput_2

  // ================================
  // 💡 Tabelle erstellen
  // ================================
  html += '<table id="dataTable">';

  if (!data || data.length === 0) {
    html += '<thead><tr><th>No data available</th></tr></thead><tbody></tbody></table>';
    return html;
  }

  let columnNames = Object.keys(data[0]);
  if (selectedTableName === 'EAD') {
    columnNames = columnNames.map(columnName => columnName === 'NOTIONAL' ? 'EAD' : columnName);
  }

  html += generateTableHeader(columnNames, includeRadioSelect, includeEditColumn, columnLabelMap);
  html += generateTableData(data, columnNames, selectedTableName, includeRadioSelect, includeEditColumn, formatRules);

  html += '</table>';
  return html;
}

    function generateTableHeader(columnNames, includeRadioSelect, includeEditColumn, columnLabelMap) {
      let html = '<thead><tr>';

      if (includeRadioSelect) {
        html += '<th>Select</th>';
      }

      columnNames.forEach((columnName) => {
        const label = columnLabelMap[columnName] || columnName;  // Mapping nur anwenden, wenn übergeben
        html += `<th>${label}</th>`;
      });

      if (includeEditColumn) {
        html += '<th>Edit</th>';
      }

      html += '</tr></thead>';
      return html;
    }


    function generateTableData(data, columnNames, selectedTableName, includeRadioSelect, includeEditColumn, formatRules) {
      let html = '<tbody>';
      const defaultInterval = 'STRESSED';  // 👈 dein gewünschter Default hier

      data.forEach((item, rowIndex) => {
        html += '<tr>';

        if (includeRadioSelect) {
          html += generateRadioCell(item, defaultInterval);  // 👈 Default mitgeben
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


        function generateRadioCell(item, defaultInterval) {
          const isChecked = item.INTERVAL_NAME === defaultInterval ? 'checked' : '';
          return `<td>
            <input type="radio" name="scenario-select" class="scenario-radio" data-interval="${item.INTERVAL_NAME}" ${isChecked}>
          </td>`;
        }


        function generateDataCell(item, columnName, selectedTableName, formatRules) {
          const dataKey = (columnName === 'EAD' && selectedTableName === 'EAD') ? 'NOTIONAL' : columnName;
          let cellValue = item[dataKey];

          if (formatRules[columnName]) {
            cellValue = formatRules[columnName](cellValue);
          }

          return `<td>${cellValue}</td>`;
        }

        function generateEditCell(rowIndex) {
          return `<td><button class="edit-button" data-row="${rowIndex}">Edit</button></td>`;
        }

        // Function to filter columns in the data array. Is used in PORT and PROD...
        function filterColumnsInData(data, columnsToShow) {
          //console.log('filterColumnsInData:', data);
          // console.log('filterColumnsInData:', columnsToShow);
          return data.map((row) => {
            return columnsToShow.reduce((obj, column) => {
              obj[column] = row[column];
              return obj;
            }, {});
          });
        }



export default processData;
export { filterColumnsInData };