// FRONT_END/STATE/portfolioDataStore.js
// State-only: Portfolio/Deals/Offers core state + PortAgg Map (portDataMap) + index/selections

export function installPortfolioDataStore({ appState } = {}) {
  if (!appState) throw new Error('[portfolioDataStore] appState fehlt');

  // --- Selections / Indices ---
  function setPortIndex(index) {
    appState.currentPortIndex = index ?? 0;
  }
  function getPortIndex() {
    return appState.currentPortIndex ?? 0;
  }

  function setSelectedPortTableName(tableName) {
    appState.port_name = tableName == null ? null : String(tableName);
  }
  function getSelectedPortTableName() {
    return appState.port_name == null ? null : String(appState.port_name);
  }

  function setSelectedDealsTableName(tableName) {
    appState.selectedDealsTableName = tableName == null ? null : String(tableName);
  }
  function getSelectedDealsTableName() {
    return appState.selectedDealsTableName == null ? null : String(appState.selectedDealsTableName);
  }

  function setSelectedTradeIDs(ids) {
    appState.selectedTradeIDs = Array.isArray(ids) ? ids : ['ALL'];
  }

  // --- Raw data buckets ---
  function setAllPortfolioData(data) {
    appState.AllPortfolioData = Array.isArray(data) ? data : [];
  }
  function getAllPortfolioData() {
    return Array.isArray(appState.AllPortfolioData) ? appState.AllPortfolioData : [];
  }

  // Optional: current view tables
  function setPortData(data) { appState.portData = Array.isArray(data) ? data : []; }
  function getPortData() { return Array.isArray(appState.portData) ? appState.portData : []; }

  function setDealsData(data) { appState.dealsData = Array.isArray(data) ? data : []; }
  function getDealsData() { return Array.isArray(appState.dealsData) ? appState.dealsData : []; }

  function setAllDealsData(data) { appState.allDealsData = Array.isArray(data) ? data : []; }
  function getAllDealsData() { return Array.isArray(appState.allDealsData) ? appState.allDealsData : []; }

  function setOffersData(data) { appState.offersData = Array.isArray(data) ? data : []; }
  function getOffersData() { return Array.isArray(appState.offersData) ? appState.offersData : []; }

  // --- PortAgg map (for compare charts / aggregated fields) ---
  if (!appState.portDataMap) appState.portDataMap = {};

  function setPortAggData(elementId, data) {
    const key = String(elementId || '');
    const before = appState.portDataMap[key] || {};
    appState.portDataMap[key] = { ...before, ...(data || {}) };
  }

  function getPortAggData(elementId) {
    const key = String(elementId || '');
    return appState.portDataMap[key] || {};
  }

  // expose
  appState.setPortIndex = setPortIndex;
  appState.getPortIndex = getPortIndex;

  appState.setSelectedPortTableName = setSelectedPortTableName;
  appState.getSelectedPortTableName = getSelectedPortTableName;

  appState.setSelectedDealsTableName = setSelectedDealsTableName;
  appState.getSelectedDealsTableName = getSelectedDealsTableName;

  appState.setSelectedTradeIDs = setSelectedTradeIDs;

  appState.setAllPortfolioData = setAllPortfolioData;
  appState.getAllPortfolioData = getAllPortfolioData;

  appState.setPortData = setPortData;
  appState.getPortData = getPortData;

  appState.setDealsData = setDealsData;
  appState.getDealsData = getDealsData;

  appState.setAllDealsData = setAllDealsData;
  appState.getAllDealsData = getAllDealsData;

  appState.setOffersData = setOffersData;
  appState.getOffersData = getOffersData;

  appState.setPortAggData = setPortAggData;
  appState.getPortAggData = getPortAggData;

  return {
    setPortIndex,
    getPortIndex,
    setSelectedPortTableName,
    getSelectedPortTableName,
    setSelectedDealsTableName,
    getSelectedDealsTableName,
    setSelectedTradeIDs,
    setAllPortfolioData,
    getAllPortfolioData,
    setPortAggData,
    getPortAggData,
  };
}
