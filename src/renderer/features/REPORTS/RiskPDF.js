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
import { getFactorKpiModel } from '../ANALYSE_PORTFOLIO/marketRisk/mvar/mvarFactorPLPanel.js';
import { getCreditDashboardModel } from '../ANALYSE_PORTFOLIO/CREDIT_RISK/creditRiskDashboard.js';

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
// Einheitliche Report-Karten-Optik: heller Fill + weicher, abgerundeter Rahmen.
const RPT_CARD_FILL = [247, 248, 250];
const RPT_CARD_BORDER = [226, 230, 236];
const RPT_CARD_HEAD = [237, 240, 244];
const RPT_MUTED = [107, 120, 136];
const RPT_TEXT = [26, 31, 41];
function drawChartCard(doc, x, y, w, h) {
  doc.setDrawColor(...RPT_CARD_BORDER); doc.setFillColor(...RPT_CARD_FILL); doc.setLineWidth(0.2);
  doc.roundedRect(x, y, w, h, 2, 2, 'FD');
}

// Credit Top-Tail-Drivers: je PD-Ansicht Chart + Tabelle NEBENEINANDER, Ansichten untereinander.
const CR_DRIVER_VIEWS = [
  { chartId: 'crTailContribChartHist', tableId: 'crTailContribTableHist' },
  { chartId: 'crTailContribChartNorm', tableId: 'crTailContribTableNorm' },
];
const CR_DRIVER_CHART_IDS = new Set(CR_DRIVER_VIEWS.map(v => v.chartId));
const CR_DRIVER_TABLE_IDS = new Set(CR_DRIVER_VIEWS.map(v => v.tableId));

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
      // Einheitliche Karten-Optik: weiche Rahmenlinien + heller, muted Kopf.
      styles: { ...(options.styles || {}), lineColor: RPT_CARD_BORDER, lineWidth: 0.1 },
      headStyles: { fontStyle: 'bold', ...(options.headStyles || {}), fillColor: RPT_CARD_HEAD, textColor: RPT_MUTED, lineColor: RPT_CARD_BORDER, lineWidth: 0.1 },
      margin: {
        left: options.margin?.left ?? (layout?.left ?? 14),
        right: options.margin?.right ?? (layout?.right ?? 14),
        top: options.margin?.top ?? topSafe,
        bottom: options.margin?.bottom ?? bottomMargin,
      },
    });
    // Weicher, abgerundeter Kartenrahmen um die Tabelle (fehlertolerant). Nur wenn die
    // Tabelle auf EINER Seite steht (sonst zeichnet der Rahmen ueber die Seitengrenze).
    try {
      const t = doc.lastAutoTable;
      const y1 = t?.finalY;
      const curPage = (doc.internal?.getCurrentPageInfo?.() || {}).pageNumber;
      const singlePage = !t?.startPageNumber || !curPage || t.startPageNumber === curPage;
      if (t && Number.isFinite(y1) && singlePage) {
        const x0 = t.settings?.margin?.left ?? (layout?.left ?? 14);
        const y0 = Number.isFinite(t.settings?.startY) ? t.settings.startY : safeStartY;
        const w0 = t.table?.width ?? options.tableWidth ?? layout?.contentWidth ?? 0;
        if (w0 > 0 && y1 > y0) { doc.setDrawColor(...RPT_CARD_BORDER); doc.setLineWidth(0.2); doc.roundedRect(x0, y0, w0, y1 - y0, 2, 2, 'S'); }
      }
    } catch {}
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

