export function addTooltipsForTruncatedText(container) {
    const cells = container.querySelectorAll('td');
    cells.forEach((cell) => {
      //console.log(`Cell content: "${cell.textContent}", scrollWidth: ${cell.scrollWidth}, clientWidth: ${cell.clientWidth}`);
      if (cell.scrollWidth > cell.clientWidth) {
        cell.setAttribute('title', cell.textContent);
        //console.log(`Tooltip added: "${cell.textContent}"`);
      }
    });
  }


// Optional: einmalige Warn-Rate-Limit pro Session (als statische Eigenschaft der Funktion)
export function addProdIdTooltips(container) {
  if (!container) {
    console.warn('⚠️ Warning: Container is undefined or null.');
    return;
  }

  // Bereits im selben Render verarbeitet? → raus
  if (container.dataset.tooltipsReady === '1') return;

  // Status prüfen
  const rows = container.querySelectorAll('tbody tr');
  const prodAllData = appState.getProdData?.() ?? [];

  // 1) Kaltstart: keine Daten & keine Zeilen → still raus (kein Toast/Log)
  if ((!Array.isArray(prodAllData) || prodAllData.length === 0) && rows.length === 0) {
    return;
  }

  // 2) Es gibt schon Zeilen, aber (noch) keine Produktdaten → einmalig warnen, dann raus
  if (!Array.isArray(prodAllData) || prodAllData.length === 0) {
    if (!addProdIdTooltips._warnedEmpty) {
      console.warn('⚠️ Warning: prodAllData is empty or undefined.');
      showToastMessage?.('⚠️ Warning: Produktdaten noch nicht geladen.', 'warning');
      addProdIdTooltips._warnedEmpty = true;
    }
    return;
  }

  // 3) Header/Spaltenindex finden
  const headerRow = container.querySelector('thead tr');
  if (!headerRow) {
    showToastMessage?.('⚠️ Warning: No table header found in the portfolio.', 'warning');
    return;
  }

  const headers = Array.from(headerRow.querySelectorAll('th'));
  const prodIdColumnIndex = headers.findIndex(th => (th.textContent || '').trim().toUpperCase() === 'PROD_ID');

  if (prodIdColumnIndex === -1) {
    showToastMessage?.('⚠️ Warning: No "PROD_ID" column found in this portfolio.', 'warning');
    return;
  }

  // 4) Defer: DOM erst stabil rendern lassen → weniger Forced Reflows
  return requestAnimationFrame(() => {
    try {
      // Lookup-Map (O(1) statt Array.find pro Zeile)
      const map = new Map();
      for (const p of prodAllData) {
        if (p && p.PROD_ID != null) map.set(String(p.PROD_ID).trim(), p);
      }

      const trList = container.querySelectorAll('tbody tr');
      const missing = new Set();

      trList.forEach(row => {
        const cells = row.querySelectorAll('td');
        const cell = cells[prodIdColumnIndex];
        if (!cell) return;

        const prodId = (cell.textContent || '').trim();
        if (!prodId) return;

        const d = map.get(prodId);
        if (d) {
          const tooltipContent =
            `Product ID: ${d.PROD_ID ?? 'N/A'}\n` +
            `Description: ${d.DESCRIPTION ?? 'N/A'}\n` +
            `Coupon Type: ${d.CouponType ?? 'N/A'}\n` +
            `Maturity: ${d.MATURITY ?? 'N/A'}\n` +
            `Issuer: ${d.ISSUER ?? 'N/A'}\n` +
            `Rank: ${d.RANK ?? 'N/A'}\n` +
            `Rating: ${d.RATING_PROD ?? 'N/A'}\n`;

          // Setze nur, wenn neu/anders → spart Reflows
          if (cell.getAttribute('title') !== tooltipContent) {
            cell.setAttribute('title', tooltipContent);
          }
        } else {
          missing.add(prodId);
        }
      });

      if (missing.size > 0) {
        const list = Array.from(missing).join(', ');
        console.warn(`⚠️ Warning: No details found for the following PROD_IDs: ${list}`);
        showToastMessage?.(`⚠️ Warning: Missing product details for PROD_IDs: ${list}`, 'warning');
      }

      // Markiere als erledigt für diesen Render
      container.dataset.tooltipsReady = '1';
    } catch (e) {
      console.error('addProdIdTooltips failed:', e);
    }
  });
}
// statische Property für einmaliges Warnen
addProdIdTooltips._warnedEmpty = false;


function showToastMessage(message, type = 'info') {
  const toast = document.createElement('div');
  toast.textContent = message;

  // Basic styling for the toast
  toast.style.position = 'absolute';
  toast.style.bottom = '20px';
  toast.style.right = '20px';
  toast.style.backgroundColor = type === 'warning' ? '#ff9800' : '#4CAF50';  // Orange for warnings, green for success
  toast.style.color = 'white';
  toast.style.padding = '10px 20px';
  toast.style.borderRadius = '5px';
  toast.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';
  toast.style.fontFamily = '"Your Font Name", sans-serif';
  toast.style.fontSize = '13px';
  toast.style.opacity = '0';
  toast.style.transition = 'opacity 0.3s ease';
  toast.style.zIndex = '1000';

  // Append to app container
  const appContainer = document.getElementById('app') || document.body;
  appContainer.appendChild(toast);

  // Fade in
  setTimeout(() => {
    toast.style.opacity = '1';
  }, 100);

  // Auto-remove after 3 seconds
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => appContainer.removeChild(toast), 300);
  }, 3000);
}

  
  
  
  
  