/* RiskPDF.js — FULL (centralized layout + table core + COVER PAGE)
   ✅ Must work:
   - Load preset (checkbox state in localStorage) -> Export -> PDF contains exactly what is checked
   ✅ Fix included:
   - NO dependency on getBreakdownChartDisplayLabel (was causing crash when Breakdown is included)
   - Breakdown labels resolved safely from DOM/data-label (fallback to id)
   - Cover page (title + date + logo)
   - TOC on page 2 (no insertPage hacks)
   - Header/Footer safe areas (no overlap)
   - Numbers never linebreak (central)
   - Appendix ProductID never wraps (generic via noWrapColumns)
*/

const { jsPDF } = window.jspdf;






import { getActiveRiskSectionsForPdf, RISK_CONFIG} from './RiskPDFPreview.js';


// =====================================================================
// REPORT DEFAULTS
// =====================================================================
export const REPORT_DEFAULTS = {
  includeTOC: true,
  fileName: 'Risk.pdf',
  paper: 'a4',
  orientation: 'p',
};

export const BREAKDOWN_CHART_LABELS = {
  // Issuer
  issuerpiechart:       'Issuer',
  ratingpiechart:       'Issuer Rating',
  rankpiechart:         'Capital Structure',

  // Product
  ratingrespiechart:    'Product Rating',
  categorypiechart:     'Product Category',
  coupontypepiechart:   'Coupon Type',

  // General
  depotbankpiechart:    'Depot Bank',

  // Geography
  regionpiechart:       'Region',
  countrypiechart:      'Country',
  issueriseupiechart:   'EU Exposure',
  issueriseuropiechart: 'Euro Area Exposure',
};

function getBreakdownChartDisplayLabel(chartId) {
  const key = String(chartId || '').toLowerCase();
  return BREAKDOWN_CHART_LABELS[key] || chartId;
}

