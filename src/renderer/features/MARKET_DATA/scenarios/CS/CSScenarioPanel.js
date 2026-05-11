'use strict';

let csScenarioPanelListenersInstalled = false;

function normCcy(value) {
  return String(value || '').trim().toUpperCase();
}

function norm(value) {
  return String(value || '').trim();
}

function getCurvePackage(ccy, rank = 'senior_unsecured') {
  return `${ccy}:RATING:${rank}`;
}

export function renderCSScenarioPanel() {
  console.log('🔥 renderCSScenarioPanel CALLED');

  if (!csScenarioPanelListenersInstalled) {
    document.addEventListener('cs:scenario:ready', renderCSScenarioPanel);
    document.addEventListener('cs:active:ready', renderCSScenarioPanel);
    document.addEventListener('ccy:changed', renderCSScenarioPanel);

    csScenarioPanelListenersInstalled = true;
  }

  const container = document.getElementById('csScenarioContainer');
  if (!container) return;

  const appState = window.appState;
  if (!appState) return;

  const scenariosData = appState.getCSScenarioData?.() || [];
  const activeRows = appState.getCSActive?.() || [];

  // --------------------------------------------------
  // CCYs bestimmen
  // --------------------------------------------------
  const ccys = [...new Set([
    ...scenariosData.map(r => normCcy(r?.ccy)),
    ...activeRows.map(r => normCcy(r?.ccy))
  ])]
    .filter(Boolean)
    .sort();

  if (!ccys.length) {
    container.innerHTML = `<p>No CS currencies found.</p>`;
    return;
  }

  // --------------------------------------------------
  // Szenarien je CCY
  // --------------------------------------------------
  function getScenariosForCcy(ccy) {
    return [...new Set([
      'BASE',
      ...scenariosData
        .filter(r => normCcy(r?.ccy) === ccy)
        .map(r => norm(r?.scenario_id))
        .filter(Boolean)
    ])].sort((a, b) => {
      if (a === 'BASE') return -1;
      if (b === 'BASE') return 1;
      return a.localeCompare(b);
    });
  }

  // --------------------------------------------------
  // Aktives Szenario je CCY
  // --------------------------------------------------
  function getActiveScenarioForCcy(ccy, scenarios) {
    const activeForCcy =
      activeRows.find(r => normCcy(r?.ccy) === ccy) || null;

    let activeScenario = norm(activeForCcy?.scenario_id) || 'BASE';

    if (!scenarios.includes(activeScenario)) {
      activeScenario = 'BASE';
    }

    return activeScenario;
  }

  // --------------------------------------------------
  // HTML
  // --------------------------------------------------
  let html = `
    <table class="ml-table">
      <thead>
        <tr>
          <th>CCY</th>
          <th>Curve Package</th>
          <th>Select Scenario</th>
        </tr>
      </thead>
      <tbody>
  `;

  ccys.forEach(ccy => {
    const scenarios = getScenariosForCcy(ccy);
    const activeScenario = getActiveScenarioForCcy(ccy, scenarios);

    const curvePackage = getCurvePackage(ccy);

    const options = scenarios.map(scenario => {
      const selected = scenario === activeScenario ? 'selected' : '';
      return `<option value="${scenario}" ${selected}>${scenario}</option>`;
    }).join('');

    html += `
      <tr>
        <td>${ccy}</td>
        <td>${curvePackage}</td>
        <td>
          <select class="cs-scenario-select" data-ccy="${ccy}">
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

  // --------------------------------------------------
  // Apply Button
  // --------------------------------------------------
  const applyBtn = document.getElementById('applyCSScenarioChanges');
  if (!applyBtn) return;

  applyBtn.onclick = async () => {
    const selects = document.querySelectorAll('.cs-scenario-select');

    for (const sel of selects) {
      const scenario_id = norm(sel.value);
      const ccy = normCcy(sel.dataset.ccy);

      if (!scenario_id || !ccy) continue;

      const result = await window.api.invoke('cs:set-active-scenario', {
        scenario_id,
        ccy
      });

      console.log('[CS PANEL] set active result', {
        ccy,
        scenario_id,
        result
      });
    }
  };
}




















// 'use strict';

// let csScenarioPanelListenersInstalled = false;

// export function renderCSScenarioPanel() {
//   console.log('🔥 renderCSScenarioPanel CALLED');

//   if (!csScenarioPanelListenersInstalled) {
//     document.addEventListener('cs:scenario:ready', () => {
//       renderCSScenarioPanel();
//     });

//     document.addEventListener('cs:active:ready', () => {
//       renderCSScenarioPanel();
//     });

//     document.addEventListener('ccy:changed', () => {
//       renderCSScenarioPanel();
//     });

//     csScenarioPanelListenersInstalled = true;
//   }

//   const container = document.getElementById('csScenarioContainer');
//   if (!container) return;

//   const appState = window.appState;
//       if (!appState) return;

// const scenariosData = appState.getCSScenarioData?.() || [];
// const activeRows = appState.getCSActive?.() || [];

// const ccys = [...new Set([
//   ...scenariosData.map(r => String(r?.ccy || '').trim().toUpperCase()),
//   ...activeRows.map(r => String(r?.ccy || '').trim().toUpperCase())
// ])]
//   .filter(Boolean)
//   .sort();

// if (!ccys.length) {
//   container.innerHTML = `<p>No CS currencies found.</p>`;
//   return;
// }

// function getScenariosForCcy(ccy) {
//   return [...new Set([
//     'BASE',
//     ...scenariosData
//       .filter(r => String(r?.ccy || '').trim().toUpperCase() === ccy)
//       .map(r => String(r.scenario_id || '').trim())
//       .filter(Boolean)
//   ])].sort((a, b) => {
//     if (a === 'BASE') return -1;
//     if (b === 'BASE') return 1;
//     return a.localeCompare(b);
//   });
// }

// function getActiveScenarioForCcy(ccy, scenarios) {
//   const activeForCcy =
//     activeRows.find(r => String(r?.ccy || '').trim().toUpperCase() === ccy) ||
//     null;

//   let activeScenario =
//     String(activeForCcy?.scenario_id || 'BASE').trim() || 'BASE';

//   if (!scenarios.includes(activeScenario)) {
//     activeScenario = 'BASE';
//   }

//   return activeScenario;
// }

// let html = `
//   <table class="ml-table">
//     <thead>
//       <tr>
//         <th>CCY</th>
//         <th>Select Scenario</th>
//       </tr>
//     </thead>
//     <tbody>
// `;

// ccys.forEach(ccy => {
//   const scenarios = getScenariosForCcy(ccy);
//   const activeScenario = getActiveScenarioForCcy(ccy, scenarios);

//   let options = '';

//   scenarios.forEach(scenario => {
//     const selected = scenario === activeScenario ? 'selected' : '';
//     options += `<option value="${scenario}" ${selected}>${scenario}</option>`;
//   });

//   html += `
//     <tr>
//       <td>${ccy}</td>
//       <td>
//         <select class="cs-scenario-select" data-ccy="${ccy}">
//           ${options}
//         </select>
//       </td>
//     </tr>
//   `;
// });

// html += `
//     </tbody>
//   </table>
// `;

// container.innerHTML = html;







//   const select = document.getElementById('csScenarioSelect');

// const applyBtn = document.getElementById('applyCSScenarioChanges');

// if (!applyBtn) return;

// applyBtn.onclick = async () => {
//   const selects = document.querySelectorAll('.cs-scenario-select');

//   for (const sel of selects) {
//     const scenario_id = String(sel.value || '').trim();
//     const ccy = String(sel.dataset.ccy || '').trim().toUpperCase();

//     if (!scenario_id || !ccy) continue;

//     const result = await window.api.invoke('cs:set-active-scenario', {
//       scenario_id,
//       ccy
//     });

//     console.log('[CS PANEL] set active result', {
//       ccy,
//       scenario_id,
//       result
//     });
//   }
// };
// }