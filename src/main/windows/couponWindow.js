'use strict';

const { BrowserWindow } = require('electron');
const path = require('path');

module.exports = function createCouponWindowController({
  ROOT,
  preloadPath,
  devTools = true,
}) {
  if (!ROOT) throw new Error('[couponWindow] ROOT missing');
  if (!preloadPath) throw new Error('[couponWindow] preloadPath missing');

  let couponWindow = null;

  function open(prodId) {
    if (!prodId) throw new Error('[couponWindow] prodId missing');

    // Wenn Fenster schon existiert: fokussieren + prod setzen
    if (couponWindow && !couponWindow.isDestroyed()) {
      couponWindow.focus();
      couponWindow.webContents.send('coupon:set-prod', prodId);
      return couponWindow;
    }

    couponWindow = new BrowserWindow({
      width: 900,
      height: 700,
      title: `Coupon Schedule – ${prodId}`,
      webPreferences: {
        preload: preloadPath,
        devTools,
      },
    });

    couponWindow.loadFile(path.join(ROOT, 'coupon.html'));

    couponWindow.on('closed', () => {
      couponWindow = null;
    });

    couponWindow.webContents.on('did-finish-load', () => {
      couponWindow?.webContents?.send('coupon:set-prod', prodId);
      if (devTools) couponWindow.webContents.openDevTools();
    });

    return couponWindow;
  }

  function isOpen() {
    return !!(couponWindow && !couponWindow.isDestroyed());
  }

  function close() {
    try {
      if (couponWindow && !couponWindow.isDestroyed()) couponWindow.close();
    } catch {}
  }

  return {
    open,
    close,
    isOpen,
  };
};
