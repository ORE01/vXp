const { jsPDF } = window.jspdf;

// ---------- Defaults ----------
export const REPORT_DEFAULTS_OFFERS = {
  includeTOC: false,
  sections: {
    intro:         true,
    detailsTable:  true,
    productChart:  true,
    durationChart: true,
    signature:     true,
  },
  fileName: 'Veranlagungsvorschlag.pdf',
  paper: 'a4',
  orientation: 'p',
  ids: {
    logo: 'logo',
    chart: 'offersProductYieldChart',
    chartDuration: 'durationOffersProductYieldChart',
  },
  headerText: '',
  footerText: '',
};

// 🔹 Fallback-Liste (falls nicht von außen mitgegeben)
const DEFAULT_DETAIL_FIELDS = [
  ['PROD_ID','ISIN'],
  ['ISSUER','Emittent'],
  ['DESCRIPTION','Beschreibung'],
  ['RATING','Rating Emittent'],
  ['RATINGres','Rating Produkt'],
  ['MATURITY','Laufzeit'],
  ['COUPON_PCT','Coupon in %'],
  ['PRICE_BUY','Kurs aktuell'],
  ['LIMIT_PRICE','Kurslimit'],
  ['ytm','Rendite in % aktuell'],
  ['RANK','Rank'],
  ['ESG','ESG'],
  ['Depotbank','Depotbank'],
  ['NOTIONAL','Volumen in EUR'],
];

// ---------- Merge-Helper ----------
function mergeOfferOpts(overrides = {}) {
  const base = REPORT_DEFAULTS_OFFERS;
  return {
    ...base,
    ...overrides,
    sections: { ...base.sections, ...(overrides.sections || {}) },
    ids:      { ...base.ids,      ...(overrides.ids || {}) },
  };
}

// Kleiner Helfer für Produkt-Titel in der PDF
function productTitle(row, idx) {
  return (
    (row?.DESCRIPTION && String(row.DESCRIPTION).trim()) ||
    (row?.PROD_ID && String(row.PROD_ID).trim()) ||
    (row?.ISIN && String(row.ISIN).trim()) ||
    `Produkt ${idx + 1}`
  );
}

