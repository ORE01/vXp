export function setupPythonProgressBars({
  initialProviders = ["ECB", "FED"],
  allowedProviders = null,
  indeterminateWhileRunning = false,
  clearOnDone = false,
  containerId = "progressBarsContainer",
  globalTextId = "progressText_GLOBAL",
  eventName = "py-progress"
} = {}) {
  const container = document.getElementById(containerId);
  const globalTxt = document.getElementById(globalTextId);

  // Optionaler Provider-Filter: nur Balken fuer diese Provider zulassen. Verhindert,
  // dass fremde Jobs (z.B. MVaR/CVaR) auf dem geteilten py-progress-Kanal Balken in
  // diesem Container erzeugen. null/leer = kein Filter (bisheriges Verhalten).
  const allowed = (Array.isArray(allowedProviders) && allowedProviders.length)
    ? new Set(allowedProviders)
    : null;

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

  // clearOnDone: Balken nach Fertigstellung ausblenden. Debounce -> erst wenn der
  // LETZTE Provider fertig ist (z.B. drei PD-Laeufe nacheinander), wird geleert.
  let clearTimer = null;

  // ✅ 3) Bind über robustes on()
  on(eventName, (data) => {
    const provider = data?.provider || "GLOBAL";

    if (provider === "GLOBAL") {
      if (globalTxt) globalTxt.textContent = data?.message ?? "";
      return;
    }

    // Fremde Provider ignorieren, wenn ein Filter gesetzt ist.
    if (allowed && !allowed.has(provider)) return;

    ensureProviderBar(provider);

    const bar = document.getElementById(`progressBar_${provider}`);
    const txt = document.getElementById(`progressText_${provider}`);

    const pct = Number(data?.progress ?? 0);
    if (bar) {
      // Jobs mit grober Fortschrittsmeldung (z.B. MVaR: 0 -> 100): waehrend des
      // Laufs animiert (indeterminate, value entfernt), bei Abschluss gefuellt.
      if (indeterminateWhileRunning && pct < 100) {
        bar.removeAttribute('value');
      } else {
        bar.value = pct;
      }
    }
    if (txt) txt.textContent = data?.message ?? "";

    if (clearOnDone) {
      if (pct >= 100) {
        // Fertig -> nach kurzer Haltezeit leeren (reset, wenn vorher noch etwas startet).
        clearTimeout(clearTimer);
        clearTimer = setTimeout(() => { try { container.innerHTML = ""; } catch (_) {} }, 1200);
      } else {
        // Ein (weiterer) Lauf hat begonnen -> geplantes Leeren abbrechen.
        clearTimeout(clearTimer);
        clearTimer = null;
      }
    }
  });

  //console.log(`[ProgressBars] Listening on "${eventName}" for #${containerId}`);
}

