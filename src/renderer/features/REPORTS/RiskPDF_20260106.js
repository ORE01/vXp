const { jsPDF } = window.jspdf;
import { getActiveRiskSectionsForPdf, RISK_CONFIG } from './RiskPDFPreview.js';

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

  return map[chartId] || chartId;
}


function applyPdfHierarchy(sections, config) {
  const parents = config?.sectionParents || {};
  const orderByParent = config?.sectionChildrenOrder || {};

  const byKey = new Map(sections.map(s => [s.key, s]));
  const childrenMap = new Map(); // parentKey -> [childKey...]

  // build children lists
  for (const s of sections) {
    const p = parents[s.key];
    if (p && byKey.has(p)) {
      if (!childrenMap.has(p)) childrenMap.set(p, []);
      childrenMap.get(p).push(s.key);
    }
  }

  // enforce optional explicit order
  for (const [p, arr] of childrenMap.entries()) {
    const pref = orderByParent[p];
    if (Array.isArray(pref) && pref.length) {
      const set = new Set(arr);
      const ordered = [
        ...pref.filter(k => set.has(k)),
        ...arr.filter(k => !pref.includes(k)),
      ];
      childrenMap.set(p, ordered);
    }
  }

  // roots = all that have no valid parent
  const roots = sections
    .filter(s => {
      const p = parents[s.key];
      return !(p && byKey.has(p));
    })
    .map(s => s.key);

  // keep original discovery order for roots
  const seenRoot = new Set(roots);
  const rootsInOriginalOrder = sections.map(s => s.key).filter(k => seenRoot.has(k));

  const out = [];
  const visit = (key, level, number) => {
    const sec = byKey.get(key);
    if (!sec) return;
    sec.tocLevel = level;
    sec.sectionNumber = number;
    out.push(sec);

    const kids = childrenMap.get(key) || [];
    kids.forEach((ck, idx) => {
      visit(ck, level + 1, `${number}.${idx + 1}`);
    });
  };

  rootsInOriginalOrder.forEach((rk, idx) => visit(rk, 1, String(idx + 1)));
  return out;
}




// =====================================================================
// GENERATE RISK PDF – Nur noch: aktive Sections/Charts/Tables aus Preview
// =====================================================================


