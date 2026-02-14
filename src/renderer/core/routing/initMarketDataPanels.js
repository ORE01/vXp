// initMarketDataPanels.js

import { initForwardPanelGlobalOnce } from "../../features/MARKET_DATA/FORWARDS/initForwardPanelGlobal.js";
import { initLazyPanels, refreshOpenPanels as refreshCore } from "./lazyPanelsCore.js";
import { initCurveSelectorGlobal } from "../../features/MARKET_DATA/INTEREST_RATES/initCurveSelectorGlobal.js";

import { renderIRPanel } from "../../features/MARKET_DATA/INTEREST_RATES/IR.js";
import { handleFWDData, handleSwapForwardCurve } from "../../features/MARKET_DATA/FORWARDS/forwards.js";

// Swaption Vols: 3D-ATM-Surface (Plotly) + Smile (Chart.js)
import { renderSwaptionIfReady } from "../../features/MARKET_DATA/VOLS/swaptionVols.js";
import { notifyRiskPreview } from '../../features/REPORTS/RiskPDFPreview.js';

import { createTSModals } from "../../features/MARKET_DATA/HISTORIC_DATA/TS.js";


// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// 1) Renderer-Registry fÃ¼r Lazy Panels
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

        
    "panel-ts": () => {
      const data = window.appState?.getTblTSData?.();
      if (data && data.length) {
        // Daten sind schon da â†’ Modals bauen
        createTSModals(data);
      } else {
        console.log("[TS] waiting for tblTSData - render will happen on data receive");
      }
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

  // 2) Curve-Selector initialisieren (erst NACH Modal-DOM)
  initCurveSelectorGlobal();

  // 3) Swaption-IPC: ATM/Smile â†’ wenn ready, Surface + Preview neu rendern
  document.addEventListener("swaption:atm:ready",   renderSwaptionAndPreview);
  document.addEventListener("swaption:smile:ready", renderSwaptionAndPreview);

  // 4) Re-render bei Curve-Change
  document.addEventListener("curve:changed", () => {
    const pRates    = document.getElementById("panel-rates");
    const pForward  = document.getElementById("panel-forward");
    const pSwaption = document.getElementById("panel-swaption");

    // â¬…ï¸ IR IMMER aktualisieren, sobald es das Panel gibt
    if (pRates) {
      renderIRPanel();
    }

    // Forward nur, wenn Panel tatsÃ¤chlich offen ist (Inputs etc.)
    if (pForward && !pForward.hidden) {
      handleFWDData();
      // handleSwapForwardCurve(); // bei Bedarf separat triggern
    }

    // Swaption nur, wenn Panel offen ist
    if (pSwaption && !pSwaption.hidden) {
      renderSwaptionAndPreview();
    }
  });

  // 5) Wenn neue EUSW-Daten reinkommen â†’ Panels refreshen
  document.addEventListener("eusw:data:ready", () => {
    const pRates    = document.getElementById("panel-rates");
    const pForward  = document.getElementById("panel-forward");
    const pSwaption = document.getElementById("panel-swaption");

    // â¬…ï¸ IR IMMER aktualisieren, damit IRDataContainer eine Tabelle hat
    if (pRates) {
      renderIRPanel();
    }

    // Forward weiterhin nur, wenn Panel offen
    if (pForward && !pForward.hidden) {
      handleFWDData();
      // handleSwapForwardCurve(); // optional
    }

    // Swaption nur bei offenem Panel
    if (pSwaption && !pSwaption.hidden) {
      renderSwaptionIfReady();
    }
  });
}






function renderSwaptionAndPreview() {
  renderSwaptionIfReady();

  // Plotly/WebGL braucht oft einen Tick lÃ¤nger â†’ 2 Frames warten
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      notifyRiskPreview('swaption');   // <â€” HIER
    });
  });
}



// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// 3) Externer Refresh-Hook fÃ¼r alle Market-Data-Panels
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export function refreshOpenMarketDataPanels() {
  refreshCore("marketdata");
}







