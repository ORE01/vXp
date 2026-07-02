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
    ersteTargetLabel.textContent = info.name;
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

  // ---------- Historic Metrics ----------
  document.getElementById('historicMetricsAddButton')
    ?.addEventListener('click', handleHistoricMetricsAddClick);

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
    { buttonId: 'MLButton', projectName: 'py-ml' },

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

  setupRadioProjectButton({
    buttonId: 'mvaRDistButton',
    projectName: 'py-MVaR',
    radioSelector: '.scenario-radio',
    valueAttr: 'data-interval',
    payloadKey: 'selectedInterval',
    emptyMessage: 'Select a Timeperiode!',
  });

  setupRadioProjectButton({
    buttonId: 'CVaRButton',
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

