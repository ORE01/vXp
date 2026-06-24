export function getCleanTableName(tableName) {
  if (typeof tableName !== 'string') {
    console.error('tableName is not a string.');
    return '';
  }

  return tableName.endsWith('Data')
    ? tableName.slice(0, -4)
    : tableName;
}

function isProductTableName(tableName) {
  return (
    tableName === 'v_PRODUCTS_APP' ||
    tableName === 'v_PRODUCTS_CANONICAL' ||
    tableName === 'PRODUCTS_MASTER'
  );
}

export function getUniqueIdentifier(newData, selectedTableName) {
  console.log('newData, selectedTableName:', newData, selectedTableName);

  let uniqueIdentifierColumn;

  if (selectedTableName.startsWith('Deals')) {
    uniqueIdentifierColumn = 'TRADE_ID';
  } else if (isProductTableName(selectedTableName)) {
    uniqueIdentifierColumn = 'PROD_ID';
  } else {
    switch (selectedTableName) {
      case 'Issuer':
        uniqueIdentifierColumn = 'TICKER';
        break;

      case 'CSParameter':
        uniqueIdentifierColumn = 'CSSzenario';
        break;

      case 'ecb':
      case 'fed':
      case 'yahoo':
        uniqueIdentifierColumn = 'ID';
        break;

      case 'CUSTOMER_PRODUCT_CATEGORY_SETUP':
        uniqueIdentifierColumn = 'id';
        break;

      default:
        console.error('Unknown table:', selectedTableName);
        return null;
    }
  }

  if (uniqueIdentifierColumn && Object.prototype.hasOwnProperty.call(newData, uniqueIdentifierColumn)) {
    return {
      column: uniqueIdentifierColumn,
      value: newData[uniqueIdentifierColumn],
    };
  }

  if (
    isProductTableName(selectedTableName) &&
    Object.prototype.hasOwnProperty.call(newData, 'product_id')
  ) {
    return {
      column: 'PROD_ID',
      value: newData.product_id,
    };
  }

  console.error('Unable to determine the unique identifier for:', selectedTableName);
  return null;
}