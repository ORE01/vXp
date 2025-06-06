// import { appState } from './renderer.js';
// import { filterColumnsInData } from './renderer/dataProcessor.js';
// import processData from './renderer/dataProcessor.js';
// import createBarChart from './charts/BarChart.js';

// let liquChart;

// export function handleLiquidityData(filteredData, index, port_name) {
//   const elementId = `liquDataContainer`;
//   const liquDataContainer = document.getElementById(elementId);

//   // 🔁 Aggregation nach MATURITY_YEAR und CATEGORY
//   const liquData = [];
//   const grouped = {};

//   filteredData.forEach(item => {
//     const year = item.MATURITY_YEAR || 'unbekannt';
//     const category = item.CATEGORY || 'unbekannt';
//     const notional = parseFloat(item.NOTIONAL) || 0;

//     if (!grouped[year]) grouped[year] = {};
//     if (!grouped[year][category]) {
//       grouped[year][category] = {
//         MATURITY_YEAR: year,
//         CATEGORY: category,
//         TOTAL_NOTIONAL: 0,
//         COUNT: 0
//       };
//     }

//     grouped[year][category].TOTAL_NOTIONAL += notional;
//     grouped[year][category].COUNT += 1;
//   });

//   for (const year in grouped) {
//     for (const category in grouped[year]) {
//       liquData.push(grouped[year][category]);
//     }
//   }

//   // 🧾 HTML Pivot-Tabelle erzeugen
//   if (liquDataContainer && liquData) {
//     const liquDataHTML = generatePivotTable(liquData);
//     liquDataContainer.innerHTML = liquDataHTML;
//   }

//   console.log('📊 Aggregierte Daten:', port_name, liquData);

//   // 📊 Gestapelter Chart anzeigen
//   setTimeout(() => {
//     createLiquChart(liquData);
//   }, 0);
  

//   // 🔁 Filter Reset
//   const liquResetButton = document.getElementById('liquResetFiltersButton');
//   if (liquResetButton) {
//     liquResetButton.addEventListener('click', () =>
//       appState.resetFiltersForActiveTable(liquData, 'port')
//     );
//   }
// }

// // 📊 Gestapeltes Balkendiagramm je Jahr & Kategorie
// function createLiquChart(data) {
//   const categories = new Set();
//   const groupedByYearAndCategory = {};

//   data.forEach(d => {
//     const year = d.MATURITY_YEAR;
//     const category = d.CATEGORY || 'unbekannt';
//     const value = d.TOTAL_NOTIONAL || 0;

//     categories.add(category);

//     if (!groupedByYearAndCategory[year]) {
//       groupedByYearAndCategory[year] = {};
//     }

//     if (!groupedByYearAndCategory[year][category]) {
//       groupedByYearAndCategory[year][category] = 0;
//     }

//     groupedByYearAndCategory[year][category] += value;
//   });

//   const sortedYears = Object.keys(groupedByYearAndCategory).sort();
//   const sortedCategories = Array.from(categories).sort();

//   const colorPalette = [
//     'rgba(75,192,192,0.7)',
//     'rgba(255,99,132,0.7)',
//     'rgba(255,206,86,0.7)',
//     'rgba(54,162,235,0.7)',
//     'rgba(153,102,255,0.7)',
//     'rgba(255,159,64,0.7)'
//   ];

//   const datasets = sortedCategories.map((cat, idx) => ({
//     label: cat,
//     data: sortedYears.map(year => groupedByYearAndCategory[year][cat] || 0),
//     backgroundColor: colorPalette[idx % colorPalette.length],
//     stack: 'total'
//   }));

//   const chartConfig = {
//     labels: sortedYears,
//     datasets: datasets
//   };

//   const canvasId = 'liquChart';

//   if (liquChart) {
//     liquChart.destroy();
//   }

//   liquChart = createBarChart(chartConfig, canvasId, 'bar', 'x', {
//     responsive: true,
//     plugins: {
//       legend: { position: 'top' },
//       title: {
//         display: true,
//         text: 'Total Notional je Jahr & Kategorie (gestapelt)'
//       }
//     },
//     scales: {
//       x: { stacked: true },
//       y: { stacked: true }
//     }
//   });
// }

// function generatePivotTable(data) {
//   const years = [...new Set(data.map(d => d.MATURITY_YEAR))].sort();
//   const categories = [...new Set(data.map(d => d.CATEGORY))].sort();

