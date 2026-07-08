/* RiskPDF.js — FULL (jsPDF + autoTable) — ROOT-SCOPED (app/report safe)
   ✅ Header/content overlap fixed
   ✅ Footer layout
   ✅ Logo aspect ratio
   ✅ No global number formatting
   ✅ PROD_ID + number columns: NEVER wrap in autoTable (robust across autoTable versions)

   NEW (critical):
   ✅ All DOM lookups are SCOPED via getById() (domRoot/appRoot/reportRoot) to avoid duplicate-id chaos
   ✅ No accidental cross-root selection
*/

const { jsPDF } = window.jspdf;

import { getActiveRiskSectionsForPdf, RISK_CONFIG, getTableNote } from './RiskPDFPreview.js';
// Cross-module element lookups (chart/container ids from the source modules)
// go through the capture adapter — see captureAdapter.js for the rationale.
import { getInAppById } from './captureAdapter.js';
import { getMarketDashboardModel } from '../ANALYSE_PORTFOLIO/marketRisk/marketRiskDashboard.js';

// =====================================================================
// REPORT DEFAULTS
// =====================================================================
export const REPORT_DEFAULTS = {
  includeTOC: true,
  fileName: 'Risk.pdf',
  paper: 'a4',
  orientation: 'l',
};

// =====================================================================
// BREAKDOWN LABELS (optional mapping)
// =====================================================================
export const BREAKDOWN_CHART_LABELS = {
  issuerpiechart:       'Issuer',
  ratingpiechart:       'Issuer Rating',
  rankpiechart:         'Capital Structure',
  ratingrespiechart:    'Product Rating',
  categorypiechart:     'Product Category',
  coupontypepiechart:   'Coupon Type',
  depotbankpiechart:    'Depot Bank',
  regionpiechart:       'Region',
  countrypiechart:      'Country',
  issueriseupiechart:   'EU Exposure',
  issueriseuropiechart: 'Euro Area Exposure',
};

function resolveBreakdownChartLabel(chartId, ctx) {
  if (!chartId) return '';
  const key = String(chartId).toLowerCase();
  if (BREAKDOWN_CHART_LABELS[key]) return BREAKDOWN_CHART_LABELS[key];

  try {
    const el = ctx?.getById?.(chartId) || getInAppById(chartId);
    const lbl = el?.dataset?.label;
    if (lbl && String(lbl).trim()) return String(lbl).trim();
  } catch {}

  return String(chartId);
}

// =====================================================================
// TIMESTAMP
// =====================================================================
function formatNowTimestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// =====================================================================
// LAYOUT SYSTEM (single source of truth)
// =====================================================================
export const PDF_LAYOUT_DEFAULTS = {
  marginLeft: 14,
  marginRight: 14,

  headerHeight: 16,
  headerGap: 12,

  footerHeight: 10,
  footerGap: 10,

  sectionTitleSpacing: 10,
  blockGap: 10,
};

function createPdfLayout(doc, overrides = {}) {
  const cfg = { ...PDF_LAYOUT_DEFAULTS, ...overrides };

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  const left = Number(cfg.marginLeft ?? 14);
  const right = Number(cfg.marginRight ?? 14);

  const headerHeight = Number(cfg.headerHeight ?? 16);
  const headerGap = Number(cfg.headerGap ?? 12);
  const footerHeight = Number(cfg.footerHeight ?? 10);
  const footerGap = Number(cfg.footerGap ?? 10);

  const topSafe = headerHeight + headerGap;
  const bottomSafe = pageH - (footerHeight + footerGap);

  return {
    cfg,
    pageW,
    pageH,
    left,
    right,

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

// =====================================================================
// IMAGE HELPERS (logo aspect ratio)
// =====================================================================
function addLogoKeepAspect(doc, logoElOrSrc, { x, y, maxW, maxH, format = 'PNG' }) {
  try {
    let src = logoElOrSrc;
    let w0 = 0, h0 = 0;

    if (logoElOrSrc && typeof logoElOrSrc === 'object' && logoElOrSrc.tagName === 'IMG') {
      src = logoElOrSrc.src;
      w0 = logoElOrSrc.naturalWidth || 0;
      h0 = logoElOrSrc.naturalHeight || 0;
    }
    if (!src) return;

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

// =====================================================================
// AUTOTABLE SAFE WRAPPER
// =====================================================================
function safeAutoTable(doc, layout, options = {}) {
  if (!doc || typeof doc.autoTable !== 'function') {
    console.warn('[PDF] autoTable not available (jspdf-autotable missing?)');
    return null;
  }

  const topSafe = Number.isFinite(layout?.topSafe) ? Number(layout.topSafe) : 28;
  const bottomMargin = (layout?.cfg?.footerHeight ?? 10) + (layout?.cfg?.footerGap ?? 10);

  const startY = options.startY != null ? Number(options.startY) : topSafe;
  const safeStartY = Number.isFinite(startY) ? Math.max(startY, topSafe) : topSafe;

  try {
    doc.autoTable({
      ...options,
      startY: safeStartY,
      margin: {
        left: options.margin?.left ?? (layout?.left ?? 14),
        right: options.margin?.right ?? (layout?.right ?? 14),
        top: options.margin?.top ?? topSafe,
        bottom: options.margin?.bottom ?? bottomMargin,
      },
    });
    return doc.lastAutoTable || null;
  } catch (e) {
    console.warn('[PDF] autoTable failed', e);
    return null;
  }
}

// =====================================================================
// HIERARCHY
// =====================================================================
// Die Sektionen kommen bereits HIERARCHISCH geordnet (mit __level) aus
// getActiveRiskSectionsForPdf → identisch zur Preview, generisch aus dem
// Trigger-DOM. Hier nur noch TOC-Level + verschachtelte Nummerierung (1, 1.1,
// 1.1.1 …) anhand von __level vergeben — keine RISK_CONFIG-Abhängigkeit mehr.
function applyPdfHierarchy(sections) {
  const counters = [];
  for (const sec of sections) {
    const level = sec.__level || 1;
    counters.length = level;                         // tiefere Ebenen verwerfen
    counters[level - 1] = (counters[level - 1] || 0) + 1;
    sec.tocLevel = level;
    sec.sectionNumber = counters.slice(0, level).join('.');
  }
  return sections;
}

// =====================================================================
// COVER / HEADER / FOOTER
// =====================================================================
function drawCoverPage(doc, layout, { title, subtitle, metaLines = [], logoEl, reportTimeText } = {}) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  // Farbwelt der Vorlage (Risk - VORLAGE.pdf): dunkles Navy-Cover, weisse Schrift,
  // hellgrauer Akzent fuer Labels.
  const NAVY   = [11, 31, 58];    // #0B1F3A
  const WHITE  = [255, 255, 255];
  const ACCENT = [200, 210, 222]; // #C8D2DE
  const MUTED  = [150, 165, 188];

  // Vollflaechiger Navy-Hintergrund
  doc.setFillColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.rect(0, 0, pageW, pageH, 'F');

  const marginL = Math.max(16, pageW * 0.06);

  // Logo oben rechts (falls vorhanden)
  if (logoEl && logoEl.tagName === 'IMG' && logoEl.src) {
    const maxW = 42, maxH = 20;
    const x = pageW - marginL - maxW;
    const y = pageH * 0.10;
    try { addLogoKeepAspect(doc, logoEl, { x, y, maxW, maxH, format: 'PNG' }); } catch {}
  }

  const titleY = pageH * 0.42;

  // Optionaler Eyebrow (kleiner Akzent-Text ueber dem Titel)
  if (subtitle) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(ACCENT[0], ACCENT[1], ACCENT[2]);
    doc.text(String(subtitle).toUpperCase(), marginL, titleY - 14);
  }

  // Grosser Titel, weiss, linksbuendig
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(40);
  doc.setTextColor(WHITE[0], WHITE[1], WHITE[2]);
  doc.text(String(title || 'Risk Report'), marginL, titleY);

  // Kurze Akzentlinie unter dem Titel
  doc.setDrawColor(ACCENT[0], ACCENT[1], ACCENT[2]);
  doc.setLineWidth(1.1);
  doc.line(marginL, titleY + 7, marginL + 64, titleY + 7);

  // Meta-Block: Label (Akzent, uppercase) + Wert (weiss, bold)
  let y = pageH * 0.60;
  const metaBlock = (label, value) => {
    if (!value) return;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10.5);
    doc.setTextColor(ACCENT[0], ACCENT[1], ACCENT[2]);
    doc.text(String(label).toUpperCase(), marginL, y);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(WHITE[0], WHITE[1], WHITE[2]);
    doc.text(String(value), marginL, y + 8);
    y += 20;
  };
  metaBlock('Generated', reportTimeText);

  if (Array.isArray(metaLines) && metaLines.length) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(WHITE[0], WHITE[1], WHITE[2]);
    metaLines.filter(Boolean).forEach((ln) => { doc.text(String(ln), marginL, y); y += 7; });
  }

  // Footer unten links
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text('generated by valuationXpro', marginL, pageH - 12);

  doc.setTextColor(0);
}

