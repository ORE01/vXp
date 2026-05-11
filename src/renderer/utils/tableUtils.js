export function getCleanTableName(tableName) {
  if (typeof tableName !== 'string') {
    console.error('tableName is not a string.');
    return '';
  }

  return tableName.endsWith('Data')
    ? tableName.slice(0, -4)
    : tableName;
}

export function getUniqueIdentifier(newData, selectedTableName) {
  console.log('newData, selectedTableName:', newData, selectedTableName);

  let uniqueIdentifierColumn;

  if (selectedTableName.startsWith('Deals')) {
    uniqueIdentifierColumn = 'TRADE_ID';
  } else {
    switch (selectedTableName) {
      case 'Issuer':
        uniqueIdentifierColumn = 'TICKER';
        break;
      case 'ProdAll':
        uniqueIdentifierColumn = 'PROD_ID';
        break;
      case 'CSParameter':
        uniqueIdentifierColumn = 'CSSzenario';
        break;
      case 'ecb':
      case 'fed':
      case 'yahoo':
      case 'ProdCouponSchedules':
        uniqueIdentifierColumn = 'ID';
        break;
      default:
        console.error('Unknown table:', selectedTableName);
        return null;
    }
  }

  if (uniqueIdentifierColumn && newData.hasOwnProperty(uniqueIdentifierColumn)) {
    return {
      column: uniqueIdentifierColumn,
      value: newData[uniqueIdentifierColumn]
    };
  } else {
    console.error('Unable to determine the unique identifier for:', selectedTableName);
    return null;
  }
}