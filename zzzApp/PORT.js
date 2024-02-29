import { filterColumnsInData } from './renderer/dataProcessor.js';
import processData from './renderer/dataProcessor.js';


let columns = ['PROD_ID', 'DESCRIPTION', 'CATEGORY', 'CouponType', 'MATURITY', 'ISSUER', 'RANK', 'RATING', 'C_SPREAD', 'NOTIONAL', 'clean_price', 'NAV', 'PV01'];

let PortValue = 0;
let PortNotional = 0;
let PortPV01 = 0;

let formPortValue;
let formPortNotional;
let formPortPV01;

let formFiltPortValue;
let formFiltPortNotional;
let formFiltPortPV01;



function formatNumberWithGrouping(value) {
  return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}
// function formatNumberWithGrouping(value) {
//   // First, convert the number to a string and split it into integer and decimal parts
//   let parts = value.toString().split('.');

//   // Format the integer part with a period as the thousand separator
//   parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');

//   // Join the integer and decimal parts back together, using a comma as the decimal separator
//   return parts.join(',');
// }


// Adjusted handlePortMainData function
export function handlePortMainData(receivedData) {
  console.log('handlePortMainData - Received Data:', receivedData);

  const portData = filterColumnsInData(receivedData, columns);

  PortValue = 0;
  PortNotional = 0;
  PortPV01 = 0;

  // Aggregate NOTIONAL and NAV to calculate total values
  portData.forEach((dataPoint) => {
    PortValue += parseFloat(dataPoint.NAV);
    PortNotional += parseFloat(dataPoint.NOTIONAL);
    PortPV01+= parseFloat(dataPoint.PV01);
  });

  formPortValue = formatNumberWithGrouping(PortValue);
  formPortNotional = formatNumberWithGrouping(PortNotional);
  formPortPV01 = PortPV01/PortValue * 10000;
  formPortPV01 = formPortPV01.toFixed(2);
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
    let filterdTotalNav = 0;
    let filteredTotalNotional = 0;
    let filteredTotalPV01 = 0;

    filteredPortData.forEach((dataPoint) => {
      filterdTotalNav += parseFloat(dataPoint.NAV);
      filteredTotalNotional += parseFloat(dataPoint.NOTIONAL);
      filteredTotalPV01 += parseFloat(dataPoint.PV01);
    });

    const filteredPortValue = filterdTotalNav;
    const filteredPortNotional = filteredTotalNotional;
    const filteredPortPV01 = -filteredTotalPV01/filterdTotalNav * 10000;

    const formFiltPortValue = formatNumberWithGrouping(filteredPortValue);
    const formFiltPortNotional = formatNumberWithGrouping(filteredPortNotional);
    const formFiltPortPV01 = filteredPortPV01.toFixed(2);

    // Display the formatted values in the corresponding span elements
    document.getElementById('formFiltPortValue').textContent = formFiltPortValue;
    document.getElementById('formFiltPortNotional').textContent = formFiltPortNotional;
    document.getElementById('formFiltPortPV01').textContent = formFiltPortPV01;

    console.log('formFiltPortValue:', formFiltPortValue);
    console.log('formFiltPortNotional:', formFiltPortNotional);
    console.log('formFiltPortPV01:', formFiltPortPV01);

    // Update the HTML content
    const portDataHTML = processData(filteredPortData, 'PortMain');
    portDataContainer.innerHTML = portDataHTML;
  }
}

export {PortValue, PortNotional, PortPV01, formPortValue, formPortNotional, formPortPV01, formFiltPortValue, formFiltPortNotional, formFiltPortPV01};


  