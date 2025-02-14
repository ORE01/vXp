export const formatNumber = (decimals, isPercentage = false, multiplyBy100 = false) => (value) => {
    let number = parseFloat(value);
    if (multiplyBy100) number *= 100; 
    const options = { minimumFractionDigits: decimals, maximumFractionDigits: decimals };
    const formattedNumber = number.toLocaleString('en', options);
    return isPercentage ? `${formattedNumber}%` : formattedNumber;
  };

export function isValidNumber(value) {
  return typeof value === 'number' && !isNaN(value);
}

export function formatNumberWithCommas(value) {
  //console.log('Value received:', value); // Debugging line to log the value
  
  // Check if value is null, undefined, an empty string, or explicitly 'N/A'
  if (value === null || value === undefined || value === '' || String(value).toUpperCase() === 'N/A') {
    return 'run calculation';
  }

  // Convert value to a number and check if it's a valid number
  const numericValue = Number(value);
  if (isNaN(numericValue)) {
    return 'run calculation';
  }

  // Format the number to two decimal places and add the % sign
  return numericValue.toFixed(3) + '%';
}

// Für die Anzeige
export function formatDisplayValue(fieldName, value) {
  if (!value) return ''; // Handle empty values

  if ([
    'COUPON', 
    'FIX_CF', 
    'GEARING', 
    'FLOOR', 
    'CAP', 
    'SPREADS', 
    'clean_price', 
    'FORWARDS', 
    'RATES'
  ].includes(fieldName)) {
  
    return (parseFloat(value) * 100).toFixed(2) + '%'; // Convert decimal to percentage format
  }

  return value; // Return unchanged for other fields
}



  //For SAVING!!!!
export function formatInputFieldValue(fieldName, value) {
  // console.log('fieldNameFF:', fieldName);
  // console.log('value', value);
  let formattedValue = value;

  if (fieldName === 'COUPON' ||
      fieldName === 'FIX_CF' ||
      fieldName === 'GEARING' ||
      fieldName === 'FLOOR' ||
      fieldName === 'CAP' ||
      fieldName === 'SPREADS' ||
      fieldName === 'clean_price' ||
      fieldName === 'FORWARDS' ||
      fieldName === 'RATES') {
      formattedValue = parseFloat(formattedValue) / 100;
      //console.log('formattedValue:', formattedValue); 

  } else if (fieldName === 'NOTIONAL') {
      formattedValue = parseInt(formattedValue); // Convert to whole number
      //console.log('formattedValue:', formattedValue);
      
  } else if (fieldName === 'RATING') {
    formattedValue = String(formattedValue); // Convert to whole number
    //console.log('formattedValue:', formattedValue);
 }

  return formattedValue;
}

export function convertDateToISO(dateStr) {
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return dateStr;
}

export function getFormatRules() {
  return {
    'PD': formatNumber(3, true, true), 
    'PD_M': formatNumber(3, true, true), 
    'PD_M_norm': formatNumber(3, true, true), 
    'ytm': formatNumber(3, true, true), 
    'ytm_BUY': formatNumber(3, true, true), 
    'ytmPort': formatNumber(3, true, true), 
    'CONVI': formatNumber(2, true), 
    'NOTIONAL': formatNumber(0), 
    'EAD': formatNumber(0), 
    'LGD': formatNumber(0),
    'LOSS': formatNumber(0),
    'NAV': formatNumber(0),
    'CPV01': formatNumber(0),
    'absolute': formatNumber(0),
  };
}
export function formatNumberWithGrouping(value) {
  return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  // return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}