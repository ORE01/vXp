const { jsPDF } = window.jspdf;

//PORTFOLIO BREAKDOWN:

// REPORT_DEFAULTS – CreditRisk als Objekt mit Subtoggle "details"
export const REPORT_DEFAULTS = {
  includeTOC: true,
  sections: {
    portfolioBreakdown: { enabled: true, issuer: true, product: true, general: true },
    performance:        true,
    marketRisk:         { enabled: true, details: true, sensitivities: true },
    creditRisk:         { enabled: true, details: true },
    liquidity:          { enabled: true },

    marketData:         { enabled: true, interestRates: true, creditSpreads: true },

    // 🆕 Historic-Block – einfache Default-Config
    historic:           { enabled: true },

    appendixProducts:   true,
  },
  fileName: 'Risk.pdf',
  paper: 'a4',
  orientation: 'p',
};


// Zuordnung Spalte → Gruppe
const BD_GROUP_OF = {
  ISSUER: 'issuer',
  RATING: 'issuer',
  RANK: 'issuer',
  RATINGres: 'product',
  CATEGORY: 'product',
  CouponType: 'product',
  Depotbank: 'general'
};

// Gruppen → Spalten (für PDF/Preview-Gruppenüberschriften)
const BD_GROUPS_ORDERED = {
  issuer:  ['ISSUER','RATING','RANK'],
  product: ['RATINGres','CATEGORY','CouponType'],
  general: ['Depotbank']
};





 //generateRiskPDF

export function generateRiskPDF(filteredData, overrides = {}) {
  // Optionen mergen (flach + für marketData & marketRisk)
// generateRiskPDF(...)
const opts = {
  ...REPORT_DEFAULTS,
  ...overrides,
  sections: {
    ...REPORT_DEFAULTS.sections,
    ...(overrides.sections || {}),
    marketData: {
      ...REPORT_DEFAULTS.sections.marketData,
      ...(overrides.sections?.marketData || {}),
    },
    marketRisk: {
      ...REPORT_DEFAULTS.sections.marketRisk,
      ...(overrides.sections?.marketRisk || {}),
    },
    creditRisk: {
      ...REPORT_DEFAULTS.sections.creditRisk,
      ...(overrides.sections?.creditRisk || {}),
    },
    // ⬇️ NEU: Liquidity sauber mergen
    liquidity: {
      ...REPORT_DEFAULTS.sections.liquidity,
      ...(overrides.sections?.liquidity || {}),
    },
  },
};



  const doc = new jsPDF({ orientation: opts.orientation, format: opts.paper });
  const totalPagesExp = '{total_pages_count_string}';

// TOC
const tocEntries = [];
let sectionCounters = [];

function addTOCEntry(title, page, level = 1) {
  if (!opts.includeTOC) return;

  // clamp + normalize level
  level = Math.max(1, Math.min(3, (level | 0) || 1));

  // trim to level (drop deeper counters) or seed zeros up to level
  if (sectionCounters.length >= level) {
    sectionCounters = sectionCounters.slice(0, level);
  } else {
    while (sectionCounters.length < level) sectionCounters.push(0);
  }

  // increment the current level
  sectionCounters[level - 1]++;

  const sectionNumber = sectionCounters.join('.');
  tocEntries.push({ title: `${sectionNumber}. ${title}`, page, level });
}



// Portfolio Breakdown
  if (opts.sections.portfolioBreakdown) {
    addTOCEntry('Portfolio Breakdown', doc.internal.getNumberOfPages(), 1);
    drawPieChartsSection(doc, filteredData);
  }
// Performance
  if (opts.sections.performance) {
    addTOCEntry('Performance Charts', doc.internal.getNumberOfPages(), 1);
    drawPerformanceSection(doc);
  }
// Market Risk: 
  const mr = opts.sections.marketRisk;
  if (mr?.enabled) {
    // L1 parent
    addTOCEntry('Market Risk', doc.internal.getNumberOfPages(), 1);

    // helper to add L2 entries under "Market Risk"
    const addMRSub = (title) => addTOCEntry(title, doc.internal.getNumberOfPages(), 2);

    // base charts always
    drawMarketRiskSection(doc, {
      includeDetails: !!mr.details,
      addTOC: mr.details ? () => addMRSub('Details') : null, // L2 "Details" right before details content
    });

    // optional L2 Sensitivities subsection
    if (mr.sensitivities) {
      addMRSub('Sensitivities'); // L2 child
      drawSensitivitiesSection(doc);
    }
  }
// Credit Risk
  const cr = opts.sections.creditRisk;
  if (cr?.enabled) {
    addTOCEntry('Credit Risk', doc.internal.getNumberOfPages(), 1); // -> 4.
    if (cr.details) {
      addTOCEntry('Details', doc.internal.getNumberOfPages(), 2);   // -> 4.1
    }
    drawCreditRiskSection(doc);
  }
  // Liquidity
  if (opts.sections.liquidity?.enabled) {
    addTOCEntry('Liquidity', doc.internal.getNumberOfPages(), 1);
    drawLiquiditySection(doc);
  }
// Market Data
  if (opts.sections.marketData?.enabled) {
    addTOCEntry('Market Data', doc.internal.getNumberOfPages(), 1); // -> 5.

    // add children as level 2
    const addMD = (t) => addTOCEntry(t, doc.internal.getNumberOfPages(), 2);

    if (opts.sections.marketData.interestRates) addMD('Interest Rates'); // -> 5.1
    if (opts.sections.marketData.creditSpreads) addMD('Credit Spreads'); // -> 5.2

    // draw section (do NOT add extra TOC entries inside this function)
    drawMarketDataSection(doc, () => {}, {
      interestRates: !!opts.sections.marketData.interestRates,
      creditSpreads: !!opts.sections.marketData.creditSpreads,
    });
  }
// Appendix
  if (opts.sections.appendixProducts) {
    addTOCEntry('Appendix: Product Table', doc.internal.getNumberOfPages(), 1);
    drawProductTableSection(doc, filteredData);
  }
// Seitenzahlen
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.text(
      `Page ${i} / ${totalPagesExp}`,
      doc.internal.pageSize.getWidth() - 30,
      doc.internal.pageSize.getHeight() - 10
    );
  }
