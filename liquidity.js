// import { appState } from './renderer.js';
// import { filterColumnsInData } from './renderer/dataProcessor.js';
// import processData from './renderer/dataProcessor.js';
// import createBarChart from './charts/BarChart.js';


// let liquChart; 

// export function handleLiquidityData(filteredData, index, port_name) {

// //const columnsToShow = ['PROD_ID', 'CATEGORY', 'Depotbank','CouponType', 'MATURITY', 'ISSUER', 'RANK', 'RATING', 'RATINGres', 'C_SPREAD', 'NOTIONAL', 'PRICE_BUY', 'clean_price', 'NAV'];
// const columnsToShow = ['MATURITY', 'NOTIONAL', 'MATURITY_YEAR', 'CATEGORY'];

// // Daten in der Konsole ausgeben
// const elementId = `liquDataContainer`;
// const liquDataContainer = document.getElementById(elementId);
// // 

// // Aggregieren der Daten nach Maturity_year und Notional
// const liquData = [];

// const grouped = {};

// filteredData.forEach(item => {
//   const year = item.MATURITY_YEAR || 'unbekannt';
//   const notional = parseFloat(item.NOTIONAL) || 0;

//   if (!grouped[year]) {
//     grouped[year] = {
//       MATURITY_YEAR: year,
//       TOTAL_NOTIONAL: 0,
//       COUNT: 0
//     };
//   }

//   grouped[year].TOTAL_NOTIONAL += notional;
//   grouped[year].COUNT += 1;
// });

// // In ein Array umwandeln
// for (const year in grouped) {
//   liquData.push(grouped[year]);
// }



// if (liquDataContainer && liquData) {
//     //let filteredColumnsPortData = filterColumnsInData(receivedData, columnsToShow); //!!!!!
//     const filteredColumnsPortData = filterColumnsInData(liquData, columnsToShow); //!!!!!
//       //console.log("filteredColumnsPortData:", filteredColumnsPortData);

      

//     const liquDataHTML = processData(filteredColumnsPortData, 'PortMain');
//     liquDataContainer.innerHTML = liquDataHTML;

//     // addTooltipsForTruncatedText(portDataContainer);
//     // addProdIdTooltips(portDataContainer); 
//   }

//   console.log('Daten aus appState:', port_name, liquData );

//   createLiquChart(liquData);

// //  const resetButton = document.getElementById('liquResetFiltersButton');
// //  if (resetButton) resetButton.click();

//  // Reset Button
//  const liquResetButton = document.getElementById('liquResetFiltersButton');
//  if (liquResetButton) {
//    liquResetButton.addEventListener('click', () => appState.resetFiltersForActiveTable(liquData, 'port'));
//  }

// }


// function createLiquChart(data) {
//     const labels = data.map(d => d.MATURITY_YEAR);
//     const values = data.map(d => d.NOTIONAL); // Now represents 'weighted_ratings'
    
//     const chartConfig = {
//         labels: labels,
//         datasets: [{
//             label: 'CPV01 Weighted Ratings (%)',
//             data: values,
//             backgroundColor: 'rgba(70, 192, 230, 0.7)',
//             borderColor: 'rgba(70, 192, 230, 0.7)',
//             borderWidth: 1
//         }]
//     };
    
//     // Specify the element ID where the chart should be rendered
//     const canvasId = 'liquChart';
    
//     // Destroy existing chart instance if it exists
//     if (liquChart) {
//         liquChart.destroy();
//     }
    
//     // Create a new chart instance
//     liquChart = createBarChart(chartConfig, canvasId, 'bar', 'y');
//     }



// CODE mit erfolgreicher Aggregation über maturity_year, CATEGORY fehlt noch

// import { appState } from './renderer.js';
// import { filterColumnsInData } from './renderer/dataProcessor.js';
// import processData from './renderer/dataProcessor.js';
// import createBarChart from './charts/BarChart.js';

// let liquChart;

