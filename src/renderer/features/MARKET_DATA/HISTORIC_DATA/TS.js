import createLineChart from '../../../charts/LineChart.js';
import { calculateSMA, calculateRSI } from './ChartAnalyses.js';
import { notifyRiskPreview } from '../../REPORTS/RiskPDFPreview.js';


// Store chart instances in an object with modalIndex as key
const chartInstances = {};

        // ===== Renderer-Helper: Customer-ID aus appState =====
        function getCurrentCustomerId() {
          // Variante A: knallhart testen
          return 1;
        }

        function waitForCustomerTSData(timeoutMs = 5000) {
          // sofort da?
          const existing = window.appState?.getCustomerTSData?.();
          if (existing !== undefined && existing !== null) return Promise.resolve(existing);
          if (window.__tsSelectionsReady) return Promise.resolve(window.appState?.getCustomerTSData?.());

          return new Promise((resolve) => {
            let done = false;
            const finish = (val) => { if (!done) { done = true; resolve(val); } };

            const t = setTimeout(() => finish(undefined), timeoutMs);

            // auf unser Custom-Event warten
            const onReady = () => {
              clearTimeout(t);
              window.removeEventListener('ts-selections-ready', onReady);
              finish(window.appState?.getCustomerTSData?.());
            };
            window.addEventListener('ts-selections-ready', onReady, { once: true });
          });
        }

        function parseSelectionUnknown(sel) {
          if (sel == null) return [];
          if (Array.isArray(sel)) return sel;
          if (typeof sel === 'string') {
            try { const p = JSON.parse(sel); return Array.isArray(p) ? p : []; } catch { return []; }
          }
          return [];
        }


async function loadTSSelectionFromDB(modalIndex, headers) {
  const customer_id = getCurrentCustomerId();
  const seriesNames = (headers || []).slice(1);

  let appRows = window.appState?.getCustomerTSData?.();
  if (appRows === undefined || appRows === null) {
    appRows = await waitForCustomerTSData(5000);
  }
  if (!Array.isArray(appRows)) {
    return {
      indices: [],
      normalization_type: 'none',
      show_daily_volatility: 0,
      apply_sma1: 0, sma1_period: 20,
      apply_sma2: 0, sma2_period: 50,
      apply_sma3: 0, sma3_period: 200,
    };
  }

  const row = appRows.find(r =>
    Number(r?.customer_id) === Number(customer_id) &&
    Number(r?.ts_modal_index) === Number(modalIndex) &&
    (r?.ts_key || 'ts_selected') === 'ts_selected'
  );

  if (!row) {
    return {
      indices: [],
      normalization_type: 'none',
      show_daily_volatility: 0,
      apply_sma1: 0, sma1_period: 20,
      apply_sma2: 0, sma2_period: 50,
      apply_sma3: 0, sma3_period: 200,
    };
  }

  // Indizes/Labels parsen
  const raw = parseSelectionUnknown(row.ts_selection ?? row.indices ?? row.labels);
  const indices = (raw.length && typeof raw[0] === 'string')
    ? raw.map(lbl => seriesNames.indexOf(lbl)).filter(i => i >= 0)
    : raw.map(n => Number(n)).filter(n => Number.isInteger(n) && n >= 0 && n < seriesNames.length);

  // <-- WICHTIG: Normalization + Volatility + SMA zurÃ¼ckgeben
  return {
    indices,
    normalization_type: (row.normalization_type ?? 'none').toString(),
    show_daily_volatility: Number(row.show_daily_volatility ?? 0),

    apply_sma1: Number(row.apply_sma1 ?? 0),
    sma1_period: Number(row.sma1_period ?? 20),

    apply_sma2: Number(row.apply_sma2 ?? 0),
    sma2_period: Number(row.sma2_period ?? 50),

    apply_sma3: Number(row.apply_sma3 ?? 0),
    sma3_period: Number(row.sma3_period ?? 200),
  };
}






