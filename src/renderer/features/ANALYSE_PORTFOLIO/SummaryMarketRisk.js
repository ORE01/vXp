import { getColorFromPalette, getPortfolioColor } from '../../utils/colors.js';
import { appState } from '../../renderer.js';
import { renderMvarProductPLPanel } from './marketRisk/mvar/mvarProductPLPanel.js';
import { ensureHistCrosshairPlugin } from './HISTORIC_RISK_METRICS/historicRiskMetrics.js';




export function handleSummaryMarketRiskData(port_name, scenario_name, asof_date = null) {
  //console.log('port_name:', port_name, 'scenario_name:', scenario_name, 'asof_date:', asof_date);

  const elementId = `portDataContainer${0}`;
  const portfolioData = appState.getPortAggData(elementId) || {};

  const num = (x) => Number(String(x ?? '').replace(/[^\d.-]/g, '').replace(',', ''));

  // --- Portfolio ratios ---
  let portValueRel = 1;
  let portfolioEndValue = 100;

  const portValue    = num(portfolioData.formPortValue);
  const portNotional = num(portfolioData.formPortNotional);
  const portPV01     = num(portfolioData.formPortPV01);
  const portCPV01    = num(portfolioData.formPortCPV01);

  if (Number.isFinite(portValue) && Number.isFinite(portNotional) && portNotional !== 0) {
    portValueRel = portValue / portNotional;
    portfolioEndValue = portValueRel * 100;
  }

  // --- Synthetic Bond vs. Portfolio line chart (tsEU1YChart) ---
  // Drawn HERE, independently of the distribution-data early-returns below: this chart
  // only needs the time series (tblTS) + portfolio PV01, NOT the MVaR distribution.
  // Previously it sat after the '[DIST] No distribution' return, so it stayed blank on
  // initial open (no dist rows yet) and only appeared after a recalc.
  console.log('[TS EU1Y CHART] reached synthetic-chart gate (early)', {
    portPV01,
    portPV01IsFinite: Number.isFinite(portPV01),
  });

  // Entkoppelt: ein Fehler im (rein renderer-seitigen) synthetischen Chart darf
  // die Python-VaR-Anzeige (Verteilung + VaR-/ES-Linien) nie blockieren.
  if (Number.isFinite(portPV01)) {
    try {
      drawSyntheticPortfolioChart(portfolioEndValue, portPV01, 5, Number.isFinite(portCPV01) ? portCPV01 : 0, port_name);
    } catch (e) {
      console.error('[SYNTH CHART] drawSyntheticPortfolioChart failed:', e);
    }
  }

  // --- NAV ---
  const OriPortData = appState.getAllPortfolioData() || [];
  const portNav = OriPortData
    .filter(item => item && item.port_name === port_name)
    .reduce((sum, item) => sum + num(item.NAV), 0);

  if (!Number.isFinite(portNav) || portNav === 0) {
    console.warn(`Invalid or zero NAV for port_name=${port_name}; cannot compute P/L%`, { portNav });
    return;
  }

  // --- VaR aggregate (header): pick latest if asof_date not provided ---
  const mvarAggData = appState.getAllMvarData() || [];
  const aggMatches = mvarAggData.filter(item =>
    item &&
    item.port_name === port_name &&
    (!scenario_name || item.scenario_name === scenario_name)
  );

  let chosenAgg = null;
  if (asof_date) {
    chosenAgg = aggMatches.find(x => String(x.asof_date) === String(asof_date)) || null;
  }
  // Fallback: kein exakter Stichtag (Aufrufer uebergeben teils veraltete/fixe
  // asof-Daten) -> juengste Aggregat-Zeile nehmen. Sonst sind VaR/ES = 0 und
  // weder die VaR-/ES-Linien noch der rote Tail werden gezeichnet.
  if (!chosenAgg && aggMatches.length) {
    const sorted = aggMatches
      .slice()
      .sort((a, b) => String(a.asof_date).localeCompare(String(b.asof_date)));
    chosenAgg = sorted[sorted.length - 1] || null;
  }

  // Stichtag der tatsaechlich gewaehlten Aggregat-Zeile (exakt ODER Fallback) —
  // so passen VaR/ES-Linien und Verteilung immer zusammen.
  const chosenAsof = chosenAgg?.asof_date || asof_date || null;
  const varTRel = Number(chosenAgg?.VaR_T_rel) || 0;
  const esTRel = Number(chosenAgg?.ES_T_rel ?? chosenAgg?.ES_rel ?? chosenAgg?.es_t_rel) || 0;

  // Horizont-Skalierung: die gespeicherte Verteilung ist die TAEGLICHE P/L-Serie,
  // VaR/ES sind aber mit sqrt(horizon_days) skaliert (Engine: pl * sqrt(h)).
  // Die Verteilung wird daher auf denselben Horizont gebracht — sonst liegen die
  // VaR/ES-Linien um Faktor sqrt(h) ausserhalb der Verteilungsmasse.
  const horizonDays = Math.max(1, Number(chosenAgg?.horizon_days) || 1);
  const horizonScale = Math.sqrt(horizonDays);

  // --- Distribution data: try exact (port, scenario, asof) first ---
let mvarDistData = appState.getMvarDistData({
  port_name,
  scenario_name,
  asof_date: chosenAsof,
}) || [];

// Fallback: if the EXACT aggregate asof has no distribution rows (common at initial
// open / test mode, where the aggregate asof and the stored distribution asof differ),
// fall back to the LATEST available distribution for this port+scenario instead of
// rendering nothing. The histogram only needs SOME distribution for the selection;
// the store getter returns the latest asof when asof_date is omitted.
if (!Array.isArray(mvarDistData) || mvarDistData.length === 0) {
  const anyAsofDist = appState.getMvarDistData({ port_name, scenario_name }) || [];

  console.warn('[DIST] no dist for exact asof; falling back to latest available', {
    port_name,
    scenario_name,
    chosenAsof,
    exactCount: 0,
    fallbackCount: anyAsofDist.length,
  });

  mvarDistData = anyAsofDist;
}

if (!Array.isArray(mvarDistData) || mvarDistData.length === 0) {
  console.warn(
    '[DIST] No distribution for selection (any asof) - nothing rendered',
    { port_name, scenario_name }
  );
  return;
}


  // console.log('mvarDistData sample keys:', mvarDistData[0] ? Object.keys(mvarDistData[0]) : null);
  // console.log('mvarDistData sample row:', mvarDistData[0] || null);

  // --- Robust P/L field handling (supports new + old schemas) ---
  const plValues = mvarDistData
    .map(row => {
      const raw =
        row?.pl_total ??
        row?.PL_TOTAL ??
        row?.["P/L"] ??
        row?.pl ??
        row?.PL ??
        null;
      return Number(raw);
    })
    .filter(v => Number.isFinite(v))
    .map(v => (v / portNav) * 100 * horizonScale);

  if (plValues.length === 0) {
    console.warn("No numeric P/L values found in distribution data. Check column name mapping.", {
      sample_keys: mvarDistData?.[0] ? Object.keys(mvarDistData[0]) : null,
      sample_row: mvarDistData?.[0] || null,
    });
    return;
  }

  // --- ROLLING_1-Verteilung als Overlay (wird seit dem MVaR-Nachlauf immer
  // mitgerechnet). Nur wenn das gewaehlte Szenario nicht selbst ROLLING_1 ist. ---
  let overlay = null;
  if (String(scenario_name ?? '').trim().toUpperCase() !== 'ROLLING_1') {
    // Rolling-Aggregat zuerst (VaR/ES + Horizont fuer die sqrt(h)-Skalierung).
    const rollAgg = mvarAggData
      .filter(item => item && item.port_name === port_name && item.scenario_name === 'ROLLING_1')
      .sort((a, b) => String(a.asof_date).localeCompare(String(b.asof_date)))
      .at(-1) || null;
    const rollScale = Math.sqrt(Math.max(1, Number(rollAgg?.horizon_days) || horizonDays));

    const rollDist = appState.getMvarDistData({ port_name, scenario_name: 'ROLLING_1' }) || [];
    const rollVals = rollDist
      .map(row => Number(row?.pl_total ?? row?.PL_TOTAL ?? row?.["P/L"] ?? row?.pl ?? row?.PL ?? null))
      .filter(v => Number.isFinite(v))
      .map(v => (v / portNav) * 100 * rollScale);
    if (rollVals.length) {
      overlay = { values: rollVals, label: 'ROLLING_1' };
      if (rollAgg) {
        overlay.varTRel = Number(rollAgg.VaR_T_rel) || 0;
        overlay.esTRel = Number(rollAgg.ES_T_rel ?? rollAgg.ES_rel) || 0;
      }
    }
  }

  // --- Render chart ---
  const canvas = document.getElementById('plMvarDistChart');
  if (!canvas) return console.warn("Canvas #plMvarDistChart not found in DOM");

  const ctx = canvas.getContext('2d');
  if (window.plMvarDistChartInstance) window.plMvarDistChartInstance.destroy();

  const { data, options, veLines } = drawMvarHistogram(plValues, portValueRel, varTRel, esTRel, {
    overlay,
    mainLabel: scenario_name || 'Selected scenario',
    horizonDays,
  });
  const chart = new Chart(ctx, { type: 'bar', data, options, plugins: [_mvarVELinePlugin] });
  chart.$veLines = veLines;

  // Standard-Auswahl: nur gewaehltes Szenario + VaR-Linie sichtbar. ES-Linien
  // und ROLLING_1 starten abgewaehlt (durchgestrichen) und lassen sich per
  // Legenden-Klick zuschalten.
  chart.$hiddenGroups = new Set(['overlay']);
  chart.$hiddenMetrics = new Set(['es']);
  chart.data.datasets.forEach((d, i) => {
    if (d.group === 'overlay' || d.metricToggle === 'es') chart.setDatasetVisibility(i, false);
  });

  try { chart.update(); } catch {}
  window.plMvarDistChartInstance = chart;
  ensureDistZoomTools(canvas);

  // NOTE: the synthetic line chart (tsEU1YChart) is now drawn earlier in this function
  // (before the distribution-data early-returns), so it is not redrawn here.
}

