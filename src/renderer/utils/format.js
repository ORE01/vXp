



// Zentrale Format-Konfiguration: EINMAL pflegen    'FORWARDS', 'RATES', 'EUSWAP', 'EUSWAP_SZ1'
const FIELD_FORMAT_CONFIG = {
  COUPON:     { decimals: 4, isPercentage: true, multiplyBy100: true },
  GEARING:    { decimals: 3, isPercentage: true, multiplyBy100: true },
  FLOOR:      { decimals: 3, isPercentage: true, multiplyBy100: true },
  CAP:        { decimals: 3, isPercentage: true, multiplyBy100: true },
  SPREADS:    { decimals: 3, isPercentage: true, multiplyBy100: true },
  clean_price:{ decimals: 3, isPercentage: true, multiplyBy100: true },

  FORWARDS:   { decimals: 3, isPercentage: true, multiplyBy100: true },
  RATES:      { decimals: 3, isPercentage: true, multiplyBy100: true },
  EUSWAP:     { decimals: 3, isPercentage: true, multiplyBy100: true },
  EUSWAP_SZ1: { decimals: 3, isPercentage: true, multiplyBy100: true },

  PD:         { decimals: 3, isPercentage: true, multiplyBy100: true },
  PD_M:       { decimals: 3, isPercentage: true, multiplyBy100: true },
  PD_M_norm:  { decimals: 3, isPercentage: true, multiplyBy100: true },
  
  ytm:        { decimals: 3, isPercentage: true, multiplyBy100: true },
  ytm_BUY:    { decimals: 3, isPercentage: true, multiplyBy100: true },
  ytmPort:    { decimals: 3, isPercentage: true, multiplyBy100: true },

  QUANTIL:    { decimals: 2, isPercentage: true, multiplyBy100: false },

  Confidence: { decimals: 2, isPercentage: true, multiplyBy100: true },
  conf_level: { decimals: 2, isPercentage: true, multiplyBy100: true },
  recovery_rate: { decimals: 2, isPercentage: true, multiplyBy100: true },

  red_threshold: { decimals: 2, isPercentage: true, multiplyBy100: true },
  yellow_threshold	: { decimals: 2, isPercentage: true, multiplyBy100: true },
  // recovery_rate: { decimals: 2, isPercentage: true, multiplyBy100: true },
  // recovery_rate: { decimals: 2, isPercentage: true, multiplyBy100: true },

  NOTIONAL:   { decimals: 0, isPercentage: false, multiplyBy100: false },
  EAD:        { decimals: 0, isPercentage: false, multiplyBy100: false },
  LGD:        { decimals: 0, isPercentage: false, multiplyBy100: false },
  LOSS:       { decimals: 0, isPercentage: false, multiplyBy100: false },
  NAV:        { decimals: 0, isPercentage: false, multiplyBy100: false },
  PV01:       { decimals: 0, isPercentage: false, multiplyBy100: false },
  CPV01:      { decimals: 0, isPercentage: false, multiplyBy100: false },

  PV01rel:    { decimals: 2, isPercentage: false, multiplyBy100: false },
  CPV01rel:   { decimals: 2, isPercentage: false, multiplyBy100: false },
  CPV01_EUR:  { decimals: 2, isPercentage: false, multiplyBy100: false },

  absolute:   { decimals: 0, isPercentage: false, multiplyBy100: false },
  C_SPREAD:        { decimals: 0, isPercentage: false, multiplyBy100: false },
  C_SPREAD_BASE:   { decimals: 0, isPercentage: false, multiplyBy100: false },
  C_SPREAD_DELTA:  { decimals: 0, isPercentage: false, multiplyBy100: false },
};


export const PERCENT_DECIMAL_FIELDS = Object.entries(FIELD_FORMAT_CONFIG)
  .filter(([_, cfg]) => cfg.isPercentage && cfg.multiplyBy100)
  .map(([field]) => field);


