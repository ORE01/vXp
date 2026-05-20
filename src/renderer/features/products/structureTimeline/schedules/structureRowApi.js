'use strict';

export function sendAddProductStructureRow(newRowData, requestId) {
  window.api.send('add-new-row', {
    cleanTableName: 'PRODUCT_STRUCTURE',
    newData: newRowData,
    requestId,
  });
}

export function sendUpdateProductStructureRow(structureId, newData) {
  window.api.send('update-data', {
    cleanTableName: 'PRODUCT_STRUCTURE',
    rowIndex: null,
    newData,
    uniqueIdentifier: {
      column: 'structure_id',
      value: structureId,
    },
  });
}