export async function renderIRScenarioBuilder() {

  let baseCurveData = []; // 🔥 SOURCE OF TRUTH

  const ccySelect = document.getElementById('createScenarioCcy');
  const curveSelect = document.getElementById('createScenarioCurve');
  const scenarioSelect = document.getElementById('existingScenarioSelect');
  const tableContainer = document.getElementById('createScenarioTable');
  const saveBtn = document.getElementById('saveScenarioBtn');

  if (!ccySelect || !curveSelect || !scenarioSelect || !tableContainer || !saveBtn) return;

  // =====================================================
  // LOAD ALL CURVES
  // =====================================================

  const curves = await window.api.invoke('rates:get-available-curves');

  const ccys = [...new Set(curves.map(c => c.ccy))];

  ccySelect.innerHTML = '';
  ccys.forEach(ccy => {
    const opt = document.createElement('option');
    opt.value = ccy;
    opt.textContent = ccy;
    ccySelect.appendChild(opt);
  });

  // =====================================================
  // UPDATE CURVES
  // =====================================================

  async function updateCurves() {

    const selectedCcy = ccySelect.value;

    const filtered = curves.filter(c => c.ccy === selectedCcy);

    curveSelect.innerHTML = '';

    filtered.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.curve_id;
      opt.textContent = c.curve_id;
      curveSelect.appendChild(opt);
    });

    // RESET UI
    scenarioSelect.value = "";
    document.getElementById('createScenarioName').value = "";

    await loadScenarios();
    await loadBaseCurve();
  }

  ccySelect.onchange = updateCurves;

  curveSelect.onchange = async () => {

    scenarioSelect.value = "";
    document.getElementById('createScenarioName').value = "";

    await loadScenarios();
    await loadBaseCurve();
  };

  // =====================================================
  // LOAD SCENARIOS
  // =====================================================

  async function loadScenarios() {

    const ccy = ccySelect.value;
    const curve_id = curveSelect.value;

    if (!ccy || !curve_id) return;

    const scenarios = await window.api.invoke('rates:get-scenarios', {
      ccy,
      curve_id
    });

    scenarioSelect.innerHTML = '<option value="">-- Neues Szenario --</option>';

    scenarios.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s;
      opt.textContent = s;
      scenarioSelect.appendChild(opt);
    });
  }

  scenarioSelect.onchange = loadSelectedScenario;

  // =====================================================
  // LOAD BASE CURVE
  // =====================================================

  async function loadBaseCurve() {

    const ccy = ccySelect.value;
    const curve_id = curveSelect.value;

    if (!ccy || !curve_id) return;

    const res = await window.api.invoke('rates:get-base-curve', {
      ccy,
      curve_id
    });

    if (!res.success) {
      tableContainer.innerHTML = "<p>No BASE data</p>";
      return;
    }

    baseCurveData = JSON.parse(JSON.stringify(res.rows)); // 🔥 speichern
    renderTable(res.rows);
  }

  // =====================================================
  // LOAD SCENARIO
  // =====================================================

  async function loadSelectedScenario() {

    const selectedScenario = scenarioSelect.value;

    if (!selectedScenario) {
      loadBaseCurve();
      return;
    }

    const ccy = ccySelect.value;
    const curve_id = curveSelect.value;

    const res = await window.api.invoke('rates:get-scenario', {
      ccy,
      curve_id,
      scenario_id: selectedScenario
    });

    if (!res.success) return;

    document.getElementById('createScenarioName').value = selectedScenario;

    baseCurveData = JSON.parse(JSON.stringify(res.rows)); // 🔥 auch hier!
    renderTable(res.rows);
  }

  // =====================================================
  // TABLE
  // =====================================================

  function renderTable(rows) {

    let html = `
      <table class="ml-table">
        <thead>
          <tr>
            <th style="width:120px;">Tenor</th>
            <th>Rate</th>
          </tr>
        </thead>
        <tbody>
    `;

    rows.forEach(r => {
      html += `
        <tr>
          <td style="width:120px;">${r.tenor}</td>

          <td>
            <div style="display:flex; gap:6px; align-items:center;">

              <input type="number"
                     value="${r.value}"
                     data-tenor="${r.tenor}"
                     style="width:90px;" />

              <button class="fill-down-btn"
                      style="padding:2px 6px; cursor:pointer; border:1px solid #888; border-radius:4px; background:#222; color:#fff;">
                ⇩
              </button>

            </div>
          </td>
        </tr>
      `;
    });

    html += `</tbody></table>`;

    tableContainer.innerHTML = html;
  }

  // =====================================================
  // FILL DOWN
  // =====================================================

  tableContainer.addEventListener('click', (e) => {

    if (!e.target.classList.contains('fill-down-btn')) return;

    const row = e.target.closest('tr');
    const input = row.querySelector('input[data-tenor]');
    const value = input.value;

    let next = row.nextElementSibling;

    while (next) {
      const nextInput = next.querySelector('input[data-tenor]');
      if (nextInput) nextInput.value = value;
      next = next.nextElementSibling;
    }
  });

  // =====================================================
  // BASE SHIFT (🔥 FIXED VERSION)
  // =====================================================

  document.getElementById('applyShiftBtn').onclick = () => {

    const shiftValue = parseFloat(
      document.getElementById('parallelShiftInput').value
    );

    if (isNaN(shiftValue)) {
      alert("Ungültiger Shift");
      return;
    }

    const inputs = tableContainer.querySelectorAll('input[data-tenor]');

    inputs.forEach(input => {

      const tenor = input.dataset.tenor;

      const basePoint = baseCurveData.find(p => p.tenor === tenor);

      if (!basePoint) return;

      const newValue = parseFloat(basePoint.value) + shiftValue;

      input.value = newValue.toFixed(6);
    });

  };

  // =====================================================
  // SAVE
  // =====================================================

  saveBtn.onclick = async () => {

    const ccy = ccySelect.value;
    const curve_id = curveSelect.value;
    const scenarioName = document.getElementById('createScenarioName').value.trim();

    if (!scenarioName) {
      alert("Name fehlt");
      return;
    }

    const inputs = tableContainer.querySelectorAll('input[data-tenor]');

    const data = [];

    inputs.forEach(input => {
      data.push({
        tenor: input.dataset.tenor,
        value: parseFloat(input.value)
      });
    });

    await window.api.invoke("rates:create-scenario", {
      ccy,
      curve_id,
      scenario_id: scenarioName,
      type: 'full',
      data
    });

    await window.api.send('fetch-table-data', {
      table: 'RATES_SCENARIO_DATA'
    });

    alert("Gespeichert");
  };

  // INIT
  updateCurves();
}