function drawHeaderFooter(doc, layout, { title, headerLabel, logoEl, reportTimeText } = {}) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  const left = layout?.left ?? 14;
  const right = layout?.right ?? 14;

  // Farbwelt wie VORLAGE: Kopf navy-blau, Fuss gedaempftes Slate, feine helle Linien.
  const NAVY  = [11, 31, 58];    // #0B1F3A
  const MUTED = [107, 120, 136]; // #6B7888
  const RULE  = [216, 222, 231]; // #D8DEE7

  const headerY = 10;
  const footerY = pageH - 9;

  const t = String(title || 'Risk Report');

  // Kopf (blau): links "vXP | <Portfolio>", rechts Zeitstempel/Datum
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.text(String(headerLabel || t), left, headerY);
  if (reportTimeText) {
    doc.setFontSize(8);
    doc.text(String(reportTimeText), pageW - right, headerY, { align: 'right' });
  }

  // Feine Linie unter dem Kopf
  doc.setDrawColor(RULE[0], RULE[1], RULE[2]);
  doc.setLineWidth(0.3);
  doc.line(left, headerY + 3.5, pageW - right, headerY + 3.5);

  // Feine Linie ueber dem Fuss
  doc.setDrawColor(RULE[0], RULE[1], RULE[2]);
  doc.setLineWidth(0.3);
  doc.line(left, footerY - 4, pageW - right, footerY - 4);

  // Fuss: links Report-Titel + Marke (Seitenzahl rechts kommt aus drawPageNumber)
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text(`${t} · valuationXpro`, left, footerY);

  doc.setTextColor(0);
}

function drawPageNumber(doc, layout, { pageIndex, pageCount } = {}) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  const right = layout?.right ?? 14;
  const footerY = pageH - 9;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(107, 120, 136); // gedaempftes Slate wie VORLAGE

  const txt = (pageIndex && pageCount) ? `Page ${pageIndex} / ${pageCount}` : String(pageIndex ?? '');
  doc.text(txt, pageW - right, footerY, { align: 'right' });

  doc.setTextColor(0);
}

// Formatiertes KPI-Band (Kacheln: grosser Wert + kleines Label auf hellgrauer Karte),
// wie auf der Concentration-Seite (PROTOTYPE Page 3). Gibt das neue y zurueck.
function drawKpiBand(doc, { marginX, contentW, y }, kpis) {
  if (!Array.isArray(kpis) || !kpis.length) return y;
  const n = kpis.length;
  const tileGap = 4;
  const tileW = (contentW - tileGap * (n - 1)) / n;
  const tileH = 20;
  kpis.forEach((k, idx) => {
    const x = marginX + idx * (tileW + tileGap);
    doc.setFillColor(245);
    doc.rect(x, y, tileW, tileH, 'F');
    doc.setFontSize(14); doc.setTextColor(0);
    doc.text(String(k.value ?? ''), x + tileW / 2, y + 9, { align: 'center' });
    doc.setFontSize(7); doc.setTextColor(110);
    doc.text(String(k.label ?? ''), x + tileW / 2, y + 15, { align: 'center' });
  });
  doc.setTextColor(0);
  return y + tileH + 8;
}

// KPI-Paare (Label/Wert) aus einer gespiegelten .data-container-Tabelle lesen.
function kpisFromTableEl(el) {
  const kpis = [];
  if (!el) return kpis;
  el.querySelectorAll('tbody tr').forEach((tr) => {
    const tds = tr.querySelectorAll('td');
    if (tds.length >= 2) kpis.push({ label: (tds[0].textContent || '').trim(), value: (tds[1].textContent || '').trim() });
  });
  return kpis;
}

