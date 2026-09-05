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
      case 'erste':
        // Auf die (unsichtbare) rowid keyen -> ALLE sichtbaren Spalten
        // bleiben editierbar, leere Werte unkritisch. __rowid liefert der
        // Data-Pump (siehe rendererDataPump). Hinweis: die tblTS-Kaskade beim
        // Löschen gilt NUR für ecb/fed/yahoo, NICHT für erste (reines Mapping).
        return { column: 'rowid', value: newData.__rowid };

      case 'CUSTOMER_PRODUCT_CATEGORY_SETUP':
        uniqueIdentifierColumn = 'id';
        break;

      case 'MVaRInput':
        // PK ist 'id'; newData enthält id ({...row, ...form} in modalEditAction).
        uniqueIdentifierColumn = 'id';
        break;

      case 'CreditVaRInput':
        // CVaR General Settings: PK ist 'id' (INTEGER). Ohne diesen case landete
        // der Edit im default -> "Unknown table" -> null -> Zeile nicht speicherbar.
        uniqueIdentifierColumn = 'id';
        break;

      case 'PortfolioHistoryMetrics':
      case 'PortfolioHistoryMetricsCopy':
        // Kein Einzel-PK: eindeutig ueber (port_name, DATE). Ohne diesen case landete
        // das Ueberschreiben ("Save to Historic Metrics" fuer ein bereits vorhandenes
        // Datum) im default -> null -> updateRecord derefereziert uniqueIdentifier.column
        // -> "Cannot read properties of null (reading 'column')". updateRecord kennt den
        // composite-Zweig (uniqueIdentifier.composite + .columns).
        return {
          composite: true,
          columns: { port_name: newData.port_name, DATE: newData.DATE },
        };

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