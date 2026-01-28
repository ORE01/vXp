// FRONT_END/UI/bindDropdowns.js
import { rerenderHistoricCharts } from '../../features/ANALYSE_PORTFOLIO/HISTORIC_RISK_METRICS/historicRiskMetrics.js';

const debounce = (fn, ms = 120) => {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
};

const debounceRaf = (fn, ms = 120) => {
  const d = debounce((...args) => requestAnimationFrame(() => fn(...args)), ms);
  return d;
};

function setupDropdown({
  appState,
  dropdownId,
  getDataFunction,
  updateDataFunction,
  updateMvarDataFunction,
  updateCvarDataFunction,
  updateEADDataFunction,
  updateLiquidityDataFunction,
  setSelectedPortTableName,
  setSelectedDealsTableName,
  setActiveTable,
  index,
}) {
  const dropdown = document.getElementById(dropdownId);
  if (!dropdown) return;

  const getData         = getDataFunction?.bind(appState);
  const updateData      = updateDataFunction?.bind(appState);
  const updateMvar      = updateMvarDataFunction?.bind(appState);
  const updateCvar      = updateCvarDataFunction?.bind(appState);
  const updateEAD       = updateEADDataFunction?.bind(appState);
  const updateLiquidity = updateLiquidityDataFunction?.bind(appState);

  const scheduleOptionsUpdate = debounceRaf((selectedTableName) => {
    appState.updateDropdownOptions({
      dropdownElementId: dropdownId,
      getDataFunction: getData,
      updateDataFunction: updateData,
      updateMvarDataFunction: updateMvar,
      updateCvarDataFunction: updateCvar,
      updateEADDataFunction: updateEAD,
      updateLiquidityDataFunction: updateLiquidity,
      selectedTableName,
      index,
    });

    rerenderHistoricCharts({ index, selectedTableName });
  }, 120);

  dropdown.addEventListener('change', (event) => {
    const selectedTableName = event.currentTarget.value;

    if (setSelectedDealsTableName) appState.setSelectedDealsTableName(selectedTableName);
    if (setSelectedPortTableName)  appState.setSelectedPortTableName(selectedTableName);
    if (setActiveTable)            setActiveTable();

    scheduleOptionsUpdate(selectedTableName);
  });
}

export function bindDropdowns({ appState } = {}) {
  if (!appState) throw new Error('[bindDropdowns] appState missing');

  // Deals Dropdown
  setupDropdown({
    appState,
    dropdownId: 'createdDealsDropdown',
    getDataFunction: appState.getDealsNameList,
    updateDataFunction: appState.updateDealsDataTable,
    setSelectedDealsTableName: appState.setSelectedDealsTableName,
    setSelectedPortTableName: appState.setSelectedPortTableName,
    setActiveTable: () => appState.setActiveElementId('dealsDataContainer'),
  });

  // Offers Dropdown
  setupDropdown({
    appState,
    dropdownId: 'createdOffersDropdown',
    getDataFunction: appState.getOffersNameList,
    updateDataFunction: appState.updateOffersDataTable,
    setSelectedDealsTableName: appState.setSelectedDealsTableName,
    setSelectedPortTableName: appState.setSelectedPortTableName,
    setActiveTable: () => appState.setActiveElementId('offersDataContainer'),
  });

  // Portfolio Dropdowns (0,1,2)
  ['0', '1', '2'].forEach((num) => {
    setupDropdown({
      appState,
      dropdownId: `createdPortDropdown${num}`,
      getDataFunction: appState.getPortNameList,
      updateDataFunction: appState.updatePortDataTable,
      updateMvarDataFunction: appState.updateMvarDistData,
      setSelectedPortTableName: appState.setSelectedPortTableName,
      setActiveTable: () => appState.setActiveElementId(`portDataContainer${num}`),
      index: parseInt(num, 10),
    });
  });
}

