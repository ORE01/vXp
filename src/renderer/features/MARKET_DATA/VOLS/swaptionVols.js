import { sortTenors } from "../../../renderer.js";
import { notifyRiskPreview } from '../../REPORTS/RiskPDFPreview.js';

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

    const vol = Number(r?.atm_vol ?? r?.vol);
    volMatrix[rowIdx][colIdx] = Number.isFinite(vol) ? vol : null;
  }

  return { optionTenors, swapTenors, volMatrix };
}
// ATM Vol für aktuell gewählte Node aus ATM rows[]
function getAtmVolForSelectedNodeFromRows() {
  const opt = document.getElementById("swaptionOptionTenorSelect")?.value || '';
  const swp = document.getElementById("swaptionSwapTenorSelect")?.value || '';
  if (!opt || !swp) return null;

  const rows = appState.getSwaptionAtmBase?.() || appState._SWAPTION_ATM_BASE || [];
  const hit = rows.find(r =>
    String(r?.option_tenor ?? "").trim() === opt &&
    String(r?.swap_tenor ?? "").trim() === swp
  );
  if (!hit) return null;

  const v = Number(hit?.atm_vol ?? hit?.vol);
  return Number.isFinite(v) ? v : null;
}

export function renderActiveSwaptionScenarioPanel() {

  const ccy =
    document.getElementById("swaptionCurrencySelect")?.value ||
    "EUR";

  const activeRows = appState.getSwaptionActive?.() || [];

  const active = activeRows
    .sort((a, b) =>
      new Date(b.activated_at || 0) - new Date(a.activated_at || 0)
    )[0];

  const scenario = active?.scenario_id || 'BASE';
  const runId = active?.active_run_id || active?.run_id || '-';
 

  const isBase = scenario === 'BASE';

  return `
    <div style="
      margin: 0 0 14px 0;
      padding: 12px 14px;
      border: 1px solid rgba(255,255,255,0.10);
      border-radius: 10px;
      background: #1e1e1e;
    ">
      <div style="font-size:0.78rem; opacity:0.72; margin-bottom:6px;">
        Active Swaption Scenario
      </div>

      <div style="
        display:grid;
        grid-template-columns: 1fr 1fr 1fr;
        gap:10px;
        font-size:0.84rem;
      ">
        <div><strong>CCY:</strong> ${ccy}</div>
        <div>
          <strong>Scenario:</strong>
          <span style="color:${isBase ? 'inherit' : '#ff4d4d'}; font-weight:700;">
            ${scenario}
          </span>
        </div>
        <div><strong>Run:</strong> ${runId}</div>
      </div>
    </div>
  `;
}

