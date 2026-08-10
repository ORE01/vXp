// src/main/ipc/handlers/python.handlers.js
'use strict';

const fs = require('fs');
const pathMod = require('path');
const { dialog } = require('electron');
const { getFilesBaseDir, getExcelPath, getDatabasePath, getExcelEnvOverrides, getEffectiveExcelPath } = require('../../main.path');
const { resolveOneShotCommand } = require('../../services/python.service');

// ---- ERSTE-Zieldatei (vom User per "Browse" wählbar, persistiert) ----
function _ersteTargetFile() {
  return pathMod.join(getFilesBaseDir(), 'erste_target.json');
}
function _defaultErsteTarget() {
  // Default = der im SETUP (Data Sources) eingestellte Market-Pfad, damit die ERSTE-
  // Abfrage genau dorthin schreibt, wo der Market-Import liest. Dynamisch (folgt dem
  // SETUP-Override, inkl. X:\ / UNC), solange hier nichts explizit gewaehlt wurde.
  try { return getEffectiveExcelPath('market').path || getExcelPath('MARKET_DATA.xlsm'); }
  catch (_) { return getExcelPath('MARKET_DATA.xlsm'); }
}
function readErsteTarget() {
  try {
    const obj = JSON.parse(fs.readFileSync(_ersteTargetFile(), 'utf-8'));
    if (obj && typeof obj.target === 'string' && obj.target) return obj.target;
  } catch (_) { /* keine/ungültige Datei -> Default */ }
  return _defaultErsteTarget();
}
// Ist aktuell ein EXPLIZIT gewaehltes Target gesetzt (vs. SETUP-Default)?
function _hasExplicitErsteTarget() {
  try {
    const obj = JSON.parse(fs.readFileSync(_ersteTargetFile(), 'utf-8'));
    return !!(obj && typeof obj.target === 'string' && obj.target.trim());
  } catch (_) { return false; }
}
// Explizite Wahl loeschen -> readErsteTarget faellt auf _defaultErsteTarget (SETUP) zurueck.
function clearErsteTarget() {
  try { fs.unlinkSync(_ersteTargetFile()); } catch (_) {}
  try { fs.unlinkSync(pathMod.join(getFilesBaseDir(), 'erste_cache.json')); } catch (_) {}
}
function writeErsteTarget(p) {
  try {
    // Kanonisch normalisieren (UNC-sicher), konsistent zum SETUP-Override.
    const target = pathMod.normalize(String(p || ''));
    fs.writeFileSync(_ersteTargetFile(), JSON.stringify({ target }, null, 2), 'utf-8');
  } catch (e) { /* nicht fatal */ }
}

// main.py/main.exe schreibt "___RESULT___{json}" auf stdout. Extrahiert das JSON
// (letzte Fundstelle). Rückgabe: geparstes Objekt oder null.
function _parseWorkerResult(stdout) {
  const marker = '___RESULT___';
  const lines = String(stdout || '').split(/\r?\n/);
  for (let i = lines.length - 1; i >= 0; i--) {
    const idx = lines[i].indexOf(marker);
    if (idx !== -1) {
      try { return JSON.parse(lines[i].slice(idx + marker.length)); } catch (_) { return null; }
    }
  }
  return null;
}

// Nur EINEN asof-Stichtag pro (port, scenario) in den MarketVaR-Ergebnistabellen halten:
// aeltere, NICHT bewusst gespeicherte Laeufe werden bei jeder Neurechnung ersetzt/geloescht.
// Bewusst gespeicherte Historie liegt separat in PortfolioHistoryMetrics ("Save to Historic
// Metrics") und bleibt davon unberuehrt.
async function pruneMvarToLatestAsof(dbApi) {
  if (!dbApi || typeof dbApi.runSQL !== 'function') return;
  const tables = ['MarketVaR', 'MarketVaR_Dist', 'MarketVaR_Product', 'MarketVaR_FactorPL', 'MarketVaR_FactorReturns'];
  for (const t of tables) {
    try {
      await dbApi.runSQL(
        `DELETE FROM ${t}
         WHERE port_name || '|' || scenario_name || '|' || asof_date NOT IN (
           SELECT port_name || '|' || scenario_name || '|' || MAX(asof_date)
           FROM ${t}
           GROUP BY port_name, scenario_name
         )`
      );
    } catch (e) {
      console.warn(`[MVaR prune] ${t} failed:`, e?.message || e);
    }
  }
}

