// FRONT_END/bootstrap/bootstrapBridges.js

import { bindGlobalChangeDelegation } from '../UI/globalChangeDelegation.js';
import { bindClearCSScenario } from '../OFFERS/csScenarioUI.js';
import { installMarketProvidersBridge } from '../MARKET_DATA/PROVIDERS/marketProvidersBridge.js';
import { bindSwaptionReadyListeners } from '../MARKET_DATA/VOLS/swaptionReadyListeners.js';

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
