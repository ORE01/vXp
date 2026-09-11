// ZENTRALE KPI-Karten-Komponente (eine Quelle fuer Aufbau + Wert-Format aller KPI-Kacheln).
// Gibt conc-kpi-Markup zurueck (damit der PDF-Report unveraendert per Klassen liest:
// .conc-kpi-grid .conc-kpi / __val / __val-2nd / __sub / __lbl).
//
// Faehigkeiten (alle optional, Default = neutral):
//  - abs/rel-Wertpaar mit ZENTRALEM Umschalter (getTileMode(tileKey)): grosser Wert = abs oder rel.
//  - Einzelwert (single:'rel'|'abs') fuer Kacheln mit nur einer Zahl (z.B. Rendite) -> kein Umschalter.
//  - Einheit (unit): 'EUR' -> klein VOR der Zahl (.cur-unit); andere ('Jahre'/'bp'/'%'/'x') klein HINTER.
//  - Zahl-Stil: 'compact' (Default; Tsd./Mio./Mrd.) oder 'full' (ganze Zahl).
//  - Zweitwert in Klammern (value2, EDE-Stil), Rahmenfarbe je Metrik (metric; null = neutral),
//    Verbindungszeichen (connector: + = ->), Ampelpunkt (dot), Trendzeile (chg),
//    Zweitlabel (label2), Tooltip (title), dynamische Beschreibung (desc -> data-desc).

import { getTileMode } from '../features/CUSTOMER_SETUP/overviewTilesPanel.js';

const _LOCALE = 'de-DE';
const _DOT = { green: '#2f9e5f', yellow: '#e0a533', red: '#d9534f' };

const _escHtml = (s) => String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const _escAttr = (s) => String(s ?? '').replace(/"/g, '&quot;');

// Betrags-Magnitude (ohne Einheit/Vorzeichen): kompakt Tsd./Mio./Mrd. (1 NK) oder voll.
function _magnitude(a, numberStyle) {
  if (numberStyle === 'full') return Math.round(a).toLocaleString(_LOCALE);
  const f1 = { minimumFractionDigits: 1, maximumFractionDigits: 1 };
  if (a >= 1e9) return `${(a / 1e9).toLocaleString(_LOCALE, f1)} Mrd.`;
  if (a >= 1e6) return `${(a / 1e6).toLocaleString(_LOCALE, f1)} Mio.`;
  if (a >= 1e3) return `${(a / 1e3).toLocaleString(_LOCALE, { maximumFractionDigits: 1 })} Tsd.`;
  return a.toLocaleString(_LOCALE, { maximumFractionDigits: 0 });
}

// Absolutwert -> HTML. Vorzeichen NACH der Einheit, VOR der Zahl (App-Konvention wie kpiValue:
// "EUR -256,3 Tsd."). EUR: "EUR" klein VORNE; andere Einheit ('Jahre'/'bp'/...): klein HINTER.
function _fmtAbs(v, { unit, numberStyle, signed }) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '–';
  const neg = n < 0 ? '-' : (signed && n > 0 ? '+' : '');
  const mag = _magnitude(Math.abs(n), numberStyle);
  return unit === 'EUR'
    ? `<span class="cur-unit">EUR</span> ${neg}${mag}`
    : `${neg}${mag} <span class="cur-unit">${_escHtml(unit)}</span>`;
}

// Relativwert (%) -> Text mit fixen Nachkommastellen (unabhaengig vom Zahl-Stil).
function _fmtRel(v, relDigits) {
  const n = Number(v);
  return Number.isFinite(n)
    ? `${n.toLocaleString(_LOCALE, { minimumFractionDigits: relDigits, maximumFractionDigits: relDigits })} %`
    : '–';
}

