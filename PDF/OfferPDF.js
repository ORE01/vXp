const { jsPDF } = window.jspdf;
import { createRatesLineChart } from '../charts/LineChart.js';

export async function generateOfferPDF(filteredData, headerText = '', footerText = '') {
  const doc = new jsPDF();
  const totalPagesExp = '{total_pages_count_string}';

  const tocEntries = [];
  const sectionCounters = [];

  function addTOCEntry(title, page, level = 1) {
    while (sectionCounters.length < level) sectionCounters.push(0);
    sectionCounters[level - 1]++;
    for (let i = level; i < sectionCounters.length; i++) sectionCounters[i] = 0;

    const sectionNumber = sectionCounters.slice(0, level).join('.');
    tocEntries.push({ title: `${sectionNumber}. ${title}`, page, level });
  }

  let currentY = 20;
  doc.setTextColor(51, 51, 51);

  // 📌 HEADER
  doc.setFontSize(18);
  doc.text('Angebot:', 14, currentY);
  currentY += 10;

  if (headerText?.trim()) {
    addTOCEntry('Einleitung', doc.internal.getNumberOfPages(), 1);

    doc.setFontSize(12);
    const headerLines = doc.splitTextToSize(headerText, 180);
    doc.text(headerLines, 14, currentY);
    currentY += headerLines.length * 5 + 10;
  }

  // 📌 TABELLE
  const offers = extractProductOfferData(filteredData);
  const tableData = offers.map(item => [
    item.PROD_ID,
    item.DESCRIPTION,
    item.CLEAN_PRICE,
    item.TtM,
    item.ytm,
    item.C_SPREAD
  ]);

  addTOCEntry('Produktübersicht', doc.internal.getNumberOfPages(), 1);

  doc.autoTable({
    head: [['Produkt-ID', 'Beschreibung', 'Kurs', 'Laufzeit', 'Rendite', 'Spread']],
    body: tableData,
    startY: currentY,
    styles: {
      cellPadding: 2,
      fontSize: 10,
      textColor: [51, 51, 51]
    },
    headStyles: {
      fillColor: [70, 192, 230],
      textColor: 255
    },
    theme: 'striped',
  });

  currentY = doc.lastAutoTable.finalY + 10;

  // 📌 FOOTER
  if (footerText?.trim()) {
    addTOCEntry('Zusätzliche Hinweise', doc.internal.getNumberOfPages(), 1);
    doc.setFontSize(11);
    const footerLines = doc.splitTextToSize(footerText, 180);
    doc.text(footerLines, 14, currentY);
    currentY += footerLines.length * 5 + 10;
  }

  // 📌 CHARTS
  addTOCEntry('Visualisierung: Produkt Yields', doc.internal.getNumberOfPages(), 1);
  await addChartToPDF('euswapProductYieldChart', doc, 14, currentY, 180, 90);

  // 📄 SEITENZAHLEN einfügen
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.text(`Seite ${i} / ${totalPagesExp}`, doc.internal.pageSize.getWidth() - 30, doc.internal.pageSize.getHeight() - 10);
  }

  // 📚 INHALTSVERZEICHNIS
  doc.insertPage(1);
  doc.setPage(1);
  doc.setFontSize(16);
  doc.text('Inhaltsverzeichnis', 14, 20);
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

  // Abstand zwischen Titel und Seitenzahl
  const dotsWidth = maxLineWidth - titleTextWidth - pageTextWidth;
  const dots = '.'.repeat(Math.floor(dotsWidth / doc.getTextWidth('.')));

  doc.text(`${titleText} ${dots} ${pageText}`, marginLeft, lineY);
});

  doc.save('Produktangebot.pdf');
}


function extractProductOfferData(filteredData) {
  if (!filteredData || !Array.isArray(filteredData)) return [];

  return filteredData.map(entry => {
    const rawPrice = entry.clean_price || '';
    const cleanText = typeof rawPrice === 'string'
      ? rawPrice.replace(/<[^>]*>/g, '').replace('%', '').trim()
      : rawPrice.toString();

    const ytm = entry.ytm != null
      ? `${(parseFloat(entry.ytm) * 100).toFixed(2)} %`
      : '';

    return {
      PROD_ID: entry.PROD_ID || '',
      DESCRIPTION: (entry.DESCRIPTION || '').toString().substring(0, 100),
      CLEAN_PRICE: cleanText,
      TtM: typeof entry.TtM === 'number' ? entry.TtM.toFixed(2) : '',
      ytm: ytm,
      C_SPREAD: entry.C_SPREAD != null ? entry.C_SPREAD.toString() : '',
      NOTIONAL: entry.NOTIONAL != null ? entry.NOTIONAL.toString() : '',
    };
  });
}


