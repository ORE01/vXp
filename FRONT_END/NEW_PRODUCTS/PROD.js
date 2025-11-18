import processData from '../../modal_HELPER/dataProcessor.js';
import { handleFormAction } from '../../modal_HELPER/FormButtonHandler.js';
import { filterColumnsInData } from '../../modal_HELPER/dataProcessor.js';
import { addTooltipsForTruncatedText } from '../../utils/tooltips.js';
import { appState } from '../renderer.js';
import { openProdEditorByProdId } from '../../utils/linksToTables.js';
import { handleCouponData } from './PRODCoupon.js';



let prodData;



export function handleProdData(filtersConfig) {
  const prodDataContainer = document.getElementById('prodDataContainer');
  if (!prodDataContainer) return;

  // Daten holen
  prodData = appState.getProdData();
  if (!Array.isArray(prodData) || prodData.length === 0) {
    console.warn('handleProdData: prodData leer/ungültig');
    prodDataContainer.innerHTML = '';
    return;
  }

  // Spalten filtern
  const columns = [
    'PROD_ID','DESCRIPTION','CouponType','SCHEDULE','MATURITY','ISSUER',
    'RANK','RATING_PROD','CS_Szenario','FINLIB','MODEL','METHODE'
  ];

  const filteredProdData = filterColumnsInData(
    filterProdData(prodData, filtersConfig),
    columns
  );

  appState.setFilteredProdData(filteredProdData);
  checkCSSzenarioFlag?.(filteredProdData);

  // Render
  prodDataContainer.innerHTML = processData(filteredProdData, 'ProdAll');

  // Tooltips
  try { addTooltipsForTruncatedText(prodDataContainer); } catch (e) { console.warn('Tooltips fail:', e); }

  // 👉 PROD_ID-Linkisierung (Buttons pro Render neu einsetzen)
  makeProdIdButtons(prodDataContainer);

  // 👉 Delegierter Klick-Listener (einmalig)
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
      handleFormAction(event, prodData, null, 'ProdAll', 'add');
    });
  }
}
    function filterProdData(data, filtersConfig) {
      return data.filter(dp =>
        Object.entries(filtersConfig || {}).every(([key, set]) =>
          set?.has('ALL') || set?.has(dp[key])
        )
      );
    }
    function makeProdIdButtons(container) {
      const table = container.querySelector('table') || container.querySelector('.data-container table');
      if (!table) return;

      const norm = s => String(s || '').trim().toUpperCase().replace(/\s+/g, '_');
      const ths = table.querySelectorAll('thead th');
      let prodIdx = -1;
      ths.forEach((th, i) => { if (norm(th.textContent) === 'PROD_ID') prodIdx = i; });
      if (prodIdx === -1) return;

      table.querySelectorAll('tbody tr').forEach((row) => {
        const cell = row.cells?.[prodIdx];
        if (!cell) return;

        if (!cell.querySelector('.prod-id-link')) {
          const txt = (cell.textContent || '').trim();
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'prod-id-link link-button';
          btn.textContent = txt || '—';
          btn.dataset.prodId = txt || '';
          btn.setAttribute('aria-label', `Produkt öffnen: ${txt || '—'}`);
          btn.setAttribute('role', 'link');
          btn.tabIndex = 0;

          cell.textContent = '';
          cell.appendChild(btn);
        }
      });
    }
    function checkCSSzenarioFlag(filteredProdData) {
        // console.log('🔍 CS Szenario Check läuft...');

        const csWarningContainer = document.getElementById('csWarningContainer');
        const csWarningLight = document.getElementById('csWarning'); 

        if (!csWarningContainer || !csWarningLight) {
            console.error("⚠️ Fehler: 'csWarningContainer' oder 'csWarning' nicht gefunden!");
            return;
        }

        // Finde alle betroffenen Zeilen
        const affectedRows = filteredProdData.filter(row =>
          row.CS_Szenario !== null &&
          row.CS_Szenario !== undefined &&
          (
            typeof row.CS_Szenario === 'number' ||
            (typeof row.CS_Szenario === 'string' && row.CS_Szenario.trim() !== '')
          )
        );
        
        
        const affectedProdIds = affectedRows.map(row => row.PROD_ID);

        if (affectedProdIds.length > 0) {
            csWarningContainer.style.visibility = 'visible'; // Warnung sichtbar machen
            csWarningLight.style.backgroundColor = 'red';  // Warnleuchte aktivieren

            // 🆕 PROD_IDs als Text hinzufügen, aber Warnleuchte beibehalten
            const idsText = affectedProdIds.join(', ');
            document.getElementById('csWarningText').textContent = idsText;

            // console.log(`🚨 CS Szenario aktiv für folgende PROD_IDs:`, affectedProdIds);
        } else {
            csWarningContainer.style.visibility = 'hidden'; // Warnung verstecken
            csWarningLight.style.backgroundColor = 'gray';  // Standardfarbe zurücksetzen

            // console.log('✅ Kein CS Szenario gesetzt.');
        }
    }

export { prodData };