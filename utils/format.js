
// diese könnte die wichtigste funktion für die ANZEIGE sein (aber nur ANZEIGE)
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
    'PV01': formatNumber(0),
    'CPV01': formatNumber(0),
    'PV01rel': formatNumber(2),
    'CPV01rel': formatNumber(2),
    'CPV01_EUR': formatNumber(2),
    'absolute': formatNumber(0),
    'C_SPREAD': formatNumber(0),
    'C_SPREAD_BASE': formatNumber(0),
    'C_SPREAD_DELTA': formatNumber(0),
    'MATURITY_YEAR': v => (v == null || v === '') ? '' : (typeof v === 'number' ? String(Math.trunc(v)) : ((String(v).trim().match(/^(-?\d+)(?:[.,]\d+)?$/) || [,''])[1] || String(v))),
  };
}


export const formatNumber = (decimals = 0, isPercentage = false, multiplyBy100 = false) => (value) => {
  let number = parseFloat(value);
  if (isNaN(number)) return '-';
  if (multiplyBy100) number *= 100;

  const options = {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  };

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
    'RATES', 
    'EUSWAP',
    'EUSWAP_SZ1'
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
      fieldName === 'RATES'||
      fieldName === 'EUSWAP'||
      fieldName === 'EUSWAP_SZ1') {
      formattedValue = parseFloat(formattedValue) / 100;
      //console.log('formattedValue:', formattedValue); 

  } else if (fieldName === 'NOTIONAL') {
      formattedValue = parseInt(formattedValue); // Convert to whole number
      //console.log('formattedValue:', formattedValue);
      
  } else if (fieldName === 'RATING') {
    formattedValue = String(formattedValue); // Convert to whole number
    //console.log('formattedValue:', formattedValue);

  } else if (['a', 'b', 'c', 'd', 'Shift_percent', 'Shift_bp'].includes(fieldName)) {
    formattedValue = parseFloat(formattedValue) || 0; // Convert text to number (default to 0)
}

  return formattedValue;
}

// export function convertDateToISO(dateStr) {
//   const parts = dateStr.split('-');
//   if (parts.length === 3) {
//     return `${parts[2]}-${parts[1]}-${parts[0]}`;
//   }
//   return dateStr;
// }
export function convertDateToISO(s) {
  if (!s) return '';
  s = String(s).trim();

  // bereits ISO → so lassen
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // DD-MM-YYYY → YYYY-MM-DD (auch 1/2-stellige D/M erlauben)
  const m = /^(\d{1,2})-(\d{1,2})-(\d{4})$/.exec(s);
  if (m) {
    const dd = m[1].padStart(2, '0');
    const mm = m[2].padStart(2, '0');
    const yy = m[3];
    return `${yy}-${mm}-${dd}`;
  }

  // sonst: unverändert zurück (oder weitere Formate ergänzen)
  return s;
}

export function toISODate(s) {
  if (!s) return '';
  if (s instanceof Date && !isNaN(s)) {
    return s.toISOString().slice(0,10); // YYYY-MM-DD
  }
  s = String(s).trim();

  // Already ISO
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // DD-MM-YYYY → YYYY-MM-DD
  const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(s);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;

  // Fallback: try Date(...)
  const d = new Date(s);
  if (!isNaN(d)) return d.toISOString().slice(0,10);

  return s; // last resort (won’t break SQL), but try to avoid
}







export function formatNumberWithGrouping(value) {
  return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  // return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

export function formatPercentage(value) {
  const number = parseFloat(value);
  if (isNaN(number)) return '-';
  return number.toFixed(2) + '%';
}


