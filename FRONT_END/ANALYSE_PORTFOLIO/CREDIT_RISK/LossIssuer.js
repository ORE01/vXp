import { filterColumnsInData } from '../../../modal_HELPER/dataProcessor.js';
import processData from '../../../modal_HELPER/dataProcessor.js';
import createBarChart from '../../../charts/BarChart.js';
import { appState } from '../../renderer.js';
// import {handleTrafficLight} from './trafficLight.js';

// Global scope — this runs as soon as the file is loaded
if (!window.charts) window.charts = {}; 

// Global objects to store datasets
let ratingData = [];
let marketData = [];
let marketNormData = [];

export function handleLossIssuerMainData(receivedData) {
  //console.log('LossIssuer receivedData:', receivedData);

  const port_name = appState.getSelectedPortTableName(); // z. B. "UNI"
  //console.log('port_name:', port_name);

  const typeMap = {
    'RATING': {
      dataContainerId: 'LossIssuerDataContainerRating',
      chartId: 'LossIssuerChartRating',
      tableName: 'sortedLossesIssuerMain'
    },
    'MARKET': {
      dataContainerId: 'LossIssuerDataContainerMarket',
      chartId: 'LossIssuerChartMarket',
      tableName: 'sortedLossesIssuerMain'
    },
    'NORM': {
      dataContainerId: 'LossIssuerDataContainerMarketNorm',
      chartId: 'LossIssuerChartMarketNorm',
      tableName: 'sortedLossesIssuerMain'
    }
  };

  // 🔁 Schleife über alle Typen
  Object.entries(typeMap).forEach(([pdFlag, config]) => {
    const { dataContainerId, chartId, tableName } = config;

    const LossIssuerDataContainer = document.getElementById(dataContainerId);
    const filteredData = receivedData.filter(
      row => row.port_name === port_name && row.pd_flag === pdFlag
    );

    if (LossIssuerDataContainer && filteredData.length > 0) {
      let sortedData = processAndSortLossIssuerData(filteredData);
      const LossIssuerDataHTML = processData(sortedData, tableName);
      LossIssuerDataContainer.innerHTML = LossIssuerDataHTML;

      const allRows = LossIssuerDataContainer.querySelectorAll('tr');
      if (allRows.length > 10) {
        allRows[10].classList.add('highlight');
      }

      // Speichern für später
      if (pdFlag === 'RATING') {
        ratingData = sortedData;
        createLossIssuerChart(ratingData, chartId, 'rating');
      } else if (pdFlag === 'MARKET') {
        marketData = sortedData;
        createLossIssuerChart(marketData, chartId, 'market');
      } else if (pdFlag === 'NORM') {
        marketNormData = sortedData;
        createLossIssuerChart(marketNormData, chartId, 'norm');
      }
    }
  });

  // 🟡 Kombinierte Charts nur erstellen, wenn alle drei da sind
  if (ratingData.length > 0 && marketData.length > 0 && marketNormData.length > 0) {
    createCombinedLossIssuerChart(ratingData, marketData, marketNormData, 'LossIssuerCombinedChart');
    createCombinedLossIssuerESChart(ratingData, marketData, marketNormData, 'LossIssuerCombinedESChart');

    const fetchRatingData = () => new Promise(resolve => {
      setTimeout(() => resolve(ratingData), 1000);
    });

    const fetchNormData = () => new Promise(resolve => {
      setTimeout(() => resolve(marketNormData), 2000);
    });

    Promise.all([fetchRatingData(), fetchNormData()]).then(([ratingData, marketNormData]) => {
      const extractedRatingLosses = ratingData.map(item => item.LOSS || 0);
      const extractedNormLosses = marketNormData.map(item => item.LOSS || 0);
      

      const state = trafficLightStateForCredit(extractedRatingLosses, extractedNormLosses);
      if (state) updateTrafficLight('#traffic-credit', state);

    });
  }
}

    function trafficLightStateForCredit(ratingLosses, normLosses) {
      // AVERAGE: 
      const SLICE = 10;           // Wieviele Werte man für den Duchschnitt nimmt

    // SCHWELLEN:
      const YELLOW = 10;          // ab dieser schwelle in % kommt gelb
      const RED    = 20;          // % Schwelle rot

      if (ratingLosses.length < SLICE || normLosses.length < SLICE) return null;

      const avg = (arr,n)=>arr.slice(0,n).reduce((s,v)=>s+v,0)/n;
      const rAvg = avg(ratingLosses, SLICE);
      const nAvg = avg(normLosses,   SLICE);
      const diff = (rAvg === 0) ? Infinity : Math.abs((nAvg - rAvg)/rAvg)*100;

      console.log('Credit Risk Ampel:',diff)

      if (diff > RED)   return 'red';
      if (diff > YELLOW)return 'yellow';
      return 'green';
    }    



