import { filterColumnsInData } from '../../../core/ui/modal/modalData.js';
import processData from '../../../core/ui/modal/modalData.js';
import createBarChart from '../../../charts/BarChart.js';
import { appState } from '../../../renderer.js';
import { renderLossHistogram } from './lossHistogramChart.js';
import { getColorFromPalette } from '../../../utils/colors.js';
import { createContribDrill, scheduleHideConcMenu } from '../SummaryBreakdown.js';
// import {handleTrafficLight} from './trafficLight.js';

// Global scope â€” this runs as soon as the file is loaded
if (!window.charts) window.charts = {};

// Drill-down fuer die kombinierte Loss-Chart (Balken = Quantil -> ausfallender
// Emittent aus ISSUER_RANK). Dieselbe Engine wie die Market-Risk-Beitragspanels.
// Nur eine Metrik-Schiene noetig ('var'); die 'es'-Config zeigt auf dieselben IDs
// und bleibt ungenutzt.
const _clossIssuerDrillCfg = {
  detailId: 'clossIssuerDetail', titleId: 'clossIssuerDetailTitle',
  tableId: 'clossIssuerDetailTable', closeId: 'clossIssuerDetailClose',
  menuId: 'clossIssuerCardMenu', valueType: 'NAV', valueLabel: 'NAV',
  // Zusatzspalte Loss (Verlust bei Ausfall) je Position, aus __LOSS (unten befuellt).
  extraCol: { key: '__LOSS', label: 'Loss' },
  // Text-Info-Spalte Rating (aus RATINGres der enriched-View), nur Positions-Sicht.
  infoCol: { key: 'RATINGres', label: 'Rating' },
};
const lossIssuerDrill = createContribDrill({ var: _clossIssuerDrillCfg, es: _clossIssuerDrillCfg });

// ISSUER_RANK = kommagetrennte Liste ALLER in diesem Szenario ausfallenden Emittenten,
// je "<Emittent>_<Seniority>" (z.B. "DZ HYP AG_senior_secured, Hypo Wohnbaubank AG_
// senior_unsecured"). Emittentennamen enthalten keine Unterstriche -> Teil vor dem
// ersten "_". Liefert alle Ausfaelle (dedupliziert), nicht nur den ersten.
function issuersFromRank(rank) {
  const s = (rank == null ? '' : String(rank)).trim();
  if (!s) return [];
  const out = [];
  const seen = new Set();
  for (const part of s.split(',')) {
    const p = part.trim();
    if (!p) continue;
    const i = p.indexOf('_');
    const name = (i > 0 ? p.slice(0, i) : p).trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}

// Drill-Schritt fuer ein Ausfall-Szenario (Balken): matcht die Positionen ALLER
// ausfallenden Emittenten via match-Praedikat (nicht nur Einzelwert-Gleichheit).
// Bei mehreren Defaults synthetischer colKey '__DEFAULTS' (keine echte Dimension),
// damit im Hover-Menue "By Issuer" erscheint -> Nutzer kann nach einzelnem Emittenten
// aufsplitten und genau einen auswaehlen. Bei einem Default direkt ISSUER (kein
// redundantes "By Issuer").
function lossDefaultStep(issuers) {
  if (!issuers || !issuers.length) return null;
  const set = new Set(issuers.map(n => String(n).trim().toLowerCase()));
  const multi = issuers.length > 1;
  return {
    colKey: multi ? '__DEFAULTS' : 'ISSUER',
    value: issuers.join(', '),
    label: multi ? 'Defaults' : 'Issuer',
    match: (r) => set.has(String(r?.ISSUER ?? '').trim().toLowerCase()),
  };
}
function bindLossCanvasLeaveHide(canvas) {
  if (!canvas || canvas.dataset.clossLeaveBound) return;
  canvas.dataset.clossLeaveBound = '1';
  canvas.addEventListener('mouseleave', () => { try { scheduleHideConcMenu(); } catch {} });
}

// Kompakte Zahl fuer die Balken-Beschriftung (z.B. 6.3M) — haelt das Label kurz.
export const _fmtLossCompact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });

// Eigene HTML-Legende (sticky, bleibt beim Scrollen sichtbar). Klick blendet die
// Serie aus/ein wie die Chart.js-Legende. legendEl.__chart haelt die aktuelle Chart.
export function renderChartLegend(chart, legendEl) {
  if (!legendEl || !chart) return;
  legendEl.__chart = chart;
  legendEl.innerHTML = chart.data.datasets.map((ds, i) => {
    const hidden = !chart.isDatasetVisible(i);
    const col = ds._legendColor
      || (Array.isArray(ds.borderColor) ? ds.borderColor.find(c => c) : ds.borderColor)
      || '#888';
    const label = String(ds.label ?? '').replace(/[<>&]/g, '');
    return `<span class="closs-leg-item${hidden ? ' is-hidden' : ''}" data-ds="${i}">`
      + `<span class="closs-leg-swatch" style="background:${col}"></span>${label}</span>`;
  }).join('');
  if (!legendEl.dataset.bound) {
    legendEl.dataset.bound = '1';
    legendEl.addEventListener('click', (e) => {
      const item = e.target?.closest?.('.closs-leg-item');
      if (!item) return;
      const ch = legendEl.__chart;
      const i = Number(item.dataset.ds);
      if (!ch || !Number.isInteger(i)) return;
      ch.setDatasetVisibility(i, !ch.isDatasetVisible(i));
      ch.update();
      renderChartLegend(ch, legendEl);
    });
  }
}

