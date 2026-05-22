import { handleFWDData, handleSwapForwardCurve } from "../../features/MARKET_DATA/FORWARDS/forwards.js";
import { renderSwaptionIfReady } from "../../features/MARKET_DATA/VOLS/swaptionVols.js";

export function initMarketDataChartsAutoRefresh() {

  const renderAllMarketDataCharts = () => {


    // Forward-Chart(s)
    handleFWDData(undefined, /* applyCubicSpline */ false);
    handleSwapForwardCurve();

    // Swaption (ATM Surface + Smile) nur orchestriert
    renderSwaptionIfReady();

    requestAnimationFrame(() => {
      renderSwaptionIfReady();
    });

    try {
      document.dispatchEvent(new Event("risk:refresh-thumbnails"));
    } catch (e) {
      console.warn("[MarketDataCharts] risk:refresh-thumbnails failed", e);
    }
  };

  document.addEventListener("eusw:data:ready", renderAllMarketDataCharts);
  document.addEventListener("curve:changed", renderAllMarketDataCharts);
}