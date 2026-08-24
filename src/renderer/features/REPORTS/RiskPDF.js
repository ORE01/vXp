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
  headerGap: 6,

  footerHeight: 10,
  footerGap: 10,

  sectionTitleSpacing: 6,
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
  // "vXp | <Portfolio>" (weiss, fett), rechts der Zeitraum (heller Akzent).
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
// Canvas -> JPEG (weiss hinterlegt), modulweit — fuer Renderer ausserhalb von
// renderPanelSectionToPDF (z.B. Breakdown-Kompaktmodus).
function canvasToJpegModule(canvas) {
  if (!canvas) return null;
  try {
    let srcW = canvas.width;
    let srcH = canvas.height;
    if (!srcW || !srcH) {
      const rect = canvas.getBoundingClientRect();
      srcW = rect.width || 900;
      srcH = rect.height || 520;
    }
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

// Kompakt-Modus fuer Breakdown-Dimensionen (Treemap abgewaehlt): EINE Spalte je
// Dimension — Titel + Top-10-Balkenchart + kompakte Key Figures (Label links,
// Wert rechts). Drei Spalten teilen sich eine Seite; state = { col, top }.
function renderConcCompactColumn(doc, sec, layout, ctx, state) {
  const { left: marginX } = layout;
  const gap = 6;
  const colW = (layout.contentWidth - gap * 2) / 3;
  const col = state ? state.col : 0;
  const top = state ? state.top : Math.max(layout.startY(), layout.topSafe ?? 0);
  const x = marginX + col * (colW + gap);
  let y = top;

  const dimKey = String(sec.key).slice('concentration-'.length);
  const enTableIds = new Set((sec.enabledTables || []).map((t) => t.id));

  doc.setFontSize(12); doc.setTextColor(0);
  doc.text(String(sec.title || dimKey), x, y);
  y += 3;

  const el = ctx.getById(`concTop10Chart__${dimKey}`);
  const img = (el && el.tagName === 'CANVAS') ? canvasToJpegModule(el) : null;
  const chartH = 64;
  drawChartCard(doc, x, y, colW, chartH);
  if (img?.dataUrl) {
    const srcW = img.width || 900, srcH = img.height || 520;
    const scale = Math.min(colW / srcW, (chartH - 2) / srcH, 1);
    const w = srcW * scale, h = srcH * scale;
    try { doc.addImage(img.dataUrl, img.fmt || 'JPEG', x + (colW - w) / 2, y + (chartH - h) / 2, w, h); }
    catch (e) { console.warn('[PDF] compact breakdown chart failed', dimKey, e); }
  }
  y += chartH + 6;

  // Key Figures kompakt an die Spaltenbreite angepasst: je Zeile Label (muted,
  // links) + Wert (fett, rechtsbuendig).
  if (enTableIds.has(`concKeyFiguresTable__${dimKey}`)) {
    const kpis = kpisFromTableEl(ctx.getById(`concKeyFiguresTable__${dimKey}`));
    kpis.forEach((k) => {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(107, 120, 136);
      doc.text(String(k.label ?? '').toUpperCase(), x, y);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(26, 31, 41);
      doc.text(String(k.value ?? ''), x + colW, y, { align: 'right' });
      y += 5;
    });
    doc.setFont('helvetica', 'normal'); doc.setTextColor(0);
  }

  return { col: col + 1, top };
}

function drawKpiBand(doc, { marginX, contentW, y }, kpis, opts = {}) {
  if (!Array.isArray(kpis) || !kpis.length) return y;
  const n = kpis.length;
  const tileGap = 4;
  const tileW = (contentW - tileGap * (n - 1)) / n;
  // Einheitlicher KPI-Karten-Stil fuer ALLE Report-Sektionen: abgerundete Box mit Rahmen,
  // oben kleines GROSSGESCHRIEBENES muted Label, darunter fetter dunkler Wert (linksbuendig)
  // — analog zu den Risk-Limit/Buffer-Karten im Dashboard.
  const valFont = opts.valueFont || 13;
  const MUTED = [107, 120, 136], CARD = [247, 248, 250], BORDER = [226, 230, 236], TEXT = [26, 31, 41];
  // Systemweit 3-zeilig (Name / Wert / Sub-Wert) -> EINHEITLICHE Hoehe, auch wenn nur 2 Zeilen befuellt sind.
  const tileH = Math.max(opts.tileH || 0, 22);
  // Wert in zwei Zahlen trennen: "abs · rel" ODER "rel + EUR/USD abs" (z.B. Sensitivities "-1,02 bp" / "EUR -21.701").
  const splitVal = (v) => {
    const s = String(v ?? '').trim();
    if (s.includes('·')) return s.split('·').map((x) => x.trim()).filter(Boolean);
    const m = s.match(/^(.+?\S)\s*((?:EUR|USD)\s+-?[\d.,].*)$/);
    if (m && m[1].trim()) return [m[1].trim(), m[2].trim()];
    return s ? [s] : [];
  };
  kpis.forEach((k, idx) => {
    const x = marginX + idx * (tileW + tileGap);
    doc.setDrawColor(...BORDER); doc.setFillColor(...CARD);
    doc.roundedRect(x, y, tileW, tileH, 2, 2, 'FD');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(...MUTED);
    doc.text(String(k.label ?? '').toUpperCase(), x + 5, y + 5.5);
    const parts = splitVal(k.value);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(valFont); doc.setTextColor(...TEXT);
    doc.text(parts[0] || '', x + 5, y + 12);
    if (parts[1]) {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(Math.max(7, valFont - 3)); doc.setTextColor(...MUTED);
      doc.text(parts.slice(1).join(' · '), x + 5, y + 17.5);
    }
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

  // Kopfzeilen-Label wie VORLAGE: "vXp | <Portfolio>". Portfolio-Name aus dem
  // (Report-)Portfolio-Dropdown; Fallback = Report-Titel.
  let portName = '';
  try {
    const portSel = getById('createdPortDropdownReport') || getById('createdPortDropdown0');
    if (portSel && portSel.tagName === 'SELECT') {
      const opt = portSel.options?.[portSel.selectedIndex];
      portName = String(opt?.textContent || portSel.value || '').trim();
    }
  } catch {}
  const headerLabel = `vXp | ${portName || reportTitle}`;

  doc.setPage(1);
  drawCoverPage(doc, layout, { title: reportTitle, logoEl, reportTimeText });

  const includeTOC = !!opts.includeTOC;
  // TOC-Seiten werden weiter unten reserviert — erst wenn die Eintragsanzahl
  // (Anzahl der Sektionen) bekannt ist (Mehrseiten-TOC).

  let sections = getActiveRiskSectionsForPdf() || [];
  sections = applyPdfHierarchy(sections);

  // Interest Rates + Credit Spreads auf EINE Seite nebeneinander: den CS-Kurven-Chart
  // in die Rates-Sektion mergen (per Chart-ID, unabhaengig vom Section-Key) und die
  // eigenstaendige CS-Sektion entfernen. Das 2-up-Rendering uebernimmt composedRow (Flag).
  try {
    const _ratesSec = sections.find(s => (s.enabledCharts || []).some(c => c.id === 'IRLineChart'));
    const _csSec    = sections.find(s => (s.enabledCharts || []).some(c => c.id === 'CS_ChartCanvas'));
    if (_ratesSec && _csSec && _ratesSec !== _csSec) {
      _ratesSec.enabledCharts = [...(_ratesSec.enabledCharts || []), ...(_csSec.enabledCharts || [])];
      _ratesSec.__composed2 = true;
      // Sektion haengt bereits unter der Gruppe "MARKET DATA" -> Praefix weglassen,
      // sonst steht "Market Data" doppelt in TOC/Ueberschrift.
      _ratesSec.title = 'Interest Rates & Credit Spreads';
      sections = sections.filter(s => s !== _csSec);
    }
  } catch (e) { console.warn('[PDF] merge rates+spreads failed', e); }

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

  // Kompakt-Modus fuer Breakdown-Dimensionen: Treemap abgewaehlt und keine
  // Top-Liste -> nur Balkenchart (+ Key Figures). Solche Dimensionen teilen
  // sich zu dritt eine Seite (Spalten) statt je eine eigene Seite zu belegen.
  const concCompactQualifies = (s) => {
    const key = String(s?.key || '');
    if (!key.startsWith('concentration-')) return false;
    const dim = key.slice('concentration-'.length);
    const ch = new Set((s.enabledCharts || []).map((c) => c.id));
    const tb = new Set((s.enabledTables || []).map((t) => t.id));
    return ch.has(`concTop10Chart__${dim}`)
      && !ch.has(`concTreemap__${dim}`)
      && !tb.has(`concTopIssuersTable__${dim}`);
  };
  let concCompactState = null; // { col, top } der laufenden Kompakt-Seite
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
    // Voller Pfad (Root -> aktuelles Blatt) als laufender Kolumnentitel in der Kopfzeile,
    // z.B. "PORTFOLIO / PERFORMANCE / YIELD" statt nur "YIELD".
    const chapterPath = titleByLevel.slice(1, level + 1).filter(Boolean).join(' / ');
    const hasContent =
      // Breakdown-PARENT: reine Kapitel-Ueberschrift (die Inhalte tragen die
      // Dimensions-Kinder) -> keine eigene, fast leere Divider-Seite erzeugen.
      sec.key !== 'concentration' &&
      ((sec.enabledCharts && sec.enabledCharts.length) ||
       (sec.enabledTables && sec.enabledTables.length));

    // Gruppen-/Überschrift-Sektionen (ohne Inhalt): NUR ins Inhaltsverzeichnis,
    // keine eigene Seite. Die Seitenzahl folgt dem ersten Blatt darunter.
    if (!hasContent) {
      pendingGroupToc.push(tocEntries.length);
      addTOCEntry(sec.sectionNumber, title, null, level);
      continue;
    }

    const compact = concCompactQualifies(sec);
    const continuing = compact && concCompactState && concCompactState.col < 3;
    if (!compact) concCompactState = null;

    if (wroteAnySection && !continuing) doc.addPage();
    wroteAnySection = true;

    const pageIndex = doc.internal.getNumberOfPages();

    addTOCEntry(sec.sectionNumber, title, pageIndex, level);

    // ausstehende Gruppen-Überschriften auf diese (erste Inhalts-)Seite zeigen lassen
    pendingGroupToc.forEach((idx) => { if (tocEntries[idx]) tocEntries[idx].page = pageIndex; });
    pendingGroupToc.length = 0;

    if (compact) {
      concCompactState = renderConcCompactColumn(doc, sec, layout, ctx, continuing ? concCompactState : null);
    } else {
      await renderPanelSectionToPDF(doc, sec, layout, ctx);
    }

    // Alle von dieser Sektion belegten Seiten bekommen den vollen Pfad (Root -> Blatt)
    // als laufenden Kolumnentitel.
    const endPage = doc.internal.getNumberOfPages();
    for (let p = pageIndex; p <= endPage; p++) chapterByPage[p] = chapterPath || parentChapter;
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

  // Economic-Capital-KPI-Story (App-Panel): 4 Karten (EL / EC / VaR / ES) mit Konnektoren + Summary,
  // nativ nachgezeichnet (das App-Grid ist ein <div>-Grid, kein data-kpi-band).
  const drawEcStory = (panelId, y0) => {
    const panel = ctx.getById(panelId) || (ctx.appRoot || document).getElementById(panelId);
    if (!panel) return y0;
    const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();
    const items = Array.from(panel.querySelectorAll('.conc-kpi-grid .conc-kpi')).map((c) => ({
      val: clean((c.querySelector('.conc-kpi__val')?.childNodes?.[0]?.textContent) || c.querySelector('.conc-kpi__val')?.textContent),
      val2: clean(c.querySelector('.conc-kpi__val-2nd')?.textContent),
      sub: clean(c.querySelector('.conc-kpi__sub')?.textContent),
      lbl: clean(c.querySelector('.conc-kpi__lbl')?.textContent),
      conn: c.getAttribute('data-conn') || '',
    })).filter((it) => it.val && it.val !== '–' && it.val !== '—');
    if (!items.length) return y0;
    const contentW = layout.contentWidth;
    const MUTED = [107, 120, 136], CARD = [247, 248, 250], BORDER = [226, 230, 236], TEXT = [26, 31, 41];
    const sumLis = Array.from(panel.querySelectorAll('.cr-kpi-summary li')).map((li) => clean(li.textContent)).filter(Boolean);
    // Karten VOLL breit; die Summary kommt DARUNTER.
    const n = items.length, connW = 6, cardW = (contentW - connW * (n - 1)) / n, cardH = 24;
    ensurePageSpace(cardH + 4, `${sectionTitle} (cont.)`);
    let cx = marginX;
    items.forEach((it, i) => {
      doc.setDrawColor(...BORDER); doc.setFillColor(...CARD);
      doc.roundedRect(cx, y0, cardW, cardH, 2, 2, 'FD');
      // Bezeichnung OBEN (erste Zeile(n), Caption), darunter Haupt-Wert + Sub.
      doc.setFont('helvetica', 'normal'); doc.setFontSize(6); doc.setTextColor(...MUTED);
      const lbl = doc.splitTextToSize(it.lbl, cardW - 6).slice(0, 2);
      lbl.forEach((ln, j) => doc.text(ln, cx + 3, y0 + 4 + j * 3));
      const yVal = y0 + 4 + lbl.length * 3 + 3;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.setTextColor(...TEXT);
      doc.text(it.val, cx + 3, yVal);
      if (it.sub) { doc.setFont('helvetica', 'normal'); doc.setFontSize(6); doc.setTextColor(...MUTED); doc.text(doc.splitTextToSize(it.sub, cardW - 6)[0] || '', cx + 3, yVal + 4); }
      if (i < n - 1) {
        const cc = it.conn === '→' ? '>' : (it.conn || '');   // "→" ist nicht in WinAnsi -> ">"
        if (cc) { doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...MUTED); doc.text(cc, cx + cardW + connW / 2 - doc.getTextWidth(cc) / 2, y0 + cardH / 2 + 1.5); }
      }
      cx += cardW + connW;
    });
    // Executive Summary UNTER den Karten (voll breit, Bullet je Aussage).
    let ny = y0 + cardH + 5;
    sumLis.forEach((s) => {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...TEXT);
      const lines = doc.splitTextToSize(s, contentW - 6);
      ensurePageSpace(lines.length * 4 + 2, `${sectionTitle} (cont.)`);
      doc.setFillColor(150, 150, 150); doc.circle(marginX + 1.5, ny - 1.2, 0.7, 'F');
      lines.forEach((ln) => { doc.text(ln, marginX + 5, ny); ny += 4; });
      ny += 1.5;
    });
    return ny + 3;
  };

  // Frage-Ueberschrift eines EC-Charts/Tabelle (heller Titel = 1. <div> in .cr-tail-tile).
  const crQuestionFor = (id) => {
    const el = ctx.getById(id);
    const tile = el?.closest?.('.cr-tail-tile');
    const q = tile?.querySelector('div');
    return (q?.textContent || '').replace(/\s+/g, ' ').trim();
  };

  // Allgemeiner App-Chart-Titel (die "Frage"/Textbeschriftung aus der App) — ersetzt den
  // technischen Namen im PDF. Quellen: eingefuegtes <h3> in .chart-box (z.B. Yield vs Rates,
  // via insertHeadingIntoExistingChartBox) oder .conc-panel__title (z.B. Portfolio Value
  // History). "Key Figures" (KPI-Band) wird ignoriert. Leer -> Fallback auf ch.label/ch.id.
  const chartAppTitle = (id) => {
    const el = ctx.getById(id);
    if (!el) return '';
    const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();
    // .chart-box: eingefuegtes <h3> (Titel) + optionaler Untertitel-Div (z.B. "Maturity"/
    // "Duration") -> kombinieren, damit zwei Charts mit gleichem Titel unterscheidbar sind.
    const h = el.closest?.('.chart-box')?.querySelector('h3');
    if (h) {
      const title = clean(h.textContent);
      const sub = clean(h.nextElementSibling?.textContent);
      if (title) return sub ? `${title} — ${sub}` : title;
    }
    // Sensitivities-Charts: Titel der Chart-Karte (.sens-chart-card .sens-card-title).
    const st = clean(el.closest?.('.sens-chart-card')?.querySelector('.sens-card-title')?.textContent);
    if (st) return st;
    const pt = clean(el.closest?.('.conc-panel')?.querySelector('.conc-panel__title')?.textContent);
    if (pt && pt.toLowerCase() !== 'key figures') return pt;
    return '';
  };

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
      doc.text(`Warning ${lim.yellowPct.toLocaleString('de-DE', { maximumFractionDigits: 2 })}%`, marginX + barW / 2, sy, { align: 'center' });
      doc.text(`Limit ${lim.redPct.toLocaleString('de-DE', { maximumFractionDigits: 2 })}%`, marginX + barW, sy, { align: 'right' });

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
      const mGap = 6, mCardW = (contentW - mGap * (mN - 1)) / mN, mCardH = 33;
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
        // Voller Kennzahl-Name klein unter dem Wert (Value at Risk, ...).
        if (c.full) { doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(...MUTED); doc.text(String(c.full), tx, y + 18.5); }
        doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...SUB);
        if (c.abs) doc.text(String(c.abs), tx, y + (c.full ? 24 : 20));
        doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(...MUTED);
        if (c.desc) doc.text(String(c.desc), tx, y + (c.full ? 29.5 : 25));
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

    // ── CREDIT: je Kennzahl EINE Zeile — links die KPI-Karte, rechts Limitleiste
    //    + Risk-Limit-/Buffer-Kaestchen (wie das Live-Dashboard). Alle 4 Zeilen
    //    passen zusammen auf eine Seite. ──
    const rowGap = 3.5, rowH = 33;
    const cardW2 = contentW * 0.30;
    const limX = marginX + cardW2 + 6;
    const limW = contentW - cardW2 - 6;

    dcards.forEach((c) => {
      ensurePageSpace(rowH + rowGap, `${sectionTitle} (cont.)`);
      const rowTop = y;
      const tx = marginX + 5;

      // KPI-Karte links
      doc.setDrawColor(...BORDER); doc.setFillColor(...CARD);
      doc.roundedRect(marginX, rowTop, cardW2, rowH, 2, 2, 'FD');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(...MUTED);
      doc.text(String(c.label).toUpperCase(), tx, rowTop + 5.5);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(...TEXT);
      const relTxt = String(c.rel);
      doc.text(relTxt, tx, rowTop + 12.5);
      const a = ampRgb(c.state); doc.setFillColor(a[0], a[1], a[2]); doc.circle(tx + doc.getTextWidth(relTxt) + 3, rowTop + 11, 1.4, 'F');
      let cy = rowTop + 17;
      // Voller Kennzahl-Name klein unter dem Wert (Value at Risk, ...).
      if (c.full) { doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(...MUTED); doc.text(String(c.full), tx, cy); cy += 4.5; }
      if (Number.isFinite(c.dRel)) { doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...GOLD); doc.text(String(c.relDeltaStr), tx, cy); cy += 4.5; }
      if (c.abs) { doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...SUB); doc.text(String(c.abs), tx, cy); cy += 4.5; }
      if (Number.isFinite(c.dAbs)) { doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(...GOLD); doc.text(String(c.absDeltaStr), tx, cy); cy += 4.5; }

      // Limit-Block rechts (Leiste + Zonen + Risk-Limit/Buffer-Kaestchen)
      const lim = c.limit;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...TEXT);
      doc.text('Limit utilization', limX, rowTop + 5);
      if (lim) {
        const aL = ampRgb(lim.state);
        doc.setTextColor(aL[0], aL[1], aL[2]); doc.setFontSize(9);
        doc.text(String(lim.utilStr), limX + limW, rowTop + 5, { align: 'right' });

        const by = rowTop + 7.5, bh = 4.5;
        doc.setFillColor(...TRACK); doc.rect(limX, by, limW, bh, 'F');
        const yellowW = limW * (lim.yellowRatio / 100);
        doc.setFillColor(205, 227, 205); doc.rect(limX, by, yellowW, bh, 'F');
        doc.setFillColor(245, 233, 197); doc.rect(limX + yellowW, by, limW - yellowW, bh, 'F');
        doc.setFillColor(...NAVY); doc.rect(limX, by, limW * Math.min(1, lim.util), bh, 'F');

        const sy = by + bh + 3.2;
        doc.setFont('helvetica', 'normal'); doc.setFontSize(6); doc.setTextColor(...MUTED);
        doc.text('0%', limX, sy);
        doc.text(`Warning ${lim.yellowPct.toLocaleString('de-DE', { maximumFractionDigits: 2 })}%`, limX + limW / 2, sy, { align: 'center' });
        doc.text(`Limit ${lim.redPct.toLocaleString('de-DE', { maximumFractionDigits: 2 })}%`, limX + limW, sy, { align: 'right' });

        const ly = sy + 2.5, lcW = 52, lcGap = 5;
        const lcH = Math.max(12, rowH - (ly - rowTop) - 1);
        [
          { lbl: 'RISK LIMIT', val: String(lim.limitRelStr), sub: (lim.limitAbsStr || 'threshold') },
          { lbl: 'BUFFER', val: String(lim.bufferRelStr), sub: (lim.bufferAbsStr || 'remaining to limit') },
        ].forEach((lc, i) => {
          const bxx = limX + i * (lcW + lcGap);
          doc.setDrawColor(...BORDER); doc.setFillColor(...CARD);
          doc.roundedRect(bxx, ly, lcW, lcH, 2, 2, 'FD');
          doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5); doc.setTextColor(...MUTED);
          doc.text(lc.lbl, bxx + 4, ly + 4.5);
          doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...TEXT);
          doc.text(lc.val, bxx + 4, ly + 9.5);
          doc.setFont('helvetica', 'normal'); doc.setFontSize(5.5); doc.setTextColor(...MUTED);
          doc.text(lc.sub, bxx + 4, ly + 12.6);
        });
      } else {
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...MUTED);
        doc.text('No limit data.', limX, rowTop + 12);
      }

      y = rowTop + rowH + rowGap;
    });
    return;
  }

  // Breakdown-PARENT (#panel-concentration): reine Kapitel-Ueberschrift, wird im
  // Sektions-Loop uebersprungen (hasContent = false) -> keine Divider-Seite mehr.
  // Die 11 Dimensions-Kinder tragen die kompakten Dashboards.

  // ── Sonderlayout: Breakdown-Dimension (#panel-concentration-<KEY>) als KOMPAKTES
  // Dashboard-Blatt (wie das Live-Panel): Treemap links + Top-10-Balken rechts,
  // darunter KPI-Band (Key Figures) + optionale Top-Liste. Jede Grafik/Tabelle ist
  // EINZELN abwaehlbar -> es wird nur gezeichnet, was in enabledCharts/enabledTables steht.
  if (sec.key.startsWith('concentration-')) {
    const dimKey    = sec.key.slice('concentration-'.length);

    // Die drei Ratings (RATING -> RATING_PROD -> RATINGres) sollen zusammen auf EINER
    // Seite stehen. Vor der ersten Rating-Dimension einen Seitenumbruch erzwingen (sofern
    // nicht ohnehin Seitenanfang) -> General/Product/Resolved fuellen dieselbe Seite.
    if (dimKey === 'RATING' && y > layout.topSafe + 2) {
      y = layout.newPage(doc);
    }

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
      // "Top N" aus dem data-label des Canvas (Dimensionen mit <10 Auspraegungen).
      if (showBar) {
        const barTitle = (ctx.getById(barId)?.dataset?.label || 'Top 10').split(' — ')[0];
        doc.text(barTitle, both ? rightX : marginX, y);
      }
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
    const showRet = enChartIds.has('perfHistYieldChart');
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
      if (showRet) doc.text(cardTitle('perfHistYieldChart', 'Yield development'), marginX, y);
      if (showSc)  doc.text(cardTitle('perfYieldScatter', 'Yield contribution'), both ? rightX : marginX, y);
      y += 3;
      if (showRet) { const el = ctx.getById('perfHistYieldChart');  drawImg(el ? canvasToPngData(el) : null, marginX, both ? leftW : contentW, chartsH); }
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

  // ── Sonderlayout Liquidity: KPI-Band oben, dann Faelligkeiten-Chart LINKS +
  //    Pivot-Tabelle (Maturity x Category) RECHTS nebeneinander (statt gestapelt).
  //    Erkennung ueber den Chart, nicht den Section-Key.
  if ((sec.enabledCharts || []).some(c => c.id === 'liqDashMaturityChart')) {
    const enChartIds = new Set((sec.enabledCharts || []).map(c => c.id));
    const enTableIds = new Set((sec.enabledTables || []).map(t => t.id));
    const contentW = layout.contentWidth;
    const gap = 6;
    ensurePageSpace(120);

    doc.setFontSize(14); doc.setTextColor(0);
    doc.text(sectionTitle, marginX, y);
    y += cfg.sectionTitleSpacing;

    // KPI-Band (liqDashKpiTable)
    for (const t of (sec.enabledTables || [])) {
      const el = ctx.getById(t.id);
      if (!el || !el.dataset || !el.dataset.kpiBand) continue;
      const kpis = kpisFromTableEl(el);
      if (kpis.length) y = drawKpiBand(doc, { marginX, contentW, y }, kpis);
      break;
    }

    const chartEl = enChartIds.has('liqDashMaturityChart') ? ctx.getById('liqDashMaturityChart') : null;
    const tblHost = ctx.getById('liqDashCategoryPivotTable');
    const tblEl = (tblHost && tblHost.tagName && tblHost.tagName.toLowerCase() === 'table')
      ? tblHost : tblHost?.querySelector?.('table');
    const both   = !!(chartEl && tblEl);
    const leftW  = both ? contentW / 2 - gap / 2 : contentW;
    const rightX = both ? marginX + leftW + gap : marginX;
    const chartH = 88;
    const rowY = y;

    if (chartEl) {
      doc.setFontSize(10); doc.setTextColor(0);
      doc.text('Maturities', marginX, rowY);
      drawChartCard(doc, marginX, rowY + 3, both ? leftW : contentW, chartH);
      const img = canvasToPngData(chartEl);
      if (img?.dataUrl) {
        const boxW = both ? leftW : contentW;
        const srcW = img.width || 900, srcH = img.height || 520;
        const scale = Math.min(boxW / srcW, (chartH - 2) / srcH, 1);
        const w = srcW * scale, h = srcH * scale;
        try { doc.addImage(img.dataUrl, img.fmt || 'JPEG', marginX + (boxW - w) / 2, rowY + 3 + (chartH - h) / 2, w, h); }
        catch (e) { console.warn('[PDF] liquidity chart failed', e); }
      }
    }

    let yBottom = rowY + 3 + chartH;
    if (tblEl) {
      doc.setFontSize(10); doc.setTextColor(0);
      doc.text('Maturity — Category', both ? rightX : marginX, rowY);
      safeAutoTable(doc, layout, {
        theme: 'grid', styles: { fontSize: 7.5, cellPadding: 1.6 }, pageBreak: 'avoid',
        headStyles: { fillColor: [245, 245, 245], textColor: [60, 60, 60] },
        alternateRowStyles: { fillColor: [255, 255, 255] },
        html: tblEl, startY: rowY + 3,
        tableWidth: both ? leftW : contentW, margin: { left: both ? rightX : marginX },
      });
      yBottom = Math.max(yBottom, doc.lastAutoTable?.finalY || yBottom);
    }
    y = yBottom + cfg.blockGap;
    return;
  }

  const chartsAll = sec.enabledCharts || [];
  const tablesAll = sec.enabledTables || [];

  // Normal sections
  // Overview NICHT straffen -> die urspruenglichen Abstaende kompensieren (headerGap 12->6, sectionTitleSpacing 10->6).
  if (sec.key === 'overview') y += 6;
  doc.setFontSize(14);
  doc.setTextColor(0);
  doc.text(sectionTitle, marginX, y);
  y += cfg.sectionTitleSpacing;
  if (sec.key === 'overview') y += 4;

  // Economic-Capital-KPI-Story (App-Panel) VOR den Charts, wenn die Sektion EC-Charts hat.
  // Historic (…Hist) -> panel-credit; market adjusted (…Norm) -> panel-credit-current.
  let ecPanelId = null;
  {
    const enIds = (sec.enabledCharts || []).map((c) => c.id);
    if (enIds.some((id) => /Hist$/.test(id) && /crTail|crLossDist/.test(id))) ecPanelId = 'panel-credit';
    else if (enIds.some((id) => /Norm$/.test(id) && /crTail|crLossDist/.test(id))) ecPanelId = 'panel-credit-current';
    if (ecPanelId) y = drawEcStory(ecPanelId, y);
  }

  // KPI-Baender (data-kpi-band) IMMER oberhalb der Graphen zeichnen (Dashboard-Konvention).
  // Vorgezogen aus dem Tabellen-Loop; dort werden sie dann uebersprungen.
  // Kompakt (flachere Kacheln, kleinere Abstaende), wenn die Sektion auch Charts hat —
  // dann passen KPI-Baender UND die Chart-Reihe zusammen auf EINE Seite.
  const bandCompact = (sec.enabledCharts || []).length > 0;
  for (const t of tablesAll) {
    const el = ctx.getById(t.id);
    if (!el || !el.dataset || !el.dataset.kpiBand) continue;
    if (ecPanelId) continue;   // EC-Story ersetzt JEDES KPI-Band in dieser Sektion (altes VaR/ES/TSI/MSD-Band raus)
    const kpis = kpisFromTableEl(el);
    if (!kpis.length) continue;
    ensurePageSpace(bandCompact ? 30 : 34, `${sectionTitle} (cont.)`);
    // "Key Figures"-Ueberschrift entfernt -> das Band rueckt direkt unter den Sektionstitel.
    y = drawKpiBand(doc, { marginX, contentW: layout.contentWidth, y }, kpis,
      bandCompact ? { tileH: 14, valueFont: 11, gapAfter: 4 } : {});
    y += bandCompact ? 4 : cfg.blockGap;
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

  // ── Sonderlayout: HOME-Overview als KPI-Karten wie in der App (3 Karten
  //    nebeneinander: Portfolio / Market Risk / Credit Risk), nativ als Vektor.
  //    Werte/Ampeln kommen aus den gerenderten HOME-Elementen (Prep ruft
  //    renderHomeOverview). Die Charts folgen darunter als composedRow; die
  //    gespiegelte KPI-Tabelle (overviewKpiTable) wird im Tabellen-Loop uebersprungen.
  if (sec.key === 'overview') {
    const otxt = (id) => (ctx.getById(id)?.textContent || '').trim() || '–';
    const odot = (id) => {
      const el = ctx.getById(id);
      if (!el || el.hidden) return null;
      for (const s of ['green', 'yellow', 'red']) if (el.classList?.contains(`mr-amp--${s}`)) return s;
      return null;
    };
    const MUTED = [107, 120, 136], CARD = [247, 248, 250], BORDER = [226, 230, 236],
          TEXT = [26, 31, 41], BOX = [240, 242, 246];
    const ampRgb = (s) => ({ green: [76, 175, 80], yellow: [224, 176, 0], red: [211, 47, 47] }[s] || [154, 167, 180]);
    const portSuffix = otxt('homePfPort') !== '–' ? ` ${otxt('homePfPort')}` : '';

    // KPI-Kacheln direkt aus dem App-DOM lesen -> Report zeigt EXAKT die im Customer
    // Setup angehakten (sichtbaren) Tiles, genau wie die App-Overview (Ampel-Dot,
    // Sub-/Relativwert und Label werden aus der jeweiligen Kachel uebernommen).
    const tTxt = (el, sel) => (el?.querySelector(sel)?.textContent || '').trim();
    const tDot = (el) => {
      const d = el?.querySelector('.mr-amp-dot');
      if (!d || d.hidden) return null;
      for (const s of ['green', 'yellow', 'red']) if (d.classList?.contains(`mr-amp--${s}`)) return s;
      return null;
    };
    const pctStyle = (el, prop) => { const n = parseFloat(el?.style?.[prop] || ''); return Number.isFinite(n) ? n : null; };
    const richText = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim();
    const cardFrom = (title, anchorId) => {
      const card = ctx.getById(anchorId)?.closest('.home-card');
      const boxes = [];
      // Alle sichtbaren Overview-Kacheln in DOM-Reihenfolge (Standard + Sonderformen).
      card?.querySelectorAll('[data-tile]').forEach((t) => {
        if (t.style.display === 'none') return;            // im Customer Setup abgewaehlt -> ausgeblendet
        // Executive-Summary-Liste -> voll-breite Bullet-Zeilen.
        const execList = t.querySelector('.mkt-exec-list');
        if (execList) {
          const lines = Array.from(execList.querySelectorAll('li'))
            .filter((li) => li.style.display !== 'none')
            .map((li) => richText(li)).filter((s) => s && s !== '–');
          if (lines.length) boxes.push({ type: 'exec', cap: richText(t.querySelector('.home-kpi-cap')) || 'EXECUTIVE SUMMARY', lines });
          return;
        }
        // Zusammengefasste Current/Stressed-Kachel (Balken statt KPI-Val) -> eigenes Box-Format.
        const grpRows = t.querySelectorAll('.mkt-grp-row');
        if (grpRows.length) {
          const rows = [];
          grpRows.forEach((r) => {
            const track = r.querySelector('.mkt-grp-track');
            rows.push({
              lbl: tTxt(r, '.mkt-grp-lbl'),
              val: (r.querySelector('.mkt-grp-val')?.textContent || '').replace(/\s+/g, ' ').trim() || '–',
              greenPct: pctStyle(track?.querySelector('.mkt-grp-zone--green'), 'width'),
              markerPct: pctStyle(track?.querySelector('.mkt-grp-marker'), 'left'),
            });
          });
          boxes.push({ type: 'group', cap: tTxt(t, '.home-kpi-cap'), dist: tTxt(t, '.mkt-grp-dist'), rows, wide: true });
          return;
        }
        // Risk-Buffer-Zusammenfassung (EL -> EC -> VaR), 3 Spalten mit Name/abs/rel.
        if (t.classList.contains('cr-ec-summary')) {
          const cols = Array.from(t.querySelectorAll('.cr-ec-sum-col')).map((cx) => ({
            name: richText(cx.querySelector('.cr-ec3-name')),
            abs: richText(cx.querySelector('.cr-ec3-abs')),
            rel: richText(cx.querySelector('.cr-ec3-rel')),
          }));
          const pdConf = richText(t.querySelector('.cr-ec-sum-pd-conf'));
          const pdFull = richText(t.querySelector('.cr-ec-sum-pd'));
          const pdTitle = (pdConf && pdFull.endsWith(pdConf)) ? pdFull.slice(0, pdFull.length - pdConf.length).trim() : pdFull;
          if (cols.length) boxes.push({ type: 'ecsum', cap: richText(t.querySelector('.cr-ec-sum-title')) || 'Risk Buffer', cols, arrows: true, specTop: pdTitle, specConf: pdConf });
          return;
        }
        // EC-Detailkachel (Name / abs / rel) -> Standard-Box (Wert = abs, Sub = rel, Label = Name).
        if (t.classList.contains('cr-ec3-tile')) {
          boxes.push({ v: richText(t.querySelector('.cr-ec3-abs')) || '–', sub: richText(t.querySelector('.cr-ec3-rel')) || undefined, lbl: richText(t.querySelector('.cr-ec3-name')) });
          return;
        }
        // Concentration / EXTREME RISK -> Status als voll-breite Box.
        // cr_tsi / cr_msd sind ebenfalls .rs-card--conc, werden aber UNTEN als Slider gezeichnet -> hier auslassen.
        if (t.classList.contains('rs-card--conc')) {
          const key = t.getAttribute('data-tile') || '';
          if (key === 'cr_tsi' || key === 'cr_msd') return;
          boxes.push({
            type: 'conc',
            title: richText(t.querySelector('.rs-title')) || 'EXTREME RISK',
            right: richText(t.querySelector('.rs-title-right')),
            status: richText(t.querySelector('.conc-tcm-sub')),
            markerPct: pctStyle(t.querySelector('.conc-tcm-marker'), 'left'),
            pill: richText(t.querySelector('.conc-tcm-pill')),
            scale: Array.from(t.querySelectorAll('.conc-tcm-scale span')).map((s) => richText(s)).filter(Boolean),
          });
          return;
        }
        // Market NORMAL/EXTREME RISK Scale-Kachel -> Caption + Current/Stressed-Werte.
        if (t.classList.contains('mkt-scale-tile')) {
          const vals = Array.from(t.querySelectorAll('.mkt-scale-vals > span')).map((sp) => ({
            name: richText(sp.querySelector('.mkt-scale-vn')),
            val: richText(sp.querySelector('.mkt-scale-vp')),
            abs: richText(sp.querySelector('.mkt-scale-vs')),
            inc: richText(sp.querySelector('.mkt-scale-vinc')),
          })).filter((v) => v.val || v.name);
          const track = t.querySelector('.mkt-scale-track');
          const greenPct = pctStyle(track?.querySelector('.mkt-grp-zone--green'), 'width');
          const ticks = Array.from(track?.querySelectorAll('.mkt-scale-tick') || []).map((m) => pctStyle(m, 'left')).filter((v) => v != null);
          const limits = Array.from(t.querySelectorAll('.mkt-scale-limits span')).map((s) => richText(s)).filter(Boolean);
          boxes.push({ type: 'scale', cap: richText(t.querySelector('.home-kpi-cap')) || 'RISK', spec: richText(t.querySelector('.mkt-scale-spec')), vals, greenPct, ticks, limits });
          return;
        }
        // Coupon-Type-Kachel -> 3 Spalten (FIX / FLOAT / STRUCTURED) im ecsum-Format.
        if (t.classList.contains('pf-cpn-tile')) {
          const cols = Array.from(t.querySelectorAll('.pf-cpn-cell')).map((cx) => ({
            name: richText(cx.querySelector('.pf-cpn-lbl')),
            abs: richText(cx.querySelector('.pf-cpn-val')),
            rel: '',
          }));
          if (cols.length) boxes.push({ type: 'ecsum', cap: richText(t.querySelector('.pf-dur-cap')) || 'Coupon Type', cols });
          return;
        }
        // Interest-Rate-Duration-Split-Kachel -> voll-breite Box mit Split-Balken (not valued | valued).
        if (t.classList.contains('pf-dur-split-tile')) {
          boxes.push({
            type: 'irdur',
            cap: richText(t.querySelector('.pf-dur-cap')) || 'Interest Rate Duration',
            avg: richText(t.querySelector('.pf-dur-splitavg-c')) || richText(t.querySelector('.pf-dur-splitavg')),
            nvLbl: richText(t.querySelector('.pf-dur-splitlbl-nv')),
            vLbl: richText(t.querySelector('.pf-dur-splitlbl-v')),
            nvPct: pctStyle(t.querySelector('.pf-dur-seg--nv'), 'width'),
            vPct: pctStyle(t.querySelector('.pf-dur-seg--v'), 'width'),
            nvPctTxt: richText(t.querySelector('.pf-dur-splitpcts span:first-child')),
            vPctTxt: richText(t.querySelector('.pf-dur-splitpcts span:last-child')),
          });
          return;
        }
        // Standard-KPI-Kachel: nur wenn echter .home-kpi-val vorhanden (sonst Sonderkachel -> skip, kein '–').
        const valEl = t.querySelector('.home-kpi-val');
        if (valEl) {
          // Swap wie in der App: bei .home-tile-swap ist der RELATIVE Wert (.home-kpi-abs) gross.
          const swap = t.classList.contains('home-tile-swap');
          const valTxt = richText(valEl) || '';
          const absTxt = tTxt(t, '.home-kpi-abs') || '';
          // Veraenderung aus dem Trend-Span (data-Attribute). Richtung -> Kreis+Pfeil (kein +/-).
          const trend = t.querySelector('.home-kpi-trend');
          const hasChg = !!(trend && !trend.hidden && trend.dataset && trend.dataset.chgAbs);
          boxes.push({
            v: (swap ? absTxt : valTxt) || '–',
            lbl: tTxt(t, '.home-kpi-lbl'),
            sub: (swap ? valTxt : absTxt) || undefined,   // Sekundaerwert (nur ohne Aenderung gezeigt)
            chgAbs: hasChg ? trend.dataset.chgAbs : undefined,
            chgRel: hasChg ? trend.dataset.chgRel : undefined,
            chgUp:  hasChg ? (trend.dataset.chgUp === '1') : undefined,
            dot: tDot(t),
          });
        }
      });
      return { title, boxes };
    };
    const ovCards = [
      cardFrom(`PORTFOLIO${portSuffix}`, 'homePfNotional'),
      cardFrom(`MARKET RISK${portSuffix}`, 'homeMktVar'),
      cardFrom(`CREDIT RISK${portSuffix}`, 'homeCrVar'),
    ];

    const ovGap = 6, ovCardW = (layout.contentWidth - ovGap * 2) / 3, ovBoxH = 13;
    const GRP_H = 22; // Hoehe einer Grouped-Tile-Box (Caption + Distanz + 2 Balkenzeilen, groessere Schrift).
    const innerW = ovCardW;   // volle Spaltenbreite -> Kacheln fluchten mit den Balkengraphen darunter
    // Exec-/EC-Summary-Boxen sind voll breit; Zeilen umbrechen + Boxhoehe vorberechnen.
    const EXEC_FS = 6, EXEC_LH = 3.0;
    ovCards.forEach((c) => (c.boxes || []).forEach((b) => {
      if (b.type === 'exec') {
        b.wide = true;
        doc.setFont('helvetica', 'normal'); doc.setFontSize(EXEC_FS);
        // Pro Aussage separat umbrechen (Platz fuer Bullet + Einrueckung) -> Bullet je Aussage.
        b._perLine = (b.lines || []).map((ln) => doc.splitTextToSize(String(ln), innerW - 7));
        const total = b._perLine.reduce((a, w) => a + w.length, 0);
        b._h = 5 + total * EXEC_LH + 1.5;   // Caption + gewrappte Zeilen
      } else if (b.type === 'ecsum') {
        b.wide = true;
        b._h = b.arrows ? 27 : 16;   // Risk Buffer (arrows) so gross wie die Market NORMAL-RISK-Kachel
      } else if (b.type === 'scale') {
        b.wide = true;
        b._h = 27;   // Caption + gerahmte Wert-Boxen + Zonen-Balken + Limit-Labels
      } else if (b.type === 'conc') {
        b.wide = true;
        b._h = 27;   // gleiche Panel-Groesse wie Normal Risk / Market-Scale-Kacheln
      } else if (b.type === 'irdur') {
        b.wide = true;
        b._h = 20;   // Caption + Labels + Split-Balken + Prozente + zentrierte Ø-Zeile
      }
    }));
    const boxHeightOf = (b) => (b.type === 'group') ? GRP_H : (b._h != null ? b._h : ovBoxH);
    // Inhaltshoehe je Karte: normale Boxen 2 je Reihe (ovBoxH), Wide-Boxen (Group/Exec/EC-Sum) voll breit.
    const contentHeight = (boxes) => {
      let h = 0, col = 0;
      (boxes || []).forEach((b) => {
        const isWide = b.wide || b.type === 'group';
        if (isWide) { if (col > 0) col = 0; h += boxHeightOf(b) + 3; }
        else if (col === 0) { h += ovBoxH + 3; col = 1; } else { col = 0; }
      });
      return Math.max(ovBoxH + 3, h);
    };
    const ovCardH = 11 + Math.max(...ovCards.map(c => contentHeight(c.boxes)));
    // Grouped-Tile (Current/Stressed Market): Caption + Distanz + 2 Balkenzeilen (Zonen + Marker).
    const drawGroup = (bx, byy, w, b) => {
      // Look wie die Duration-Bloecke: groessere Schrift + abgerundete Balken. Die Zonen-Farben
      // (gruen/amber) bleiben, weil sie die Limit-Grenzen darstellen; Marker = aktueller Wert.
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...TEXT);
      doc.text(String(b.cap || ''), bx, byy + 3);
      if (b.dist) {
        doc.setFont('helvetica', 'normal'); doc.setFontSize(6); doc.setTextColor(...MUTED);
        doc.text(String(b.dist), bx, byy + 7);
      }
      const lblW = 17, valW = 22, gap = 2;
      const trackX = bx + lblW, trackW = Math.max(6, w - lblW - valW - gap);
      const ZG = [47, 158, 91], ZA = [224, 165, 51];
      (b.rows || []).forEach((r, i) => {
        const ry = byy + 9 + i * 7, th = 2.4, rad = 1.1;
        doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(...MUTED);
        doc.text(String(r.lbl || ''), bx, ry + 2.6);
        // Zonen-Balken: runde AUSSEN-Ecken, aber buendiger Farb-Uebergang (keine Einschnuerung).
        const gp = (r.greenPct != null) ? Math.max(0, Math.min(100, r.greenPct)) : 60;
        const gW = trackW * gp / 100;
        if (gW <= 0.2) {
          doc.setFillColor(...ZA); doc.roundedRect(trackX, ry, trackW, th, rad, rad, 'F');
        } else if (gW >= trackW - 0.2) {
          doc.setFillColor(...ZG); doc.roundedRect(trackX, ry, trackW, th, rad, rad, 'F');
        } else {
          doc.setFillColor(...ZG); doc.roundedRect(trackX, ry, trackW, th, rad, rad, 'F');            // Basis gruen (runde Enden)
          doc.setFillColor(...ZA); doc.roundedRect(trackX + gW, ry, trackW - gW, th, rad, rad, 'F');   // amber rechts (rundes rechtes Ende)
          doc.rect(trackX + gW, ry, Math.min(rad + 0.6, trackW - gW), th, 'F');                        // Uebergang eckig auffuellen -> buendig
        }
        if (r.markerPct != null) {
          const mx = trackX + trackW * Math.max(0, Math.min(100, r.markerPct)) / 100;
          doc.setDrawColor(40, 40, 40); doc.setLineWidth(0.6); doc.line(mx, ry - 1, mx, ry + th + 1);
        }
        doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5); doc.setTextColor(...TEXT);
        const vt = String(r.val || '–');
        doc.text(vt, bx + w - doc.getTextWidth(vt), ry + 2.6);
      });
    };
    // --- "EUR" kleiner/muted (wie in der App) + Trend-Kreis mit 45°-Pfeil (statt +/-) ---
    const UP_COL = [47, 158, 91], DOWN_COL = [217, 83, 79];
    const eurTextWidth = (str) => {
      const s = String(str); const i = s.indexOf('EUR');
      if (i < 0) return doc.getTextWidth(s);
      const size = doc.getFontSize();
      const rest = doc.getTextWidth(s.slice(0, i)) + doc.getTextWidth(s.slice(i + 3));
      doc.setFontSize(size * 0.62); const we = doc.getTextWidth('EUR'); doc.setFontSize(size);
      return rest + we;
    };
    const drawEurText = (str, x, y, baseColor) => {
      const s = String(str); const i = s.indexOf('EUR');
      doc.setTextColor(...baseColor);
      if (i < 0) { doc.text(s, x, y); return doc.getTextWidth(s); }
      const size = doc.getFontSize(); let cx = x;
      const before = s.slice(0, i), after = s.slice(i + 3);
      if (before) { doc.text(before, cx, y); cx += doc.getTextWidth(before); }
      doc.setFontSize(size * 0.62); doc.setTextColor(...MUTED);
      doc.text('EUR', cx, y); cx += doc.getTextWidth('EUR');
      doc.setFontSize(size); doc.setTextColor(...baseColor);
      if (after) { doc.text(after, cx, y); cx += doc.getTextWidth(after); }
      return cx - x;
    };
    const drawTrendCircle = (cx, cy, up) => {
      const col = up ? UP_COL : DOWN_COL, r = 1.4, a = r * 0.6;
      doc.setDrawColor(...col); doc.setLineWidth(0.25); doc.circle(cx, cy, r, 'S');
      const tipx = cx + a, tipy = up ? cy - a : cy + a, tailx = cx - a, taily = up ? cy + a : cy - a;
      doc.setLineWidth(0.3); doc.line(tailx, taily, tipx, tipy);
      const hl = 0.65;
      doc.line(tipx, tipy, tipx - hl, tipy);
      doc.line(tipx, tipy, tipx, up ? tipy + hl : tipy - hl);
    };
    ensurePageSpace(ovCardH + 8, `${sectionTitle} (cont.)`);
    ovCards.forEach((c, i) => {
      const x = marginX + i * (ovCardW + ovGap), tx = x;   // kein Inset -> Kacheln fluchten mit den Charts
      // Kein grosser Karten-Rahmen mehr (einheitlich wie Market Risk) — die einzelnen Kacheln/
      // Balken tragen ihre eigenen kleinen Rahmen.
      doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5);
      doc.setTextColor(...TEXT);
      doc.text(String(c.title), tx, y + 7);

      // Kein Hero mehr — alle Kennzahlen als Boxen direkt unter dem Titel.
      const halfW = (innerW - 3) / 2;
      let byy = y + 11, col = 0;
      (c.boxes || []).forEach((b) => {
        const isWide = b.wide || b.type === 'group';
        if (isWide && col > 0) { col = 0; byy += ovBoxH + 3; }
        const w = isWide ? innerW : halfW;
        const bx = tx + (isWide ? 0 : col * (halfW + 3));
        if (b.type === 'group') { drawGroup(bx, byy, w, b); byy += GRP_H + 3; col = 0; return; }
        // Executive Summary: Box, Caption + gewrappte Zeilen. Status-Woerter farbig; Mockup-Punkt oben rechts.
        if (b.type === 'exec') {
          const bh = boxHeightOf(b);
          doc.setDrawColor(...BORDER); doc.setFillColor(...BOX);
          doc.roundedRect(bx, byy, w, bh, 1.5, 1.5, 'FD');
          doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5); doc.setTextColor(...MUTED);
          doc.text(String(b.cap || 'EXECUTIVE SUMMARY'), bx + 3, byy + 4);
          // Mockup-Punkt rechts oben in der Ecke.
          doc.setFillColor(150, 150, 150); doc.circle(bx + w - 3.5, byy + 3, 1.3, 'F');
          // Zeilen; Status-Woerter hervorheben (LOW gruen / MODERATE-ELEVATED amber / HIGH rot).
          doc.setFontSize(EXEC_FS);
          const STATUS_COL = { LOW: [47, 158, 91], MODERATE: [224, 165, 51], ELEVATED: [224, 165, 51], HIGH: [217, 83, 79] };
          const textX = bx + 6;   // Text nach dem grauen Bullet
          let li = 0;
          (b._perLine || []).forEach((wrapLines) => {
            wrapLines.forEach((ln, j) => {
              const ly = byy + 8 + li * EXEC_LH;
              // Grauer Punkt vor der ERSTEN Zeile jeder Aussage.
              if (j === 0) { doc.setFillColor(150, 150, 150); doc.circle(bx + 3, ly - 1, 0.7, 'F'); }
              const re = /\b(LOW|MODERATE|ELEVATED|HIGH)\b/g;
              let last = 0, cx = textX, m; const segs = [];
              while ((m = re.exec(ln)) !== null) {
                if (m.index > last) segs.push({ t: ln.slice(last, m.index), c: null });
                segs.push({ t: m[0], c: STATUS_COL[m[0]] });
                last = m.index + m[0].length;
              }
              if (last < ln.length) segs.push({ t: ln.slice(last), c: null });
              if (!segs.length) segs.push({ t: ln, c: null });
              segs.forEach((s) => {
                if (s.c) { doc.setFont('helvetica', 'bold'); doc.setTextColor(s.c[0], s.c[1], s.c[2]); doc.text(s.t, cx, ly); cx += doc.getTextWidth(s.t); }
                else { doc.setFont('helvetica', 'normal'); cx += drawEurText(s.t, cx, ly, TEXT); }  // "EUR" kleiner/muted
              });
              li++;
            });
          });
          byy += bh + 3; col = 0; return;
        }
        // Risk-Buffer (arrows): jede Zahl in EIGENEM Rahmen, Pfeile beruehren die Rahmen.
        // Coupon Type (kein arrows): schlichte 3 Spalten in einer Box.
        if (b.type === 'ecsum') {
          const bh = boxHeightOf(b);
          const nc = (b.cols || []).length || 1;
          if (b.arrows) {
            // Aussenrahmen wie die Market NORMAL-RISK-Kachel (gleiche Groesse/Optik).
            doc.setDrawColor(...BORDER); doc.setFillColor(...BOX);
            doc.roundedRect(bx, byy, w, bh, 1.5, 1.5, 'FD');
            if (b.cap) { doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5); doc.setTextColor(...MUTED); doc.text(String(b.cap).toUpperCase(), bx + 3, byy + 4); }
            // Spec oben rechts: Historic-PD-Titel + VaR-Konfidenz (wie die Market-Scale-Spec).
            if (b.specTop) { doc.setFont('helvetica', 'normal'); doc.setFontSize(4.8); doc.setTextColor(...MUTED); const s = String(b.specTop); doc.text(s, bx + w - 3 - doc.getTextWidth(s), byy + 4); }
            if (b.specConf) { doc.setFont('helvetica', 'normal'); doc.setFontSize(4.8); doc.setTextColor(...MUTED); const s = String(b.specConf); doc.text(s, bx + w - 3 - doc.getTextWidth(s), byy + 7.3); }
            const gap = 5, pad = 4, bw = (w - pad * 2 - gap * (nc - 1)) / nc;
            const boxH = 13, boxY = byy + 10;
            (b.cols || []).forEach((cc, i) => {
              const bxx = bx + pad + i * (bw + gap), midX = bxx + bw / 2;
              doc.setDrawColor(...BORDER); doc.setFillColor(255, 255, 255);
              doc.roundedRect(bxx, boxY, bw, boxH, 1, 1, 'FD');
              doc.setFont('helvetica', 'normal'); doc.setFontSize(5.2); doc.setTextColor(...MUTED);
              const nm = doc.splitTextToSize(String(cc.name || ''), bw - 1)[0] || '';
              doc.text(nm, midX - doc.getTextWidth(nm) / 2, boxY + 3.5);
              doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5);
              const av = String(cc.abs || '–');
              drawEurText(av, midX - eurTextWidth(av) / 2, boxY + 8, TEXT);
              if (cc.rel) { doc.setFont('helvetica', 'normal'); doc.setFontSize(5); doc.setTextColor(...MUTED); const rv = String(cc.rel); doc.text(rv, midX - doc.getTextWidth(rv) / 2, boxY + 11); }
              if (i < nc - 1) {
                const ax = bxx + bw, ay = boxY + boxH / 2;
                doc.setDrawColor(...MUTED); doc.setLineWidth(0.4); doc.line(ax, ay, ax + gap - 1.4, ay);
                doc.setFillColor(...MUTED); doc.triangle(ax + gap - 1.4, ay - 1.1, ax + gap - 1.4, ay + 1.1, ax + gap, ay, 'F');
              }
            });
          } else {
            doc.setDrawColor(...BORDER); doc.setFillColor(...BOX);
            doc.roundedRect(bx, byy, w, bh, 1.5, 1.5, 'FD');
            if (b.cap) { doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5); doc.setTextColor(...MUTED); doc.text(String(b.cap), bx + 3, byy + 4); }
            const cw = (w - 6) / nc;
            (b.cols || []).forEach((cc, i) => {
              const cxx = bx + 3 + i * cw;
              doc.setFont('helvetica', 'normal'); doc.setFontSize(5.5); doc.setTextColor(...MUTED);
              doc.text(doc.splitTextToSize(String(cc.name || ''), cw - 1)[0] || '', cxx, byy + 8);
              doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5);
              drawEurText(String(cc.abs || '–'), cxx, byy + 12, TEXT);
              if (cc.rel) { doc.setFont('helvetica', 'normal'); doc.setFontSize(5.5); doc.setTextColor(...MUTED); doc.text(String(cc.rel), cxx, byy + 15); }
            });
          }
          byy += bh + 3; col = 0; return;
        }
        // Market Scale (NORMAL/EXTREME RISK): Caption + Spec + gerahmte Current/Stressed-Boxen
        // + gruen/amber Zonen-Balken mit Current/Stressed-Ticks + Limit-Labels (wie in der App).
        if (b.type === 'scale') {
          const bh = boxHeightOf(b);
          doc.setDrawColor(...BORDER); doc.setFillColor(...BOX);
          doc.roundedRect(bx, byy, w, bh, 1.5, 1.5, 'FD');
          doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5); doc.setTextColor(...MUTED);
          doc.text(String(b.cap || ''), bx + 3, byy + 4);
          if (b.spec) { doc.setFont('helvetica', 'normal'); doc.setFontSize(4.8); doc.setTextColor(...MUTED); const sp = String(b.spec); doc.text(sp, bx + w - 3 - doc.getTextWidth(sp), byy + 4); }
          // Gerahmte Wert-Boxen (Current/Stressed) nebeneinander.
          const vb = b.vals || [];
          const nb = Math.max(1, vb.length);
          const vbGap = 3, vbW = (w - 6 - vbGap * (nb - 1)) / nb, vbY = byy + 6, vbH = 11.5;
          vb.forEach((vv, i) => {
            const vx = bx + 3 + i * (vbW + vbGap);
            doc.setDrawColor(...BORDER); doc.setFillColor(255, 255, 255);
            doc.roundedRect(vx, vbY, vbW, vbH, 1, 1, 'FD');
            doc.setFont('helvetica', 'normal'); doc.setFontSize(5.2); doc.setTextColor(...MUTED);
            doc.text(String(vv.name || ''), vx + 2, vbY + 3);
            doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...TEXT);
            const vtxt = String(vv.val || '–') + (vv.inc ? '  ' + vv.inc : '');
            doc.text(vtxt, vx + 2, vbY + 7.2);
            if (vv.abs) { doc.setFont('helvetica', 'normal'); doc.setFontSize(4.8); doc.setTextColor(...MUTED); doc.text(String(vv.abs), vx + 2, vbY + 10.2); }
          });
          // Zonen-Balken (gruen bis Warnschwelle, amber danach) + Current/Stressed-Ticks.
          const barX = bx + 3, barW = w - 6, barY = vbY + vbH + 2.5, barH = 2, rad = 0.8;
          const gp = (b.greenPct != null) ? Math.max(0, Math.min(100, b.greenPct)) : 60;
          const gW = barW * gp / 100;
          const ZG = [47, 158, 91], ZA = [224, 165, 51];
          if (gW <= 0.2) { doc.setFillColor(...ZA); doc.roundedRect(barX, barY, barW, barH, rad, rad, 'F'); }
          else if (gW >= barW - 0.2) { doc.setFillColor(...ZG); doc.roundedRect(barX, barY, barW, barH, rad, rad, 'F'); }
          else {
            doc.setFillColor(...ZG); doc.roundedRect(barX, barY, barW, barH, rad, rad, 'F');
            doc.setFillColor(...ZA); doc.roundedRect(barX + gW, barY, barW - gW, barH, rad, rad, 'F');
            doc.rect(barX + gW, barY, Math.min(rad + 0.6, barW - gW), barH, 'F');
          }
          (b.ticks || []).forEach((tp) => {
            const mx = barX + barW * Math.max(0, Math.min(100, tp)) / 100;
            doc.setDrawColor(40, 40, 40); doc.setLineWidth(0.5); doc.line(mx, barY - 1, mx, barY + barH + 1);
          });
          if (b.limits && b.limits.length) {
            doc.setFont('helvetica', 'normal'); doc.setFontSize(4.5); doc.setTextColor(...MUTED);
            const lt = b.limits.join('    ');
            doc.text(lt, barX + barW - doc.getTextWidth(lt), barY + barH + 3.2);
          }
          byy += bh + 3; col = 0; return;
        }
        // Concentration (EXTREME RISK): Titel + Status (Wort in Zonenfarbe) + 3-Zonen-Score-Balken + Marker/Pill + Skala.
        if (b.type === 'conc') {
          const bh = boxHeightOf(b);
          doc.setDrawColor(...BORDER); doc.setFillColor(...BOX);
          doc.roundedRect(bx, byy, w, bh, 1.5, 1.5, 'FD');
          doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5); doc.setTextColor(...MUTED);
          doc.text(String(b.title || ''), bx + 3, byy + 4);
          if (b.right) { doc.setFont('helvetica', 'normal'); doc.setFontSize(4.6); doc.setTextColor(...MUTED); const rt = String(b.right); doc.text(rt, bx + w - 3 - doc.getTextWidth(rt), byy + 4); }
          const zc = (b.markerPct != null && b.markerPct >= 60) ? [217, 83, 79] : (b.markerPct != null && b.markerPct >= 40) ? [224, 165, 51] : [47, 158, 91];
          const st = String(b.status || '');
          doc.setFontSize(6.5);
          const ci = st.lastIndexOf(':');
          if (ci >= 0) {
            const pre = st.slice(0, ci + 1) + ' ', word = st.slice(ci + 1).trim();
            doc.setFont('helvetica', 'normal'); doc.setTextColor(...MUTED); doc.text(pre, bx + 3, byy + 8);
            doc.setFont('helvetica', 'bold'); doc.setTextColor(zc[0], zc[1], zc[2]); doc.text(word, bx + 3 + doc.getTextWidth(pre), byy + 8);
          } else { doc.setFont('helvetica', 'normal'); doc.setTextColor(...MUTED); doc.text(st, bx + 3, byy + 8); }
          const barX = bx + 3, barW = w - 6, barY = byy + 13, barH = 2, rad = 0.8;
          const g40 = barW * 0.40, g60 = barW * 0.60;
          doc.setFillColor(47, 158, 91); doc.roundedRect(barX, barY, g40, barH, rad, rad, 'F'); doc.rect(barX + g40 - 1.2, barY, 1.2, barH, 'F');
          doc.setFillColor(224, 165, 51); doc.rect(barX + g40, barY, g60 - g40, barH, 'F');
          doc.setFillColor(217, 83, 79); doc.roundedRect(barX + g60, barY, barW - g60, barH, rad, rad, 'F'); doc.rect(barX + g60, barY, 1.2, barH, 'F');
          if (b.markerPct != null) {
            const mx = barX + barW * Math.max(0, Math.min(100, b.markerPct)) / 100;
            doc.setDrawColor(255, 255, 255); doc.setLineWidth(0.7); doc.line(mx, barY - 0.6, mx, barY + barH + 0.6);
            doc.setDrawColor(40, 40, 40); doc.setLineWidth(0.3); doc.line(mx, barY - 0.6, mx, barY + barH + 0.6);
            if (b.pill) { doc.setFont('helvetica', 'bold'); doc.setFontSize(5.5); doc.setTextColor(...TEXT); const pw = doc.getTextWidth(String(b.pill)); doc.text(String(b.pill), Math.max(barX, Math.min(barX + barW - pw, mx - pw / 2)), byy + 11.5); }
          }
          if (b.scale && b.scale.length) {
            doc.setFont('helvetica', 'normal'); doc.setFontSize(4.5); doc.setTextColor(...MUTED);
            const L = b.scale;
            if (L[0]) doc.text(L[0], barX, barY + barH + 3);
            if (L[1]) doc.text(L[1], barX + g40 - doc.getTextWidth(L[1]) / 2, barY + barH + 3);
            if (L[2]) doc.text(L[2], barX + g60 - doc.getTextWidth(L[2]) / 2, barY + barH + 3);
            const last = L[L.length - 1]; if (last && L.length > 3) doc.text(last, barX + barW - doc.getTextWidth(last), barY + barH + 3);
          }
          byy += bh + 3; col = 0; return;
        }
        // Interest Rate Duration: Caption + Oe + Split-Balken (not valued | valued) + Prozente.
        if (b.type === 'irdur') {
          const bh = boxHeightOf(b);
          doc.setDrawColor(...BORDER); doc.setFillColor(...BOX);
          doc.roundedRect(bx, byy, w, bh, 1.5, 1.5, 'FD');
          doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5); doc.setTextColor(...MUTED);
          doc.text(String(b.cap || ''), bx + 3, byy + 4);
          // Gleiche Dicke/Rundung wie die Risk-Panel-Balken (barH 2, rad 0.8); Uebergang buendig (nicht abgeschnuert).
          const barX = bx + 3, barW = w - 6, barY = byy + 9, barH = 2, rad = 0.8;
          const nvW = (b.nvPct != null) ? Math.max(0, Math.min(100, b.nvPct)) : 0;
          const nvPx = barW * nvW / 100;
          const NV = [154, 167, 180], V = [108, 155, 209];
          if (nvPx <= 0.2) { doc.setFillColor(...V); doc.roundedRect(barX, barY, barW, barH, rad, rad, 'F'); }
          else if (nvPx >= barW - 0.2) { doc.setFillColor(...NV); doc.roundedRect(barX, barY, barW, barH, rad, rad, 'F'); }
          else {
            doc.setFillColor(...NV); doc.roundedRect(barX, barY, barW, barH, rad, rad, 'F');            // Basis grau (runde Enden)
            doc.setFillColor(...V); doc.roundedRect(barX + nvPx, barY, barW - nvPx, barH, rad, rad, 'F'); // valued rechts (rundes rechtes Ende)
            doc.rect(barX + nvPx, barY, Math.min(rad + 0.6, barW - nvPx), barH, 'F');                     // Uebergang eckig auffuellen -> buendig
          }
          // Labels ueber dem Balken: not valued links, valued rechts.
          doc.setFont('helvetica', 'normal'); doc.setFontSize(5); doc.setTextColor(...MUTED);
          if (b.nvLbl) doc.text(String(b.nvLbl), barX, byy + 7.5);
          if (b.vLbl) { const vl = String(b.vLbl); doc.text(vl, barX + barW - doc.getTextWidth(vl), byy + 7.5); }
          // Prozente unter dem Balken.
          doc.setFontSize(5); doc.setTextColor(...MUTED);
          if (b.nvPctTxt) doc.text(String(b.nvPctTxt), barX, byy + 15);
          if (b.vPctTxt) { const vp = String(b.vPctTxt); doc.text(vp, barX + barW - doc.getTextWidth(vp), byy + 15); }
          // Durchschnitts-Duration zentriert unten.
          if (b.avg) { doc.setFont('helvetica', 'bold'); doc.setFontSize(6); doc.setTextColor(...TEXT); const a = String(b.avg); doc.text(a, bx + w / 2 - doc.getTextWidth(a) / 2, byy + 18.5); }
          byy += bh + 3; col = 0; return;
        }
        doc.setDrawColor(...BORDER); doc.setFillColor(...BOX);
        doc.roundedRect(bx, byy, w, ovBoxH, 1.5, 1.5, 'FD');
        const vs = String(b.v);
        doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5);
        if (b.pre) {
          // Zweizeilige Ampel-Box (wie in der App): Zeile 1 = Titel,
          // Zeile 2 = Einstufung in Ampelfarbe + Ampel-Punkt. Sonst nichts.
          doc.setTextColor(...TEXT);
          doc.text(String(b.pre), bx + 3, byy + 5.2);
          const a2 = b.dot ? ampRgb(b.dot) : TEXT;
          doc.setTextColor(a2[0], a2[1], a2[2]);
          doc.text(vs, bx + 3, byy + 10.8);
          if (b.dot) { const a = ampRgb(b.dot); doc.setFillColor(a[0], a[1], a[2]); doc.circle(bx + 3 + doc.getTextWidth(vs) + 2.4, byy + 9.6, 1.1, 'F'); }
        } else {
          // Name als Caption oben, Haupt-Wert um die VERTIKALE MITTE der Kachel, Sub darunter.
          // (Frueher feste Offsets 4,2/9,4/12,4 -> Wert/Sub sassen zu tief; jetzt am Wert zentriert,
          // konsistent fuer 2- und 3-zeilige Kacheln.)
          const yVal = byy + ovBoxH / 2 + 1.4;
          const yLbl = yVal - 5.2;
          const ySub = yVal + 3.2;
          doc.setFont('helvetica', 'normal'); doc.setFontSize(6); doc.setTextColor(...MUTED);
          if (b.lbl) doc.text(String(b.lbl), bx + 3, yLbl);
          // Zeile 2: Primaerwert (fett), "EUR" kleiner/muted.
          doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5);
          let vx = bx + 3 + drawEurText(vs, bx + 3, yVal, TEXT);
          if (b.dot) { const a = ampRgb(b.dot); doc.setFillColor(a[0], a[1], a[2]); doc.circle(vx + 2.4, yVal - 1.2, 1.1, 'F'); vx += 4.5; }
          // Zeile 2 zusaetzlich: Sekundaerwert (muted, klein) inline dahinter — passt jetzt, da "EUR" klein ist.
          if (b.sub) { doc.setFont('helvetica', 'normal'); doc.setFontSize(6); drawEurText(String(b.sub), vx + 1.8, yVal, MUTED); }
          // Zeile 3: Aenderung = kleiner Kreis+45°-Pfeil (Richtung) + "abs · rel" ohne Vorzeichen.
          if (b.chgAbs) {
            drawTrendCircle(bx + 3.8, ySub - 1.3, b.chgUp);
            doc.setFont('helvetica', 'normal'); doc.setFontSize(6);
            drawEurText(`${b.chgAbs} · ${b.chgRel}`, bx + 6.8, ySub, MUTED);
          }
        }
        if (b.wide) { col = 0; byy += ovBoxH + 3; }
        else { col += 1; if (col >= 2) { col = 0; byy += ovBoxH + 3; } }
      });
    });
    y += ovCardH + 4;

    // ── Risk-Slider (Interest Rate / Credit Spread) in voller Breite unter den Karten.
    //    Positionen/Zonen aus den data-Attributen der gerenderten UI-Slider -> PDF = App.
    const ds = (id, k) => (ctx.getById(id)?.dataset?.[k] ?? '');
    const dnum = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; };
    // Balken-Fuellgrad (%) aus der style.width des gerenderten UI-Balkens (Duration-Kacheln).
    const barPct = (id) => { const n = parseFloat(ctx.getById(id)?.style?.width || ''); return Number.isFinite(n) ? n : 0; };
    const drawRiskSlider = (sx, sy, sw, s) => {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...TEXT);
      doc.text(s.title, sx, sy);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(...MUTED);
      doc.text(s.leftLbl, sx, sy + 4.5);
      doc.text(s.rightLbl, sx + sw - doc.getTextWidth(s.rightLbl), sy + 4.5);
      const tY = sy + 12, tH = 3;
      const gx = sx + sw * (s.gP / 100), yx = sx + sw * (s.yP / 100);
      doc.setFillColor(...ampRgb('green'));  doc.rect(sx, tY, Math.max(0, gx - sx), tH, 'F');
      doc.setFillColor(...ampRgb('yellow')); doc.rect(gx, tY, Math.max(0, yx - gx), tH, 'F');
      doc.setFillColor(...ampRgb('red'));    doc.rect(yx, tY, Math.max(0, sx + sw - yx), tH, 'F');
      if (s.oneY != null) {
        const bx = sx + sw * (s.oneY / 100);
        doc.setDrawColor(255, 255, 255); doc.setLineWidth(0.4); doc.line(bx, tY, bx, tY + tH);
      }
      const mx = sx + sw * (s.pos / 100), mc = ampRgb(s.state || 'green');
      doc.setDrawColor(...mc); doc.setLineWidth(0.8); doc.line(mx, tY - 2, mx, tY + tH + 2);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5);
      const vw = doc.getTextWidth(s.durTxt) + 3;
      const px = Math.max(sx, Math.min(sx + sw - vw, mx - vw / 2));
      doc.setFillColor(...mc); doc.roundedRect(px, tY - 6.5, vw, 4.2, 1, 1, 'F');
      doc.setTextColor(255, 255, 255);
      doc.text(s.durTxt, px + vw / 2 - doc.getTextWidth(s.durTxt) / 2, tY - 3.6);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(6); doc.setTextColor(...MUTED);
      doc.text('0', sx, tY + tH + 4);
      doc.text(s.maxTxt, sx + sw - doc.getTextWidth(s.maxTxt), tY + tH + 4);
    };
    // Duration-Kachel (IR/CS) als 2 Balken (Total NAV / Valued NAV) — statt Slider, wie in der App.
    const drawDurationBars = (sx, sy, sw, title, rows) => {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...TEXT);
      doc.text(title, sx, sy);
      const lblW = 18, valW = 13, gap = 3;
      const trackX = sx + lblW, trackW = Math.max(4, sw - lblW - valW - gap);
      rows.forEach((r, i) => {
        const ry = sy + 5 + i * 7;
        doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(...MUTED);
        doc.text(String(r.lbl), sx, ry + 2.6);
        doc.setFillColor(226, 230, 236); doc.roundedRect(trackX, ry, trackW, 2.4, 0.9, 0.9, 'F');
        const fw = Math.max(0, Math.min(trackW, trackW * (r.pct / 100)));
        if (fw > 0.3) { doc.setFillColor(108, 155, 209); doc.roundedRect(trackX, ry, fw, 2.4, 0.9, 0.9, 'F'); }
        doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(...TEXT);
        doc.text(String(r.valTxt), sx + sw - doc.getTextWidth(String(r.valTxt)), ry + 2.8);
      });
    };
    // Slider auf Drittelbreite UNTER die jeweilige Karte -> immer 3-teilig wie in der App:
    // IR/CS unter Portfolio (links), TSI/MSD unter Credit (rechts), Market-Mitte bleibt frei.
    // Reuse der Karten-Geometrie (ovCardW/ovGap), damit Slider nie in den Market-Bereich ragen.
    const sHalfW = ovCardW;
    const sColL = marginX, sColR = marginX + 2 * (ovCardW + ovGap);
    const sColM = marginX + (ovCardW + ovGap);   // Mitte = Market-Spalte
    const irMax = otxt('irScaleMax'), tsiMax = otxt('tsiScaleMax');
    const mr1Max = otxt('mr1ScaleMax'), mr2Max = otxt('mr2ScaleMax');
    // Slider NUR, wenn die jeweilige Kachel im Customer Setup nicht ausgehakt ist (display:none).
    const tileHidden = (key) => {
      const el = (ctx.appRoot || document).querySelector(`[data-tile="${key}"]`);
      return !!el && el.style.display === 'none';
    };
    const showIr  = irMax !== '–' && !tileHidden('ir_duration');
    const showCs  = otxt('homePfCsDurTotal') !== '–' && !tileHidden('cs_duration');
    const showTsi = tsiMax !== '–' && !tileHidden('cr_tsi');
    const showMsd = otxt('msdScaleMax') !== '–' && !tileHidden('cr_msd');
    const showMr1 = mr1Max !== '–' && !tileHidden('mkt_mr1');
    const showMr2 = mr2Max !== '–' && !tileHidden('mkt_mr2');
    if (showIr || showCs || showTsi || showMsd || showMr1 || showMr2) {
      // Nur die tatsaechlich genutzte Hoehe reservieren (kein fixer 52er-Block) -> ohne
      // angehakte Slider ruecken die Charts hoch auf dieselbe Seite.
      const leftH = (showIr ? 22 : 0) + (showCs ? 22 : 0);
      const rightH = ((showTsi ? 1 : 0) + (showMsd ? 1 : 0)) * 26;
      const midH = ((showMr1 ? 1 : 0) + (showMr2 ? 1 : 0)) * 26;
      const blockH = Math.max(leftH, rightH, midH) + 6;
      ensurePageSpace(blockH, `${sectionTitle} (cont.)`);
      if (showIr || showCs) {
        let dy = y + 4;
        if (showIr) {
          drawDurationBars(sColL, dy, sHalfW, 'Interest Rate Duration', [
            { lbl: 'Total NAV',  valTxt: otxt('homePfIrDurTotal'),  pct: barPct('homePfIrDurTotalBar') },
            { lbl: 'Valued NAV', valTxt: otxt('homePfIrDurValued'), pct: barPct('homePfIrDurValuedBar') },
          ]); dy += 22;
        }
        if (showCs) {
          drawDurationBars(sColL, dy, sHalfW, 'Credit Spread Duration', [
            { lbl: 'Total NAV',  valTxt: otxt('homePfCsDurTotal'),  pct: barPct('homePfCsDurTotalBar') },
            { lbl: 'Valued NAV', valTxt: otxt('homePfCsDurValued'), pct: barPct('homePfCsDurValuedBar') },
          ]);
        }
      }
      if (showTsi || showMsd) {
        let dy = y + 4;
        if (showTsi) {
          drawRiskSlider(sColR, dy, sHalfW, {
            title: 'Cluster Risk (TSI)', leftLbl: 'Low cluster', rightLbl: 'High cluster',
            gP: dnum(ds('tsiTrack', 'g')), yP: dnum(ds('tsiTrack', 'y')), oneY: null,
            pos: dnum(ds('tsiMarker', 'pos')), state: ds('tsiMarker', 'state') || 'green',
            durTxt: otxt('tsiMarkerVal'), maxTxt: tsiMax,
          }); dy += 26;
        }
        if (showMsd) {
          drawRiskSlider(sColR, dy, sHalfW, {
            title: 'Market Stress (MSD)', leftLbl: 'Low stress', rightLbl: 'High stress',
            gP: dnum(ds('msdTrack', 'g')), yP: dnum(ds('msdTrack', 'y')), oneY: null,
            pos: dnum(ds('msdMarker', 'pos')), state: ds('msdMarker', 'state') || 'green',
            durTxt: otxt('msdMarkerVal'), maxTxt: otxt('msdScaleMax'),
          });
        }
      }
      if (showMr1 || showMr2) {
        let dy = y + 4;
        if (showMr1) {
          drawRiskSlider(sColM, dy, sHalfW, {
            title: 'Market Indicator 1', leftLbl: 'Low', rightLbl: 'High',
            gP: dnum(ds('mr1Track', 'g')), yP: dnum(ds('mr1Track', 'y')), oneY: null,
            pos: dnum(ds('mr1Marker', 'pos')), state: ds('mr1Marker', 'state') || 'green',
            durTxt: otxt('mr1MarkerVal'), maxTxt: mr1Max,
          }); dy += 26;
        }
        if (showMr2) {
          drawRiskSlider(sColM, dy, sHalfW, {
            title: 'Market Indicator 2', leftLbl: 'Low', rightLbl: 'High',
            gP: dnum(ds('mr2Track', 'g')), yP: dnum(ds('mr2Track', 'y')), oneY: null,
            pos: dnum(ds('mr2Marker', 'pos')), state: ds('mr2Marker', 'state') || 'green',
            durTxt: otxt('mr2MarkerVal'), maxTxt: mr2Max,
          });
        }
      }
      y += blockH;
    }
  }

  // 'overview': die 3 HOME-Overview-Charts nebeneinander in EINER Reihe ->
  // Sektion (KPI-Karten + Charts) passt komplett auf eine Seite.
  const COMPOSED_ROW_KEYS = new Set(['overview', 'structure', 'market', 'credit', 'mvar', 'mvar-products', 'mvar-yield', 'mvar-issuers', 'mvar-scenarios', 'sensitivities', 'hist-sensitivities', 'performance', 'ts']);
  const composedRow = (COMPOSED_ROW_KEYS.has(sec.key) || sec.__composed2) && (sec.enabledCharts || []).length > 0;
  if (composedRow) {
    // Credit-Tail-Driver-Charts NICHT in der Nebeneinander-Reihe (sie werden unten je
    // PD-Ansicht als Chart+Tabelle-Paar gezeichnet).
    // Credit: NUR den Scatter (Tail loss vs EAD) aus der Nebeneinander-Reihe nehmen (kommt darunter).
    // Loss distribution + Top tail drivers bleiben zusammen in der Reihe -> nebeneinander.
    const rowCharts = (sec.enabledCharts || []).filter(ch => !/crTailTcmScatter/.test(ch.id));
    // Issuers/Products/Factors: 2 pro Reihe (Balken+Scatter je Metrik untereinander).
    const FORCE_TWO_PER_ROW = new Set(['mvar-issuers', 'mvar-products', 'mvar-yield', 'mvar', 'credit', 'sensitivities', 'hist-sensitivities', 'performance', 'ts']);
    const perRow = (FORCE_TWO_PER_ROW.has(sec.key) || sec.__composed2) ? Math.min(2, rowCharts.length || 1) : Math.min(rowCharts.length, 3);
    const cgap = 6;
    const cellW = (layout.contentWidth - cgap * (perRow - 1)) / perRow;
    // Mit KPI-Baendern daruerber etwas flacher, damit Baender + Charts auf eine Seite passen.
    const hasKpiBand = tablesAll.some((t) => ctx.getById(t.id)?.dataset?.kpiBand);
    // Overview-Charts sind flache Balken-Diagramme -> kompaktere Kachel (kein grosser
    // Leerraum ueber/unter den Balken) und weniger Gesamthoehe, damit KPIs + Slider +
    // Charts auf EINE Seite passen.
    let cellH = (sec.key === 'overview') ? 44 : (perRow >= 3 ? 70 : (hasKpiBand ? 74 : 84));
    const composedRows = Math.ceil(rowCharts.length / perRow);
    if (composedRows > 1) {
      // Bevorzugt auf den RESTPLATZ der aktuellen Seite quetschen (z.B. KPI-Band + Charts
      // auf EINE Seite), statt auf eine frische Seite umzubrechen. "Zu grosse" Graphen
      // werden dabei verkleinert. Reicht der Rest nicht, frische Seite + volle Hoehe.
      const availNow = layout.bottomSafe - y;
      const fitNow = Math.floor((availNow - 4) / composedRows) - 16;
      if (fitNow >= 34) {
        cellH = Math.min(cellH, fitNow);   // passt auf die aktuelle Seite -> KEIN Umbruch
      } else {
        const usable = layout.bottomSafe - layout.topSafe;   // volle frische Seite
        const fitFull = Math.floor((usable - 30) / composedRows) - 16;
        if (fitFull > 30) cellH = Math.min(cellH, fitFull);
        // Ganzen Block einmal reservieren -> bricht komplett auf eine frische Seite.
        ensurePageSpace(composedRows * (cellH + 16) + 2, `${sectionTitle} (cont.)`);
      }
    } else if (sec.key === 'overview') {
      // Overview = EINE Chart-Reihe (3 Charts). Wenn oben KPIs + Slider schon Platz
      // belegen, die Charts NICHT auf Seite 2 umbrechen, sondern auf den Restplatz der
      // aktuellen Seite verkleinern (bis zu einer Mindesthoehe) -> alles auf 1 Seite.
      const remaining = layout.bottomSafe - y - 16;   // -16 = Reserve wie ensurePageSpace unten
      // Aggressiv: solange noch mind. ~22 Rest ist, die Charts in den Restplatz der
      // aktuellen Seite quetschen (statt umzubrechen) -> Overview bleibt auf 1 Seite.
      if (remaining >= 22) cellH = Math.min(cellH, remaining);
    }
    let col = 0;
    let rowY = y;
    for (const ch of rowCharts) {
      const el = ctx.getById(ch.id);
      let imgData = null;
      if (el) imgData = (el.tagName === 'CANVAS') ? canvasToPngData(el) : await plotlyToPngData(el);
      if (col === 0) { ensurePageSpace(cellH + 16, `${sectionTitle} (cont.)`); rowY = y; }
      const x = marginX + col * (cellW + cgap);
      drawChartCard(doc, x, rowY, cellW, cellH + 8);
      // EC-Frage (falls vorhanden) fett/dunkel als Ueberschrift + data-label als Untertitel; sonst nur Label.
      const cq = crQuestionFor(ch.id);
      if (cq) {
        doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(26, 31, 41);
        doc.text(doc.splitTextToSize(cq, cellW - 6)[0] || cq, x + cellW / 2, rowY + 4, { align: 'center' });
        doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(110);
        doc.text(ch.label || ch.id, x + cellW / 2, rowY + 8, { align: 'center' });
      } else {
        if (sec.key === 'overview') { doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(26, 31, 41); }
        else { doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(90); }
        doc.text(chartAppTitle(ch.id) || ch.label || ch.id, x + cellW / 2, rowY + 5, { align: 'center' });
      }
      doc.setFont('helvetica', 'normal');
      if (imgData?.dataUrl) {
        const srcW = imgData.width || 900;
        const srcH = imgData.height || 520;
        const capH = cq ? 10 : 7;
        const availH = cellH - (cq ? 3 : 2);
        const scale = Math.min(cellW / srcW, availH / srcH, 1);
        const w = srcW * scale;
        const h = srcH * scale;
        const ix = x + (cellW - w) / 2;
        const iy = rowY + capH + (availH - h) / 2;
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
    for (const v of CR_DRIVER_VIEWS) {
      // Top tail drivers steht jetzt in der composedRow (rechts neben Loss distribution) -> hier nur Scatter + TCM.
      if (!enC.has(v.chartId)) continue;
      // Scatter (links) + TCM-Tabelle (rechts) NEBENEINANDER — nach den Top tail drivers.
      const scatterId = v.chartId.endsWith('Hist') ? 'crTailTcmScatterHist' : 'crTailTcmScatterNorm';
      const tcmId = v.chartId.endsWith('Hist') ? 'crTailTcmTableHist' : 'crTailTcmTableNorm';
      const scEl = ctx.getById(scatterId);
      const tcmTbl = extractTableFromContainer(tcmId, { maxRows: 30, maxCols: 12, ctx });
      const hasSc = !!(scEl && enC.has(scatterId));
      const hasTcm = !!(tcmTbl && tcmTbl.body && tcmTbl.body.length);
      if (hasSc || hasTcm) {
        const gap = 6, colW = (layout.contentWidth - gap) / 2;
        const bothCols = hasSc && hasTcm;
        const scH = 62;
        ensurePageSpace(scH + 16, `${sectionTitle} (cont.)`);
        const rowTop = y;
        let bottom = rowTop;
        if (hasSc) {
          const scW = bothCols ? colW : layout.contentWidth;
          const scImg = canvasToPngData(scEl);
          const scQ = crQuestionFor(scatterId);
          if (scQ) { doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(26, 31, 41); doc.text(doc.splitTextToSize(scQ, scW - 4)[0] || scQ, marginX, rowTop + 4); }
          const scTop = scQ ? rowTop + 6 : rowTop;
          drawChartCard(doc, marginX, scTop, scW, scH + 8);
          if (scImg?.dataUrl) {
            const srcW = scImg.width || 900, srcH = scImg.height || 520;
            const availH = scH - 2;
            const scale = Math.min(scW / srcW, availH / srcH, 1);
            const w = srcW * scale, h = srcH * scale;
            try { doc.addImage(scImg.dataUrl, scImg.fmt || 'JPEG', marginX + (scW - w) / 2, scTop + 7 + (availH - h) / 2, w, h); }
            catch (e) { console.warn('[PDF] EC scatter failed', scatterId, e); }
          }
          bottom = Math.max(bottom, scTop + scH + 8);
        }
        if (hasTcm) {
          const tcmX = bothCols ? marginX + colW + gap : marginX;
          const tcmW = bothCols ? colW : layout.contentWidth;
          const tcmQ = crQuestionFor(tcmId);
          let ty = rowTop;
          if (tcmQ) { doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(26, 31, 41); doc.text(doc.splitTextToSize(tcmQ, tcmW - 4)[0] || tcmQ, tcmX, rowTop + 4); ty = rowTop + 6; }
          safeAutoTable(doc, layout, {
            head: tcmTbl.head && tcmTbl.head.length ? [tcmTbl.head] : undefined,
            body: tcmTbl.body, startY: ty, theme: 'grid',
            styles: { fontSize: 7, cellPadding: 1.2 },
            headStyles: { fillColor: [34, 34, 34], textColor: [220, 220, 220] },
            tableWidth: tcmW, margin: { left: tcmX }, pageBreak: 'avoid',
          });
          bottom = Math.max(bottom, doc.lastAutoTable?.finalY || ty);
        }
        y = bottom + cfg.blockGap;
      }
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

    const q = crQuestionFor(ch.id);
    const appT = q ? '' : chartAppTitle(ch.id);   // App-Titel ersetzt den technischen Namen
    const extraQ = q ? 5 : 0;
    const blockHeight = Math.max(targetHeight, noteHeight) + 22 + extraQ;
    ensurePageSpace(blockHeight + 10, `${sectionTitle} (cont.)`);

    const boxY = y;
    const imgY = boxY + 11 + extraQ;
    const imgX = marginX + (chartWidth - targetWidth) / 2;

    drawChartCard(doc, marginX - 2, boxY, chartWidth + 4, blockHeight - 4);

    if (q) {
      // EC-Frage als helle Ueberschrift + data-label als Untertitel (wie in der App).
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(26, 31, 41);
      doc.text(q, marginX + chartWidth / 2, boxY + 6, { align: 'center' });
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(110);
      doc.text(ch.label || ch.id, marginX + chartWidth / 2, boxY + 10.5, { align: 'center' });
    } else {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(0);
      doc.text(appT || ch.label || ch.id, marginX + chartWidth / 2, boxY + 7, { align: 'center' });
    }

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
    // Overview: KPIs sind bereits als native Karten gezeichnet -> Spiegel-Tabelle ueberspringen.
    if (sec.key === 'overview' && t.id === 'overviewKpiTable') continue;

    const tbl = extractTableFromContainer(t.id, { maxRows: 500, maxCols: 40, ctx });
    if (!tbl) continue;

    ensurePageSpace(40, `${sectionTitle} (cont.)`);

    // Tabellen-Titel nur zeichnen, wenn ein ECHTES data-label existiert. Ohne data-label
    // ist t.label == t.id (technischer Name) -> weglassen.
    const tblLabel = (t.label && t.label !== t.id) ? String(t.label) : '';
    if (tblLabel) {
      doc.setFontSize(10);
      doc.setTextColor(0);
      doc.text(tblLabel, marginX, y);
    }

    const head = tbl.head && tbl.head.length ? [tbl.head] : undefined;
    const cellStatus = tbl.cellStatus || [];

    // Tabelle immer schmaler (~60%), damit rechts Platz fuer die Notiz-Spalte bleibt.
    const noteGap = 6;
    const tableW  = layout.contentWidth * 0.60;
    const noteX   = marginX + tableW + noteGap;
    const noteW   = Math.max(0, layout.contentWidth - tableW - noteGap);
    const noteTxt = (typeof getTableNote === 'function' ? getTableNote(t.id) : '') || '';
    const tableTopY = y + (tblLabel ? 6 : 0);

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

