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
  console.log('Value received:', value); // Debugging line to log the value
  
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
  return numericValue.toFixed(2) + '%';
}
  
export function formatInputFieldValue(fieldName, value) {
  console.log('fieldNameFF:', fieldName);
  console.log('value', value);
  let formattedValue = value;

  if (fieldName === 'COUPON' ||
      fieldName === 'GEARING' ||
      fieldName === 'FLOOR' ||
      fieldName === 'CAP' ||
      fieldName === 'SPREADS' ||
      fieldName === 'clean_price' ||
      fieldName === 'FORWARDS' ||
      fieldName === 'RATES') {
      formattedValue = parseFloat(formattedValue) / 100;
      console.log('formattedValue:', formattedValue);

  } else if (fieldName === 'NOTIONAL') {
      formattedValue = parseInt(formattedValue); // Convert to whole number
      console.log('formattedValue:', formattedValue);
  } else if (fieldName === 'RATING') {
    formattedValue = String(formattedValue); // Convert to whole number
    console.log('formattedValue:', formattedValue);
 }

  return formattedValue;
}