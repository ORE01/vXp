import { filterColumnsInData } from '../../../core/ui/modal/modalData.js';
import processData from '../../../core/ui/modal/modalData.js';
import createBarChart from '../../../charts/BarChart.js';
import { appState } from '../../../renderer.js';
import { renderLossHistogram } from './lossHistogramChart.js';
import { getColorFromPalette } from '../../../utils/colors.js';
// import {handleTrafficLight} from './trafficLight.js';

// Global scope â€” this runs as soon as the file is loaded
if (!window.charts) window.charts = {}; 

// Global objects to store datasets
let ratingData = [];
let marketData = [];
let marketNormData = [];

// var_index der gelaufenen CVaR-Config: spiegelt das Backend
// (var_index = floor((1 - conf_level) * n_simulations)). Werte kommen aus
// CreditVaRInput (die gewaehlte/aktive Config), damit die markierte VaR-Zeile
// mit n_simulations mitskaliert. Fallback = 10 (bisheriges Verhalten).
function getRunVarIndex() {
  const configs = appState.getCvarInput?.() || [];
  const selName = document.querySelector('.cvar-radio:checked')?.dataset?.name;
  const cfg =
    (selName && configs.find(c => String(c.name) === String(selName))) ||
    configs.find(c => Number(c.is_active) === 1) ||
    configs[configs.length - 1] ||
    null;
  const conf = Number(cfg?.conf_level);
  const nSim = Number(cfg?.n_simulations);
  if (Number.isFinite(conf) && Number.isFinite(nSim) && nSim > 0) {
    return Math.floor((1 - conf) * nSim);
  }
  return 10;
}

// Ziel-Quantil des VaR in Prozent (= conf_level * 100, Default 99.9). Der VaR-Balken
// in den Charts liegt am Quantil, das dem Konfidenzniveau am naechsten ist.
function getRunConfQuantil() {
  const configs = appState.getCvarInput?.() || [];
  const selName = document.querySelector('.cvar-radio:checked')?.dataset?.name;
  const cfg =
    (selName && configs.find(c => String(c.name) === String(selName))) ||
    configs.find(c => Number(c.is_active) === 1) ||
    configs[configs.length - 1] ||
    null;
  const conf = Number(cfg?.conf_level);
  return (Number.isFinite(conf) && conf > 0 && conf < 1) ? conf * 100 : 99.9;
}

// Index des Wertes in values, der target am naechsten ist (fuer die Balken-Markierung).
function closestIndex(values, target) {
  let idx = -1;
  let best = Infinity;
  values.forEach((v, i) => {
    const d = Math.abs(Number(v) - target);
    if (d < best) { best = d; idx = i; }
  });
  return idx;
}

// Summe der NAV eines Portfolios aus dem EAD-Store (pro pd_flag dupliziert ->
// auf ein Flag filtern). Fuer die Umrechnung der Verluste in % vom NAV. Fallback 1.
function sumNavForPort(port) {
  const rows = (appState.getAllEADData?.() || []).filter(
    (r) => String(r.port_name) === String(port) && String(r.pd_flag).toUpperCase() === 'RATING'
  );
  const s = rows.reduce((acc, r) => acc + Number(r.NAV || 0), 0);
  return s > 0 ? s : 1;
}

