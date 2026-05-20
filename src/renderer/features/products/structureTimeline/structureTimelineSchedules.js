// electron_app/src/renderer/features/products/structureTimeline/structureTimelineSchedules.js

import {
  sendAddProductStructureRow,
  sendUpdateProductStructureRow,
} from './schedules/structureRowApi.js';

'use strict';

import {
  buildBaseTimelineDates,
} from './structureTimelineUtils.js';

import {
  getProductRow,
  getProductStartDate,
  getProductMaturityDate,
  getProductFrequency,
  getCouponRows,
} from './structureTimelineData.js';

import {
  showStructureMessage,
} from './structureTimelineDrawer.js';

export {
  renderFloatingCouponScheduleDrawer,
} from './schedules/floatingCouponScheduleDrawer.js';

export {
  renderBulkCallDrawer,
} from './schedules/bulkCallScheduleDrawer.js';


// ------------------------------------------------------------
// EMPTY STATE: Create initial coupon schedule
// ------------------------------------------------------------

export function renderCreateCouponScheduleEmptyState(container, prodId, options = {}) {
  const onRefresh =
    typeof options.onRefresh === 'function'
      ? options.onRefresh
      : () => {};

  const product = getProductRow(prodId);

  const startDate = getProductStartDate(product);
  const maturity = getProductMaturityDate(product);
  const frequency = getProductFrequency(product);

  container.innerHTML = `
    <div style="padding:16px;">
      <h2>Structure Timeline · ${prodId}</h2>

      <p style="color:#777; margin-bottom:16px;">
        No PRODUCT_STRUCTURE rows found for this product.
      </p>

      <div
        style="
          max-width:520px;
          border:1px solid #ddd;
          border-radius:8px;
          padding:14px;
          background:#fafafa;
        "
      >
        <h3 style="margin-top:0;">Create Coupon Schedule</h3>

        <label style="display:block; font-size:12px; margin-top:8px;">
          Start Date
        </label>
        <input
          id="initialCouponStartDate"
          value="${startDate || ''}"
          placeholder="YYYY-MM-DD"
          style="width:100%; box-sizing:border-box; margin-bottom:8px;"
        />

        <label style="display:block; font-size:12px; margin-top:8px;">
          Maturity Date
        </label>
        <input
          id="initialCouponMaturityDate"
          value="${maturity || ''}"
          placeholder="YYYY-MM-DD"
          style="width:100%; box-sizing:border-box; margin-bottom:8px;"
        />

        <label style="display:block; font-size:12px; margin-top:8px;">
          Coupon Frequency
        </label>
        <input
          id="initialCouponFrequency"
          value="${frequency || 1}"
          placeholder="1 = yearly, 2 = semiannual, 4 = quarterly"
          style="width:100%; box-sizing:border-box; margin-bottom:8px;"
        />

        <label style="display:block; font-size:12px; margin-top:8px;">
          Coupon Rate
        </label>
        <input
          id="initialCouponRate"
          value=""
          placeholder="optional, e.g. 0.04"
          style="width:100%; box-sizing:border-box; margin-bottom:8px;"
        />

        <label style="display:block; font-size:12px; margin-top:8px;">
          Notional Factor
        </label>
        <input
          id="initialCouponNotionalFactor"
          value="1"
          style="width:100%; box-sizing:border-box; margin-bottom:8px;"
        />

        <button id="createInitialCouponSchedule" type="button" style="margin-top:10px;">
          + Create Coupon Schedule
        </button>
      </div>
    </div>
  `;

  container
    .querySelector('#createInitialCouponSchedule')
    ?.addEventListener('click', () => {
      const startDateInput =
        container.querySelector('#initialCouponStartDate')?.value || '';

      const maturityInput =
        container.querySelector('#initialCouponMaturityDate')?.value || '';

      const frequencyInput =
        Number(container.querySelector('#initialCouponFrequency')?.value || 1);

      const couponRateRaw =
        container.querySelector('#initialCouponRate')?.value ?? '';

      const notionalFactor =
        Number(container.querySelector('#initialCouponNotionalFactor')?.value || 1);

      const dates = buildBaseTimelineDates(
        startDateInput,
        maturityInput,
        frequencyInput
      );

      if (!dates.length) {
        showStructureMessage(
          container,
          'Could not create schedule. Check Start Date, Maturity and Frequency.',
          'warning'
        );
        return;
      }

      const couponRate =
        couponRateRaw === ''
          ? null
          : Number(couponRateRaw);

      if (couponRateRaw !== '' && !Number.isFinite(couponRate)) {
        showStructureMessage(
          container,
          'Invalid coupon rate.',
          'warning'
        );
        return;
      }

      const cleanNotionalFactor =
        Number.isFinite(notionalFactor)
          ? notionalFactor
          : 1;

      dates.forEach((date, index) => {
        const payload = {
          notional_factor: cleanNotionalFactor,
        };

        if (couponRate !== null) {
          payload.rate = couponRate;
        }

        const newRowData = {
          product_id: prodId,
          leg_id: 1,
          structure_type: 'COUPON_FIXED',
          structure_subtype: 'FIXED',
          period_number: index + 1,
          structure_date: date,
          structure_payload: JSON.stringify(payload),
          notional_factor: cleanNotionalFactor,
          sort_order: index + 1,
          is_active: 1,
          source_table: 'PRODUCT_STRUCTURE_UI_INITIAL',
          source_id: null,
        };

        sendAddProductStructureRow(
          newRowData,
          `structure-initial-coupon-${prodId}-${Date.now()}-${index}`
        );
      });

      const maturityDate = dates[dates.length - 1];

      const redemptionRow = {
        product_id: prodId,
        leg_id: 1,
        structure_type: 'REDEMPTION',
        structure_subtype: 'BULLET',
        period_number: dates.length,
        structure_date: maturityDate,
        structure_payload: JSON.stringify({
          notional_factor: 1,
        }),
        notional_factor: 1,
        sort_order: dates.length + 1,
        is_active: 1,
        source_table: 'PRODUCT_STRUCTURE_UI_INITIAL',
        source_id: null,
      };

      sendAddProductStructureRow(
        redemptionRow,
        `structure-initial-redemption-${prodId}-${Date.now()}`
      );

      showStructureMessage(
        container,
        `Coupon schedule created with ${dates.length} coupon rows and 1 redemption.`,
        'success'
      );

      onRefresh(container, prodId);
    });
}

