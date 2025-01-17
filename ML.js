import { futurePredictionsChart, MLTestDataChart } from './charts/LineChart.js';
import { addTooltipsForTruncatedText } from './utils/tooltips.js';
import { ensureRendered } from './utils/domHelpers.js';


// Handle Future Predictions
export function handleFuturePredictions(receivedData) {
  console.log('FuturePrediction data received:', receivedData);

  if (!Array.isArray(receivedData)) {
      console.error('Invalid data structure:', receivedData);
      return;
  }

  // Extract and map the predictions for the chart with dates and future predictions
  const predictions = receivedData.map(item => ({
      x: new Date(item.Date).toISOString().split('T')[0],  
      y: item.FuturePrediction  // Y values as predictions
  }));

  // Log the predictions to ensure data integrity
  console.log('Predictions data for chart:', predictions);

  if (predictions.length === 0) {
      console.error('No data points found in predictions.');
      return;
  }

  // Prepare datasets for the chart
  const datasets = [{
      label: 'Future Predictions',
      data: predictions,
  }];

  // Create the chart using the provided data and the canvas element ID
  futurePredictionsChart(datasets, 'MLFuturePredictionChart', 'Future Predictions Chart', 3);
}

// Handle Future Predictions
export function handleMLTestData(receivedData) {
    console.log('ML Test data received:', receivedData);
  
    if (!Array.isArray(receivedData)) {
      console.error('Invalid data structure for test data:', receivedData);
      return;
    }

    // Get the current date and calculate the date one year ago
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 5);
  
    // Filter receivedData to only include entries from the last year
    const filteredData = receivedData.filter(item => new Date(item.Date) >= oneYearAgo);

    // Map the filtered data for all the columns in the merged data, format date as 'YYYY-MM-DD'
    const trainData = filteredData.map(item => ({
      x: new Date(item.Date).toISOString().split('T')[0],  // Format to 'YYYY-MM-DD'
      y: item.TrainData !== null ? item.TrainData : null
    })).filter(item => item.y !== null);

    const testData = filteredData.map(item => ({
      x: new Date(item.Date).toISOString().split('T')[0],  // Format to 'YYYY-MM-DD'
      y: item.TestData !== null ? item.TestData : null
    })).filter(item => item.y !== null);

    const predictionsData = filteredData.map(item => ({
      x: new Date(item.Date).toISOString().split('T')[0],  // Format to 'YYYY-MM-DD'
      y: item.Predictions !== null ? item.Predictions : null
    })).filter(item => item.y !== null);

    const futurePredictionsData = filteredData.map(item => ({
      x: new Date(item.Date).toISOString().split('T')[0],  // Format to 'YYYY-MM-DD'
      y: item.FuturePrediction !== null ? item.FuturePrediction : null
    })).filter(item => item.y !== null);

    // Prepare datasets for all four y-axis columns
    const datasets = [
      {
        label: 'Train Data',
        data: trainData,
        borderColor: 'rgba(0, 123, 255, 1)',  // Blue color for TrainData
        fill: false
      },
      {
        label: 'Test Data',
        data: testData,
        borderColor: 'rgba(75, 192, 192, 1)',  // Cyan color for TestData
        fill: false
      },
      {
        label: 'Predictions',
        data: predictionsData,
        borderColor: 'rgba(255, 99, 132, 1)',  // Red color for Predictions
        fill: false
      },
      {
        label: 'Future Predictions',
        data: futurePredictionsData,
        borderColor: 'rgba(255, 206, 86, 1)',  // Yellow color for Future Predictions
        fill: false,
        borderDash: [5, 5]  // Dashed line for future predictions
      }
    ];

    console.log('ML Test data for chart:', datasets);

    // Create the chart using the provided data and the canvas element ID
    MLTestDataChart(datasets, 'MLTestDataChart', 'ML Test Data Chart', 3);
}


