import { formatNumber, getFormatRules } from '../utils/format.js';


// function processData(data, selectedTableName) {
//   console.log(`🔍 selectedTableName: ${selectedTableName}`);
//   let html = '';
//   const formatRules = getFormatRules();


//                 //console.log('dataP proData selectedTableName:', selectedTableName);
//                 //console.log('processData - data:', data);

//                 // Define a list of tables to exclude from having an "Edit" column
//                 const excludeEditColumnTables = [
//                   'tblTS', 
//                   'MVaRMain', 
//                   'CVaRMain',
//                   'EADMain',
//                   'Portfolios',
//                   'PortMain',
//                   'MarketVaR',
//                   'CreditVaR',
//                   'PortMain',
//                   'sortedLossesIssuerMain',
//                   'EAD',
//                   'Portfolio',
   


//                 ];

//                 // Exclude all table names that start with "Port"
//                 const excludePortTables = /^Port/;

//                 // Check if the current table is in the list of tables to exclude the "Edit" column
//                 const includeEditColumn = !excludeEditColumnTables.includes(selectedTableName) && !excludePortTables.test(selectedTableName);




//   // Generate table headers
//   html += '<table id="dataTable">';
//   html += '<thead><tr>';

//   // Check if data is empty
//   if (!data || data.length === 0) {
//     html += '<th>No data available</th></tr></thead><tbody></tbody></table>';
//     return html;
//   }

//   // Get column names from the keys of the first object in the data array
//   let columnNames = Object.keys(data[0]);

//   // If table name is EADMain, replace column name NOTIONAL with EAD
//   if (selectedTableName === 'EAD') {
//     columnNames = columnNames.map(columnName => columnName === 'NOTIONAL' ? 'EAD' : columnName);
//   }

//   // Create table header cells
//   columnNames.forEach((columnName) => {
//     html += `<th>${columnName}</th>`;
//   });

//   // Optionally add an extra "Edit" column header if not excluded
//   if (includeEditColumn) {
//     html += '<th>Edit</th>';
//   }

//   html += '</tr></thead><tbody>';

//   data.forEach((item, rowIndex) => {
//     html += '<tr>';
//     columnNames.forEach((columnName) => {
//       const dataKey = columnName === 'EAD' && selectedTableName === 'EAD' ? 'NOTIONAL' : columnName;
//       let cellValue = item[dataKey]; 

//       if (formatRules[columnName]) {
//         cellValue = formatRules[columnName](cellValue);
//       }

//       html += `<td>${cellValue}</td>`;
//     });

//     // Optionally add an "Edit" button to each row if not excluded
//     if (includeEditColumn) {
//       html += `<td><button class="edit-button" data-row="${rowIndex}">Edit</button></td>`;
//     }

//     html += '</tr>';
//   });

//   html += '</tbody></table>';
//   return html;
// }

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