// ===== Renderer-Helper: TS-Auswahl in DB speichern =====
// Speichert sowohl indices als auch labels (robust gegen Main-Implementierung).
function saveTSSelectionToDB(modalIndex, headers, checkboxes) {
  const customer_id = 1; // dein Test
  if (!customer_id) return Promise.resolve();

  const seriesNames = (headers || []).slice(1);
  const indices = [];
  checkboxes.forEach((cb, i) => { if (cb.checked) indices.push(i); });

  // UI lesen
  const normalization_type = document.getElementById(`normalizationTypeSelector_${modalIndex}`)?.value || 'none';
  const show_daily_volatility = document.getElementById(`showDailyVolatility_${modalIndex}`)?.checked ? 1 : 0;

  const apply_sma1 = document.getElementById(`applySMA1_${modalIndex}`)?.checked ? 1 : 0;
  const sma1_period = parseInt(document.getElementById(`movingAveragePeriod1_${modalIndex}`)?.value,10) || 20;

  const apply_sma2 = document.getElementById(`applySMA2_${modalIndex}`)?.checked ? 1 : 0;
  const sma2_period = parseInt(document.getElementById(`movingAveragePeriod2_${modalIndex}`)?.value,10) || 50;

  const apply_sma3 = document.getElementById(`applySMA3_${modalIndex}`)?.checked ? 1 : 0;
  const sma3_period = parseInt(document.getElementById(`movingAveragePeriod3_${modalIndex}`)?.value,10) || 200;

  return new Promise((resolve) => {
    const requestId = `save_${modalIndex}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    window.api.once(`ts-selection:save-success:${requestId}`, () => resolve());
    window.api.once(`ts-selection:save-error:${requestId}`, (_e, msg) => { console.warn(msg); resolve(); });

    window.api.send('ts-selection:save', {
      requestId, customer_id, ts_modal_index: modalIndex, ts_key: 'ts_selected',
      indices,
      normalization_type,
      show_daily_volatility,
      apply_sma1, sma1_period,
      apply_sma2, sma2_period,
      apply_sma3, sma3_period,
    });
  });
}


export async function handleTSData(receivedData, modalIndex) {
  appState.setTblTSData(receivedData);

  const checkboxContainer       = document.getElementById(`checkboxContainer_${modalIndex}`);
  const targetCheckboxContainer = document.getElementById('targetCheckboxContainer');
  const loadButton              = document.getElementById(`loadButton_${modalIndex}`);

  // âœ… raw rows
  const rowsRaw = Array.isArray(receivedData) ? receivedData : (receivedData?.rows || receivedData?.data || []);
  if (!(rowsRaw && rowsRaw.length && checkboxContainer && loadButton)) return;

  // âœ… dateKey bestimmen (falls bei dir fix "DATE" ist: const dateKey = "DATE";)
  const first = rowsRaw[0];
  const dateKey =
    ('DATE' in first) ? 'DATE' :
    ('date' in first) ? 'date' :
    ('Date' in first) ? 'Date' :
    Object.keys(first)[0];

  // âœ… headers: [dateKey, ...rest]
  const headers = [dateKey, ...Object.keys(first).filter(k => k !== dateKey)];

  checkboxContainer.innerHTML = '';
  targetCheckboxContainer.innerHTML = '';

  const defaultCheckedIndices = { 1:[0,1], 2:[7,8], 3:[17], 4:[15] };

  const saved = await loadTSSelectionFromDB(modalIndex, headers) || {};
  const savedIndices = Array.isArray(saved.indices) ? saved.indices : [];

  const selNormalization = document.getElementById(`normalizationTypeSelector_${modalIndex}`);
  const chkVolatility    = document.getElementById(`showDailyVolatility_${modalIndex}`);

  const chkSMA1 = document.getElementById(`applySMA1_${modalIndex}`);
  const perSMA1 = document.getElementById(`movingAveragePeriod1_${modalIndex}`);
  const chkSMA2 = document.getElementById(`applySMA2_${modalIndex}`);
  const perSMA2 = document.getElementById(`movingAveragePeriod2_${modalIndex}`);
  const chkSMA3 = document.getElementById(`applySMA3_${modalIndex}`);
  const perSMA3 = document.getElementById(`movingAveragePeriod3_${modalIndex}`);

  if (selNormalization) selNormalization.value = saved.normalization_type ?? 'none';
  if (chkVolatility)    chkVolatility.checked  = !!saved.show_daily_volatility;

  if (chkSMA1) chkSMA1.checked = !!saved.apply_sma1;
  if (perSMA1) perSMA1.value   = saved.sma1_period ?? 20;

  if (chkSMA2) chkSMA2.checked = !!saved.apply_sma2;
  if (perSMA2) perSMA2.value   = saved.sma2_period ?? 50;

  if (chkSMA3) chkSMA3.checked = !!saved.apply_sma3;
  if (perSMA3) perSMA3.value   = saved.sma3_period ?? 200;

  const checkboxes = headers.slice(1).map((header, index) => {
    const cb = document.createElement('input');
    cb.type  = 'checkbox';
    cb.id    = `checkbox-${modalIndex}-${index}`;
    cb.value = header;

    const isSaved   = savedIndices.includes(index);
    const isDefault = defaultCheckedIndices[modalIndex]?.includes(index) || false;
    cb.checked = isSaved || (!savedIndices.length && isDefault);

    checkboxContainer.appendChild(cb);
    const label = document.createElement('label');
    label.htmlFor = cb.id; label.textContent = header;
    checkboxContainer.appendChild(label);
    checkboxContainer.appendChild(document.createElement('br'));
    return cb;
  });

  headers.slice(1).forEach((header, index) => {
    const tcb = document.createElement('input');
    tcb.type = 'checkbox';
    tcb.id   = `target-checkbox-${index}`;
    tcb.value = header;

    targetCheckboxContainer.appendChild(tcb);
    const label = document.createElement('label');
    label.htmlFor = tcb.id; label.textContent = header;
    targetCheckboxContainer.appendChild(label);
    targetCheckboxContainer.appendChild(document.createElement('br'));

    tcb.addEventListener('change', (e) => {
      if (e.target.checked) {
        const all = targetCheckboxContainer.querySelectorAll('input[type="checkbox"]');
        all.forEach(cb => { if (cb !== e.target) cb.checked = false; });
      }
    });
  });

  const persistNow = () => saveTSSelectionToDB(modalIndex, headers, checkboxes);

  // Änderungen werden NUR gespeichert (kein sofortiges Neuzeichnen).
  // Der Chart aktualisiert sich erst beim Klick auf "Load Data".
  checkboxes.forEach(cb => cb.addEventListener('change', persistNow));
  if (selNormalization) selNormalization.addEventListener('change', persistNow);
  if (chkVolatility)    chkVolatility.addEventListener('change', persistNow);

  [chkSMA1, chkSMA2, chkSMA3].forEach(el => el && el.addEventListener('change', persistNow));
  [perSMA1, perSMA2, perSMA3].forEach(el => el && el.addEventListener('input', persistNow));

  // Y-Achse Log/Linear: kein Live-Update mehr -> wirkt erst bei "Load Data".
  // (createLineChart liest #logScale_<modalIndex> beim Zeichnen aus.)

  loadButton.replaceWith(loadButton.cloneNode(true));
  const newLoadButton = document.getElementById(`loadButton_${modalIndex}`);

newLoadButton.onclick = async () => {
  await persistNow();

  const chartContainer = document.querySelector(`#TSlineChart_${modalIndex}`)?.parentElement;
  const mainTableContainer = document.getElementById(`TSDataContainer_${modalIndex}`);
  if (chartContainer && mainTableContainer) {
    chartContainer.style.display = 'block';
    mainTableContainer.style.display = 'none';
  }

  // Chart + Tabelle aktualisieren
  refreshTableAndChartRaw(rowsRaw, headers, checkboxes, modalIndex, dateKey);

  // Risk-Preview nach dem Render anstoÃŸen
  // ein Frame warten, damit Chart.js Zeit hat, den Canvas zu zeichnen
  requestAnimationFrame(() => {
    try {
      console.log('[TS] notifyRiskPreview for modal', modalIndex);
      notifyRiskPreview('historicTS'); // Label ist egal, dient nur dem Logging
    } catch (e) {
      console.warn('[TS] notifyRiskPreview failed', e);
    }
  });
};


  loadButton.style.display = 'block';
}





function toIsoDateString(d) {
  if (d == null) return null;

  // ISO already
  if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}/.test(d)) return d.slice(0, 10);

  // "DD-MM-YYYY" oder "DD.MM.YYYY"
  if (typeof d === 'string') {
    const m = d.match(/^(\d{2})[-.](\d{2})[-.](\d{4})$/);
    if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  }

  // Date object
  if (d instanceof Date && !isNaN(d)) return d.toISOString().slice(0, 10);

  // last resort
  const dt = new Date(d);
  if (!isNaN(dt)) return dt.toISOString().slice(0, 10);

  return null;
}


