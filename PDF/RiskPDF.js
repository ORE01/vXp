const { jsPDF } = window.jspdf;


export function generateRiskPDF(filteredData) {
  const doc = new jsPDF();
  const totalPagesExp = '{total_pages_count_string}';

  // Table of Contents (TOC)
  const tocEntries = [];
  const sectionCounters = [];

  // 🔢 TOC-Eintrag mit automatischer Nummerierung
  function addTOCEntry(title, page, level = 1) {
    // Stelle sicher, dass wir genug Zähler-Ebenen haben
    while (sectionCounters.length < level) sectionCounters.push(0);

    // Erhöhe aktuelle Ebene
    sectionCounters[level - 1]++;

    // Setze tiefere Ebenen zurück
    for (let i = level; i < sectionCounters.length; i++) {
      sectionCounters[i] = 0;
    }

    // Abschnittsnummer zusammenbauen (z.B. 5.2.1)
    const sectionNumber = sectionCounters.slice(0, level).join('.');

    // TOC-Eintrag speichern
    tocEntries.push({ title: `${sectionNumber}. ${title}`, page, level });
  }

  // 📊 Inhalt zeichnen
  addTOCEntry('Portfolio Breakdown', doc.internal.getNumberOfPages(), 1);
  drawPieChartsSection(doc, filteredData);

  addTOCEntry('Performance Charts', doc.internal.getNumberOfPages(), 1);
  drawPerformanceSection(doc);

  addTOCEntry('Market Risk', doc.internal.getNumberOfPages(), 1);
  drawMarketRiskSection(doc);

  addTOCEntry('Credit Risk', doc.internal.getNumberOfPages(), 1);
  drawCreditRiskSection(doc);

  drawMarketDataSection(doc, addTOCEntry); // übernimmt eigene Einträge: 5., 5.1., 5.2.

  addTOCEntry('Appendix: Product Table', doc.internal.getNumberOfPages(), 1);
  drawProductTableSection(doc, filteredData);

  // 📄 Seitenzahlen einfügen
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.text(`Page ${i} / ${totalPagesExp}`, doc.internal.pageSize.getWidth() - 30, doc.internal.pageSize.getHeight() - 10);
  }

  // 📚 Inhaltsverzeichnis auf Seite 1 einfügen
  doc.insertPage(1);
  doc.setPage(1);
  doc.setFontSize(16);
  doc.text('Table of Contents', 14, 20);
  doc.setFontSize(11);

  tocEntries.forEach((entry, index) => {
    const indent = (entry.level - 1) * 5;
    doc.text(`${entry.title} ............................................. ${entry.page + 1}`, 20 + indent, 30 + index * 8);
  });

  doc.save('Risk.pdf');
}





//PORTFOLIO BREAKDOWN:
function drawPieChartsSection(doc, filteredData) {
  doc.setFontSize(14);
  doc.text('Portfolio Breakdown', 14, 20);

  const canvases = document.querySelectorAll('.pieChart');
  const chartsPerRow = 3;
  const chartPadding = 10;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 10;
  const marginY = 20;

  const maxChartAreaWidth = (pageWidth - marginX * 2 - chartPadding * (chartsPerRow - 1)) / chartsPerRow;

  let y = marginY + 10;
  let x = marginX;
  let chartIndex = 0;

  canvases.forEach((canvas, i) => {
    try {
      const imageData = canvas.toDataURL('image/png');
      const canvasWidth = canvas.width;
      const canvasHeight = canvas.height;
      const aspectRatio = canvasWidth / canvasHeight;

      // Skaliere basierend auf maxChartAreaWidth
      const chartWidth = maxChartAreaWidth;
      const chartHeight = chartWidth / aspectRatio;

      // Seitenumbruch, wenn nicht genug Platz unten
      if (y + chartHeight + 16 > pageHeight - marginY) {
        doc.addPage();
        y = marginY;
        x = marginX;
      }

      // Hintergrundkasten
      doc.setFillColor(240);
      doc.rect(x - 2, y - 2, chartWidth + 4, chartHeight + 16, 'F');

      // Titel
      const chartId = canvas.id.replace('PieChart', '').toUpperCase();
      const titleMap = {
        ISSUER: 'Issuer',
        RATING: 'Issuer General Rating',
        RANK: 'Issuer Capital Structure',
        RATINGRES: 'Product Ratings',
        CATEGORY: 'Product Categories',
        COUPONTYPE: 'General Coupon Type',
        DEPOTBANK: 'Depot Bank'
      };
      const title = titleMap[chartId] || chartId;

      doc.setFontSize(9);
      doc.setTextColor(0);
      doc.text(title, x + chartWidth / 2, y - 4, { align: 'center' });

      // Bild einfügen
      doc.addImage(imageData, 'PNG', x, y, chartWidth, chartHeight);

      // Position updaten
      x += chartWidth + chartPadding;
      chartIndex++;
      if (chartIndex % chartsPerRow === 0) {
        x = marginX;
        y += chartHeight + chartPadding + 16;
      }

    } catch (err) {
      console.warn(`Fehler beim Einbetten von Canvas ${canvas.id}:`, err);
    }
  });

  if (chartIndex % chartsPerRow !== 0) {
    y += 40;
  }

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
//MARKET RISK:
function drawMarketRiskSection(doc) {
  doc.setFontSize(14);
  doc.text('Market Risk', 14, 20);

  // Reihenfolge vertauscht: zuerst tsEU1YChart (CMB), dann plMvarDistChart (Histogramm)
  const canvas1 = document.getElementById('tsEU1YChart');      // 🔮 CMB
  const canvas2 = document.getElementById('plMvarDistChart');  // 📊 Histogramm

  if (!canvas1 || !canvas2) {
    console.warn('Ein oder mehrere Market Risk Charts nicht gefunden.');
    return;
  }

  const maxWidth = 90;
  const chartHeight = 60;
  const padding = 10;
  const y = 30;

  [canvas1, canvas2].forEach((canvas, i) => {
    try {
      const imageData = canvas.toDataURL('image/png');
      const aspectRatio = canvas.width / canvas.height;
      const width = maxWidth;
      const height = width / aspectRatio;
      const x = 10 + i * (maxWidth + padding);

      doc.setFillColor(240);
      doc.rect(x - 2, y - 2, width + 4, chartHeight + 12, 'F');

      const title = i === 0 ? 'Constant Maturity Bond (CMB)' : 'P/L Distribution';
      doc.setFontSize(9);
      doc.text(title, x + width / 2, y - 4, { align: 'center' });

      doc.addImage(imageData, 'PNG', x, y, width, chartHeight);
    } catch (err) {
      console.warn(`Fehler beim Zeichnen von Chart ${i + 1}:`, err);
    }
  });

  doc.addPage(); // neue Seite für nächste Sektion
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
//MARKET DATA:
function drawMarketDataSection(doc, addTOCEntry) {
  addTOCEntry('Market Data', doc.internal.getNumberOfPages(), 1);

  let y = 30;

  // 5.1 Interest Rates
  addTOCEntry('Interest Rates', doc.internal.getNumberOfPages(), 2);
  doc.setFontSize(12);
  doc.text('Interest Rates', 14, y);
  y += 10;
  const irCanvas = document.getElementById('IRlineChart');
  if (irCanvas) {
    const irImg = irCanvas.toDataURL('image/png');
    doc.addImage(irImg, 'PNG', 10, y, 180, 80);
    y += 90;
  }

  // Seitenumbruch, falls nötig
  if (y > doc.internal.pageSize.getHeight() - 100) {
    doc.addPage();
    y = 30;
  }

  // 5.2 Credit Spreads
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