// ------------------------------------------------------------
// Existing Coupon Schedule updater
// ------------------------------------------------------------

export function renderCouponScheduleDrawer(drawer, prodId, container, rows, options = {}) {
  const onRefresh =
    typeof options.onRefresh === 'function'
      ? options.onRefresh
      : () => {};

  const couponRows = getCouponRows(rows);

  drawer.innerHTML = `
    <h3 style="margin-top:0;">Add Coupon Schedule</h3>

    <div style="font-size:12px; color:#555; margin-bottom:12px;">
      <div><strong>Product:</strong> ${prodId}</div>
      <div><strong>Coupon rows:</strong> ${couponRows.length}</div>
      <div><strong>Target:</strong> all existing COUPON_FIXED rows</div>
    </div>

    <label style="display:block; font-size:12px; margin-top:8px;">Coupon Rate</label>
    <input
      id="couponScheduleRateInput"
      value="0.04"
      placeholder="0.04 = 4%"
      style="width:100%; box-sizing:border-box; margin-bottom:8px;"
    />

    <label style="display:block; font-size:12px; margin-top:8px;">Notional Factor</label>
    <input
      id="couponScheduleNotionalInput"
      value="1"
      style="width:100%; box-sizing:border-box; margin-bottom:8px;"
    />

    <div
      style="margin-top:12px; padding:8px; background:#f4f4f4; border:1px solid #ddd; font-size:12px;"
    >
      This will update all COUPON_FIXED rows with:<br/>
      <code>{ "rate": couponRate, "notional_factor": notionalFactor }</code>
    </div>

    <button id="saveCouponScheduleRows" style="margin-top:12px;">
      Save Coupon Schedule
    </button>
  `;

  drawer
    .querySelector('#saveCouponScheduleRows')
    ?.addEventListener('click', () => {
      if (!couponRows.length) {
        showStructureMessage(
          drawer,
          'No COUPON_FIXED rows found.',
          'warning'
        );
        return;
      }

      const rate = Number(
        drawer.querySelector('#couponScheduleRateInput')?.value || 0
      );

      const notionalFactor = Number(
        drawer.querySelector('#couponScheduleNotionalInput')?.value || 1
      );

      if (!Number.isFinite(rate)) {
        showStructureMessage(
          drawer,
          'Invalid coupon rate.',
          'warning'
        );
        return;
      }

      couponRows.forEach((row) => {
        const structureId =
          row.raw.structure_id ||
          row.raw.STRUCTURE_ID;

        if (!structureId) {
          console.warn('[COUPON SCHEDULE UPDATE SKIPPED] missing structure_id', row);
          return;
        }

        const payload = {
          ...(row.payload || {}),
          rate,
          notional_factor: Number.isFinite(notionalFactor)
            ? notionalFactor
            : 1,
        };

        const newData = {
          structure_payload: JSON.stringify(payload),
          notional_factor: payload.notional_factor,
        };

        sendUpdateProductStructureRow(structureId, newData);
      });

      console.log('[STRUCTURE TIMELINE COUPON SCHEDULE UPDATE]', {
        prodId,
        count: couponRows.length,
        rate,
        notionalFactor,
      });

      showStructureMessage(
        drawer,
        `Coupon schedule submitted for ${couponRows.length} rows.`,
        'success'
      );

      onRefresh(container, prodId);
    });
}

