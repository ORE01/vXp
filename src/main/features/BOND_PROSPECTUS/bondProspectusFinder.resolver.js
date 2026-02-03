'use strict';

const { normalizeISIN, normalizeWKN } = require('./bondProspectusFinder.domains.js');

function createBondProspectusFinderResolver(deps) {
  const log = deps && deps.log ? deps.log : (() => {});
  const service = deps && deps.service;
  if (!service || typeof service.findProspectus !== 'function') {
    throw new Error('BondProspectusFinderResolver: service missing');
  }

  async function resolveFind(payload) {
    try {
      const input = normalizeInput(payload);
      const options = normalizeOptions(payload);
      return await service.findProspectus(input, options);
    } catch (err) {
      log({ level: 'error', msg: 'resolveFind failed', err: String(err && err.message ? err.message : err) });
      return { status: 'error', message: String(err && err.message ? err.message : err) };
    }
  }

  function ping() {
    return { status: 'ok', message: 'bondProspectusFinder alive' };
  }

  return { resolveFind, ping };
}

function normalizeInput(payload) {
  const isin = normalizeISIN(payload && payload.isin);
  const wkn  = normalizeWKN(payload && payload.wkn);

  return {
    isin: isin || undefined,
    wkn: wkn || undefined,
    issuerName: payload && payload.issuerName ? String(payload.issuerName).trim() : undefined,
    bondName: payload && payload.bondName ? String(payload.bondName).trim() : undefined,
    currency: payload && payload.currency ? String(payload.currency).trim().toUpperCase() : undefined,
    country: payload && payload.country ? String(payload.country).trim().toUpperCase() : undefined,
  };
}

function normalizeOptions(payload) {
  const o = payload && payload.options ? payload.options : {};
  return {
    minConfidence: isFiniteNumber(o.minConfidence) ? Number(o.minConfidence) : undefined,
    maxCandidates: isFiniteNumber(o.maxCandidates) ? Number(o.maxCandidates) : undefined,
    timeoutMs: isFiniteNumber(o.timeoutMs) ? Number(o.timeoutMs) : undefined,
  };
}

function isFiniteNumber(x) {
  return typeof x === 'number' && Number.isFinite(x);
}

module.exports = { createBondProspectusFinderResolver };

