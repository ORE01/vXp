export const BASE_COLORS = [
  [255,   0,   0],  // True Red
  [255, 255,   0],  // Bright Yellow
  [  0, 255, 255],  // Bright Cyan
  [173, 255,  47],  // Bright Green
  [255, 105, 180],  // Hot Pink
  [ 75,   0, 130],  // Indigo
  [255, 140,   0],  // Dark Orange
  [  0, 191, 255],  // Deep Sky Blue
  [ 50, 205,  50],  // Lime Green
  [255,  51, 153],  // Neon Pink
  [  0, 255, 127],  // Spring Green
  [  0, 128, 255],  // Vivid Azure
  [255,   0, 255],  // Magenta
  [255, 165,   0],  // Vibrant Orange
  [  0, 255,  64],  // Neon Green
  [102,  51, 255],  // Electric Purple
  [255,  99,  71],  // Tomato
  [127, 255,   0],  // Chartreuse
  [ 30, 144, 255],  // Dodger Blue
  [255,  20, 147],  // Deep Pink
  [  0, 206, 209],  // Dark Turquoise
  [124, 252,   0],  // Lawn Green
  [255, 215,   0],  // Gold
  [ 65, 105, 225],  // Royal Blue
  [  0, 250, 154],  // Medium Spring Green
  [186,  85, 211],  // Medium Orchid
  [255, 160, 122],  // Light Salmon
  [ 60, 179, 113],  // Medium Sea Green
  [ 72,  61, 139],  // Dark Slate Blue
  [135, 206, 250],  // Light Sky Blue
  [250, 128, 114],  // Salmon
];

// ==============================
// Hilfsfunktionen auf Basis der Palette
// ==============================

// 1) Einfacher Farbstring (z.B. für Lines, Bars, Punkte)
export function getColorFromPalette(index, alpha = 1) {
  const [r, g, b] = BASE_COLORS[index % BASE_COLORS.length];
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Alias, falls du bereits getColor() irgendwo verwendest
export function getColor(index, alpha = 1) {
  return getColorFromPalette(index, alpha);
}

// 2) Objekt für PieCharts / Legenden (background + border)
export function getColorForPieChart(index, alpha = 1) {
  const [r, g, b] = BASE_COLORS[index % BASE_COLORS.length];
  return {
    backgroundColor: `rgba(${r}, ${g}, ${b}, ${alpha})`, // kräftig
    borderColor:     `rgba(${r}, ${g}, ${b}, 1)`,
  };
}

// Alias, falls du bereits getColorObject() verwendest
export function getColorObject(index, alpha = 1) {
  return getColorForPieChart(index, alpha);
}

export function getPortfolioColor(alpha = 1) {
  return {
    backgroundColor: `rgba(255, 20, 147, ${alpha})`,
    borderColor:     `rgba(255, 20, 147, 1)`,
  };
}

export function getEuswCurveColor(alpha = 1) {
  return {
    backgroundColor: `rgba(54, 162, 235, ${alpha})`, // klares Chart-Blau
    borderColor:     `rgba(54, 162, 235, 1)`,
  };
}

export function getMarketMvarColors(type = 'TOTAL', alpha = 0.25) {
  switch (type) {
    case 'TOTAL':
      return {
        backgroundColor: `rgba(220, 53, 69, ${alpha})`,   // Rot / Credit
        borderColor:     `rgba(220, 53, 69, 1)`,
      };

    case 'IR':
      return {
        backgroundColor: `rgba(54, 162, 235, ${alpha})`, // klares Chart-Blau
        borderColor:     `rgba(54, 162, 235, 1)`,
      };

    case 'CS':
      return {
        backgroundColor: `rgba(255, 193, 7, ${alpha})`,   // Gelb
        borderColor:     `rgba(255, 193, 7, 1)`,
      };

    default:
      return {
        backgroundColor: `rgba(200, 200, 200, ${alpha})`,
        borderColor:     `rgba(200, 200, 200, 1)`,
      };
  }
}

export function getIrSensitivityColor(alpha = 0.7) {
  return {
    backgroundColor: `rgba(54, 162, 235, ${alpha})`, // klares Chart-Blau
    borderColor:     `rgba(54, 162, 235, 1)`,
  };
}

export function getCreditSensitivityColor(alpha = 0.7) {
  return {
        backgroundColor: `rgba(255, 193, 7, ${alpha})`,   // Gelb
        borderColor:     `rgba(255, 193, 7, 1)`,
  };
}

export function getCSColors(index = 0, alpha = 0.6) {
  // index 0 soll IMMER True Red sein
  const baseIndex = index === 0 ? 0 : (index % (BASE_COLORS.length - 1)) + 1;
  const [r, g, b] = BASE_COLORS[baseIndex];

  return {
    backgroundColor: `rgba(${r}, ${g}, ${b}, ${alpha})`,
    borderColor:     `rgba(${r}, ${g}, ${b}, 1)`,
  };
}














