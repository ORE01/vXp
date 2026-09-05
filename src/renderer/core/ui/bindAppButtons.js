// FRONT_END/UI/bindAppButtons.js

import { bindTradeButtons } from '../../features/portfolio/trades/bindTradeButtons.js';
import { showMessageBox } from './dialogs/confirm.js';

/**
 * Central UI button bindings for the app.
 * Renderer should only call: bindAppButtons({ ...deps })
 *
 * NOTE: This module contains ONLY UI binding (DOM events),
 * no IPC receiver wiring.
 */

export function bindAppButtons({
  dealsActions,
  py, // window.__py

  updateTooltipsFn, // function(language) { ... }  (optional)
  handleHistoricMetricsAddClick,

  // excel / import
  handleExcelImport,

  // AI mapping / matching
  handleSubmitMatchedColumns,
  startOfferImport,
  handleSubmitMatching,
  quickImportWithStandardMapping,

  // provider (tabs are already moved out, so NOT here)

  // optional: you can pass a callback to toggle theme
} = {}) {
  if (!dealsActions) {
    console.warn('[bindAppButtons] dealsActions missing');
    return;
  }

  // idempotent
  if (window.__appButtonsBoundOnce) return;
  window.__appButtonsBoundOnce = true;

  // ============================================================
  // GLOBAL MODAL CLOSE (delegated)
  // - closes ANY modal via span.close
  // - does NOT use `hidden` (tabs won't restore it)
  // - releases our inline override on tab click
  // ============================================================
  if (!window.__modalCloseDelegationBoundOnce) {
    window.__modalCloseDelegationBoundOnce = true;

    // Close (soft-hide): display none + remove hidden attr
    document.addEventListener('click', (e) => {
      const closeEl = e.target.closest('.close');
      if (!closeEl) return;

      const modal =
        closeEl.closest('.modal') ||
        closeEl.closest('[id$="_Modal"]') ||
        closeEl.closest('[id*="Modal"]');

      if (!modal) {
        console.warn('[bindAppButtons] .close clicked but no modal container found');
        return;
      }

      // IMPORTANT: Tabs typically won't undo `hidden=true`, so we avoid it.
      modal.style.display = 'none';
      modal.removeAttribute('hidden');

      // Close any slide-ins/backdrops inside this modal
      modal.querySelectorAll('.sub-panel.open').forEach((p) => p.classList.remove('open'));
      modal.querySelectorAll('.sub-panel-backdrop.show').forEach((b) => b.classList.remove('show'));
      modal.querySelectorAll('.chart-section.is-open').forEach((s) => s.classList.remove('is-open'));
    }, true);

    // Tab click: release our inline hide so tab system can show content again
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.tablinks')) return;

      setTimeout(() => {
        document.querySelectorAll('[id$="_Modal"], [id*="Modal"]').forEach((m) => {
          if (m.style.display === 'none') m.style.display = '';
          m.removeAttribute('hidden');
        });
      }, 0);
    }, false);
  }

  // ---------- Trade-Editor (Create / Change Portfolio) ----------
  // Button-Verdrahtung liegt jetzt beim Feature (portfolio/tradeEditor).
  bindTradeButtons({ dealsActions, py });

  // ---------- Column selector drawers (SELECT PORTFOLIO, ISSUER, ...) ----------
  const wireColumnDrawer = (btnId, drawerId) => {
    const drawer = document.getElementById(drawerId);
    if (!drawer) return;

    document.getElementById(btnId)
      ?.addEventListener('click', () => drawer.classList.add('is-open'));

    drawer.querySelector('[data-col-drawer-close]')
      ?.addEventListener('click', () => drawer.classList.remove('is-open'));

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') drawer.classList.remove('is-open');
    });
  };

  wireColumnDrawer('portColumnsBtn', 'portColumnDrawer');
  wireColumnDrawer('issuerColumnsBtn', 'issuerColumnDrawer');
  wireColumnDrawer('prodColumnsBtn', 'prodColumnDrawer');
  wireColumnDrawer('dealsColumnsBtn', 'dealsColumnDrawer');
  wireColumnDrawer('marketDataSelectBtn', 'marketDataDrawer');

  // Market-Data-Drawer: Auswahl merken (localStorage) + Währungs-Checkbox schaltet Kinder.
  const mdSelector = document.getElementById('marketDataSelector');
  if (mdSelector) {
    const MD_KEY = 'marketDataSelection';

    // Angehakte Konventionen persistieren.
    const persistMdSelection = () => {
      const checked = Array.from(
        mdSelector.querySelectorAll('input[type="checkbox"][value]:checked')
      ).map((cb) => cb.value);
      try { localStorage.setItem(MD_KEY, JSON.stringify(checked)); } catch (_) {}
    };

    // Währungs-Häkchen (Header) = angehakt, wenn mind. ein Kind angehakt ist.
    const syncCcyToggles = () => {
      mdSelector.querySelectorAll('input.md-ccy-toggle[data-ccy]').forEach((toggle) => {
        const ccy = toggle.dataset.ccy;
        const kids = mdSelector.querySelectorAll(`input[type="checkbox"][value][data-ccy="${ccy}"]`);
        toggle.checked = Array.from(kids).some((cb) => cb.checked);
      });
    };

    // Gespeicherte Auswahl wiederherstellen (nur falls vorhanden, sonst HTML-Defaults).
    const restoreMdSelection = () => {
      let stored = null;
      try { stored = JSON.parse(localStorage.getItem(MD_KEY)); } catch (_) { stored = null; }
      if (!Array.isArray(stored)) return;
      const set = new Set(stored);
      mdSelector.querySelectorAll('input[type="checkbox"][value]').forEach((cb) => {
        cb.checked = set.has(cb.value);
      });
      syncCcyToggles();
    };

    restoreMdSelection();

    mdSelector.addEventListener('change', (e) => {
      const t = e.target;
      if (t instanceof HTMLInputElement && t.classList.contains('md-ccy-toggle')) {
        const ccy = t.dataset.ccy;
        mdSelector
          .querySelectorAll(`input[type="checkbox"][value][data-ccy="${ccy}"]`)
          .forEach((cb) => { cb.checked = t.checked; });
      }
      persistMdSelection();
    });
  }

  // ---------- ERSTE Zielmappe (Browse) ----------
  // Zeigt die aktuelle Zieldatei; "Target Workbook…" öffnet den Datei-Dialog.
  const ersteTargetLabel = document.getElementById('ersteTargetLabel');
  const setErsteTargetLabel = (info) => {
    if (!ersteTargetLabel || !info || !info.name) return;
    // Vollen Pfad anzeigen (wo die ERSTE-Daten hingeschrieben werden), Name als Fallback.
    // Hinweis, ob aktuell der SETUP-Default folgt oder ein explizites Target gewaehlt ist.
    const suffix = info.isDefault ? '  (SETUP default)' : '  (custom)';
    ersteTargetLabel.textContent = (info.path || info.name) + suffix;
    ersteTargetLabel.title = info.path || '';
  };
  window.api?.invoke?.('erste:get-target').then(setErsteTargetLabel).catch(() => {});
  document.getElementById('ersteTargetBrowseBtn')?.addEventListener('click', async () => {
    try {
      const res = await window.api.invoke('erste:select-target');
      if (res && !res.canceled) setErsteTargetLabel(res);
    } catch (e) {
      console.warn('[erste target] select failed', e);
    }
  });
  // "Use SETUP path": explizite Wahl loeschen -> zurueck auf den SETUP-Market-Pfad.
  document.getElementById('ersteTargetResetBtn')?.addEventListener('click', async () => {
    try {
      const res = await window.api.invoke('erste:reset-target');
      if (res) setErsteTargetLabel(res);
    } catch (e) {
      console.warn('[erste target] reset failed', e);
    }
  });

  // ---------- Historic Metrics ----------
  document.getElementById('historicMetricsAddButton')
    ?.addEventListener('click', handleHistoricMetricsAddClick);

  // ---------- Toolbar calculator popover (3 Calculate buttons) ----------
  const calcToggle = document.getElementById('toolbarCalcToggle');
  const calcMenu   = document.getElementById('toolbarCalcMenu');
  if (calcToggle && calcMenu) {
    const setCalcOpen = (open) => {
      calcMenu.hidden = !open;
      calcToggle.setAttribute('aria-expanded', String(open));
    };
    calcToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      setCalcOpen(calcMenu.hidden);
    });
    // mousedown (nicht click): der Proxy löst per .click() einen SYNTHETISCHEN
    // Klick auf den versteckten Original-Button außerhalb des Menüs aus – der hat
    // kein mousedown, würde als 'click' aber fälschlich als Außenklick zählen.
    document.addEventListener('mousedown', (e) => {
      if (!calcMenu.hidden && !calcMenu.contains(e.target) && !calcToggle.contains(e.target)) {
        setCalcOpen(false);
      }
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !calcMenu.hidden) setCalcOpen(false);
    });
  }

  // ---------- Excel Import ----------
  document.getElementById('importExcelButtonVXP')
    ?.addEventListener('click', handleExcelImport);

  document.getElementById('importEUSWButton')
    ?.addEventListener('click', () => handleExcelImport?.(['EUSW']));

  // ---------- Matching / Offers ----------
  document.getElementById('submitToProductsBtn')
    ?.addEventListener('click', () => handleSubmitMatchedColumns?.('productMatchesOutput', 'v_PRODUCTS_APP'));

  document.getElementById('submitToOffersBtn')
    ?.addEventListener('click', () => handleSubmitMatchedColumns?.('offerMatchesOutput', 'DealsMain', { port_name: 'LGT' }));

  document.getElementById('importOffersBtn')
    ?.addEventListener('click', () => startOfferImport?.());

  document.getElementById('submitMatchingBtn')
    ?.addEventListener('click', () => handleSubmitMatching?.());

  document.getElementById('btnQuickImport')
    ?.addEventListener('click', () => quickImportWithStandardMapping?.());

  // ---------- Python execution buttons ----------
  const projectButtons = [
    { buttonId: 'fairValueButton', projectName: 'py-fairValue' },
    { buttonId: 'fairValueButton1', projectName: 'py-fairValue' },
    { buttonId: 'fairValueButton2', projectName: 'py-fairValue' },
    { buttonId: 'fairValueButton3', projectName: 'py-fairValue' },

    { buttonId: 'CSParButton', projectName: 'py-cspar' },

    { buttonId: 'matchColumnsButton', projectName: 'py-matchColumns' },
    { buttonId: 'updateHistoricDataButton', projectName: 'py-historicData' },

    // Excel-Import
    { buttonId: 'updateExcelAllButton', projectName: 'py-excel' },
    { buttonId: 'updateExcelIssuerButton', projectName: 'py-excel' },
    { buttonId: 'updateExcelProductsButton', projectName: 'py-excel' },
    { buttonId: 'updateExcelDealsButton', projectName: 'py-excel' },
    { buttonId: 'updateExcelMarketButton', projectName: 'py-excel' },

    // Get Market Data (Erste -> MARKET_DATA.xlsm), separater Schritt vor dem Import
    { buttonId: 'getMarketDataButton', projectName: 'py-erste' },

    // Hist
    { buttonId: 'histEcbButton', projectName: 'py-hist' },
    { buttonId: 'histFedButton', projectName: 'py-hist' },
    { buttonId: 'histYahooButton', projectName: 'py-hist' },


  ];

  projectButtons.forEach(({ buttonId, projectName, extraParam }) => {
    const button = document.getElementById(buttonId);
    button?.addEventListener('click', () => {
      if (!py || typeof py.handleProjectButtonClick !== 'function') {
        console.warn('[bindAppButtons] py missing or invalid');
        return;
      }
      py.handleProjectButtonClick(button, projectName, extraParam);
    });
  });

  // ---------- Radio-based python project buttons (MVaR / CVaR) ----------
  function setupRadioProjectButton({
    buttonId,
    projectName,
    radioSelector,
    valueAttr,
    payloadKey,
    emptyMessage,
  }) {
    const button = document.getElementById(buttonId);
    if (!button) return;

    button.addEventListener('click', (event) => {
      const selectedRadio = document.querySelector(`${radioSelector}:checked`);
      if (!selectedRadio) {
        const msg = emptyMessage || 'Please select an option!';
        if (typeof showMessageBox === 'function') showMessageBox(msg);
        else console.warn('[bindAppButtons]', msg);
        return;
      }

      const value = selectedRadio.getAttribute(valueAttr);
      if (!value) {
        console.warn('[bindAppButtons]', `Selected row has no ${valueAttr} attribute.`);
        return;
      }

      if (!py || typeof py.handleProjectButtonClick !== 'function') {
        console.warn('[bindAppButtons] py missing or invalid');
        return;
      }

      py.handleProjectButtonClick(event.target, projectName, { [payloadKey]: value });
    });
  }

  // ---------- Market Risk: ALLE ausgewaehlten Szenarien rechnen ----------
  // ROLLING (immer, Baseline) + alle angehakten Stress-Szenarien (is_selected in MVaRInput)
  // werden SEQUENZIELL gerechnet: ein py-MVaR-Lauf nach dem anderen, der naechste erst nach
  // 'project-finished'. So sind stets alle ausgewaehlten Szenarien aktuell.
  // Market-Risk Dot/Proxy für die GANZE Sequenz (bleibt busy bis fertig), damit der
  // Status-Punkt nicht zwischen den Szenarien auf done springt.
  function setMarketCalcStatus(state /* 'busy' | 'done' */) {
    const dot   = document.getElementById('riskDotMarket');
    const proxy = document.getElementById('riskCalcMarket');
    const busy  = state === 'busy';
    if (dot) {
      dot.classList.toggle('is-busy', busy);
      dot.classList.toggle('is-done', !busy);
      dot.title = busy ? 'calculating…' : 'done';
    }
    if (proxy) {
      if (busy) {
        if (!proxy.dataset.origLabel) proxy.dataset.origLabel = proxy.textContent;
        proxy.disabled = true;
        proxy.textContent = 'Calculating…';
      } else {
        proxy.disabled = false;
        proxy.textContent = proxy.dataset.origLabel || proxy.textContent;
      }
    }
  }

  // ALLE ausgewaehlten Intervalle (ROLLING + Szenarien) in EINEM py-MVaR-Job rechnen:
  // Python macht den teuren Setup nur einmal und schleift ueber die Szenarien. Frueher
  // wurde pro Intervall ein eigener Lauf gestartet (sequenziell, langsam).
  function runMvarBatch(button, intervals) {
    // Waehrend des Laufs die per-Tabelle-Re-Renders der Pipeline unterdruecken (Daten werden
    // trotzdem gesetzt). Gerendert wird EINMAL am Ende via refreshMarketRiskUI() -> kein 3x-
    // Flackern. Sicherheitsnetz: Flag nach 5 min sicher freigeben, falls project-finished
    // ausbleibt (Crash), damit spaetere Daten-Updates wieder rendern.
    if (window.appState) window.appState._suppressMvarPipelineRender = true;
    const _safetyClear = setTimeout(() => {
      if (window.appState) window.appState._suppressMvarPipelineRender = false;
    }, 5 * 60 * 1000);

    // Auf den Abschluss GENAU des py-MVaR-Jobs warten (andere Projekte ignorieren).
    const onFinished = (data) => {
      if (data && data.projectName === 'py-MVaR') {
        clearTimeout(_safetyClear);
        if (window.appState) window.appState._suppressMvarPipelineRender = false;
        setMarketCalcStatus('done');
        // Ansicht auf ROLLING (Default) zuruecksetzen + einmal frisch rendern.
        const rollingName = intervals.find((x) => /^ROLLING/i.test(x)) || 'ROLLING_1';
        try {
          if (window.appState) window.appState.selectedMvarInterval = rollingName;
          window.appState?.refreshMarketRiskUI?.(0);
        } catch (_) {}
      } else {
        window.api.once('project-finished', onFinished);
      }
    };
    window.api.once('project-finished', onFinished);

    // Ein einziger Aufruf mit der kompletten Intervall-Liste.
    py.handleProjectButtonClick(button, 'py-MVaR', { intervalsOverride: intervals });
  }

  function setupMvarSequenceButton(buttonId) {
    const button = document.getElementById(buttonId);
    if (!button) return;

    button.addEventListener('click', () => {
      const as = window.appState;
      const rows = as?.getMvarModelSelectionAppRows?.() || [];
      const isRolling = (r) => /^ROLLING/i.test(String(r?.INTERVAL_NAME ?? '').trim());
      const rolling = rows.filter(isRolling).map((r) => String(r.INTERVAL_NAME));
      // Stress-Auswahl aus der SESSION (Set) — spiegelt auch ungespeicherte Haken; Fallback:
      // gespeichertes is_selected, falls die Session-Auswahl noch nicht initialisiert wurde.
      const sessionSet = as?.mvarSelectedScenarios;
      const selected = (sessionSet instanceof Set)
        ? [...sessionSet]
        : rows.filter((r) => !isRolling(r) && Number(r.is_selected) === 1).map((r) => String(r.INTERVAL_NAME));

      // ROLLING zuerst (Baseline), dann die ausgewaehlten Szenarien; dedupliziert.
      const intervals = [...new Set([...(rolling.length ? rolling : ['ROLLING_1']), ...selected])];
      if (!intervals.length) { showMessageBox?.('No scenario selected!'); return; }

      if (!py || typeof py.handleProjectButtonClick !== 'function') {
        console.warn('[bindAppButtons] py missing or invalid');
        return;
      }

      // Dot sofort rot (busy) für den gesamten Batch-Lauf.
      setMarketCalcStatus('busy');
      runMvarBatch(button, intervals);
    });
  }

  setupMvarSequenceButton('mvaRDistButton');

  setupRadioProjectButton({
    buttonId: 'CVaRButton',
    projectName: 'py-CVaR',
    radioSelector: '.cvar-radio',
    valueAttr: 'data-name',
    payloadKey: 'cvarName',
    emptyMessage: 'Select a CVaR configuration!',
  });

  // Market-adjusted Economic-Capital-Panel: eigener Calculate-Button. Gleiches Projekt (py-CVaR,
  // liefert historic + market adjusted in EINEM Lauf), aber mit eigenem "executing..."-Status
  // (handleProjectButtonClick setzt den geklickten Button, also diesen hier).
  setupRadioProjectButton({
    buttonId: 'CVaRButtonCurrent',
    projectName: 'py-CVaR',
    radioSelector: '.cvar-radio',
    valueAttr: 'data-name',
    payloadKey: 'cvarName',
    emptyMessage: 'Select a CVaR configuration!',
  });

  // ---------- Language / tooltips ----------
  if (typeof updateTooltipsFn === 'function') {
    updateTooltipsFn('en');

    [
      { buttonId: 'lang-en', lang: 'en' },
      { buttonId: 'lang-de', lang: 'de' },
    ].forEach(({ buttonId, lang }) => {
      document.getElementById(buttonId)?.addEventListener('click', () => updateTooltipsFn(lang));
    });
  }

  // ---------- Theme toggle ----------
  document.getElementById('themeToggle')?.addEventListener('click', () => {
    document.body.classList.toggle('light-theme');
    // Charts holen ihre Farben theme-aware aus colors.js → bei Wechsel neu zeichnen.
    try {
      const light = document.body.classList.contains('light-theme');
      document.dispatchEvent(new CustomEvent('theme:changed', { detail: { light } }));
    } catch {}
  });
}