//   const lookup = {};
//   data.forEach(d => {
//     if (!lookup[d.CATEGORY]) lookup[d.CATEGORY] = {};
//     lookup[d.CATEGORY][d.MATURITY_YEAR] = d.TOTAL_NOTIONAL;
//   });

//   let html = '<table class="pivot-table">';
//   html += '<thead><tr><th>Kapitalfälligkeiten</th>';

//   years.forEach(year => {
//     html += `<th>${year}</th>`;
//   });

//   html += `<th>Summe</th>`; // ➕ neue Spalte im Header
//   html += '</tr></thead>';

//   html += '<tbody>';

//   categories.forEach(category => {
//     html += `<tr><td>${category}</td>`;

//     let rowSum = 0;
//     years.forEach(year => {
//       const value = lookup[category]?.[year] || 0;
//       rowSum += value;
//       html += `<td>${value.toLocaleString('de-AT')}</td>`;
//     });

//     html += `<td><strong>${rowSum.toLocaleString('de-AT')}</strong></td>`; // ➕ neue Zelle
//     html += '</tr>';
//   });

//   // Gesamtergebnis-Zeile
//   html += '<tr style="font-weight:bold"><td>Gesamtergebnis</td>';

//   let grandTotal = 0;
//   years.forEach(year => {
//     const total = data
//       .filter(d => d.MATURITY_YEAR === year)
//       .reduce((sum, d) => sum + d.TOTAL_NOTIONAL, 0);

//     grandTotal += total;
//     html += `<td>${total.toLocaleString('de-AT')}</td>`;
//   });

//   html += `<td><strong>${grandTotal.toLocaleString('de-AT')}</strong></td>`; // ➕ Gesamtsumme rechts
//   html += '</tr>';

//   html += '</tbody></table>';

//   return html;
// }



// // ***2. Anpassung***

import { appState } from './renderer.js';
import createBarChart from './charts/BarChart.js';

let liquChart;

/**
 * Kern-Funktion zur Darstellung:
 * 1) Pivot-Tabelle nach Fälligkeit/Kategorie
 * 2) Stacked Bar Chart
 * 3) Emittenten-Gruppierung (immer aktuell, ohne Button)
 */
export function handleLiquidityData(filteredData, index, port_name) {
  // 1) Pivot-Tabelle
  const liquDataContainer = document.getElementById('liquDataContainer');
  const liquData = aggregateByMaturityAndCategory(filteredData);
  if (liquDataContainer) {
    liquDataContainer.innerHTML = generatePivotTable(liquData);
  }

  // 2) Chart
  setTimeout(() => {
    renderLiquidityChart(liquData);
  }, 0);

  // 3) Emittenten-Tabelle
  const issuerContainer = document.getElementById('issuerDataContainer');
  if (issuerContainer) {
    const issuers = aggregateByIssuer(filteredData);
    issuerContainer.innerHTML = generateIssuerTable(issuers);
  }

  // 4) Filter-Reset
  const resetBtn = document.getElementById('liquResetFiltersButton');
  if (resetBtn) {
    resetBtn.onclick = () => appState.resetFiltersForActiveTable(liquData, 'port');
  }
}

// ────────────────────────────────────────────────────────────────────────────────
// 1) Aggregation nach MATURITY_YEAR & CATEGORY
function aggregateByMaturityAndCategory(data) {
  const grouped = {};
  data.forEach(item => {
    const year     = item.MATURITY_YEAR || 'unbekannt';
    const category = item.CATEGORY      || 'unbekannt';
    const notional = parseFloat(item.NOTIONAL) || 0;

    grouped[year] ??= {};
    grouped[year][category] ??= { MATURITY_YEAR: year, CATEGORY: category, TOTAL_NOTIONAL: 0 };
    grouped[year][category].TOTAL_NOTIONAL += notional;
  });

  return Object.values(grouped)
    .flatMap(catMap => Object.values(catMap));
}

