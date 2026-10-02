export function updateCurveWarningUI() {
  const warningContainer = document.getElementById("curveWarningContainer");
  const warningLight = document.getElementById("curveWarning");
  const warningText = document.getElementById("curveWarningText");

  if (!warningContainer || !warningLight || !warningText) return;

  const activeRows = window.appState?.getRatesActive?.() || [];

  const affected = activeRows
    .filter(r => String(r?.scenario_id || "BASE").trim() !== "BASE")
    .map(r => {
      const ccy = String(r?.ccy || "").trim().toUpperCase();
      const curveId = String(r?.curve_id || "").trim();
      const scenario = String(r?.scenario_id || "").trim();

      if (curveId && scenario) return `${curveId}: ${scenario}`;
      if (ccy && scenario) return `${ccy}: ${scenario}`;
      return scenario;
    })
    .filter(Boolean);

  const showWarning = affected.length > 0;

  warningContainer.style.display = showWarning ? "flex" : "none";
  warningLight.style.backgroundColor = showWarning ? "red" : "transparent";

  warningText.textContent = "Curve Scenario Set";
  warningText.title = showWarning ? affected.join("\n") : "";
}

export function updateCSScenarioWarningUI() {
  const warningContainer = document.getElementById("csWarningContainer");
  const warningLight = document.getElementById("csWarning");
  const warningText = document.getElementById("csWarningText");

  if (!warningContainer || !warningLight || !warningText) return;

  const appState = window.appState;
  if (!appState) return;

  const activeRows = appState.getCSActive?.() || [];

  const affected = activeRows
    .filter(r => String(r?.scenario_id || "BASE").trim() !== "BASE")
    .map(r => {
      const ccy = String(r?.ccy || "").trim().toUpperCase();
      const scenario = String(r?.scenario_id || "").trim();
      return ccy ? `${ccy}: ${scenario}` : scenario;
    })
    .filter(Boolean);

  const showWarning = affected.length > 0;

  warningContainer.style.display = showWarning ? "flex" : "none";
  warningLight.style.backgroundColor = showWarning ? "red" : "transparent";

  warningText.textContent = "Credit Spread Scenario Set";
  warningText.title = showWarning ? affected.join("\n") : "";
}

// --- CS-Override: klickbares Hover-Menue (statt nur title-Tooltip) -----------------
// Hover ueber "CS Override for ID Set" zeigt die betroffenen PROD_IDs; Klick auf eine ID
// oeffnet sofort das Produkt-Panel (openProdEditorByProdId, dynamisch importiert -> keine
// zirkulaere Abhaengigkeit).
let _csOvItems = [];
let _csOvMenu = null;
let _csOvHideTimer = null;

function _csOvHide() {
  if (_csOvHideTimer) { clearTimeout(_csOvHideTimer); _csOvHideTimer = null; }
  if (_csOvMenu) _csOvMenu.style.display = 'none';
}
function _csOvScheduleHide() {
  if (_csOvHideTimer) clearTimeout(_csOvHideTimer);
  _csOvHideTimer = setTimeout(_csOvHide, 250);
}
function _csOvEnsureMenu() {
  if (_csOvMenu) return _csOvMenu;
  const m = document.createElement('div');
  m.id = 'csOverrideMenu';
  m.style.cssText = 'position:fixed;z-index:10000;display:none;min-width:170px;max-height:320px;'
    + 'overflow:auto;background:var(--surface-raised,#2a2a2e);color:var(--text-bright,#eee);'
    + 'border:1px solid var(--border,#444);border-radius:8px;box-shadow:0 6px 20px rgba(0,0,0,.4);'
    + 'padding:4px;font-size:12px;';
  m.addEventListener('mouseenter', () => { if (_csOvHideTimer) { clearTimeout(_csOvHideTimer); _csOvHideTimer = null; } });
  m.addEventListener('mouseleave', _csOvScheduleHide);
  m.addEventListener('click', (e) => {
    const row = e.target.closest && e.target.closest('[data-prod-id]');
    if (!row) return;
    const pid = row.getAttribute('data-prod-id');
    _csOvHide();
    if (pid) {
      import('../../utils/linksToTables.js')
        .then((mod) => mod.openProdEditorByProdId(pid))
        .catch((err) => console.warn('[csOverride] open product failed', err));
    }
  });
  document.body.appendChild(m);
  _csOvMenu = m;
  return m;
}
function _csOvFill() {
  const m = _csOvEnsureMenu();
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  m.innerHTML = _csOvItems.map((it) => {
    const label = it.value !== '' ? `${esc(it.prodId)}: ${esc(it.value)} bp` : esc(it.prodId);
    return `<div data-prod-id="${esc(it.prodId)}" title="Open product"`
      + ` style="padding:5px 10px;border-radius:5px;cursor:pointer;white-space:nowrap;"`
      + ` onmouseover="this.style.background='rgba(255,255,255,.08)'"`
      + ` onmouseout="this.style.background='transparent'">${label}</div>`;
  }).join('');
}
function _csOvBindHover(container) {
  if (!container || container.dataset.csOvHoverBound === '1') return;
  container.dataset.csOvHoverBound = '1';
  container.style.cursor = 'pointer';
  container.addEventListener('mouseenter', () => {
    if (!_csOvItems.length) return;
    _csOvFill();
    const r = container.getBoundingClientRect();
    _csOvMenu.style.left = Math.round(r.left) + 'px';
    _csOvMenu.style.top = Math.round(r.bottom + 4) + 'px';
    _csOvMenu.style.display = 'block';
    if (_csOvHideTimer) { clearTimeout(_csOvHideTimer); _csOvHideTimer = null; }
  });
  container.addEventListener('mouseleave', _csOvScheduleHide);
}

