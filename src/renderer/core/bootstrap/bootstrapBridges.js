'use strict';

import { bindGlobalChangeDelegation } from '../ui/globalChangeDelegation.js';
import { bindClearCSScenario } from '../../features/OFFERS/csScenarioUI.js';
import { installMarketProvidersBridge } from '../../features/MARKET_DATA/PROVIDERS/marketProvidersBridge.js';
import { bindSwaptionReadyListeners } from '../../features/MARKET_DATA/VOLS/swaptionReadyListeners.js';

export function bootstrapBridges(appState, deps = {}) {
  const {
    api,
    ratesHandlers,
    handlePortProdData,
    handleProviderData,
  } = deps;

  if (!api) throw new Error('[bootstrapBridges] api missing');
  if (!appState) throw new Error('[bootstrapBridges] appState missing');

  // SOFORT setzen, bevor irgendetwas anderes potenziell crasht
  window.appState = appState;
  console.log('[bootstrapBridges] window.appState set:', window.appState);

  if (!ratesHandlers || typeof ratesHandlers !== 'object') {
    console.error('[bootstrapBridges] ratesHandlers missing/invalid:', ratesHandlers);
    throw new Error('[bootstrapBridges] ratesHandlers missing. Ensure bootstrapHandlers passes ratesHandlers into bootstrapBridges().');
  }

  const handleEUSWData =
    (typeof ratesHandlers.handleEUSWData === 'function' && ratesHandlers.handleEUSWData) ||
    (typeof ratesHandlers.handleRATESData === 'function' && ratesHandlers.handleRATESData) ||
    null;

  if (!handleEUSWData) {
    console.error('[bootstrapBridges] No EUSW/RATES handler on ratesHandlers:', Object.keys(ratesHandlers || {}));
    throw new Error('[bootstrapBridges] ratesHandlers has no handleEUSWData/handleRATESData.');
  }

  bindGlobalChangeDelegation({
    appState,
    handleEUSWData,
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

  bindSwaptionReadyListeners({ appState });
}

