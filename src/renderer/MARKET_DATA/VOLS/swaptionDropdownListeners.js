// FRONT_END/MARKET_DATA/VOLS/swaptionDropdownListeners.js

import { renderVolSurfacePanel, renderSwaptionSmile } from './swaptionVols.js';
import { renderSwaptionCubeSurface3D, renderSwaptionCubeSummary } from './volCube.js';

export function bindSwaptionDropdownListeners() {
  if (window.__swaptionDropdownListenersBound) return;
  window.__swaptionDropdownListenersBound = true;

  // --- ATM / Smile Dropdowns ---
  const optSel = document.getElementById("swaptionOptionTenorSelect");
  const swpSel = document.getElementById("swaptionSwapTenorSelect");

  if (optSel && swpSel) {
    optSel.addEventListener("change", () => {
      renderVolSurfacePanel();
      renderSwaptionSmile();
    });

    swpSel.addEventListener("change", () => {
      renderVolSurfacePanel();
      renderSwaptionSmile();
    });
  }

  // --- Cube Dropdowns ---
  const cubeOptSel = document.getElementById('swaptionOptionTenorSelectCube');
  const cubeSwpSel = document.getElementById('swaptionSwapTenorSelectCube');

  if (cubeOptSel && cubeSwpSel) {
    cubeOptSel.addEventListener('change', () => {
      renderSwaptionCubeSurface3D();
      renderSwaptionCubeSummary();
    });

    cubeSwpSel.addEventListener('change', () => {
      renderSwaptionCubeSurface3D();
      renderSwaptionCubeSummary();
    });
  }
}