// Leitet aus den Serien-Keys (z.B. EU_1Y, US_AAA) ein sprechendes Chart-Label ab,
// damit Preview/PDF "Interest Rates EUR" / "Credit Spreads USD" zeigen statt "TSlineChart_x".
function deriveTsChartLabel(keys) {
  const list = (keys || []).map(k => String(k || '').toUpperCase().trim()).filter(Boolean);
  if (!list.length) return null;
  const REGION = { EU: 'EUR', EUR: 'EUR', EUSWAP: 'EUR', DE: 'EUR', AT: 'EUR', US: 'USD', USD: 'USD', GB: 'GBP', UK: 'GBP', CH: 'CHF', JP: 'JPY' };
  const regions = new Set();
  const rems = [];
  for (const k of list) {
    const parts = k.split(/[_\- ]/);
    regions.add(parts[0]);
    rems.push(parts.slice(1).join('_') || k);
  }
  const tenorRe  = /^\d+\s*[YM]$|SWAP|^SW\d|OIS|IBOR|YIELD|RATE|ZINS/;
  const ratingRe = /^(AAA|AA|A|BBB|BB|B|CCC|CC|C|D)[+\-]?$|SPREAD|^CS/;
  const anyTenor  = rems.some(r => tenorRe.test(r));
  const anyRating = rems.some(r => ratingRe.test(r));
  const type = (anyRating && !anyTenor) ? 'Credit Spreads' : (anyTenor ? 'Interest Rates' : 'Time Series');
  let region = '';
  if (regions.size === 1) { const r = [...regions][0]; region = REGION[r] || r; }
  return region ? `${type} ${region}` : type;
}

    function refreshTableAndChartRaw(rowsRaw, headers, checkboxes, modalIndex, dateKey, containerId = 'modal-content-container') {
  const normalizationTypeSelector = document.getElementById(`normalizationTypeSelector_${modalIndex}`);
  const normalizationType = normalizationTypeSelector ? normalizationTypeSelector.value : 'none';
  const showDailyVolatility = document.getElementById(`showDailyVolatility_${modalIndex}`)?.checked ?? false;

  // Moving averages unverÃ¤ndert
  let movingAverages = { period1: null, period2: null, period3: null };
  if (containerId === 'modal-content-container') {
    try { movingAverages = getMovingAverages(modalIndex); } catch (e) {}
  }

  // âœ… Checkbox -> Dataset mapping bleibt gleich,
  // ABER dataset.index ist jetzt Header-Index im headers-Array (ab 1 sind Y-Spalten)
  const selectedDatasets = checkboxes
    .map((checkbox, index) => checkbox.checked ? {
      label: headers[index + 1],
      data: [],
      key: headers[index + 1],     // âœ… raw key statt numeric index
    } : null)
    .filter(Boolean);

  if (!selectedDatasets.length) return;

  selectedDatasets.forEach((dataset) => {
    dataset.data = [];

    for (const row of rowsRaw) {


  const xValue = toIsoDateString(row?.[dateKey]);
  if (!xValue) continue;


      

      // robustes Number-Parsing (falls DB Strings mit , liefert)
      const raw = row?.[dataset.key];
      const yNum = (raw === null || raw === undefined || raw === '') ? NaN : Number(String(raw).replace(',', '.'));

      dataset.data.push({
        x: xValue,
        y: Number.isFinite(yNum) ? yNum : null,
        originalY: Number.isFinite(yNum) ? yNum : null
      });
    }

    applyNormalization(dataset, normalizationType);

    if (containerId === 'modal-content-container') {
      try { applyMovingAverages(dataset, movingAverages); } catch (e) {}
    }
    if (showDailyVolatility) applyDailyVolatility(dataset);
  });

  // Chart destroy bleibt gleich
  if (chartInstances[modalIndex]) chartInstances[modalIndex].destroy();

  chartInstances[modalIndex] = createLineChart(
    selectedDatasets,
    `TSlineChart_${modalIndex}`,
    'Timeseries',
    0,
    modalIndex,
    { sma1: movingAverages?.period1, sma2: movingAverages?.period2, sma3: movingAverages?.period3 }
  );

  // Aussagekraeftiges Label fuer Preview/PDF aus den Serien ableiten (statt "TSlineChart_x").
  try {
    const _cv = document.getElementById(`TSlineChart_${modalIndex}`);
    const _lbl = deriveTsChartLabel(selectedDatasets.map(d => d.key));
    if (_cv && _lbl) _cv.dataset.label = _lbl;
  } catch (e) {}

// ðŸ”„ Risk-Preview updaten - HISTORIC DATA ist jetzt â€žwirklichâ€œ da
  try {
    // 1) Globaler Thumbnail-Refresh
    document.dispatchEvent(new Event('risk:refresh-thumbnails'));
  } catch (e) {
    console.warn('[TS] risk:refresh-thumbnails dispatch failed', e);
  }

  try {
    // 2) Section-spezifisch - exakt denselben Key verwenden,
    //    den du in RiskPDFPreview fÃ¼r HISTORIC DATA verwendest!
    notifyRiskPreview('historicData'); // oder z.B. 'historicTS' / 'PORTFOLIO_HISTORY_TS'
  } catch (e) {
    console.warn('[TS] notifyRiskPreview(historicData) failed', e);
  }




}


    // MAs
    function getMovingAverages(modalIndex) {
      return {
        applySMA1: document.getElementById(`applySMA1_${modalIndex}`)?.checked ?? false, 
        applySMA2: document.getElementById(`applySMA2_${modalIndex}`)?.checked ?? false, 
        applySMA3: document.getElementById(`applySMA3_${modalIndex}`)?.checked ?? false, 
        period1: parseInt(document.getElementById(`movingAveragePeriod1_${modalIndex}`)?.value, 10) || 20, 
        period2: parseInt(document.getElementById(`movingAveragePeriod2_${modalIndex}`)?.value, 10) || 50, 
        period3: parseInt(document.getElementById(`movingAveragePeriod3_${modalIndex}`)?.value, 10) || 200 
      };
    }

    function applyMovingAverages(dataset, movingAverages) {
      if (movingAverages.applySMA1) {
        const sma1 = calculateSMA(dataset.data, movingAverages.period1);
        if (sma1 && sma1.length > 0) {
          dataset.smaData1 = dataset.data.map((point, idx) => ({
            x: point.x,
            y: sma1[idx]
          }));
          //console.log(`Calculated SMA 20 for dataset [${dataset.label}]:`, dataset.smaData1);
        } else {
          console.error(`Error calculating SMA 20 for dataset [${dataset.label}]`);
        }
      }
      
      if (movingAverages.applySMA2) {
        const sma2 = calculateSMA(dataset.data, movingAverages.period2);
        if (sma2 && sma2.length > 0) {
          dataset.smaData2 = dataset.data.map((point, idx) => ({
            x: point.x,
            y: sma2[idx]
          }));
          //console.log(`Calculated SMA 50 for dataset [${dataset.label}]`, dataset.smaData2);
        } else {
          console.error(`Error calculating SMA 50 for dataset [${dataset.label}]`);
        }
      }

      if (movingAverages.applySMA3) {
        const sma3 = calculateSMA(dataset.data, movingAverages.period3);
        if (sma3 && sma3.length > 0) {
          dataset.smaData3 = dataset.data.map((point, idx) => ({
            x: point.x,
            y: sma3[idx]
          }));
          //console.log(`Calculated SMA 200 for dataset [${dataset.label}]`, dataset.smaData3);
        } else {
          console.error(`Error calculating SMA 200 for dataset [${dataset.label}]`);
        }
      }
    }
    // NORMALIZATION
    function applyNormalization(dataset, normalizationType) {
      switch (normalizationType) {
        case 'dynamic':
          if (typeof dynamicNormalization === 'function') {
            dataset.data = dynamicNormalization(dataset).data;  
            //console.log('Applied dynamicNormalization:', dataset.data);
          } else {
            console.error('dynamicNormalization function is not defined.');
          }
          break;
        case 'normalize':
          if (typeof normalizeDataset === 'function') {
            dataset.data = normalizeDataset(dataset).data;  
            //console.log('Applied normalizeDataset:', dataset.data);
          } else {
            console.error('normalizeDataset function is not defined.');
          }
          break;
        case 'none':
        default:
          //console.log(`Using original data for dataset [${dataset.label}]`);
          break;
      }
    }

    function normalizeDataset(dataset) {
        // [perf] entfernt: console.log("Before normalizeDataset:", dataset.data);
      
        // Find the first non-NaN and non-null value for normalization
        const firstValidIndex = dataset.data.findIndex(({ y }) => y !== null && !isNaN(y));
      
        // If no valid data points, return the dataset as-is
        if (firstValidIndex === -1) {
          console.warn("No valid data found for normalization.");
          return dataset;
        }
      
        const startingValue = dataset.data[firstValidIndex].y;
      
        // If the starting value is 0, return the dataset as-is
        if (startingValue === 0) {
          console.warn("Starting value for normalization is 0, skipping normalization.");
          return dataset;
        }
      
        // Normalize the data based on the first valid value
        const normalizedData = dataset.data.map(({ x, y, originalY }) => ({
          x,
          y: y !== null && !isNaN(y) ? (y / startingValue) * 100 : null, // Normalize to 100
          originalY // Preserve original value
        }));
      
        // [perf] entfernt: console.log("After normalizeDataset:", normalizedData);
      
        // Return a new dataset with normalized data
        return { ...dataset, data: normalizedData };
    }
      
    function dynamicNormalization(dataset) {
        // [perf] entfernt: console.log("Before dynamicNormalization:", dataset.data);
        const validData = dataset.data.filter(({ y }) => y !== null && !isNaN(y));
        const minValue = Math.min(...validData.map(({ y }) => y));
        const maxValue = Math.max(...validData.map(({ y }) => y));

        if (minValue === maxValue) {
            return dataset.data.map(({ x, y, originalY }) => ({ x, y, originalY }));
        }

        const normalizedData = dataset.data.map(({ x, y, originalY }) => ({
            x,
            y: y !== null && !isNaN(y) ? ((y - minValue) / (maxValue - minValue)) * 100 : null,
            originalY // Preserve original
        }));

        // [perf] entfernt: console.log("After dynamicNormalization:", normalizedData);
        return { ...dataset, data: normalizedData };
    }

    // DAILY VOL
    function applyDailyVolatility(dataset) {
      dataset.data = dataset.data.map((point, idx, array) => {
        if (idx === 0) return { x: point.x, y: null }; // No previous day to compare to
        const previousPoint = array[idx - 1].y;
        const currentPoint = point.y;
        const volatility = (previousPoint && currentPoint) ? ((currentPoint - previousPoint) / previousPoint) * 100 : null; // Calculate relative change in percentage
        return { x: point.x, y: volatility };
      });
      // [perf] entfernt: console.log(`Calculated daily volatility for dataset [${dataset.label}]`, dataset.data);
    }