// TOC-Seite nur wenn aktiviert
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

      const pageText = (entry.page + 1).toString();
      const pageTextWidth = doc.getTextWidth(pageText);

      const titleText = entry.title;
      const titleTextWidth = doc.getTextWidth(titleText);

      const dotsWidth = Math.max(0, maxLineWidth - titleTextWidth - pageTextWidth);
      const dotW = doc.getTextWidth('.');
      const dots = dotW ? '.'.repeat(Math.floor(dotsWidth / dotW)) : '';

      doc.text(`${titleText} ${dots} ${pageText}`, marginLeft, lineY);
    });
  }

  doc.save(opts.fileName || 'Risk.pdf');
}


function drawPieChartsSection(doc, filteredData) {
  // ===== Setup & Überschrift =====
  doc.setFontSize(14);
  doc.text('Portfolio Breakdown', 14, 20);

  const pageWidth  = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 10;
  const marginY = 20;

  const chartsPerRow   = 3;
  const chartPadding   = 10;
  const maxChartAreaWidth = (pageWidth - marginX * 2 - chartPadding * (chartsPerRow - 1)) / chartsPerRow;

  let y = marginY + 10;
  let x = marginX;
  let colInRow = 0;

  // ===== Optionen lesen (kompatibel zu alter Struktur) =====
  const opts = (typeof getRiskReportOptions === 'function') ? getRiskReportOptions() : { sections: { portfolioBreakdown: true } };
  let bd = opts?.sections?.portfolioBreakdown;

  // Backward-Compat: bool -> alles an
  if (typeof bd === 'boolean') {
    bd = { enabled: !!bd, issuer: true, product: true, general: true };
  } else if (typeof bd !== 'object' || bd == null) {
    bd = { enabled: true, issuer: true, product: true, general: true };
  } else {
    bd.enabled = bd.enabled !== false;
    bd.issuer  = bd.issuer  !== false;
    bd.product = bd.product !== false;
    bd.general = bd.general !== false;
  }

  if (!bd.enabled) { doc.addPage(); return; }

  // ===== Mapping (lokal, keine weiteren Änderungen nötig) =====
  const GROUPS = {
    Issuer:  ['ISSUER', 'RATING', 'RANK'],
    Product: ['RATINGres', 'CATEGORY', 'CouponType'],
    General: ['Depotbank'],
  };
  const GROUP_ENABLED = {
    Issuer:  bd.issuer,
    Product: bd.product,
    General: bd.general,
  };
  const TITLE_MAP = {
    ISSUER: 'Issuer',
    RATING: 'Issuer General Rating',
    RANK: 'Issuer Capital Structure',
    RATINGRES: 'Product Ratings',
    CATEGORY: 'Product Categories',
    COUPONTYPE: 'Product Coupon Type',
    DEPOTBANK: 'Depot Bank'
  };

  // Per-Chart-Checkbox (optional)
  const isColSelected = (col) => {
    const el = document.getElementById('rr-bd-' + col);
    return el ? !!el.checked : true;
  };

  // ===== Helpers =====
  const addGroupHeading = (title) => {
    if (y + 16 > pageHeight - marginY) {
      doc.addPage();
      y = marginY;
      x = marginX;
      colInRow = 0;
    }
    doc.setFontSize(12);
    doc.text(title, marginX + 4, y);
    y += 8;
    doc.setDrawColor(180);
    doc.line(marginX + 4, y, pageWidth - marginX - 4, y);
    y += 6;
    x = marginX;
    colInRow = 0;
  };

  const addChart = (canvas, title) => {
    const canvasWidth  = canvas.width;
    const canvasHeight = canvas.height;
    if (!canvasWidth || !canvasHeight) return;

    const aspectRatio = canvasWidth / canvasHeight;
    const chartWidth  = maxChartAreaWidth;
    const chartHeight = chartWidth / aspectRatio;

    if (y + chartHeight + 16 > pageHeight - marginY) {
      doc.addPage();
      y = marginY;
      x = marginX;
      colInRow = 0;
    }

    // Hintergrundkasten
    doc.setFillColor(240);
    doc.rect(x - 2, y - 2, chartWidth + 4, chartHeight + 16, 'F');

    // Titel
    doc.setFontSize(9);
    doc.setTextColor(0);
    doc.text(title, x + chartWidth / 2, y - 4, { align: 'center' });

    // Bild
    try {
      const imageData = canvas.toDataURL('image/png');
      doc.addImage(imageData, 'PNG', x, y, chartWidth, chartHeight);
    } catch (err) {
      console.warn('Fehler beim Einbetten von Canvas', canvas.id, err);
    }

    // Position updaten
    x += chartWidth + chartPadding;
    colInRow++;
    if (colInRow % chartsPerRow === 0) {
      x = marginX;
      y += chartHeight + chartPadding + 16;
      colInRow = 0;
    }
  };

  // ===== Gruppen in fester Reihenfolge rendern =====
  ['Issuer', 'Product', 'General'].forEach(groupName => {
    if (!GROUP_ENABLED[groupName]) return;

    // Prüfe, ob in dieser Gruppe überhaupt etwas zu rendern ist
    const cols = GROUPS[groupName].filter(col => {
      if (!isColSelected(col)) return false;
      const cv = document.getElementById(col.toLowerCase() + 'PieChart');
      return !!(cv && cv.width && cv.height);
    });
    if (!cols.length) return;

    addGroupHeading(groupName);

    cols.forEach(col => {
      const canvas = document.getElementById(col.toLowerCase() + 'PieChart');
      const title  = TITLE_MAP[col.toUpperCase()] || col.toUpperCase();
      if (canvas) addChart(canvas, title);
    });

    // Kleine Luft zwischen Gruppen, wenn Reihe nicht sauber abgeschlossen
    if (colInRow !== 0) {
      x = marginX;
      y += 8;
      colInRow = 0;
    }
  });

  // Platz für nächste Sektion (wie bisher)
  doc.addPage();
}