export function handleLossIssuerMainData(receivedData) {
  //console.log('LossIssuer receivedData:', receivedData);

  const port_name = appState.getSelectedPortTableName();
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

  // Schleife Ã¼ber alle Typen
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

      // VaR-Zeile markieren = Backend CVaR = df.iloc[var_index]. tbody-Datenzeilen
      // direkt indizieren (0-basiert), damit Header-Offset und Skalierung stimmen.
      const varIndex = getRunVarIndex();
      const dataRows = LossIssuerDataContainer.querySelectorAll('tbody tr');
      if (dataRows.length > varIndex) {
        dataRows[varIndex].classList.add('highlight');
      }

      // Speichern (die 3 Einzelcharts sind zu EINER Chart mit 3 Serien zusammengefasst,
      // siehe createCombinedLossesChart unten -> 'LossIssuerChartCombinedTop').
      if (pdFlag === 'RATING') {
        ratingData = sortedData;
      } else if (pdFlag === 'MARKET') {
        marketData = sortedData;
      } else if (pdFlag === 'NORM') {
        marketNormData = sortedData;
      }
    }
  });

  // Kombinierte Charts nur erstellen, wenn alle drei da sind
  if (ratingData.length > 0 && marketData.length > 0 && marketNormData.length > 0) {
    // Rating/Market/Norm Losses in EINER horizontalen Balkenchart (gleicher Stil
    // wie die früheren Einzelcharts), als 3 farbige Serien.
    createCombinedLossesChart(ratingData, marketData, marketNormData, 'LossIssuerChartCombinedTop');

    createCombinedLossIssuerChart(ratingData, marketData, marketNormData, 'LossIssuerCombinedChart');
    createCombinedLossIssuerESChart(ratingData, marketData, marketNormData, 'LossIssuerCombinedESChart');

    // Loss-Histogramm mit-rendern: hier ist der Port garantiert gesetzt (die Loss-
    // Charts wurden gerade fuer diesen Port gerendert) -> loest das Timing-Problem
    // beim Reload (Histogramm-Daten da, aber port_name noch nicht gesetzt).
    try { renderLossHistogram(); } catch (_) {}

    const fetchRatingData = () => new Promise(resolve => {
      setTimeout(() => resolve(ratingData), 1000);
    });

    const fetchNormData = () => new Promise(resolve => {
      setTimeout(() => resolve(marketNormData), 2000);
    });

    Promise.all([fetchRatingData(), fetchNormData()]).then(([ratingData, marketNormData]) => {
      const extractedRatingLosses = ratingData.map(item => item.LOSS || 0);
      const extractedNormLosses = marketNormData.map(item => item.LOSS || 0);
      
    });
  }
}






