import processData from '../../../core/ui/MODAL_HELPER/dataProcessor.js';
import { createRatesLineChart } from '../../../charts/LineChart.js';
import { handleModalAction } from '../../../core/ui/MODAL_HELPER/ModalActionHandler.js';
import { notifyRiskPreview } from '../../REPORTS/RiskPDFPreview.js';


// =====================================================
// INTERNAL STATE
// =====================================================

let IRPanelWaitingForData = false;
let selectedCurrency = 'EUR';
let selectedCurveId = null;
let IRRatesListenerInstalled = false;


// =====================================================
// HELPER
// =====================================================
// function getIRDataForSelectedCurve() {

//   console.log("---- IR PANEL DEBUG ----");
// console.log("selectedCurrency:", selectedCurrency);
// console.log("selectedCurveId:", selectedCurveId);
// console.log("RATES_ACTIVE:", appState.getRatesActive());

//   const raw = appState._RATESDataCacheByCcy?.[selectedCurrency] || [];
//   if (!Array.isArray(raw) || raw.length === 0) {
//     return { IRData: [], curve: null };
//   }

//   // 1) Curve Selection (Dropdown) muss gelten
//   const curves = [...new Set(raw.map(r => r.curve_id).filter(Boolean))];
//   if (curves.length === 0) return { IRData: [], curve: null };

//   const selectedCurve =
//     selectedCurveId && curves.includes(selectedCurveId)
//       ? selectedCurveId
//       : curves[0];

//   // 2) Curve filtern
//   const curveRows = raw.filter(r => r.curve_id === selectedCurve);
//   if (curveRows.length === 0) return { IRData: [], curve: selectedCurve };

//   // 3) Instrument (falls relevant) – optional, aber sinnvoll
//   const instrumentRows = curveRows.filter(r => (r.instrument || '').toLowerCase() === 'swap');
//   const baseUniverse = instrumentRows.length ? instrumentRows : curveRows;

// // 4) Aktives Szenario aus RATES_ACTIVE bestimmen
// const activeEntry = appState.getRatesActive()
//   ?.filter(r =>
//     r.ccy === selectedCurrency &&
//     r.curve_id === selectedCurve
//   )
//   .sort((a, b) =>
//     new Date(b.activated_at) - new Date(a.activated_at)
//   )[0];

// const activeScenario = activeEntry?.scenario_id || 'BASE';
// const activeRunId = activeEntry?.active_run_id;

// // Szenario filtern
// let scenarioRows = baseUniverse.filter(
//   r => (r.scenario_id || 'BASE') === activeScenario
// );

// // Optional: wenn Run gesetzt ist → exakt diesen Run nehmen
// if (activeRunId) {
//   scenarioRows = scenarioRows.filter(r => r.run_id === activeRunId);
// }

// if (scenarioRows.length === 0) {
//   return { IRData: [], curve: selectedCurve };
// }

//   // 5) Latest asof_date bestimmen (zuerst Datum!)
//   const latestDate = scenarioRows
//     .map(r => r.asof_date)
//     .filter(Boolean)
//     .sort()
//     .pop();

// const dateRows = latestDate
//   ? scenarioRows.filter(r => r.asof_date === latestDate)
//   : scenarioRows;

//   // 6) Latest run_id innerhalb dieses Datums (dann Run!)
//   const latestRun = dateRows
//     .map(r => r.run_id)
//     .filter(Boolean)
//     .sort()
//     .pop();

//   const finalRows = latestRun
//     ? dateRows.filter(r => r.run_id === latestRun)
//     : dateRows;

//   // 7) Tenor sortieren (numerisch)
//   function tenorToMonths(t) {
//     if (!t) return 0;
//     const s = String(t).trim();
//     if (s.endsWith('Y')) return parseInt(s, 10) * 12;
//     if (s.endsWith('M')) return parseInt(s, 10);
//     return parseInt(s, 10) || 0;
//   }

//   finalRows.sort((a, b) => tenorToMonths(a.tenor) - tenorToMonths(b.tenor));

//   // 8) Chart data (deine DB hat value)
// const IRData = finalRows.map(r => ({
//   tenor: r.tenor,
//   value: Number(r.value ?? 0),

//   // 🔑 IDENTIFIER FIELDS
//   asof_date: r.asof_date,
//   run_id: r.run_id,
//   scenario_id: r.scenario_id,
//   ccy: r.ccy,
//   curve_id: r.curve_id,
//   instrument: r.instrument
// }));