export function handleMLTrainedModels(data) {
  const tableBody = document.querySelector('#MLTrainedModelsTable tbody');
  if (!tableBody) {
    console.error('Table body not found.');
    return;
  }

  tableBody.innerHTML = '';

  if (!Array.isArray(data) || data.length === 0) {
    tableBody.innerHTML = '<tr><td colspan="12">No models found.</td></tr>'; // Update colspan for new columns
    return;
  }

  // Populate table rows
  data.forEach((row, index) => {
    const checkboxId = `modelCheckbox_${index}`;
    const optimizer = safeJSONParse(row.optimizer);
    const metrics = safeJSONParse(row.metrics);

    const tableRow = document.createElement('tr');

    tableRow.innerHTML = `
      <td>${row.id || 'N/A'}</td>
      <td>${row.target || 'N/A'}</td>
      <td>${row.modelname || 'N/A'}</td>
      <td>${row.created_at ? new Date(row.created_at).toLocaleString() : 'N/A'}</td>
      <td>${row.model_type || 'N/A'}</td>
      <td>${row.epochs || 'N/A'}</td>
      <td>${row.batch_size || 'N/A'}</td>
      <td>${optimizer?.name || 'N/A'}</td>
      <td>${row.loss || 'N/A'}</td>
      <td>${metrics?.join(', ') || 'N/A'}</td>
      <td>
        <input type="checkbox" id="${checkboxId}" class="model-checkbox" 
              data-modelname="${row.modelname}" 
              data-modeltype="${row.model_type}" 
              data-target="${row.target}" 
              data-epochs="${row.epochs}" 
              data-batch-size="${row.batch_size}" 
              data-optimizer='${JSON.stringify(optimizer || {})}' 
              data-loss="${row.loss || ''}" 
              data-metrics='${JSON.stringify(metrics || [])}'>
        <label for="${checkboxId}">Use Model</label>
      </td>
      <td>
        <button class="edit-button" data-row="${index}" data-id="${row.id}" data-tablename="ML_TrainedModels">Delete</button>
      </td>
    `;

    tableBody.appendChild(tableRow);
  });

  // Ensure DOM rendering before adding tooltips and attaching events
  ensureRendered(() => {
    // Add tooltips for truncated text in the table
    addTooltipsForTruncatedText(tableBody);

    // Checkbox logic
    const checkboxes = document.querySelectorAll('.model-checkbox');
    checkboxes.forEach((checkbox) => {
      checkbox.addEventListener('change', (event) => {
        if (event.target.checked) {
          checkboxes.forEach((cb) => {
            if (cb !== event.target) cb.checked = false;
          });

        // Fetch model details from the selected checkbox
        const modelName = event.target.dataset.modelname || '';
        const modelType = event.target.dataset.modeltype || '';
        const target = event.target.dataset.target || '';
        const epochs = event.target.dataset.epochs || '';
        const batchSize = event.target.dataset.batchSize || '';
        const optimizer = safeJSONParse(event.target.dataset.optimizer);
        const metrics = safeJSONParse(event.target.dataset.metrics) || [];

        // Update app state with the selected model details
        appState.setMLTrainedModel({
          modelName,
          modelType,
          target,
          epochs,
          batchSize,
          optimizer,
          loss: event.target.dataset.loss || '',
          metrics,
        });
        console.log('Current MLTrainedModel:', appState.getMLTrainedModel());
      } else {
        appState.setMLTrainedModel(null); // Clear the state if unchecked
      }
    });
  });
});

  // Delete button logic
  const deleteButtons = document.querySelectorAll('#MLTrainedModelsTable .edit-button');
  deleteButtons.forEach((button) => {
    button.addEventListener('click', (event) => {
      event.stopPropagation(); // Prevent any parent click events

      const tableName = button.getAttribute('data-tablename'); // Table name from button attribute
      const rowIndex = parseInt(button.getAttribute('data-row'), 10); // Row index from button attribute
      const modelId = button.getAttribute('data-id'); // Model ID for deletion

      handleDeleteAction(event, rowIndex, tableName, modelId);
    });
  });
}

// Helper function for safe JSON parsing
function safeJSONParse(jsonString) {
  console.log('Parsing JSON:', jsonString); // Log raw input
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    console.error('Invalid JSON:', jsonString, error);
    return null; // Return null on failure
  }
}

function handleDeleteAction(event, rowIndex, tableName, modelId) {
  const confirmDelete = confirm(`Are you sure you want to delete model ID: ${modelId}?`);
  if (!confirmDelete) return;

  // Send delete request to the backend
  window.api.send('erase-data', { cleanTableName: tableName, uniqueIdentifier: { column: 'id', value: modelId } });

  window.api.once('erase-data-success', () => {
    const tableBody = document.querySelector('#MLTrainedModelsTable tbody');
    const rows = tableBody.querySelectorAll('tr');

    // Remove the row from the DOM
    if (rows[rowIndex]) {
      rows[rowIndex].remove();
    }

    setTimeout(() => {
      const targetInput = document.getElementById('targetInput');
      if (targetInput) targetInput.focus();
    }, 100); // Delay in milliseconds
    

    // Log the active element to confirm
    console.log('Active element after restoring focus:', document.activeElement);
  });

  window.api.once('erase-data-error', (errorMessage) => {
    console.error(`Failed to delete row: ${errorMessage}`);
  });
}



export function handleMLModels(receivedData) {
  console.log('MLModels data received:', receivedData);
  const tableBody = document.querySelector("#MLModelsTable tbody");

  // Clear existing rows in the table
  tableBody.innerHTML = "";

  // Iterate over the received data and create rows
  receivedData.forEach((modelType) => {
    const { id, model_type, description } = modelType;

    // Create a table row
    const row = document.createElement("tr");

    // Add columns for ID, Model Name, and Description
    row.innerHTML = `
      <td>${id}</td>
      <td>${model_type}</td>
      <td>${description}</td>
      <td>
        <input type="checkbox" class="select-model-checkbox" data-model-type="${model_type}">
      </td>
    `;

    // Append the row to the table body
    tableBody.appendChild(row);
  });

  // Ensure DOM rendering before adding tooltips and attaching events
  ensureRendered(() => {
    // Add tooltips for truncated text in the table
    addTooltipsForTruncatedText(tableBody);

    // Add event listeners to the checkboxes
    const checkboxes = document.querySelectorAll(".select-model-checkbox");
    checkboxes.forEach((checkbox) => {
      checkbox.addEventListener("change", (event) => {
        // Uncheck all other checkboxes when one is selected
        if (event.target.checked) {
          checkboxes.forEach((cb) => {
            if (cb !== event.target) {
              cb.checked = false;
            }
          });

          // Set the selected model in the app state
          const selectedModelType = event.target.getAttribute("data-model-type");
          appState.setMLModelType(selectedModelType);
          console.log(`Selected model type: ${selectedModelType}`);
        } else {
          // Clear the selected model if unchecked
          appState.setMLModelType(null);
          console.log("Model Type selection cleared.");
        }
      });
    });
  });
}




  
