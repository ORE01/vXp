function processData(data, selectedTableName) {
  let html = '';
  console.log('dataP proData selectedTableName:', selectedTableName);
  console.log('processData - data:', data);
  const tableName = selectedTableName
  // Generate table headers
  html += '<table id="dataTable">';
  html += '<thead><tr>'; 
  //console.log('dataP proData data:', data);
  // Get column names from the keys of the first object in the data array
  const columnNames = Object.keys(data[0]);

  // Create table header cells
  columnNames.forEach((columnName) => {
    html += `<th>${columnName}</th>`;
  });

// Add an extra column for edit buttons but exclude:
if (tableName !== 'PortMain' && tableName !== 'tblTS' && tableName !== 'MVaRMain') {
  // Add column
  html += '<th>Edit</th>'; 
}

  html += '</tr></thead>';

  if (data.length === 0) {
    // Display a message when there is no data
    html += '<tbody><tr><td colspan="' + (columnNames.length + 1) + '">No data available</td></tr></tbody>';
  } else {
    // Generate table rows with data
    html += '<tbody>';
    data.forEach((item, rowIndex) => {
      html += '<tr>';

      // Fill table cells with data values
      columnNames.forEach((columnName) => {
        html += `<td>${item[columnName]}</td>`;
      });


      // Add an edit button to each row but excude:
      if (tableName !== 'PortMain' && tableName !== 'tblTS' && tableName !== 'MVaRMain') {
        // Add Edit Button
        html += `<td><button class="edit-button" data-row="${rowIndex}">Edit</button></td>`;
      }

      html += '</tr>';
    });
    html += '</tbody>';
  }

  html += '</table>';

  return html;
}
  // Function to filter columns in the data array
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