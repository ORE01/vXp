// Minor change to test git push 1-3-2024 1011

import { PortValue, PortCPV01, formPortCPV01 } from './PORT.js';
import processData from './renderer/dataProcessor.js';
import createBarChart from './charts/BarChart.js';

let CPV01Chart; // This will hold the chart instance

export function handleCSSensData(portMainData) {
    console.log('Aggregating IR Sensitivity Data - Received Data:', portMainData);

    const groupedCPV01 = portMainData.reduce((acc, { CPV01, RATING }) => {
        if (!acc[RATING]) {
            acc[RATING] = 0;
        }
        acc[RATING] += CPV01;
        return acc;
    }, {});

    const ratingsOrder = ['AAA', 'AA+', 'AA', 'AA-', 'A+', 'A', 'A-', 'BBB+', 'BBB', 'BBB-', 'BB+', 'BB', 'BB-'];

    const sortedCPV01 = Object.entries(groupedCPV01).sort((a, b) => {
        return ratingsOrder.indexOf(a[0]) - ratingsOrder.indexOf(b[0]);
    });

    const processDataFormat = sortedCPV01.map(([RATING, CPV01]) => {
        let cpv01Bp = (CPV01 / PortValue) * 10000; // Convert to basis points
        let weightedRatings = (CPV01 / PortCPV01) * 100; // Calculate the weighted rating as a percentage
        return {
            RATING,
            'CPV01': CPV01.toFixed(2),
            'CPV01_bp': `${cpv01Bp.toFixed(2)} bp`,
            'Weighted_Ratings': `${weightedRatings.toFixed(2)}%`
        };
    });

    // Assuming processData can handle this data structure
    const htmlContent = processData(processDataFormat, 'PortMain');
    const container = document.getElementById('CRSensDataContainer');
    if (container) {
        container.innerHTML = htmlContent;
    } else {
        console.error('CRSensDataContainer not found');
    }

    // Prepare data for the chart
   // Prepare chart data using 'weighted_ratings' and 'RATING'
   const chartData = sortedCPV01.map(([RATING, CPV01]) => {
    // Calculate the weighted rating as a percentage of CPV01 relative to PortCPV01
    let weightedRatingPercent = (CPV01 / PortCPV01) * 100;
    return { RATING, PV01: weightedRatingPercent };
});

console.log(chartData);
createCPV01Chart(chartData);
}

function createCPV01Chart(data) {
const labels = data.map(d => d.RATING);
const values = data.map(d => d.PV01); // Now represents 'weighted_ratings'

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
const canvasId = 'CPV01Chart';

// Destroy existing chart instance if it exists
if (CPV01Chart) {
    CPV01Chart.destroy();
}

// Create a new chart instance
CPV01Chart = createBarChart(chartConfig, canvasId, 'bar', 'y');
}

  