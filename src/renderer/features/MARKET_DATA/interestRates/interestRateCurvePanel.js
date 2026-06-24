import processData from '../../../core/ui/modal/modalData.js';
import { notifyRiskPreview } from '../../REPORTS/RiskPDFPreview.js';
import { getInterestRateCurveData } from './interestRateCurveData.js';
import { renderInterestRateCurveChart } from './renderInterestRateCurveChart.js';
import { formatDisplayValue } from '../../../utils/tableCellFormats.js';

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

      document.dispatchEvent(new CustomEvent('interest-rates:currency-changed', {
        detail: {
          selectedCurrency,
          selectedCurveId
        }
      }));

      console.log('[IR CCY CHANGE] dispatched interest-rates:currency-changed');

      renderInterestRateCurvePanel();
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

      renderInterestRateCurveChart(IRData);

    }, 0);
  });

  notifyRiskPreview('interestRates');
}






