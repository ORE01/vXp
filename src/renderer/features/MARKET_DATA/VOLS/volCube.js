import { notifyRiskPreview } from '../../REPORTS/RiskPDFPreview.js';

// Legacy-compatible helper, falls noch irgendwo alte Node-Struktur kommt
export function buildCubeSurfaceGrid(cubeSurfaceFixedK) {
  if (!cubeSurfaceFixedK || !Array.isArray(cubeSurfaceFixedK.nodes)) {
    console.warn('[buildCubeSurfaceGrid] Keine nodes in cubeSurfaceFixedK.');
    return null;
  }

  const nodes = cubeSurfaceFixedK.nodes;

  const optionTenors = [...new Set(nodes.map(n => String(n.optionTenor).trim()))];
  const swapTenors = [...new Set(nodes.map(n => String(n.swapTenor).trim()))];

  const volMatrix = swapTenors.map(() => optionTenors.map(() => null));

  for (const n of nodes) {
    const rowIdx = swapTenors.indexOf(String(n.swapTenor).trim());
    const colIdx = optionTenors.indexOf(String(n.optionTenor).trim());

    if (rowIdx >= 0 && colIdx >= 0) {
      volMatrix[rowIdx][colIdx] = Number(n.vol);
    }
  }

  return {
    strike: Number(cubeSurfaceFixedK.strike),
    optionTenors,
    swapTenors,
    volMatrix,
  };
}

function getCubeState() {
  const state = window.appState || globalThis.appState;

  if (!state) return null;

  return state.getSwaptionCubeSurface
    ? state.getSwaptionCubeSurface()
    : state.swaptionCubeSurface;
}

function getAvailableSurfaces(cube) {
  if (!cube) return [];

  // Neuer möglicher Aufbau: mehrere Surfaces
  if (Array.isArray(cube.surfaces)) return cube.surfaces;

  // Alternativer Aufbau: byStrike Map
  if (cube.byStrike && typeof cube.byStrike === 'object') {
    return Object.values(cube.byStrike);
  }

  // Legacy: nur eine Surface vorhanden
  if (
    Array.isArray(cube.optionTenors) &&
    Array.isArray(cube.swapTenors) &&
    Array.isArray(cube.volMatrix)
  ) {
    return [cube];
  }

  return [];
}

function getSurfaceStrike(surface) {
  return Number(
    surface?.strike ??
    surface?.strike_spread_bp ??
    surface?.strikeSpreadBp ??
    surface?.smile_key
  );
}

function getSelectedCubeSurface(cube) {
  const strikeValue = document.getElementById('swaptionCubeStrikeSelect')?.value || '';
  const surfaces = getAvailableSurfaces(cube);

  if (!surfaces.length) return null;

  // Wenn nichts gewählt ist: ATM anzeigen
  if (!strikeValue) {
    const atmSurface =
      cube.atmSurface ||
      cube.ATM ||
      surfaces.find(s => s.isATM === true) ||
      surfaces.find(s => String(s.strikeLabel || '').toUpperCase() === 'ATM');

    return atmSurface || surfaces[0];
  }

  const selectedStrike = Number(strikeValue);

  return (
    surfaces.find(s => getSurfaceStrike(s) === selectedStrike) ||
    surfaces.find(s => Math.abs(getSurfaceStrike(s) - selectedStrike) < 1e-10) ||
    surfaces[0]
  );
}

function getCubeView(surface) {
  return {
    xLabels: [...surface.optionTenors],
    yLabels: [...surface.swapTenors],
    z: surface.volMatrix.map(row => [...row]),
  };
}

export function populateSwaptionCubeSelectors() {
  const panel = document.getElementById('panel-swaption-cube');

    if (!panel) {
      return;
    }

  console.log('--- populateSwaptionCubeSelectors ---');
  console.log(
    'panel exists:',
    !!document.getElementById('panel-swaption-cube')
  );
  console.log(
    'select exists:',
    !!document.getElementById('swaptionCubeStrikeSelect')
  );

  const cube = getCubeState();

  if (!cube) {
    console.warn('[populateSwaptionCubeSelectors] Kein Cube im State.');
    return;
  }

  const strikeSel = document.getElementById('swaptionCubeStrikeSelect');

  if (!strikeSel) {
    console.warn('[populateSwaptionCubeSelectors] Strike-Select nicht gefunden.');
    return;
  }

  const surfaces = getAvailableSurfaces(cube);

  console.log('[CUBE SELECTOR DEBUG]', {
    cube,
    surfaces,
    strikes: surfaces.map(s => ({
      strike: s.strike,
      strike_spread_bp: s.strike_spread_bp,
      strikeLabel: s.strikeLabel
    }))
  });

  const strikes = [...new Set(
    surfaces
      .map(s => getSurfaceStrike(s))
      .filter(v => Number.isFinite(v))
  )].sort((a, b) => a - b);

  strikeSel.innerHTML = `
    <option value="">ATM</option>
    ${strikes.map(k => `
      <option value="${k}">${k} bp</option>
    `).join('')}
  `;

  strikeSel.value = '';

  strikeSel.onchange = () => {
    renderSwaptionCubeHeatmap();
    renderSwaptionCubeSummary();
  };
}

