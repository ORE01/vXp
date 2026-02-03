import processData, { filterColumnsInData } from '../../core/ui/MODAL_HELPER/dataProcessor.js';
import { handleModalAction } from '../../core/ui/MODAL_HELPER/ModalActionHandler.js';
import { addTooltipsForTruncatedText } from '../../utils/tooltips.js';
import { appState } from '../../renderer.js';
import { openProdEditorByProdId } from '../../utils/linksToTables.js';


// ======================================================
// ðŸŒ SPALTEN-KONFIG FÃœR ProdAll
// ======================================================

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

// 2) Wunsch-Reihenfolge fÃ¼r Felder im Add/Edit-Modal
const PROD_FIELD_ORDER = [
  'INCLUDE',
  'PROD_ID',
  'DESCRIPTION',
  'ISSUER',
  'TICKER',
  'RANK',
  'RATING_PROD',
  'CouponType',
  'START_DATE',
  'MATURITY',
  'COUPON',
  'TENOR',
  'GEARING',
  'SPREADS',
  'CAP',
  'FLOOR',
  'SCHEDULE',
  'FINLIB',
  'MODEL',
  'METHODE',
  'CS_Szenario',
  
   
  
  
  // alles Weitere (CAP, FLOOR, GEARING, SPREADS â€¦) hinten dran
];



// ======================================================

let prodData;

export function handleProdData(filtersConfig) {
  const prodDataContainer = document.getElementById('prodDataContainer');
  if (!prodDataContainer) return;

  // Daten holen
  prodData = appState.getProdData();
  if (!Array.isArray(prodData) || prodData.length === 0) {
    console.warn('handleProdData: prodData leer/ungÃ¼ltig');
    prodDataContainer.innerHTML = '';
    return;
  }

  // Spalten filtern fÃ¼r Anzeige
  const filteredProdData = filterColumnsInData(
    filterProdData(prodData, filtersConfig),
    PROD_TABLE_COLUMNS
  );

  appState.setFilteredProdData(filteredProdData);
  checkCSSzenarioFlag?.(filteredProdData);

  // Render Tabelle
  prodDataContainer.innerHTML = processData(filteredProdData, 'ProdAll');

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

  // Add-Button (optional)
  const prodAddButton = document.getElementById('prodAddButton');
  if (prodAddButton && !prodAddButton.dataset.bound) {
    prodAddButton.dataset.bound = '1';
    prodAddButton.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      handleModalAction(event, prodData, null, 'ProdAll', 'add');
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

function checkCSSzenarioFlag(filteredProdData) {
  const csWarningContainer = document.getElementById('csWarningContainer');
  const csWarningLight = document.getElementById('csWarning');

  if (!csWarningContainer || !csWarningLight) {
    console.error("âš ï¸ 'csWarningContainer' oder 'csWarning' nicht gefunden!");
    return;
  }

  const affectedRows = filteredProdData.filter(
    (row) =>
      row.CS_Szenario !== null &&
      row.CS_Szenario !== undefined &&
      (typeof row.CS_Szenario === 'number' ||
        (typeof row.CS_Szenario === 'string' &&
          row.CS_Szenario.trim() !== ''))
  );

  const affectedProdIds = affectedRows.map((row) => row.PROD_ID);

  if (affectedProdIds.length > 0) {
    csWarningContainer.style.visibility = 'visible';
    csWarningLight.style.backgroundColor = 'red';
    const idsText = affectedProdIds.join(', ');
    document.getElementById('csWarningText').textContent = idsText;
  } else {
    csWarningContainer.style.visibility = 'hidden';
    csWarningLight.style.backgroundColor = 'gray';
  }
}

/**
 * Bringt ein ProdAll-Row-Objekt in die gewÃ¼nschte Feld-Reihenfolge
 * â€“ genutzt im Formular (Add/Edit), damit CAP & Co. nicht vorne stehen.
 */
export function buildOrderedFieldsForModal(row) {
  if (!row) return row;

  const ordered = {};

  // 1) Zuerst unsere Wunsch-Felder in definierter Reihenfolge
  PROD_FIELD_ORDER.forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(row, key)) {
      ordered[key] = row[key];
    }
  });

  // 2) Alle Ã¼brigen Felder hinten anhÃ¤ngen
  Object.keys(row).forEach((key) => {
    if (!Object.prototype.hasOwnProperty.call(ordered, key)) {
      ordered[key] = row[key];
    }
  });

  return ordered;
}

export { prodData };


