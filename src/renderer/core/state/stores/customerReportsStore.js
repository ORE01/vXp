
export function installCustomerReportsStore({ appState } = {}) {
  if (!appState) throw new Error('[customerReportsStore] appState fehlt');

  // -----------------------------
  // Observer-Bus (leichtgewichtig)
  // -----------------------------
  if (!Array.isArray(appState.observers)) appState.observers = [];

  function addObserver(fn) {
    if (typeof fn === 'function') appState.observers.push(fn);
  }

  function notifyObservers() {
    const obs = Array.isArray(appState.observers) ? appState.observers : [];
    for (const fn of obs) {
      try { fn(); } catch (e) { console.warn('[customerReportsStore] observer error', e); }
    }
  }

  // -----------------------------
  // Customer Reports Data
  // -----------------------------
  function setCustomerReportsData(rows) {
    appState.customerReportsData = Array.isArray(rows) ? rows : [];
    // KEIN Default auf den ersten Report -> beim (Reload-)Start ist nichts vorausgewaehlt.
    notifyObservers();
  }

  function getCustomerReportsData() {
    return Array.isArray(appState.customerReportsData) ? appState.customerReportsData : [];
  }

  function setActiveCustomerReportName(name) {
    // NUR in-memory (appState). So bleibt die Auswahl beim Panel-Wechsel INNERHALB der
    // Session erhalten, ist aber nach einem Reload leer (appState wird neu erzeugt)
    // -> reload = "nichts vorausgewaehlt".
    appState.activeCustomerReportName = String(name || '').trim();
    notifyObservers();
  }

  function getActiveCustomerReportName() {
    return String(appState.activeCustomerReportName || '').trim();
  }

  // -----------------------------
  // Expose on appState
  // -----------------------------
  appState.addObserver = addObserver;
  appState.notifyObservers = notifyObservers;

  appState.setCustomerReportsData = setCustomerReportsData;
  appState.getCustomerReportsData = getCustomerReportsData;

  appState.setActiveCustomerReportName = setActiveCustomerReportName;
  appState.getActiveCustomerReportName = getActiveCustomerReportName;

  return {
    addObserver,
    notifyObservers,
    setCustomerReportsData,
    getCustomerReportsData,
    setActiveCustomerReportName,
    getActiveCustomerReportName,
  };
}
