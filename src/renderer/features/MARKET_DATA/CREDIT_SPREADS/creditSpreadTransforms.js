// creditSpreadTransforms.js

export function pivotCreditSpreadRowsByRating(rows) {
  const rowMap = new Map();

  rows.forEach(row => {
    const rating = String(row?.rating || '').trim();
    const tenor = String(row?.tenor || '').trim();
    const value = parseFloat(String(row?.value ?? '').replace(',', '.'));

    if (!rating || !tenor || Number.isNaN(value)) return;

    if (!rowMap.has(rating)) {
      rowMap.set(rating, { RATING: rating });
    }

    rowMap.get(rating)[tenor] = value;
  });

  return Array.from(rowMap.values());
}

export function extractSortedTenors(rows) {
  if (!Array.isArray(rows) || !rows.length) return [];

  const tenorSet = new Set();

  rows.forEach(row => {
    Object.keys(row || {}).forEach(key => {
      if (key !== 'RATING') tenorSet.add(key);
    });
  });

  return Array.from(tenorSet).sort((a, b) => Number(a) - Number(b));
}

export function normalizeRatings(rows) {
  const fallbackRatings = [
    'AAA', 'AA+', 'AA', 'AA-', 'A+', 'A',
    'A-', 'BBB+', 'BBB', 'BBB-', 'BB+', 'BB'
  ];

  return rows.map((row, index) => ({
    ...row,
    RATING: row.RATING || row.rating || fallbackRatings[index],
  }));
}

export function buildCreditSpreadCurveChartData(rows, tenors, getCSColors) {
  return {
    labels: tenors,
    datasets: rows.map((row, index) => {
      const rating = row.RATING;
      const cs = getCSColors(index, 0.6);

      return {
        label: rating,
        data: tenors.map(t => row[t]),
        borderColor: cs.borderColor,
        backgroundColor: cs.backgroundColor,
        borderWidth: 1,
        fill: false,
        hidden: !['AAA', 'AA', 'A', 'BBB', 'BB'].includes(rating),
      };
    }),
  };
}