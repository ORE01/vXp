const { jsPDF } = window.jspdf;
import { createRatesLineChart } from '../charts/LineChart.js';

export async function generateOfferPDF(filteredData, headerText = '', footerText = '') {
  const doc = new jsPDF();
  const offers = extractProductOfferData(filteredData);

  // Titel
  doc.setFontSize(18);
  doc.text('Angebot: Produktübersicht', 14, 20);

  // Header-Text
  doc.setFontSize(12);
  if (headerText) {
    doc.text(headerText, 14, 28);
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
    startY: 35,
    styles: { cellPadding: 2, fontSize: 10 },
    headStyles: { fillColor: [70, 192, 230] },
    theme: 'striped',
  });

  let yAfterTable = doc.lastAutoTable.finalY + 10;

  if (footerText) {
    doc.setFontSize(11);
    doc.text(footerText, 14, yAfterTable);
    yAfterTable += 10;
  }

  await drawSwapChartToPDF(filteredData, yAfterTable, doc);

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
        const ytm = parseFloat((rawYTM || '').toString().replace('%', '').trim());

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


// Hilfsfunktion: Formatiert die Rohdaten
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


