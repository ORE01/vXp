// FRONT_END/MARKET_DATA/PROVIDERS/providerHandlers.js

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
    ['ersteData', 'erste'],
  ];

  mapping.forEach(([eventName, type]) => {
    api.receive(eventName, (data) => handleProviderData(data, type));
  });
}
