import { appState } from '../renderer.js';
import createBarChart from '../../charts/BarChart.js';
import { getColorFromPalette } from '../../utils/colors.js'; // ✅ zentrale Palette

let liquChart;

// Root nur im Panel suchen (fällt zurück auf altes Modal, falls vorhanden)
const liquRoot =
  document.getElementById('panel-liquidity') ||
  document.getElementById('Liquidity_Modal') ||
  document;

// kleine DOM-Helper (null-safe)
const $  = (sel, root = liquRoot) => root?.querySelector(sel) || null;
const $$ = (sel, root = liquRoot) => Array.from(root?.querySelectorAll(sel) || []);

/**
 * 1) Pivot Fälligkeit/Kategorie
 * 2) Stacked Bar Chart
 * 3) Emittenten-Tabelle
 * 4) Reset-Button
 */
export function handleLiquidityData(filteredData) {
  console.log('filteredData:', filteredData)
  const data = Array.isArray(filteredData) ? filteredData : [];

  // Panel-DOM schon vorhanden?
  const liquDataContainer  = $('#liquDataContainer');
  const issuerContainer    = $('#issuerDataContainerLiqu');
  const chartCanvas        = $('#liquChart');

  if (!liquRoot || !liquDataContainer || !chartCanvas) {
    console.warn('[Liquidity] Panel-DOM nicht bereit – Rendering übersprungen.');
    return;
  }

  // 1) Pivot
  const liquData = aggregateByMaturityAndCategory(data);
  liquDataContainer.innerHTML = generatePivotTable(liquData);

  // 2) Chart (microtask, damit DOM-Updates stehen)
  queueMicrotask(() => renderLiquidityChart(liquData));

  // 3) Emittenten
  if (issuerContainer) {
    const issuers = aggregateByIssuer(data);
    issuerContainer.innerHTML = generateIssuerTable(issuers);
  }

  // 4) Reset – nur einmal binden
  const resetBtn = $('#liquResetFiltersButton');
  if (resetBtn && !resetBtn.dataset.bound) {
    resetBtn.addEventListener('click', () => appState.resetFiltersForActiveTable(liquData, 'port'));
    resetBtn.dataset.bound = '1';
  }
}

// ────────────────────────────────────────────────────────────────────────────────
// Aggregation nach MATURITY_YEAR & CATEGORY
function aggregateByMaturityAndCategory(data) {
  const arr = Array.isArray(data) ? data : [];
  const grouped = {};

  arr.forEach(item => {
    const year     = item?.MATURITY_YEAR ?? 'unbekannt';
    const category = item?.CATEGORY      ?? 'unbekannt';
    const notional = Number.parseFloat(item?.NOTIONAL) || 0;

    grouped[year] ??= {};
    grouped[year][category] ??= { MATURITY_YEAR: year, CATEGORY: category, TOTAL_NOTIONAL: 0 };
    grouped[year][category].TOTAL_NOTIONAL += notional;
  });

  return Object.values(grouped).flatMap(catMap => Object.values(catMap));
}

// Stacked Bar Chart
function renderLiquidityChart(data) {
  const arr = Array.isArray(data) ? data : [];
  const categories = new Set();
  const byYear = {};

  arr.forEach(d => {
    categories.add(d.CATEGORY);
    byYear[d.MATURITY_YEAR] ??= {};
    byYear[d.MATURITY_YEAR][d.CATEGORY] =
      (byYear[d.MATURITY_YEAR][d.CATEGORY] || 0) + (d.TOTAL_NOTIONAL || 0);
  });

  const years      = Object.keys(byYear).sort();
  const catsSorted = [...categories].sort();

  // Empty state handlen
  if (years.length === 0 || catsSorted.length === 0) {
    if (liquChart) { liquChart.destroy(); liquChart = null; }
    const container = $('#liquChart')?.parentElement;
    if (container) container.setAttribute('data-empty', '1');
    return;
  } else {
    $('#liquChart')?.parentElement?.removeAttribute('data-empty');
  }

  // ✅ zentrale Farbpalette nutzen (alpha leicht reduziert für Bars)
  const datasets = catsSorted.map((cat, i) => ({
    label: cat,
    data: years.map(y => byYear[y][cat] || 0),
    backgroundColor: getColorFromPalette(i, 0.85),
    borderColor: getColorFromPalette(i, 1),
    borderWidth: 1,
    stack: 'total'
  }));

  if (liquChart) liquChart.destroy();
  liquChart = createBarChart(
    { labels: years, datasets },
    'liquChart',      // canvas id
    'bar',
    'x',
    {
      responsive: true,
      plugins: {
        legend: { position: 'top' },
        title: { display: true, text: 'Notional je Jahr & Kategorie' }
      },
      scales: { x: { stacked: true }, y: { stacked: true } }
    }
  );
}

