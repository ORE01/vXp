// electron_app/src/renderer/features/products/structureTimeline/structureTimelineDrawer.js

'use strict';

import { parseDeNumber } from '../../../utils/tableCellFormats.js';

export function showStructureMessage(drawer, message, type = 'info') {
  const modal =
    document.getElementById('structureTimelineModal') ||
    drawer?.closest?.('#structureTimelineModal') ||
    drawer;

  if (!modal) return;

  let box = modal.querySelector('#structureInlineMessage');

  if (!box) {
    box = document.createElement('div');
    box.id = 'structureInlineMessage';

    box.style.position = 'sticky';
    box.style.top = '0';
    box.style.zIndex = '10';
    box.style.width = 'fit-content';
    box.style.maxWidth = '520px';
    box.style.margin = '0 auto 10px auto';
    box.style.padding = '6px 12px';
    box.style.borderRadius = '999px';
    box.style.fontSize = '12px';
    box.style.lineHeight = '1.3';
    box.style.border = '1px solid #ddd';
    box.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)';
    box.style.textAlign = 'center';
    box.style.whiteSpace = 'normal';

    const titleRow = modal.querySelector('h2')?.parentElement;

    if (titleRow) {
      titleRow.insertAdjacentElement('afterend', box);
    } else {
      modal.prepend(box);
    }
  }

  const styles = {
    info: {
      background: '#f4f4f4',
      color: '#333',
      border: '#ddd',
    },
    success: {
      background: '#eef8ee',
      color: '#176b26',
      border: '#b9dfbd',
    },
    warning: {
      background: '#fff7e6',
      color: '#8a5a00',
      border: '#ffd58a',
    },
    error: {
      background: '#fdeeee',
      color: '#9b1c1c',
      border: '#f1b4b4',
    },
  };

  const s = styles[type] || styles.info;

  box.style.background = s.background;
  box.style.color = s.color;
  box.style.borderColor = s.border;
  box.textContent = message;

  clearTimeout(box._hideTimer);

  box._hideTimer = setTimeout(() => {
    box.remove();
  }, 3500);
}

export function renderPayloadEditor(row) {
  const eventType = String(row?.eventType || '').toUpperCase();

  const payload = {
    ...(row?.payload || {}),
  };

  // ------------------------------------------------------------
  // Default editable payload fields per structure type
  // ------------------------------------------------------------

  if (
    eventType === 'COUPON_FIXED' ||
    eventType === 'FIXED_COUPON'
  ) {
    if (!Object.prototype.hasOwnProperty.call(payload, 'notional_factor')) {
      payload.notional_factor = 1;
    }

    if (!Object.prototype.hasOwnProperty.call(payload, 'rate')) {
      payload.rate = '';
    }
  }

  if (eventType === 'REDEMPTION') {
    if (!Object.prototype.hasOwnProperty.call(payload, 'notional_factor')) {
      payload.notional_factor = 1;
    }
  }

  if (eventType === 'COUPON_FLOATING') {
    if (!Object.prototype.hasOwnProperty.call(payload, 'index')) {
      payload.index = '';
    }

    if (!Object.prototype.hasOwnProperty.call(payload, 'tenor')) {
      payload.tenor = '';
    }

    if (!Object.prototype.hasOwnProperty.call(payload, 'gearing')) {
      payload.gearing = 1;
    }

    if (!Object.prototype.hasOwnProperty.call(payload, 'spread')) {
      payload.spread = 0;
    }

    if (!Object.prototype.hasOwnProperty.call(payload, 'cap')) {
      payload.cap = '';
    }

    if (!Object.prototype.hasOwnProperty.call(payload, 'floor')) {
      payload.floor = '';
    }

    if (!Object.prototype.hasOwnProperty.call(payload, 'notional_factor')) {
      payload.notional_factor = 1;
    }
  }

  if (eventType === 'CALL') {
    if (!Object.prototype.hasOwnProperty.call(payload, 'call_price')) {
      payload.call_price = 100;
    }

    if (!Object.prototype.hasOwnProperty.call(payload, 'notional_factor')) {
      payload.notional_factor = 1;
    }
  }

  const entries = Object.entries(payload);

  if (!entries.length) {
    return `
      <div style="margin-top:8px; color:#777;">
        No payload fields.
      </div>
    `;
  }

  return entries
    .map(([key, value]) => {
      const safeValue =
        value === null || value === undefined
          ? ''
          : typeof value === 'object'
            ? JSON.stringify(value)
            : String(value);

      return `
        <label style="display:block; font-size:12px; margin-top:8px;">
          ${key}
        </label>
        <input
          data-payload-key="${key}"
          value="${safeValue}"
          style="width:100%; box-sizing:border-box; margin-bottom:4px;"
        />
      `;
    })
    .join('');
}

