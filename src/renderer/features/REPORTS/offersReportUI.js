// FRONT_END/REPORTS/offersReportUI.js

import { generateOfferPDF } from './OffersPDF.js';
import { OFFERS_TABLE_CONTAINER_ID } from './captureAdapter.js';
import {
  getOffersReportData,
  getOffersReportOptions,
  renderOffersPreview,
  rowsAsObjectsFrom,
  setOffersReportData,
  wireOffersPreview
} from './OffersPDFPreview.js';

import { showMessageBox } from '../../core/ui/dialogs/confirm.js';

/**
 * Verdrahtet Offers Report UI (Preview + PDF).
 * Erwartet openPanel aus UI/panels.js.
 */
export function wireOffersReportUI({ openPanel } = {}) {
  if (window.__offersReportUIWired) return;
  window.__offersReportUIWired = true;

  // "Go to Report" Button
  document.getElementById('offersGoToReportButton')?.addEventListener('click', () => {
    // Approach A: echte Offer-Datenobjekte aus dem State bevorzugen (richtige Keys);
    // DOM-Scrape der configurable Tabelle nur als Fallback.
    const stateRows = window.appState?.offersReportRows;
    const rows = (Array.isArray(stateRows) && stateRows.length)
      ? stateRows
      : rowsAsObjectsFrom(OFFERS_TABLE_CONTAINER_ID);
    if (!rows.length) {
      const msg = `❌ Keine Daten in #${OFFERS_TABLE_CONTAINER_ID}.`;
      if (typeof showMessageBox === 'function') showMessageBox(msg);
      else console.warn('[OffersReportUI]', msg);
      return;
    }

    setOffersReportData(rows);

    // Panel öffnen
    if (typeof openPanel === 'function') openPanel('panel-reports-offers');

    // Preview wiring
    wireOffersPreview({
      containerPreviewId: 'reportsOffersPreview',
      containerId: OFFERS_TABLE_CONTAINER_ID,
      dropdownId: 'reportsOffersDropdown'
    });

    // Render Preview
    renderOffersPreview?.('reportsOffersPreview', OFFERS_TABLE_CONTAINER_ID);
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
    if (!data.length) {
      const msg = '❌ Bitte zuerst "Go to Report" klicken.';
      if (typeof showMessageBox === 'function') showMessageBox(msg);
      else console.warn('[OffersReportUI]', msg);
      return;
    }
    const opts = getOffersReportOptions();
    generateOfferPDF(data, opts);
  });
}