export function kpiCard(opts = {}) {
  const {
    tileKey, label, label2, abs, rel, value2 = null,
    single = null, unit = 'EUR', numberStyle = 'compact', relDigits = 2, signed = false,
    metric = null, connector = null, dot = null, chg = null, title, desc,
    caption = null, subText = null, valueHtml = null, pairInline = false, reserveChg = false,
    borderColor = null,
  } = opts;

  const fmtOpts = { unit, numberStyle, signed };
  const absStr = _fmtAbs(abs, fmtOpts);
  const relStr = _fmtRel(rel, relDigits);

  // Grosser Wert + Sub-Zeile. Modi (Prioritaet von oben):
  //  - valueHtml: vorformatierter Wert (z.B. %-Beitraege in Issuers/Products) -> unveraendert.
  //  - single ('rel'/'abs'): genau eine Zahl, keine Sub-Zeile.
  //  - subText gesetzt: abs + rel klein INLINE in __val; __sub = freier Text (Issuers/Products).
  //  - sonst: abs/rel-Swap ueber den zentralen Umschalter (Credit/P&L).
  const _relInline = Number.isFinite(Number(rel)) ? ` <span class="conc-kpi__qual">${relStr}</span>` : '';
  let bigHtml, subHtml;
  if (valueHtml != null) { bigHtml = valueHtml; subHtml = ''; }
  else if (single === 'rel') { bigHtml = relStr; subHtml = ''; }
  else if (single === 'abs') { bigHtml = absStr; subHtml = ''; }
  else if (subText != null) { bigHtml = absStr + _relInline; subHtml = ''; }
  else if (pairInline) {
    // BEIDE Zahlen in EINER Zeile: der per Umschalter gewaehlte Wert gross VORNE, der andere
    // klein/muted DAHINTER. Reihenfolge folgt getTileMode; funktioniert immer (auch bei '–').
    const mode = tileKey ? getTileMode(tileKey) : 'abs';
    const primary = mode === 'rel' ? relStr : absStr;
    const secondary = mode === 'rel' ? absStr : relStr;
    bigHtml = `${primary} <span class="conc-kpi__qual">${secondary}</span>`;
    subHtml = '';
  }
  else {
    const mode = tileKey ? getTileMode(tileKey) : 'abs';
    bigHtml = mode === 'rel' ? relStr : absStr;
    subHtml = mode === 'rel' ? absStr : relStr;
  }
  if (subText != null) subHtml = _escHtml(subText);

  // Zweitwert in Klammern (EDE-Stil): abs in __val-2nd, rel in __sub-2nd.
  const hasV2 = value2 && Number.isFinite(Number(value2.abs));
  const val2Html = hasV2 ? `<span class="conc-kpi__val-2nd">(${_fmtAbs(value2.abs, fmtOpts)})</span>` : '';
  const sub2Html = (hasV2 && Number.isFinite(Number(value2.rel)))
    ? `<span class="conc-kpi__sub-2nd">(${_fmtRel(value2.rel, relDigits)})</span>` : '';

  const dotHtml = (dot && _DOT[dot]) ? `<span class="cr-kpi-dot" style="background:${_DOT[dot]}"></span>` : '';

  // Trendzeile (Market P&L): Kreis-Pfeil-Badge + abs.Aenderung · rel.Aenderung. Mit reserveChg
  // wird die Zeile IMMER gerendert (leer via &nbsp;), damit alle Kacheln gleich hoch/4-zeilig sind.
  const chgHtml = (chg && Number.isFinite(Number(chg.abs)))
    ? `<div class="conc-kpi__chg"><span class="perf-chg-badge ${chg.up ? 'is-down' : 'is-up'}">${chg.up ? '↗' : '↘'}</span>`
      + `${_fmtAbs(chg.abs, fmtOpts)} · ${_fmtRel(chg.rel, relDigits)}</div>`
    : (reserveChg ? '<div class="conc-kpi__chg">&nbsp;</div>' : '');

  const lblHtml = `${_escHtml(label)}${label2 ? ` <span class="conc-kpi__lbl-2nd">${_escHtml(label2)}</span>` : ''}`;
  // Kopfzeile (Ueberschrift) oben in der Kachel — z.B. die beschreibende letzte Zeile von
  // Issuers/Products; analog zur ::before-Kopfzeile der Credit-EC-Kacheln.
  const capHtml = caption ? `<div class="conc-kpi__cap">${_escHtml(caption)}</div>` : '';

  // Freie Rahmenfarbe (z.B. je Faktor): faerbt Rand UND Label (wie die metrik-farbigen Kacheln).
  const _lblStyle = borderColor ? ` style="color:${_escAttr(borderColor)}"` : '';
  const attrs = [
    `class="conc-kpi${metric ? ` conc-kpi--${metric}` : ''}"`,
    borderColor ? `style="border-color:${_escAttr(borderColor)}"` : '',
    tileKey ? `data-tile="${_escAttr(tileKey)}"` : '',
    connector ? `data-conn="${_escAttr(connector)}"` : '',
    desc ? `data-desc="${_escAttr(desc)}"` : '',
    title ? `title="${_escAttr(title)}"` : '',
  ].filter(Boolean).join(' ');

  return `<div ${attrs}>`
    + capHtml
    + `<div class="conc-kpi__val">${bigHtml}${val2Html}${dotHtml}</div>`
    + `<div class="conc-kpi__sub">${subHtml}${sub2Html}</div>`
    + `<div class="conc-kpi__lbl"${_lblStyle}>${lblHtml}</div>`
    + chgHtml
    + `</div>`;
}

// Plain-Text-Variante des Karten-Werts (KOMPAKT: Tsd./Mio./Mrd.) fuer die PDF-Spiegel-Baender
// (data-kpi-band). Liefert exakt das App-Karten-Format ("EUR -253,8 Tsd. · -12,34 %"), aber ohne
// HTML-Spans — so erkennt drawKpiBand das "EUR" per Substring und rendert es klein. Ersetzt das
// bisherige kpiValue({html:false}) (das die volle Zahl "EUR -253.805" liefert) in den Baendern.
export function kpiPlainCompact(abs, rel, { unit = 'EUR', relDigits = 2, numberStyle = 'compact', signed = false } = {}) {
  const a = Number(abs);
  const absStr = Number.isFinite(a)
    ? (() => {
        const sign = a < 0 ? '-' : (signed && a > 0 ? '+' : '');
        const mag = _magnitude(Math.abs(a), numberStyle);
        return unit === 'EUR' ? `EUR ${sign}${mag}` : `${sign}${mag} ${unit}`;
      })()
    : '–';
  const r = Number(rel);
  return Number.isFinite(r) ? `${absStr} · ${_fmtRel(r, relDigits)}` : absStr;
}
