// =============================================================================
// Zentrale Chart-Farben — theme-aware (Light/Dark).
//
// Konzept: EINE Palette aus Basis-Farbtönen (HSL). Pro Theme ändert sich nur die
// INTENSITÄT (Lightness/Sättigung), nicht der Farbton:
//   • Light-Theme (auf Weiß): Basiswerte → satter/dunkler, guter Kontrast.
//   • Dark-Theme  (auf Dunkel): aufgehellt + leicht entsättigt → klar, nicht neon.
//
// Alle Charts holen ihre Farben über die Funktionen unten → zentrale Steuerung.
// Bei Theme-Wechsel ein 'theme:changed'-Event feuern, dann zeichnen die Charts neu.
// =============================================================================

// Moderne, harmonische Qualitativ-Palette als Basis-Farbtöne: [hue, sat%, light%]
const PALETTE_HSL = [
  [212, 65, 48],  // Blue
  [ 24, 80, 52],  // Orange   [174, 58, 40],  // Teal 
  [142, 50, 42],  // Green
  [ 40, 85, 50],  // Amber
  [174, 58, 40],  // Teal     [ 24, 80, 52],  // Orange
  [  4, 70, 53],  // Red
  [262, 48, 56],  // Purple
  [330, 62, 56],  // Pink
  [196, 65, 45],  // Sky
  [ 88, 48, 44],  // Olive
  [238, 50, 60],  // Indigo
  [ 18, 42, 46],  // Brown
  [210, 14, 50],  // Slate
  [300, 45, 50],  // Magenta
];

// Gedeckte, professionelle Palette aus dem Report-Screenshot (Navy → Blau → Teal →
// Gruen → Olive/Gold), auf hellem Grund. ZUSAETZLICH zur Classic-Palette oben —
// die classic bleibt erhalten. Die systemweit aktive Palette steht in ACTIVE_PALETTE.
// Reihenfolge = nach Groesse (Gradient): groesste Kachel/Slice bekommt Index 0
// (navy), dann absteigend blue-dark, blue-steel, ... — genau deine Original-Liste.
const PALETTE_HSL_MUTED = [
  // Original (deine kuratierte vxp-Palette) — UNVERAENDERT, Blautoene bleiben.
  [213, 83, 14],  // navy        #062141
  [212, 46, 32],  // blue-dark   #2C4F77
  [206, 40, 41],  // blue-steel  #3E6D91
  [212, 29, 49],  // blue-muted  #5879A0
  [211, 35, 54],  // blue-soft   #6088B2
  [187, 29, 50],  // teal        #5A9AA3
  [113, 17, 50],  // green       #70956B
  [108, 19, 54],  // green-soft  #7DA174
  [ 64, 32, 60],  // olive       #B5B977
  [194, 14, 57],  // blue-grey   #839AA1
  // NUR ANGEHAENGT: Gold -> Amber -> Orange -> Terracotta -> Rot (nichts ersetzt).
  [ 45, 54, 65],  // gold        #D6BF77
  [ 37, 62, 60],  // amber       #D9A95B
  [ 29, 59, 55],  // orange      #D18B4A
  [ 21, 50, 51],  // burnt       #C06E42
  [ 12, 46, 46],  // terracotta  #AC5540
  [359, 44, 41],  // rot         #973A3C
];

// Systemweit aktive Chart-Palette. Fuer die Classic-Palette: ACTIVE_PALETTE = PALETTE_HSL.
const ACTIVE_PALETTE = PALETTE_HSL_MUTED;

// Legacy-Export (RGB) — nur Kompatibilität, intern nicht mehr genutzt.
export const BASE_COLORS = [
  [255, 0, 0], [255, 255, 0], [0, 255, 255], [173, 255, 47], [255, 105, 180],
];

