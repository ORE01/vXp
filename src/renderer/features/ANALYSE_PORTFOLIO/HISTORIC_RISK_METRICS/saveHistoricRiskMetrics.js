import { handleModalAction } from '../../../core/ui/modal/modalActions.js';
import { appState } from '../../../renderer.js';

// Fallback-Parser fuer de-DE-Waehrungsstrings ("EUR 212.380.052,00"): Punkt = Tausender,
// Komma = Dezimal. Primaer werden aber die rohen *Raw-Felder gelesen (siehe preferRaw) -
// dieser Parser greift nur, falls die roh-Werte fehlen (Alt-/Fremdaufrufe).
function parseEuroString(str) {
  if (str == null || str === "") return null;
  const cleaned = String(str)
    .replace(/[^\d,.-]/g, "")   // "EUR", Leerzeichen etc. weg
    .replace(/\./g, "")          // Tausenderpunkte entfernen
    .replace(/,/g, ".");         // Dezimalkomma -> Punkt
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

// Rohen Zahlenwert bevorzugen (format-once); nur wenn nicht vorhanden, den formatierten
// String parsen.
function preferRaw(raw, str) {
  const n = Number(raw);
  return Number.isFinite(n) ? n : parseEuroString(str);
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


  const notional   = preferRaw(portAgg.formPortNotionalRaw, portAgg.formPortNotional);
  const value      = preferRaw(portAgg.formPortValueRaw,    portAgg.formPortValue);
  const valueBuy   = preferRaw(portAgg.formPortValueBuyRaw, portAgg.formPortValueBuy);
  const profitLoss = (value != null && valueBuy != null)? (value - valueBuy): null;
  const profitLossPct = (profitLoss != null && notional)? (profitLoss / notional): null;
  const pv01abs   = preferRaw(portAgg.formPortPV01absRaw,  portAgg.formPortPV01abs);
  const cpv01abs   = preferRaw(portAgg.formPortCPV01absRaw, portAgg.formPortCPV01abs);
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

  // WICHTIG: dieselbe Zeile wie die Panel-KPI "portfolio total" waehlen, nicht einfach die
  // erste Portfolio-Zeile. Das Profit/Loss-Panel (mvarAggregatePanel.js) nimmt die MVaR-Zeile
  // fuer port_name + AKTUELL gewaehltes Interval (appState.selectedMvarInterval) + juengstes
  // asof_date. Vorher wurde per find(port_name) irgendein Szenario (z.B. TEST1) gespeichert ->
  // gespeicherter M_VaR_ALL wich vom angezeigten Wert (ROLLING_1) ab.
  const _norm = (s) => String(s ?? "").trim().toLowerCase();
  const _asof = (r) => String(r?.asof_date ?? r?.ASOF_DATE ?? "");
  const _mvarScenario = appState?.selectedMvarInterval;

  let selectedMvarData = null;

  if (Array.isArray(allMvarData)) {
    const forPort = allMvarData.filter(d => String(d?.port_name) === port_name);
    const scen = forPort.filter(d => _norm(d?.scenario_name) === _norm(_mvarScenario));
    // Bei gesetztem Interval nur dessen Zeilen; sonst (kein Match) Fallback auf alle Port-Zeilen.
    const pool = scen.length ? scen : forPort;
    selectedMvarData = pool.slice().sort((a, b) => _asof(a).localeCompare(_asof(b))).at(-1) || null;
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
  // Fall 1: Array von Rows/Objekten. Je Portfolio existieren mehrere Zeilen (pd_flag:
  // RATING = historic PD, MARKET = market-adjusted PD, NORM). Fuer den Historic-Snapshot
  // gezielt die historic-PD-Zeile (RATING) nehmen statt der ersten Array-Zeile.
  const forPort = allCvarData.filter(d => String(d?.port_name) === port_name);
  selectedCvarData =
    forPort.find(d => _norm(d?.pd_flag) === "rating") || forPort[0] || null;

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


  // Prozentzahl (0,195 = 0,195 %) -> Bruch (0,00195) fuer die *_PCT-Spalten.
  const _pctToFrac = (v) => (Number.isFinite(Number(v)) ? Number(v) / 100 : null);

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
  // MVaR-rel aus dem Lauf (MarketVaR) ist eine PROZENTZAHL (z.B. 0,195 = 0,195 %).
  // Historic-Metrics speichert *_PCT aber als BRUCH ("DB = roh") - so wie es alle
  // Consumer erwarten (History-Charts + marketRiskDashboard multiplizieren beim Anzeigen
  // mit 100) und wie die Altzeilen bereits vorliegen. Daher hier /100.
  M_VaR_ALL_PCT: _pctToFrac(selectedMvarData?.VaR_T_rel),
  M_VaR_IR_PCT:  _pctToFrac(selectedMvarData?.VaR_IR_rel),
  M_VaR_CS_PCT:  _pctToFrac(selectedMvarData?.VaR_CS_rel),

  M_ES_ALL_PCT:  _pctToFrac(selectedMvarData?.ES_T_rel),
  M_ES_IR_PCT:   _pctToFrac(selectedMvarData?.ES_IR_rel),
  M_ES_CS_PCT:   _pctToFrac(selectedMvarData?.ES_CS_rel),

  // --- CVaR / Credit Risk (selected Porfolio -> DB) ---
  // CVaR-rel ist bereits ein BRUCH (z.B. 0,044 = 4,4 %) - NICHT umrechnen.
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












