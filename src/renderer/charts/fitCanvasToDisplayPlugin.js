'use strict';

// Globales Chart.js-Plugin gegen den systemweiten Hover-/Klick-Offset.
//
// Problem: Bei `responsive:false`-Charts setzt der Code einen festen Zeichenpuffer
// (canvas.width/height), waehrend CSS die Anzeige erzwingt (z. B.
// `.chart-box canvas { width:100% !important; height:360px !important }`). Chart.js nimmt
// fuer non-responsive die Canvas-ATTRIBUTE als Logikgroesse; weicht diese von der echten
// Darstellung ab, liegen Maus- und Zeichenkoordinaten auseinander -> Tooltip/Drill trifft
// neben dem sichtbaren Punkt.
//
// Fix: vor der Initialisierung die Canvas-Attribute auf die TATSAECHLICHE Anzeigegroesse
// (getBoundingClientRect, in CSS-Pixeln) setzen. Den DevicePixelRatio wendet Chart.js selbst
// via retinaScale an -> also NICHT mit dpr multiplizieren (sonst Doppel-Skalierung).
//
// Zusatzfall "hidden render": Wird ein Chart erzeugt, waehrend sein Panel noch verborgen ist
// (display:none -> rect=0), kann beim Init nicht eingepasst werden. Ein ResizeObserver passt
// darum spaeter neu ein, sobald das Canvas eine gueltige/geaenderte Groesse bekommt (Panel
// wird geoeffnet).
//
// Default-on: wirkt auf ALLE `responsive:false`-Charts. Opt-out pro Chart via
// `options.fitDisplay === false` (z.B. wenn ein Chart bewusst eine feste Bitmap-Groesse
// unabhaengig von der Anzeige braucht). Versteckte Charts (rect=0) werden uebersprungen
// und spaeter per ResizeObserver eingepasst, sobald sie sichtbar werden.

function _fitEnabled(chart) {
  const opts = chart?.options || {};
  return opts.fitDisplay !== false && opts.responsive === false;
}

// Canvas-Attribute auf die aktuelle Anzeigegroesse setzen (nur wenn im Layout sichtbar).
function _applyFit(chart) {
  try {
    if (!_fitEnabled(chart)) return;
    const canvas = chart.canvas;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width > 1 && rect.height > 1) {
      canvas.width = Math.round(rect.width);
      canvas.height = Math.round(rect.height);
    }
  } catch {}
}

export const fitCanvasToDisplayPlugin = {
  id: 'fitCanvasToDisplay',

  beforeInit(chart) {
    _applyFit(chart);
  },

  afterInit(chart) {
    try {
      if (!_fitEnabled(chart)) return;
      if (typeof ResizeObserver === 'undefined') return;
      const canvas = chart.canvas;
      if (!canvas) return;
      // Neu einpassen, sobald das Canvas (z. B. beim Oeffnen eines zuvor verborgenen
      // Panels) eine gueltige oder veraenderte Groesse bekommt. chart.resize() ohne
      // Argumente nimmt die tatsaechliche Anzeigegroesse -> Koordinaten stimmen wieder.
      const ro = new ResizeObserver(() => {
        try {
          const rect = canvas.getBoundingClientRect();
          if (rect.width > 1 && rect.height > 1 &&
              (Math.abs(rect.width - chart.width) > 1 || Math.abs(rect.height - chart.height) > 1)) {
            chart.resize();
          }
        } catch {}
      });
      ro.observe(canvas);
      chart.$fitRO = ro;
    } catch {}
  },

  afterDestroy(chart) {
    try { chart.$fitRO?.disconnect?.(); chart.$fitRO = null; } catch {}
  },
};

let _registered = false;
export function registerFitCanvasPlugin() {
  if (_registered) return;
  const C = (typeof window !== 'undefined' && window.Chart) ? window.Chart : null;
  if (!C || typeof C.register !== 'function') return;
  C.register(fitCanvasToDisplayPlugin);
  _registered = true;
}
