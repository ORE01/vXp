// FRONT_END/PYTHON/pythonProgressBarsBridge.js
import { setupPythonProgressBars } from '../PYTHON/pythonProgressBars.js'; 
// Pfad ggf. anpassen wie bei pythonBridge

export function installPythonProgressBarsBridge() {
  // HIST-Progress
  setupPythonProgressBars({
    initialProviders: ["ECB", "FED"],
    containerId: "progressBarsContainer",
    globalTextId: "progressText_GLOBAL",
    eventName: "py-progress"
  });

  // EXCEL-Progress
  setupPythonProgressBars({
    initialProviders: ["ALL", "ISSUER", "PRODUCTS", "DEALS", "EUSW"],
    containerId: "excelProgressBarsContainer",
    globalTextId: "progressText_EXCEL",
    eventName: "py-excel-progress"
  });
}
