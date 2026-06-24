
// utils/linksToTables.js
import { handleModalAction } from '../core/ui/modal/modalActions.js';
import { appState } from '../../renderer/renderer.js';
import { handleStructureTimelineModal } from '../features/products/productSetupModal.js';



// 1) attachIdLinks – IDs in Tabellen anklickbar machen
export function attachIdLinks(container, opts = {}) {
  if (!container) return;

  const {
    prodHeader = 'PROD_ID',
    tradeHeader = 'TRADE_ID',
    bindFlag = 'idLinksEventsBound',    // ⚠️ nur noch für EVENTS!
    addKeyboardSupport = true,
    stopOtherHandlers = true
  } = opts;

  // ==== 1) Event-Delegation EINMAL binden ====
  if (container.dataset[bindFlag] !== '1') {
    const handler = (ev) => {
      const prodBtn  = ev.target.closest('.prod-id-link');
      const tradeBtn = ev.target.closest('.trade-id-link');
      if (!prodBtn && !tradeBtn) return;

      if (stopOtherHandlers) { ev.preventDefault(); ev.stopPropagation(); }

      if (ev.type === 'keydown' && addKeyboardSupport) {
        if (!['Enter', ' '].includes(ev.key)) return;
      } else if (ev.type !== 'click') {
        return;
      }

      if (prodBtn) {
        const prodId =
          prodBtn.dataset.prodId?.trim() ||
          prodBtn.getAttribute('data-prod-id')?.trim() ||
          (prodBtn.textContent || '').trim();
        if (prodId) openProdEditorByProdId(prodId);
        return;
      }

      if (tradeBtn) {
        const tradeId =
          tradeBtn.dataset.tradeId?.trim() ||
          tradeBtn.getAttribute('data-trade-id')?.trim() ||
          (tradeBtn.textContent || '').trim();
        if (tradeId) openDealEditorByTradeId(tradeId);
        return;
      }
    };

    container.addEventListener('click', handler, true);
    if (addKeyboardSupport) container.addEventListener('keydown', handler, true);
    if (stopOtherHandlers) {
      container.addEventListener('pointerdown', (e) => {
        if (e.target.closest('.prod-id-link, .trade-id-link')) {
          e.preventDefault(); e.stopPropagation();
        }
      }, true);
    }
    container.dataset[bindFlag] = '1';
  }

  // ==== 2) Buttons JEDES MAL nach dem Render einbauen ====
  const norm = (s) => String(s || '').trim().toUpperCase().replace(/\s+/g, '_');
  const table = container.querySelector('table');
  if (!table) return;

  // Spaltenindizes suchen (robust gegen Schreibweise)
  const ths = table.querySelectorAll('thead th');
  let prodIdx = -1, tradeIdx = -1;

  ths.forEach((th, i) => {
    const label = norm(th.textContent);

    const isProdHeader =
      label === norm(prodHeader) ||
      label === 'PRODUCT_ID';

    const isTradeHeader =
      label === norm(tradeHeader) ||
      label === 'TRADE_ID';

    if (isProdHeader) prodIdx = i;
    if (isTradeHeader) tradeIdx = i;
  });

  if (prodIdx === -1 && tradeIdx === -1) return;

  // Pro Renderlauf Buttons setzen (wenn in Zelle noch keiner drin)
  table.querySelectorAll('tbody tr').forEach((row) => {
    // PROD_ID
    if (prodIdx > -1) {
      const cell = row.cells?.[prodIdx];
      if (cell) {
        const txt = (cell.textContent || '').trim();
        cell.classList.add('prod-id-cell');
        if (!txt) {
          // Placeholder row (e.g. empty-portfolio dummy): no product assigned yet.
          // Render plain text instead of a dead link button.
          cell.classList.add('prod-id-placeholder');
          cell.textContent = 'No product yet';
        } else if (!cell.querySelector('.prod-id-link')) {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'prod-id-link link-button';
          btn.textContent = txt;
          btn.dataset.prodId = txt;
          btn.setAttribute('aria-label', `Produkt öffnen: ${txt}`);
          btn.setAttribute('role', 'link');
          if (addKeyboardSupport) btn.tabIndex = 0;
          cell.textContent = '';
          cell.appendChild(btn);
        }
      }
    }

    // TRADE_ID
    if (tradeIdx > -1) {
      const cell = row.cells?.[tradeIdx];
      if (cell) {
        const txt = (cell.textContent || '').trim();
        if (!cell.querySelector('.trade-id-link')) {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'trade-id-link link-button';
          btn.textContent = txt || '—';
          btn.dataset.tradeId = txt || '';
          btn.setAttribute('aria-label', `Deal öffnen: ${txt || '—'}`);
          btn.setAttribute('role', 'link');
          if (addKeyboardSupport) btn.tabIndex = 0;
          cell.textContent = '';
          cell.appendChild(btn);
        }
      }
    }
  });
}

