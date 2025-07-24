const { jsPDF } = window.jspdf;

export function generateRiskPDF(filteredData) {
  const doc = new jsPDF();
  const riskData = extractProductRiskData(filteredData);

  // Titel
  doc.setFontSize(18);
  doc.text('Risikoanalyse: Produkte', 14, 20);

  // Tabelle vorbereiten
  const tableData = riskData.map(item => [
    item.PROD_ID,
    item.DESCRIPTION,
    item.ISSUER,
    item.NOTIONAL,
    item.NAV
  ]);

  // Tabelle erzeugen
  doc.autoTable({
    head: [['Produkt-ID', 'Beschreibung', 'Issuer', 'Notional', 'NAV']],
    body: tableData,
    startY: 30,
    styles: { cellPadding: 2, fontSize: 10 },
    headStyles: { fillColor: [255, 102, 102] }, // z. B. rötlich für "Risiko"
    theme: 'striped',
  });

  // 📊 Charts einfügen (wie gehabt)
  const chartContainers = ['issuerCharts', 'productCharts', 'generalCharts'];
  let yOffset = doc.lastAutoTable ? doc.lastAutoTable.finalY + 10 : 60;

  const maxWidth = 100;
  const maxHeight = 100;

  chartContainers.forEach(containerId => {
    const container = document.getElementById(containerId);
    if (!container) return;

    const canvases = container.querySelectorAll('canvas');
    canvases.forEach(canvas => {
      try {
        const imageData = canvas.toDataURL('image/png');
        const aspectRatio = canvas.width / canvas.height;
        let width = maxWidth;
        let height = maxHeight;

        if (aspectRatio > 1) {
          height = maxWidth / aspectRatio;
        } else {
          width = maxHeight * aspectRatio;
        }

        if (yOffset + height > 280) {
          doc.addPage();
          yOffset = 20;
        }

        doc.addImage(imageData, 'PNG', 10, yOffset, width, height);
        yOffset += height + 10;
      } catch (err) {
        console.warn(`Fehler beim Einbetten von Canvas ${canvas.id}:`, err);
      }
    });
  });

  doc.save('Risk.pdf');
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