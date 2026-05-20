import processData, { filterColumnsInData } from '../../core/ui/modal/modalData.js';
import { addTooltipsForTruncatedText } from '../../utils/tooltips.js';
import { appState } from '../../renderer.js';
import { openProdEditorByProdId } from '../../utils/linksToTables.js';
import { updateProductCSWarningUI } from '../../core/ui/warnings.js';
import { handleStructureTimelineModal } from './StructureTimelineModal.js';





// 1) Spalten, die in der Tabelle angezeigt werden sollen
const PROD_TABLE_COLUMNS = [
  'PROD_ID',
  'DESCRIPTION',
  'CouponType',
  'SCHEDULE',
  'MATURITY',
  'ISSUER',
  'RANK',
  'RATING_PROD',
  'CS_Szenario',
  'FINLIB',
  'MODEL',
  'METHODE',
];

// ======================================================

let prodData;

export function renderProductTable(filtersConfig) {
  const prodDataContainer = document.getElementById('prodDataContainer');
  if (!prodDataContainer) return;

  // Daten holen
  prodData = appState.getProdData();
  if (!Array.isArray(prodData) || prodData.length === 0) {
    console.warn('renderProductTable: prodData leer/ungÃ¼ltig');
    prodDataContainer.innerHTML = '';
    return;
  }

  // Spalten filtern fÃ¼r Anzeige
  const filteredProdData = filterColumnsInData(
    filterProdData(prodData, filtersConfig),
    PROD_TABLE_COLUMNS
  );

  appState.setFilteredProdData(filteredProdData);
  updateProductCSWarningUI?.(filteredProdData);

  // Render Tabelle
  prodDataContainer.innerHTML = processData(filteredProdData, 'v_PRODUCTS_APP');

  // Tooltips
  try {
    addTooltipsForTruncatedText(prodDataContainer);
  } catch (e) {
    console.warn('Tooltips fail:', e);
  }

  // PROD_ID zu Buttons machen
  makeProdIdButtons(prodDataContainer);

  // Delegierter Klick-Listener fÃ¼r PROD_ID-Buttons (einmalig)
  if (prodDataContainer.dataset.prodLinksBound !== '1') {
    prodDataContainer.dataset.prodLinksBound = '1';
    prodDataContainer.addEventListener('click', (ev) => {
      const btn = ev.target.closest('.prod-id-link');
      if (!btn) return;

      ev.preventDefault();
      ev.stopPropagation();

      const prodId = (btn.dataset.prodId || btn.textContent || '').trim();
      if (prodId) openProdEditorByProdId(prodId);
    });
  }

  // Add-Button: products now use the new Product Editor / Structure Timeline flow
  const prodAddButton = document.getElementById('prodAddButton');
  if (prodAddButton && !prodAddButton.dataset.bound) {
    prodAddButton.dataset.bound = '1';

    prodAddButton.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();

      console.log('[PRODUCT ADD ROUTE] opening new product editor create mode');

      handleStructureTimelineModal(null, {
        mode: 'create',
        source: 'prod-add-button',
        templateName: null,
      });
    });
  }
}

function filterProdData(data, filtersConfig) {
  return data.filter((dp) =>
    Object.entries(filtersConfig || {}).every(([key, set]) =>
      set?.has('ALL') || set?.has(dp[key])
    )
  );
}

function makeProdIdButtons(container) {
  const table =
    container.querySelector('table') ||
    container.querySelector('.data-container table');
  if (!table) return;

  const norm = (s) =>
    String(s || '')
      .trim()
      .toUpperCase()
      .replace(/\s+/g, '_');

  const ths = table.querySelectorAll('thead th');
  let prodIdx = -1;
  ths.forEach((th, i) => {
    if (norm(th.textContent) === 'PROD_ID') prodIdx = i;
  });
  if (prodIdx === -1) return;

  table.querySelectorAll('tbody tr').forEach((row) => {
    const cell = row.cells?.[prodIdx];
    if (!cell) return;

    if (!cell.querySelector('.prod-id-link')) {
      const txt = (cell.textContent || '').trim();
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'prod-id-link link-button';
      btn.textContent = txt || 'â€”';
      btn.dataset.prodId = txt || '';
      btn.setAttribute('aria-label', `Produkt Ã¶ffnen: ${txt || 'â€”'}`);
      btn.setAttribute('role', 'link');
      btn.tabIndex = 0;

      cell.textContent = '';
      cell.appendChild(btn);
    }
  });
}



export { prodData };


