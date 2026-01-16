// FRONT_END/PYTHON/pythonBridge.js
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

import { bindPythonExecution } from '../PYTHON/pythonExecution.js'; 

export function installPythonBridge({
  appState,

  // handlers (DI)
  handlePortAggData,
  handlePortProdData,
  handleMVaRData,
  handleSummaryMarketRiskData,
  handleMvarProductTable,
  handleCVaRData,

  handleSwaptionATMData,
  handleSwaptionSmileData,
  handleSwaptionCubeSurfaceData,

  buildCubeSurfaceGrid,
  populateSwaptionCubeSelectors,

  openPortAnalyseAndFocus,

  // receivers hooks
  onExcelComplete,
  onAIColumnComplete,

  // optional: keep dev global
  exposeGlobal = true,
} = {}) {
  if (!appState) throw new Error('[pythonBridge] appState is required');

  const py = bindPythonExecution({
    appState,

    handlePortAggData,
    handlePortProdData,
    handleMVaRData,
    handleSummaryMarketRiskData,
    handleMvarProductTable,
    handleCVaRData,

    handleSwaptionATMData,
    handleSwaptionSmileData,
    handleSwaptionCubeSurfaceData,

    buildCubeSurfaceGrid,
    populateSwaptionCubeSelectors,

    openPortAnalyseAndFocus: (typeof openPortAnalyseAndFocus === 'function') ? openPortAnalyseAndFocus : null,
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
