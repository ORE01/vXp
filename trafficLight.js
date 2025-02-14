function handleTrafficLight(ratingData, normData) {
    // console.log("Raw Rating Data:", ratingData);
    // console.log("Raw Norm Data:", normData);

    // Extract the LOSS values
    const ratingLosses = ratingData
    const normLosses = normData

    // console.log("Extracted Rating Losses:", ratingLosses);
    // console.log("Extracted Norm Losses:", normLosses);
    


    // Validate data length
    if (ratingLosses.length < 10 || normLosses.length < 10) {
        console.error("Insufficient data for traffic light calculation.");
        return;
    }

    // Take first 10 values and calculate averages
    const ratingAvg = ratingLosses.slice(0, 10).reduce((sum, val) => sum + val, 0) / 10;
    const normAvg = normLosses.slice(0, 10).reduce((sum, val) => sum + val, 0) / 10;

    //console.log(`Rating Avg: ${ratingAvg}, Norm Avg: ${normAvg}`);

    // Calculate the percentage difference
    const differencePercent = Math.abs((normAvg - ratingAvg)/ratingAvg ) * 100;

    //console.log(`Percentage Difference: ${differencePercent}%`);

    // Update traffic light based on thresholds
    if (differencePercent > 20) {
        updateTrafficLight('red');
    } else if (differencePercent > 10) {
        updateTrafficLight('yellow');
    } else {
        updateTrafficLight('green');
    }
}

// Function to update the traffic light state
function updateTrafficLight(state) {
    const redLight = document.getElementById('red');
    const yellowLight = document.getElementById('yellow');
    const greenLight = document.getElementById('green');

    if (!redLight || !yellowLight || !greenLight) {
        console.error("Traffic light elements not found in the DOM.");
        return;
    }

    // Remove active class from all lights
    redLight.classList.remove('active');
    yellowLight.classList.remove('active');
    greenLight.classList.remove('active');

    // Add active class based on the current state
    if (state === 'green') {
        greenLight.classList.add('active');
    } else if (state === 'yellow') {
        yellowLight.classList.add('active');
    } else if (state === 'red') {
        redLight.classList.add('active');
    }
}



// Attach functions to the global `window` object for access
window.handleTrafficLight = handleTrafficLight;