// =====================================================================
// BREAKDOWN GROUPING (from DOM) — ROOT-SCOPED
// =====================================================================
function groupBreakdownChartsBySection(charts, ctx) {
  if (!charts || !charts.length) return [];
  const groupsMap = new Map();

  for (const ch of charts) {
    const el = ctx?.getById?.(ch.id) || getInAppById(ch.id);
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
// GENERATE PDF (Cover + TOC + Content) — ROOT-SCOPED
// =====================================================================
export async function generateRiskPDF(filteredData, overrides = {}) {
  const opts = { ...REPORT_DEFAULTS, ...overrides };

  // --- Roots / scoping ---
  const appRoot = overrides?.appRoot || document.getElementById('app-root') || document;
  const reportRoot = overrides?.reportRoot || document.getElementById('report-root') || null;

  // domRoot: where charts/tables are searched (default: appRoot, because live charts exist there)
  const domRoot = overrides?.domRoot || appRoot;

  const esc = (s) => {
    if (window.CSS && typeof window.CSS.escape === 'function') return window.CSS.escape(String(s));
    return String(s).replace(/([ #;?%&,.+*~\':"!^$[\]()=>|/@])/g, '\\$1');
  };

  const getById = (id) => {
    if (!id) return null;
    const sel = '#' + esc(id);

    // 1) scope to domRoot first
    const a = domRoot?.querySelector?.(sel);
    if (a) return a;

    // 2) allow reportRoot as second scope (export-only canvases live there)
    const b = reportRoot?.querySelector?.(sel);
    if (b) return b;

    // 3) last fallback (avoid, but keep as safety)
    return getInAppById(id);
  };

  const ctx = { appRoot, reportRoot, domRoot, getById };

  // --- PDF setup ---
  const doc = new jsPDF({ orientation: opts.orientation, format: opts.paper });
  const layout = createPdfLayout(doc, overrides?.layout || {});

  const reportTitle = String(opts.reportTitle || 'Risk Report').trim() || 'Risk Report';
  const logoEl = getById('logo');
  const reportTimeText = formatNowTimestamp();

  // Kopfzeilen-Label wie VORLAGE: "vXP | <Portfolio>". Portfolio-Name aus dem
  // (Report-)Portfolio-Dropdown; Fallback = Report-Titel.
  let portName = '';
  try {
    const portSel = getById('createdPortDropdownReport') || getById('createdPortDropdown0');
    if (portSel && portSel.tagName === 'SELECT') {
      const opt = portSel.options?.[portSel.selectedIndex];
      portName = String(opt?.textContent || portSel.value || '').trim();
    }
  } catch {}
  const headerLabel = `vXP | ${portName || reportTitle}`;

  doc.setPage(1);
  drawCoverPage(doc, layout, { title: reportTitle, logoEl, reportTimeText });

  const includeTOC = !!opts.includeTOC;
  // TOC-Seiten werden weiter unten reserviert — erst wenn die Eintragsanzahl
  // (Sektionen + Breakdown-Untereinträge + Appendix) bekannt ist (Mehrseiten-TOC).

  let sections = getActiveRiskSectionsForPdf() || [];
  sections = applyPdfHierarchy(sections);

  const sectionNoByKey = {};
  sections.forEach((s) => (sectionNoByKey[s.key] = s.sectionNumber));

  // Breakdown numbering (optional)
  const breakdownSec = sections.find((s) => s.key === 'breakdown');
  if (breakdownSec && typeof groupBreakdownChartsBySection === 'function') {
    const sectionNo = sectionNoByKey[breakdownSec.key] || '1';
    const chartsForGroups = breakdownSec.enabledCharts || [];
    const groups = groupBreakdownChartsBySection(chartsForGroups, ctx) || [];

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
        const label = resolveBreakdownChartLabel(ch.id, ctx);
        breakdownNumbering.charts[ch.id] = { no: `${gNo}.${cIdx}`, label };
        cIdx++;
      });
      gIdx++;
    });

    breakdownSec.breakdownNumbering = breakdownNumbering;
  }

  // TOC collect
  const tocEntries = [];
  const addTOCEntry = (number, title, page, level = 1) => {
    tocEntries.push({ title: `${number}. ${title}`, page, level });
  };

  // TOC-Seiten VORAB reservieren, sonst werden überzählige Einträge verworfen
  // (Mehrseiten-TOC). Eintragsanzahl exakt: 1 pro Sektion (Gruppe ODER Blatt) +
  // Breakdown-Untereinträge + Appendix. Seitenzahl per Simulation der Schreib-
  // logik (gleicher lineStep/Threshold) → reservierte Seiten == benötigte Seiten.
  const TOC_LINE_STEP = 8;
  if (includeTOC) {
    let estEntries = sections.length;
    const bn = breakdownSec?.breakdownNumbering;
    if (bn) estEntries += Object.keys(bn.groups || {}).length + Object.keys(bn.charts || {}).length;
    if (Array.isArray(filteredData) && filteredData.length) estEntries += 1;

    const tl = createPdfLayout(doc, layout.cfg);
    let tocPagesNeeded = 1, y = tl.startY() + 12;
    for (let i = 0; i < estEntries; i++) {
      if (y > tl.bottomY - 6) { tocPagesNeeded++; y = tl.startY(); }
      y += TOC_LINE_STEP;
    }
    for (let i = 0; i < tocPagesNeeded; i++) doc.addPage();
  }

  doc.addPage();

  let wroteAnySection = false;
  const pendingGroupToc = []; // TOC-Indizes von Gruppen-Überschriften ohne eigene Seite

  for (let i = 0; i < sections.length; i++) {
    const sec = sections[i];
    const sectionNo = sectionNoByKey[sec.key] || String(i + 1);
    sec.sectionNumber = sectionNo;

    const title = sec.title || sec.key;
    const level = sec.tocLevel || 1;
    const hasContent =
      (sec.enabledCharts && sec.enabledCharts.length) ||
      (sec.enabledTables && sec.enabledTables.length);

    // Gruppen-/Überschrift-Sektionen (ohne Inhalt): NUR ins Inhaltsverzeichnis,
    // keine eigene Seite. Die Seitenzahl folgt dem ersten Blatt darunter.
    if (!hasContent) {
      pendingGroupToc.push(tocEntries.length);
      addTOCEntry(sec.sectionNumber, title, null, level);
      continue;
    }

    if (wroteAnySection) doc.addPage();
    wroteAnySection = true;

    const pageIndex = doc.internal.getNumberOfPages();

    addTOCEntry(sec.sectionNumber, title, pageIndex, level);

    // ausstehende Gruppen-Überschriften auf diese (erste Inhalts-)Seite zeigen lassen
    pendingGroupToc.forEach((idx) => { if (tocEntries[idx]) tocEntries[idx].page = pageIndex; });
    pendingGroupToc.length = 0;

    if (sec.key === 'breakdown' && sec.breakdownNumbering && typeof groupBreakdownChartsBySection === 'function') {
      const chartsForGroups = sec.enabledCharts || [];
      const groups = groupBreakdownChartsBySection(chartsForGroups, ctx) || [];

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

    await renderPanelSectionToPDF(doc, sec, layout, ctx);
  }

  // Gruppen-Überschriften ohne folgendes Blatt: auf die letzte Seite zeigen.
  {
    const lastPage = doc.internal.getNumberOfPages();
    pendingGroupToc.forEach((idx) => { if (tocEntries[idx] && tocEntries[idx].page == null) tocEntries[idx].page = lastPage; });
    pendingGroupToc.length = 0;
  }

  // Appendix: products
  if (Array.isArray(filteredData) && filteredData.length) {
    doc.addPage();
    const pageIndex = doc.internal.getNumberOfPages();
    // Nächste Top-Level-Nummer (zählt nur Ebene-1-Sektionen, nicht Untergruppen).
    const topLevelCount = sections.filter((s) => (s.tocLevel || 1) === 1).length;
    const appendixNo = String(topLevelCount + 1);

    tocEntries.push({ title: `${appendixNo}. Appendix: Product Table`, page: pageIndex, level: 1 });
    drawProductTableSection(doc, filteredData, layout, { appendixNo });
  }

  // Write TOC (ab Seite 2; fließt über die vorab reservierten Seiten).
  if (includeTOC) {
    let tocPage = 2;
    doc.setPage(tocPage);
    const tocLayout = createPdfLayout(doc, layout.cfg);

    doc.setFontSize(16);
    doc.setTextColor(0);
    doc.text('Table of Contents', tocLayout.left, tocLayout.startY());
    doc.setFontSize(11);

    let y = tocLayout.startY() + 12; // erste TOC-Seite: unter der Überschrift

    tocEntries.forEach((entry) => {
      // Überlauf → nächste (reservierte) TOC-Seite, oben beginnen.
      if (y > tocLayout.bottomY - 6) {
        tocPage++;
        doc.setPage(tocPage);
        doc.setFontSize(11);
        y = tocLayout.startY();
      }

      const indent = (entry.level - 1) * 5;
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
      y += TOC_LINE_STEP;
    });
  }

  // Draw header/footer + page numbers
  const pageCount = doc.internal.getNumberOfPages();
  const finalLayout = createPdfLayout(doc, layout.cfg);

  for (let p = 2; p <= pageCount; p++) {
    doc.setPage(p);
    drawHeaderFooter(doc, finalLayout, { title: reportTitle, headerLabel, logoEl, reportTimeText });
    drawPageNumber(doc, finalLayout, { pageIndex: p, pageCount });
  }

  doc.save(opts.fileName || 'Risk.pdf');
}

// =====================================================================
// SECTION RENDERING — ROOT-SCOPED
// =====================================================================
async function renderPanelSectionToPDF(doc, sec, layout, ctx) {
  const { left: marginX, cfg } = layout;
  const gutter = 10;

  let y = layout.startY();
  y = Math.max(y, layout.topSafe ?? y);

  const sectionTitle = sec.title || sec.key || '';
  const sectionNumber = sec.sectionNumber || '';
  const breakdownNumbering = sec.breakdownNumbering || null;

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
    y = Math.max(y, layout.topSafe ?? y);

    if (contTitle) {
      doc.setFontSize(14);
      doc.setTextColor(0);
      doc.text(contTitle, marginX, y);
      y += cfg.sectionTitleSpacing;
    }
  }

  // ── Sonderlayout: Market-Risk-Dashboard nativ (Vektor, KEIN Bild) ──
  // KPI-Karten (rel. Wert + Ampel + Deltas, abs. Wert + Delta) + Limit-Auslastungs-
  // leiste (Zonen/Fuellung, Skala) + Risk-limit/Buffer-Karten. Daten aus dem Store
  // via getMarketDashboardModel().
  if (sec.key === 'market-dashboard') {
    doc.setFontSize(14); doc.setTextColor(0);
    doc.text(sectionNumber ? `${sectionNumber}. ${sectionTitle}` : sectionTitle, marginX, y);
    y += cfg.sectionTitleSpacing;
    doc.setFontSize(9); doc.setTextColor(110);
    doc.text('Current market risk position for the selected portfolio.', marginX, y);
    y += 6;

    let model = null;
    try { model = getMarketDashboardModel(); } catch (e) { console.warn('[PDF] market dashboard model failed', e); }
    const dcards = model?.cards || [];
    const contentW = layout.contentWidth;

    const MUTED = [107, 120, 136], GOLD = [200, 162, 58], CARD = [247, 248, 250],
          BORDER = [226, 230, 236], TEXT = [26, 31, 41], SUB = [58, 65, 80],
          NAVY = [11, 31, 58], TRACK = [238, 242, 246];
    const ampRgb = (s) => ({ green: [76, 175, 80], yellow: [224, 176, 0], red: [211, 47, 47] }[s] || [154, 167, 180]);

    // KPI-Karten
    const n = Math.max(1, dcards.length);
    const gap = 6, cardW = (contentW - gap * (n - 1)) / n, cardH = 34;
    ensurePageSpace(cardH + 6);
    dcards.forEach((c, i) => {
      const x = marginX + i * (cardW + gap), tx = x + 6;
      doc.setDrawColor(...BORDER); doc.setFillColor(...CARD);
      doc.roundedRect(x, y, cardW, cardH, 2, 2, 'FD');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...MUTED);
      doc.text(String(c.label).toUpperCase(), tx, y + 6.5);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(17); doc.setTextColor(...TEXT);
      const relTxt = String(c.rel); doc.text(relTxt, tx, y + 15);
      const relW = doc.getTextWidth(relTxt);
      const a = ampRgb(c.state); doc.setFillColor(a[0], a[1], a[2]); doc.circle(tx + relW + 3, y + 13.5, 1.4, 'F');
      if (Number.isFinite(c.dRel)) { doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...GOLD); doc.text(String(c.relDeltaStr), tx, y + 21); }
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(...SUB); doc.text(String(c.abs), tx, y + 27);
      if (Number.isFinite(c.dAbs)) { doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...GOLD); doc.text(String(c.absDeltaStr), tx, y + 32); }
    });
    y += cardH + 10;

    // Limitleiste
    const lim = model?.limit;
    ensurePageSpace(44);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...TEXT);
    doc.text('Limit utilization', marginX, y);
    if (!lim) {
      y += 6; doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...MUTED);
      doc.text('No market risk data for the selected portfolio yet.', marginX, y);
      y += cfg.blockGap; return;
    }
    const a = ampRgb(lim.state);
    doc.setTextColor(a[0], a[1], a[2]); doc.setFontSize(11);
    doc.text(String(lim.utilStr), marginX + contentW, y, { align: 'right' });

    const by = y + 3, bh = 6;
    doc.setFillColor(...TRACK); doc.rect(marginX, by, contentW, bh, 'F');
    const yellowW = contentW * (lim.yellowRatio / 100);
    doc.setFillColor(205, 227, 205); doc.rect(marginX, by, yellowW, bh, 'F');
    doc.setFillColor(245, 233, 197); doc.rect(marginX + yellowW, by, contentW - yellowW, bh, 'F');
    doc.setFillColor(...NAVY); doc.rect(marginX, by, contentW * Math.min(1, lim.util), bh, 'F');

    const sy = by + bh + 4;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...MUTED);
    doc.text('0%', marginX, sy);
    doc.text(`Warning ${Number(lim.yellowPct.toFixed(2))}%`, marginX + contentW / 2, sy, { align: 'center' });
    doc.text(`Limit ${Number(lim.redPct.toFixed(2))}%`, marginX + contentW, sy, { align: 'right' });

    const ly = sy + 5, lcW = 72, lcH = 20, lcGap = 6;
    const lcards = [
      { lbl: 'RISK LIMIT', val: String(lim.limitRelStr), sub: 'CONSERVATIVE' },
      { lbl: 'BUFFER', val: String(lim.bufferRelStr), sub: 'remaining to limit' },
    ];
    lcards.forEach((lc, i) => {
      const x = marginX + i * (lcW + lcGap);
      doc.setDrawColor(...BORDER); doc.setFillColor(...CARD);
      doc.roundedRect(x, ly, lcW, lcH, 2, 2, 'FD');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(...MUTED);
      doc.text(lc.lbl, x + 5, ly + 6);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(...TEXT);
      doc.text(lc.val, x + 5, ly + 13);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...MUTED);
      doc.text(lc.sub, x + 5, ly + 17.5);
    });
    y = ly + lcH + cfg.blockGap;
    return;
  }

  // ── Sonderlayout: Concentration/Overview als Dashboard-Blatt ──
  // Treemap (concCards, Plotly) links + Top-10-Balken (concTop10Chart) rechts,
  // darunter ein KPI-Band aus concKeyFiguresTable. Statt lineare Einzel-Charts.
  if (sec.key === 'concentration') {
    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text(sectionNumber ? `${sectionNumber}. ${sectionTitle}` : sectionTitle, marginX, y);
    y += cfg.sectionTitleSpacing;

    // Untertitel unter dem Sektionstitel.
    doc.setFontSize(9); doc.setTextColor(110);
    doc.text('Share of total portfolio by market value.', marginX, y);
    y += 6;

    const contentW = layout.contentWidth;
    const gap = 6;
    const leftW = contentW * 0.55 - gap / 2;
    const rightW = contentW * 0.45 - gap / 2;
    const chartsH = 78;
    const rightX = marginX + leftW + gap;

    const drawImg = (imgData, x, boxW, boxH) => {
      doc.setFillColor(247);
      doc.rect(x, y, boxW, boxH, 'F');
      if (!imgData?.dataUrl) return;
      const srcW = imgData.width || 900;
      const srcH = imgData.height || 520;
      const scale = Math.min(boxW / srcW, (boxH - 2) / srcH, 1);
      const w = srcW * scale;
      const h = srcH * scale;
      const ix = x + (boxW - w) / 2;
      const iy = y + (boxH - h) / 2;
      try { doc.addImage(imgData.dataUrl, 'PNG', ix, iy, w, h); } catch (e) { console.warn('[PDF] dashboard image failed', e); }
    };

    const treemapEl = ctx.getById('concCards');
    const barEl = ctx.getById('concTop10Chart');
    const treemapImg = treemapEl
      ? (treemapEl.tagName === 'CANVAS' ? canvasToPngData(treemapEl) : await plotlyToPngData(treemapEl))
      : null;
    const barImg = (barEl && barEl.tagName === 'CANVAS') ? canvasToPngData(barEl) : null;

    ensurePageSpace(chartsH + 52, `${sectionTitle} (cont.)`);
    // Chart-Ueberschriften: linke ueber der Treemap, rechte (Top 10) ueber dem Balken.
    doc.setFontSize(10); doc.setTextColor(0);
    doc.text('All issuers', marginX, y);
    doc.text('Top 10 issuers', rightX, y);
    y += 3;
    drawImg(treemapImg, marginX, leftW, chartsH);
    drawImg(barImg, rightX, rightW, chartsH);
    y += chartsH + 10;

    // KPI-Band (Key Figures: Number of entries / Top 10 / Others / Avg / Median).
    const kpis = kpisFromTableEl(ctx.getById('concKeyFiguresTable'));
    if (kpis.length) {
      ensurePageSpace(26);
      y = drawKpiBand(doc, { marginX, contentW, y }, kpis);
    }
    return;
  }

  const chartsAll = sec.enabledCharts || [];
  const tablesAll = sec.enabledTables || [];
  const isBreakdown = sec.key === 'breakdown';

  if (isBreakdown) {
    const legendByChartId = new Map();
    tablesAll.forEach((t) => {
      if (!t.id) return;
      const m = t.id.match(/^(.*)-legend$/i);
      if (!m) return;
      legendByChartId.set(m[1], t);
    });

    const groups = groupBreakdownChartsBySection(chartsAll, ctx);
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
      if (blockIndex === 0) {
        y = layout.startY();
        y = Math.max(y, layout.topSafe ?? y);
      } else {
        y = layout.newPage(doc);
        y = Math.max(y, layout.topSafe ?? y);
      }

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
      const chartLabel = chartMeta?.label || chart.label || resolveBreakdownChartLabel(chart.id, ctx);
      const chartNumber = chartMeta?.no;
      const chartHeading = chartNumber ? `${chartNumber}. ${chartLabel}` : chartLabel;

      doc.setFontSize(11);
      doc.setTextColor(0);
      doc.text(chartHeading, marginX, y);
      y += 6;

      const el = ctx.getById(chart.id);
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

          doc.setFillColor(245);
          doc.rect(boxX - 2, boxY, maxW + 4, boxHeight - 4, 'F');

          doc.setFontSize(9);
          doc.setTextColor(0);
          doc.text(chartLabel, boxX + maxW / 2, labelY, { align: 'center' });

          try {
            doc.addImage(imgData.dataUrl, 'PNG', imgX, imgY, targetWidth, targetHeight);
          } catch (e) {
            console.warn('[PDF] addImage failed for breakdown chart', chart.id, e);
          }

          y += boxHeight + 6;
        }
      }

      const tMeta = legendByChartId.get(chart.id);
      if (tMeta) {
        const host = ctx.getById(tMeta.id);
        const tableElem =
          host && host.tagName && host.tagName.toLowerCase() === 'table'
            ? host
            : host?.querySelector?.('table');

        if (tableElem) {
          ensurePageSpace(40, `${sectionTitle} (cont.)`);

          doc.setFontSize(10);
          doc.setTextColor(0);
          doc.text(`${chartHeading} Breakdown`, marginX, y);

          safeAutoTable(doc, layout, {
            html: tableElem,
            startY: y + 6,
            theme: 'grid',
            styles: { fontSize: 8, cellPadding: 2 },
            headStyles: { fillColor: [245, 245, 245], textColor: [60, 60, 60] },
            alternateRowStyles: { fillColor: [255, 255, 255] },
            tableWidth: layout.contentWidth,
          });

          y = doc.lastAutoTable?.finalY ? doc.lastAutoTable.finalY + cfg.blockGap : y + 60;
        }
      }

      blockIndex++;
    }

    return;
  }

  // Normal sections
  doc.setFontSize(14);
  doc.setTextColor(0);
  doc.text(sectionNumber ? `${sectionNumber}. ${sectionTitle}` : sectionTitle, marginX, y);
  y += cfg.sectionTitleSpacing;

  // ── Komponiertes Layout: Charts NEBENEINANDER in einer Zeile (Dashboard-Stil)
  //    fuer Structure + Market-Risk-Seiten; Tabellen laufen danach im Standard-
  //    Tabellen-Loop full-width darunter. Andere Sektionen bleiben linear. ──
  const COMPOSED_ROW_KEYS = new Set(['structure', 'market', 'mvar', 'mvar-products', 'mvar-issuers', 'mvar-scenarios']);
  const composedRow = COMPOSED_ROW_KEYS.has(sec.key) && (sec.enabledCharts || []).length > 0;
  if (composedRow) {
    const rowCharts = sec.enabledCharts || [];
    // Issuers: festes 2x2-Raster (VaR-Zeile: Balken+Scatter, ES-Zeile: Balken+Scatter).
    const perRow = (sec.key === 'mvar-issuers') ? 2 : Math.min(rowCharts.length, 3);
    const cgap = 6;
    const cellW = (layout.contentWidth - cgap * (perRow - 1)) / perRow;
    const cellH = perRow >= 3 ? 70 : 84;
    let col = 0;
    let rowY = y;
    for (const ch of rowCharts) {
      const el = ctx.getById(ch.id);
      let imgData = null;
      if (el) imgData = (el.tagName === 'CANVAS') ? canvasToPngData(el) : await plotlyToPngData(el);
      if (col === 0) { ensurePageSpace(cellH + 16, `${sectionTitle} (cont.)`); rowY = y; }
      const x = marginX + col * (cellW + cgap);
      doc.setFillColor(245);
      doc.rect(x, rowY, cellW, cellH + 8, 'F');
      doc.setFontSize(8); doc.setTextColor(90);
      doc.text(ch.label || ch.id, x + cellW / 2, rowY + 5, { align: 'center' });
      if (imgData?.dataUrl) {
        const srcW = imgData.width || 900;
        const srcH = imgData.height || 520;
        const availH = cellH - 2;
        const scale = Math.min(cellW / srcW, availH / srcH, 1);
        const w = srcW * scale;
        const h = srcH * scale;
        const ix = x + (cellW - w) / 2;
        const iy = rowY + 7 + (availH - h) / 2;
        try { doc.addImage(imgData.dataUrl, 'PNG', ix, iy, w, h); } catch (e) { console.warn('[PDF] composed chart failed', ch.id, e); }
      }
      col++;
      if (col >= perRow) { col = 0; y = rowY + cellH + 16; }
    }
    if (col > 0) y = rowY + cellH + 16;
  }

  // Graphiken 1-spaltig (~60% Breite links), damit rechts die Notiz danebenpasst
  // (analog zu den Tabellen). Bei composedRow uebersprungen (Charts stehen bereits).
  const chartWidth = layout.contentWidth * 0.60;
  const noteGapC = 6;
  const noteXC = marginX + chartWidth + noteGapC;
  const noteWC = Math.max(0, layout.contentWidth - chartWidth - noteGapC);

  for (const ch of (composedRow ? [] : chartsAll)) {
    const el = ctx.getById(ch.id);
    if (!el) continue;

    let imgData = null;
    if (el.tagName === 'CANVAS') imgData = canvasToPngData(el);
    else imgData = await plotlyToPngData(el);

    if (!imgData?.dataUrl) continue;

    const srcW = imgData.width || 900;
    const srcH = imgData.height || 520;

    const maxH = 90;
    const scale = Math.min(chartWidth / srcW, maxH / srcH, 1);
    const targetWidth = srcW * scale;
    const targetHeight = srcH * scale;

    // Notiz zur Graphik (gleicher Store wie Tabellen, Key = chart-id).
    const noteTxt = (typeof getTableNote === 'function' ? getTableNote(ch.id) : '') || '';
    let noteLines = [];
    if (noteTxt.trim() && noteWC > 10) {
      doc.setFontSize(9);
      noteLines = doc.splitTextToSize(noteTxt, noteWC);
    }
    const noteHeight = noteLines.length * 4;

    const blockHeight = Math.max(targetHeight, noteHeight) + 22;
    ensurePageSpace(blockHeight + 10, `${sectionTitle} (cont.)`);

    const boxY = y;
    const labelY = boxY + 7;
    const imgY = boxY + 11;
    const imgX = marginX + (chartWidth - targetWidth) / 2;

    doc.setFillColor(245);
    doc.rect(marginX - 2, boxY, chartWidth + 4, blockHeight - 4, 'F');

    doc.setFontSize(9);
    doc.setTextColor(0);
    doc.text(ch.label || ch.id, marginX + chartWidth / 2, labelY, { align: 'center' });

    try {
      doc.addImage(imgData.dataUrl, 'PNG', imgX, imgY, targetWidth, targetHeight);
    } catch (e) {
      console.warn('[PDF] addImage failed for', ch.id, e);
    }

    // Notiz rechts neben der Graphik.
    if (noteLines.length) {
      doc.setFontSize(9);
      doc.setTextColor(90);
      doc.text(noteLines, noteXC, imgY + 3);
      doc.setTextColor(0);
    }

    y += blockHeight + 4;
  }

  for (const t of tablesAll) {
    // KPI-Tabellen (data-kpi-band) als formatiertes Kachel-Band rendern statt als
    // schmucklose Tabelle (wie die Concentration-Seite / PROTOTYPE Page 3).
    const kpiEl = ctx.getById(t.id);
    if (kpiEl && kpiEl.dataset && kpiEl.dataset.kpiBand) {
      const kpis = kpisFromTableEl(kpiEl);
      if (kpis.length) {
        ensurePageSpace(32, `${sectionTitle} (cont.)`);
        doc.setFontSize(10); doc.setTextColor(0);
        doc.text(String(t.label || 'Key Figures'), marginX, y);
        y += 6;
        y = drawKpiBand(doc, { marginX, contentW: layout.contentWidth, y }, kpis);
        y += cfg.blockGap;
      }
      continue;
    }

    const tbl = extractTableFromContainer(t.id, { maxRows: 500, maxCols: 40, ctx });
    if (!tbl) continue;

    ensurePageSpace(40, `${sectionTitle} (cont.)`);

    doc.setFontSize(10);
    doc.setTextColor(0);
    doc.text(String(t.label || t.id), marginX, y);

    const head = tbl.head && tbl.head.length ? [tbl.head] : undefined;
    const cellStatus = tbl.cellStatus || [];

    // Tabelle immer schmaler (~60%), damit rechts Platz fuer die Notiz-Spalte bleibt.
    const noteGap = 6;
    const tableW  = layout.contentWidth * 0.60;
    const noteX   = marginX + tableW + noteGap;
    const noteW   = Math.max(0, layout.contentWidth - tableW - noteGap);
    const noteTxt = (typeof getTableNote === 'function' ? getTableNote(t.id) : '') || '';
    const tableTopY = y + 6;

    safeAutoTable(doc, layout, {
      startY: tableTopY,
      head,
      body: tbl.body,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [34, 34, 34], textColor: [220, 220, 220] },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      tableWidth: tableW,
      margin: { left: marginX },
      // Ampelpunkt: kleiner gefüllter Kreis am rechten Zellenrand, wo die Live-
      // Tabelle einen Traffic-Light-Dot hat (Text geht via textContent verloren).
      didDrawCell: (data) => {
        if (!data || data.section !== 'body') return;
        const status = cellStatus?.[data.row?.index]?.[data.column?.index];
        if (!status) return;
        const palette = { green: [76, 175, 80], yellow: [224, 176, 0], red: [211, 47, 47] };
        const rgb = palette[status];
        if (!rgb) return;
        const cell = data.cell;
        const r = 1.3;
        const cx = cell.x + cell.width - r - 1.6;
        const cy = cell.y + cell.height / 2;
        doc.setFillColor(rgb[0], rgb[1], rgb[2]);
        doc.circle(cx, cy, r, 'F');
      },
    });

    const tableFinalY = doc.lastAutoTable?.finalY ? doc.lastAutoTable.finalY : (tableTopY + 40);

    // Notiz rechts neben der Tabelle (umgebrochen, kleine graue Schrift).
    let noteBottomY = tableTopY;
    if (noteTxt.trim() && noteW > 10) {
      doc.setFontSize(9);
      doc.setTextColor(90);
      const lines = doc.splitTextToSize(noteTxt, noteW);
      doc.text(lines, noteX, tableTopY + 3);
      noteBottomY = tableTopY + 3 + lines.length * 4;
      doc.setTextColor(0);
    }

    y = Math.max(tableFinalY, noteBottomY) + cfg.blockGap;
  }
}

