// FRONT_END/STATE/nameListsStore.js
// State-only: Tabellen-Listen für Deals/Offers/Port (created*Dropdown sources)

export function installNameListsStore({ appState } = {}) {
  if (!appState) throw new Error('[nameListsStore] appState fehlt');

  // Deals
  function setDealsNameList(receivedData) {
    if (!Array.isArray(receivedData)) {
      console.error("setDealsNameList received non-array data:", receivedData);
      return;
    }
    appState.availableDealsTablesData = {};
    appState.availableDealsTablesArray = [];

    for (const table of receivedData) {
      appState.availableDealsTablesData[table.table_name] = table;
      appState.availableDealsTablesArray.push(table);
    }
    appState.notifyObservers?.();
  }

  function getDealsNameList() {
    return Array.isArray(appState.availableDealsTablesArray) ? appState.availableDealsTablesArray : [];
  }

  // Offers
  function setOffersNameList(receivedData) {
    if (!Array.isArray(receivedData)) {
      console.error("setOffersNameList received non-array data:", receivedData);
      return;
    }
    appState.availableOffersTablesData = {};
    appState.availableOffersTablesArray = [];

    for (const table of receivedData) {
      appState.availableOffersTablesData[table.table_name] = table;
      appState.availableOffersTablesArray.push(table);
    }
    appState.notifyObservers?.();
  }

  function getOffersNameList() {
    return Array.isArray(appState.availableOffersTablesArray) ? appState.availableOffersTablesArray : [];
  }

  // Portfolios
  function setPortNameList(receivedData) {
    if (Array.isArray(receivedData)) {
      appState.availablePortTablesData = {};
      appState.availablePortTablesArray = [];

      for (const table of receivedData) {
        appState.availablePortTablesData[table.table_name] = table;
        appState.availablePortTablesArray.push(table);
      }
      appState.notifyObservers?.();
      return;
    }

    if (receivedData && receivedData.table_name) {
      if (!appState.availablePortTablesData) appState.availablePortTablesData = {};
      if (!Array.isArray(appState.availablePortTablesArray)) appState.availablePortTablesArray = [];

      if (!appState.availablePortTablesData[receivedData.table_name]) {
        appState.availablePortTablesData[receivedData.table_name] = receivedData;
        appState.availablePortTablesArray.push(receivedData);
      }
      appState.notifyObservers?.();
      return;
    }

    console.error("setPortNameList received invalid data:", receivedData);
  }

  function getPortNameList() {
    return Array.isArray(appState.availablePortTablesArray) ? appState.availablePortTablesArray : [];
  }

  // expose
  appState.setDealsNameList = setDealsNameList;
  appState.getDealsNameList = getDealsNameList;

  appState.setOffersNameList = setOffersNameList;
  appState.getOffersNameList = getOffersNameList;

  appState.setPortNameList = setPortNameList;
  appState.getPortNameList = getPortNameList;

  return {
    setDealsNameList,
    getDealsNameList,
    setOffersNameList,
    getOffersNameList,
    setPortNameList,
    getPortNameList,
  };
}
