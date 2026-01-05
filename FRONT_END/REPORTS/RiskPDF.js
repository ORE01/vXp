const { jsPDF } = window.jspdf;
import { getActiveRiskSectionsForPdf } from './RiskPDFPreview.js';

// =====================================================================
// REPORT DEFAULTS – nur für TOC, Dateiname, Format
// =====================================================================
export const REPORT_DEFAULTS = {
  includeTOC: true,
  fileName: 'Risk.pdf',
  paper: 'a4',
  orientation: 'p',
};

const reportTimestamp = new Date();

const formatTimestamp = (d) => {
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} `
       + `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const reportTimeText = formatTimestamp(reportTimestamp);


// =====================================================================
// Section-Titel automatisch aus DOM (wird von der Preview importiert)
// =====================================================================
export function getSectionTitleFromPanel(panel, fallbackKey = '') {
  if (!panel) return fallbackKey || 'Section';

  // 1) Datenattribute am Panel
  const dataTitle =
    (panel.dataset && panel.dataset.title) ||
    panel.getAttribute('data-panel-title');

  if (dataTitle && dataTitle.trim()) {
    return dataTitle.trim();
  }

  // 2) Überschrift im Panel suchen
  const heading = panel.querySelector(
    '.panel-title, .sub-panel-title, h2, h3, h1'
  );
  if (heading) {
    const text = (heading.textContent || '').trim();
    if (text) return text;
  }

  // 3) Fallback aus ID / Key ableiten
  const raw = panel.id || fallbackKey || '';
  if (raw) {
    const cleaned = raw
      .replace(/^panel-/, '')     // "panel-" vorne weg
      .replace(/_Modal$/, '')     // evtl. "_Modal" weg
      .replace(/[_-]+/g, ' ')     // "_" und "-" zu Leerzeichen
      .trim();

    if (cleaned) {
      // Erste Buchstaben groß
      return cleaned.replace(/\b\w/g, c => c.toUpperCase());
    }
  }

  // 4) Letzter Fallback
  return 'Section';
}

// =====================================================================
// GENERATE RISK PDF – Nur noch: aktive Sections/Charts/Tables aus Preview
// =====================================================================

// Canvas/Plotly-Export – Helfer bleiben wie gehabt
async function exportChartAsPngDataUrl(ch) {
  const el = document.getElementById(ch.id);
  if (!el) return null;

  if (el.tagName === 'CANVAS') {
    try { return el.toDataURL('image/png'); } catch { return null; }
  }

  if (ch.id === 'swaption-atm-surface-3d' && appState?.swaptionATMSurfacePng) {
    return appState.swaptionATMSurfacePng;
  }
  if (ch.id === 'swaption-cube-surface-3d' && appState?.swaptionCubeSurfacePng) {
    return appState.swaptionCubeSurfacePng;
  }

  if (typeof Plotly !== 'undefined' && typeof Plotly.toImage === 'function') {
    try {
      return await Plotly.toImage(el, { format: 'png', width: 1200, height: 700, scale: 2 });
    } catch (e) {
      console.warn('[PDF] Plotly.toImage failed for', ch.id, e);
      return null;
    }
  }

  return null;
}