// TIMESERIES:Modal Hier wird die Anzahl bestimmt!
// export function createTSModals(data) {
//   const modalContentContainer = document.getElementById('modal-content-container');
//   if (!modalContentContainer) {
//     console.error('modal-content-container not found in the DOM.');
//     return;
//   }

//   // Clear existing modals
//   modalContentContainer.innerHTML = '';

//   // Add new modals
//   const sectionCount = 4;
//   for (let i = 1; i <= sectionCount; i++) {
//     insertModal(i, data);
//   }
// }
export function createTSModals(data) {
  //console.log('data:', data)
  const modalContentContainer = document.getElementById('modal-content-container');
  if (!modalContentContainer) {
    console.error('modal-content-container not found in the DOM.');
    return;
  }

  modalContentContainer.innerHTML = '';

  const sectionCount = 4;

  // âœ… Daten pro Modal extrahieren
  const perModal = normalizeTSModalPayload(data, sectionCount);

  for (let i = 1; i <= sectionCount; i++) {
    insertModal(i, perModal[i]); // âœ… nicht mehr "data" Ã¼berall
  }

  // Wenn die Daten (spät) ankommen während das Panel offen ist: Charts direkt
  // zeichnen. (Bei geschlossenem Panel passiert nichts; das übernimmt der Open-Hook.)
  scheduleTsAutoDraw();
}