export function renderDrawer(drawer, row, container, prodId, options = {}) {
  if (!drawer || !row) return;

  const onRefresh =
    typeof options.onRefresh === 'function'
      ? options.onRefresh
      : () => {};

  drawer.innerHTML = `
    <h3 style="margin-top:0;">${row.eventType || 'Event'}</h3>

    <div style="font-size:12px; color:#555; margin-bottom:12px;">
      <div><strong>Product:</strong> ${row.productId}</div>
      <div><strong>Date:</strong> ${row.eventDate}</div>
      <div><strong>Active:</strong> ${row.isActive ? 'Yes' : 'No'}</div>
      <div><strong>Source:</strong> ${row.sourceTable || '-'} ${row.sourceRowId || ''}</div>
    </div>

    <label style="display:block; font-size:12px; margin-top:8px;">Event Date</label>
    <input
      id="structureEventDateInput"
      value="${row.eventDate || ''}"
      style="width:100%; box-sizing:border-box; margin-bottom:8px;"
    />

    <label style="display:block; font-size:12px; margin-top:8px;">Event Type</label>
    <input
      id="structureEventTypeInput"
      value="${row.eventType || ''}"
      style="width:100%; box-sizing:border-box; margin-bottom:8px;"
    />

    <hr style="margin:14px 0;" />

    <strong>Payload</strong>

    ${renderPayloadEditor(row)}

    <div style="display:flex; gap:8px; margin-top:14px;">
      <button id="saveStructureEventRow">
        Save Row
      </button>

      <button id="deleteStructureEventRow" style="color:#b00020;">
        Delete Row
      </button>
    </div>

    <pre style="margin-top:14px; font-size:11px; background:#f0f0f0; padding:8px; overflow:auto; max-height:220px;">${JSON.stringify(row.raw, null, 2)}</pre>
  `;

  drawer
    .querySelector('#saveStructureEventRow')
    ?.addEventListener('click', () => {
      const structureId =
        row.raw.structure_id ||
        row.raw.STRUCTURE_ID;

      if (!structureId) {
        console.error('[STRUCTURE TIMELINE SAVE] missing structure_id', row);

        showStructureMessage(
          drawer,
          'Save failed: missing structure_id.',
          'error'
        );

        return;
      }

      const structureDate =
        drawer.querySelector('#structureEventDateInput')?.value || '';

      const structureType =
        drawer.querySelector('#structureEventTypeInput')?.value || '';

      const payload = { ...row.payload };

      drawer.querySelectorAll('[data-payload-key]').forEach((input) => {
        const key = input.dataset.payloadKey;
        const rawValue = input.value;

        const numericValue = parseDeNumber(rawValue);

        payload[key] =
          rawValue !== '' && Number.isFinite(numericValue)
            ? numericValue
            : rawValue;
      });

      const newData = {
        structure_date: structureDate,
        structure_type: structureType,
        structure_payload: JSON.stringify(payload),
      };

      console.log('[STRUCTURE TIMELINE SAVE]', {
        structureId,
        newData,
        row,
      });

      window.api.send('update-data', {
        cleanTableName: 'PRODUCT_STRUCTURE',
        rowIndex: null,
        newData,
        uniqueIdentifier: {
          column: 'structure_id',
          value: structureId,
        },
      });

      showStructureMessage(
        drawer,
        `Row ${structureId} submitted for update.`,
        'success'
      );

      onRefresh(container, prodId);
    });

  drawer
    .querySelector('#deleteStructureEventRow')
    ?.addEventListener('click', () => {
      const structureId =
        row.raw.structure_id ||
        row.raw.STRUCTURE_ID;

      if (!structureId) {
        console.error('[STRUCTURE TIMELINE DELETE] missing structure_id', row);

        showStructureMessage(
          drawer,
          'Delete failed: missing structure_id.',
          'error'
        );

        return;
      }

      const confirmed =
        drawer.dataset.confirmDeleteStructureId === String(structureId);

      if (!confirmed) {
        drawer.dataset.confirmDeleteStructureId = String(structureId);

        showStructureMessage(
          drawer,
          `Click Delete Row again to permanently delete row ${structureId}.`,
          'warning'
        );

        return;
      }

      delete drawer.dataset.confirmDeleteStructureId;

      console.log('[STRUCTURE TIMELINE DELETE]', {
        structureId,
        row,
      });

      window.api.send('erase-data', {
        cleanTableName: 'PRODUCT_STRUCTURE',
        uniqueIdentifier: {
          column: 'structure_id',
          value: structureId,
        },
      });

      showStructureMessage(
        drawer,
        `Row ${structureId} submitted for deletion.`,
        'success'
      );

      onRefresh(container, prodId);
    });
}

export function renderGroupedDateDrawer(drawer, group, container, prodId, options = {}) {
  if (!drawer || !group?.rows?.length) return;

  const onRefresh =
    typeof options.onRefresh === 'function'
      ? options.onRefresh
      : () => {};

  drawer.innerHTML = `
    <h3 style="margin-top:0;">${group.eventDate}</h3>

    <div style="font-size:12px; color:#555; margin-bottom:12px;">
      <div><strong>Product:</strong> ${prodId}</div>
      <div><strong>Date:</strong> ${group.eventDate}</div>
      <div><strong>Events:</strong> ${group.typeSummary || '-'}</div>
    </div>

    <div
      id="structureGroupedEventButtons"
      style="display:flex; flex-wrap:wrap; gap:6px; margin-bottom:12px;"
    >
      ${group.rows.map((row, idx) => `
        <button
          type="button"
          data-event-index="${idx}"
          style="font-size:12px;"
        >
          ${row.eventType || 'Event'}
        </button>
      `).join('')}
    </div>

    <div id="structureGroupedEventDetail"></div>
  `;

  const detail = drawer.querySelector('#structureGroupedEventDetail');

  function openEvent(index) {
    const row = group.rows[index];

    if (!row) return;

    drawer
      .querySelectorAll('[data-event-index]')
      .forEach((btn) => {
        btn.style.fontWeight =
          Number(btn.dataset.eventIndex) === index
            ? '700'
            : '400';
      });

    renderDrawer(detail, row, container, prodId, {
      onRefresh,
    });
  }

  drawer
    .querySelectorAll('[data-event-index]')
    .forEach((button) => {
      button.addEventListener('click', () => {
        openEvent(Number(button.dataset.eventIndex));
      });
    });

  openEvent(0);
}