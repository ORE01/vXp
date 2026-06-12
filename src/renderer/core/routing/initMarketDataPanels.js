// initMarketDataPanels.js

import { initForwardPanelGlobalOnce } from "../../features/MARKET_DATA/forwards/initForwardPanelGlobal.js";
import { initLazyPanels, refreshOpenPanels as refreshCore } from "./panelOrchestrator.js";


import { renderInterestRateCurvePanel} from "../../features/MARKET_DATA/interestRates/interestRateCurvePanel.js";
import { handleFWDData, handleSwapForwardCurve } from "../../features/MARKET_DATA/forwards/forwardCurvePanel.js";

// Swaption Vols: 3D-ATM-Surface (Plotly) + Smile (Chart.js)
import { renderSwaptionIfReady } from "../../features/MARKET_DATA/VOLS/swaptionVols.js";
import { notifyRiskPreview } from '../../features/REPORTS/RiskPDFPreview.js';

import { createTSModals } from "../../features/MARKET_DATA/HISTORIC_DATA/TS.js";

import { renderIRScenarioPanel } from "../../features/MARKET_DATA/scenarios/IR/IRScenarioPanel.js";
import { renderIRScenarioBuilder } from "../../features/MARKET_DATA/scenarios/IR/IRScenarioBuilder.js";

import { renderCSScenarioPanel } from "../../features/MARKET_DATA/scenarios/CS/CSScenarioPanel.js";
import { renderCSScenarioBuilder } from "../../features/MARKET_DATA/scenarios/CS/CSScenarioBuilder.js";
import { renderCreditSpreadCurveChart } from "../../features/MARKET_DATA/CREDIT_SPREADS/renderCreditSpreadCurveChart.js";

import { renderVolScenarioPanel } from "../../features/MARKET_DATA/scenarios/VOLS/VolScenarioPanel.js";
import { renderVolScenarioBuilder } from "../../features/MARKET_DATA/scenarios/VOLS/VolScenarioBuilder.js";


// ====================================================================================================================================================================================
// 1) Renderer-Registry fuer Lazy Panels
// =======================================================================================================================================================================================
export function getMarketDataPanelRenderers() {
  return {

    // ======================================================
    // INTEREST RATES (Curve Viewer)
    // ======================================================
    "panel-rates": () => {
      renderInterestRateCurvePanel();
    },

    // ======================================================
    // MARKET SCENARIOS (Curve → Scenario Mapping)
    // ======================================================
    "panel-scenarios": () => {
        renderIRScenarioPanel();
        renderCSScenarioPanel();
        renderVolScenarioPanel();
    },

    "panel-create-scenario": () => {
        renderIRScenarioBuilder();
    },

    "panel-create-cs-scenario": () => {
        renderCSScenarioBuilder();
    },

    "panel-create-vol-scenario": () => {
        renderVolScenarioBuilder();
    },

    // ======================================================
    // FORWARD CURVES
    // ======================================================
    "panel-forward": () => {
      initForwardPanelGlobalOnce();
      handleFWDData();
      handleSwapForwardCurve();
    },

    // ======================================================
    // SWAPTION VOLS (ATM Surface + Smile)
    // ======================================================
    "panel-swaption": () => {
      renderSwaptionAndPreview();
    },

    // ======================================================
    // HISTORIC DATA
    // ======================================================
    "panel-ts": () => {
      const data = window.appState?.getTblTSData?.();

      if (data && data.length) {
        createTSModals(data);
      } else {
        console.log("[TS] waiting for tblTSData - render will happen on data receive");
      }
    },

    // ======================================================
    // FUTURE EXTENSIONS
    // ======================================================
    "panel-creditspreads": () => {
      renderCreditSpreadCurveChart();
    },
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

  

  // 3) Swaption-IPC: ATM/Smile â†’ wenn ready, Surface + Preview neu rendern
  document.addEventListener("swaption:atm:ready",   renderSwaptionAndPreview);
  document.addEventListener("swaption:smile:ready", renderSwaptionAndPreview);

  // 4) Re-render bei Curve-Change
  document.addEventListener("curve:changed", () => {
    const pRates    = document.getElementById("panel-rates");
    const pForward  = document.getElementById("panel-forward");
    const pSwaption = document.getElementById("panel-swaption");

    // IR IMMER aktualisieren, sobald es das Panel gibt
    if (pRates) {
      renderInterestRateCurvePanel();
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

    // IR IMMER aktualisieren, damit IRDataContainer eine Tabelle hat
    if (pRates) {
      renderInterestRateCurvePanel();
    }

    // Forward weiterhin nur, wenn Panel offen
    if (pForward && !pForward.hidden) {
      handleFWDData();
      // handleSwapForwardCurve(); // optional
    }

    // Swaption nur bei offenem Panel
    if (pSwaption && !pSwaption.hidden && pSwaption.classList.contains('open')) {
      renderSwaptionAndPreview();
    }

    document.addEventListener("ccy:changed", () => {
      const pRates = document.getElementById("panel-rates");
      const pForward = document.getElementById("panel-forward");
      const pSwaption = document.getElementById("panel-swaption");
      const pCS = document.getElementById("panel-creditspreads");

      if (pRates) {
        renderInterestRateCurvePanel();
      }

      if (pForward && !pForward.hidden) {
        handleFWDData();
      }

      if (pSwaption && !pSwaption.hidden && pSwaption.classList.contains("open")) {
        renderSwaptionAndPreview();
      }

      if (pCS && !pCS.hidden) {
        renderCreditSpreadCurveChart();
      }
    });

  });
}






let swaptionRenderQueued = false;
let swaptionPreviewQueued = false;

function isSwaptionPanelOpen() {
  const panel = document.getElementById('panel-swaption');

  return Boolean(
    panel &&
    !panel.hidden &&
    panel.classList.contains('open')
  );
}

function isRiskPreviewVisible() {
  const reportsModal = document.getElementById('REPORTS_Modal');
  const previewPanel = document.getElementById('risk-preview');

  const reportsOpen =
    reportsModal &&
    !reportsModal.hidden &&
    reportsModal.classList.contains('open');

  const previewVisible =
    previewPanel &&
    previewPanel.offsetParent !== null;

  return Boolean(reportsOpen && previewVisible);
}

function renderSwaptionAndPreview() {
  if (!isSwaptionPanelOpen()) return;
  if (swaptionRenderQueued) return;

  swaptionRenderQueued = true;

  requestAnimationFrame(() => {
    swaptionRenderQueued = false;

    renderSwaptionIfReady();

    if (!isRiskPreviewVisible()) {
      swaptionPreviewQueued = false;
      return;
    }

    if (swaptionPreviewQueued) return;
    swaptionPreviewQueued = true;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        swaptionPreviewQueued = false;
        notifyRiskPreview('swaption');
      });
    });
  });
}




// 3) Externer Refresh-Hook fÃ¼r alle Market-Data-Panels

export function refreshOpenMarketDataPanels() {
  refreshCore("marketdata");
}