// ---------- PDF-Erzeugung ----------
export async function generateOfferPDF(filteredData, overrides = {}) {
  const opts = mergeOfferOpts(overrides);
  const doc = new jsPDF({ orientation: opts.orientation, format: opts.paper });

  // ⬇️ Feldliste + Enabled-Map einsammeln:
  const detailFields   = overrides.detailFields || (window.DETAIL_FIELDS) || DEFAULT_DETAIL_FIELDS;
  const detailsEnabled = overrides.detailsEnabled || {}; // { KEY: true/false }

  const totalPagesExp = '{total_pages_count_string}';
  const tocEntries = [];
  let sectionCounters = [];

  const addTOCEntry = (title, page, level = 1) => {
    if (!opts.includeTOC) return;
    level = Math.max(1, Math.min(3, (level | 0) || 1));
    if (sectionCounters.length >= level) {
      sectionCounters = sectionCounters.slice(0, level);
    } else {
      while (sectionCounters.length < level) sectionCounters.push(0);
    }
    sectionCounters[level - 1]++;
    const sectionNumber = sectionCounters.join('.');
    tocEntries.push({ title: `${sectionNumber}. ${title}`, page, level });
  };

  // Logo (optional)
  const logoImg = document.getElementById(opts.ids.logo);
  if (logoImg && logoImg.naturalWidth && logoImg.naturalHeight) {
    const aspect = logoImg.naturalWidth / logoImg.naturalHeight;
    const logoH = 20; // mm
    const logoW = logoH * aspect;
    const pageW = doc.internal.pageSize.getWidth();
    const posX = pageW - logoW - 14;
    const posY = 10;
    try { doc.addImage(logoImg, 'PNG', posX, posY, logoW, logoH); } catch {}
  }

  let y = 20;
  doc.setTextColor(51, 51, 51);

  // Intro
  if (opts.sections.intro) {
    addTOCEntry('Einleitung', doc.internal.getNumberOfPages(), 1);
    doc.setFontSize(18);
    doc.text('Veranlagungsvorschlag', 14, y);
    y += 10;

    const dateStr = new Date().toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit', year: 'numeric' });
    doc.setFontSize(11);
    doc.text(dateStr, 14, y);
    y += 10;

    const headerText = (opts.headerText || '').trim();
    if (headerText) {
      doc.setFontSize(12);
      const lines = doc.splitTextToSize(headerText, 180);
      doc.text(lines, 14, y);
      y += lines.length * 5 + 10;
    }
  }

  // Details-Tabellen (🆕 alle übergebenen/selektierten Zeilen, nicht nur die erste)
  if (opts.sections.detailsTable) {
    // Eingabedaten normalisieren: Array erzwingen
    const rows = Array.isArray(filteredData) ? filteredData : (filteredData ? [filteredData] : []);

    if (rows.length) {
      addTOCEntry('Produkt-Details', doc.internal.getNumberOfPages(), 1);

      for (let i = 0; i < rows.length; i++) {
        const r = rows[i] || {};
        const pageH = doc.internal.pageSize.getHeight();

        // Bei wenig Platz neue Seite beginnen
        if (y > pageH - 40) { doc.addPage(); y = 20; }

        // Untertitel je Produkt
        const title = productTitle(r, i);
        addTOCEntry(title, doc.internal.getNumberOfPages(), 2);
        doc.setFontSize(13);
        doc.setFont(undefined, 'bold');
        doc.text(String(title), 14, y);
        y += 6;

        // Tabelle mit nur erlaubten & befüllten Feldern
        const details = detailFields
          .filter(([key]) => detailsEnabled[key] !== false)
          .map(([key, label]) => [label, r?.[key] ?? ''])
          .filter(([, val]) => String(val ?? '').trim() !== '');

        if (details.length) {
          doc.setFont(undefined, 'normal');
          doc.autoTable({
            body: details,
            startY: y,
            styles: { cellPadding: 2, fontSize: 10, textColor: [51,51,51] },
            theme: 'striped',
            margin: { left: 14, right: 14 }
          });
          y = (doc.lastAutoTable?.finalY || y) + 8;
        } else {
          doc.setFontSize(10);
          doc.setFont(undefined, 'normal');
          doc.text('Keine Detailfelder verfügbar.', 14, y);
          y += 8;
        }
      }
    }
  }

  // Charts (Produkt + Duration) auf eigene Seite
  if (opts.sections.productChart || opts.sections.durationChart) {
    doc.addPage();
    y = 20;

    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();

    const leftX = 14;
    const rightPad = 14;
    const bottomPad = 20;
    const aspect = 16 / 9;
    const maxW = Math.min(180, pageW - leftX - rightPad);
    const gap = 10;

    const availableH = pageH - bottomPad - y;

    const desiredW = maxW;
    const naturalH = desiredW / aspect;
    const maxHThatFits = Math.max(20, (availableH - gap) / 2);
    const chartH = Math.min(naturalH, maxHThatFits);
    const chartW = Math.min(desiredW, chartH * aspect);

    if (opts.sections.productChart) {
      addTOCEntry('Visualisierung', doc.internal.getNumberOfPages(), 1);
      try { await addChartToPDF(opts.ids.chart, doc, leftX, y, chartW, chartH); } catch {}
      y += chartH + gap;
    }

    if (opts.sections.durationChart) {
      addTOCEntry('Visualisierung (Duration)', doc.internal.getNumberOfPages(), 1);
      try { await addChartToPDF(opts.ids.chartDuration, doc, leftX, y, chartW, chartH); } catch {}
      y += chartH + gap;
    }
  }

  // Footer-Text (optional)
  const footer = (opts.footerText || '').trim();
  if (footer) {
    addTOCEntry('Hinweise', doc.internal.getNumberOfPages(), 1);
    doc.setFontSize(11);
    const lines = doc.splitTextToSize(footer, 180);
    doc.text(lines, 14, y);
    y += lines.length * 5 + 10;
  }

  // Signature
  if (opts.sections.signature) {
    addTOCEntry('Freigabe', doc.internal.getNumberOfPages(), 1);

    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const marginX = 14, bottomPad = 20, gutter = 20;
    const blockW = (pageW - marginX * 2 - gutter) / 2;

    if (y + 30 > pageH - bottomPad) { doc.addPage(); y = 20; }

    const leftX  = marginX;
    const rightX = marginX + blockW + gutter;

    doc.setFontSize(11);
    doc.setFont(undefined, 'normal');
    doc.text('Freigabe', leftX, y);

    const lineY = y + 12;

    doc.setLineWidth(0.4);
    doc.line(leftX, lineY, leftX + blockW, lineY);
    doc.setFontSize(10);
    doc.text('Ort, Datum', leftX, lineY + 5);

    doc.line(rightX, lineY, rightX + blockW, lineY);
    doc.text('Unterschrift', rightX, lineY + 5);
    doc.text('Rektor Dr. Peter Riedler', rightX, lineY + 10);

    y = lineY + 16;
  }

  // Pagination
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.text(
      `Seite ${i} / ${totalPagesExp}`,
      doc.internal.pageSize.getWidth() - 30,
      doc.internal.pageSize.getHeight() - 10
    );
  }

  // TOC optional
  if (opts.includeTOC && tocEntries.length) {
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

      const dotsWidth = Math.max(0, maxLineWidth - titleTextWidth - pageTextWidth);
      const dotW = doc.getTextWidth('.');
      const dots = dotW ? '.'.repeat(Math.floor(dotsWidth / dotW)) : '';

      doc.text(`${titleText} ${dots} ${pageText}`, marginLeft, lineY);
    });
  }

  if (typeof doc.putTotalPages === 'function') {
    doc.putTotalPages(totalPagesExp);
  }

  const safeName = (opts.fileName || 'Veranlagungsvorschlag.pdf').replace(/[\\/:*?"<>|]/g, "_");
  doc.save(safeName);
}

// ---------- Legacy/Batch unverändert ----------
export async function generateOfferPDF_legacy(filteredData, headerText = '', footerText = '', pdfName = 'Veranlagungsvorschlag.pdf') {
  return generateOfferPDF(filteredData, { headerText, footerText, fileName: pdfName });
}
export async function generateAllOffersByProdId(filteredData, headerText = '', footerText = '') {
  if (!Array.isArray(filteredData) || filteredData.length === 0) return;
  const groups = filteredData.reduce((acc, row) => {
    const id = row?.PROD_ID ?? 'UNKNOWN';
    (acc[id] ||= []).push(row);
    return acc;
  }, {});
  for (const [prodId, rows] of Object.entries(groups)) {
    const filename = `Veranlagungsvorschlag_${prodId}.pdf`;
    await generateOfferPDF(rows, { headerText, footerText, fileName: filename });
  }
}

async function addChartToPDF(canvasId, doc, x, y, w, h) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) throw new Error(`[PDF] Canvas #${canvasId} nicht gefunden`);
  const dataUrl = canvas.toDataURL('image/png', 1.0);
  doc.addImage(dataUrl, 'PNG', x, y, w, h);
}























