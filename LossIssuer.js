import { filterColumnsInData } from './renderer/dataProcessor.js';
import processData from './renderer/dataProcessor.js';
import createBarChart from './charts/BarChart.js';
import { filteredEADMainData, getEADMainDataContainer } from './CVaR.js';

let LossIssuerChart;
let LossIssuerDataContainer;

export function handleLossIssuerMainData(receivedData) {
  // console.log('receivedData:', receivedData)
  LossIssuerDataContainer = document.getElementById('LossIssuerDataContainer');

  if (LossIssuerDataContainer && receivedData) {
    let sortedData = processAndSortLossIssuerData(receivedData);
    const LossIssuerDataHTML = processData(sortedData, 'sortedLossesIssuerMain');
    LossIssuerDataContainer.innerHTML = LossIssuerDataHTML;

    createLossIssuerChart(sortedData);
  }
}

export function setupLossIssuerUI() {
  let EADMainDataContainer = getEADMainDataContainer();
  LossIssuerDataContainer = document.getElementById('LossIssuerDataContainer');

  // Initially hide all containers
  if (EADMainDataContainer) EADMainDataContainer.style.display = 'none';
  if (LossIssuerDataContainer) LossIssuerDataContainer.style.display = 'none';

  setupEventListeners();

}

function setupEventListeners() {
  const lossIssuerButton = document.querySelector('.chart-button[data-chart="LossIssuerChart"]');
  const eadButton = document.querySelector('.chart-button[data-chart="EADChart"]');
  const lgdButton = document.querySelector('.chart-button[data-chart="LGDChart"]');
  
  toggleDisplay('EAD')

  lossIssuerButton.addEventListener('click', () => toggleDisplay('LossIssuer'));
  eadButton.addEventListener('click', () => toggleDisplay('EAD'));
  lgdButton.addEventListener('click', () => toggleDisplay('LGD'));
  
}

function toggleDisplay(chartType) {
  const dataContainers = {
    'EAD': 'EADMainDataContainer',
    'LossIssuer': 'LossIssuerDataContainer'
  };

  const chartContainers = {
    'EAD': 'EADChartContainer',
    'LGD': 'LGDChartContainer', 
    'LossIssuer': 'LossIssuerChartContainer'
  };

 // Toggle data containers
 Object.keys(dataContainers).forEach(key => {
  const container = document.getElementById(dataContainers[key]);
  if (container) {
    container.style.display = (key === chartType || (key === 'EAD' && chartType === 'LGD')) ? 'block' : 'none';
  }
});


  // Toggle chart containers
  Object.keys(chartContainers).forEach(key => {
    const chartContainer = document.getElementById(chartContainers[key]);
    if (chartContainer) {
      chartContainer.style.display = key === chartType ? 'block' : 'none';
    }
  });
}

export function processAndSortLossIssuerData(receivedData) {
  let columns = ['CONVI', 'DEFAULTS', 'ISSUER_RANK', 'LOSS'];
  let filteredData = filterColumnsInData(receivedData, columns);

  // Sort the data
  return filteredData;
}

export function createLossIssuerChart(data) {
  if (LossIssuerChart) {
    LossIssuerChart.destroy();
  }

  const labels = data.map(d => d.ISSUER_RANK);
  const values = data.map(d => d.LOSS);

  LossIssuerChart = createBarChart({ 
    labels: labels, 
    datasets: [{ 
      label: 'Aggregated Losses per Issuer',
      data: values, 
      backgroundColor: 'rgba(70, 192, 230, 0.7)', 
      borderColor: 'rgba(70, 192, 230, 0.7)' 
    }] 
  }, 'LossIssuerChart', 'bar', 'y');
}