// =====================================================================
// APPENDIX TABLE — HARD NO-WRAP for PROD_ID + numeric cols (0,3,4)
// =====================================================================
function drawProductTableSection(doc, filteredData, layout, { appendixNo } = {}) {
  const riskData = extractProductRiskData(filteredData);

  let y = layout.startY();
  y = Math.max(y, layout.topSafe ?? y);

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

  const base = [22, 72, 34, 26, 22];
  const mins = [18, 40, 26, 18, 18];
  const targetW = Math.max(40, (layout.contentWidth || 180) - 2);

  const sumBase = base.reduce((a, b) => a + b, 0) || 1;
  let scaled = base.map((w, i) => Math.max(mins[i], (w / sumBase) * targetW));

  const sumScaled1 = scaled.reduce((a, b) => a + b, 0) || 1;
  const f = targetW / sumScaled1;
  scaled = scaled.map((w, i) => Math.max(mins[i], w * f));

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
    shave(1, mins[1]);
    shave(2, mins[2]);
    shave(3, mins[3]);
    shave(4, mins[4]);
  }

  safeAutoTable(doc, layout, {
    startY: y,
    head: [['Product ID', 'Description', 'Issuer', 'Notional', 'NAV']],
    body: tableData,
    theme: 'striped',
    tableWidth: targetW,

    // Default overflow hidden => NO wrap for everything unless explicit
    styles: {
      fontSize: 7,
      cellPadding: 1.2,
      overflow: 'hidden',
      cellWidth: 'wrap',
      valign: 'top',
    },
    headStyles: { fontSize: 7, cellPadding: 1.2, fillColor: [245, 245, 245], textColor: [60, 60, 60] },
    alternateRowStyles: { fillColor: [255, 255, 255] },

    columnStyles: {
      0: { cellWidth: scaled[0], halign: 'left', overflow: 'hidden' },
      3: { cellWidth: scaled[3], halign: 'right', overflow: 'hidden' },
      4: { cellWidth: scaled[4], halign: 'right', overflow: 'hidden' },
      1: { cellWidth: scaled[1], overflow: 'linebreak' },
      2: { cellWidth: scaled[2], overflow: 'linebreak' },
    },

    didParseCell: function (data) {
      const c = data?.column?.index;

      if (c === 0 || c === 3 || c === 4) {
        const raw = data?.cell?.raw;
        const oneLine = raw == null ? '' : String(raw).replace(/\r?\n/g, ' ');
        data.cell.text = [oneLine];
        data.cell.styles.overflow = 'hidden';
      }

      if (c === 3 || c === 4) {
        data.cell.styles.halign = 'right';
      }
    },
  });
}

