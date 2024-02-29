import { filterColumnsInData } from './renderer/dataProcessor.js';
import processData from './renderer/dataProcessor.js';
import createBarChart from './charts/BarChart.js';
import { filteredEADMainData } from './CVaR.js';

let LossIssuerChart;

export function handleLossIssuerMainData(receivedData) {
  const LossIssuerDataContainer = document.getElementById('LossIssuerDataContainer');
  const EADMainDataContainer = document.getElementById('EADMainDataContainer');
  const LossIssuerData = receivedData;

  // Show the EADMainDataContainer by default
  EADMainDataContainer.style.display = 'block';
  
  // Hide the LossIssuerDataContainer by default
  LossIssuerDataContainer.style.display = 'none';

  if (LossIssuerDataContainer && LossIssuerData) {
    let columns = ['ISSUER', 'LOSS'];
    let filteredLossIssuerData = filterColumnsInData(LossIssuerData, columns);

    // Extract issuer names from filteredEADMainData
    const EADIssuerNames = filteredEADMainData.map(data => data.ISSUER);

    // Sort filteredLossIssuerData based on the order of issuer names from EAD data
    filteredLossIssuerData.sort((a, b) => {
      const issuerA = a.ISSUER;
      const issuerB = b.ISSUER;
      return EADIssuerNames.indexOf(issuerA) - EADIssuerNames.indexOf(issuerB);
    });

    const LossIssuerDataHTML = processData(filteredLossIssuerData, 'sortedLossesIssuerMain');
    LossIssuerDataContainer.innerHTML = LossIssuerDataHTML;

    const LossIssuerLabels = filteredLossIssuerData.map(data => data.ISSUER);
    const LossIssuerValues = filteredLossIssuerData.map(data => data.LOSS);

    // Destroy the existing chart before creating a new one
    if (LossIssuerChart) {
      LossIssuerChart.destroy();
    }

    // Call createBarChart with the formatted data for Loss Issuer chart
    LossIssuerChart = createBarChart({ labels: LossIssuerLabels, datasets: [{ data: LossIssuerValues, backgroundColor: 'rgba(70, 192, 230, 0.7)', borderColor: 'rgba(70, 192, 230, 0.7)' }] }, 'LossIssuerChart', 'bar', 'y');

    // Add click event listeners to the buttons
    const lossIssuerButton = document.querySelector('.chart-button[data-chart="LossIssuerChart"]');
    lossIssuerButton.addEventListener('click', function () {
      // Hide the EADMainDataContainer
      EADMainDataContainer.style.display = 'none';

      // Show the LossIssuerDataContainer
      LossIssuerDataContainer.style.display = 'block';
    });

    const eadButton = document.querySelector('.chart-button[data-chart="EADChart"]');
    const lgdButton = document.querySelector('.chart-button[data-chart="LGDChart"]');
    
    eadButton.addEventListener('click', function () {
      // Show the EADMainDataContainer
      EADMainDataContainer.style.display = 'block';

      // Hide the LossIssuerDataContainer
      LossIssuerDataContainer.style.display = 'none';
    });

    lgdButton.addEventListener('click', function () {
      // Show the EADMainDataContainer
      EADMainDataContainer.style.display = 'block';

      // Hide the LossIssuerDataContainer
      LossIssuerDataContainer.style.display = 'none';
    });
  }
}




