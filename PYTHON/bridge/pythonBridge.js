// PYTHON/bridge/pythonBridge.js
/**
 * pythonBridge
 *
 * Purpose:
 * - Centralizes creation of the python execution facade (bindPythonExecution)
 * - Installs python receivers once
 * - Returns { py } for DI into other modules (bindAppButtons, etc.)
 *
 * Renderer stays clean: Boot + Wiring + DI.
 */

import { bindPythonExecution } from '../execution/index.js';

export function installPythonBridge({
  appState,

  // ✅ NEW (bundled)
  handlers = {},
  hooks = {},

  // optional: keep dev global
  exposeGlobal = true,
} = {}) {
  if (!appState) throw new Error('[pythonBridge] appState is required');

  // --- unpack bundles (with safe defaults) ---
  const {
    port = {},
    mvar = {},
    cvar = {},
    swaption = {},
    cube = {},
    nav = {},
  } = handlers;

  const {
    onExcelComplete,
    onAIColumnComplete,
  } = hooks;

  // --- flatten for execution layer (NO behaviour change) ---
  const py = bindPythonExecution({
    appState,

    // PORT
    handlePortAggData: port.handlePortAggData,
    handlePortProdData: port.handlePortProdData,

    // MVaR
    handleMVaRData: mvar.handleMVaRData,
    handleSummaryMarketRiskData: mvar.handleSummaryMarketRiskData,
    handleMvarProductTable: mvar.handleMvarProductTable,

    // CVaR
    handleCVaRData: cvar.handleCVaRData,

    // Swaption
    handleSwaptionATMData: swaption.handleSwaptionATMData,
    handleSwaptionSmileData: swaption.handleSwaptionSmileData,
    handleSwaptionCubeSurfaceData: swaption.handleSwaptionCubeSurfaceData,

    // Cube helpers (optional)
    buildCubeSurfaceGrid: cube.buildCubeSurfaceGrid,
    populateSwaptionCubeSelectors: cube.populateSwaptionCubeSelectors,

    // Navigation helper (optional)
    openPortAnalyseAndFocus: (typeof nav.openPortAnalyseAndFocus === 'function')
      ? nav.openPortAnalyseAndFocus
      : null,
  });

  // Install receivers once
  py.installPythonReceivers({
    onExcelComplete,
    onAIColumnComplete,
  });

  if (exposeGlobal) {
    window.__py = py;
  }

  return { py };
}

