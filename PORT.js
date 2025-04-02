import { filterColumnsInData } from './renderer/dataProcessor.js';
import processData from './renderer/dataProcessor.js';
import { handleFormAction } from './renderer/FormButtonHandler.js';
import { createComparisonCharts} from './COMP.js';
import { appState } from './renderer.js';
import { addTooltipsForTruncatedText, addProdIdTooltips } from './utils/tooltips.js';
import { handleLiquidityData } from './liquidity.js';
import { formatNumberWithGrouping } from './utils/format.js';


let tableName = 'Portfolio'
let columns = ['PROD_ID', 'DESCRIPTION', 'CATEGORY', 'Depotbank','CouponType', 'MATURITY', 'ISSUER', 'RANK', 'RATING', 'RATINGres', 'C_SPREAD', 'NOTIONAL', 'PRICE_BUY', 'clean_price', 'NAV', 'PV01rel', 'CPV01rel', 'ytm_BUY', 'ytm', 'ytmPort', 'ytmPortA','PV01', 'CPV01'];
let columnsToShow = ['PROD_ID', 'DESCRIPTION', 'CATEGORY', 'Depotbank','CouponType', 'MATURITY', 'ISSUER', 'RANK', 'RATING', 'RATINGres', 'C_SPREAD', 'NOTIONAL', 'PRICE_BUY', 'clean_price', 'NAV', 'PV01rel', 'CPV01rel', 'ytm_BUY', 'ytm'];
        function mapPortDataToTableRows(data) {
          return [
            { label: 'Notional', value: data.formPortNotional },
            { label: 'NetAssetValue', value: data.formPortValue },
            { label: 'Portfolio Yield', value: data.formPortYield },
            { label: 'Portfolio Yield (act)', value: data.formPortYieldA },
            { label: 'Interest Rate Sensitivity (PV01)', value: data.formPortPV01 },
            { label: 'Credit Spread Sensitivity (CPV01)', value: data.formPortCPV01 },

            { label: 'MVaR Total', value: data.formPortMvarTOT ?? '–' },
            { label: 'MVaR IR', value: data.formPortMvarIR ?? '–' },
            { label: 'MVaR CS', value: data.formPortMvarCS ?? '–' },

            { label: 'CVaR Rating', value: data.formPortCvarRating ?? '–' },
            { label: 'CVaR Market', value: data.formPortCvarMarket ?? '–' },
            { label: 'CVaR Norm', value: data.formPortCvarNorm ?? '–' },
            
          ];
        }


        
        const portDataMap = {}; // Speichert Daten pro Container
export function handlePortAggData(receivedData, index, port_name) {
  //console.log('portData:', receivedData);
  const elementId = `portDataContainer${index}`;
  const aggContainerId = `portAggDataContainer${index}`;


  if (!portDataMap[elementId]) {
    portDataMap[elementId] = {}; // Falls noch keine Daten gespeichert sind
  }

  const portData = filterColumnsInData(receivedData, columns);

  // VaR-Daten holen
  const cvarData = appState.getAllCvarData();
  
  CvarValues(portDataMap, elementId, port_name, cvarData);

  const mvarData = appState.getAllMvarData();
  //console.log(`mvarData:`, mvarData);

    // Daten vorher filtern
    const filtered = mvarData.filter(
      row => row.port_name === port_name);

  MvarValues(portDataMap, elementId, port_name, filtered);
  
  //console.log('portData:', portData);

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

  // Formatierte Werte speichern
  portDataMap[elementId] = {
    ...portDataMap[elementId], // vorherige Daten (z. B. MVaR/CVaR später)
    formPortValue: formatNumberWithGrouping(PortValue) + " EUR",
    formPortNotional: formatNumberWithGrouping(PortNotional) + " EUR",
    formPortYield: (PortYield / PortValue * 100).toFixed(2) + "%",
    formPortYieldA: (PortYieldA / PortValue * 100).toFixed(2) + "%",
    formPortPV01: (PortPV01 / PortValue * 10000).toFixed(2),
    formPortCPV01: (PortCPV01 / PortValue * 10000).toFixed(2),
  };
  
  //console.log(`✅ Gespeicherte Daten für ${elementId}:`, portDataMap[elementId]);



  // in die AggContainer schreiben:
  const portDataAggContainer = document.getElementById(aggContainerId);

    if (portDataAggContainer) {
      const tableData = mapPortDataToTableRows(portDataMap[elementId]);

      const portDataHTML = processData(tableData, port_name, tableName);
      portDataAggContainer.innerHTML = portDataHTML;
    }  
      createComparisonCharts(portDataMap);

  // // Reset Button
  // const portResetButton = document.getElementById('portResetFiltersButton');
  // if (portResetButton) {
  //   portResetButton.addEventListener('click', () => appState.resetFiltersForActiveTable(receivedData, 'port'));
  // }



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

    const portDataHTML = processData(filteredColumnsPortData, port_name, tableName);
    portDataContainer.innerHTML = portDataHTML;

    addTooltipsForTruncatedText(portDataContainer);
    addProdIdTooltips(portDataContainer); 
  }
}



        function CvarValues(dataMap, elementId, port_name, cvarData) {
          const matchingEntries = cvarData.filter(entry => entry.port_name === port_name);

          if (matchingEntries.length > 0) {
            matchingEntries.forEach((entry) => {
              const rel = (parseFloat(entry.VaR_rel) * 100).toFixed(2) + ' %';

              switch (entry.pd_flag?.toLowerCase()) {
                case 'rating':
                  dataMap[elementId].formPortCvarRating = rel;
                  break;
                case 'market':
                  dataMap[elementId].formPortCvarMarket = rel;
                  break;
                case 'norm':
                  dataMap[elementId].formPortCvarNorm = rel;
                  break;
                default:
                  console.warn(`⚠️ Unknown CVaR type in pd_flag:`, entry.pd_flag);
              }
            });
          } else {
            // Defaults if no data found
            dataMap[elementId].formPortCvarRating = '–';
            dataMap[elementId].formPortCvarMarket = '–';
            dataMap[elementId].formPortCvarNorm = '–';
          }
        }

        function MvarValues(dataMap, elementId, port_name, mvarData) {
          const entry = mvarData.find(e => e.port_name === port_name);

          if (entry) {
            dataMap[elementId].formPortMvarTOT = (parseFloat(entry.VaR_T_rel) * 100).toFixed(2)+ ' %';
            dataMap[elementId].formPortMvarIR = (parseFloat(entry.VaR_IR_rel) * 100).toFixed(2)+ ' %';
            dataMap[elementId].formPortMvarCS = (parseFloat(entry.VaR_CS_rel) * 100).toFixed(2)+ ' %';
          } else {
            dataMap[elementId].formPortMvarTOT = '–';
            dataMap[elementId].formPortMvarIR = '–';
            dataMap[elementId].formPortMvarCS = '–';
          }
        }
  


  