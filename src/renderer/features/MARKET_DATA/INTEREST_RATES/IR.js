import processData from '../../../core/ui/MODAL_HELPER/dataProcessor.js';
import { createRatesLineChart } from '../../../charts/LineChart.js';
import { handleModalAction } from '../../../core/ui/MODAL_HELPER/ModalActionHandler.js';
import { notifyRiskPreview } from '../../REPORTS/RiskPDFPreview.js';

//HELPER:
      function getIRDataForSelectedCurve() {
        const raw = (typeof appState.getEUSWData === "function")
          ? appState.getEUSWData()
          : [];

        if (!Array.isArray(raw) || raw.length === 0) {
          return { IRData: [], curve: null };
        }

        const curve =
          (typeof appState.getSelectedCurve === "function" && appState.getSelectedCurve()) ||
          "EUSWAP";

        const IRData = raw.map(row => {
          const r = { ...row };
          if (curve in r) {
            r.RATES = r[curve]; // zentrale Logik
          }
          return r;
        });

        return { IRData, curve };
      }
export function renderIRPanel() {
  const IRDataContainer = document.getElementById("IRDataContainer");
  const ratesSelector   = document.getElementById("ratesSelector");
  if (!IRDataContainer || !ratesSelector) return;

  const { IRData, curve } = getIRDataForSelectedCurve();

  if (!IRData || IRData.length === 0) {
    console.log("â³ IRPanel waiting for data - skipping render");
    return;    // NICHTS Ã¼berschreiben!
  }

  // Selector auf gespeicherte Curve syncen
  if (curve && ratesSelector.value !== curve) {
    ratesSelector.value = curve;
  }

  // ============= 3) Table rendern =============
  IRDataContainer.innerHTML = processData(IRData);

  // ============= 4) Edit-Buttons binden =============
  const IREditButtons = document.querySelectorAll('#IRDataContainer .edit-button');
  IREditButtons.forEach((button) => {
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      const tableName = 'EUSW';
      const rowIndex = parseInt(button.getAttribute('data-row'), 10);
      handleModalAction(event, IRData, rowIndex, tableName, "edit");
    });
  });

  // ============= 5) Chart rendern =============
  renderIRLineChart(IRData);

  // ============= 6) Risk-Preview aktualisieren =============
  try {
    document.dispatchEvent(new Event('risk:refresh-thumbnails'));
  } catch (e) {
    console.warn('risk:refresh-thumbnails dispatch failed', e);
  }

  notifyRiskPreview('interestRates');
}


export function renderIRLineChart(optionalIRData) {
  const canvasId = "IRLineChart";
  const IRDataContainer = document.getElementById("IRDataContainer");

  // Sicherheit: ohne Container macht der Chart keinen Sinn
  if (!IRDataContainer) {
    console.warn("renderIRLineChart: IRDataContainer not found");
    return;
  }

  // Datenquelle: entweder vom Aufrufer, oder selbst geholt
  let IRData = Array.isArray(optionalIRData) ? optionalIRData : null;
  if (!IRData) {
    const res = getIRDataForSelectedCurve();
    IRData = res.IRData;
  }

  if (!IRData || IRData.length === 0) {
    console.log("â³ renderIRLineChart waiting for data - skipping");
    return;
  }

  // Alten Chart killen
  if (appState._IRLineChart) {
    appState._IRLineChart.destroy();
    appState._IRLineChart = null;
  }

  // Versuch 1: aus der Tabelle lesen (falls vorhanden)
  const table = IRDataContainer.querySelector('#dataTable');
  let ratesDataset = {
    label: "RATES",
    data: [],
    fill: false,
    tension: 0.1,
  };

  if (table) {
    const rows = Array.from(table.rows);
    let yearIndex = -1;
    let ratesIndex = -1;

    rows.forEach((row, index) => {
      if (index === 0) {
        const headers = Array.from(row.cells).map(c => c.textContent.trim());
        yearIndex  = headers.indexOf("YEAR");
        ratesIndex = headers.indexOf("RATES");
        return;
      }
      const rowData = Array.from(row.cells).map(c => c.textContent.trim());
      if (yearIndex >= 0 && ratesIndex >= 0) {
        ratesDataset.data.push({
          x: rowData[yearIndex],
          y: parseFloat(rowData[ratesIndex]),
        });
      }
    });
  } else {
    // Fallback: direkt aus IRData (falls kein Table vorhanden)
    ratesDataset.data = IRData.map(r => ({
      x: r.YEAR,
      y: parseFloat(r.RATES),
    }));
  }

  // Chart nur zeichnen, wenn wir wirklich Punkte haben
  if (!ratesDataset.data.length) {
    console.warn("renderIRLineChart: no data points for chart");
    return;
  }

  appState._IRLineChart = createRatesLineChart(
    [ratesDataset],
    canvasId,
    "Interest Rates",
    3
  );
}



