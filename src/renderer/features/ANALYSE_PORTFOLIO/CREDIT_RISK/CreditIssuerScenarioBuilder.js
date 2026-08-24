'use strict';

// Create/Set Credit (Issuer) Scenario.
// BASE = berechnete EAD-Werte (EAD-Tabelle des gewaehlten Portfolios). Benannte
// Szenarien je (Issuer, RANK) in CREDIT_ISSUER_SCENARIO_DATA (allgemein, NICHT ans
// Portfolio gebunden — das Portfolio liefert nur die Issuer-Liste zum Editieren).
// Aktives Szenario in CREDIT_ISSUER_ACTIVE (id=1). Felder: include / ead / rr /
// rating_res. LGD wird NICHT gespeichert, sondern abgeleitet: LGD = EAD * (1 - RR).
// Alle Schreibvorgaenge laufen ueber die generischen CRUD-Kanaele.

import {
  showSuccess,
  showError,
} from '../../../core/ui/notifications/notifications.js';
// Zentrales Zahlenformat (de-DE, "format-once"): fmtNum = Tausendertrennzeichen,
// parseDeNumber = de-DE-tolerante Eingabe -> echte Zahl.
import { fmtNum, parseDeNumber } from '../../../utils/tableCellFormats.js';

const TABLE_SCEN = 'CREDIT_ISSUER_SCENARIO_DATA';
const TABLE_ACTIVE = 'CREDIT_ISSUER_ACTIVE';

let builderListenersInstalled = false;
let setPanelListenersInstalled = false;
let tableDelegBound = false;
let fillDownBound = false;

function norm(v) {
  return String(v == null ? '' : v).trim();
}

