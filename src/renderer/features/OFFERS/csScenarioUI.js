// FRONT_END/OFFERS/csScenarioUI.js

export function bindClearCSScenario({ appState, api, handlePortProdData } = {}) {
  if (!appState) throw new Error('[bindClearCSScenario] appState missing');
  if (!api) throw new Error('[bindClearCSScenario] api missing');

  const PRODUCTS_TABLE = 'v_PRODUCTS_APP';

  // idempotent binding
  if (window.__clearCSScenarioBoundOnce) return;
  window.__clearCSScenarioBoundOnce = true;

  function updateProductCSScenarioGeneric(prodId) {
    return new Promise((resolve, reject) => {
      const payload = {
        cleanTableName: PRODUCTS_TABLE,
        rowIndex: 0, // ignored by canonical product path
        newData: {
          PROD_ID: prodId,
          CS_Szenario: '',
        },
        uniqueIdentifier: {
          column: 'PROD_ID',
          value: prodId,
        },
      };

      const onOk = () => resolve(true);
      const onErr = (msg) => reject(new Error(msg?.message || msg?.error || String(msg)));

      if (api?.once) {
        api.once('update-data-success', onOk);
        api.once('update-data-error', onErr);
      } else {
        // fallback if once does not exist
        api.receive('update-data-success', onOk);
        api.receive('update-data-error', onErr);
      }

      api.send('update-data', payload);
    });
  }

  async function clearCSSzenarioForCurrentOffer() {
    const portName = String(
      appState.getSelectedPortTableName?.() ||
      document.getElementById('createdOffersDropdown')?.value ||
      ''
    ).trim();

    if (!portName) {
      console.warn('[clearCSScenario] Kein port_name ausgewählt – Abbruch.');
      return;
    }

    const ports = appState.getAllPortfolioData?.() || [];

    const prodIds = [...new Set(
      ports
        .filter((r) => String(r.port_name) === portName)
        .map((r) => r.PROD_ID)
        .filter(Boolean)
    )];

    if (!prodIds.length) {
      console.warn(`[clearCSScenario] Keine PROD_IDs gefunden für '${portName}'.`);
      return;
    }

    // 1) Clear product CS scenario sequentially via canonical product update
    for (const id of prodIds) {
      await updateProductCSScenarioGeneric(id);
    }

    // 2) Refresh canonical product views
    const onceIPC = (channel) =>
      new Promise((res) => (
        api?.once
          ? api.once(channel, res)
          : api.receive(channel, res)
      ));

    try {
      const prodP = onceIPC('v_PRODUCTS_APPData');
      api.send('fetch-table-data', PRODUCTS_TABLE);
      const freshProd = await prodP;

      appState.setAllProdData?.(freshProd);
    } catch (e) {
      console.warn('[clearCSScenario] Refresh v_PRODUCTS_APPData nicht empfangen – Channel prüfen.', e);
    }

    try {
      api.send('fetch-table-data', 'v_PRODUCTS_CANONICAL');
    } catch {}

    try {
      api.send('fetch-table-data', 'Portfolios');
    } catch {}

    // 3) Redraw offers view
    const filtered = ports.filter((r) => String(r.port_name) === portName);
    appState.updateOffersDataTable?.(filtered, 0);

    // optional: Preview/Panel refresh
    if (typeof handlePortProdData === 'function') {
      try {
        handlePortProdData(filtered, 4, portName);
      } catch {}
    }
  }

  // 4) Bind button
  const btn = document.getElementById('clearCSButton');
  if (!btn) return;

  btn.addEventListener('click', async () => {
    const old = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Clearing…';

    try {
      await clearCSSzenarioForCurrentOffer();
    } finally {
      btn.disabled = false;
      btn.textContent = old;
    }
  });
}