// Drop-in Replacement (async-safe, jetzt mit getActiveRiskSectionsForPdf)
export async function generateRiskPDF(filteredData, overrides = {}) {
  const opts = { ...REPORT_DEFAULTS, ...overrides };

  const doc = new jsPDF({ orientation: opts.orientation, format: opts.paper });
  const totalPagesExp = '{total_pages_count_string}';

  const tocEntries = [];
  let sectionCounters = [];

  function addTOCEntry(title, page, level = 1) {
    if (!opts.includeTOC) return;

    level = Math.max(1, Math.min(3, (level | 0) || 1));

    if (sectionCounters.length >= level) {
      sectionCounters = sectionCounters.slice(0, level);
    } else {
      while (sectionCounters.length < level) sectionCounters.push(0);
    }

    sectionCounters[level - 1]++;
    const sectionNumber = sectionCounters.join('.');
    tocEntries.push({ title: `${sectionNumber}. ${title}`, page, level });
  }

  // 🔥 Zentrale Wahrheit aus der Preview:
  // getActiveRiskSectionsForPdf() liefert nur Sections mit aktivem Inhalt
  const sections = getActiveRiskSectionsForPdf() || [];

  let wroteAnySection = false;

  for (const sec of sections) {
    if (wroteAnySection) {
      doc.addPage();
    }
    wroteAnySection = true;

    const title = sec.title || sec.key;
    const pageIndex = doc.internal.getNumberOfPages(); // aktuelle Seite
    addTOCEntry(title, pageIndex, 1);

    // Render nur dieser Section (Charts + Tabellen, jeweils nur enabled)
    await renderPanelSectionToPDF(doc, sec);
  }

  // Appendix nur wenn Daten existieren
  if (Array.isArray(filteredData) && filteredData.length) {
    if (wroteAnySection) doc.addPage();
    wroteAnySection = true;

    const pageIndex = doc.internal.getNumberOfPages();
    addTOCEntry('Appendix: Product Table', pageIndex, 1);
    drawProductTableSection(doc, filteredData);
  }

    // === 3) TOC-Seite vorne einfügen ===
  if (opts.includeTOC && tocEntries.length) {
    doc.insertPage(1);
    doc.setPage(1);
    doc.setFontSize(16);
    doc.text('Table of Contents', 14, 20);
    doc.setFontSize(11);

    tocEntries.forEach((entry, index) => {
      const indent = (entry.level - 1) * 5;
      const lineY = 30 + index * 8;

      const pageWidth = doc.internal.pageSize.getWidth();
      const marginLeft = 20 + indent;
      const marginRight = 20;
      const maxLineWidth = pageWidth - marginLeft - marginRight;

      const pageText = (entry.page + 1).toString(); // +1 wegen TOC-Seite
      const pageTextWidth = doc.getTextWidth(pageText);

      const titleText = entry.title;
      const titleTextWidth = doc.getTextWidth(titleText);

      const dotsWidth = Math.max(0, maxLineWidth - titleTextWidth - pageTextWidth);
      const dotW = doc.getTextWidth('.');
      const dots = dotW ? '.'.repeat(Math.floor(dotsWidth / dotW)) : '';

      doc.text(`${titleText} ${dots} ${pageText}`, marginLeft, lineY);
    });
  }

// // === 4) Seitenzahlen einfügen ===
//   const pageCount = doc.internal.getNumberOfPages();
//   for (let i = 1; i <= pageCount; i++) {
//     doc.setPage(i);
//     doc.setFontSize(8);
//     doc.text(
//       `Page ${i} / ${totalPagesExp}`,
//       doc.internal.pageSize.getWidth() - 30,
//       doc.internal.pageSize.getHeight() - 10
//     );
//   }

// === 4) Seitenzahlen einfügen (FINAL) ===
// const pageCount = doc.internal.getNumberOfPages();

// for (let i = 1; i <= pageCount; i++) {
//   doc.setPage(i);
//   doc.setFontSize(8);

//   doc.text(
//     `Page ${i} / ${pageCount}`,
//     doc.internal.pageSize.getWidth() - 30,
//     doc.internal.pageSize.getHeight() - 10
//   );
// }

// === 4) Fußzeile + Seitenzahlen (FINAL) ===
// const pageCount = doc.internal.getNumberOfPages();

// const pageW = doc.internal.pageSize.getWidth();
// const pageH = doc.internal.pageSize.getHeight();

// for (let i = 1; i <= pageCount; i++) {
//   doc.setPage(i);
//   doc.setFontSize(8);

//   const footerY = pageH - 12;

//   // --- links: Timestamp (2 Zeilen, linksbündig) ---
//   doc.text(
//     ['Report generated:', reportTimeText],
//     14,
//     footerY
//   );

//   // --- mitte: Branding ---
//   doc.text(
//     'generated by valuationXpro',
//     pageW / 2,
//     footerY + 4,
//     { align: 'center' }
//   );

//   // --- rechts: Seitenzahl ---
//   doc.text(
//     `Page ${i} / ${pageCount}`,
//     pageW - 14,
//     footerY + 4,
//     { align: 'right' }
//   );
// }


// === 4) Header + Footer (FINAL) ===
const pageCount = doc.internal.getNumberOfPages();

const pageW = doc.internal.pageSize.getWidth();
const pageH = doc.internal.pageSize.getHeight();

// Logo aus DOM (bereits vorhanden: <img id="logo" src="assets/logo.png" ...>)
const logoEl = document.getElementById('logo');

// Layout-Parameter
const headerY = 14;
const logoY   = 8;
const maxLogoW = 30;
const maxLogoH = 12;

for (let i = 1; i <= pageCount; i++) {
  doc.setPage(i);

  /* ================= HEADER ================= */

  doc.setFontSize(10);

  // links oben: Berichtstitel
  doc.text('Title', 14, headerY);

  // rechts oben: Logo (automatisch skaliert)
if (logoEl && logoEl.complete && logoEl.naturalWidth > 0) {

  const imgW = logoEl.naturalWidth;
  const imgH = logoEl.naturalHeight;
  const ratio = imgW / imgH;

  let logoW = maxLogoW;
  let logoH = logoW / ratio;

  // falls Höhe zu groß → nach Höhe skalieren
  if (logoH > maxLogoH) {
    logoH = maxLogoH;
    logoW = logoH * ratio;
  }

  doc.addImage(
    logoEl,
    'PNG',
    pageW - 14 - logoW,   // rechtsbündig
    logoY,
    logoW,
    logoH
  );
}


  /* ================= FOOTER ================= */

  doc.setFontSize(8);
  const footerY = pageH - 12;

  // links: Timestamp (2 Zeilen) – Variable existiert bereits!
  doc.text(
    ['Report generated:', reportTimeText],
    14,
    footerY
  );

  // mitte: Branding
  doc.text(
    'generated by valuationXpro',
    pageW / 2,
    footerY + 4,
    { align: 'center' }
  );

  // rechts: Seitenzahl
  doc.text(
    `Page ${i} / ${pageCount}`,
    pageW - 14,
    footerY + 4,
    { align: 'right' }
  );
}


  doc.save(opts.fileName || 'Risk.pdf');
}

