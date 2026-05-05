'use strict';

module.exports = function registerBondFetchHandlers({ ipcMain, dc }) {
  ipcMain.handle('bonds:fetch', async (_evt, isins) => {
    try {
      if (!Array.isArray(isins) || isins.length === 0) return [];

      const res = await dc.fetchTermsAndSchedule(isins);

      return res.map(r => ({
        isin: r.isin,
        terms: r.terms || {},
        rows: Array.isArray(r.rows) ? r.rows : [],
        error: r.error,
      }));
    } catch (err) {
      console.error('bonds:fetch error', err);
      return [{
        isin: null,
        terms: {},
        rows: [],
        error: err?.message || String(err),
      }];
    }
  });

  ipcMain.handle('bonds:fetchTermsOnly', async (_evt, isins) => {
    try {
      if (!Array.isArray(isins) || isins.length === 0) return [];

      const res = await dc.fetchTermsOnly(isins);

      return res.map(r => ({
        isin: r.isin,
        terms: r.terms || {},
        error: r.error,
      }));
    } catch (err) {
      console.error('bonds:fetchTermsOnly error', err);
      return [{
        isin: null,
        terms: {},
        error: err?.message || String(err),
      }];
    }
  });

  ipcMain.handle('bonds:parsePdfUrl', async (_evt, { url, isin }) => {
    try {
      if (!url) return { ok: false, error: 'pdf url required' };

      const r = await dc.parseSinglePdf(url, isin || null);

      return { ok: true, ...r };
    } catch (err) {
      return {
        ok: false,
        error: err?.message || String(err),
      };
    }
  });

  console.log('[IPC] bondFetch.handlers registered');
};