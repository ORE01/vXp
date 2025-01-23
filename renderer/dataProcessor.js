import { formatNumber } from '../utils/format.js';


function processData(data, selectedTableName) {
  let html = '';
  console.log('dataP proData selectedTableName:', selectedTableName);
  //console.log('processData - data:', data);

  // Define a list of tables to exclude from having an "Edit" column
  const excludeEditColumnTables = [
    'tblTS', 
    'MVaRMain', 
    'CVaRMain',
    'EADMain',
    'EADMain_rating', 
    'sortedLossesMain_rating', 
    'sortedLossesIssuerMain_rating', 
    'EADMain_market', 
    'sortedLossesMain_market', 
    'sortedLossesIssuerMain_market',    
    'EADMain_norm', 
    'sortedLossesMain_norm', 
    'sortedLossesIssuerMain_norm', 
    'EADMain_marketNorm', 
    'sortedLossesMain_marketNorm', 
    'sortedLossesIssuerMain_marketNorm', 
  ];

  // Exclude all table names that start with "Port"
  const excludePortTables = /^Port/;

  // Check if the current table is in the list of tables to exclude the "Edit" column
  const includeEditColumn = !excludeEditColumnTables.includes(selectedTableName) && !excludePortTables.test(selectedTableName);

  // Generate table headers
  html += '<table id="dataTable">';
  html += '<thead><tr>';

  // Check if data is empty
  if (!data || data.length === 0) {
    html += '<th>No data available</th></tr></thead><tbody></tbody></table>';
    return html;
  }

  // Get column names from the keys of the first object in the data array
  let columnNames = Object.keys(data[0]);

  // If table name is EADMain, replace column name NOTIONAL with EAD
  if (selectedTableName === 'EADMain') {
    columnNames = columnNames.map(columnName => columnName === 'NOTIONAL' ? 'EAD' : columnName);
  }

  // Create table header cells
  columnNames.forEach((columnName) => {
    html += `<th>${columnName}</th>`;
  });

  // Optionally add an extra "Edit" column header if not excluded
  if (includeEditColumn) {
    html += '<th>Edit</th>';
  }

  html += '</tr></thead><tbody>';

  // const formatNumber = (decimals, isPercentage = false, multiplyBy100 = false) => (value) => {
  //   let number = parseFloat(value);
  //   if (multiplyBy100) number *= 100; 
  //   const options = { minimumFractionDigits: decimals, maximumFractionDigits: decimals };
  //   const formattedNumber = number.toLocaleString('en', options);
  //   return isPercentage ? `${formattedNumber}%` : formattedNumber;
  // };

  const formatRules = {
    'PD': formatNumber(3, true, true), 
    'PD_M': formatNumber(3, true, true), 
    'PD_M_norm': formatNumber(3, true, true), 
    'ytm': formatNumber(3, true, true), 
    'ytm_BUY': formatNumber(3, true, true), 
    'ytmPort': formatNumber(3, true, true), 
    'CONVI': formatNumber(2, true), 
    'NOTIONAL': formatNumber(0), 
    'EAD': formatNumber(0), 
    'LGD': formatNumber(0),
    'LOSS': formatNumber(0),
    'NAV': formatNumber(0),
    'CPV01': formatNumber(0),
    'absolute': formatNumber(0),
  };

  data.forEach((item, rowIndex) => {
    html += '<tr>';
    columnNames.forEach((columnName) => {
      const dataKey = columnName === 'EAD' && selectedTableName === 'EADMain' ? 'NOTIONAL' : columnName;
      let cellValue = item[dataKey]; 

      if (formatRules[columnName]) {
        cellValue = formatRules[columnName](cellValue);
      }

      html += `<td>${cellValue}</td>`;
    });

    // Optionally add an "Edit" button to each row if not excluded
    if (includeEditColumn) {
      html += `<td><button class="edit-button" data-row="${rowIndex}">Edit</button></td>`;
    }

    html += '</tr>';
  });

  html += '</tbody></table>';
  return html;
}

  // Function to filter columns in the data array. Is used in PORT and PROD...
function filterColumnsInData(data, columnsToShow) {
  // console.log('filterColumnsInData:', data);
  // console.log('filterColumnsInData:', columnsToShow);
  return data.map((row) => {
    return columnsToShow.reduce((obj, column) => {
      obj[column] = row[column];
      return obj;
    }, {});
  });
}
// Export the function to be used in other files
export default processData;
export { filterColumnsInData };

//export { processData, filterColumnsInData };