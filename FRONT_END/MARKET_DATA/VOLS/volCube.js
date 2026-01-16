import { notifyRiskPreview } from '../../REPORTS/RiskPDFPreview.js';


export function buildCubeSurfaceGrid(cubeSurfaceFixedK) {
  if (!cubeSurfaceFixedK || !Array.isArray(cubeSurfaceFixedK.nodes)) {
    console.warn('[buildCubeSurfaceGrid] Keine nodes in cubeSurfaceFixedK.');
    return null;
  }

  const nodes = cubeSurfaceFixedK.nodes;

  // Sortierfunktion für Tenor-Labels ("6M", "1Y", "10Y", ...)
  const sortTenorLabels = (labels) => {
    const key = (lbl) => {
      const m = /^(\d+)([YMDW])$/.exec(String(lbl).trim().toUpperCase());
      if (!m) return Number.MAX_SAFE_INTEGER;

      const n = parseInt(m[1], 10);
      const unit = m[2];
      const unitRank = { D: 0, W: 1, M: 2, Y: 3 }[unit] ?? 9;

      return unitRank * 1000 + n;
    };

    return [...labels].sort((a, b) => key(a) - key(b));
  };

  // 1) Labels direkt aus den Nodes holen
  const optionLabelsRaw = [...new Set(nodes.map(n => String(n.optionTenor).trim()))];
  const swapLabelsRaw   = [...new Set(nodes.map(n => String(n.swapTenor).trim()))];

  // 2) Sauber sortieren
  const optionTenors = sortTenorLabels(optionLabelsRaw);
  const swapTenors   = sortTenorLabels(swapLabelsRaw);

  // 3) Vol-Matrix bauen (Y = Swap, X = Option)
  const volMatrix = swapTenors.map(() => optionTenors.map(() => null));

  nodes.forEach(n => {
    const optLabel = String(n.optionTenor).trim();
    const swpLabel = String(n.swapTenor).trim();

    const i = swapTenors.indexOf(swpLabel);   // Y
    const j = optionTenors.indexOf(optLabel); // X
    if (i >= 0 && j >= 0) {
      volMatrix[i][j] = Number(n.vol);
    }
  });

  return {
    strike: Number(cubeSurfaceFixedK.strike),
    optionTenors,
    swapTenors,
    volMatrix,
  };
}




// Dropdowns befüllen + Default setzen (Option 2Y, Swap 5Y wenn vorhanden)
export function populateSwaptionCubeSelectors() {
  const cube = appState.getSwaptionCubeSurface
    ? appState.getSwaptionCubeSurface()
    : appState.swaptionCubeSurface;

  if (!cube) {
    console.warn('[populateSwaptionCubeSelectors] Kein Cube im State.');
    return;
  }

  const { optionTenors, swapTenors } = cube;

  const optSel = document.getElementById('swaptionOptionTenorSelectCube');
  const swpSel = document.getElementById('swaptionSwapTenorSelectCube');

  if (!optSel || !swpSel) {
    console.warn('[populateSwaptionCubeSelectors] Select-Elemente nicht gefunden.');
    return;
  }

  optSel.innerHTML = optionTenors
    .map(t => `<option value="${t}">${t}</option>`)
    .join('');
  swpSel.innerHTML = swapTenors
    .map(t => `<option value="${t}">${t}</option>`)
    .join('');

  // Defaults: 2Y / 5Y falls vorhanden, sonst erstes Element
  const defaultOpt = optionTenors.find(t => t === '2Y' || t === '2') || optionTenors[0];
  const defaultSwp = swapTenors.find(t => t === '5Y' || t === '5') || swapTenors[0];

  optSel.value = defaultOpt;
  swpSel.value = defaultSwp;

  // Bei Änderung neu rendern
  optSel.onchange = () => renderSwaptionCubeSurface3D();
  swpSel.onchange = () => renderSwaptionCubeSurface3D();
}