function extractProductRiskData(filteredData) {
  if (!filteredData || !Array.isArray(filteredData)) return [];
  return filteredData.map((entry) => ({
    PROD_ID: entry.PROD_ID != null ? String(entry.PROD_ID) : '',
    DESCRIPTION: (entry.DESCRIPTION || '').toString().substring(0, 160),
    ISSUER: entry.ISSUER || '',
    NOTIONAL: entry.NOTIONAL != null ? String(entry.NOTIONAL) : '',
    NAV: entry.NAV != null ? String(entry.NAV) : '',
  }));
}

// =====================================================================
// GENERIC TABLE EXTRACT — ROOT-SCOPED
// =====================================================================
// Traffic-light dot status of a table cell (real DOM dot rendered by the MVaR
// renderer: <span class="mvar-status-dot risk-dot risk-dot--green" data-risk-status="green">).
// textContent loses it, so we read it separately to draw a coloured circle in the PDF.
function dotStatusFromCell(td) {
  if (!td || typeof td.querySelector !== 'function') return null;
  const el = td.querySelector('[data-risk-status], .risk-dot, .mvar-status-dot, .credit-status-dot');
  if (!el) return null;
  let s = ((el.getAttribute && (el.getAttribute('data-risk-status') || el.getAttribute('data-status'))) || '').toLowerCase();
  if (s !== 'green' && s !== 'yellow' && s !== 'red') {
    const m = /risk-dot--(green|yellow|red)/.exec(String(el.className || ''));
    s = m ? m[1] : '';
  }
  return (s === 'green' || s === 'yellow' || s === 'red') ? s : null;
}