// Verlust bei Ausfall je Position = NOTIONAL x LGD-Rate(Emittent, Rang). Die LGD-Rate
// stammt aus der EAD-Tabelle (LGD ist dort ein Betrag je Emittent/Rang; Rate =
// LGD/NOTIONAL) und ist ueber alle pd_flags identisch -> pd_flag='RATING' reicht.
// Summe der Positions-Losses eines Emittent/Rangs = dessen Szenario-Loss.
export function buildPositionLoss(portRows, port) {
  const rate = new Map(); // "ISSUER||RANK" -> LGD-Rate
  const ead = appState.getAllEADData?.() || [];
  for (const e of ead) {
    if (String(e?.port_name ?? '') !== String(port)) continue;
    if (String(e?.pd_flag ?? '').toUpperCase() !== 'RATING') continue;
    const notion = Number(e?.NOTIONAL);
    const lgd = Number(e?.LGD);
    if (!Number.isFinite(notion) || notion <= 0 || !Number.isFinite(lgd)) continue;
    const key = `${String(e?.ISSUER ?? '').trim().toLowerCase()}||${String(e?.RANK ?? '').trim().toLowerCase()}`;
    rate.set(key, lgd / notion);
  }
  return (portRows || []).map((r) => {
    const key = `${String(r?.ISSUER ?? '').trim().toLowerCase()}||${String(r?.RANK ?? '').trim().toLowerCase()}`;
    const rt = rate.get(key);
    const notion = Number(r?.NOTIONAL);
    const loss = (Number.isFinite(rt) && Number.isFinite(notion)) ? notion * rt : 0;
    return { ...r, __LOSS: loss };
  });
}

// Global objects to store datasets
let ratingData = [];
let marketData = [];
let marketNormData = [];

// var_index der gelaufenen CVaR-Config: spiegelt das Backend
// (var_index = floor((1 - conf_level) * n_simulations)). Werte kommen aus
// CreditVaRInput (die gewaehlte/aktive Config), damit die markierte VaR-Zeile
// mit n_simulations mitskaliert. Fallback = 10 (bisheriges Verhalten).
function getRunVarIndex() {
  const configs = appState.getCvarInput?.() || [];
  const selName = document.querySelector('.cvar-radio:checked')?.dataset?.name;
  const cfg =
    (selName && configs.find(c => String(c.name) === String(selName))) ||
    configs.find(c => Number(c.is_active) === 1) ||
    configs[configs.length - 1] ||
    null;
  const conf = Number(cfg?.conf_level);
  const nSim = Number(cfg?.n_simulations);
  if (Number.isFinite(conf) && Number.isFinite(nSim) && nSim > 0) {
    return Math.floor((1 - conf) * nSim);
  }
  return 10;
}

// Ziel-Quantil des VaR in Prozent (= conf_level * 100, Default 99.9). Der VaR-Balken
// in den Charts liegt am Quantil, das dem Konfidenzniveau am naechsten ist.
function getRunConfQuantil() {
  const configs = appState.getCvarInput?.() || [];
  const selName = document.querySelector('.cvar-radio:checked')?.dataset?.name;
  const cfg =
    (selName && configs.find(c => String(c.name) === String(selName))) ||
    configs.find(c => Number(c.is_active) === 1) ||
    configs[configs.length - 1] ||
    null;
  const conf = Number(cfg?.conf_level);
  return (Number.isFinite(conf) && conf > 0 && conf < 1) ? conf * 100 : 99.9;
}

// Index des Wertes in values, der target am naechsten ist (fuer die Balken-Markierung).
function closestIndex(values, target) {
  let idx = -1;
  let best = Infinity;
  values.forEach((v, i) => {
    const d = Math.abs(Number(v) - target);
    if (d < best) { best = d; idx = i; }
  });
  return idx;
}

// Summe der NAV eines Portfolios aus dem EAD-Store (pro pd_flag dupliziert ->
// auf ein Flag filtern). Fuer die Umrechnung der Verluste in % vom NAV. Fallback 1.
export function sumNavForPort(port) {
  const rows = (appState.getAllEADData?.() || []).filter(
    (r) => String(r.port_name) === String(port) && String(r.pd_flag).toUpperCase() === 'RATING'
  );
  const s = rows.reduce((acc, r) => acc + Number(r.NAV || 0), 0);
  return s > 0 ? s : 1;
}

