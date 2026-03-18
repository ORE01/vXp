'use strict';

const { dialog } = require('electron');
const XLSX = require('xlsx');

module.exports = function registerExcelHandlers({ ipcMain, services }) {

  console.log("EXCEL HANDLERS REGISTERED");

  const dbApi = services?.dbApi || {};

  if (!dbApi.runSQL || !dbApi.insertRowInTable) {
    throw new Error("[excel.handlers] dbApi.runSQL or insertRowInTable missing");
  }

  // =========================================================
  // Select Excel File
  // =========================================================
  ipcMain.handle('select-excel-file', async () => {

    try {

      const result = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [
          { name: 'Excel Files', extensions: ['xlsx', 'xls'] }
        ]
      });

      if (result.canceled) {
        return { success: false };
      }

      const filePath = result.filePaths[0];

      const workbook = XLSX.readFile(filePath);

      return {
        success: true,
        filePath,
        sheetNames: workbook.SheetNames
      };

    } catch (err) {

      return {
        success: false,
        error: err.message
      };

    }

  });

  // =========================================================
  // Helper: Create Temp Table
  // =========================================================
  async function createTempTable(tableName, columns) {

    const safeColumns = columns.map(col =>
      `"${String(col).replace(/"/g, '')}" TEXT`
    ).join(", ");

    const sql = `
      CREATE TABLE "${tableName}" (
        ${safeColumns}
      )
    `;

    await dbApi.runSQL(sql);
  }

  // =========================================================
  // Import Excel Sheet
  // =========================================================
  ipcMain.handle('import-excel-offer-sheet', async (event, args) => {

    try {

      const { filePath, sheetName } = args;

      const workbook = XLSX.readFile(filePath);
      const sheet = workbook.Sheets[sheetName];

      const data = XLSX.utils.sheet_to_json(sheet);

      if (!data.length) {
        return { success: false, error: "Excel sheet empty" };
      }

      const tempTableName = "TMP_" + Date.now();

      const columns = Object.keys(data[0]);

      await createTempTable(tempTableName, columns);

      for (const row of data) {
        await dbApi.insertRowInTable(row, tempTableName);
      }

      return {
        success: true,
        tempTableName,
        PortfoliosColumns: columns,
        tempTableColumns: columns
      };

    } catch (err) {

      console.error("[Excel Import Error]", err);

      return {
        success: false,
        error: err.message
      };

    }

  });

  // =========================================================
  // Quick Import
  // =========================================================
  ipcMain.handle('import-excel-offer-sheet-quick', async (event, args) => {

    try {

      const { filePath, sheetName } = args;

      const workbook = XLSX.readFile(filePath);
      const sheet = workbook.Sheets[sheetName];

      const data = XLSX.utils.sheet_to_json(sheet);

      if (!data.length) {
        return { success: false, error: "Excel sheet empty" };
      }

      const tempTableName = "TMP_" + Date.now();

      const columns = Object.keys(data[0]);

      await createTempTable(tempTableName, columns);

      for (const row of data) {
        await dbApi.insertRowInTable(row, tempTableName);
      }

      return {
        success: true,
        tempTableName
      };

    } catch (err) {

      console.error("[Excel Quick Import Error]", err);

      return {
        success: false,
        error: err.message
      };

    }

  });

};