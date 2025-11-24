// initMarketDataPanels.js
import { initForwardPanelGlobalOnce } from "./MARKET_DATA/FORWARDS/initForwardPanelGlobal.js";
import { initLazyPanels, refreshOpenPanels as refreshCore } from "./lazyPanelsCore.js";
import { initCurveSelectorGlobal } from "./MARKET_DATA/INTEREST_RATES/initCurveSelectorGlobal.js";

import { renderIRPanel } from "./MARKET_DATA/INTEREST_RATES/IR.js";
import { handleFWDData, handleSwapForwardCurve } from "./MARKET_DATA/FORWARDS/FORWARDS.js"; 
// ^^^ Pfad bitte ggf. an dein Projekt anpassen
//     Wichtig ist nur: das ist dein Forward-Render/Handler

// Register renderers for lazy loading
export function getMarketDataPanelRenderers() {
  return {
    "panel-rates": () => renderIRPanel(),
    "panel-forward": () => {
        initForwardPanelGlobalOnce(); 
      handleFWDData();
      handleSwapForwardCurve(); 
      },  
    // "panel-creditspreads": () => renderCreditSpreadsPanel(),
    // "panel-ts": () => renderHistoricTsPanel(),
    // "panel-ml": () => renderMLPanel(),
  };
}

export function initMarketDataPanelsLazyRender({ panelRenderState } = {}) {

  // 1) Lazy Panels Setup
  initLazyPanels({
    key: "marketdata",
    panelRenderState,
    panelRenderers: getMarketDataPanelRenderers(),
    triggerSelector: "#MARKETDATA_Modal .section-trigger"
  });

  // 2) Dropdown initialisieren (erst NACH Modal-DOM)
  initCurveSelectorGlobal();

  // 3) Re-render offene Panels wenn Curve geändert wurde
  document.addEventListener("curve:changed", () => {
    const pRates   = document.getElementById("panel-rates");
    const pForward = document.getElementById("panel-forward");

    if (pRates && !pRates.hidden) renderIRPanel();
    if (pForward && !pForward.hidden) handleFWDData();
  });

  // 4) Wenn EUSW data reinkommt → offene Panels refreshen
  document.addEventListener("eusw:data:ready", () => {
    const pRates   = document.getElementById("panel-rates");
    const pForward = document.getElementById("panel-forward");

    if (pRates && !pRates.hidden) renderIRPanel();
    if (pForward && !pForward.hidden) handleFWDData();
  });
}

export function refreshOpenMarketDataPanels() {
  refreshCore("marketdata");
}