//PERFORMANCE:
function drawPerformanceSection(doc) {
  const chartIds = [
    'euswapPortfolioYieldChart',
    'euswapProductYieldChart',
    'durationSwapChart',
    'durationProductYieldChart'
  ];

  const chartTitles = [
    'Portfolio Yield vs Maturity',
    'Product Yields vs Maturity',
    'Portfolio Yield vs Duration',
    'Product Yields vs Duration'
  ];

  const chartWidth = 80;
  const chartHeight = 60;
  const padding = 10;
  const startX = 10;
  let x = startX;
  let y = 30;

  doc.setFontSize(14);
  doc.text('Performance Charts', 14, 20);

  chartIds.forEach((id, i) => {
    const canvas = document.getElementById(id);
    if (!canvas) return;

    const imageData = canvas.toDataURL('image/png');

    if (y + chartHeight > doc.internal.pageSize.getHeight() - 20) {
      doc.addPage();
      y = 20;
    }

    doc.setFillColor(240);
    doc.rect(x - 2, y - 2, chartWidth + 4, chartHeight + 12, 'F');
    doc.setFontSize(10);
    doc.text(chartTitles[i], x + chartWidth / 2, y - 4, { align: 'center' });
    doc.addImage(imageData, 'PNG', x, y, chartWidth, chartHeight);

    if (i % 2 === 0) {
      x += chartWidth + padding;
    } else {
      x = startX;
      y += chartHeight + padding + 12;
    }
  });

  doc.addPage();
}
// MARKET RISK:
function drawMarketRiskSection(doc, { includeDetails = true, addTOC = null } = {}) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginX = 10, marginY = 20, gutter = 10;

  let y = marginY;

  // Title
  doc.setFontSize(14);
  doc.text('Market Risk', marginX + 4, y);
  y += 10;

