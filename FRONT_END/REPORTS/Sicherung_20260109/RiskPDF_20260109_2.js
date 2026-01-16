/* RiskPDF.js — Full version with:
   - reusable layout (header/footer safe areas)
   - TOC
   - charts (canvas + plotly)
   - breakdown (one chart+legend per page + hierarchy headings)
   - credit/market traffic light special sections
   - SAFE autotable (no overlap, no stackoverflow)
*/

const { jsPDF } = window.jspdf;

import { getActiveRiskSectionsForPdf, RISK_CONFIG } from './RiskPDFPreview.js';

// =====================================================================
// REPORT DEFAULTS
// =====================================================================
export const REPORT_DEFAULTS = {
  includeTOC: true,
  fileName: 'Risk.pdf',
  paper: 'a4',
  orientation: 'p',
};

// =====================================================================
// TIMESTAMP
// =====================================================================
const reportTimestamp = new Date();

const formatTimestamp = (d) => {
  const pad = (n) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
};

const reportTimeText = formatTimestamp(reportTimestamp);

// =====================================================================
// LAYOUT SYSTEM (single source of truth)
// =====================================================================
export const PDF_LAYOUT_DEFAULTS = {
  marginLeft: 14,
  marginRight: 14,

  headerHeight: 18,
  headerGap: 10,     // main knob: space between header and content

  footerHeight: 16,
  footerGap: 8,      // space between content and footer

  sectionTitleSpacing: 12,
  blockGap: 10,
};

export function createPdfLayout(doc, overrides = {}) {
  const cfg = { ...PDF_LAYOUT_DEFAULTS, ...overrides };

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  // Distances (not absolute Y):
  const topMargin = cfg.headerHeight + cfg.headerGap;
  const bottomMargin = cfg.footerHeight + cfg.footerGap;

  const left = cfg.marginLeft;
  const right = cfg.marginRight;

  return {
    cfg,
    pageW,
    pageH,
    left,
    right,

    // content area boundaries (absolute Y)
    topY: topMargin,
    bottomY: pageH - bottomMargin,

    // margins as distances (for autoTable)
    topMargin,
    bottomMargin,

    contentWidth: pageW - left - right,

    startY() {
      return topMargin;
    },

    hasSpace(y, neededHeight) {
      return y + neededHeight <= (pageH - bottomMargin);
    },

    newPage(doc) {
      doc.addPage();
      return topMargin;
    },
  };
}

// =====================================================================
// SAFE AUTOTABLE WRAPPER (fix for multi-page overlap + stackoverflow)
// =====================================================================
// function safeAutoTable(doc, layout, options) {
//   const startY = Math.max(options.startY ?? layout.startY(), layout.topY);

//   return doc.autoTable({
//     ...options,
//     startY,

//     // margins are distances, not absolute coordinates
//     margin: {
//       left: options.margin?.left ?? layout.left,
//       right: options.margin?.right ?? layout.right,
//       top: options.margin?.top ?? layout.topMargin,
//       bottom: options.margin?.bottom ?? layout.bottomMargin,
//     },

//     pageBreak: options.pageBreak ?? 'auto',
//     rowPageBreak: options.rowPageBreak ?? 'auto',

//     // helps if any long text would otherwise create insane row heights
//     styles: {
//       ...(options.styles || {}),
//       overflow: (options.styles && options.styles.overflow) || 'linebreak',
//       cellWidth: (options.styles && options.styles.cellWidth) || 'wrap',
//     },
//   });
// }

function safeAutoTable(doc, layout, options) {
  const startY = Math.max(options.startY ?? layout.startY(), layout.topY);

  const baseStyles = {
    fontSize: 8,
    cellPadding: 1.5,
    overflow: 'linebreak',
    cellWidth: 'wrap',
    minCellWidth: 0,   // ✅ IMPORTANT: allow columns to shrink more
    valign: 'top',
  };

  const mergedStyles = {
    ...baseStyles,
    ...(options.styles || {}),
  };

  const mergedHeadStyles = {
    fontSize: mergedStyles.fontSize,
    cellPadding: mergedStyles.cellPadding,
    overflow: 'linebreak',
    cellWidth: 'wrap',
    minCellWidth: 0,
    ...(options.headStyles || {}),
  };

  return doc.autoTable({
    ...options,
    startY,

    margin: {
      left: options.margin?.left ?? layout.left,
      right: options.margin?.right ?? layout.right,
      top: options.margin?.top ?? layout.topMargin,
      bottom: options.margin?.bottom ?? layout.bottomMargin,
    },

    // ✅ wrap tends to reduce total width better than 'auto' in wide tables
    tableWidth: options.tableWidth ?? 'wrap',

    pageBreak: options.pageBreak ?? 'auto',
    rowPageBreak: options.rowPageBreak ?? 'auto',

    styles: mergedStyles,
    headStyles: mergedHeadStyles,
  });
}