export function getFormatRules() {
  const rules = {};

  for (const [field, cfg] of Object.entries(FIELD_FORMAT_CONFIG)) {
    rules[field] = formatNumber(
      cfg.decimals,
      cfg.isPercentage,
      cfg.multiplyBy100
    );
  }

  // Sonderfall MATURITY_YEAR bleibt so wie bisher extra
  rules.MATURITY_YEAR = v =>
    (v == null || v === '')
      ? ''
      : (typeof v === 'number'
          ? String(Math.trunc(v))
          : ((String(v).trim().match(/^(-?\d+)(?:[.,]\d+)?$/) || [,''])[1] || String(v)));

  return rules;
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

// =============================================================================ANZEIGE APP===============================================================
// export function formatDisplayValue(fieldName, value) {
//   if (!value) return ''; // Handle empty values

//   if ([
//     'COUPON', 
//     'FIX_CF', 
//     'GEARING', 
//     'FLOOR', 
//     'CAP', 
//     'SPREADS', 
//     'clean_price', 
//     'FORWARDS', 
//     'RATES', 
//     'EUSWAP',
//     'EUSWAP_SZ1'
//   ].includes(fieldName)) {
  
//     return (parseFloat(value) * 100).toFixed(2) + '%'; // Convert decimal to percentage format
//   }

//   return value; // Return unchanged for other fields
// }

// Für die Anzeige (z.B. in Edit-Feldern)
export function formatDisplayValue(fieldName, value) {
  if (value === null || value === undefined || value === '') return '';

  // Wenn das Feld in der Prozent-Liste ist → Dezimal (0.2) zu Prozent (20.00%)
  if (PERCENT_DECIMAL_FIELDS.includes(fieldName)) {
    const num = parseFloat(value);
    if (isNaN(num)) return value;

    // hier kannst du frei entscheiden, wie viele Nachkommastellen du im Input sehen willst
    // das ist unabhängig von getFormatRules (Tabelle)
    return (num * 100).toFixed(3) + '%';
  }

  // Alle anderen Felder unverändert
  return value;
}

 


  //=============================================================================SPEICHERUNG DB============================================================



// export function formatInputFieldValue(fieldName, value) {
//   let formattedValue = value;

//   // 1) Alle Felder, die in der DB als Dezimal liegen,
//   //    aber im UI als Prozent angezeigt werden
//   if (PERCENT_DECIMAL_FIELDS.includes(fieldName)) {
//     if (formattedValue === null || formattedValue === undefined || formattedValue === '') {
//       return null;
//     }

//     let str = String(formattedValue).trim();

//     // % entfernen, falls der User  "25%" oder "25.00 %" eingibt
//     str = str.replace('%', '').trim();
//     // Komma in Punkt wandeln (z.B. "25,5")
//     str = str.replace(',', '.');

//     const num = parseFloat(str);
//     if (isNaN(num)) {
//       return null; // oder: return formattedValue; wenn du lieber "roh" speicherst
//     }

//     // Zurück in dein DB-Format: 25.00 -> 0.25
//     formattedValue = num / 100;

//   // 2) Ganzzahlige Notional
//   } else if (fieldName === 'NOTIONAL') {
//     formattedValue = parseInt(formattedValue, 10);

//   // 3) Rating als String
//   } else if (fieldName === 'RATING') {
//     formattedValue = String(formattedValue);

//   // 4) Sonstige numerische Felder
//   } else if (['a', 'b', 'c', 'd', 'Shift_percent', 'Shift_bp'].includes(fieldName)) {
//     formattedValue = parseFloat(formattedValue) || 0;
//   }

//   return formattedValue;
// }

// ✅ Ganz oben im Modul platzieren (außerhalb der Funktion)
export const COUPON_DECIMAL_FIELDS = new Set([
  'COUPON', 'FIX_CF', 'GEARING', 'FLOOR', 'CAP', 'SPREADS',
  'clean_price', 'FORWARDS', 'RATES', 'EUSWAP', 'EUSWAP_SZ1'
]);

export function formatInputFieldValue(fieldName, value) {
  let formattedValue = value;

  // ✅ FIX: COUPON & Co. liegen in der DB als Dezimal (0.03),
  // werden im UI aber oft als "3%" oder "3.000%" angezeigt.
  if (COUPON_DECIMAL_FIELDS.has(fieldName)) {
    if (formattedValue === null || formattedValue === undefined || formattedValue === '') {
      return null;
    }

    let str = String(formattedValue).trim();
    const hadPercent = str.includes('%');

    str = str.replace('%', '').trim();
    str = str.replace(',', '.');

    const num = parseFloat(str);
    if (isNaN(num)) return null;

    // 3% / "3.000%"  -> 0.03
    // 3 (ohne %)      -> 0.03 (User tippt Prozent ohne %)
    // 0.03            -> 0.03 (Dezimal bleibt Dezimal)
    formattedValue = (hadPercent || num > 1) ? (num / 100) : num;
    return formattedValue;
  }

  // 1) Alle Felder, die in der DB als Dezimal liegen,
  //    aber im UI als Prozent angezeigt werden
  if (PERCENT_DECIMAL_FIELDS.includes(fieldName)) {
    if (formattedValue === null || formattedValue === undefined || formattedValue === '') {
      return null;
    }

    let str = String(formattedValue).trim();
    str = str.replace('%', '').trim();
    str = str.replace(',', '.');

    const num = parseFloat(str);
    if (isNaN(num)) {
      return null;
    }

    formattedValue = num / 100;

  } else if (fieldName === 'NOTIONAL') {
    formattedValue = parseInt(formattedValue, 10);

  } else if (fieldName === 'RATING') {
    formattedValue = String(formattedValue);

  } else if (['a', 'b', 'c', 'd', 'Shift_percent', 'Shift_bp'].includes(fieldName)) {
    formattedValue = parseFloat(formattedValue) || 0;
  }

  return formattedValue;
}




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
  const n = Number(value);
  if (!Number.isFinite(n)) return '';

  // 0 Nachkommastellen (wie NOTIONAL/NAV typischerweise)
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}


export function formatPercentage(value) {
  const number = parseFloat(value);
  if (isNaN(number)) return '-';
  return number.toFixed(2) + '%';
}


