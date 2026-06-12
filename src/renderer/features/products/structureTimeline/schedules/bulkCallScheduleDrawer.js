'use strict';

import {
  getCouponRows,
} from '../complexTimelineData.js';

import {
  showStructureMessage,
} from '../complexTimelineDrawer.js';

import {
  sendAddProductStructureRow,
} from './structureRowApi.js';

// ------------------------------------------------------------
// Bulk CALL schedule
// ------------------------------------------------------------

export function renderBulkCallDrawer(drawer, prodId, container, rows, options = {}) {
  const onRefresh =
    typeof options.onRefresh === 'function'
      ? options.onRefresh
      : () => {};

  const couponRows = getCouponRows(rows);

  drawer.innerHTML = `
    <h3 style="margin-top:0;">Add Call Schedule</h3>

    <div style="font-size:12px; color:#555; margin-bottom:12px;">
      <div><strong>Product:</strong> ${prodId}</div>
      <div><strong>Basis:</strong> existing coupon dates</div>
      <div><strong>Available coupon dates:</strong> ${couponRows.length}</div>
      <div><strong>Existing calls:</strong> ${
        rows.filter((r) => String(r.eventType || '').toUpperCase() === 'CALL').length
      }</div>
    </div>

    <label style="display:block; font-size:12px; margin-top:8px;">First Call Date</label>
    <input
      id="bulkCallFirstDateInput"
      placeholder="YYYY-MM-DD"
      style="width:100%; box-sizing:border-box; margin-bottom:8px;"
    />

    <label style="display:block; font-size:12px; margin-top:8px;">Last Call Date</label>
    <input
      id="bulkCallLastDateInput"
      placeholder="YYYY-MM-DD"
      style="width:100%; box-sizing:border-box; margin-bottom:8px;"
    />

    <label style="display:block; font-size:12px; margin-top:8px;">Call Price</label>
    <input
      id="bulkCallPriceInput"
      value="100"
      style="width:100%; box-sizing:border-box; margin-bottom:8px;"
    />

    <label style="display:block; font-size:12px; margin-top:8px;">Notional Factor</label>
    <input
      id="bulkCallNotionalFactorInput"
      value="1"
      style="width:100%; box-sizing:border-box; margin-bottom:8px;"
    />

    <div
      id="bulkCallPreview"
      style="margin-top:12px; padding:8px; background:#f4f4f4; border:1px solid #ddd; max-height:180px; overflow:auto; font-size:12px;"
    >
      Existing calls will appear here.
    </div>

    <button id="saveBulkCallRows" style="margin-top:10px;">
      Create Call Schedule
    </button>
  `;

  const preview = drawer.querySelector('#bulkCallPreview');

  function renderBulkPreview() {
    const firstDate = drawer.querySelector('#bulkCallFirstDateInput')?.value || '';
    const lastDate = drawer.querySelector('#bulkCallLastDateInput')?.value || '';

    const existingCallDates = new Set(
      rows
        .filter((r) => String(r.eventType || '').toUpperCase() === 'CALL')
        .map((r) => String(r.eventDate))
    );

    const relevantCouponRows = couponRows.filter((r) => {
      if (firstDate && String(r.eventDate) < String(firstDate)) return false;
      if (lastDate && String(r.eventDate) > String(lastDate)) return false;
      return true;
    });

    if (!preview) return;

    if (!relevantCouponRows.length) {
      preview.innerHTML = '<em>No coupon dates in selected range.</em>';
      return;
    }

    preview.innerHTML = `
      <strong>Preview</strong>
      <table style="width:100%; border-collapse:collapse; margin-top:6px;">
        <tbody>
          ${relevantCouponRows.map((r) => {
            const hasCall = existingCallDates.has(String(r.eventDate));

            return `
              <tr>
                <td style="padding:3px; border-bottom:1px solid #ddd;">${r.eventDate}</td>
                <td style="padding:3px; border-bottom:1px solid #ddd;">
                  ${hasCall ? 'CALL already exists' : 'will create CALL'}
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;
  }

  drawer
    .querySelector('#bulkCallFirstDateInput')
    ?.addEventListener('input', renderBulkPreview);

  drawer
    .querySelector('#bulkCallLastDateInput')
    ?.addEventListener('input', renderBulkPreview);

  renderBulkPreview();

  drawer
    .querySelector('#saveBulkCallRows')
    ?.addEventListener('click', () => {
      const firstDate = drawer.querySelector('#bulkCallFirstDateInput')?.value || '';
      const lastDate = drawer.querySelector('#bulkCallLastDateInput')?.value || '';
      const callPrice = Number(drawer.querySelector('#bulkCallPriceInput')?.value || 100);
      const notionalFactor = Number(drawer.querySelector('#bulkCallNotionalFactorInput')?.value || 1);

      if (!firstDate || !lastDate) {
        showStructureMessage(
          drawer,
          'Please enter First Call Date and Last Call Date.',
          'warning'
        );
        return;
      }

      const selectedCouponRows = couponRows.filter((r) =>
        String(r.eventDate) >= String(firstDate) &&
        String(r.eventDate) <= String(lastDate)
      );

      if (!selectedCouponRows.length) {
        showStructureMessage(
          drawer,
          'No coupon dates found in selected range.',
          'warning'
        );
        return;
      }

      const existingCallDates = new Set(
        rows
          .filter((r) => String(r.eventType || '').toUpperCase() === 'CALL')
          .map((r) => String(r.eventDate))
      );

      const rowsToCreate = selectedCouponRows.filter(
        (r) => !existingCallDates.has(String(r.eventDate))
      );

      if (!rowsToCreate.length) {
        showStructureMessage(
          drawer,
          'All selected coupon dates already have CALL rows.',
          'info'
        );
        return;
      }

      rowsToCreate.forEach((r, idx) => {
        const newRowData = {
          product_id: prodId,
          leg_id: 1,
          structure_type: 'CALL',
          structure_date: r.eventDate,
          structure_payload: JSON.stringify({
            call_price: callPrice,
            notional_factor: notionalFactor,
          }),
          notional_factor: notionalFactor,
          sort_order: 10001 + idx,
          is_active: 1,
          source_table: 'PRODUCT_STRUCTURE_UI',
          source_id: null,
        };

        sendAddProductStructureRow(
          newRowData,
          `structure-bulk-call-${Date.now()}-${idx}`
        );
      });

      console.log('[STRUCTURE TIMELINE BULK ADD CALLS]', {
        prodId,
        count: rowsToCreate.length,
        dates: rowsToCreate.map((r) => r.eventDate),
      });

      showStructureMessage(
        drawer,
        `Submitted ${rowsToCreate.length} CALL rows.`,
        'success'
      );

      onRefresh(container, prodId);
    });
}