// =====================================================================
// HEADER / FOOTER
// =====================================================================
function drawHeaderFooter(doc, layout, { title = 'Risk Report', logoEl, reportTimeText }) {
  const { pageW, pageH, left, right, cfg } = layout;

  const headerTextY = Math.max(10, cfg.headerHeight - 4);
  const logoY = 8;

  const footerBaseY = pageH - (cfg.footerHeight - 4);

  const maxLogoW = 30;
  const maxLogoH = Math.max(10, cfg.headerHeight - 6);

  /* HEADER */
  doc.setFontSize(10);
  doc.setTextColor(0);
  doc.text(title, left, headerTextY);

  if (logoEl && logoEl.complete && logoEl.naturalWidth > 0) {
    const imgW = logoEl.naturalWidth;
    const imgH = logoEl.naturalHeight;
    const ratio = imgW / imgH;

    let logoW = maxLogoW;
    let logoH = logoW / ratio;

    if (logoH > maxLogoH) {
      logoH = maxLogoH;
      logoW = logoH * ratio;
    }

    doc.addImage(logoEl, 'PNG', pageW - right - logoW, logoY, logoW, logoH);
  }

  /* FOOTER */
  doc.setFontSize(8);
  doc.setTextColor(0);
  doc.text(['Report generated:', reportTimeText], left, footerBaseY - 4);
  doc.text('generated by valuationXpro', pageW / 2, footerBaseY, { align: 'center' });
}

function drawPageNumber(doc, layout, { pageIndex, pageCount }) {
  const { pageW, pageH, right, cfg } = layout;
  const footerBaseY = pageH - (cfg.footerHeight - 4);

  doc.setFontSize(8);
  doc.setTextColor(0);
  doc.text(`Page ${pageIndex} / ${pageCount}`, pageW - right, footerBaseY, { align: 'right' });
}

// =====================================================================
// HIERARCHY (same idea as before)
// =====================================================================
function applyPdfHierarchy(sections, config) {
  const parents = config?.sectionParents || {};
  const orderByParent = config?.sectionChildrenOrder || {};

  const byKey = new Map(sections.map((s) => [s.key, s]));
  const childrenMap = new Map();

  for (const s of sections) {
    const p = parents[s.key];
    if (p && byKey.has(p)) {
      if (!childrenMap.has(p)) childrenMap.set(p, []);
      childrenMap.get(p).push(s.key);
    }
  }

  for (const [p, arr] of childrenMap.entries()) {
    const pref = orderByParent[p];
    if (Array.isArray(pref) && pref.length) {
      const set = new Set(arr);
      const ordered = [...pref.filter((k) => set.has(k)), ...arr.filter((k) => !pref.includes(k))];
      childrenMap.set(p, ordered);
    }
  }

  const roots = sections
    .filter((s) => {
      const p = parents[s.key];
      return !(p && byKey.has(p));
    })
    .map((s) => s.key);

  const seenRoot = new Set(roots);
  const rootsInOriginalOrder = sections.map((s) => s.key).filter((k) => seenRoot.has(k));

  const out = [];
  const visit = (key, level, number) => {
    const sec = byKey.get(key);
    if (!sec) return;

    sec.tocLevel = level;
    sec.sectionNumber = number;
    out.push(sec);

    const kids = childrenMap.get(key) || [];
    kids.forEach((ck, idx) => visit(ck, level + 1, `${number}.${idx + 1}`));
  };

  rootsInOriginalOrder.forEach((rk, idx) => visit(rk, 1, String(idx + 1)));
  return out;
}