// Aggregation nach ISSUER
function aggregateByIssuer(data) {
  const arr = Array.isArray(data) ? data : [];
  const total = arr.reduce((s, i) => s + (Number.parseFloat(i?.NOTIONAL) || 0), 0) || 1;

  const grouped = {};
  arr.forEach(item => {
    const issuer  = item?.ISSUER ?? 'unbekannt';
    const notional = Number.parseFloat(item?.NOTIONAL) || 0;
    grouped[issuer] ??= { ISSUER: issuer, TOTAL_NOTIONAL: 0 };
    grouped[issuer].TOTAL_NOTIONAL += notional;
  });

  return Object.values(grouped)
    .map(d => ({ ...d, SHARE: (d.TOTAL_NOTIONAL / total * 100) }))
    .sort((a, b) => b.TOTAL_NOTIONAL - a.TOTAL_NOTIONAL);
}

// HTML – Emittenten
function generateIssuerTable(data) {
  const rows = Array.isArray(data) ? data : [];
  let html = `<table class="pivot-table">
    <thead>
      <tr><th>Issuer</th><th>Sum Notional</th><th>Anteil [%]</th></tr>
    </thead><tbody>`;

  rows.forEach(d => {
    html += `<tr>
      <td>${d.ISSUER}</td>
      <td>${(d.TOTAL_NOTIONAL || 0).toLocaleString('de-AT')}</td>
      <td>${(d.SHARE ?? 0).toFixed(2)}</td>
    </tr>`;
  });

  html += `</tbody></table>`;
  return html;
}

// HTML – Pivot Fälligkeiten/Kategorien
function generatePivotTable(data) {
  const arr = Array.isArray(data) ? data : [];
  const years      = [...new Set(arr.map(d => d.MATURITY_YEAR))].sort();
  const categories = [...new Set(arr.map(d => d.CATEGORY))].sort();
  const lookup     = {};

  arr.forEach(d => {
    (lookup[d.CATEGORY] ??= {})[d.MATURITY_YEAR] = d.TOTAL_NOTIONAL;
  });

  let html = `<table class="pivot-table">
    <thead><tr><th>Kapitalfälligkeiten</th>`;
  years.forEach(y => html += `<th>${y}</th>`);
  html += `<th>Summe</th></tr></thead><tbody>`;

  categories.forEach(cat => {
    let rowSum = 0;
    html += `<tr><td>${cat}</td>`;
    years.forEach(y => {
      const v = lookup[cat]?.[y] || 0;
      rowSum += v;
      html += `<td>${v.toLocaleString('de-AT')}</td>`;
    });
    html += `<td><strong>${rowSum.toLocaleString('de-AT')}</strong></td></tr>`;
  });

  // Gesamtergebnis
  html += `<tr style="font-weight:bold"><td>Gesamtergebnis</td>`;
  let grand = 0;
  years.forEach(y => {
    const sumY = arr.filter(d => d.MATURITY_YEAR === y)
                    .reduce((s, d) => s + (d.TOTAL_NOTIONAL || 0), 0);
    grand += sumY;
    html += `<td>${sumY.toLocaleString('de-AT')}</td>`;
  });
  html += `<td><strong>${grand.toLocaleString('de-AT')}</strong></td></tr>`;
  html += `</tbody></table>`;
  return html;
}



// let liquChart;

// // Root nur im Panel suchen (fällt zurück auf altes Modal, falls vorhanden)
// const liquRoot =
//   document.getElementById('panel-liquidity') ||
//   document.getElementById('Liquidity_Modal') ||
//   document;

