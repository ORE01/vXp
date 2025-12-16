import { sortTenors } from "../../renderer.js";

const colorScale = [
  [0.0,  '#1a1a1a'],   // very dark
  [0.25, '#0e3a60'],   // tiefes Stahlblau
  [0.50, '#1565c0'],   // mittleres Blau
  [0.75, '#29b6f6'],   // Cyan
  [1.0,  '#80deea']    // helles Aqua als Highlight
];

//HELPER:
      function buildSwaptionATMGridFromRows(atmRows) {
        const rows = Array.isArray(atmRows) ? atmRows : [];
        if (rows.length === 0) return null;

        const optionSet = new Set();
        const swapSet = new Set();

        for (const r of rows) {
          const opt = String(r?.option_tenor ?? "").trim();
          const swp = String(r?.swap_tenor ?? "").trim();
          if (opt) optionSet.add(opt);
          if (swp) swapSet.add(swp);
        }

        const optionTenors = sortTenors([...optionSet]); // X
        const swapTenors   = sortTenors([...swapSet]);   // Y

        const volMatrix = swapTenors.map(() => optionTenors.map(() => null)); // [y][x]

        for (const r of rows) {
          const opt = String(r?.option_tenor ?? "").trim();
          const swp = String(r?.swap_tenor ?? "").trim();
          const rowIdx = swapTenors.indexOf(swp);
          const colIdx = optionTenors.indexOf(opt);
          if (rowIdx < 0 || colIdx < 0) continue;

          const vol = Number(r?.atm_vol);
          volMatrix[rowIdx][colIdx] = Number.isFinite(vol) ? vol : null;
        }

        return { optionTenors, swapTenors, volMatrix };
      }
      // ATM Vol für aktuell gewählte Node aus ATM rows[]
      function getAtmVolForSelectedNodeFromRows() {
        const opt = document.getElementById("swaptionOptionTenorSelect")?.value || '';
        const swp = document.getElementById("swaptionSwapTenorSelect")?.value || '';
        if (!opt || !swp) return null;

        const rows = Array.isArray(appState?.swaptionATM) ? appState.swaptionATM : [];
        const hit = rows.find(r =>
          String(r?.option_tenor ?? "").trim() === opt &&
          String(r?.swap_tenor ?? "").trim() === swp
        );
        if (!hit) return null;

        const v = Number(hit?.atm_vol);
        return Number.isFinite(v) ? v : null;
      }


//3D plottly Chart:
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

  // ✅ ATM ist jetzt rows[]
  const atmRows = appState?.swaptionATM;
  if (!Array.isArray(atmRows) || atmRows.length === 0) {
    console.warn('[renderVolSurfacePanel] Keine swaptionATM-Daten (rows[]) im appState.');
    return;
  }

  const grid = buildSwaptionATMGridFromRows(atmRows);
  if (!grid) {
    console.warn('[renderVolSurfacePanel] Konnte ATM-Grid nicht bauen.');
    return;
  }

  const { optionTenors, swapTenors, volMatrix } = grid;
  console.log('[renderVolSurfacePanel] swaptionATM grid:', grid);

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
    title: { text: 'EUR Swaption ATM Vol Surface', font: { color: 'rgb(161,160,160)', size: 14 } },
    paper_bgcolor: 'rgb(20, 20, 20)',
    plot_bgcolor:  'rgb(20, 20, 20)',
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

  const config = { responsive: true, displaylogo: false };

Plotly.newPlot(el, data, layout, config)
  .then(async () => {
    console.log('[renderVolSurfacePanel] Plot erfolgreich gerendert.');

    // ✅ Plotly Surface als PNG exportieren (für Preview)
    try {
      const png = await Plotly.toImage(el, {
        format: "png",
        width: 900,
        height: 520,
        scale: 2
      });

      // irgendwo speichern (appState)
      appState.swaptionATMSurfacePng = png;

      // Preview neu triggern
      document.dispatchEvent(new Event("risk:refresh-thumbnails"));
    } catch (e) {
      console.warn("[renderVolSurfacePanel] Plotly.toImage failed", e);
      appState.swaptionATMSurfacePng = null;
    }
  })
  .catch(err => console.error('[renderVolSurfacePanel] Fehler beim Rendern:', err));

}


export function renderSwaptionSmile() {
  const rows = appState?.swaptionSmile;

  // ✅ Smile bleibt: nur StrikeSpreadBP + VolSpread
  if (!Array.isArray(rows) || rows.length === 0) {
    console.warn('[Smile] Kein Smile im State.');
    return;
  }

  const opt = document.getElementById("swaptionOptionTenorSelect")?.value || '';
  const swp = document.getElementById("swaptionSwapTenorSelect")?.value || '';
  const label = (opt && swp) ? `Smile ${opt} x ${swp}` : 'Smile';

  // 1) sortieren
  const sorted = [...rows].sort((a, b) =>
    Number(a?.StrikeSpreadBP ?? 0) - Number(b?.StrikeSpreadBP ?? 0)
  );

  // 2) ATM-Vol aus ATM rows[] (nicht mehr aus volMatrix)
  const atmVol = getAtmVolForSelectedNodeFromRows();

  // 3) absolute Vol = ATM + Spread
  const strikesBp = sorted.map(r => Number(r?.StrikeSpreadBP ?? 0));
  const volsAbs   = sorted.map(r => (atmVol ?? 0) + Number(r?.VolSpread ?? 0));

  console.log('[Smile] Plot data (abs Vol):', { strikesBp, volsAbs, atmVol, label });

  renderSmileChart(strikesBp, volsAbs, label);
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



export function swaptionReady() {
  const atmOk   = Array.isArray(appState?.swaptionATM)   && appState.swaptionATM.length > 0;
  const smileOk = Array.isArray(appState?.swaptionSmile) && appState.swaptionSmile.length > 0;
  return atmOk && smileOk;
}


export function renderSwaptionIfReady() {
  const panel = document.getElementById("panel-swaption");
  if (!panel || panel.hidden) return;

  if (!swaptionReady()) return;

  renderVolSurfacePanel();
  renderSwaptionSmile?.();
}



export async function plotlyDivToPngDataUrl(plotlyDiv, { width = 900, height = 520 } = {}) {
  if (!plotlyDiv) return null;
  if (typeof Plotly === "undefined") return null;

  // Plotly rendert async – wenn noch nichts da ist, kann toImage fehlschlagen
  // (optional) kurz warten bis Plotly intern fertig ist:
  await new Promise(r => requestAnimationFrame(r));

  try {
    const dataUrl = await Plotly.toImage(plotlyDiv, {
      format: "png",
      width,
      height,
      scale: 2
    });
    return dataUrl;
  } catch (e) {
    console.warn("[Preview] Plotly.toImage failed", e);
    return null;
  }
}








