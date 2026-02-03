// FRONT_END/bootstrap/bootstrapBridges.js

import { bindGlobalChangeDelegation } from '../ui/globalChangeDelegation.js';
import { bindClearCSScenario } from '../../features/OFFERS/csScenarioUI.js';
import { installMarketProvidersBridge } from '../../features/MARKET_DATA/PROVIDERS/marketProvidersBridge.js';
import { bindSwaptionReadyListeners } from '../../features/MARKET_DATA/VOLS/swaptionReadyListeners.js';

export function bootstrapBridges(appState, deps) {
  const {
    api,
    ratesHandlers,
    handlePortProdData,
    handleProviderData,
  } = deps;

  bindGlobalChangeDelegation({
    appState,
    handleEUSWData: ratesHandlers.handleEUSWData,
  });

  bindClearCSScenario({
    appState,
    api,
    handlePortProdData,
  });

  installMarketProvidersBridge({
    api,
    handleProviderData,
  });

  // Debug (optional)
  window.appState = appState;

  bindSwaptionReadyListeners({ appState });
}

