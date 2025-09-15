const { jsPDF } = window.jspdf;
import { createRatesLineChart } from '../charts/LineChart.js';

// für ein PDF pro Portfolio
// export async function generateOfferPDF(filteredData, headerText = '', footerText = '') {

//ein PDF pro ProdID
export async function generateOfferPDF(filteredData, headerText = '', footerText = '', pdfName = 'Veranlagungsvorschlag.pdf') {
  

if (Array.isArray(filteredData)) {
  console.table(filteredData);
} else {
  console.log('filteredData:', filteredData);
}

  const doc = new jsPDF();

  // ✅ Logo oben rechts einfügen
const logoImg = document.getElementById("logo");

// Original-Pixelgröße
const naturalWidth = logoImg.naturalWidth;
const naturalHeight = logoImg.naturalHeight;

// Seitenverhältnis berechnen
const aspectRatio = naturalWidth / naturalHeight;

// Zielhöhe festlegen (z. B. 15 mm)
const logoHeight = 20; // mm
const logoWidth = logoHeight * aspectRatio; // Breite automatisch

const pageWidth = doc.internal.pageSize.getWidth();
const marginRight = 14;
const posX = pageWidth - logoWidth - marginRight;
const posY = 10; // Abstand von oben

doc.addImage(logoImg, "PNG", posX, posY, logoWidth, logoHeight);



  const totalPagesExp = '{total_pages_count_string}';

  // const tocEntries = [];
  const sectionCounters = [];

  // function addTOCEntry(title, page, level = 1) {
  //   while (sectionCounters.length < level) sectionCounters.push(0);
  //   sectionCounters[level - 1]++;
  //   for (let i = level; i < sectionCounters.length; i++) sectionCounters[i] = 0;

  //   const sectionNumber = sectionCounters.slice(0, level).join('.');
  //   tocEntries.push({ title: `${sectionNumber}. ${title}`, page, level });
  // }

  let currentY = 20;
  doc.setTextColor(51, 51, 51);

  // 📌 HEADER
  doc.setFontSize(18);
  doc.text('Veranlagungsvorschlag', 14, currentY);
  currentY += 10;

  const today = new Date();
  const dateStr = today.toLocaleDateString('de-AT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });

  doc.setFontSize(11);
  doc.text(dateStr, 14, currentY);
  currentY += 10; 

  if (headerText?.trim()) {
    // addTOCEntry('Einleitung', doc.internal.getNumberOfPages(), 1);

    doc.setFontSize(12);
    const headerLines = doc.splitTextToSize(headerText, 180);
    doc.text(headerLines, 14, currentY);
    currentY += headerLines.length * 5 + 10;
  }

// 📌 DETAIL-TABELLE
const details = [
  ['ISIN',                filteredData?.[0]?.PROD_ID || ''],
  ['Emittent',            filteredData?.[0]?.ISSUER || ''],
  ['Beschreibung',        filteredData?.[0]?.DESCRIPTION || ''],
  ['Rating Emittent',     filteredData?.[0]?.RATING || ''],
  ['Rating Produkt',      filteredData?.[0]?.RATINGres || ''],
  ['Laufzeit',            filteredData?.[0]?.MATURITY || ''],
  // ['Laufzeit in Jahren',  filteredData?.[0]?.TtM || ''],
  ['Coupon in %',         filteredData?.[0]?.COUPON_PCT || ''],
  ['Kurs aktuell',        filteredData?.[0]?.PRICE_BUY || ''],
  ['Kurslimit',           filteredData?.[0]?.LIMIT_PRICE || ''],
  ['Rendite in % aktuell',filteredData?.[0]?.ytm || ''],
  ['Rank',                filteredData?.[0]?.RANK || ''],
  ['ESG',                 filteredData?.[0]?.ESG || ''],
  ['Depotbank',           filteredData?.[0]?.Depotbank || ''],
  ['Volumen in EUR',      filteredData?.[0]?.NOTIONAL || ''],
];

// doc.autoTable({
//   head: [['Merkmal', 'Wert']],  // Kopfzeile wie bei Produkttabelle
//   body: details,                // die Key-Value-Zeilen
//   startY: currentY,             // startet an der aktuellen Y-Position
//   styles: {
//     cellPadding: 2,
//     fontSize: 10,
//     textColor: [51, 51, 51]
//   },
//   headStyles: {
//     fillColor: [70, 192, 230], // hellblau wie Produktübersicht
//     textColor: 255
//   },
//   theme: 'striped',             // gleicher Stil wie Produkttabelle
//   margin: { left: 14, right: 14 }
// });

doc.autoTable({
  body: details,                // nur Body, keine Head-Zeile
  startY: currentY,
  styles: {
    cellPadding: 2,
    fontSize: 10,
    textColor: [51, 51, 51]
  },
  theme: 'striped',             // behält abwechselnde Zeilenfarben
  margin: { left: 14, right: 14 }
});

// Y-Position nachziehen
currentY = doc.lastAutoTable.finalY + 10;


  // // 📌 TABELLE
  // const offers = extractProductOfferData(filteredData);
  // const tableData = offers.map(item => [
  //   item.PROD_ID,
  //   item.DESCRIPTION,
  //   item.CLEAN_PRICE,
  //   item.TtM,
  //   item.ytm,
  //   item.C_SPREAD
  // ]);

  // // addTOCEntry('Produktübersicht', doc.internal.getNumberOfPages(), 1);

  // doc.autoTable({
  //   head: [['Produkt-ID', 'Beschreibung', 'Kurs', 'Laufzeit', 'Rendite', 'Spread']],
  //   body: tableData,
  //   startY: currentY,
  //   styles: {
  //     cellPadding: 2,
  //     fontSize: 10,
  //     textColor: [51, 51, 51]
  //   },
  //   headStyles: {
  //     fillColor: [70, 192, 230],
  //     textColor: 255
  //   },
  //   theme: 'striped',
  // });

  // currentY = doc.lastAutoTable.finalY + 10;

  // 📌 FOOTER
  if (footerText?.trim()) {
    // addTOCEntry('Zusätzliche Hinweise', doc.internal.getNumberOfPages(), 1);
    doc.setFontSize(11);
    const footerLines = doc.splitTextToSize(footerText, 180);
    doc.text(footerLines, 14, currentY);
    currentY += footerLines.length * 5 + 10;
  }

  // 📌 CHARTS
  // addTOCEntry('Visualisierung: Produkt Yields', doc.internal.getNumberOfPages(), 1);
//   // 📌 CHART einfügen – mit Platzprüfung und Y-Update
// const chartW = 180;   // mm
// const chartH = 90;    // mm
// const leftX  = 14;    // mm
// const bottomPad = 20; // mm

// const pageH = doc.internal.pageSize.getHeight();
// if (currentY + chartH > pageH - bottomPad) {
//   doc.addPage();
//   currentY = 20; // top margin auf neuer Seite
// }

//   await addChartToPDF('euswapProductYieldChart', doc, 14, currentY, chartW, chartH);

//   currentY += chartH + 10;

//Chart neu
// 📌 CHART einfügen – dynamisch so verkleinern, dass alles auf 1 Seite passt
{
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  const leftX = 14;             // linker Rand
  const rightX = 14;            // rechter Rand
  const bottomPad = 20;         // unterer Seitenrand
  const afterChartGap = 10;     // Abstand nach dem Chart bis Freigabe-Block

  // 🔧 Geplanter Platzbedarf für den Freigabe-/Unterschrift-Block (wie in deinem Code)
  const signatureBlockNeededH = 30;

  // 🔶 Chart-Defaults und Seitenverhältnis (16:9)
  const aspect = 16 / 9;
  const maxChartW = Math.min(180, pageW - leftX - rightX); // nie breiter als Seite
  let   chartW = maxChartW;
  let   chartH = chartW / aspect;                          // Höhe aus Breite

  // 🧮 Verfügbarer Restplatz, damit alles auf 1 Seite bleibt
  const availableH = pageH - bottomPad - currentY - signatureBlockNeededH - afterChartGap;

  // Wenn der Standard-Chart zu hoch wäre, proportional verkleinern
  if (availableH < chartH) {
    chartH = Math.max(availableH, 20); // minimale Höhe, damit es nicht 0 wird
    chartW = chartH * aspect;

    // Falls die neue Breite jetzt über die Seitenbreite hinausgeht, wieder deckeln
    if (chartW > maxChartW) {
      chartW = maxChartW;
      chartH = chartW / aspect;
    }
  }

  // Sicherheit: niemals negative/NaN-Werte verwenden
  if (!(chartW > 0 && chartH > 0)) {
    chartW = Math.min(100, maxChartW);
    chartH = chartW / aspect;
  }

  // Chart einfügen (immer auf derselben Seite, kein addPage)
  await addChartToPDF('euswapProductYieldChart', doc, leftX, currentY, chartW, chartH);

  // Y-Position fortschreiben, damit der Freigabe-Block darunter Platz findet
  currentY += chartH + afterChartGap;
}




  // 🔽 FREIGABE-/UNTERSCHRIFT-BEREICH (nach der Grafik einfügen)
{
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  const marginX = 14;         // linker/rechter Rand
  const bottomPad = 20;        // unterer Rand
  const gutter = 20;           // Abstand zwischen den beiden Blöcken
  const blockW = (pageW - marginX * 2 - gutter) / 2;

  // Platzbedarf schätzen und ggf. neue Seite
  const neededH = 30;
  if (currentY + neededH > pageH - bottomPad) {
    doc.addPage();
    currentY = 20;
  }

  // Positionen
  const leftX  = marginX;
  const rightX = marginX + blockW + gutter;

  // Überschrift links ("Freigabe")
  doc.setFontSize(11);
  doc.setFont(undefined, 'normal');
  doc.text('Freigabe', leftX, currentY);

  // Linien (Signaturlinien)
  const lineY = currentY + 12;     // Y-Position der Linie
  const lineW = blockW;            // Linienbreite = Blockbreite

  // Linke Linie + Beschriftung
  doc.setLineWidth(0.4);
  doc.line(leftX, lineY, leftX + lineW, lineY);
  doc.setFontSize(10);
  doc.text('Ort, Datum', leftX, lineY + 5);

  // Rechte Linie + Beschriftung + Name
  doc.line(rightX, lineY, rightX + lineW, lineY);
  doc.text('Unterschrift', rightX, lineY + 5);
  doc.text('Rektor Dr. Peter Riedler', rightX, lineY + 10);

  currentY = lineY + 16; // etwas Abstand nach dem Block
}


  // 📄 SEITENZAHLEN einfügen
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.text(`Seite ${i} / ${totalPagesExp}`, doc.internal.pageSize.getWidth() - 30, doc.internal.pageSize.getHeight() - 10);
  }

  //  // 📌 Gesamtseitenzahl setzen
  // if (typeof doc.putTotalPages === 'function') {
  //   doc.putTotalPages(totalPagesExp);
  // }

  // // 📚 INHALTSVERZEICHNIS
  // doc.insertPage(1);
  // doc.setPage(1);
  // doc.setFontSize(16);
  // doc.text('Inhaltsverzeichnis', 14, 20);
  // doc.setFontSize(11);

// tocEntries.forEach((entry, index) => {
//   const indent = (entry.level - 1) * 5;
//   const lineY = 30 + index * 8;
//   const pageWidth = doc.internal.pageSize.getWidth();
//   const marginLeft = 20 + indent;
//   const marginRight = 20;
//   const maxLineWidth = pageWidth - marginLeft - marginRight;

//   const pageText = (entry.page + 1).toString();
//   const pageTextWidth = doc.getTextWidth(pageText);

//   const titleText = entry.title;
//   const titleTextWidth = doc.getTextWidth(titleText);

//   // Abstand zwischen Titel und Seitenzahl
//   const dotsWidth = maxLineWidth - titleTextWidth - pageTextWidth;
//   const dots = '.'.repeat(Math.floor(dotsWidth / doc.getTextWidth('.')));

//   doc.text(`${titleText} ${dots} ${pageText}`, marginLeft, lineY);
// });

  // doc.save('Veranlagungsvorschlag.pdf');

if (typeof doc.putTotalPages === 'function') {
  doc.putTotalPages('{total_pages_count_string}');
}
doc.save(pdfName);

}

//Wrapper für PDF pro ProdID
export async function generateAllOffersByProdId(filteredData, headerText = '', footerText = '') {
  if (!Array.isArray(filteredData) || filteredData.length === 0) return;

  // Nach PROD_ID gruppieren
  const groups = filteredData.reduce((acc, row) => {
    const id = row?.PROD_ID ?? 'UNKNOWN';
    (acc[id] ||= []).push(row);
    return acc;
  }, {});

  // Für jede PROD_ID ein eigenes PDF erzeugen
  for (const [prodId, rows] of Object.entries(groups)) {
    const filename = `Veranlagungsvorschlag_${prodId}.pdf`;
    await generateOfferPDF(rows, headerText, footerText, filename);
  }
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






