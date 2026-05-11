// src/renderer/features/MARKET_DATA/scenarios/ScenarioPanel.js

import { renderIRScenarioBuilder } from './IRScenarioBuilder.js';

export function renderIRScenarioPanel() {

  const container = document.getElementById("ScenarioMappingContainer");
  if (!container) return;

  const appState = window.appState;

  // =====================================================
  // WAIT FOR DATA
  // =====================================================

  if (
    !appState ||
    !appState._RATESDataCacheByCcy ||
    Object.keys(appState._RATESDataCacheByCcy).length === 0
  ) {
    console.log('[ScenarioPanel] waiting for rates data');

    container.innerHTML = "<p>Loading market data...</p>";
    return;
  }

  const ratesByCcy = appState._RATESDataCacheByCcy;
  const activeRows = appState.getRatesActive() || [];

  // =====================================================
  // INSTALL LISTENER (ONLY ONCE)
  // =====================================================

  if (!window.__scenarioPanelListenerInstalled) {
    document.addEventListener('rates:data:ready', () => {
      console.log('[ScenarioPanel] re-render after data');
      renderIRScenarioPanel();
    });

    document.addEventListener('rates:snapshots:ready', () => {
      console.log('[ScenarioPanel] re-render after snapshots');
      renderIRScenarioPanel();
    });
    window.__scenarioPanelListenerInstalled = true;
  }

  // =====================================================
  // HELPERS
  // =====================================================

  function getActiveScenario(ccy, curveId) {
    const row = activeRows
      .filter(r => r.ccy === ccy && r.curve_id === curveId)
      .sort((a, b) =>
        new Date(b.activated_at || 0) - new Date(a.activated_at || 0)
      )[0];

    return row?.scenario_id || "BASE";
  }

  function getScenarios(ccy, curveId) {
    const snapshotRows = appState.getRatesScenarioData?.() || [];

    const set = new Set(['BASE']);

    snapshotRows.forEach(r => {
      if (r.ccy === ccy && r.curve_id === curveId && r.scenario_id) {
        set.add(r.scenario_id);
      }
    });

    const result = [...set].sort((a, b) => {
      if (a === 'BASE') return -1;
      if (b === 'BASE') return 1;
      return a.localeCompare(b);
    });

    console.log(`[ScenarioPanel] ${ccy} ${curveId} scenarios:`, result);

    return result;
  }

  // =====================================================
  // COLLECT CURVES
  // =====================================================

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

  // =====================================================
  // BUILD TABLE
  // =====================================================

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
    const snapshots = window.appState.getRatesScenarioData?.() || [];

    for (const sel of selects) {
      const ccy = sel.dataset.ccy;
      const curve_id = sel.dataset.curve;
      const scenario_id = sel.value;

      let asof_date = null;
      let active_run_id = "BASE";

      if (scenario_id !== "BASE") {
        const matchingRows = snapshots.filter(r =>
          r.ccy === ccy &&
          r.curve_id === curve_id &&
          r.scenario_id === scenario_id
        );

        const latest = matchingRows.sort((a, b) => {
          const dateCompare = new Date(b.asof_date || 0) - new Date(a.asof_date || 0);
          if (dateCompare !== 0) return dateCompare;
          return String(b.run_id || '').localeCompare(String(a.run_id || ''));
        })[0];

        if (!latest) {
          console.warn("[ScenarioPanel] No snapshot rows for scenario:", {
            ccy,
            curve_id,
            scenario_id
          });
          continue;
        }

        asof_date = latest.asof_date;
        active_run_id = latest.run_id;
      }

      console.log("Applying scenario:", {
        ccy,
        curve_id,
        scenario_id,
        asof_date,
        active_run_id
      });

      await window.api.invoke("rates:set-active-scenario", {
        asof_date,
        active_run_id,
        ccy,
        curve_id,
        scenario_id
      });
    }
  };

}