/** Liefert ein Objekt: {1: rows[], 2: rows[], 3: rows[], 4: rows[]} */
// function normalizeTSModalPayload(data, sectionCount) {
//   const out = {};
//   for (let i = 1; i <= sectionCount; i++) out[i] = [];

//   // Fall A: Array mit 4 BlÃ¶cken
//   if (Array.isArray(data) && data.length && (Array.isArray(data[0]) || typeof data[0] === 'object')) {
//     // Wenn data[0] selbst schon rows ist (Objekte mit DATE etc.), dann ist es EIN Block -> an alle geben
//     const looksLikeRows = Array.isArray(data) && data.length && !Array.isArray(data[0]) && typeof data[0] === 'object';
//     if (looksLikeRows) {
//       for (let i = 1; i <= sectionCount; i++) out[i] = data;
//       return out;
//     }

//     // Wenn data[0] ein Array ist, interpretieren wir als 4 BlÃ¶cke
//     if (Array.isArray(data[0])) {
//       for (let i = 1; i <= sectionCount; i++) out[i] = data[i - 1] || [];
//       return out;
//     }
//   }

//   // Fall B: Objekt mit Keys "1".."4"
//   if (data && typeof data === 'object') {
//     for (let i = 1; i <= sectionCount; i++) {
//       out[i] = data[i] || data[String(i)] || data[`section${i}`] || [];
//     }
//     return out;
//   }

