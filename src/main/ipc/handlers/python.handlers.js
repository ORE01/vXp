// src/main/ipc/handlers/python.handlers.js
'use strict';

module.exports = function registerPythonHandlers({
  ipcMain,
  startPythonScriptWithEvent,
  refreshTable,
  dbApi,
}) {
if (!ipcMain) throw new Error('[python.handlers] ipcMain missing');
  if (typeof startPythonScriptWithEvent !== 'function') throw new Error('[python.handlers] startPythonScriptWithEvent missing');
  if (typeof refreshTable !== 'function') throw new Error('[python.handlers] refreshTable missing');



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
      'sortedLossesIndicesMain'
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

  // ===================== HISTORIC =====================
  ipcMain.on('start-py-historicData', async (event, args = {}) => {
    const api = args.api || '';
    const scriptArgs = [];
    if (api) scriptArgs.push('--api', api);

    try {
      const result = await startPythonScriptWithEvent(event, 'hist', 'py-historicData', scriptArgs);

      try { refreshTable('tblTS'); } catch {}

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

  // ===================== ML (optional) =====================
  ipcMain.on('start-py-ml', async (event, args = {}) => {
    // --------------------------------------------------
    // 1) SAFE DESTRUCTURING (FIRST – avoids TDZ errors)
    // --------------------------------------------------
    let {
      tableName,
      target,
      newModel = false,
      modelName = '',
      modelType = '',
      epochs = 1,
      batch_size = 32,
      optimizer,
      loss,
      metrics,
    } = args || {};

    console.log('[ML] start-py-ml args:', JSON.stringify(args));
    console.log('[ML] parsed:', {
      tableName, target, newModel, modelName, modelType, epochs, batch_size
    });

    // --------------------------------------------------
    // 2) BASIC VALIDATION
    // --------------------------------------------------
    if (!tableName) {
      event.reply('project-finished', {
        success: false,
        message: 'tableName is required'
      });
      return;
    }

    const resolvedTarget = target || 'NVDA';

    // --------------------------------------------------
    // 3) MODEL SELECTION LOGIC
    // --------------------------------------------------

    // a) If using existing model but modelName missing → auto-pick latest
  // If pre-trained requested (newModel=false) but modelName missing:
  // In your schema "modelName" == model_type
  if (!newModel && !modelName) {
    try {
      const rows = await dbApi.selectAll(
        `SELECT model_type
          FROM ML_Models
          ORDER BY id DESC
          LIMIT 1`
      );

      const picked = rows?.[0]?.model_type;
      if (picked) {
        modelName = String(picked);
        console.warn('[ML] modelName missing → using latest model_type:', modelName);
      } else {
        event.reply('project-finished', {
          success: false,
          message: 'No trained models found in ML_Models (table is empty).'
        });
        return;
      }
    } catch (e) {
      event.reply('project-finished', {
        success: false,
        message: e?.message || String(e)
      });
      return;
    }
  }



    // b) Final guard rails
    if (newModel) {
      if (!modelType) {
        event.reply('project-finished', {
          success: false,
          message: 'modelType is required for new models'
        });
        return;
      }
    } else {
      if (!modelName) {
        event.reply('project-finished', {
          success: false,
          message: 'modelName is required for pre-trained models'
        });
        return;
      }
    }

    // --------------------------------------------------
    // 4) BUILD PYTHON ARGS
    // --------------------------------------------------
    const pythonArgs = [
      '--table', tableName,
      '--target', resolvedTarget,
      '--epochs', String(epochs),
      '--batch_size', String(batch_size),
    ];

    if (newModel) {
      pythonArgs.push('--newModel');
      pythonArgs.push('--modelType', modelType);
    } else {
      pythonArgs.push('--modelName', modelName);
    }

    if (optimizer) {
      pythonArgs.push('--optimizer', JSON.stringify(optimizer));
    }
    if (loss) {
      pythonArgs.push('--loss', loss);
    }
    if (metrics && metrics.length > 0) {
      pythonArgs.push(
        '--metrics',
        Array.isArray(metrics) ? metrics.join(',') : metrics
      );
    }

    console.log('[ML] pythonArgs:', pythonArgs.join(' '));

    // --------------------------------------------------
    // 5) EXECUTE PYTHON
    // --------------------------------------------------
    const tablesToRefresh = [
      'ML_FuturePredictions',
      'ML_MergedData',
      'ML_TrainedModels'
    ];

    try {
      const result = await startPythonScriptWithEvent(
        event,
        'ml',
        'py-ml',
        pythonArgs
      );

      // Refresh ML tables
      for (const t of tablesToRefresh) {
        try {
          refreshTable(t);
        } catch (e) {
          console.error('[ML] refresh failed:', t, e);
        }
      }

      event.reply('project-finished', {
        success: true,
        projectName: 'py-ml',
        data: result
      });

    } catch (error) {
      console.error('[ML] Python execution failed:', error);
      event.reply('project-finished', {
        success: false,
        message: error?.message || 'Python script execution failed'
      });
    }
  });

};
