import { filterColumnsInData } from '../../../core/ui/modal/modalData.js';
import processData from '../../../core/ui/modal/modalData.js';

import createBarChart from '../../../charts/BarChart.js';

import { formatNumber, isValidNumber, formatNumberWithCommas } from '../../../utils/tableCellFormats.js';
import { updateTrafficLight } from '../../../utils/trafficLight.js';
import { renderCreditRiskDashboard, renderCreditOverviewCharts, renderCreditTsiPanel, renderCreditMsdPanel } from './creditRiskDashboard.js';
import { renderHomeOverview } from '../../HOME/homeOverview.js';
import { appState } from '../../../renderer.js';
import { createContribDrill, scheduleHideConcMenu, bindRightClickDrill } from '../SummaryBreakdown.js';
import { renderChartLegend, sumNavForPort, _fmtLossCompact, buildPositionLoss, getRunConfQuantil, creditVarEsForFlag, setSelectedCreditConf, getSelectedCreditConf, refreshLossDistribution } from './LossIssuer.js';
import { crTailTopForFlag, tailConcentrationIndex } from './creditRiskDashboard.js';
import { getTileMode } from '../../CUSTOMER_SETUP/overviewTilesPanel.js';

// KPI-Betragsformat: kompakt (Tsd./Mio.) mit 2 Nachkommastellen (eigener Formatter,
// damit die geteilte Bar-/Tooltip-Formatierung _fmtLossCompact unveraendert bleibt).
const _fmtKpiCompact = new Intl.NumberFormat('de-DE', { notation: 'compact', minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Tail-Loss-Anteil der Top-3-Emittenten (%) fuer die Zusammenfassung — gleiche Logik wie
// das Tail-Panel (crTailTopForFlag). flag = 'RATING' (historic) bzw. 'NORM' (market adjusted).
function _top3TailShare(port, flag) {
  try {
    const portRows = (appState.getAllPortfolioData?.() || [])
      .filter((r) => String(r?.port_name ?? r?.PORT_NAME ?? '').trim() === port);
    if (!portRows.length) return NaN;
    const issuerLoss = new Map(), issuerRating = new Map();
    for (const r of buildPositionLoss(portRows, port)) {
      const name = String(r?.ISSUER ?? '').trim(); if (!name) continue;
      const key = name.toLowerCase();
      const cur = issuerLoss.get(key) || { name, loss: 0 };
      cur.loss += Number(r.__LOSS) || 0; issuerLoss.set(key, cur);
      if (!issuerRating.get(key)) issuerRating.set(key, '');
    }
    const allLoss = (appState.getAllLossData?.() || []).filter((r) => String(r?.port_name ?? '') === port);
    const top = crTailTopForFlag(flag, issuerLoss, issuerRating, allLoss, getRunConfQuantil());
    const s = top.slice(0, 3).reduce((a, b) => a + (Number(b.pct) || 0), 0);
    return (Number.isFinite(s) && s > 0) ? s : NaN;
  } catch { return NaN; }
}

// Drill-down fuer den EAD/LGD-Chart (Balken = Emittent -> dessen Positionen).
// Dieselbe Engine wie die Loss-/Market-Risk-Panels. Nur die 'var'-Schiene noetig;
// 'es' zeigt auf dieselben IDs und bleibt ungenutzt.
const _eadDrillCfg = {
  detailId: 'eadIssuerDetail', titleId: 'eadIssuerDetailTitle',
  tableId: 'eadIssuerDetailTable', closeId: 'eadIssuerDetailClose',
  menuId: 'eadIssuerCardMenu', valueType: 'NAV', valueLabel: 'NAV',
  // Positions-Tabelle wie der EAD-Data-Container: Rank/Rating/Notional/LGD/PD.
  columns: [
    { key: 'PROD_ID', label: 'Product ID' },
    { key: 'RANK', label: 'Rank' },
    { key: 'RATINGres', label: 'Rating' },
    { key: 'NOTIONAL', label: 'Notional', align: 'right', fmt: 'num' },
    { key: '__LGD', label: 'LGD', align: 'right', fmt: 'num' },
    { key: '__PD', label: 'PD-Historic', align: 'right', fmt: 'pct' },
    { key: '__PD_M', label: 'PD-MARKET', align: 'right', fmt: 'pct' },
    { key: '__PD_M_norm', label: 'PD-MARKET ADJUSTED', align: 'right', fmt: 'pct' },
  ],
};
const eadDrill = createContribDrill({ var: _eadDrillCfg, es: _eadDrillCfg });
function eadIssuerStep(name) {
  const s = String(name ?? '').trim();
  return s ? { colKey: 'ISSUER', value: s, label: 'Issuer' } : null;
}

// Positionen des Emittenten mit EAD-Feldern anreichern (je Emittent+Rang aus der
// EAD-Tabelle, pd_flag=RATING): LGD-Betrag je Position = NOTIONAL x LGD-Rate; PD/
// PD_M/PD_M_norm direkt uebernommen. Fuer die Drill-Spalten wie im EAD-Container.
function enrichEadDrillRows(portRows, port) {
  const info = new Map(); // "ISSUER||RANK" -> { rate, RATING, ead, PD, PD_M, PD_M_norm }
  for (const e of (appState.getAllEADData?.() || [])) {
    if (String(e?.port_name ?? '') !== String(port)) continue;
    if (String(e?.pd_flag ?? '').toUpperCase() !== 'RATING') continue;
    const notion = Number(e?.NOTIONAL);
    const lgd = Number(e?.LGD);
    const key = `${String(e?.ISSUER ?? '').trim().toLowerCase()}||${String(e?.RANK ?? '').trim().toLowerCase()}`;
    info.set(key, {
      rate: (Number.isFinite(notion) && notion > 0 && Number.isFinite(lgd)) ? lgd / notion : null,
      RATING: e?.RATING,
      ead: Number.isFinite(notion) ? notion : null, // Szenario-EAD (Gruppen-Total je Issuer,Rank)
      PD: e?.PD, PD_M: e?.PD_M, PD_M_norm: e?.PD_M_norm,
    });
  }
  // Basis-Notional-Summe je (Issuer,Rank) aus den Positionen -> um die Szenario-EAD
  // (Gruppen-Total) anteilig auf die einzelnen Positionen zu verteilen.
  const baseTotal = new Map();
  for (const r of (portRows || [])) {
    const key = `${String(r?.ISSUER ?? '').trim().toLowerCase()}||${String(r?.RANK ?? '').trim().toLowerCase()}`;
    const n = Number(r?.NOTIONAL);
    if (Number.isFinite(n)) baseTotal.set(key, (baseTotal.get(key) || 0) + n);
  }
  // Wenn EAD-Daten vorliegen, spiegelt info das AKTIVE Credit-Szenario (Include /
  // EAD / RR->LGD / RATINGres): Positionen ausgeschlossener (Issuer,Rank) sind NICHT
  // in info -> rausfiltern; Rating + EAD (anteilig) + LGD je Position aus dem Szenario.
  const hasEad = info.size > 0;
  return (portRows || []).map((r) => {
    const key = `${String(r?.ISSUER ?? '').trim().toLowerCase()}||${String(r?.RANK ?? '').trim().toLowerCase()}`;
    const inf = info.get(key);
    if (hasEad && !inf) return null; // (Issuer,Rank) nicht im Szenario -> ausgeschlossen
    const baseN = Number(r?.NOTIONAL);
    const gtot = baseTotal.get(key);
    // Positions-EAD = Basis-Notional skaliert, sodass die Gruppe die Szenario-EAD ergibt.
    let posEad = baseN;
    if (inf && Number.isFinite(inf.ead) && Number.isFinite(gtot) && gtot > 0 && Number.isFinite(baseN)) {
      posEad = baseN * (inf.ead / gtot);
    }
    const lgdAmt = (inf && Number.isFinite(inf.rate) && Number.isFinite(posEad)) ? posEad * inf.rate : null;
    const ratingRes = (inf && inf.RATING != null && String(inf.RATING).trim() !== '')
      ? inf.RATING
      : r?.RATINGres;
    return {
      ...r,
      NOTIONAL: posEad,
      RATINGres: ratingRes,
      __LGD: lgdAmt, __PD: inf?.PD, __PD_M: inf?.PD_M, __PD_M_norm: inf?.PD_M_norm,
    };
  }).filter(Boolean);
}
function bindEadCanvasLeaveHide(canvas) {
  if (!canvas || canvas.dataset.eadLeaveBound) return;
  canvas.dataset.eadLeaveBound = '1';
  canvas.addEventListener('mouseleave', () => { try { scheduleHideConcMenu(); } catch {} });
}

// "All issuers": rendert die EAD-Daten (filteredEADMainData, je Emittent+Rang) in das
// Drill-Fenster -> gleiche Tabelle wie der EAD-Container (erste Spalte ISSUER).
function renderEadAllIssuers() {
  const detail = document.getElementById('eadIssuerDetail');
  const titleEl = document.getElementById('eadIssuerDetailTitle');
  const tableEl = document.getElementById('eadIssuerDetailTable');
  if (!detail || !tableEl) return;
  const rows = Array.isArray(filteredEADMainData) ? filteredEADMainData : [];
  const cols = [
    { key: 'ISSUER', label: 'Issuer' },
    { key: 'RANK', label: 'Rank' },
    { key: 'RATING', label: 'Rating' },
    { key: 'NOTIONAL', label: 'Notional', align: 'right', fmt: 'num' },
    { key: 'LGD', label: 'LGD', align: 'right', fmt: 'num' },
    { key: 'PD', label: 'PD-Historic', align: 'right', fmt: 'pct' },
    { key: 'PD_M', label: 'PD-MARKET', align: 'right', fmt: 'pct' },
    { key: 'PD_M_norm', label: 'PD-MARKET ADJUSTED', align: 'right', fmt: 'pct' },
  ];
  const esc = (s) => String(s ?? '').replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
  const fmtCell = (r, col) => {
    const v = r[col.key];
    if (col.fmt === 'num') return Number.isFinite(Number(v)) ? Number(v).toLocaleString('de-DE', { maximumFractionDigits: 0 }) : '';
    if (col.fmt === 'pct') return Number.isFinite(Number(v)) ? `${(Number(v) * 100).toLocaleString('de-DE', { maximumFractionDigits: 4 })} %` : '';
    return v == null ? '' : String(v);
  };
  if (titleEl) titleEl.textContent = 'All issuers';
  tableEl.innerHTML = `
    <table class="conc-detail-tbl">
      <thead><tr>${cols.map(c => `<th${c.align === 'right' ? ' style="text-align:right;"' : ''}>${esc(c.label)}</th>`).join('')}</tr></thead>
      <tbody>${rows.map(r => `<tr>${cols.map(c => `<td${c.align === 'right' ? ' style="text-align:right;"' : ''}>${esc(fmtCell(r, c))}</td>`).join('')}</tr>`).join('')}</tbody>
    </table>`;
  detail.style.display = '';
  try { detail.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } catch {}
}




// === Modul-Scope ===
let LGDChart = null;
// dient als Cache fÃ¼r EAD/LDG-Daten des aktuellen Portfolios
let filteredEADMainData = [];


// Expected Loss (Profit/Loss-Panel, KPI oben) = Summe ueber die RATING-Zeilen des
// gewaehlten Portfolios von EAD x LGD-Rate x PD. Da die EAD-Spalte LGD bereits der
// LGD-BETRAG ist (= NOTIONAL x LGD-Rate = EAD x LGD-Rate), gilt EL = Summe(LGD x PD).
// Ein KPI-Set (Economic-Capital-Panel) je Variante. suffix '' = historic-PD-Panel (panel-credit),
// suffix 'M' = current-PD-Panel (panel-credit-current). opts.eadPdField = Spalte fuer PD (PD | PD_M),
// opts.cvarFlag = CreditVaR-Zeile (RATING | MARKET). EL = Summe(LGD-Betrag x PD),
// EDE = Summe(NOTIONAL x PD); Basis aus dem VaR abgeleitet (EL/EDE/EC-rel konsistent zur VaR-rel).
// Ampel-Status fuer Credit-VaR aus |VaR_rel| (Bruch) + Customer-CVaR-Schwellen: green < yellow,
// yellow < red, sonst red. Gleiche Logik wie trafficLightStateForCvar (ehem. CVaR-Tabelle).
function creditCvarStateForLevel(lossLevel) {
  const thrRaw = appState.getCustomerCreditRiskThreshold?.('CVAR');
  if (!thrRaw) return null;
  const thrObj = Array.isArray(thrRaw) ? (thrRaw.find((r) => r?.metric === 'CVaR') || thrRaw[0]) : thrRaw;
  let Y = Number(thrObj?.yellow_threshold), R = Number(thrObj?.red_threshold);
  if (!Number.isFinite(Y) || !Number.isFinite(R)) return null;
  if (Math.abs(Y) > 1 || Math.abs(R) > 1) { Y /= 100; R /= 100; }
  Y = Math.abs(Y); R = Math.abs(R);
  const lvl = Math.abs(Number(lossLevel));
  if (!Number.isFinite(lvl)) return null;
  if (lvl >= R) return 'red';
  if (lvl >= Y) return 'yellow';
  return 'green';
}

// Corner-Description der EC-Kachel: "Risk buffer <conf_level> <horizon>" aus der aktiven
// Credit-VaR-Config (CreditVaRInput). conf_level -> "99,00 %"; horizon_days -> Jahre
// (256 Handelstage = 1 Jahr in dieser Config), z.B. "1y".
function riskBufferDescFromConfig() {
  const configs = appState.getCvarInput?.() || [];
  const selName = document.querySelector('.cvar-radio:checked')?.dataset?.name;
  const cfg =
    (selName && configs.find((c) => String(c.name) === String(selName))) ||
    configs.find((c) => Number(c.is_active) === 1) ||
    configs[configs.length - 1] ||
    null;
  // Konfidenz aus dem gewaehlten Niveau (Dropdown) via getRunConfQuantil (respektiert das
  // Dropdown), Horizont weiter aus der Config.
  const q = getRunConfQuantil();
  const hDays = Number(cfg?.horizon_days);
  const confStr = (Number.isFinite(q) && q > 0)
    ? `${q.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %`
    : '';
  let hStr = '';
  if (Number.isFinite(hDays) && hDays > 0) {
    const years = hDays / 256;
    const yRound = Math.round(years);
    hStr = (Math.abs(years - yRound) < 0.05 && yRound >= 1)
      ? `${yRound}y`
      : `${years.toLocaleString('de-DE', { maximumFractionDigits: 1 })}y`;
  }
  return ['Risk buffer', confStr, hStr].filter(Boolean).join(' ');
}

function renderCreditKpiSet(port, suffix, opts, rowsOverride) {
  if (!document.getElementById('creditELBig' + suffix)) return;
  const eadRows = Array.isArray(rowsOverride) ? rowsOverride : (appState.getAllEADData?.() || []);
  let elSum = 0, elCnt = 0, edeSum = 0;
  for (const r of eadRows) {
    if (String(r?.port_name ?? '').trim() !== port) continue;
    if (String(r?.pd_flag ?? '').trim().toUpperCase() !== 'RATING') continue;   // Basiszeilen (haben PD + PD_M)
    const lgd = Number(r?.LGD), pd = Number(r?.[opts.eadPdField]), notion = Number(r?.NOTIONAL);
    if (Number.isFinite(lgd) && Number.isFinite(pd)) { elSum += lgd * pd; elCnt++; }
    if (Number.isFinite(notion) && Number.isFinite(pd)) edeSum += notion * pd;
  }
  // VaR/ES beim gewaehlten Konfidenzniveau aus der Verteilung neu berechnen (keine
  // Simulation). Ersetzt die gespeicherte CreditVaR-Zeile.
  const cvar = creditVarEsForFlag(port, opts.cvarFlag);
  const varAbs = Math.abs(Number(cvar?.VaR_abs));
  const varRel = Math.abs(Number(cvar?.VaR_rel));
  const esAbs = Math.abs(Number(cvar?.ES_abs));
  const esRel = Math.abs(Number(cvar?.ES_rel));
  const base = (Number.isFinite(varAbs) && Number.isFinite(varRel) && varRel > 0) ? varAbs / varRel : NaN;

  const haveEl = elCnt > 0, haveVar = Number.isFinite(varAbs), haveEs = Number.isFinite(esAbs);
  const elRel = (haveEl && Number.isFinite(base)) ? elSum / base : NaN;
  const edeRel = (haveEl && Number.isFinite(base)) ? edeSum / base : NaN;
  const ecAbs = (haveEl && haveVar) ? varAbs - elSum : NaN;
  const ecRel = (Number.isFinite(ecAbs) && Number.isFinite(base)) ? ecAbs / base : NaN;

  const fA = (x) => Number.isFinite(x) ? `EUR ${_fmtKpiCompact.format(x)}` : '–';
  const fR = (x) => Number.isFinite(x) ? `${(x * 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %` : '–';
  // Grosse Zahl = abs oder rel je nach Customer-Setup-Umschalter (getTileMode; Key ist metrik-,
  // nicht variantenspezifisch -> beide Panels teilen die Einstellung).
  const setKpi = (bigId, subId, key, absStr, relStr) => {
    const mode = (() => { try { return getTileMode(key); } catch { return 'abs'; } })();
    const big = document.getElementById(bigId), sub = document.getElementById(subId);
    if (big) big.textContent = mode === 'rel' ? relStr : absStr;
    if (sub) sub.textContent = mode === 'rel' ? absStr : relStr;
  };
  setKpi('creditELBig' + suffix,      'creditELSub' + suffix,      'credit_el',       haveEl ? fA(elSum) : '–', fR(elRel));
  setKpi('creditEDEBig' + suffix,     'creditEDESub' + suffix,     'credit_ede',      haveEl ? fA(edeSum) : '–', fR(edeRel));
  setKpi('creditVarHistBig' + suffix, 'creditVarHistSub' + suffix, 'credit_var_hist', haveVar ? fA(varAbs) : '–', fR(varRel));
  setKpi('creditESBig' + suffix,      'creditESSub' + suffix,      'credit_es',       haveEs ? fA(esAbs) : '–', fR(esRel));
  setKpi('creditECBig' + suffix,      'creditECSub' + suffix,      'credit_ec',       fA(ecAbs),               fR(ecRel));
  // EC-Kachel-Beschriftung dynamisch aus der Config: "Risk buffer 99,00 % 1y".
  const ecTile = document.getElementById('creditECBig' + suffix)?.closest('.conc-kpi[data-tile="credit_ec"]');
  if (ecTile) ecTile.setAttribute('data-desc', riskBufferDescFromConfig());
  // EDE zusaetzlich in die EL-Kachel — je Zeile in Klammern: Wert (Z1), rel (Z2), Name (Z3, statisch im HTML).
  const _emode = (() => { try { return getTileMode('credit_el'); } catch { return 'abs'; } })();
  const edeExtra = document.getElementById('creditELDE' + suffix);
  const edeExtraSub = document.getElementById('creditELDESub' + suffix);
  if (edeExtra) edeExtra.textContent = haveEl ? `(${_emode === 'rel' ? fR(edeRel) : fA(edeSum)})` : '';
  if (edeExtraSub) edeExtraSub.textContent = haveEl ? `(${_emode === 'rel' ? fA(edeSum) : fR(edeRel)})` : '';
  // Zusammenfassung als Bullet-Liste (je Panel aus dessen EC/VaR/ES-Werten), rechts neben/unter den KPIs.
  const summaryEl = document.getElementById('creditKpiSummary' + suffix);
  if (summaryEl) {
    if (haveEl && haveVar && haveEs) {
      // Konzentration (K = round(Effective Tail Drivers), Top-K-Anteil) — gleiche Quelle wie der Slider.
      const conc = tailConcentrationIndex();
      const K = (conc && Number.isFinite(conc.eff)) ? Math.max(1, Math.round(conc.eff)) : NaN;
      const topKShare = (conc && Array.isArray(conc.shares) && Number.isFinite(K))
        ? conc.shares.slice(0, K).reduce((a, b) => a + b, 0) : NaN;
      const f1 = (x) => x.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
      // rel/abs je Kennzahl nach dem Customer-Setup-Umschalter (wie die KPI-Kacheln).
      const em = (key) => { try { return getTileMode(key); } catch { return 'abs'; } };
      const vEl = em('credit_el')       === 'rel' ? fR(elRel) : fA(elSum);
      const vEc = em('credit_ec')       === 'rel' ? fR(ecRel) : fA(ecAbs);
      const vEs = em('credit_es')       === 'rel' ? fR(esRel) : fA(esAbs);
      const items = [
        `Reported expected loss remains low at ${vEl}.`,
        `Economic Capital provides a ${vEc} realistic risk buffer.`,
        `Average loss in extreme cases reaches ${vEs}.`,
        (Number.isFinite(K) && Number.isFinite(topKShare))
          ? `Tail risk is highly concentrated: ${K} issuers drive ${f1(topKShare)} % of tail losses.`
          : 'Tail risk concentration: n/a.',
      ];
      summaryEl.innerHTML = items.map((s) => `<li>${s}</li>`).join('');
    } else {
      summaryEl.innerHTML = '';
    }
  }
  // Ampel-Status (aus CVaR-Schwellen) als farbiger Punkt in der VaR-KPI (ersetzt die Tabelle).
  const cvarState = creditCvarStateForLevel(varRel);
  const dotEl = document.getElementById('creditVarDot' + suffix);
  if (dotEl) {
    const col = { green: '#2f9e5f', yellow: '#e0a533', red: '#d9534f' }[cvarState];
    if (col) { dotEl.hidden = false; dotEl.style.background = col; } else { dotEl.hidden = true; }
  }
  const m = document.getElementById('creditVarMethod' + suffix);
  if (m) m.textContent = opts.methodLabel;
}

// Konfidenz-Dropdowns (99,9/99,5/99,0) in BEIDEN Panels (Historic + Market adjusted):
// je Element gebunden, global synchron. Auswahl setzt das Niveau und rechnet VaR/EC/ES +
// Beschriftung + Loss-Chart neu (OHNE neue Simulation). EL bleibt.
const _CONF_SELECT_IDS = ['creditConfSelect', 'creditConfSelectM'];
function _bindCreditConfDropdown() {
  const curConf = getSelectedCreditConf() ?? (getRunConfQuantil() / 100);
  _CONF_SELECT_IDS.forEach((id) => {
    const sel = document.getElementById(id);
    if (!sel) return;
    if (!sel.__confBound) {
      sel.__confBound = true;
      sel.addEventListener('change', () => {
        setSelectedCreditConf(Number(sel.value));
        try { renderCreditExpectedLoss(); } catch {}         // KPI-Kacheln + EC-Beschriftung (spiegelt beide Dropdowns)
        try { renderCreditRiskDashboard(); } catch {}         // Limits/Concentration (confQ-abhaengig)
        try { renderCreditOverviewCharts(); } catch {}        // Loss-Dist-Chart + Tail-Contributors/TCM
        try { renderCreditTsiPanel(); } catch {}              // TSI-Panel (VaR/ES-Baender)
        try { renderCreditMsdPanel(); } catch {}              // MSD-Panel (VaR/ES-Baender)
        try { refreshLossDistribution(); } catch {}           // Trigger "Loss Distribution": VaR-Balken + Tail-Liste
        try { renderHomeOverview(); } catch {}                // HOME-Overview: Credit-Kachel + Concentration-Slider + Exec-Summary
      });
    }
    // Auf den aktuellen Wert spiegeln (float-sicher die naechstliegende Option waehlen).
    let bestOpt = null, bestD = Infinity;
    [...sel.options].forEach((o) => { const d = Math.abs(Number(o.value) - curConf); if (d < bestD) { bestD = d; bestOpt = o; } });
    if (bestOpt && sel.value !== bestOpt.value) sel.value = bestOpt.value;
  });
}

// Beide Varianten rendern: historic PD (panel-credit) + current PD/Market (panel-credit-current).
export function renderCreditExpectedLoss(rowsOverride) {
  const port = String(appState.getSelectedPortTableName?.() ?? '').trim();
  _bindCreditConfDropdown();
  renderCreditKpiSet(port, '',  { eadPdField: 'PD',   cvarFlag: 'RATING', methodLabel: 'Historic' }, rowsOverride);
  renderCreditKpiSet(port, 'M', { eadPdField: 'PD_M_norm', cvarFlag: 'NORM', methodLabel: 'Market adjusted' }, rowsOverride);
}

// Beim Oeffnen des Profit/Loss-Panels das KPI aus dem Store neu rechnen.
document.addEventListener('panel:opened', (e) => {
  const p = e?.detail?.panelId;
  if (p === 'panel-credit' || p === 'panel-credit-current') {
    try { renderCreditExpectedLoss(); } catch {}
    // Loss-Charts (crLossDistChart historic / crLossDistChartNorm market adjusted) rendern —
    // bei sichtbarem Panel, damit die Breite korrekt gemessen wird.
    try { renderCreditOverviewCharts(); } catch {}
  }
});

export function handleEADData(receivedData, index = 0, port_nameArg) {
  const port_name = String(
    port_nameArg ?? appState.getSelectedPortTableName?.() ?? ''
  ).trim();

  // âœ… If no portfolio selected: do nothing (no DOM, no chart, no warnings)
  if (!port_name) return;

  // Expected-Loss-KPI (Profit/Loss-Panel) aus den frischen EAD-Daten aktualisieren.
  try { renderCreditExpectedLoss(receivedData); } catch {}

  const EADDataContainer = document.getElementById('EADDataContainer');
  if (!EADDataContainer) return;

  // If payload missing/empty: clear UI + reset chart (quietly)
  if (!Array.isArray(receivedData) || receivedData.length === 0) {
    EADDataContainer.innerHTML = '';
    filteredEADMainData = [];
    try {
      if (LGDChart) {
        LGDChart.destroy();
        LGDChart = null;
      }
    } catch {}
    return;
  }

  // Filter: current portfolio + PD-Flag RATING
  const filtered = receivedData.filter(row =>
    row &&
    String(row.port_name ?? '').trim() === port_name &&
    String(row.pd_flag ?? '').trim().toUpperCase() === 'RATING'
  );

  if (filtered.length === 0) {
    EADDataContainer.innerHTML = '';
    filteredEADMainData = [];
    try {
      if (LGDChart) {
        LGDChart.destroy();
        LGDChart = null;
      }
    } catch {}
    return;
  }

  // Relevant columns
  const columns = ['ISSUER', 'RANK', 'RATING', 'NOTIONAL', 'LGD', 'PD', 'PD_M', 'PD_M_norm'];
  const eadColumnLabelMap = {
    ISSUER: 'ISSUER',
    RANK: 'RANK',
    RATING: 'RATING',
    NOTIONAL: 'NOTIONAL',
    LGD: 'LGD',
    PD: 'PD-Historic',
    PD_M: 'PD-Market Implied',
    PD_M_norm: 'PD-Risk Adjusted',
  };

  filteredEADMainData = filterColumnsInData(filtered, columns);

  // Sort by NOTIONAL (numeric) desc
  filteredEADMainData.sort(
    (a, b) =>
      parseFloat((b.NOTIONAL || '0').toString().replace(/\s/g, '')) -
      parseFloat((a.NOTIONAL || '0').toString().replace(/\s/g, ''))
  );

  // Render table
  const EADMainDataHTML = processData(filteredEADMainData, 'EAD', eadColumnLabelMap);
  EADDataContainer.innerHTML = EADMainDataHTML;

  // Render chart after update
  renderLGDChart();

  // Standardansicht: beim Laden/Oeffnen der Seite direkt die "All issuers"-Tabelle
  // (= EAD-Daten) im Drill-Fenster zeigen.
  try { renderEadAllIssuers(); } catch (e) { console.warn('[EAD] All-issuers default failed', e); }
}


export function renderLGDChart() {
  if (!filteredEADMainData || filteredEADMainData.length === 0) {
    console.warn('renderLGDChart: keine Daten in filteredEADMainData');
    return;
  }

  const canvasId = 'LGDChart';
  const canvas = document.getElementById(canvasId);

  if (!canvas) {
    console.warn(`renderLGDChart: Canvas mit ID ${canvasId} nicht gefunden`);
    return;
  }

  // Alten Chart VOR dem Resize zerstören.
  // Wichtig beim Wechsel von wenigen -> vielen Einträgen.
  if (LGDChart) {
    try {
      LGDChart.destroy();
    } catch (err) {
      console.error('renderLGDChart: Fehler beim Destroy von LGDChart:', err);
    }
    LGDChart = null;
  }

  const labels = filteredEADMainData.map(row => String(row.ISSUER ?? '').trim());
  const rowCount = labels.length;

  /*
    Ziel:
    - wenige Emittenten: kompakt
    - viele Emittenten: wächst nach unten
    - Balkendicke bleibt stabil
  */
  const minChartHeight = 180;
  const rowSlotHeight = 24;
  const chartPadding = 90;
  const dynamicHeight = Math.max(
    minChartHeight,
    rowCount * rowSlotHeight + chartPadding
  );

  // Container hat feste Hoehe + overflow-y:auto (CSS). Das Canvas bekommt die volle
  // dynamicHeight (im raf) -> bei vielen Emittenten hoeher als die Karte, die Karte
  // scrollt. Frueheres Aufblasen der Container-Hoehe (inline) entfaellt.
  canvas.removeAttribute('height');
  canvas.style.height = '';
  canvas.style.maxHeight = '';
  canvas.style.minHeight = '';
  canvas.style.display = 'block';
  if (canvas.parentElement) {
    canvas.parentElement.style.height = '';
    canvas.parentElement.style.maxHeight = '';
    canvas.parentElement.style.minHeight = '';
  }

  const EADValues = filteredEADMainData.map(row => {
    const raw = (row.NOTIONAL || '').toString().replace(/\s/g, '');
    const v = parseFloat(raw);
    return Number.isFinite(v) ? v : 0;
  });

  const LGDValues = filteredEADMainData.map(row => {
    const raw = (row.LGD || '').toString().replace(/\s/g, '');
    const v = parseFloat(raw);
    return Number.isFinite(v) ? v : 0;
  });

  const commonBarOptions = {
    maxBarThickness: 12,
    categoryPercentage: 0.65,
    barPercentage: 0.75,
  };

  const datasets = [
    {
      label: 'EAD',
      data: EADValues,
      backgroundColor: 'rgba(70, 192, 230, 0.7)',
      borderColor: 'rgba(70, 192, 230, 0.7)',
      borderWidth: 1,
      ...commonBarOptions,
    },
    {
      label: 'LGD',
      data: LGDValues,
      backgroundColor: 'rgba(255, 0, 0, 0.7)',
      borderColor: 'rgba(255, 0, 0, 1)',
      borderWidth: 1,
      ...commonBarOptions,
    },
  ];

  // Drill-Schritte je Balken (Emittent) + Drill-Datenquelle (Positionen des gewaehlten
  // Portfolios, angereichert mit __LOSS). Balken = Emittent -> dessen Positionen.
  const steps = labels.map(iss => eadIssuerStep(iss));
  try {
    const selPort = String(appState.getSelectedPortTableName?.() ?? '').trim();
    const portRows = (appState.getAllPortfolioData?.() || [])
      .filter(r => String(r?.port_name ?? r?.PORT_NAME ?? '').trim() === selPort);
    eadDrill.setData(enrichEadDrillRows(portRows, selPort));
  } catch (e) { console.warn('[EAD] drill data failed', e); }
  bindEadCanvasLeaveHide(canvas);

  // "All issuers"-Button im Drill-Fenster: rendert die EAD-Daten (je Emittent+Rang)
  // -> genau die EAD-Container-Tabelle, erste Spalte ISSUER. Einmalig binden.
  const showAllBtn = document.getElementById('eadShowAllBtn');
  if (showAllBtn && !showAllBtn.dataset.bound) {
    showAllBtn.dataset.bound = '1';
    showAllBtn.addEventListener('click', () => { try { renderEadAllIssuers(); } catch {} });
  }

  // Bei Breitenaenderung des Containers neu zeichnen (z.B. Panel-Open: Chart wurde
  // evtl. mit Fallback-Breite gerendert, solange das Panel versteckt war). Nur Breite
  // beruecksichtigen -> die von uns gesetzte Hoehe loest keine Endlosschleife aus.
  const eadContainer = canvas.parentElement;
  if (eadContainer && !eadContainer.__eadRO && typeof ResizeObserver !== 'undefined') {
    eadContainer.__eadRO = true;
    let lastW = 0;
    const ro = new ResizeObserver(() => {
      const w = eadContainer.getBoundingClientRect().width;
      if (w > 5 && Math.abs(w - lastW) > 8) { lastW = w; try { renderLGDChart(); } catch {} }
    });
    ro.observe(eadContainer);
  }

  // Einen Frame warten, damit Browser die neue Canvas-Höhe wirklich übernimmt.
  // Direkt mit new Chart() (statt createBarChart), damit Hover/Klick fuer den Drill
  // funktionieren (createBarChart setzt events:[]).
  requestAnimationFrame(() => {
    const cv = document.getElementById(canvasId);
    if (!cv || !cv.isConnected || !cv.parentNode) return;
    const existing = (typeof Chart !== 'undefined' && Chart.getChart) ? Chart.getChart(cv) : null;
    if (existing) { try { existing.destroy(); } catch {} }

    // Breite = Container-Innenbreite; Höhe = dynamicHeight -> bei vielen Emittenten
    // hoeher als die (fixe) Karte, die Karte scrollt (overflow-y in CSS).
    const padX = 24; // .chart-container-inner padding links+rechts
    cv.width = Math.max(320, Math.floor((cv.parentNode.clientWidth || 800) - padX));
    cv.height = dynamicHeight;

    // Fuer die Balken-Labels (Wert kompakt + rel % vom NAV, wie beim Loss-Chart).
    const sumNav = sumNavForPort(appState.getSelectedPortTableName?.());
    const bodyCss = getComputedStyle(document.body);
    const labelColor = (bodyCss.getPropertyValue('--text-primary') || '').trim() || '#ddd';

    LGDChart = new Chart(cv.getContext('2d'), {
      type: 'bar',
      plugins: window.ChartDataLabels ? [window.ChartDataLabels] : [],
      data: { labels, datasets },
      options: {
        responsive: false,
        maintainAspectRatio: false,
        indexAxis: 'y',
        animation: false,
        normalized: true,
        // Platz rechts fuer die Wert-Labels neben den Balken.
        layout: { padding: { right: 96 } },
        // Drill per RECHTSKLICK (bindRightClickDrill nach der Chart-Erzeugung).
        plugins: {
          // Canvas-Legende aus: sticky HTML-Legende (renderChartLegend) bleibt beim
          // Scrollen sichtbar, gleiches Styling wie beim Loss-Chart.
          legend: { display: false },
          annotation: false,
          // Wert (kompakt) + rel % vom NAV rechts neben jedem Balken.
          datalabels: window.ChartDataLabels ? {
            anchor: 'end', align: 'right', clamp: true,
            color: labelColor,
            font: { size: 10 },
            formatter: (value) => {
              const v = Number(value) || 0;
              if (!v) return '';
              const rel = sumNav > 0 ? (v / sumNav * 100) : 0;
              return `${_fmtLossCompact.format(v)} · ${rel.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
            },
          } : undefined,
        },
        scales: { y: { beginAtZero: true, ticks: { autoSkip: false } }, x: { beginAtZero: true, grace: '5%' } },
      },
    });

    LGDChart.$eadSteps = steps;
    bindRightClickDrill(cv, () => LGDChart,
      (el, ch, e) => eadDrill.hover('var', { native: e }, [el], ch.$eadSteps || []));

    try { renderChartLegend(LGDChart, document.getElementById('eadChartLegend')); } catch {}
  });
}


export function handleCVaRData(receivedData, index, port_nameArg) {
  const safeIndex = Number.isFinite(index) ? index : 0;

  // Slot → port_name (wie bei MVaR: panel-lokal)
  const dd = document.getElementById(`createdPortDropdown${safeIndex}`);
  const port_name = String(port_nameArg ?? dd?.value ?? '').trim();

  // Wenn Slot nichts selected hat: ruhig bleiben
  if (!port_name) return;

  // Optional: stale-guard (verhindert "alte Response überschreibt neuen Slot")
  const current = String(dd?.value ?? '').trim();
  if (current && current !== port_name) return;

  const filteredByPort = Array.isArray(receivedData)
    ? receivedData.filter(item =>
        item &&
        String(item.port_name ?? '').trim() === port_name
      )
    : [];

  appState.setCvarData?.(filteredByPort);

  // Nur Combined-Overview (slot-spezifisch!) – das ist stabil, weil ContainerId index-basiert ist
  const combinedRelData = {
    rating: filteredByPort.filter(x => String(x?.pd_flag ?? '').toLowerCase() === 'rating'),
    market: filteredByPort.filter(x => String(x?.pd_flag ?? '').toLowerCase() === 'market'),
    norm:   filteredByPort.filter(x => String(x?.pd_flag ?? '').toLowerCase() === 'norm'),
  };

  console.log('combinedRelData:', combinedRelData)

  renderCombinedCVaRRelTable(combinedRelData, safeIndex);

  // Credit-Risk-Dashboard (KPI-Karten) aus denselben CVaR-Daten aktualisieren.
  try { renderCreditRiskDashboard(); } catch (e) { console.warn('[CVaR] credit dashboard render failed', e); }
  // Overview-Loss-Charts (Loss distribution + Tail zoom) ebenfalls mitziehen, damit sie
  // beim Portfoliowechsel aktualisieren (nicht erst nach einer Neuberechnung).
  try { renderCreditOverviewCharts(); } catch (e) { console.warn('[CVaR] credit overview charts render failed', e); }
  // Expected Loss + Economic Capital (KPIs oben im Profit/Loss-Panel) neu rechnen — jetzt ist
  // die frische VaR-historic-Zeile im Store.
  try { renderCreditExpectedLoss(); } catch {}
}




function populateCVaRTable(container, CVaRData, port_name) {
  if (!CVaRData || CVaRData.length === 0) {
    console.warn('âš ï¸ No CVaR data available.');
    container.innerHTML = '<p>No data available</p>';
    return;
  }

  const row0 = CVaRData[0];

  // Create a new table
  const table = document.createElement('table');
  table.border = '1'; // Add border for visibility

  // Create table headers
  const headers = [`Metric for ${port_name}`, 'Absolute', 'Relative'];
  const headerRow = table.insertRow();
  headers.forEach(headerText => {
    const cell = headerRow.insertCell();
    cell.textContent = headerText;
    cell.style.fontWeight = 'bold'; // Make headers bold
  });

  // Process and insert data rows
  const metrics = [
    { label: 'VaR', absKey: 'VaR_abs', relKey: 'VaR_rel' },
    { label: 'ES', absKey: 'ES_abs', relKey: 'ES_rel' },
  ];

  metrics.forEach(metric => {
    const row = table.insertRow();
    row.insertCell().textContent = metric.label; // First column: Metric name

    const absVal = row0[metric.absKey];
    const relVal = row0[metric.relKey];

    row.insertCell().textContent =
      absVal !== undefined ? formatNumber(0)(absVal) : 'N/A';
    row.insertCell().textContent = formatPercentage(relVal);
  });

  // Clear previous content and append the new table
  container.innerHTML = '';
  container.appendChild(table);
}

function formatPercentage(value) {
  if (value === undefined || value === null || isNaN(value)) return 'N/A';
  return (Number(value) * 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%';
}

// Cached inputs of the last credit-risk traffic-light render, so the ampel can be
// re-computed when the customer thresholds change (without new CVaR data).
let __lastCvarAmpelData = null;
let __lastCvarAmpelIndex = null;

// Re-render the credit-risk traffic lights from the last CVaR data using the
// CURRENT customer thresholds. No-op if nothing was rendered yet / panel hidden.
export function refreshCreditRiskTrafficLights() {
  if (__lastCvarAmpelData == null) return;
  renderCombinedCVaRRelTable(__lastCvarAmpelData, __lastCvarAmpelIndex);
}

// Core: append a small coloured status dot AFTER the value cell of a table row.
// Same colours/look as Market Risk. Removes any previous dot first.
function appendCreditStatusDot(row, state) {
  const valueCell = row && row.cells ? row.cells[1] : null;
  if (!valueCell) return;

  const existingDot = valueCell.querySelector('.credit-status-dot');
  if (existingDot) existingDot.remove();

  const colorMap = {
    green: 'var(--accent)',
    yellow: 'yellow',
    red: 'red',
  };
  const color = colorMap[state] || null;
  if (!color) return;

  const dot = document.createElement('span');
  dot.className = 'credit-status-dot';
  dot.dataset.status = state;   // green|yellow|red -> vom PDF-Export gelesen (dotStatusFromCell)
  dot.style.display = 'inline-block';
  dot.style.width = '10px';
  dot.style.height = '10px';
  dot.style.borderRadius = '50%';
  dot.style.backgroundColor = color;
  dot.style.marginLeft = '8px';
  dot.style.verticalAlign = 'middle';

  valueCell.appendChild(dot);
}

// CVaR: dot on the matching row of the existing VaR table (data-metric = pd_flag).
function applyCreditDotToTable(index, state, metric) {
  const container = document.getElementById(`CVaR_allRelativeContainer${index}`);
  if (!container) return;

  const row = container.querySelector(`tr[data-metric="${metric}"]`);
  appendCreditStatusDot(row, state);
}

// Extract the rating-row values used for TSI: ES_rel, VaR_rel and TSI = ES - VaR.
// Mirrors the field handling in trafficLightStateForTsi.
function getTsiRatingValues(allFilteredDataByPdFlag) {
  const ratingArr = allFilteredDataByPdFlag && allFilteredDataByPdFlag['rating'];
  if (!Array.isArray(ratingArr) || !ratingArr.length) return null;

  const row = ratingArr[0];
  if (!row || typeof row !== 'object') return null;

  const esKey = ['ES_rel', 'es_rel'].find(k => k in row);
  const varKey = ['VaR_rel', 'var_rel'].find(k => k in row);
  if (!esKey || !varKey) return null;

  const esVal = Number(row[esKey]);
  const varVal = Number(row[varKey]);
  if (!Number.isFinite(esVal) || !Number.isFinite(varVal) || varVal === 0) return null;

  // TSI relativ: (ES - VaR) / VaR statt reiner Differenz.
  return { esVal, varVal, tsiDiff: (esVal - varVal) / varVal };
}

// Build the TSI table (ES / VaR / TSI stacked) and put the traffic-light dot on the
// TSI row. Unlike CVaR, TSI has no pre-existing table, so we generate it here first.
function renderTsiTable(allFilteredDataByPdFlag, index, state) {
  const container = document.getElementById(`creditTsiTableContainer${index}`);
  if (!container) return;

  container.innerHTML = '';

  const vals = getTsiRatingValues(allFilteredDataByPdFlag);
  if (!vals) return;

  const table = document.createElement('table');
  table.classList.add('CVaRTable');

  const headerRow = table.insertRow();
  ['label', 'value'].forEach(text => {
    headerRow.insertCell().textContent = text;
  });

  const tsiRows = [
    { metric: 'tsi', label: 'TSI',          value: formatPercentage(vals.tsiDiff) },
    { metric: 'es',  label: 'Historic ES',  value: formatPercentage(vals.esVal) },
    { metric: 'var', label: 'Historic VaR', value: formatPercentage(vals.varVal) },
  ];

  tsiRows.forEach(({ metric, label, value }) => {
    const r = table.insertRow();
    r.dataset.metric = metric;
    r.insertCell(0).textContent = label;
    r.insertCell(1).textContent = value;
  });

  container.appendChild(table);

  // Dot only on the TSI row.
  const tsiRow = container.querySelector('tr[data-metric="tsi"]');
  appendCreditStatusDot(tsiRow, state);
}

// Extract the ES values used for MSD: Historic ES (rating), Adjusted ES (norm) and
// MSD = Adjusted ES - Historic ES. Mirrors the field handling in trafficLightStateForMsd.
function getMsdValues(allFilteredDataByPdFlag) {
  const ratingArr = allFilteredDataByPdFlag && allFilteredDataByPdFlag['rating'];
  const normArr   = allFilteredDataByPdFlag && allFilteredDataByPdFlag['norm'];
  if (!Array.isArray(ratingArr) || !ratingArr.length) return null;
  if (!Array.isArray(normArr)   || !normArr.length)   return null;

  const ratingRow = ratingArr[0];
  const normRow   = normArr[0];
  if (!ratingRow || !normRow) return null;
  if (!('ES_rel' in ratingRow) || !('ES_rel' in normRow)) return null;

  const esRating = Number(ratingRow.ES_rel); // Historic ES
  const esNorm   = Number(normRow.ES_rel);   // Adjusted ES
  if (!Number.isFinite(esRating) || !Number.isFinite(esNorm) || esRating === 0) return null;

  // MSD relativ: (Adjusted ES - Historic ES) / Historic ES statt reiner Differenz.
  return { esRating, esNorm, msdDiff: (esNorm - esRating) / esRating };
}

// Build the MSD table (Adjusted ES / Historic ES / MSD) and put the dot on the MSD row.
function renderMsdTable(allFilteredDataByPdFlag, index, state) {
  const container = document.getElementById(`creditMsdTableContainer${index}`);
  if (!container) return;

  container.innerHTML = '';

  const vals = getMsdValues(allFilteredDataByPdFlag);
  if (!vals) return;

  const table = document.createElement('table');
  table.classList.add('CVaRTable');

  const headerRow = table.insertRow();
  ['label', 'value'].forEach(text => {
    headerRow.insertCell().textContent = text;
  });

  const msdRows = [
    { metric: 'msd',    label: 'MSD',                 value: formatPercentage(vals.msdDiff) },
    { metric: 'adjEs',  label: 'Market adjusted ES', value: formatPercentage(vals.esNorm) },
    { metric: 'histEs', label: 'Historic ES',         value: formatPercentage(vals.esRating) },
  ];

  msdRows.forEach(({ metric, label, value }) => {
    const r = table.insertRow();
    r.dataset.metric = metric;
    r.insertCell(0).textContent = label;
    r.insertCell(1).textContent = value;
  });

  container.appendChild(table);

  // Dot only on the MSD row.
  const msdRow = container.querySelector('tr[data-metric="msd"]');
  appendCreditStatusDot(msdRow, state);
}

function renderCombinedCVaRRelTable(allFilteredDataByPdFlag, index) {
  __lastCvarAmpelData = allFilteredDataByPdFlag;
  __lastCvarAmpelIndex = index;

  const containerId = `CVaR_allRelativeContainer${index}`;
  const container   = document.getElementById(containerId);
  if (!container) return;


  container.dataset.panelTitle = 'Credit Risk / Traffic Lights';

  
  if (
    !allFilteredDataByPdFlag ||
    typeof allFilteredDataByPdFlag !== 'object' ||
    Object.keys(allFilteredDataByPdFlag).length === 0
  ) {
    container.innerHTML = '';
    return;
  }

  
  const hasValidData = Object.values(allFilteredDataByPdFlag).some(
    data => Array.isArray(data) && data[0] && data[0].VaR_rel !== undefined
  );

  // Container immer zuerst leeren
  container.innerHTML = '';

  if (!hasValidData) return;

  // Tabelle neu anlegen
  const table = document.createElement('table');
  table.classList.add('CVaRTable');
  table.classList.add('CVaRTable--3col');   // 3 Spalten: label / VaR / ES

  const headerRow = table.insertRow();
  ['label', 'VaR', 'ES'].forEach(text => {
    const cell = headerRow.insertCell();
    cell.textContent = text;
  });

  // Welche pd_flags zeigen wir an?
  const allowedPdFlags = ['rating', 'market', 'norm'];

  const labelMap = {
    rating: 'Historic',
    market: 'Market',
    norm:   'Market adjusted',
  };

  Object.entries(allFilteredDataByPdFlag).forEach(([pd_flag, data]) => {
    if (!Array.isArray(data) || !data.length) return;
    if (allowedPdFlags.length > 0 && !allowedPdFlags.includes(pd_flag)) return;

    const row = data[0];
    if (!row || !('VaR_rel' in row)) return;

    // Label ohne " VaR" -> Historic / Market Implied / Risk Adjusted
    const label = labelMap[pd_flag] || pd_flag;
    const fmt = (raw) => (typeof raw === 'string' ? raw : formatPercentage(raw));

    const r = table.insertRow();
    // Tag the row with its pd_flag so the matching traffic-light state can place a
    // coloured status dot here (rating -> CVaR ampel, auf der VaR-Zelle = cells[1]).
    r.dataset.metric = pd_flag;
    r.insertCell(0).textContent = label;
    r.insertCell(1).textContent = fmt(row.VaR_rel);   // VaR
    r.insertCell(2).textContent = fmt(row.ES_rel);    // ES
  });

  container.appendChild(table);



  // Credit-risk thresholds now come from the customer store
  // (CustomerCreditRiskThresholdSetting), not the legacy CreditVaRInputThreshold.
  console.log('[CREDIT RISK SETTING THRESHOLDS USED]', {
    source: 'CustomerCreditRiskThresholdSetting/appState',
    CVAR: appState.getCustomerCreditRiskThreshold?.('CVAR'),
    TSI: appState.getCustomerCreditRiskThreshold?.('TSI'),
    MSD: appState.getCustomerCreditRiskThreshold?.('MSD'),
  });

  // CVaR
  const stateCvar = trafficLightStateForCvar(allFilteredDataByPdFlag, 'Historic');
  if (stateCvar) {
    const el = document.getElementById('traffic-credit-cvar');
    if (el) el.dataset.status = stateCvar;
    updateTrafficLight('#traffic-credit-cvar', stateCvar);
    // Same as Market Risk: show the CVaR state as a coloured dot after the value in
    // the FIRST table row (Historic VaR / pd_flag 'rating').
    applyCreditDotToTable(index, stateCvar, 'rating');
  }

  // MSD
  const stateMsd = trafficLightStateForMsd(allFilteredDataByPdFlag, allowedPdFlags);
  if (stateMsd) {
    const el = document.getElementById('traffic-credit-msd');
    if (el) el.dataset.status = stateMsd;
    updateTrafficLight('#traffic-credit-msd', stateMsd);
  }
  // Generate the MSD table (Adjusted ES / Historic ES / MSD) and put the dot on MSD.
  renderMsdTable(allFilteredDataByPdFlag, index, stateMsd);

  // TSI
  const stateTsi = trafficLightStateForTsi(allFilteredDataByPdFlag, allowedPdFlags);
  if (stateTsi) {
    const el = document.getElementById('traffic-credit-tsi');
    if (el) el.dataset.status = stateTsi;
    updateTrafficLight('#traffic-credit-tsi', stateTsi);
  }
  // Generate the TSI table (ES / VaR / TSI) and put the dot on the TSI row.
  renderTsiTable(allFilteredDataByPdFlag, index, stateTsi);
}




function trafficLightStateForCvar(allFilteredDataByPdFlag, flag) {
  if (!allFilteredDataByPdFlag || typeof allFilteredDataByPdFlag !== 'object') {
    return null;
  }

  // 1) Thresholds aus appState holen (kann Array oder Objekt sein)
  const thrRaw = appState.getCustomerCreditRiskThreshold
    ? appState.getCustomerCreditRiskThreshold('CVAR')
    : null;

  //console.log('getCvarInputThreshold("CVaR") â†’', thrRaw);

  if (!thrRaw) {
    console.warn('âš ï¸ CVaR-Thresholds: getCvarInputThreshold gibt null/undefined zurÃ¼ck');
    return null;
  }

  // 2) Falls Array â†’ passende Zeile nach metric = "CVaR" suchen
  let thrObj;

  if (Array.isArray(thrRaw)) {
    thrObj = thrRaw.find(r => r.metric === 'CVaR') || thrRaw[0];
  } else {
    thrObj = thrRaw;
  }

  if (!thrObj) {
    console.warn('âš ï¸ CVaR-Thresholds: Kein Eintrag fÃ¼r metric="CVaR" gefunden:', thrRaw);
    return null;
  }

  let YELLOW = Number(thrObj.yellow_threshold);
  let RED    = Number(thrObj.red_threshold);

  // console.log('Rohe Thresholds aus DB (CVaR-Zeile):', {
  //   rawYellow: YELLOW,
  //   rawRed: RED,
  // });

  if (!Number.isFinite(YELLOW) || !Number.isFinite(RED)) {
    console.warn('âš ï¸ CVaR-Thresholds sind keine gÃ¼ltigen Zahlen:', thrObj);
    return null;
  }

  // 3) Einheit normalisieren:
  // - Deine neue DB-Konvention: -0.05, -0.2 etc. â†’ already fractions â†’ bleiben so.
  // - Falls irgendwo noch alte Werte wie -5 / -20 drin sind â†’ in BrÃ¼che umrechnen.
  if (Math.abs(YELLOW) > 1 || Math.abs(RED) > 1) {
    YELLOW = YELLOW / 100;
    RED    = RED / 100;
  }

  // BetrÃ¤ge verwenden (weil Verlustseite negativ)
  YELLOW = Math.abs(YELLOW);
  RED    = Math.abs(RED);

  //console.log('Normierte Thresholds (BrÃ¼che, Betrag):', { YELLOW, RED });

  // 4) Daten fÃ¼r aktuelles Flag holen
  const key = (flag === 'Historic') ? 'rating' : flag;
  const arr = allFilteredDataByPdFlag[key];

  if (!Array.isArray(arr) || !arr.length) return null;

  const row = arr[0];
  if (!row || row.VaR_rel == null) return null;

  const raw = Number(row.VaR_rel);
  if (!isFinite(raw)) return null;

  // VaR_rel ist bei Verlusten negativ â†’ Betrag
  const lossLevel = Math.abs(raw);   // z.B. -0.0552 â†’ 0.0552 = 5.52 %

  // console.log('CVaR Ampel Check:', {
  //   flag,
  //   VaR_rel_raw: raw,
  //   lossLevel,
  //   YELLOW,
  //   RED
  // });

  if (lossLevel >= RED)    return 'red';
  if (lossLevel >= YELLOW) return 'yellow';
  return 'green';
}
function trafficLightStateForMsd(allFilteredDataByPdFlag, _flags) {
  if (!allFilteredDataByPdFlag || typeof allFilteredDataByPdFlag !== 'object') {
    return null;
  }

  // 1) Thresholds aus appState holen (kann Array oder Objekt sein)
  const thrRaw = appState.getCustomerCreditRiskThreshold
    ? appState.getCustomerCreditRiskThreshold('MSD')
    : null;

  console.warn('[MSD THRESHOLD USED IN TRAFFIC LIGHT]', {
    threshold: appState.getCustomerCreditRiskThreshold?.('MSD'),
    red: appState.getCustomerCreditRiskThreshold?.('MSD')?.red_threshold,
  });

  if (!thrRaw) {
    console.warn('âš ï¸ MSD-Thresholds: getCvarInputThreshold gibt null/undefined zurÃ¼ck');
    return null;
  }

  // 2) Falls Array â†’ passende Zeile nach metric = "MSD" suchen
  let thrObj;

  if (Array.isArray(thrRaw)) {
    thrObj = thrRaw.find(r => r.metric === 'MSD') || thrRaw[0];
  } else {
    thrObj = thrRaw;
  }

  if (!thrObj) {
    console.warn('âš ï¸ MSD-Thresholds: Kein Eintrag fÃ¼r metric="MSD" gefunden:', thrRaw);
    return null;
  }

  let YELLOW = Number(thrObj.yellow_threshold);
  let RED    = Number(thrObj.red_threshold);

  // console.log('Rohe MSD-Thresholds aus DB:', {
  //   rawYellow: YELLOW,
  //   rawRed: RED,
  // });

  if (!Number.isFinite(YELLOW) || !Number.isFinite(RED)) {
    console.warn('âš ï¸ MSD-Thresholds sind keine gÃ¼ltigen Zahlen:', thrObj);
    return null;
  }

  // 3) Einheit normalisieren:
  // Neue Konvention: 0.01, 0.02 etc. â†’ bereits BrÃ¼che.
  // Falls mal alte Werte 1 / 2 oder 10 / 20 drin sind â†’ in BrÃ¼che umrechnen.
  if (Math.abs(YELLOW) > 1 || Math.abs(RED) > 1) {
    YELLOW = YELLOW / 100;
    RED    = RED / 100;
  }

  // Ab jetzt arbeiten wir mit positiven Schwellen (Betrag)
  YELLOW = Math.abs(YELLOW);
  RED    = Math.abs(RED);

  //console.log('Normierte MSD-Thresholds (BrÃ¼che, Betrag):', { YELLOW, RED });

  // 4) rating/norm-Daten holen
  const ratingArr = allFilteredDataByPdFlag['rating'];
  const normArr   = allFilteredDataByPdFlag['norm'];

  if (!Array.isArray(ratingArr) || !ratingArr.length) return null;
  if (!Array.isArray(normArr)   || !normArr.length)   return null;

  const ratingRow = ratingArr[0];
  const normRow   = normArr[0];

  if (!ratingRow || !normRow) return null;

  // Wir verwenden gezielt ES_rel
  const candidateKeys = ['ES_rel'];

  const findKey = (row) =>
    candidateKeys.find(k => k in row);

  const keyRating = findKey(ratingRow);
  const keyNorm   = findKey(normRow);

  if (!keyRating || !keyNorm) {
    console.warn('âš ï¸ Kein passender ES-Key in rating/norm gefunden (MSD)');
    return null;
  }

  const esRating = Number(ratingRow[keyRating]);
  const esNorm   = Number(normRow[keyNorm]);

  if (!Number.isFinite(esRating) || !Number.isFinite(esNorm)) {
    return null;
  }

  // MSD relativ: (Adjusted ES - Historic ES) / Historic ES; verglichen wird der Betrag.
  if (esRating === 0) return null;
  const diffRel = (esNorm - esRating) / esRating;
  const valueToCompare = Math.abs(diffRel);

  // console.log('Credit Risk Ampel MSD (ES):', {
  //   esRating,
  //   esNorm,
  //   diffRel,
  //   absDiff: valueToCompare,
  //   YELLOW,
  //   RED
  // });

  // Schwellen sind positiv:
  // Beispiel: YELLOW = 0.01, RED = 0.02
  // |diffRel| >= RED    â†’ rot
  // |diffRel| >= YELLOW â†’ gelb
  if (valueToCompare >= RED)    return 'red';
  if (valueToCompare >= YELLOW) return 'yellow';
  return 'green';
}
function trafficLightStateForTsi(allFilteredDataByPdFlag, _flags) {
  if (!allFilteredDataByPdFlag || typeof allFilteredDataByPdFlag !== 'object') {
    return null;
  }

  // 1) Thresholds aus appState holen (kann Array oder Objekt sein)
  const thrRaw = appState.getCustomerCreditRiskThreshold
    ? appState.getCustomerCreditRiskThreshold('TSI')
    : null;

  //console.log('getCvarInputThreshold("TSI") â†’', thrRaw);

  if (!thrRaw) {
    console.warn('âš ï¸ TSI-Thresholds: getCvarInputThreshold gibt null/undefined zurÃ¼ck');
    return null;
  }

  // 2) Falls Array â†’ passende Zeile nach metric = "TSI" suchen
  let thrObj;

  if (Array.isArray(thrRaw)) {
    thrObj = thrRaw.find(r => r.metric === 'TSI') || thrRaw[0];
  } else {
    thrObj = thrRaw;
  }

  if (!thrObj) {
    console.warn('âš ï¸ TSI-Thresholds: Kein Eintrag fÃ¼r metric="TSI" gefunden:', thrRaw);
    return null;
  }

  let YELLOW = Number(thrObj.yellow_threshold);
  let RED    = Number(thrObj.red_threshold);

  // console.log('Rohe TSI-Thresholds aus DB:', {
  //   rawYellow: YELLOW,
  //   rawRed: RED,
  // });

  if (!Number.isFinite(YELLOW) || !Number.isFinite(RED)) {
    console.warn('âš ï¸ TSI-Thresholds sind keine gÃ¼ltigen Zahlen:', thrObj);
    return null;
  }

  // 3) Einheit normalisieren:
  // Neue Konvention: 0.01, 0.02 etc. â†’ bereits BrÃ¼che (Prozentpunkte).
  // Alte Werte 1 / 2 / 10 / 20 â†’ in BrÃ¼che umrechnen.
  if (Math.abs(YELLOW) > 1 || Math.abs(RED) > 1) {
    YELLOW = YELLOW / 100;
    RED    = RED / 100;
  }

  // Ab jetzt mit positiven Schwellen (Betrag in Prozentpunkten)
  YELLOW = Math.abs(YELLOW);
  RED    = Math.abs(RED);

  //console.log('Normierte TSI-Thresholds (BrÃ¼che, Betrag):', { YELLOW, RED });

  // 4) Wir schauen nur auf "rating"
  const ratingArr = allFilteredDataByPdFlag['rating'];
  if (!Array.isArray(ratingArr) || !ratingArr.length) return null;

  const row = ratingArr[0];
  if (!row || typeof row !== 'object') return null;

  // Feldnamen - nur relative GrÃ¶ÃŸen
  const esCandidates  = ['ES_rel', 'es_rel'];
  const varCandidates = ['VaR_rel', 'var_rel'];

  const findKey = (r, candidates) =>
    candidates.find(k => k in r);

  const esKey  = findKey(row, esCandidates);
  const varKey = findKey(row, varCandidates);

  if (!esKey || !varKey) {
    console.warn('âš ï¸ Kein ES_rel-/VaR_rel-Key fÃ¼r rating gefunden (TSI).');
    return null;
  }

  const esVal  = Number(row[esKey]);   // z.B. -0.07
  const varVal = Number(row[varKey]);  // z.B. -0.05

  if (!Number.isFinite(esVal) || !Number.isFinite(varVal)) {
    return null;
  }

  // TSI relativ: (ES - VaR) / VaR; z.B. (-0.07 - (-0.05)) / -0.05 = 0.4.
  // Verglichen wird der Betrag.
  if (varVal === 0) return null;
  const tsiDiff = (esVal - varVal) / varVal;
  const valueToCompare = Math.abs(tsiDiff);

  // console.log('TSI (rating, Prozentpunkte):', {
  //   esKey,
  //   varKey,
  //   esVal,
  //   varVal,
  //   tsiDiff,
  //   absDiff: valueToCompare,
  //   YELLOW,
  //   RED
  // });

  // Schwellen sind positiv:
  // |TSI_diff| >= RED    â†’ rot
  // |TSI_diff| >= YELLOW â†’ gelb
  if (valueToCompare >= RED)    return 'red';
  if (valueToCompare >= YELLOW) return 'yellow';
  return 'green';
}


function ensureTrafficPanel({ id, title, hostId = 'CVaR_allRelativeContainer1' /* anpassen */ }) {
  // hostId: wo du den Panel-Block sinnvollerweise andocken willst
  const host = document.getElementById(hostId) || document.body;

  let panel = document.getElementById(id);
  if (!panel) {
    panel = document.createElement('section');
    panel.id = id;

    // WICHTIG: Diese Klasse muss zu deinem discoverPanels() Selector passen
    panel.classList.add('risk-panel');

    // WICHTIG: Title-Attr (oder das, was deine Discovery liest)
    panel.dataset.panelTitle = title;

    // Optional: Key stabil
    panel.dataset.panelKey = id;

    // etwas Layout, damit es im Preview nicht â€œfliegtâ€
    panel.style.marginTop = '12px';
    panel.style.padding = '10px';
    panel.style.border = '1px solid rgba(255,255,255,.12)';
    panel.style.borderRadius = '10px';

    host.appendChild(panel);
  }
  return panel;
}


export { filteredEADMainData };






