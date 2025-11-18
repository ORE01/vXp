export function getColorFromPalette(index) {
  const colorPalette = [
    "rgba(255, 255, 0, 1)",     // Bright Yellow
    "rgba(255, 87, 34, 1)",     // Bright Red-Orange
    "rgba(0, 255, 255, 1)",     // Bright Cyan
    "rgba(173, 255, 47, 1)",    // Bright Green
    "rgba(255, 105, 180, 1)",   // Hot Pink
    "rgba(75, 0, 130, 1)",      // Indigo
    "rgba(255, 140, 0, 1)",     // Dark Orange
    "rgba(0, 191, 255, 1)",     // Deep Sky Blue
    "rgba(50, 205, 50, 1)",     // Lime Green
  ];

  // Wrap around the palette if the index exceeds its length
  return colorPalette[index % colorPalette.length];
}

export function getColorForPieChart(index) {
  const baseColors = [
    [255, 255, 0],     // Bright Yellow
    [255, 87, 34],     // Bright Red-Orange
    [0, 255, 255],     // Bright Cyan
    [173, 255, 47],    // Bright Green
    [255, 105, 180],   // Hot Pink
    [75, 0, 130],      // Indigo
    [255, 140, 0],     // Dark Orange
    [0, 191, 255],     // Deep Sky Blue
    [50, 205, 50]      // Lime Green
  ];

  const [r, g, b] = baseColors[index % baseColors.length];

  return {
    backgroundColor: `rgba(${r}, ${g}, ${b}, 0.2)`,
    borderColor: `rgba(${r}, ${g}, ${b}, 1)`
  };
}