export function renderVolSurfacePanel() {
  const targetId = 'swaption-atm-surface-3d';
  const el = document.getElementById(targetId);

  if (!el) {
    console.warn(`[renderVolSurfacePanel] Element mit id="${targetId}" nicht gefunden.`);
    return;
  }

  if (!appState) {
    console.warn('[renderVolSurfacePanel] appState fehlt.');
    return;
  }

  const atmRows = appState.getSwaptionAtmBase?.() || appState._SWAPTION_ATM_BASE || [];

  if (!Array.isArray(atmRows) || atmRows.length === 0) {
    el.innerHTML = `<div style="opacity:0.7; padding:12px;">Keine ATM-Vols geladen.</div>`;
    return;
  }

  const grid = buildSwaptionATMGridFromRows(atmRows);

  if (!grid) {
    el.innerHTML = `<div style="opacity:0.7; padding:12px;">ATM-Grid konnte nicht gebaut werden.</div>`;
    return;
  }

  const { optionTenors, swapTenors, volMatrix } = grid;

  const flatVols = volMatrix
    .flat()
    .filter(v => typeof v === 'number' && Number.isFinite(v));

  if (!flatVols.length) {
    el.innerHTML = `<div style="opacity:0.7; padding:12px;">Keine gültigen ATM-Vols verfügbar.</div>`;
    return;
  }

  const minVol = Math.min(...flatVols);
  const maxVol = Math.max(...flatVols);
  const range = maxVol - minVol || 1;

  const cellStyle = (value) => {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return 'background:#222; color:#777;';
    }

    const intensity = (value - minVol) / range;
    const lightness = 18 + intensity * 42;

    return `
      background:hsl(198, 85%, ${lightness}%);
      color:${lightness > 42 ? '#061018' : '#f2f7fa'};
      font-weight:600;
    `;
  };

  const rowsHtml = swapTenors.map((swapTenor, rowIdx) => {
    const cells = optionTenors.map((optionTenor, colIdx) => {
      const value = volMatrix[rowIdx]?.[colIdx];

      const label = typeof value === 'number' && Number.isFinite(value)
        ? `${(value * 100).toFixed(2)}%`
        : '–';

      return `
        <td
          title="${optionTenor} x ${swapTenor}"
          style="
            ${cellStyle(value)}
            padding:10px 12px;
            text-align:center;
            border:1px solid rgba(255,255,255,0.08);
            min-width:72px;
          ">
          ${label}
        </td>
      `;
    }).join('');

    return `
      <tr>
        <th style="
          position:sticky;
          left:0;
          background:#151515;
          color:rgb(190,190,190);
          padding:10px 12px;
          text-align:left;
          border:1px solid rgba(255,255,255,0.08);
          z-index:1;
        ">
          ${swapTenor}
        </th>
        ${cells}
      </tr>
    `;
  }).join('');

  const headerHtml = optionTenors.map(t => `
    <th style="
      background:#151515;
      color:rgb(190,190,190);
      padding:10px 12px;
      text-align:center;
      border:1px solid rgba(255,255,255,0.08);
      position:sticky;
      top:0;
      z-index:2;
    ">
      ${t}
    </th>
  `).join('');

  el.innerHTML = `
    <div style="height:100%; overflow:auto; padding:10px;">
      <div style="margin-bottom:10px; color:rgb(190,190,190); font-weight:600;">
        EUR Swaption ATM Vol Heatmap
      </div>

      <table style="
        border-collapse:collapse;
        width:max-content;
        min-width:100%;
        font-size:0.82rem;
      ">
        <thead>
          <tr>
            <th style="
              background:#151515;
              color:rgb(190,190,190);
              padding:10px 12px;
              text-align:left;
              border:1px solid rgba(255,255,255,0.08);
              position:sticky;
              top:0;
              left:0;
              z-index:3;
            ">
              Swap \\ Option
            </th>
            ${headerHtml}
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    </div>
  `;

  appState.swaptionATMSurfacePng = null;

  try {
    notifyRiskPreview('interestRates');
  } catch (e) {
    console.warn("[renderVolSurfacePanel] notifyRiskPreview failed", e);
  }
}
export function renderSwaptionSmile() {
  if (!appState) {
    console.warn('[renderSwaptionSmile] appState fehlt.');
    return;
  }

  const rows = appState.getSwaptionSmileBase?.() || appState._SWAPTION_SMILE_BASE || [];

  // ✅ Smile bleibt: nur StrikeSpreadBP + VolSpread
  if (!Array.isArray(rows) || rows.length === 0) {
    console.warn('[Smile] Kein Smile im State.');
    return;
  }

  const opt = document.getElementById("swaptionOptionTenorSelect")?.value || '';
  const swp = document.getElementById("swaptionSwapTenorSelect")?.value || '';
  const label = (opt && swp) ? `Smile ${opt} x ${swp}` : 'Smile';

  // 1) sortieren
  const normalizedSmileRows = rows
    .map(r => ({
      strikeSpreadBP: Number(r?.strike_spread_bp ?? r?.StrikeSpreadBP ?? r?.smile_key),
      volSpread: Number(r?.vol_spread ?? r?.VolSpread ?? r?.adjustment),
    }))
    .filter(r =>
      Number.isFinite(r.strikeSpreadBP) &&
      Number.isFinite(r.volSpread)
    );

  const sorted = [...normalizedSmileRows].sort(
    (a, b) => a.strikeSpreadBP - b.strikeSpreadBP
  );

  // 2) ATM-Vol aus ATM rows[] (nicht mehr aus volMatrix)
  const atmVol = getAtmVolForSelectedNodeFromRows();

  // 3) absolute Vol = ATM + Spread
  const strikesBp = sorted.map(r => r.strikeSpreadBP);
  const volsAbs = sorted.map(r => (atmVol ?? 0) + r.volSpread);

  // console.log('[Smile] Plot data (abs Vol):', { strikesBp, volsAbs, atmVol, label });

  // Chart & Tabelle rendern
  renderSmileChart(strikesBp, volsAbs, label);
  renderSmileSummaryTable(sorted, atmVol);

  // 🔔 Risk-Preview informieren (Interest-Rate-Sektion)
  try {
    notifyRiskPreview("interestRates");
  } catch (e) {
    console.warn("[renderSwaptionSmile] notifyRiskPreview('interestRates') failed", e);
  }
}

