import { renderIRLineChart } from "./MARKET_DATA/INTEREST_RATES/IR.js";
import { handleFWDData, handleSwapForwardCurve } from "./MARKET_DATA/FORWARDS/forwards.js";
import { renderSwaptionIfReady } from "./MARKET_DATA/VOLS/swaptionVols.js";

export function initMarketDataChartsAutoRefresh() {

  const renderAllMarketDataCharts = () => {
    // IR-Chart
    renderIRLineChart();

    // Forward-Chart(s)
    handleFWDData(undefined, /* applyCubicSpline */ false);
    handleSwapForwardCurve();

    // ✅ Swaption (ATM Surface + Smile) nur orchestriert
    renderSwaptionIfReady();

    // (Optional) ein Frame später nochmal, falls Selects/DOM gerade erst gesetzt wurden
    requestAnimationFrame(() => {
      renderSwaptionIfReady();
    });

    // Danach: Preview updaten
    try {
      document.dispatchEvent(new Event("risk:refresh-thumbnails"));
    } catch (e) {
      console.warn("[MarketDataCharts] risk:refresh-thumbnails failed", e);
    }
  };

  // Wenn neue EUSW-Daten fertig sind → alle Market-Data-Charts ziehen
  document.addEventListener("eusw:data:ready", renderAllMarketDataCharts);

  // Wenn Curve geändert wird → alle Market-Data-Charts neu zeichnen
  document.addEventListener("curve:changed", renderAllMarketDataCharts);
}