// HISTOGRAMM:

// Vertikale VaR/ES-Linien am jeweiligen P/L-Bin (chart.$veLines = [{at,label,color,dash}]).
const _mvarVELinePlugin = {
  id: 'mvarVELines',
  afterDatasetsDraw(chart) {
    const lines = chart.$veLines;
    if (!Array.isArray(lines) || !chart.chartArea || !chart.scales?.x) return;
    const { ctx, chartArea } = chart;
    lines.forEach((ln) => {
      if (!Number.isFinite(ln.at)) return;
      // Ausgeblendete Szenario-Gruppe bzw. ausgeblendete Metrik (VaR/ES-Toggle)
      // -> Linie nicht zeichnen.
      if (ln.group && chart.$hiddenGroups?.has(ln.group)) return;
      if (ln.metric && chart.$hiddenMetrics?.has(ln.metric)) return;
      const x = chart.scales.x.getPixelForValue(ln.at);
      if (!Number.isFinite(x)) return;
      ctx.save();
      ctx.beginPath();
      ctx.setLineDash(ln.dash || []);
      ctx.lineWidth = 2;
      ctx.strokeStyle = ln.color || 'rgba(255,0,0,0.95)';
      ctx.moveTo(x, chartArea.top);
      ctx.lineTo(x, chartArea.bottom);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = ln.color || 'rgba(255,0,0,0.95)';
      ctx.font = 'bold 11px sans-serif';
      // Label LINKS vom Strich, direkt darunter der Wert; reicht der Platz am
      // linken Chartrand nicht, wird nach rechts ausgewichen. dy staffelt die
      // Eintraege vertikal, damit sich nichts ueberlappt.
      const label = ln.label || '';
      const valueStr = Number.isFinite(ln.value) ? `${Number(ln.value.toFixed(2))}%` : '';
      const w = Math.max(ctx.measureText(label).width, valueStr ? ctx.measureText(valueStr).width : 0);
      const fitsLeft = (x - 4 - w) >= chartArea.left;
      ctx.textAlign = fitsLeft ? 'right' : 'left';
      const tx = fitsLeft ? x - 4 : x + 4;
      const ty = chartArea.top + (ln.dy || 11);
      ctx.fillText(label, tx, ty);
      if (valueStr) {
        ctx.font = '10px sans-serif';
        ctx.fillText(valueStr, tx, ty + 12);
      }
      ctx.restore();
    });
  },
};

function createHistogramDataAdjusted(values, portValueRel = 1, numBins = 50, includeValues = []) {
  // 1. In absolute Performance umrechnen
  const adjusted = values;   // P/L% direkt (KEIN Bond-Preis) -> P&L-konforme x-Achse // z. B. -2% â†’ 0.97

  // 2. Basiswerte
  const avg = adjusted.reduce((sum, v) => sum + v, 0) / adjusted.length;
  const spread = Math.max(...adjusted) - Math.min(...adjusted);
  const padding = spread * 0.35; // breitere x-Achse (mehr Kontext um die Verteilung)

  // 3. Symmetrischer Bereich um avg
  let min = avg - spread / 2 - padding;
  let max = avg + spread / 2 + padding;

  // VaR/ES-Marken (includeValues) IMMER in den sichtbaren Bereich aufnehmen —
  // sonst liegen die Linien ausserhalb der Bins und werden nicht gezeichnet.
  (includeValues || []).forEach((v) => {
    if (!Number.isFinite(v)) return;
    if (v < min) min = v - spread * 0.05;
    if (v > max) max = v + spread * 0.05;
  });

  const binWidth = (max - min) / numBins;

  const bins = Array(numBins).fill(0);

  // 4. ZÃ¤hlen
  adjusted.forEach(v => {
    const binIndex = Math.min(Math.floor((v - min) / binWidth), numBins - 1);
    bins[binIndex]++;
  });

  // 5. Labels generieren als Prozent (% vom NAV)
  const labels = bins.map((_, i) => {
    const start = (min + i * binWidth).toFixed(2);
    const end = (min + (i + 1) * binWidth).toFixed(2);
    return `${start}% - ${end}%`;
  });

  // 6. Normalverteilungs-Parameter (in adjusted-Einheiten) + Bin-Zentren fuer die Kurve.
  const mu = avg;
  const variance = adjusted.reduce((s, v) => s + (v - avg) * (v - avg), 0) / Math.max(1, adjusted.length);
  const sigma = Math.sqrt(variance);
  const centers = bins.map((_, i) => min + (i + 0.5) * binWidth);

  return { labels, bins, min, binWidth, mu, sigma, centers, total: adjusted.length };
}

