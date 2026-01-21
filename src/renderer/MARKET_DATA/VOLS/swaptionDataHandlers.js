// ./MARKET_DATA/VOLS/swaptionDataHandlers.js

import { buildCubeSurfaceGrid, populateSwaptionCubeSelectors } from './volCube.js';

// ---------- helpers (lokal im Feature) ----------
function sortTenors(tenors) {
  function parseTenor(t) {
    if (typeof t !== 'string') return { totalYears: 9999 };

    const match = t.trim().match(/^(\d+)\s*([MDWY])?$/i);
    if (!match) return { totalYears: 9999 };

    const value = parseInt(match[1], 10);
    const unit = (match[2] || 'Y').toUpperCase();

    let factor;
    switch (unit) {
      case 'D': factor = 1 / 365; break;
      case 'W': factor = 7 / 365; break;
      case 'M': factor = 1 / 12; break;
      case 'Y':
      default:  factor = 1; break;
    }
    return { totalYears: value * factor };
  }

  return [...tenors].sort((a, b) => parseTenor(a).totalYears - parseTenor(b).totalYears);
}

function fillSwaptionDropdowns(optionTenors, swapTenors) {
  const optSel = document.getElementById('swaptionOptionTenorSelect');
  const swpSel = document.getElementById('swaptionSwapTenorSelect');

  if (!optSel || !swpSel) {
    console.warn('[swaptionDataHandlers] Swaption dropdowns not found in DOM.');
    return;
  }

  optSel.innerHTML = '';
  swpSel.innerHTML = '';

  optionTenors.forEach((t) => {
    const opt = document.createElement('option');
    opt.value = t;
    opt.textContent = t;
    optSel.appendChild(opt);
  });

  swapTenors.forEach((t) => {
    const opt = document.createElement('option');
    opt.value = t;
    opt.textContent = t;
    swpSel.appendChild(opt);
  });

  if (!optSel.value && optionTenors.length) optSel.value = optionTenors[0];
  if (!swpSel.value && swapTenors.length)   swpSel.value = swapTenors[0];
}

// ---------- public factory ----------
export function createSwaptionDataHandlers({ appState } = {}) {
  if (!appState) {
    console.warn('[swaptionDataHandlers] createSwaptionDataHandlers called without appState.');
  }

  function handleSwaptionATMData(rows) {
    if (!appState) return console.warn('[handleSwaptionATMData] appState fehlt.');

    const safeRows = Array.isArray(rows) ? rows : [];
    appState.setSwaptionATM?.(safeRows);

    const optionSet = new Set();
    const swapSet = new Set();
    for (const r of safeRows) {
      if (r?.option_tenor != null) optionSet.add(String(r.option_tenor));
      if (r?.swap_tenor != null)   swapSet.add(String(r.swap_tenor));
    }

    const optionTenors = sortTenors([...optionSet]);
    const swapTenors = sortTenors([...swapSet]);

    fillSwaptionDropdowns(optionTenors, swapTenors);

    document.dispatchEvent(
      new CustomEvent('swaption:atm:ready', { detail: { count: safeRows.length } })
    );
  }

  function handleSwaptionSmileData(rows) {
    if (!appState) return console.warn('[handleSwaptionSmileData] appState fehlt.');

    const safeRows = Array.isArray(rows) ? rows : [];
    appState.setSwaptionSmile?.(safeRows);

    document.dispatchEvent(
      new CustomEvent('swaption:smile:ready', { detail: { count: safeRows.length } })
    );
  }

  function handleSwaptionCubeSurfaceData(cubeSurfaceFixedK) {
    if (!appState) {
      console.warn('[handleSwaptionCubeSurfaceData] appState fehlt.');
      return;
    }

    const grid = buildCubeSurfaceGrid(cubeSurfaceFixedK);
    if (!grid) {
      console.warn('[handleSwaptionCubeSurfaceData] Grid konnte nicht gebaut werden.');
      return;
    }

    // 1) State setzen
    if (typeof appState.setSwaptionCubeSurface === 'function') appState.setSwaptionCubeSurface(grid);
    else appState.swaptionCubeSurface = grid;

    // 2) Dropdowns füllen
    try { populateSwaptionCubeSelectors(); } catch (e) {
      console.warn('[handleSwaptionCubeSurfaceData] populateSwaptionCubeSelectors failed', e);
    }

    // 3) Data-ready Event
    document.dispatchEvent(
      new CustomEvent('swaption:cube:ready', { detail: { strike: grid.strike, source: 'data' } })
    );

    // 4) Layout-ready Retry
    const start = performance.now();
    const maxMs = 2500;

    const tick = () => {
      const target = document.getElementById('swaption-cube-surface-3d');
      if (!target) {
        if (performance.now() - start < maxMs) requestAnimationFrame(tick);
        return;
      }

      const r = target.getBoundingClientRect();
      const visible = r.width > 10 && r.height > 10;

      if (visible) {
        document.dispatchEvent(
          new CustomEvent('swaption:cube:ready', { detail: { strike: grid.strike, source: 'layout' } })
        );
        return;
      }

      if (performance.now() - start < maxMs) requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
  }

  return {
    handleSwaptionATMData,
    handleSwaptionSmileData,
    handleSwaptionCubeSurfaceData,
  };
}


