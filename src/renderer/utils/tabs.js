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

  // Default to the ANALYSE view.
  setAnalyseView('analyse');
}