//   return { IRData, curve: selectedCurve };
// }



function getIRDataForSelectedCurve() {

  console.log("---- IR PANEL DEBUG ----");
  console.log("selectedCurrency:", selectedCurrency);
  console.log("selectedCurveId:", selectedCurveId);
  console.log("RATES_ACTIVE:", appState.getRatesActive());

  const raw = appState._RATESDataCacheByCcy?.[selectedCurrency] || [];
  if (!Array.isArray(raw) || raw.length === 0) {
    return { IRData: [], curve: null };
  }

  // 1) Curve Selection (Dropdown) muss gelten
  const curves = [...new Set(raw.map(r => r.curve_id).filter(Boolean))];
  if (curves.length === 0) return { IRData: [], curve: null };

  const selectedCurve =
    selectedCurveId && curves.includes(selectedCurveId)
      ? selectedCurveId
      : curves[0];

  // 2) Curve filtern
  const curveRows = raw.filter(r => r.curve_id === selectedCurve);
  if (curveRows.length === 0) return { IRData: [], curve: selectedCurve };

  // 3) Instrument (falls relevant)
  const instrumentRows = curveRows.filter(r => (r.instrument || '').toLowerCase() === 'swap');
  const baseUniverse = instrumentRows.length ? instrumentRows : curveRows;

  // =====================================================
  // 4) Aktives Szenario aus RATES_ACTIVE bestimmen
  // =====================================================

  const activeEntry = appState.getRatesActive()
    ?.filter(r =>
      r.ccy === selectedCurrency &&
      r.curve_id === selectedCurve
    )
    .sort((a, b) =>
      new Date(b.activated_at) - new Date(a.activated_at)
    )[0];

  const activeScenario = activeEntry?.scenario_id || 'BASE';
  
  const activeRunId = activeEntry?.active_run_id;

  // 🔥 Dropdown synchronisieren (wenn vorhanden)
  const scenarioSelector = document.getElementById('scenarioSelector');
  if (scenarioSelector) {
    scenarioSelector.value = activeScenario;
  }

  // =====================================================
  // Szenario filtern
  // =====================================================

  let scenarioRows = baseUniverse.filter(
    r => (r.scenario_id || 'BASE') === activeScenario
  );

  // Optional: exakter Run
  if (activeRunId) {
    scenarioRows = scenarioRows.filter(r => r.run_id === activeRunId);
  }

  if (scenarioRows.length === 0) {
    return { IRData: [], curve: selectedCurve };
  }

  // =====================================================
  // 5) Latest asof_date
  // =====================================================

  const latestDate = scenarioRows
    .map(r => r.asof_date)
    .filter(Boolean)
    .sort()
    .pop();

  const dateRows = latestDate
    ? scenarioRows.filter(r => r.asof_date === latestDate)
    : scenarioRows;

  // =====================================================
  // 6) Latest run_id
  // =====================================================

  const latestRun = dateRows
    .map(r => r.run_id)
    .filter(Boolean)
    .sort()
    .pop();

  const finalRows = latestRun
    ? dateRows.filter(r => r.run_id === latestRun)
    : dateRows;

  // =====================================================
  // 7) Tenor sortieren
  // =====================================================

  function tenorToMonths(t) {
    if (!t) return 0;
    const s = String(t).trim();
    if (s.endsWith('Y')) return parseInt(s, 10) * 12;
    if (s.endsWith('M')) return parseInt(s, 10);
    return parseInt(s, 10) || 0;
  }

  finalRows.sort((a, b) => tenorToMonths(a.tenor) - tenorToMonths(b.tenor));

  // =====================================================
  // 8) Chart Data
  // =====================================================

  const IRData = finalRows.map(r => ({
    tenor: r.tenor,
    value: Number(r.value ?? 0),

    asof_date: r.asof_date,
    run_id: r.run_id,
    scenario_id: r.scenario_id,
    ccy: r.ccy,
    curve_id: r.curve_id,
    instrument: r.instrument
  }));

  return { IRData, curve: selectedCurve };
}

// =====================================================
// MAIN PANEL RENDER
// =====================================================
// export function renderIRPanel() {

//   const IRDataContainer = document.getElementById('IRDataContainer');
//   const ratesSelector   = document.getElementById('ratesSelector');
//   const currencySelector = document.getElementById('currencySelector');

//   if (!IRDataContainer || !ratesSelector) return;

