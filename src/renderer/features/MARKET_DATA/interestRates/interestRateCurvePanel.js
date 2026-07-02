import processData from '../../../core/ui/modal/modalData.js';
import { notifyRiskPreview } from '../../REPORTS/RiskPDFPreview.js';
import { getInterestRateCurveData } from './interestRateCurveData.js';
import { renderInterestRateCurveChart, renderInterestRateCurvesChart } from './renderInterestRateCurveChart.js';
import { formatDisplayValue } from '../../../utils/tableCellFormats.js';

// =====================================================
// CHART: MEHRERE KURVEN (Checkbox-Drawer)
// Tabelle bleibt einkurvig; der Chart zeigt alle angehakten Kurven.
// =====================================================

function irAllCurveIds() {
  const cache = window.appState?._RATESDataCacheByCcy || {};
  const ids = new Set();
  for (const ccy of Object.keys(cache)) {
    for (const r of (cache[ccy] || [])) {
      if (r.curve_id) ids.add(r.curve_id);
    }
  }
  return [...ids].sort();
}

// Checkboxen füllen. Beim ERSTEN Mal die aktuell gewählte Kurve anhaken,
// danach die bisherige Nutzer-Auswahl bewahren (auch wenn neue Kurven dazukommen).
function populateIRCurveChecklist(defaultCurveId) {
  const box = document.getElementById('irCurvesSelector');
  if (!box) return;

  const ids = irAllCurveIds();
  const firstTime = box.dataset.populated !== '1';
  const prevChecked = new Set(
    [...box.querySelectorAll('input[type="checkbox"]:checked')].map(c => c.value)
  );

  box.innerHTML = ids.map(id => {
    const checked = firstTime ? (id === defaultCurveId) : prevChecked.has(id);
    return `<label class="ir-curve-row"><input type="checkbox" value="${id}" ${checked ? 'checked' : ''}> ${id}</label>`;
  }).join('');
  box.dataset.populated = '1';
}

function renderIRChartFromChecks(fallbackCurveId) {
  const box = document.getElementById('irCurvesSelector');
  let ids = box
    ? [...box.querySelectorAll('input[type="checkbox"]:checked')].map(c => c.value)
    : [];
  if (!ids.length && fallbackCurveId) ids = [fallbackCurveId];

  const curves = ids.map(curveId => {
    const ccy = String(curveId).split(':')[0];
    const { IRData } = getInterestRateCurveData(window.appState, ccy, curveId, curveId);
    return { label: curveId, rows: IRData };
  }).filter(c => c.rows && c.rows.length);

  renderInterestRateCurvesChart(curves);
}

// Button öffnet Drawer, Checkbox-Änderung zeichnet den Chart neu. Nur EINMAL binden.
function wireIRCurvesDrawerOnce() {
  if (window.__irCurvesDrawerBound) return;
  window.__irCurvesDrawerBound = true;

  const drawer = document.getElementById('irCurvesDrawer');
  document.getElementById('irCurvesBtn')
    ?.addEventListener('click', () => drawer?.classList.add('is-open'));
  drawer?.querySelector('[data-col-drawer-close]')
    ?.addEventListener('click', () => drawer.classList.remove('is-open'));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') drawer?.classList.remove('is-open');
  });

  document.getElementById('irCurvesSelector')
    ?.addEventListener('change', () => renderIRChartFromChecks(selectedCurveId));
}

// =====================================================
// INTERNAL
// =====================================================


let selectedCurrency = 'EUR';
let selectedCurveId = null;
let IRChartFrameId = null;


// =====================================================
// VISIBILITY GUARD
// =====================================================

function isIRPanelVisible() {
  const panel = document.getElementById('panel-rates');
  const container = document.getElementById('IRDataContainer');

  return !!(
    panel &&
    container &&
    panel.isConnected &&
    container.isConnected &&
    panel.getClientRects().length > 0 &&
    container.getClientRects().length > 0
  );
}

// =====================================================
// EDIT
// =====================================================

function handleRatesEdit({ row, rowIndex, event }) {
  event?.stopPropagation?.();

  if (row?.scenario_id === 'BASE') {
    console.warn('[RatesEdit] BASE darf nicht editiert werden');
    return;
  }

  window.api.invoke('rates:update-scenario-row', {
    row,
    rowIndex
  });
}

function renderActiveRatesScenarioPanel({ selectedCurrency, selectedCurveId }) {
  const activeRows = appState.getRatesActive() || [];

  const active = activeRows
    .filter(r =>
      String(r.ccy || '').trim() === selectedCurrency &&
      String(r.curve_id || '').trim() === selectedCurveId
    )
    .sort((a, b) =>
      new Date(b.activated_at || 0) - new Date(a.activated_at || 0)
    )[0];

  const scenario = active?.scenario_id || 'BASE';
  const isBase = scenario === 'BASE';

  return `
    <div class="ir-active-scenario-panel" style="
      margin: 0 0 14px 0;
      padding: 12px 14px;
      border: 1px solid var(--border-subtle);
      border-radius: 10px;
      background: var(--surface-overlay);
      color: var(--text-primary);
    ">
      <div style="font-size:0.78rem; opacity:0.72; margin-bottom:6px;">
        Active Interest Rate Scenario
      </div>

      <div style="
        display:grid;
        grid-template-columns: 1fr 1fr 1fr 1fr;
        gap: 10px;
        align-items:center;
        font-size:0.84rem;
      ">
        <div><strong>CCY:</strong> ${selectedCurrency}</div>
        <div><strong>Curve:</strong> ${selectedCurveId || ''}</div>
        <div>
          <strong>Scenario:</strong>
          <span style="
            color:${isBase ? 'inherit' : '#ff4d4d'};
            font-weight:700;
          ">
            ${scenario}
          </span>
        </div>
        <div><strong>Run:</strong> ${active?.active_run_id || '-'}</div>
      </div>
    </div>
  `;
}