module.exports = function registerPythonHandlers({
  ipcMain,
  startPythonScriptWithEvent,
  refreshTable,
  dbApi,
}) {
if (!ipcMain) throw new Error('[python.handlers] ipcMain missing');
  if (typeof startPythonScriptWithEvent !== 'function') throw new Error('[python.handlers] startPythonScriptWithEvent missing');
  if (typeof refreshTable !== 'function') throw new Error('[python.handlers] refreshTable missing');

  // ===================== ERSTE TARGET WORKBOOK (Browse) =====================
  // Aktuelle Zieldatei zurückgeben. isDefault = folgt dem SETUP-Market-Pfad (kein
  // explizites Target gewaehlt).
  ipcMain.handle('erste:get-target', async () => {
    const p = readErsteTarget();
    return { path: p, name: pathMod.basename(p), isDefault: !_hasExplicitErsteTarget() };
  });

  // Explizite Wahl loeschen -> zurueck auf den SETUP-Market-Pfad.
  ipcMain.handle('erste:reset-target', async () => {
    clearErsteTarget();
    const p = readErsteTarget();
    return { path: p, name: pathMod.basename(p), isDefault: true };
  });

  // Datei-Dialog: Zielmappe für den Scrape wählen (vorbelegt auf files/).
  ipcMain.handle('erste:select-target', async () => {
    try {
      const res = await dialog.showOpenDialog({
        title: 'Select target workbook for market data',
        defaultPath: getFilesBaseDir(),
        properties: ['openFile'],
        filters: [{ name: 'Excel Workbook', extensions: ['xlsx', 'xlsm'] }],
      });
      if (res.canceled || !res.filePaths || !res.filePaths.length) {
        return { canceled: true };
      }
      const target = res.filePaths[0];
      writeErsteTarget(target);
      // Zielwechsel -> Cache verwerfen, damit der nächste Abruf SICHER neu schreibt.
      try { fs.unlinkSync(pathMod.join(getFilesBaseDir(), 'erste_cache.json')); } catch (_) {}
      return { canceled: false, path: pathMod.normalize(target), name: pathMod.basename(target), isDefault: false };
    } catch (e) {
      return { canceled: true, error: e.message };
    }
  });

  // ===================== GET MARKET DATA (Erste) =====================
  // Holt den Erste-Swap-Snapshot und schreibt ihn als Sheet "ERSTE_snapshot"
  // in MARKET_DATA.xlsm. Läuft als EIGENER Subprozess (xlwings/Excel-COM), NICHT
  // im Dauer-Worker. Danach drückt der User separat "EUSW + ATM + Smile".
  ipcMain.on('start-py-erste', (event, args = {}) => {
    const cp = require('child_process');
    const envName = (process.env.NODE_ENV || '').trim().toLowerCase();

    const finish = (success, message) => {
      event.reply('py-erste-complete', { success, projectName: 'py-erste', message });
      event.reply('project-finished', { success, projectName: 'py-erste' });
    };

    // ERSTE-Fetch über den Worker-Dispatch (main.py 'erste') als Einmal-Prozess.
    // Systemkonform je Modus (dev: python main.py; thomasdev/prod: main.exe) —
    // KEIN Dev-Gate, KEINE hartkodierten Pfade.
    const types = Array.isArray(args.types) ? args.types.filter(Boolean) : [];
    const flags = [];
    if (types.length) flags.push('--types', types.join(','));
    // Zielmappe: vom User per "Browse" gewählt (readErsteTarget), sonst Default.
    flags.push('--target', readErsteTarget());

    let exe, spawnArgs, cwd;
    try {
      ({ exe, args: spawnArgs, cwd } = resolveOneShotCommand('erste', flags));
    } catch (e) {
      finish(false, `Start failed: ${e.message}`);
      return;
    }

    let stdout = '';
    let stderrErr = '';   // nur Nicht-Progress-stderr (für Fehlermeldung)
    let stderrBuf = '';
    let child;
    try {
      child = cp.spawn(exe, spawnArgs, { windowsHide: true, cwd, env: { ...process.env, UNI_DB_PATH: getDatabasePath(), ...getExcelEnvOverrides() } });
    } catch (e) {
      finish(false, `Start failed: ${e.message}`);
      return;
    }

    child.stdout.on('data', (d) => { stdout += d.toString(); });

    // stderr zeilenweise: Progress-JSON -> py-erste-progress, Rest -> Fehlertext.
    child.stderr.on('data', (d) => {
      stderrBuf += d.toString();
      const lines = stderrBuf.split(/\r?\n/);
      stderrBuf = lines.pop();
      for (const line of lines) {
        const t = line.trim();
        if (!t) continue;
        try {
          const parsed = JSON.parse(t);
          if (parsed && typeof parsed.progress !== 'undefined') {
            event.reply('py-erste-progress', parsed);
            continue;
          }
        } catch (_) { /* kein JSON -> Fehlertext */ }
        stderrErr += t + '\n';
      }
    });

    child.on('error', (err) => finish(false, `Error: ${err.message}`));
    child.on('close', (code) => {
      // main.py schreibt ___RESULT___{json} auf stdout -> status/message lesen.
      const res = _parseWorkerResult(stdout);
      const ok = res ? res.status === 'ok' : code === 0;
      if (ok) {
        // Baut zusätzlich die Kurven in RATES_BASE -> Panel aktualisieren.
        try { refreshTable('RATES_BASE'); } catch (_) {}
      }
      const msg = res
        ? (res.message || res.error || (ok ? 'Market data fetched.' : `Error (exit code ${code}).`))
        : (ok ? (stdout.trim() || 'Market data fetched.') : (stderrErr.trim() || `Error (exit code ${code}).`));
      finish(ok, msg);
    });
  });

  // ===================== CURVE CONSTRUCTION (curve_spreads) =====================
  // Kleiner Editor für die flachen bp-Spreads, aus denen die Kurven
  // OIS/3M/6M/12M gebaut werden (6M-Basis + spread_bp/10000).

  // Währungen für das Dropdown: alle aktiven aus dem ERSTE-Mapping (INCLUDE=1).
  ipcMain.handle('curve-spreads:currencies', async () => {
    try {
      const rows = await dbApi.selectAll(
        'SELECT DISTINCT ccy FROM erste WHERE INCLUDE = 1 AND ccy IS NOT NULL ORDER BY ccy'
      );
      const ccys = (rows || []).map(r => r.ccy).filter(Boolean);
      return ccys.length ? ccys : ['EUR'];
    } catch (e) {
      return ['EUR'];
    }
  });

  // Gespeicherte Spreads + Basis-Konvention einer Währung lesen.
  // base_options = eindeutige Konventionen (market_data_type) mit Label + index_tenor.
  ipcMain.handle('curve-spreads:get', async (_evt, args = {}) => {
    const ccy = String(args.ccy || '').trim();
    if (!ccy) return { spreads: [], base_mdt: '', base_options: [], tenors: [], base_points: [] };

    const spreads = await dbApi.selectAll(
      'SELECT ccy, index_tenor, spread_bp FROM curve_spreads WHERE ccy = ? ORDER BY index_tenor',
      [ccy]
    );

    // Wählbare Basis-Konventionen: gemappte Roh-Konventionen der ccy.
    // Label z.B. "Ann/3M", "Semi/3M", "Ann/6M"; value = market_data_type (eindeutig).
    let base_options = [];
    try {
      const rows = await dbApi.selectAll(
        'SELECT DISTINCT market_data_type, index_tenor, fixed_freq FROM erste ' +
        'WHERE ccy = ? AND INCLUDE = 1 AND market_data_type IS NOT NULL ' +
        'ORDER BY index_tenor, fixed_freq',
        [ccy]
      );
      base_options = (rows || [])
        .filter(r => r.market_data_type)
        .map(r => {
          const it = String(r.index_tenor || '').toUpperCase();
          const ff = String(r.fixed_freq || '').trim();
          return {
            value: String(r.market_data_type),
            index_tenor: it,
            label: (ff ? `${ff}/` : '') + it,
          };
        });
    } catch (_) { base_options = []; }

    // Gespeicherte Basis-Konvention (Fallback: Ann/6M falls vorhanden, sonst erste Option).
    let base_mdt = '';
    try {
      const rows = await dbApi.selectAll(
        'SELECT base_mdt FROM curve_base WHERE ccy = ? LIMIT 1', [ccy]
      );
      base_mdt = rows && rows[0] ? String(rows[0].base_mdt) : '';
    } catch (_) { base_mdt = ''; }
    if (!base_mdt || !base_options.some(o => o.value === base_mdt)) {
      const ann6m = base_options.find(o => o.index_tenor === '6M' && /ann/i.test(o.label));
      base_mdt = (ann6m && ann6m.value) || (base_options[0] && base_options[0].value) || '';
    }

    // Verfuegbare Tenoren (aus den konstruierten SWAP-Kurven) fuer das per-Tenor-Raster.
    let tenors = [];
    try {
      const rows = await dbApi.selectAll(
        "SELECT DISTINCT tenor FROM RATES_BASE WHERE ccy = ? AND curve_id LIKE '%:SWAP:%' " +
        "ORDER BY CASE WHEN tenor LIKE '%Y' THEN CAST(REPLACE(tenor,'Y','') AS INTEGER)*12 " +
        "WHEN tenor LIKE '%M' THEN CAST(REPLACE(tenor,'M','') AS INTEGER) ELSE 0 END",
        [ccy]
      );
      tenors = (rows || []).map(r => String(r.tenor).toUpperCase()).filter(Boolean);
    } catch (_) { tenors = []; }

    // Gespeicherte per-Tenor-Basis-Auswahl (leer -> Fallback auf Default-Basis).
    let base_points = [];
    try {
      const rows = await dbApi.selectAll(
        'SELECT tenor, market_data_type FROM RATES_CURVE_BASE_POINT WHERE ccy = ? AND enabled = 1',
        [ccy]
      );
      base_points = (rows || []).map(r => ({
        tenor: String(r.tenor).toUpperCase(),
        market_data_type: String(r.market_data_type),
      }));
    } catch (_) { base_points = []; }

    return { spreads, base_mdt, base_options, tenors, base_points };
  });

  // Spreads + Basis einer Währung speichern (DELETE + INSERT, da keine PKs).
  ipcMain.handle('curve-spreads:save', async (_evt, args = {}) => {
    const ccy = String(args.ccy || '').trim();
    const spreads = Array.isArray(args.spreads) ? args.spreads : [];
    const baseMdt = String(args.base_mdt || '').trim();
    if (!ccy) return { success: false, message: 'Currency missing.' };
    try {
      await dbApi.runSQL('DELETE FROM curve_spreads WHERE ccy = ?', [ccy]);
      for (const s of spreads) {
        const tenor = String(s.index_tenor || '').trim().toUpperCase();
        const bp = Number(s.spread_bp);
        if (!tenor || !Number.isFinite(bp)) continue;
        await dbApi.runSQL(
          'INSERT INTO curve_spreads (ccy, index_tenor, spread_bp) VALUES (?, ?, ?)',
          [ccy, tenor, bp]
        );
      }

      // Basis-Konvention je ccy (curve_base) upserten.
      if (baseMdt) {
        try {
          await dbApi.runSQL('CREATE TABLE IF NOT EXISTS curve_base (ccy TEXT, base_mdt TEXT)');
          await dbApi.runSQL('DELETE FROM curve_base WHERE ccy = ?', [ccy]);
          await dbApi.runSQL('INSERT INTO curve_base (ccy, base_mdt) VALUES (?, ?)', [ccy, baseMdt]);
        } catch (_) { /* Basis nicht fatal */ }
      }

      // Per-Tenor-Basis-Auswahl (RATES_CURVE_BASE_POINT) upserten (vollstaendiges Set je ccy).
      if (Array.isArray(args.base_points)) {
        try {
          await dbApi.runSQL(
            'CREATE TABLE IF NOT EXISTS RATES_CURVE_BASE_POINT (' +
            'ccy TEXT NOT NULL, tenor TEXT NOT NULL, market_data_type TEXT NOT NULL, ' +
            'enabled INTEGER NOT NULL DEFAULT 1, PRIMARY KEY (ccy, tenor))'
          );
          await dbApi.runSQL('DELETE FROM RATES_CURVE_BASE_POINT WHERE ccy = ?', [ccy]);
          for (const p of args.base_points) {
            const tenor = String(p.tenor || '').trim().toUpperCase();
            const mdt = String(p.market_data_type || '').trim();
            if (!tenor || !mdt) continue;
            await dbApi.runSQL(
              'INSERT INTO RATES_CURVE_BASE_POINT (ccy, tenor, market_data_type, enabled) VALUES (?, ?, ?, 1)',
              [ccy, tenor, mdt]
            );
          }
        } catch (_) { /* per-Tenor nicht fatal */ }
      }

      return { success: true, count: spreads.length };
    } catch (e) {
      return { success: false, message: e.message };
    }
  });

  // ===================== REBUILD CURVES (kein Scrape) =====================
  // Baut OIS/3M/6M/12M aus dem letzten ERSTE-Snapshot neu (erste_to_excel.py
  // --rebuild). Kein Netzwerk. Danach RATES_BASE refreshen.
  ipcMain.on('start-py-erste-rebuild', (event) => {
    const cp = require('child_process');
    const envName = (process.env.NODE_ENV || '').trim().toLowerCase();

    const finish = (success, message) => {
      event.reply('py-erste-rebuild-complete', { success, projectName: 'py-erste-rebuild', message });
      event.reply('project-finished', { success, projectName: 'py-erste-rebuild' });
    };

    // Rebuild über den Worker-Dispatch (main.py 'erste-rebuild') als Einmal-Prozess.
    // Zielmappe = dieselbe wie "Get Market Data" (readErsteTarget). Kein Dev-Gate.
    let exe, spawnArgs, cwd;
    try {
      ({ exe, args: spawnArgs, cwd } = resolveOneShotCommand('erste-rebuild', ['--target', readErsteTarget()]));
    } catch (e) {
      finish(false, `Start failed: ${e.message}`);
      return;
    }

    let stdout = '';
    let stderrErr = '';
    let stderrBuf = '';
    let child;
    try {
      child = cp.spawn(exe, spawnArgs, { windowsHide: true, cwd, env: { ...process.env, UNI_DB_PATH: getDatabasePath(), ...getExcelEnvOverrides() } });
    } catch (e) {
      finish(false, `Start failed: ${e.message}`);
      return;
    }

    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => {
      stderrBuf += d.toString();
      const lines = stderrBuf.split(/\r?\n/);
      stderrBuf = lines.pop();
      for (const line of lines) {
        const t = line.trim();
        if (!t) continue;
        try {
          const parsed = JSON.parse(t);
          if (parsed && typeof parsed.progress !== 'undefined') {
            event.reply('py-erste-rebuild-progress', parsed);
            continue;
          }
        } catch (_) { /* kein JSON -> Fehlertext */ }
        stderrErr += t + '\n';
      }
    });

    child.on('error', (err) => finish(false, `Error: ${err.message}`));
    child.on('close', (code) => {
      const res = _parseWorkerResult(stdout);
      const ok = res ? res.status === 'ok' : code === 0;
      if (ok) {
        try { refreshTable('RATES_BASE'); } catch (_) {}
      }
      const msg = res
        ? (res.message || res.error || (ok ? 'Curves rebuilt.' : `Error (exit code ${code}).`))
        : (ok ? (stdout.trim() || 'Curves rebuilt.') : (stderrErr.trim() || `Error (exit code ${code}).`));
      finish(ok, msg);
    });
  });

  // ===================== FAIR VALUE =====================
  ipcMain.on('start-py-fairValue', async (event, args) => {
    const {
      tableName,
      selectedCurve,
      calibrate = false,
      cal_iters = 2,
    } = args || {};

    if (!tableName || !selectedCurve) {
      event.reply('py-fairValue-complete', {
        success: false,
        projectName: 'py-fairValue',
        message: 'Arguments "tableName" and "selectedCurve" are required.'
      });
      event.reply('project-finished', { success: false, projectName: 'py-fairValue' });
      return;
    }

    try {
      const pythonArgs = ['--table', tableName, '--selectedCurve', selectedCurve];
      if (calibrate) pythonArgs.push('--calibrate');
      if (Number.isFinite(cal_iters)) pythonArgs.push('--cal-iters', String(cal_iters));

      const result = await startPythonScriptWithEvent(event, 'fvo', 'py-fairValue', pythonArgs);

      // Tabelle nach Abschluss aktualisieren
      try { refreshTable('Portfolios'); } catch {}

      event.reply('py-fairValue-complete', {
        success: true,
        projectName: 'py-fairValue',
        tableName,
        result
      });

      event.reply('project-finished', { success: true, projectName: 'py-fairValue' });

    } catch (error) {
      event.reply('py-fairValue-complete', {
        success: false,
        projectName: 'py-fairValue',
        error: error?.message || String(error),
        tableName
      });

      event.reply('project-finished', { success: false, projectName: 'py-fairValue' });
    }
  });

  // ===================== PRODUCT VALUATION =====================
  ipcMain.on('price-product', async (event, args = {}) => {
    const {
      prodId,
      notional = 100,
      asofDate = null,
      selectedCurve = 'EUSWAP',
      discount_curve_id = null,
      discountCurveId = null,
      // product-specific credit spread scenario override
      cs_spread_override_bp = null,
      csSpreadOverrideBp = null,
      CS_SPREAD_OVERRIDE_BP = null,
    } = args || {};

    if (!prodId) {
      event.reply('price-product-error', {
        success: false,
        message: 'Argument "prodId" is required.',
      });
      return;
    }

    try {
      const pythonArgs = [
        '--prod-id', String(prodId),
        '--notional', String(notional),
        '--selectedCurve', String(selectedCurve),
      ];

      if (asofDate) {
        pythonArgs.push('--asof-date', String(asofDate));
      }

      const resolvedDiscountCurveId =
        discount_curve_id ||
        discountCurveId ||
        null;

      if (resolvedDiscountCurveId) {
        pythonArgs.push('--discount_curve_id', String(resolvedDiscountCurveId));
      }

      const resolvedCsSpreadOverrideBp =
        cs_spread_override_bp ||
        csSpreadOverrideBp ||
        CS_SPREAD_OVERRIDE_BP ||
        null;

      if (resolvedCsSpreadOverrideBp) {
        pythonArgs.push(
          '--cs_spread_override_bp',
          String(resolvedCsSpreadOverrideBp)
        );
      }

      console.log('[PRODUCT VALUATION IPC]', {
        prodId,
        notional,
        asofDate,
        selectedCurve,
        discount_curve_id: resolvedDiscountCurveId,
        cs_spread_override_bp: resolvedCsSpreadOverrideBp,
        pythonArgs,
      });

      const result = await startPythonScriptWithEvent(
        event,
        'product_valuation',
        'py-product-valuation',
        pythonArgs
      );

      console.log('[PRODUCT VALUATION PYTHON RESULT]', {
        prodId,
        result,
        resultKeys: result && typeof result === 'object' ? Object.keys(result) : null,
        nestedResultKeys:
          result?.result && typeof result.result === 'object'
            ? Object.keys(result.result)
            : null,
      });

      event.reply('price-product-success', {
        success: true,
        prodId,
        result,
      });

    } catch (error) {
      console.error('[PRODUCT VALUATION IPC ERROR]', error);

      event.reply('price-product-error', {
        success: false,
        prodId,
        error: error?.message || String(error),
      });
    }
  });

  // ===================== MVaR =====================
  ipcMain.on('start-py-MVaR', async (event, args) => {
    const { tableName, selectedInterval, var_days, confidence } = args || {};

    const tablesToRefresh = [
      'MarketVaR',
      'MarketVaR_Dist',
      'MarketVaR_Product',
      'MarketVaR_FactorReturns',
      'MarketVaR_FactorPL',
    ];

    if (!tableName) {
      event.reply('py-mvar-complete', {
        success: false,
        projectName: 'py-MVaR',
        message: '"tableName" is required.',
      });
      return;
    }

    if (!selectedInterval) {
      event.reply('py-mvar-complete', {
        success: false,
        projectName: 'py-MVaR',
        message: '"selectedInterval" is required.',
      });
      return;
    }

    const pythonArgs = ['--table', tableName, '--intervalName', selectedInterval];

    // Customer risk-calc settings (VaR horizon days + confidence). Forwarded so the
    // MVaR run uses them as horizon/alpha instead of MVaRInput legacy values.
    if (var_days !== undefined && var_days !== null && var_days !== '') {
      pythonArgs.push('--varDays', String(var_days));
    }
    if (confidence !== undefined && confidence !== null && confidence !== '') {
      pythonArgs.push('--confidence', String(confidence));
    }

    try {
      await startPythonScriptWithEvent(event, 'mvar', 'py-MVaR', pythonArgs);

      // Nur EIN asof-Stichtag pro (port, scenario): aeltere, nicht bewusst gespeicherte
      // Laeufe werden ersetzt/geloescht. Bewusste Historie liegt separat in
      // PortfolioHistoryMetrics ("Save to Historic Metrics") und bleibt unberuehrt.
      // (Der fruehere automatische ROLLING_1-Nachlauf entfaellt — die Berechnungs-Schleife
      // im Renderer rechnet ROLLING ohnehin explizit als Baseline mit.)
      try { await pruneMvarToLatestAsof(dbApi); } catch (e) { console.warn('[MVaR] prune failed', e?.message || e); }

      tablesToRefresh.forEach(t => { try { refreshTable(t); } catch {} });

      event.reply('py-mvar-complete', { success: true, projectName: 'py-MVaR' });
      event.reply('project-finished', { success: true, projectName: 'py-MVaR' });
    } catch (error) {
      event.reply('py-mvar-complete', { success: false, projectName: 'py-MVaR', error: error?.message || String(error) });
      event.reply('project-finished', { success: false, projectName: 'py-MVaR' });
    }
  });

  // ===================== CVaR =====================
  ipcMain.on('start-py-CVaR', async (event, args) => {
    const { tableName, CSSzenario, cvarName } = args || {};

    const tablesToRefresh = [
      'EAD',
      'CreditVaR',
      'sortedLossesMain',
      'sortedLossesIssuerMain',
      'sortedLossesIndicesMain',
      'lossHistogramMain'
    ];

    if (!tableName || !CSSzenario || !cvarName) {
      event.reply('py-CVaR-complete', {
        success: false,
        projectName: 'py-CVaR',
        message: 'Arguments "tableName", "CSSzenario" and "cvarName" are required.',
      });
      return;
    }

    const pythonArgs = ['--table', tableName, '--CSSzenario', CSSzenario, '--cvarName', cvarName];

    try {
      await startPythonScriptWithEvent(event, 'cvar', 'py-CVaR', pythonArgs);
      tablesToRefresh.forEach(t => { try { refreshTable(t); } catch {} });

      event.reply('py-cvar-complete', { success: true, projectName: 'py-CVaR' });
      event.reply('project-finished', { success: true, projectName: 'py-CVaR' });
    } catch (error) {
      event.reply('py-cvar-complete', { success: false, projectName: 'py-CVaR', error: error?.message || String(error) });
      event.reply('project-finished', { success: false, projectName: 'py-CVaR' });
    }
  });

  // ===================== EXCEL (py-excel) =====================
  ipcMain.on('start-py-excel', async (event, args = {}) => {
    const mode = String(args.tableName || 'ALL').toUpperCase();

    const scriptArgs = [];
    if (mode) scriptArgs.push('--table', mode);

  let tablesToRefresh = [];

  switch (mode) {
    case 'ISSUER':
      tablesToRefresh = ['Issuer', 'Rank'];
      break;

    case 'PRODUCTS':
      tablesToRefresh = ['v_PRODUCTS_CANONICAL'];
      break;

    case 'DEALS':
      tablesToRefresh = ['DealsMain', 'Portfolios'];
      break;

    case 'RANK':
      tablesToRefresh = ['Rank'];
      break;

    case 'MARKET':
      tablesToRefresh = ['RATES_BASE', 'SWAPTION_ATM_BASE', 'SWAPTION_SMILE_BASE'];
      break;

    case 'ALL':
    default:
      tablesToRefresh = [
        'Portfolios',
        'DealsMain',
        'v_PRODUCTS_CANONICAL',
        'Issuer',
        'Rank',
        'RATES_BASE',
        'SWAPTION_ATM_BASE',
        'SWAPTION_SMILE_BASE',
      ];
      break;
  }

    try {
      event.sender.send('py-excel-progress', { provider: mode, progress: 5, message: `Starting Excel import (${mode}) ...` });

      const result = await startPythonScriptWithEvent(event, 'excel', 'py-excel', scriptArgs);

      event.sender.send('py-excel-progress', { provider: mode, progress: 70, message: `Updating UI tables (${mode}) ...` });
      tablesToRefresh.forEach(t => { try { refreshTable(t); } catch {} });

      event.sender.send('py-excel-progress', { provider: mode, progress: 100, message: `Excel import completed (${mode}).` });

      event.reply('py-excel-complete', { success: true, projectName: 'py-excel', mode, result });
      event.reply('project-finished', { success: true, projectName: 'py-excel', mode });
    } catch (error) {
      event.sender.send('py-excel-progress', {
        provider: mode, progress: 100,
        message: `Excel import failed (${mode}): ${error?.message || String(error)}`
      });

      event.reply('py-excel-complete', { success: false, projectName: 'py-excel', mode, error: error?.message || String(error) });
      event.reply('project-finished', { success: false, projectName: 'py-excel', mode, error: error?.message || String(error) });
    }
  });

  // Benchmark-Kurven (RATES_BASE) aus dem frischen tblTS neu bauen — als leiser
  // Hintergrund-Schritt nach dem Historic-Update. Über den Worker-Dispatch
  // (main.py 'erste-benchmark'), systemkonform in jedem Modus.
  function rebuildBenchmarkCurves() {
    const cp = require('child_process');
    let exe, spawnArgs, cwd;
    try {
      ({ exe, args: spawnArgs, cwd } = resolveOneShotCommand('erste-benchmark', []));
    } catch (_) { return; }

    let child;
    try {
      child = cp.spawn(exe, spawnArgs, { windowsHide: true, cwd, env: { ...process.env, UNI_DB_PATH: getDatabasePath(), ...getExcelEnvOverrides() } });
    } catch (_) { return; }

    child.on('error', () => {});
    child.on('close', (code) => {
      if (code === 0) { try { refreshTable('RATES_BASE'); } catch (_) {} }
    });
  }

  // ===================== HISTORIC =====================
  ipcMain.on('start-py-historicData', async (event, args = {}) => {
    const api = args.api || '';
    const scriptArgs = [];
    if (api) scriptArgs.push('--api', api);

    try {
      const result = await startPythonScriptWithEvent(event, 'hist', 'py-historicData', scriptArgs);

      try { refreshTable('tblTS'); } catch {}

      // tblTS ist frisch -> Benchmark-Renditekurven in RATES_BASE nachziehen.
      try { rebuildBenchmarkCurves(); } catch {}

      event.reply('py-historicData-complete', { success: true, projectName: 'py-historicData', api, result });
      event.reply('project-finished', { success: true, projectName: 'py-hist', buttonId: args.buttonId || 'histButton' });
    } catch (error) {
      event.reply('py-historicData-complete', { success: false, projectName: 'py-historicData', api, error: error?.message || String(error) });
      event.reply('project-finished', { success: false, projectName: 'py-historicData' });
    }
  });

  // ===================== CSPAR =====================
  ipcMain.on('start-py-cspar', async (event, args = {}) => {
    try {
      // CSPAR is BASE-only.
      // It rebuilds CS_BASE from CSParameter and must not depend on UI scenario state.
      const CSSzenario = 'BASE';

      const pythonArgs = ['--CSSzenario', CSSzenario];

      console.log('[py-cspar] BASE-only run. args from renderer =', args);
      console.log('[py-cspar] pythonArgs =', pythonArgs);

      const result = await startPythonScriptWithEvent(
        event,
        'cspar',
        'py-csparData',
        pythonArgs
      );

      try { refreshTable('CS_BASE'); } catch (err) {
        console.warn('[py-cspar] refreshTable CS_BASE failed:', err?.message || err);
      }

      try { refreshTable('CSParameter'); } catch (err) {
        console.warn('[py-cspar] refreshTable CSParameter failed:', err?.message || err);
      }

      event.reply('project-finished', {
        success: true,
        projectName: 'py-cspar',
        data: result,
      });
    } catch (error) {
      event.reply('project-finished', {
        success: false,
        projectName: 'py-cspar',
        message: 'Python script execution failed.',
        error: error?.message || String(error),
      });
    }
  });

  // ===================== MATCH COLUMNS =====================
  ipcMain.on('start-py-matchColumns', async (event, args) => {
    const { inputColumns, productTargetColumns, offerTargetColumns } = args || {};

    if (!Array.isArray(inputColumns) || !Array.isArray(productTargetColumns) || !Array.isArray(offerTargetColumns)) {
      event.reply('py-matchColumns-complete', {
        success: false,
        projectName: 'py-matchColumns',
        message: 'Arguments "inputColumns", "productTargetColumns", and "offerTargetColumns" must be arrays.'
      });
      event.reply('project-finished', { success: false, projectName: 'py-matchColumns' });
      return;
    }

    try {
      const pythonArgs = [
        '--aicolumn_input', JSON.stringify(inputColumns),
        '--product_targets', JSON.stringify(productTargetColumns),
        '--offer_targets', JSON.stringify(offerTargetColumns)
      ];

      const result = await startPythonScriptWithEvent(event, 'aicolumn', 'py-matchColumns', pythonArgs);

      event.reply('py-matchColumns-complete', {
        success: true,
        projectName: 'py-matchColumns',
        product_matches: result.product_matches,
        offer_matches: result.offer_matches
      });

      event.reply('project-finished', { success: true, projectName: 'py-matchColumns' });
    } catch (error) {
      event.reply('py-matchColumns-complete', { success: false, projectName: 'py-matchColumns', error: error?.message || String(error) });
      event.reply('project-finished', { success: false, projectName: 'py-matchColumns' });
    }
  });

  // ===================== SWAPTION =====================
  ipcMain.on('start-py-swaption', async (event, args) => {
    const { selectedCurve = 'EUSWAP' } = args || {};

    try {
      const pythonArgs = [];
      if (selectedCurve) pythonArgs.push('--selectedCurve', selectedCurve);

      const result = await startPythonScriptWithEvent(event, 'swaption', 'py-swaption', pythonArgs);

      event.reply('py-swaption-complete', { success: true, projectName: 'py-swaption', result });
      event.reply('project-finished', { success: true, projectName: 'py-swaption' });
    } catch (error) {
      event.reply('py-swaption-complete', { success: false, projectName: 'py-swaption', error: error?.message || String(error) });
      event.reply('project-finished', { success: false, projectName: 'py-swaption' });
    }
  });

  // ===================== VOL CUBE =====================
  ipcMain.on('start-py-volcube', async (event, args) => {
    const { selectedCurve = 'EUSWAP' } = args || {};

    try {
      const pythonArgs = [];
      if (selectedCurve) pythonArgs.push('--selectedCurve', selectedCurve);

      const result = await startPythonScriptWithEvent(
        event,
        'volcube',
        'py-volcube',
        pythonArgs
      );

      try { refreshTable('SWAPTION_CUBE'); } catch {}

      event.reply('py-volcube-complete', {
        success: true,
        projectName: 'py-volcube',
        result
      });

      event.reply('py-volcube-complete', {
        success: true,
        projectName: 'py-volcube',
        result
      });

      event.reply('project-finished', {
        success: true,
        projectName: 'py-volcube'
      });

    } catch (error) {
      event.reply('py-volcube-complete', {
        success: false,
        projectName: 'py-volcube',
        error: error?.message || String(error)
      });

      event.reply('project-finished', {
        success: false,
        projectName: 'py-volcube'
      });
    }
  });


};
