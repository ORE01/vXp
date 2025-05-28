export function groupDataByColumn(data, groupByColumn) {
  return data.reduce((acc, row) => {
    const key = row[groupByColumn] || 'Unbekannt';
    (acc[key] = acc[key] || []).push(row);
    return acc;
  }, {});
}