// export function handleLiquidityData(filteredData, index, port_name) {
//   // Nur die verfügbaren Felder nach Aggregation anzeigen
//   const columnsToShow = ['MATURITY_YEAR', 'TOTAL_NOTIONAL', 'COUNT'];

//   const elementId = `liquDataContainer`;
//   const liquDataContainer = document.getElementById(elementId);

//   // 🔁 Aggregieren der Daten nach MATURITY_YEAR und Summierung des NOTIONAL
//   const liquData = [];
//   const grouped = {};

//   filteredData.forEach(item => {
//     const year = item.MATURITY_YEAR || 'unbekannt';
//     const notional = parseFloat(item.NOTIONAL) || 0;

//     if (!grouped[year]) {
//       grouped[year] = {
//         MATURITY_YEAR: year,
//         TOTAL_NOTIONAL: 0,
//         COUNT: 0
//       };
//     }

//     grouped[year].TOTAL_NOTIONAL += notional;
//     grouped[year].COUNT += 1;
//   });

//   for (const year in grouped) {
//     liquData.push(grouped[year]);
//   }

//   // 🔽 HTML-Ausgabe
//   if (liquDataContainer && liquData) {
//     const filteredColumnsPortData = filterColumnsInData(liquData, columnsToShow);
//     const liquDataHTML = processData(filteredColumnsPortData, 'PortMain');
//     liquDataContainer.innerHTML = liquDataHTML;
//   }

//   console.log('📊 Aggregierte Daten:', port_name, liquData);

//   // 🔽 Bar Chart
//   createLiquChart(liquData);

//   // 🔁 Reset Button (für Filter)
//   const liquResetButton = document.getElementById('liquResetFiltersButton');
//   if (liquResetButton) {
//     liquResetButton.addEventListener('click', () => appState.resetFiltersForActiveTable(liquData, 'port'));
//   }
// }

// function createLiquChart(data) {
//   const labels = data.map(d => d.MATURITY_YEAR);
//   const values = data.map(d => d.TOTAL_NOTIONAL); // ⬅️ wichtig: TOTAL_NOTIONAL verwenden!

//   const chartConfig = {
//     labels: labels,
//     datasets: [{
//       label: 'Total Notional je Jahr',
//       data: values,
//       backgroundColor: 'rgba(70, 192, 230, 0.7)',
//       borderColor: 'rgba(70, 192, 230, 0.7)',
//       borderWidth: 1
//     }]
//   };

//   const canvasId = 'liquChart';

//   if (liquChart) {
//     liquChart.destroy();
//   }

//   liquChart = createBarChart(chartConfig, canvasId, 'bar', 'y');
// }


//alles da außer Pivottabelle, Chart super
// import { appState } from './renderer.js';
// import { filterColumnsInData } from './renderer/dataProcessor.js';
// import processData from './renderer/dataProcessor.js';
// import createBarChart from './charts/BarChart.js';

// let liquChart;

// export function handleLiquidityData(filteredData, index, port_name) {
//   // Neue Struktur: Zeige Felder aus der Gruppierung
//   const columnsToShow = ['MATURITY_YEAR', 'CATEGORY', 'TOTAL_NOTIONAL', 'COUNT'];

//   const elementId = `liquDataContainer`;
//   const liquDataContainer = document.getElementById(elementId);

//   // 🔁 Aggregation nach MATURITY_YEAR → CATEGORY
//   const liquData = [];
//   const grouped = {};

//   filteredData.forEach(item => {
//     const year = item.MATURITY_YEAR || 'unbekannt';
//     const category = item.CATEGORY || 'unbekannt';
//     const notional = parseFloat(item.NOTIONAL) || 0;

//     if (!grouped[year]) {
//       grouped[year] = {};
//     }

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

//   // 🔄 In ein flaches Array umwandeln
//   for (const year in grouped) {
//     for (const category in grouped[year]) {
//       liquData.push(grouped[year][category]);
//     }
//   }

