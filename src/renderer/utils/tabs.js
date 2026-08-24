const ANALYSE_MODAL_ID = 'ANALYSE_Modal';

function hideModal(el) {
  el.style.visibility = 'hidden';
  el.style.opacity = '0';
  el.style.height = '0';
  el.style.overflow = 'hidden';
}

function showModal(targetModalId, allModals) {
  allModals.forEach(hideModal);
  // Hintergrund-Modus der Overview beim Tab-Wechsel immer zuruecksetzen;
  // PORTFOLIO/RISK schalten ihn danach gezielt wieder ein (showHomeBehind).
  document.getElementById('HOME_Modal')?.classList.remove('home-behind');
  const target = document.getElementById(targetModalId);
  if (target) {
    target.style.visibility = 'visible';
    target.style.opacity = '1';
    target.style.height = 'auto';
    target.style.overflow = 'visible';
  }
}

// OVERVIEW als Hintergrund-Ebene im PORTFOLIO/RISK-Tab: bleibt rechts neben dem
// Trigger-Baum sichtbar (Position via .home-behind in css/HOME/overview.css) und
// wird erst ueberdeckt, wenn ein Trigger ein Slide-In-Panel oeffnet (z-index).
function showHomeBehind() {
  const home = document.getElementById('HOME_Modal');
  if (!home) return;
  home.classList.add('home-behind');
  home.style.visibility = 'visible';
  home.style.opacity = '1';
  home.style.height = 'auto';
  home.style.overflow = 'auto';
  try { window.renderHomeOverview?.(); } catch (_) {}
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
  // Market Risk (mvaRDistButton) rechnet alle Szenarien als EINEN Batch-Job; Dot/Proxy
  // werden von setMarketCalcStatus()/runMvarBatch() (bindAppButtons.js) gesteuert, damit
  // der Punkt bis zum Ende rot bleibt statt zwischendurch auf done zu springen. Hier nur
  // die Einzellauf-Buttons beobachten.
  const specs = [
    { proxy: 'riskCalcPortfolio', target: 'fairValueButton', dot: 'riskDotPortfolio' },
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

// Mini-Icon-Badges (gleiche Farben/Symbole wie die Overview-Karten) in alle
// Trigger mit den Labels "Portfolio" / "Market Risk" / "Credit Risk" einsetzen.
// Dokumentweit + idempotent (bereits dekorierte Buttons werden uebersprungen).
const TRIGGER_ICONS = {
  'Portfolio': {
    bg: '#6C9BD1',
    svg: '<svg viewBox="0 0 24 24"><path d="M12 4a8 8 0 1 0 8 8h-8z" fill="#fff"/><path d="M14 2.3A8 8 0 0 1 21.7 10H14z" fill="#fff" opacity=".9"/></svg>',
  },
  'Market Risk': {
    bg: '#2A7F7F',
    svg: '<svg viewBox="0 0 24 24"><rect x="4" y="12" width="3.4" height="8" rx="1" fill="#fff"/><rect x="10.3" y="8" width="3.4" height="12" rx="1" fill="#fff"/><rect x="16.6" y="4" width="3.4" height="16" rx="1" fill="#fff"/></svg>',
  },
  'Credit Risk': {
    bg: '#7A5C91',
    svg: '<svg viewBox="0 0 24 24"><path d="M12 2l8 3v6c0 5-3.4 8.6-8 11-4.6-2.4-8-6-8-11V5z" fill="#fff"/></svg>',
  },
};

function decorateTriggerIcons() {
  document.querySelectorAll('.section-trigger .section-header').forEach((h) => {
    const cfg = TRIGGER_ICONS[(h.textContent || '').trim()];
    if (!cfg) return;
    const btn = h.closest('.section-trigger');
    if (!btn) return;

    if (!btn.querySelector('.trigger-ico')) {
      btn.classList.add('has-ico');
      const ico = document.createElement('span');
      ico.className = 'trigger-ico';
      ico.style.setProperty('--ico-bg', cfg.bg);
      ico.setAttribute('aria-hidden', 'true');
      ico.innerHTML = cfg.svg;
      btn.insertBefore(ico, h);
    }

    // KPI-Farbstreifen: Gruppen-Trigger (Accordion-Kopf) faerben ALLE Trigger
    // ihres Teilbaums (Unterpunkte, Configuration-Blaetter, verschachtelte
    // Gruppen) mit der Bereichs-Farbe; Einzel-Trigger nur sich selbst.
    const applyAccent = (el) => {
      el.classList.add('has-accent');
      el.style.setProperty('--trigger-accent', cfg.bg);
    };
    if (btn.classList.contains('risk-acc-toggle')) {
      const acc = btn.closest('.risk-acc');
      if (acc) acc.querySelectorAll('.section-trigger').forEach(applyAccent);
      applyAccent(btn);
    } else {
      applyAccent(btn);
    }
  });

  // PORTFOLIO-Bereich: ALLE Valuation-Trigger bekommen den blauen Portfolio-
  // Farbstreifen (nur Accent, kein Icon) — analog zu Market/Credit Risk, wo die
  // Bereichsfarbe den ganzen Teilbaum faerbt. Gruppen-Trigger faerben ihren
  // .risk-acc-Teilbaum mit (z.B. Yield -> Current/History).
  const PORTFOLIO_ACCENT_LABELS = new Set([
    'Select Portfolio', 'Portfolio', 'Create Portfolio', 'Change Portfolio',
    'Breakdown', 'Yield', 'Current', 'History', 'Liquidity',
  ]);
  const portfolioAccent = (el) => {
    if (el.classList.contains('has-accent')) return;
    el.classList.add('has-accent');
    el.style.setProperty('--trigger-accent', TRIGGER_ICONS['Portfolio'].bg);
  };
  document.querySelectorAll('.section-trigger .section-header').forEach((h) => {
    if (!PORTFOLIO_ACCENT_LABELS.has((h.textContent || '').trim())) return;
    const btn = h.closest('.section-trigger');
    if (!btn) return;
    if (btn.classList.contains('risk-acc-toggle')) {
      const acc = btn.closest('.risk-acc');
      if (acc) acc.querySelectorAll('.section-trigger').forEach(portfolioAccent);
    }
    portfolioAccent(btn);
  });

  // Marker-Klasse statt Label-Match: faerbt gezielt einzelne Trigger portfolio-blau,
  // ohne gleichnamige Trigger anderer Bereiche (Risk History, Market Data) zu treffen.
  document.querySelectorAll('.section-trigger.pf-accent').forEach(portfolioAccent);
}

export function initializeTabs() {
  const map = {
    'HOME_Tab': 'HOME_Modal',
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
      showHomeBehind();
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
      showHomeBehind();
    });
  }

  bindRiskCalcProxies();
  relocateRiskInputs();
  wireRiskCalcStatus();
  bindRiskAccordion();
  decorateTriggerIcons();

  // OVERVIEW: beim Oeffnen des Home-Tabs aus den (bereits gefuellten) Stores neu rendern.
  const homeTab = document.getElementById('HOME_Tab');
  if (homeTab) {
    homeTab.addEventListener('click', () => {
      try { window.renderHomeOverview?.(); } catch (_) {}
    });
  }

  // Default to the ANALYSE view class (greift erst, wenn PORTFOLIO/RISK geoeffnet wird).
  setAnalyseView('analyse');
  // Populate the shared inline "Select Portfolio" picker for the default view too.
  syncRiskDropdownFromPort();

  // Landing nach Login = OVERVIEW (frueher: kein Modal sichtbar -> nur Header).
  showModal('HOME_Modal', tables);
  try { window.renderHomeOverview?.(); } catch (_) {}
}
