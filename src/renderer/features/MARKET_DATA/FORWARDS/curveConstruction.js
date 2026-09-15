// curveConstruction.js
// -----------------------------------------------------------------------------
// Fachlich korrekte Diskont-/Zero-/Forward-Kurven-Konstruktion fuer die ANZEIGE
// des Forwards-Panels. Reine Mathematik, KEIN DOM, KEINE Produktbewertung.
//
// Konventionen (Anzeige-Annahme, da im System nicht als Kurven-Metadaten
// gespeichert): EUR Fixed Leg annual, 30/360 -> TAU = 1; Single-Curve
// (self-discounting). Zeros stetig verzinst: DF(t) = exp(-z*t).
//
// Kette: Par-Swap-Quotes -> EINMALIGER Bootstrap (dichte Tenors) + gekoppelter
// Gap-Root-Find (dünne Long-End-Tenors) mit eingebettetem Interpolator
// (Hagan-West Monotone Convex, Default; PCHIP als Option) -> DF/Zero-Gitter ->
// Forward-Kennzahlen. Reproduziert die Marktquotes exakt (Repricing ~0 bp).
// -----------------------------------------------------------------------------

const TAU = 1.0;

const sumDF = (DF, a, b) => { let s = 0; for (let i = a; i <= b; i++) s += DF[i]; return s; };

// Annual Par-Swap-Rate aus DF-Gitter (DF[0]=1).
export function parRateFromDF(DF, n) {
  return (DF[0] - DF[n]) / (TAU * sumDF(DF, 1, n));
}

// Forward-Start Par-Swap-Rate (Swap startet in Jahr a, endet in Jahr b).
export function parForwardSwapRate(DF, a, b) {
  return (DF[a] - DF[b]) / (TAU * sumDF(DF, a + 1, b));
}

// 1-Jahres-Forward-(Zero)-Rate ab Jahr t.
export function fwd1yRate(DF, t) {
  return DF[t] / DF[t + 1] - 1;
}

// ---------- PCHIP (Fritsch–Carlson, monoton) ----------
function pchip(xs, ys) {
  const n = xs.length, h = [], d = [];
  for (let i = 0; i < n - 1; i++) { h.push(xs[i + 1] - xs[i]); d.push((ys[i + 1] - ys[i]) / h[i]); }
  const m = new Array(n);
  m[0] = d[0]; m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) {
    if (d[i - 1] * d[i] <= 0) m[i] = 0;
    else { const w1 = 2 * h[i] + h[i - 1], w2 = h[i] + 2 * h[i - 1]; m[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i]); }
  }
  return (x) => {
    if (x <= xs[0]) return ys[0] + m[0] * (x - xs[0]);
    if (x >= xs[n - 1]) return ys[n - 1] + m[n - 1] * (x - xs[n - 1]);
    let i = 0; while (i < n - 1 && x > xs[i + 1]) i++;
    const t = (x - xs[i]) / h[i];
    const h00 = 2 * t ** 3 - 3 * t ** 2 + 1, h10 = t ** 3 - 2 * t ** 2 + t, h01 = -2 * t ** 3 + 3 * t ** 2, h11 = t ** 3 - t ** 2;
    return h00 * ys[i] + h10 * h[i] * m[i] + h01 * ys[i + 1] + h11 * h[i] * m[i + 1];
  };
}

// ---------- Hagan–West Monotone Convex (OHNE Positivitaets-Collar) ----------
// Negative Forwards sind wirtschaftlich zulaessig und werden NICHT weggedrueckt.
function Gint(g0, g1, x) { // ∫_0^x g(s) ds
  if (Math.abs(g0) < 1e-15 && Math.abs(g1) < 1e-15) return 0;
  if ((g0 > 0 && g1 >= -2 * g0 && g1 <= -0.5 * g0) || (g0 < 0 && g1 <= -2 * g0 && g1 >= -0.5 * g0))
    return g0 * (x - 2 * x * x + x ** 3) + g1 * (-x * x + x ** 3);
  if ((g0 < 0 && g1 > -2 * g0) || (g0 > 0 && g1 < -2 * g0)) {
    const eta = (g1 + 2 * g0) / (g1 - g0);
    if (x <= eta) return g0 * x;
    return g0 * x + (g1 - g0) / (3 * (1 - eta) ** 2) * (x - eta) ** 3;
  }
  if ((g0 > 0 && g1 < 0 && g1 > -0.5 * g0) || (g0 < 0 && g1 > 0 && g1 < -0.5 * g0)) {
    const eta = 3 * g1 / (g1 - g0);
    if (x <= eta) return g1 * x + (g0 - g1) / (eta * eta) * ((eta ** 3 - (eta - x) ** 3) / 3);
    const Ge = g1 * eta + (g0 - g1) / (eta * eta) * (eta ** 3 / 3);
    return Ge + g1 * (x - eta);
  }
  if (Math.abs(g0 + g1) < 1e-15) return g0 * x + (g1 - g0) * x * x / 2;
  const eta = g1 / (g1 + g0), A = -g0 * g1 / (g0 + g1);
  if (x <= eta) return A * x + (g0 - A) / (eta * eta) * ((eta ** 3 - (eta - x) ** 3) / 3);
  const Ge = A * eta + (g0 - A) / (eta * eta) * (eta ** 3 / 3);
  return Ge + A * (x - eta) + (g1 - A) / (3 * (1 - eta) ** 2) * (x - eta) ** 3;
}
function haganWest(nodeT, nodeDF) {
  const n = nodeT.length, tau = [0, ...nodeT], R = [0];
  for (let i = 1; i <= n; i++) R.push(-Math.log(nodeDF[i - 1]));
  const fd = [null];
  for (let i = 1; i <= n; i++) fd.push((R[i] - R[i - 1]) / (tau[i] - tau[i - 1]));
  const f = new Array(n + 1);
  for (let i = 1; i <= n - 1; i++)
    f[i] = (tau[i] - tau[i - 1]) / (tau[i + 1] - tau[i - 1]) * fd[i + 1] + (tau[i + 1] - tau[i]) / (tau[i + 1] - tau[i - 1]) * fd[i];
  f[0] = fd[1] - 0.5 * (f[1] - fd[1]);
  f[n] = fd[n] - 0.5 * (f[n - 1] - fd[n]);
  return (t) => {
    if (t <= 0) return 1;
    let i = 1; while (i < n && t > tau[i]) i++;
    const dt = tau[i] - tau[i - 1], x = (t - tau[i - 1]) / dt;
    const g0 = f[i - 1] - fd[i], g1 = f[i] - fd[i];
    const Rt = R[i - 1] + fd[i] * (t - tau[i - 1]) + dt * Gint(g0, g1, x);
    return Math.exp(-Rt);
  };
}

