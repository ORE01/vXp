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
  const normSec   = document.getElementById('inputPdNormContainer')?.closest('.pd-norm-section');
  const thrSec    = document.getElementById('inputCreditVaRThresholdContainer')?.closest('.threshold-section');

  const marketHost = document.getElementById('riskInputMarketHost');
  const creditHost = document.getElementById('riskInputCreditHost');

  if (marketHost && mvarInput) marketHost.appendChild(mvarInput);
  if (creditHost && cfgSec)    creditHost.appendChild(cfgSec);
  if (creditHost && normSec)   creditHost.appendChild(normSec);
  if (creditHost && thrSec)    creditHost.appendChild(thrSec);
}

// Compare-Panels (panel-comp-port1/port2/charts) aus dem COMP_Modal in das
// #ANALYSE_Modal verschieben. Dann öffnen die "Risk Comparison"-Sub-Trigger sie
// als Slide-In im RISK-View (RISK-Tree bleibt sichtbar) — wie alle anderen RISK-
// Punkte. IDs bleiben → Dropdown-Bindings/Render/CSS (per Panel-ID) greifen weiter.
function relocateCompPanels() {
  const analyseModal = document.getElementById(ANALYSE_MODAL_ID);
  if (!analyseModal) return;
  const content = analyseModal.querySelector('.table-content') || analyseModal;
  ['panel-comp-port1', 'panel-comp-port2', 'panel-comp-charts'].forEach((id) => {
    const panel = document.getElementById(id);
    if (panel && panel.parentElement !== content) content.appendChild(panel);
  });
}

// Create/Change-Portfolio-Panels aus dem alten #CREATE_PORTFOLIO_Modal in das
// #ANALYSE_Modal verschieben. Die zugehoerigen Trigger leben jetzt in der
// "Select Portfolio"-Gruppe (PORTFOLIO-View). Gleiches Muster wie relocateCompPanels:
// als Slide-In sichtbar werden Panels nur im aktuell angezeigten Modal. IDs bleiben
// → Bindings/Render/CSS (panel-ID-gescoped) greifen weiter.
function relocatePortfolioPanels() {
  const analyseModal = document.getElementById(ANALYSE_MODAL_ID);
  if (!analyseModal) return;
  const content = analyseModal.querySelector('.table-content') || analyseModal;
  ['panel-newDeals', 'panel-deals'].forEach((id) => {
    const panel = document.getElementById(id);
    if (panel && panel.parentElement !== content) content.appendChild(panel);
  });
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

// Nested accordion for the RISK "Risk Metrics Input" group. A group toggle
// (.risk-acc-toggle, no data-panel) just expands/collapses its OWN next level;
// the leaf triggers (with data-panel) open a slide-in via bootstrapTriggers.
function bindRiskAccordion() {
  if (window.__riskAccBound) return;
  window.__riskAccBound = true;

  document.addEventListener('click', (e) => {
    const toggle = e.target.closest && e.target.closest('.risk-acc-toggle');
    if (!toggle) return;
    e.preventDefault();
    e.stopPropagation();
    const acc = toggle.closest('.risk-acc');
    if (!acc) return;
    const open = acc.classList.toggle('is-expanded');
    toggle.setAttribute('aria-expanded', String(open));
  });
}

export function initializeTabs() {
  const map = {
    'DATA_Tab': 'DATA_Modal',
    'DataProvider_Tab': 'DataProvider_Modal',
    'MARKETDATA_Tab': 'MARKETDATA_Modal',
    'products_Tab': 'products_Modal',
    'ISSUER_Tab': 'issuer_Modal',
    'REPORTS_Tab': 'REPORTS_Modal',
    'CUSTOMER_SETUP_Tab': 'CUSTOMER_SETUP_Modal',
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

  // Compare-Panels in #ANALYSE_Modal verschieben, damit "Risk Comparison" sie
  // — wie alle anderen RISK-Punkte — als Slide-In im RISK-View öffnet (RISK-Tree
  // bleibt links sichtbar). Die Sub-Trigger nutzen normales data-panel.
  relocateCompPanels();
  relocatePortfolioPanels();

  // ANALYSE + RISK both open #ANALYSE_Modal, only differing by the view class.
  const analyseTab = document.getElementById('ANALYSE_Tab');
  const riskTab = document.getElementById('RISK_Tab');

  if (analyseTab) {
    analyseTab.addEventListener('click', () => {
      // Panels nur beim echten View-Wechsel RISK -> VALUATION schließen, NICHT
      // beim Zurückkommen aus einem anderen Tab (dann bleibt das Panel offen).
      const modal = document.getElementById(ANALYSE_MODAL_ID);
      if (modal?.classList.contains('view-risk')) closeOpenSubPanels();
      setAnalyseView('analyse');
      showModal(ANALYSE_MODAL_ID, tables);
      // VALUATION uses the same inline "Select Portfolio" picker as RISK -> keep it
      // mirrored to createdPortDropdown0, exactly like the RISK tab does.
      syncRiskDropdownFromPort();
    });
  }
  if (riskTab) {
    riskTab.addEventListener('click', () => {
      // Panels nur beim echten View-Wechsel VALUATION -> RISK schließen.
      const modal = document.getElementById(ANALYSE_MODAL_ID);
      if (!modal?.classList.contains('view-risk')) closeOpenSubPanels();
      setAnalyseView('risk');
      showModal(ANALYSE_MODAL_ID, tables);
      syncRiskDropdownFromPort();
    });
  }

  bindRiskCalcProxies();
  relocateRiskInputs();
  wireRiskCalcStatus();
  bindRiskAccordion();

  // Default to the ANALYSE view.
  setAnalyseView('analyse');
  // Populate the shared inline "Select Portfolio" picker for the default view too.
  syncRiskDropdownFromPort();
}
