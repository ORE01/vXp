import { filterColumnsInData } from '../../../core/ui/modal/modalData.js';
import processData from '../../../core/ui/modal/modalData.js';

import createBarChart from '../../../charts/BarChart.js';

import { formatNumber, isValidNumber, formatNumberWithCommas } from '../../../utils/tableCellFormats.js';
import { updateTrafficLight } from '../../../utils/trafficLight.js';




// === Modul-Scope ===
let LGDChart = null;
// dient als Cache fÃ¼r EAD/LDG-Daten des aktuellen Portfolios
let filteredEADMainData = [];


export function handleEADData(receivedData) {
  const port_name = appState.getSelectedPortTableName(); 

  // âœ… If no portfolio selected: do nothing (no DOM, no chart, no warnings)
  if (!port_name) return;

  const EADDataContainer = document.getElementById('EADDataContainer');
  if (!EADDataContainer) return;

  // If payload missing/empty: clear UI + reset chart (quietly)
  if (!Array.isArray(receivedData) || receivedData.length === 0) {
    EADDataContainer.innerHTML = '';
    filteredEADMainData = [];
    try {
      if (LGDChart) {
        LGDChart.destroy();
        LGDChart = null;
      }
    } catch {}
    return;
  }

  // Filter: current portfolio + PD-Flag RATING
  const filtered = receivedData.filter(
    row => row && row.port_name === port_name && row.pd_flag === 'RATING'
  );

  if (filtered.length === 0) {
    EADDataContainer.innerHTML = '';
    filteredEADMainData = [];
    try {
      if (LGDChart) {
        LGDChart.destroy();
        LGDChart = null;
      }
    } catch {}
    return;
  }

  // Relevant columns
  const columns = ['ISSUER', 'RANK', 'RATING', 'NOTIONAL', 'LGD', 'PD', 'PD_M', 'PD_M_norm'];
  const eadColumnLabelMap = {
    ISSUER: 'ISSUER',
    RANK: 'RANK',
    RATING: 'RATING',
    NOTIONAL: 'NOTIONAL',
    LGD: 'LGD',
    PD: 'PD-Historic',
    PD_M: 'PD-Market Implied',
    PD_M_norm: 'PD-Risk Adjusted',
  };

  filteredEADMainData = filterColumnsInData(filtered, columns);

  // Sort by NOTIONAL (numeric) desc
  filteredEADMainData.sort(
    (a, b) =>
      parseFloat((b.NOTIONAL || '0').toString().replace(/\s/g, '')) -
      parseFloat((a.NOTIONAL || '0').toString().replace(/\s/g, ''))
  );

  // Render table
  const EADMainDataHTML = processData(filteredEADMainData, 'EAD', eadColumnLabelMap);
  EADDataContainer.innerHTML = EADMainDataHTML;

  // Render chart after update
  renderLGDChart();
}


export function renderLGDChart() {
  if (!filteredEADMainData || filteredEADMainData.length === 0) {
    console.warn('renderLGDChart: keine Daten in filteredEADMainData');
    return;
  }

  const canvasId = 'LGDChart';
  const canvas = document.getElementById(canvasId);

  if (!canvas) {
    console.warn(`renderLGDChart: Canvas mit ID ${canvasId} nicht gefunden`);
    return;
  }

  // Labels = Issuer
  const labels = filteredEADMainData.map(row => row.ISSUER);

  // EAD (NOTIONAL) â†’ Zahl
  const EADValues = filteredEADMainData.map(row => {
    const raw = (row.NOTIONAL || '').toString().replace(/\s/g, '');
    const v = parseFloat(raw);
    return isNaN(v) ? 0 : v;
  });

  // LGD â†’ Zahl
  const LGDValues = filteredEADMainData.map(row => {
    const raw = (row.LGD || '').toString().replace(/\s/g, '');
    const v = parseFloat(raw);
    return isNaN(v) ? 0 : v;
  });

  // alten Chart zerstÃ¶ren
  if (LGDChart) {
    try {
      LGDChart.destroy();
    } catch (err) {
      console.error('renderLGDChart: Fehler beim Destroy von LGDChart:', err);
    }
    LGDChart = null;
  }

  const datasets = [
    {
      label: 'EAD',
      data: EADValues,
      backgroundColor: 'rgba(70, 192, 230, 0.7)',
      borderColor: 'rgba(70, 192, 230, 0.7)',
      borderWidth: 1,
    },
    {
      label: 'LGD',
      data: LGDValues,
      backgroundColor: 'rgba(255, 0, 0, 0.7)',
      borderColor: 'rgba(255, 0, 0, 1)',
      borderWidth: 1,
    },
  ];

  LGDChart = createBarChart(
    { labels, datasets },
    canvasId,
    'bar',
    'y'
  );
}

