// initMarketDataPanels.js

import { initForwardPanelGlobalOnce } from "./MARKET_DATA/FORWARDS/initForwardPanelGlobal.js";
import { initLazyPanels, refreshOpenPanels as refreshCore } from "./lazyPanelsCore.js";
import { initCurveSelectorGlobal } from "./MARKET_DATA/INTEREST_RATES/initCurveSelectorGlobal.js";

import { renderIRPanel } from "./MARKET_DATA/INTEREST_RATES/IR.js";
import { handleFWDData, handleSwapForwardCurve } from "./MARKET_DATA/FORWARDS/forwards.js";

// Swaption Vols: 3D-ATM-Surface (Plotly) + Smile (Chart.js)
import { renderSwaptionIfReady } from "./MARKET_DATA/VOLS/swaptionVols.js";


// ────────────────────────────────────────────────────────────
// 1) Renderer-Registry für Lazy Panels
// ────────────────────────────────────────────────────────────
export function getMarketDataPanelRenderers() {
  return {
    // Zinsstruktur / Curves
    "panel-rates": () => renderIRPanel(),

    // Forward-Curves
    "panel-forward": () => {
      initForwardPanelGlobalOnce();
      handleFWDData();
      handleSwapForwardCurve();
    },

    // Swaption-Panel: ATM-3D-Surface + Smile
    "panel-swaption": () => {
      renderSwaptionAndPreview();
    },

    // "panel-creditspreads": () => renderCreditSpreadsPanel(),
    // "panel-ts": () => renderHistoricTsPanel(),
    // "panel-ml": () => renderMLPanel(),
  };
}


// ────────────────────────────────────────────────────────────
// 2) Initialisierung der Market-Data-Panels mit Lazy Loading
// ────────────────────────────────────────────────────────────
export function initMarketDataPanelsLazyRender({ panelRenderState } = {}) {

  // 1) Lazy Panels Setup
  initLazyPanels({
    key: "marketdata",
    panelRenderState,
    panelRenderers: getMarketDataPanelRenderers(),
    triggerSelector: "#MARKETDATA_Modal .section-trigger"
  });

  // 2) Curve-Selector initialisieren (erst NACH Modal-DOM)
  initCurveSelectorGlobal();

  // OPTIONAL aber sehr empfehlenswert:
  // Wenn IPC-Daten (ATM/Smile) reinkommen → wenn Panel offen & ready → rendern
document.addEventListener("swaption:atm:ready",   renderSwaptionAndPreview);
document.addEventListener("swaption:smile:ready", renderSwaptionAndPreview);


  // 3) Re-render offene Panels, wenn sich die Curve ändert
  document.addEventListener("curve:changed", () => {
    const pRates    = document.getElementById("panel-rates");
    const pForward  = document.getElementById("panel-forward");
    const pSwaption = document.getElementById("panel-swaption");

    if (pRates && !pRates.hidden) {
      renderIRPanel();
    }

    if (pForward && !pForward.hidden) {
      handleFWDData();
      // handleSwapForwardCurve(); // bei Bedarf
    }

    if (pSwaption && !pSwaption.hidden) {
      renderSwaptionAndPreview();
    }
  });

  // 4) Wenn neue EUSW-Daten reinkommen → offene Panels refreshen
  document.addEventListener("eusw:data:ready", () => {
    const pRates    = document.getElementById("panel-rates");
    const pForward  = document.getElementById("panel-forward");
    const pSwaption = document.getElementById("panel-swaption");

    if (pRates && !pRates.hidden) {
      renderIRPanel();
    }

    if (pForward && !pForward.hidden) {
      handleFWDData();
      // handleSwapForwardCurve(); // bei Bedarf
    }

    if (pSwaption && !pSwaption.hidden) {
      renderSwaptionIfReady();
    }
  });
}



function renderSwaptionAndPreview() {
  renderSwaptionIfReady();

  // Plotly/WebGL braucht oft einen Tick länger → 2 Frames warten
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      try {
        document.dispatchEvent(new Event("risk:refresh-thumbnails"));
      } catch (e) {
        console.warn("[MarketDataPanels] risk:refresh-thumbnails failed", e);
      }
    });
  });
}



// ────────────────────────────────────────────────────────────
// 3) Externer Refresh-Hook für alle Market-Data-Panels
// ────────────────────────────────────────────────────────────
export function refreshOpenMarketDataPanels() {
  refreshCore("marketdata");
}






