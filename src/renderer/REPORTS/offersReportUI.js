// FRONT_END/REPORTS/offersReportUI.js

import { generateOfferPDF } from './OffersPDF.js';
import {
  getOffersReportData,
  getOffersReportOptions,
  renderOffersPreview,
  rowsAsObjectsFrom,
  setOffersReportData,
  wireOffersPreview
} from './OffersPDFPreview.js';

/**
 * Verdrahtet Offers Report UI (Preview + PDF).
 * Erwartet openPanel aus UI/panels.js.
 */
export function wireOffersReportUI({ openPanel } = {}) {
  if (window.__offersReportUIWired) return;
  window.__offersReportUIWired = true;

  // "Go to Report" Button
  document.getElementById('offersGoToReportButton')?.addEventListener('click', () => {
    const rows = rowsAsObjectsFrom('portDataContainer4');
    if (!rows.length) { alert('❌ Keine Daten in #portDataContainer4.'); return; }

    setOffersReportData(rows);

    // Panel öffnen
    if (typeof openPanel === 'function') openPanel('panel-reports-offers');

    // Preview wiring
    wireOffersPreview({
      containerPreviewId: 'reportsOffersPreview',
      containerId: 'portDataContainer4',
      dropdownId: 'reportsOffersDropdown'
    });

    // Render Preview
    renderOffersPreview?.('reportsOffersPreview', 'portDataContainer4');
  });

  // "PDF" Button
  document.getElementById('offerPDFButton')?.addEventListener('click', () => {
    // 1) Canvas Snapshot merken (falls vorhanden)
    const c = document.getElementById('offersProductYieldChart');
    if (c && c.toDataURL) {
      try {
        window.__offersCharts = window.__offersCharts || {};
        window.__offersCharts.productYieldPNG = c.toDataURL('image/png');
      } catch (e) {
        console.warn('[OffersPDF] Canvas Snapshot fehlgeschlagen:', e);
      }
    }

    // 2) PDF erzeugen
    const data = getOffersReportData();
    if (!data.length) { alert('❌ Bitte zuerst "Go to Report" klicken.'); return; }
    const opts = getOffersReportOptions();
    generateOfferPDF(data, opts);
  });
}
