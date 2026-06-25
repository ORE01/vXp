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
            column: 'factor_id',
            value: row.factor_id,
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

  const rows =
    appState?.getMarketVarFactorSeriesMap?.() ||
    appState?.marketVarFactorSeriesMap ||
    [];

  if (!Array.isArray(rows) || rows.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7">No mapping loaded.</td>
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