// =====================================================================
// Rendering einer Section: nutzt NUR enabledCharts / enabledTables
// =====================================================================
async function renderPanelSectionToPDF(doc, sec) {
  const pageW   = doc.internal.pageSize.getWidth();
  const pageH   = doc.internal.pageSize.getHeight();
  const marginX = 10;
  const marginY = 20;
  const gutter  = 10;

  let y = marginY;

  const title = sec.title || sec.key;
  doc.setFontSize(14);
  doc.text(title, marginX, y);
  y += 8;

  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  async function plotlyToPngDataUrl(el) {
    if (!el || typeof Plotly === "undefined") return null;

    for (let i = 0; i < 10; i++) {
      try {
        if (el._fullLayout) break;
      } catch {}
      await sleep(40);
    }

    try {
      const dataUrl = await Plotly.toImage(el, {
        format: "png",
        width: Math.max(900, el.clientWidth || 900),
        height: Math.max(520, el.clientHeight || 520),
        scale: 2
      });
      return dataUrl;
    } catch (e) {
      console.warn("[PDF] Plotly export failed for", el.id, e);
      return null;
    }
  }

  function canvasToPngDataUrl(canvas) {
    try {
      return canvas.toDataURL("image/png");
    } catch (e) {
      console.warn("[PDF] Canvas export failed for", canvas?.id, e);
      return null;
    }
  }

  // --- 1) Charts dieser Section (bereits gefiltert durch Preview) ----
  const charts = sec.enabledCharts || [];

  const chartWidth  = (pageW - marginX * 2 - gutter) / 2;
  const chartHeight = 60;
  let colInRow = 0;

  for (const ch of charts) {
    const el = document.getElementById(ch.id);
    if (!el) continue;

    if (y + chartHeight + 16 > pageH - marginY) {
      doc.addPage();
      y        = marginY;
      colInRow = 0;
      doc.setFontSize(14);
      doc.text(`${title} (cont.)`, marginX, y);
      y += 8;
    }

    const x = marginX + colInRow * (chartWidth + gutter);

    let imgDataUrl = null;

    if (el.tagName === "CANVAS") {
      imgDataUrl = canvasToPngDataUrl(el);
    } else {
      imgDataUrl = await plotlyToPngDataUrl(el);
    }

    if (!imgDataUrl) {
      colInRow++;
      if (colInRow >= 2) { colInRow = 0; y += chartHeight + 18; }
      continue;
    }

    try {
      doc.setFillColor(240);
      doc.rect(x - 2, y - 2, chartWidth + 4, chartHeight + 12, "F");
      doc.setFontSize(9);
      doc.text(ch.label || ch.id, x + chartWidth / 2, y - 4, { align: "center" });
      doc.addImage(imgDataUrl, "PNG", x, y, chartWidth, chartHeight);
    } catch (e) {
      console.warn("[PDF] addImage failed for", ch.id, e);
    }

    colInRow++;
    if (colInRow >= 2) {
      colInRow = 0;
      y += chartHeight + 18;
    }
  }

  if (charts.length && colInRow !== 0) {
    colInRow = 0;
    y += chartHeight + 10;
  }

  // --- 2) Tabellen dieser Section (bereits gefiltert durch Preview) ---
  const tables = sec.enabledTables || [];

  for (const t of tables) {
    const tbl = extractTableFromContainer(t.id, { maxRows: 500, maxCols: 40 });
    if (!tbl || !tbl.body.length) continue;

    if (y + 40 > pageH - marginY) {
      doc.addPage();
      y = marginY;
      doc.setFontSize(14);
      doc.text(`${title} (cont.)`, marginX, y);
      y += 8;
    }

    doc.setFontSize(11);
    doc.text(t.label || t.id, marginX, y);

    doc.autoTable({
      startY: y + 6,
      head: [tbl.head],
      body: tbl.body,
      styles: { fontSize: 8, cellPadding: 2 },
      theme: "grid",
      headStyles: { fillColor: [34, 34, 34], textColor: [220, 220, 220] },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      margin: { left: marginX, right: marginX },
      tableWidth: "auto",
    });

    y = doc.lastAutoTable?.finalY ? doc.lastAutoTable.finalY + 10 : y + 60;
  }
}