// 2) PROD -> Editor + optional Coupon-Modal

export function openProdEditorByProdId(prodId) {
  const prodDataArr = appState.getProdData?.() || [];
  const needle = String(prodId ?? '').trim();

  const row = prodDataArr.find((r) => {
    const id = String(
      r?.PROD_ID ??
      r?.product_id ??
      r?.PRODUCT_ID ??
      ''
    ).trim();

    return id === needle;
  });

  if (!row) {
    console.warn('[openProdEditorByProdId] PROD_ID nicht gefunden:', needle);
    return false;
  }

// Resolve editor template from canonical product semantics.
// IMPORTANT:
// Existing __PRODUCT_TEMPLATE__ / __UI_MODE__ can be stale or wrong.
// Therefore we intentionally recompute them every time before opening.
const productType = String(
  row.product_type ??
  row.PRODUCT_TYPE ??
  row.ProductType ??
  ''
).trim().toUpperCase();

const couponType = String(
  row.coupon_type ??
  row.COUPON_TYPE ??
  row.CouponType ??
  ''
).trim().toUpperCase();

const model = String(
  row.MODEL ??
  row.model ??
  row.pricing_model ??
  ''
).trim().toUpperCase();

const prodIdUpper = String(
  row.PROD_ID ??
  row.product_id ??
  row.PRODUCT_ID ??
  needle ??
  ''
).trim().toUpperCase();

// ------------------------------------------------------
// Resolve editor route from product semantics.
// IMPORTANT:
// MODEL / pricing model must NOT decide whether a product is complex.
// Example:
//   A simple fixed bond may be priced with LMM_vxp.
//   It must still open the simple fixed bond editor.
// ------------------------------------------------------

const isFixedBond =
  couponType === 'FIX' ||
  couponType === 'FIXED' ||
  couponType === 'FIXED_COUPON' ||
  productType === 'FIX' ||
  productType === 'FIXED' ||
  productType === 'FIXED_COUPON';

const isFloatingBond =
  couponType === 'FLOATER' ||
  couponType === 'FLOATING' ||
  couponType === 'FLOATING_COUPON' ||
  couponType === 'FRN' ||
  productType === 'FLOATER' ||
  productType === 'FLOATING' ||
  productType === 'FLOATING_COUPON' ||
  productType === 'FRN';

const isCmsOrStructured =
  productType === 'STRUCTURED' ||
  productType === 'COMPLEX' ||
  productType === 'COMPLEX_BOND' ||
  couponType === 'CMS' ||
  couponType === 'FORMULA' ||
  couponType === 'STRUCTURED' ||
  // Complex Bonds werden mit CouponType='CUSTOM' gespeichert (siehe
  // productCanonical.service / resolveProductTemplateName). Ohne diese Zeile fiel
  // der Complex Bond in den FIXED_BOND-Fallback und öffnete als Simple Fixed.
  couponType === 'CUSTOM' ||
  couponType === 'COMPLEX' ||
  couponType === 'COMPLEX_BOND' ||
  prodIdUpper.startsWith('CMS');

// Simple products win over model/pricing method.
// LMM_vxp is allowed for simple fixed / simple FRN products.
if (isFixedBond) {
  row.__PRODUCT_TEMPLATE__ = 'FIXED_BOND';
  row.__UI_MODE__ = 'simple_fixed';
} else if (isFloatingBond) {
  row.__PRODUCT_TEMPLATE__ = 'FRN';
  row.__UI_MODE__ = 'simple_frn';
} else if (isCmsOrStructured) {
  row.__PRODUCT_TEMPLATE__ = 'COMPLEX_BOND';
  row.__UI_MODE__ = 'complex';
} else {
  // Safer fallback for ordinary bonds:
  // If product metadata is incomplete, do not force complex timeline.
  row.__PRODUCT_TEMPLATE__ = 'FIXED_BOND';
  row.__UI_MODE__ = 'simple_fixed';
}

  console.log('[PRODUCT EDITOR ROUTE] opening product editor', {
    prodId: needle,
    productType,
    couponType,
    model,
    template: row.__PRODUCT_TEMPLATE__,
    uiMode: row.__UI_MODE__,
  });

  handleStructureTimelineModal(needle, {
    mode: 'edit',
    source: 'prod-id-link',
    templateName: row.__PRODUCT_TEMPLATE__,
    uiMode: row.__UI_MODE__,
  });

  return true;
}

