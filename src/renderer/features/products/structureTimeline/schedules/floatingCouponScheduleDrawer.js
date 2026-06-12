'use strict';

import {
  getCouponRows,
} from '../complexTimelineData.js';

import {
  showStructureMessage,
} from '../complexTimelineDrawer.js';

import {
  asFiniteNumber,
  getExistingRowsByType,
  getExistingRowsByTypeAndDate,
  buildGeneratedCouponDateRows,
  getPeriodNumber,
} from './scheduleHelpers.js';

import {
  sendAddProductStructureRow,
  sendUpdateProductStructureRow,
} from './structureRowApi.js';

// ------------------------------------------------------------
// Floating Coupon Schedule: one index
// ------------------------------------------------------------

export function renderFloatingCouponScheduleDrawer(drawer, prodId, container, rows, options = {}) {
  const onRefresh =
    typeof options.onRefresh === 'function'
      ? options.onRefresh
      : () => {};

  const existingCouponRows = getCouponRows(rows);

  const basisLabel = existingCouponRows.length
    ? 'existing coupon dates'
    : 'generated from product dates';

  drawer.innerHTML = `
    <h3 style="margin-top:0;">Add Floating Coupon Schedule</h3>

    <div style="font-size:12px; color:#555; margin-bottom:12px;">
      <div><strong>Product:</strong> ${prodId}</div>
      <div><strong>Basis:</strong> ${basisLabel}</div>
      <div><strong>Existing coupon dates:</strong> ${existingCouponRows.length}</div>
      <div><strong>Target:</strong> creates COUPON_FLOATING rows</div>
    </div>

    <label style="display:block; font-size:12px; margin-top:8px;">Index</label>
    <input
      id="floatingIndexInput"
      value="EURIBOR"
      placeholder="EURIBOR / SOFR / ESTR"
      style="width:100%; box-sizing:border-box; margin-bottom:8px;"
    />

    <label style="display:block; font-size:12px; margin-top:8px;">Tenor</label>
    <input
      id="floatingTenorInput"
      value="6M"
      placeholder="1M / 3M / 6M / 12M"
      style="width:100%; box-sizing:border-box; margin-bottom:8px;"
    />

    <label style="display:block; font-size:12px; margin-top:8px;">Payment Frequency</label>
    <input
      id="floatingPaymentFrequencyInput"
      value="2"
      placeholder="1 = yearly, 2 = semiannual, 4 = quarterly, 12 = monthly"
      style="width:100%; box-sizing:border-box; margin-bottom:8px;"
    />

    <label style="display:block; font-size:12px; margin-top:8px;">Gearing</label>
    <input
      id="floatingGearingInput"
      value="1"
      style="width:100%; box-sizing:border-box; margin-bottom:8px;"
    />

    <label style="display:block; font-size:12px; margin-top:8px;">Spread</label>
    <input
      id="floatingSpreadInput"
      value="0"
      placeholder="0.0025 = 25bp"
      style="width:100%; box-sizing:border-box; margin-bottom:8px;"
    />

    <label style="display:block; font-size:12px; margin-top:8px;">Cap</label>
    <input
      id="floatingCapInput"
      value=""
      placeholder="optional, e.g. 0.05"
      style="width:100%; box-sizing:border-box; margin-bottom:8px;"
    />

    <label style="display:block; font-size:12px; margin-top:8px;">Floor</label>
    <input
      id="floatingFloorInput"
      value=""
      placeholder="optional, e.g. 0"
      style="width:100%; box-sizing:border-box; margin-bottom:8px;"
    />

    <label style="display:block; font-size:12px; margin-top:8px;">Notional Factor</label>
    <input
      id="floatingNotionalFactorInput"
      value="1"
      style="width:100%; box-sizing:border-box; margin-bottom:8px;"
    />

    <div
      style="margin-top:12px; padding:8px; background:#f4f4f4; border:1px solid #ddd; font-size:12px;"
    >
      Creates one <strong>COUPON_FLOATING</strong> event for every available coupon date.
      If no fixed coupon dates exist, dates are generated from product START_DATE, MATURITY and frequency.
    </div>

    <button id="saveFloatingCouponScheduleRows" style="margin-top:12px;">
      Create Floating Coupon Schedule
    </button>
  `;

  drawer
    .querySelector('#saveFloatingCouponScheduleRows')
    ?.addEventListener('click', () => {
      const indexName =
        drawer.querySelector('#floatingIndexInput')?.value?.trim() || '';

      const tenor =
        drawer.querySelector('#floatingTenorInput')?.value?.trim() || '';

      const paymentFrequency = Number(
        drawer.querySelector('#floatingPaymentFrequencyInput')?.value || 1
      );

      const gearing = asFiniteNumber(
        drawer.querySelector('#floatingGearingInput')?.value || 1,
        null
      );

      const spread = asFiniteNumber(
        drawer.querySelector('#floatingSpreadInput')?.value || 0,
        null
      );

      const capRaw =
        drawer.querySelector('#floatingCapInput')?.value ?? '';

      const floorRaw =
        drawer.querySelector('#floatingFloorInput')?.value ?? '';

      const notionalFactor = asFiniteNumber(
        drawer.querySelector('#floatingNotionalFactorInput')?.value || 1,
        1
      );

      if (!indexName) {
        showStructureMessage(drawer, 'Index is required.', 'warning');
        return;
      }

      if (!tenor) {
        showStructureMessage(drawer, 'Tenor is required.', 'warning');
        return;
      }

      if (!Number.isFinite(paymentFrequency) || paymentFrequency <= 0) {
        showStructureMessage(drawer, 'Invalid payment frequency.', 'warning');
        return;
      }

      if (!Number.isFinite(gearing)) {
        showStructureMessage(drawer, 'Invalid gearing.', 'warning');
        return;
      }

      if (!Number.isFinite(spread)) {
        showStructureMessage(drawer, 'Invalid spread.', 'warning');
        return;
      }

      const cap =
        capRaw === ''
          ? null
          : Number(capRaw);

      const floor =
        floorRaw === ''
          ? null
          : Number(floorRaw);

      if (capRaw !== '' && !Number.isFinite(cap)) {
        showStructureMessage(drawer, 'Invalid cap.', 'warning');
        return;
      }

      if (floorRaw !== '' && !Number.isFinite(floor)) {
        showStructureMessage(drawer, 'Invalid floor.', 'warning');
        return;
      }

      const cleanNotionalFactor =
        Number.isFinite(notionalFactor)
          ? notionalFactor
          : 1;

      const generatedCouponRows = existingCouponRows.length
        ? []
        : buildGeneratedCouponDateRows(prodId, paymentFrequency);

      const floatingBasisRows = existingCouponRows.length
        ? existingCouponRows
        : generatedCouponRows;

      if (!floatingBasisRows.length) {
        showStructureMessage(
          drawer,
          'No coupon dates found. Check START_DATE, MATURITY and Payment Frequency.',
          'warning'
        );
        return;
      }

      const activeRows = rows.filter((r) => r.isActive !== false);

      const existingFloatingRowsByDate =
        getExistingRowsByTypeAndDate(activeRows, 'COUPON_FLOATING');
      let createdCount = 0;
      let updatedCount = 0;

      floatingBasisRows.forEach((row, idx) => {
        const eventDate = String(row.eventDate || '');
        const existingFloatingRow = existingFloatingRowsByDate.get(eventDate);

        const payload = {
          index: indexName,
          tenor,
          payment_frequency: paymentFrequency,
          gearing,
          spread,
          cap,
          floor,
          notional_factor: cleanNotionalFactor,
        };

        if (existingFloatingRow) {
          const structureId =
            existingFloatingRow.raw.structure_id ||
            existingFloatingRow.raw.STRUCTURE_ID;

          if (!structureId) {
            console.warn(
              '[FLOATING COUPON UPDATE SKIPPED] missing structure_id',
              existingFloatingRow
            );
            return;
          }

          const newData = {
            structure_payload: JSON.stringify(payload),
            notional_factor: cleanNotionalFactor,
          };

          sendUpdateProductStructureRow(structureId, newData);

          updatedCount += 1;
          return;
        }

        const newRowData = {
          product_id: prodId,
          leg_id: 1,
          structure_type: 'COUPON_FLOATING',
          structure_subtype: 'INDEX',
          period_number: getPeriodNumber(row, idx),
          structure_date: eventDate,
          structure_payload: JSON.stringify(payload),
          notional_factor: cleanNotionalFactor,
          sort_order: 2000 + idx,
          is_active: 1,
          source_table: 'PRODUCT_STRUCTURE_UI_FLOATING',
          source_id: null,
        };

        sendAddProductStructureRow(
          newRowData,
          `structure-floating-coupon-${prodId}-${Date.now()}-${idx}`
        );

        createdCount += 1;
      });

      const hasRedemption =
        getExistingRowsByType(rows, 'REDEMPTION').length > 0;

      if (!hasRedemption && floatingBasisRows.length) {
        const maturityDate =
          floatingBasisRows[floatingBasisRows.length - 1]?.eventDate || '';

        if (maturityDate) {
          const redemptionRow = {
            product_id: prodId,
            leg_id: 1,
            structure_type: 'REDEMPTION',
            structure_subtype: 'BULLET',
            period_number: floatingBasisRows.length,
            structure_date: maturityDate,
            structure_payload: JSON.stringify({
              notional_factor: 1,
            }),
            notional_factor: 1,
            sort_order: 9000,
            is_active: 1,
            source_table: 'PRODUCT_STRUCTURE_UI_FLOATING',
            source_id: null,
          };

          sendAddProductStructureRow(
            redemptionRow,
            `structure-floating-redemption-${prodId}-${Date.now()}`
          );
        }
      }

      console.log('[STRUCTURE TIMELINE FLOATING COUPON SCHEDULE UPSERT]', {
        prodId,
        basis: basisLabel,
        count: createdCount + updatedCount,
        createdCount,
        updatedCount,
        indexName,
        tenor,
        gearing,
        spread,
        cap,
        floor,
      });

      showStructureMessage(
        drawer,
        `Floating coupon schedule submitted. Created ${createdCount}, updated ${updatedCount}.`,
        'success'
      );

      onRefresh(container, prodId);
    });
}