// ------------------------------------------------------------
// Single CALL
// ------------------------------------------------------------

export function renderNewCallDrawer(drawer, prodId, container, options = {}) {
  const onRefresh =
    typeof options.onRefresh === 'function'
      ? options.onRefresh
      : () => {};

  if (!drawer || !prodId) return;

  drawer.innerHTML = `
    <h3 style="margin-top:0;">New CALL</h3>

    <div style="font-size:12px; color:#555; margin-bottom:12px;">
      <div><strong>Product:</strong> ${prodId}</div>
      <div><strong>Source:</strong> PRODUCT_STRUCTURE_UI</div>
    </div>

    <label style="display:block; font-size:12px; margin-top:8px;">Event Date</label>
    <input
      id="newStructureEventDateInput"
      placeholder="YYYY-MM-DD"
      style="width:100%; box-sizing:border-box; margin-bottom:8px;"
    />

    <label style="display:block; font-size:12px; margin-top:8px;">Event Type</label>
    <input
      id="newStructureEventTypeInput"
      value="CALL"
      style="width:100%; box-sizing:border-box; margin-bottom:8px;"
    />

    <hr style="margin:14px 0;" />

    <strong>Payload</strong>

    <label style="display:block; font-size:12px; margin-top:8px;">call_price</label>
    <input
      id="newCallPriceInput"
      value="100"
      style="width:100%; box-sizing:border-box; margin-bottom:8px;"
    />

    <label style="display:block; font-size:12px; margin-top:8px;">notional_factor</label>
    <input
      id="newCallNotionalFactorInput"
      value="1"
      style="width:100%; box-sizing:border-box; margin-bottom:8px;"
    />

    <label style="display:block; font-size:12px; margin-top:8px;">sort_order</label>
    <input
      id="newCallSortOrderInput"
      value="10001"
      style="width:100%; box-sizing:border-box; margin-bottom:8px;"
    />

    <div style="display:flex; gap:8px; margin-top:14px;">
      <button id="saveNewCallRow">
        Save New CALL
      </button>
    </div>
  `;

  drawer
    .querySelector('#saveNewCallRow')
    ?.addEventListener('click', () => {
      const structureDate =
        drawer.querySelector('#newStructureEventDateInput')?.value || '';

      const structureType =
        drawer.querySelector('#newStructureEventTypeInput')?.value || 'CALL';

      const callPrice =
        Number(drawer.querySelector('#newCallPriceInput')?.value || 100);

      const notionalFactor =
        Number(drawer.querySelector('#newCallNotionalFactorInput')?.value || 1);

      const sortOrder =
        Number(drawer.querySelector('#newCallSortOrderInput')?.value || 10001);

      if (!structureDate) {
        showStructureMessage(
          drawer,
          'Please enter Event Date.',
          'warning'
        );
        return;
      }

      const newRowData = {
        product_id: prodId,
        leg_id: null,
        structure_type: structureType,
        structure_date: structureDate,
        structure_payload: JSON.stringify({
          call_price: callPrice,
          notional_factor: notionalFactor,
        }),
        notional_factor: notionalFactor,
        sort_order: sortOrder,
        is_active: 1,
        source_table: 'PRODUCT_STRUCTURE_UI',
        source_id: null,
      };

      console.log('[STRUCTURE TIMELINE ADD CALL]', newRowData);

      sendAddProductStructureRow(
        newRowData,
        `structure-add-call-${Date.now()}`
      );

      showStructureMessage(
        drawer,
        `New CALL row submitted for ${structureDate}.`,
        'success'
      );

      onRefresh(container, prodId);
    });
}


