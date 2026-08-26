
// Zentrale Format-Konfiguration: EINMAL pflegen    'FORWARDS', 'RATES', 'EUSWAP', 'EUSWAP_SZ1'
const FIELD_FORMAT_CONFIG = {
  COUPON:     { decimals: 3, isPercentage: true, multiplyBy100: true },
  Coupon:     { decimals: 4, isPercentage: true, multiplyBy100: true },
  GEARING:    { decimals: 3, isPercentage: true, multiplyBy100: true },
  FLOOR:      { decimals: 3, isPercentage: true, multiplyBy100: true },
  CAP:        { decimals: 3, isPercentage: true, multiplyBy100: true },
  SPREADS:    { decimals: 3, isPercentage: true, multiplyBy100: true },
  clean_price:{ decimals: 3, isPercentage: true, multiplyBy100: true },
  'Clean Price': { decimals: 3, isPercentage: true, multiplyBy100: true },

  FORWARDS:   { decimals: 3, isPercentage: true, multiplyBy100: true },
  RATES:      { decimals: 3, isPercentage: true, multiplyBy100: true },
  EUSWAP:     { decimals: 3, isPercentage: true, multiplyBy100: true },
  EUSWAP_SZ1: { decimals: 3, isPercentage: true, multiplyBy100: true },
  //value:      { decimals: 3, isPercentage: true, multiplyBy100: true },

  PD:         { decimals: 3, isPercentage: true, multiplyBy100: true },
  PD_M:       { decimals: 3, isPercentage: true, multiplyBy100: true },
  PD_M_norm:  { decimals: 3, isPercentage: true, multiplyBy100: true },
  
  ytm:        { decimals: 3, isPercentage: true, multiplyBy100: true },
  ytm_BUY:    { decimals: 3, isPercentage: true, multiplyBy100: true },
  ytmPort:    { decimals: 3, isPercentage: true, multiplyBy100: true },

  QUANTIL:    { decimals: 4, isPercentage: true, multiplyBy100: false },

  Confidence: { decimals: 2, isPercentage: true, multiplyBy100: true },
  conf_level: { decimals: 2, isPercentage: true, multiplyBy100: true },
  recovery_rate: { decimals: 2, isPercentage: true, multiplyBy100: true },

  red_threshold: { decimals: 2, isPercentage: true, multiplyBy100: true },
  yellow_threshold	: { decimals: 2, isPercentage: true, multiplyBy100: true },
  // recovery_rate: { decimals: 2, isPercentage: true, multiplyBy100: true },
  // recovery_rate: { decimals: 2, isPercentage: true, multiplyBy100: true },

  NOTIONAL:   { decimals: 0, isPercentage: false, multiplyBy100: false },
  Notional:   { decimals: 0, isPercentage: false, multiplyBy100: false },
  EAD:        { decimals: 0, isPercentage: false, multiplyBy100: false },
  LGD:        { decimals: 0, isPercentage: false, multiplyBy100: false },
  LOSS:       { decimals: 0, isPercentage: false, multiplyBy100: false },
  NAV:        { decimals: 0, isPercentage: false, multiplyBy100: false },
  PV01:       { decimals: 1, isPercentage: false, multiplyBy100: false },
  CPV01:      { decimals: 1, isPercentage: false, multiplyBy100: false },

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

// ================================================================
// Zentrales Zahlenformat (eine Quelle der Wahrheit) — de-DE:
//   1.234,56  (Punkt = Tausender, Komma = Dezimal)
// Regel: Rohwert -> Number(v) -> GENAU EINMAL hiermit formatieren.
// Niemals einen bereits formatierten String erneut formatieren.
// ================================================================
export const APP_LOCALE = 'de-DE';

export function fmtNum(value, decimals = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '–';
  return n.toLocaleString(APP_LOCALE, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function fmtPct(value, decimals = 2) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '–';
  return `${fmtNum(n, decimals)} %`;
}

// Einheitlicher kompakter EUR-Betrag (ersetzt Mischformen Mio./mn/M/k/K/bn):
//   >= 1e9 -> "EUR 1,2 Mrd."     >= 1e6 -> "EUR 212,4 Mio."
//   >= 1e3 -> "EUR 260,0 Tsd."   sonst  -> "EUR 875"
// Nachkommastellen: Mrd/Mio(Portfolio)/Tsd = 1 fest; Mio(Risiko) = max 2 (opts.risk);
// unter 1.000 = 0. Vorzeichen steht vor EUR: "-EUR 87,6 Tsd.".
// ZENTRALE EUR-Einheit: steht immer VOR der Zahl. { html:true } wickelt "EUR" in
// <span class="cur-unit"> -> kleinere Darstellung (Groesse zentral via CSS .cur-unit).
// Position (vorne/hinten) und Groesse damit an EINER Stelle aenderbar.
export const eurUnit = (html = false) => (html ? '<span class="cur-unit">EUR</span>' : 'EUR');

export function fmtEurCompact(value, { risk = false, signed = false, html = false } = {}) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '–';
  const neg = n < 0 ? '-' : (signed ? '+' : '');
  const a = Math.abs(n);
  const fixed1 = { minimumFractionDigits: 1, maximumFractionDigits: 1 };
  let scaled, unit, opts;
  if (a >= 1e9)      { scaled = a / 1e9; unit = ' Mrd.'; opts = fixed1; }
  else if (a >= 1e6) { scaled = a / 1e6; unit = ' Mio.'; opts = risk ? { maximumFractionDigits: 2 } : fixed1; }
  else if (a >= 1e3) { scaled = a / 1e3; unit = ' Tsd.'; opts = { maximumFractionDigits: 1 }; }
  else               { scaled = a;       unit = '';      opts = { maximumFractionDigits: 0 }; }
  return `${neg}${eurUnit(html)} ${scaled.toLocaleString(APP_LOCALE, opts)}${unit}`;
}

// Voller EUR-Betrag (keine Kurzform), "EUR" VORNE, Vorzeichen davor ("-EUR 8.275").
// { html:true } -> "EUR" klein (span.cur-unit). Zentraler Ersatz fuer lokale "X EUR"-Helfer.
export function fmtEur(value, { html = false } = {}) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '–';
  const neg = n < 0 ? '-' : '';
  return `${neg}${eurUnit(html)} ${Math.round(Math.abs(n)).toLocaleString(APP_LOCALE)}`;
}

