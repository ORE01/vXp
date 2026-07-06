'use strict';

// Create PD Scenario (historical PD by rating).
// Track A: BASE = PD_RATING_HISTORICAL (editable), named scenarios in
// PD_HIST_SCENARIO_DATA(scenario_id, rating, pd_historical). Rating-only
// (no CCY, no tenor). ALL writes go through the generic CRUD channels
// (update-data / add-new-row / erase-data) — no bespoke handlers.

import {
  showSuccess,
  showError,
} from '../../../../core/ui/notifications/notifications.js';

const TABLE_BASE = 'PD_RATING_HISTORICAL';
const TABLE_SCEN = 'PD_HIST_SCENARIO_DATA';
const TABLE_ACTIVE = 'PD_HIST_ACTIVE';

let pdHistBuilderListenersInstalled = false;
let pdHistSetPanelListenersInstalled = false;
let fillDownBound = false;

function norm(v) {
  return String(v == null ? '' : v).trim();
}

// tblTS/PD values may arrive as strings with comma decimals.
function toNum(v) {
  if (v == null || v === '') return null;
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function fmtVal(v) {
  const n = toNum(v);
  return n == null ? '' : n;
}

export function renderPDHistScenarioBuilder() {
  if (!pdHistBuilderListenersInstalled) {
    document.addEventListener('pdhist:base:ready', renderPDHistScenarioBuilder);
    document.addEventListener('pdhist:scenario:ready', renderPDHistScenarioBuilder);
    document.addEventListener('pdhist:active:ready', renderPDHistScenarioBuilder);
    pdHistBuilderListenersInstalled = true;
  }

  const container = document.getElementById('pdHistScenarioTableData');
  if (!container) return;

  const appState = window.appState;
  if (!appState) return;

  const baseRows = appState.getPDHistBaseData?.() || [];       // PD_RATING_HISTORICAL
  const scenarioRows = appState.getPDHistScenarioData?.() || []; // PD_HIST_SCENARIO_DATA

  // BASE-Werte + Rating-Liste (Reihenfolge = BASE-Reihenfolge).
  const baseByRating = new Map();
  const ratings = [];
  baseRows.forEach((r) => {
    const rating = norm(r.rating);
    if (!rating || baseByRating.has(rating)) return;
    baseByRating.set(rating, fmtVal(r.pd_historical));
    ratings.push(rating);
  });

  bindScenarioDropdown(appState, scenarioRows);

  if (!ratings.length) {
    container.innerHTML = `<p>No historical PD loaded (${TABLE_BASE}).</p>`;
    bindSave(appState, ratings, scenarioRows);
    bindDelete(appState, scenarioRows);
    return;
  }

  const select = document.getElementById('pdHistScenarioSelect');
  const selected = norm(select?.value); // '' = neu, 'BASE', oder Szenarioname

  // Werte je nach Auswahl: BASE oder das gewählte Szenario (fehlende Ratings
  // mit BASE vorbelegen, damit die Tabelle vollständig ist).
  let valueByRating;
  if (!selected || selected === 'BASE') {
    valueByRating = baseByRating;
  } else {
    const m = new Map();
    scenarioRows
      .filter((r) => norm(r.scenario_id) === selected)
      .forEach((r) => m.set(norm(r.rating), fmtVal(r.pd_historical)));
    valueByRating = new Map(
      ratings.map((rt) => [rt, m.has(rt) ? m.get(rt) : baseByRating.get(rt)])
    );
  }

  renderTable(container, ratings, valueByRating);

  bindFillDown(container);
  bindSave(appState, ratings, scenarioRows);
  bindDelete(appState, scenarioRows);
}

// ↓-Button: kopiert den Wert der Zeile in alle darunterliegenden Zeilen.
// Delegiert auf den (stabilen) Container -> nur einmal binden.
function bindFillDown(container) {
  if (fillDownBound) return;
  fillDownBound = true;

  container.addEventListener('click', (e) => {
    const btn = e.target.closest('.fill-down-btn');
    if (!btn || !container.contains(btn)) return;

    const row = btn.closest('tr');
    const input = row?.querySelector('input[data-rating]');
    if (!input) return;

    const value = input.value;
    let next = row.nextElementSibling;
    while (next) {
      const ni = next.querySelector('input[data-rating]');
      if (ni) ni.value = value;
      next = next.nextElementSibling;
    }
  });
}

function renderTable(container, ratings, valueByRating) {
  let html = `
    <div style="overflow:auto; max-width:100%;">
      <table class="ml-table">
        <thead>
          <tr><th>Rating</th><th>Historical PD</th></tr>
        </thead>
        <tbody>
  `;

  ratings.forEach((rating) => {
    const value = valueByRating.get(rating);
    html += `
      <tr>
        <td>${rating}</td>
        <td>
          <div style="display:flex; gap:4px; align-items:center;">
            <input
              type="number"
              step="any"
              value="${value === '' || value == null ? '' : value}"
              data-rating="${rating}"
              style="width:130px;"
            />
            <button
              class="fill-down-btn"
              title="Fill value down"
              style="padding:2px 6px; cursor:pointer; border:1px solid #888; border-radius:4px; background:#222; color:#fff;"
            >&#8595;</button>
          </div>
        </td>
      </tr>
    `;
  });

  html += `
        </tbody>
      </table>
    </div>
  `;

  container.innerHTML = html;
}

function bindScenarioDropdown(appState, scenarioRows) {
  const select = document.getElementById('pdHistScenarioSelect');
  const nameInput = document.getElementById('pdHistScenarioName');
  if (!select) return;

  const previousValue = norm(select.value);

  const names = [...new Set(
    scenarioRows.map((r) => norm(r.scenario_id)).filter(Boolean)
  )].sort((a, b) => a.localeCompare(b));

  // 'BASE' fix oben, dann benannte Szenarien; leerer Eintrag = neues Szenario.
  select.innerHTML =
    `<option value="">-- New Scenario --</option>` +
    `<option value="BASE">BASE</option>` +
    names.map((n) => `<option value="${n}">${n}</option>`).join('');

  if (previousValue && (previousValue === 'BASE' || names.includes(previousValue))) {
    select.value = previousValue;
  }

  if (select.dataset.bound !== '1') {
    select.dataset.bound = '1';
    select.onchange = () => {
      const sel = norm(select.value);
      if (nameInput) nameInput.value = sel && sel !== 'BASE' ? sel : (sel === 'BASE' ? 'BASE' : '');
      renderPDHistScenarioBuilder();
    };
  }

  updateDeleteButtonState();
}

function readInputs(container) {
  const inputs = container.querySelectorAll('input[data-rating]');
  const out = [];
  for (const input of inputs) {
    const rating = norm(input.dataset.rating);
    const raw = norm(input.value);
    if (!rating) continue;
    if (raw === '') { out.push({ rating, value: null }); continue; }
    const value = toNum(raw);
    if (value == null) return { error: `Invalid value for ${rating}` };
    out.push({ rating, value });
  }
  return { rows: out };
}

function bindSave(appState, ratings, scenarioRows) {
  const saveBtn = document.getElementById('pdHistSaveScenarioBtn');
  const nameInput = document.getElementById('pdHistScenarioName');
  const container = document.getElementById('pdHistScenarioTableData');
  if (!saveBtn || !nameInput || !container) return;

  saveBtn.onclick = () => {
    const scenarioId = norm(nameInput.value);
    if (!scenarioId) { showError('Scenario name missing'); return; }

    const parsed = readInputs(container);
    if (parsed.error) { showError(parsed.error); return; }

    const nowIso = new Date().toISOString();

    if (scenarioId === 'BASE') {
      // BASE = historische PD direkt in PD_RATING_HISTORICAL editieren.
      parsed.rows.forEach(({ rating, value }) => {
        window.api.send('update-data', {
          cleanTableName: TABLE_BASE,
          uniqueIdentifier: { column: 'rating', value: rating },
          newData: { pd_historical: value },
        });
      });
      showSuccess('Historical PD (BASE) saved');
      return;
    }

    // Benanntes Szenario: pro Rating upsert. Existiert (scenario_id, rating)
    // schon -> update-data (composite), sonst add-new-row.
    const existing = new Set(
      scenarioRows
        .filter((r) => norm(r.scenario_id) === scenarioId)
        .map((r) => norm(r.rating))
    );

    parsed.rows.forEach(({ rating, value }) => {
      if (existing.has(rating)) {
        window.api.send('update-data', {
          cleanTableName: TABLE_SCEN,
          uniqueIdentifier: {
            composite: true,
            columns: { scenario_id: scenarioId, rating },
          },
          newData: { pd_historical: value, updated_at: nowIso },
        });
      } else {
        window.api.send('add-new-row', {
          cleanTableName: TABLE_SCEN,
          newRowData: {
            scenario_id: scenarioId,
            rating,
            pd_historical: value,
            updated_at: nowIso,
          },
        });
      }
    });

    showSuccess(`PD scenario "${scenarioId}" saved`);

    const select = document.getElementById('pdHistScenarioSelect');
    if (select) select.value = scenarioId;
    updateDeleteButtonState();
  };
}

function bindDelete(appState, scenarioRows) {
  const deleteBtn = document.getElementById('pdHistDeleteScenarioBtn');
  const select = document.getElementById('pdHistScenarioSelect');
  if (!deleteBtn) return;

  deleteBtn.onclick = () => {
    const scenarioId = norm(select?.value);

    if (!scenarioId || scenarioId === 'BASE') {
      showError('BASE cannot be deleted');
      return;
    }

    if (!window.confirm(`Delete PD scenario "${scenarioId}"? This cannot be undone.`)) {
      return;
    }

    // Ganzes Szenario löschen: DELETE ... WHERE scenario_id = ?
    window.api.send('erase-data', {
      cleanTableName: TABLE_SCEN,
      uniqueIdentifier: { column: 'scenario_id', value: scenarioId },
    });

    showSuccess(`PD scenario "${scenarioId}" deleted`);

    if (select) select.value = '';
    const nameInput = document.getElementById('pdHistScenarioName');
    if (nameInput) nameInput.value = '';
    updateDeleteButtonState();
  };

  updateDeleteButtonState();
}

function updateDeleteButtonState() {
  const btn = document.getElementById('pdHistDeleteScenarioBtn');
  const select = document.getElementById('pdHistScenarioSelect');
  if (!btn) return;
  const selected = norm(select?.value);
  btn.disabled = !selected || selected === 'BASE';
}

// -----------------------------------------------------------------------------
// SET SCENARIO (aktives PD-Historical-Szenario) — im "Set Scenarios"-Panel.
// Rating-only -> ein einziges Dropdown (kein Per-CCY). Aktiv setzen via
// update-data auf PD_HIST_ACTIVE (eine Zeile, id=1).
// -----------------------------------------------------------------------------
export function renderPDHistScenarioSetPanel() {
  if (!pdHistSetPanelListenersInstalled) {
    document.addEventListener('pdhist:scenario:ready', renderPDHistScenarioSetPanel);
    document.addEventListener('pdhist:active:ready', renderPDHistScenarioSetPanel);
    pdHistSetPanelListenersInstalled = true;
  }

  const container = document.getElementById('pdHistScenarioSetContainer');
  if (!container) return;

  const appState = window.appState;
  if (!appState) return;

  const scenarioRows = appState.getPDHistScenarioData?.() || [];
  const activeRows = appState.getPDHistActive?.() || [];

  const names = [...new Set(
    scenarioRows.map((r) => norm(r.scenario_id)).filter(Boolean)
  )].sort((a, b) => a.localeCompare(b));

  const scenarios = ['BASE', ...names];

  let active = norm(activeRows[0]?.scenario_id) || 'BASE';
  if (!scenarios.includes(active)) active = 'BASE';

  const options = scenarios
    .map((s) => `<option value="${s}"${s === active ? ' selected' : ''}>${s}</option>`)
    .join('');

  container.innerHTML = `
    <table class="ml-table">
      <thead><tr><th>Scope</th><th>Active Scenario</th></tr></thead>
      <tbody>
        <tr>
          <td>Historical PD (all ratings)</td>
          <td><select id="pdHistScenarioActiveSelect">${options}</select></td>
        </tr>
      </tbody>
    </table>
  `;

  const applyBtn = document.getElementById('applyPdHistScenarioChanges');
  if (applyBtn && applyBtn.dataset.bound !== '1') {
    applyBtn.dataset.bound = '1';
    applyBtn.onclick = () => {
      const sel = document.getElementById('pdHistScenarioActiveSelect');
      const scenarioId = norm(sel?.value) || 'BASE';
      window.api.send('update-data', {
        cleanTableName: TABLE_ACTIVE,
        uniqueIdentifier: { column: 'id', value: 1 },
        newData: { scenario_id: scenarioId },
      });
      showSuccess(`Active PD scenario: ${scenarioId}`);
    };
  }
}