export function renderSwaptionCubeSurface3D() {
  const targetId = 'swaption-cube-surface-3d';
  const el = document.getElementById(targetId);

  if (!el) {
    console.warn(`[renderSwaptionCubeSurface3D] Element mit id="${targetId}" nicht gefunden.`);
    return;
  }

  if (typeof Plotly === 'undefined') {
    console.error('[renderSwaptionCubeSurface3D] Plotly ist undefined.');
    return;
  }

  const state = window.appState;
  if (!state) {
    console.warn('[renderSwaptionCubeSurface3D] window.appState fehlt.');
    return;
  }

  const cube = state.getSwaptionCubeSurface
    ? state.getSwaptionCubeSurface()
    : state.swaptionCubeSurface;

  if (!cube) {
    console.warn('[renderSwaptionCubeSurface3D] Keine swaptionCubeSurface im state.');
    return;
  }

  let { optionTenors, swapTenors, volMatrix, strike } = cube;

  const optSelValue = document.getElementById('swaptionOptionTenorSelectCube')?.value || '';
  const swpSelValue = document.getElementById('swaptionSwapTenorSelectCube')?.value || '';

  let xLabels = [...optionTenors];
  let yLabels = [...swapTenors];
  let z       = volMatrix.map(row => [...row]);

  if (optSelValue) {
    const colIdx = xLabels.indexOf(optSelValue);
    if (colIdx >= 0) {
      xLabels = xLabels.slice(colIdx);
      z = z.map(row => row.slice(colIdx));
    }
  }

  if (swpSelValue) {
    const rowIdx = yLabels.indexOf(swpSelValue);
    if (rowIdx >= 0) {
      yLabels = yLabels.slice(rowIdx);
      z = z.slice(rowIdx);
    }
  }

  const data = [{
    type: 'surface',
    x: xLabels,
    y: yLabels,
    z,
    colorscale: (typeof colorScale !== 'undefined') ? colorScale : 'Viridis',
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
      text: `SABR Vol Cube Surface (K = ${(strike * 100).toFixed(2)}%)`,
      font: { color: 'rgb(161,160,160)', size: 14 }
    },
    paper_bgcolor: 'rgb(20, 20, 20)',
    plot_bgcolor:  'rgb(20, 20, 20)',
    scene: { /* ... wie bisher ... */ },
    margin: { l: 0, r: 0, t: 30, b: 0 }
  };

  const config = { responsive: true, displaylogo: false };

  Plotly.newPlot(el, data, layout, config)
    .then(async () => {
      console.log('[renderSwaptionCubeSurface3D] Plot erfolgreich gerendert.');

try {
  const png = await Plotly.toImage(el, {
    format: "png",
    width: 900,
    height: 520,
    scale: 2
  });

  state.swaptionCubeSurfacePng = png;
  console.log('[renderSwaptionCubeSurface3D] PNG erzeugt');

  notifyRiskPreview("interestRates");
} catch (e) {
  console.warn("[renderSwaptionCubeSurface3D] toImage failed", e);
  state.swaptionCubeSurfacePng = null;
}

    })
    .catch(err => {
      console.error('[renderSwaptionCubeSurface3D] Fehler beim Rendern:', err);
    });
}




export function renderSwaptionCubeSummary() {
  const summaryEl = document.getElementById('SwaptionCubeSummaryContainer');
  if (!summaryEl) {
    console.warn('[renderSwaptionCubeSummary] Summary-Container nicht gefunden.');
    return;
  }

  const cube = appState.getSwaptionCubeSurface
    ? appState.getSwaptionCubeSurface()
    : appState.swaptionCubeSurface;

  if (!cube) {
    summaryEl.innerHTML = "<div style='opacity:0.7;'>Kein Vol-Cube geladen.</div>";
    notifyRiskPreview("interestRates");
    return;
  }

  let { optionTenors, swapTenors, volMatrix, strike } = cube;

  const optSelValue = document.getElementById('swaptionOptionTenorSelectCube')?.value || '';
  const swpSelValue = document.getElementById('swaptionSwapTenorSelectCube')?.value || '';

  let xLabels = [...optionTenors];
  let yLabels = [...swapTenors];
  let z       = volMatrix.map(row => [...row]);

  if (optSelValue) {
    const colIdx = xLabels.indexOf(optSelValue);
    if (colIdx >= 0) {
      xLabels = xLabels.slice(colIdx);
      z = z.map(row => row.slice(colIdx));
    }
  }

  if (swpSelValue) {
    const rowIdx = yLabels.indexOf(swpSelValue);
    if (rowIdx >= 0) {
      yLabels = yLabels.slice(rowIdx);
      z = z.slice(rowIdx);
    }
  }

  const flatVols = z.flat().filter(v => typeof v === 'number' && !isNaN(v));
  if (!flatVols.length) {
    summaryEl.innerHTML = "<div style='opacity:0.7;'>Keine Vols für diese Auswahl.</div>";
    notifyRiskPreview("interestRates");
    return;
  }

  const minVol = Math.min(...flatVols);
  const maxVol = Math.max(...flatVols);

  summaryEl.innerHTML = `
    <div style="margin-bottom:6px; font-weight:600; opacity:0.85;">
      Cube Node Summary
    </div>

    <div style="margin-bottom:6px; font-size:0.85rem; opacity:0.8; line-height:1.4;">
      Strike K: <strong>${(strike * 100).toFixed(3)} %</strong><br>
      Vol-Range: <strong>${(minVol * 100).toFixed(3)} % – ${(maxVol * 100).toFixed(3)} %</strong><br>
      Nodes im Ausschnitt: <strong>${flatVols.length}</strong>
    </div>
  `;

  // 🔔 wichtig für Preview-Tabellen-Refresh
  notifyRiskPreview("interestRates");
}