// =====================================================================
// LAYOUT SYSTEM (single source of truth)
// =====================================================================
export const PDF_LAYOUT_DEFAULTS = {
  marginLeft: 14,
  marginRight: 14,

  // header/footer safe area
  headerHeight: 10,
  headerGap: 8,
  footerHeight: 10,
  footerGap: 10,

  // spacing
  sectionTitleSpacing: 10,
  blockGap: 10,
};




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
// GENERATE PDF (Cover + TOC + Content)
// =====================================================================
export async function generateRiskPDF(filteredData, overrides = {}) {
  const opts = { ...REPORT_DEFAULTS, ...overrides };

  const doc = new jsPDF({ orientation: opts.orientation, format: opts.paper });
  const layout = createPdfLayout(doc, overrides?.layout || {});

  const reportTitle = String(opts.reportTitle || 'Risk Report').trim() || 'Risk Report';
  const logoEl = document.getElementById('logo');

    const reportTimeText = (() => {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  })();




  // 0) COVER PAGE (page 1)
  doc.setPage(1);
  drawCoverPage(doc, layout, { title: reportTitle, logoEl, reportTimeText });

  // 1) TOC placeholder (page 2)
  const includeTOC = !!opts.includeTOC;
  if (includeTOC) doc.addPage(); // page 2 reserved for TOC

  // 2) Sections from preview (reads current rr-chart-state)
  let sections = getActiveRiskSectionsForPdf() || [];
  sections = applyPdfHierarchy(sections, RISK_CONFIG);

  const sectionNoByKey = {};
  sections.forEach((s) => (sectionNoByKey[s.key] = s.sectionNumber));

  // 3) Breakdown numbering (TOC level 2/3) — SAFE label resolver
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
        const label = resolveBreakdownChartLabel(ch.id);
        breakdownNumbering.charts[ch.id] = { no: `${gNo}.${cIdx}`, label };
        cIdx++;
      });
      gIdx++;
    });

    breakdownSec.breakdownNumbering = breakdownNumbering;
  }

  // 4) Render sections
  const tocEntries = [];
  const addTOCEntry = (number, title, page, level = 1) => {
    tocEntries.push({ title: `${number}. ${title}`, page, level });
  };

  // First content page (page 3 if TOC, else page 2)
  doc.addPage();

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

  // 5) Appendix
  if (Array.isArray(filteredData) && filteredData.length) {
    doc.addPage();
    const pageIndex = doc.internal.getNumberOfPages();
    const appendixNo = String(sections.length + 1);

    tocEntries.push({ title: `${appendixNo}. Appendix: Product Table`, page: pageIndex, level: 1 });
    drawProductTableSection(doc, filteredData, layout, { appendixNo });
  }

  // 6) Draw TOC into page 2
  if (includeTOC) {
    doc.setPage(2);
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

      if (y > tocLayout.bottomY - 6) return;

      const pageText = String(entry.page);
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

  // 7) Header/Footer + Page numbers on all pages except cover (page 1)
  const pageCount = doc.internal.getNumberOfPages();
  const finalLayout = createPdfLayout(doc, layout.cfg);

  for (let p = 2; p <= pageCount; p++) {
    doc.setPage(p);
    drawHeaderFooter(doc, finalLayout, { title: reportTitle, logoEl, reportTimeText });
    drawPageNumber(doc, finalLayout, { pageIndex: p, pageCount });
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
  const { left: marginX, cfg } = layout;
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
      const chartLabel = chartMeta?.label || chart.label || resolveBreakdownChartLabel(chart.id);
      const chartNumber = chartMeta?.no;
      const chartHeading = chartNumber ? `${chartNumber}. ${chartLabel}` : chartLabel;

      doc.setFontSize(11);
      doc.setTextColor(0);
      doc.text(chartHeading, marginX, y);
      y += 6;

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

      const tMeta = legendByChartId.get(chart.id);
      if (tMeta) {
        const host = document.getElementById(tMeta.id);
        const tableElem =
          host && host.tagName && host.tagName.toLowerCase() === 'table'
            ? host
            : host?.querySelector?.('table');

        if (tableElem && typeof doc.autoTable === 'function') {
          const chartMeta2 = breakdownNumbering?.charts[chart.id];
          const chartLabel2 = chartMeta2?.label || chart.label || tMeta.label || resolveBreakdownChartLabel(chart.id);
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
            tableWidth: layout.contentWidth,

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
    { key: 'tsi',  id: 'traffic-credit-tsi' },
    { key: 'msd',  id: 'traffic-credit-msd' },
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
    { label: 'TSI',  key: 'tsi'  },
    { label: 'MSD',  key: 'msd'  },
  ];

  const colors = [
    { name: 'red',    rgb: [220, 53, 69] },
    { name: 'yellow', rgb: [255, 193, 7] },
    { name: 'green',  rgb: [40, 167, 69] },
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

  const legendX = marginX + 90;
  const legendY = layout.startY() + 14;

  doc.setFontSize(8);
  doc.setTextColor(80, 80, 80);
  doc.text('Legend:', legendX, legendY);

  const legendEntries = [
    { label: 'Red = critical',   color: [220, 53, 69] },
    { label: 'Yellow = watch',   color: [255, 193, 7] },
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
    { name: 'red',    rgb: [220, 53, 69] },
    { name: 'yellow', rgb: [255, 193, 7] },
    { name: 'green',  rgb: [40, 167, 69] },
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

  const legendX = marginX + 90;
  const legendY = layout.startY() + 14;

  doc.setFontSize(8);
  doc.setTextColor(80, 80, 80);
  doc.text('Legend:', legendX, legendY);

  const legendEntries = [
    { label: 'Red = critical',   color: [220, 53, 69] },
    { label: 'Yellow = watch',   color: [255, 193, 7] },
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
// APPENDIX (wrap/linebreak + ProductID no wrap)
// =====================================================================
function drawProductTableSection(doc, filteredData, layout, { appendixNo } = {}) {
  const riskData = extractProductRiskData(filteredData);

  let y = layout.startY();
  const marginX = layout.left;

  doc.setFontSize(14);
  doc.setTextColor(0);

  const title = appendixNo ? `${appendixNo}. Appendix: Product Table` : 'Appendix: Product Table';
  doc.text(title, marginX, y);
  y += 10;

  const tableData = riskData.map((item) => [
    item.PROD_ID,
    item.DESCRIPTION,
    item.ISSUER,
    item.NOTIONAL,
    item.NAV,
  ]);

  // Desired relative widths (will be normalized to fit exactly)
  const base = [22, 72, 34, 26, 22];
  const mins = [18, 40, 26, 18, 18];

  // Single source for typography
  const fontSize = 7;
  const cellPadding = 1.2;

  // Hard target width (slight epsilon for borders/rounding inside autoTable)
  const targetW = Math.max(40, (layout.contentWidth || 180) - 2);

  // 1) Scale base -> scaled with mins
  const sumBase = base.reduce((a, b) => a + b, 0) || 1;
  let scaled = base.map((w, i) => Math.max(mins[i], (w / sumBase) * targetW));

  // 2) Normalize to fit EXACTLY into targetW (guarantees no "could not fit page")
  const sumScaled1 = scaled.reduce((a, b) => a + b, 0) || 1;
  const f = targetW / sumScaled1;
  scaled = scaled.map((w, i) => Math.max(mins[i], w * f));

  // 3) If mins forced us over targetW, shave from Description column (idx 1), then Issuer (idx 2)
  const sumScaled2 = scaled.reduce((a, b) => a + b, 0);
  if (sumScaled2 > targetW) {
    let overflow = sumScaled2 - targetW;

    const shave = (idx, min) => {
      if (overflow <= 0) return;
      const can = Math.max(0, scaled[idx] - min);
      const cut = Math.min(can, overflow);
      scaled[idx] -= cut;
      overflow -= cut;
    };

    shave(1, mins[1]); // Description first
    shave(2, mins[2]); // then Issuer
    // If still overflow, shave Notional/NAV a bit (rare)
    shave(3, mins[3]);
    shave(4, mins[4]);
  }

  safeAutoTable(doc, layout, {
    startY: y,
    head: [['Product ID', 'Description', 'Issuer', 'Notional', 'NAV']],
    body: tableData,
    theme: 'striped',
    tableWidth: targetW,

    // Only ProductID no-wrap
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
      fillColor: [245, 245, 245],
      textColor: [60, 60, 60],
    },

    alternateRowStyles: { fillColor: [255, 255, 255] },

    columnStyles: {
      0: { cellWidth: scaled[0] },
      1: { cellWidth: scaled[1] },
      2: { cellWidth: scaled[2] },
      3: { cellWidth: scaled[3], halign: 'right' },
      4: { cellWidth: scaled[4], halign: 'right' },
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

function createPdfLayout(doc, overrides = {}) {
  const cfg = { ...PDF_LAYOUT_DEFAULTS, ...overrides };

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  const left = Number(cfg.marginLeft ?? 14);
  const right = Number(cfg.marginRight ?? 14);

  const headerHeight = Number(cfg.headerHeight ?? 10);
  const headerGap = Number(cfg.headerGap ?? 8);
  const footerHeight = Number(cfg.footerHeight ?? 10);
  const footerGap = Number(cfg.footerGap ?? 10);

  const topSafe = headerHeight + headerGap;                 // ✅ number
  const bottomSafe = pageH - (footerHeight + footerGap);    // ✅ number

  return {
    cfg,
    pageW,
    pageH,
    left,
    right,

    // aliases (du nutzt später bottomY)
    topSafe,
    bottomSafe,
    bottomY: bottomSafe,

    contentWidth: pageW - left - right,

    startY() {
      return topSafe;
    },

    hasSpace(y, neededHeight) {
      return Number(y) + Number(neededHeight) <= bottomSafe;
    },

    newPage(doc) {
      doc.addPage();
      return topSafe;
    },
  };
}

// Helper Logo Skalierung //

function addLogoKeepAspect(doc, logoElOrSrc, {
  x,
  y,
  maxW,
  maxH,
  format = 'PNG',
}) {
  try {
    // Accept either <img> or src string
    let src = logoElOrSrc;
    let w0 = 0, h0 = 0;

    if (logoElOrSrc && typeof logoElOrSrc === 'object' && logoElOrSrc.tagName === 'IMG') {
      src = logoElOrSrc.src;
      w0 = logoElOrSrc.naturalWidth || 0;
      h0 = logoElOrSrc.naturalHeight || 0;
    }

    if (!src) return;

    // If natural sizes unknown, fall back to max box (won't preserve perfectly, but avoids crash)
    if (!w0 || !h0) {
      doc.addImage(src, format, x, y, maxW, maxH);
      return;
    }

    const ratio = w0 / h0;
    let w = maxW;
    let h = w / ratio;

    if (h > maxH) {
      h = maxH;
      w = h * ratio;
    }

    doc.addImage(src, format, x, y, w, h);
  } catch (e) {
    console.warn('[PDF] addLogoKeepAspect failed', e);
  }
}


// function drawCoverPage(doc, layout, { title, subtitle, metaLines = [], logoEl, reportTimeText } = {}) {
//   // Du machst davor doc.setPage(1) -> hier KEIN doc.addPage()

//   const pageW = doc.internal.pageSize.getWidth();
//   const pageH = doc.internal.pageSize.getHeight();

//   const centerX = pageW / 2;

//   // Hintergrund
//   doc.setFillColor(255, 255, 255);
//   doc.rect(0, 0, pageW, pageH, 'F');

//   // Logo (optional)
//   try {
//     if (logoEl && logoEl.tagName === 'IMG' && logoEl.src) {
//       const maxW = 70;
//       const maxH = 35;
//       const x = (pageW - maxW) / 2;
//       const y = 28;

//       // Wenn dein Logo jpg ist -> 'JPEG'
//       doc.addImage(logoEl.src, 'PNG', x, y, maxW, maxH);
//     }
//   } catch (e) {
//     console.warn('[PDF] cover logo addImage failed', e);
//   }

//   // Titel
//   const t = String(title || 'Report');
//   doc.setTextColor(0);
//   doc.setFont('helvetica', 'bold');
//   doc.setFontSize(26);
//   doc.text(t, centerX, pageH * 0.38, { align: 'center' });

//   // Subtitle (optional)
//   if (subtitle) {
//     doc.setFont('helvetica', 'normal');
//     doc.setFontSize(12);
//     doc.setTextColor(70);
//     doc.text(String(subtitle), centerX, pageH * 0.38 + 12, { align: 'center' });
//   }

//   // Meta lines (optional)
//   const lines = [];
//   if (reportTimeText) lines.push(`Generated: ${reportTimeText}`);
//   if (Array.isArray(metaLines) && metaLines.length) lines.push(...metaLines.map((x) => String(x)));

//   if (lines.length) {
//     doc.setFont('helvetica', 'normal');
//     doc.setFontSize(10);
//     doc.setTextColor(90);

//     const startY = pageH * 0.38 + 28;
//     const step = 6;

//     lines.forEach((line, i) => {
//       doc.text(line, centerX, startY + i * step, { align: 'center' });
//     });
//   }

//   // Fußzeile
//   doc.setFontSize(9);
//   doc.setTextColor(130);
//   doc.text('Risk Report', centerX, pageH - 18, { align: 'center' });
// }

function drawCoverPage(doc, layout, { title, subtitle, metaLines = [], logoEl, reportTimeText } = {}) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const centerX = pageW / 2;

  // Hintergrund
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, pageW, pageH, 'F');

  // Logo oben, zentriert, korrekt skaliert
  if (logoEl && logoEl.tagName === 'IMG' && logoEl.src) {
    const maxW = 70;
    const maxH = 35;
    const x = (pageW - maxW) / 2;
    const y = 26;

    // keep aspect ratio inside max box
    addLogoKeepAspect(doc, logoEl, { x, y, maxW, maxH, format: 'PNG' });
  }

  // Titel
  const t = String(title || 'Report');
  doc.setTextColor(0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(26);
  doc.text(t, centerX, pageH * 0.38, { align: 'center' });

  // Subtitle optional
  if (subtitle) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12);
    doc.setTextColor(70);
    doc.text(String(subtitle), centerX, pageH * 0.38 + 12, { align: 'center' });
  }

  // Meta lines optional (inkl. Generated)
  const lines = [];
  if (reportTimeText) lines.push(`Generated: ${reportTimeText}`);
  if (Array.isArray(metaLines) && metaLines.length) lines.push(...metaLines.map((x) => String(x)));

  if (lines.length) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(90);

    const startY = pageH * 0.38 + 28;
    const step = 6;

    lines.forEach((line, i) => {
      doc.text(line, centerX, startY + i * step, { align: 'center' });
    });
  }

  // Kleine Fußzeile auf Cover (optional, sehr dezent)
  doc.setFontSize(9);
  doc.setTextColor(130);
  doc.text('generated by valuationXpro', centerX, pageH - 18, { align: 'center' });

  doc.setTextColor(0);
}


function resolveBreakdownChartLabel(chartId) {
  if (!chartId) return '';

  // 1) Versuch: aus BREAKDOWN_CHART_LABELS
  const key = String(chartId).toLowerCase();
  if (BREAKDOWN_CHART_LABELS[key]) {
    return BREAKDOWN_CHART_LABELS[key];
  }

  // 2) Versuch: data-label vom DOM
  try {
    const el = document.getElementById(chartId);
    const lbl = el?.dataset?.label;
    if (lbl) return lbl;
  } catch {}

  // 3) Fallback: ID
  return chartId;
}
function safeAutoTable(doc, layout, options = {}) {
  if (!doc || typeof doc.autoTable !== 'function') {
    console.warn('[PDF] autoTable not available (jspdf-autotable missing?)');
    return null;
  }

  const startY =
    options.startY != null
      ? Number(options.startY)
      : (typeof layout?.startY === 'function' ? Number(layout.startY()) : Number(layout?.topSafe ?? 20));

  const safeStartY = Number.isFinite(startY) ? startY : 20;

  try {
    doc.autoTable({
      ...options,
      startY: safeStartY,
    });
    return doc.lastAutoTable || null;
  } catch (e) {
    console.warn('[PDF] autoTable failed', e);
    return null;
  }
}
function renderTableAutoFit(doc, layout, opts = {}) {
  const {
    title,
    y,
    tbl,
    theme = 'grid',
    styles,
    headStyles,
    alternateRowStyles,
  } = opts;

  let startY = Number.isFinite(y)
    ? y
    : (typeof layout?.startY === 'function' ? layout.startY() : 20);

  const marginX = layout?.left ?? 14;

  // Titel
  if (title) {
    doc.setFontSize(10);
    doc.setTextColor(0);
    doc.text(String(title), marginX, startY);
    startY += 6;
  }

  // Tabelle
  const res = safeAutoTable(doc, layout, {
    startY,
    head: tbl.head ? [tbl.head] : undefined,
    body: tbl.body || [],
    theme,
    styles,
    headStyles,
    alternateRowStyles,
    tableWidth: 'auto',
  });

  return {
    finalY: res?.finalY ?? startY + 20,
  };
}
// function drawHeaderFooter(doc, layout, { title, logoEl, reportTimeText } = {}) {
//   const pageW = doc.internal.pageSize.getWidth();

//   const left = layout?.left ?? 14;
//   const right = layout?.right ?? 14;

//   const headerY = Math.max(10, (layout?.cfg?.headerHeight ?? 10)); // safe y
//   const footerY = doc.internal.pageSize.getHeight() - 10;

//   // HEADER LINE
//   doc.setDrawColor(220);
//   doc.setLineWidth(0.2);
//   doc.line(left, headerY + 4, pageW - right, headerY + 4);

//   // Header title (links)
//   doc.setFont('helvetica', 'normal');
//   doc.setFontSize(9);
//   doc.setTextColor(60);
//   if (title) doc.text(String(title), left, headerY);

//   // Header time (rechts)
//   if (reportTimeText) {
//     const txt = String(reportTimeText);
//     doc.text(txt, pageW - right, headerY, { align: 'right' });
//   }

//   // Logo klein rechts oben (optional)
//   try {
//     if (logoEl && logoEl.tagName === 'IMG' && logoEl.src) {
//       const w = 18;
//       const h = 9;
//       const x = pageW - right - w;
//       const y = 6;
//       doc.addImage(logoEl.src, 'PNG', x, y, w, h);
//     }
//   } catch {}
  
//   // FOOTER LINE
//   doc.setDrawColor(220);
//   doc.setLineWidth(0.2);
//   doc.line(left, footerY - 6, pageW - right, footerY - 6);
// }

function drawHeaderFooter(doc, layout, { title, logoEl, reportTimeText } = {}) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  const left  = layout?.left ?? 14;
  const right = layout?.right ?? 14;

  const headerY = 12;                 // baseline header text
  const footerY = pageH - 10;         // baseline footer text

  // ===== HEADER =====
  doc.setDrawColor(220);
  doc.setLineWidth(0.2);
  doc.line(left, headerY + 4, pageW - right, headerY + 4);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(60);

  // Title left in header
  if (title) doc.text(String(title), left, headerY);

  // Logo right in header (keep aspect ratio)
  if (logoEl && logoEl.tagName === 'IMG' && logoEl.src) {
    const maxW = 18;
    const maxH = 9;
    const x = pageW - right - maxW;
    const y = 6;
    addLogoKeepAspect(doc, logoEl, { x, y, maxW, maxH, format: 'PNG' });
  }

  // ===== FOOTER =====
  doc.setDrawColor(220);
  doc.setLineWidth(0.2);
  doc.line(left, footerY - 6, pageW - right, footerY - 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(90);

  // Left: timestamp
  if (reportTimeText) {
    doc.text(String(reportTimeText), left, footerY);
  }

  // Center: branding
  doc.text('generated by valuationXpro', pageW / 2, footerY, { align: 'center' });

  // reset
  doc.setTextColor(0);
}


function drawPageNumber(doc, layout, { pageIndex, pageCount } = {}) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  const right = layout?.right ?? 14;
  const footerY = pageH - 10; // muss exakt zur Footer-Baseline passen

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(90);

  const txt = (pageIndex && pageCount) ? `Page ${pageIndex} / ${pageCount}` : String(pageIndex ?? '');
  doc.text(txt, pageW - right, footerY, { align: 'right' });

  doc.setTextColor(0);
}






