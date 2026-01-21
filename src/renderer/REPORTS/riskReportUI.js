// FRONT_END/REPORTS/riskReportUI.js

import { generateRiskPDF } from './RiskPDF.js';
import { wireRiskPreview } from './RiskPDFPreview.js';

/**
 * Verdrahtet Risk Report UI (Thumbnails Refresh + Risk PDF).
 */
export function wireRiskReportUI({ appState, handleIRSensData, handleCSSensData } = {}) {
  if (window.__riskReportUIWired) return;
  window.__riskReportUIWired = true;

  // Preview wiring (einmal)
  try { wireRiskPreview?.(); } catch (e) { console.warn('[RiskPreview] wireRiskPreview failed', e); }

  // Refresh thumbnails
  document.getElementById('refreshThumbnailsBtn')?.addEventListener('click', async (e) => {
    const btn = e?.currentTarget || document.getElementById('refreshThumbnailsBtn');
    if (!btn) return;

    const original = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Refreshing…';

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
      replaceContent('IRSensDataContainer', irTable);

      if (typeof handleCSSensData === 'function') {
        const crTable = handleCSSensData(portMainData);
        replaceContent('CSSensDataContainer', crTable);
      }

      document.dispatchEvent(
        new CustomEvent('risk:refresh-thumbnails', { detail: { source: 'manual-refresh' } })
      );
    } catch (err) {
      console.error('[RiskPDF] refresh failed:', err);
    } finally {
      btn.disabled = false;
      btn.textContent = original;
    }
  });

  // Risk PDF
  document.getElementById('riskPDFButton')?.addEventListener('click', () => {
    const data = appState?.getFilteredPortData?.() || [];
    if (!data.length) {
      alert('❌ Keine Angebotsdaten verfügbar!');
      return;
    }

    try {
      const presetName = getCurrentReportPresetName();
      const safeName = sanitizeFileName(presetName);
      const fileName = safeName ? `Risk - ${safeName}.pdf` : 'Risk.pdf';

      generateRiskPDF(data, { fileName });
    } catch (e) {
      console.error(e);
      alert('Risk-PDF-Erstellung fehlgeschlagen.');
    }
  });
}

function replaceContent(containerId, node) {
  const el = document.getElementById(containerId);
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

function getCurrentReportPresetName() {
  return (
    document.getElementById('customerReportsNameInput')?.value ||
    document.getElementById('customerReportsDropdown')?.value ||
    ''
  ).trim();
}
