'use strict';

module.exports = function registerCouponWindowHandlers({ ipcMain, couponWindow }) {
  if (!ipcMain) throw new Error('[couponWindow.handlers] ipcMain missing');
  if (!couponWindow?.open) throw new Error('[couponWindow.handlers] couponWindow.open missing');

  ipcMain.on('open-coupon-window', (_event, { prodId }) => {
    try {
      couponWindow.open(prodId);
    } catch (e) {
      console.error('[couponWindow.handlers] open failed:', e?.message || e);
    }
  });
};