// ==============================
// Theme-Helfer
// ==============================
function isLightTheme() {
  return typeof document !== 'undefined'
    && !!document.body
    && document.body.classList.contains('light-theme');
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// Basis-HSL → theme-angepasste HSL.
function themed(h, s, l) {
  if (isLightTheme()) {
    return { h, s, l };
  }
  // Dark-Theme: aufhellen + leicht entsättigen (gleicher Farbton).
  return { h, s: clamp(s - 6, 30, 100), l: clamp(l + 14, 0, 74) };
}

function hsla(h, s, l, alpha = 1) {
  return `hsla(${h}, ${s}%, ${l}%, ${alpha})`;
}

// Palette-Eintrag (theme-aware) als {h,s,l}. Nutzt die aktive Palette (ACTIVE_PALETTE).
function paletteHsl(index) {
  const p = ACTIVE_PALETTE;
  const [h, s, l] = p[((index % p.length) + p.length) % p.length];
  return themed(h, s, l);
}

// Aus Basis-HSL ein {backgroundColor, borderColor}-Objekt (Border etwas dunkler).
function colorObjFromHsl({ h, s, l }, alpha = 1) {
  return {
    backgroundColor: hsla(h, s, l, alpha),
    borderColor:     hsla(h, s, clamp(l - 8, 0, 100), 1),
  };
}

// ==============================
// Palette-Funktionen (gleiche Signaturen/Rückgaben wie bisher)
// ==============================

// 1) Einfacher Farbstring (Lines, Bars, Punkte)
export function getColorFromPalette(index, alpha = 1) {
  const { h, s, l } = paletteHsl(index);
  return hsla(h, s, l, alpha);
}

export function getColor(index, alpha = 1) {
  return getColorFromPalette(index, alpha);
}

// 2) Objekt für PieCharts / Legenden (background + border)
export function getColorForPieChart(index, alpha = 1) {
  return colorObjFromHsl(paletteHsl(index), alpha);
}

export function getColorObject(index, alpha = 1) {
  return getColorForPieChart(index, alpha);
}

// ==============================
// Kontrast-Palette (klassische, gut unterscheidbare Farbtoene) — fuer KATEGORIALE
// Charts (z.B. Asset Classes), wo Unterscheidbarkeit wichtiger ist als ein
// Groessen-Gradient. Nutzt IMMER PALETTE_HSL (classic), unabhaengig von ACTIVE_PALETTE.
// ==============================
function classicPaletteHsl(index) {
  const p = PALETTE_HSL;
  const [h, s, l] = p[((index % p.length) + p.length) % p.length];
  return themed(h, s, l);
}

export function getContrastColorForPieChart(index, alpha = 1) {
  return colorObjFromHsl(classicPaletteHsl(index), alpha);
}

export function getContrastColor(index, alpha = 1) {
  const { h, s, l } = classicPaletteHsl(index);
  return hsla(h, s, l, alpha);
}

// ==============================
// Semantische Farben (fester Farbton, theme-aware Intensität)
// ==============================

// Portfolio-Markierung (Pink)
export function getPortfolioColor(alpha = 1) {
  return colorObjFromHsl(themed(330, 72, 52), alpha);
}

// EU-Swap/Yield-Kurve (Blau)
export function getEuswCurveColor(alpha = 1) {
  return colorObjFromHsl(themed(205, 68, 50), alpha);
}

// MVaR-Komponenten
export function getMarketMvarColors(type = 'TOTAL', alpha = 0.25) {
  switch (type) {
    case 'TOTAL': return colorObjFromHsl(themed(354, 68, 50), alpha); // Rot
    case 'IR':    return colorObjFromHsl(themed(205, 68, 50), alpha); // Blau
    case 'CS':    return colorObjFromHsl(themed( 40, 85, 50), alpha); // Amber
    default:      return colorObjFromHsl(themed(210, 10, 60), alpha); // Grau
  }
}

// Sensitivitäten
export function getIrSensitivityColor(alpha = 0.7) {
  return colorObjFromHsl(themed(205, 68, 50), alpha); // Blau
}

export function getCreditSensitivityColor(alpha = 0.7) {
  return colorObjFromHsl(themed(40, 85, 50), alpha);  // Amber
}

// Generisches Amber (z.B. Difference-Balken in Vergleichs-Charts), theme-aware.
export function getAmberColor(alpha = 1) {
  return colorObjFromHsl(themed(40, 85, 50), alpha);
}

// Generisches Rot (z.B. Difference-Balken in Vergleichs-Charts), theme-aware.
export function getRedColor(alpha = 1) {
  return colorObjFromHsl(themed(4, 70, 53), alpha);
}

// Credit-Spread-Serien: index 0 IMMER Rot, sonst aus der Palette.
export function getCSColors(index = 0, alpha = 0.6) {
  if (index === 0) {
    return colorObjFromHsl(themed(4, 70, 53), alpha); // Rot
  }
  return colorObjFromHsl(paletteHsl(index), alpha);
}