export function setupLossIssuerUI() {
  const show = (id) => {
    const el = document.getElementById(id);
    if (!el) return;
    // Falls irgendwo display:none gesetzt wurde → zurück zum Standard
    el.style.removeProperty('display');
    // Falls im HTML das hidden-Attribut gesetzt ist
    if (el.hasAttribute('hidden')) el.removeAttribute('hidden');
    // Safety: trotzdem sichtbar erzwingen
    el.style.display = 'block';
  };

  // LEFT (Tabellen)
  [
    'EADDataContainer',
    'LossIssuerDataContainerRating',
    'LossIssuerDataContainerMarket',
    'LossIssuerDataContainerMarketNorm',
    'CVaR_ratingDataContainer',
    'CVaR_marketDataContainer',
    'CVaR_normDataContainer',
  ].forEach(show);

  // RIGHT (Charts)
  [
    // 'EADChartContainer',
    'LGDChartContainer',
    'LossIssuerChartContainerRating',
    'LossIssuerChartContainerMarket',
    'LossIssuerChartContainerMarketNorm',
    // kombinierte Charts (falls eigene Container vorhanden sind)
    'LossIssuerCombinedChartContainer',
    'LossIssuerCombinedESChartContainer',
  ].forEach(show);

  // Falls du die kombinierten Charts ohne extra Container direkt per Canvas-ID hast:
  show('LossIssuerCombinedChart');
  show('LossIssuerCombinedESChart');

  // KEINE Button-Events mehr, kein Umschalten
}
    function processAndSortLossIssuerData(receivedData) {
      let columns = ['CONVI', 'DEFAULTS', 'ISSUER_RANK', 'LOSS'];
      let filteredData = filterColumnsInData(receivedData, columns);

      // Sort the data
      return filteredData;
    }
    function createLossIssuerChart(data, chartId, type) {
      // 🔥 Destroy the old chart if it exists
      if (window[chartId] && typeof window[chartId].destroy === 'function') {
        window[chartId].destroy();
      }

      // 🔥 Limit the data to the first 15 rows
      const limitedData = data.slice(0, 15);
      const labels = limitedData.map(d => d.DEFAULTS);
      const values = limitedData.map(d => d.LOSS);

      // 🔥 Set the color based on the type ('rating' = blue, 'market' = orange, 'norm' = green)
      let barColor;
      if (type === 'market') {
        barColor = 'rgba(255, 165, 0, 0.7)'; // Orange
      } else if (type === 'norm') {
        barColor = 'rgba(144, 238, 144, 0.7)'; // Light Green (semi-transparent)
      } else {
        barColor = 'rgba(70, 192, 230, 0.7)'; // Blue for Rating
      }

      // 🔥 Create color array and highlight the 10th bar in red
      const barColors = limitedData.map((_, index) => 
        index === 9 ? '#ff6666' : barColor
      );

      // 🔥 Create the new chart and store it in `window`
      window[chartId] = createBarChart({ 
        labels: labels, 
        datasets: [{ 
          label: type === 'market' ? 'Market Losses' : type === 'norm' ? 'Norm Losses' : 'Rating Losses',
          data: values, 
          backgroundColor: barColors, 
          borderColor: barColors 
        }] 
      }, chartId, 'bar', 'y');
    }
    //VaR
    function createCombinedLossIssuerChart(ratingData, marketData, marketNormData, chartId) {
      if (!window.charts) window.charts = {}; 
      if (window.charts[chartId] && typeof window.charts[chartId].destroy === 'function') {
        window.charts[chartId].destroy();
      }

      const chartElement = document.getElementById(chartId);
      if (!chartElement) {
        console.error(`Chart element with ID "${chartId}" not found.`);
        return; 
      }

      // 🔥 Combine the CONVI labels from all datasets (remove duplicates)
      const allConvIValues = Array.from(new Set([
        ...ratingData.map(d => d.CONVI), 
        ...marketData.map(d => d.CONVI),
        ...marketNormData.map(d => d.CONVI)
      ])).sort((a, b) => a - b);

      // 🔥 Map the LOSS and ISSUER_RANK for each CONVI in all datasets
      const ratingValues = allConvIValues.map(convI => {
        const found = ratingData.find(d => d.CONVI === convI);
        return found ? found.LOSS : 0; 
      });

      const marketValues = allConvIValues.map(convI => {
        const found = marketData.find(d => d.CONVI === convI);
        return found ? found.LOSS : 0; 
      });

      const marketNormValues = allConvIValues.map(convI => {
        const found = marketNormData.find(d => d.CONVI === convI);
        return found ? found.LOSS : 0; 
      });

      const issuerRanksRating = allConvIValues.map(convI => {
        const found = ratingData.find(d => d.CONVI === convI);
        return found ? found.ISSUER_RANK : 'N/A';
      });

      const issuerRanksMarket = allConvIValues.map(convI => {
        const found = marketData.find(d => d.CONVI === convI);
        return found ? found.ISSUER_RANK : 'N/A';
      });

      const issuerRanksMarketNorm = allConvIValues.map(convI => {
        const found = marketNormData.find(d => d.CONVI === convI);
        return found ? found.ISSUER_RANK : 'N/A';
      });

      // 🔥 Colors for the chart bars
      const highlightColor = 'rgba(255, 0, 0, 0.9)'; // Red for highlight
      const defaultRatingColor = 'rgba(0, 191, 255, 1)'; // Bright Blue for Rating 
      const defaultMarketColor = 'rgba(255, 165, 0, 0.7)'; // Light Orange (semi-transparent)
      const defaultMarketNormColor = 'rgba(144, 238, 144, 0.7)'; // Light Green (semi-transparent)

      const ratingBarColors = allConvIValues.map(convI => convI === 99.9 ? highlightColor : defaultRatingColor);
      const marketBarColors = allConvIValues.map(convI => convI === 99.9 ? highlightColor : defaultMarketColor);
      const marketNormBarColors = allConvIValues.map(convI => convI === 99.9 ? highlightColor : defaultMarketNormColor);

      // 🔥 Create the new chart with 3 datasets
      window.charts[chartId] = new Chart(chartElement.getContext('2d'), {
        type: 'bar',
        data: { 
          labels: allConvIValues, 
          datasets: [
            { 
              label: 'Historic Loss',
              data: ratingValues, 
              backgroundColor: ratingBarColors, 
              borderColor: ratingBarColors, 
            },
            { 
              label: 'Market Implied Loss',
              data: marketValues, 
              backgroundColor: marketBarColors, 
              borderColor: marketBarColors, 
            },
            { 
              label: 'Risk Adjusted Loss',
              data: marketNormValues, 
              backgroundColor: marketNormBarColors, 
              borderColor: marketNormBarColors, 
            }
          ] 
        }, 
        options: {
          responsive: false,            // ⬅️ deaktiviert automatisches Anpassen
          maintainAspectRatio: false,   // ⬅️ erlaubt, Breite/Höhe frei zu setzen
          indexAxis: 'x', 
          scales: {
            x: {
              reverse: true, 
              title: {
                display: true,
                text: 'CONVI'
              },
            },
            y: {
              title: {
                display: true,
                text: 'Loss Amount'
              }
            }
          },
          plugins: {
            zoom: {
              pan: {
                enabled: true, 
                mode: 'x', 
              },
              zoom: {
                drag: {
                  enabled: true 
                },
                wheel: {
                  enabled: true, 
                },
                pinch: {
                  enabled: true, 
                },
                mode: 'x', 
                onZoomComplete: ({chart}) => {
                  const minIndex = chart.scales.x.min;
                  const maxIndex = chart.scales.x.max;

                  const fullRangeMin = 0;
                  const fullRangeMax = allConvIValues.length// - 1;

                  if (minIndex === fullRangeMin && maxIndex === fullRangeMax) {
                    // console.log('Already at full zoom-out, no further action.');
                    return; 
                  }

                  if ((maxIndex - minIndex) < 0) {
                    chart.resetZoom();
                  }

                  // console.log('Zoom Complete:', minIndex, maxIndex);
                }
              },
              limits: {
                x: { 
                  min: 0, 
                  max: allConvIValues.length// - 1, 
                },
                y: { 
                  min: 0 
                }
              },
            },
            tooltip: {
              callbacks: {
                title: (context) => {
                  const index = context[0].dataIndex;
                  return `CONVI: ${allConvIValues[index]}`;
                },
                label: (context) => {
                  const index = context.dataIndex;
                  const datasetLabel = context.dataset.label;

                  const lossValue = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(context.raw); 

                  let issuerRank = 'N/A';
                  if (context.datasetIndex === 0) {
                    issuerRank = issuerRanksRating[index];
                  } else if (context.datasetIndex === 1) {
                    issuerRank = issuerRanksMarket[index];
                  } else if (context.datasetIndex === 2) {
                    issuerRank = issuerRanksMarketNorm[index];
                  }

                  return `${datasetLabel}: ${lossValue}, Issuer: ${issuerRank}`;
                }
              }
            }
          }
        }
      });
    }
    //ES
    function createCombinedLossIssuerESChart(ratingData, marketData, marketNormData, chartId) {
      if (!window.charts) window.charts = {}; 
      if (window.charts[chartId] && typeof window.charts[chartId].destroy === 'function') {
        window.charts[chartId].destroy();
      }

      const chartElement = document.getElementById(chartId);
      if (!chartElement) {
        console.error(`Chart element with ID "${chartId}" not found.`);
        return; 
      }

      // 🔥 Filter CONVI values to only include those from 99.9 to 99.89
      const allConvIValues = Array.from(new Set([
        ...ratingData.map(d => d.CONVI), 
        ...marketData.map(d => d.CONVI),
        ...marketNormData.map(d => d.CONVI)
      ])).filter(convI => convI <= 99.99 && convI >= 99.90).sort((a, b) => a - b);

      // 🔥 Map the LOSS and ISSUER_RANK for each CONVI in all datasets
      const ratingValues = allConvIValues.map(convI => {
        const found = ratingData.find(d => d.CONVI === convI);
        return found ? found.LOSS : 0; 
      });

      const marketValues = allConvIValues.map(convI => {
        const found = marketData.find(d => d.CONVI === convI);
        return found ? found.LOSS : 0; 
      });

      const marketNormValues = allConvIValues.map(convI => {
        const found = marketNormData.find(d => d.CONVI === convI);
        return found ? found.LOSS : 0; 
      });

      const issuerRanksRating = allConvIValues.map(convI => {
        const found = ratingData.find(d => d.CONVI === convI);
        return found ? found.ISSUER_RANK : 'N/A';
      });

      const issuerRanksMarket = allConvIValues.map(convI => {
        const found = marketData.find(d => d.CONVI === convI);
        return found ? found.ISSUER_RANK : 'N/A';
      });

      const issuerRanksMarketNorm = allConvIValues.map(convI => {
        const found = marketNormData.find(d => d.CONVI === convI);
        return found ? found.ISSUER_RANK : 'N/A';
      });

      // 🔥 Calculate averages for the first 10 entries in each dataset
      const calculateAverage = (values) => {
        const firstTenValues = values.slice(0, 10);
        // console.log('Values used to calculate average:', firstTenValues);
        const sum = firstTenValues.reduce((acc, val) => acc + val, 0);
        return firstTenValues.length > 0 ? sum / firstTenValues.length : 0;
      };

      const averageRating = calculateAverage(ratingValues);
      const averageMarket = calculateAverage(marketValues);
      const averageMarketNorm = calculateAverage(marketNormValues);

      // 🔥 Colors for the chart bars
      const highlightColor1 = 'rgba(255, 0, 0, 0.9)'; // Red for highlight 1
      const highlightColor2 = 'rgba(200, 0, 0, 0.9)'; // Darker Red for highlight 2
      const highlightColor3 = 'rgba(150, 0, 0, 0.9)'; // Even Darker Red for highlight 3
      const defaultRatingColor = 'rgba(0, 191, 255, 1)'; // Bright Blue for Rating 
      const defaultMarketColor = 'rgba(255, 165, 0, 0.7)'; // Light Orange (semi-transparent)
      const defaultMarketNormColor = 'rgba(144, 238, 144, 0.7)'; // Light Green (semi-transparent)

      const ratingBarColors = allConvIValues.map(convI => convI === 99.9 ? highlightColor1 : defaultRatingColor);
      const marketBarColors = allConvIValues.map(convI => convI === 99.9 ? highlightColor2 : defaultMarketColor);
      const marketNormBarColors = allConvIValues.map(convI => convI === 99.9 ? highlightColor3 : defaultMarketNormColor);

      // 🔥 Create the new chart with 3 datasets
      window.charts[chartId] = new Chart(chartElement.getContext('2d'), {
        type: 'bar',
        data: { 
          labels: allConvIValues, 
          datasets: [
            { 
              label: 'VaR Rating',
              data: ratingValues, 
              backgroundColor: ratingBarColors, 
              borderColor: ratingBarColors, 
              borderWidth: 1,
              borderDash: [5, 5],
            },
            { 
              label: 'VaR Market',
              data: marketValues, 
              backgroundColor: marketBarColors, 
              borderColor: marketBarColors, 
              borderWidth: 1,
              borderDash: [10, 5],
            },
            { 
              label: 'VaR Market Norm',
              data: marketNormValues, 
              backgroundColor: marketNormBarColors, 
              borderColor: marketNormBarColors, 
              borderWidth: 1,
              borderDash: [2, 2],
            },
            {
              label: 'ES Rating',
              data: Array(allConvIValues.length).fill(averageRating),
              type: 'line',
              borderColor: 'rgba(0, 191, 255, 1)',
              borderDash: [5, 5],
              borderWidth: 2,
              fill: false,
            },
            {
              label: 'ES Market',
              data: Array(allConvIValues.length).fill(averageMarket),
              type: 'line',
              borderColor: 'rgba(255, 165, 0, 0.7)',
              borderDash: [5, 5],
              borderWidth: 2,
              fill: false,
            },
            {
              label: 'ES Market Norm',
              data: Array(allConvIValues.length).fill(averageMarketNorm),
              type: 'line',
              borderColor: 'rgba(144, 238, 144, 0.7)',
              borderDash: [5, 5],
              borderWidth: 2,
              fill: false,
            }
          ] 
        }, 
        options: {
          indexAxis: 'x', 
          scales: {
            x: {
              reverse: true, 
              title: {
                display: true,
                text: 'CONVI'
              },
            },
            y: {
              title: {
                display: true,
                text: 'Loss Amount'
              }
            }
          },
          plugins: {
            zoom: {
              pan: {
                enabled: true, 
                mode: 'x', 
              },
              zoom: {
                drag: {
                  enabled: true 
                },
                wheel: {
                  enabled: true, 
                },
                pinch: {
                  enabled: true, 
                },
                mode: 'x'
              },
              limits: {
                x: { 
                  min: 0, 
                  max: allConvIValues.length - 1, 
                },
                y: { 
                  min: 0 
                }
              },
            },
            tooltip: {
              callbacks: {
                title: (context) => `CONVI: ${allConvIValues[context[0].dataIndex]}`
              }
            }
          }
        }
      });
    }
















