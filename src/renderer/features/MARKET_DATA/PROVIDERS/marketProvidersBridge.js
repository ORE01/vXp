// FRONT_END/MARKET_DATA/PROVIDERS/marketProvidersBridge.js

import { wireMarketProviders } from '../../DATA_PROVIDER/providerHandlers.js';

// NOTE:
// Provider panel triggers (.provider-triggers .section-trigger[data-panel])
// are bound centrally by the panel system (UI/panels.js or related).
// This bridge is DATA-only by design to avoid double-binding.


export function installMarketProvidersBridge({ api, handleProviderData } = {}) {
  if (!api) throw new Error('[marketProvidersBridge] api missing');
  if (typeof handleProviderData !== 'function') {
    throw new Error('[marketProvidersBridge] handleProviderData must be a function');
  }

  if (window.__marketProvidersDataBoundOnce) return;
  window.__marketProvidersDataBoundOnce = true;

  wireMarketProviders({ api, handleProviderData });
}



