'use strict';

const {
  DEFAULTS,
  normalizeISIN,
  normalizeWKN,
  guessFormatFromUrl,
} = require('./bondProspectusFinder.domains.js');

function createBondProspectusFinderService(deps) {
  const log = deps && deps.log ? deps.log : (() => {});
  if (!deps || typeof deps.httpGet !== 'function') {
    throw new Error('BondProspectusFinder: httpGet missing');
  }

  async function findProspectus(input, options) {
    const isin = normalizeISIN(input && input.isin);
    const wkn  = normalizeWKN(input && input.wkn);

    if (!isin && !wkn && !(input && input.issuerName) && !(input && input.bondName)) {
      return { status: 'invalid_input', message: 'Provide ISIN, WKN, issuerName or bondName.' };
    }

    const cfg = {
      minConfidence: options && options.minConfidence != null ? options.minConfidence : DEFAULTS.minConfidence,
      maxCandidates: options && options.maxCandidates != null ? options.maxCandidates : DEFAULTS.maxCandidates,
      timeoutMs: options && options.timeoutMs != null ? options.timeoutMs : DEFAULTS.timeoutMs,
    };

    const queries = buildSearchQueries({
      isin, wkn,
      issuerName: input && input.issuerName,
      bondName: input && input.bondName,
    });

    const candidatesRaw = [];
    for (const q of queries) {
      const batch = await retrieveCandidatesStub(q, deps.httpGet, cfg.timeoutMs, log);
      candidatesRaw.push.apply(candidatesRaw, batch);
      if (candidatesRaw.length >= cfg.maxCandidates * 3) break;
    }

    const candidates = candidatesRaw
      .map(c => normalizeCandidate(c, { isin, wkn }))
      .map(c => Object.assign({}, c, { confidence: scoreCandidate(c, { isin, wkn, input }) }))
      .sort((a, b) => (b.confidence || 0) - (a.confidence || 0))
      .slice(0, cfg.maxCandidates);

    const best = candidates[0];

    if (!best || (best.confidence || 0) < cfg.minConfidence) {
      return {
        status: 'not_found',
        message: 'No sufficiently confident prospectus candidate found.',
        candidates,
        debug: { queries, cfg },
      };
    }

    return { status: 'ok', best, candidates, debug: { queries, cfg } };
  }

  return { findProspectus };
}

function buildSearchQueries({ isin, wkn, issuerName, bondName }) {
  const qs = [];
  if (isin) qs.push(`${isin} prospectus pdf`);
  if (wkn)  qs.push(`${wkn} prospekt pdf`);
  if (issuerName && bondName) qs.push(`"${issuerName}" "${bondName}" prospectus pdf`);
  if (issuerName) qs.push(`"${issuerName}" bond prospectus pdf`);
  return uniq(qs).slice(0, 6);
}

function uniq(arr) {
  const out = [];
  const seen = new Set();
  for (const x of arr) {
    if (!x) continue;
    if (seen.has(x)) continue;
    seen.add(x);
    out.push(x);
  }
  return out;
}

function normalizeCandidate(c, { isin, wkn }) {
  const url = String(c && c.url ? c.url : '').trim();
  return {
    url,
    title: String(c && c.title ? c.title : '').trim(),
    sourceType: (c && c.sourceType) || 'web',
    sourceName: (c && c.sourceName) || 'stub',
    format: (c && c.format) || guessFormatFromUrl(url),
    docType: (c && c.docType) || 'UNKNOWN',
    isin: (c && c.isin) || isin || undefined,
    wkn: (c && c.wkn) || wkn || undefined,
    language: c && c.language,
    publishedAtISO: c && c.publishedAtISO,
  };
}

function scoreCandidate(c, { isin, wkn, input }) {
  let s = 0;
  const title = String(c && c.title ? c.title : '').toLowerCase();
  const url   = String(c && c.url ? c.url : '').toLowerCase();

  if (c && c.format === 'PDF') s += 0.25;
  if (title.includes('prospectus') || title.includes('prospekt')) s += 0.25;

  if (isin) {
    const isinL = isin.toLowerCase();
    if (title.includes(isinL) || url.includes(isinL)) s += 0.35;
  }
  if (wkn) {
    const wknL = wkn.toLowerCase();
    if (title.includes(wknL) || url.includes(wknL)) s += 0.20;
  }

  if (input && input.issuerName) {
    const issuer = String(input.issuerName).toLowerCase();
    if (issuer && title.includes(issuer)) s += 0.10;
  }

  return Math.max(0, Math.min(1, s));
}

async function retrieveCandidatesStub(query, _httpGet, _timeoutMs, log) {
  // Absichtlich leer. Wir hängen hier später echte Quellen an (z.B. DataCollector, DB, lokale PDFs).
  log({ level: 'debug', msg: 'ProspectusFinder query (stub)', query });
  return [];
}

module.exports = { createBondProspectusFinderService };

