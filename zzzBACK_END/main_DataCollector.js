// DataCollector.js (ganz oben, vor pdf-parse!)
let pdfjsLib;
try {
  pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');   // bevorzugt
} catch {
  try { pdfjsLib = require('pdfjs-dist/build/pdf.js'); }  // Fallback
  catch {}
}
if (pdfjsLib && pdfjsLib.VerbosityLevel && typeof pdfjsLib.setVerbosityLevel === 'function') {
  pdfjsLib.setVerbosityLevel(pdfjsLib.VerbosityLevel.ERRORS); // nur Errors, keine Warnings
}

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const pdfParse = require('pdf-parse');
const dayjs = require('dayjs');
const customParseFormat = require('dayjs/plugin/customParseFormat');
dayjs.extend(customParseFormat);

(() => {
  const noisy = [
    /^Warning:\s*TT:\s*undefined function:/i,
    /Ignoring invalid character .* in hex string/i,
    /Indexing all PDF objects/i,
    /Could not find a preferred cmap table/i
  ];
  const ow = console.warn;
  console.warn = (...args) => {
    const s = args[0] && String(args[0]);
    if (s && noisy.some(rx => rx.test(s))) return;
    ow(...args);
  };
})();

function withMutedPdfWarnings(run) {
  const pats = [
    /^Warning:\s*TT:\s*undefined function:/i,
    /Ignoring invalid character .* in hex string/i,
    /Could not find a preferred cmap table/i,
    /Indexing all PDF objects/i,
  ];
  const ow = console.warn, oe = console.error;
  const mute = (orig) => (...args) => {
    const s = args[0] ? String(args[0]) : '';
    if (s && pats.some(rx => rx.test(s))) return;
    return orig(...args);
  };
  console.warn = mute(ow);
  console.error = mute(oe);
  try { return run(); }
  finally { console.warn = ow; console.error = oe; }
}



function createDataCollector({
  cseKey,
  cseCx,
  whitelist = ['bngbank.com','kfw.de','esma.europa.eu','afm.nl'],
  resolvePdf = null
} = {}) {
  if (!resolvePdf) assertConfig({ cseKey, cseCx });

  // ---- Gemeinsame Worker-Funktion (ohne `this`) ----
  const runFetch = async (isins = []) => {
    const out = [];
    if (!Array.isArray(isins)) isins = [];

    for (const isin of isins) {
      try {
        const pdfRef = resolvePdf
          ? await resolvePdf(isin)
          : await findFinalTermsPdf({ isin, cseKey, cseCx, whitelist });

        if (!pdfRef) {
          out.push({ isin, terms: {}, rows: [], error: 'Final Terms not found' });
          continue;
        }

        const terms = await parseFinalTerms(pdfRef);
        const schedule = buildSchedule(terms);
        out.push({
          isin,
          terms: { ...terms, pdfUrl: pdfRef },
          rows: toProdCouponRows(isin, terms.coupon, schedule)
        });
      } catch (e) {
        out.push({ isin, terms: {}, rows: [], error: e?.message || String(e) });
      }
    }
    return out;
  };

  return {
    // vorher: async fetchTermsAndSchedule(...) { ... }
    fetchTermsAndSchedule: runFetch,

    // vorher: this.fetchTermsAndSchedule(...)  -> jetzt ohne `this`
    async fetchTermsOnly(isins = []) {
      const res = await runFetch(isins);
      const list = Array.isArray(res) ? res : [];
      return list.map(r => ({ isin: r.isin ?? null, terms: r.terms ?? {}, error: r.error }));
    },

    // Direkt-PDF-Parser (wie besprochen)
    async parseSinglePdf(pdfRef, isin = null) {
      const terms = await parseFinalTerms(pdfRef);
      const schedule = buildSchedule(terms);
      return {
        isin,
        terms: { ...terms, pdfUrl: pdfRef },
        rows: toProdCouponRows(isin || '', terms.coupon, schedule)
      };
    }
  };
}





/* =========================
   Resolver (ohne Google-Key)
   ========================= */

/** Einfacher Sitemap-Resolver:
 *  Lädt (Root-)Sitemaps der Domains und sucht eine PDF-URL, die die ISIN im Link enthält.
 */