function drawMvarHistogram(plValues, portValueRel, varTRel, esTRel = 0, { overlay = null, mainLabel = 'Frequency', horizonDays = 1 } = {}) {
  // VaR/ES BEIDER Szenarien in den Bin-Bereich aufnehmen, damit alle Linien
  // immer sichtbar sind.
  const marks = [varTRel, esTRel, overlay?.varTRel, overlay?.esTRel]
    .filter((v) => Number.isFinite(v) && v !== 0);
  const histogram = createHistogramDataAdjusted(plValues, portValueRel, 50, marks);

  // Overlay-Verteilung (z.B. ROLLING_1) in DIESELBEN Bins zaehlen, damit beide
  // Histogramme exakt uebereinander liegen. Werte ausserhalb landen im Randbin.
  let overlayBins = null;
  let overlayNormal = null;
  if (overlay && Array.isArray(overlay.values) && overlay.values.length && histogram.binWidth > 0) {
    overlayBins = Array(histogram.bins.length).fill(0);
    overlay.values.forEach((v) => {
      if (!Number.isFinite(v)) return;
      const idx = Math.max(0, Math.min(
        Math.floor((v - histogram.min) / histogram.binWidth),
        overlayBins.length - 1
      ));
      overlayBins[idx]++;
    });

    // Normalverteilung der Overlay-Serie (eigene mu/sigma, gleiche Frequenz-Skala).
    const oN = overlay.values.length;
    const oMu = overlay.values.reduce((s, v) => s + v, 0) / oN;
    const oVar = overlay.values.reduce((s, v) => s + (v - oMu) * (v - oMu), 0) / oN;
    const oSigma = Math.sqrt(oVar);
    overlayNormal = (oSigma > 0)
      ? histogram.centers.map(c => oN * histogram.binWidth * (1 / (oSigma * Math.sqrt(2 * Math.PI))) * Math.exp(-((c - oMu) ** 2) / (2 * oSigma * oSigma)))
      : null;
  }

  // VaR/ES sind bereits in % (P/L vom NAV), gleiche Einheit wie die Balken -> Bin-Index
  // direkt ueber die Bin-Kanten (robust auch bei negativen Werten).
  const binIndexOf = (value) => {
    if (!Number.isFinite(value) || !(histogram.binWidth > 0)) return -1;
    const idx = Math.floor((value - histogram.min) / histogram.binWidth);
    return (idx >= 0 && idx < histogram.bins.length) ? idx : -1;
  };

  // âœ… Robust: entfernt ALLE Prozentzeichen, normalisiert Dash-Varianten, parst sauber
  const findBinIndexForValue = (value, labels) =>
    labels.findIndex(label => {
      // Beispiel-Label: "95.12% - 96.34%"
      const cleaned = String(label)
        .replace(/%/g, '')          // <- ALLE % entfernen (dein Bug)
        .replace(/[-â€”]/g, '-')      // <- En-Dash/Em-Dash auf normales '-' normalisieren
        .replace(/\s+/g, ' ')       // <- Whitespace normalisieren
        .trim();

      const parts = cleaned.split('-').map(s => s.trim());
      if (parts.length < 2) return false;

      const start = Number.parseFloat(parts[0]);
      const end   = Number.parseFloat(parts[1]);

      if (!Number.isFinite(start) || !Number.isFinite(end)) return false;

      // Sicherheit: falls start/end vertauscht (sollte nicht passieren, aber robust)
      const lo = Math.min(start, end);
      const hi = Math.max(start, end);

      // Wichtig: include hi, weil dein Label "start - end" inkl. Endpunkt wirken soll
      return value >= lo && value <= hi;
    });

  const thresholdBinIndex = binIndexOf(varTRel);
  const esBinIndex = binIndexOf(esTRel);

  // Normalverteilung ueber das Histogramm (gleiche Frequenz-Skala): total * binWidth * pdf.
  const { mu, sigma, binWidth, centers, total } = histogram;
  const normal = (sigma > 0)
    ? centers.map(c => total * binWidth * (1 / (sigma * Math.sqrt(2 * Math.PI))) * Math.exp(-((c - mu) ** 2) / (2 * sigma * sigma)))
    : centers.map(() => 0);

  // VaR/ES-Linien (vertikal am jeweiligen P/L-Bin) — fuer BEIDE Szenarien,
  // beschriftet mit dem Szenario-Namen. Gewaehltes Szenario rot/orange,
  // ROLLING_1 in leicht dunklerem Rot/Orange (NICHT rosa wie die Balken,
  // sonst ist alles im Chart rosa); Labels je Linie in eigener Zeile.
  const veLines = [];
  const scenTag = String(mainLabel || '').trim();
  if (thresholdBinIndex !== -1 && Number.isFinite(varTRel) && varTRel !== 0) {
    veLines.push({ at: thresholdBinIndex, label: scenTag ? `VaR ${scenTag}` : 'VaR', value: varTRel, color: 'rgba(255,0,0,0.95)', dash: [], group: 'main', metric: 'var' });
  }
  if (esBinIndex !== -1 && Number.isFinite(esTRel) && esTRel !== 0) {
    veLines.push({ at: esBinIndex, label: scenTag ? `ES ${scenTag}` : 'ES', value: esTRel, color: 'rgba(255,150,0,0.98)', dash: [6, 4], group: 'main', metric: 'es' });
  }
  if (overlay) {
    const rollTag = String(overlay.label || 'ROLLING_1');
    const rollVarIdx = binIndexOf(overlay.varTRel);
    const rollEsIdx = binIndexOf(overlay.esTRel);
    if (rollVarIdx !== -1 && Number.isFinite(overlay.varTRel) && overlay.varTRel !== 0) {
      veLines.push({ at: rollVarIdx, label: `VaR ${rollTag}`, value: overlay.varTRel, color: 'rgba(185,25,45,0.95)', dash: [], group: 'overlay', metric: 'var' });
    }
    if (rollEsIdx !== -1 && Number.isFinite(overlay.esTRel) && overlay.esTRel !== 0) {
      veLines.push({ at: rollEsIdx, label: `ES ${rollTag}`, value: overlay.esTRel, color: 'rgba(205,105,0,0.98)', dash: [6, 4], group: 'overlay', metric: 'es' });
    }
  }
  // Jeder Eintrag (Label + Wert darunter) in eigener vertikaler Staffel.
  veLines.forEach((ln, i) => { ln.dy = 11 + i * 26; });

  const pCol = getPortfolioColor(1); // Garmin-Pink fÃ¼r Portfolio-Bin

  // Tail rot: ALLE Bins ab dem VaR-Bin abwaerts (schlechteres P/L = kleinerer Index),
  // inklusive VaR-Bin. Rest blau (Portfolio-Bin bleibt pink). Nur bei echtem VaR-Wert.
  const varRedUpTo = (Number.isFinite(varTRel) && varTRel !== 0 && thresholdBinIndex !== -1) ? thresholdBinIndex : -1;

  // Kein Pink-/Portfolio-Bin mehr (das war der Durchschnitt). Tail ab VaR rot, Rest blau.
  const backgroundColor = histogram.bins.map((_, i) =>
    (varRedUpTo !== -1 && i <= varRedUpTo) ? 'rgba(255, 0, 0, 0.55)' : 'rgba(54, 162, 235, 0.5)'
  );

  const borderColor = histogram.bins.map((_, i) =>
    (varRedUpTo !== -1 && i <= varRedUpTo) ? 'rgba(255, 0, 0, 0.9)' : 'rgba(54, 162, 235, 1)'
  );

  // Beide Balkenserien uebereinander (grouped:false -> volle Kategorie-Breite),
  // Overlay halbtransparent in Magenta darueber. 'group' verbindet Balken,
  // Normalkurve und VaR-/ES-Linien eines Szenarios -> Legenden-Klick toggelt alles.
  const datasets = [
    {
      label: String(mainLabel || 'Frequency'),
      data: histogram.bins,
      backgroundColor,
      borderColor,
      borderWidth: 1,
      grouped: false,
      order: 3,
      group: 'main',
    },
  ];
  if (overlayBins) {
    // Tail der ROLLING-Balken ab deren VaR-Bin DUNKELROT (Farbe der Rolling-VaR-Linie),
    // Rest gruen — analog zum roten Tail der Hauptserie.
    const overlayVarRedUpTo = (overlay && Number.isFinite(overlay.varTRel) && overlay.varTRel !== 0)
      ? binIndexOf(overlay.varTRel)
      : -1;
    datasets.push({
      label: String(overlay.label || 'ROLLING_1'),
      data: overlayBins,
      backgroundColor: overlayBins.map((_, i) =>
        (overlayVarRedUpTo !== -1 && i <= overlayVarRedUpTo) ? 'rgba(185, 25, 45, 0.5)' : 'rgba(46, 158, 91, 0.35)'
      ),
      borderColor: overlayBins.map((_, i) =>
        (overlayVarRedUpTo !== -1 && i <= overlayVarRedUpTo) ? 'rgba(185, 25, 45, 0.9)' : 'rgba(46, 158, 91, 0.85)'
      ),
      borderWidth: 1,
      grouped: false,
      order: 2,
      group: 'overlay',
    });
  }
  // Normalverteilung des gewaehlten Szenarios: BLAU gestrichelt (Balkenfarbe).
  // normalCurve: eigener Legenden-Eintrag, einzeln ein-/ausschaltbar.
  datasets.push({
    type: 'line',
    label: 'Normal',
    data: normal,
    borderColor: 'rgba(54, 162, 235, 1)',
    borderDash: [6, 4],
    borderWidth: 2,
    pointRadius: 0,
    fill: false,
    tension: 0.35,
    order: 1,
    group: 'main',
    normalCurve: true,
  });
  // Normalverteilung der Overlay-Serie (ROLLING_1): GRUEN, gestrichelt wie die Haupt-Normalkurve.
  if (overlayNormal) {
    datasets.push({
      type: 'line',
      label: `Normal ${String(overlay.label || 'ROLLING_1')}`,
      data: overlayNormal,
      borderColor: 'rgba(46, 158, 91, 0.95)',
      borderDash: [6, 4],
      borderWidth: 2,
      pointRadius: 0,
      fill: false,
      tension: 0.35,
      order: 0,
      group: 'overlay',
      normalCurve: true,
    });
  }

  // Legenden-Schalter fuer die VaR-/ES-Linien: leere Dummy-Datasets, deren
  // Legenden-Klick ALLE VaR- bzw. ES-Linien (beider Szenarien) togglet.
  if (veLines.some((l) => l.metric === 'var')) {
    datasets.push({ type: 'line', label: 'VaR', data: [], borderColor: 'rgba(255,0,0,0.95)', backgroundColor: 'rgba(255,0,0,0.95)', pointRadius: 0, metricToggle: 'var' });
  }
  if (veLines.some((l) => l.metric === 'es')) {
    datasets.push({ type: 'line', label: 'ES', data: [], borderColor: 'rgba(255,150,0,0.98)', backgroundColor: 'rgba(255,150,0,0.98)', pointRadius: 0, metricToggle: 'es' });
  }

  const col = _chartTextColor();
  return {
    data: {
      labels: histogram.labels,
      datasets,
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'x', // um 90 Grad gedreht -> vertikale Balken (P/L auf x, Frequency auf y)
      color: col,
      scales: {
        x: {
          title: { display: true, text: horizonDays > 1 ? `P/L as % of NAV (${horizonDays}d horizon)` : 'P/L as % of NAV', color: col },
          ticks: { color: col, maxRotation: 90, minRotation: 90, autoSkip: true, maxTicksLimit: 16 }
        },
        y: {
          beginAtZero: true,
          title: { display: true, text: 'Frequency', color: col },
          ticks: { color: col }
        }
      },
      plugins: {
        // Mit Overlay (zwei Verteilungen) Legende RECHTS zeigen (kleine Kaestchen),
        // sonst wie bisher aus. Die Normal-Kurven bleiben aus der Legende draussen.
        legend: {
          // Immer anzeigen: die Normal-Kurven sind nur ueber die Legende schaltbar.
          display: true,
          position: 'right',
          labels: {
            color: col,
            boxWidth: 12,
            boxHeight: 6,
            font: { size: 11 },
            // Legendenfarbe explizit je Gruppe: die Balkenfarbe ist ein ARRAY
            // (Tail rot) -> Chart.js wuerde sonst die erste Farbe (rot) zeigen.
            // Normal-Kurven behalten ihre Linienfarbe (eigene, schaltbare Eintraege).
            generateLabels: (chart) => {
              const items = Chart.defaults.plugins.legend.labels.generateLabels(chart);
              items.forEach((it) => {
                const ds = chart.data.datasets[it.datasetIndex];
                if (ds?.normalCurve) {
                  it.fillStyle = 'transparent';
                  it.strokeStyle = ds.borderColor;
                  return;
                }
                const g = ds?.group;
                if (g === 'main') {
                  it.fillStyle = 'rgba(54, 162, 235, 0.7)';
                  it.strokeStyle = 'rgba(54, 162, 235, 1)';
                } else if (g === 'overlay') {
                  it.fillStyle = 'rgba(46, 158, 91, 0.6)';
                  it.strokeStyle = 'rgba(46, 158, 91, 0.85)';
                }
              });
              return items;
            },
          },
          // Legenden-Klick: Szenario-Eintraege togglen die GANZE Gruppe (Balken +
          // Normalkurve + Linien via chart.$hiddenGroups); die "VaR"/"ES"-Eintraege
          // togglen NUR die jeweiligen Linien (chart.$hiddenMetrics).
          onClick: (e, item, legend) => {
            const chart = legend.chart;
            const ds = chart.data.datasets[item.datasetIndex];

            if (ds?.metricToggle) {
              const hiddenM = new Set(chart.$hiddenMetrics || []);
              const nowHidden = !hiddenM.has(ds.metricToggle);
              if (nowHidden) hiddenM.add(ds.metricToggle); else hiddenM.delete(ds.metricToggle);
              chart.$hiddenMetrics = hiddenM;
              chart.setDatasetVisibility(item.datasetIndex, !nowHidden); // Durchstreichen
              chart.update();
              return;
            }

            // Normal-Kurven einzeln togglen (NICHT die ganze Szenario-Gruppe).
            if (ds?.normalCurve) {
              chart.setDatasetVisibility(item.datasetIndex, !chart.isDatasetVisible(item.datasetIndex));
              chart.update();
              return;
            }

            const group = ds?.group;
            if (!group) return;
            const hidden = new Set(chart.$hiddenGroups || []);
            const nowHidden = !hidden.has(group);
            if (nowHidden) hidden.add(group); else hidden.delete(group);
            chart.$hiddenGroups = hidden;
            chart.data.datasets.forEach((d, i) => {
              if (d.group === group) chart.setDatasetVisibility(i, !nowHidden);
            });
            chart.update();
          },
        },
        tooltip: {
          callbacks: {
            label: context => `${context.dataset?.label ?? ''}: ${context.raw}`
          }
        },
        // Intervall-Zoom (chartjs-plugin-zoom, global geladen): Ziehen = x-Intervall
        // aufziehen, Wheel = Zoom, Ctrl+Ziehen = Pan. Reset ueber den Button.
        zoom: {
          pan: { enabled: true, mode: 'x', modifierKey: 'ctrl' },
          zoom: {
            drag: { enabled: true, backgroundColor: 'rgba(75,150,225,0.15)', borderColor: 'rgba(75,150,225,0.6)', borderWidth: 1 },
            wheel: { enabled: true },
            mode: 'x',
          },
        },
      }
    },
    veLines,
  };
}