// ---- Eingabe-Pfad (Komma rein -> Punkt in die DB) ----
// parseDeNumber: de-DE-tolerante Nutzereingabe -> echte number (Punkt).
//   - Komma vorhanden  -> Komma = Dezimal, Punkte = Tausender (entfernt): "1.234,56" -> 1234.56
//   - nur Punkte: EIN Punkt = Dezimal ("1.234" -> 1.234, "98.5" -> 98.5);
//                 MEHRERE Punkte = Tausender ("1.234.567" -> 1234567)
//   - entfernt %, Währung, Leerzeichen; echtes Minus (U+2212) -> ASCII.
// NaN wenn nicht parsebar. So gelangt NIE ein Komma in die DB.
export function parseDeNumber(input) {
  if (typeof input === 'number') return input;
  if (input === null || input === undefined) return NaN;
  let s = String(input).trim().replace(/−/g, '-');
  s = s.replace(/[^0-9.,\-]/g, '');
  if (!s || s === '-') return NaN;
  if (s.includes(',')) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if ((s.match(/\./g) || []).length > 1) {
    s = s.replace(/\./g, '');
  }
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : NaN;
}

// toDeInput: Rohwert (number oder Punkt-String aus DB) -> de-DE-Editier-String
// (Punkt -> Komma, KEINE Tausendergruppierung, verlustfrei). Nur bei reiner Zahl;
// Text/Datum bleiben unverändert. Für Prefill von Edit-Feldern.
export function toDeInput(value) {
  if (value === null || value === undefined || value === '') return '';
  const s = String(value).trim();
  if (!/^-?\d*\.?\d+$/.test(s)) return s;
  return s.replace('.', ',');
}

export const formatNumber = (decimals = 0, isPercentage = false, multiplyBy100 = false) => (value) => {
  let number = parseFloat(value);
  if (isNaN(number)) return '-';
  if (multiplyBy100) number *= 100;

  const options = {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  };

  const formattedNumber = number.toLocaleString(APP_LOCALE, options);
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

  // Format the number to three decimal places and add the % sign (de-DE)
  return fmtNum(numericValue, 3) + '%';
}

// Für die Anzeige (z.B. in Edit-Feldern)
export function formatDisplayValue(fieldName, value) {
  if (value === null || value === undefined || value === '') return '';

  // Wenn das Feld in der Prozent-Liste ist → Dezimal (0.2) zu Prozent (20,000%)
  if (PERCENT_DECIMAL_FIELDS.includes(fieldName)) {
    const num = parseFloat(value);
    if (isNaN(num)) return value;

    // de-DE (Komma) für Edit-/Anzeige-Konsistenz; beim Speichern parst
    // formatInputFieldValue via parseDeNumber wieder zu Punkt für die DB.
    return toDeInput((num * 100).toFixed(3)) + '%';
  }

  // Numerische Felder verlustfrei auf Komma-Anzeige (Punkt -> Komma).
  if (COUPON_DECIMAL_FIELDS.has(fieldName)) return toDeInput(value);

  // Alle anderen Felder (Text/Datum/…) unverändert
  return value;
}

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

    const num = parseDeNumber(str);
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

    const num = parseDeNumber(str);
    if (isNaN(num)) {
      return null;
    }

    formattedValue = num / 100;

  } else if (fieldName === 'NOTIONAL') {
    const n = parseDeNumber(formattedValue);
    formattedValue = Number.isFinite(n) ? Math.round(n) : formattedValue;

  } else if (fieldName === 'RATING') {
    formattedValue = String(formattedValue);

  } else if (['a', 'b', 'c', 'd', 'Shift_percent', 'Shift_bp'].includes(fieldName)) {
    formattedValue = parseDeNumber(formattedValue) || 0;
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

  // 0 Nachkommastellen (wie NOTIONAL/NAV typischerweise), de-DE-Gruppierung
  // -> "13.775" (Punkt = Tausender). NICHT re-parsen (siehe fmtNum-Regel oben).
  return Math.round(n).toLocaleString(APP_LOCALE);
}

export function formatPercentage(value) {
  const number = parseFloat(value);
  if (isNaN(number)) return '-';
  return fmtNum(number, 2) + '%';
}