// =====================================================================
// GENERATE PDF
// =====================================================================
export async function generateRiskPDF(filteredData, overrides = {}) {
  const opts = { ...REPORT_DEFAULTS, ...overrides };
  const doc = new jsPDF({ orientation: opts.orientation, format: opts.paper });
  const layout = createPdfLayout(doc, overrides?.layout || {});

  // Sections from preview
  let sections = getActiveRiskSectionsForPdf() || [];
  sections = applyPdfHierarchy(sections, RISK_CONFIG);

  // Map section numbers
  const sectionNoByKey = {};
  sections.forEach((s) => (sectionNoByKey[s.key] = s.sectionNumber));

  // Breakdown numbering (for TOC level 2/3 entries)
  const breakdownSec = sections.find((s) => s.key === 'breakdown');
  if (breakdownSec && typeof groupBreakdownChartsBySection === 'function') {
    const sectionNo = sectionNoByKey[breakdownSec.key] || '1';
    const chartsForGroups = breakdownSec.enabledCharts || [];
    const groups = groupBreakdownChartsBySection(chartsForGroups) || [];

    const breakdownNumbering = { section: sectionNo, groups: {}, charts: {} };

    let gIdx = 1;
    groups.forEach((g) => {
      if (!g?.charts?.length) return;
      const gTitle = g.title || g.name || `Group ${gIdx}`;
      const gNo = `${sectionNo}.${gIdx}`;
      breakdownNumbering.groups[gTitle] = gNo;

      let cIdx = 1;
      g.charts.forEach((ch) => {
        if (!ch?.id) return;
        const label = getBreakdownChartDisplayLabel(ch.id);
        breakdownNumbering.charts[ch.id] = { no: `${gNo}.${cIdx}`, label };
        cIdx++;
      });
      gIdx++;
    });

    breakdownSec.breakdownNumbering = breakdownNumbering;
  }

  // TOC entries
  const tocEntries = [];
  const addTOCEntry = (number, title, page, level = 1) => {
    tocEntries.push({ title: `${number}. ${title}`, page, level });
  };

  // Render sections
  let wroteAnySection = false;

  for (let i = 0; i < sections.length; i++) {
    const sec = sections[i];
    const sectionNo = sectionNoByKey[sec.key] || String(i + 1);
    sec.sectionNumber = sectionNo;

    if (wroteAnySection) doc.addPage();
    wroteAnySection = true;

    const title = sec.title || sec.key;
    const pageIndex = doc.internal.getNumberOfPages();

    addTOCEntry(sec.sectionNumber, title, pageIndex, sec.tocLevel || 1);

    // Breakdown: groups + charts in TOC
    if (sec.key === 'breakdown' && sec.breakdownNumbering && typeof groupBreakdownChartsBySection === 'function') {
      const chartsForGroups = sec.enabledCharts || [];
      const groups = groupBreakdownChartsBySection(chartsForGroups) || [];

      groups.forEach((g) => {
        if (!g?.charts?.length) return;
        const gTitle = g.title || g.name || '';
        const gNo = sec.breakdownNumbering.groups[gTitle];
        if (gNo) tocEntries.push({ title: `${gNo}. ${gTitle}`, page: pageIndex, level: 2 });

        g.charts.forEach((ch) => {
          const meta = sec.breakdownNumbering.charts[ch.id];
          if (!meta) return;
          tocEntries.push({ title: `${meta.no}. ${meta.label}`, page: pageIndex, level: 3 });
        });
      });
    }

    await renderPanelSectionToPDF(doc, sec, layout);
  }

  // Appendix
  if (Array.isArray(filteredData) && filteredData.length) {
    if (wroteAnySection) doc.addPage();
    const pageIndex = doc.internal.getNumberOfPages();
    const appendixNo = String(sections.length + 1);

    tocEntries.push({ title: `${appendixNo}. Appendix: Product Table`, page: pageIndex, level: 1 });
    drawProductTableSection(doc, filteredData, layout, { appendixNo });
  }

  // Insert TOC
  if (opts.includeTOC && tocEntries.length) {
    doc.insertPage(1);
    doc.setPage(1);

    const tocLayout = createPdfLayout(doc, layout.cfg);

    doc.setFontSize(16);
    doc.setTextColor(0);
    doc.text('Table of Contents', tocLayout.left, tocLayout.startY());
    doc.setFontSize(11);

    const lineStartY = tocLayout.startY() + 12;
    const lineStep = 8;

    tocEntries.forEach((entry, index) => {
      const indent = (entry.level - 1) * 5;
      const y = lineStartY + index * lineStep;

      if (y > tocLayout.bottomY - 6) return; // keep it simple; paging can be added later

      const pageText = (entry.page + 1).toString(); // +1 wegen TOC-Seite

      const marginLeft = tocLayout.left + indent;
      const marginRight = tocLayout.right;

      const maxLineWidth = tocLayout.pageW - marginLeft - marginRight;
      const titleText = entry.title;

      const titleW = doc.getTextWidth(titleText);
      const pageW = doc.getTextWidth(pageText);
      const dotsWidth = Math.max(0, maxLineWidth - titleW - pageW);
      const dotW = doc.getTextWidth('.');
      const dots = dotW ? '.'.repeat(Math.floor(dotsWidth / dotW)) : '';

      doc.text(`${titleText} ${dots} ${pageText}`, marginLeft, y);
    });
  }

  // Header/Footer on all pages
  const pageCount = doc.internal.getNumberOfPages();
  const logoEl = document.getElementById('logo');

  const finalLayout = createPdfLayout(doc, layout.cfg);
  const reportTitle = opts.reportTitle || overrides?.reportTitle || 'Risk Report';

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    drawHeaderFooter(doc, finalLayout, { title: reportTitle, logoEl, reportTimeText });
    drawPageNumber(doc, finalLayout, { pageIndex: i, pageCount });
  }

  // Save
  doc.save(opts.fileName || 'Risk.pdf');
}

// =====================================================================
// BREAKDOWN GROUPING (from DOM)
// =====================================================================
function groupBreakdownChartsBySection(charts) {
  if (!charts || !charts.length) return [];
  const groupsMap = new Map();

  for (const ch of charts) {
    const el = document.getElementById(ch.id);
    if (!el) continue;

    const section = el.closest?.('.pie-section');
    let groupTitle = 'Breakdown';

    if (section) {
      const titleEl = section.querySelector('.pie-section-title');
      const txt = titleEl?.textContent?.trim();
      if (txt) groupTitle = txt;
    }

    if (!groupsMap.has(groupTitle)) groupsMap.set(groupTitle, { title: groupTitle, charts: [] });
    groupsMap.get(groupTitle).charts.push(ch);
  }

  return Array.from(groupsMap.values());
}