// export function handleCVaRData(receivedData, index) {
//   const port_name = appState.getSelectedPortTableName();

//   // âœ… If no portfolio selected: do nothing (no state write, no DOM changes)
//   if (!port_name) return;

//   const filteredByPort = Array.isArray(receivedData)
//     ? receivedData.filter(item => item && item.port_name === port_name)
//     : [];

//   appState.setCvarData(filteredByPort);

//   const containerMapping = {
//     rating: 'CVaR_ratingDataContainer',
//     market: 'CVaR_marketDataContainer',
//     norm: 'CVaR_normDataContainer',
//   };

//   const combinedRelData = {};

//   Object.keys(containerMapping).forEach(pd_flag => {
//     const filteredData = filteredByPort.filter(
//       item => item.pd_flag && item.pd_flag.toLowerCase() === pd_flag
//     );

//     const containerId = containerMapping[pd_flag];
//     const container = document.getElementById(containerId);

//     if (!container) return;

//     if (filteredData.length > 0) {
//       populateCVaRTable(container, filteredData, port_name);
//       combinedRelData[pd_flag] = filteredData;
//     } else {
//       // âœ… keep UI quiet; just clear (no "No data available" noise during normal startup)
//       container.innerHTML = '';
//     }
//   });

//   // Combined overview (VaR_rel)
//   renderCombinedCVaRRelTable(combinedRelData, index);
// }
export function handleCVaRData(receivedData, index, port_nameArg) {
  const safeIndex = Number.isFinite(index) ? index : 0;

  // Slot → port_name (wie bei MVaR: panel-lokal)
  const dd = document.getElementById(`createdPortDropdown${safeIndex}`);
  const port_name = String(port_nameArg ?? dd?.value ?? '').trim();

  // Wenn Slot nichts selected hat: ruhig bleiben
  if (!port_name) return;

  // Optional: stale-guard (verhindert "alte Response überschreibt neuen Slot")
  const current = String(dd?.value ?? '').trim();
  if (current && current !== port_name) return;

  const filteredByPort = Array.isArray(receivedData)
    ? receivedData.filter(item => item && String(item.port_name) === port_name)
    : [];

  appState.setCvarData?.(filteredByPort);

  // Nur Combined-Overview (slot-spezifisch!) – das ist stabil, weil ContainerId index-basiert ist
  const combinedRelData = {
    rating: filteredByPort.filter(x => String(x?.pd_flag ?? '').toLowerCase() === 'rating'),
    market: filteredByPort.filter(x => String(x?.pd_flag ?? '').toLowerCase() === 'market'),
    norm:   filteredByPort.filter(x => String(x?.pd_flag ?? '').toLowerCase() === 'norm'),
  };

  console.log('combinedRelData:', combinedRelData)

  renderCombinedCVaRRelTable(combinedRelData, safeIndex);
}




function populateCVaRTable(container, CVaRData, port_name) {
  if (!CVaRData || CVaRData.length === 0) {
    console.warn('âš ï¸ No CVaR data available.');
    container.innerHTML = '<p>No data available</p>';
    return;
  }

  const row0 = CVaRData[0];

  // Create a new table
  const table = document.createElement('table');
  table.border = '1'; // Add border for visibility

  // Create table headers
  const headers = [`Metric for ${port_name}`, 'Absolute', 'Relative'];
  const headerRow = table.insertRow();
  headers.forEach(headerText => {
    const cell = headerRow.insertCell();
    cell.textContent = headerText;
    cell.style.fontWeight = 'bold'; // Make headers bold
  });

  // Process and insert data rows
  const metrics = [
    { label: 'VaR', absKey: 'VaR_abs', relKey: 'VaR_rel' },
    { label: 'ES', absKey: 'ES_abs', relKey: 'ES_rel' },
  ];

  metrics.forEach(metric => {
    const row = table.insertRow();
    row.insertCell().textContent = metric.label; // First column: Metric name

    const absVal = row0[metric.absKey];
    const relVal = row0[metric.relKey];

    row.insertCell().textContent =
      absVal !== undefined ? formatNumber(0)(absVal) : 'N/A';
    row.insertCell().textContent = formatPercentage(relVal);
  });

  // Clear previous content and append the new table
  container.innerHTML = '';
  container.appendChild(table);
}

