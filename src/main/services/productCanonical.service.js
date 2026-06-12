// src/main/services/productCanonical.service.js
'use strict';

/**
 * Canonical Product Service
 *
 * Ausgelagerte Product-Logik aus crud.handlers.js.
 *
 * Wichtig:
 * - keine IPC-Logik
 * - keine Refresh-Logik
 * - keine neue Structure-Generator-Logik
 * - nur bestehende Funktionen aus crud.handlers.js ausgelagert
 */
function createProductCanonicalService(dbApi) {
  if (!dbApi) {
    throw new Error('[productCanonical.service] dbApi missing');
  }

  const {
    updateRecord,
    insertRowInTable,
    eraseRowFromDB,
  } = dbApi;

  if (typeof updateRecord !== 'function') {
    throw new Error('[productCanonical.service] dbApi.updateRecord missing');
  }

  if (typeof insertRowInTable !== 'function') {
    throw new Error('[productCanonical.service] dbApi.insertRowInTable missing');
  }

  if (typeof eraseRowFromDB !== 'function') {
    throw new Error('[productCanonical.service] dbApi.eraseRowFromDB missing');
  }

  // ------------------------------------------------------------
  // UPDATE / INSERT helper
  // ------------------------------------------------------------

  function updateRecordAsync(table, newData, uniqueIdentifier) {
    return new Promise((resolve, reject) => {
      updateRecord(table, null, newData, uniqueIdentifier, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  function insertRowAsync(table, rowData) {
    return new Promise((resolve, reject) => {
      insertRowInTable(rowData, table, (err, insertedId) => {
        if (err) reject(err);
        else resolve(insertedId);
      });
    });
  }

  // ------------------------------------------------------------
  // DELETE canonical product
  // ------------------------------------------------------------

  async function deleteCanonicalProduct(productId) {
    if (!productId) {
      throw new Error('[canonical product delete] Missing product id');
    }

    console.log('[CANONICAL PRODUCT DELETE START]', { productId });

    await eraseRowFromDB('PRODUCT_STRUCTURE', {
      column: 'product_id',
      value: productId,
    });

    await eraseRowFromDB('PRODUCTS_FIXED_TERMS', {
      column: 'product_id',
      value: productId,
    });

    await eraseRowFromDB('PRODUCTS_FRN_TERMS', {
      column: 'product_id',
      value: productId,
    });

    await eraseRowFromDB('PRODUCTS_CONVENTIONS', {
      column: 'product_id',
      value: productId,
    });

    await eraseRowFromDB('PRODUCTS_PRICING_CONFIG', {
      column: 'product_id',
      value: productId,
    });

    await eraseRowFromDB('PRODUCTS_MASTER', {
      column: 'product_id',
      value: productId,
    });

    console.log('[CANONICAL PRODUCT DELETE DONE]', { productId });
  }

  // ------------------------------------------------------------
  // UPSERT canonical record
  // ------------------------------------------------------------

  async function upsertCanonicalRecord(table, data, productId) {
    if (!productId) {
      throw new Error(`[canonical upsert] Missing productId for ${table}`);
    }

    if (!data || !Object.keys(data).length) {
      console.log('[CANONICAL UPSERT SKIP]', { table, productId });
      return 'skipped';
    }

    const now = new Date().toISOString();

    const insertData = {
      product_id: productId,
      ...data,
      created_at: data.created_at || now,
      updated_at: now,
    };

    const updateData = {
      ...data,
      updated_at: now,
    };

    const id = {
      column: 'product_id',
      value: productId,
    };

    console.log('[CANONICAL UPSERT START]', {
      table,
      productId,
      insertData,
    });

    try {
      await insertRowAsync(table, insertData);

      console.log('[CANONICAL UPSERT INSERTED]', {
        table,
        productId,
      });

      return 'inserted';
    } catch (insertErr) {
      const msg = String(insertErr?.message || insertErr || '');

      console.log('[CANONICAL UPSERT INSERT FAILED]', {
        table,
        productId,
        message: msg,
      });

      const isDuplicate =
        msg.includes('UNIQUE constraint failed') ||
        msg.includes('PRIMARY KEY') ||
        msg.includes('SQLITE_CONSTRAINT: UNIQUE');

      if (!isDuplicate) {
        throw insertErr;
      }

      console.log('[CANONICAL UPSERT FALLBACK UPDATE]', {
        table,
        productId,
        updateData,
      });

      await updateRecordAsync(table, updateData, id);

      console.log('[CANONICAL UPSERT UPDATED]', {
        table,
        productId,
      });

      return 'updated';
    }
  }



  async function saveCanonicalProduct(newData = {}, uniqueIdentifier = {}) {
    console.log('[CANONICAL RAW INPUT]', {
      uniqueIdentifier,
      newData,
    });

    const productId =
      newData.PROD_ID ||
      newData.product_id ||
      uniqueIdentifier?.value;

    if (!productId) {
      throw new Error('[canonical product update] Missing product id');
    }

    const master = {};
    const fixedTerms = {};
    const frnTerms = {};
    const conventions = {};
    const pricingConfig = {};
    const updatedTables = [];

    // ------------------------------------------------------------
    // TEMPLATE → CANONICAL PRODUCT ROUTING
    // Product Type im Modal ist UI.
    // CouponType ist internes Routing-Feld.
    // ------------------------------------------------------------

    const selectedTemplate =
      newData.__PRODUCT_TEMPLATE_SELECTOR__ ||
      newData.__PRODUCT_TEMPLATE__ ||
      null;

    if (selectedTemplate === 'FIXED_BOND') {
      newData.CouponType = 'FIX';

      if (!newData.FINLIB) {
        newData.FINLIB = 'ql';
      }

      if (!newData.MODEL) {
        newData.MODEL = 'DCF_ql';
      }

      if (!newData.METHODE) {
        newData.METHODE = '';
      }
    }

    if (selectedTemplate === 'FRN') {
      newData.CouponType = 'FLOATER';

      if (!newData.FINLIB) {
        newData.FINLIB = 'ql';
      }

      if (!newData.MODEL) {
        newData.MODEL = 'DCF_ql';
      }

      if (!newData.METHODE) {
        newData.METHODE = '';
      }
    }

    if (selectedTemplate === 'COMPLEX_BOND') {
      // Complex Bond setzt nur Defaults.
      // Manuelle User-Auswahl im Modal darf beim Edit NICHT überschrieben werden.
      if (!newData.CouponType && !newData.coupon_type) {
        newData.CouponType = 'CUSTOM';
      }

      if (!newData.SCHEDULE && !newData.SCHEDULE_RULE) {
        newData.SCHEDULE = '1';
      }

      if (!newData.FINLIB) {
        newData.FINLIB = 'vxp';
      }

      if (!newData.MODEL) {
        newData.MODEL = 'LMM_vxp';
      }

      if (!newData.METHODE) {
        newData.METHODE = 'tree_structure';
      }
    }

    // Final safety fallback:
    // PRODUCTS_MASTER.coupon_type is NOT NULL.
    // If the UI did not send template/coupon type, default to CUSTOM.
    // Safer fallback: complex products preserve optionality and avoid false FIX classification.
    if (!newData.CouponType && !newData.coupon_type) {
      console.warn('[CANONICAL ROUTING FALLBACK] Missing CouponType; defaulting to CUSTOM', {
        productId,
        selectedTemplate,
        newData,
      });

      newData.CouponType = 'CUSTOM';

      if (!newData.SCHEDULE && !newData.SCHEDULE_RULE) {
        newData.SCHEDULE = '1';
      }

      if (!newData.FINLIB) newData.FINLIB = 'vxp';
      if (!newData.MODEL) newData.MODEL = 'LMM_vxp';
      if (!newData.METHODE) newData.METHODE = 'tree_structure';
    }

    const couponType =
      String(newData.CouponType || newData.coupon_type || '').toUpperCase();

    const isFRN =
      couponType === 'FRN' ||
      couponType === 'FLOATER' ||
      couponType === 'FLOATING' ||
      couponType === 'FLOATING_RATE';

    const isFIX =
      couponType === 'FIX' ||
      couponType === 'FIXED' ||
      couponType === 'FIXED_COUPON';

    // ------------------------------------------------------------
    // PRODUCTS_MASTER
    // ------------------------------------------------------------

    master.product_type = 'BOND';

    if ('DESCRIPTION' in newData) master.product_name = newData.DESCRIPTION;
    if ('CouponType' in newData) master.coupon_type = newData.CouponType;
    if ('ISSUER' in newData) master.issuer_id = newData.ISSUER;
    if ('TICKER' in newData) master.issuer_ticker = newData.TICKER;
    if ('RANK' in newData) master.seniority = newData.RANK;
    if ('RATING_PROD' in newData) master.product_rating = newData.RATING_PROD;
    if ('CCY' in newData) master.currency_code = newData.CCY;
    if ('START_DATE' in newData) master.issue_date = newData.START_DATE;
    if ('MATURITY' in newData) master.maturity_date = newData.MATURITY;

    // ------------------------------------------------------------
    // PRODUCTS_FIXED_TERMS
    // ------------------------------------------------------------

    if ('COUPON' in newData && isFIX) {
      const couponRaw = newData.COUPON;

      if (
        couponRaw !== null &&
        couponRaw !== undefined &&
        String(couponRaw).trim() !== ''
      ) {
        fixedTerms.fixed_coupon_rate = Number(couponRaw);
      }
    }

    // ------------------------------------------------------------
    // PRODUCTS_FRN_TERMS
    // DB schema:
    // reference_index, index_tenor, reset_frequency,
    // payment_frequency, gearing, spread_margin,
    // cap_rate, floor_rate, fixing_lag_days
    // ------------------------------------------------------------

    if (isFRN) {
      if ('REFERENCE_INDEX' in newData) {
        frnTerms.reference_index = newData.REFERENCE_INDEX;
      }

      if ('INDEX_TENOR' in newData) {
        frnTerms.index_tenor = newData.INDEX_TENOR;
      }

      if ('RESET_TENOR' in newData) {
        frnTerms.reset_frequency = newData.RESET_TENOR;
      }

      if ('FRN_PAYMENT_FREQ' in newData) {
        frnTerms.payment_frequency = newData.FRN_PAYMENT_FREQ;
      }

      if ('PAYMENT_TENOR' in newData) {
        frnTerms.payment_frequency = newData.PAYMENT_TENOR;
      }

      if ('GEARING' in newData) {
        frnTerms.gearing = Number(newData.GEARING || 0);
      }

      if ('SPREADS' in newData) {
        frnTerms.spread_margin = Number(newData.SPREADS || 0);
      }

      if ('CAP' in newData) {
        frnTerms.cap_rate = Number(newData.CAP || 0);
      }

      if ('FLOOR' in newData) {
        frnTerms.floor_rate = Number(newData.FLOOR || 0);
      }

      if ('FIXING_LAG_DAYS' in newData) {
        frnTerms.fixing_lag_days = Number(newData.FIXING_LAG_DAYS || 0);
      }
    }

    // ------------------------------------------------------------
    // PRODUCTS_CONVENTIONS
    // ------------------------------------------------------------

    if ('DAY_COUNT' in newData) {
      conventions.day_count_convention = newData.DAY_COUNT;
    }

    if ('CALENDAR' in newData) {
      conventions.calendar_code = newData.CALENDAR;
    }

    if ('BUSINESS_DAY_CONVENTION' in newData) {
      conventions.business_day_convention = newData.BUSINESS_DAY_CONVENTION;
    }

    if ('SETTLEMENT_DAYS' in newData) {
      conventions.settlement_days = Number(newData.SETTLEMENT_DAYS || 0);
    }

    if (
      'TENOR' in newData &&
      newData.TENOR !== null &&
      newData.TENOR !== undefined &&
      String(newData.TENOR).trim() !== ''
    ) {
      conventions.coupon_frequency = String(newData.TENOR);
      conventions.payment_frequency = String(newData.TENOR);
    }

    if (
      'COUPON_FREQ' in newData &&
      newData.COUPON_FREQ !== null &&
      newData.COUPON_FREQ !== undefined &&
      String(newData.COUPON_FREQ).trim() !== ''
    ) {
      conventions.coupon_frequency = String(newData.COUPON_FREQ);
      conventions.payment_frequency = String(newData.COUPON_FREQ);
    }

    if ('PAYMENT_TENOR' in newData) {
      conventions.payment_frequency = String(newData.PAYMENT_TENOR);
    }

    if ('SCHEDULE_RULE' in newData) {
      conventions.schedule_generation_rule = String(newData.SCHEDULE_RULE);
    }

    if (
      'SCHEDULE' in newData &&
      newData.SCHEDULE !== null &&
      newData.SCHEDULE !== undefined &&
      String(newData.SCHEDULE).trim() !== ''
    ) {
      const scheduleValue = String(newData.SCHEDULE).trim();

      conventions.schedule_generation_rule = scheduleValue;

      if (
        scheduleValue === '1' ||
        scheduleValue.toUpperCase() === 'Y' ||
        scheduleValue.toUpperCase() === 'YES' ||
        scheduleValue.toUpperCase() === 'TRUE'
      ) {
        conventions.uses_explicit_events = 1;
      }
    }

    if ('USES_EVENTS' in newData) {
      conventions.uses_explicit_events = Number(newData.USES_EVENTS || 0);
    }

    // ------------------------------------------------------------
    // PRODUCTS_PRICING_CONFIG
    // ------------------------------------------------------------

    if ('FINLIB' in newData) {
      pricingConfig.pricing_library = newData.FINLIB;
    }

    if ('MODEL' in newData) {
      pricingConfig.pricing_model = newData.MODEL;
    }

    if ('METHODE' in newData) {
      pricingConfig.pricing_method = newData.METHODE;
    }

    if ('CS_SPREAD_OVERRIDE_BP' in newData) {
      const raw = newData.CS_SPREAD_OVERRIDE_BP;

      pricingConfig.cs_spread_override_bp =
        raw === null ||
        raw === undefined ||
        String(raw).trim() === '' ||
        String(raw).trim().toLowerCase() === 'default'
          ? null
          : Number(String(raw).replace(',', '.'));
    }

    if ('calibration_enabled' in newData) {
      pricingConfig.calibration_enabled = Number(newData.calibration_enabled || 0);
    }

    if ('valuation_engine' in newData) {
      pricingConfig.valuation_engine = newData.valuation_engine;
    }

    // ------------------------------------------------------------
    // UPSERT CANONICAL TABLES
    // ------------------------------------------------------------

    if (Object.keys(master).length) {
      const action = await upsertCanonicalRecord(
        'PRODUCTS_MASTER',
        master,
        productId
      );

      updatedTables.push(`PRODUCTS_MASTER:${action}`);
    }

    if (Object.keys(fixedTerms).length) {
      const action = await upsertCanonicalRecord(
        'PRODUCTS_FIXED_TERMS',
        fixedTerms,
        productId
      );

      updatedTables.push(`PRODUCTS_FIXED_TERMS:${action}`);
    }

    if (Object.keys(frnTerms).length) {
      const action = await upsertCanonicalRecord(
        'PRODUCTS_FRN_TERMS',
        frnTerms,
        productId
      );

      updatedTables.push(`PRODUCTS_FRN_TERMS:${action}`);
    }

    if (Object.keys(conventions).length) {
      const action = await upsertCanonicalRecord(
        'PRODUCTS_CONVENTIONS',
        conventions,
        productId
      );

      updatedTables.push(`PRODUCTS_CONVENTIONS:${action}`);
    }

    if (Object.keys(pricingConfig).length) {
      const action = await upsertCanonicalRecord(
        'PRODUCTS_PRICING_CONFIG',
        pricingConfig,
        productId
      );

      updatedTables.push(`PRODUCTS_PRICING_CONFIG:${action}`);
    }

    console.log('[CANONICAL PRODUCT UPDATE]', {
      productId,
      couponType,
      isFRN,
      isFIX,
      updatedTables,
      master,
      fixedTerms,
      frnTerms,
      conventions,
      pricingConfig,
    });
  }

  return {
    saveCanonicalProduct,
    deleteCanonicalProduct,
  };
}

module.exports = {
  createProductCanonicalService,
};