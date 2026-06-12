'use strict';

import createBarChart from '../../../../charts/BarChart.js';
import { getMarketMvarColors } from '../../../../utils/colors.js';

let mvarRiskTypeVaRRelChart = null;

function getRiskTypeChartColor(riskType) {
  const key = String(riskType || '').toUpperCase().trim();

  if (key === 'TOTAL') return getMarketMvarColors('TOTAL', 1);
  if (key === 'IR') return getMarketMvarColors('IR', 1);
  if (key === 'CS') return getMarketMvarColors('CS', 1);
  if (key === 'VEGA') return getMarketMvarColors('VEGA', 1);
  if (key === 'FX') return getMarketMvarColors('FX', 1);

  return getMarketMvarColors('TOTAL', 1);
}

export function destroyRiskTypeVaRRelChart() {
  const canvas = document.getElementById('MVaRChart');

  if (mvarRiskTypeVaRRelChart) {
    try {
      mvarRiskTypeVaRRelChart.destroy();
    } catch (error) {
      console.warn('[MVaR FactorPL Chart] failed to destroy stored chart instance', error);
    }

    mvarRiskTypeVaRRelChart = null;
  }

  if (canvas && window.Chart?.getChart) {
    const existingChart = window.Chart.getChart(canvas);

    if (existingChart) {
      try {
        existingChart.destroy();
      } catch (error) {
        console.warn('[MVaR FactorPL Chart] failed to destroy canvas chart instance', error);
      }
    }
  }
}

export function renderRiskTypeVaRRelChart(riskTypeRows) {
  const canvas = document.getElementById('MVaRChart');

  if (!canvas) {
    console.warn('[MVaR FactorPL Chart] #MVaRChart missing');
    return;
  }

  destroyRiskTypeVaRRelChart();

  const chartRows = Array.isArray(riskTypeRows)
    ? riskTypeRows.filter(row =>
        row &&
        row.var_rel !== null &&
        row.var_rel !== undefined &&
        Number.isFinite(Number(row.var_rel))
      )
    : [];

  if (!chartRows.length) {
    console.warn('[MVaR FactorPL Chart] no VaR rel rows');
    return;
  }

  // TOTAL must stay first. buildRiskTypeRows already returns TOTAL first.
  const labels = chartRows.map(row => row.risk_type);
  const values = chartRows.map(row => Number(row.var_rel));

  const firstColor = getRiskTypeChartColor(chartRows[0]?.risk_type || 'TOTAL');

  mvarRiskTypeVaRRelChart = createBarChart(
    {
      labels,
      datasets: [
        {
          label: 'VaR rel',
          data: values,
          ...firstColor,
          borderWidth: 1,
        },
      ],
    },
    'MVaRChart',
    'bar',
    'x'
  );

  console.log('[MVaR FactorPL Chart] rendered', {
    labels,
    values,
  });
}