export function handleLossIssuerMainData(receivedData) {
  //console.log('LossIssuer receivedData:', receivedData);

  const port_name = appState.getSelectedPortTableName();
  //console.log('port_name:', port_name);

  const typeMap = {
    'RATING': {
      dataContainerId: 'LossIssuerDataContainerRating',
      chartId: 'LossIssuerChartRating',
      tableName: 'sortedLossesIssuerMain'
    },
    'MARKET': {
      dataContainerId: 'LossIssuerDataContainerMarket',
      chartId: 'LossIssuerChartMarket',
      tableName: 'sortedLossesIssuerMain'
    },
    'NORM': {
      dataContainerId: 'LossIssuerDataContainerMarketNorm',
      chartId: 'LossIssuerChartMarketNorm',
      tableName: 'sortedLossesIssuerMain'
    }
  };

  // Schleife Ã¼ber alle Typen
  Object.entries(typeMap).forEach(([pdFlag, config]) => {
    const { dataContainerId, tableName } = config;

    const filteredData = receivedData.filter(
      row => row.port_name === port_name && row.pd_flag === pdFlag
    );
    if (filteredData.length === 0) return;

    const sortedData = processAndSortLossIssuerData(filteredData);

    // Chart-Daten IMMER setzen (die 3 Serien der kombinierten Chart, siehe
    // createCombinedLossesChart -> 'LossIssuerChartCombinedTop'). Unabhaengig davon,
    // ob die (inzwischen entfernten) Roh-Tabellen im DOM existieren.
    if (pdFlag === 'RATING') {
      ratingData = sortedData;
    } else if (pdFlag === 'MARKET') {
      marketData = sortedData;
    } else if (pdFlag === 'NORM') {
      marketNormData = sortedData;
    }

    // Optionale Tabellen-Anzeige: nur, falls der Container (noch) existiert.
    const LossIssuerDataContainer = document.getElementById(dataContainerId);
    if (LossIssuerDataContainer) {
      LossIssuerDataContainer.innerHTML = processData(sortedData, tableName);
      // VaR-Zeile markieren = Backend CVaR = df.iloc[var_index].
      const varIndex = getRunVarIndex();
      const dataRows = LossIssuerDataContainer.querySelectorAll('tbody tr');
      if (dataRows.length > varIndex) {
        dataRows[varIndex].classList.add('highlight');
      }
    }
  });

  // Kombinierte Charts nur erstellen, wenn alle drei da sind
  if (ratingData.length > 0 && marketData.length > 0 && marketNormData.length > 0) {
    // Rating/Market/Norm Losses in EINER horizontalen Balkenchart (gleicher Stil
    // wie die früheren Einzelcharts), als 3 farbige Serien.
    createCombinedLossesChart(ratingData, marketData, marketNormData, 'LossIssuerChartCombinedTop');

    createCombinedLossIssuerChart(ratingData, marketData, marketNormData, 'LossIssuerCombinedChart');
    createCombinedLossIssuerESChart(ratingData, marketData, marketNormData, 'LossIssuerCombinedESChart');

    // Loss-Histogramm mit-rendern: hier ist der Port garantiert gesetzt (die Loss-
    // Charts wurden gerade fuer diesen Port gerendert) -> loest das Timing-Problem
    // beim Reload (Histogramm-Daten da, aber port_name noch nicht gesetzt).
    try { renderLossHistogram(); } catch (_) {}

    const fetchRatingData = () => new Promise(resolve => {
      setTimeout(() => resolve(ratingData), 1000);
    });

    const fetchNormData = () => new Promise(resolve => {
      setTimeout(() => resolve(marketNormData), 2000);
    });

    Promise.all([fetchRatingData(), fetchNormData()]).then(([ratingData, marketNormData]) => {
      const extractedRatingLosses = ratingData.map(item => item.LOSS || 0);
      const extractedNormLosses = marketNormData.map(item => item.LOSS || 0);
      
    });
  }
}






