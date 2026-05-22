
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

    // default active name, falls noch keiner gesetzt
    if (!getActiveCustomerReportName() && appState.customerReportsData.length) {
      appState.activeCustomerReportName = String(appState.customerReportsData[0]?.name || '').trim();
    }

    notifyObservers();
  }

  function getCustomerReportsData() {
    return Array.isArray(appState.customerReportsData) ? appState.customerReportsData : [];
  }

  function setActiveCustomerReportName(name) {
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
