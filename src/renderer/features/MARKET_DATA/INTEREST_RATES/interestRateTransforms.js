// interestRateTransforms.js

export function tenorToMonths(tenor) {
  if (!tenor) return 0;

  const s = String(tenor).trim();

  if (s.endsWith('Y')) return parseInt(s, 10) * 12;
  if (s.endsWith('M')) return parseInt(s, 10);

  return parseInt(s, 10) || 0;
}

export function sortInterestRateRowsByTenor(rows) {
  return [...rows].sort(
    (a, b) => tenorToMonths(a.tenor) - tenorToMonths(b.tenor)
  );
}