export function setupLossIssuerUI() {
  const show = (id) => {
    const el = document.getElementById(id);
    if (!el) return;
    
    el.style.removeProperty('display');
    // Falls im HTML das hidden-Attribut gesetzt ist
    if (el.hasAttribute('hidden')) el.removeAttribute('hidden');
    // Safety: trotzdem sichtbar erzwingen
    el.style.display = 'block';
  };

  // LEFT (Tabellen)
  [
    'EADDataContainer',
  ].forEach(show);

  // RIGHT (Charts)
  [
    // 'EADChartContainer',
    'LGDChartContainer',
    // Rating/Market/Norm Losses zusammengefasst in einer Chart
    'LossIssuerChartContainerCombined',
    // kombinierte Charts (falls eigene Container vorhanden sind)
    'LossIssuerCombinedChartContainer',
    'LossIssuerCombinedESChartContainer',
  ].forEach(show);

  // Falls du die kombinierten Charts ohne extra Container direkt per Canvas-ID hast:
  show('LossIssuerCombinedChart');
  show('LossIssuerCombinedESChart');

  // KEINE Button-Events mehr, kein Umschalten
}
    function processAndSortLossIssuerData(receivedData) {
      let columns = ['QUANTIL', 'DEFAULTS', 'ISSUER_RANK', 'LOSS'];
      let filteredData = filterColumnsInData(receivedData, columns);

      // Sort the data
      return filteredData;
    }
    function createLossIssuerChart(data, chartId, type) {
      // Destroy the old chart if it exists
      if (window[chartId] && typeof window[chartId].destroy === 'function') {
        window[chartId].destroy();
      }

      // Limit the data to the first 15 rows
      const limitedData = data.slice(0, 15);
      const labels = limitedData.map(d => d.DEFAULTS);
      const values = limitedData.map(d => d.LOSS);

      // Set the color based on the type ('rating' = blue, 'market' = orange, 'norm' = green)
      let barColor;
      if (type === 'market') {
        barColor = 'rgba(255, 165, 0, 0.7)'; // Orange
      } else if (type === 'norm') {
        barColor = 'rgba(144, 238, 144, 0.7)'; // Light Green (semi-transparent)
      } else {
        barColor = 'rgba(70, 192, 230, 0.7)'; // Blue for Rating
      }

      // Create color array and highlight the 10th bar in red
      const barColors = limitedData.map((_, index) => 
        index === 9 ? '#ff6666' : barColor
      );

      // Create the new chart and store it in `window`
      window[chartId] = createBarChart({ 
        labels: labels, 
        datasets: [{ 
          label: type === 'market' ? 'Market Losses' : type === 'norm' ? 'Market adjusted Losses' : 'Historic Losses',
          data: values, 
          backgroundColor: barColors, 
          borderColor: barColors 
        }]
      }, chartId, 'bar', 'y');
    }

    // Rating + Market + Norm Losses in EINER horizontalen Balkenchart (3 Serien).
    // Gleicher Stil/Helper wie createLossIssuerChart (createBarChart, indexAxis 'y').
    // Achse = QUANTIL (bei allen pd_flags identisch); erste 15 Zeilen.
    //
    // createBarChart ist responsive:false und snapshottet die Canvas-Größe beim
    // Erstellen. Wird die Chart gezeichnet, bevor der Container seine endgültige
    // Höhe hat (Panel-Open/Layout), bleibt sie zu klein. Daher: per ResizeObserver
    // neu zeichnen, sobald der Container seine Maße ändert -> füllt die Karte.
    function createCombinedLossesChart(ratingData, marketData, marketNormData, chartId) {
      const canvas = document.getElementById(chartId);
      if (!canvas) return;
      const host = canvas.parentNode;

      const render = () => {
        if (window[chartId] && typeof window[chartId].destroy === 'function') {
          try { window[chartId].destroy(); } catch (e) {}
        }

        // Alle Zeilen (nicht nur 15) -> Chart scrollt (feste Kartenhoehe via CSS,
        // Canvas-Hoehe unten je Zeile). baseQuantils = Lookup-Schluessel; labels =
        // Anzeige mit Zeilennummer VORNE, per " | " von der Wahrscheinlichkeit getrennt.
        const base = (ratingData.length ? ratingData : marketData);
        const baseQuantils = base.map(d => d.QUANTIL);
        const labels = base.map((d, i) => `${i + 1}  |  ${Number(d.QUANTIL).toFixed(2)}`);

        const lossByQuantil = (rows) => {
          const m = new Map((rows || []).map(r => [r.QUANTIL, r.LOSS]));
          return baseQuantils.map(q => m.get(q) ?? 0);
        };

        // Drill-Schritte je Serie (Historic/Market/Norm): pro Balken (Quantil) der
        // ausfallende Emittent aus ISSUER_RANK. Beim Hover/Klick wird die zur Serie
        // passende Steps-Liste ueber els[0].datasetIndex gewaehlt.
        const stepsFor = (rows) => {
          const m = new Map((rows || []).map(r => [r.QUANTIL, r.ISSUER_RANK]));
          return baseQuantils.map(q => lossDefaultStep(issuersFromRank(m.get(q))));
        };
        const stepsByDs = [stepsFor(ratingData), stepsFor(marketData), stepsFor(marketNormData)];

        // Anzahl Defaults je Serie/Balken (DEFAULTS), fuer die Beschriftung im Balken.
        const defaultsFor = (rows) => {
          const m = new Map((rows || []).map(r => [r.QUANTIL, r.DEFAULTS]));
          return baseQuantils.map(q => m.get(q));
        };
        const defaultsByDs = [defaultsFor(ratingData), defaultsFor(marketData), defaultsFor(marketNormData)];

        // VaR-Balken (Quantil am naechsten zum Konfidenzniveau) rot einfaerben.
        const varIdx = closestIndex(baseQuantils, getRunConfQuantil());
        const VAR_RED = 'rgba(255, 0, 0, 0.9)';
        const colorsFor = (col) => baseQuantils.map((_, i) => (i === varIdx ? VAR_RED : col));
        try {
          // Nur Positionen des aktuell gewaehlten Portfolios: getAllPortfolioData()
          // enthaelt ALLE Portfolios, die Drill-Engine filtert aber nur nach ISSUER.
          // Ohne Port-Filter wuerde dasselbe Papier je haltendem Portfolio erscheinen.
          const selPort = String(appState.getSelectedPortTableName?.() ?? '').trim();
          const portRows = (appState.getAllPortfolioData?.() || [])
            .filter(r => String(r?.port_name ?? r?.PORT_NAME ?? '').trim() === selPort);
          lossIssuerDrill.setData(buildPositionLoss(portRows, selPort));
        } catch (e) { console.warn('[CVaR LossIssuer] drill data failed', e); }
        bindLossCanvasLeaveHide(canvas);

        // Direkt mit new Chart() (statt createBarChart), damit die Legende klickbar
        // ist: createBarChart setzt events:[] -> Serien ließen sich nicht aus-/
        // einblenden. Sonst identische Optionen (responsive:false, indexAxis 'y').
        const cv = document.getElementById(chartId);
        if (!cv || !cv.isConnected || !cv.parentNode) return;

        const existing = (typeof Chart !== 'undefined' && Chart.getChart) ? Chart.getChart(cv) : null;
        if (existing) { try { existing.destroy(); } catch (e) {} }

        // Canvas-Groesse (responsive:false): Breite = Container-Innenbreite; Hoehe =
        // je Zeile ein fester Betrag -> bei vielen Zeilen wird das Canvas hoeher als
        // die Karte, die Karte scrollt (overflow-y in CSS). Chart wird NICHT groesser.
        const PER_ROW = 40;
        const padX = 24; // .chart-container-inner padding links+rechts
        const contentW = Math.max(320, Math.floor((cv.parentNode.clientWidth || 800) - padX));
        cv.width = contentW;
        cv.height = Math.max(200, base.length * PER_ROW + 50);

        // colors = Balkenfarben-Array (VaR-Balken rot); legendColor = Basis-Serienfarbe
        // fuer die HTML-Legende (Balken-Array taugt dort nicht).
        const mkDs = (label, data, colors, legendColor) => ({
          label, data,
          backgroundColor: colors,
          borderColor: colors,
          maxBarThickness: 64,
          _legendColor: legendColor,
        });

        // Fuer die relative Beschriftung (Loss in % vom NAV) — gleiche Basis wie die
        // uebrigen CVaR-Charts.
        const sumNav = sumNavForPort(appState.getSelectedPortTableName?.());
        const bodyCss = getComputedStyle(document.body);
        const labelColor = (bodyCss.getPropertyValue('--text-primary') || '').trim() || '#ddd';

        window[chartId] = new Chart(cv.getContext('2d'), {
          type: 'bar',
          plugins: window.ChartDataLabels ? [window.ChartDataLabels] : [],
          data: {
            labels,
            datasets: [
              mkDs('Historic Losses', lossByQuantil(ratingData), colorsFor(getColorFromPalette(0, 0.7)), getColorFromPalette(0, 0.7)),
              mkDs('Market Losses', lossByQuantil(marketData), colorsFor(getColorFromPalette(1, 0.7)), getColorFromPalette(1, 0.7)),
              mkDs('Market adjusted Losses', lossByQuantil(marketNormData), colorsFor(getColorFromPalette(2, 0.7)), getColorFromPalette(2, 0.7)),
            ],
          },
          options: {
            responsive: false,
            maintainAspectRatio: false,
            indexAxis: 'y',
            animation: false,
            normalized: true,
            // Platz rechts fuer die Wert-Labels neben den Balken.
            layout: { padding: { right: 96 } },
            // 'click' -> Legende (Serien aus-/einblenden) + Balken-Drill; 'mousemove'/
            // 'mouseout' -> Hover-Menue. Steps je Serie ueber datasetIndex waehlen.
            events: ['mousemove', 'mouseout', 'click'],
            onHover: (evt, els) => {
              try {
                const ds = els && els.length ? (els[0].datasetIndex ?? 0) : 0;
                lossIssuerDrill.hover('var', evt, els, stepsByDs[ds] || stepsByDs[0]);
              } catch {}
            },
            onClick: (evt, els) => {
              try {
                const ds = els && els.length ? (els[0].datasetIndex ?? 0) : 0;
                lossIssuerDrill.click('var', els, stepsByDs[ds] || stepsByDs[0]);
              } catch {}
            },
            plugins: {
              // Canvas-Legende aus: eine sticky HTML-Legende (renderChartLegend) bleibt
              // beim Scrollen sichtbar (die Canvas-Legende wuerde mit wegscrollen).
              legend: { display: false },
              annotation: false,
              // Zwei Beschriftungen je Balken: Wert (abs kompakt + rel % NAV) rechts
              // aussen, Anzahl Defaults mittig im Balken.
              datalabels: window.ChartDataLabels ? {
                labels: {
                  value: {
                    anchor: 'end', align: 'right', clamp: true,
                    color: labelColor,
                    font: { size: 10 },
                    formatter: (value) => {
                      const v = Number(value) || 0;
                      if (!v) return '';
                      const rel = sumNav > 0 ? (v / sumNav * 100) : 0;
                      return `${_fmtLossCompact.format(v)} · ${rel.toFixed(1)}%`;
                    },
                  },
                  defaults: {
                    // Am Balkenanfang (x=0) -> alle Zahlen in einer Flucht, links.
                    anchor: 'start', align: 'right', offset: 2, clamp: true,
                    color: '#fff',
                    font: { size: 10, weight: 'bold' },
                    formatter: (value, ctx) => {
                      if (!(Number(value) > 0)) return '';
                      const n = Number(defaultsByDs[ctx.datasetIndex]?.[ctx.dataIndex]);
                      return Number.isFinite(n) && n > 0 ? String(n) : '';
                    },
                  },
                },
              } : undefined,
            },
            scales: {
              y: { beginAtZero: true, ticks: { autoSkip: false } },
              x: { beginAtZero: true, grace: '5%' },
            },
          },
        });

        // Sticky HTML-Legende (bleibt beim Scrollen sichtbar) aus den Serien aufbauen.
        try { renderChartLegend(window[chartId], document.getElementById('clossChartLegend')); } catch {}
      };

      // Immer die aktuelle Render-Funktion (frische Daten) am Container hinterlegen.
      if (host) host.__lossComboRender = render;

      render();

      // Einmaliger ResizeObserver pro Container: bei Größenänderung neu zeichnen,
      // damit die Chart die Karte korrekt ausfüllt (auch nach Panel-Open).
      if (host && !host.__lossComboRO && typeof ResizeObserver !== 'undefined') {
        host.__lossComboRO = true;
        let lastH = 0;
        const ro = new ResizeObserver(() => {
          const h = host.getBoundingClientRect().height;
          if (h > 5 && Math.abs(h - lastH) > 8) {
            lastH = h;
            host.__lossComboRender?.();
          }
        });
        ro.observe(host);
      }
    }
    //VaR
    function createCombinedLossIssuerChart(ratingData, marketData, marketNormData, chartId) {
      if (!window.charts) window.charts = {}; 
      if (window.charts[chartId] && typeof window.charts[chartId].destroy === 'function') {
        window.charts[chartId].destroy();
      }

      const chartElement = document.getElementById(chartId);
      if (!chartElement) {
        console.error(`Chart element with ID "${chartId}" not found.`);
        return; 
      }

      // Combine the QUANTIL labels from all datasets (remove duplicates)
      const allConvIValues = Array.from(new Set([
        ...ratingData.map(d => d.QUANTIL), 
        ...marketData.map(d => d.QUANTIL),
        ...marketNormData.map(d => d.QUANTIL)
      ])).sort((a, b) => a - b);

      // Map the LOSS and ISSUER_RANK for each QUANTIL in all datasets
      const sumNav = sumNavForPort(appState.getSelectedPortTableName?.());
      const ratingValues = allConvIValues.map(convI => {
        const found = ratingData.find(d => d.QUANTIL === convI);
        return found ? (Number(found.LOSS) / sumNav) * 100 : 0; 
      });

      const marketValues = allConvIValues.map(convI => {
        const found = marketData.find(d => d.QUANTIL === convI);
        return found ? (Number(found.LOSS) / sumNav) * 100 : 0; 
      });

      const marketNormValues = allConvIValues.map(convI => {
        const found = marketNormData.find(d => d.QUANTIL === convI);
        return found ? (Number(found.LOSS) / sumNav) * 100 : 0; 
      });

      const issuerRanksRating = allConvIValues.map(convI => {
        const found = ratingData.find(d => d.QUANTIL === convI);
        return found ? found.ISSUER_RANK : 'N/A';
      });

      const issuerRanksMarket = allConvIValues.map(convI => {
        const found = marketData.find(d => d.QUANTIL === convI);
        return found ? found.ISSUER_RANK : 'N/A';
      });

      const issuerRanksMarketNorm = allConvIValues.map(convI => {
        const found = marketNormData.find(d => d.QUANTIL === convI);
        return found ? found.ISSUER_RANK : 'N/A';
      });

      // Colors for the chart bars
      const highlightColor = 'rgba(255, 0, 0, 0.9)'; // Red for highlight
      const defaultRatingColor = getColorFromPalette(0, 0.7); // Historic (Palette-Blau)
      const defaultMarketColor = getColorFromPalette(1, 0.7); // Market (Palette-Orange)
      const defaultMarketNormColor = getColorFromPalette(2, 0.7); // Market adjusted (Palette-Grün)

      // VaR-Balken = Quantil am naechsten zum Konfidenzniveau (statt exaktem ===99.9,
      // das seit der 6-stelligen QUANTIL-Praezision nie mehr traf).
      const varIdx = closestIndex(allConvIValues, getRunConfQuantil());
      const ratingBarColors = allConvIValues.map((_, i) => i === varIdx ? highlightColor : defaultRatingColor);
      const marketBarColors = allConvIValues.map((_, i) => i === varIdx ? highlightColor : defaultMarketColor);
      const marketNormBarColors = allConvIValues.map((_, i) => i === varIdx ? highlightColor : defaultMarketNormColor);

      // Create the new chart with 3 datasets
      window.charts[chartId] = new Chart(chartElement.getContext('2d'), {
        type: 'bar',
        data: { 
          labels: allConvIValues.map(v => Number(v).toFixed(2)),
          datasets: [
            { 
              label: 'Historic Loss',
              data: ratingValues, 
              backgroundColor: ratingBarColors, 
              borderColor: ratingBarColors, 
            },
            {
              label: 'Market Loss',
              data: marketValues,
              backgroundColor: marketBarColors,
              borderColor: marketBarColors,
              hidden: true,   // initial ausgeblendet (per Legende einblendbar)
            },
            {
              label: 'Market adjusted Loss',
              data: marketNormValues,
              backgroundColor: marketNormBarColors,
              borderColor: marketNormBarColors,
              hidden: true,   // initial ausgeblendet (per Legende einblendbar)
            }
          ]
        },
        options: {
          responsive: true,            // â¬…ï¸ deaktiviert automatisches Anpassen
          maintainAspectRatio: false,   // â¬…ï¸ erlaubt, Breite/HÃ¶he frei zu setzen
          indexAxis: 'x', 
          scales: {
            x: {
              reverse: true, 
              title: {
                display: true,
                text: 'QUANTIL'
              },
            },
            y: {
              title: {
                display: true,
                text: 'Loss (% of NAV)'
              }
            }
          },
          plugins: {
            legend: {
              position: 'right',
              labels: {
                boxWidth: 12, padding: 8, font: { size: 12 },
                // Zusatz-Eintrag "VaR" (rot) unter den 3 Serien-Labels.
                generateLabels: (chart) => {
                  const items = Chart.defaults.plugins.legend.labels.generateLabels(chart);
                  items.push({ text: 'VaR', fillStyle: 'rgba(255,0,0,0.9)', strokeStyle: 'rgba(255,0,0,0.9)', lineWidth: 0, hidden: false, datasetIndex: -1 });
                  return items;
                },
              },
              onClick: (e, item, legend) => {
                if (item.datasetIndex == null || item.datasetIndex < 0) return; // Pseudo-Eintrag "VaR"
                Chart.defaults.plugins.legend.onClick(e, item, legend);
              },
            },
            zoom: {
              pan: {
                enabled: true,
                mode: 'x',
              },
              zoom: {
                drag: {
                  enabled: true
                },
                wheel: {
                  enabled: true,
                },
                pinch: {
                  enabled: true,
                },
                mode: 'x',
                onZoomComplete: ({chart}) => {
                  const minIndex = chart.scales.x.min;
                  const maxIndex = chart.scales.x.max;

                  const fullRangeMin = 0;
                  const fullRangeMax = allConvIValues.length// - 1;

                  if (minIndex === fullRangeMin && maxIndex === fullRangeMax) {
                    // console.log('Already at full zoom-out, no further action.');
                    return; 
                  }

                  if ((maxIndex - minIndex) < 0) {
                    chart.resetZoom();
                  }

                  // console.log('Zoom Complete:', minIndex, maxIndex);
                }
              },
              limits: {
                x: { 
                  min: 0, 
                  max: allConvIValues.length// - 1, 
                },
                y: { 
                  min: 0 
                }
              },
            },
            tooltip: {
              callbacks: {
                title: (context) => {
                  const index = context[0].dataIndex;
                  return `QUANTIL: ${allConvIValues[index]}`;
                },
                label: (context) => {
                  const index = context.dataIndex;
                  const datasetLabel = context.dataset.label;

                  const lossValue = `${Number(context.raw).toFixed(2)} %`;

                  let issuerRank = 'N/A';
                  if (context.datasetIndex === 0) {
                    issuerRank = issuerRanksRating[index];
                  } else if (context.datasetIndex === 1) {
                    issuerRank = issuerRanksMarket[index];
                  } else if (context.datasetIndex === 2) {
                    issuerRank = issuerRanksMarketNorm[index];
                  }

                  return `${datasetLabel}: ${lossValue}, Issuer: ${issuerRank}`;
                }
              }
            }
          }
        }
      });
    }
    //ES
    function createCombinedLossIssuerESChart(ratingData, marketData, marketNormData, chartId) {
      if (!window.charts) window.charts = {}; 
      if (window.charts[chartId] && typeof window.charts[chartId].destroy === 'function') {
        window.charts[chartId].destroy();
      }

      const chartElement = document.getElementById(chartId);
      if (!chartElement) {
        console.error(`Chart element with ID "${chartId}" not found.`);
        return; 
      }

      // Detail-Tail = ab dem VaR-Quantil (99.90) bis zum Maximum (schlimmster Verlust).
      // Frueher zusaetzlich `<= 99.99` -> schnitt bei >10k Sims die obersten Zeilen
      // (Quantil 99.99x, hoechster Balken) ab. Obere Grenze daher entfernt.
      const allConvIValues = Array.from(new Set([
        ...ratingData.map(d => d.QUANTIL),
        ...marketData.map(d => d.QUANTIL),
        ...marketNormData.map(d => d.QUANTIL)
      ])).filter(convI => convI >= 99.90).sort((a, b) => a - b);

      // Map the LOSS and ISSUER_RANK for each QUANTIL in all datasets
      const sumNav = sumNavForPort(appState.getSelectedPortTableName?.());
      const ratingValues = allConvIValues.map(convI => {
        const found = ratingData.find(d => d.QUANTIL === convI);
        return found ? (Number(found.LOSS) / sumNav) * 100 : 0; 
      });

      const marketValues = allConvIValues.map(convI => {
        const found = marketData.find(d => d.QUANTIL === convI);
        return found ? (Number(found.LOSS) / sumNav) * 100 : 0; 
      });

      const marketNormValues = allConvIValues.map(convI => {
        const found = marketNormData.find(d => d.QUANTIL === convI);
        return found ? (Number(found.LOSS) / sumNav) * 100 : 0; 
      });

      const issuerRanksRating = allConvIValues.map(convI => {
        const found = ratingData.find(d => d.QUANTIL === convI);
        return found ? found.ISSUER_RANK : 'N/A';
      });

      const issuerRanksMarket = allConvIValues.map(convI => {
        const found = marketData.find(d => d.QUANTIL === convI);
        return found ? found.ISSUER_RANK : 'N/A';
      });

      const issuerRanksMarketNorm = allConvIValues.map(convI => {
        const found = marketNormData.find(d => d.QUANTIL === convI);
        return found ? found.ISSUER_RANK : 'N/A';
      });

      // Expected Shortfall = Mittelwert des GESAMTEN dargestellten Tails
      // (= schlechteste var_index Szenarien, quantil >= VaR-Quantil) — dieselbe
      // Datenbasis, aus der das Backend den ES bildet. Frueher slice(0,10) -> die
      // KLEINSTEN Tail-Verluste (nahe VaR) -> Linie ~2x zu tief und n-abhaengig.
      const calculateAverage = (values) => {
        const tail = values.filter(v => Number.isFinite(Number(v)) && Number(v) > 0);
        if (!tail.length) return 0;
        return tail.reduce((acc, v) => acc + Number(v), 0) / tail.length;
      };

      const averageRating = calculateAverage(ratingValues);
      const averageMarket = calculateAverage(marketValues);
      const averageMarketNorm = calculateAverage(marketNormValues);

      // Colors for the chart bars
      const highlightColor1 = 'rgba(255, 0, 0, 0.9)'; // Red for highlight 1
      const highlightColor2 = 'rgba(200, 0, 0, 0.9)'; // Darker Red for highlight 2
      const highlightColor3 = 'rgba(150, 0, 0, 0.9)'; // Even Darker Red for highlight 3
      const defaultRatingColor = getColorFromPalette(0, 0.7); // Historic (Palette-Blau)
      const defaultMarketColor = getColorFromPalette(1, 0.7); // Market (Palette-Orange)
      const defaultMarketNormColor = getColorFromPalette(2, 0.7); // Market adjusted (Palette-Grün)

      // VaR-Balken = Quantil am naechsten zum Konfidenzniveau (robust gegen die
      // 6-stellige QUANTIL-Praezision und beliebiges n_simulations).
      const varIdx = closestIndex(allConvIValues, getRunConfQuantil());
      const ratingBarColors = allConvIValues.map((_, i) => i === varIdx ? highlightColor1 : defaultRatingColor);
      const marketBarColors = allConvIValues.map((_, i) => i === varIdx ? highlightColor2 : defaultMarketColor);
      const marketNormBarColors = allConvIValues.map((_, i) => i === varIdx ? highlightColor3 : defaultMarketNormColor);

      // Create the new chart with 3 datasets
      window.charts[chartId] = new Chart(chartElement.getContext('2d'), {
        type: 'bar',
        data: { 
          labels: allConvIValues.map(v => Number(v).toFixed(2)),
          datasets: [
            { 
              label: 'Historic VaR',
              data: ratingValues, 
              backgroundColor: ratingBarColors, 
              borderColor: ratingBarColors, 
              borderWidth: 1,
              borderDash: [5, 5],
            },
            { 
              label: 'Market VaR',
              data: marketValues,
              backgroundColor: marketBarColors,
              borderColor: marketBarColors,
              borderWidth: 1,
              borderDash: [10, 5],
              hidden: true,
            },
            { 
              label: 'Market adjusted VaR',
              data: marketNormValues,
              backgroundColor: marketNormBarColors,
              borderColor: marketNormBarColors,
              borderWidth: 1,
              borderDash: [2, 2],
              hidden: true,
            },
            {
              label: 'Historic ES',
              data: Array(allConvIValues.length).fill(averageRating),
              type: 'line',
              borderColor: defaultRatingColor,
              borderDash: [5, 5],
              borderWidth: 2,
              fill: false,
            },
            {
              label: 'Market ES',
              data: Array(allConvIValues.length).fill(averageMarket),
              type: 'line',
              borderColor: defaultMarketColor,
              borderDash: [5, 5],
              borderWidth: 2,
              fill: false,
              hidden: true,
            },
            {
              label: 'Market adjusted ES',
              data: Array(allConvIValues.length).fill(averageMarketNorm),
              type: 'line',
              borderColor: defaultMarketNormColor,
              borderDash: [5, 5],
              borderWidth: 2,
              fill: false,
              hidden: true,
            }
          ] 
        }, 
        options: {
          responsive: true,
          maintainAspectRatio: false,   // CSS fixiert die Canvas-Hoehe -> kein Seitenverhaeltnis, sonst Klick-Versatz in der Legende
          indexAxis: 'x',
          scales: {
            x: {
              reverse: true, 
              title: {
                display: true,
                text: 'QUANTIL'
              },
            },
            y: {
              title: {
                display: true,
                text: 'Loss (% of NAV)'
              }
            }
          },
          plugins: {
            legend: {
              position: 'right',
              labels: { boxWidth: 12, padding: 8, font: { size: 12 } },
            },
            zoom: {
              pan: {
                enabled: true, 
                mode: 'x', 
              },
              zoom: {
                drag: {
                  enabled: true 
                },
                wheel: {
                  enabled: true, 
                },
                pinch: {
                  enabled: true, 
                },
                mode: 'x'
              },
              limits: {
                x: { 
                  min: 0, 
                  max: allConvIValues.length - 1, 
                },
                y: { 
                  min: 0 
                }
              },
            },
            tooltip: {
              callbacks: {
                title: (context) => `QUANTIL: ${allConvIValues[context[0].dataIndex]}`,
                label: (ctx) => `${ctx.dataset.label}: ${Number(ctx.parsed.y).toFixed(2)} %`,
              }
            }
          }
        }
      });
    }


