// 2) Chart-Rendering (gestapeltes Balkendiagramm)
function renderLiquidityChart(data) {
  const categories = new Set(), byYear = {};
  data.forEach(d => {
    categories.add(d.CATEGORY);
    byYear[d.MATURITY_YEAR] ??= {};
    byYear[d.MATURITY_YEAR][d.CATEGORY] = (byYear[d.MATURITY_YEAR][d.CATEGORY] || 0) + d.TOTAL_NOTIONAL;
  });

  const years      = Object.keys(byYear).sort();
  const catsSorted = [...categories].sort();
  const palette    = [
    'rgba(75,192,192,0.7)','rgba(255,99,132,0.7)',
    'rgba(255,206,86,0.7)',  'rgba(54,162,235,0.7)',
    'rgba(153,102,255,0.7)', 'rgba(255,159,64,0.7)'
  ];

  const datasets = catsSorted.map((cat,i) => ({
    label: cat,
    data: years.map(y => byYear[y][cat] || 0),
    backgroundColor: palette[i % palette.length],
    stack: 'total'
  }));

  if (liquChart) liquChart.destroy();
  liquChart = createBarChart(
    { labels: years, datasets },
    'liquChart','bar','x',
    {
      responsive: true,
      plugins: {
        legend: { position: 'top' },
        title: { display: true, text: 'Notional je Jahr & Kategorie' }
      },
      scales: { x:{ stacked:true }, y:{ stacked:true } }
    }
  );
}

// 3) Aggregation nach ISSUER
function aggregateByIssuer(data) {
  const grouped = {}, total = data.reduce((s, i) => s + (parseFloat(i.NOTIONAL)||0), 0);

  data.forEach(item => {
    const issuer  = item.ISSUER || 'unbekannt';
    const notional = parseFloat(item.NOTIONAL) || 0;
    grouped[issuer] ??= { ISSUER: issuer, TOTAL_NOTIONAL: 0 };
    grouped[issuer].TOTAL_NOTIONAL += notional;
  });

  return Object.values(grouped)
    .map(d => ({ ...d, SHARE: (d.TOTAL_NOTIONAL/total*100) }))
    .sort((a,b) => b.TOTAL_NOTIONAL - a.TOTAL_NOTIONAL);
}

// 4) HTML-Tabelle Emittenten
function generateIssuerTable(data) {
  let html = `<table class="pivot-table">
    <thead>
      <tr>
        <th>Issuer</th>
        <th>Sum Notional</th>
        <th>Anteil [%]</th>
      </tr>
    </thead>
    <tbody>`;

  data.forEach(d => {
    html += `<tr>
      <td>${d.ISSUER}</td>
      <td>${d.TOTAL_NOTIONAL.toLocaleString('de-AT')}</td>
      <td>${d.SHARE.toFixed(2)}</td>
    </tr>`;
  });

  html += `</tbody></table>`;
  return html;
}

// 5) HTML-Pivot-Tabelle Fälligkeiten/Kategorien
function generatePivotTable(data) {
  const years      = [...new Set(data.map(d => d.MATURITY_YEAR))].sort();
  const categories = [...new Set(data.map(d => d.CATEGORY))].sort();
  const lookup     = {};

  data.forEach(d => {
    lookup[d.CATEGORY] ??= {};
    lookup[d.CATEGORY][d.MATURITY_YEAR] = d.TOTAL_NOTIONAL;
  });

  let html = `<table class="pivot-table">
    <thead><tr><th>Kapitalfälligkeiten</th>`;
  years.forEach(y => html += `<th>${y}</th>`);
  html += `<th>Summe</th></tr></thead><tbody>`;

  categories.forEach(cat => {
    let rowSum = 0;
    html += `<tr><td>${cat}</td>`;
    years.forEach(y => {
      const v = lookup[cat]?.[y]||0;
      rowSum += v;
      html += `<td>${v.toLocaleString('de-AT')}</td>`;
    });
    html += `<td><strong>${rowSum.toLocaleString('de-AT')}</strong></td></tr>`;
  });

  // Gesamtergebnis-Zeile
  html += `<tr style="font-weight:bold"><td>Gesamtergebnis</td>`;
  let grand = 0;
  years.forEach(y => {
    const sumY = data.filter(d => d.MATURITY_YEAR===y)
                     .reduce((s,d)=>s+d.TOTAL_NOTIONAL,0);
    grand += sumY;
    html += `<td>${sumY.toLocaleString('de-AT')}</td>`;
  });
  html += `<td><strong>${grand.toLocaleString('de-AT')}</strong></td></tr>`;
  html += `</tbody></table>`;
  return html;
}