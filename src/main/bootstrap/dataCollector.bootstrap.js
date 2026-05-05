'use strict';

function createDataCollectorBootstrap({
  createDataCollector,
  createCrawlerResolver,
  createContentMatchingResolver,
  createSitemapResolver,
}) {
  function buildResolver() {
    const domains = [
      'bngbank.com',
      'afm.nl',
      'esma.europa.eu',
      'bourse.lu',
      'luxse.com',
      'euronext.com',
      'ise.ie',
      'londonstockexchange.com',
      'oebfa.at',
      'wienerborse.at',
    ];

    const crawler = createCrawlerResolver(domains, {
      maxDepth: 2,
      maxPagesPerDomain: 60,
      maxPdfChecksPerDomain: 40,
    });

    const content = createContentMatchingResolver(domains, {
      maxCandidatesPerDomain: 40,
    });

    const sitemaps = createSitemapResolver(domains);

    return async (isin) =>
      (await crawler(isin)) ||
      (await content(isin)) ||
      (await sitemaps(isin)) ||
      null;
  }

  function init() {
    const resolver = buildResolver();
    return createDataCollector({
      resolvePdf: resolver,
    });
  }

  return { init };
}

module.exports = { createDataCollectorBootstrap };