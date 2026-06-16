const ANALYSE_MODAL_ID = 'ANALYSE_Modal';

function hideModal(el) {
  el.style.visibility = 'hidden';
  el.style.opacity = '0';
  el.style.height = '0';
  el.style.overflow = 'hidden';
}

function showModal(targetModalId, allModals) {
  allModals.forEach(hideModal);
  const target = document.getElementById(targetModalId);
  if (target) {
    target.style.visibility = 'visible';
    target.style.opacity = '1';
    target.style.height = 'auto';
    target.style.overflow = 'visible';
  }
}

// ANALYSE and RISK share #ANALYSE_Modal. Switching only toggles which triggers
// (and titles) are visible via a view class; the panels stay put so all their
// #ANALYSE_Modal-scoped CSS keeps working.
function setAnalyseView(view) {
  const modal = document.getElementById(ANALYSE_MODAL_ID);
  if (!modal) return;
  modal.classList.remove('view-analyse', 'view-risk');
  modal.classList.add(view === 'risk' ? 'view-risk' : 'view-analyse');
}

// Close any open sub-panel + backdrop, so a panel from the other view doesn't
// linger when switching between ANALYSE and RISK (same modal).
function closeOpenSubPanels() {
  const modal = document.getElementById(ANALYSE_MODAL_ID);
  if (!modal) return;
  modal.querySelectorAll('.sub-panel').forEach((p) => {
    p.classList.remove('open');
    p.hidden = true;
    p.removeAttribute('aria-modal');
  });
  modal.querySelectorAll('.sub-panel-backdrop').forEach((b) => {
    b.classList.remove('show');
    b.hidden = true;
  });
  modal.querySelectorAll('.section-trigger[aria-expanded="true"]').forEach((t) => {
    t.setAttribute('aria-expanded', 'false');
  });
}

// RISK view has its own portfolio picker that MIRRORS createdPortDropdown0
// (the SELECT PORTFOLIO dropdown). Selecting there drives the existing pipeline
// by setting createdPortDropdown0 + firing its change event.
let _riskDropdownBound = false;

function syncRiskDropdownFromPort() {
  const src = document.getElementById('createdPortDropdown0');
  const dst = document.getElementById('createdPortDropdownRisk');
  if (!src || !dst) return;

  dst.innerHTML = src.innerHTML; // copy the same <option> list
  dst.value = src.value;         // reflect the current selection

  if (!_riskDropdownBound) {
    _riskDropdownBound = true;
    dst.addEventListener('change', () => {
      const s = document.getElementById('createdPortDropdown0');
      if (!s || s.value === dst.value) return;
      s.value = dst.value;
      s.dispatchEvent(new Event('change', { bubbles: true }));
    });
  }
}

// The Calculate buttons in the RISK "Select Portfolio" panel proxy to the
// existing buttons, so all wiring (radio payloads, py calls, progress) is reused.
function bindRiskCalcProxies() {
  const proxy = (srcId, dstId) => {
    const src = document.getElementById(srcId);
    if (!src || src.dataset.proxyBound === '1') return;
    src.dataset.proxyBound = '1';
    src.addEventListener('click', () => {
      document.getElementById(dstId)?.click();
    });
  };
  proxy('riskCalcPortfolio', 'fairValueButton'); // py-fairValue
  proxy('riskCalcMarket', 'mvaRDistButton');     // py-MVaR
  proxy('riskCalcCredit', 'CVaRButton');         // py-CVaR
}

// Move the risk INPUT sections out of panel-market/panel-credit into the
// dedicated "Risk Metrics Input" sub-panels. Done on the browser-parsed nodes,
// so the (tangled) source markup is irrelevant. Containers keep their IDs, so
// the renderers (handleMVaRData input, handleCvarInput*View) still target them.
function relocateRiskInputs() {
  const mvarInput = document.getElementById('inputMvarContainer')?.closest('.mvar-input');
  const cfgSec    = document.getElementById('inputCreditVaRConfigContainer')?.closest('.cvar-config-section');
  const thrSec    = document.getElementById('inputCreditVaRThresholdContainer')?.closest('.threshold-section');

  const marketHost = document.getElementById('riskInputMarketHost');
  const creditHost = document.getElementById('riskInputCreditHost');

  if (marketHost && mvarInput) marketHost.appendChild(mvarInput);
  if (creditHost && cfgSec)    creditHost.appendChild(cfgSec);
  if (creditHost && thrSec)    creditHost.appendChild(thrSec);
}

