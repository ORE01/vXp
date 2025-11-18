// import { PortValue } from './PORT.js';

// let PortYield;

// export function handleYieldData(Data) {
//   // Check if Data is valid
//   if (!Data || !Array.isArray(Data) || Data.length === 0) {
//     console.error('Invalid or empty data received');
//     return null;
//   }

//   // Initialize variable to sum ytmPort values
//   let sumYtmPort = 0;

//   // Loop through the received data to sum up ytmPort values
//   Data.forEach(item => {
//     if (item.ytmPort !== undefined) {
//       sumYtmPort += item.ytmPort;
//     }
//   });

//   // Calculate the Porfolio Yield
//   PortYield = sumYtmPort / PortValue * 100;

// // Format PortYield as a percentage with two decimal places
// PortYield = PortYield.toFixed(2) + '%';

// //   // Create an object for the calculated YtmPort value
// //   // This is necessary to match the expected input format for processData
// //   const PortYieldData = [{
// //     PortYield: PortYield.toFixed(2) // Assuming you want to format the number to two decimal places
// //   }];

// //   // Generate the HTML table using processData
// //   // Assuming 'PortYield' as the table name or identifier for this specific data format
// //   const tableHTML = processData(PortYieldData, 'PortYield');
  
// //   // Assuming you have a container in your HTML with an ID where you want to display the table
// //   document.getElementById('PortYieldDataContainer').innerHTML = tableHTML;

//   return PortYield;
// }

// export {PortYield} 



//     // Assuming processData can handle this data structure
//     const htmlContent = processData(processDataFormat, 'PortMain');
//     const container = document.getElementById('CRSensDataContainer');
//     if (container) {
//         container.innerHTML = htmlContent;
//     } else {
//         console.error('CRSensDataContainer not found');
//     }

//     // Prepare data for the chart
//    // Prepare chart data using 'weighted_ratings' and 'RATING'
//    const chartData = sortedCPV01.map(([RATING, CPV01]) => {
//     // Calculate the weighted rating as a percentage of CPV01 relative to PortCPV01
//     let weightedRatingPercent = (CPV01 / PortCPV01) * 100;
//     return { RATING, PV01: weightedRatingPercent };
// });
// console.log(chartData);
// createCPV01Chart(chartData);