/**
 * Fügt einen scharfen Chart aus einem bestehenden Canvas in ein jsPDF-Dokument ein.
 *
 * @param {string} sourceCanvasId - ID des Canvas mit dem originalen Chart
 * @param {jsPDF} doc - Instanz von jsPDF
 * @param {number} posX - X-Position im PDF (mm)
 * @param {number} posY - Y-Position im PDF (mm)
 * @param {number} widthMm - Breite im PDF (mm)
 * @param {number} heightMm - Höhe im PDF (mm)
 */



export async function addChartToPDF(
  sourceCanvasId,
  doc,
  posX,
  posY,
  widthMm,
  heightMm,
  {
    dpi = 200,           // 150–300 ist sweet spot
    fit = 'contain',     // 'contain' | 'cover' | 'stretch'
    pagePaddingMm = 10,  // untere Seitenmarge
    bg = '#ffffff'
  } = {}
) {
  const canvas = document.getElementById(sourceCanvasId);
  if (!canvas) {
    console.warn(`Canvas '${sourceCanvasId}' nicht gefunden.`);
    return;
  }

  // Quelle: echte Canvas-Pixel (nicht CSS!)
  const srcW = canvas.width;
  const srcH = canvas.height;
  if (!srcW || !srcH) {
    console.warn(`Canvas '${sourceCanvasId}' hat 0×0.`);
    return;
  }

  // Zielgröße in Pixel basierend auf gewünschter DPI
  const PX_PER_MM = dpi / 25.4;
  const destBoxWpx = Math.max(1, Math.round(widthMm  * PX_PER_MM));
  const destBoxHpx = Math.max(1, Math.round(heightMm * PX_PER_MM));

  // Seitenverhältnis wahren
  const srcAR  = srcW / srcH;
  const boxAR  = destBoxWpx / destBoxHpx;

  let drawWpx, drawHpx;
  if (fit === 'stretch') {
    drawWpx = destBoxWpx;
    drawHpx = destBoxHpx;
  } else if (fit === 'cover') {
    // fülle Box komplett, schneide ggf. ab (zentriert)
    if (srcAR > boxAR) { // Quelle „zu breit“ → Höhe passt, Breite wird beschnitten
      drawHpx = destBoxHpx;
      drawWpx = Math.round(drawHpx * srcAR);
    } else {
      drawWpx = destBoxWpx;
      drawHpx = Math.round(drawWpx / srcAR);
    }
  } else { // 'contain' (empfohlen): alles sichtbar, ggf. Ränder
    if (srcAR > boxAR) { // Quelle breiter → Breite passt, Höhe kleiner
      drawWpx = destBoxWpx;
      drawHpx = Math.round(drawWpx / srcAR);
    } else {
      drawHpx = destBoxHpx;
      drawWpx = Math.round(drawHpx * srcAR);
    }
  }

  // Offscreen-Canvas in „Export-DPI“
  const off = document.createElement('canvas');
  const ctx = off.getContext('2d');
  off.width  = drawWpx;
  off.height = drawHpx;

  // Hintergrund
  ctx.save();
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, off.width, off.height);
  ctx.restore();

  // Quelle → Ziel (cover/contain berücksichtigen: wir letterboxen/überfüllen)
  // Quell-Rect (bei cover schneiden wir Quelle mittig zu)
  let sx = 0, sy = 0, sW = srcW, sH = srcH;
  if (fit === 'cover') {
    const scale = Math.max(drawWpx / srcW, drawHpx / srcH);
    const cropW = Math.round(drawWpx / scale);
    const cropH = Math.round(drawHpx / scale);
    sx = Math.floor((srcW - cropW) / 2);
    sy = Math.floor((srcH - cropH) / 2);
    sW = cropW;
    sH = cropH;
  }

  // Ziel-Rect (bei contain zentrieren wir)
  const dx = Math.floor((destBoxWpx - drawWpx) / 2);
  const dy = Math.floor((destBoxHpx - drawHpx) / 2);

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(canvas, sx, sy, sW, sH, 0, 0, drawWpx, drawHpx);

  // PNG erzeugen
  const img = off.toDataURL('image/png');

  // Seitenumbruch falls nötig
  const pageH = doc.internal.pageSize.getHeight();
  if (posY + heightMm > pageH - pagePaddingMm) {
    doc.addPage();
    posY = 20;
  }

  // PDF: wir platzieren in der ursprünglich gewünschten mm-Box
  // (bei contain/cover gibt's oben/unten oder links/rechts kleine Ränder)
  doc.addImage(img, 'PNG', posX, posY, widthMm, heightMm);

  off.remove();
}






