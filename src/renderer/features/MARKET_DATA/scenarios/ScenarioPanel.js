// features/MARKET_DATA/scenarios/ScenarioPanel.js

export function renderScenarioPanel() {

  const container = document.getElementById("ScenarioMappingContainer");
  if (!container) return;

  const appState = window.appState;

  if (!appState || !appState._RATESDataCacheByCcy) {
    container.innerHTML = "<p>No curve data available.</p>";
    return;
  }

  const ratesByCcy = appState._RATESDataCacheByCcy;
  const activeRows = appState.getRatesActive?.() || [];

  // ---------------------------------------------------
  // helper: active scenario
  // ---------------------------------------------------

function getActiveScenario(ccy, curveId) {

  const row = activeRows
    .filter(r => r.ccy === ccy && r.curve_id === curveId)
    .sort((a, b) =>
      new Date(b.activated_at || 0) - new Date(a.activated_at || 0)
    )[0];

  return row?.scenario_id || "BASE";

}

  // ---------------------------------------------------
  // helper: scenarios available
  // ---------------------------------------------------

  function getScenarios(ccy, curveId) {

    const rows = ratesByCcy[ccy] || [];

    const set = new Set();
console.log("rows sample", rows[0]);
    rows.forEach(r => {
      if (r.curve_id === curveId && r.scenario_id) {
        set.add(r.scenario_id);
      }
    });

    return [...set].sort();

  }

  // ---------------------------------------------------
  // collect curves
  // ---------------------------------------------------

  const rows = [];

  Object.keys(ratesByCcy).forEach(ccy => {

    const curves = new Set(
      ratesByCcy[ccy].map(r => r.curve_id)
    );

    curves.forEach(curveId => {
      rows.push({ ccy, curveId });
    });

  });

  if (!rows.length) {
    container.innerHTML = "<p>No curves found.</p>";
    return;
  }

  // ---------------------------------------------------
  // build table
  // ---------------------------------------------------

  let html = `
    <table class="ml-table">
      <thead>
        <tr>
          <th>CCY</th>
          <th>Curve</th>
          <th>Select Scenario</th>
        </tr>
      </thead>
      <tbody>
  `;

  rows.forEach(row => {

    const scenarios = getScenarios(row.ccy, row.curveId);
    const activeScenario = getActiveScenario(row.ccy, row.curveId);

    let options = "";

    scenarios.forEach(s => {

      const selected = s === activeScenario ? "selected" : "";

      options += `<option value="${s}" ${selected}>${s}</option>`;

    });

    html += `
      <tr>
        <td>${row.ccy}</td>
        <td>${row.curveId}</td>
        <td>
          <select class="scenario-select"
                  data-ccy="${row.ccy}"
                  data-curve="${row.curveId}">
            ${options}
          </select>
        </td>
      </tr>
    `;

  });

  html += `
      </tbody>
    </table>
  `;

  container.innerHTML = html;

  console.log("[ScenarioPanel] rendered", rows.length, "curves");

}


// =====================================================
// APPLY CHANGES
// =====================================================

const applyBtn = document.getElementById("applyScenarioChanges");

if (applyBtn) {

  applyBtn.onclick = async () => {

    const selects = document.querySelectorAll(".scenario-select");

    for (const sel of selects) {

      const ccy = sel.dataset.ccy;
      const curve_id = sel.dataset.curve;
      const scenario_id = sel.value;

      console.log("Applying scenario:", ccy, curve_id, scenario_id);

      await window.api.invoke("rates:set-active-scenario", {

        asof_date: "2026-02-27",
        active_run_id: "20260227_195620",
        ccy,
        curve_id,
        scenario_id

      });

    }

    // optional refresh UI
    //renderScenarioPanel();

  };

}