// Theme-Textfarbe fuer Chart-Beschriftungen (wie crTailZoomChart im Credit-Dashboard).
function _chartTextColor() {
  return (getComputedStyle(document.body).getPropertyValue('--text-primary') || '').trim() || '#333';
}

// "Reset Zoom"-Button oben rechts im Chart (idempotent, pro .chart-box).
function ensureDistZoomTools(canvas, instanceKey = 'plMvarDistChartInstance') {
  const box = canvas?.parentElement;
  if (!box) return;
  if (getComputedStyle(box).position === 'static') box.style.position = 'relative';
  if (box.querySelector('.pl-dist-resetzoom')) return;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'pl-dist-resetzoom';
  btn.textContent = 'Reset Zoom';
  btn.title = 'Zoom zuruecksetzen';
  Object.assign(btn.style, {
    position: 'absolute', top: '6px', right: '8px', zIndex: 5,
    fontSize: '11px', padding: '2px 8px', cursor: 'pointer',
  });
  btn.addEventListener('click', () => {
    try { window[instanceKey]?.resetZoom?.(); } catch (_) {}
  });
  box.appendChild(btn);
}


// SYNTHETIC PORTFOLIO &  CMB CHART:

// ===== Factor-Mapping-Anbindung (MVaR FACTOR SERIES MAPPING) =====
// Die Zins-/Spread-Deltas des synthetischen Charts laufen ueber das Mapping des
// AKTIVEN Szenarios (MarketVaR_FactorSeriesMap: factor_id -> linked_ts_col x scale),
// damit ein dort eingestelltes Szenario auch hier wirkt. Fallback: rohe tblTS-Spalten.

// Letzte Aufruf-Parameter fuer Re-Renders durch Dropdown-/Mapping-Aenderungen.
let __synthChartArgs = null;
let __synthControlsBound = false;
// Zeitfenster in Jahren (0 = Max), umschaltbar wie im Scenario-Period-Chart.
let __synthRangeYears = 5;

// Gleiche Quelle wie das Factor-Mapping-Panel (persistActiveScenario).
function activeFactorMapScenario() {
  try { return localStorage.getItem('mvarFactorMapActiveScenario') || 'default'; }
  catch (_) { return 'default'; }
}

// factor_id -> { col, scale } fuer das aktive Szenario; nur aktive Zeilen, deren
// linked_ts_col als tblTS-Spalte existiert (analog buildFactorMap im Factor-Chart-Panel).
function buildActiveFactorMap(sampleRow) {
  const active = activeFactorMapScenario();
  const colSet = new Set(Object.keys(sampleRow || {}));
  const map = new Map();
  (appState.getMarketVarFactorSeriesMap?.() || []).forEach((r) => {
    if (String(r.scenario ?? 'default').trim() !== active) return;
    if (Number(r.is_active) === 0) return;
    const col = String(r.linked_ts_col ?? '').trim();
    if (!col || !colSet.has(col)) return;
    const scale = Number(r.scale);
    map.set(String(r.factor_id), { col, scale: Number.isFinite(scale) ? scale : 1 });
  });
  return map;
}

// Lineare Interpolation ueber aufsteigend sortierte (x,y)-Stuetzstellen; ausserhalb geklemmt.
function interpolatePoints(points, x) {
  if (!points || points.length === 0) return null;
  if (points.length === 1) return points[0].y;
  if (x <= points[0].x) return points[0].y;
  if (x >= points[points.length - 1].x) return points[points.length - 1].y;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i], b = points[i + 1];
    if (x >= a.x && x <= b.x) {
      const t = (x - a.x) / (b.x - a.x);
      return a.y + t * (b.y - a.y);
    }
  }
  return null;
}

// Zinssatz fuer targetYear: Stuetzstellen aus den IR:EUR-Faktoren des aktiven
// Szenarios (gemappte Serie x scale); unter 2 gemappten Stuetzstellen Fallback
// auf die rohen EU_<n>Y-Spalten.
function interpolateMappedRate(row, targetYear, factorMap) {
  const pts = [];
  if (factorMap) {
    factorMap.forEach((m, fid) => {
      const match = /^IR:EUR:(\d+(?:\.\d+)?)Y$/.exec(fid);
      if (!match) return;
      const v = parseFloat(row[m.col]);
      if (!Number.isFinite(v)) return;
      pts.push({ x: parseFloat(match[1]), y: v * m.scale });
    });
  }
  if (pts.length < 2) return interpolateSwapRateDynamic(row, targetYear);
  pts.sort((a, b) => a.x - b.x);
  return interpolatePoints(pts, targetYear);
}

// Notch-Skala fuer die Rating-Interpolation (Index = Rang, AAA am besten).
const RATING_NOTCHES = ['AAA', 'AA+', 'AA', 'AA-', 'A+', 'A', 'A-', 'BBB+', 'BBB', 'BBB-', 'BB+', 'BB', 'BB-'];
// Rohspalten-Fallback: in tblTS existieren nur die Haupt-Buckets.
const RATING_RAW_COLS = { AAA: 'US_AAA', AA: 'US_AA', A: 'US_A', BBB: 'US_BBB', BB: 'US_BB' };

// Spread fuer ein Rating: Stuetzstellen aus den CS:EUR-Faktoren des aktiven
// Szenarios, Zwischenstufen (AA-, A+, ...) linear ueber die Notch-Skala;
// unter 2 gemappten Stuetzstellen Fallback auf die rohen US_-Spalten.
// rating: Notch-String ('AA-') ODER numerischer Rang (3.4 = zwischen AA- und A+).
function interpolateRatingSpread(row, rating, factorMap) {
  let targetRank;
  if (Number.isFinite(rating)) {
    targetRank = rating;
  } else {
    const rank = RATING_NOTCHES.indexOf(String(rating || 'A').toUpperCase().trim());
    targetRank = rank >= 0 ? rank : RATING_NOTCHES.indexOf('A');
  }
  let pts = [];
  if (factorMap) {
    factorMap.forEach((m, fid) => {
      const match = /^CS:EUR:(.+)$/.exec(fid);
      if (!match) return;
      const notch = RATING_NOTCHES.indexOf(match[1]);
      if (notch < 0) return;
      const v = parseFloat(row[m.col]);
      if (!Number.isFinite(v)) return;
      pts.push({ x: notch, y: v * m.scale });
    });
  }
  if (pts.length < 2) {
    pts = [];
    Object.entries(RATING_RAW_COLS).forEach(([rt, col]) => {
      const v = parseFloat(row[col]);
      if (!Number.isFinite(v)) return;
      pts.push({ x: RATING_NOTCHES.indexOf(rt), y: v });
    });
  }
  if (!pts.length) return null;
  pts.sort((a, b) => a.x - b.x);
  return interpolatePoints(pts, targetRank);
}

