
import { setupPythonProgressBars } from './pythonProgressBars.js'; 
// Pfad ggf. anpassen wie bei pythonBridge

export function installPythonProgressBarsBridge() {
  // HIST-Progress
  setupPythonProgressBars({
    initialProviders: ["ECB", "FED"],
    containerId: "progressBarsContainer",
    globalTextId: "progressText_GLOBAL",
    eventName: "py-progress"
  });

  // EXCEL-Progress — pro Kachel ein eigener Container + passende Provider.
  // (Alle hören auf py-excel-progress; ein Provider-Balken wird nur EINMAL
  //  erzeugt, im Container seiner initialProviders.)
  setupPythonProgressBars({
    initialProviders: ["ALL"],
    containerId: "excelProgress_full",
    globalTextId: "progressText_EXCEL",
    eventName: "py-excel-progress"
  });
  setupPythonProgressBars({
    initialProviders: ["ISSUER", "PRODUCTS", "DEALS"],
    containerId: "excelProgress_master",
    globalTextId: "progressText_EXCEL",
    eventName: "py-excel-progress"
  });
  // "Get Market Data" (ERSTE, py-erste-progress) -> eigenes Panel "Market Data".
  setupPythonProgressBars({
    initialProviders: ["ERSTE"],
    containerId: "marketProgress_get",
    globalTextId: "progressText_MARKET",
    eventName: "py-erste-progress"
  });
  // "Import Market Data" (MARKET, py-excel-progress) -> bleibt im Excel-Import-Panel.
  setupPythonProgressBars({
    initialProviders: ["MARKET"],
    containerId: "excelProgress_market",
    globalTextId: "progressText_EXCEL",
    eventName: "py-excel-progress"
  });
}