// // kleine DOM-Helper (null-safe)
// const $  = (sel, root = liquRoot) => root?.querySelector(sel) || null;
// const $$ = (sel, root = liquRoot) => Array.from(root?.querySelectorAll(sel) || []);

// /**
//  * 1) Pivot Fälligkeit/Kategorie
//  * 2) Stacked Bar Chart
//  * 3) Emittenten-Tabelle
//  * 4) Reset-Button
//  */
// export function handleLiquidityData(filteredData) {
//   console.log('filteredData:', filteredData)
//   const data = Array.isArray(filteredData) ? filteredData : [];

//   // Panel-DOM schon vorhanden?
//   const liquDataContainer  = $('#liquDataContainer');
//   const issuerContainer    = $('#issuerDataContainerLiqu');
//   const chartCanvas        = $('#liquChart');

//   if (!liquRoot || !liquDataContainer || !chartCanvas) {
//     console.warn('[Liquidity] Panel-DOM nicht bereit – Rendering übersprungen.');
//     return;
//   }

//   // 1) Pivot
//   const liquData = aggregateByMaturityAndCategory(data);
//   liquDataContainer.innerHTML = generatePivotTable(liquData);

//   // 2) Chart (microtask, damit DOM-Updates stehen)
//   queueMicrotask(() => renderLiquidityChart(liquData));

//   // 3) Emittenten
//   if (issuerContainer) {
//     const issuers = aggregateByIssuer(data);
//     issuerContainer.innerHTML = generateIssuerTable(issuers);
//   }

//   // 4) Reset – nur einmal binden
//   const resetBtn = $('#liquResetFiltersButton');
//   if (resetBtn && !resetBtn.dataset.bound) {
//     resetBtn.addEventListener('click', () => appState.resetFiltersForActiveTable(liquData, 'port'));
//     resetBtn.dataset.bound = '1';
//   }
// }

// // ────────────────────────────────────────────────────────────────────────────────
// // Aggregation nach MATURITY_YEAR & CATEGORY
// function aggregateByMaturityAndCategory(data) {
//   const arr = Array.isArray(data) ? data : [];
//   const grouped = {};

//   arr.forEach(item => {
//     const year     = item?.MATURITY_YEAR ?? 'unbekannt';
//     const category = item?.CATEGORY      ?? 'unbekannt';
//     const notional = Number.parseFloat(item?.NOTIONAL) || 0;

//     grouped[year] ??= {};
//     grouped[year][category] ??= { MATURITY_YEAR: year, CATEGORY: category, TOTAL_NOTIONAL: 0 };
//     grouped[year][category].TOTAL_NOTIONAL += notional;
//   });

//   return Object.values(grouped).flatMap(catMap => Object.values(catMap));
// }

// // Stacked Bar Chart
// function renderLiquidityChart(data) {
//   const arr = Array.isArray(data) ? data : [];
//   const categories = new Set();
//   const byYear = {};

//   arr.forEach(d => {
//     categories.add(d.CATEGORY);
//     byYear[d.MATURITY_YEAR] ??= {};
//     byYear[d.MATURITY_YEAR][d.CATEGORY] =
//       (byYear[d.MATURITY_YEAR][d.CATEGORY] || 0) + (d.TOTAL_NOTIONAL || 0);
//   });

//   const years      = Object.keys(byYear).sort();
//   const catsSorted = [...categories].sort();

//   // Empty state handlen
//   if (years.length === 0 || catsSorted.length === 0) {
//     if (liquChart) { liquChart.destroy(); liquChart = null; }
//     const container = $('#liquChart')?.parentElement;
//     if (container) container.setAttribute('data-empty', '1');
//     return;
//   } else {
//     $('#liquChart')?.parentElement?.removeAttribute('data-empty');
//   }

//   const palette = [
//     'rgba(255,213,0,1)','rgba(0,0,0,1)',
//     'rgba(198,198,198,1)','rgba(255,255,255,1)',
//     'rgba(153,102,255,0.7)','rgba(255,159,64,0.7)'
//   ];