// =====================================================================
// SECTION RENDERING
// =====================================================================
async function renderPanelSectionToPDF(doc, sec, layout) {
  const { pageW, pageH, left: marginX, cfg } = layout;
  const gutter = 10;

  let y = layout.startY();

  const sectionTitle = sec.title || sec.key || '';
  const sectionNumber = sec.sectionNumber || '';
  const breakdownNumbering = sec.breakdownNumbering || null;

  // SPECIAL: Credit Traffic
  if (sec.isCreditTraffic || sec.key === 'creditTraffic') {
    await renderCreditTrafficSectionToPDF(doc, sec, layout);
    return;
  }

  // SPECIAL: Market Traffic
  if (sec.isMarketTraffic || sec.key === 'marketTraffic') {
    await renderMarketTrafficSectionToPDF(doc, sec, layout);
    return;
  }

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  async function plotlyToPngData(el) {
    if (!el || typeof Plotly === 'undefined') return null;

    for (let i = 0; i < 10; i++) {
      try { if (el._fullLayout) break; } catch {}
      await sleep(40);
    }

    try {
      const exportWidth = Math.max(900, el.clientWidth || 900);
      const exportHeight = Math.max(520, el.clientHeight || 520);

      const dataUrl = await Plotly.toImage(el, {
        format: 'png',
        width: exportWidth,
        height: exportHeight,
        scale: 2,
      });

      return { dataUrl, width: exportWidth, height: exportHeight };
    } catch (e) {
      console.warn('[PDF] Plotly export failed for', el.id, e);
      return null;
    }
  }

  function canvasToPngData(canvas) {
    if (!canvas) return null;
    try {
      let srcW = canvas.width;
      let srcH = canvas.height;

      if (!srcW || !srcH) {
        const rect = canvas.getBoundingClientRect();
        srcW = rect.width || 900;
        srcH = rect.height || 520;
      }

      const dataUrl = canvas.toDataURL('image/png');
      return { dataUrl, width: srcW, height: srcH };
    } catch (e) {
      console.warn('[PDF] Canvas export failed for', canvas?.id, e);
      return null;
    }
  }

  function ensurePageSpace(needsHeight, contTitle = null) {
    if (layout.hasSpace(y, needsHeight)) return;
    y = layout.newPage(doc);

    if (contTitle) {
      doc.setFontSize(14);
      doc.setTextColor(0);
      doc.text(contTitle, marginX, y);
      y += cfg.sectionTitleSpacing;
    }
  }

  const chartsAll = sec.enabledCharts || [];
  const tablesAll = sec.enabledTables || [];
  const chartWidth = (pageW - marginX * 2 - gutter) / 2;

  const isBreakdown = sec.key === 'breakdown';

  // ─────────────────────────────────────────────
  // BREAKDOWN – one chart + legend per page
  // ─────────────────────────────────────────────
  if (isBreakdown) {
    const legendByChartId = new Map();
    tablesAll.forEach((t) => {
      if (!t.id) return;
      const m = t.id.match(/^(.*)-legend$/i);
      if (!m) return;
      legendByChartId.set(m[1], t);
    });

    const groups = groupBreakdownChartsBySection(chartsAll);
    const blocks = [];

    if (groups?.length) {
      for (const g of groups) {
        (g.charts || []).forEach((ch) => blocks.push({ chart: ch, groupTitle: g.title }));
      }
    } else {
      chartsAll.forEach((ch) => blocks.push({ chart: ch, groupTitle: null }));
    }

    let blockIndex = 0;
    let firstPageOfSec = true;
    let lastGroupTitle = null;

    for (const { chart, groupTitle } of blocks) {
      if (blockIndex === 0) y = layout.startY();
      else y = layout.newPage(doc);

      if (firstPageOfSec) {
        doc.setFontSize(14);
        doc.setTextColor(0);
        doc.text(sectionNumber ? `${sectionNumber}. ${sectionTitle}` : sectionTitle, marginX, y);
        y += 8;
        firstPageOfSec = false;
      }

      if (groupTitle && groupTitle !== lastGroupTitle) {
        const gNo = breakdownNumbering?.groups[groupTitle];
        const groupHeading = gNo ? `${gNo}. ${groupTitle}` : groupTitle;

        doc.setFontSize(12);
        doc.setTextColor(0);
        doc.text(groupHeading, marginX, y);
        y += 8;
        lastGroupTitle = groupTitle;
      }

      const chartMeta = breakdownNumbering?.charts[chart.id];
      const chartLabel = chartMeta?.label || chart.label || chart.id;
      const chartNumber = chartMeta?.no;
      const chartHeading = chartNumber ? `${chartNumber}. ${chartLabel}` : chartLabel;

      doc.setFontSize(11);
      doc.setTextColor(0);
      doc.text(chartHeading, marginX, y);
      y += 6;

      // chart image
      const el = document.getElementById(chart.id);
      if (el) {
        let imgData = null;
        if (el.tagName === 'CANVAS') imgData = canvasToPngData(el);
        else imgData = await plotlyToPngData(el);

        if (imgData?.dataUrl) {
          const srcW = imgData.width || 900;
          const srcH = imgData.height || 520;

          const maxW = layout.contentWidth;
          const maxH = 90;

          const scale = Math.min(maxW / srcW, maxH / srcH, 1);
          const targetWidth = srcW * scale;
          const targetHeight = srcH * scale;

          const boxHeight = targetHeight + 22;

          ensurePageSpace(boxHeight + 10, `${sectionTitle} (cont.)`);

          const boxX = marginX;
          const boxY = y;
          const labelY = boxY + 7;
          const imgY = boxY + 11;
          const imgX = boxX + (maxW - targetWidth) / 2;

          try {
            doc.setFillColor(245);
            doc.rect(boxX - 2, boxY, maxW + 4, boxHeight - 4, 'F');

            doc.setFontSize(9);
            doc.setTextColor(0);
            doc.text(chartLabel, boxX + maxW / 2, labelY, { align: 'center' });

            doc.addImage(imgData.dataUrl, 'PNG', imgX, imgY, targetWidth, targetHeight);
          } catch (e) {
            console.warn('[PDF] addImage failed for breakdown chart', chart.id, e);
          }

          y += boxHeight + 6;
        }
      }

      // legend table under chart
      const tMeta = legendByChartId.get(chart.id);
      if (tMeta) {
        const host = document.getElementById(tMeta.id);
        const tableElem =
          host && host.tagName && host.tagName.toLowerCase() === 'table'
            ? host
            : host?.querySelector?.('table');

        if (tableElem && typeof doc.autoTable === 'function') {
          const chartMeta2 = breakdownNumbering?.charts[chart.id];
          const chartLabel2 = chartMeta2?.label || chart.label || tMeta.label || tMeta.id;
          const chartNumber2 = chartMeta2?.no;

          const tableTitle = chartNumber2
            ? `${chartNumber2}. ${chartLabel2} Breakdown`
            : `${chartLabel2} Breakdown`;

          ensurePageSpace(40, `${sectionTitle} (cont.)`);

          doc.setFontSize(10);
          doc.setTextColor(0);
          doc.text(tableTitle, marginX, y);

          safeAutoTable(doc, layout, {
            html: tableElem,
            startY: y + 6,
            theme: 'grid',
            styles: { fontSize: 8, cellPadding: 2 },
            headStyles: { fillColor: [245, 245, 245], textColor: [60, 60, 60] },
            alternateRowStyles: { fillColor: [255, 255, 255] },
            tableWidth: 'auto',

            didParseCell(data) {
              if (data.section === 'head') return;
              if (data.section !== 'body' || data.column.index !== 0) return;

              const raw = data.cell.raw;
              if (!raw) return;

              let bg = '';

              const swatchEl =
                raw.querySelector?.('[data-color]') ||
                raw.querySelector?.('.color-swatch') ||
                raw.firstElementChild;

              if (swatchEl) {
                bg =
                  (swatchEl.dataset && swatchEl.dataset.color) ||
                  swatchEl.style?.backgroundColor ||
                  '';
                if (!bg) {
                  try {
                    const cs = getComputedStyle(swatchEl);
                    if (
                      cs &&
                      cs.backgroundColor &&
                      cs.backgroundColor !== 'rgba(0, 0, 0, 0)' &&
                      cs.backgroundColor !== 'transparent'
                    ) {
                      bg = cs.backgroundColor;
                    }
                  } catch {}
                }
              }

              if (!bg) {
                try {
                  const csTd = getComputedStyle(raw);
                  if (
                    csTd &&
                    csTd.backgroundColor &&
                    csTd.backgroundColor !== 'rgba(0,0,0,0)' &&
                    csTd.backgroundColor !== 'transparent'
                  ) {
                    bg = csTd.backgroundColor;
                  }
                } catch {}
              }

              if (!bg) return;

              const m = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)\s*\)/);
              if (!m) return;

              const r = parseInt(m[1], 10);
              const g = parseInt(m[2], 10);
              const b = parseInt(m[3], 10);

              data.cell.text = [''];
              data.cell.styles.fillColor = [255, 255, 255];
              data.cell.styles.textColor = [0, 0, 0];
              data.cell._swatchColor = [r, g, b];
            },

            didDrawCell(data) {
              if (data.section !== 'body' || data.column.index !== 0) return;
              const c = data.cell._swatchColor;
              if (!c) return;

              const x = data.cell.x;
              const yCell = data.cell.y;
              const h = data.cell.height;

              const size = Math.min(h - 4, 8);
              const padY = (h - size) / 2;
              const squareX = x + 4;
              const squareY = yCell + padY;

              doc.setFillColor(c[0], c[1], c[2]);
              doc.setDrawColor(200, 200, 200);
              doc.rect(squareX, squareY, size, size, 'FD');
            },
          });

          y = doc.lastAutoTable?.finalY ? doc.lastAutoTable.finalY + cfg.blockGap : y + 60;
        }
      }

      blockIndex++;
    }

    return;
  }

  // ─────────────────────────────────────────────
  // STANDARD SECTIONS (charts + tables)
  // ─────────────────────────────────────────────
  doc.setFontSize(14);
  doc.setTextColor(0);
  doc.text(sectionNumber ? `${sectionNumber}. ${sectionTitle}` : sectionTitle, marginX, y);
  y += cfg.sectionTitleSpacing;

  let colInRow = 0;
  let rowHeight = 0;

  for (const ch of chartsAll) {
    const el = document.getElementById(ch.id);
    if (!el) continue;

    let imgData = null;
    if (el.tagName === 'CANVAS') imgData = canvasToPngData(el);
    else imgData = await plotlyToPngData(el);

    if (!imgData?.dataUrl) continue;

    const srcW = imgData.width || 900;
    const srcH = imgData.height || 520;

    const maxW = chartWidth;
    const maxH = 90;

    const scale = Math.min(maxW / srcW, maxH / srcH, 1);
    const targetWidth = srcW * scale;
    const targetHeight = srcH * scale;

    const blockHeight = targetHeight + 22;

    ensurePageSpace(blockHeight + 10, `${sectionTitle} (cont.)`);

    const cellX = marginX + colInRow * (chartWidth + gutter);
    const boxY = y;
    const labelY = boxY + 7;
    const imgY = boxY + 11;
    const imgX = cellX + (chartWidth - targetWidth) / 2;

    try {
      doc.setFillColor(245);
      doc.rect(cellX - 2, boxY, chartWidth + 4, blockHeight - 4, 'F');

      doc.setFontSize(9);
      doc.setTextColor(0);
      doc.text(ch.label || ch.id, cellX + chartWidth / 2, labelY, { align: 'center' });

      doc.addImage(imgData.dataUrl, 'PNG', imgX, imgY, targetWidth, targetHeight);
    } catch (e) {
      console.warn('[PDF] addImage failed for', ch.id, e);
    }

    rowHeight = Math.max(rowHeight, blockHeight);

    colInRow++;
    if (colInRow >= 2) {
      colInRow = 0;
      y += rowHeight + 4;
      rowHeight = 0;
    }
  }

  if (colInRow !== 0) {
    y += rowHeight + 4;
    colInRow = 0;
    rowHeight = 0;
  }

  for (const t of tablesAll) {
    const tbl = extractTableFromContainer(t.id, { maxRows: 500, maxCols: 40 });
    if (!tbl) continue;

    ensurePageSpace(40, `${sectionTitle} (cont.)`);

    doc.setFontSize(11);
    doc.setTextColor(0);
    doc.text(t.label || t.id, marginX, y);

    const head = tbl.head && tbl.head.length ? [tbl.head] : undefined;

    safeAutoTable(doc, layout, {
      startY: y + 6,
      head,
      body: tbl.body,
      styles: { fontSize: 8, cellPadding: 2 },
      theme: 'grid',
      headStyles: { fillColor: [34, 34, 34], textColor: [220, 220, 220] },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      tableWidth: 'auto',
    });

    y = doc.lastAutoTable?.finalY ? doc.lastAutoTable.finalY + cfg.blockGap : y + 60;
  }
}