// =====================================================================
// Appendix-Block – wie gehabt
// =====================================================================
function drawProductTableSection(doc, filteredData) {
  const riskData = extractProductRiskData(filteredData);
  doc.setFontSize(14);
  doc.text('Anhang: Produkt-Tabelle', 14, 20);

  const tableData = riskData.map(item => [
    item.PROD_ID,
    item.DESCRIPTION,
    item.ISSUER,
    item.NOTIONAL,
    item.NAV,
  ]);

  doc.autoTable({
    head: [['Produkt-ID', 'Beschreibung', 'Issuer', 'Notional', 'NAV']],
    body: tableData,
    startY: 30,
    styles: { cellPadding: 2, fontSize: 10 },
    headStyles: { fillColor: [255, 102, 102] },
    theme: 'striped',
  });
}

function extractProductRiskData(filteredData) {
  if (!filteredData || !Array.isArray(filteredData)) return [];
  return filteredData.map(entry => ({
    PROD_ID: entry.PROD_ID || '',
    DESCRIPTION: (entry.DESCRIPTION || '').toString().substring(0, 100),
    ISSUER: entry.ISSUER || '',
    NOTIONAL: entry.NOTIONAL != null ? entry.NOTIONAL.toString() : '',
    NAV: entry.NAV != null ? entry.NAV.toString() : '',
  }));
}

// ───────────── generisches Table-Extract (alle Spalten) ─────────────
function extractTableFromContainer(containerIds, { maxRows = 100, maxCols = 20 } = {}) {
  const ids = Array.isArray(containerIds) ? containerIds : [containerIds];
  let container = null;

  for (const id of ids) {
    const el = document.getElementById(id);
    if (el) { container = el; break; }
  }
  if (!container) return null;

  const table = container.querySelector('table');
  if (!table) return null;

  const theadCells = Array.from(table.querySelectorAll('thead th'));
  let head = theadCells.slice(0, maxCols).map(th => (th.textContent || '').trim());

  const tbody = table.querySelector('tbody');
  let rows = tbody ? Array.from(tbody.querySelectorAll('tr'))
                   : Array.from(table.querySelectorAll('tr'));

  if (!head.length && rows.length) {
    const firstCells = Array.from(rows[0].children).slice(0, maxCols);
    head = firstCells.map(c => (c.textContent || '').trim());
    rows = rows.slice(1);
  }

  const cellText = (td) => {
    const radios = td.querySelectorAll('input[type="radio"]');
    if (radios.length) {
      const checked = Array.from(radios).some(r => r.checked);
      return checked ? 'X' : '';
    }
    const cbs = td.querySelectorAll('input[type="checkbox"]');
    if (cbs.length) {
      const checked = Array.from(cbs).some(cb => cb.checked);
      return checked ? '✓' : '';
    }
    return (td.textContent || '').trim();
  };

  const body = [];
  rows.slice(0, maxRows).forEach(tr => {
    const cells = Array.from(tr.children).slice(0, maxCols);
    const row   = cells.map(td => cellText(td));
    if (row.some(v => v !== '')) body.push(row);
  });

  if (!head.length && body.length) {
    head = body[0].map((_, i) => `COL ${i + 1}`);
  }

  return (head.length || body.length) ? { head, body } : null;
}







