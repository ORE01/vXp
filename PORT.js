import { filterColumnsInData } from './renderer/dataProcessor.js';
import processData from './renderer/dataProcessor.js';
import { handleFormAction } from './renderer/FormButtonHandler.js';
import { displayValuesForElementId } from './COMP.js';
import { appState } from './renderer.js';
import { addTooltipsForTruncatedText, addProdIdTooltips } from './utils/tooltips.js';
import { handleLiquidityData } from './liquidity.js';

let columns = ['PROD_ID', 'DESCRIPTION', 'CATEGORY', 'Depotbank','CouponType', 'MATURITY', 'ISSUER', 'RANK', 'RATING', 'RATINGres', 'C_SPREAD', 'NOTIONAL', 'PRICE_BUY', 'clean_price', 'NAV', 'PV01', 'CPV01','PV01rel', 'CPV01rel', 'ytm_BUY', 'ytm', 'ytmPort', 'ytmPortA'];
let columnsShowen = ['PROD_ID', 'DESCRIPTION', 'CATEGORY', 'Depotbank', 'CouponType', 'MATURITY', 'ISSUER', 'RANK', 'RATINGres', 'C_SPREAD', 'NOTIONAL', 'clean_price', 'NAV','PV01rel', 'CPV01rel', 'ytm_BUY', 'ytm'];
let PortValue = 0; 
let PortNotional = 0;
let PortYield = 0;
let PortYieldA = 0;
let PortPV01 = 0;
let PortCPV01 = 0;

let formPortValue;
let formPortNotional;
let formPortYield;
let formPortYieldA;
let formPortPV01;
let formPortCPV01;

let formFiltPortValue;
let formFiltPortNotional;
let formFiltPortYield;
let formFiltPortYieldA;
let formFiltPortPV01;
let formFiltPortCPV01;

let savedValues = {};

let mvarTOT;
let mvarIR;
let mvarCS;
let esIR;
let esCS;
let esTOT;

let cvarTOT;
let cesTOT;




