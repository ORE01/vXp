// src/renderer/core/state/stores/categorySetupStore.js
//
// Holds CUSTOMER_PRODUCT_CATEGORY_SETUP rows so the renderer can query which
// product categories are FIXED_VALUE ("no valuation"). Used to exclude
// fixed-value holdings when reconstructing sensitivities from per-product
// per-unit data — mirroring the Python valuation, which zeroes fixed-value
// category trades in PortfolioRiskSensitivities.

function normalizeName(name) {
  return String(name ?? '').trim();
}

const categorySetupStore = {
  rows: [],
  fixedValueNames: new Set(),

  setRows(rows) {
    this.rows = Array.isArray(rows) ? rows : [];

    this.fixedValueNames = new Set(
      this.rows
        .filter(r =>
          String(r.category_type ?? '').trim().toUpperCase() === 'FIXED_VALUE' &&
          // Treat missing/1 as active; only an explicit 0 disables it.
          Number(r.is_active) !== 0
        )
        .map(r => normalizeName(r.category_name))
        .filter(Boolean)
    );

    console.log('[CATEGORY STORE] rows set', {
      rows: this.rows.length,
      fixedValueNames: [...this.fixedValueNames],
    });
  },

  getRows() {
    return this.rows || [];
  },

  getFixedValueCategoryNames() {
    return this.fixedValueNames;
  },
};

export function installCategorySetupStore({ appState } = {}) {
  if (!appState) {
    throw new Error('[installCategorySetupStore] appState missing');
  }

  appState.setCategorySetupData = (rows) => categorySetupStore.setRows(rows);
  appState.getCategorySetupRows = () => categorySetupStore.getRows();
  appState.getFixedValueCategoryNames = () =>
    categorySetupStore.getFixedValueCategoryNames();

  return categorySetupStore;
}

export default categorySetupStore;