// =====================================================
// MAIN PANEL
// =====================================================

export function renderInterestRateCurvePanel() {

  const IRDataContainer = document.getElementById('IRDataContainer');
  const ratesSelector   = document.getElementById('ratesSelector');
  const currencySelector = document.getElementById('currencySelector');

  if (!IRDataContainer || !ratesSelector) return;


  // Currency
  if (currencySelector && appState._RATESDataCacheByCcy) {
    const currencies = Object.keys(appState._RATESDataCacheByCcy);

    currencySelector.innerHTML = '';

    currencies.forEach(ccy => {
      const option = document.createElement('option');
      option.value = ccy;
      option.textContent = ccy;
      currencySelector.appendChild(option);
    });

    selectedCurrency = currencies.includes(selectedCurrency)
      ? selectedCurrency
      : currencies[0];

    currencySelector.value = selectedCurrency;

    currencySelector.onchange = (e) => {
      selectedCurrency = e.target.value;
      selectedCurveId = null;

      console.log('[IR CCY CHANGE] selectedCurrency:', selectedCurrency);

      // appState mit-syncen wie im Curve-Handler -> Forwards/Credit-Spreads lesen
      // zuerst appState.selectedCurrency; ohne das bliebe es stale (alte Währung).
      appState.selectedCurrency = selectedCurrency;
      appState?.setSelectedCurrency?.(selectedCurrency);

      // Zuerst neu rendern: Curve-Dropdown wird für die neue ccy neu befüllt,
      // selectedCurveId auf die erste Kurve der neuen ccy gesetzt.
      renderInterestRateCurvePanel();

      // Jetzt steht die aktive Kurve fest -> appState/Setter aktualisieren,
      // sonst mischt Forwards neue ccy mit alter curve_id (keine Treffer).
      appState.selectedCurveId = selectedCurveId;
      appState?.setSelectedCurve?.(selectedCurveId);

      // Erst danach informieren -> konsistenter Stand (neue ccy + passende Kurve).
      document.dispatchEvent(new CustomEvent('interest-rates:currency-changed', {
        detail: {
          selectedCurrency,
          selectedCurveId
        }
      }));

      console.log('[IR CCY CHANGE] dispatched interest-rates:currency-changed');
    };
  }

  // Curve
  const raw = appState._RATESDataCacheByCcy?.[selectedCurrency] || [];
  const curves = [...new Set(raw.map(r => r.curve_id))];

  ratesSelector.innerHTML = '';

  curves.forEach(curveId => {
    const option = document.createElement('option');
    option.value = curveId;
    option.textContent = curveId;
    ratesSelector.appendChild(option);
  });

  selectedCurveId = curves.includes(selectedCurveId)
    ? selectedCurveId
    : curves[0];

  ratesSelector.value = selectedCurveId;

  ratesSelector.onchange = (e) => {
    selectedCurveId = e.target.value;

    console.log('[IR CURVE CHANGE] selectedCurveId:', selectedCurveId);
    console.log('[IR CURVE CHANGE] selectedCurrency:', selectedCurrency);

    appState.selectedCurrency = selectedCurrency;
    appState.selectedCurveId = selectedCurveId;

    appState?.setSelectedCurrency?.(selectedCurrency);
    appState?.setSelectedCurve?.(selectedCurveId);

    document.dispatchEvent(new CustomEvent('interest-rates:curve-changed', {
      detail: {
        selectedCurrency,
        selectedCurveId
      }
    }));

    console.log('[IR CURVE CHANGE] dispatched interest-rates:curve-changed');

    renderInterestRateCurvePanel();
  };

  // DATA
  const domSelectedCurve = document.getElementById('ratesSelector')?.value;

  const { IRData, curve } = getInterestRateCurveData(
    appState,
    selectedCurrency,
    selectedCurveId,
    domSelectedCurve
  );

  selectedCurveId = curve;

  if (!IRData || IRData.length === 0) return;

  // TABLE
  if (appState._IRLineChart) {
    try { appState._IRLineChart.destroy(); } catch {}
    appState._IRLineChart = null;
  }

    const IRDisplayData = IRData.map(r => ({
    ...r,
    value: formatDisplayValue('RATES', r.value)
  }));

  IRDataContainer.innerHTML = `
    ${renderActiveRatesScenarioPanel({
      selectedCurrency,
      selectedCurveId
    })}
    ${processData(IRDisplayData, 'RATES_BASE', {}, { includeEditColumn: false })}
  `;

  // EDIT
  document.querySelectorAll('#IRDataContainer .edit-button')
    .forEach(button => {
      button.addEventListener('click', (event) => {
        const rowIndex = parseInt(button.getAttribute('data-row'), 10);
        handleRatesEdit({ row: IRData[rowIndex], rowIndex, event });
      });
    });

  // CHART SAFE RENDER
  if (IRChartFrameId) cancelAnimationFrame(IRChartFrameId);

  IRChartFrameId = requestAnimationFrame(() => {

    setTimeout(() => {

      if (!isIRPanelVisible()) return;

      const canvas = document.getElementById('IRLineChart');
      if (!canvas || !canvas.isConnected) return;

      // Chart = alle im Drawer angehakten Kurven (Default: die Tabellen-Kurve).
      wireIRCurvesDrawerOnce();
      populateIRCurveChecklist(selectedCurveId);
      renderIRChartFromChecks(selectedCurveId);

    }, 0);
  });

  notifyRiskPreview('interestRates');
}






