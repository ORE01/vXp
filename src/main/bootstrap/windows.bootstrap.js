'use strict';

function createAppWindows({
  app,
  BrowserWindow,
  ROOT,
  preloadPath,
  createMainWindowController,
  createCouponWindowController,
  registerCouponWindowHandlers,
  ipcMain,
  pump,
  getMainWindow,
  setMainWindow,
}) {
  function createMainWindow() {
    const mainWindow = createMainWindowController({
      ROOT,
      preloadPath,
      devTools: true,
    });

    mainWindow.on('closed', () => {
      setMainWindow(null);
    });

    setMainWindow(mainWindow);
    return mainWindow;
  }

  function initCouponWindow() {
    const couponWindow = createCouponWindowController({
      ROOT,
      preloadPath,
      devTools: true,
    });

    registerCouponWindowHandlers({
      ipcMain,
      couponWindow,
    });
  }

  function installActivateHandler() {
    app.on('activate', () => {
      const mainWindow = getMainWindow();

      if (mainWindow && !mainWindow.isDestroyed()) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.show();
        mainWindow.focus();
        return;
      }

      if (BrowserWindow.getAllWindows().length === 0) {
        const newWindow = createMainWindow();

        newWindow.webContents.on('did-finish-load', () => {
          pump.initTableNamesAndFirstSend();
        });
      }
    });
  }

  return {
    createMainWindow,
    initCouponWindow,
    installActivateHandler,
  };
}

module.exports = { createAppWindows };