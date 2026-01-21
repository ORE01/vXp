import { filterColumnsInData } from '../../../MODAL_HELPER/dataProcessor.js';
import processData from '../../../MODAL_HELPER/dataProcessor.js';
import createBarChart from '../../../charts/BarChart.js';
import { formatNumber, isValidNumber, formatNumberWithCommas } from '../../../utils/format.js';

// === Modul-Scope ===
let LGDChart = null;
// dient als Cache für EAD/LDG-Daten des aktuellen Portfolios
let filteredEADMainData = [];


export function handleEADData(receivedData) {
  const port_name = appState.getSelectedPortTableName(); // z. B. "UNI"
  const EADDataContainer = document.getElementById('EADDataContainer');

  if (!Array.isArray(receivedData) || receivedData.length === 0) {
    console.warn('handleEADData: keine EAD-Daten erhalten');
    if (EADDataContainer) {
      EADDataContainer.innerHTML = '<p>No EAD data available.</p>';
    }
    filteredEADMainData = [];
    try {
      if (LGDChart) {
        LGDChart.destroy();
        LGDChart = null;
      }
    } catch (err) {
      console.error('handleEADData: Fehler beim Destroy von LGDChart:', err);
    }
    return;
  }

  if (!EADDataContainer) {
    console.warn('handleEADData: EADDataContainer nicht gefunden');
    return;
  }

  // 🔍 Daten vorher filtern: aktuelles Portfolio + PD-Flag RATING
  const filtered = receivedData.filter(
    row => row.port_name === port_name && row.pd_flag === 'RATING'
  );

  if (filtered.length === 0) {
    //console.warn('handleEADData: keine passenden EAD-Zeilen für', port_name);
    EADDataContainer.innerHTML = '<p>No EAD data for selected portfolio.</p>';
    filteredEADMainData = [];
    try {
      if (LGDChart) {
        LGDChart.destroy();
        LGDChart = null;
      }
    } catch (err) {
      console.error('handleEADData: Fehler beim Destroy von LGDChart:', err);
    }
    return;
  }

  // Relevante Spalten
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

  // Nur relevante Spalten behalten
  filteredEADMainData = filterColumnsInData(filtered, columns);

  // Nach NOTIONAL (numerisch) desc sortieren
  filteredEADMainData.sort(
    (a, b) =>
      parseFloat((b.NOTIONAL || '0').toString().replace(/\s/g, '')) -
      parseFloat((a.NOTIONAL || '0').toString().replace(/\s/g, ''))
  );

  // Tabelle rendern
  const EADMainDataHTML = processData(filteredEADMainData, 'EAD', eadColumnLabelMap);
  EADDataContainer.innerHTML = EADMainDataHTML;

  // 🔁 Direkt nach Daten-Update: Chart zeichnen
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

  // EAD (NOTIONAL) → Zahl
  const EADValues = filteredEADMainData.map(row => {
    const raw = (row.NOTIONAL || '').toString().replace(/\s/g, '');
    const v = parseFloat(raw);
    return isNaN(v) ? 0 : v;
  });

  // LGD → Zahl
  const LGDValues = filteredEADMainData.map(row => {
    const raw = (row.LGD || '').toString().replace(/\s/g, '');
    const v = parseFloat(raw);
    return isNaN(v) ? 0 : v;
  });

  // alten Chart zerstören
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

export function handleCVaRData(receivedData, index) {
  const port_name = appState.getSelectedPortTableName();
  const filteredByPort = Array.isArray(receivedData)
    ? receivedData.filter(item => item.port_name === port_name)
    : [];

  appState.setCvarData(filteredByPort);

  const containerMapping = {
    rating: 'CVaR_ratingDataContainer',
    market: 'CVaR_marketDataContainer',
    norm: 'CVaR_normDataContainer',
  };

  const combinedRelData = {};

  Object.keys(containerMapping).forEach(pd_flag => {
    const filteredData = filteredByPort.filter(
      item => item.pd_flag && item.pd_flag.toLowerCase() === pd_flag
    );

    const containerId = containerMapping[pd_flag];
    const container = document.getElementById(containerId);

    if (container && filteredData.length > 0) {
      populateCVaRTable(container, filteredData, port_name);
      combinedRelData[pd_flag] = filteredData;
    } else if (container) {
      container.innerHTML = '<p>No data available</p>';
    }
  });

  // Kombinierte Übersicht (VaR_rel)
  renderCombinedCVaRRelTable(combinedRelData, index);


}

function populateCVaRTable(container, CVaRData, port_name) {
  if (!CVaRData || CVaRData.length === 0) {
    console.warn('⚠️ No CVaR data available.');
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

  // ✅ WICHTIG: Container als Section für Checkboxen markieren
  container.classList.add('sub-panel'); // <<< DAS ist der Schlüssel
  container.dataset.panelTitle = 'Credit Risk – Traffic Lights';

  // 🔍 Defensive: wenn kein Objekt, einfach leeren und raus
  if (
    !allFilteredDataByPdFlag ||
    typeof allFilteredDataByPdFlag !== 'object' ||
    Object.keys(allFilteredDataByPdFlag).length === 0
  ) {
    container.innerHTML = '';
    return;
  }

  // Prüfen, ob überhaupt sinnvolle Daten vorhanden sind
  const hasValidData = Object.values(allFilteredDataByPdFlag).some(
    data => Array.isArray(data) && data[0] && data[0].VaR_rel !== undefined
  );

  // Container immer zuerst leeren
  container.innerHTML = '';

  if (!hasValidData) return;

  // 🔹 Tabelle neu anlegen
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

  // ─────────────────────────────────────
  // 🔴🟡🟢 Traffic Lights setzen (UI + PDF)
  // ─────────────────────────────────────

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

  //console.log('getCvarInputThreshold("CVaR") →', thrRaw);

  if (!thrRaw) {
    console.warn('⚠️ CVaR-Thresholds: getCvarInputThreshold gibt null/undefined zurück');
    return null;
  }

  // 2) Falls Array → passende Zeile nach metric = "CVaR" suchen
  let thrObj;

  if (Array.isArray(thrRaw)) {
    thrObj = thrRaw.find(r => r.metric === 'CVaR') || thrRaw[0];
  } else {
    thrObj = thrRaw;
  }

  if (!thrObj) {
    console.warn('⚠️ CVaR-Thresholds: Kein Eintrag für metric="CVaR" gefunden:', thrRaw);
    return null;
  }

  let YELLOW = Number(thrObj.yellow_threshold);
  let RED    = Number(thrObj.red_threshold);

  // console.log('Rohe Thresholds aus DB (CVaR-Zeile):', {
  //   rawYellow: YELLOW,
  //   rawRed: RED,
  // });

  if (!Number.isFinite(YELLOW) || !Number.isFinite(RED)) {
    console.warn('⚠️ CVaR-Thresholds sind keine gültigen Zahlen:', thrObj);
    return null;
  }

  // 3) Einheit normalisieren:
  // - Deine neue DB-Konvention: -0.05, -0.2 etc. → already fractions → bleiben so.
  // - Falls irgendwo noch alte Werte wie -5 / -20 drin sind → in Brüche umrechnen.
  if (Math.abs(YELLOW) > 1 || Math.abs(RED) > 1) {
    YELLOW = YELLOW / 100;
    RED    = RED / 100;
  }

  // Beträge verwenden (weil Verlustseite negativ)
  YELLOW = Math.abs(YELLOW);
  RED    = Math.abs(RED);

  //console.log('Normierte Thresholds (Brüche, Betrag):', { YELLOW, RED });

  // 4) Daten für aktuelles Flag holen
  const key = (flag === 'Historic') ? 'rating' : flag;
  const arr = allFilteredDataByPdFlag[key];

  if (!Array.isArray(arr) || !arr.length) return null;

  const row = arr[0];
  if (!row || row.VaR_rel == null) return null;

  const raw = Number(row.VaR_rel);
  if (!isFinite(raw)) return null;

  // VaR_rel ist bei Verlusten negativ → Betrag
  const lossLevel = Math.abs(raw);   // z.B. -0.0552 → 0.0552 = 5.52 %

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

  //console.log('getCvarInputThreshold("MSD") →', thrRaw);

  if (!thrRaw) {
    console.warn('⚠️ MSD-Thresholds: getCvarInputThreshold gibt null/undefined zurück');
    return null;
  }

  // 2) Falls Array → passende Zeile nach metric = "MSD" suchen
  let thrObj;

  if (Array.isArray(thrRaw)) {
    thrObj = thrRaw.find(r => r.metric === 'MSD') || thrRaw[0];
  } else {
    thrObj = thrRaw;
  }

  if (!thrObj) {
    console.warn('⚠️ MSD-Thresholds: Kein Eintrag für metric="MSD" gefunden:', thrRaw);
    return null;
  }

  let YELLOW = Number(thrObj.yellow_threshold);
  let RED    = Number(thrObj.red_threshold);

  // console.log('Rohe MSD-Thresholds aus DB:', {
  //   rawYellow: YELLOW,
  //   rawRed: RED,
  // });

  if (!Number.isFinite(YELLOW) || !Number.isFinite(RED)) {
    console.warn('⚠️ MSD-Thresholds sind keine gültigen Zahlen:', thrObj);
    return null;
  }

  // 3) Einheit normalisieren:
  // Neue Konvention: 0.01, 0.02 etc. → bereits Brüche.
  // Falls mal alte Werte 1 / 2 oder 10 / 20 drin sind → in Brüche umrechnen.
  if (Math.abs(YELLOW) > 1 || Math.abs(RED) > 1) {
    YELLOW = YELLOW / 100;
    RED    = RED / 100;
  }

  // Ab jetzt arbeiten wir mit positiven Schwellen (Betrag)
  YELLOW = Math.abs(YELLOW);
  RED    = Math.abs(RED);

  //console.log('Normierte MSD-Thresholds (Brüche, Betrag):', { YELLOW, RED });

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
    console.warn('⚠️ Kein passender ES-Key in rating/norm gefunden (MSD)');
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
  // |diffRel| >= RED    → rot
  // |diffRel| >= YELLOW → gelb
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

  //console.log('getCvarInputThreshold("TSI") →', thrRaw);

  if (!thrRaw) {
    console.warn('⚠️ TSI-Thresholds: getCvarInputThreshold gibt null/undefined zurück');
    return null;
  }

  // 2) Falls Array → passende Zeile nach metric = "TSI" suchen
  let thrObj;

  if (Array.isArray(thrRaw)) {
    thrObj = thrRaw.find(r => r.metric === 'TSI') || thrRaw[0];
  } else {
    thrObj = thrRaw;
  }

  if (!thrObj) {
    console.warn('⚠️ TSI-Thresholds: Kein Eintrag für metric="TSI" gefunden:', thrRaw);
    return null;
  }

  let YELLOW = Number(thrObj.yellow_threshold);
  let RED    = Number(thrObj.red_threshold);

  // console.log('Rohe TSI-Thresholds aus DB:', {
  //   rawYellow: YELLOW,
  //   rawRed: RED,
  // });

  if (!Number.isFinite(YELLOW) || !Number.isFinite(RED)) {
    console.warn('⚠️ TSI-Thresholds sind keine gültigen Zahlen:', thrObj);
    return null;
  }

  // 3) Einheit normalisieren:
  // Neue Konvention: 0.01, 0.02 etc. → bereits Brüche (Prozentpunkte).
  // Alte Werte 1 / 2 / 10 / 20 → in Brüche umrechnen.
  if (Math.abs(YELLOW) > 1 || Math.abs(RED) > 1) {
    YELLOW = YELLOW / 100;
    RED    = RED / 100;
  }

  // Ab jetzt mit positiven Schwellen (Betrag in Prozentpunkten)
  YELLOW = Math.abs(YELLOW);
  RED    = Math.abs(RED);

  //console.log('Normierte TSI-Thresholds (Brüche, Betrag):', { YELLOW, RED });

  // 4) Wir schauen nur auf "rating"
  const ratingArr = allFilteredDataByPdFlag['rating'];
  if (!Array.isArray(ratingArr) || !ratingArr.length) return null;

  const row = ratingArr[0];
  if (!row || typeof row !== 'object') return null;

  // Feldnamen – nur relative Größen
  const esCandidates  = ['ES_rel', 'es_rel'];
  const varCandidates = ['VaR_rel', 'var_rel'];

  const findKey = (r, candidates) =>
    candidates.find(k => k in r);

  const esKey  = findKey(row, esCandidates);
  const varKey = findKey(row, varCandidates);

  if (!esKey || !varKey) {
    console.warn('⚠️ Kein ES_rel-/VaR_rel-Key für rating gefunden (TSI).');
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
  // |TSI_diff| >= RED    → rot
  // |TSI_diff| >= YELLOW → gelb
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

    // etwas Layout, damit es im Preview nicht “fliegt”
    panel.style.marginTop = '12px';
    panel.style.padding = '10px';
    panel.style.border = '1px solid rgba(255,255,255,.12)';
    panel.style.borderRadius = '10px';

    host.appendChild(panel);
  }
  return panel;
}


export { filteredEADMainData };


