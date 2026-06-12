
  export function addTooltipsForTruncatedText(container) {
  const elements = container.querySelectorAll('td, .warning-text');

  elements.forEach((el) => {
    const fullText = el.dataset.fullText || el.textContent;

    if (el.scrollWidth > el.clientWidth || el.dataset.fullText) {
      el.setAttribute('title', fullText);
    }
  });
}

// Optional: einmalige Warn-Rate-Limit pro Session (als statische Eigenschaft der Funktion)
export function addProdIdTooltips(container) {
  if (!container) return;
  if (container.dataset.tooltipsReady === '1') return;

  const rows = container.querySelectorAll('tbody tr');
  const prodAllData = appState.getProdData?.() ?? [];

  if ((!Array.isArray(prodAllData) || prodAllData.length === 0) && rows.length === 0) return;
  if (!Array.isArray(prodAllData) || prodAllData.length === 0) return;

  const headerRow = container.querySelector('thead tr');
  if (!headerRow) return;

  const headers = Array.from(headerRow.querySelectorAll('th'));
  const prodIdColumnIndex = headers.findIndex(th => (th.textContent || '').trim().toUpperCase() === 'PROD_ID');
  if (prodIdColumnIndex === -1) return;

  return requestAnimationFrame(() => {
    try {
      const map = new Map();
      for (const p of prodAllData) {
        if (p && p.PROD_ID != null) map.set(String(p.PROD_ID).trim(), p);
      }

      const trList = container.querySelectorAll('tbody tr');

      trList.forEach(row => {
        const cells = row.querySelectorAll('td');
        const cell = cells[prodIdColumnIndex];
        if (!cell) return;

        const prodId = (cell.textContent || '').trim();
        if (!prodId) return;

        const d = map.get(prodId);
        if (!d) return;

        const tooltipContent =
          `Product ID: ${d.PROD_ID ?? 'N/A'}\n` +
          `Description: ${d.DESCRIPTION ?? 'N/A'}\n` +
          `Coupon Type: ${d.CouponType ?? 'N/A'}\n` +
          `Maturity: ${d.MATURITY ?? 'N/A'}\n` +
          `Issuer: ${d.ISSUER ?? 'N/A'}\n` +
          `Rank: ${d.RANK ?? 'N/A'}\n` +
          `Rating: ${d.RATING_PROD ?? 'N/A'}\n`;

        if (cell.getAttribute('title') !== tooltipContent) {
          cell.setAttribute('title', tooltipContent);
        }
      });

      container.dataset.tooltipsReady = '1';
    } catch {}
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
