// FRONT_END/STATE/productstore.js
// State-only: ProdData + Map lookup by PROD_ID
// Minimal-invasiv: hängt Methoden an appState.

export function installProductsStore({ appState } = {}) {
  if (!appState) throw new Error('[productstore] appState fehlt');

  function setProdData(data) {
    const arr = Array.isArray(data) ? data : [];
    appState.prodData = arr;

    const m = new Map();
    for (const r of arr) {
      const id = String(r?.PROD_ID ?? '').trim();
      if (id) m.set(id, r);
    }
    appState.prodById = m;

    console.log('[SET] prodData len=', arr.length, 'prodById=', m.size);
  }

  function getProdData() {
    return Array.isArray(appState.prodData) ? appState.prodData : [];
  }

  function getProdById(prod_id) {
    const id = String(prod_id ?? '').trim();
    return appState.prodById?.get(id) || null;
  }

  appState.setProdData = setProdData;
  appState.getProdData = getProdData;
  appState.getProdById = getProdById;

  return { setProdData, getProdData, getProdById };
}

