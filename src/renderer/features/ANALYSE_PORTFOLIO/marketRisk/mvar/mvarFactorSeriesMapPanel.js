'use strict';

function getMappingStatus(row) {
  const linked = String(row.linked_ts_col ?? '').trim();

  if (!linked) return 'invalid';

  const status = String(
    row.mapping_status ??
    row.status ??
    ''
  ).trim().toLowerCase();

  if (status === 'exact' || status === 'ok') return 'exact';
  if (status === 'manual') return 'manual';
  if (status === 'invalid') return 'invalid';

  return 'manual';
}

function getMappingStatusLabel(status) {
  if (status === 'exact') return 'OK';
  if (status === 'manual') return 'Manual';
  return 'Invalid';
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function isChecked(value) {
  return Number(value) === 1 || value === true ? 'checked' : '';
}

// Aktuell gewähltes = aktives Szenario. null = beim ersten Render aus localStorage
// initialisieren (zeigt das zuletzt aktivierte Szenario).
let __selectedScenario = null;

// Aktives Szenario persistieren: DB (MarketVaR_FactorSeriesMap_Active) für den
// MVaR-Lauf + localStorage für die Panel-Anzeige. Beides schreibt nur dieses Panel.
function persistActiveScenario(scenario) {
  const s = String(scenario || 'default').trim() || 'default';
  try { localStorage.setItem('mvarFactorMapActiveScenario', s); } catch (_) {}
  if (window.api?.send) {
    window.api.send('update-data', {
      cleanTableName: 'MarketVaR_FactorSeriesMap_Active',
      rowIndex: 0,
      uniqueIdentifier: { column: 'id', value: 1 },
      newData: { scenario: s },
    });
  }
  // Risk-Factor-Chart (Scenario Period) auf das aktive Szenario re-rendern lassen.
  try { document.dispatchEvent(new Event('mvar:factor-map-changed')); } catch (_) {}
}

function readMvarFactorSeriesMapRowsFromDom() {
  const tableRows = Array.from(
    document.querySelectorAll('#mvarFactorSeriesMapTableBody tr[data-factor-id]')
  );

  return tableRows.map((tr) => {
    const factorId = tr.dataset.factorId;

    const getInput = (field) =>
      tr.querySelector(`[data-field="${field}"]`);

    const linkedInput = getInput('linked_ts_col');
    const activeInput = getInput('is_active');
    const proxyInput = getInput('allow_proxy');
    const scaleInput = getInput('scale');
    const commentInput = getInput('comment');

    return {
      scenario: __selectedScenario,
      factor_id: factorId,
      linked_ts_col: linkedInput?.value?.trim() || '',
      is_active: activeInput?.checked ? 1 : 0,
      allow_proxy: proxyInput?.checked ? 1 : 0,
      scale: Number(scaleInput?.value || 1),
      comment: commentInput?.value?.trim() || '',
    };
  });
}

function bindMvarFactorSeriesMapSaveButton() {
  const btn = document.getElementById('saveMvarFactorSeriesMapButton');

  if (!btn) {
    console.warn('[MVAR FACTOR MAP] save button missing: saveMvarFactorSeriesMapButton');
    return;
  }

  if (btn.dataset.bound === '1') {
    return;
  }

  btn.dataset.bound = '1';

    btn.addEventListener('click', () => {
    const rows = readMvarFactorSeriesMapRowsFromDom();

    // console.log('[MVAR FACTOR MAP SAVE PAYLOAD]', rows);
    window.__mvarFactorSeriesMapSavePayload = rows;

    if (!window.api?.send) {
        console.error('[MVAR FACTOR MAP] window.api.send missing');
        return;
    }

    rows.forEach((row, rowIndex) => {
        window.api.send('update-data', {
        cleanTableName: 'MarketVaR_FactorSeriesMap',
        rowIndex,
        uniqueIdentifier: {
            composite: true,
            columns: { scenario: row.scenario, factor_id: row.factor_id },
        },
        newData: {
            linked_ts_col: row.linked_ts_col,
            is_active: row.is_active,
            allow_proxy: row.allow_proxy,
            scale: row.scale,
            comment: row.comment,
            updated_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
        },
        });
    });

    btn.textContent = 'Saving...';

    setTimeout(() => {
        btn.textContent = 'Save Mapping';
    }, 1200);
    });
}

let __factorsReady = false;   // true, sobald einmal mit Faktor-Optionen gerendert
let __tbltsBound = false;     // tblts:ready-Listener nur einmal binden

// Risikofaktoren = Spalten der historischen Zeitreihe (tblTS), wie im Factor-Chart.
function getFactorOptions(appState) {
  const rows = appState?.getTblTSData?.() || [];
  if (!rows.length) return [];
  const keys = Object.keys(rows[0]);
  const dateKey = keys.find((k) => /date|datum/i.test(k)) || keys[0];
  return keys.filter((k) => k !== dateKey);
}

// <select> für "Linked Time Series": Faktoren + aktueller Wert (auch wenn tblTS
// noch nicht geladen ist). Save bleibt kompatibel, da .value gelesen wird.
function buildLinkedSelect(current, factorOpts) {
  const cur = String(current ?? '').trim();
  const opts = ['', ...factorOpts];
  if (cur && !opts.includes(cur)) opts.push(cur);
  return '<select class="mvar-factor-map-input" data-field="linked_ts_col">'
    + opts
      .map((o) => `<option value="${escapeHtml(o)}"${o === cur ? ' selected' : ''}>${escapeHtml(o || '—')}</option>`)
      .join('')
    + '</select>';
}

// Aktive Tabellen-Filter (leer = alle).
let __filterType = '';
let __filterCcy = '';

// Typ + CCY aus dem factor_id ("IR:EUR:5Y" -> type=IR, ccy=EUR).
function factorTypeCcy(fid) {
  const p = String(fid || '').split(':');
  return { type: (p[0] || '').trim(), ccy: (p[1] || '').trim() };
}

// Rating-Reihenfolge = Spiegel der DB-Tabelle RatingScale (rating, rating_index).
const RATING_ORDER = {
  AAA: 0, 'AA+': 1, AA: 2, 'AA-': 3, 'A+': 4, A: 5, 'A-': 6,
  'BBB+': 7, BBB: 8, 'BBB-': 9, 'BB+': 10, BB: 11, 'BB-': 12,
  'B+': 13, B: 14, 'B-': 15, 'CCC+': 16, CCC: 17, 'CCC-': 18,
};

// Faktor-Sortierung: gruppiert nach Prefix (IR:EUR, IR:USD, CS:EUR …), innerhalb
// nach Tenor numerisch (1Y < 2Y < 10Y). Nicht-Tenoren (z.B. CS-Buckets) nach Text.
function parseFactorKey(fid) {
  const s = String(fid || '');
  const i = s.lastIndexOf(':');
  const head = i >= 0 ? s.slice(0, i) : s;
  const last = i >= 0 ? s.slice(i + 1) : '';
  const m = last.match(/^(\d+)\s*([A-Za-z]*)$/);
  let tenor = 0;
  if (m) {
    const n = parseInt(m[1], 10);
    const u = (m[2] || 'Y').toUpperCase();
    tenor = u.startsWith('Y') ? n * 12 : u.startsWith('M') ? n : u.startsWith('W') ? n / 4 : n;
  }
  return { head, tenor, last, isTenor: !!m };
}
function factorSortCompare(fa, fb) {
  const pa = parseFactorKey(fa), pb = parseFactorKey(fb);
  if (pa.head !== pb.head) return pa.head < pb.head ? -1 : 1;
  // Ratings nach RatingScale-Reihenfolge (AAA, AA+, AA, AA-, A+, …).
  const ra = RATING_ORDER[pa.last], rb = RATING_ORDER[pb.last];
  if (ra != null && rb != null && ra !== rb) return ra - rb;
  // Tenoren numerisch (1Y < 2Y < 10Y).
  if (pa.isTenor && pb.isTenor && pa.tenor !== pb.tenor) return pa.tenor - pb.tenor;
  return pa.last < pb.last ? -1 : (pa.last > pb.last ? 1 : 0);
}

// Distinct-Szenarien aus den Store-Zeilen (immer inkl. 'default').
function getScenarioList(rows) {
  const set = new Set(['default']);
  (rows || []).forEach((r) => {
    const s = String(r.scenario || 'default').trim() || 'default';
    set.add(s);
  });
  return [...set];
}

// "Save as new scenario…": legt aus den aktuellen Zeilen ein neues Szenario an
// (per vorhandenem add-new-row-CRUD, ein Insert je Faktor).
function bindSaveAsNewScenarioButton(appState) {
  const btn = document.getElementById('saveMvarFactorSeriesMapAsButton');
  if (!btn || btn.dataset.bound === '1') return;
  btn.dataset.bound = '1';

  btn.addEventListener('click', () => {
    const nameInput = document.getElementById('factorMapNewScenarioName');
    const name = String(nameInput?.value || '').trim();
    if (!name) { nameInput?.focus(); return; }
    if (name.toLowerCase() === 'default') {
      window.alert('Use "Save Mapping" to edit the default scenario.');
      nameInput?.focus();
      return;
    }
    if (!window.api?.send) return;

    // Vollständiges Set: ALLE Faktoren des aktuellen Szenarios aus dem Store,
    // überlagert mit den (evtl. gefilterten) DOM-Bearbeitungen -> auch bei
    // aktivem Filter wird das neue Szenario komplett angelegt.
    const edited = new Map(
      readMvarFactorSeriesMapRowsFromDom().map((r) => [r.factor_id, r])
    );
    const source = (appState?.getMarketVarFactorSeriesMap?.() || [])
      .filter((r) => String(r.scenario || 'default').trim() === __selectedScenario);
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

    source.forEach((base) => {
      const e = edited.get(base.factor_id);
      window.api.send('add-new-row', {
        cleanTableName: 'MarketVaR_FactorSeriesMap',
        newRowData: {
          scenario: name,
          factor_id: base.factor_id,
          linked_ts_col: (e ? e.linked_ts_col : base.linked_ts_col) || '',
          is_active: e ? e.is_active : (Number(base.is_active) ? 1 : 0),
          allow_proxy: e ? e.allow_proxy : (Number(base.allow_proxy) ? 1 : 0),
          scale: e ? e.scale : Number(base.scale ?? 1),
          comment: (e ? e.comment : base.comment) || '',
          updated_at: now,
        },
      });
    });

    // Nach dem CRUD-Refresh (Store push -> re-render) wird dieses Szenario gezeigt.
    __selectedScenario = name;
    persistActiveScenario(name);   // neues Szenario direkt aktiv setzen
    if (nameInput) nameInput.value = '';
    btn.textContent = 'Saving...';
    setTimeout(() => { btn.textContent = 'Save as new scenario…'; }, 1200);
  });
}

// "Delete scenario": löscht alle Zeilen des gewählten Szenarios (erase-data,
// WHERE scenario = ?). 'default' ist geschützt. Mit Bestätigungs-Warnung.
function bindDeleteScenarioButton(appState) {
  const btn = document.getElementById('deleteMvarFactorSeriesMapScenarioButton');
  if (!btn) return;
  btn.disabled = (__selectedScenario === 'default');   // Default nicht löschbar
  if (btn.dataset.bound === '1') return;
  btn.dataset.bound = '1';

  btn.addEventListener('click', () => {
    const sc = __selectedScenario;
    if (!sc || sc === 'default') {
      window.alert('The default scenario cannot be deleted.');
      return;
    }
    if (!window.confirm(`Delete scenario "${sc}"? This cannot be undone.`)) return;
    if (!window.api?.send) return;

    window.api.send('erase-data', {
      cleanTableName: 'MarketVaR_FactorSeriesMap',
      uniqueIdentifier: { column: 'scenario', value: sc },
    });

    // Zurück auf 'default' und default aktiv setzen.
    __selectedScenario = 'default';
    persistActiveScenario('default');
    renderMvarFactorSeriesMapPanel(appState);
  });
}

// Szenario-Dropdown füllen + Change-Handler + Save-as-Button binden.
function populateScenarioDropdown(appState, rows) {
  const sel = document.getElementById('factorMapScenario');
  if (sel) {
    // Beim ersten Render das zuletzt aktive Szenario aus localStorage übernehmen.
    if (__selectedScenario == null) {
      let saved = 'default';
      try { saved = localStorage.getItem('mvarFactorMapActiveScenario') || 'default'; } catch (_) {}
      __selectedScenario = saved;
    }
    const list = getScenarioList(rows);
    if (!list.includes(__selectedScenario)) __selectedScenario = 'default';
    sel.innerHTML = list
      .map((s) => `<option value="${escapeHtml(s)}"${s === __selectedScenario ? ' selected' : ''}>${escapeHtml(s)}</option>`)
      .join('');
    sel.value = __selectedScenario;
    if (sel.dataset.bound !== '1') {
      sel.dataset.bound = '1';
      sel.addEventListener('change', () => {
        __selectedScenario = sel.value || 'default';
        persistActiveScenario(__selectedScenario);   // = aktiv für den MVaR-Lauf
        renderMvarFactorSeriesMapPanel(appState);
      });
    }
  }
  bindSaveAsNewScenarioButton(appState);
  bindDeleteScenarioButton(appState);
}

// Filter-Dropdowns (Type/CCY) aus den Faktoren des aktuellen Szenarios füllen.
function populateFilterDropdowns(appState, scenarioRows) {
  const typeSel = document.getElementById('factorMapFilterType');
  const ccySel = document.getElementById('factorMapFilterCcy');
  const types = new Set();
  const ccys = new Set();
  (scenarioRows || []).forEach((r) => {
    const tc = factorTypeCcy(r.factor_id);
    if (tc.type) types.add(tc.type);
    if (tc.ccy) ccys.add(tc.ccy);
  });

  const fill = (sel, values, current) => {
    if (!sel) return current;
    const list = [...values].sort();
    const cur = list.includes(current) ? current : '';
    sel.innerHTML = '<option value="">All</option>'
      + list.map((v) => `<option value="${escapeHtml(v)}"${v === cur ? ' selected' : ''}>${escapeHtml(v)}</option>`).join('');
    sel.value = cur;
    return cur;
  };

  __filterType = fill(typeSel, types, __filterType);
  __filterCcy = fill(ccySel, ccys, __filterCcy);

  if (typeSel && typeSel.dataset.bound !== '1') {
    typeSel.dataset.bound = '1';
    typeSel.addEventListener('change', () => {
      __filterType = typeSel.value || '';
      renderMvarFactorSeriesMapPanel(appState);
    });
  }
  if (ccySel && ccySel.dataset.bound !== '1') {
    ccySel.dataset.bound = '1';
    ccySel.addEventListener('change', () => {
      __filterCcy = ccySel.value || '';
      renderMvarFactorSeriesMapPanel(appState);
    });
  }
}

export function renderMvarFactorSeriesMapPanel(appState) {
  const tbody = document.getElementById('mvarFactorSeriesMapTableBody');

  if (!tbody) {
    console.warn('[MVAR FACTOR MAP] tbody missing: mvarFactorSeriesMapTableBody');
    return;
  }

  // tblTS-Ready einmalig binden: wird die Faktorliste erst NACH dem ersten Render
  // geladen, einmal neu rendern, damit die Dropdowns die Faktoren bekommen.
  // Guard __factorsReady verhindert spätere Re-Renders (keine Edit-Überschreibung).
  if (!__tbltsBound) {
    __tbltsBound = true;
    document.addEventListener('tblts:ready', () => {
      if (__factorsReady) return;
      if (!document.getElementById('mvarFactorSeriesMapTableBody')) return;
      if (getFactorOptions(appState).length > 0) renderMvarFactorSeriesMapPanel(appState);
    });
  }

  const allRows =
    appState?.getMarketVarFactorSeriesMap?.() ||
    appState?.marketVarFactorSeriesMap ||
    [];

  // Dropdown (default + benannte Szenarien) füllen, dann auf das gewählte filtern.
  populateScenarioDropdown(appState, allRows);
  const scenarioRows = allRows.filter(
    (r) => String(r.scenario || 'default').trim() === __selectedScenario
  );
  populateFilterDropdowns(appState, scenarioRows);
  const rows = scenarioRows
    .filter((r) => {
      const tc = factorTypeCcy(r.factor_id);
      return (!__filterType || tc.type === __filterType)
          && (!__filterCcy || tc.ccy === __filterCcy);
    })
    .sort((a, b) => factorSortCompare(a.factor_id, b.factor_id));

  if (!Array.isArray(rows) || rows.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7">${scenarioRows.length ? 'No factors match the filter.' : 'No mapping loaded.'}</td>
      </tr>
    `;

    bindMvarFactorSeriesMapSaveButton();
    return;
  }

    const factorOpts = getFactorOptions(appState);
    if (factorOpts.length > 0) __factorsReady = true;

    tbody.innerHTML = rows.map((row) => {
    const status = getMappingStatus(row);
    const statusLabel = getMappingStatusLabel(status);

    return `
        <tr
        data-factor-id="${escapeHtml(row.factor_id)}"
        class="mvar-map-row mvar-map-row--${status}">
        <td>${escapeHtml(row.factor_id)}</td>

        <td>
            <span class="mvar-map-status mvar-map-status--${status}">
            ${escapeHtml(statusLabel)}
            </span>
        </td>

        <td>
          ${buildLinkedSelect(row.linked_ts_col, factorOpts)}
        </td>

        <td>
          <input
            type="checkbox"
            data-field="is_active"
            ${isChecked(row.is_active)}
          />
        </td>

        <td>
          <input
            type="checkbox"
            data-field="allow_proxy"
            ${isChecked(row.allow_proxy)}
          />
        </td>

        <td>
          <input
            type="number"
            step="0.01"
            data-field="scale"
            value="${escapeHtml(row.scale ?? 1.0)}"
          />
        </td>

        <td>
          <input
            class="mvar-factor-map-input"
            data-field="comment"
            value="${escapeHtml(row.comment ?? '')}"
          />
        </td>
      </tr>
    `;
  }).join('');

  bindMvarFactorSeriesMapSaveButton();

  // console.log('[MVAR FACTOR MAP] rendered', rows.length);
}

export function handleMarketVarFactorSeriesMapData(rows, appState) {
  const safeRows = Array.isArray(rows) ? rows : [];

  console.log('[MVAR FACTOR MAP] handler called', {
    rows: safeRows.length,
    sample: safeRows[0],
    storeRows: appState?.getMarketVarFactorSeriesMap?.()?.length,
    hasAppState: !!appState,
  });

  renderMvarFactorSeriesMapPanel(appState);
}