//   // 🔥 GLOBAL RATES UPDATE LISTENER
//   if (!IRRatesListenerInstalled) {
//     document.addEventListener('interestRates:updated', () => {
//       console.log('[IRPanel] interestRates updated → rerender');
//       renderIRPanel();
//     });
//     IRRatesListenerInstalled = true;
//   }

//   // =====================================================
//   // 🔥 CURRENCY DROPDOWN (unabhängig von IRData)
//   // =====================================================
//   if (currencySelector && appState._RATESDataCacheByCcy) {

//     const currencies = Object.keys(appState._RATESDataCacheByCcy);

//     currencySelector.innerHTML = '';

//     currencies.forEach(ccy => {
//       const option = document.createElement('option');
//       option.value = ccy;
//       option.textContent = ccy;
//       currencySelector.appendChild(option);
//     });

//     if (!selectedCurrency || !currencies.includes(selectedCurrency)) {
//       selectedCurrency = currencies[0];
//     }

//     currencySelector.value = selectedCurrency;

//     currencySelector.onchange = (e) => {
//       selectedCurrency = e.target.value;
//       selectedCurveId = null; // reset curve on currency change
//       renderIRPanel();
//     };
//   }

//   // =====================================================
//   // DATA
//   // =====================================================
//   const { IRData, curve } = getIRDataForSelectedCurve();

//   // =====================================================
//   // ✅ DATA NOT READY → WAIT
//   // =====================================================
//   if (!IRData || IRData.length === 0) {

//     console.log('[IRPanel] waiting for interest rate data');

//     if (!IRPanelWaitingForData) {
//       IRPanelWaitingForData = true;

//       document.addEventListener(
//         'interestRates:updated',
//         () => {
//           console.log('[IRPanel] data arrived → rerender');
//           IRPanelWaitingForData = false;
//           renderIRPanel();
//         },
//         { once: true }
//       );
//     }

//     return;
//   }

//   // =====================================================
//   // CURVE DROPDOWN
//   // =====================================================
//   if (ratesSelector) {

//     const raw = appState._RATESDataCacheByCcy?.[selectedCurrency] || [];
//     const curves = [...new Set(raw.map(r => r.curve_id))];

//     ratesSelector.innerHTML = '';

//     curves.forEach(curveId => {
//       const option = document.createElement('option');
//       option.value = curveId;
//       option.textContent = curveId;
//       ratesSelector.appendChild(option);
//     });

//     if (!selectedCurveId || !curves.includes(selectedCurveId)) {
//       selectedCurveId = curves[0];
//     }

//     ratesSelector.value = selectedCurveId;

//     ratesSelector.onchange = (e) => {
//       selectedCurveId = e.target.value;
//       renderIRPanel();
//     };
//   }

//   // =====================================================
//   // TABLE
//   // =====================================================
//   IRDataContainer.innerHTML = processData(IRData);

//   // =====================================================
//   // EDIT BUTTONS
//   // =====================================================
//   const editButtons =
//     document.querySelectorAll('#IRDataContainer .edit-button');

//   editButtons.forEach(button => {
//     button.addEventListener('click', (event) => {
//       event.stopPropagation();

//       const tableName = 'RATES_SNAPSHOTS';
//       const rowIndex = parseInt(
//         button.getAttribute('data-row'),
//         10
//       );

//       handleModalAction(
//         event,
//         IRData,
//         rowIndex,
//         tableName,
//         'edit'
//       );
//     });
//   });

//   // =====================================================
//   // CHART
//   // =====================================================
//   renderIRLineChart(IRData);

//   // =====================================================
//   // RISK PREVIEW
//   // =====================================================
//   try {
//     document.dispatchEvent(
//       new Event('risk:refresh-thumbnails')
//     );
//   } catch (e) {
//     console.warn('risk refresh failed', e);
//   }

//   notifyRiskPreview('interestRates');
// }

