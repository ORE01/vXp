'use strict';

module.exports = [
  {
    name: 'python',
    register: require('./handlers/python.handlers'),
    getCtx: ({ ipcMain, services, refreshTable, dbApi }) => ({
      ipcMain,
      startPythonScriptWithEvent: services.startPythonScriptWithEvent,
      refreshTable,
      dbApi,
    }),
  },

  {
  name: 'db',
  register: require('./handlers/db.handlers'),
  getCtx: ({ ipcMain, refreshTable }) => ({
    ipcMain,
    refreshTable,
  }),
},

  {
    name: 'customerMarketRiskSetting',
    register: require('./handlers/customerMarketRiskSetting.handlers'),
    getCtx: ({ ipcMain, dbApi, refreshTable }) => ({
      ipcMain,
      dbApi,
      refreshTable,
    }),
  },

  {
    name: 'customerCreditRiskSetting',
    register: require('./handlers/customerCreditRiskSetting.handlers'),
    getCtx: ({ ipcMain, dbApi, refreshTable }) => ({
      ipcMain,
      dbApi,
      refreshTable,
    }),
  },

  {
    name: 'ratesActive',
    register: require('./handlers/ratesActive.handlers'),
    getCtx: ({ ipcMain, dbApi, refreshTable }) => ({
      ipcMain,
      dbApi,
      refreshTable,
    }),
  },

  {
    name: 'csActive',
    register: require('./handlers/csActive.handlers'),
    getCtx: ({ ipcMain, dbApi, refreshTable }) => ({
      ipcMain,
      dbApi,
      refreshTable,
    }),
  },

  {
    name: 'csScenario',
    register: require('./handlers/csScenario.handlers'),
    getCtx: ({ ipcMain, dbApi, refreshTable }) => ({
      ipcMain,
      dbApi,
      refreshTable,
    }),
  },

  {
    name: 'swaptionActive',
    register: require('./handlers/swaptionActive.handlers'),
    getCtx: ({ ipcMain, refreshTable }) => ({
      ipcMain,
      refreshTable,
    }),
  },

  {
    name: 'swaptionScenario',
    register: require('./handlers/swaptionScenario.handlers'),
    getCtx: ({ ipcMain, refreshTable }) => ({
      ipcMain,
      refreshTable,
    }),
  },

  {
    name: 'excel',
    register: require('./handlers/excel.handlers'),
    getCtx: ({ ipcMain, services, dbApi, refreshTable }) => ({
      ipcMain,
      services: {
        ...services,
        dbApi,
        refreshTable,
      },
    }),
  },

  {
    name: 'issuer',
    register: require('./handlers/issuer.handlers'),
    getCtx: ({ ipcMain, mainFct, sqliteDb, refreshTable }) => ({
      ipcMain,
      dbApi: { runSQL: mainFct.runSQL },
      sqliteDb,
      refreshTable,
    }),
  },

  {
    name: 'products',
    register: require('./handlers/products.handlers'),
    getCtx: ({ ipcMain, mainFct, sqliteDb, refreshTable }) => ({
      ipcMain,
      dbApi: { runSQL: mainFct.runSQL },
      sqliteDb,
      refreshTable,
    }),
  },

  {
    name: 'dealsImport',
    register: require('./handlers/dealsImport.handlers'),
    getCtx: ({ ipcMain, mainFct, sqliteDb, refreshTable }) => ({
      ipcMain,
      sqliteDb,
      dbApi: {
        getAllRowsFromTable: mainFct.getAllRowsFromTable,
        insertRowInTable: mainFct.insertRowInTable,
      },
      refreshTable,
    }),
  },

{
  name: 'crud',
  register: require('./handlers/crud.handlers'),
  getCtx: ({ ipcMain, mainFct, refreshTable }) => ({
    ipcMain,
    dbApi: {
      updateRecord: mainFct.updateRecord,
      insertRowInTable: mainFct.insertRowInTable,
      eraseRowFromDB: mainFct.eraseRowFromDB,
      runSQL: mainFct.runSQL,
      selectAll: mainFct.selectAll,

      syncProductScheduleToProductEvents:
        mainFct.syncProductScheduleToProductEvents,

      eraseCouponScheduleAndSync:
        mainFct.eraseCouponScheduleAndSync,
    },
    refreshTable,
  }),
},

  {
    name: 'dealsSelection',
    register: require('./handlers/dealsSelection.handlers'),
    getCtx: ({ ipcMain, mainFct, refreshTable }) => ({
      ipcMain,
      dbApi: {
        insertSelection: mainFct.insertSelection,
        deleteTable: mainFct.deleteTable,
      },
      refreshTable,
    }),
  },

  {
    name: 'portfolioDelete',
    register: require('./handlers/portfolioDelete.handlers'),
    getCtx: ({ ipcMain, mainFct, refreshTable }) => ({
      ipcMain,
      dbApi: {
        runSQL: mainFct.runSQL,
        selectAll: mainFct.selectAll,
      },
      refreshTable,
    }),
  },

  {
    name: 'portfolioProducts',
    register: require('./handlers/portfolioProducts.handlers'),
    getCtx: ({ ipcMain, mainFct, refreshTable }) => ({
      ipcMain,
      dbApi: {
        runSQL: mainFct.runSQL,
        selectAll: mainFct.selectAll,
      },
      refreshTable,
    }),
  },

  {
    name: 'dealsUpdate',
    register: require('./handlers/dealsUpdate.handlers'),
    getCtx: ({ ipcMain, mainFct, refreshTable }) => ({
      ipcMain,
      dbApi: {
        runSQL: mainFct.runSQL,
      },
      refreshTable,
    }),
  },

  {
    name: 'customer',
    register: require('./handlers/customer.handlers'),
    getCtx: ({ ipcMain, mainFct, sqliteDb, refreshTable, emitToRenderer }) => ({
      ipcMain,
      sqliteDb,
      dbApi: {
        runSQL: mainFct.runSQL,
        updateCustomerTexts: mainFct.updateCustomerTexts,
      },
      refreshTable,
      emitToRenderer,
    }),
  },

  {
    name: 'training',
    register: require('./handlers/training.handlers'),
    getCtx: ({ ipcMain }) => ({ ipcMain }),
  },

  {
    name: 'csParameter',
    register: require('./handlers/csParameter.handlers'),
    getCtx: ({ ipcMain, mainFct, refreshTable }) => ({
      ipcMain,
      dbApi: {
        insertCSParameter: mainFct.insertCSParameter,
      },
      refreshTable,
    }),
  },

  {
    name: 'columnImport',
    register: require('./handlers/columnImport.handlers'),
    getCtx: ({ ipcMain, mainFct, refreshTable }) => ({
      ipcMain,
      dbApi: {
        getAllRowsFromTable: mainFct.getAllRowsFromTable,
        insertRowInTable: mainFct.insertRowInTable,
      },
      refreshTable,
    }),
  },
];