// Zelltext robust lesen: Werte stehen oft in <input>/<select>/<textarea> (z.B.
// Customer-Setup Threshold-/Limit-Tabellen), NICHT in td.textContent. Ohne das
// erscheint im PDF nur das "%"/Label, der Wert fehlt. Fallback: textContent.
function cellText(el) {
  if (!el || typeof el.querySelector !== 'function') return (el?.textContent || '').trim();

  const input = el.querySelector('input:not([type="checkbox"]):not([type="radio"])');
  if (input) {
    // Einheit/Suffix (z.B. "%") steht oft in einem verschachtelten <span>, nicht als
    // direkter Text-Node. textContent erfasst beides; das <input> selbst hat keinen
    // textContent, liefert also nur den Einheiten-/Suffix-Text.
    const suffix = (el.textContent || '').trim();
    return `${input.value ?? ''}${suffix ? ' ' + suffix : ''}`.trim();
  }

  const select = el.querySelector('select');
  if (select) {
    return (
      select.options?.[select.selectedIndex]?.textContent?.trim() ||
      select.value ||
      ''
    ).trim();
  }

  const textarea = el.querySelector('textarea');
  if (textarea) return (textarea.value || '').trim();

  return (el.textContent || '').trim();
}

function extractTableFromContainer(containerIds, { maxRows = 100, maxCols = 20, ctx } = {}) {
  const ids = Array.isArray(containerIds) ? containerIds : [containerIds];
  let host = null;

  for (const id of ids) {
    const el = ctx?.getById?.(id) || getInAppById(id);
    if (el) { host = el; break; }
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
  if (!rows.length) rows = Array.from(table.querySelectorAll('tr'));

  // Kein <thead> -> erste Zeile als Kopfzeile nehmen (identisch zur Preview/miniTbl).
  // Ohne das erscheint generisch "COL 1/2/3" und die echte Kopfzeile (z.B. label/VaR/ES)
  // landet als Datenzeile. Betrifft u.a. die Credit-Tabellen (insertRow/insertCell -> nur <td>).
  if (!head.length && rows.length) {
    const first = Array.from(rows[0].children).slice(0, maxCols);
    head = first.map((c) => (c.textContent || '').trim());
    rows = rows.slice(1);
  }

  rows = rows.slice(0, maxRows);

  const body = rows.map((tr) => {
    const cells = Array.from(tr.children).slice(0, maxCols);
    return cells.map((td) => cellText(td));
  });

  // Per-cell traffic-light status (same row/col indexing as body) so the PDF can
  // draw a coloured dot where the live table has one.
  const cellStatus = rows.map((tr) => {
    const cells = Array.from(tr.children).slice(0, maxCols);
    return cells.map((td) => dotStatusFromCell(td));
  });

  if (!head.length && body.length) head = body[0].map((_, i) => `COL ${i + 1}`);
  if (!head.length && !body.length) return null;

  return { head, body, cellStatus };
}

