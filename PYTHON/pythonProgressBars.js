export function setupPythonProgressBars({
  initialProviders = ["ECB", "FED"],
  containerId = "progressBarsContainer",
  globalTextId = "progressText_GLOBAL",
  eventName = "py-progress"
} = {}) {
  const container = document.getElementById(containerId);
  const globalTxt = document.getElementById(globalTextId);

  if (!container) {
    console.warn(`[ProgressBars] Container #${containerId} not found.`);
    return;
  }

  // ✅ 1) Robust: api.on ODER api.receive
  const api = window.api;
  const on =
    (api?.on && api.on.bind(api)) ||
    (api?.receive && api.receive.bind(api));

  if (!on) {
    console.warn(`[ProgressBars] window.api.on/receive not available for event "${eventName}"`);
    return;
  }

  // ✅ 2) Duplicate-Guard (sonst: mehrfaches Binden nach Reloads / Tabs)
  window.__progressBarListeners ??= new Set();
  const key = `${containerId}::${eventName}`;
  if (window.__progressBarListeners.has(key)) return;
  window.__progressBarListeners.add(key);

  function ensureProviderBar(provider) {
    const barId = `progressBar_${provider}`;
    if (document.getElementById(barId)) return;

    const row = document.createElement("div");
    row.className = "provider-progress";
    row.innerHTML = `
      <div class="provider-label">${provider}</div>
      <progress id="${barId}" value="0" max="100"></progress>
      <div id="progressText_${provider}" class="progress-text">Waiting...</div>
    `;
    container.appendChild(row);
  }

  for (const p of initialProviders) {
    ensureProviderBar(p);
    const bar = document.getElementById(`progressBar_${p}`);
    const txt = document.getElementById(`progressText_${p}`);
    if (bar) bar.value = 0;
    if (txt) txt.textContent = "Waiting...";
  }

  if (globalTxt) globalTxt.textContent = "Starting...";

  // ✅ 3) Bind über robustes on()
  on(eventName, (data) => {
    const provider = data?.provider || "GLOBAL";

    if (provider === "GLOBAL") {
      if (globalTxt) globalTxt.textContent = data?.message ?? "";
      return;
    }

    ensureProviderBar(provider);

    const bar = document.getElementById(`progressBar_${provider}`);
    const txt = document.getElementById(`progressText_${provider}`);

    if (bar) bar.value = data?.progress ?? 0;
    if (txt) txt.textContent = data?.message ?? "";
  });

  //console.log(`[ProgressBars] Listening on "${eventName}" for #${containerId}`);
}

