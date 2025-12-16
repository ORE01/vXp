const colorScale = [
  [0.0,  '#1a1a1a'],   // very dark
  [0.25, '#0e3a60'],   // tiefes Stahlblau
  [0.50, '#1565c0'],   // mittleres Blau
  [0.75, '#29b6f6'],   // Cyan
  [1.0,  '#80deea']    // helles Aqua als Highlight
];



export function renderVolSurfacePanel() {
  const targetId = 'swaption-atm-surface-3d';
  const el = document.getElementById(targetId);

  if (!el) {
    console.warn(`[renderVolSurfacePanel] Element mit id="${targetId}" nicht gefunden.`);
    return;
  }

  if (typeof Plotly === 'undefined') {
    console.error('[renderVolSurfacePanel] Plotly ist undefined.');
    return;
  }

  const atm = appState && appState.swaptionATM;
  if (!atm) {
    console.warn('[renderVolSurfacePanel] Keine swaptionATM-Daten im appState.');
    return;
  }

  const { optionTenors, swapTenors, volMatrix } = atm;
  console.log('[renderVolSurfacePanel] swaptionATM:', atm);

const data = [{
  type: 'surface',
  x: optionTenors,
  y: swapTenors,
  z: volMatrix,
  colorscale: colorScale,
  colorbar: {
    title: 'Vol',
    tickcolor: 'rgb(161,160,160)',
    tickfont: { color: 'rgb(161,160,160)' },
    titlefont: { color: 'rgb(161,160,160)' },
    bgcolor: 'rgb(20,20,20)',
    outlinecolor: 'rgb(90,90,90)'
  }
}];


const layout = {
  title: {
    text: 'EUR Swaption ATM Vol Surface',
    font: { color: 'rgb(161,160,160)', size: 14 }
  },

  paper_bgcolor: 'rgb(20, 20, 20)',   // GANZES Panel
  plot_bgcolor:  'rgb(20, 20, 20)',   // Chartfläche

  scene: {
    bgcolor: 'rgb(20,20,20)',

    xaxis: {
      title: { text: 'Option Tenor', font: { color: 'rgb(161,160,160)' } },
      tickfont: { color: 'rgb(161,160,160)' },
      gridcolor: 'rgb(90, 90, 90)',
      zerolinecolor: 'rgb(120, 120, 120)'
    },

    yaxis: {
      title: { text: 'Swap Tenor', font: { color: 'rgb(161,160,160)' } },
      tickfont: { color: 'rgb(161,160,160)' },
      gridcolor: 'rgb(90, 90, 90)',
      zerolinecolor: 'rgb(120, 120, 120)'
    },

    zaxis: {
      title: { text: 'Vol', font: { color: 'rgb(161,160,160)' } },
      tickfont: { color: 'rgb(161,160,160)' },
      gridcolor: 'rgb(90, 90, 90)',
      zerolinecolor: 'rgb(120, 120, 120)'
    }
  },

  margin: { l: 0, r: 0, t: 30, b: 0 }
};


  const config = {
    responsive: true,
    displaylogo: false
  };

  Plotly.newPlot(el, data, layout, config)
    .then(() => console.log('[renderVolSurfacePanel] Plot erfolgreich gerendert.'))
    .catch(err => console.error('[renderVolSurfacePanel] Fehler beim Rendern:', err));
}

export function renderSwaptionSmile() {
  const rows = appState?.swaptionSmile;
  if (!rows || rows.length === 0) {
    console.warn('[Smile] Kein Smile im State.');
    return;
  }

  // 1) Smile-Daten sortieren
  const sorted = [...rows].sort((a, b) => a.StrikeSpreadBP - b.StrikeSpreadBP);

  const opt = document.getElementById("swaptionOptionTenorSelect")?.value || '';
  const swp = document.getElementById("swaptionSwapTenorSelect")?.value || '';
  const label = (opt && swp) ? `Smile ${opt} x ${swp}` : 'Smile';

  // 2) ATM-Vol für dieses Tenor-Paar holen
  let atmVol = null;
  const atm = appState?.swaptionATM;
  if (atm && opt && swp) {
    const colIdx = atm.optionTenors.indexOf(opt); // X = OptionTenor
    const rowIdx = atm.swapTenors.indexOf(swp);   // Y = SwapTenor
    if (rowIdx >= 0 && colIdx >= 0) {
      atmVol = atm.volMatrix[rowIdx][colIdx];     // [Y][X]
    }
  }

  // 3) X/Y für den Chart: gesamte Vol, nicht Spread
  const strikesBp = sorted.map(r => r.StrikeSpreadBP);
  const volsAbs   = sorted.map(r => {
    const spread = Number(r.VolSpread || 0);
    return (atmVol != null ? atmVol : 0) + spread;   // Vol in Dezimalform
  });

  console.log('[Smile] Plot data (abs Vol):', { strikesBp, volsAbs, atmVol, label });

  // 👉 jetzt wird die absolute Vol geplottet
  renderSmileChart(strikesBp, volsAbs, label);

  // 4) Summary-Tabelle links – hier verwenden wir ebenfalls atmVol + Spreads
  renderSmileSummaryTable(sorted, atmVol);
}




