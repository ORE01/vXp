// Minor change to test git push 1-3-2024 1011

import processData from '../../UI/MODAL_HELPER/dataProcessor.js';
import createBarChart from '../../../charts/BarChart.js';
import { formatNumberWithGrouping } from '../../../utils/format.js';
import { getCreditSensitivityColor } from '../../../utils/colors.js';

let CPV01Chart; // This will hold the chart instance

export function handleCSSensData(portMainData) {
  // ✅ Immer ein Node zurückgeben
  const wrapper = document.createElement('div');
  wrapper.className = 'csens-wrapper';

  // 🔹 Eingabedaten prüfen
  if (!Array.isArray(portMainData) || portMainData.length === 0) {
    wrapper.textContent = 'No credit spread sensitivities available.';
    return wrapper;
  }

  const portValue = portMainData.reduce((sum, row) => sum + (parseFloat(row.NAV) || 0), 0);
  const portCPV01 = portMainData.reduce((sum, row) => sum + (parseFloat(row.CPV01) || 0), 0);

  if (!Number.isFinite(portValue) || portValue === 0 || !Number.isFinite(portCPV01) || portCPV01 === 0) {
    wrapper.textContent = 'No meaningful credit spread sensitivities (NAV/CPV01 = 0).';
    return wrapper;
  }

  // 🔹 Gruppen nach Rating aufbauen
  const groupedCPV01 = portMainData.reduce((acc, { CPV01, RATING }) => {
    if (!RATING) return acc;
    if (!acc[RATING]) acc[RATING] = 0;
    acc[RATING] += (parseFloat(CPV01) || 0);
    return acc;
  }, {});

  const ratingsOrder = [
    'AAA', 'AA+', 'AA', 'AA-',
    'A+', 'A', 'A-',
    'BBB+', 'BBB', 'BBB-',
    'BB+', 'BB', 'BB-'
  ];

  const sortedCPV01 = Object.entries(groupedCPV01)
    .filter(([, val]) => Number.isFinite(val) && val !== 0)
    .sort((a, b) => ratingsOrder.indexOf(a[0]) - ratingsOrder.indexOf(b[0]));

  if (sortedCPV01.length === 0) {
    wrapper.textContent = 'No credit spread sensitivities per rating.';
    return wrapper;
  }

  // 🔹 Tabelle vorbereiten
  const tableData = sortedCPV01.map(([RATING, CPV01]) => {
    const cpv01Bp        = (CPV01 / portValue)  * 10000; // bp
    const weightedRating = (CPV01 / portCPV01) * 100;    // %

    return {
      RATING,
      CPV01_EUR: formatNumberWithGrouping(CPV01),
      CPV01_bp: `${cpv01Bp.toFixed(2)} bp`,
      Weighted_Ratings: `${weightedRating.toFixed(2)}%`,
    };
  });

  // processData liefert HTML → in wrapper setzen
  wrapper.innerHTML = processData(tableData, 'Portfolios');

  // 🔹 Chart-Daten vorbereiten
  const chartData = sortedCPV01.map(([RATING, CPV01]) => ({
    RATING,
    PV01: (CPV01 / portCPV01) * 100,
  }));

  // Wichtig: Chart-Funktion muss entweder selbst das Canvas finden
  // oder du sorgst dafür, dass das Canvas im wrapper existiert.
  // Wenn createCPV01Chart global auf ein fixes Canvas rendert, kannst du es so lassen:
  if (chartData.length > 0) {
    createCPV01Chart(chartData);
  }

  return wrapper;
}



function createCPV01Chart(data) {
  const labels = data.map(d => d.RATING);
  const values = data.map(d => d.PV01);

  const csColors = getCreditSensitivityColor(0.7);

  const chartConfig = {
    labels,
    datasets: [{
      label: 'CPV01 Weighted Ratings (%)',
      data: values,
      ...csColors,
      borderWidth: 1
    }]
  };

  const canvasId = 'CPV01Chart';

  if (CPV01Chart) CPV01Chart.destroy();

  CPV01Chart = createBarChart(chartConfig, canvasId, 'bar', 'y');
}

  