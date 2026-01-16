/* RiskPDF.js — FULL (centralized layout + table core)
   - Header/Footer safe areas (no overlap)
   - TOC
   - Charts (canvas + plotly)
   - Breakdown (one chart + legend per page)
   - Credit/Market traffic light sections
   - CENTRAL TABLE LAYOUT CORE:
       * renderTableAutoFit() => "shrink only" strategy for ALL normal tables (incl. Liquidity)
       * forces tableWidth = layout.contentWidth + fitted columnStyles
       * no horizontal breaks
   - Appendix Product Table:
       * wrap+linebreak for text
       * numbers never linebreak (central rule)
       * ProductID column never linebreak (generic via noWrapColumns)
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
  headerGap: 10, // space between header and content

  footerHeight: 16,
  footerGap: 8, // space between content and footer

  sectionTitleSpacing: 12,
  blockGap: 10,
};

export function createPdfLayout(doc, overrides = {}) {
  const cfg = { ...PDF_LAYOUT_DEFAULTS, ...overrides };

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  // margins as distances (NOT absolute coords)
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

    // absolute content boundaries
    topY: topMargin,
    bottomY: pageH - bottomMargin,

    // margins (distances) used by autoTable
    topMargin,
    bottomMargin,

    contentWidth: pageW - left - right,

    startY() {
      return topMargin;
    },

    hasSpace(y, neededHeight) {
      return y + neededHeight <= pageH - bottomMargin;
    },

    newPage(doc) {
      doc.addPage();
      return topMargin;
    },
  };
}

// =====================================================================
// SAFE AUTOTABLE WRAPPER (header/footer-safe)
// + central rule: numbers never linebreak
// + optional: noWrapColumns (e.g., ProductID col)
// =====================================================================
function safeAutoTable(doc, layout, options) {
  const startY = Math.max(options.startY ?? layout.startY(), layout.topY);

  const baseStyles = {
    fontSize: 8,
    cellPadding: 2,
    overflow: 'linebreak',
    cellWidth: 'wrap',
    minCellWidth: 0,
    valign: 'top',
  };

  // optional per-table no-wrap columns
  const noWrapCols = Array.isArray(options.noWrapColumns) ? options.noWrapColumns : [];

  // preserve user callback if any
  const userDidParseCell = options.didParseCell;

  // robust numeric detection (finance-friendly)
  const isNumericLike = (val) => {
    const t = String(val ?? '').trim();
    if (!t) return false;

    const cleaned = t
      .replace(/\s+/g, '')
      .replace(/[€$£¥]/g, '')
      .replace(/%/g, '')
      .replace(/^\(/, '-')
      .replace(/\)$/, '');

    if (!/\d/.test(cleaned)) return false;
    return /^-?\d+(?:[.,']\d+)*$/.test(cleaned);
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

    pageBreak: options.pageBreak ?? 'auto',
    rowPageBreak: options.rowPageBreak ?? 'auto',

    styles: { ...baseStyles, ...(options.styles || {}) },
    headStyles: { ...(options.headStyles || {}) },

    // central behavior
    didParseCell: (data) => {
      // run user callback first (safe)
      try { userDidParseCell?.(data); } catch {}

      if (!data || data.section !== 'body') return;
      if (!data.cell || !data.cell.styles) return;

      const colIdx = data.column?.index;

      // 1) Hard no-wrap columns (e.g., ProductID)
      if (typeof colIdx === 'number' && noWrapCols.includes(colIdx)) {
        data.cell.styles.overflow = 'visible'; // no linebreak
        data.cell.styles.cellWidth = 'auto';
        data.cell.styles.valign = 'middle';
        return;
      }

      // 2) Numbers never linebreak
      let txt = '';
      if (Array.isArray(data.cell.text)) txt = data.cell.text.join(' ').trim();
      else if (typeof data.cell.text === 'string') txt = data.cell.text.trim();
      else if (data.cell.raw != null) {
        if (typeof data.cell.raw === 'string' || typeof data.cell.raw === 'number') txt = String(data.cell.raw).trim();
        else if (data.cell.raw?.textContent) txt = String(data.cell.raw.textContent).trim();
      }

      if (!txt) return;

      if (isNumericLike(txt)) {
        data.cell.styles.overflow = 'visible'; // no linebreak
        data.cell.styles.cellWidth = 'auto';
        data.cell.styles.halign = data.cell.styles.halign || 'right';
        data.cell.styles.valign = 'middle';
      }
    },
  });
}

// =====================================================================
// TABLE LAYOUT CORE (centralized, reusable)
// =====================================================================

// Analyze extracted table (rough “width pressure”)
function analyzeTable(tbl) {
  const head = tbl?.head || [];
  const body = tbl?.body || [];

  const colCount = head.length || (body[0] ? body[0].length : 0);
  const maxLenByCol = Array.from({ length: colCount }, () => 0);

  const scanRow = (row) => {
    if (!Array.isArray(row)) return;
    for (let i = 0; i < colCount; i++) {
      const v = row[i] == null ? '' : String(row[i]);
      const len = Math.min(v.length, 80); // clamp
      if (len > maxLenByCol[i]) maxLenByCol[i] = len;
    }
  };

  scanRow(head);
  for (let r = 0; r < Math.min(body.length, 80); r++) scanRow(body[r]);

  const totalLen = maxLenByCol.reduce((a, b) => a + b, 0);
  return { colCount, maxLenByCol, totalLen };
}

// Fit column widths to exactly layout.contentWidth (first col wider)
function fitColumnStyles(layout, colCount, { firstCol = 48, minOther = 7 } = {}) {
  const W = layout.contentWidth;
  if (!colCount || colCount < 1) return {};
  if (colCount === 1) return { 0: { cellWidth: W } };

  const rest = Math.max(10, W - firstCol);
  const other = Math.max(minOther, rest / (colCount - 1));

  const cs = { 0: { cellWidth: firstCol } };
  for (let i = 1; i < colCount; i++) cs[i] = { cellWidth: other };
  return cs;
}

// Pick “shrink only as needed” preset
function pickShrinkPreset(analysis) {
  const { colCount, totalLen } = analysis;

  // many columns => shrink more
  if (colCount >= 14) return { fontSize: 6.0, cellPadding: 0.9, firstCol: 44 };
  if (colCount >= 11) return { fontSize: 6.5, cellPadding: 1.0, firstCol: 44 };
  if (colCount >= 9) return { fontSize: 7.0, cellPadding: 1.2, firstCol: 44 };

  // fewer columns but long text => slightly compact
  if (totalLen > 220) return { fontSize: 7.5, cellPadding: 1.4, firstCol: 46 };

  // default
  return { fontSize: 8.0, cellPadding: 1.8, firstCol: 48 };
}

/**
 * Render a regular (non-appendix) table with “shrink only” strategy.
 * - no horizontal breaks
 * - forces fit to content width by tableWidth + columnStyles
 * - wraps text as needed; numbers never linebreak (central)
 */
