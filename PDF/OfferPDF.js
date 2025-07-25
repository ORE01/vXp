const { jsPDF } = window.jspdf;
import { createRatesLineChart } from '../charts/LineChart.js';

export async function generateOfferPDF(filteredData, headerText = '', footerText = '') {
  const doc = new jsPDF();
  const offers = extractProductOfferData(filteredData);

  let currentY = 20;

  // Schriftfarbe auf Dunkelgrau setzen
  doc.setTextColor(51, 51, 51);

  // Titel
  doc.setFontSize(18);
  doc.text('Angebot:', 14, currentY);
  currentY += 10;

  // Header-Text dynamisch
  doc.setFontSize(12);
  if (headerText?.trim()) {
    const headerLines = doc.splitTextToSize(headerText, 180);
    const headerHeight = headerLines.length * 5 + 2;

    if (currentY + headerHeight > doc.internal.pageSize.getHeight()) {
      doc.addPage();
      currentY = 20;
      doc.setTextColor(51, 51, 51);
    }

    doc.text(headerLines, 14, currentY);
    currentY += headerHeight;
  }

  // Tabelle vorbereiten
  const tableData = offers.map(item => [
    item.PROD_ID,
    item.DESCRIPTION,
    item.CLEAN_PRICE,
    item.TtM,
    item.ytm,
    item.C_SPREAD
  ]);

  doc.autoTable({
    head: [['Produkt-ID', 'Beschreibung', 'Kurs', 'Laufzeit', 'Rendite', 'Spread']],
    body: tableData,
    startY: currentY + 5,
    styles: {
      cellPadding: 2,
      fontSize: 10,
      textColor: [51, 51, 51] // Tabelleninhalt auch dunkelgrau
    },
    headStyles: {
      fillColor: [70, 192, 230],
      textColor: 255 // Weißer Tabellenkopf
    },
    theme: 'striped',
  });

  // Nach der Tabelle
  currentY = doc.lastAutoTable.finalY + 10;

  // Footer-Text dynamisch
  doc.setFontSize(11);
  if (footerText?.trim()) {
    const footerLines = doc.splitTextToSize(footerText, 180);
    const footerHeight = footerLines.length * 5 + 2;

    if (currentY + footerHeight > doc.internal.pageSize.getHeight()) {
      doc.addPage();
      currentY = 20;
      doc.setTextColor(51, 51, 51);
    }

    doc.text(footerLines, 14, currentY);
    currentY += footerHeight;
  }

  // Chart zeichnen
  await drawSwapChartToPDF(filteredData, currentY, doc);

  doc.save('Produktangebot.pdf');
}



async function drawSwapChartToPDF(filteredData, startY, doc) {
  const euswData = window.appState.getEUSWData?.();
  if (euswData?.length) {
    const canvas = document.getElementById('IRlineChartExport');
    if (canvas) {
      const ctx = canvas.getContext('2d');

      const swapPoints = euswData.map(entry => {
        const x = parseFloat(entry.YEAR || entry.year || entry.TERM);
        const y = parseFloat(entry.RATES || entry.rate || entry.RATE);
        return (!isNaN(x) && !isNaN(y)) ? { x, y } : null;
      }).filter(Boolean);

      const productDatasets = filteredData.map((entry, index) => {
        const rawTtM = entry.TtM;
        const rawYTM = entry.ytm;

        const ttm = typeof rawTtM === 'number' ? rawTtM : parseFloat(rawTtM);
        //const ytm = parseFloat((rawYTM || '').toString().replace('%', '').trim());
        const ytm = typeof entry.ytm === 'number' ? entry.ytm : parseFloat(entry.ytm);
        console.log('ytm:', ytm)

        if (isNaN(ttm) || isNaN(ytm)) return null;

        const hue = (index * 47) % 360;
        const color = `hsl(${hue}, 80%, 50%)`;

        return {
          label: entry.PROD_ID || `Produkt ${index + 1}`,
          data: [{ x: ttm, y: ytm * 100 }],
          type: 'scatter',
          backgroundColor: color,
          borderColor: color,
          pointRadius: 5,
          pointHoverRadius: 7
        };
      }).filter(Boolean);

      if (window.exportChartInstance) {
        window.exportChartInstance.destroy();
      }

      window.exportChartInstance = new Chart(ctx, {
        type: 'scatter',
        data: {
          datasets: [
            {
              label: 'Swapkurve',
              data: swapPoints,
              showLine: true,
              borderColor: 'rgba(75, 192, 192, 1)',
              backgroundColor: 'rgba(75, 192, 192, 0.2)',
              tension: 0.3,
              pointRadius: 3
            },
            ...productDatasets
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: {
              type: 'linear',
              title: {
                display: true,
                text: 'Laufzeit (Jahre)'
              },
              min: 0,
              max: Math.max(...swapPoints.map(p => p.x), ...productDatasets.map(d => d.data[0].x)) + 1
            },
            y: {
              title: {
                display: true,
                text: 'Rendite (%)'
              },
              ticks: {
                callback: val => `${val.toFixed(2)}%`
              }
            }
          },
          plugins: {
            legend: { position: 'top' },
            tooltip: {
              callbacks: {
                label: context => `${context.dataset.label}: ${context.raw.y.toFixed(2)}% bei ${context.raw.x.toFixed(2)}J`
              }
            }
          }
        }
      });

      await new Promise(resolve => setTimeout(resolve, 300));
      const chartImage = canvas.toDataURL('image/png');
      doc.addImage(chartImage, 'PNG', 14, startY, 180, 90);
    }
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




