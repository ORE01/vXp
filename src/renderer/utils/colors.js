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

// Palette-Eintrag (theme-aware) als {h,s,l}.
function paletteHsl(index) {
  const [h, s, l] = PALETTE_HSL[((index % PALETTE_HSL.length) + PALETTE_HSL.length) % PALETTE_HSL.length];
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

// Credit-Spread-Serien: index 0 IMMER Rot, sonst aus der Palette.
export function getCSColors(index = 0, alpha = 0.6) {
  if (index === 0) {
    return colorObjFromHsl(themed(4, 70, 53), alpha); // Rot
  }
  return colorObjFromHsl(paletteHsl(index), alpha);
}