function formatPercentage(value) {
  if (value === undefined || value === null || isNaN(value)) return 'N/A';
  return (Number(value) * 100).toFixed(2) + '%';
}

function renderCombinedCVaRRelTable(allFilteredDataByPdFlag, index) {
  const containerId = `CVaR_allRelativeContainer${index}`;
  const container   = document.getElementById(containerId);
  if (!container) return;


  container.dataset.panelTitle = 'Credit Risk / Traffic Lights';

  
  if (
    !allFilteredDataByPdFlag ||
    typeof allFilteredDataByPdFlag !== 'object' ||
    Object.keys(allFilteredDataByPdFlag).length === 0
  ) {
    container.innerHTML = '';
    return;
  }

  
  const hasValidData = Object.values(allFilteredDataByPdFlag).some(
    data => Array.isArray(data) && data[0] && data[0].VaR_rel !== undefined
  );

  // Container immer zuerst leeren
  container.innerHTML = '';

  if (!hasValidData) return;

  // Tabelle neu anlegen
  const table = document.createElement('table');
  table.classList.add('CVaRTable');

  const headerRow = table.insertRow();
  ['label', 'value'].forEach(text => {
    const cell = headerRow.insertCell();
    cell.textContent = text;
  });

  // Welche pd_flags zeigen wir an?
  const allowedPdFlags = ['rating', 'market', 'norm'];

  const labelMap = {
    rating: 'Historic',
    market: 'Market Implied',
    norm:   'Risk Adjusted',
  };

  Object.entries(allFilteredDataByPdFlag).forEach(([pd_flag, data]) => {
    if (!Array.isArray(data) || !data.length) return;
    if (allowedPdFlags.length > 0 && !allowedPdFlags.includes(pd_flag)) return;

    const row = data[0];
    if (!row || !('VaR_rel' in row)) return;

    const label  = `${labelMap[pd_flag] || pd_flag} VaR`;
    const rawVal = row.VaR_rel;

    const value =
      typeof rawVal === 'string'
        ? rawVal
        : formatPercentage(rawVal);

    const r = table.insertRow();
    r.insertCell(0).textContent = label;
    r.insertCell(1).textContent = value;
  });

  container.appendChild(table);



  // CVaR
  const stateCvar = trafficLightStateForCvar(allFilteredDataByPdFlag, 'Historic');
  if (stateCvar) {
    const el = document.getElementById('traffic-credit-cvar');
    if (el) el.dataset.status = stateCvar;
    updateTrafficLight('#traffic-credit-cvar', stateCvar);
  }

  // MSD
  const stateMsd = trafficLightStateForMsd(allFilteredDataByPdFlag, allowedPdFlags);
  if (stateMsd) {
    const el = document.getElementById('traffic-credit-msd');
    if (el) el.dataset.status = stateMsd;
    updateTrafficLight('#traffic-credit-msd', stateMsd);
  }

  // TSI
  const stateTsi = trafficLightStateForTsi(allFilteredDataByPdFlag, allowedPdFlags);
  if (stateTsi) {
    const el = document.getElementById('traffic-credit-tsi');
    if (el) el.dataset.status = stateTsi;
    updateTrafficLight('#traffic-credit-tsi', stateTsi);
  }
}