//   return out;
// }
function normalizeTSModalPayload(data, sectionCount) {
  const out = {};
  for (let i = 1; i <= sectionCount; i++) out[i] = [];

  // ---- DEBUG: Basis-Infos
  const typeLabel =
    Array.isArray(data) ? 'array' :
    (data === null ? 'null' : typeof data);

  //console.log('[TS normalize] input type:', typeLabel);

  if (Array.isArray(data)) {
    //console.log('[TS normalize] array length:', data.length);
    const first = data[0];
    //console.log('[TS normalize] first item type:', Array.isArray(first) ? 'array' : (first === null ? 'null' : typeof first));
    if (first && typeof first === 'object' && !Array.isArray(first)) {
      //console.log('[TS normalize] first item keys sample:', Object.keys(first).slice(0, 12));
    }
  } else if (data && typeof data === 'object') {
    //console.log('[TS normalize] object keys sample:', Object.keys(data).slice(0, 20));
  }

  // ---- FALL 1: data ist rows[] (Array von Objekten) -> an alle Modals spiegeln
  // Dein Log zeigt genau das: (11970) [{...}, {...}, ...]
  if (Array.isArray(data) && data.length && data[0] && typeof data[0] === 'object' && !Array.isArray(data[0])) {
    for (let i = 1; i <= sectionCount; i++) out[i] = data;

    //console.log('[TS normalize] detected rows[] -> mirrored to all modals');
    // console.log('[TS normalize] perModal lengths:', Object.fromEntries(
    //   Object.keys(out).map(k => [k, out[k]?.length ?? 0])
    // ));

    return out;
  }

  // ---- FALL 2: data ist [rows1, rows2, rows3, rows4]
  if (Array.isArray(data) && data.length && Array.isArray(data[0])) {
    for (let i = 1; i <= sectionCount; i++) out[i] = data[i - 1] || [];

    console.log('[TS normalize] detected [rows1..] -> distributed by index');
    console.log('[TS normalize] perModal lengths:', Object.fromEntries(
      Object.keys(out).map(k => [k, out[k]?.length ?? 0])
    ));

    return out;
  }

  // ---- FALL 3: data ist Objekt mit Keys "1"/"2"/... oder "section1"/...
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    for (let i = 1; i <= sectionCount; i++) {
      out[i] = data[i] || data[String(i)] || data[`section${i}`] || [];
    }

    console.log('[TS normalize] detected object-of-modals -> extracted by keys');
    console.log('[TS normalize] perModal lengths:', Object.fromEntries(
      Object.keys(out).map(k => [k, out[k]?.length ?? 0])
    ));

    return out;
  }

  console.warn('[TS normalize] could not classify payload -> returning empty perModal');
  return out;
}



// function insertModal(modalIndex, receivedData) {
//   const template = document.getElementById('TS_Modal_Template');
//   if (!template) {
//     console.error('Template not found');
//     return;
//   }

//   const clone = document.importNode(template.content, true);

//   // Assign unique IDs to the cloned elements (nur Indizes ergÃ¤nzt)
//   const elementsToUpdate = [
//     // Root hilft beim Scoping pro Instanz
//     { selector: '.table-content', id: `tsRoot_${modalIndex}` },

//     // âœ… Toolbox & Toggle mit Index
//     { selector: '#tsTools', id: `tsTools_${modalIndex}` },
//     { selector: '#tsToolsToggle', id: `tsToolsToggle_${modalIndex}` },

//     { selector: '#checkboxContainer', id: `checkboxContainer_${modalIndex}` },
//     { selector: '#loadButton', id: `loadButton_${modalIndex}` },
//     { selector: '#TSDataContainer', id: `TSDataContainer_${modalIndex}` },
//     { selector: '#TSlineChart', id: `TSlineChart_${modalIndex}` },
//     { selector: '#oneYearButton', id: `oneYearButton_${modalIndex}` },
//     { selector: '#fiveYearButton', id: `fiveYearButton_${modalIndex}` },
//     { selector: '#tenYearButton', id: `tenYearButton_${modalIndex}` },
//     { selector: '#maxButton', id: `maxButton_${modalIndex}` },
//     { selector: '#normalizationTypeSelector', id: `normalizationTypeSelector_${modalIndex}` },
//     { selector: '#applySMA1', id: `applySMA1_${modalIndex}` },
//     { selector: '#movingAveragePeriod1', id: `movingAveragePeriod1_${modalIndex}` },
//     { selector: '#applySMA2', id: `applySMA2_${modalIndex}` },
//     { selector: '#movingAveragePeriod2', id: `movingAveragePeriod2_${modalIndex}` },
//     { selector: '#applySMA3', id: `applySMA3_${modalIndex}` },
//     { selector: '#movingAveragePeriod3', id: `movingAveragePeriod3_${modalIndex}` }
//   ];

//   elementsToUpdate.forEach(({ selector, id }) => {
//     const element = clone.querySelector(selector);
//     if (element) {
//       element.id = id;
//     } else {
//       console.warn(`Element with selector '${selector}' not found in the template.`);
//     }
//   });

//   // Append the cloned modal to the modal-content-container inside TS_Modal
//   const modalContentContainer = document.getElementById('modal-content-container');
//   if (modalContentContainer) {
//     modalContentContainer.appendChild(clone);
//   } else {
//     console.error('modal-content-container not found in the DOM.');
//     return;
//   }