// =====================================================================
// CREDIT TRAFFIC
// =====================================================================
function readCreditTrafficStatus() {
  const map = {};
  const defs = [
    { key: 'cvar', id: 'traffic-credit-cvar' },
    { key: 'tsi', id: 'traffic-credit-tsi' },
    { key: 'msd', id: 'traffic-credit-msd' },
  ];

  defs.forEach((d) => {
    const el = document.getElementById(d.id);
    if (!el) return;
    const status = (el.dataset.status || '').toLowerCase();
    if (status === 'red' || status === 'yellow' || status === 'green') map[d.key] = status;
  });

  return map;
}

async function renderCreditTrafficSectionToPDF(doc, sec, layout) {
  const { left: marginX } = layout;
  let y = layout.startY();

  doc.setFontSize(14);
  doc.setTextColor(0);
  doc.text(sec.title || 'Credit Risk – Traffic Lights', marginX, y);
  y += 8;

  doc.setFontSize(10);
  doc.text('Summary of CVaR, TSI and MSD traffic lights.', marginX, y);
  y += 6;

  const statuses = readCreditTrafficStatus();

  const metrics = [
    { label: 'CVaR', key: 'cvar' },
    { label: 'TSI', key: 'tsi' },
    { label: 'MSD', key: 'msd' },
  ];

  const colors = [
    { name: 'red', rgb: [220, 53, 69] },
    { name: 'yellow', rgb: [255, 193, 7] },
    { name: 'green', rgb: [40, 167, 69] },
  ];

  const radius = 3;
  const rowHeight = 14;
  const circleGap = 14;

  const neededHeight = metrics.length * (rowHeight + 2) + 24;
  if (!layout.hasSpace(y, neededHeight)) y = layout.newPage(doc);

  const boxX = marginX;
  const labelX = boxX + 6;
  const circleStartX = boxX + 35;

  metrics.forEach((m) => {
    const active = statuses[m.key] || 'green';

    doc.setDrawColor(210, 210, 210);
    doc.setFillColor(250, 250, 250);
    doc.roundedRect(boxX, y, 80, rowHeight, 2, 2, 'FD');

    doc.setFontSize(9);
    doc.setTextColor(50, 50, 50);
    doc.text(m.label + ':', labelX, y + rowHeight / 2 + 2);

    colors.forEach((c, idx) => {
      const cx = circleStartX + idx * circleGap;
      const cy = y + rowHeight / 2;

      doc.setDrawColor(120, 120, 120);

      if (c.name === active) {
        doc.setFillColor(c.rgb[0], c.rgb[1], c.rgb[2]);
        doc.circle(cx, cy, radius, 'FD');
      } else {
        doc.setFillColor(255, 255, 255);
        doc.circle(cx, cy, radius, 'S');
      }
    });

    y += rowHeight + 2;
  });

  // legend
  const legendX = marginX + 90;
  const legendY = layout.startY() + 14;

  doc.setFontSize(8);
  doc.setTextColor(80, 80, 80);
  doc.text('Legend:', legendX, legendY);

  const legendEntries = [
    { label: 'Red = critical', color: [220, 53, 69] },
    { label: 'Yellow = watch', color: [255, 193, 7] },
    { label: 'Green = in range', color: [40, 167, 69] },
  ];

  let ly = legendY + 5;
  legendEntries.forEach((entry) => {
    doc.setFillColor(entry.color[0], entry.color[1], entry.color[2]);
    doc.setDrawColor(120, 120, 120);
    doc.rect(legendX, ly - 3, 3, 3, 'FD');
    doc.setTextColor(60, 60, 60);
    doc.text(entry.label, legendX + 6, ly);
    ly += 5;
  });
}