// === Nur für PDF: erst Szenarien, dann NUR Summary aus MVaRDataContainer0 ===
(() => {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginX = 10, marginY = 20;

  // 1) Eingabentabelle (Szenarien)
  const tblInputs = extractTableFromContainer('inputMVaRContainer', { maxRows: 200, maxCols: 50 });
  if (tblInputs && tblInputs.body.length) {
    if (y + 40 > pageH - marginY) { doc.addPage(); y = marginY; }
    doc.setFontSize(11);
    doc.text('Market VaR — Scenarios', marginX + 4, y);
    doc.autoTable({
      startY: y + 6,
      head: [tblInputs.head],
      body: tblInputs.body,
      styles: { fontSize: 8, cellPadding: 2 },
      theme: 'grid',
      headStyles: { fillColor: [34,34,34], textColor: [220,220,220] },
      alternateRowStyles: { fillColor: [245,245,245] },
      margin: { left: marginX, right: marginX },
      tableWidth: 'auto'
    });
    y = (doc.lastAutoTable?.finalY || y) + 8;
  }

  // 2) Nur die neue Summary (Container0) – KEIN Fallback auf MVaRDataContainer
  const tblSum0 = extractTableFromContainer('MVaRDataContainer0', { maxRows: 200, maxCols: 10 });
  if (tblSum0 && tblSum0.body.length) {
    if (y + 40 > pageH - marginY) { doc.addPage(); y = marginY; }
    doc.setFontSize(11);
    doc.text('VaR/ES Summary', marginX + 4, y);
    doc.autoTable({
      startY: y + 6,
      head: [tblSum0.head],
      body: tblSum0.body,
      styles: { fontSize: 8, cellPadding: 2 },
      theme: 'grid',
      headStyles: { fillColor: [34,34,34], textColor: [220,220,220] },
      alternateRowStyles: { fillColor: [245,245,245] },
      margin: { left: marginX, right: marginX },
      tableWidth: 'auto'
    });
    y = (doc.lastAutoTable?.finalY || y) + 10;
  }
})();




  // Top row: CMB & P/L
  const top = [
    { id: 'tsEU1YChart',     title: 'Constant Maturity Bond (CMB)' },
    { id: 'plMvarDistChart', title: 'P/L Distribution' }
  ];
  const w = (pageW - marginX*2 - gutter) / 2;
  const h = 60;

  top.forEach((c, i) => {
    const cv = document.getElementById(c.id);
    if (!cv || !cv.width || !cv.height) return;
    try {
      const img = cv.toDataURL('image/png');
      const x = marginX + i * (w + gutter);
      doc.setFillColor(240);
      doc.rect(x - 2, y - 2, w + 4, h + 12, 'F');
      doc.setFontSize(9);
      doc.text(c.title, x + w/2, y - 4, { align: 'center' });
      doc.addImage(img, 'PNG', x, y, w, h);
    } catch {}
  });

  y += h + 16;

  if (includeDetails) {
    if (typeof addTOC === 'function') addTOC(); // L2 "Details"

    const mvarCv = document.getElementById('MVaRChart') || document.getElementById('MVaRChart0');
    if (mvarCv && mvarCv.width && mvarCv.height) {
      if (y + 70 > pageH - marginY) { doc.addPage(); y = marginY; }
      try {
        const img = mvarCv.toDataURL('image/png');
        const mvW = pageW - marginX*2, mvH = 60;
        doc.setFillColor(240);
        doc.rect(marginX - 2, y - 2, mvW + 4, mvH + 12, 'F');
        doc.setFontSize(9);
        doc.text('Market VaR Chart', marginX + mvW/2, y - 4, { align: 'center' });
        doc.addImage(img, 'PNG', marginX, y, mvW, mvH);
        y += mvH + 16;
      } catch {}
    }

    // MVaR Tabelle (generisch)
    const tbl = extractTableFromContainer(['MVaRDataContainer','MVaRDataContainer0'], { maxRows: 200, maxCols: 50 });
    if (tbl && tbl.body.length) {
      if (y + 40 > pageH - marginY) { doc.addPage(); y = marginY; }
      doc.setFontSize(11);
      doc.text('MVaR Summary', marginX + 4, y);
      doc.autoTable({
        startY: y + 6,
        head: [tbl.head],
        body: tbl.body,
        styles: { fontSize: 9, cellPadding: 2 },
        theme: 'grid',
        headStyles: { fillColor: [34,34,34], textColor: [220,220,220] },
        alternateRowStyles: { fillColor: [245,245,245] },
        margin: { left: marginX, right: marginX }
      });
      y = doc.lastAutoTable?.finalY ? doc.lastAutoTable.finalY + 10 : y + 60;
    }
  }

  // KEIN blindes addPage() hier — die nächste Sektion entscheidet selbst
}

