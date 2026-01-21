// FRONT_END/OFFERS/csScenarioUI.js

export function bindClearCSScenario({ appState, api, handlePortProdData } = {}) {
  if (!appState) throw new Error('[bindClearCSScenario] appState missing');
  if (!api) throw new Error('[bindClearCSScenario] api missing');

  const ALL_PRODUCTS_TABLE = 'ProdAll'; // falls anders, hier anpassen

  // idempotent binding
  if (window.__clearCSScenarioBoundOnce) return;
  window.__clearCSScenarioBoundOnce = true;

  function updateProdAllCSGeneric(prodId) {
    return new Promise((resolve, reject) => {
      const payload = {
        cleanTableName: ALL_PRODUCTS_TABLE,
        rowIndex: 0, // wird bei dir ignoriert
        newData: { CS_Szenario: '' }, // → leeren
        uniqueIdentifier: { column: 'PROD_ID', value: prodId },
      };

      const onOk = () => resolve(true);
      const onErr = (msg) => reject(new Error(msg));

      if (api?.once) {
        api.once('update-data-success', onOk);
        api.once('update-data-error', onErr);
      } else {
        // fallback (falls once nicht existiert)
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

    // 1) sequenziell leeren
    for (const id of prodIds) {
      await updateProdAllCSGeneric(id);
    }

    // 2) ProdAll refresh
    const onceIPC = (channel) =>
      new Promise((res) => (api?.once ? api.once(channel, res) : api.receive(channel, res)));

    try {
      const prodP = onceIPC('ProdAllData');
      api.send('fetch-table-data', ALL_PRODUCTS_TABLE); // 'ProdAll'
      const freshProd = await prodP;

      // je nach AppState API: bei dir war setAllProdData optional
      appState.setAllProdData?.(freshProd);
    } catch (e) {
      console.warn('[clearCSScenario] Refresh ProdAllData nicht empfangen – Channel prüfen.', e);
    }

    // 3) Offers-Ansicht neu zeichnen
    const filtered = ports.filter((r) => String(r.port_name) === portName);
    appState.updateOffersDataTable?.(filtered, 0);

    // optional: Preview/Panel refresh
    if (typeof handlePortProdData === 'function') {
      try { handlePortProdData(filtered, 4, portName); } catch {}
    }
  }

  // 4) Button binden
  const btn = document.getElementById('clearCSButton');
  if (!btn) return;

  btn.addEventListener('click', async (e) => {
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
