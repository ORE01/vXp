import { generateRiskPDF } from './RiskPDF.js';
import { wireRiskPreview } from './RiskPDFPreview.js';
import { showMessageBox } from '../../core/ui/dialogs/confirm.js';

/**
 * Verdrahtet Risk Report UI (Thumbnails Refresh + Risk PDF).
 * Scoped: arbeitet nur innerhalb #app-root, Report-Assets in #report-root.
 */
export function wireRiskReportUI({ appRoot, reportRoot, appState, handleIRSensData, handleCSSensData } = {}) {
  if (window.__riskReportUIWired) return;
  window.__riskReportUIWired = true;

  // Roots robust holen (falls Bridge nicht übergibt)
  appRoot = appRoot || document.getElementById('app-root');
  reportRoot = reportRoot || document.getElementById('report-root');

  if (!appRoot) throw new Error('[RiskReportUI] appRoot missing (#app-root)');
  if (!reportRoot) throw new Error('[RiskReportUI] reportRoot missing (#report-root)');

  // Preview wiring (einmal) – idealerweise ebenfalls scoped
  try { wireRiskPreview?.({ appRoot, reportRoot, appState }); }
  catch (e) { console.warn('[RiskPreview] wireRiskPreview failed', e); }

  // Refresh thumbnails
  appRoot.querySelector('#refreshThumbnailsBtn')?.addEventListener('click', async (e) => {
    const btn = e?.currentTarget || appRoot.querySelector('#refreshThumbnailsBtn');
    if (!btn) return;

    // Button-Status (Executing… + Punkt) wird zentral in RiskPDFPreview gesteuert.
    // Arbeit erst NACH dem Paint, sonst blockiert sie die Busy-Anzeige.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      try {
        const portMainData =
          (appState?.getPortMainData?.() ||
           appState?.getPortMainTable?.() ||
           window.appState?.getPortMainData?.() ||
           window.appState?.getPortMainTable?.() ||
           []);

        if (typeof handleIRSensData !== 'function') {
          throw new Error('handleIRSensData is not available (import missing or wrong)');
        }

        const irTable = handleIRSensData(portMainData);
        replaceContent(appRoot, 'IRSensDataContainer', irTable);

        if (typeof handleCSSensData === 'function') {
          const crTable = handleCSSensData(portMainData);
          replaceContent(appRoot, 'CSSensDataContainer', crTable);
        }

        document.dispatchEvent(
          new CustomEvent('risk:refresh-thumbnails', { detail: { source: 'manual-refresh' } })
        );
      } catch (err) {
        console.error('[RiskPDF] refresh failed:', err);
      }
    }));
  });

  // Risk PDF
  appRoot.querySelector('#riskPDFButton')?.addEventListener('click', () => {
    const data = appState?.getFilteredPortData?.() || [];
    // Portfolio-Daten werden NUR für portfolioabhängige Teile gebraucht (Produkt-
    // Appendix, der in generateRiskPDF ohnehin nur bei vorhandenen Daten gezeichnet
    // wird). Kundenweite Sektionen (CUSTOMER SETUP) sollen auch OHNE Portfolio
    // druckbar sein → nicht mehr hart abbrechen, nur Hinweis loggen.
    if (!data.length) {
      console.warn('[RiskReportUI] kein Portfolio gewählt — PDF wird nur aus den ausgewählten Sektionen erzeugt (kein Produkt-Appendix).');
    }

    try {
      const presetName = getCurrentReportPresetName(appRoot);
      const safeName = sanitizeFileName(presetName);
      const fileName = safeName ? `Risk - ${safeName}.pdf` : 'Risk.pdf';

      // Seitenformat aus dem Preview-Selector (Portrait/Landscape).
      const orientation = appRoot.querySelector('#riskPdfOrientation')?.value === 'l' ? 'l' : 'p';

      // Anzeige-Titel aus dem Feld (leer -> generateRiskPDF nutzt Default 'Risk Report').
      const reportTitle = (appRoot.querySelector('#reportDisplayTitleInput')?.value || '').trim();

      // ✅ Report-safe: pass roots into PDF generator
      generateRiskPDF(data, { fileName, appRoot, reportRoot, orientation, reportTitle });
    } catch (e) {
      console.error(e);
      const msg = 'Risk-PDF-Erstellung fehlgeschlagen.';
      if (typeof showMessageBox === 'function') showMessageBox(msg);
      else console.warn('[RiskReportUI]', msg);
    }
  });
}

function replaceContent(root, containerId, node) {
  const el = root.querySelector('#' + containerId);
  if (!el) return;
  el.innerHTML = '';
  if (node) el.appendChild(node);
}

function sanitizeFileName(name) {
  const s = String(name || '').trim();
  if (!s) return '';
  return s
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}

function getCurrentReportPresetName(appRoot) {
  return (
    appRoot.querySelector('#customerReportsNameInput')?.value ||
    appRoot.querySelector('#customerReportsDropdown')?.value ||
    ''
  ).trim();
}