// Sensitivities (PV01/CPV01) 
function drawSensitivitiesSection(doc) {
  // 👉 Neue Seite in Landscape, damit 33 Spalten Platz haben
  doc.addPage('l');

  const pageW   = doc.internal.pageSize.getWidth();
  const pageH   = doc.internal.pageSize.getHeight();
  const marginX = 10, marginY = 20, gutter = 10;

  const pv = document.getElementById('PV01Chart')  || document.getElementById('PV01Chart0');
  const cp = document.getElementById('CPV01Chart') || document.getElementById('CPV01Chart0');
  const hasAnyChart = !!(pv || cp);

  // Tabelle aus dem DOM ziehen (liest .irsens-table vollständig, inkl. 1..30y)
  const pvTbl = extractIRSensFromDOM(['IRSensDataContainer', 'IRSensDataContainer0']);

  // Wenn weder Charts noch Tabelle vorhanden, abbrechen
  if (!hasAnyChart && !(pvTbl && pvTbl.body.length)) return;

  let y = marginY;

  // Titel
  doc.setFontSize(14);
  doc.text('Sensitivities', marginX + 4, y);
  y += 10;

  // Charts nebeneinander
  const w = (pageW - marginX*2 - gutter) / 2;
  const h = 60;

  const addChart = (canvas, title, x) => {
    if (!canvas) return;
    try {
      const img = canvas.toDataURL('image/png');
      doc.setFillColor(240);
      doc.rect(x - 2, y - 2, w + 4, h + 12, 'F');
      doc.setFontSize(9);
      doc.text(title, x + w/2, y - 4, { align: 'center' });
      doc.addImage(img, 'PNG', x, y, w, h);
    } catch (e) {
      console.warn('Sens chart error:', title, e);
    }
  };

  addChart(pv, 'PV01', marginX);
  addChart(cp, 'CPV01', marginX + w + gutter);
  if (hasAnyChart) y += h + 16;

  // Platz prüfen vor Tabelle
  if (y > pageH - 80) { doc.addPage('l'); y = marginY; }

  // PV01/IR-Sensitivitäten-Tabelle (ALLE 30 Jahre)
// ---- PV01/IR-Sensitivitäten-Tabelle (ALLE 30 Jahre)
if (pvTbl && pvTbl.body.length) {
  doc.setFontSize(11);
  doc.text('PV01 Table', marginX + 4, y);

  // ⬇️ Nur 15 Spalten behalten: [0]=Year, [1]=Sum, [2..14]=1y..13y
  const keepCols = [0, 1, ...Array.from({ length: 13 }, (_, i) => i + 2)];
  const head15 = keepCols.map(i => pvTbl.head[i]).filter(v => v != null);
  const body15 = pvTbl.body.map(row => keepCols.map(i => row[i]));

  doc.autoTable({
    startY: y + 6,
    head: [head15],
    body: body15,
    theme: 'grid',
    styles: {
      fontSize: 7,
      cellPadding: 1.2,
      halign: 'right',
      overflow: 'linebreak'
    },
    headStyles: {
      fillColor: [34,34,34],
      textColor: [220,220,220],
      halign: 'center'
    },
    alternateRowStyles: { fillColor: [245,245,245] },
    margin: { left: marginX, right: marginX },
    tableWidth: 'auto',
    columnStyles: {
      0: { halign: 'left',  cellWidth: 26 }, // Year
      1: { halign: 'right', cellWidth: 18 }, // Sum
      // rest automatisch
    }
  });

  y = doc.lastAutoTable?.finalY ? doc.lastAutoTable.finalY + 10 : y + 60;
}


  // ❌ kein addPage() hier – nächste Sektion entscheidet selbst
// ✅ DOCH: eigene Seite für Credit Risk reservieren (Portrait),
// aber nur wenn wir hier wirklich etwas gerendert haben:
if (hasAnyChart || (pvTbl && pvTbl.body.length)) {
  doc.addPage('p'); // neue Seite in Portrait für die nächste Sektion (Credit Risk)
}

}


