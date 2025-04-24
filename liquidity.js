import { appState } from './renderer.js';
import { filterColumnsInData } from './renderer/dataProcessor.js';
import processData from './renderer/dataProcessor.js';
import createBarChart from './charts/BarChart.js';


let liquChart; 

export function handleLiquidityData(filteredData, index, port_name) {

//const columnsToShow = ['PROD_ID', 'CATEGORY', 'Depotbank','CouponType', 'MATURITY', 'ISSUER', 'RANK', 'RATING', 'RATINGres', 'C_SPREAD', 'NOTIONAL', 'PRICE_BUY', 'clean_price', 'NAV'];
const columnsToShow = ['MATURITY', 'NOTIONAL'];

// Daten in der Konsole ausgeben
const elementId = `liquDataContainer`;
const liquDataContainer = document.getElementById(elementId);
const liquData = filteredData;

if (liquDataContainer && liquData) {
    //let filteredColumnsPortData = filterColumnsInData(receivedData, columnsToShow); //!!!!!
    const filteredColumnsPortData = filterColumnsInData(liquData, columnsToShow); //!!!!!
      //console.log("filteredColumnsPortData:", filteredColumnsPortData);

      

    const liquDataHTML = processData(filteredColumnsPortData, 'PortMain');
    liquDataContainer.innerHTML = liquDataHTML;

    // addTooltipsForTruncatedText(portDataContainer);
    // addProdIdTooltips(portDataContainer); 
  }

  console.log('Daten aus appState:', port_name, liquData );

  createLiquChart(liquData);

}


function createLiquChart(data) {
    const labels = data.map(d => d.MATURITY);
    const values = data.map(d => d.NOTIONAL); // Now represents 'weighted_ratings'
    
    const chartConfig = {
        labels: labels,
        datasets: [{
            label: 'CPV01 Weighted Ratings (%)',
            data: values,
            backgroundColor: 'rgba(70, 192, 230, 0.7)',
            borderColor: 'rgba(70, 192, 230, 0.7)',
            borderWidth: 1
        }]
    };
    
    // Specify the element ID where the chart should be rendered
    const canvasId = 'liquChart';
    
    // Destroy existing chart instance if it exists
    if (liquChart) {
        liquChart.destroy();
    }
    
    // Create a new chart instance
    liquChart = createBarChart(chartConfig, canvasId, 'bar', 'y');
    }