//   // Call handleTSData for this modal and pass the modal index and received data
//   handleTSData(receivedData, modalIndex);
// }
function insertModal(modalIndex, receivedData) {
  const template = document.getElementById('TS_Modal_Template');
  if (!template) {
    console.error('Template not found');
    return;
  }

  // âœ… 1) Pro Modal die richtigen Daten herausziehen (unterstÃ¼tzt mehrere Payload-Formen)
  const dataForThisModal =
    // Fall: receivedData = [ [rowsModal1], [rowsModal2], ... ]
    (Array.isArray(receivedData) && Array.isArray(receivedData[0]))
      ? (receivedData[modalIndex - 1] || [])
      : (
        // Fall: receivedData = {1: rows1, 2: rows2, 3: rows3, 4: rows4}
        (receivedData && typeof receivedData === 'object' && !Array.isArray(receivedData) &&
          (receivedData[modalIndex] || receivedData[String(modalIndex)]))
          ? (receivedData[modalIndex] || receivedData[String(modalIndex)])
          // Fall: receivedData = rows[]
          : receivedData
      );

  const clone = document.importNode(template.content, true);

  // âœ… 2) IDs pro Instanz eindeutig machen
  const elementsToUpdate = [
    { selector: '.table-content', id: `tsRoot_${modalIndex}` },

    { selector: '#tsTools',         id: `tsTools_${modalIndex}` },
    { selector: '#tsToolsToggle',   id: `tsToolsToggle_${modalIndex}` },
    { selector: '#tsEnlargeToggle', id: `tsEnlargeToggle_${modalIndex}` },

    { selector: '#checkboxContainer', id: `checkboxContainer_${modalIndex}` },
    { selector: '#loadButton',        id: `loadButton_${modalIndex}` },
    { selector: '#TSDataContainer',   id: `TSDataContainer_${modalIndex}` },
    { selector: '#TSlineChart',       id: `TSlineChart_${modalIndex}` },

    { selector: '#oneYearButton',     id: `oneYearButton_${modalIndex}` },
    { selector: '#fiveYearButton',    id: `fiveYearButton_${modalIndex}` },
    { selector: '#tenYearButton',     id: `tenYearButton_${modalIndex}` },
    { selector: '#maxButton',         id: `maxButton_${modalIndex}` },
    { selector: '#resetZoomButton',   id: `resetZoomButton_${modalIndex}` },

    { selector: '#normalizationTypeSelector', id: `normalizationTypeSelector_${modalIndex}` },
    { selector: '#logScale',                  id: `logScale_${modalIndex}` },

    { selector: '#applySMA1',           id: `applySMA1_${modalIndex}` },
    { selector: '#movingAveragePeriod1', id: `movingAveragePeriod1_${modalIndex}` },
    { selector: '#applySMA2',           id: `applySMA2_${modalIndex}` },
    { selector: '#movingAveragePeriod2', id: `movingAveragePeriod2_${modalIndex}` },
    { selector: '#applySMA3',           id: `applySMA3_${modalIndex}` },
    { selector: '#movingAveragePeriod3', id: `movingAveragePeriod3_${modalIndex}` },

    // âœ… Optional, aber wichtig falls du es in handleTSData verwendest:
    // { selector: '#showDailyVolatility', id: `showDailyVolatility_${modalIndex}` },

    // âœ… Optional, falls Targets pro Modal sein sollen:
    // { selector: '#targetCheckboxContainer', id: `targetCheckboxContainer_${modalIndex}` },
  ];

  elementsToUpdate.forEach(({ selector, id }) => {
    const element = clone.querySelector(selector);
    if (element) element.id = id;
    else console.warn(`Element with selector '${selector}' not found in the template.`);
  });

  // âœ… 3) In DOM einhÃ¤ngen
  const modalContentContainer = document.getElementById('modal-content-container');
  if (!modalContentContainer) {
    console.error('modal-content-container not found in the DOM.');
    return;
  }
  modalContentContainer.appendChild(clone);

  // âœ… 4) Daten an dieses Modal binden (nach dem Append!)
  Promise.resolve(handleTSData(dataForThisModal, modalIndex))
    .catch(err => console.error(`handleTSData failed for modal ${modalIndex}`, err));
}



// ---- TS Tools Toggle (Historic Data) -------------------------------
const TS_TOOLS_STATE_KEY = 'tsToolsCollapsed';

// Header mit Tools-Button einfÃ¼gen, falls nicht vorhanden
function ensureTsToolsHeader() {
  // In deinem Template ist der Header schon drin.
  // Falls du Ã¤ltere Strukturen hast, hier nur minimaler Guard:
  const panel = document.getElementById('panel-ts');
  if (!panel) return;
  const anyHeader = panel.querySelector('.ts-tools-header, .tools-header');
  if (anyHeader) return; // nichts einfÃ¼gen, alles vorhanden
}

// State anwenden (klappen ein/aus) - optionaler root fÃ¼r pro-Instanz Toggle
function applyTsToolsState(collapsed, rootEl) {
  if (rootEl) {
    rootEl.classList.toggle('tools-collapsed', !!collapsed);
    return;
  }
  // Fallback: auf alle tsRoot_* anwenden (kompatibel zu altem Aufruf)
  document
    .querySelectorAll('#panel-ts .table-content')
    .forEach(el => el.classList.toggle('tools-collapsed', !!collapsed));
}