function drawHeaderFooter(doc, layout, { title, headerLabel, chapter, logoEl, reportTimeText } = {}) {
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

  // Kopf: gefuellter Navy-Balken (Farbe wie Deckblatt) ueber die volle Breite; links
  // "vXP | <Portfolio>" (weiss, fett), rechts der Zeitraum (heller Akzent).
  const bandH = 14;
  const bandTextY = 9;
  doc.setFillColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.rect(0, 0, pageW, bandH, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(255, 255, 255);
  doc.text(String(headerLabel || t), left, bandTextY);
  // Uebergeordnetes Kapitel (Level-1) mittig als laufender Kolumnentitel.
  if (chapter) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.text(String(chapter).toUpperCase(), pageW / 2, bandTextY, { align: 'center' });
  }
  if (reportTimeText) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(200, 210, 222); // Akzentgrau wie die Cover-Labels
    doc.text(String(reportTimeText), pageW - right, bandTextY, { align: 'right' });
  }
  doc.setTextColor(0);

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
function drawKpiBand(doc, { marginX, contentW, y }, kpis, opts = {}) {
  if (!Array.isArray(kpis) || !kpis.length) return y;
  const n = kpis.length;
  const tileGap = 4;
  const tileW = (contentW - tileGap * (n - 1)) / n;
  // Einheitlicher KPI-Karten-Stil fuer ALLE Report-Sektionen: abgerundete Box mit Rahmen,
  // oben kleines GROSSGESCHRIEBENES muted Label, darunter fetter dunkler Wert (linksbuendig)
  // — analog zu den Risk-Limit/Buffer-Karten im Dashboard.
  const tileH = opts.tileH || 18;
  const valFont = opts.valueFont || 13;
  const MUTED = [107, 120, 136], CARD = [247, 248, 250], BORDER = [226, 230, 236], TEXT = [26, 31, 41];
  kpis.forEach((k, idx) => {
    const x = marginX + idx * (tileW + tileGap);
    doc.setDrawColor(...BORDER); doc.setFillColor(...CARD);
    doc.roundedRect(x, y, tileW, tileH, 2, 2, 'FD');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(...MUTED);
    doc.text(String(k.label ?? '').toUpperCase(), x + 5, y + 6);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(valFont); doc.setTextColor(...TEXT);
    doc.text(String(k.value ?? ''), x + 5, y + 13.5);
  });
  doc.setFont('helvetica', 'normal'); doc.setTextColor(0);
  return y + tileH + (opts.gapAfter ?? 6);
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
  // (Anzahl der Sektionen) bekannt ist (Mehrseiten-TOC).

  let sections = getActiveRiskSectionsForPdf() || [];
  sections = applyPdfHierarchy(sections);

  const sectionNoByKey = {};
  sections.forEach((s) => (sectionNoByKey[s.key] = s.sectionNumber));

  // TOC collect
  const tocEntries = [];
  const addTOCEntry = (number, title, page, level = 1) => {
    tocEntries.push({ title, page, level }); // Nummern bewusst weggelassen (Einrueckung via level)
  };

  // TOC-Seiten VORAB reservieren, sonst werden überzählige Einträge verworfen
  // (Mehrseiten-TOC). Eintragsanzahl exakt: 1 pro Sektion (Gruppe ODER Blatt).
  // Seitenzahl per Simulation der Schreib-
  // logik (gleicher lineStep/Threshold) → reservierte Seiten == benötigte Seiten.
  const TOC_LINE_STEP = 8;
  if (includeTOC) {
    let estEntries = sections.length;
    // Kein Appendix-Eintrag mehr (Produkttabelle entfernt).

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
  const chapterByPage = {};   // Seite -> uebergeordnetes Kapitel (direkter Elternknoten)
  const titleByLevel = [];    // Titel je Hierarchie-Ebene (1-basiert)

  for (let i = 0; i < sections.length; i++) {
    const sec = sections[i];
    const sectionNo = sectionNoByKey[sec.key] || String(i + 1);
    sec.sectionNumber = sectionNo;

    const title = sec.title || sec.key;
    const level = sec.tocLevel || 1;
    // Titel dieser Ebene setzen, tiefere (veraltete) Ebenen verwerfen. Das uebergeordnete
    // Kapitel ist der DIREKTE Elternknoten = Titel eine Ebene hoeher (nicht die Wurzel).
    titleByLevel[level] = title;
    titleByLevel.length = level + 1;
    const parentChapter = titleByLevel[level - 1] || '';
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

    await renderPanelSectionToPDF(doc, sec, layout, ctx);

    // Alle von dieser Sektion belegten Seiten dem direkten Elternkapitel zuordnen.
    const endPage = doc.internal.getNumberOfPages();
    for (let p = pageIndex; p <= endPage; p++) chapterByPage[p] = parentChapter;
  }

  // Gruppen-Überschriften ohne folgendes Blatt: auf die letzte Seite zeigen.
  {
    const lastPage = doc.internal.getNumberOfPages();
    pendingGroupToc.forEach((idx) => { if (tocEntries[idx] && tocEntries[idx].page == null) tocEntries[idx].page = lastPage; });
    pendingGroupToc.length = 0;
  }

  // Appendix (Produkttabelle) auf Wunsch entfernt — bewusst nicht mehr gezeichnet.

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
    drawHeaderFooter(doc, finalLayout, { title: reportTitle, headerLabel, chapter: chapterByPage[p] || '', logoEl, reportTimeText });
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
        format: 'jpeg',
        width: exportWidth,
        height: exportHeight,
        scale: 2,
      });

      return { dataUrl, width: exportWidth, height: exportHeight, fmt: 'JPEG' };
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

      // Charts als JPEG statt PNG einbetten -> drastisch kleinere PDF-Datei (Flaechen/
      // Verlaeufe komprimieren als PNG kaum). Chart-Canvas sind transparent, daher vorher
      // auf WEISS komponieren, sonst wird der JPEG-Hintergrund schwarz.
      let dataUrl, fmt = 'JPEG';
      try {
        const off = document.createElement('canvas');
        off.width = srcW; off.height = srcH;
        const octx = off.getContext('2d');
        octx.fillStyle = '#ffffff';
        octx.fillRect(0, 0, srcW, srcH);
        octx.drawImage(canvas, 0, 0, srcW, srcH);
        dataUrl = off.toDataURL('image/jpeg', 0.82);
      } catch {
        dataUrl = canvas.toDataURL('image/png'); fmt = 'PNG';
      }
      return { dataUrl, width: srcW, height: srcH, fmt };
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
  if (sec.key === 'market-dashboard' || sec.key === 'credit-dashboard') {
    const isCredit = sec.key === 'credit-dashboard';
    doc.setFontSize(14); doc.setTextColor(0);
    doc.text(sectionTitle, marginX, y);
    y += cfg.sectionTitleSpacing;
    doc.setFontSize(9); doc.setTextColor(110);
    doc.text(isCredit ? 'Current credit risk position for the selected portfolio.' : 'Current market risk position for the selected portfolio.', marginX, y);
    y += 6;

    let model = null;
    try { model = isCredit ? getCreditDashboardModel() : getMarketDashboardModel(); } catch (e) { console.warn('[PDF] dashboard model failed', e); }
    const dcards = model?.cards || [];
    const contentW = layout.contentWidth;

    const MUTED = [107, 120, 136], GOLD = [200, 162, 58], CARD = [247, 248, 250],
          BORDER = [226, 230, 236], TEXT = [26, 31, 41], SUB = [58, 65, 80],
          NAVY = [11, 31, 58], TRACK = [238, 242, 246];
    const ampRgb = (s) => ({ green: [76, 175, 80], yellow: [224, 176, 0], red: [211, 47, 47] }[s] || [154, 167, 180]);

    // Limitleiste(n): Market = eine (MVaR); Credit = eine je Kennzahl (untereinander).
    // Zuerst definieren, damit beide Zweige sie nutzen.
    const drawLimitBar = (lim, titleLabel, limitSub, noDataMsg) => {
      ensurePageSpace(46);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...TEXT);
      doc.text(titleLabel ? `Limit utilization — ${titleLabel}` : 'Limit utilization', marginX, y);
      if (!lim) {
        y += 6; doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...MUTED);
        doc.text(noDataMsg || 'No limit data.', marginX, y);
        y += cfg.blockGap; return;
      }
      // Balken ~halb so breit (wie im Screen).
      const barW = contentW * 0.5;
      const a = ampRgb(lim.state);
      doc.setTextColor(a[0], a[1], a[2]); doc.setFontSize(11);
      doc.text(String(lim.utilStr), marginX + barW, y, { align: 'right' });

      const by = y + 3, bh = 6;
      doc.setFillColor(...TRACK); doc.rect(marginX, by, barW, bh, 'F');
      const yellowW = barW * (lim.yellowRatio / 100);
      doc.setFillColor(205, 227, 205); doc.rect(marginX, by, yellowW, bh, 'F');
      doc.setFillColor(245, 233, 197); doc.rect(marginX + yellowW, by, barW - yellowW, bh, 'F');
      doc.setFillColor(...NAVY); doc.rect(marginX, by, barW * Math.min(1, lim.util), bh, 'F');

      const sy = by + bh + 4;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...MUTED);
      doc.text('0%', marginX, sy);
      doc.text(`Warning ${Number(lim.yellowPct.toFixed(2))}%`, marginX + barW / 2, sy, { align: 'center' });
      doc.text(`Limit ${Number(lim.redPct.toFixed(2))}%`, marginX + barW, sy, { align: 'right' });

      const ly = sy + 5, lcW = 72, lcH = 20, lcGap = 6;
      const lcards = [
        { lbl: 'RISK LIMIT', val: String(lim.limitRelStr), sub: (lim.limitAbsStr || limitSub || 'THRESHOLD') },
        { lbl: 'BUFFER', val: String(lim.bufferRelStr), sub: (lim.bufferAbsStr || 'remaining to limit') },
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
    };

    // ── MARKET: Status-Box + 4 KPI-Karten (rel oben, abs darunter) + Risk development + Limit ──
    if (!isCredit) {
      const st = model?.status;
      if (st) {
        const boxH = 22;
        ensurePageSpace(boxH + 6);
        doc.setDrawColor(...BORDER); doc.setFillColor(...CARD);
        doc.roundedRect(marginX, y, contentW, boxH, 2, 2, 'FD');
        doc.setFillColor(...GOLD); doc.rect(marginX, y, 1.6, boxH, 'F');
        doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...TEXT);
        doc.text('Market Risk Overview', marginX + 6, y + 6);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...SUB);
        const lines = doc.splitTextToSize(String(st.text || ''), contentW - 55);
        doc.text(lines.slice(0, 3), marginX + 6, y + 11);
        const a = ampRgb(st.state);
        const bx = marginX + contentW - 22;
        doc.setFillColor(a[0], a[1], a[2]); doc.circle(bx, y + 8, 2.6, 'F');
        doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(...MUTED);
        doc.text(String(st.label || ''), bx, y + 15, { align: 'center' });
        y += boxH + 8;
      }

      const mcards = model?.cards || [];
      const mN = Math.max(1, mcards.length);
      const mGap = 6, mCardW = (contentW - mGap * (mN - 1)) / mN, mCardH = 30;
      ensurePageSpace(mCardH + 6);
      mcards.forEach((c, i) => {
        const x = marginX + i * (mCardW + mGap), tx = x + 5;
        doc.setDrawColor(...BORDER); doc.setFillColor(...CARD);
        doc.roundedRect(x, y, mCardW, mCardH, 2, 2, 'FD');
        doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(...MUTED);
        doc.text(String(c.label).toUpperCase(), tx, y + 6);
        doc.setFont('helvetica', 'bold'); doc.setFontSize(14);
        if (c.isDelta) doc.setTextColor(76, 175, 80); else doc.setTextColor(...TEXT);
        const relTxt = String(c.rel); doc.text(relTxt, tx, y + 14);
        if (!c.isDelta) { const relW = doc.getTextWidth(relTxt); const a = ampRgb(c.state); doc.setFillColor(a[0], a[1], a[2]); doc.circle(tx + relW + 3, y + 12.6, 1.3, 'F'); }
        doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...SUB);
        if (c.abs) doc.text(String(c.abs), tx, y + 20);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(...MUTED);
        if (c.desc) doc.text(String(c.desc), tx, y + 25);
      });
      y += mCardH + 10;

      const flow = model?.flow || [];
      if (flow.length) {
        ensurePageSpace(26);
        doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...TEXT);
        doc.text('Risk development', marginX, y); y += 3;
        const fN = flow.length, arrowW = 8;
        const fBoxW = (contentW - arrowW * (fN - 1)) / fN, fBoxH = 18;
        let fx = marginX;
        flow.forEach((f, i) => {
          if (i > 0) { doc.setFont('helvetica', 'normal'); doc.setFontSize(13); doc.setTextColor(...MUTED); doc.text('>', fx + arrowW / 2, y + fBoxH / 2 + 2, { align: 'center' }); fx += arrowW; }
          doc.setDrawColor(...BORDER); doc.setFillColor(...CARD);
          doc.roundedRect(fx, y, fBoxW, fBoxH, 2, 2, 'FD');
          doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(...MUTED);
          doc.text(String(f.label).toUpperCase(), fx + 4, y + 5);
          doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...TEXT);
          doc.text(String(f.rel), fx + 4, y + 11);
          doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...SUB);
          doc.text(String(f.abs), fx + 4, y + 16);
          fx += fBoxW;
        });
        y += fBoxH + cfg.blockGap;
      }

      drawLimitBar(model?.limit, null, 'CONSERVATIVE', 'No market risk data for the selected portfolio yet.');
      return;
    }

    // ── CREDIT: KPI-Karten-Reihe + Limitleiste je Kennzahl ──
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
      if (c.abs) { doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(...SUB); doc.text(String(c.abs), tx, y + 27); }
      if (Number.isFinite(c.dAbs)) { doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...GOLD); doc.text(String(c.absDeltaStr), tx, y + 32); }
    });
    y += cardH + 10;
    dcards.forEach((c) => { if (c.limit) drawLimitBar(c.limit, c.label, 'THRESHOLD', null); });
    return;
  }

  // Breakdown-PARENT (#panel-concentration): nur Kapitel-Titel (Divider) — die
  // Live-Charts (concCards/concTop10Chart = aktuell gewaehlte Dimension) werden
  // bewusst NICHT gezeichnet (sonst Doppelung). Die 11 Dimensions-Kinder tragen die
  // kompakten Dashboards.
  if (sec.key === 'concentration') {
    doc.setFontSize(14); doc.setTextColor(0);
    doc.text(sectionTitle, marginX, y);
    y += cfg.sectionTitleSpacing;
    doc.setFontSize(9); doc.setTextColor(110);
    doc.text('Portfolio breakdown by dimension — see the following pages.', marginX, y);
    return;
  }

  // ── Sonderlayout: Breakdown-Dimension (#panel-concentration-<KEY>) als KOMPAKTES
  // Dashboard-Blatt (wie das Live-Panel): Treemap links + Top-10-Balken rechts,
  // darunter KPI-Band (Key Figures) + optionale Top-Liste. Jede Grafik/Tabelle ist
  // EINZELN abwaehlbar -> es wird nur gezeichnet, was in enabledCharts/enabledTables steht.
  if (sec.key.startsWith('concentration-')) {
    const dimKey    = sec.key.slice('concentration-'.length);
    const enChartIds = new Set((sec.enabledCharts || []).map(c => c.id));
    const enTableIds = new Set((sec.enabledTables || []).map(t => t.id));

    const treemapId = `concTreemap__${dimKey}`;
    const barId     = `concTop10Chart__${dimKey}`;
    const kfId      = `concKeyFiguresTable__${dimKey}`;
    const topId     = `concTopIssuersTable__${dimKey}`;

    const showTree = enChartIds.has(treemapId);
    const showBar  = enChartIds.has(barId);

    doc.setFontSize(14); doc.setTextColor(0);
    doc.text(sectionTitle, marginX, y);
    y += cfg.sectionTitleSpacing;
    doc.setFontSize(9); doc.setTextColor(110);
    doc.text('Share of total portfolio by market value.', marginX, y);
    y += 6;

    const contentW = layout.contentWidth;
    const gap = 6;
    const chartsH = 78;

    const drawImg = (imgData, x, boxW, boxH) => {
      drawChartCard(doc, x, y, boxW, boxH);
      if (!imgData?.dataUrl) return;
      const srcW = imgData.width || 900;
      const srcH = imgData.height || 520;
      const scale = Math.min(boxW / srcW, (boxH - 2) / srcH, 1);
      const w = srcW * scale, h = srcH * scale;
      try { doc.addImage(imgData.dataUrl, imgData.fmt || 'JPEG', x + (boxW - w) / 2, y + (boxH - h) / 2, w, h); }
      catch (e) { console.warn('[PDF] breakdown image failed', e); }
    };

    // KPI-Band (Key Figures) IMMER oberhalb der Graphen (nur wenn ausgewaehlt).
    if (enTableIds.has(kfId)) {
      const kpis = kpisFromTableEl(ctx.getById(kfId));
      if (kpis.length) { ensurePageSpace(26); y = drawKpiBand(doc, { marginX, contentW, y }, kpis); }
    }

    if (showTree || showBar) {
      const both   = showTree && showBar;
      const leftW  = both ? contentW * 0.55 - gap / 2 : contentW;
      const rightW = both ? contentW * 0.45 - gap / 2 : contentW;
      const rightX = both ? marginX + leftW + gap : marginX;

      ensurePageSpace(chartsH + 24, `${sectionTitle} (cont.)`);
      doc.setFontSize(10); doc.setTextColor(0);
      if (showTree) doc.text('All entries', marginX, y);
      if (showBar)  doc.text('Top 10', both ? rightX : marginX, y);
      y += 3;

      if (showTree) {
        const el = ctx.getById(treemapId);
        const img = el ? (el.tagName === 'CANVAS' ? canvasToPngData(el) : await plotlyToPngData(el)) : null;
        drawImg(img, marginX, both ? leftW : contentW, chartsH);
      }
      if (showBar) {
        const el = ctx.getById(barId);
        const img = (el && el.tagName === 'CANVAS') ? canvasToPngData(el) : null;
        drawImg(img, both ? rightX : marginX, both ? rightW : contentW, chartsH);
      }
      y += chartsH + 10;
    }

    // Top-Liste (Tabelle) nur wenn ausgewaehlt.
    if (enTableIds.has(topId)) {
      const host = ctx.getById(topId);
      const tableElem = host && host.tagName && host.tagName.toLowerCase() === 'table'
        ? host : host?.querySelector?.('table');
      if (tableElem) {
        ensurePageSpace(40, `${sectionTitle} (cont.)`);
        safeAutoTable(doc, layout, {
          html: tableElem, startY: y + 2, theme: 'grid',
          styles: { fontSize: 8, cellPadding: 2 },
          headStyles: { fillColor: [245, 245, 245], textColor: [60, 60, 60] },
          alternateRowStyles: { fillColor: [255, 255, 255] },
          tableWidth: layout.contentWidth,
        });
        y = doc.lastAutoTable?.finalY ? doc.lastAutoTable.finalY + cfg.blockGap : y + 40;
      }
    }
    return;
  }

  // ── Sonderlayout: Yield-Dashboard (#panel-performance-dashboard) als KOMPAKTES
  // Ein-Seiten-Blatt: oben KPI-Band, darunter beide Charts nebeneinander, darunter
  // die zwei Listen-Tabellen nebeneinander. Jede Grafik/Tabelle bleibt einzeln abwaehlbar.
  if (sec.key === 'performance-dashboard') {
    const enChartIds = new Set((sec.enabledCharts || []).map(c => c.id));
    const enTableIds = new Set((sec.enabledTables || []).map(t => t.id));
    const contentW = layout.contentWidth;
    const gap = 6;

    // Alles auf eine Seite: EINMAL genug Platz fuer das ganze Blatt reservieren (bricht
    // ggf. vorher auf eine frische Seite um). Danach KEINE Zwischen-Umbrueche mehr, sonst
    // rutschen die Tabellen auf die naechste Seite obwohl Platz da ist.
    ensurePageSpace(140);

    doc.setFontSize(14); doc.setTextColor(0);
    doc.text(sectionTitle, marginX, y);
    y += cfg.sectionTitleSpacing;
    doc.setFontSize(9); doc.setTextColor(110);
    doc.text('Yield development and key yield drivers.', marginX, y);
    y += 6;

    // 1) KPI-Band oben (flacher als der Standard).
    if (enTableIds.has('perfKpiTable')) {
      const kpis = kpisFromTableEl(ctx.getById('perfKpiTable'));
      if (kpis.length) { y = drawKpiBand(doc, { marginX, contentW, y }, kpis); }
    }

    // 2) Beide Charts nebeneinander.
    const showRet = enChartIds.has('perfReturnChart');
    const showSc  = enChartIds.has('perfYieldScatter');
    const drawImg = (imgData, x, boxW, boxH) => {
      drawChartCard(doc, x, y, boxW, boxH);
      if (!imgData?.dataUrl) return;
      const srcW = imgData.width || 900, srcH = imgData.height || 520;
      const scale = Math.min(boxW / srcW, (boxH - 2) / srcH, 1);
      const w = srcW * scale, h = srcH * scale;
      try { doc.addImage(imgData.dataUrl, imgData.fmt || 'JPEG', x + (boxW - w) / 2, y + (boxH - h) / 2, w, h); }
      catch (e) { console.warn('[PDF] yield chart image failed', e); }
    };
    if (showRet || showSc) {
      const both   = showRet && showSc;
      const leftW  = both ? contentW / 2 - gap / 2 : contentW;
      const rightW = both ? contentW / 2 - gap / 2 : contentW;
      const rightX = both ? marginX + leftW + gap : marginX;
      const chartsH = 58;
      // Echten Grafik-Titel aus dem Live-DOM uebernehmen (.perf-card__title neben dem Canvas).
      const cardTitle = (id, fb) => {
        const el = ctx.getById(id);
        const t = el?.closest?.('.perf-card')?.querySelector?.('.perf-card__title')?.textContent?.trim();
        return t || fb;
      };
      doc.setFontSize(10); doc.setTextColor(0);
      if (showRet) doc.text(cardTitle('perfReturnChart', 'Yield development'), marginX, y);
      if (showSc)  doc.text(cardTitle('perfYieldScatter', 'Yield contribution'), both ? rightX : marginX, y);
      y += 3;
      if (showRet) { const el = ctx.getById('perfReturnChart');  drawImg(el ? canvasToPngData(el) : null, marginX, both ? leftW : contentW, chartsH); }
      if (showSc)  { const el = ctx.getById('perfYieldScatter'); drawImg(el ? canvasToPngData(el) : null, both ? rightX : marginX, both ? rightW : contentW, chartsH); }
      y += chartsH + 8;
    }

    // 3) Beide Listen-Tabellen nebeneinander (Top / Flop).
    const tblElem = (host) => (host && host.tagName && host.tagName.toLowerCase() === 'table')
      ? host : host?.querySelector?.('table');
    const topTbl  = enTableIds.has('perfTopTable')  ? tblElem(ctx.getById('perfTopTable'))  : null;
    const flopTbl = enTableIds.has('perfFlopTable') ? tblElem(ctx.getById('perfFlopTable')) : null;
    if (topTbl || flopTbl) {
      const both   = !!(topTbl && flopTbl);
      const halfW  = both ? contentW / 2 - gap / 2 : contentW;
      const rightX = both ? marginX + halfW + gap : marginX;
      // Kein Umbruch hier: der Reserve-Check oben stellt sicher, dass die Tabellen
      // auf dieselbe Seite wie die Charts passen.
      doc.setFontSize(10); doc.setTextColor(0);
      if (topTbl)  doc.text('Top yield contributors', marginX, y);
      if (flopTbl) doc.text('Largest yield detractors', both ? rightX : marginX, y);
      const tblStartY = y + 3;
      const tblOpts = {
        theme: 'grid', styles: { fontSize: 8, cellPadding: 2 }, pageBreak: 'avoid',
        headStyles: { fillColor: [245, 245, 245], textColor: [60, 60, 60] },
        alternateRowStyles: { fillColor: [255, 255, 255] },
      };
      let y1 = tblStartY, y2 = tblStartY;
      if (topTbl)  { safeAutoTable(doc, layout, { ...tblOpts, html: topTbl,  startY: tblStartY, tableWidth: both ? halfW : contentW, margin: { left: marginX } });          y1 = doc.lastAutoTable?.finalY || tblStartY; }
      if (flopTbl) { safeAutoTable(doc, layout, { ...tblOpts, html: flopTbl, startY: tblStartY, tableWidth: both ? halfW : contentW, margin: { left: both ? rightX : marginX } }); y2 = doc.lastAutoTable?.finalY || tblStartY; }
      y = Math.max(y1, y2) + cfg.blockGap;
    }
    return;
  }

  const chartsAll = sec.enabledCharts || [];
  const tablesAll = sec.enabledTables || [];

  // Normal sections
  doc.setFontSize(14);
  doc.setTextColor(0);
  doc.text(sectionTitle, marginX, y);
  y += cfg.sectionTitleSpacing;

  // KPI-Baender (data-kpi-band) IMMER oberhalb der Graphen zeichnen (Dashboard-Konvention).
  // Vorgezogen aus dem Tabellen-Loop; dort werden sie dann uebersprungen.
  for (const t of tablesAll) {
    const el = ctx.getById(t.id);
    if (!el || !el.dataset || !el.dataset.kpiBand) continue;
    const kpis = kpisFromTableEl(el);
    if (!kpis.length) continue;
    ensurePageSpace(32, `${sectionTitle} (cont.)`);
    doc.setFontSize(10); doc.setTextColor(0);
    doc.text(String(t.label || 'Key Figures'), marginX, y);
    y += 6;
    y = drawKpiBand(doc, { marginX, contentW: layout.contentWidth, y }, kpis);
    y += cfg.blockGap;
  }

  // ── Komponiertes Layout: Charts NEBENEINANDER in einer Zeile (Dashboard-Stil)
  //    fuer Structure + Market-Risk-Seiten; Tabellen laufen danach im Standard-
  //    Tabellen-Loop full-width darunter. Andere Sektionen bleiben linear. ──
  // Factors-Sektion: KPI-Karten (MVaR / ES MVaR mit IR/CS/Vega) wie im Dashboard,
  // ueber den Charts (die HTML-Karten werden sonst nicht erfasst).
  if (sec.key === 'mvar') {
    const km = (() => { try { return getFactorKpiModel(); } catch { return null; } })();
    if (km) {
      const gap = 6, cardW = (layout.contentWidth - gap) / 2, cardH = 30;
      ensurePageSpace(cardH + 8, `${sectionTitle} (cont.)`);
      const MUTED = [107, 120, 136], CARD = [247, 248, 250], BORDER = [226, 230, 236], TEXT = [26, 31, 41], SUB = [58, 65, 80];
      [['MVaR', km.var], ['ES MVaR', km.es]].forEach(([label, m], i) => {
        const x = marginX + i * (cardW + gap);
        doc.setDrawColor(...BORDER); doc.setFillColor(...CARD);
        doc.roundedRect(x, y, cardW, cardH, 2, 2, 'FD');
        doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...MUTED);
        doc.text(String(label).toUpperCase(), x + 6, y + 6.5);
        doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.setTextColor(...TEXT);
        doc.text(String(m.total), x + 6, y + 15);
        let ry = y + 21;
        (m.rows || []).forEach((rr) => {
          doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...MUTED);
          doc.text(String(rr.nm), x + 6, ry);
          doc.setTextColor(...SUB);
          doc.text(String(rr.v), x + cardW - 6, ry, { align: 'right' });
          ry += 4;
        });
      });
      y += cardH + 8;
    }
  }

  const COMPOSED_ROW_KEYS = new Set(['structure', 'market', 'credit', 'mvar', 'mvar-products', 'mvar-issuers', 'mvar-scenarios', 'sensitivities', 'hist-sensitivities']);
  const composedRow = COMPOSED_ROW_KEYS.has(sec.key) && (sec.enabledCharts || []).length > 0;
  if (composedRow) {
    // Credit-Tail-Driver-Charts NICHT in der Nebeneinander-Reihe (sie werden unten je
    // PD-Ansicht als Chart+Tabelle-Paar gezeichnet).
    const rowCharts = (sec.enabledCharts || []).filter(ch => !CR_DRIVER_CHART_IDS.has(ch.id));
    // Issuers/Products/Factors: 2 pro Reihe (Balken+Scatter je Metrik untereinander).
    const FORCE_TWO_PER_ROW = new Set(['mvar-issuers', 'mvar-products', 'mvar', 'credit', 'sensitivities', 'hist-sensitivities']);
    const perRow = FORCE_TWO_PER_ROW.has(sec.key) ? 2 : Math.min(rowCharts.length, 3);
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
      drawChartCard(doc, x, rowY, cellW, cellH + 8);
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
        try { doc.addImage(imgData.dataUrl, imgData.fmt || 'JPEG', ix, iy, w, h); } catch (e) { console.warn('[PDF] composed chart failed', ch.id, e); }
      }
      col++;
      if (col >= perRow) { col = 0; y = rowY + cellH + 16; }
    }
    if (col > 0) y = rowY + cellH + 16;
  }

  // ── Credit Top-Tail-Drivers: je PD-Ansicht Chart (links) + Tabelle (rechts) NEBENEINANDER,
  //    die zwei Ansichten (Historic / Market adjusted) untereinander. Chart traegt seinen
  //    Titel selbst -> keine zusaetzliche Karten-Beschriftung. Tabellen werden im spaeteren
  //    Tabellen-Loop uebersprungen (CR_DRIVER_TABLE_IDS). ──
  if (sec.key === 'credit') {
    const enC = new Set((sec.enabledCharts || []).map(c => c.id));
    const enT = new Set((sec.enabledTables || []).map(t => t.id));
    const gap = 6;
    for (const v of CR_DRIVER_VIEWS) {
      const showChart = enC.has(v.chartId);
      const host = ctx.getById(v.tableId);
      const tbl = enT.has(v.tableId) && host
        ? (host.tagName?.toLowerCase() === 'table' ? host : host.querySelector?.('table'))
        : null;
      if (!showChart && !tbl) continue;

      const both = showChart && tbl;
      const chartW = both ? layout.contentWidth * 0.54 - gap / 2 : layout.contentWidth;
      const tableX = marginX + chartW + gap;
      const tableW = both ? layout.contentWidth - chartW - gap : layout.contentWidth;
      const blockH = 60;
      ensurePageSpace(blockH + 12, `${sectionTitle} (cont.)`);
      const rowTop = y;

      if (showChart) {
        const el = ctx.getById(v.chartId);
        const img = el ? canvasToPngData(el) : null;
        drawChartCard(doc, marginX, rowTop, chartW, blockH + 8);
        if (img?.dataUrl) {
          const srcW = img.width || 900, srcH = img.height || 520;
          const availH = blockH - 2;
          const scale = Math.min(chartW / srcW, availH / srcH, 1);
          const w = srcW * scale, h = srcH * scale;
          try { doc.addImage(img.dataUrl, img.fmt || 'JPEG', marginX + (chartW - w) / 2, rowTop + 7 + (availH - h) / 2, w, h); }
          catch (e) { console.warn('[PDF] tail driver chart failed', v.chartId, e); }
        }
      }

      let bottom = rowTop + (showChart ? blockH + 8 : 0);
      if (tbl) {
        safeAutoTable(doc, layout, {
          html: tbl, startY: rowTop + 2, theme: 'grid',
          styles: { fontSize: 7.5, cellPadding: 1.5 },
          tableWidth: tableW, margin: { left: both ? tableX : marginX }, pageBreak: 'avoid',
        });
        bottom = Math.max(bottom, doc.lastAutoTable?.finalY || rowTop);
      }
      y = bottom + cfg.blockGap;
    }
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

    drawChartCard(doc, marginX - 2, boxY, chartWidth + 4, blockHeight - 4);

    doc.setFontSize(9);
    doc.setTextColor(0);
    doc.text(ch.label || ch.id, marginX + chartWidth / 2, labelY, { align: 'center' });

    try {
      doc.addImage(imgData.dataUrl, imgData.fmt || 'JPEG', imgX, imgY, targetWidth, targetHeight);
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
    // KPI-Baender (data-kpi-band) sind bereits oberhalb der Graphen gezeichnet -> hier
    // ueberspringen, damit sie nicht doppelt (und unter den Charts) erscheinen.
    const kpiEl = ctx.getById(t.id);
    if (kpiEl && kpiEl.dataset && kpiEl.dataset.kpiBand) continue;
    // Credit Tail-Driver-Tabellen sind bereits neben ihrem Chart gezeichnet -> ueberspringen.
    if (CR_DRIVER_TABLE_IDS.has(t.id)) continue;

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