export function updateProductCSWarningUI(filteredProdData) {
  const warningContainer = document.getElementById("creditWarningContainer");
  const warningLight = document.getElementById("creditWarning");
  const warningText = document.getElementById("creditWarningText");

  if (!warningContainer || !warningLight || !warningText) {
    console.error("credit warning elements not found");
    return;
  }

  const rows = Array.isArray(filteredProdData) ? filteredProdData : [];

  // Active override = CS_SPREAD_OVERRIDE_BP is set (0 counts as an override!),
  // NOT the legacy CS_Szenario column (which does not exist in v_PRODUCTS_APP).
  const affectedRows = rows.filter(
    row =>
      row.CS_SPREAD_OVERRIDE_BP !== null &&
      row.CS_SPREAD_OVERRIDE_BP !== undefined &&
      String(row.CS_SPREAD_OVERRIDE_BP).trim() !== ""
  );

  // Items fuer das klickbare Hover-Menue (PROD_ID + bp-Wert). ?? haelt 0 -> "0".
  _csOvItems = affectedRows
    .map(row => ({
      prodId: String(row.PROD_ID || "").trim(),
      value: String(row.CS_SPREAD_OVERRIDE_BP ?? "").trim(),
    }))
    .filter(it => it.prodId);

  const showWarning = _csOvItems.length > 0;

  warningContainer.style.display = showWarning ? "flex" : "none";
  warningLight.style.backgroundColor = showWarning ? "red" : "transparent";

  warningText.textContent = "CS Override for ID Set";
  // Natives title-Tooltip entfernt -> stattdessen das klickbare Hover-Menue.
  warningText.title = "";
  _csOvBindHover(warningContainer);
  if (!showWarning) _csOvHide();
}

export function updateFactorMapScenarioWarningUI() {
  const warningContainer = document.getElementById("factorMapWarningContainer");
  const warningLight = document.getElementById("factorMapWarning");
  const warningText = document.getElementById("factorMapWarningText");

  if (!warningContainer || !warningLight || !warningText) return;

  // Aktives Factor-Mapping-Szenario (vom Factor-Mapping-Panel gesetzt).
  let active = "default";
  try { active = localStorage.getItem("mvarFactorMapActiveScenario") || "default"; }
  catch (_) {}
  active = String(active).trim() || "default";

  const showWarning = active !== "default";

  warningContainer.style.display = showWarning ? "flex" : "none";
  warningLight.style.backgroundColor = showWarning ? "red" : "transparent";

  warningText.textContent = "Factor Mapping Scenario Set";
  warningText.title = showWarning ? active : "";
}

export function updatePdHistScenarioWarningUI() {
  const warningContainer = document.getElementById("pdHistWarningContainer");
  const warningLight = document.getElementById("pdHistWarning");
  const warningText = document.getElementById("pdHistWarningText");

  if (!warningContainer || !warningLight || !warningText) return;

  // Aktives Historical-PD-Szenario aus PD_HIST_ACTIVE (eine Zeile).
  const activeRows = window.appState?.getPDHistActive?.() || [];
  const active = String(activeRows[0]?.scenario_id || "BASE").trim() || "BASE";

  const showWarning = active !== "BASE";

  warningContainer.style.display = showWarning ? "flex" : "none";
  warningLight.style.backgroundColor = showWarning ? "red" : "transparent";

  warningText.textContent = "PD Scenario Set";
  warningText.title = showWarning ? active : "";
}