export async function generateRiskPDF(filteredData, overrides = {}) {
  const opts = { ...REPORT_DEFAULTS, ...overrides };

  const doc = new jsPDF({ orientation: opts.orientation, format: opts.paper });
  const totalPagesExp = '{total_pages_count_string}';

  // Zentrale Wahrheit aus Preview
let sections = getActiveRiskSectionsForPdf() || [];

// ✅ Hierarchie + Nummerierung fürs PDF anwenden
sections = applyPdfHierarchy(sections, RISK_CONFIG);

// optional: falls du weiterhin ein map brauchst
const sectionNoByKey = {};
sections.forEach(sec => { sectionNoByKey[sec.key] = sec.sectionNumber; });


  // ─────────────────────────────────────────────
  // 2) Breakdown-Nummerierung vorbereiten
  // ─────────────────────────────────────────────
  const breakdownSec = sections.find(s => s.key === 'breakdown');

  if (breakdownSec && typeof groupBreakdownChartsBySection === 'function') {
    const sectionNo = sectionNoByKey[breakdownSec.key] || '1';
    const chartsForGroups = breakdownSec.enabledCharts || [];
    const groups = groupBreakdownChartsBySection(chartsForGroups) || [];

    const breakdownNumbering = {
      section: sectionNo,   // "1"
      groups: {},           // "Issuer"  -> "1.1"
      charts: {},           // "issuerPieChart" -> { no: "1.1.1", label: "Issuer" }
    };

    let gIdx = 1;
    groups.forEach(g => {
      if (!g || !g.charts || !g.charts.length) return;

      const gTitle = g.title || g.name || `Group ${gIdx}`;
      const gNo    = `${sectionNo}.${gIdx}`;
      breakdownNumbering.groups[gTitle] = gNo;

      let cIdx = 1;
      g.charts.forEach(ch => {
        if (!ch || !ch.id) return;
        const label = getBreakdownChartDisplayLabel(ch.id);
        breakdownNumbering.charts[ch.id] = {
          no:   `${gNo}.${cIdx}`,    // z.B. "1.1.1"
          label
        };
        cIdx++;
      });

      gIdx++;
    });

    breakdownSec.breakdownNumbering = breakdownNumbering;
  }

  // ─────────────────────────────────────────────
  // 3) TOC-Einträge + Rendering
  // ─────────────────────────────────────────────
  const tocEntries = [];

function addTOCEntry(number, title, page, level = 1) {
  tocEntries.push({
    title: `${number}. ${title}`,
    page,
    level,
  });
}


  let wroteAnySection = false;

  for (let i = 0; i < sections.length; i++) {
    const sec = sections[i];
    const sectionNo = sectionNoByKey[sec.key] || String(i + 1);
    sec.sectionNumber = sectionNo; // fürs Rendering

    if (wroteAnySection) {
      doc.addPage();
    }
    wroteAnySection = true;

const title     = sec.title || sec.key;
const pageIndex = doc.internal.getNumberOfPages();

// ✅ Level aus Hierarchie übernehmen
addTOCEntry(sec.sectionNumber, title, pageIndex, sec.tocLevel || 1);


    // Breakdown: Gruppen + Charts in TOC eintragen
    if (sec.key === 'breakdown' &&
        sec.breakdownNumbering &&
        typeof groupBreakdownChartsBySection === 'function') {

      const chartsForGroups = sec.enabledCharts || [];
      const groups = groupBreakdownChartsBySection(chartsForGroups) || [];

      groups.forEach(g => {
        if (!g || !g.charts || !g.charts.length) return;

        const gTitle = g.title || g.name || '';
        const gNo    = sec.breakdownNumbering.groups[gTitle];

        // Ebene 2: Gruppe (Issuer / Product / General)
        if (gNo) {
          tocEntries.push({
            title: `${gNo}. ${gTitle}`,
            page:  pageIndex,
            level: 2,
          });
        }

        // Ebene 3: Charts (Issuer, Rating, Rank, …)
        g.charts.forEach(ch => {
          const meta = sec.breakdownNumbering.charts[ch.id];
          if (!meta) return;
          tocEntries.push({
            title: `${meta.no}. ${meta.label}`,
            page:  pageIndex,
            level: 3,
          });
        });
      });
    }

    // Section rendern (bekommt Nummern mit)
    await renderPanelSectionToPDF(doc, sec);
  }

  // ─────────────────────────────────────────────
  // 4) Appendix
  // ─────────────────────────────────────────────
  if (Array.isArray(filteredData) && filteredData.length) {
    if (wroteAnySection) doc.addPage();
    wroteAnySection = true;

    const pageIndex   = doc.internal.getNumberOfPages();
    const appendixNo  = String(sections.length + 1);

    tocEntries.push({
      title: `${appendixNo}. Appendix: Product Table`,
      page:  pageIndex,
      level: 1,
    });

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
      const indent       = (entry.level - 1) * 5;
      const lineY        = 30 + index * 8;
      const pageWidth    = doc.internal.pageSize.getWidth();
      const marginLeft   = 20 + indent;
      const marginRight  = 20;
      const maxLineWidth = pageWidth - marginLeft - marginRight;

      const pageText      = (entry.page + 1).toString(); // +1 wegen TOC-Seite
      const pageTextWidth = doc.getTextWidth(pageText);

      const titleText      = entry.title;
      const titleTextWidth = doc.getTextWidth(titleText);

      const dotsWidth = Math.max(0, maxLineWidth - titleTextWidth - pageTextWidth);
      const dotW      = doc.getTextWidth('.');
      const dots      = dotW ? '.'.repeat(Math.floor(dotsWidth / dotW)) : '';

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


// Gruppiert Breakdown-Charts nach .pie-section-title (Issuer / Product / General)


function groupBreakdownChartsBySection(charts) {
  if (!charts || !charts.length) return [];

  const groupsMap = new Map();

  for (const ch of charts) {
    const el = document.getElementById(ch.id);
    if (!el) continue;

    // Nächster .pie-section Container im Breakdown-Panel
    const section = el.closest?.('.pie-section');
    let groupTitle = 'Breakdown';

    if (section) {
      const titleEl = section.querySelector('.pie-section-title');
      const txt = titleEl?.textContent?.trim();
      if (txt) groupTitle = txt;
    }

    if (!groupsMap.has(groupTitle)) {
      groupsMap.set(groupTitle, { title: groupTitle, charts: [] });
    }
    groupsMap.get(groupTitle).charts.push(ch);
  }

  return Array.from(groupsMap.values());
}



async function renderPanelSectionToPDF(doc, sec) {
  const pageW   = doc.internal.pageSize.getWidth();
  const pageH   = doc.internal.pageSize.getHeight();
  const marginX = 10;
  const marginY = 20;
  const gutter  = 10;

  let y = marginY;

  const sectionTitle       = sec.title || sec.key || '';
  const sectionNumber      = sec.sectionNumber || '';        // z.B. "1"
  const breakdownNumbering = sec.breakdownNumbering || null; // nur für breakdown

  // 🔹 SPEZIALFALL: Credit-Traffic-Lights-Section
  if (sec.isCreditTraffic || sec.key === 'creditTraffic') {
    await renderCreditTrafficSectionToPDF(doc, {
      sectionTitle,
      pageW,
      pageH,
      marginX,
      marginY,
    });
    return; // keine Charts/Tables für diese Section rendern
  }

  // 🔹 SPEZIALFALL: Market-Traffic-Lights-Section
  if (sec.isMarketTraffic || sec.key === 'marketTraffic') {
    await renderMarketTrafficSectionToPDF(doc, {
      sectionTitle,
      pageW,
      pageH,
      marginX,
      marginY,
    });
    return;
  }

  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  // Plotly → PNG
  async function plotlyToPngData(el) {
    if (!el || typeof Plotly === "undefined") return null;

    for (let i = 0; i < 10; i++) {
      try {
        if (el._fullLayout) break;
      } catch {}
      await sleep(40);
    }

    try {
      const exportWidth  = Math.max(900, el.clientWidth  || 900);
      const exportHeight = Math.max(520, el.clientHeight || 520);

      const dataUrl = await Plotly.toImage(el, {
        format: "png",
        width:  exportWidth,
        height: exportHeight,
        scale: 2,
      });

      return { dataUrl, width: exportWidth, height: exportHeight };
    } catch (e) {
      console.warn("[PDF] Plotly export failed for", el.id, e);
      return null;
    }
  }

  // Canvas → PNG
  function canvasToPngData(canvas) {
    if (!canvas) return null;

    try {
      let srcW = canvas.width;
      let srcH = canvas.height;

      if (!srcW || !srcH) {
        const rect = canvas.getBoundingClientRect();
        srcW = rect.width  || 900;
        srcH = rect.height || 520;
      }

      const dataUrl = canvas.toDataURL("image/png");
      return { dataUrl, width: srcW, height: srcH };
    } catch (e) {
      console.warn("[PDF] Canvas export failed for", canvas?.id, e);
      return null;
    }
  }

  // Pagebreak-Helper (nicht für Breakdown genutzt)
  function ensurePageSpace(needsHeight) {
    if (y + needsHeight <= pageH - marginY) return;
    doc.addPage();
    y = marginY;
    doc.setFontSize(14);
    doc.text(`${sectionTitle} (cont.)`, marginX, y);
    y += 12;
  }

  const chartsAll  = sec.enabledCharts || [];
  const tablesAll  = sec.enabledTables || [];
  const chartWidth = (pageW - marginX * 2 - gutter) / 2;
  const isBreakdown = sec.key === 'breakdown';

  // ─────────────────────────────────────────────
  // BREAKDOWN – pro Pie + Legend eine Seite, mit Hierarchie-Überschriften
  // ─────────────────────────────────────────────
  if (isBreakdown) {
    const legendByChartId = new Map();
    tablesAll.forEach(t => {
      if (!t.id) return;
      const m = t.id.match(/^(.*)-legend$/i);
      if (!m) return;
      legendByChartId.set(m[1], t);
    });

    const groups = groupBreakdownChartsBySection(chartsAll);
    const blocks = [];

    if (groups && groups.length) {
      for (const g of groups) {
        (g.charts || []).forEach(ch => {
          blocks.push({ chart: ch, groupTitle: g.title });
        });
      }
    } else {
      chartsAll.forEach(ch => blocks.push({ chart: ch, groupTitle: null }));
    }

    let blockIndex     = 0;
    let firstPageOfSec = true;
    let lastGroupTitle = null;

    for (const { chart, groupTitle } of blocks) {
      // ── Seitenwechsel pro Block ──
      if (blockIndex === 0) {
        y = marginY;          // erste Seite der Section
      } else {
        doc.addPage();
        y = marginY;
      }

      // 1) Abschnittsüberschrift nur einmal
      if (firstPageOfSec) {
        doc.setFontSize(14);
        if (sectionNumber) {
          doc.text(`${sectionNumber}. ${sectionTitle}`, marginX, y);
        } else {
          doc.text(sectionTitle, marginX, y);
        }
        y += 8;
        firstPageOfSec = false;
      }

      // 2) Gruppen-Überschrift nur bei Wechsel (Issuer / Product / General)
      if (groupTitle && groupTitle !== lastGroupTitle) {
        const gNo = breakdownNumbering?.groups[groupTitle];
        const groupHeading = gNo ? `${gNo}. ${groupTitle}` : groupTitle;
        doc.setFontSize(12);
        doc.text(groupHeading, marginX, y);
        y += 8;
        lastGroupTitle = groupTitle;
      }

      // 3) Nummer + Label der 3. Ebene (z.B. 1.1.1 Issuer) – direkt ÜBER dem Pie
      const chartMeta    = breakdownNumbering?.charts[chart.id];
      const chartLabel   = chartMeta?.label || chart.label || chart.id;
      const chartNumber  = chartMeta?.no;
      const chartHeading = chartNumber ? `${chartNumber}. ${chartLabel}` : chartLabel;

      doc.setFontSize(11);
      doc.text(chartHeading, marginX, y);
      y += 6;  // etwas Abstand zum Chart

      // --- Pie-Chart rendern (zentriert, innerhalb Box) ---
      const el = document.getElementById(chart.id);
      if (el) {
        let imgData = null;
        if (el.tagName === "CANVAS") {
          imgData = canvasToPngData(el);
        } else {
          imgData = await plotlyToPngData(el);
        }

        if (imgData && imgData.dataUrl) {
          const srcW = imgData.width  || 900;
          const srcH = imgData.height || 520;

          if (srcW && srcH) {
            const maxW = pageW - marginX * 2;
            const maxH = 90;

            const scale = Math.min(maxW / srcW, maxH / srcH, 1);

            const targetWidth  = srcW * scale;
            const targetHeight = srcH * scale;
            const boxHeight    = targetHeight + 22;

            const boxX   = marginX;
            const boxY   = y;
            const labelY = boxY + 7;
            const imgY   = boxY + 11;
            const imgX   = boxX + (maxW - targetWidth) / 2;

            // Label INSIDE Box: nur kurzer Name (ohne Nummer)
            const innerLabel = chartLabel;

            try {
              doc.setFillColor(245);
              doc.rect(boxX - 2, boxY, maxW + 4, boxHeight - 4, "F");

              doc.setFontSize(9);
              doc.text(innerLabel, boxX + maxW / 2, labelY, { align: "center" });

              doc.addImage(imgData.dataUrl, "PNG", imgX, imgY, targetWidth, targetHeight);
            } catch (e) {
              console.warn("[PDF] addImage failed for breakdown chart", chart.id, e);
            }

            y += boxHeight + 6;
          }
        }
      }

      // --- Legend-Tabelle direkt unter dem Pie ---
      const tMeta = legendByChartId.get(chart.id);
      if (tMeta) {
        const host = document.getElementById(tMeta.id);
        const tableElem =
          host && host.tagName && host.tagName.toLowerCase() === 'table'
            ? host
            : host?.querySelector?.('table');

        if (tableElem && typeof doc.autoTable === 'function') {
          const chartMeta2   = breakdownNumbering?.charts[chart.id];
          const chartLabel2  = chartMeta2?.label || chart.label || tMeta.label || tMeta.id;
          const chartNumber2 = chartMeta2?.no;

          const tableTitle = chartNumber2
            ? `${chartNumber2}. ${chartLabel2} Breakdown`
            : `${chartLabel2} Breakdown`;

          doc.setFontSize(10);
          doc.text(tableTitle, marginX, y);

          doc.autoTable({
            html: tableElem,
            startY: y + 6,
            theme: 'grid',
            styles: { fontSize: 8, cellPadding: 2 },
            headStyles: { fillColor: [245, 245, 245], textColor: [60, 60, 60] },
            alternateRowStyles: { fillColor: [255, 255, 255] },
            margin: { left: marginX, right: marginX },
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

              const x     = data.cell.x;
              const yCell = data.cell.y;
              const h     = data.cell.height;

              const size    = Math.min(h - 4, 8);
              const padY    = (h - size) / 2;
              const squareX = x + 4;
              const squareY = yCell + padY;

              doc.setFillColor(c[0], c[1], c[2]);
              doc.setDrawColor(200, 200, 200);
              doc.rect(squareX, squareY, size, size, 'FD');
            },
          });

          y = doc.lastAutoTable?.finalY ? doc.lastAutoTable.finalY + 10 : y + 60;
        }
      }

      blockIndex++;
    }

    return; // Breakdown komplett
  }

  // ─────────────────────────────────────────────
  // Standard-Sections (ohne Breakdown)
  // ─────────────────────────────────────────────

  doc.setFontSize(14);
  if (sectionNumber) {
    doc.text(`${sectionNumber}. ${sectionTitle}`, marginX, y);
  } else {
    doc.text(sectionTitle, marginX, y);
  }
  y += 12;

  let colInRow  = 0;
  let rowHeight = 0;

  const renderChartGroup = async (charts, groupTitle) => {
    if (!charts || !charts.length) return;

    if (groupTitle) {
      ensurePageSpace(10);
      doc.setFontSize(11);
      doc.text(groupTitle, marginX, y);
      y += 8;
    }

    for (const ch of charts) {
      const el = document.getElementById(ch.id);
      if (!el) continue;

      let imgData = null;
      if (el.tagName === "CANVAS") {
        imgData = canvasToPngData(el);
      } else {
        imgData = await plotlyToPngData(el);
      }
      if (!imgData || !imgData.dataUrl) continue;

      const srcW = imgData.width  || 900;
      const srcH = imgData.height || 520;
      if (!srcW || !srcH) continue;

      const maxW = chartWidth;
      const maxH = 90;

      const scale = Math.min(maxW / srcW, maxH / srcH, 1);

      const targetWidth  = srcW * scale;
      const targetHeight = srcH * scale;
      const blockHeight  = targetHeight + 22;

      ensurePageSpace(blockHeight + 10);

      const cellX  = marginX + colInRow * (chartWidth + gutter);
      const boxY   = y;
      const labelY = boxY + 7;
      const imgY   = boxY + 11;
      const imgX   = cellX + (chartWidth - targetWidth) / 2;

      try {
        doc.setFillColor(245);
        doc.rect(cellX - 2, boxY, chartWidth + 4, blockHeight - 4, "F");

        doc.setFontSize(9);
        doc.text(ch.label || ch.id, cellX + chartWidth / 2, labelY, { align: "center" });

        doc.addImage(imgData.dataUrl, "PNG", imgX, imgY, targetWidth, targetHeight);
      } catch (e) {
        console.warn("[PDF] addImage failed for", ch.id, e);
      }

      rowHeight = Math.max(rowHeight, blockHeight);

      colInRow++;
      if (colInRow >= 2) {
        colInRow  = 0;
        y        += rowHeight + 4;
        rowHeight = 0;
      }
    }

    if (colInRow !== 0) {
      y        += rowHeight + 4;
      colInRow  = 0;
      rowHeight = 0;
    }
  };

  await renderChartGroup(chartsAll, null);

  for (const t of tablesAll) {
    const tbl = extractTableFromContainer(t.id, { maxRows: 500, maxCols: 40 });
    if (!tbl) continue;

    ensurePageSpace(40);

    doc.setFontSize(11);
    doc.text(t.label || t.id, marginX, y);

    const head = (tbl.head && tbl.head.length) ? [tbl.head] : undefined;

    doc.autoTable({
      startY: y + 6,
      head,
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












function readCreditTrafficStatus() {
  const map = {};

  const defs = [
    { key: 'cvar', id: 'traffic-credit-cvar' },
    { key: 'tsi',  id: 'traffic-credit-tsi'  },
    { key: 'msd',  id: 'traffic-credit-msd'  },
  ];

  defs.forEach(d => {
    const el = document.getElementById(d.id);
    if (!el) return;

    // erwartet: el.dataset.status = 'red' | 'yellow' | 'green'
    const status = (el.dataset.status || '').toLowerCase();

    if (status === 'red' || status === 'yellow' || status === 'green') {
      map[d.key] = status;
    }
  });

  return map;
}

async function renderCreditTrafficSectionToPDF(doc, opts) {
  const { sectionTitle, pageW, pageH, marginX, marginY } = opts;

  let y = marginY;

  // Titel
  doc.setFontSize(14);
  doc.text(sectionTitle || 'Credit Risk – Traffic Lights', marginX, y);
  y += 8;

  // Beschreibung
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
  const rowPadding = 5;
  const rowHeight  = 14;
  const circleGap  = 14;

  // Platz prüfen
  const neededHeight = metrics.length * rowHeight + 12;
  if (y + neededHeight > pageH - marginY) {
    doc.addPage();
    y = marginY;
    doc.setFontSize(14);
    doc.text((sectionTitle || 'Credit Risk – Traffic Lights') + ' (cont.)', marginX, y);
    y += 6;
  }

  // Start X-Positionen
  const boxX = marginX;
  const labelX = boxX + 6;
  const circleStartX = boxX + 35;

  // -- pro Reihe: einzelne Mini-Card --
  metrics.forEach(m => {
    const active = statuses[m.key] || 'green';

    // Rahmenbox für die Reihe
    doc.setDrawColor(210, 210, 210);
    doc.setFillColor(250, 250, 250);
    doc.roundedRect(boxX, y, 80, rowHeight, 2, 2, 'FD');

    // Label
    doc.setFontSize(9);
    doc.setTextColor(50, 50, 50);
    doc.text(m.label + ':', labelX, y + rowHeight / 2 + 2);

    // Ampeln malen
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

  // -- Legende rechts --
  const legendX = marginX + 90;
  const legendY = marginY + 14;

  doc.setFontSize(8);
  doc.setTextColor(80, 80, 80);
  doc.text('Legend:', legendX, legendY);

  const legendEntries = [
    { label: 'Red = critical',    color: [220, 53, 69] },
    { label: 'Yellow = watch',    color: [255, 193, 7] },
    { label: 'Green = in range',  color: [40, 167, 69] },
  ];

  let ly = legendY + 5;
  legendEntries.forEach(entry => {
    doc.setFillColor(entry.color[0], entry.color[1], entry.color[2]);
    doc.setDrawColor(120, 120, 120);
    doc.rect(legendX, ly - 3, 3, 3, 'FD');
    doc.setTextColor(60, 60, 60);
    doc.text(entry.label, legendX + 6, ly);
    ly += 5;
  });
}

function readMarketTrafficStatus() {
  const el = document.getElementById('traffic-mvar');
  if (!el) return null;

  const status = (el.dataset.status || '').toLowerCase();
  if (status === 'red' || status === 'yellow' || status === 'green') {
    return status;
  }
  return null;
}

async function renderMarketTrafficSectionToPDF(doc, opts) {
  const { sectionTitle, pageW, pageH, marginX, marginY } = opts;

  let y = marginY;

  // Titel
  doc.setFontSize(14);
  doc.text(sectionTitle || 'Market Risk – Traffic Light', marginX, y);
  y += 8;

  // Beschreibung
  doc.setFontSize(10);
  doc.text('Summary of Market VaR / ES traffic light.', marginX, y);
  y += 6;

  const status = readMarketTrafficStatus() || 'green';

  const colors = [
    { name: 'red',    rgb: [220, 53, 69] },
    { name: 'yellow', rgb: [255, 193, 7] },
    { name: 'green',  rgb: [40, 167, 69] },
  ];

  const radius      = 3;
  const rowHeight   = 14;
  const circleGap   = 14;

  // Platz prüfen
  const neededHeight = rowHeight + 12;
  if (y + neededHeight > pageH - marginY) {
    doc.addPage();
    y = marginY;
    doc.setFontSize(14);
    doc.text((sectionTitle || 'Market Risk – Traffic Light') + ' (cont.)', marginX, y);
    y += 6;
  }

  const boxX           = marginX;
  const labelX         = boxX + 6;
  const circleStartX   = boxX + 35;

  // einzelne Mini-Card
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

  // Legende rechts daneben
  const legendX = marginX + 90;
  const legendY = marginY + 14;

  doc.setFontSize(8);
  doc.setTextColor(80, 80, 80);
  doc.text('Legend:', legendX, legendY);

  const legendEntries = [
    { label: 'Red = critical',    color: [220, 53, 69] },
    { label: 'Yellow = watch',    color: [255, 193, 7] },
    { label: 'Green = in range',  color: [40, 167, 69] },
  ];

  let ly = legendY + 5;
  legendEntries.forEach(entry => {
    doc.setFillColor(entry.color[0], entry.color[1], entry.color[2]);
    doc.setDrawColor(120, 120, 120);
    doc.rect(legendX, ly - 3, 3, 3, 'FD');
    doc.setTextColor(60, 60, 60);
    doc.text(entry.label, legendX + 6, ly);
    ly += 5;
  });
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
// ───────────── generisches Table-Extract (alle Spalten) ─────────────
function extractTableFromContainer(
  containerIds,
  {
    maxRows = 100,
    maxCols = 20,
  } = {}
) {
  const ids = Array.isArray(containerIds) ? containerIds : [containerIds];
  let host = null;

  // 1) Host anhand der ID(s) finden
  for (const id of ids) {
    const el = document.getElementById(id);
    if (el) {
      host = el;
      break;
    }
  }
  if (!host) return null;

  // 2) Host kann direkt eine <table> sein ODER ein Wrapper mit <table>
  const table =
    host.tagName && host.tagName.toLowerCase() === 'table'
      ? host
      : host.querySelector('table');

  if (!table) return null;

  // 3) Header finden
  let headCells = Array.from(table.querySelectorAll('thead th')).slice(0, maxCols);
  let head = headCells.map(th => (th.textContent || '').trim());

  // 4) Body finden
  let rows = Array.from(table.querySelectorAll('tbody tr'));

  // Fallback: wenn kein <tbody>
  if (!rows.length) {
    const allRows = Array.from(table.querySelectorAll('tr'));
    if (allRows.length) {
      if (!head.length) {
        const first = Array.from(allRows[0].children).slice(0, maxCols);
        head = first.map(c => (c.textContent || '').trim());
        rows = allRows.slice(1);
      } else {
        rows = allRows;
      }
    }
  }

  rows = rows.slice(0, maxRows);

  // 5) Body-Zellen extrahieren
  const body = rows.map(tr => {
    const cells = Array.from(tr.children).slice(0, maxCols);
    return cells.map(td => (td.textContent || '').trim());
  });

  // 6) Falls Header leer aber Body existiert
  if (!head.length && body.length) {
    head = body[0].map((_, i) => `COL ${i + 1}`);
  }

  if (!head.length && !body.length) return null;

  return { head, body };
}









