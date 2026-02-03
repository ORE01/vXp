'use strict';

function createBondsService({ dataCollector, log }) {
  log = log || (() => {});
  if (!dataCollector || typeof dataCollector.parseSinglePdf !== 'function') {
    throw new Error('BONDS.service: dataCollector.parseSinglePdf missing');
  }

  async function parsePdf({ url, isin }) {
    if (!url) return { ok: false, error: 'pdf url required' };

    try {
      const r = await dataCollector.parseSinglePdf(url, isin || null);
      // r is whatever dc.parseSinglePdf returns; we wrap in a stable envelope
      return { ok: true, isin: isin || null, url, result: r };
    } catch (err) {
      return { ok: false, isin: isin || null, url, error: err?.message || String(err) };
    }
  }

  async function parsePdfBatch(items) {
    if (!Array.isArray(items) || items.length === 0) return [];

    // sequential = safer (rate limits / memory). later we can do concurrency with a limit.
    const out = [];
    for (const it of items) {
      out.push(await parsePdf({ url: it?.url, isin: it?.isin }));
    }
    return out;
  }

  return { parsePdf, parsePdfBatch };
}

module.exports = { createBondsService };