export function setupLossIssuerUI() {
  const show = (id) => {
    const el = document.getElementById(id);
    if (!el) return;
    
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
    // Rating/Market/Norm Losses zusammengefasst in einer Chart
    'LossIssuerChartContainerCombined',
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
      let columns = ['QUANTIL', 'DEFAULTS', 'ISSUER_RANK', 'LOSS'];
      let filteredData = filterColumnsInData(receivedData, columns);

      // Sort the data
      return filteredData;
    }
    function createLossIssuerChart(data, chartId, type) {
      // Destroy the old chart if it exists
      if (window[chartId] && typeof window[chartId].destroy === 'function') {
        window[chartId].destroy();
      }

      // Limit the data to the first 15 rows
      const limitedData = data.slice(0, 15);
      const labels = limitedData.map(d => d.DEFAULTS);
      const values = limitedData.map(d => d.LOSS);

      // Set the color based on the type ('rating' = blue, 'market' = orange, 'norm' = green)
      let barColor;
      if (type === 'market') {
        barColor = 'rgba(255, 165, 0, 0.7)'; // Orange
      } else if (type === 'norm') {
        barColor = 'rgba(144, 238, 144, 0.7)'; // Light Green (semi-transparent)
      } else {
        barColor = 'rgba(70, 192, 230, 0.7)'; // Blue for Rating
      }

      // Create color array and highlight the 10th bar in red
      const barColors = limitedData.map((_, index) => 
        index === 9 ? '#ff6666' : barColor
      );

      // Create the new chart and store it in `window`
      window[chartId] = createBarChart({ 
        labels: labels, 
        datasets: [{ 
          label: type === 'market' ? 'Market Losses' : type === 'norm' ? 'Market adjusted Losses' : 'Historic Losses',
          data: values, 
          backgroundColor: barColors, 
          borderColor: barColors 
        }]
      }, chartId, 'bar', 'y');
    }

    // Rating + Market + Norm Losses in EINER horizontalen Balkenchart (3 Serien).
    // Gleicher Stil/Helper wie createLossIssuerChart (createBarChart, indexAxis 'y').
    // Achse = QUANTIL (bei allen pd_flags identisch); erste 15 Zeilen.
    //
    // createBarChart ist responsive:false und snapshottet die Canvas-Größe beim
    // Erstellen. Wird die Chart gezeichnet, bevor der Container seine endgültige
    // Höhe hat (Panel-Open/Layout), bleibt sie zu klein. Daher: per ResizeObserver
    // neu zeichnen, sobald der Container seine Maße ändert -> füllt die Karte.
    function createCombinedLossesChart(ratingData, marketData, marketNormData, chartId) {
      const canvas = document.getElementById(chartId);
      if (!canvas) return;
      const host = canvas.parentNode;

      const render = () => {
        if (window[chartId] && typeof window[chartId].destroy === 'function') {
          try { window[chartId].destroy(); } catch (e) {}
        }

        const base = (ratingData.length ? ratingData : marketData).slice(0, 15);
        const labels = base.map(d => d.QUANTIL);

        const lossByQuantil = (rows) => {
          const m = new Map((rows || []).map(r => [r.QUANTIL, r.LOSS]));
          return labels.map(q => m.get(q) ?? 0);
        };

        // Direkt mit new Chart() (statt createBarChart), damit die Legende klickbar
        // ist: createBarChart setzt events:[] -> Serien ließen sich nicht aus-/
        // einblenden. Sonst identische Optionen (responsive:false, indexAxis 'y').
        const cv = document.getElementById(chartId);
        if (!cv || !cv.isConnected || !cv.parentNode) return;

        const existing = (typeof Chart !== 'undefined' && Chart.getChart) ? Chart.getChart(cv) : null;
        if (existing) { try { existing.destroy(); } catch (e) {} }

        // Canvas-Größe aus dem Container (responsive:false braucht feste Maße).
        const hostRect = cv.parentNode.getBoundingClientRect();
        const selfRect = cv.getBoundingClientRect();
        cv.width = Math.floor(selfRect.width || hostRect.width || 800);
        cv.height = Math.floor(selfRect.height || hostRect.height || 300);

        const mkDs = (label, data, color) => ({
          label, data,
          backgroundColor: color,
          borderColor: color,
          maxBarThickness: 64,
        });

        window[chartId] = new Chart(cv.getContext('2d'), {
          type: 'bar',
          data: {
            labels,
            datasets: [
              mkDs('Historic Losses', lossByQuantil(ratingData), getColorFromPalette(0, 0.7)),
              mkDs('Market Losses', lossByQuantil(marketData), getColorFromPalette(1, 0.7)),
              mkDs('Market adjusted Losses', lossByQuantil(marketNormData), getColorFromPalette(2, 0.7)),
            ],
          },
          options: {
            responsive: false,
            maintainAspectRatio: false,
            indexAxis: 'y',
            animation: false,
            normalized: true,
            // 'click' aktiviert das Aus-/Einblenden der Serien über die Legende.
            events: ['click'],
            plugins: {
              legend: { display: true },
              annotation: false,
            },
            scales: {
              y: { beginAtZero: true, ticks: { autoSkip: false } },
            },
          },
        });
      };

      // Immer die aktuelle Render-Funktion (frische Daten) am Container hinterlegen.
      if (host) host.__lossComboRender = render;

      render();

      // Einmaliger ResizeObserver pro Container: bei Größenänderung neu zeichnen,
      // damit die Chart die Karte korrekt ausfüllt (auch nach Panel-Open).
      if (host && !host.__lossComboRO && typeof ResizeObserver !== 'undefined') {
        host.__lossComboRO = true;
        let lastH = 0;
        const ro = new ResizeObserver(() => {
          const h = host.getBoundingClientRect().height;
          if (h > 5 && Math.abs(h - lastH) > 8) {
            lastH = h;
            host.__lossComboRender?.();
          }
        });
        ro.observe(host);
      }
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

      // Combine the QUANTIL labels from all datasets (remove duplicates)
      const allConvIValues = Array.from(new Set([
        ...ratingData.map(d => d.QUANTIL), 
        ...marketData.map(d => d.QUANTIL),
        ...marketNormData.map(d => d.QUANTIL)
      ])).sort((a, b) => a - b);

      // Map the LOSS and ISSUER_RANK for each QUANTIL in all datasets
      const sumNav = sumNavForPort(appState.getSelectedPortTableName?.());
      const ratingValues = allConvIValues.map(convI => {
        const found = ratingData.find(d => d.QUANTIL === convI);
        return found ? (Number(found.LOSS) / sumNav) * 100 : 0; 
      });

      const marketValues = allConvIValues.map(convI => {
        const found = marketData.find(d => d.QUANTIL === convI);
        return found ? (Number(found.LOSS) / sumNav) * 100 : 0; 
      });

      const marketNormValues = allConvIValues.map(convI => {
        const found = marketNormData.find(d => d.QUANTIL === convI);
        return found ? (Number(found.LOSS) / sumNav) * 100 : 0; 
      });

      const issuerRanksRating = allConvIValues.map(convI => {
        const found = ratingData.find(d => d.QUANTIL === convI);
        return found ? found.ISSUER_RANK : 'N/A';
      });

      const issuerRanksMarket = allConvIValues.map(convI => {
        const found = marketData.find(d => d.QUANTIL === convI);
        return found ? found.ISSUER_RANK : 'N/A';
      });

      const issuerRanksMarketNorm = allConvIValues.map(convI => {
        const found = marketNormData.find(d => d.QUANTIL === convI);
        return found ? found.ISSUER_RANK : 'N/A';
      });

      // Colors for the chart bars
      const highlightColor = 'rgba(255, 0, 0, 0.9)'; // Red for highlight
      const defaultRatingColor = getColorFromPalette(0, 0.7); // Historic (Palette-Blau)
      const defaultMarketColor = getColorFromPalette(1, 0.7); // Market (Palette-Orange)
      const defaultMarketNormColor = getColorFromPalette(2, 0.7); // Market adjusted (Palette-Grün)

      // VaR-Balken = Quantil am naechsten zum Konfidenzniveau (statt exaktem ===99.9,
      // das seit der 6-stelligen QUANTIL-Praezision nie mehr traf).
      const varIdx = closestIndex(allConvIValues, getRunConfQuantil());
      const ratingBarColors = allConvIValues.map((_, i) => i === varIdx ? highlightColor : defaultRatingColor);
      const marketBarColors = allConvIValues.map((_, i) => i === varIdx ? highlightColor : defaultMarketColor);
      const marketNormBarColors = allConvIValues.map((_, i) => i === varIdx ? highlightColor : defaultMarketNormColor);

      // Create the new chart with 3 datasets
      window.charts[chartId] = new Chart(chartElement.getContext('2d'), {
        type: 'bar',
        data: { 
          labels: allConvIValues.map(v => Number(v).toFixed(2)),
          datasets: [
            { 
              label: 'Historic Loss',
              data: ratingValues, 
              backgroundColor: ratingBarColors, 
              borderColor: ratingBarColors, 
            },
            {
              label: 'Market Loss',
              data: marketValues,
              backgroundColor: marketBarColors,
              borderColor: marketBarColors,
              hidden: true,   // initial ausgeblendet (per Legende einblendbar)
            },
            {
              label: 'Market adjusted Loss',
              data: marketNormValues,
              backgroundColor: marketNormBarColors,
              borderColor: marketNormBarColors,
              hidden: true,   // initial ausgeblendet (per Legende einblendbar)
            }
          ]
        },
        options: {
          responsive: true,            // â¬…ï¸ deaktiviert automatisches Anpassen
          maintainAspectRatio: false,   // â¬…ï¸ erlaubt, Breite/HÃ¶he frei zu setzen
          indexAxis: 'x', 
          scales: {
            x: {
              reverse: true, 
              title: {
                display: true,
                text: 'QUANTIL'
              },
            },
            y: {
              title: {
                display: true,
                text: 'Loss (% of NAV)'
              }
            }
          },
          plugins: {
            legend: {
              position: 'right',
              labels: {
                boxWidth: 12, padding: 8, font: { size: 12 },
                // Zusatz-Eintrag "VaR" (rot) unter den 3 Serien-Labels.
                generateLabels: (chart) => {
                  const items = Chart.defaults.plugins.legend.labels.generateLabels(chart);
                  items.push({ text: 'VaR', fillStyle: 'rgba(255,0,0,0.9)', strokeStyle: 'rgba(255,0,0,0.9)', lineWidth: 0, hidden: false, datasetIndex: -1 });
                  return items;
                },
              },
              onClick: (e, item, legend) => {
                if (item.datasetIndex == null || item.datasetIndex < 0) return; // Pseudo-Eintrag "VaR"
                Chart.defaults.plugins.legend.onClick(e, item, legend);
              },
            },
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
                  return `QUANTIL: ${allConvIValues[index]}`;
                },
                label: (context) => {
                  const index = context.dataIndex;
                  const datasetLabel = context.dataset.label;

                  const lossValue = `${Number(context.raw).toFixed(2)} %`;

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

      // Detail-Tail = ab dem VaR-Quantil (99.90) bis zum Maximum (schlimmster Verlust).
      // Frueher zusaetzlich `<= 99.99` -> schnitt bei >10k Sims die obersten Zeilen
      // (Quantil 99.99x, hoechster Balken) ab. Obere Grenze daher entfernt.
      const allConvIValues = Array.from(new Set([
        ...ratingData.map(d => d.QUANTIL),
        ...marketData.map(d => d.QUANTIL),
        ...marketNormData.map(d => d.QUANTIL)
      ])).filter(convI => convI >= 99.90).sort((a, b) => a - b);

      // Map the LOSS and ISSUER_RANK for each QUANTIL in all datasets
      const sumNav = sumNavForPort(appState.getSelectedPortTableName?.());
      const ratingValues = allConvIValues.map(convI => {
        const found = ratingData.find(d => d.QUANTIL === convI);
        return found ? (Number(found.LOSS) / sumNav) * 100 : 0; 
      });

      const marketValues = allConvIValues.map(convI => {
        const found = marketData.find(d => d.QUANTIL === convI);
        return found ? (Number(found.LOSS) / sumNav) * 100 : 0; 
      });

      const marketNormValues = allConvIValues.map(convI => {
        const found = marketNormData.find(d => d.QUANTIL === convI);
        return found ? (Number(found.LOSS) / sumNav) * 100 : 0; 
      });

      const issuerRanksRating = allConvIValues.map(convI => {
        const found = ratingData.find(d => d.QUANTIL === convI);
        return found ? found.ISSUER_RANK : 'N/A';
      });

      const issuerRanksMarket = allConvIValues.map(convI => {
        const found = marketData.find(d => d.QUANTIL === convI);
        return found ? found.ISSUER_RANK : 'N/A';
      });

      const issuerRanksMarketNorm = allConvIValues.map(convI => {
        const found = marketNormData.find(d => d.QUANTIL === convI);
        return found ? found.ISSUER_RANK : 'N/A';
      });

      // Expected Shortfall = Mittelwert des GESAMTEN dargestellten Tails
      // (= schlechteste var_index Szenarien, quantil >= VaR-Quantil) — dieselbe
      // Datenbasis, aus der das Backend den ES bildet. Frueher slice(0,10) -> die
      // KLEINSTEN Tail-Verluste (nahe VaR) -> Linie ~2x zu tief und n-abhaengig.
      const calculateAverage = (values) => {
        const tail = values.filter(v => Number.isFinite(Number(v)) && Number(v) > 0);
        if (!tail.length) return 0;
        return tail.reduce((acc, v) => acc + Number(v), 0) / tail.length;
      };

      const averageRating = calculateAverage(ratingValues);
      const averageMarket = calculateAverage(marketValues);
      const averageMarketNorm = calculateAverage(marketNormValues);

      // Colors for the chart bars
      const highlightColor1 = 'rgba(255, 0, 0, 0.9)'; // Red for highlight 1
      const highlightColor2 = 'rgba(200, 0, 0, 0.9)'; // Darker Red for highlight 2
      const highlightColor3 = 'rgba(150, 0, 0, 0.9)'; // Even Darker Red for highlight 3
      const defaultRatingColor = getColorFromPalette(0, 0.7); // Historic (Palette-Blau)
      const defaultMarketColor = getColorFromPalette(1, 0.7); // Market (Palette-Orange)
      const defaultMarketNormColor = getColorFromPalette(2, 0.7); // Market adjusted (Palette-Grün)

      // VaR-Balken = Quantil am naechsten zum Konfidenzniveau (robust gegen die
      // 6-stellige QUANTIL-Praezision und beliebiges n_simulations).
      const varIdx = closestIndex(allConvIValues, getRunConfQuantil());
      const ratingBarColors = allConvIValues.map((_, i) => i === varIdx ? highlightColor1 : defaultRatingColor);
      const marketBarColors = allConvIValues.map((_, i) => i === varIdx ? highlightColor2 : defaultMarketColor);
      const marketNormBarColors = allConvIValues.map((_, i) => i === varIdx ? highlightColor3 : defaultMarketNormColor);

      // Create the new chart with 3 datasets
      window.charts[chartId] = new Chart(chartElement.getContext('2d'), {
        type: 'bar',
        data: { 
          labels: allConvIValues.map(v => Number(v).toFixed(2)),
          datasets: [
            { 
              label: 'Historic VaR',
              data: ratingValues, 
              backgroundColor: ratingBarColors, 
              borderColor: ratingBarColors, 
              borderWidth: 1,
              borderDash: [5, 5],
            },
            { 
              label: 'Market VaR',
              data: marketValues,
              backgroundColor: marketBarColors,
              borderColor: marketBarColors,
              borderWidth: 1,
              borderDash: [10, 5],
              hidden: true,
            },
            { 
              label: 'Market adjusted VaR',
              data: marketNormValues,
              backgroundColor: marketNormBarColors,
              borderColor: marketNormBarColors,
              borderWidth: 1,
              borderDash: [2, 2],
              hidden: true,
            },
            {
              label: 'Historic ES',
              data: Array(allConvIValues.length).fill(averageRating),
              type: 'line',
              borderColor: defaultRatingColor,
              borderDash: [5, 5],
              borderWidth: 2,
              fill: false,
            },
            {
              label: 'Market ES',
              data: Array(allConvIValues.length).fill(averageMarket),
              type: 'line',
              borderColor: defaultMarketColor,
              borderDash: [5, 5],
              borderWidth: 2,
              fill: false,
              hidden: true,
            },
            {
              label: 'Market adjusted ES',
              data: Array(allConvIValues.length).fill(averageMarketNorm),
              type: 'line',
              borderColor: defaultMarketNormColor,
              borderDash: [5, 5],
              borderWidth: 2,
              fill: false,
              hidden: true,
            }
          ] 
        }, 
        options: {
          responsive: true,
          maintainAspectRatio: false,   // CSS fixiert die Canvas-Hoehe -> kein Seitenverhaeltnis, sonst Klick-Versatz in der Legende
          indexAxis: 'x',
          scales: {
            x: {
              reverse: true, 
              title: {
                display: true,
                text: 'QUANTIL'
              },
            },
            y: {
              title: {
                display: true,
                text: 'Loss (% of NAV)'
              }
            }
          },
          plugins: {
            legend: {
              position: 'right',
              labels: { boxWidth: 12, padding: 8, font: { size: 12 } },
            },
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
                title: (context) => `QUANTIL: ${allConvIValues[context[0].dataIndex]}`,
                label: (ctx) => `${ctx.dataset.label}: ${Number(ctx.parsed.y).toFixed(2)} %`,
              }
            }
          }
        }
      });
    }


