// Klick auf eine Szenario-Lampe/-Text in der Uebersichtsleiste -> zur zugehoerigen
// "Set Scenario"-Quelle springen (Tab wechseln + Set-Panel oeffnen). Zwei Quellen:
// Market-Data-Szenarien (Curve/CS/Vol/PD) -> MARKET DATA "Set Scenarios"; Credit-Issuer
// -> RISK "Set Credit Scenario".
export function bindScenarioWarningNavigation() {
  const go = (tabId, panelSelector) => {
    document.getElementById(tabId)?.click();
    requestAnimationFrame(() => {
      const trig = document.querySelector(panelSelector);
      if (!trig) return;
      // Sidebar-Baum zu diesem Trigger aufklappen (nicht nur das Panel oeffnen).
      // (a) RISK-Baum (Credit): alle uebergeordneten .risk-acc-Gruppen expandieren.
      let acc = trig.closest('.risk-acc');
      while (acc) {
        acc.classList.add('is-expanded');
        acc.querySelector('.risk-acc-toggle')?.setAttribute('aria-expanded', 'true');
        acc = acc.parentElement?.closest?.('.risk-acc');
      }
      // (b) MARKET-DATA-Baum: die Hauptgruppe .chart-section oeffnen, damit die
      //     Sub-Trigger (z.B. "Set Scenarios") sichtbar werden.
      const sec = trig.closest('.chart-section');
      if (sec?.classList.contains('chart-section--sub')) {
        let prev = sec.previousElementSibling;
        while (prev && prev.classList.contains('chart-section--sub')) prev = prev.previousElementSibling;
        if (prev?.classList.contains('chart-section')) prev.classList.add('is-open');
      }
      try { trig.click(); } catch (_) {}
    });
  };
  const bind = (containerId, tabId, panelSelector) => {
    const el = document.getElementById(containerId);
    if (!el || el.dataset.navBound === '1') return;
    el.dataset.navBound = '1';
    el.style.cursor = 'pointer';
    el.addEventListener('click', () => go(tabId, panelSelector));
  };

  // Market-Data-Szenarien -> "Set Scenarios"-Panel im MARKET DATA-Tab.
  ['curveWarningContainer', 'csWarningContainer', 'volWarningContainer', 'pdHistWarningContainer']
    .forEach((id) => bind(id, 'MARKETDATA_Tab', '.section-trigger[data-panel="panel-scenarios"]'));

  // Credit-Issuer-Szenario -> "Set Credit Scenario"-Panel im RISK-Tab.
  bind('creditScenWarningContainer', 'RISK_Tab', '.section-trigger[data-panel="panel-credit-scenario-set"]');
}

export function updateCreditIssuerScenarioWarningUI() {
  const warningContainer = document.getElementById("creditScenWarningContainer");
  const warningLight = document.getElementById("creditScenWarning");
  const warningText = document.getElementById("creditScenWarningText");

  if (!warningContainer || !warningLight || !warningText) return;

  // Aktives Credit-Issuer-Szenario aus CREDIT_ISSUER_ACTIVE (eine Zeile).
  const activeRows = window.appState?.getCreditIssuerActive?.() || [];
  const active = String(activeRows[0]?.scenario_id || "BASE").trim() || "BASE";

  const showWarning = active !== "BASE";

  warningContainer.style.display = showWarning ? "flex" : "none";
  warningLight.style.backgroundColor = showWarning ? "red" : "transparent";

  warningText.textContent = "Credit Scenario Set";
  warningText.title = showWarning ? active : "";
}

export function updateVolScenarioWarningUI() {
  const warningContainer = document.getElementById("volWarningContainer");
  const warningLight = document.getElementById("volWarning");
  const warningText = document.getElementById("volWarningText");

  if (!warningContainer || !warningLight || !warningText) return;

  const activeRows = window.appState?.getSwaptionActive?.() || [];

  const affected = activeRows
    .filter(r => String(r?.scenario_id || "BASE").trim() !== "BASE")
    .map(r => {
      const ccy = String(r?.ccy || "").trim().toUpperCase();
      const scenario = String(r?.scenario_id || "").trim();
      return ccy ? `${ccy}: ${scenario}` : scenario;
    })
    .filter(Boolean);

  const showWarning = affected.length > 0;

  warningContainer.style.display = showWarning ? "flex" : "none";
  warningLight.style.backgroundColor = showWarning ? "red" : "transparent";

  warningText.textContent = "Vol Scenario Set";
  warningText.title = showWarning ? affected.join("\n") : "";
}