// CPV01-gewichtete Rating-Position des Portfolios auf der Notch-Skala.
// Quelle: PortfolioRiskSensitivities (RISK_TYPE=CPV01, RISK_FACTOR_ID=CS:CCY:<Rating>)
// — dieselben Buckets wie im Sensitivities-CPV01-Chart. null = keine Daten (-> Fallback 'A').
function computePortfolioRatingRank(portName) {
  const norm = (s) => String(s ?? '').replace(/^Portfolios[_-]?/i, '').trim();
  const port = norm(portName);
  if (!port) return null;
  const rows = appState.getPortfolioRiskSensitivitiesData?.() || [];
  let weighted = 0, weight = 0;
  rows.forEach((r) => {
    if (norm(r.PORT_NAME ?? r.port_name) !== port) return;
    if (String(r.RISK_TYPE ?? r.risk_type ?? '').toUpperCase().trim() !== 'CPV01') return;
    const fid = String(r.RISK_FACTOR_ID ?? r.risk_factor_id ?? '').trim();
    const bucket = fid.includes(':') ? fid.split(':').pop().trim() : fid;
    const rank = RATING_NOTCHES.indexOf(bucket);
    if (rank < 0) return;
    const v = Math.abs(Number(r.VALUE_BASE ?? r.value_base ?? r.VALUE_LOCAL ?? r.value_local ?? 0));
    if (!Number.isFinite(v) || v === 0) return;
    weighted += rank * v;
    weight += v;
  });
  return weight > 0 ? weighted / weight : null;
}

// Dropdowns (Laufzeit/Rating) und Factor-Map-Aktivierung einmalig binden ->
// Chart mit den zuletzt uebergebenen Portfolio-Parametern neu zeichnen.
function bindSynthBondControls() {
  if (__synthControlsBound) return;
  const ttmSel = document.getElementById('synthBondTtmSelect');
  const ratingSel = document.getElementById('synthBondRatingSelect');
  if (!ttmSel && !ratingSel) return; // Controls (noch) nicht im DOM
  const redraw = () => {
    if (!__synthChartArgs) return;
    const a = __synthChartArgs;
    drawSyntheticPortfolioChart(a.targetEndValue, a.portPV01, a.testTtM, a.portCPV01, a.portName);
  };
  ttmSel?.addEventListener('change', redraw);
  ratingSel?.addEventListener('change', redraw);
  // Zeitraum-Buttons (1Y/3Y/5Y/10Y/Max) wie im Scenario-Period-Chart.
  const rangeBtns = document.querySelectorAll('.synth-bond-controls .synth-range');
  rangeBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      __synthRangeYears = Number(btn.dataset.years) || 0;
      rangeBtns.forEach((b) => b.classList.toggle('is-active', b === btn));
      redraw();
    });
  });
  document.addEventListener('mvar:factor-map-changed', redraw);
  __synthControlsBound = true;
}

// pv01 treibt den Zinsbeitrag (Laufzeit-interpoliert), cpv01 den Spreadbeitrag
// (Rating-interpoliert). Beide Deltas laufen ueber das Factor-Mapping des aktiven
// Szenarios (opts.factorMap); opts.rating bestimmt die Spread-Stufe.
// Rueckgabe: { points, impacts } — impacts[i] = Tages-P/L in % zum Punkt i (fuer VaR-Pane).
function createAllProductData(tsData, testTtM, pv01, startValue = 100, cpv01 = 0, opts = {}) {
  const { factorMap = null, rating = 'A' } = opts;
  const result = [];
  const impacts = [];
  let currentValue = startValue;

  for (let i = 1; i < tsData.length; i++) {
    const prev = tsData[i - 1];
    const curr = tsData[i];

    const prevRate = interpolateMappedRate(prev, testTtM, factorMap);
    const currRate = interpolateMappedRate(curr, testTtM, factorMap);
    if (prevRate == null || currRate == null) continue;

    const diff = currRate - prevRate;

    // Credit-Spread-Beitrag; fehlt die Serie an einem Tag, zaehlt nur der Zins.
    const prevSpread = interpolateRatingSpread(prev, rating, factorMap);
    const currSpread = interpolateRatingSpread(curr, rating, factorMap);
    const sdiff = (Number.isFinite(prevSpread) && Number.isFinite(currSpread))
      ? currSpread - prevSpread
      : 0;

    const impact = diff * pv01 + sdiff * cpv01;
    currentValue *= (1 + impact / 100);

    impacts.push(impact);
    result.push({
      x: curr.DATE || curr.date,
      y: currentValue,
      originalY: currentValue
    });
  }

  return { points: result, impacts };
}

// Schnittindex des fuehrenden Abschnitts, in dem sich KEINE der beiden Linien bewegt —
// tblTS ist vor dem echten Datenbeginn konstant rueckgefuellt (Deltas = 0), 'Max'
// soll aber am Beginn der Faktordaten starten (wie trimLeadingFlat im Factor-Chart).
function leadingFlatCut(a, b) {
  const firstMove = (arr) => {
    if (!arr.length) return 0;
    const y0 = arr[0].y;
    const idx = arr.findIndex((p) => p.y !== y0);
    return idx < 0 ? arr.length : idx;
  };
  return Math.max(0, Math.min(firstMove(a), firstMove(b)) - 1);
}

// ===== Gleitender VaR (glatt: EWMA/RiskMetrics) fuers Pane unter dem Chart =====

// z-Wert zur Konfidenz (Normalverteilung, gaengige Stufen).
function zScore(confidence) {
  const table = [
    [0.90, 1.2816], [0.95, 1.6449], [0.975, 1.9600], [0.99, 2.3263], [0.995, 2.5758],
  ];
  let best = table[1];
  table.forEach((t) => { if (Math.abs(t[0] - confidence) < Math.abs(best[0] - confidence)) best = t; });
  return best[1];
}

// Konfidenz + Horizont aus dem Scenario-Period-Setup (Customer Default bevorzugt),
// Fallback 95 % / 10 Tage.
function getVarConfHorizon() {
  const rows = appState.getMvarModelSelectionAppRows?.() || [];
  const row = rows.find((r) => Number(r.CUSTOMER_DEFAULT ?? r.customer_default) === 1) || rows[0] || {};
  let conf = parseFloat(String(row.CONFIDENCE ?? row.Confidence ?? row.confidence ?? '').replace('%', '').replace(',', '.'));
  if (Number.isFinite(conf)) { if (conf > 1) conf /= 100; } else { conf = 0.95; }
  let h = parseInt(row.VaR_Days ?? row.VAR_DAYS ?? row.var_days, 10);
  if (!Number.isFinite(h) || h <= 0) h = 10;
  return { conf, h };
}

// Gleitender VaR: EWMA (lambda 0.94) auf UEBERLAPPENDEN h-Tages-P/L-Summen statt
// Eintages-Vol x sqrt(h) — ein Schocktag verteilt sich so auf h Fenster (die Linie
// steigt ueber ~h Tage statt an einem Tag, max. Tagessprung ~x1.25 statt x2.16),
// und die Autokorrelation der Tage wird mitgemessen statt per sqrt(h) wegargumentiert.
// Seed = Varianz der ersten (max 30) Fenster statt erstem Wert^2 (falscher Start).
// Rueckgabe ist label-synchron: die ersten h-1 Punkte sind null (kein volles Fenster).
function ewmaVarSeries(impacts, z, horizonDays) {
  const lambda = 0.94;
  const h = Math.max(1, Math.round(Number(horizonDays) || 1));
  const n = impacts.length;
  if (!n) return [];

  // Ueberlappende h-Tages-Summen (Index i = Fenster endet am Tag i).
  const sums = new Array(n).fill(null);
  let run = 0;
  for (let i = 0; i < n; i++) {
    run += Number(impacts[i]) || 0;
    if (i >= h) run -= Number(impacts[i - h]) || 0;
    if (i >= h - 1) sums[i] = run;
  }

  const windows = sums.filter((v) => v != null);
  if (!windows.length) return new Array(n).fill(null);

  const seedN = Math.min(30, windows.length);
  let variance = windows.slice(0, seedN).reduce((s, v) => s + v * v, 0) / seedN;

  const out = new Array(n).fill(null);
  for (let i = h - 1; i < n; i++) {
    const v = sums[i];
    variance = lambda * variance + (1 - lambda) * v * v;
    out[i] = z * Math.sqrt(variance);
  }
  return out;
}