// Click-Delegation fÃ¼r den Toggle (mit Index-UnterstÃ¼tzung)
function wireTsToggle() {
  const root = document.getElementById('panel-ts');
  if (!root || root.__tsToggleWired) return;
  root.__tsToggleWired = true;

  const closeAllTsDrawers = () => {
    root.querySelectorAll('.ts-tools.column-drawer.is-open')
      .forEach(d => d.classList.remove('is-open'));
  };

  root.addEventListener('click', (e) => {
    // Öffnen: 🔑-Button einer Section öffnet DEREN Tools-Drawer (rechts, Overlay).
    const btn = e.target.closest('[id^="tsToolsToggle_"]');
    if (btn) {
      const instanceRoot = btn.closest('.table-content');
      const drawer = instanceRoot?.querySelector('.ts-tools.column-drawer');
      if (drawer) {
        const wasOpen = drawer.classList.contains('is-open');
        closeAllTsDrawers();            // fixed rechts -> immer nur einer offen
        if (!wasOpen) drawer.classList.add('is-open');
      }
      return;
    }
    // Vergrößern: ⛶-Button zieht seine Section auf volle Breite (Toggle).
    const enlargeBtn = e.target.closest('[id^="tsEnlargeToggle_"]');
    if (enlargeBtn) {
      const instanceRoot = enlargeBtn.closest('.table-content');
      if (instanceRoot) {
        instanceRoot.classList.toggle('is-enlarged');
        const idx = enlargeBtn.id.replace('tsEnlargeToggle_', '');
        // Chart nach der Layout-Änderung neu vermessen.
        requestAnimationFrame(() => { try { chartInstances[idx]?.resize(); } catch {} });
      }
      return;
    }
    // Schließen: Close-Button (×) im Drawer.
    if (e.target.closest('[data-col-drawer-close]')) {
      const drawer = e.target.closest('.ts-tools.column-drawer');
      if (drawer) drawer.classList.remove('is-open');
    }
  });

  // Escape schließt offene TS-Drawer.
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeAllTsDrawers();
  });
}

// Zeichnet die TS-Charts automatisch. KEIN Sichtbarkeits-Guard mehr: der Report-Warmup
// (createTSModals -> scheduleTsAutoDraw) muss die Charts auch bei verstecktem Panel aus
// dem Store materialisieren (analog IR/Swaption). Gestaffelt (blockiert das Öffnen
// nicht); bereits gezeichnete Sections werden übersprungen (Zoom/Zustand bleibt).
function scheduleTsAutoDraw() {
  const panel = document.getElementById('panel-ts');
  if (!panel) return;
  requestAnimationFrame(() => {
    const btns = document.querySelectorAll('#panel-ts [id^="loadButton_"]');
    btns.forEach((btn, i) => {
      const idx = btn.id.replace('loadButton_', '');
      const canvas = document.getElementById(`TSlineChart_${idx}`);
      const alreadyDrawn = typeof Chart !== 'undefined' && canvas && Chart.getChart(canvas);
      if (alreadyDrawn) return;
      setTimeout(() => { try { btn.click(); } catch (_) {} }, i * 80);
    });
  });
}

export function observePanelTsOpen() {
  const panel = document.getElementById('panel-ts');
  if (!panel) return;

  const run = () => {
    ensureTsToolsHeader();
    wireTsToggle();
    // Tools sind jetzt ein rechter Overlay-Drawer -> beim Öffnen des Panels
    // sind alle Drawer standardmäßig geschlossen (kein .is-open).

    // Initiale Anzeige: Charts automatisch zeichnen (sichtbares Panel).
    scheduleTsAutoDraw();
  };

  // Einmal direkt probieren (falls schon offen/gebaut)
  run();

  // Beobachte AttributÃ¤nderungen (z.B. wenn Slide-in geÃ¶ffnet wird)
  new MutationObserver((recs) => {
    for (const r of recs) {
      if (r.type === 'attributes' && r.attributeName === 'hidden') {
        if (!panel.hidden) {
          requestAnimationFrame(run);
        }
      }
    }
  }).observe(panel, { attributes: true });
}






export function loadTrendlines(modalIndex, chartName) {
  return new Promise((resolve) => {
    const requestId = `load_${modalIndex}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const okCh  = `ts-trendlines:load-success:${requestId}`;
    const errCh = `ts-trendlines:load-error:${requestId}`;

    //console.log(`[TS-TL][LOAD->SEND] req=${requestId} modal_index=${modalIndex} chart_name=${chartName}`);

    // â¬‡ï¸ WICHTIG: nur EIN Argument (payload)
    window.api.once(okCh, (payload) => {
      //console.log('[TS-TL][LOAD<-RAW]', payload);
      const lines = Array.isArray(payload?.lines) ? payload.lines : [];
      console.log(`[TS-TL][LOAD<-OK] req=${requestId} | lines.count=${lines.length} | sample=${lines.length ? JSON.stringify(lines[0]) : 'null'}`);
      resolve(lines);
    });

    // â¬‡ï¸ hier auch nur EIN Argument (msg)
    window.api.once(errCh, (msg) => {
      console.warn(`[TS-TL][LOAD<-ERR] req=${requestId} | ${msg}`);
      resolve([]);
    });

    window.api.send('ts-trendlines:load', {
      requestId,
      customer_id: getCurrentCustomerId(),
      modal_index: Number(modalIndex),
      chart_name: chartName
    });
  });
}






export function saveTrendlines(modalIndex, chartName, lines) {
  return new Promise((resolve) => {
    const requestId = `save_${modalIndex}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    console.log(
      `[TS-TL][SAVE->SEND] req=%s modal_index=%s chart_name=%s lines.count=%d sample=%o`,
      requestId, Number(modalIndex), chartName, Array.isArray(lines) ? lines.length : -1, lines?.[0] ?? null
    );

    window.api.once(`ts-trendlines:save-success:${requestId}`, () => {
      console.log(`[TS-TL][SAVE<-OK] req=%s`, requestId);
      resolve(true);
    });
    window.api.once(`ts-trendlines:save-error:${requestId}`, (_e, msg) => {
      console.warn(`[TS-TL][SAVE<-ERR] req=%s msg=%s`, requestId, msg);
      resolve(false);
    });

    window.api.send('ts-trendlines:save', {
      requestId,
      customer_id: getCurrentCustomerId(),
      modal_index: Number(modalIndex),
      chart_name: chartName,
      lines: Array.isArray(lines) ? lines : []
    });
  });
}