// =====================================================================
// MARKET TRAFFIC
// =====================================================================
function readMarketTrafficStatus() {
  const el = document.getElementById('traffic-mvar');
  if (!el) return null;

  const status = (el.dataset.status || '').toLowerCase();
  if (status === 'red' || status === 'yellow' || status === 'green') return status;
  return null;
}

async function renderMarketTrafficSectionToPDF(doc, sec, layout) {
  const { left: marginX } = layout;
  let y = layout.startY();

  doc.setFontSize(14);
  doc.setTextColor(0);
  doc.text(sec.title || 'Market Risk – Traffic Light', marginX, y);
  y += 8;

  doc.setFontSize(10);
  doc.text('Summary of Market VaR / ES traffic light.', marginX, y);
  y += 6;

  const status = readMarketTrafficStatus() || 'green';

  const colors = [
    { name: 'red', rgb: [220, 53, 69] },
    { name: 'yellow', rgb: [255, 193, 7] },
    { name: 'green', rgb: [40, 167, 69] },
  ];

  const radius = 3;
  const rowHeight = 14;
  const circleGap = 14;

  if (!layout.hasSpace(y, rowHeight + 24)) y = layout.newPage(doc);

  const boxX = marginX;
  const labelX = boxX + 6;
  const circleStartX = boxX + 35;

  doc.setDrawColor(210, 210, 210);
  doc.setFillColor(250, 250, 250);
  doc.roundedRect(boxX, y, 80, rowHeight, 2, 2, 'FD');

  doc.setFontSize(9);
  doc.setTextColor(50, 50, 50);
  doc.text('MVaR:', labelX, y + rowHeight / 2 + 2);

  colors.forEach((c, idx) => {
    const cx = circleStartX + idx * circleGap;
    const cy = y + rowHeight / 2;

    doc.setDrawColor(120, 120, 120);

    if (c.name === status) {
      doc.setFillColor(c.rgb[0], c.rgb[1], c.rgb[2]);
      doc.circle(cx, cy, radius, 'FD');
    } else {
      doc.setFillColor(255, 255, 255);
      doc.circle(cx, cy, radius, 'S');
    }
  });

  // legend
  const legendX = marginX + 90;
  const legendY = layout.startY() + 14;

  doc.setFontSize(8);
  doc.setTextColor(80, 80, 80);
  doc.text('Legend:', legendX, legendY);

  const legendEntries = [
    { label: 'Red = critical', color: [220, 53, 69] },
    { label: 'Yellow = watch', color: [255, 193, 7] },
    { label: 'Green = in range', color: [40, 167, 69] },
  ];

  let ly = legendY + 5;
  legendEntries.forEach((entry) => {
    doc.setFillColor(entry.color[0], entry.color[1], entry.color[2]);
    doc.setDrawColor(120, 120, 120);
    doc.rect(legendX, ly - 3, 3, 3, 'FD');
    doc.setTextColor(60, 60, 60);
    doc.text(entry.label, legendX + 6, ly);
    ly += 5;
  });
}