function extractIRSensFromDOM(containerIds = []) {
  let tblEl = null;

  for (const id of containerIds) {
    const c = document.getElementById(id);
    if (!c) continue;
    const found = c.querySelector('table.irsens-table');
    if (found) { tblEl = found; break; }
  }

  if (!tblEl) {
    // Fallback: irgendwo im DOM?
    tblEl = document.querySelector('table.irsens-table');
  }
  if (!tblEl) return null;

  const rows = Array.from(tblEl.querySelectorAll('tr'));
  if (rows.length < 3) return null;

  // Header aus der ZWEITEN Zeile (erste ist der Titel mit colspan)
  let headCells = [];
  if (rows[0].querySelectorAll('th').length > 1) {
    // Falls doch schon die erste Zeile reguläre Köpfe enthält
    headCells = Array.from(rows[0].children).map(c => (c.textContent || '').trim());
  } else {
    // Normale Struktur: use rows[1]
    headCells = Array.from(rows[1].children).map(c => (c.textContent || '').trim());
  }

  // Body: NIMM die nächsten 3 Zeilen, falls vorhanden
  const body = [];
  const startIdx = headCells.length > 1 ? 2 : 1; // je nach Header-Zeile
  for (let i = startIdx; i < Math.min(rows.length, startIdx + 3); i++) {
    const tds = Array.from(rows[i].children).map(td => (td.textContent || '').trim());
    // Falls „bp“ oder „%“ angehängt sind, einfach als String belassen; AutoTable rendert sie
    body.push(tds);
  }

  return { head: headCells, body };
}