export function renderSwaptionCubeHeatmap() {
  const targetId = 'swaption-cube-surface-3d';
  const el = document.getElementById(targetId);

  if (!el) {
    console.warn(`[renderSwaptionCubeHeatmap] Element mit id="${targetId}" nicht gefunden.`);
    return;
  }

  const cube = getCubeState();

  if (!cube) {
    el.innerHTML = `<div style="opacity:0.7; padding:12px;">Kein Vol-Cube geladen.</div>`;
    return;
  }

  const surface = getSelectedCubeSurface(cube);

  if (!surface) {
    el.innerHTML = `<div style="opacity:0.7; padding:12px;">Keine Surface verfügbar.</div>`;
    return;
  }

  const { xLabels, yLabels, z } = getCubeView(surface);
  const flatVols = z.flat().filter(v => typeof v === 'number' && Number.isFinite(v));

  if (!flatVols.length) {
    el.innerHTML = `<div style="opacity:0.7; padding:12px;">Keine Vols für diese Auswahl.</div>`;
    return;
  }

  const minVol = Math.min(...flatVols);
  const maxVol = Math.max(...flatVols);
  const range = maxVol - minVol || 1;

  const strikeValue = document.getElementById('swaptionCubeStrikeSelect')?.value || '';
  const title = strikeValue
    ? `SABR Vol Cube Heatmap · Strike Spread = ${Number(strikeValue)} bp`
    : 'SABR Vol Cube Heatmap · ATM';

  const cellStyle = (value) => {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return 'background:var(--surface-overlay); color:var(--text-muted);';
    }

    const intensity = (value - minVol) / range;
    const lightness = 18 + intensity * 42;

    return `
      background:hsl(198, 85%, ${lightness}%);
      color:${lightness > 42 ? '#061018' : '#f2f7fa'};
      font-weight:600;
    `;
  };

  const rowsHtml = yLabels.map((swapTenor, rowIdx) => {
    const cells = xLabels.map((optionTenor, colIdx) => {
      const value = z[rowIdx]?.[colIdx];
      const label = typeof value === 'number' && Number.isFinite(value)
        ? `${(value * 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`
        : '–';

      return `
        <td
          title="${optionTenor} x ${swapTenor}"
          style="
            ${cellStyle(value)}
            padding:10px 12px;
            text-align:center;
            border:1px solid var(--border-subtle);
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
          background:var(--surface-header);
          color:var(--text-primary);
          padding:10px 12px;
          text-align:left;
          border:1px solid var(--border-subtle);
          z-index:1;
        ">
          ${swapTenor}
        </th>
        ${cells}
      </tr>
    `;
  }).join('');

  const headerHtml = xLabels.map(t => `
    <th style="
      background:var(--surface-header);
      color:var(--text-primary);
      padding:10px 12px;
      text-align:center;
      border:1px solid var(--border-subtle);
      position:sticky;
      top:0;
      z-index:2;
    ">
      ${t}
    </th>
  `).join('');

  el.innerHTML = `
    <div style="height:100%; overflow:auto; padding:10px;">
      <div style="margin-bottom:10px; color:var(--text-primary); font-weight:600;">
        ${title}
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
              background:var(--surface-header);
              color:var(--text-primary);
              padding:10px 12px;
              text-align:left;
              border:1px solid var(--border-subtle);
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

  const state = window.appState || globalThis.appState;
  if (state) state.swaptionCubeSurfacePng = null;

  notifyRiskPreview('interestRates');
}

// Backward-compatible name, damit bestehende Listener nicht brechen
export function renderSwaptionCubeSurface3D() {
  return renderSwaptionCubeHeatmap();
}

export function renderSwaptionCubeSummary() {
  const summaryEl = document.getElementById('SwaptionCubeSummaryContainer');

  if (!summaryEl) {
    console.warn('[renderSwaptionCubeSummary] Summary-Container nicht gefunden.');
    return;
  }

  const cube = getCubeState();

  if (!cube) {
    summaryEl.innerHTML = "<div style='opacity:0.7;'>Kein Vol-Cube geladen.</div>";
    notifyRiskPreview('interestRates');
    return;
  }

  const surface = getSelectedCubeSurface(cube);

  if (!surface) {
    summaryEl.innerHTML = "<div style='opacity:0.7;'>Keine Surface verfügbar.</div>";
    notifyRiskPreview('interestRates');
    return;
  }

  const { xLabels, yLabels, z } = getCubeView(surface);
  const flatVols = z.flat().filter(v => typeof v === 'number' && Number.isFinite(v));

  if (!flatVols.length) {
    summaryEl.innerHTML = "<div style='opacity:0.7;'>Keine Vols für diese Auswahl.</div>";
    notifyRiskPreview('interestRates');
    return;
  }

  const minVol = Math.min(...flatVols);
  const maxVol = Math.max(...flatVols);

  const strikeValue = document.getElementById('swaptionCubeStrikeSelect')?.value || '';
  const strikeLabel = strikeValue
    ? `Strike Spread: <strong>${Number(strikeValue)} bp</strong>`
    : `Surface: <strong>ATM</strong>`;

  summaryEl.innerHTML = `
    <div style="margin-bottom:6px; font-weight:600; opacity:0.85;">
      Cube Surface Summary
    </div>

    <div style="margin-bottom:6px; font-size:0.85rem; opacity:0.8; line-height:1.4;">
      ${strikeLabel}<br>
      Vol-Range: <strong>${(minVol * 100).toLocaleString('de-DE', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} % – ${(maxVol * 100).toLocaleString('de-DE', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} %</strong><br>
      Nodes im Ausschnitt: <strong>${flatVols.length}</strong><br>
      Option Tenors: <strong>${xLabels.length}</strong><br>
      Swap Tenors: <strong>${yLabels.length}</strong>
    </div>
  `;

  notifyRiskPreview('interestRates');
}