export function renderIRPanel() {

  const IRDataContainer = document.getElementById('IRDataContainer');
  const ratesSelector   = document.getElementById('ratesSelector');
  const currencySelector = document.getElementById('currencySelector');

  if (!IRDataContainer || !ratesSelector) return;

  // =====================================================
  // 🔥 GLOBAL RATES UPDATE LISTENER
  // =====================================================
  if (!IRRatesListenerInstalled) {
    document.addEventListener('rates:data:ready', () => {
      console.log('[IRPanel] rates:data:ready → rerender');
      renderIRPanel();
    });
    IRRatesListenerInstalled = true;
  }

  // =====================================================
  // 🔥 CURRENCY DROPDOWN (unabhängig von IRData)
  // =====================================================
  if (currencySelector && appState._RATESDataCacheByCcy) {

    const currencies = Object.keys(appState._RATESDataCacheByCcy);

    currencySelector.innerHTML = '';

    currencies.forEach(ccy => {
      const option = document.createElement('option');
      option.value = ccy;
      option.textContent = ccy;
      currencySelector.appendChild(option);
    });

    if (!selectedCurrency || !currencies.includes(selectedCurrency)) {
      selectedCurrency = currencies[0];
    }

    currencySelector.value = selectedCurrency;

    currencySelector.onchange = (e) => {
      selectedCurrency = e.target.value;
      selectedCurveId = null;
      renderIRPanel();
    };
  }

  // =====================================================
  // DATA
  // =====================================================
  const { IRData, curve } = getIRDataForSelectedCurve();

  // =====================================================
  // DATA NOT READY → WAIT
  // =====================================================
  if (!IRData || IRData.length === 0) {

    console.log('[IRPanel] waiting for interest rate data');

    if (!IRPanelWaitingForData) {
      IRPanelWaitingForData = true;

      document.addEventListener(
        'rates:data:ready',
        () => {
          console.log('[IRPanel] data arrived → rerender');
          IRPanelWaitingForData = false;
          renderIRPanel();
        },
        { once: true }
      );
    }

    return;
  }

  // =====================================================
  // CURVE DROPDOWN
  // =====================================================
  if (ratesSelector) {

    const raw = appState._RATESDataCacheByCcy?.[selectedCurrency] || [];
    const curves = [...new Set(raw.map(r => r.curve_id))];

    ratesSelector.innerHTML = '';

    curves.forEach(curveId => {
      const option = document.createElement('option');
      option.value = curveId;
      option.textContent = curveId;
      ratesSelector.appendChild(option);
    });

    if (!selectedCurveId || !curves.includes(selectedCurveId)) {
      selectedCurveId = curves[0];
    }

    ratesSelector.value = selectedCurveId;

    ratesSelector.onchange = (e) => {
      selectedCurveId = e.target.value;
      renderIRPanel();
    };
  }

  // =====================================================
  // TABLE
  // =====================================================
  IRDataContainer.innerHTML = processData(IRData);

  // =====================================================
  // EDIT BUTTONS
  // =====================================================
  const editButtons =
    document.querySelectorAll('#IRDataContainer .edit-button');

  editButtons.forEach(button => {
    button.addEventListener('click', (event) => {
      event.stopPropagation();

      const tableName = 'RATES_SNAPSHOTS';
      const rowIndex = parseInt(
        button.getAttribute('data-row'),
        10
      );

      handleModalAction(
        event,
        IRData,
        rowIndex,
        tableName,
        'edit'
      );
    });
  });

  // =====================================================
  // CHART
  // =====================================================
  renderIRLineChart(IRData);

  // =====================================================
  // RISK PREVIEW
  // =====================================================
  try {
    document.dispatchEvent(
      new Event('risk:refresh-thumbnails')
    );
  } catch (e) {
    console.warn('risk refresh failed', e);
  }

  notifyRiskPreview('interestRates');
}


// =====================================================
// CHART
// =====================================================
export function renderIRLineChart(optionalIRData) {

  const canvasId = 'IRLineChart';
  const IRDataContainer =
    document.getElementById('IRDataContainer');

  if (!IRDataContainer) {
    console.warn('IRLineChart: container missing');
    return;
  }

  let IRData =
    Array.isArray(optionalIRData)
      ? optionalIRData
      : getIRDataForSelectedCurve().IRData;

  if (!IRData || IRData.length === 0) {
    console.log('[IRChart] waiting for data');
    return;
  }

  // destroy old
  if (appState._IRLineChart) {
    appState._IRLineChart.destroy();
    appState._IRLineChart = null;
  }

  const dataset = {
    label: 'RATES',
    data: IRData.map(r => ({
      x: r.tenor,
      y: parseFloat(r.value)*100
    })),
    fill: false,
    tension: 0.1,
  };

  if (!dataset.data.length) {
    console.warn('IRLineChart: no datapoints');
    return;
  }

  appState._IRLineChart = createRatesLineChart(
    [dataset],
    canvasId,
    'Interest Rates',
    3
  );
}