let swaptionSmileChartInstance = null;

export function renderSmileChart(strikes, vols, label = "Smile") {
  const canvas = document.getElementById('swaption-smile-chart');
  if (!canvas) {
    console.warn('[renderSmileChart] Canvas #swaption-smile-chart nicht gefunden.');
    return;
  }

  const ctx = canvas.getContext('2d');
  if (swaptionSmileChartInstance) {
    swaptionSmileChartInstance.destroy();
  }

  if (typeof Chart !== 'undefined') {
    Chart.defaults.color = "rgb(161,160,160)";
  }

swaptionSmileChartInstance = new Chart(ctx, {
  type: 'line',
  data: {
    labels: strikes,
    datasets: [{
      label,
      data: vols,
      borderColor: "rgba(0, 191, 255, 1)",
      borderWidth: 2,
      pointRadius: 3,
      tension: 0.25
    }]
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,   // 🔸 WICHTIG: passt Chart an die Container-Höhe an
    scales: {
      x: {
        title: {
          display: true,
          text: "Strike Spread (bp)",
          color: "rgb(161,160,160)"
        },
        ticks: { color: "rgb(161,160,160)" },
        grid:  { color: "rgb(90,90,90)" }
      },
y: {
  title: {
    display: true,
    text: "Vol (abs.)",   // vorher "Vol Spread"
    color: "rgb(161,160,160)"
  },
        ticks: {
          color: "rgb(161,160,160)",
          callback: v => Number(v).toFixed(3)
        },
        grid: { color: "rgb(90,90,90)" }
      }
    },
    plugins: {
      legend: { labels: { color: "rgb(161,160,160)" } },
      zoom: {
        pan: { enabled: true, mode: 'xy' },
        zoom: {
          wheel:  { enabled: true },
          pinch:  { enabled: true },
          mode: 'xy'
        }
      }
    }
  }
});


  return swaptionSmileChartInstance;
}


function renderSmileSummaryTable(sortedSmileRows, atmVol) {
  const container = document.getElementById("SwaptionATMDataContainer");
  if (!container) {
    console.warn('[renderSmileSummaryTable] SwaptionATMDataContainer nicht gefunden.');
    return;
  }

  if (atmVol == null || isNaN(atmVol)) {
    container.innerHTML = "<div style='opacity:0.7;'>Keine ATM-Vol für diese Tenor-Kombination verfügbar.</div>";
    return;
  }

  // Absolute Vols je Strike-Punkt
  const absVolRows = sortedSmileRows.map(r => {
    const spread = Number(r.VolSpread || 0);
    const absVol = atmVol + spread;     // Vol in Dezimal
    return { ...r, absVol };
  });

  const absVolValues = absVolRows.map(r => r.absVol);
  const minAbs = Math.min(...absVolValues);
  const maxAbs = Math.max(...absVolValues);

  // Tabellenzeilen
  const rowsHtml = absVolRows.map(r => `
    <tr>
      <td style="text-align:right;">${r.StrikeSpreadBP}</td>
      <td style="text-align:right;">${(Number(r.VolSpread) * 100).toFixed(2)} bp</td>
      <td style="text-align:right;">${(r.absVol * 100).toFixed(3)} %</td>
    </tr>
  `).join("");

  container.innerHTML = `
    <div style="margin-bottom:6px; font-weight:600; opacity:0.85;">
      Node Summary
    </div>

    <!-- 🔹 Info-Box: gesamte (absolute) Vols -->
    <div style="margin-bottom:6px; font-size:0.85rem; opacity:0.8; line-height:1.4;">
      ATM Vol: <strong>${(atmVol * 100).toFixed(3)} %</strong><br>
      Vol-Range (inkl. Smile): 
      <strong>${(minAbs * 100).toFixed(3)} % – ${(maxAbs * 100).toFixed(3)} %</strong>
    </div>

    <table class="mini-table" style="width:100%; border-collapse:collapse; font-size:0.8rem;">
      <thead>
        <tr>
          <th style="text-align:right; padding-bottom:4px;">Strike Spread (bp)</th>
          <th style="text-align:right; padding-bottom:4px;">Vol Spread (bp)</th>
          <th style="text-align:right; padding-bottom:4px;">Vol (abs. %)</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>
  `;
}







