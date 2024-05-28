import { filterColumnsInData } from './renderer/dataProcessor.js';
import processData from './renderer/dataProcessor.js';
import { handleFormAction } from './renderer/FormButtonHandler.js';

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

  formPortValue = formatNumberWithGrouping(PortValue);
  formPortNotional = formatNumberWithGrouping(PortNotional);

  formPortYield = PortYield/PortValue *100;
  formPortYield = formPortYield.toFixed(2);

  formPortYieldA = PortYieldA/PortValue *100;
  formPortYieldA = formPortYieldA.toFixed(2);

  formPortPV01 = PortPV01/PortValue * 10000;
  formPortPV01 = formPortPV01.toFixed(2);

  formPortCPV01 = PortCPV01/PortValue * 10000;
  formPortCPV01 = formPortCPV01.toFixed(2);
}

// Function to filter data based on current selections in filtersConfig
function filterData(data, filtersConfig) {
  console.log('data, filtersConfig:', data, filtersConfig);
  return data.filter(dataPoint => {
    return Object.entries(filtersConfig).every(([key, valueSet]) => {
      return valueSet.has('ALL') || valueSet.has(dataPoint[key]);
    });
  });
}

export function handlePortMainFilteredData(receivedData, filtersConfig, elementId) {
  console.log('elementId:', elementId);
  console.log('handlePortMainFilteredData:', receivedData);
  const portDataContainer = document.getElementById(elementId);
  const portData = receivedData;

  if (portDataContainer && portData) {
    let filteredPortData = filterColumnsInData(filterData(receivedData, filtersConfig), columns);
   
    // Aggregate NOTIONAL and NAV to calculate total values
    let filteredTotalNav = 0;
    let filteredTotalNotional = 0;
    let filteredTotalYield = 0;
    let filteredTotalYieldA = 0;
    let filteredTotalPV01 = 0;
    let filteredTotalCPV01 = 0;

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

    const formFiltPortValue = formatNumberWithGrouping(filteredPortValue);
    const formFiltPortNotional = formatNumberWithGrouping(filteredPortNotional);
    const formFiltPortYield = filteredPortYield.toFixed(2);
    const formFiltPortYieldA = filteredPortYieldA.toFixed(2);
    const formFiltPortPV01 = filteredPortPV01.toFixed(2);
    const formFiltPortCPV01 = filteredPortCPV01.toFixed(2);

        // Save the values for the current elementId
        savedValues[elementId] = {
          formFiltPortValue,
          formFiltPortNotional,
          formFiltPortYield,
          formFiltPortYieldA,
          formFiltPortPV01,
          formFiltPortCPV01,
        };

    displayValuesForElementId(elementId);

    console.log('formFiltPortValue:', formFiltPortValue);
    console.log('formFiltPortNotional:', formFiltPortNotional);
    console.log('formFiltPortYield:', formFiltPortYield);
    console.log('formFiltPortYieldA:', formFiltPortYieldA);
    console.log('formFiltPortPV01:', formFiltPortPV01);
    console.log('formFiltPortCPV01:', formFiltPortCPV01);

    let filteredPortDataNew = filterColumnsInData(filteredPortData, columnsShowen);
    console.log('filteredPortDataNew:', filteredPortDataNew);

    // Update the HTML content
    const portTableName = appState.getSelectedPortTableName();
    console.log('portTableName:', portTableName);
    const portDataHTML = processData(filteredPortDataNew, portTableName);
    portDataContainer.innerHTML = portDataHTML;
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

function displayValuesForElementId(elementId) {
  const values = savedValues[elementId];
  if (values) {
    switch (elementId) {
      case 'portDataContainer':
        {
          const elements = {
            formFiltPortValue: 'formFiltPortValue',
            formFiltPortNotional: 'formFiltPortNotional',
            formFiltPortYield: 'formFiltPortYield',
            formFiltPortYieldA: 'formFiltPortYieldA',
            formFiltPortPV01: 'formFiltPortPV01',
            formFiltPortCPV01: 'formFiltPortCPV01',
          };
        
          for (const id of Object.values(elements)) {
            const element = document.getElementById(id);
            if (element) {
              element.textContent = values[id];
            }
          }
        }
        break;

      case 'compPortDataContainer':
        {
          const compElements1 = ['formPortNotional1'];

          for (const id of compElements1) {
            const element = document.getElementById(id);
            if (element) {
              element.textContent = values.formFiltPortNotional;
            }
          }
        }
        break;

      case 'compPortDataContainer2':
        {
          const compElements2 = ['formPortNotional2'];

          for (const id of compElements2) {
            const element = document.getElementById(id);
            if (element) {
              element.textContent = values.formFiltPortNotional;
            }
          }
        }
        break;

      default:
        console.log(`No handler for elementId: ${elementId}`);
    }
  } else {
    console.log(`No saved values for ${elementId}`);
  }
}


export {PortValue, PortNotional, PortYield, PortPV01, PortCPV01, formPortValue, formPortNotional, formPortYield, formPortYieldA,  formPortPV01, formPortCPV01, formFiltPortValue, formFiltPortNotional, formFiltPortYield, formFiltPortYieldA, formFiltPortPV01, formFiltPortCPV01};


  