function createSitemapResolver(domains = [], {
  maxRootSitemaps = 2,
  timeoutMs = 10000
} = {}) {
  const axiosText = (url) => axios.get(url, { timeout: timeoutMs }).then(r => String(r.data)).catch(() => null);
  const extractLocs = (xml) => {
    if (!xml) return [];
    const locs = []; const re = /<loc>\s*([^<\s]+)\s*<\/loc>/gi; let m;
    while ((m = re.exec(xml))) locs.push(m[1]);
    return locs;
  };
  const sitemapCandidates = (host) => [
    `https://${host}/sitemap.xml`,
    `https://${host}/sitemap_index.xml`,
  ];

  async function findOn(host, isin) {
    const roots = sitemapCandidates(host).slice(0, maxRootSitemaps);
    const rootXmls = await Promise.all(roots.map(axiosText));
    const rootLocs = rootXmls.flatMap(extractLocs);

    // Child-Sitemaps
    const childMaps = rootLocs.filter(u => /\.xml(\.gz)?$/i.test(u) && !/\/sitemap(_index)?\.xml$/i.test(u));
    const childXmls = await Promise.all(childMaps.map(axiosText));
    const childLocs = childXmls.flatMap(extractLocs);

    const allUrls = [
      ...rootLocs.filter(u => !/\.xml(\.gz)?$/i.test(u)),
      ...childLocs
    ];

    const hit = allUrls.find(u =>
      /\.pdf(\?|$)/i.test(u) && u.toUpperCase().includes(isin.toUpperCase())
    );
    return hit || null;
  }

  return async function resolvePdf(isin) {
    for (const host of domains) {
      const hit = await findOn(host, isin);
      if (hit) return hit;
    }
    return null;
  };
}

/** Content-Matching-Resolver:
 *  Sammelt PDF-Kandidaten (über Sitemaps), lädt deren Inhalt
 *  und prüft, ob die ISIN im Text steht.
 */
function createContentMatchingResolver(domains = [], {
  maxRootSitemaps = 2,            // wie viele Root-Sitemaps pro Domain probieren
  maxCandidatesPerDomain = 30,    // PDF-Downloads begrenzen (Bandbreite!)
  timeoutMs = 12000
} = {}) {
  const axiosText = (url) => axios.get(url, { timeout: timeoutMs }).then(r => String(r.data)).catch(() => null);

  const extractLocs = (xml) => {
    if (!xml) return [];
    const locs = []; const re = /<loc>\s*([^<\s]+)\s*<\/loc>/gi; let m;
    while ((m = re.exec(xml))) locs.push(m[1]);
    return locs;
  };

  const sitemapCandidates = (host) => [
    `https://${host}/sitemap.xml`,
    `https://${host}/sitemap_index.xml`,
  ];

// ersetzt looksLikeFinalTerms:
const looksLikeFinalTerms = (url) => {
  const u = url.toLowerCase();
  if (!u.endsWith('.pdf')) return false;
  return /final[-_ ]?terms|pricing[-_ ]?supplement|offering[-_ ]?circular|base[-_ ]?prospectus|prospectus|investor|investors|documents|docs/.test(u);
};



  async function findPdfForIsinOn(host, isin) {
    // 1) Root Sitemaps laden
    const roots = sitemapCandidates(host).slice(0, maxRootSitemaps);
    const rootXmls = await Promise.all(roots.map(axiosText));
    const rootLocs = rootXmls.flatMap(extractLocs);

    // 2) Child-Sitemaps laden (falls sitemap_index.xml verlinkt)
    const childMaps = rootLocs.filter(u => /\.xml(\.gz)?$/i.test(u) && !/\/sitemap(_index)?\.xml$/i.test(u));
    const childXmls = await Promise.all(childMaps.map(axiosText));
    const childLocs = childXmls.flatMap(extractLocs);

    // 3) Kandidaten (PDFs) sammeln & beschränken
    const allUrls = [
      ...rootLocs.filter(u => !/\.xml(\.gz)?$/i.test(u)),
      ...childLocs
    ];
    const pdfs = allUrls.filter(looksLikeFinalTerms);

    // 4) Falls zu wenig Treffer: alle PDFs als Fallback
    const fallbackPdfs = allUrls.filter(u => u.toLowerCase().endsWith('.pdf'));
    const candidates = (pdfs.length ? pdfs : fallbackPdfs).slice(0, maxCandidatesPerDomain);

    // 5) Inhalte prüfen, ob ISIN im Text vorkommt
    for (const url of candidates) {
      try {
        const buf = (await axios.get(url, { responseType: 'arraybuffer', timeout: timeoutMs })).data;
        const txt = (await pdfParse(buf)).text;
        if (txt && txt.toUpperCase().includes(isin.toUpperCase())) {
          return url; // Treffer
        }
      } catch (_) { /* leise ignorieren */ }
    }
    return null;
  }

  return async function resolvePdf(isin) {
    for (const host of domains) {
      const hit = await findPdfForIsinOn(host, isin);
      if (hit) return hit;
    }
    return null;
  };
}