//CREDIT RISK:
function drawCreditRiskSection(doc) {
  const canvas1 = document.getElementById('LossIssuerCombinedChart');     // 🔁 Reihenfolge getauscht
  const canvas2 = document.getElementById('LossIssuerCombinedESChart');

  const chartWidth = 90;
  const chartHeight = 80;
  const x1 = 10;
  const x2 = 110; // 10 + chartWidth + 10 Puffer
  const y = 30;

  doc.setFontSize(14);
  doc.text('Credit Risk', 14, 20);

  if (canvas1 && canvas2) {
    const img1 = canvas1.toDataURL('image/png');
    const img2 = canvas2.toDataURL('image/png');

    doc.addImage(img1, 'PNG', x1, y, chartWidth, chartHeight);
    doc.addImage(img2, 'PNG', x2, y, chartWidth, chartHeight);
  }

  doc.addPage();
}
//LIQUIDITY:
function drawLiquiditySection(doc) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginX = 10, marginY = 20;
  let y = marginY;

  doc.setFontSize(14);
  doc.text('Liquidity', marginX + 4, y);
  y += 10;

  // Chart (optional)
  const liquCanvas = document.getElementById('liquChart');
  if (liquCanvas && liquCanvas.width && liquCanvas.height) {
    try {
      const w = pageW - marginX * 2;
      const h = 70;
      const img = liquCanvas.toDataURL('image/png');
      doc.setFillColor(240);
      doc.rect(marginX - 2, y - 2, w + 4, h + 12, 'F');
      doc.setFontSize(9);
      doc.text('Liquidity Chart', marginX + w / 2, y - 4, { align: 'center' });
      doc.addImage(img, 'PNG', marginX, y, w, h);
      y += h + 16;
    } catch {}
  }

  // Tabelle 1: Fälligkeiten × Kategorien
  const tbl1 = extractTableFromContainer('liquDataContainer', { maxRows: 200, maxCols: 30 });
  if (tbl1 && tbl1.body.length) {
    if (y + 40 > pageH - marginY) { doc.addPage(); y = marginY; }
    doc.setFontSize(11);
    doc.text('Maturities × Categories', marginX + 4, y);
    doc.autoTable({
      startY: y + 6,
      head: [tbl1.head],
      body: tbl1.body,
      styles: { fontSize: 9, cellPadding: 2 },
      theme: 'grid',
      headStyles: { fillColor: [34,34,34], textColor: [220,220,220] },
      alternateRowStyles: { fillColor: [245,245,245] },
      margin: { left: marginX, right: marginX },
    });
    y = doc.lastAutoTable?.finalY ? doc.lastAutoTable.finalY + 10 : y + 60;
  }

  // Tabelle 2: Emittenten
  const tbl2 = extractTableFromContainer('issuerDataContainerLiqu', { maxRows: 200, maxCols: 30 });
  if (tbl2 && tbl2.body.length) {
    if (y + 40 > pageH - marginY) { doc.addPage(); y = marginY; }
    doc.setFontSize(11);
    doc.text('Issuers', marginX + 4, y);
    doc.autoTable({
      startY: y + 6,
      head: [tbl2.head],
      body: tbl2.body,
      styles: { fontSize: 9, cellPadding: 2 },
      theme: 'grid',
      headStyles: { fillColor: [34,34,34], textColor: [220,220,220] },
      alternateRowStyles: { fillColor: [245,245,245] },
      margin: { left: marginX, right: marginX },
    });
    y = doc.lastAutoTable?.finalY ? doc.lastAutoTable.finalY + 10 : y + 60;
  }

  // Platz für nächste Sektion
  doc.addPage();
}


