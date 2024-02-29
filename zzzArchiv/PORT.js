import { filterColumnsInData } from './renderer/dataProcessor.js';
import processData from './renderer/dataProcessor.js';

let PortValue;
let PortNotional;
let PortPV01;
//let issuerDropdown;

export function handlePortMainData(receivedData, selectedIssuers) {
  const portDataContainer = document.getElementById('portDataContainer');
  const portData = receivedData;
 

  if (portDataContainer && portData) {
    // Filter the prodData for specific columns
    let columns = ['PROD_ID', 'DESCRIPTION', 'CouponType', 'MATURITY', 'ISSUER', 'RATING', 'C_SPREAD', 'NOTIONAL', 'clean_price', 'NAV', 'PV01'];
    let filteredPortData;

    if (selectedIssuers.includes('ALL')) {
      filteredPortData = filterColumnsInData(portData, columns);
      // console.log('filterColumnsInData1:', filteredPortData); 
    } else {
      // Handle the case when specific issuers are selected
      filteredPortData = filterColumnsInData(
        portData.filter(dataPoint => selectedIssuers.includes(dataPoint.ISSUER)),
        columns
      );
    }
    
    // Aggregate NOTIONAL and NAV to calculate total values
    let totalNav = 0;
    let totalNotional = 0;
    let totalPV01 = 0;

    filteredPortData.forEach((dataPoint) => {
      totalNav += parseFloat(dataPoint.NAV);
      totalNotional += parseFloat(dataPoint.NOTIONAL);
      totalPV01 += parseFloat(dataPoint.PV01);
    });

    PortValue = totalNav;
    PortNotional = totalNotional;
    PortPV01 = -totalPV01/totalNav * 10000;

    function formatNumberWithGrouping(value) {
      return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    }

    const formattedPortValue = formatNumberWithGrouping(PortValue);
    const formattedPortNotional = formatNumberWithGrouping(PortNotional);
    const formattedPortPV01 = PortPV01.toFixed(2);

    // Display the formatted values in the corresponding span elements
    // document.getElementById('issuerDropdown');
    document.getElementById('portValue').textContent = formattedPortValue;
    document.getElementById('portNotional').textContent = formattedPortNotional;
    document.getElementById('portPV01').textContent = formattedPortPV01;

    console.log('PortValue:', PortValue);
    console.log('PortNotional:', PortNotional);
    console.log('PortPV01:', PortPV01);
    // console.log('selectedIssuer:', selectedIssuers);

    columns = ['PROD_ID', 'DESCRIPTION', 'CouponType', 'MATURITY', 'ISSUER', 'RATING', 'C_SPREAD', 'NOTIONAL', 'clean_price', 'NAV'];
  
    if (selectedIssuers.includes('ALL')) {
      filteredPortData = filterColumnsInData(portData, columns);
      // console.log('filterColumnsInData1:', filteredPortData); 
    } else {
      // Handle the case when specific issuers are selected
      filteredPortData = filterColumnsInData(
        portData.filter(dataPoint => selectedIssuers.includes(dataPoint.ISSUER)),
        columns
      );
    }

    const portDataHTML = processData(filteredPortData, 'PortMain');
    portDataContainer.innerHTML = portDataHTML;
  }
}

export { PortValue, PortNotional };

  