/* =========================
   Parsing & Helpers
   ========================= */

function assertConfig({ cseKey, cseCx }) {
  if (!cseKey || !cseCx) throw new Error('GOOGLE_CSE_KEY / GOOGLE_CX fehlt');
}

async function findFinalTermsPdf({ isin, cseKey, cseCx, whitelist }) {
  const siteFilter = whitelist.map(d => `site:${d}`).join(' OR ');
  const q = `${isin} ("Final Terms" OR "Prospectus" OR "Press Release") ${siteFilter}`;
  const { data } = await axios.get('https://www.googleapis.com/customsearch/v1', {
    params: { key: cseKey, cx: cseCx, q, fileType: 'pdf' },
    timeout: 10000
  });
  const item = (data.items || []).find(it => (it.link || '').toLowerCase().endsWith('.pdf'));
  return item?.link || null;
}

function muteTTWarnings() {
  const origWarn = console.warn;
  console.warn = (msg, ...args) => {
    const s = typeof msg === 'string' ? msg : '';
    if (/^Warning:\s*TT:\s*undefined function:\s*\d+/.test(s)) return; // swallow
    origWarn(msg, ...args);
  };
  return () => { console.warn = origWarn; };
}

// async function parseFinalTerms(pdfRef) {
//   let buf;
//   if (/^https?:\/\//i.test(pdfRef)) {
//     buf = (await axios.get(pdfRef, { responseType: 'arraybuffer', timeout: 15000 })).data;
//   } else {
//     const abs = path.isAbsolute(pdfRef) ? pdfRef : path.resolve(pdfRef);
//     if (!fs.existsSync(abs)) throw new Error(`PDF not found at ${abs}`);
//     buf = fs.readFileSync(abs);
//   }

//   // 👇 nur rund um pdf-parse die TT-Warnungen stummschalten
//   const restoreWarn = muteTTWarnings();
//   let raw;
//   try {
//     raw = (await pdfParse(buf)).text || '';
//   } finally {
//     restoreWarn();
//   }

//   // --- Normalize: Zeilenumbrüche/Soft-Hyphen/Doppelspaces glätten ---
//   const T = raw
//     .replace(/\u00AD/g, '')          // Soft hyphen raus
//     .replace(/\r?\n+/g, ' ')         // Zeilenumbrüche -> Space
//     .replace(/\s{2,}/g, ' ')         // doppelte Spaces
//     .trim();

//   const get = (re) => (T.match(re)?.[1] || '').trim();
//   const toPct = (s) => parseFloat(String(s).replace(',', '.')) / 100;

//   // 1) Coupon EXAKT parsen (erst positiv suchen, dann Zero prüfen)
//   let coupon = null;

//   // a) „Fixed Rate(s) of Interest: 2.75 per cent.“
//   const mFixed = T.match(
//     /fixed\s*rate(?:\(\s*s\s*\))?\s*of\s*interest[^0-9]{0,40}([0-9]+(?:[.,][0-9]+)?)\s*(?:%|per\s*cent\.?|percent)\b/i
//   );
//   if (mFixed) {
//     coupon = toPct(mFixed[1]); // -> 0.0275
//   } else {
//     // b) generische Varianten: Coupon, Interest Rate, Rate of Interest
//     const mGeneric = T.match(
//       /(?:coupon(?:\s*rate)?|interest(?:\s*rate)?|rate\s*of\s*interest)\s*[:\-]?\s*([0-9]+(?:[.,][0-9]+)?)\s*(?:%|per\s*cent\.?|percent)\b/i
//     );
//     if (mGeneric) coupon = toPct(mGeneric[1]);
//   }

