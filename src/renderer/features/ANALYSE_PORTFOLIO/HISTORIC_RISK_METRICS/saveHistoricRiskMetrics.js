import { handleModalAction } from '../../../core/ui/modal/modalActions.js';
import { appState } from '../../../renderer.js';

function parseEuroString(str) {
  if (!str) return null;
  const cleaned = String(str)
    .replace(/[^\d,.-]/g, "")
    .replace(/,/g, "");
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

function parsePercentString(str) {
  if (!str) return null;
  const cleaned = String(str)
    .replace("%", "")
    .trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num / 100;
}

function getTodayIsoDate() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`; // "2025-11-20"
}

// "31-05-2021" -> "2021-05-31", "2025-11-20 00:00:00" -> "2025-11-20"
function normalizeDateToIso(value) {
  if (!value) return "";

  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  const s = String(value).trim();

  // YYYY-MM-DD irgendwo drin
  let m = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    return `${m[1]}-${m[2]}-${m[3]}`;
  }

  // DD-MM-YYYY
  m = s.match(/(\d{2})-(\d{2})-(\d{4})/);
  if (m) {
    const [_, dd, mm, yyyy] = m;
    return `${yyyy}-${mm}-${dd}`;
  }

  // 20251120
  if (/^\d{8}$/.test(s)) {
    return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  }

  return "";
}


export function showConfirmationBox(message, {
  confirmText = "OK",
  cancelText = null,          // wenn null -> kein Cancel-Button
  confirmClass = "confirmation-button-green",
  cancelClass = "confirmation-button-grey",
  dangerous = false           // optional, falls du rot willst
} = {}) {
  return new Promise(resolve => {
    const previouslyFocused = document.activeElement;

    const overlay = document.createElement("div");
    overlay.className = "confirmation-overlay";

    const modal = document.createElement("div");
    modal.className = "confirmation-modal";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "false"); // kein echtes Modal -> kein Fokus-Shift

    const msgEl = document.createElement("div");
    msgEl.className = "confirmation-message";
    msgEl.textContent = message;

    const btnWrap = document.createElement("div");
    btnWrap.className = "confirmation-button-container";

    const confirmBtn = document.createElement("button");
    confirmBtn.type = "button";
    confirmBtn.className =
      "confirmation-button " +
      (dangerous ? "confirmation-button-red" : confirmClass);
    confirmBtn.textContent = confirmText;

    btnWrap.appendChild(confirmBtn);

    let cancelBtn = null;
    if (cancelText) {
      cancelBtn = document.createElement("button");
      cancelBtn.type = "button";
      cancelBtn.className = "confirmation-button " + cancelClass;
      cancelBtn.textContent = cancelText;
      btnWrap.appendChild(cancelBtn);
    }

    modal.appendChild(msgEl);
    modal.appendChild(btnWrap);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // WICHTIG: NICHT confirmBtn.focus() -> Cursor bleibt wo er war

    const cleanup = (result) => {
      overlay.remove();
      if (previouslyFocused && typeof previouslyFocused.focus === "function") {
        requestAnimationFrame(() => {
          try { previouslyFocused.focus({ preventScroll: true }); } catch {}
        });
      }
      resolve(result);
    };

    confirmBtn.addEventListener("click", () => cleanup(true));
    if (cancelBtn) cancelBtn.addEventListener("click", () => cleanup(false));

    // ESC = Cancel falls vorhanden, sonst OK
    overlay.addEventListener("keydown", (e) => {
      if (e.key === "Escape") cleanup(Boolean(!cancelBtn));
    });

    // Klick auf Overlay NICHT schlieÃŸen (sonst unabsichtlich)
    modal.addEventListener("click", (e) => e.stopPropagation());
  });
}




export async function handleHistoricMetricsAddClick(event) {
  const tableName = "PortfolioHistoryMetrics";
  const elementId = "portDataContainer3";

  const dateIso = getTodayIsoDate();

  // âœ… Aktives Portfolio
  const port_name_raw = appState.getSelectedPortTableName?.();
  const port_name = String(port_name_raw ?? "").trim();

  if (!port_name) {
    await showConfirmationBox("No portfolio selected.", {
      confirmText: "OK",
      confirmClass: "confirmation-button-green",
      dangerous: true
    });
    return;
  }

  // 1) History-DATEN: ALLE holen (weil wir edit mit Index im Gesamtarray machen)
  const historyAll = appState?.getPortfolioHistoryData?.() || [];
  console.log("historyAll length:", historyAll.length, "port_name:", port_name);

  // 2) PrÃ¼fen, ob es fÃ¼r DIESEN port_name und HEUTE schon einen Eintrag gibt
  const existingIndex = historyAll.findIndex(row =>
    String(row?.port_name ?? "").trim() === port_name &&
    normalizeDateToIso(row?.DATE) === dateIso
  );

  const hasExisting = existingIndex !== -1;
  console.log("Existing index for", { dateIso, port_name }, "â†’", existingIndex);

  if (hasExisting) {
    await showConfirmationBox(
      `There is already a record for ${dateIso} in PortfolioHistoryMetrics for portfolio "${port_name}". Existing row will be edited/overwritten.`,
      { confirmText: "OK", confirmClass: "confirmation-button-green" }
    );
  }

  // 3) Portfoliodaten holen
  const portAgg = appState?.getPortAggData(elementId) || {};
  console.log("PortAggData for", elementId, portAgg);


  const notional   = parseEuroString(portAgg.formPortNotional);
  const value      = parseEuroString(portAgg.formPortValue);
  const valueBuy   = parseEuroString(portAgg.formPortValueBuy);
  const profitLoss = (value != null && valueBuy != null)? (value - valueBuy): null;
  const profitLossPct = (profitLoss != null && notional)? (profitLoss / notional): null;
  const pv01abs   = parseEuroString(portAgg.formPortPV01abs);
  const cpv01abs   = parseEuroString(portAgg.formPortCPV01abs);
  const pv01       = portAgg.formPortPV01 != null ? parseFloat(portAgg.formPortPV01) : null;
  const cpv01      = portAgg.formPortCPV01 != null ? parseFloat(portAgg.formPortCPV01) : null;
  const yieldBuy     = parsePercentString(portAgg.formPortYield);

  // -----------------------------------------------
  // 3b) MVaR-Daten aus appState holen (port_name = port_name)
  // -----------------------------------------------
  const allMvarData =
    (appState?.getAllMvarData?.() ??
     appState?.getAllMVaRData?.() ??
     null);

  let selectedMvarData = null;

  if (Array.isArray(allMvarData)) {
selectedMvarData = allMvarData.find(d => d?.port_name === port_name) || null;

  } else if (allMvarData && typeof allMvarData === "object") {
    if (port_name in allMvarData) {
      selectedMvarData = allMvarData[port_name];
    } else {
      const hitKey = Object.keys(allMvarData).find(k => {
        const v = allMvarData[k];
        const pn = v?.port_name || v?.PORT_NAME || v?.PORT || v?.port;
        return pn === port_name;
      });
      selectedMvarData = hitKey ? allMvarData[hitKey] : null;
    }
  }

  console.log("[MVaR] selected Porfolio only:", selectedMvarData);
  // -----------------------------------------------

  // -----------------------------------------------
// 3c) CVaR-Daten aus appState holen (port_name = port_name) - nur LOG
// -----------------------------------------------
const allCvarData =
  (appState?.getAllCvarData?.() ??
   appState?.getAllCVaRData?.() ??
   null);

let selectedCvarData = null;

if (Array.isArray(allCvarData)) {
  // Fall 1: Array von Rows/Objekten
selectedCvarData = allCvarData.find(d => d?.port_name === port_name) || null;

} else if (allCvarData && typeof allCvarData === "object") {
  // Fall 2: Map/Object mit Portnamen als Keys
  if (port_name in allCvarData) {
    selectedCvarData = allCvarData[port_name];
  } else {
    // Fall 3: Map/Object mit anderen Keys, innen steht port_name
    const hitKey = Object.keys(allCvarData).find(k => {
      const v = allCvarData[k];
      const pn = v?.port_name || v?.PORT_NAME || v?.PORT || v?.port;
      return pn === port_name;
    });
    selectedCvarData = hitKey ? allCvarData[hitKey] : null;
  }
}

console.log("[CVaR] selected Porfolio only:", selectedCvarData);

if (selectedCvarData && typeof selectedCvarData === "object") {
  console.log("[CVaR] selected Porfolio keys:", Object.keys(selectedCvarData));
}
// -----------------------------------------------


  // 4) Gemeinsame Payload-Werte (was wir in die DB schreiben wollen)
const payload = {
  port_name, 
  DATE: dateIso,
  PORTFOLIO_NOTIONAL: notional,
  PORTFOLIO_VALUE: value,
  PORTFOLIO_VALUE_BUY: valueBuy,
  PROFIT_LOSS : profitLoss,
  PROFIT_LOSS_PCT: profitLossPct,
  PV01: pv01abs, 
  CPV01: cpv01abs,
  MDURATION: pv01,
  CPV01bp: cpv01,
  RETURN: yieldBuy,

  // --- MVaR ABSOLUT (selected Porfolio -> DB) ---
  M_VaR_ALL: selectedMvarData?.VaR_T_abs  ?? null,
  M_VaR_IR:  selectedMvarData?.VaR_IR_abs ?? null,
  M_VaR_CS:  selectedMvarData?.VaR_CS_abs ?? null,

  M_ES_ALL:  selectedMvarData?.ES_T_abs  ?? null,
  M_ES_IR:   selectedMvarData?.ES_IR_abs ?? null,
  M_ES_CS:   selectedMvarData?.ES_CS_abs ?? null,

  // --- MVaR RELATIV / PCT (selected Porfolio -> DB) ---
  M_VaR_ALL_PCT: selectedMvarData?.VaR_T_rel  ?? null,
  M_VaR_IR_PCT:  selectedMvarData?.VaR_IR_rel ?? null,
  M_VaR_CS_PCT:  selectedMvarData?.VaR_CS_rel ?? null,

  M_ES_ALL_PCT:  selectedMvarData?.ES_T_rel  ?? null,
  M_ES_IR_PCT:   selectedMvarData?.ES_IR_rel ?? null,
  M_ES_CS_PCT:   selectedMvarData?.ES_CS_rel ?? null,

  // --- CVaR / Credit Risk (selected Porfolio -> DB) ---
  C_VaR:      selectedCvarData?.VaR_abs ?? null,
  C_VaR_PCT:  selectedCvarData?.VaR_rel ?? null,
  C_ES:       selectedCvarData?.ES_abs  ?? null,
  C_ES_PCT:   selectedCvarData?.ES_rel  ?? null,
};



if (hasExisting) {
  const dataForEdit = [...historyAll];

  const mergedRow = {
    ...dataForEdit[existingIndex],
    ...payload
  };

  dataForEdit[existingIndex] = mergedRow;

  console.log("Edit existing HistoricMetric row:", mergedRow);

  handleModalAction(event, dataForEdit, existingIndex, tableName, "edit");
} else {
  const newRow = { ...payload };
  const dataForAdd = [newRow];

  console.log("Add new HistoricMetric row:", newRow);

  handleModalAction(event, dataForAdd, null, tableName, "add");
}

}












