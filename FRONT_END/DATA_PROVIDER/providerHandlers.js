// FRONT_END/MARKET_DATA/PROVIDERS/providerHandlers.js

/**
 * Wires market data providers (ECB/FED/Yahoo) from IPC -> handler(data, type).
 * Keeps provider-specific IPC channels out of installReceivers.js.
 */
export function wireMarketProviders({ api, handleProviderData } = {}) {
  if (!api) throw new Error('[wireMarketProviders] api missing');
  if (typeof handleProviderData !== 'function') {
    console.warn('[wireMarketProviders] handleProviderData missing');
    return;
  }

  const mapping = [
    ['ecbData', 'ecb'],
    ['fedData', 'fed'],
    ['yahooData', 'yahoo'],
  ];

  mapping.forEach(([eventName, type]) => {
    api.receive(eventName, (data) => handleProviderData(data, type));
  });
}