//   // 2) Nur wenn KEIN Coupon gefunden: Zero-Coupon erkennen (eng am Feld)
//   if (coupon === null) {
//     const zeroPhrase =
//       /\bzero\s*coupon\b/i.test(T) ||
//       /(?:fixed\s*rate(?:\(\s*s\s*\))?\s*of\s*interest|coupon|interest(?:\s*rate)?)\s*[:\-]?\s*0(?:[.,]0+)?\s*(?:%|per\s*cent\.?|percent)\b/i
//         .test(T);
//     if (zeroPhrase) coupon = 0; // sonst bleibt null
//   }

//   // 3) Dates
//   const maturityRaw = get(/(?:maturity\s+date|redemption(?:[^a-zA-Z]|.*?date))\s*[:\-]?\s*([0-9]{1,2}\s+\w+\s+\d{4}|[0-9]{4}-\d{2}-\d{2})/i);
//   const issueRaw    = get(/(?:issue\s+date|interest\s+commencement\s+date)\s*[:\-]?\s*([0-9]{1,2}\s+\w+\s+\d{4}|[0-9]{4}-\d{2}-\d{2})/i);

//   // 4) Frequenz – „per annum payable annually“ → A
//   function extractFrequency(text) {
//     if (/semi[-\s]?annually|semi[-\s]?annual|half[-\s]?year/i.test(text)) return 'S/A';
//     if (/quarterly/i.test(text)) return 'Q';
//     if (/monthly/i.test(text)) return 'M';
//     if (/per\s+annum|annually|annual/i.test(text)) return 'A';
//     return 'A';
//   }
//   const frequency = (coupon === 0) ? 'Z' : extractFrequency(T);