function renderTableAutoFit(doc, layout, { title, y, tbl, theme = 'grid', headStyles, alternateRowStyles } = {}) {
  if (!tbl) return { finalY: y };

  const analysis = analyzeTable(tbl);
  const preset = pickShrinkPreset(analysis);

  const head = tbl.head && tbl.head.length ? [tbl.head] : undefined;

  const columnStyles = fitColumnStyles(layout, analysis.colCount, {
    firstCol: preset.firstCol,
    minOther: 7,
  });

  if (title) {
    doc.setFontSize(11);
    doc.setTextColor(0);
    doc.text(title, layout.left, y);
    y += 6;
  }

  safeAutoTable(doc, layout, {
    startY: y,
    head,
    body: tbl.body,
    theme,

    // core: fit to page width
    tableWidth: layout.contentWidth,
    columnStyles,

    styles: {
      fontSize: preset.fontSize,
      cellPadding: preset.cellPadding,
      overflow: 'linebreak',
      cellWidth: 'wrap',
      valign: 'top',
    },

    headStyles: {
      ...(headStyles || {}),
      fontSize: preset.fontSize,
      cellPadding: preset.cellPadding,
    },

    alternateRowStyles: alternateRowStyles || undefined,
  });

  const finalY = doc.lastAutoTable?.finalY ?? y + 40;
  return { finalY };
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
// HIERARCHY
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

  // Breakdown numbering (TOC level 2/3)
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

      if (y > tocLayout.bottomY - 6) return; // simple; add paging later if needed

      const pageText = (entry.page + 1).toString(); // +1 because TOC page

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
  const { pageW, left: marginX, cfg } = layout;
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
      for (const g of groups) (g.charts || []).forEach((ch) => blocks.push({ chart: ch, groupTitle: g.title }));
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

  // Charts (2 columns)
  const chartWidth = (layout.contentWidth - gutter) / 2;
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

  // Tables — CENTRALIZED AUTOFIT
  for (const t of tablesAll) {
    const tbl = extractTableFromContainer(t.id, { maxRows: 500, maxCols: 40 });
    if (!tbl) continue;

    ensurePageSpace(40, `${sectionTitle} (cont.)`);

    const out = renderTableAutoFit(doc, layout, {
      title: t.label || t.id,
      y,
      tbl,
      theme: 'grid',
      headStyles: { fillColor: [34, 34, 34], textColor: [220, 220, 220] },
      alternateRowStyles: { fillColor: [245, 245, 245] },
    });

    y = (out.finalY || y) + cfg.blockGap;
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
// APPENDIX (wrap/linebreak + fixed widths; ProductID no wrap)
// =====================================================================
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

  const tableData = riskData.map((item) => [
    item.PROD_ID,
    item.DESCRIPTION,
    item.ISSUER,
    item.NOTIONAL,
    item.NAV,
  ]);

  // Keep your base look (you can tune)
  const base = [22, 72, 34, 26, 22];
  const colCount = base.length;

  const fontSize = 8;
  const cellPadding = 1.5;

  // Effective width for scaling (padding-aware)
  const contentW = layout.contentWidth;
  const safety = 4;
  const effectiveW = Math.max(40, contentW - (colCount * 2 * cellPadding) - safety);

  const sumBase = base.reduce((a, b) => a + b, 0);
  const scale = effectiveW / sumBase;

  // Minimums
  const mins = [18, 40, 26, 18, 18];
  const scaled = base.map((w, i) => Math.max(mins[i], w * scale));

  // If mins overflow: reduce Description
  const sumScaled = scaled.reduce((a, b) => a + b, 0);
  if (sumScaled > effectiveW) {
    const overflow = sumScaled - effectiveW;
    scaled[1] = Math.max(mins[1], scaled[1] - overflow);
  }

  safeAutoTable(doc, layout, {
    startY: y,
    head: [['Product ID', 'Description', 'Issuer', 'Notional', 'NAV']],
    body: tableData,
    theme: 'striped',

    // (You can keep auto; leaving it as auto avoids some plugin quirks)
    tableWidth: 'auto',

    // ✅ Generic: only ProductID column is no-wrap
    noWrapColumns: [0],

    styles: {
      fontSize,
      cellPadding,
      overflow: 'linebreak',
      cellWidth: 'wrap',
      valign: 'top',
    },

    headStyles: {
      fontSize,
      cellPadding,
      overflow: 'linebreak',
      cellWidth: 'wrap',
    },

    columnStyles: {
      0: { cellWidth: scaled[0] },
      1: { cellWidth: scaled[1] },
      2: { cellWidth: scaled[2] },
      3: { cellWidth: scaled[3] },
      4: { cellWidth: scaled[4] },
    },
  });
}

function extractProductRiskData(filteredData) {
  if (!filteredData || !Array.isArray(filteredData)) return [];
  return filteredData.map((entry) => ({
    PROD_ID: entry.PROD_ID || '',
    DESCRIPTION: (entry.DESCRIPTION || '').toString().substring(0, 160),
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
    host.tagName && host.tagName.toLowerCase() === 'table'
      ? host
      : host.querySelector('table');

  if (!table) return null;

  let headCells = Array.from(table.querySelectorAll('thead th')).slice(0, maxCols);
  let head = headCells.map((th) => (th.textContent || '').trim());

  let rows = Array.from(table.querySelectorAll('tbody tr'));

  // fallback if no tbody
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
   If it lives in another module, import it as you already did.
*/