function toNum(v) {
  if (v == null || v === '') return null;
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function round(n, dp = 4) {
  if (n == null || !Number.isFinite(n)) return null;
  const f = Math.pow(10, dp);
  return Math.round(n * f) / f;
}

// Betrag mit Tausendertrennzeichen (de-DE), max. 2 Nachkommastellen — fuer EAD- und
// RR(%)-Editierfelder (Anzeige/Reformat). "5000000" -> "5.000.000".
function fmtAmount(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '';
  return n.toLocaleString('de-DE', { maximumFractionDigits: 2 });
}
// RR-Bruch (0.4) -> Prozent-Eingabestring ("40").
function rrToPctStr(fraction) {
  const n = Number(fraction);
  return Number.isFinite(n) ? fmtAmount(n * 100) : '';
}

function selectedPort() {
  return norm(window.appState?.getSelectedPortTableName?.());
}

// key je (issuer, rank)
function keyOf(issuer, rnk) {
  return `${norm(issuer)}||${norm(rnk)}`;
}

// ECHTE Basis-Zeilen — bewusst aus den PORTFOLIO-Positionen (getAllPortfolioData),
// NICHT aus der EAD-Tabelle: Letztere spiegelt den letzten Credit-Lauf und damit ein
// evtl. aktives Szenario (EAD/Rating/LGD ueberschrieben). Die Positionen sind
// szenariounabhaengig -> so zeigt "BASE" wirklich die Basiswerte.
//   ead    = Σ NOTIONAL je (Issuer, Rank)
//   rating = aufgeloestes Rating der Position (RATINGres)
//   rr     = globale recovery_rate (haeufigste Rate 1-LGD/NOTIONAL in der EAD-Tabelle;
//            Szenario-RR betrifft nur Einzelne -> Mehrheit = global; Fallback 0,4)
function baseRows() {
  const appState = window.appState;
  const port = selectedPort();

  // Globale Basis-RR aus der EAD-Tabelle ableiten (Modus der Rate 1 - LGD/NOTIONAL).
  const ead = appState?.getAllEADData?.() || [];
  const rateCount = new Map();
  ead.forEach((e) => {
    if (port && norm(e?.port_name) !== port) return;
    if (String(e?.pd_flag ?? '').toUpperCase() !== 'RATING') return;
    const n = toNum(e?.NOTIONAL), l = toNum(e?.LGD);
    if (n == null || n === 0 || l == null) return;
    const rr = round(1 - l / n, 4);
    rateCount.set(rr, (rateCount.get(rr) || 0) + 1);
  });
  let baseRr = null, best = -1;
  rateCount.forEach((c, rr) => { if (c > best) { best = c; baseRr = rr; } });
  if (baseRr == null) baseRr = 0.4;

  // Basis aus den Portfolio-Positionen je (Issuer, Rank) aggregieren.
  const pos = appState?.getAllPortfolioData?.() || [];
  const agg = new Map(); // key -> { issuer, rnk, ead, rating }
  pos.forEach((r) => {
    const pn = norm(r?.port_name ?? r?.PORT_NAME);
    if (port && pn && pn !== port) return;
    if (r?.INCLUDE != null && Number(r.INCLUDE) === 0) return; // ausgeschlossene Positionen
    const issuer = norm(r?.ISSUER);
    if (!issuer) return;
    const rnk = norm(r?.RANK);
    const key = keyOf(issuer, rnk);
    const n = toNum(r?.NOTIONAL) || 0;
    const rating = norm(r?.RATINGres ?? r?.RATING);
    const cur = agg.get(key) || { issuer, rnk, ead: 0, rating: '' };
    cur.ead += n;
    if (!cur.rating && rating) cur.rating = rating;
    agg.set(key, cur);
  });

  if (agg.size) {
    return [...agg.values()].map((x) => ({ issuer: x.issuer, rnk: x.rnk, ead: x.ead, rr: baseRr, rating: x.rating }));
  }

  // Fallback (keine Positionsdaten geladen): aus der EAD-Tabelle (kann Szenario spiegeln).
  const out = [];
  const seen = new Set();
  ead.forEach((r) => {
    if (port && norm(r?.port_name) !== port) return;
    if (String(r?.pd_flag ?? '').toUpperCase() !== 'RATING') return;
    const issuer = norm(r?.ISSUER);
    if (!issuer) return;
    const rnk = norm(r?.RANK);
    const k = keyOf(issuer, rnk);
    if (seen.has(k)) return;
    seen.add(k);
    const eadv = toNum(r?.NOTIONAL);
    const lgd = toNum(r?.LGD);
    const rrB = (eadv != null && eadv !== 0 && lgd != null) ? round(1 - lgd / eadv) : baseRr;
    out.push({ issuer, rnk, ead: eadv, rr: rrB, rating: norm(r?.RATING) });
  });
  return out;
}

// =============================================================================
// CREATE / BUILDER
// =============================================================================
export function renderCreditIssuerScenarioBuilder() {
  if (!builderListenersInstalled) {
    document.addEventListener('creditissuer:scenario:ready', renderCreditIssuerScenarioBuilder);
    document.addEventListener('creditissuer:active:ready', renderCreditIssuerScenarioBuilder);
    builderListenersInstalled = true;
  }

  const container = document.getElementById('creditIssuerScenarioTableData');
  if (!container) return;

  const appState = window.appState;
  if (!appState) return;

  const base = baseRows();
  const scenarioRows = appState.getCreditIssuerScenarioData?.() || [];

  bindScenarioDropdown(appState, scenarioRows);

  const select = document.getElementById('creditIssuerScenarioSelect');
  const selected = norm(select?.value); // '' = neu, 'BASE', oder Szenarioname

  if (!base.length) {
    container.innerHTML = `<p>No EAD rows for the selected portfolio. Run Credit Risk / select a portfolio first.</p>`;
    bindSave(appState, scenarioRows);
    bindDelete(appState, scenarioRows);
    return;
  }

  // Overlay: fuer das gewaehlte Szenario je (issuer,rnk) die gespeicherten Werte,
  // sonst Basiswerte.
  const ovl = new Map();
  if (selected && selected !== 'BASE') {
    scenarioRows
      .filter((r) => norm(r.scenario_id) === selected)
      .forEach((r) => ovl.set(keyOf(r.issuer, r.rnk), r));
  }

  const rows = base.map((b) => {
    const o = ovl.get(keyOf(b.issuer, b.rnk));
    if (!o) return { ...b, include: 1 };
    return {
      issuer: b.issuer,
      rnk: b.rnk,
      include: (o.include == null ? 1 : (Number(o.include) ? 1 : 0)),
      ead: (o.ead == null || o.ead === '') ? b.ead : toNum(o.ead),
      rr: (o.rr == null || o.rr === '') ? b.rr : toNum(o.rr),
      rating: norm(o.rating_res) || b.rating,
    };
  });

  renderTable(container, rows);
  bindTableDelegation(container);
  bindBulkApply(container);
  bindSave(appState, scenarioRows);
  bindDelete(appState, scenarioRows);
}

// LGD = EAD × (1 − RR). eadStr = Betrag mit Tausendertrennzeichen, rrPctStr = Prozent.
function lgdOf(eadStr, rrPctStr) {
  const e = parseDeNumber(eadStr);
  const rrPct = parseDeNumber(rrPctStr);
  if (!Number.isFinite(e) || !Number.isFinite(rrPct)) return null;
  return e * (1 - rrPct / 100);
}
// LGD-Zelle einer Zeile aus den aktuellen EAD/RR-Feldwerten neu berechnen + formatieren.
function recalcRowLgd(row) {
  if (!row) return;
  const ead = row.querySelector('input[data-fld="ead"]')?.value;
  const rr = row.querySelector('input[data-fld="rr"]')?.value;
  const cell = row.querySelector('.lgd-cell');
  if (cell) { const lgd = lgdOf(ead, rr); cell.textContent = (lgd == null ? '' : fmtNum(lgd, 0)); }
}

function renderTable(container, rows) {
  let html = `
    <div style="overflow:auto; max-width:100%;">
      <table class="ml-table">
        <thead>
          <tr>
            <th>Incl.</th><th>Issuer</th><th>Rank</th>
            <th>EAD</th><th>RR (%)</th><th>RATINGres</th><th>LGD (= EAD·(1−RR))</th>
          </tr>
        </thead>
        <tbody>
  `;

  rows.forEach((r) => {
    // EAD mit Tausendertrennzeichen, RR in Prozent; LGD = EAD·(1−RR) mit Tausendertrennzeichen.
    const eadStr = r.ead == null ? '' : fmtAmount(r.ead);
    const rrStr = r.rr == null ? '' : rrToPctStr(r.rr);
    const lgdVal = (r.ead != null && r.rr != null) ? r.ead * (1 - r.rr) : null;
    html += `
      <tr data-issuer="${escAttr(r.issuer)}" data-rnk="${escAttr(r.rnk)}">
        <td style="text-align:center;">
          <input type="checkbox" data-fld="include" ${r.include ? 'checked' : ''} />
        </td>
        <td>${escHtml(r.issuer)}</td>
        <td><input type="text" data-fld="rnk" value="${escAttr(r.rnk || '')}" style="width:150px;" /></td>
        <td><input type="text" inputmode="decimal" data-fld="ead" value="${escAttr(eadStr)}" style="width:130px; text-align:right;" /></td>
        <td style="white-space:nowrap;"><input type="text" inputmode="decimal" data-fld="rr" value="${escAttr(rrStr)}" style="width:70px; text-align:right;" /> %</td>
        <td><input type="text" data-fld="rating" value="${escAttr(r.rating || '')}" style="width:90px;" /></td>
        <td class="lgd-cell" style="text-align:right;">${lgdVal == null ? '' : fmtNum(lgdVal, 0)}</td>
      </tr>
    `;
  });

  html += `</tbody></table></div>`;
  container.innerHTML = html;
}

// LGD live nachrechnen, wenn EAD/RR geaendert werden; beim Verlassen eines EAD/RR-
// Feldes den Wert neu formatieren (EAD Tausendertrennzeichen, RR Prozent).
function bindTableDelegation(container) {
  if (tableDelegBound) return;
  tableDelegBound = true;
  container.addEventListener('input', (e) => {
    const inp = e.target;
    if (!inp || !inp.dataset || (inp.dataset.fld !== 'ead' && inp.dataset.fld !== 'rr')) return;
    recalcRowLgd(inp.closest('tr'));
  });
  container.addEventListener('focusout', (e) => {
    const inp = e.target;
    if (!inp || !inp.dataset || (inp.dataset.fld !== 'ead' && inp.dataset.fld !== 'rr')) return;
    const n = parseDeNumber(inp.value);
    inp.value = Number.isFinite(n) ? fmtAmount(n) : '';
    recalcRowLgd(inp.closest('tr'));
  });
}

// "Apply to all": RR/Rating/EAD aus den Bulk-Feldern in ALLE angehakten Zeilen.
function bindBulkApply(container) {
  const btn = document.getElementById('creditIssuerApplyAllBtn');
  if (!btn) return;
  btn.onclick = () => {
    const bulkRR = document.getElementById('creditIssuerBulkRR')?.value;
    const bulkRating = norm(document.getElementById('creditIssuerBulkRating')?.value);
    const bulkRank = norm(document.getElementById('creditIssuerBulkRank')?.value);
    const bulkEAD = document.getElementById('creditIssuerBulkEAD')?.value;

    container.querySelectorAll('tbody tr').forEach((row) => {
      const inc = row.querySelector('input[data-fld="include"]');
      if (inc && !inc.checked) return; // nur angehakte Zeilen
      if (bulkRR !== '' && bulkRR != null) {
        const el = row.querySelector('input[data-fld="rr"]'); if (el) el.value = bulkRR;
      }
      if (bulkRating !== '') {
        const el = row.querySelector('input[data-fld="rating"]'); if (el) el.value = bulkRating;
      }
      if (bulkRank !== '') {
        const el = row.querySelector('input[data-fld="rnk"]'); if (el) el.value = bulkRank;
      }
      if (bulkEAD !== '' && bulkEAD != null) {
        const el = row.querySelector('input[data-fld="ead"]'); if (el) el.value = bulkEAD;
      }
      // Gesetzte EAD/RR-Felder neu formatieren (Tausender / Prozent) + LGD aktualisieren.
      ['ead', 'rr'].forEach((fld) => {
        const el = row.querySelector(`input[data-fld="${fld}"]`);
        if (!el) return;
        const n = parseDeNumber(el.value);
        if (Number.isFinite(n)) el.value = fmtAmount(n);
      });
      recalcRowLgd(row);
    });
  };
}

function bindScenarioDropdown(appState, scenarioRows) {
  const select = document.getElementById('creditIssuerScenarioSelect');
  const nameInput = document.getElementById('creditIssuerScenarioName');
  if (!select) return;

  const previousValue = norm(select.value);
  const names = [...new Set(scenarioRows.map((r) => norm(r.scenario_id)).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b));

  select.innerHTML =
    `<option value="">-- New Scenario --</option>` +
    `<option value="BASE">BASE</option>` +
    names.map((n) => `<option value="${escAttr(n)}">${escHtml(n)}</option>`).join('');

  if (previousValue && (previousValue === 'BASE' || names.includes(previousValue))) {
    select.value = previousValue;
  }

  if (select.dataset.bound !== '1') {
    select.dataset.bound = '1';
    select.onchange = () => {
      const sel = norm(select.value);
      if (nameInput) nameInput.value = (sel && sel !== 'BASE') ? sel : '';
      renderCreditIssuerScenarioBuilder();
    };
  }
  updateDeleteButtonState();
}

function readRows(container) {
  const out = [];
  container.querySelectorAll('tbody tr').forEach((row) => {
    const issuer = norm(row.dataset.issuer);
    // Rank ist editierbar -> aus dem Input lesen (Fallback: urspruenglicher Wert).
    const rnk = norm(row.querySelector('input[data-fld="rnk"]')?.value ?? row.dataset.rnk);
    if (!issuer) return;
    const include = row.querySelector('input[data-fld="include"]')?.checked ? 1 : 0;
    const eadRaw = norm(row.querySelector('input[data-fld="ead"]')?.value);
    const rrRaw = norm(row.querySelector('input[data-fld="rr"]')?.value); // Prozent
    const rating = norm(row.querySelector('input[data-fld="rating"]')?.value);
    // EAD: de-DE-Eingabe -> Zahl. RR: Prozent-Eingabe -> Bruch (0..1) fuer Speicherung.
    const eadNum = eadRaw === '' ? null : parseDeNumber(eadRaw);
    const rrPct = rrRaw === '' ? null : parseDeNumber(rrRaw);
    out.push({
      issuer,
      rnk,
      include,
      ead: (eadNum != null && Number.isFinite(eadNum)) ? eadNum : null,
      rr: (rrPct != null && Number.isFinite(rrPct)) ? rrPct / 100 : null,
      rating_res: rating === '' ? null : rating,
    });
  });
  return out;
}

function bindSave(appState, scenarioRows) {
  const saveBtn = document.getElementById('creditIssuerSaveScenarioBtn');
  const nameInput = document.getElementById('creditIssuerScenarioName');
  const container = document.getElementById('creditIssuerScenarioTableData');
  if (!saveBtn || !nameInput || !container) return;

  saveBtn.onclick = () => {
    const scenarioId = norm(nameInput.value);
    if (!scenarioId) { showError('Scenario name missing'); return; }
    if (scenarioId === 'BASE') { showError('BASE cannot be overwritten'); return; }

    const rows = readRows(container);
    if (!rows.length) { showError('No issuers to save'); return; }

    const nowIso = new Date().toISOString();

    // Rank ist Teil des Schluessels UND editierbar -> Szenario komplett neu schreiben
    // (erst loeschen, dann einfuegen). So bleiben bei geaenderten Raengen keine
    // verwaisten Zeilen zurueck. node-sqlite3 serialisiert die Ops und die IPC-Nachrichten
    // kommen in Reihenfolge an -> erase laeuft vor den inserts.
    window.api.send('erase-data', {
      cleanTableName: TABLE_SCEN,
      uniqueIdentifier: { column: 'scenario_id', value: scenarioId },
    });

    // Dedupe je (issuer, rnk) — letzte Zeile gewinnt (verhindert PK-Kollisionen, falls
    // per "Rank for all" mehrere Raenge eines Issuers auf denselben Rang gesetzt wurden).
    const byKey = new Map();
    rows.forEach((r) => byKey.set(keyOf(r.issuer, r.rnk), r));

    for (const { issuer, rnk, include, ead, rr, rating_res } of byKey.values()) {
      window.api.send('add-new-row', {
        cleanTableName: TABLE_SCEN,
        newRowData: { scenario_id: scenarioId, issuer, rnk, include, ead, rr, rating_res, updated_at: nowIso },
      });
    }

    showSuccess(`Credit scenario "${scenarioId}" saved`);
    const select = document.getElementById('creditIssuerScenarioSelect');
    if (select) select.value = scenarioId;
    updateDeleteButtonState();
  };
}

function bindDelete(appState, scenarioRows) {
  const deleteBtn = document.getElementById('creditIssuerDeleteScenarioBtn');
  const select = document.getElementById('creditIssuerScenarioSelect');
  if (!deleteBtn) return;

  deleteBtn.onclick = () => {
    const scenarioId = norm(select?.value);
    if (!scenarioId || scenarioId === 'BASE') { showError('BASE cannot be deleted'); return; }
    if (!window.confirm(`Delete credit scenario "${scenarioId}"? This cannot be undone.`)) return;

    window.api.send('erase-data', {
      cleanTableName: TABLE_SCEN,
      uniqueIdentifier: { column: 'scenario_id', value: scenarioId },
    });

    showSuccess(`Credit scenario "${scenarioId}" deleted`);
    if (select) select.value = '';
    const nameInput = document.getElementById('creditIssuerScenarioName');
    if (nameInput) nameInput.value = '';
    updateDeleteButtonState();
  };
  updateDeleteButtonState();
}

function updateDeleteButtonState() {
  const btn = document.getElementById('creditIssuerDeleteScenarioBtn');
  const select = document.getElementById('creditIssuerScenarioSelect');
  if (!btn) return;
  const selected = norm(select?.value);
  btn.disabled = !selected || selected === 'BASE';
}

// =============================================================================
// SET (aktives Credit-Issuer-Szenario) — CREDIT_ISSUER_ACTIVE (id=1).
// =============================================================================
export function renderCreditIssuerScenarioSetPanel() {
  if (!setPanelListenersInstalled) {
    document.addEventListener('creditissuer:scenario:ready', renderCreditIssuerScenarioSetPanel);
    document.addEventListener('creditissuer:active:ready', renderCreditIssuerScenarioSetPanel);
    setPanelListenersInstalled = true;
  }

  const container = document.getElementById('creditIssuerScenarioSetContainer');
  if (!container) return;

  const appState = window.appState;
  if (!appState) return;

  const scenarioRows = appState.getCreditIssuerScenarioData?.() || [];
  const activeRows = appState.getCreditIssuerActive?.() || [];

  const names = [...new Set(scenarioRows.map((r) => norm(r.scenario_id)).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b));
  const scenarios = ['BASE', ...names];

  let active = norm(activeRows[0]?.scenario_id) || 'BASE';
  if (!scenarios.includes(active)) active = 'BASE';

  const options = scenarios
    .map((s) => `<option value="${escAttr(s)}"${s === active ? ' selected' : ''}>${escHtml(s)}</option>`)
    .join('');

  container.innerHTML = `
    <table class="ml-table">
      <thead><tr><th>Scope</th><th>Active Scenario</th></tr></thead>
      <tbody>
        <tr>
          <td>Credit issuers (all)</td>
          <td><select id="creditIssuerScenarioActiveSelect">${options}</select></td>
        </tr>
      </tbody>
    </table>
  `;

  const applyBtn = document.getElementById('applyCreditIssuerScenarioChanges');
  if (applyBtn && applyBtn.dataset.bound !== '1') {
    applyBtn.dataset.bound = '1';
    applyBtn.onclick = () => {
      const sel = document.getElementById('creditIssuerScenarioActiveSelect');
      const scenarioId = norm(sel?.value) || 'BASE';
      window.api.send('update-data', {
        cleanTableName: TABLE_ACTIVE,
        uniqueIdentifier: { column: 'id', value: 1 },
        newData: { scenario_id: scenarioId },
      });
      // Nur das aktive Szenario setzen — KEIN automatischer Neu-Lauf. Der Override wirkt
      // beim naechsten Credit-Lauf (die EAD/LGD/PD-Tabelle ist ein berechneter Output);
      // den Lauf startet der Nutzer selbst (Calculate Credit Risk).
      showSuccess(`Active credit scenario: ${scenarioId}. Run Credit Risk to apply.`);
    };
  }
}

// --- kleine HTML-Escapes ---
function escHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function escAttr(s) {
  return escHtml(s).replace(/"/g, '&quot;');
}