function trafficLightStateForCvar(allFilteredDataByPdFlag, flag) {
  if (!allFilteredDataByPdFlag || typeof allFilteredDataByPdFlag !== 'object') {
    return null;
  }

  // 1) Thresholds aus appState holen (kann Array oder Objekt sein)
  const thrRaw = appState.getCvarInputThreshold
    ? appState.getCvarInputThreshold('CVaR')
    : null;

  //console.log('getCvarInputThreshold("CVaR") â†’', thrRaw);

  if (!thrRaw) {
    console.warn('âš ï¸ CVaR-Thresholds: getCvarInputThreshold gibt null/undefined zurÃ¼ck');
    return null;
  }

  // 2) Falls Array â†’ passende Zeile nach metric = "CVaR" suchen
  let thrObj;

  if (Array.isArray(thrRaw)) {
    thrObj = thrRaw.find(r => r.metric === 'CVaR') || thrRaw[0];
  } else {
    thrObj = thrRaw;
  }

  if (!thrObj) {
    console.warn('âš ï¸ CVaR-Thresholds: Kein Eintrag fÃ¼r metric="CVaR" gefunden:', thrRaw);
    return null;
  }

  let YELLOW = Number(thrObj.yellow_threshold);
  let RED    = Number(thrObj.red_threshold);

  // console.log('Rohe Thresholds aus DB (CVaR-Zeile):', {
  //   rawYellow: YELLOW,
  //   rawRed: RED,
  // });

  if (!Number.isFinite(YELLOW) || !Number.isFinite(RED)) {
    console.warn('âš ï¸ CVaR-Thresholds sind keine gÃ¼ltigen Zahlen:', thrObj);
    return null;
  }

  // 3) Einheit normalisieren:
  // - Deine neue DB-Konvention: -0.05, -0.2 etc. â†’ already fractions â†’ bleiben so.
  // - Falls irgendwo noch alte Werte wie -5 / -20 drin sind â†’ in BrÃ¼che umrechnen.
  if (Math.abs(YELLOW) > 1 || Math.abs(RED) > 1) {
    YELLOW = YELLOW / 100;
    RED    = RED / 100;
  }

  // BetrÃ¤ge verwenden (weil Verlustseite negativ)
  YELLOW = Math.abs(YELLOW);
  RED    = Math.abs(RED);

  //console.log('Normierte Thresholds (BrÃ¼che, Betrag):', { YELLOW, RED });

  // 4) Daten fÃ¼r aktuelles Flag holen
  const key = (flag === 'Historic') ? 'rating' : flag;
  const arr = allFilteredDataByPdFlag[key];

  if (!Array.isArray(arr) || !arr.length) return null;

  const row = arr[0];
  if (!row || row.VaR_rel == null) return null;

  const raw = Number(row.VaR_rel);
  if (!isFinite(raw)) return null;

  // VaR_rel ist bei Verlusten negativ â†’ Betrag
  const lossLevel = Math.abs(raw);   // z.B. -0.0552 â†’ 0.0552 = 5.52 %

  // console.log('CVaR Ampel Check:', {
  //   flag,
  //   VaR_rel_raw: raw,
  //   lossLevel,
  //   YELLOW,
  //   RED
  // });

  if (lossLevel >= RED)    return 'red';
  if (lossLevel >= YELLOW) return 'yellow';
  return 'green';
}
function trafficLightStateForMsd(allFilteredDataByPdFlag, _flags) {
  if (!allFilteredDataByPdFlag || typeof allFilteredDataByPdFlag !== 'object') {
    return null;
  }

  // 1) Thresholds aus appState holen (kann Array oder Objekt sein)
  const thrRaw = appState.getCvarInputThreshold
    ? appState.getCvarInputThreshold('MSD')
    : null;

  //console.log('getCvarInputThreshold("MSD") â†’', thrRaw);

  if (!thrRaw) {
    console.warn('âš ï¸ MSD-Thresholds: getCvarInputThreshold gibt null/undefined zurÃ¼ck');
    return null;
  }

  // 2) Falls Array â†’ passende Zeile nach metric = "MSD" suchen
  let thrObj;

  if (Array.isArray(thrRaw)) {
    thrObj = thrRaw.find(r => r.metric === 'MSD') || thrRaw[0];
  } else {
    thrObj = thrRaw;
  }

  if (!thrObj) {
    console.warn('âš ï¸ MSD-Thresholds: Kein Eintrag fÃ¼r metric="MSD" gefunden:', thrRaw);
    return null;
  }

  let YELLOW = Number(thrObj.yellow_threshold);
  let RED    = Number(thrObj.red_threshold);

  // console.log('Rohe MSD-Thresholds aus DB:', {
  //   rawYellow: YELLOW,
  //   rawRed: RED,
  // });

  if (!Number.isFinite(YELLOW) || !Number.isFinite(RED)) {
    console.warn('âš ï¸ MSD-Thresholds sind keine gÃ¼ltigen Zahlen:', thrObj);
    return null;
  }

  // 3) Einheit normalisieren:
  // Neue Konvention: 0.01, 0.02 etc. â†’ bereits BrÃ¼che.
  // Falls mal alte Werte 1 / 2 oder 10 / 20 drin sind â†’ in BrÃ¼che umrechnen.
  if (Math.abs(YELLOW) > 1 || Math.abs(RED) > 1) {
    YELLOW = YELLOW / 100;
    RED    = RED / 100;
  }

  // Ab jetzt arbeiten wir mit positiven Schwellen (Betrag)
  YELLOW = Math.abs(YELLOW);
  RED    = Math.abs(RED);

  //console.log('Normierte MSD-Thresholds (BrÃ¼che, Betrag):', { YELLOW, RED });

  // 4) rating/norm-Daten holen
  const ratingArr = allFilteredDataByPdFlag['rating'];
  const normArr   = allFilteredDataByPdFlag['norm'];

  if (!Array.isArray(ratingArr) || !ratingArr.length) return null;
  if (!Array.isArray(normArr)   || !normArr.length)   return null;

  const ratingRow = ratingArr[0];
  const normRow   = normArr[0];

  if (!ratingRow || !normRow) return null;

  // Wir verwenden gezielt ES_rel
  const candidateKeys = ['ES_rel'];

  const findKey = (row) =>
    candidateKeys.find(k => k in row);

  const keyRating = findKey(ratingRow);
  const keyNorm   = findKey(normRow);

  if (!keyRating || !keyNorm) {
    console.warn('âš ï¸ Kein passender ES-Key in rating/norm gefunden (MSD)');
    return null;
  }

  const esRating = Number(ratingRow[keyRating]);
  const esNorm   = Number(normRow[keyNorm]);

  if (!Number.isFinite(esRating) || !Number.isFinite(esNorm)) {
    return null;
  }

  // Differenz, z.B. -0.01 = -1%, aber wir vergleichen den Betrag
  const diffRel = esNorm - esRating;
  const valueToCompare = Math.abs(diffRel);

  // console.log('Credit Risk Ampel MSD (ES):', {
  //   esRating,
  //   esNorm,
  //   diffRel,
  //   absDiff: valueToCompare,
  //   YELLOW,
  //   RED
  // });

  // Schwellen sind positiv:
  // Beispiel: YELLOW = 0.01, RED = 0.02
  // |diffRel| >= RED    â†’ rot
  // |diffRel| >= YELLOW â†’ gelb
  if (valueToCompare >= RED)    return 'red';
  if (valueToCompare >= YELLOW) return 'yellow';
  return 'green';
}
function trafficLightStateForTsi(allFilteredDataByPdFlag, _flags) {
  if (!allFilteredDataByPdFlag || typeof allFilteredDataByPdFlag !== 'object') {
    return null;
  }

  // 1) Thresholds aus appState holen (kann Array oder Objekt sein)
  const thrRaw = appState.getCvarInputThreshold
    ? appState.getCvarInputThreshold('TSI')
    : null;

  //console.log('getCvarInputThreshold("TSI") â†’', thrRaw);

  if (!thrRaw) {
    console.warn('âš ï¸ TSI-Thresholds: getCvarInputThreshold gibt null/undefined zurÃ¼ck');
    return null;
  }

  // 2) Falls Array â†’ passende Zeile nach metric = "TSI" suchen
  let thrObj;

  if (Array.isArray(thrRaw)) {
    thrObj = thrRaw.find(r => r.metric === 'TSI') || thrRaw[0];
  } else {
    thrObj = thrRaw;
  }

  if (!thrObj) {
    console.warn('âš ï¸ TSI-Thresholds: Kein Eintrag fÃ¼r metric="TSI" gefunden:', thrRaw);
    return null;
  }

  let YELLOW = Number(thrObj.yellow_threshold);
  let RED    = Number(thrObj.red_threshold);

  // console.log('Rohe TSI-Thresholds aus DB:', {
  //   rawYellow: YELLOW,
  //   rawRed: RED,
  // });

  if (!Number.isFinite(YELLOW) || !Number.isFinite(RED)) {
    console.warn('âš ï¸ TSI-Thresholds sind keine gÃ¼ltigen Zahlen:', thrObj);
    return null;
  }

  // 3) Einheit normalisieren:
  // Neue Konvention: 0.01, 0.02 etc. â†’ bereits BrÃ¼che (Prozentpunkte).
  // Alte Werte 1 / 2 / 10 / 20 â†’ in BrÃ¼che umrechnen.
  if (Math.abs(YELLOW) > 1 || Math.abs(RED) > 1) {
    YELLOW = YELLOW / 100;
    RED    = RED / 100;
  }

  // Ab jetzt mit positiven Schwellen (Betrag in Prozentpunkten)
  YELLOW = Math.abs(YELLOW);
  RED    = Math.abs(RED);

  //console.log('Normierte TSI-Thresholds (BrÃ¼che, Betrag):', { YELLOW, RED });

  // 4) Wir schauen nur auf "rating"
  const ratingArr = allFilteredDataByPdFlag['rating'];
  if (!Array.isArray(ratingArr) || !ratingArr.length) return null;

  const row = ratingArr[0];
  if (!row || typeof row !== 'object') return null;

  // Feldnamen - nur relative GrÃ¶ÃŸen
  const esCandidates  = ['ES_rel', 'es_rel'];
  const varCandidates = ['VaR_rel', 'var_rel'];

  const findKey = (r, candidates) =>
    candidates.find(k => k in r);

  const esKey  = findKey(row, esCandidates);
  const varKey = findKey(row, varCandidates);

  if (!esKey || !varKey) {
    console.warn('âš ï¸ Kein ES_rel-/VaR_rel-Key fÃ¼r rating gefunden (TSI).');
    return null;
  }

  const esVal  = Number(row[esKey]);   // z.B. -0.07
  const varVal = Number(row[varKey]);  // z.B. -0.05

  if (!Number.isFinite(esVal) || !Number.isFinite(varVal)) {
    return null;
  }

  // TSI in Prozentpunkten: Differenz zweier relativer Werte
  // z.B. -0.07 - (-0.05) = -0.02 ( = -2 %-Punkte )
  const tsiDiff = esVal - varVal;
  const valueToCompare = Math.abs(tsiDiff);  // 0.02

  // console.log('TSI (rating, Prozentpunkte):', {
  //   esKey,
  //   varKey,
  //   esVal,
  //   varVal,
  //   tsiDiff,
  //   absDiff: valueToCompare,
  //   YELLOW,
  //   RED
  // });

  // Schwellen sind positiv:
  // |TSI_diff| >= RED    â†’ rot
  // |TSI_diff| >= YELLOW â†’ gelb
  if (valueToCompare >= RED)    return 'red';
  if (valueToCompare >= YELLOW) return 'yellow';
  return 'green';
}


function ensureTrafficPanel({ id, title, hostId = 'CVaR_allRelativeContainer1' /* anpassen */ }) {
  // hostId: wo du den Panel-Block sinnvollerweise andocken willst
  const host = document.getElementById(hostId) || document.body;

  let panel = document.getElementById(id);
  if (!panel) {
    panel = document.createElement('section');
    panel.id = id;

    // WICHTIG: Diese Klasse muss zu deinem discoverPanels() Selector passen
    panel.classList.add('risk-panel');

    // WICHTIG: Title-Attr (oder das, was deine Discovery liest)
    panel.dataset.panelTitle = title;

    // Optional: Key stabil
    panel.dataset.panelKey = id;

    // etwas Layout, damit es im Preview nicht â€œfliegtâ€
    panel.style.marginTop = '12px';
    panel.style.padding = '10px';
    panel.style.border = '1px solid rgba(255,255,255,.12)';
    panel.style.borderRadius = '10px';

    host.appendChild(panel);
  }
  return panel;
}


export { filteredEADMainData };






