import { filterColumnsInData } from './renderer/dataProcessor.js';
import processData from './renderer/dataProcessor.js';
import { handleFormAction } from './renderer/FormButtonHandler.js';
import { createComparisonCharts} from './COMP.js';
import { appState } from './renderer.js';
import { addTooltipsForTruncatedText, addProdIdTooltips } from './utils/tooltips.js';
import { handleLiquidityData } from './liquidity.js';
import { formatNumberWithGrouping } from './utils/format.js';


let tableName = 'Portfolio'
let columns = ['PROD_ID', 'DESCRIPTION', 'CATEGORY', 'Depotbank','CouponType', 'MATURITY', 'ISSUER', 'RANK', 'RATING', 'RATINGres', 'C_SPREAD', 'NOTIONAL', 'PRICE_BUY', 'clean_price', 'NAV', 'PV01rel', 'CPV01rel', 'ytm_BUY', 'ytm', 'ytmPort', 'ytmPortA','PV01', 'CPV01', 'MATURITY_YEAR'];
let columnsToShow = ['PROD_ID', 'DESCRIPTION', 'CATEGORY', 'Depotbank','CouponType', 'MATURITY', 'ISSUER', 'RANK', 'RATING', 'RATINGres', 'clean_price', 'C_SPREAD', 'NOTIONAL', 'PRICE_BUY', 'NAV', 'PV01rel', 'CPV01rel', 'ytm_BUY', 'ytm', 'MATURITY_YEAR'];
     
const portDataMap = {}; // Speichert Daten pro Container

export function handlePortAggData(receivedData, index, port_name) {
  //console.log('portData:', receivedData);
  const elementId = `portDataContainer${index}`;
  const aggContainerId = `portAggDataContainer${index}`;


  if (!portDataMap[elementId]) {
    portDataMap[elementId] = {}; // Falls noch keine Daten gespeichert sind
  }

  const portData = filterColumnsInData(receivedData, columns);

  let PortValue = 0;
  let PortNotional = 0;
  let PortYield = 0;
  let PortYieldA = 0;
  let PortPV01 = 0;
  let PortCPV01 = 0;

  // Aggregate NOTIONAL und NAV für das aktuelle Dropdown
  portData.forEach((dataPoint) => {
    PortValue += parseFloat(dataPoint.NAV);
    PortNotional += parseFloat(dataPoint.NOTIONAL);
    PortYield += parseFloat(dataPoint.ytmPort);
    PortYieldA += parseFloat(dataPoint.ytmPortA);
    PortPV01 += parseFloat(dataPoint.PV01);
    PortCPV01 += parseFloat(dataPoint.CPV01);
  });


  
  const aggData = {
    formPortValue: formatNumberWithGrouping(PortValue) + " EUR",
    formPortNotional: formatNumberWithGrouping(PortNotional) + " EUR",
    formPortYield: (PortYield / PortValue * 100).toFixed(2) + "%",
    formPortYieldA: (PortYieldA / PortValue * 100).toFixed(2) + "%",
    formPortPV01: (PortPV01 / PortValue * 10000).toFixed(2),
    formPortCPV01: (PortCPV01 / PortValue * 10000).toFixed(2)
  };
  
  appState.setPortAggData(elementId, aggData);
  



  // in die AggContainer schreiben:
  const portDataAggContainer = document.getElementById(aggContainerId);
  if (portDataAggContainer) {
    const tableData = mapPortDataToTableRows(appState.portDataMap[elementId]);
    const portDataHTML = processData(tableData, tableName);
    portDataAggContainer.innerHTML = portDataHTML;
  }
  
      // createComparisonCharts(portDataMap);
}
    function mapPortDataToTableRows(data) {
      return [
        { label: 'Notional', value: data.formPortNotional },
        { label: 'NetAssetValue', value: data.formPortValue },
        { label: 'Portfolio Yield', value: data.formPortYield },
        { label: 'Portfolio Yield (act)', value: data.formPortYieldA },
        { label: 'Interest Rate Sensitivity (PV01)', value: data.formPortPV01 },
        { label: 'Credit Spread Sensitivity (CPV01)', value: data.formPortCPV01 },
      ];
    }

export function handlePortProdData(receivedData, index, port_name) {
  const elementId = `portDataContainer${index}`;
  
  //console.log('Fct: handlePortProdData:');
  //console.log('elementId:', elementId);
  //console.log('receivedData:', receivedData);

  if (!receivedData || !Array.isArray(receivedData) || receivedData.length === 0) {
    console.error('receivedData is not in the expected format or is empty');
    return;
  }

  const portDataContainer = document.getElementById(elementId);

  if (!portDataContainer) {
    console.error(`Element with id ${elementId} not found`);
    return;
  }

  const portData = receivedData;
  
  if (portDataContainer && portData) {
    let filteredColumnsPortData = filterColumnsInData(receivedData, columnsToShow); //!!!!!
      //console.log("filteredColumnsPortData:", filteredColumnsPortData);

      appState.setFilteredPortData(filteredColumnsPortData);// !!!

    const portDataHTML = processData(filteredColumnsPortData, tableName);
    portDataContainer.innerHTML = portDataHTML;

    addTooltipsForTruncatedText(portDataContainer);
    addProdIdTooltips(portDataContainer); 
  }
}