// =====================================================================
// APPENDIX
// =====================================================================
// function drawProductTableSection(doc, filteredData, layout, { appendixNo } = {}) {
//   const riskData = extractProductRiskData(filteredData);

//   let y = layout.startY();
//   const marginX = layout.left;

//   doc.setFontSize(14);
//   doc.setTextColor(0);

//   const title = appendixNo ? `${appendixNo}. Appendix: Product Table` : 'Appendix: Product Table';
//   doc.text(title, marginX, y);
//   y += 10;

//   const tableData = riskData.map((item) => [
//     item.PROD_ID,
//     item.DESCRIPTION,
//     item.ISSUER,
//     item.NOTIONAL,
//     item.NAV,
//   ]);

//   safeAutoTable(doc, layout, {
//     head: [['Produkt-ID', 'Beschreibung', 'Issuer', 'Notional', 'NAV']],
//     body: tableData,
//     startY: y,
//     styles: { cellPadding: 2, fontSize: 10 },
//     headStyles: { fillColor: [255, 102, 102] },
//     theme: 'striped',
//   });
// }

function drawProductTableSection(doc, filteredData, layout, { appendixNo } = {}) {
  const riskData = extractProductRiskData(filteredData);

  let y = layout.startY();
  const marginX = layout.left;

  doc.setFontSize(14);
  doc.setTextColor(0);

  const title = appendixNo
    ? `${appendixNo}. Appendix: Product Table`
    : 'Appendix: Product Table';

  doc.text(title, marginX, y);
  y += 10;

  const tableData = riskData.map(item => [
    item.PROD_ID,
    item.DESCRIPTION,
    item.ISSUER,
    item.NOTIONAL,
    item.NAV,
  ]);

  // ✅ Spaltenbreiten so wählen, dass es in A4 (Portrait) sicher passt
  // contentWidth ist pageW - left - right
  // Beispielwerte sind konservativ und funktionieren gut für typische Daten
  const colW = {
    prodId: 22,
    desc:   72,
    issuer: 34,
    notional: 26,
    nav:    22,
  };

  safeAutoTable(doc, layout, {
    startY: y,
    head: [['Product ID', 'Description', 'Issuer', 'Notional', 'NAV']],
    body: tableData,
    theme: 'striped',

    // ✅ wichtig: Auto soll in verfügbare Breite arbeiten
    tableWidth: 'auto',

    // ✅ global: Umbruch + Wrap
    styles: {
      fontSize: 8,
      cellPadding: 1.5,
      overflow: 'linebreak',
      cellWidth: 'wrap',
      valign: 'top',
    },

    // ✅ Header etwas kompakter/lesbar
    headStyles: {
      fontSize: 8,
      cellPadding: 1.5,
      overflow: 'linebreak',
      cellWidth: 'wrap',
    },

    // ✅ Spalten hart begrenzen (das ist das "Zusammenschieben")
    columnStyles: {
      0: { cellWidth: colW.prodId },   // Product ID
      1: { cellWidth: colW.desc },     // Description (Wrap!)
      2: { cellWidth: colW.issuer },   // Issuer
      3: { cellWidth: colW.notional }, // Notional
      4: { cellWidth: colW.nav },      // NAV
    },

    // optional: lange Wörter/Strings ohne spaces besser brechen
    didParseCell: (data) => {
      if (data.section !== 'body') return;
      // Description-Spalte aggressiver wrappen
      if (data.column.index === 1 && typeof data.cell.text?.[0] === 'string') {
        data.cell.styles.overflow = 'linebreak';
        data.cell.styles.cellWidth = colW.desc;
      }
    },
  });
}


