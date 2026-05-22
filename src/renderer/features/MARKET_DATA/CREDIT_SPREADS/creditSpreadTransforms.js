// creditSpreadTransforms.js

function isTenorKey(key) {
  const k = String(key ?? '').trim().toUpperCase();

  return (
    /^\d+(\.\d+)?$/.test(k) ||        // 1, 2, 5, 10
    /^\d+(\.\d+)?Y$/.test(k) ||       // 1Y, 5Y
    /^\d+(\.\d+)?M$/.test(k)         // 6M
  );
}

function toNumber(value) {
  const n = parseFloat(String(value ?? '').replace(',', '.'));
  return Number.isNaN(n) ? null : n;
}

function normalizeTenor(tenor) {
  const t = String(tenor ?? '').trim();
  if (!t) return '';

  // Deine DB hat teils "1", teils evtl. "1Y"
  // Für Tabellen-Spalten lassen wir "1" stabil.
  return t.replace(/Y$/i, '');
}

function tenorSortValue(tenor) {
  const t = String(tenor ?? '').trim().toUpperCase();

  if (t.endsWith('M')) return parseFloat(t) / 12;
  if (t.endsWith('Y')) return parseFloat(t);
  return parseFloat(t);
}

export function pivotCreditSpreadRowsByRating(rows) {
  const rowMap = new Map();

  rows.forEach(row => {
    const rating = String(row?.rating || row?.RATING || '').trim();
    const tenor = normalizeTenor(row?.tenor);
    const value = toNumber(row?.value);

    if (!rating || !tenor || value === null) return;

    const curveId =
      String(row?.curve_id || '').trim() ||
      `${String(row?.ccy || '').trim().toUpperCase()}:RATING:${rating}:${String(row?.rank || 'senior_unsecured').trim()}`;

    const key = curveId || rating;

    if (!rowMap.has(key)) {
      rowMap.set(key, {
        curve_id: curveId,
        ccy: String(row?.ccy || '').trim().toUpperCase(),
        RATING: rating,
        rank: String(row?.rank || 'senior_unsecured').trim(),
      });
    }

    rowMap.get(key)[tenor] = value;
  });

  return Array.from(rowMap.values());
}

export function extractSortedTenors(rows) {
  if (!Array.isArray(rows) || !rows.length) return [];

  const tenorSet = new Set();

  rows.forEach(row => {
    Object.keys(row || {}).forEach(key => {
      if (isTenorKey(key)) {
        tenorSet.add(key);
      }
    });
  });

  return Array.from(tenorSet).sort((a, b) => {
    const av = tenorSortValue(a);
    const bv = tenorSortValue(b);
    return av - bv;
  });
}

export function normalizeRatings(rows) {
  const fallbackRatings = [
    'AAA', 'AA+', 'AA', 'AA-', 'A+', 'A',
    'A-', 'BBB+', 'BBB', 'BBB-', 'BB+', 'BB'
  ];

  return rows.map((row, index) => ({
    ...row,
    RATING: row.RATING || row.rating || fallbackRatings[index],
    curve_id: row.curve_id || '',
    rank: row.rank || 'senior_unsecured',
    ccy: row.ccy || '',
  }));
}

export function buildCreditSpreadCurveChartData(rows, tenors, getCSColors) {
  return {
    labels: tenors,
    datasets: rows.map((row, index) => {
      const rating = row.RATING;
      const curveId = row.curve_id || rating;
      const rank = row.rank || 'senior_unsecured';
      const cs = getCSColors(index, 0.6);

      return {
        label: `${rating}`,
        curve_id: curveId,
        rating,
        rank,
        data: tenors.map(t => row[t] ?? null),
        borderColor: cs.borderColor,
        backgroundColor: cs.backgroundColor,
        borderWidth: 1,
        fill: false,
        hidden: !['AAA', 'AA', 'A', 'BBB', 'BB'].includes(rating),
      };
    }),
  };
}
















// // creditSpreadTransforms.js

// export function pivotCreditSpreadRowsByRating(rows) {
//   const rowMap = new Map();

//   rows.forEach(row => {
//     const rating = String(row?.rating || '').trim();
//     const tenor = String(row?.tenor || '').trim();
//     const value = parseFloat(String(row?.value ?? '').replace(',', '.'));

//     if (!rating || !tenor || Number.isNaN(value)) return;

//     if (!rowMap.has(rating)) {
//       rowMap.set(rating, { RATING: rating });
//     }

//     rowMap.get(rating)[tenor] = value;
//   });

//   return Array.from(rowMap.values());
// }

// export function extractSortedTenors(rows) {
//   if (!Array.isArray(rows) || !rows.length) return [];

//   const tenorSet = new Set();

//   rows.forEach(row => {
//     Object.keys(row || {}).forEach(key => {
//       if (key !== 'RATING') tenorSet.add(key);
//     });
//   });

//   return Array.from(tenorSet).sort((a, b) => Number(a) - Number(b));
// }

// export function normalizeRatings(rows) {
//   const fallbackRatings = [
//     'AAA', 'AA+', 'AA', 'AA-', 'A+', 'A',
//     'A-', 'BBB+', 'BBB', 'BBB-', 'BB+', 'BB'
//   ];

//   return rows.map((row, index) => ({
//     ...row,
//     RATING: row.RATING || row.rating || fallbackRatings[index],
//   }));
// }

// export function buildCreditSpreadCurveChartData(rows, tenors, getCSColors) {
//   return {
//     labels: tenors,
//     datasets: rows.map((row, index) => {
//       const rating = row.RATING;
//       const cs = getCSColors(index, 0.6);

//       return {
//         label: rating,
//         data: tenors.map(t => row[t]),
//         borderColor: cs.borderColor,
//         backgroundColor: cs.backgroundColor,
//         borderWidth: 1,
//         fill: false,
//         hidden: !['AAA', 'AA', 'A', 'BBB', 'BB'].includes(rating),
//       };
//     }),
//   };
// }