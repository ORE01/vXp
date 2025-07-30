export function handleSummaryRMData(filteredData, index, port_name) {
  console.log('RiskMangementData', filteredData, index, port_name);

const mvarAggData = appState.getAllMvarData();
// console.log('All mvarAggData:', mvarAggData);

// ✅ Find the entry matching the current portfolio
const matchingEntry = mvarAggData.find(item => item.port_name === port_name);

if (!matchingEntry) {
  console.warn(`No MVaR data found for portfolio: ${port_name}`);
} else {
  const varTRel = matchingEntry.VaR_T_rel;
  if (typeof varTRel !== 'number' || isNaN(varTRel)) {
    console.warn(`VaR_T_rel for ${port_name} is invalid:`, varTRel);
  } else {
    // console.log(`Using VaR_T_rel for ${port_name}:`, varTRel);
    // ✅ Place your annotation/chart code using varTRel here
  }




  const mvarDistData = appState.getMvarDistData();
  // console.log('mvarAggData', mvarAggData);
  // console.log('mvarDistData', mvarDistData);


  //NAV VAlue:
  //1)
    const OriPortData = appState.getAllPortfolioData();
    const filteredOriginalData = OriPortData.filter(item => item.port_name === port_name);
    //handlePortAggData(filteredOriginalData, 3, port_name);
    // console.log('filteredOriginalData', filteredOriginalData);
    const portNav = filteredOriginalData.reduce((sum, item) => {
    const navValue = parseFloat(item.NAV?.toString().replace(/[^\d.-]/g, '') || 0);
    return sum + navValue;
  }, 0);

  // console.log('portNav', portNav);

  //2)
    // const elementId = `portDataContainer${0}`;
    // const portfolioData = appState.getPortAggData(elementId) || []; 
    // // console.log('portfolioData', portfolioData);
    // const navValue = portfolioData.formPortValue;// wird noch weiterverwendet da er sich immer ändert und der mvar nicht!
    // // console.log('navValues', navValue);

  // ✅ Extract and scale P/L values
  const plValues = mvarDistData.map(row => row["P/L"] / portNav * 100);
  if (plValues.length === 0) {
    console.warn("No P/L data found in mvarDistData");
    return;
  }

  // ✅ Compute histogram data
  function createHistogramData(values, numBins = 50) {
    const min = Math.min(...values);
    const max = Math.max(...values);
    const binWidth = (max - min) / numBins;
    const bins = Array(numBins).fill(0);

    values.forEach(v => {
      const binIndex = Math.min(
        Math.floor((v - min) / binWidth),
        numBins - 1
      );
      bins[binIndex]++;
    });

    const labels = bins.map((_, i) => {
      const rangeStart = (min + i * binWidth).toFixed(2) + '%';
      const rangeEnd = (min + (i + 1) * binWidth).toFixed(2) + '%';
      return `${rangeStart} - ${rangeEnd}`;
    });


    return { labels, bins };
  }

  const histogram = createHistogramData(plValues);

  // ✅ Create or reuse chart canvas
  let chartContainer = document.getElementById('riskDistChartSection');
  if (!chartContainer) {
    const summaryModal = document.getElementById('SUMMARY_Modal') || document.body;
    chartContainer = document.createElement('div');
    chartContainer.id = 'riskDistChartSection';
    chartContainer.className = 'chart-section';

    const heading = document.createElement('h3');
    heading.className = 'section-header';
    heading.textContent = 'Market P/L Distribution';

    const canvas = document.createElement('canvas');
    canvas.id = 'plMvarDistChart';

    // chartContainer.appendChild(heading);
    // chartContainer.appendChild(canvas);
    // summaryModal.appendChild(chartContainer);
    chartContainer.appendChild(heading);

    // ✅ Dynamically add the button
    const buttonWrapper = document.createElement('div');
    buttonWrapper.className = 'button-wrapper';

    const button = document.createElement('button');
    button.id = 'mvaRDistButton';
    button.className = 'edit-button';
    button.textContent = 'Update MVaR';

    // ✅ Attach click listener directly
    button.addEventListener('click', () => {
      // console.log('MVaR button clicked!');
      handleSummaryRMData(filteredData, index, port_name);  // or another function if you prefer
    });

    buttonWrapper.appendChild(button);
    chartContainer.appendChild(buttonWrapper);

    chartContainer.appendChild(canvas);
    summaryModal.appendChild(chartContainer);


  }

  const ctx = document.getElementById('plMvarDistChart').getContext('2d');

  // ✅ Destroy old chart if it exists
  if (window.plMvarDistChartInstance) {
    window.plMvarDistChartInstance.destroy();
  }

  // ✅ Set canvas resolution for clear sizing
  const canvas = document.getElementById('plMvarDistChart');
  canvas.width = 900;   // True rendering resolution
  canvas.height = 500;

    // ✅ Render histogram chart
    window.plMvarDistChartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: histogram.labels,
        datasets: [{
          label: 'Frequency',
          data: histogram.bins,
          backgroundColor: 'rgba(54, 162, 235, 0.5)',
          borderColor: 'rgba(54, 162, 235, 1)',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            title: { display: true, text: 'P/L as % of NAV' },
            ticks: { maxRotation: 90, minRotation: 45 }
          },
          y: {
            title: { display: true, text: 'Frequency' }
          }
        },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: context => `Count: ${context.parsed.y}`
          }
        },
        annotation: {
          annotations: {
            varLine: {
              type: 'line',
              xMin: varTRel,
              xMax: varTRel,
              borderColor: 'red',
              borderWidth: 2,
              label: {
                display: true,
                content: `VaR (${varTRel.toFixed(2)}%)`,
                color: 'red',
                position: 'start',
                font: { weight: 'bold' }
              }
            }
          }
        }
      }
    }
    });
  }
}
