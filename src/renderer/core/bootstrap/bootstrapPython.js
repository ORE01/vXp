// core/bootstrap/bootstrapPython.js

import { installPythonBridge } from '../../../../PYTHON/bridge/pythonBridge.js';
import { installPythonProgressBarsBridge } from '../../../../PYTHON/progress/pythonProgressBarsBridge.js';

export function bootstrapPython(appState, deps) {

  //HANDLER ENTNEHMEN; (lokale Variablen → handlers/hooks contract)====================================================

  const {
    // PORT
    handlePortAggData,
    handlePortProdData,

    // MVaR
    handleMVaRData,
    handleSummaryMarketRiskData,
    handleMvarProductTable,

    // CVaR
    handleCVaRData,

    // Swaption + Cube helpers
    buildCubeSurfaceGrid,
    populateSwaptionCubeSelectors,
    handleSwaptionAtmBaseData,
    handleSwaptionSmileBaseData,
    handleSwaptionAtmScenarioData,
    handleSwaptionSmileScenarioData,
    //handleSwaptionCubeData,

    // hooks
    onExcelComplete,

    // optional
    openPortAnalyseAndFocus,
    onAIColumnComplete,
  } = deps;

// HANDLER ZUORDNUNG (BÜNDELN); (lokale Variablen → handlers/hooks contract) =======================================================

  const handlers = {
    port: {
      handlePortAggData,
      handlePortProdData,
    },
    mvar: {
      handleMVaRData,
      handleSummaryMarketRiskData,
      handleMvarProductTable,
    },
    cvar: {
      handleCVaRData,
    },
    swaption: {
        handleSwaptionAtmBaseData,
        handleSwaptionSmileBaseData,
        handleSwaptionAtmScenarioData,
        handleSwaptionSmileScenarioData,
      //handleSwaptionCubeData,
    },
    cube: {
      buildCubeSurfaceGrid,
      populateSwaptionCubeSelectors,
    },
    nav: {
      openPortAnalyseAndFocus, // bridge prüft selbst typeof function
    },
  };

  const hooks = {
    onExcelComplete,
    onAIColumnComplete, // optional, falls du’s irgendwo brauchst
  };

  const { py } = installPythonBridge({
    appState,
    handlers,
    hooks,
    exposeGlobal: true,
  });

  installPythonProgressBarsBridge();

  return { py };
}