// ---------- Gitter (DF/Zero, Jahr 1..maxYear) aus Knoten-Zeros ----------
function gridFromNodes(nodeT, nodeZ, method, maxYear) {
  const DF = [1], Z = [null];
  if (method === 'pchip') {
    const zf = pchip(nodeT, nodeZ);
    for (let y = 1; y <= maxYear; y++) { const z = zf(y); Z.push(z); DF.push(Math.exp(-z * y)); }
  } else {
    const nodeDF = nodeT.map((t, i) => Math.exp(-nodeZ[i] * t));
    const dff = haganWest(nodeT, nodeDF);
    for (let y = 1; y <= maxYear; y++) { const df = dff(y); DF.push(df); Z.push(-Math.log(df) / y); }
  }
  return { DF, Z };
}

/**
 * Diskontkurve aus Par-Swap-Quotes konstruieren.
 * @param {number[]} marketTenors ganzzahlige Jahres-Tenors (aufsteigend)
 * @param {number[]} parRates     Par-Swap-Rates in DEZIMAL (0.03329 = 3,329 %)
 * @param {{method?: 'haganwest'|'pchip', maxYear?: number}} opts
 * @returns {{years:number[], DF:number[], Z:number[], nodeT:number[], nodeZ:number[], reprice:{t:number,errBp:number}[]}}
 */
export function buildDiscountCurve(marketTenors, parRates, opts = {}) {
  const method = opts.method === 'pchip' ? 'pchip' : 'haganwest';
  const maxYear = opts.maxYear || 30;

  const parByT = new Map(marketTenors.map((t, i) => [t, parRates[i]]));

  // Dichter Bootstrap (konsekutiv ab 1): geschlossene Form, konventionskonsistent (TAU=1).
  const dDF = [1], dZ = [null]; let denseLast = 0;
  for (let t = 1; parByT.has(t); t++) {
    const S = parByT.get(t); let s = 0; for (let i = 1; i < t; i++) s += dDF[i];
    const df = (1 - S * TAU * s) / (1 + S * TAU);
    dDF.push(df); dZ.push(-Math.log(df) / t); denseLast = t;
  }

  const nodeT = [...marketTenors];
  const nodeZ = nodeT.map((t) => (t <= denseLast ? dZ[t] : parByT.get(t))); // Gap-Knoten init mit Par
  const gapIdx = []; nodeT.forEach((t, i) => { if (t > denseLast) gapIdx.push(i); });

  const parFromGrid = (DF, n) => (1 - DF[n]) / (TAU * sumDF(DF, 1, n));

  // Gekoppelter Gap-Bootstrap: je Long-End-Knoten den Zero per Bisektion so loesen,
  // dass der Markt-Swap repriced; Zwischenjahre kommen aus dem Interpolator.
  // Global geprueft (Gauss-Seidel-Kopplung) bis Repricing ~ Maschinenpraezision.
  for (let sweep = 0; sweep < 80; sweep++) {
    for (const gi of gapIdx) {
      const tn = nodeT[gi], Smk = parByT.get(tn);
      const resid = (z) => { const zz = nodeZ.slice(); zz[gi] = z; const { DF } = gridFromNodes(nodeT, zz, method, maxYear); return Smk - parFromGrid(DF, tn); };
      let lo = -0.05, hi = 0.15, flo = resid(lo), fhi = resid(hi), guard = 0;
      while (flo * fhi > 0 && guard < 50) { lo -= 0.02; hi += 0.02; flo = resid(lo); fhi = resid(hi); guard++; }
      let z = nodeZ[gi];
      if (flo * fhi <= 0) for (let it = 0; it < 100; it++) { z = 0.5 * (lo + hi); const fm = resid(z); if (fm === 0) break; if (flo * fm < 0) { hi = z; fhi = fm; } else { lo = z; flo = fm; } }
      nodeZ[gi] = z;
    }
    const { DF: dfc } = gridFromNodes(nodeT, nodeZ, method, maxYear);
    let tmax = 0; for (const gi of gapIdx) tmax = Math.max(tmax, Math.abs(parByT.get(nodeT[gi]) - parFromGrid(dfc, nodeT[gi])));
    if (tmax < 1e-13) break;
  }

  const { DF, Z } = gridFromNodes(nodeT, nodeZ, method, maxYear);
  const reprice = marketTenors.map((t, i) => ({ t, errBp: (parFromGrid(DF, t) - parRates[i]) * 1e4 }));
  return { years: Array.from({ length: maxYear }, (_, i) => i + 1), DF, Z, nodeT, nodeZ, reprice };
}
