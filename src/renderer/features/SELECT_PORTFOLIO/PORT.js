import { filterColumnsInData } from '../../core/ui/MODAL_HELPER/dataProcessor.js';
import processData from '../../core/ui/MODAL_HELPER/dataProcessor.js';

// QUICK FIX (funktioniert sofort, aber Entry-Import ist architektonisch unsauber):
import { appState } from '../../renderer.js';

import { addTooltipsForTruncatedText, addProdIdTooltips } from '../../utils/tooltips.js';
import { formatNumberWithGrouping } from '../../utils/format.js';
import { attachIdLinks } from '../../utils/linksToTables.js';
import { applyPortfolioTableColoring } from '../../utils/tableColorize.js';







let tableName = 'Portfolios'
let columns = ['TRADE_ID','PROD_ID', 'DESCRIPTION', 'CATEGORY', 'Depotbank','CouponType', 'MATURITY', 'ISSUER', 'RANK', 'RATING', 'RATINGres', 'C_SPREAD', 'C_SPREAD_BASE','C_SPREAD_DELTA','NOTIONAL', 'PRICE_BUY', 'clean_price', 'NAV', 'PV01rel', 'CPV01rel', 'ytm_BUY', 'ytm', 'ytmPort', 'ytmPortA','PV01', 'CPV01', 'MATURITY_YEAR','TtM'];
let columnsToShow = ['TRADE_ID','PROD_ID', 'DESCRIPTION', 'CATEGORY', 'Depotbank','CouponType', 'MATURITY', 'ISSUER', 'RANK', 'RATING', 'RATINGres', 'clean_price', 'C_SPREAD', 'C_SPREAD_BASE','C_SPREAD_DELTA','NOTIONAL', 'PRICE_BUY', 'NAV', 'PV01rel', 'CPV01rel', 'ytm_BUY', 'ytm', 'MATURITY_YEAR'];
     
const portDataMap = {}; // Speichert Daten pro Container

//    (leer/undefined -> 0, Whitespaces erlaubt, Dezimalpunkt bleibt Dezimalpunkt)
const pf = (v) => {
  if (v == null) return 0;
  const n = parseFloat(String(v).replace(/\s/g, '')); // "2 000.5" -> "2000.5"
  return Number.isFinite(n) ? n : 0;
};

const safeDiv = (num, den) => (den ? num / den : 0);


export function handlePortAggData(receivedData, index, port_name) {
  const elementId = `portDataContainer${index}`;
  const aggContainerId = `portAggDataContainer${index}`;

  if (!portDataMap[elementId]) portDataMap[elementId] = {};

  const portData = filterColumnsInData(receivedData, columns);

  let PortValue = 0;
  let PortValueBuy = 0;     // <-- NEU
  let PortNotional = 0;
  let PortYield = 0;
  let PortYieldA = 0;
  let PortPV01 = 0;
  let PortCPV01 = 0;
  let PortTtM = 0;

  // Aggregation â€“ wie vorher, nur mit pf()
  for (let i = 0; i < portData.length; i++) {
    const r = portData[i];
    const nav      = pf(r.NAV);
    const notional = pf(r.NOTIONAL);

    // NEU: PRICE_BUY in Prozentpunkten -> /100 * Notional
    const priceBuy = pf(r.PRICE_BUY);  // erwartet z.B. 98.75
    PortValueBuy  += (priceBuy / 100) * notional;

    PortValue     += nav;
    PortNotional  += notional;
    PortYield     += pf(r.ytmPort);
    PortYieldA    += pf(r.ytmPortA);
    PortPV01      += pf(r.PV01);
    PortCPV01     += pf(r.CPV01);
    PortTtM       += pf(r.TtM) * notional;
  }

  const aggData = {
    formPortValue:     formatNumberWithGrouping(PortValue) + ' EUR',
    formPortValueBuy:  formatNumberWithGrouping(PortValueBuy) + ' EUR', // <-- NEU
    formPortNotional:  formatNumberWithGrouping(PortNotional) + ' EUR',
    formPortPV01abs:  formatNumberWithGrouping(PortPV01) + ' EUR',
    formPortCPV01abs:  formatNumberWithGrouping(PortCPV01) + ' EUR',
    formPortYield:     (safeDiv(PortYield,  PortNotional) * 100).toFixed(2) + '%',
    formPortYieldA:    (safeDiv(PortYieldA, PortNotional) * 100).toFixed(2) + '%',
    formPortPV01:      (safeDiv(PortPV01,   PortNotional) * 10000).toFixed(2),
    formPortCPV01:     (safeDiv(PortCPV01,  PortNotional) * 10000).toFixed(2),
    formPortTtM:       (safeDiv(PortTtM,    PortNotional)).toFixed(2),
  };

 //Aggregierte werte ins appState setzen:
  appState.setPortAggData(elementId, aggData);



// HTML: nur mit aggKeysToShow

    const aggKeysToShow = [
    'formPortValue',
    'formPortValueBuy',
    'formPortNotional',
    'formPortYield',
    'formPortYieldA',
    'formPortPV01',
    'formPortCPV01',
    'formPortTtM',
    // 'formPortPV01abs', 'formPortCPV01abs' z.B. bewusst weglassen
  ];

  const portDataAggContainer = document.getElementById(aggContainerId);
  if (!portDataAggContainer) return;

  
  requestAnimationFrame(() => {
    // nur ausgewÃ¤hlte Keys ins Table-Objekt
    const filteredAggData = Object.fromEntries(
      Object.entries(aggData).filter(([key]) => aggKeysToShow.includes(key))
    );

    // NAMENSVERGABE fÃ¼r ANZEIGE:
    const tableData = mapPortDataToTableRows(filteredAggData);

    // ANZEIGE:  
    const portDataHTML = processData(tableData, tableName);
    portDataAggContainer.innerHTML = portDataHTML;

    requestAnimationFrame(() => {
      addTooltipsForTruncatedText(portDataAggContainer);
      addProdIdTooltips?.(portDataAggContainer);
      attachIdLinks?.(portDataAggContainer);
    });
  });

}


    function mapPortDataToTableRows(data) {
      return [
        { label: 'Notional', value: data.formPortNotional },
        { label: 'NetAssetValue', value: data.formPortValue },
        { label: 'NetAssetValueBuy', value: data.formPortValueBuy },

        // { label: 'PV01 (abs)', value: data.formPortPV01abs },   // <-- NEU
        // { label: 'CPV01 (abs)', value: data.formPortCPV01abs }, // <-- NEU

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
    let filteredPortData = filterColumnsInData(receivedData, columns); //!!!!! nach Porfolioname
      //console.log("filteredPortData:", filteredPortData);

      appState.setFilteredPortData(filteredPortData);// !!!

    const portDataHTML = processData(filteredColumnsPortData, tableName);
    portDataContainer.innerHTML = portDataHTML;

    applyPortfolioTableColoring(portDataContainer);
    attachIdLinks(portDataContainer);  

    addTooltipsForTruncatedText(portDataContainer);
    addProdIdTooltips(portDataContainer);

  }
}



















