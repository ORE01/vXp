'use strict';

// IPC channel names
const IPC_BOND_PROSPECTUS_FIND = 'bondProspectusFinder:find';
const IPC_BOND_PROSPECTUS_PING = 'bondProspectusFinder:ping';

const DEFAULTS = Object.freeze({
  minConfidence: 0.55,
  maxCandidates: 8,
  timeoutMs: 12000,
});

function normalizeISIN(isin) {
  if (!isin) return null;
  const x = String(isin).trim().toUpperCase().replace(/\s+/g, '');
  return /^[A-Z]{2}[A-Z0-9]{9}\d$/.test(x) ? x : null;
}

function normalizeWKN(wkn) {
  if (!wkn) return null;
  const x = String(wkn).trim().toUpperCase().replace(/\s+/g, '');
  // WKN: 6-stellig, ohne I/O (und typischerweise kein Sonderzeichen)
  return /^[A-HJ-NP-Z0-9]{6}$/.test(x) ? x : null;
}

function guessFormatFromUrl(url) {
  const u = String(url || '').toLowerCase();
  if (u.includes('.pdf')) return 'PDF';
  if (u.startsWith('http')) return 'HTML';
  return 'UNKNOWN';
}

module.exports = {
  IPC_BOND_PROSPECTUS_FIND,
  IPC_BOND_PROSPECTUS_PING,
  DEFAULTS,
  normalizeISIN,
  normalizeWKN,
  guessFormatFromUrl,
};