//   // 🔽 HTML-Ausgabe
//   if (liquDataContainer && liquData) {
//     const filteredColumnsPortData = filterColumnsInData(liquData, columnsToShow);
//     const liquDataHTML = processData(filteredColumnsPortData, 'PortMain');
//     liquDataContainer.innerHTML = liquDataHTML;
//   }

//   console.log('📊 Aggregierte Daten:', port_name, liquData);

//   // 🔽 Chart anzeigen
//   createLiquChart(liquData);

//   // 🔁 Reset Button (für Filter)
//   const liquResetButton = document.getElementById('liquResetFiltersButton');
//   if (liquResetButton) {
//     liquResetButton.addEventListener('click', () => appState.resetFiltersForActiveTable(liquData, 'port'));
//   }
// }


// function createLiquChart(data) {
//   // 📊 Daten vorbereiten: Nach Jahr + Kategorie gruppieren
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

//   // 🎨 Farben (optional mehr hinzufügen)
//   const colorPalette = [
//     'rgba(75,192,192,0.7)',
//     'rgba(255,99,132,0.7)',
//     'rgba(255,206,86,0.7)',
//     'rgba(54,162,235,0.7)',
//     'rgba(153,102,255,0.7)',
//     'rgba(255,159,64,0.7)'
//   ];

//   // 📦 Datasets erstellen: ein Dataset pro Kategorie
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


// alles super, Pivot+Chart+Filter, ABER Chart flackert
import { appState } from './renderer.js';
import { filterColumnsInData } from './renderer/dataProcessor.js';
import processData from './renderer/dataProcessor.js';
import createBarChart from './charts/BarChart.js';

let liquChart;

export function handleLiquidityData(filteredData, index, port_name) {
  const elementId = `liquDataContainer`;
  const liquDataContainer = document.getElementById(elementId);

  // 🔁 Aggregation nach MATURITY_YEAR und CATEGORY
  const liquData = [];
  const grouped = {};

  filteredData.forEach(item => {
    const year = item.MATURITY_YEAR || 'unbekannt';
    const category = item.CATEGORY || 'unbekannt';
    const notional = parseFloat(item.NOTIONAL) || 0;

    if (!grouped[year]) grouped[year] = {};
    if (!grouped[year][category]) {
      grouped[year][category] = {
        MATURITY_YEAR: year,
        CATEGORY: category,
        TOTAL_NOTIONAL: 0,
        COUNT: 0
      };
    }

    grouped[year][category].TOTAL_NOTIONAL += notional;
    grouped[year][category].COUNT += 1;
  });

  for (const year in grouped) {
    for (const category in grouped[year]) {
      liquData.push(grouped[year][category]);
    }
  }

  // 🧾 HTML Pivot-Tabelle erzeugen
  if (liquDataContainer && liquData) {
    const liquDataHTML = generatePivotTable(liquData);
    liquDataContainer.innerHTML = liquDataHTML;
  }

  console.log('📊 Aggregierte Daten:', port_name, liquData);

  // 📊 Gestapelter Chart anzeigen
  setTimeout(() => {
    createLiquChart(liquData);
  }, 0);
  

  // 🔁 Filter Reset
  const liquResetButton = document.getElementById('liquResetFiltersButton');
  if (liquResetButton) {
    liquResetButton.addEventListener('click', () =>
      appState.resetFiltersForActiveTable(liquData, 'port')
    );
  }
}