function formatNumberWithGrouping(value) {
  return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  // return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}


// Adjusted handlePortMainData function
export function handlePortMainData(receivedData) {
  console.log('handlePortMainData - Received Data:', receivedData);

  const portData = filterColumnsInData(receivedData, columns);

  PortValue = 0;
  PortNotional = 0;
  PortYield = 0;
  PortYieldA = 0;
  PortPV01 = 0;
  PortCPV01 = 0;

  // Aggregate NOTIONAL and NAV to calculate total values
  portData.forEach((dataPoint) => {
    PortValue += parseFloat(dataPoint.NAV);
    PortNotional += parseFloat(dataPoint.NOTIONAL);
    PortYield += parseFloat(dataPoint.ytmPort);
    PortYieldA += parseFloat(dataPoint.ytmPortA);
    PortPV01+= parseFloat(dataPoint.PV01);
    PortCPV01+= parseFloat(dataPoint.CPV01);
  });

  formPortValue = formatNumberWithGrouping(PortValue)+ ' EUR';
  formPortNotional = formatNumberWithGrouping(PortNotional)+ ' EUR';

  formPortYield = PortYield/PortValue *100;
  formPortYield = formPortYield.toFixed(2)+'%';

  formPortYieldA = PortYieldA/PortValue *100;
  formPortYieldA = formPortYieldA.toFixed(2)+'%';

  formPortPV01 = PortPV01/PortValue * 10000;
  formPortPV01 = formPortPV01.toFixed(2);

  formPortCPV01 = PortCPV01/PortValue * 10000;
  formPortCPV01 = formPortCPV01.toFixed(2);
}

// Function to filter data based on current selections in filtersConfig
function filterData(data, filtersConfig) {
  console.log('Function: filterData');
  console.log('data:', data);
  console.log('filtersConfig:', filtersConfig);
  
  return data.filter(dataPoint => {
    return Object.entries(filtersConfig).every(([key, valueSet]) => {
      return valueSet.has('ALL') || valueSet.has(dataPoint[key]);
    });
  });
}

export function handlePortMainFilteredData(receivedData, filtersConfig, elementId) {
  console.log('Fct: handlePortMainFilteredData:');
  console.log('elementId:', elementId);
  console.log('receivedData:', receivedData);

  if (!receivedData || !Array.isArray(receivedData) || receivedData.length === 0) {
    console.error('receivedData is not in the expected format or is empty');
    return;
  }


  const portTableName = appState.getSelectedPortTableName();
  console.log('portTableName:', portTableName);
  const portDataContainer = document.getElementById(elementId);


  const MVaRData = appState.getMvarData();
  console.log('MVaRData:', MVaRData);
  if (!MVaRData) {
    // Set the associated variables to 0
    mvarIR = 0;
    mvarCS = 0;
    mvarTOT = 0;
    esIR = 0;
    esCS = 0;
    esTOT = 0;
  } else {

  [mvarTOT, mvarIR, mvarCS] = MVaRData.map(item => item.VaR);
  [esTOT, esIR, esCS] = MVaRData.map(item => item.ES);
  
  console.log('mvarIR:', mvarIR);
  console.log('mvarCS:', mvarCS);
  console.log('mvarTOT:', mvarTOT);
  console.log('esIR:', esIR);
  console.log('esCS:', esCS);
  console.log('esTOT:', esTOT);
  };

  const CVaRData = appState.getCvarData();

  if (!CVaRData) {
    // Set the associated variables to 0

    cvarTOT = 0;

    cesTOT = 0;
  } else {

  [cvarTOT] = CVaRData.map(item => item.VaR);
  [cesTOT] = CVaRData.map(item => item.ES);

  console.log('cvarTOT:', cvarTOT);
  console.log('cesTOT:', cesTOT);
  };

  if (!portDataContainer) {
    console.error(`Element with id ${elementId} not found`);
    return;
  }

  console.log('Before filtering: receivedData:', receivedData);
  console.log('filtersConfig:', filtersConfig);

  const portData = receivedData;
  console.log('portData:', portData);

  if (portDataContainer && portData) {
    let filteredPortData = filterColumnsInData(filterData(receivedData, filtersConfig), columns);
    console.log('filteredPortData:', filteredPortData);

    appState.setFilteredPortData(filteredPortData);
    handleLiquidityData();

   
    // Aggregate NOTIONAL and NAV to calculate total values
    let filteredTotalNav = 0;
    let filteredTotalNotional = 0;
    let filteredTotalYield = 0;
    let filteredTotalYieldA = 0;
    let filteredTotalPV01 = 0;
    let filteredTotalCPV01 = 0;
    //let formMvarTOT;

    filteredPortData.forEach((dataPoint) => {
      filteredTotalNav += parseFloat(dataPoint.NAV);
      filteredTotalNotional += parseFloat(dataPoint.NOTIONAL);
      filteredTotalYield += parseFloat(dataPoint.ytmPort);
      filteredTotalYieldA += parseFloat(dataPoint.ytmPortA);
      filteredTotalPV01 += parseFloat(dataPoint.PV01);
      filteredTotalCPV01 += parseFloat(dataPoint.CPV01);
      
    });



    const filteredPortValue = filteredTotalNav;
    const filteredPortNotional = filteredTotalNotional;
    const filteredPortYield = filteredTotalYield/filteredTotalNav * 100;
    const filteredPortYieldA = filteredTotalYieldA/filteredTotalNav * 100;
    const filteredPortPV01 = filteredTotalPV01/filteredTotalNav * 10000;
    const filteredPortCPV01 = filteredTotalCPV01/filteredTotalNav * 10000;

    const formFiltPortValue = formatNumberWithGrouping(filteredPortValue)+' EUR';
    const formFiltPortNotional = formatNumberWithGrouping(filteredPortNotional)+' EUR';
    const formFiltPortYield = filteredPortYield.toFixed(2)+'%';
    const formFiltPortYieldA = filteredPortYieldA.toFixed(2)+'%';

    const formFiltPortPV01 = filteredPortPV01.toFixed(2);
    const formFiltPortCPV01 = filteredPortCPV01.toFixed(2);

    const formMvarTOT = (parseFloat(mvarTOT) ).toFixed(2)+'%';
    const formMvarIR = (parseFloat(mvarIR) ).toFixed(2)+'%';
    const formMvarCS = (parseFloat(mvarCS) ).toFixed(2)+'%';

    const formCvarTOT = (parseFloat(cvarTOT) * 100).toFixed(2)+'%';

  console.log('formMvarTOT:', formMvarTOT);

    // elementId: Save the values
        savedValues[elementId] = {
          formFiltPortValue,
          formFiltPortNotional,
          formFiltPortYield,
          formFiltPortYieldA,
          formFiltPortPV01,
          formFiltPortCPV01,

          formPortMvarTOT:formMvarTOT,
          formPortMvarIR:formMvarIR,
          formPortMvarCS:formMvarCS,

          formPortCvarTOT:formCvarTOT,

          formPortValue1: formFiltPortValue,
          formPortNotional1: formFiltPortNotional,
          formPortYield1: formFiltPortYield,
          formPortYieldA1: formFiltPortYieldA,

          formPortPV011: formFiltPortPV01,
          formPortCPV011: formFiltPortCPV01,

          formPortMvarTOT1:formMvarTOT,
          formPortMvarIR1:formMvarIR,
          formPortMvarCS1:formMvarCS,

          formPortCvarTOT1:formCvarTOT,

          formPortValue2: formFiltPortValue,
          formPortNotional2: formFiltPortNotional,
          formPortYield2: formFiltPortYield,
          formPortYieldA2: formFiltPortYieldA,
          
          formPortPV012: formFiltPortPV01,
          formPortCPV012: formFiltPortCPV01,

          formPortMvarTOT2:formMvarTOT,
          formPortMvarIR2:formMvarIR,
          formPortMvarCS2:formMvarCS,

          formPortCvarTOT2:formCvarTOT,
        };


console.log('savedValues[elementId] :', savedValues[elementId] );


    displayValuesForElementId(elementId, savedValues);


    console.log('formFiltPortValue:', formFiltPortValue);
    console.log('formFiltPortNotional:', formFiltPortNotional);
    console.log('formFiltPortYield:', formFiltPortYield);
    console.log('formFiltPortYieldA:', formFiltPortYieldA);
    console.log('formFiltPortPV01:', formFiltPortPV01);
    console.log('formFiltPortCPV01:', formFiltPortCPV01);
    console.log('mvarTOT:', formMvarTOT);
    console.log('cvarTOT:', formCvarTOT);

    let filteredPortDataNew = filterColumnsInData(filteredPortData, columnsShowen);
    console.log('filteredPortDataNew:', filteredPortDataNew);

    // Update the HTML content
    // const portTableName = appState.getSelectedPortTableName();
    // console.log('portTableName:', portTableName);
    const portDataHTML = processData(filteredPortDataNew, portTableName);
    portDataContainer.innerHTML = portDataHTML;

    addTooltipsForTruncatedText(portDataContainer);
    addProdIdTooltips(portDataContainer); 
  }
    // Edit Buttons
    const portEditButtons = document.querySelectorAll('#portDataContainer .edit-button');
    portEditButtons.forEach((button) => {
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        const tableName = appState.getSelectedPortTableName();
        const actionType = 'edit';
        const rowIndex = parseInt(button.getAttribute('data-row'), 10);
        handleFormAction(event, portData, rowIndex, tableName, actionType);
      });
    });

      // PDF Button
      const portAddButton = document.getElementById('portAddButton');
      portAddButton.addEventListener('click', (event) => {
        const tableName = appState.getSelectedPortTableName();
        const actionType = 'add';
        handleFormAction(event, portData, null, tableName, actionType);
      });
      

}

export {PortValue, 
        PortNotional, 
        PortYield, 
        PortPV01, 
        PortCPV01, 
        formPortValue, 
        formPortNotional, 
        formPortYield, 
        formPortYieldA,  
        formPortPV01, 
        formPortCPV01, 
        formFiltPortValue, 
        formFiltPortNotional, 
        formFiltPortYield, 
        formFiltPortYieldA, 
        formFiltPortPV01, 
        formFiltPortCPV01
};


  