import { filterColumnsInData } from './renderer/dataProcessor.js';
import processData from './renderer/dataProcessor.js';


let columns = ['PROD_ID', 'DESCRIPTION', 'CATEGORY', 'CouponType', 'MATURITY', 'ISSUER', 'RANK', 'RATING', 'C_SPREAD', 'NOTIONAL', 'PRICE_BUY', 'clean_price', 'NAV', 'PV01', 'CPV01','PV01rel', 'CPV01rel', 'ytm_BUY', 'ytm', 'ytmPort', 'ytmPortA'];
let columnsShowen = ['PROD_ID', 'DESCRIPTION', 'CATEGORY', 'CouponType', 'MATURITY', 'ISSUER', 'RANK', 'RATING', 'C_SPREAD', 'NOTIONAL', 'clean_price', 'NAV','PV01rel', 'CPV01rel', 'ytm_BUY', 'ytm'];
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
  return data.filter(dataPoint => {
    return Object.entries(filtersConfig).every(([key, valueSet]) => {
      return valueSet.has('ALL') || valueSet.has(dataPoint[key]);
    });
  });
}

export function handlePortMainFilteredData(receivedData, filtersConfig) {
  console.log('handlePortMainData - Received Data:', receivedData);
  const portDataContainer = document.getElementById('portDataContainer');
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

    // Display the formatted values in the corresponding span elements
    document.getElementById('formFiltPortValue').textContent = formFiltPortValue;
    document.getElementById('formFiltPortNotional').textContent = formFiltPortNotional;
    document.getElementById('formFiltPortYield').textContent = formFiltPortYield;
    document.getElementById('formFiltPortYieldA').textContent = formFiltPortYieldA;
    document.getElementById('formFiltPortPV01').textContent = formFiltPortPV01;
    document.getElementById('formFiltPortCPV01').textContent = formFiltPortCPV01;

    console.log('formFiltPortValue:', formFiltPortValue);
    console.log('formFiltPortNotional:', formFiltPortNotional);
    console.log('formFiltPortYield:', formFiltPortYield);
    console.log('formFiltPortYieldA:', formFiltPortYieldA);
    console.log('formFiltPortPV01:', formFiltPortPV01);
    console.log('formFiltPortCPV01:', formFiltPortCPV01);

    let filteredPortDataNew = filterColumnsInData(filteredPortData, columnsShowen);

    // Update the HTML content
    const portDataHTML = processData(filteredPortDataNew, 'PortMain');
    portDataContainer.innerHTML = portDataHTML;
  }
}

export {PortValue, PortNotional, PortYield, PortPV01, PortCPV01, formPortValue, formPortNotional, formPortYield, formPortYieldA,  formPortPV01, formPortCPV01, formFiltPortValue, formFiltPortNotional, formFiltPortYield, formFiltPortYieldA, formFiltPortPV01, formFiltPortCPV01};


  