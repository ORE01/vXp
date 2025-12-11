
// utils/linksToTables.js
import { handleModalAction } from '../MODAL_HELPER/ModalActionHandler.js';
import { appState } from '../FRONT_END/renderer.js';
import { handleCouponModal } from '../FRONT_END/NEW_PRODUCTS/PRODCoupon.js';


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
    if (label === norm(prodHeader))  prodIdx = i;
    if (label === norm(tradeHeader)) tradeIdx = i;
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
        if (!cell.querySelector('.prod-id-link')) {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'prod-id-link link-button';
          btn.textContent = txt || '—';
          btn.dataset.prodId = txt || '';
          btn.setAttribute('aria-label', `Produkt öffnen: ${txt || '—'}`);
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
    const rowIndex = prodDataArr.findIndex(r => String(r?.PROD_ID).trim() === needle);
    if (rowIndex < 0) { console.warn('PROD_ID nicht gefunden:', needle); return false; }

    const fakeEvt = new Event('click', { bubbles: true });
    try {
        handleModalAction(fakeEvt, prodDataArr, rowIndex, 'ProdAll', 'edit');
    } catch (e) {
        console.error('[openProdEditorByProdId] handleFormAction Fehler:', e);
        return false;
    }

    // Optionales Folge-Modal
    const row = prodDataArr[rowIndex];
    requestAnimationFrame(() => {
        if (row) handleCouponModal?.(row.PROD_ID, row.SCHEDULE, row.START_DATE, row.MATURITY, row.TENOR);
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

try {
    handleModalAction(fakeEvt, dealsArr, rowIndex, 'DealsMain', 'edit');
    return true;
} catch (err) {
    console.error('[openDealEditorByTradeId] handleFormAction Fehler:', err);
    return false;
}
}
    // -------- helpers (modul-intern) --------
    function normalizeId(v){ return String(v ?? '').trim(); }
    function getDealsArrSafe(){
    return (appState.getAllDealsData && appState.getAllDealsData())
        || (appState.getFilteredData && appState.getFilteredData('deals'))
        || [];
    }