//MARKET DATA:
function drawMarketDataSection(doc, addTOCEntry, flags = { interestRates: true, creditSpreads: true }) {
  // ⚠️ KEIN Top-Level TOC hier – das kommt schon aus generateRiskPDF
  let y = 30;

  // 5.1 Interest Rates
  if (flags.interestRates) {
    addTOCEntry('Interest Rates', doc.internal.getNumberOfPages(), 2);
    doc.setFontSize(12);
    doc.text('Interest Rates', 14, y);
    y += 10;

    const irCanvas = document.getElementById('IRLineChart');
    if (irCanvas) {
      const irImg = irCanvas.toDataURL('image/png');
      doc.addImage(irImg, 'PNG', 10, y, 180, 80);
      y += 90;
    }

    // Seitenumbruch wenn nötig
    if (y > doc.internal.pageSize.getHeight() - 100) {
      doc.addPage(); y = 30;
    }
  }

  // 5.2 Credit Spreads
  if (flags.creditSpreads) {
    addTOCEntry('Credit Spreads', doc.internal.getNumberOfPages(), 2);
    doc.setFontSize(12);
    doc.text('Credit Spreads', 14, y);
    y += 10;

    const csCanvas = document.getElementById('CS_ChartCanvas');
    if (csCanvas) {
      const csImg = csCanvas.toDataURL('image/png');
      doc.addImage(csImg, 'PNG', 10, y, 180, 80);
      y += 90;
    }
  }

  // Platz für nächste Sektion
  doc.addPage();
}

//ANHANG:
function drawProductTableSection(doc, filteredData) {
  const riskData = extractProductRiskData(filteredData);
  doc.setFontSize(14);
  doc.text('Anhang: Produkt-Tabelle', 14, 20);

  const tableData = riskData.map(item => [
    item.PROD_ID,
    item.DESCRIPTION,
    item.ISSUER,
    item.NOTIONAL,
    item.NAV
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

  // Header
  const theadCells = Array.from(table.querySelectorAll('thead th'));
  let head = theadCells.slice(0, maxCols).map(th => (th.textContent || '').trim());

  // Body rows
  let rows = [];
  const tbody = table.querySelector('tbody');
  rows = tbody ? Array.from(tbody.querySelectorAll('tr')) : Array.from(table.querySelectorAll('tr'));

  // Fallback: if no thead, use first tr as header
  if (!head.length && rows.length) {
    const firstCells = Array.from(rows[0].children).slice(0, maxCols);
    head = firstCells.map(c => (c.textContent || '').trim());
    rows = rows.slice(1);
  }

// helper: cell text with radio support
const cellText = (td) => {
  const radios = td.querySelectorAll('input[type="radio"]');
  if (radios.length) {
    const checked = Array.from(radios).some(r => r.checked);
    // Marker statt Unicode: wird in AutoTable gehookt und gezeichnet
    return checked ? 'X' : '';
  }
  return (td.textContent || '').trim();
};


  const body = [];
  rows.slice(0, maxRows).forEach(tr => {
    const cells = Array.from(tr.children).slice(0, maxCols);
    const row = cells.map(td => cellText(td));
    if (row.some(v => v !== '')) body.push(row);
  });

  if (!head.length && body.length) {
    head = body[0].map((_, i) => `COL ${i+1}`);
  }

  return (head.length || body.length) ? { head, body } : null;
}