//   return {
//     coupon,                                   // 0.0275 bei deinem Beispiel
//     maturity: normalizeDate(maturityRaw),
//     issueDate: normalizeDate(issueRaw),
//     frequency
//   };
// }
async function parseFinalTerms(pdfRef) {
  // --- Buffer laden (URL oder lokaler Pfad)
  let buf;
  if (/^https?:\/\//i.test(pdfRef)) {
    buf = (await axios.get(pdfRef, { responseType: 'arraybuffer', timeout: 15000 })).data;
  } else {
    const abs = path.isAbsolute(pdfRef) ? pdfRef : path.resolve(pdfRef);
    if (!fs.existsSync(abs)) throw new Error(`PDF not found at ${abs}`);
    buf = fs.readFileSync(abs);
  }

  // --- Helper: pdf.js-Noise NUR rund um pdf-parse stummschalten
  function mutePdfWarningsOnce() {
    const pats = [
      /^Warning:\s*TT:\s*undefined function:/i,
      /Ignoring invalid character .* in hex string/i,
      /Could not find a preferred cmap table/i,
      /Indexing all PDF objects/i,
    ];
    const ow = console.warn, oe = console.error;
    const mute = (orig) => (...args) => {
      const s = args[0] ? String(args[0]) : '';
      if (s && pats.some(rx => rx.test(s))) return;
      return orig(...args);
    };
    console.warn = mute(ow);
    console.error = mute(oe);
    return () => { console.warn = ow; console.error = oe; };
  }

  // --- pdf-parse mit lokalem Mute
  let rawText = '';
  const restore = mutePdfWarningsOnce();
  try {
    const res = await pdfParse(buf);
    rawText = res?.text || '';
  } finally {
    restore();
  }

  // --- Normalize: Soft-Hyphen/Zeilenumbrüche/Mehrfachspaces glätten
  const T = rawText
    .replace(/\u00AD/g, '')      // Soft hyphen raus
    .replace(/\r?\n+/g, ' ')     // Zeilenumbrüche -> Space
    .replace(/\s{2,}/g, ' ')     // doppelte Spaces
    .trim();

  const pick = (re) => (T.match(re)?.[1] || '').trim();
  const toPct = (s) => {
    const v = parseFloat(String(s).replace(',', '.'));
    return Number.isFinite(v) ? v / 100 : null;
  };

  // --- 1) Coupon präzise parsen
  // a) „Fixed Rate(s) of Interest: 2.75 per cent.“
  let coupon = null;
  const mFixed = T.match(
    /fixed\s*rate(?:\(\s*s\s*\))?\s*of\s*interest[^0-9]{0,40}([0-9]+(?:[.,][0-9]+)?)\s*(?:%|per\s*cent\.?|percent)\b/i
  );
  if (mFixed) {
    coupon = toPct(mFixed[1]); // -> 0.0275 bei „2.75 per cent.“
  } else {
    // b) generische Varianten: Coupon/Interest Rate/Rate of Interest
    const mGeneric = T.match(
      /(?:coupon(?:\s*rate)?|interest(?:\s*rate)?|rate\s*of\s*interest)\s*[:\-]?\s*([0-9]+(?:[.,][0-9]+)?)\s*(?:%|per\s*cent\.?|percent)\b/i
    );
    if (mGeneric) coupon = toPct(mGeneric[1]);
  }

  // --- 2) Zero-Coupon nur dann, wenn nichts gefunden wurde
  if (coupon === null) {
    const mentionsZero =
      /\bzero\s*coupon\b/i.test(T) ||
      /(?:fixed\s*rate(?:\(\s*s\s*\))?\s*of\s*interest|coupon|interest(?:\s*rate)?)\s*[:\-]?\s*0(?:[.,]0+)?\s*(?:%|per\s*cent\.?|percent)\b/i
        .test(T);
    if (mentionsZero) coupon = 0;
  }

  // --- 3) Termine
  const maturityRaw = pick(/(?:maturity\s+date|redemption(?:[^a-zA-Z]|.*?date))\s*[:\-]?\s*([0-9]{1,2}\s+\w+\s+\d{4}|[0-9]{4}-\d{2}-\d{2})/i);
  const issueRaw    = pick(/(?:issue\s+date|interest\s+commencement\s+date)\s*[:\-]?\s*([0-9]{1,2}\s+\w+\s+\d{4}|[0-9]{4}-\d{2}-\d{2})/i);

  // --- 4) Frequenz
  function extractFrequency(text) {
    if (/semi[-\s]?annually|semi[-\s]?annual|half[-\s]?year/i.test(text)) return 'S/A';
    if (/quarterly/i.test(text)) return 'Q';
    if (/monthly/i.test(text)) return 'M';
    if (/per\s+annum|annually|annual/i.test(text)) return 'A';
    return 'A'; // Default
  }
  const frequency = (coupon === 0) ? 'Z' : extractFrequency(T);

  return {
    coupon,                                   // z. B. 0.0275
    maturity: normalizeDate(maturityRaw),
    issueDate: normalizeDate(issueRaw),
    frequency                                  // 'A', 'S/A', 'Q', 'M' oder 'Z'
  };
}






function normalizeDate(s) {
  if (!s) return null;
  const iso = dayjs(s, ['D MMMM YYYY','D MMM YYYY','YYYY-MM-DD'], true);
  return iso.isValid() ? iso.format('YYYY-MM-DD') : null;
}
function mapFreq(freq){ if(freq.startsWith('semi'))return 'S/A'; if(freq.startsWith('quarter'))return 'Q'; if(freq.startsWith('month'))return 'M'; return 'A'; }

function buildSchedule({ issueDate, maturity, frequency, coupon }) {
  if (frequency === 'Z' || (coupon === 0 && frequency === 'A')) {
    return maturity ? [maturity] : [];
  }
  const stepM = { 'A':12,'S/A':6,'Q':3,'M':1 }[frequency || 'A'];
  if (!issueDate || !maturity || !stepM) return [];
  const dates = [];
  let d = dayjs(issueDate); const end = dayjs(maturity);
  while (d.add(stepM,'month').isBefore(end) || d.add(stepM,'month').isSame(end,'day')) {
    d = d.add(stepM,'month'); dates.push(d.format('YYYY-MM-DD'));
  }
  if (dates[dates.length-1] !== end.format('YYYY-MM-DD')) dates.push(end.format('YYYY-MM-DD'));
  return dates;
}



function toProdCouponRows(isin, coupon, schedule) {
  const FIX_CF = coupon ?? 0;
  return schedule.map(date => ({ PROD_ID: isin, DATE: date, FIX_CF, CALL: 0, ZERO: 0 }));
}