function extractProductRiskData(filteredData) {
  if (!filteredData || !Array.isArray(filteredData)) return [];
  return filteredData.map((entry) => ({
    PROD_ID: entry.PROD_ID || '',
    DESCRIPTION: (entry.DESCRIPTION || '').toString().substring(0, 100),
    ISSUER: entry.ISSUER || '',
    NOTIONAL: entry.NOTIONAL != null ? entry.NOTIONAL.toString() : '',
    NAV: entry.NAV != null ? entry.NAV.toString() : '',
  }));
}

// =====================================================================
// GENERIC TABLE EXTRACT
// =====================================================================
function extractTableFromContainer(containerIds, { maxRows = 100, maxCols = 20 } = {}) {
  const ids = Array.isArray(containerIds) ? containerIds : [containerIds];
  let host = null;

  for (const id of ids) {
    const el = document.getElementById(id);
    if (el) {
      host = el;
      break;
    }
  }
  if (!host) return null;

  const table =
    host.tagName && host.tagName.toLowerCase() === 'table' ? host : host.querySelector('table');
  if (!table) return null;

  let headCells = Array.from(table.querySelectorAll('thead th')).slice(0, maxCols);
  let head = headCells.map((th) => (th.textContent || '').trim());

  let rows = Array.from(table.querySelectorAll('tbody tr'));

  if (!rows.length) {
    const allRows = Array.from(table.querySelectorAll('tr'));
    if (allRows.length) {
      if (!head.length) {
        const first = Array.from(allRows[0].children).slice(0, maxCols);
        head = first.map((c) => (c.textContent || '').trim());
        rows = allRows.slice(1);
      } else {
        rows = allRows;
      }
    }
  }

  rows = rows.slice(0, maxRows);

  const body = rows.map((tr) => {
    const cells = Array.from(tr.children).slice(0, maxCols);
    return cells.map((td) => (td.textContent || '').trim());
  });

  if (!head.length && body.length) head = body[0].map((_, i) => `COL ${i + 1}`);
  if (!head.length && !body.length) return null;

  return { head, body };
}

/* NOTE:
   getBreakdownChartDisplayLabel(...) must exist in your runtime (as before).
   If it lives in another module, import it like you did previously.
*/
