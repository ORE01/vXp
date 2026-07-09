'use strict';

// SETUP → Data Sources: Speicherort der Input-Workbooks (UNI_DATA.xlsm / MARKET_DATA.xlsm)
// waehlbar machen (z.B. gemeinsamer Netzwerkordner). Kanaele:
//   data-inputs:get-paths / :select / :reset  (Main: excel.handlers.js)
// Der gewaehlte Pfad wird persistiert und beim Python-Spawn als Env-Override
// (UNI_DATA_PATH / MARKET_DATA_PATH) durchgereicht.

function fillPaths(res) {
  const set = (id, info) => {
    const el = document.getElementById(id);
    if (!el) return;
    const p = (info && info.path) ? String(info.path) : '–';
    el.textContent = p;
    el.title = p;
    el.classList.toggle('ds-path--override', !!(info && info.isOverride));
  };
  set('dsPathBusiness', res && res.business);
  set('dsPathMarket', res && res.market);
}

// Quell-Angabe je Import-Button (UPDATES → Excel Import): dauerhaft anzeigen, aus
// welcher Datei der jeweilige Import liest (effektiver Pfad, inkl. SETUP-Override).
function fillImportSources(res) {
  const b = res && res.business ? res.business.path : null;
  const m = res && res.market ? res.market.path : null;
  const line = (p) => (p ? `reads: ${p}` : 'reads: –');
  document.querySelectorAll('.upd-src[data-src-key]').forEach((el) => {
    const key = el.getAttribute('data-src-key');
    let text = '';
    if (key === 'business') text = line(b);
    else if (key === 'market') text = line(m);
    else if (key === 'both') text = `reads: ${b || '–'}  +  ${m || '–'}`;
    el.textContent = text;
    el.title = text;
  });
}

async function loadDataSourcePaths() {
  try {
    const res = await window.api.invoke('data-inputs:get-paths');
    fillPaths(res);
    fillImportSources(res);
  } catch (e) { console.warn('[DataSources] get-paths failed', e); }
}

async function chooseDataSource(key) {
  try {
    const res = await window.api.invoke('data-inputs:select', key);
    if (res && res.success) await loadDataSourcePaths();
  } catch (e) { console.warn('[DataSources] select failed', e); }
}

async function resetDataSource(key) {
  try {
    const res = await window.api.invoke('data-inputs:reset', key);
    if (res && res.success) await loadDataSourcePaths();
  } catch (e) { console.warn('[DataSources] reset failed', e); }
}

let _bound = false;
export function initDataSourcesPanel() {
  if (_bound) return;
  _bound = true;
  const bind = (id, fn) => { const el = document.getElementById(id); if (el) el.addEventListener('click', fn); };
  bind('dsChooseBusiness', () => chooseDataSource('business'));
  bind('dsResetBusiness', () => resetDataSource('business'));
  bind('dsChooseMarket', () => chooseDataSource('market'));
  bind('dsResetMarket', () => resetDataSource('market'));
  // Beim Oeffnen des SETUP-Panels ODER des Excel-Import-Panels die Pfade/Quellen laden.
  document.addEventListener('panel:opened', (e) => {
    const id = e && e.detail && e.detail.panelId;
    if (id === 'panel-data-sources' || id === 'panel-upd-excel') loadDataSourcePaths();
  });
  // Einmal initial laden (falls das Panel schon sichtbar ist).
  loadDataSourcePaths();
}
