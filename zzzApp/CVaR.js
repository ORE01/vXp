import { filterColumnsInData } from './renderer/dataProcessor.js';
import processData from './renderer/dataProcessor.js';
import createBarChart from './charts/BarChart.js';

let EADChart;
let LGDChart;
let filteredEADMainData = [];

export function handleEADMainData(receivedData) {
  const EADMainDataContainer = document.getElementById('EADMainDataContainer');
  const EADMainData = receivedData;

  if (EADMainDataContainer && EADMainData) {
    let columns = ['ISSUER', 'RATING', 'NOTIONAL', 'LGD', 'PD'];
    filteredEADMainData = filterColumnsInData(EADMainData, columns);
    if (EADChart) {EADChart.destroy();}
    if (LGDChart) {LGDChart.destroy();}

    // Sort the data by the "NOTIONAL" in descending order
    filteredEADMainData.sort((a, b) => parseFloat(b.NOTIONAL.replace(/\s/g, '')) - parseFloat(a.NOTIONAL.replace(/\s/g, '')));

    const EADMainDataHTML = processData(filteredEADMainData, 'EADMain');
    EADMainDataContainer.innerHTML = EADMainDataHTML;

    // Format the data for the EAD bar chart
    const EADLabels = filteredEADMainData.map(data => data.ISSUER);
    //NOTIONAL is a string!
    const EADValues = filteredEADMainData.map(data => parseFloat(data.NOTIONAL.replace(/\s/g, '')));

    // Call createBarChart with the formatted data for EAD chart
    EADChart = createBarChart({ labels: EADLabels, datasets: [{ data: EADValues, backgroundColor: 'rgba(70, 192, 230, 0.7)', borderColor: 'rgba(70, 192, 230, 0.7)' }] }, 'EADChart', 'bar', 'y');
    
    // Format the data for the LGD bar chart
    const LGDValues = filteredEADMainData.map(data => parseFloat(data.LGD.toString().replace(/\s/g, '')));
    //console.log('LGDvalues:', LGDValues);

    // Create the combined dataset for EAD and LGD
    const combinedDataset = [
      {
        label: 'EAD',
        data: EADValues,
        backgroundColor: 'rgba(70, 192, 230, 0.7)',
        borderColor: 'rgba(70, 192, 230, 0.7)',
        borderWidth: 1,
      },
      {
        label: 'LGD',
        data: LGDValues,
        backgroundColor: 'rgba(255, 0, 0)',
        borderColor: 'rgba(255, 0, 0)',
        borderWidth: 1,
      },
    ];
    //console.log('combinedDatasets:', combinedDataset);
    
    // Call createBarChart with the combined datasets for EAD and LGD chart
    const combinedLabels = EADLabels;
    LGDChart = createBarChart({ labels: combinedLabels, datasets: combinedDataset }, 'LGDChart', 'bar', 'y');
    //LGDChart = createBarChart({ labels: combinedLabels, datasets: combinedDataset }, 'LGDChart', 'bar', 'y');

    //console.log('EADMain:', EADMainData);
  }
}

export { filteredEADMainData };