// === NEU: Crawler-Resolver (kein Key, HTML-Seiten scannen) ===
function createCrawlerResolver(domains = [], {
  seeds = [
  '/investor','/investors','/debt-investors','/funding',
  '/documents','/debt-programme','/debt-program','/prospectus',
  '/en/investors','/en/documents'
]
,
  maxDepth = 2,              // Link-Tiefe
  maxPagesPerDomain = 40,    // HTML-Seiten-Limit
  maxPdfChecksPerDomain = 25,// PDF-Downloads begrenzen
  timeoutMs = 10000,
  userAgent = 'Mozilla/5.0 (compatible; vXpBot/1.0; +https://example.com/bot)'
} = {}) {
  const absUrl = (base, href) => {
    try {
      if (!href) return null;
      if (/^https?:\/\//i.test(href)) return href;
      // handle //host paths
      if (/^\/\//.test(href)) return 'https:' + href;
      // relative
      return new URL(href, base).toString();
    } catch { return null; }
  };

  const sameHost = (u, host) => {
    try { return new URL(u).hostname.replace(/^www\./,'') === host.replace(/^www\./,''); } catch { return false; }
  };

  const extractLinks = (html) => {
    const out = [];
    const re = /href\s*=\s*["']([^"']+)["']/gi;
    let m;
    while ((m = re.exec(html))) out.push(m[1]);
    return out;
  };

  async function fetchText(url) {
    try {
      const { data } = await axios.get(url, {
        timeout: timeoutMs,
        headers: { 'User-Agent': userAgent, 'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' }
      });
      return String(data);
    } catch { return null; }
  }

  async function checkPdfHasIsin(url, isin) {
    try {
      const res = await axios.get(url, { responseType: 'arraybuffer', timeout: timeoutMs, headers: { 'User-Agent': userAgent }});
      const txt = (await pdfParse(res.data)).text;
      return txt && txt.toUpperCase().includes(isin.toUpperCase());
    } catch { return false; }
  }

  async function searchOn(host, isin) {
    const origin = `https://${host}`;
    const queue = [];
    const seen = new Set();
    const htmlPages = [];
    const pdfCandidates = new Set();

    // Seeds
    queue.push({ url: origin, depth: 0 });
    for (const s of seeds) queue.push({ url: absUrl(origin+'/', s), depth: 0 });

    // BFS über HTML-Seiten
    while (queue.length && htmlPages.length < maxPagesPerDomain) {
      const { url, depth } = queue.shift();
      if (!url || seen.has(url)) continue;
      seen.add(url);

      if (!sameHost(url, host)) continue;
      if (/\.(pdf|docx?|xlsx?|zip)(\?|$)/i.test(url)) { // direkter File-Link → als PDF-Kandidat werten
        if (/\.pdf(\?|$)/i.test(url)) pdfCandidates.add(url);
        continue;
      }
      if (depth > maxDepth) continue;

      const html = await fetchText(url);
      if (!html) continue;
      htmlPages.push(url);

      const links = extractLinks(html);
      for (const href of links) {
        const abs = absUrl(url, href);
        if (!abs) continue;
        if (/\.pdf(\?|$)/i.test(abs)) {
          pdfCandidates.add(abs);
        } else if (sameHost(abs, host)) {
          // nur „interessante“ Unterseiten in die Queue
          if (/(investor|investors|funding|debt|document|documents|prospectus|final-?terms)/i.test(abs)) {
            queue.push({ url: abs, depth: depth + 1 });
          }
        }
      }
      if (pdfCandidates.size >= maxPdfChecksPerDomain) break;
    }

    // PDFs prüfen
    let checked = 0;
    for (const pdfUrl of pdfCandidates) {
      if (checked++ >= maxPdfChecksPerDomain) break;
      const ok = await checkPdfHasIsin(pdfUrl, isin);
      if (ok) return pdfUrl;
    }
    return null;
  }

  return async function resolvePdf(isin) {
    for (const host of domains) {
      const hit = await searchOn(host, isin);
      if (hit) return hit;
    }
    return null;
  };
}


module.exports = {
  createDataCollector,
  createSitemapResolver,
  createContentMatchingResolver,
  createCrawlerResolver,     // ← NEU
};