// 📊 Gestapeltes Balkendiagramm je Jahr & Kategorie
function createLiquChart(data) {
  const categories = new Set();
  const groupedByYearAndCategory = {};

  data.forEach(d => {
    const year = d.MATURITY_YEAR;
    const category = d.CATEGORY || 'unbekannt';
    const value = d.TOTAL_NOTIONAL || 0;

    categories.add(category);

    if (!groupedByYearAndCategory[year]) {
      groupedByYearAndCategory[year] = {};
    }

    if (!groupedByYearAndCategory[year][category]) {
      groupedByYearAndCategory[year][category] = 0;
    }

    groupedByYearAndCategory[year][category] += value;
  });

  const sortedYears = Object.keys(groupedByYearAndCategory).sort();
  const sortedCategories = Array.from(categories).sort();

  const colorPalette = [
    'rgba(75,192,192,0.7)',
    'rgba(255,99,132,0.7)',
    'rgba(255,206,86,0.7)',
    'rgba(54,162,235,0.7)',
    'rgba(153,102,255,0.7)',
    'rgba(255,159,64,0.7)'
  ];

  const datasets = sortedCategories.map((cat, idx) => ({
    label: cat,
    data: sortedYears.map(year => groupedByYearAndCategory[year][cat] || 0),
    backgroundColor: colorPalette[idx % colorPalette.length],
    stack: 'total'
  }));

  const chartConfig = {
    labels: sortedYears,
    datasets: datasets
  };

  const canvasId = 'liquChart';

  if (liquChart) {
    liquChart.destroy();
  }

  liquChart = createBarChart(chartConfig, canvasId, 'bar', 'x', {
    responsive: true,
    plugins: {
      legend: { position: 'top' },
      title: {
        display: true,
        text: 'Total Notional je Jahr & Kategorie (gestapelt)'
      }
    },
    scales: {
      x: { stacked: true },
      y: { stacked: true }
    }
  });
}

// 🧾 Pivot-Tabelle: CATEGORY als Zeilen, MATURITY_YEAR als Spalten
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
//   html += '</tr></thead>';

//   html += '<tbody>';
//   categories.forEach(category => {
//     html += `<tr><td>${category}</td>`;
//     years.forEach(year => {
//       const value = lookup[category]?.[year] || 0;
//       html += `<td>${value.toLocaleString('de-AT')}</td>`;
//     });
//     html += '</tr>';
//   });

//   html += '<tr style="font-weight:bold"><td>Gesamtergebnis</td>';
//   years.forEach(year => {
//     const total = data
//       .filter(d => d.MATURITY_YEAR === year)
//       .reduce((sum, d) => sum + d.TOTAL_NOTIONAL, 0);
//     html += `<td>${total.toLocaleString('de-AT')}</td>`;
//   });
//   html += '</tr>';

//   html += '</tbody></table>';

//   return html;
// }

function generatePivotTable(data) {
  const years = [...new Set(data.map(d => d.MATURITY_YEAR))].sort();
  const categories = [...new Set(data.map(d => d.CATEGORY))].sort();

  const lookup = {};
  data.forEach(d => {
    if (!lookup[d.CATEGORY]) lookup[d.CATEGORY] = {};
    lookup[d.CATEGORY][d.MATURITY_YEAR] = d.TOTAL_NOTIONAL;
  });

  let html = '<table class="pivot-table">';
  html += '<thead><tr><th>Kapitalfälligkeiten</th>';

  years.forEach(year => {
    html += `<th>${year}</th>`;
  });

  html += `<th>Summe</th>`; // ➕ neue Spalte im Header
  html += '</tr></thead>';

  html += '<tbody>';

  categories.forEach(category => {
    html += `<tr><td>${category}</td>`;

    let rowSum = 0;
    years.forEach(year => {
      const value = lookup[category]?.[year] || 0;
      rowSum += value;
      html += `<td>${value.toLocaleString('de-AT')}</td>`;
    });

    html += `<td><strong>${rowSum.toLocaleString('de-AT')}</strong></td>`; // ➕ neue Zelle
    html += '</tr>';
  });

  // Gesamtergebnis-Zeile
  html += '<tr style="font-weight:bold"><td>Gesamtergebnis</td>';

  let grandTotal = 0;
  years.forEach(year => {
    const total = data
      .filter(d => d.MATURITY_YEAR === year)
      .reduce((sum, d) => sum + d.TOTAL_NOTIONAL, 0);

    grandTotal += total;
    html += `<td>${total.toLocaleString('de-AT')}</td>`;
  });

  html += `<td><strong>${grandTotal.toLocaleString('de-AT')}</strong></td>`; // ➕ Gesamtsumme rechts
  html += '</tr>';

  html += '</tbody></table>';

  return html;
}

