// FRONT_END/bootstrap/bootstrapPython.js

import { installPythonBridge } from '../../PYTHON/pythonBridge.js';
import { installPythonProgressBarsBridge } from '../../PYTHON/pythonProgressBarsBridge.js';

export function bootstrapPython(appState, deps) {
  const {
    handlePortAggData,
    handlePortProdData,
    handleMVaRData,
    handleSummaryMarketRiskData,
    handleMvarProductTable,
    handleCVaRData,

    buildCubeSurfaceGrid,
    populateSwaptionCubeSelectors,

    handleSwaptionATMData,
    handleSwaptionSmileData,
    handleSwaptionCubeSurfaceData,

    onExcelComplete,
  } = deps;

  const { py } = installPythonBridge({
    appState,

    handlePortAggData,
    handlePortProdData,
    handleMVaRData,
    handleSummaryMarketRiskData,
    handleMvarProductTable,
    handleCVaRData,

    buildCubeSurfaceGrid,
    populateSwaptionCubeSelectors,

    handleSwaptionATMData,
    handleSwaptionSmileData,
    handleSwaptionCubeSurfaceData,

    openPortAnalyseAndFocus: (typeof openPortAnalyseAndFocus === 'function') ? openPortAnalyseAndFocus : null,

    onExcelComplete,

    exposeGlobal: true,
  });

  installPythonProgressBarsBridge();

  return { py };
}