// Status dot next to each RISK Calculate button: gray (idle) -> red (running)
// -> green (done). Driven by the original button's `disabled` state, which the
// project router sets true while running and false on completion.
function wireRiskCalcStatus() {
  const specs = [
    { proxy: 'riskCalcPortfolio', target: 'fairValueButton', dot: 'riskDotPortfolio' },
    { proxy: 'riskCalcMarket',    target: 'mvaRDistButton',  dot: 'riskDotMarket' },
    { proxy: 'riskCalcCredit',    target: 'CVaRButton',      dot: 'riskDotCredit' },
  ];

  specs.forEach(({ proxy, target, dot }) => {
    const proxyEl = document.getElementById(proxy);
    const targetEl = document.getElementById(target);
    const dotEl = document.getElementById(dot);
    if (!proxyEl || !targetEl || !dotEl) return;
    if (targetEl.dataset.riskStatusBound === '1') return;
    targetEl.dataset.riskStatusBound = '1';

    const label = proxyEl.textContent;
    let wasBusy = false;

    const update = () => {
      if (targetEl.disabled) {
        wasBusy = true;
        dotEl.classList.remove('is-done');
        dotEl.classList.add('is-busy');
        dotEl.title = 'calculating…';
        proxyEl.disabled = true;
        proxyEl.textContent = 'Calculating…';
      } else {
        proxyEl.disabled = false;
        proxyEl.textContent = label;
        if (wasBusy) {
          dotEl.classList.remove('is-busy');
          dotEl.classList.add('is-done');
          dotEl.title = 'done';
          wasBusy = false;
        }
      }
    };

    new MutationObserver(update).observe(targetEl, {
      attributes: true,
      attributeFilter: ['disabled'],
    });
  });
}

export function initializeTabs() {
  const map = {
    'DATA_Tab': 'DATA_Modal',
    'COMP_Tab': 'COMP_Modal',
    'DataProvider_Tab': 'DataProvider_Modal',
    'CREATE_PORTFOLIO_Tab': 'CREATE_PORTFOLIO_Modal',
    'MARKETDATA_Tab': 'MARKETDATA_Modal',
    'products_Tab': 'products_Modal',
    'ISSUER_Tab': 'issuer_Modal',
    'REPORTS_Tab': 'REPORTS_Modal',
  };

  const tables = document.querySelectorAll('.table');
  tables.forEach(hideModal);

  Object.entries(map).forEach(([tabId, modalId]) => {
    const tab = document.getElementById(tabId);
    const modal = document.getElementById(modalId);
    if (!tab || !modal) {
      console.warn(`ID fehlt: ${tabId} → ${modalId}`);
      return;
    }
    tab.addEventListener('click', () => showModal(modalId, tables));
  });

  // ANALYSE + RISK both open #ANALYSE_Modal, only differing by the view class.
  const analyseTab = document.getElementById('ANALYSE_Tab');
  const riskTab = document.getElementById('RISK_Tab');

  if (analyseTab) {
    analyseTab.addEventListener('click', () => {
      closeOpenSubPanels();
      setAnalyseView('analyse');
      showModal(ANALYSE_MODAL_ID, tables);
    });
  }
  if (riskTab) {
    riskTab.addEventListener('click', () => {
      closeOpenSubPanels();
      setAnalyseView('risk');
      showModal(ANALYSE_MODAL_ID, tables);
      syncRiskDropdownFromPort();
    });
  }

  bindRiskCalcProxies();
  relocateRiskInputs();
  wireRiskCalcStatus();

  // Default to the ANALYSE view.
  setAnalyseView('analyse');
}
