import processData from '../../core/ui/modal/modalData.js';
import { handleModalAction } from '../../core/ui/modal/modalActions.js';
import { addTooltipsForTruncatedText, addProdIdTooltips } from '../../utils/tooltips.js';
import { attachIdLinks } from '../../utils/linksToTables.js';
import { enhanceIncludeCheckboxes } from '../../core/ui/enhancers/includeToggleEnhancer.js';


let filteredDealsData;

export function handleDealsData(receivedData, dealsTableName, opts = {}) {
  const tableName = dealsTableName || '';

  const ctx = resolveDealsContext(opts);
  const { targetId, dropdownId, buttonId, isOffer } = ctx;

  const targetContainer = document.getElementById(targetId);
  if (!targetContainer) return;

  // ✅ Gate: If we're rendering the main deals container and no portfolio is selected, render nothing.
  // This prevents showing ALL portfolios on reload / initial state.
  if (!isOffer && targetId === 'dealsDataContainer') {
    const dd = dropdownId ? document.getElementById(dropdownId) : null;
    const sel = String(dd?.value ?? '').trim();

    const isNone =
      !sel ||
      sel === '__NONE__' ||
      sel === 'Select a table';

    if (isNone) {
      if (opts.allowClear === true) targetContainer.innerHTML = '';
      return;
    }
  }

  // leere Payload = no-op (außer explizit erlaubt)
  if (!Array.isArray(receivedData) || receivedData.length === 0) {
    if (opts.allowClear === true) targetContainer.innerHTML = '';
    return;
  }

  // 1) Dropdown-Snapshot nur für Deals
  const snap =
    !isOffer &&
    preserveAndRestoreFilterDropdown({
      dropdownId,
      enabled: opts.restoreDropdown !== false,
    });

  // 2) Render
  filteredDealsData = receivedData;
  renderDealsTableIntoContainer(targetContainer, filteredDealsData, tableName);

  // 3) UI Enhancements
  applyDealsUIEnhancements(targetContainer);
  enhanceIncludeCheckboxes(targetContainer);


  // 4) Mirror NUR wenn explizit gewünscht (New Portfolio Flow)
  if (!isOffer && opts.mirrorToNewPortfolio === true) {
    mirrorDealsToNewPortfolioPanel(filteredDealsData, tableName);
  }

  // 5) Add-Button NUR für Deals
  if (!isOffer) {
    bindDealsAddButtonOnce(buttonId, tableName);
  }

  // 6) Restore Dropdown (nur Deals)
  if (snap) snap.restore();
}


/* =========================================================
   Context (offers vs deals)
   ========================================================= */
function resolveDealsContext(opts = {}) {
  const forced = opts.forceTarget; // 'offers' | 'deals' | 'newPortfolio' | undefined

  const isOffer = forced === 'offers';
  const isNewPortfolio = forced === 'newPortfolio';

  return {
    isOffer, // bleibt nur für offers true
    targetId: isOffer
      ? 'offersDataContainer'
      : isNewPortfolio
        ? 'newPortfolioDealsDataContainer'
        : 'dealsDataContainer',

    dropdownId: isOffer || isNewPortfolio ? null : 'createdDealsDropdown',
    buttonId: isOffer || isNewPortfolio ? null : 'dealsAddButton',
  };
}


/* =========================================================
   Rendering
   ========================================================= */
function renderDealsTableIntoContainer(container, rows, tableName) {
  // console.log('[renderDealsTableIntoContainer]', {
  //   container: container?.id,
  //   tableName,
  //   rows: rows?.length,
  // });

  container.innerHTML = processData(rows, tableName);
}

/* =========================================================
   UI enhancements
   ========================================================= */
function applyDealsUIEnhancements(container) {
  addTooltipsForTruncatedText(container);
  addProdIdTooltips(container);
  attachIdLinks(container);
}

/* =========================================================
   Mirror (Deals only)
   ========================================================= */
function mirrorDealsToNewPortfolioPanel(rows, tableName) {
  const mirrorContainer = document.getElementById('newPortfolioDealsDataContainer');
  if (!mirrorContainer) return;

  mirrorContainer.innerHTML = processData(rows, tableName);
  addTooltipsForTruncatedText(mirrorContainer);
  addProdIdTooltips(mirrorContainer);
  attachIdLinks(mirrorContainer);
}

/* =========================================================
   Add button binding (once, Deals only)
   ========================================================= */
function bindDealsAddButtonOnce(buttonId, tableName) {
  const addButton = document.getElementById(buttonId);
  if (!addButton || addButton.dataset.bound === '1') return;

  addButton.dataset.bound = '1';
  addButton.addEventListener('click', (event) => {
    console.log('Start Add Deal', tableName);
    handleModalAction(event, filteredDealsData, null, tableName, 'add');
  });
}

/* =========================================================
   Filter / Dropdown: snapshot + restore (Deals only)
   ========================================================= */
function preserveAndRestoreFilterDropdown({ dropdownId, enabled = true } = {}) {
  if (!enabled || !dropdownId) return null;

  const el = document.getElementById(dropdownId);
  if (!el) return null;

  const snap = {
    id: dropdownId,
    value: el.value,
    index: el.selectedIndex,
    text: el.selectedIndex >= 0 ? el.options[el.selectedIndex]?.text : null,
  };

  return {
    restore() {
      const dd = document.getElementById(snap.id);
      if (!dd) return;

      if (snap.value && dd.querySelector(`option[value="${CSS.escape(snap.value)}"]`)) {
        dd.value = snap.value;
      } else if (snap.text) {
        const opt = Array.from(dd.options).find((o) => o.text === snap.text);
        if (opt) dd.value = opt.value;
        else if (snap.index >= 0 && snap.index < dd.options.length)
          dd.selectedIndex = snap.index;
      }
    },
  };
}
