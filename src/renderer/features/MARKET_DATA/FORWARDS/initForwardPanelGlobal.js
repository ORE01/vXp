// FRONT_END/MARKET_DATA/FORWARDS/initForwardPanelGlobal.js

import { handleFWDData } from "./forwardCurvePanel.js";
import { handleSwapForwardCurve } from "./forwardCurvePanel.js";

function renderForwardPanelNow(reason = "manual") {
  console.log(`[FORWARDS] renderForwardPanelNow reason=${reason}`);

  try {
    handleFWDData();
  } catch (err) {
    console.error("[FORWARDS] handleFWDData failed:", err);
  }

  try {
    handleSwapForwardCurve();
  } catch (err) {
    console.error("[FORWARDS] handleSwapForwardCurve failed:", err);
  }
}

export function initForwardPanelGlobalOnce() {
  const root = document.getElementById("panel-forward");
  if (!root) {
    console.warn("[FORWARDS INIT] panel-forward not found");
    return;
  }

  // nur 1x binden
  if (root.dataset.bound === "1") {
    console.log("[FORWARDS INIT] already bound");

    // Wichtig bei Lazy Render:
    // Wenn das Panel erneut geöffnet wird, trotzdem aktuellen State rendern.
    renderForwardPanelNow("already-bound-panel-opened");
    return;
  }

  root.dataset.bound = "1";

  console.log("[FORWARDS INIT] binding forward panel");

  const btnCMS1 = root.querySelector("#CMSButton1");
  const btnCMS2 = root.querySelector("#CMSButton2");
  const btnYears = root.querySelector("#applyYearsForwardButton");

  btnCMS1?.addEventListener("click", () => {
    console.log("[FORWARDS] CMSButton1 clicked");
    handleFWDData();
  });

  btnCMS2?.addEventListener("click", () => {
    console.log("[FORWARDS] CMSButton2 clicked");
    handleFWDData();
  });

  btnYears?.addEventListener("click", () => {
    console.log("[FORWARDS] applyYearsForwardButton clicked");
    handleSwapForwardCurve();
  });

  // Forwards ist von Interest Rates entkoppelt: eigene CCY/Curve-Auswahl im
  // Panel. Daher KEIN Re-Render mehr bei interest-rates:*-Events.

  // Wichtigster Fix:
  // Beim Öffnen des lazy Panels sofort mit aktueller Kurve neu rendern.
  renderForwardPanelNow("initial-panel-open");
}