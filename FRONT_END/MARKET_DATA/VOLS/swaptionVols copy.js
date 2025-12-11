const colorScale = [
  [0.0,  '#1a1a1a'],   // very dark
  [0.25, '#0e3a60'],   // tiefes Stahlblau
  [0.50, '#1565c0'],   // mittleres Blau
  [0.75, '#29b6f6'],   // Cyan
  [1.0,  '#80deea']    // helles Aqua als Highlight
];



// export function renderVolSurfacePanel() {
//   const targetId = 'swaption-atm-surface-3d';
//   const el = document.getElementById(targetId);

//   if (!el) {
//     console.warn(`[renderVolSurfacePanel] Element mit id="${targetId}" nicht gefunden.`);
//     return;
//   }

//   if (typeof Plotly === 'undefined') {
//     console.error('[renderVolSurfacePanel] Plotly ist undefined.');
//     return;
//   }

//   const atm = appState && appState.swaptionATM;
//   if (!atm) {
//     console.warn('[renderVolSurfacePanel] Keine swaptionATM-Daten im appState.');
//     return;
//   }

//   const { optionTenors, swapTenors, volMatrix } = atm;
//   console.log('[renderVolSurfacePanel] swaptionATM:', atm);

// const data = [{
//   type: 'surface',
//   x: optionTenors,
//   y: swapTenors,
//   z: volMatrix,
//   colorscale: colorScale,
//   colorbar: {
//     title: 'Vol',
//     tickcolor: 'rgb(161,160,160)',
//     tickfont: { color: 'rgb(161,160,160)' },
//     titlefont: { color: 'rgb(161,160,160)' },
//     bgcolor: 'rgb(20,20,20)',
//     outlinecolor: 'rgb(90,90,90)'
//   }
// }];


// const layout = {
//   title: {
//     text: 'EUR Swaption ATM Vol Surface',
//     font: { color: 'rgb(161,160,160)', size: 14 }
//   },

//   paper_bgcolor: 'rgb(20, 20, 20)',   // GANZES Panel
//   plot_bgcolor:  'rgb(20, 20, 20)',   // Chartfläche

//   scene: {
//     bgcolor: 'rgb(20,20,20)',

//     xaxis: {
//       title: { text: 'Option Tenor', font: { color: 'rgb(161,160,160)' } },
//       tickfont: { color: 'rgb(161,160,160)' },
//       gridcolor: 'rgb(90, 90, 90)',
//       zerolinecolor: 'rgb(120, 120, 120)'
//     },

//     yaxis: {
//       title: { text: 'Swap Tenor', font: { color: 'rgb(161,160,160)' } },
//       tickfont: { color: 'rgb(161,160,160)' },
//       gridcolor: 'rgb(90, 90, 90)',
//       zerolinecolor: 'rgb(120, 120, 120)'
//     },

//     zaxis: {
//       title: { text: 'Vol', font: { color: 'rgb(161,160,160)' } },
//       tickfont: { color: 'rgb(161,160,160)' },
//       gridcolor: 'rgb(90, 90, 90)',
//       zerolinecolor: 'rgb(120, 120, 120)'
//     }
//   },

//   margin: { l: 0, r: 0, t: 30, b: 0 }
// };


//   const config = {
//     responsive: true,
//     displaylogo: false
//   };

//   Plotly.newPlot(el, data, layout, config)
//     .then(() => console.log('[renderVolSurfacePanel] Plot erfolgreich gerendert.'))
//     .catch(err => console.error('[renderVolSurfacePanel] Fehler beim Rendern:', err));
// }

// HARDCODED DATA




export function renderVolSurfacePanel() {
  const el = document.getElementById('swaption-atm-surface-3d');
  if (!el) return;

  const optionTenors = ['1Y','2Y','5Y','10Y'];       // X
  const swapTenors   = ['1Y','2Y','5Y','10Y','20Y']; // Y

// Gebogene Vol-Struktur (Pseudo-Welle)
const atm_vols = [
  [0.28,  0.275, 0.265, 0.27,  0.28 ],
  [0.275, 0.27,  0.26,  0.265, 0.275],
  [0.27,  0.265, 0.255, 0.26,  0.27 ],
  [0.265, 0.26,  0.25,  0.255, 0.265],
];



  const volMatrix = swapTenors.map((_, j) =>
    optionTenors.map((_, i) => atm_vols[i][j])
  );

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


  Plotly.newPlot(el, data, layout, { responsive: true, displaylogo: false });
}

export function renderSwaptionSmile() {
  const rows = appState?.swaptionSmile;

  if (!rows || rows.length === 0) {
    console.warn('[Smile] Kein Smile im State.');
    return;
  }

  // Nach Strike sortieren (damit Kurve schön ist)
  const sorted = [...rows].sort((a, b) => a.StrikeSpreadBP - b.StrikeSpreadBP);

  // X-Achse: Strike-Spread in bp
  const strikesBp = sorted.map(r => r.StrikeSpreadBP);

  // Y-Achse: Vol-Spread (z. B. in Dezimalform, 0.02 = 2 Volpunkte)
  const vols = sorted.map(r => r.VolSpread);

  // Optional: Label dynamisch – z. B. aus Dropdowns
  const opt = document.getElementById("swaptionOptionTenorSelect")?.value || '';
  const swp = document.getElementById("swaptionSwapTenorSelect")?.value || '';
  const label = (opt && swp) ? `Smile ${opt} x ${swp}` : 'Smile';

  console.log('[Smile] Plot data:', { strikesBp, vols, label });

  // Dein Chart.js-Renderer
  renderSmileChart(strikesBp, vols, label);
}