export function renderSwaptionActiveScenarioInfo() {
  const container = document.getElementById('SwaptionActiveScenarioContainer');
  if (!container) return;

  container.innerHTML = renderActiveSwaptionScenarioPanel();
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
    maintainAspectRatio: false,
    animation: false,
    animations: false,
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

  const absVolRows = sortedSmileRows.map(r => {
    const spread = Number(r.volSpread);
    const absVol = atmVol + spread;

    return {
      strikeSpreadBP: r.strikeSpreadBP,
      volSpread: spread,
      absVol
    };
  });

  const absVolValues = absVolRows.map(r => r.absVol);
  const minAbs = Math.min(...absVolValues);
  const maxAbs = Math.max(...absVolValues);

  const rowsHtml = absVolRows.map(r => `
    <tr>
      <td style="text-align:right;">${r.strikeSpreadBP}</td>
      <td style="text-align:right;">${(r.volSpread * 100).toFixed(2)} bp</td>
      <td style="text-align:right;">${(r.absVol * 100).toFixed(3)} %</td>
    </tr>
  `).join("");

  container.innerHTML = `
    <div style="margin-bottom:6px; font-weight:600; opacity:0.85;">
      Node Summary
    </div>

    <div style="margin-bottom:6px; font-size:0.85rem; opacity:0.8; line-height:1.4;">
      ATM Vol: <strong>${(atmVol * 100).toFixed(3)} %</strong><br>
      Vol-Range (inkl. Smile): 
      <strong>${(minAbs * 100).toFixed(3)} % – ${(maxAbs * 100).toFixed(3)} %</strong>
    </div>

    <table class="mini-table" style="width:100%; border-collapse:collapse; font-size:0.8rem;">
      <thead>
        <tr>
          <th style="text-align:right; padding-bottom:4px;">Strike Spread (bp)</th>
          <th style="text-align:right; padding-bottom:4px;">Vol Spread</th>
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
  const atmRows = appState.getSwaptionAtmBase?.() || appState._SWAPTION_ATM_BASE || [];
  const smileRows = appState.getSwaptionSmileBase?.() || appState._SWAPTION_SMILE_BASE || [];

  const atmOk = Array.isArray(atmRows) && atmRows.length > 0;
  const smileOk = Array.isArray(smileRows) && smileRows.length > 0;
  return atmOk && smileOk;
}
export function renderSwaptionIfReady() {
  if (!swaptionReady()) return;

  const volsPanel = document.getElementById("panel-swaption");
  const smilePanel = document.getElementById("panel-swaption-smile");

  const volsOpen =
    volsPanel &&
    !volsPanel.hidden &&
    volsPanel.classList.contains("open");

  const smileOpen =
    smilePanel &&
    !smilePanel.hidden &&
    smilePanel.classList.contains("open");

  if (!volsOpen && !smileOpen) return;

  if (volsOpen) {
    renderVolSurfacePanel();
  }

  if (smileOpen) {
    renderSwaptionSmile();
  }
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