// Vollwertiger Rolling-VaR-Chart in eigener Box: gleiche x-Achse, Groesse und
// Optik wie der Synth-Chart (Legende rechts, Fadenkreuz, Zoom + Reset-Button),
// nur die y-Achse zeigt den gleitenden VaR.
function drawSynthVarChart(labels, impBond, impPort, bondLabel, portLabel, bondColor, portColor) {
  const canvas = document.getElementById('synthVarChart');
  if (!canvas) return;
  if (window.synthVarChartInstance) { try { window.synthVarChartInstance.destroy(); } catch (_) {} }

  const { conf, h } = getVarConfHorizon();
  const z = zScore(conf);
  const col = _chartTextColor();

  window.synthVarChartInstance = new Chart(canvas.getContext('2d'), {
    type: 'line',
    plugins: [_synthZoomSyncPlugin],
    data: {
      labels,
      datasets: [
        { label: `VaR ${bondLabel}`, data: ewmaVarSeries(impBond, z, h), borderColor: bondColor, backgroundColor: 'transparent', pointRadius: 0, borderWidth: 1.5, tension: 0.1 },
        { label: `VaR ${portLabel}`, data: ewmaVarSeries(impPort, z, h), borderColor: portColor, backgroundColor: 'transparent', pointRadius: 0, borderWidth: 1.5, tension: 0.1 },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      color: col,
      interaction: { mode: 'nearest', axis: 'x', intersect: false },
      scales: {
        x: {
          display: true,
          type: 'category',
          title: { display: true, text: 'Date', color: col },
          ticks: { color: col },
        },
        y: {
          beginAtZero: true,
          title: { display: true, text: `Rolling VaR ${Math.round(conf * 100)}% / ${h}d (% NAV)`, color: col },
          ticks: { color: col, callback: (v) => `${Number(v).toFixed(2)}%` },
        },
      },
      plugins: {
        legend: {
          position: 'right',
          labels: { color: col, boxWidth: 12, boxHeight: 6, font: { size: 11 } },
        },
        tooltip: { enabled: false },
        histCrosshair: { enabled: true, valueScale: 1 },
        zoom: {
          pan: { enabled: true, mode: 'x' },
          zoom: {
            drag: { enabled: true },
            wheel: { enabled: true },
            pinch: { enabled: true },
            mode: 'x',
          },
        },
      },
    },
  });

  ensureDistZoomTools(canvas, 'synthVarChartInstance');
}

function drawSyntheticPortfolioChart(targetEndValue = 100, portPV01 = 1, testTtM = 5, portCPV01 = 0, portName = null) {
  // Fuer Re-Renders durch Dropdown-/Factor-Map-Aenderungen merken.
  __synthChartArgs = { targetEndValue, portPV01, testTtM, portCPV01, portName };
  bindSynthBondControls();

  const tsData = appState.getTblTSData();

  console.log('[TS EU1Y CHART] drawSyntheticPortfolioChart called', {
    tsDataLen: Array.isArray(tsData) ? tsData.length : null,
    targetEndValue,
    portPV01,
    canvasExists: !!document.getElementById('tsEU1YChart'),
  });

  // Guard: without a usable time-series, tsData[last] is undefined and the
  // interpolation below would THROW (Object.entries(undefined)), which previously
  // also aborted the product render that runs after this in refreshMarketRiskUI.
  if (!Array.isArray(tsData) || tsData.length < 2) {
    console.warn('[TS EU1Y CHART] skipped: tblTS time-series empty/too short', {
      tsDataLen: Array.isArray(tsData) ? tsData.length : null,
    });
    return;
  }

  // Dropdown-Auswahl fuer die Bond-Linie (Fallback: Aufruf-Parameter / Rating A).
  const selTtm = Number(document.getElementById('synthBondTtmSelect')?.value);
  const ttm = Number.isFinite(selTtm) && selTtm > 0 ? selTtm : testTtM;
  const rating = String(document.getElementById('synthBondRatingSelect')?.value || 'A');

  // Factor-Mapping des aktiven Szenarios: bestimmt, welche tblTS-Serien (x scale)
  // die Zins- und Spread-Deltas liefern.
  const factorMap = buildActiveFactorMap(tsData[tsData.length - 1]);

  const testCurr = tsData[tsData.length - 1];
  const testCurrRate = interpolateMappedRate(testCurr, ttm, factorMap) / 100;

  const testPV01 = -ttm / (1 + testCurrRate);
  const portfolioPV01 = portPV01;

  // Zeitfenster (1Y/3Y/5Y/10Y/Max) ab dem juengsten Datum der Zeitreihe.
  const lastTs = new Date(testCurr.DATE || testCurr.date);
  let tsFiltered = tsData;
  if (__synthRangeYears > 0 && !Number.isNaN(lastTs.getTime())) {
    const cutoff = new Date(lastTs);
    cutoff.setFullYear(cutoff.getFullYear() - __synthRangeYears);
    tsFiltered = tsData.filter(d => new Date(d.DATE || d.date) >= cutoff);
  }

  // Bond: Dropdown-Laufzeit + Dropdown-Rating (Spread-Duration = Zins-Duration).
  // Portfolio: Deltas vom duration-aequivalenten Kurvenpunkt (Duration ~ ttm/(1+r)
  // -> ttm = |PV01| * (1+r)), NICHT von einem festen Tenor — beide Linien sind
  // Ein-Faktor-Naeherungen, das Portfolio kennt seine Kurvenverteilung hier nicht.
  const durGuess = Math.abs(portfolioPV01);
  const rPort = interpolateMappedRate(testCurr, durGuess, factorMap) / 100;
  const portTtm = durGuess * (1 + rPort);

  // Spread-Seite analog: CPV01-gewichtete Rating-Position des Portfolios auf der
  // Spread-Kurve (statt fix 'A'); ohne CPV01-Buckets Fallback 'A'.
  const portRatingRank = computePortfolioRatingRank(portName);
  const portRatingLabel = portRatingRank != null
    ? (RATING_NOTCHES[Math.round(portRatingRank)] || 'A')
    : 'A';
  const portLabel = `Synthetic Portfolio (PV01 ${Number(portfolioPV01).toFixed(2)})`;

  const synthRes = createAllProductData(tsFiltered, ttm, testPV01, 100, testPV01, { factorMap, rating });
  const portRes = createAllProductData(tsFiltered, portTtm, portfolioPV01, 100, portCPV01, { factorMap, rating: portRatingRank ?? 'A' });
  const cut = leadingFlatCut(synthRes.points, portRes.points);
  const rawSynthetic = synthRes.points.slice(cut);
  const rawPortfolio = portRes.points.slice(cut);
  const impSynthetic = synthRes.impacts.slice(cut);
  const impPortfolio = portRes.impacts.slice(cut);

  const syntheticData = normalizeCurveToEndValue(rawSynthetic, targetEndValue);
  const portfolioData = normalizeCurveToEndValue(rawPortfolio, targetEndValue);

  const cmbValueDataset = {
    label: `Synthetic Portfolio (${ttm}Y ${rating})`,
    data: syntheticData,
    borderColor: 'rgba(45, 212, 191, 0.9)',
    backgroundColor: 'rgba(45, 212, 191, 0.4)',
    tension: 0.1,
    pointRadius: 0
  };

  // Synthetic Portfolio = Garmin-Pink, durchgezogen
  const pCol = getPortfolioColor(1);
  const portfolioValueDataset = {
    label: portLabel,
    data: portfolioData,
    borderColor: pCol.borderColor,
    backgroundColor: 'transparent',
    tension: 0.1,
    pointRadius: 0
  };

  const lastPoint = syntheticData[syntheticData.length - 1];

  // Current Portfolio Value Marker = Garmin-Pink
  const endMarker = {
    label: `Current Portfolio Value (${targetEndValue.toFixed(2)}%)`,
    data: [{ x: lastPoint.x, y: targetEndValue }],
    pointRadius: 6,
    pointStyle: 'circle',
    pointBackgroundColor: pCol.backgroundColor,
    pointBorderColor: pCol.borderColor,
    showLine: false,
    borderColor: pCol.borderColor,
    backgroundColor: pCol.backgroundColor,
  };

  // Chart generieren
  window.tsEU1YChartInstance = createSimpleLineChart(
    [cmbValueDataset, portfolioValueDataset, endMarker],
    'tsEU1YChart',
    'Synthetic Bond vs. Portfolio',
    0,
    { // optionsOverride: nur der Achsentitel — min/max rechnet createSimpleLineChart
      // selbst (deckt die volle Datenrange ab, sonst wird die Kurve oben abgeschnitten).
      scales: {
        y: {
          title: { display: true, text: 'Normalized Value (%)' },
        }
      }
    }
  );

  // Legende: unter dem Portfolio-Eintrag das durchschnittliche Rating als eigene,
  // nicht klickbare Zeile ohne Farbkasten anzeigen.
  const synthChart = window.tsEU1YChartInstance;
  if (synthChart) {
    synthChart.options.plugins.legend.labels.generateLabels = (ch) => {
      const items = Chart.defaults.plugins.legend.labels.generateLabels(ch);
      const idx = items.findIndex((it) => it.text === portLabel);
      const info = {
        text: `Ø Rating ~${portRatingLabel}`,
        fillStyle: 'transparent', strokeStyle: 'transparent', lineWidth: 0,
        datasetIndex: -1, $info: true,
      };
      if (idx >= 0) items.splice(idx + 1, 0, info); else items.push(info);
      return items;
    };
    synthChart.options.plugins.legend.onClick = (e, item, legend) => {
      if (item.$info) return; // Info-Zeile togglet nichts
      Chart.defaults.plugins.legend.onClick(e, item, legend);
    };
    synthChart.update();
  }

  ensureDistZoomTools(document.getElementById('tsEU1YChart'), 'tsEU1YChartInstance');

  // Gleitender VaR (EWMA) als eigener Chart darunter — gleiche Zeitachse und Farben.
  drawSynthVarChart(
    syntheticData.map((p) => formatDateLabel(p.x)),
    impSynthetic,
    impPortfolio,
    cmbValueDataset.label,
    portLabel,
    cmbValueDataset.borderColor,
    pCol.borderColor
  );
}

function interpolateSwapRateDynamic(row, targetYear) {
  const points = Object.entries(row)
    .filter(([key, val]) => key.startsWith('EU_') && !isNaN(parseFloat(val)))
    .map(([key, val]) => {
      const match = key.match(/^EU_(\d+(\.\d+)?)Y$/);
      if (!match) return null;
      return { year: parseFloat(match[1]), rate: parseFloat(val) };
    })
    .filter(p => p && !isNaN(p.year) && !isNaN(p.rate))
    .sort((a, b) => a.year - b.year);

  if (points.length < 2) return null;

  let lower = null, upper = null;
  for (let i = 0; i < points.length - 1; i++) {
    if (targetYear >= points[i].year && targetYear <= points[i + 1].year) {
      lower = points[i];
      upper = points[i + 1];
      break;
    }
  }

  if (!lower || !upper) {
    if (targetYear < points[0].year) return points[0].rate;
    if (targetYear > points[points.length - 1].year) return points[points.length - 1].rate;
    return null;
  }

  const t = (targetYear - lower.year) / (upper.year - lower.year);
  return lower.rate + t * (upper.rate - lower.rate);
}

function normalizeCurveToEndValue(curve, targetEndValue) {
  if (!curve.length) return curve;

  const lastY = curve[curve.length - 1].y;
  const factor = targetEndValue / lastY;

  return curve.map(point => ({
    ...point,
    y: point.y * factor
  }));
}

// Zoom-Sync in BEIDE Richtungen: jede x-Range-Aenderung (Drag-/Wheel-Zoom, Pan,
// Reset) des einen Charts wird auf den anderen gespiegelt. Beide Charts haben
// identische Kategorie-Labels, daher genuegt das Uebertragen der Indizes.
// __synthZoomSyncing verhindert Ping-Pong (Sync loest dst-Update aus).
let __synthZoomSyncing = false;
const _synthZoomSyncPlugin = {
  id: 'synthZoomSync',
  afterUpdate(chart) {
    if (__synthZoomSyncing) return;
    const id = chart?.canvas?.id;
    const dst = id === 'tsEU1YChart' ? window.synthVarChartInstance
      : id === 'synthVarChart' ? window.tsEU1YChartInstance
      : null;
    const xs = chart.scales?.x;
    if (!dst || !xs) return;
    const min = xs.min, max = xs.max;
    const prev = chart.$lastSyncRange;
    if (prev && prev.min === min && prev.max === max) return;
    chart.$lastSyncRange = { min, max };
    const dxs = dst.scales?.x;
    if (dxs && dxs.min === min && dxs.max === max) return; // schon synchron
    __synthZoomSyncing = true;
    try { dst.zoomScale('x', { min, max }, 'none'); } catch (_) {}
    __synthZoomSyncing = false;
  },
};

// NOTE: createSimpleLineChart bleibt bei dir unverÃ¤ndert nutzbar,
// weil wir die Farben im Dataset selbst setzen (inkl. borderDash fÃ¼r Synthetic Portfolio).
function createSimpleLineChart(datasets, chartName, chartTitle = 'Line Chart', pointRadius = 0, optionsOverride = {}) {
  const canvasElement = document.getElementById(chartName);
  if (!canvasElement) {
    console.error(`Canvas element with ID "${chartName}" not found.`);
    return null;
  }

  if (window[chartName + 'Instance']) {
    window[chartName + 'Instance'].destroy();
  }

  const ctx = canvasElement.getContext("2d");
  if (!ctx) {
    console.error(`Failed to get 2D context for canvas with ID "${chartName}".`);
    return null;
  }

  const markerDatasets = datasets.filter(d => d.pointStyle === 'circle');
  const regularDatasets = datasets.filter(d => d.pointStyle !== 'circle');

  const allDatasets = [
    ...regularDatasets.map((dataset, index) => ({
      label: dataset.label,
data: dataset.data.map(dataPoint => ({
  x: formatDateLabel(dataPoint.x),   // <-- entscheidend
  y: dataPoint.y,
  originalY: dataPoint.originalY
})),

      pointStyle: 'line', // Legendensymbol (usePointStyle): Linie statt Rechteck
      fill: false,
      borderColor: dataset.borderColor || getColorFromPalette(index),
      backgroundColor: dataset.backgroundColor || 'transparent',
      tension: dataset.tension ?? 0.1,
      pointRadius: dataset.pointRadius ?? pointRadius,
      borderWidth: dataset.borderWidth ?? 1,
      spanGaps: false,
      borderDash: dataset.borderDash || [],
      yAxisID: 'y'
    })),
    ...markerDatasets.map(marker => ({
      label: marker.label,
      data: marker.data,
      showLine: false,
      // Marker am rechten Chartrand nicht an der Plotflaeche abschneiden
      // (der Endpunkt liegt exakt auf der Kante -> sonst nur ein halber Kreis).
      clip: false,
      pointRadius: marker.pointRadius ?? 5,
      pointStyle: marker.pointStyle ?? 'circle',
      pointBackgroundColor: marker.pointBackgroundColor ?? 'red',
      pointBorderColor: marker.pointBorderColor ?? 'red',
      // Punktfarben auch als Dataset-Farben, damit das Legendensymbol sichtbar ist
      // (showLine: false verhindert ohnehin eine Linie).
      borderColor: marker.pointBorderColor ?? 'red',
      backgroundColor: marker.pointBackgroundColor ?? 'red',
      yAxisID: 'y'
    }))
  ];

  const targetMarker = markerDatasets.find(m => m.data?.[0]?.y != null);
  const targetY = targetMarker?.data?.[0]?.y ?? 100;

  const allYValues = regularDatasets.flatMap(ds => ds.data.map(p => p.y));
  const minY = Math.min(...allYValues);
  const maxY = Math.max(...allYValues);
  const spread = Math.max(Math.abs(targetY - minY), Math.abs(targetY - maxY));
  const padding = spread * 0.15;

  const yMin = targetY - spread - padding;
  const yMax = targetY + spread + padding;

  const chartCol = _chartTextColor();
  // Achs-Overrides des Aufrufers (z. B. y-min/max/title von drawSyntheticPortfolioChart);
  // title-Objekte werden gemerged, damit die Theme-Textfarbe erhalten bleibt.
  const xOv = optionsOverride?.scales?.x || {};
  const yOv = optionsOverride?.scales?.y || {};

  ensureHistCrosshairPlugin(); // Fadenkreuz-Plugin registrieren (idempotent)
  const newChart = new Chart(ctx, {
    type: "line",
    plugins: [_synthZoomSyncPlugin],
    data: {
      labels: datasets[0].data.map(d => formatDateLabel(d.x)),
      datasets: allDatasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      color: chartCol,
      interaction: {
        mode: 'nearest',
        axis: 'x',
        intersect: false
      },
      scales: {
        x: {
          display: true,
          type: 'category',
          ticks: { color: chartCol },
          ...xOv,
          title: { display: true, text: "Date", color: chartCol, ...(xOv.title || {}) },
        },
        y: {
          ticks: { color: chartCol, callback: val => `${val.toFixed(2)}%` },
          min: yMin,
          max: yMax,
          ...yOv,
          title: { display: true, text: "Value Development (%)", color: chartCol, ...(yOv.title || {}) },
        }
      },
      plugins: {
        legend: {
          position: 'right',
          // usePointStyle: Marker-Eintrag als KREIS (dataset.pointStyle 'circle'),
          // Linien-Serien als Linien-Symbol (dataset.pointStyle 'line').
          labels: { color: chartCol, usePointStyle: true, pointStyleWidth: 16, font: { size: 11 } },
        },
        tooltip: { enabled: false },
        // Fadenkreuz mit Randwerten; Werte sind hier schon in %, daher valueScale 1
        // (das Plugin multipliziert sonst mit 100 wie in den Historic-Charts).
        histCrosshair: { enabled: true, valueScale: 1 },
        zoom: {
          pan: { enabled: true, mode: 'x' },
          zoom: {
            drag: { enabled: true },
            wheel: { enabled: true },
            pinch: { enabled: true },
            mode: 'x'
          }
        }
      }
    }
  });

  window[chartName + 'Instance'] = newChart;
  return newChart;
}

function formatDateLabel(val) {
  if (val == null) return '';

  // 1) Strings: immer versuchen sauber auf YYYY-MM-DD zu kÃ¼rzen
  if (typeof val === 'string') {
    const s = val.trim();

    // Wenn es mit YYYY-MM-DD beginnt â†’ IMMER auf die ersten 10 Zeichen kÃ¼rzen
    // (deckt "YYYY-MM-DD", "YYYY-MM-DD 00:00:00", "YYYY-MM-DDTHH:MM:SS..." ab)
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);

    // Fallback: Date parse versuchen
    const d = new Date(s);
    if (!isNaN(d)) return d.toISOString().slice(0, 10);

    // Wenn gar nichts geht: original zurÃ¼ck
    return s;
  }

  // 2) Date/Number: normal parsen
  const d = new Date(val);
  if (!isNaN(d)) return d.toISOString().slice(0, 10);

  return String(val);
}