//   const datasets = catsSorted.map((cat, i) => ({
//     label: cat,
//     data: years.map(y => byYear[y][cat] || 0),
//     backgroundColor: palette[i % palette.length],
//     stack: 'total'
//   }));

//   if (liquChart) liquChart.destroy();
//   liquChart = createBarChart(
//     { labels: years, datasets },
//     'liquChart',      // canvas id
//     'bar',
//     'x',
//     {
//       responsive: true,
//       plugins: {
//         legend: { position: 'top' },
//         title: { display: true, text: 'Notional je Jahr & Kategorie' }
//       },
//       scales: { x: { stacked: true }, y: { stacked: true } }
//     }
//   );
// }

// // Aggregation nach ISSUER
// function aggregateByIssuer(data) {
//   const arr = Array.isArray(data) ? data : [];
//   const total = arr.reduce((s, i) => s + (Number.parseFloat(i?.NOTIONAL) || 0), 0) || 1;

//   const grouped = {};
//   arr.forEach(item => {
//     const issuer  = item?.ISSUER ?? 'unbekannt';
//     const notional = Number.parseFloat(item?.NOTIONAL) || 0;
//     grouped[issuer] ??= { ISSUER: issuer, TOTAL_NOTIONAL: 0 };
//     grouped[issuer].TOTAL_NOTIONAL += notional;
//   });

//   return Object.values(grouped)
//     .map(d => ({ ...d, SHARE: (d.TOTAL_NOTIONAL / total * 100) }))
//     .sort((a, b) => b.TOTAL_NOTIONAL - a.TOTAL_NOTIONAL);
// }

// // HTML – Emittenten
// function generateIssuerTable(data) {
//   const rows = Array.isArray(data) ? data : [];
//   let html = `<table class="pivot-table">
//     <thead>
//       <tr><th>Issuer</th><th>Sum Notional</th><th>Anteil [%]</th></tr>
//     </thead><tbody>`;

//   rows.forEach(d => {
//     html += `<tr>
//       <td>${d.ISSUER}</td>
//       <td>${(d.TOTAL_NOTIONAL || 0).toLocaleString('de-AT')}</td>
//       <td>${(d.SHARE ?? 0).toFixed(2)}</td>
//     </tr>`;
//   });

//   html += `</tbody></table>`;
//   return html;
// }

// // HTML – Pivot Fälligkeiten/Kategorien
// function generatePivotTable(data) {
//   const arr = Array.isArray(data) ? data : [];
//   const years      = [...new Set(arr.map(d => d.MATURITY_YEAR))].sort();
//   const categories = [...new Set(arr.map(d => d.CATEGORY))].sort();
//   const lookup     = {};

//   arr.forEach(d => {
//     (lookup[d.CATEGORY] ??= {})[d.MATURITY_YEAR] = d.TOTAL_NOTIONAL;
//   });

//   let html = `<table class="pivot-table">
//     <thead><tr><th>Kapitalfälligkeiten</th>`;
//   years.forEach(y => html += `<th>${y}</th>`);
//   html += `<th>Summe</th></tr></thead><tbody>`;

//   categories.forEach(cat => {
//     let rowSum = 0;
//     html += `<tr><td>${cat}</td>`;
//     years.forEach(y => {
//       const v = lookup[cat]?.[y] || 0;
//       rowSum += v;
//       html += `<td>${v.toLocaleString('de-AT')}</td>`;
//     });
//     html += `<td><strong>${rowSum.toLocaleString('de-AT')}</strong></td></tr>`;
//   });

//   // Gesamtergebnis
//   html += `<tr style="font-weight:bold"><td>Gesamtergebnis</td>`;
//   let grand = 0;
//   years.forEach(y => {
//     const sumY = arr.filter(d => d.MATURITY_YEAR === y)
//                     .reduce((s, d) => s + (d.TOTAL_NOTIONAL || 0), 0);
//     grand += sumY;
//     html += `<td>${sumY.toLocaleString('de-AT')}</td>`;
//   });
//   html += `<td><strong>${grand.toLocaleString('de-AT')}</strong></td></tr>`;
//   html += `</tbody></table>`;
//   return html;
// }



// // export { issuerDataContainerLiqu };