// 3) DEAL -> Editor per TRADE_ID
function openDealEditorByTradeId(tradeId) {
  const dealsArr = getDealsArrSafe();
  if (!Array.isArray(dealsArr) || dealsArr.length === 0) {
      console.warn('[openDealEditorByTradeId] Deals-Array nicht gefunden oder leer.');
      return false;
  }
  const needle = normalizeId(tradeId);

  const matches = [];
  for (let i = 0; i < dealsArr.length; i++) {
      if (normalizeId(dealsArr[i]?.TRADE_ID) === needle) matches.push(i);
  }
  if (matches.length === 0) {
      console.warn('[openDealEditorByTradeId] TRADE_ID nicht gefunden:', needle);
      return false;
  }
  if (matches.length > 1) {
      console.warn(`[openDealEditorByTradeId] WARN: ${matches.length} Treffer. Öffne ersten.`, matches);
  }
  const rowIndex = matches[0];

  // Kontext (optional)
  if (typeof appState?.setActiveTable === 'function') {
      try { appState.setActiveTable('DealsMain'); } catch {}
  }

  // Fake-Button wie echter UI-Trigger
  const fakeBtn = document.createElement('button');
  fakeBtn.type = 'button';
  fakeBtn.className = 'edit-button';
  fakeBtn.dataset.row = String(rowIndex);
  fakeBtn.dataset.table = 'DealsMain';
  fakeBtn.dataset.action = 'edit';
  fakeBtn.dataset.tradeId = needle;

  const fakeEvt = {
      preventDefault(){},
      stopPropagation(){},
      target: fakeBtn,
      currentTarget: fakeBtn
  };

  // Use the SAME curated DealsMain field set as the Change-Portfolio "Add" modal,
  // so editing shows exactly the editable deal fields (PROD_ID, Notional, Trade
  // Date, Category, Depot Bank, Buy Price) instead of the enriched/derived columns.
  const curatedRows = dealsArr.map(toDealsMainEditRow);

  try {
      handleModalAction(fakeEvt, curatedRows, rowIndex, 'DealsMain', 'edit');
      return true;
  } catch (err) {
      console.error('[openDealEditorByTradeId] handleFormAction Fehler:', err);
      return false;
  }
}

// Mirror of mapDealViewRowToDealsMainRow (tradeTableRenderer.js): the curated
// editable DealsMain shape used by the Add modal. Kept local to avoid a circular
// import (tradeTableRenderer.js already imports from this module).
function toDealsMainEditRow(row = {}) {
    return {
        TRADE_ID: row.TRADE_ID ?? '',
        INCLUDE: row.INCLUDE ?? 1,
        port_name: row.port_name ?? row.PORT_NAME ?? '',
        Depotbank: row.Depotbank ?? row.DEPOT_BANK ?? '',
        PROD_ID: row.PROD_ID ?? row.product_id ?? '',
        TRADE_DATE: row.TRADE_DATE ?? '',
        CATEGORY: row.CATEGORY ?? '',
        NOTIONAL: row.NOTIONAL ?? '',
        PRICE_BUY: row.PRICE_BUY ?? '',
    };
}
    // -------- helpers (modul-intern) --------
    function normalizeId(v){ return String(v ?? '').trim(); }
    function getDealsArrSafe(){
    return (appState.getAllDealsData && appState.getAllDealsData())
        || (appState.getFilteredData && appState.getFilteredData('deals'))
        || [];
    }