//MarketVaR_Product
// Delegiert an den kuratierten Product-VaR-Renderer, damit der INITIAL-Feed
// dieselbe Tabelle zeigt wie nach einer Berechnung (Product ID / Description /
// VaR / ES / Obs) — kein Roh-DB-Dump (id, asof_date, var_contrib_* …) mehr.
// Die Daten stehen bereits im Store (setMvarProductData lief davor).
export function handleMvarProductTable(/* port_name, scenario_name, asof_date */) {
  try {
    renderMvarProductPLPanel();
  } catch (e) {
    console.warn('[PRODUCT] renderMvarProductPLPanel delegation failed', e);
  }
}

function pickProductColumns(rows) {
  const sample = rows?.[0] || {};
  const keys = Object.keys(sample);

  // Diese Spalten sind typischerweise sinnvoll (falls vorhanden)
  const preferred = [
    'prod_id',  
    'product_id', 'instrument_id', 'isin', 'ric', 'ticker', 'name',
    'currency', 'ccy',
    'notional', 'qty', 'position',
    'pv', 'value', 'price',
    'var_contrib_total', 'var_contrib', 'VaR_Contrib', 'VaR', 'var',
    'es_contrib_total', 'es_contrib', 'ES_Contrib', 'ES', 'es'

  ].filter(k => keys.includes(k));

  // Wenn preferred leer ist: nimm einfach die ersten 10 Keys
  if (preferred.length < 4) {
  const base = keys.slice(0, 12);
  if (keys.includes('prod_id')) {
    return ['prod_id', ...base.filter(k => k !== 'prod_id')].slice(0, 12);
  }
  return base;
}



  // Stelle sicher: nicht zu viele Spalten (UI)
  return preferred.slice(0, 12);
}

function renderHtmlTable(rows, columns) {
  const table = document.createElement('table');
  table.className = 'risk-table';

  const thead = document.createElement('thead');
  const trh = document.createElement('tr');
  for (const c of columns) {
    const th = document.createElement('th');
    th.textContent = c;
    trh.appendChild(th);
  }
  thead.appendChild(trh);

  const tbody = document.createElement('tbody');
  for (const r of rows) {
    const tr = document.createElement('tr');
    for (const c of columns) {
      const td = document.createElement('td');
      td.textContent = formatCell(r?.[c]);
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }

  table.appendChild(thead);
  table.appendChild(tbody);
  return table;
}

function formatCell(v) {
  if (v == null) return '';
  if (typeof v === 'number') {
    // klein & robust: max 6 decimals, keine scientific notation
    return Number.isFinite(v) ? v.toLocaleString(undefined, { maximumFractionDigits: 6 }) : '';
  }
  return String(v);
}

function buildProdIdVarContribSeries(rows, {
  valueKey = 'var_contrib_total',
  idKey = 'prod_id',
  topN = 20,
  sortByAbs = true,
} = {}) {
  const arr = Array.isArray(rows) ? rows : [];

  const series = arr
    .map(r => {
      const id = String(r?.[idKey] ?? '').trim();
      const v = Number(r?.[valueKey]);
      const value = Number.isFinite(v) ? v : null;
      return { id, value };
    })
    .filter(x => x.id && x.value != null);

  series.sort((a, b) => {
    const av = sortByAbs ? Math.abs(a.value) : a.value;
    const bv = sortByAbs ? Math.abs(b.value) : b.value;
    return bv - av;
  });

  return series.slice(0, topN);
}

let __mvarProdIdChart = null;

// export function renderMvarProdIdVarContribChart(rows) {
//   console.warn('[SummaryMarketRisk] renderMvarProdIdVarContribChart is deprecated. Product VaR chart is owned by mvarProductPLPanel.js.');

//   const series = buildProdIdVarContribSeries(rows, {
//     valueKey: 'var_contrib_total',
//     idKey: 'prod_id',
//     topN: 20,
//     sortByAbs: true,
//   });

//   renderProdContribMiniTable(series, {
//     containerId: 'mvarProdIdVarContribTable',
//     valueLabel: 'var_contrib_total',
//   });

//   bindProdIdClicksForDetailsTable();
// }

function buildProdIdEsContribSeries(rows, {
  valueKey = 'es_contrib_total',
  idKey = 'prod_id',
  topN = 20,
  sortByAbs = true,
} = {}) {
  const arr = Array.isArray(rows) ? rows : [];

  const series = arr
    .map(r => {
      const id = String(r?.[idKey] ?? '').trim();
      const v = Number(r?.[valueKey]);
      const value = Number.isFinite(v) ? v : null;
      return { id, value };
    })
    .filter(x => x.id && x.value != null);

  series.sort((a, b) => {
    const av = sortByAbs ? Math.abs(a.value) : a.value;
    const bv = sortByAbs ? Math.abs(b.value) : b.value;
    return bv - av;
  });

  return series.slice(0, topN);
}

let __mvarProdIdESChart = null;

export function renderMvarProdIdEsContribChart(rows) {
  const canvas = document.getElementById('mvarProdIdEsContribChart');
  if (!canvas) {
    console.warn('[MVAR-PROD-ES-CHART] canvas #mvarProdIdEsContribChart not found');
    return;
  }



  const series = buildProdIdEsContribSeries(rows, {
    valueKey: 'es_contrib_total',
    idKey: 'prod_id',
    topN: 20,
    sortByAbs: true,
  });

  const labels = series.map(x => x.id);
  const values = series.map(x => x.value);

  const bg = values.map(v => v >= 0 ? 'rgba(59,130,246,0.75)' : 'rgba(239,68,68,0.75)');
  const br = values.map(v => v >= 0 ? 'rgba(59,130,246,1)' : 'rgba(239,68,68,1)');

  if (__mvarProdIdESChart) { __mvarProdIdESChart.destroy(); __mvarProdIdESChart = null; }

  __mvarProdIdESChart = new Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Top Product ES Contribution (es_contrib_total)',
        data: values,
        backgroundColor: bg,
        borderColor: br,
        borderWidth: 1,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'y',
      plugins: {
        legend: { display: true },
        tooltip: {
          callbacks: {
            label: (ctx) =>
              ` ${Number(ctx.raw).toLocaleString(undefined, { maximumFractionDigits: 2 })}`
          }
        }
      },
      scales: {
        x: {
          ticks: {
            callback: (v) =>
              Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 })
          }
        }
      }
    }
  });
}




function renderProdContribMiniTable(series, {
  containerId,
  valueLabel = 'var_contrib_total',
} = {}) {
  const el = document.getElementById(containerId);
  if (!el) {
    console.warn('[MVAR-MINI-TABLE] container not found:', containerId);
    return;
  }

  if (!Array.isArray(series) || series.length === 0) {
    el.innerHTML = `<div class="muted">No data.</div>`;
    return;
  }

  const fmt = (v) => Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 });

  el.innerHTML = `
    <table class="mvar-mini-table">
      <thead>
        <tr>
          <th>#</th>
          <th>prod_id</th>
          <th>${valueLabel}</th>
        </tr>
      </thead>
      <tbody>
        ${series.map((x, i) => `
          <tr>
            <td>${i + 1}</td>
            <td><span class="clickable" data-prod-id="${x.id}">${x.id}</span></td>
            <td>${fmt(x.value)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}


export function showProdDetailsSidepanel(prod_id) {
  const meta = document.getElementById('prodDetailsMeta');
  const container = document.getElementById('prodDetailsContainer');

  if (!meta || !container) {
    console.warn('[PROD-DETAILS] panel containers missing');
    return;
  }

  const id = String(prod_id ?? '').trim();
  meta.innerHTML = `PROD_ID: <b>${id}</b>`;

  const row = appState.getProdById?.(id);

  if (!row) {
    container.innerHTML = `<div class="muted">No product details found for PROD_ID: ${id}</div>`;
  } else {
    const entries = Object.entries(row);
    container.innerHTML = `
      <table class="risk-table">
        <tbody>
          ${entries.map(([k, v]) => `
            <tr>
              <td style="opacity:.7; padding-right:12px; white-space:nowrap;">${k}</td>
              <td>${v == null ? '' : String(v)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

const panel = document.getElementById('panel-prod-details');
if (!panel) {
  console.warn('[PROD-DETAILS] panel #panel-prod-details not found');
  return;
}
panel.hidden = false;

}

let __prodDetailsClickBound = false;

export function bindProdIdClicksForDetailsTable() {
  if (__prodDetailsClickBound) return;

  const root = document.getElementById('mvarProdIdVarContribTable');
  if (!root) return;

  root.addEventListener('click', (e) => {
    const prodId = e?.target?.dataset?.prodId;
    if (!prodId) return;
    showProdDetailsSidepanel(prodId);
  });

  __prodDetailsClickBound = true;
}





















