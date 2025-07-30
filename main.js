const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { getAllTableNames, 
        queryDB, 
        updateRecord,  
        insertRowInTable, 
        eraseRowFromDB, 
        closeDatabase, 
        insertSelection, 
        deleteTable, 
        startPythonScriptWithEvent, 
        handlePythonProgress, 
        insertCSParameter, 
        importExcelToSQLite, 
        runSQL,
        updateCustomerTexts,
        db,
        getAllRowsFromTable} = require('./main_fct');

const { formatColumns, formatDate} = require('./utils/main_format');

const {getExcelPath} = require('./main_path');

require('dotenv').config();

const { spawn } = require('child_process');

const XLSX = require('xlsx');

const importColumnMappings = {};

const sqlite3 = require('sqlite3').verbose();

let mainWindow;
let tableNames;


// IMPORT
// ipcMain.handle('import-excel-dialog', async (event, options = {}) => {
//   try {
//     // const sheetFilter = options.sheetFilter || null;  // z. B. ['EUSW']
//         // ⚠️ geändert: sichere Prüfung, ob sheetFilter ein Array ist
//     const sheetFilter = Array.isArray(options.sheetFilter) ? options.sheetFilter : null;
//     const excelPath = getExcelPath();

//     // Mapping der Sheets → Tabellen
//     const mappings = [
//       { 
//         sheetName: 'INPUT_DEALS', 
//         tableName: 'DealsMain',
//         allowedColumns: [
//           'INCLUDE', 'TRADE_ID', 'PROD_ID', 'CATEGORY', 'NOTIONAL',
//           'PRICE_BUY', 'TRADE_DATE', 'Depotbank', 'port_name'
//         ],
//         deleteCondition: "port_name = 'UNI'" 
//       },
//       { 
//         sheetName: 'INPUT_BONDS', 
//         tableName: 'ProdAll', 
//         allowedColumns: [
//           'INCLUDE', 'PROD_ID', 'DESCRIPTION', 'START_DATE', 'MATURITY',
//           'COUPON', 'SCHEDULE', 'GEARING', 'SPREADS', 'CAP', 'FLOOR', 'TENOR',
//           'CouponType', 'ISSUER', 'TICKER', 'CS_Szenario', 'RATING_PROD', 'RANK'
//         ],
//         overwriteExisting: true
//       },
//       {
//         sheetName: 'INPUT_ISSUER',
//         tableName: 'Issuer',
//         allowedColumns: [
//           'INCLUDE', 'ISSUER', 'TICKER', 'RATING',
//           'senior_secured', 'senior_preferred', 'senior_unsecured',
//           'senior_subordinated', 'junior_subordinated'
//         ],
//         deleteCondition: "1 = 1"
//       },
//       { 
//         sheetName: 'INPUT_RANK', 
//         tableName: 'Rank', 
//         allowedColumns: [
//           'RANK', 'STEPS'
//         ],
//         deleteCondition: "1 = 1" 
//       },
//       { 
//         sheetName: 'EUSW', 
//         tableName: 'EUSW', 
//         allowedColumns: [
//           'instrument', 'YEAR', 'EUSWAP', 'EUSWAP_SZ1'
//         ],
//         deleteCondition: "1 = 1" 
//       },
//       {
//         sheetName: 'INPUT_LGT',
//         tableName: 'LGT',
//         deleteCondition: "1 = 1"
//       }
      
//     ];

//     for (const { sheetName, tableName, deleteCondition, allowedColumns, overwriteExisting } of mappings) {
//       // Falls sheetFilter gesetzt ist → nur gefilterte Sheets importieren
//       if (sheetFilter && !sheetFilter.includes(sheetName)) {
//         console.log(`⏭️ Sheet ${sheetName} wird übersprungen (nicht im Filter enthalten).`);
//         continue;
//       }

//       console.log(`🚀 Importiere ${sheetName} → ${tableName}`);
//       await importExcelToSQLite(excelPath, sheetName, tableName, deleteCondition, allowedColumns, overwriteExisting);
//     }

//     // Tabellen nach dem Import aktualisieren
//     const tablesToRefresh = ['DealsMain', 'ProdAll', 'EUSW', 'Issuer'];

//     tablesToRefresh.forEach(table => {
//       refreshTable(table, () => {
//         console.log('Refreshed table:', table);
//       });
//     });

//     return { success: true };

//   } catch (err) {
//     console.error('❌ Fehler beim Excel-Import:', err);
//     return { success: false, error: err.message };
//   }
// });

ipcMain.handle('import-excel-dialog', async (event, options = {}) => {
  try {
    const sheetFilter = Array.isArray(options.sheetFilter) ? options.sheetFilter : null;
    const excelPath = getExcelPath();

    const mappings = [
      { 
        sheetName: 'INPUT_DEALS', 
        tableName: 'DealsMain',
        allowedColumns: ['INCLUDE', 'TRADE_ID', 'PROD_ID', 'CATEGORY', 'NOTIONAL', 'PRICE_BUY', 'TRADE_DATE', 'Depotbank', 'port_name'],
        deleteCondition: "port_name = 'UNI'" 
      },
      { 
        sheetName: 'INPUT_BONDS', 
        tableName: 'ProdAll', 
        allowedColumns: ['INCLUDE', 'PROD_ID', 'DESCRIPTION', 'START_DATE', 'MATURITY', 'COUPON', 'SCHEDULE', 'GEARING', 'SPREADS', 'CAP', 'FLOOR', 'TENOR', 'CouponType', 'ISSUER', 'TICKER', 'CS_Szenario', 'RATING_PROD', 'RANK'],
        overwriteExisting: true
      },
      {
        sheetName: 'INPUT_ISSUER',
        tableName: 'Issuer',
        allowedColumns: ['INCLUDE', 'ISSUER', 'TICKER', 'RATING', 'senior_secured', 'senior_preferred', 'senior_unsecured', 'senior_subordinated', 'junior_subordinated']
        // ❌ Kein deleteCondition mehr
      },
      { 
        sheetName: 'INPUT_RANK', 
        tableName: 'Rank', 
        allowedColumns: ['RANK', 'STEPS'],
        deleteCondition: "1 = 1" 
      },
      { 
        sheetName: 'EUSW', 
        tableName: 'EUSW', 
        allowedColumns: ['instrument', 'YEAR', 'EUSWAP', 'EUSWAP_SZ1'],
        deleteCondition: "1 = 1" 
      },
      {
        sheetName: 'INPUT_LGT',
        tableName: 'LGT',
        deleteCondition: "1 = 1"
      }
    ];

    for (const { sheetName, tableName, deleteCondition, allowedColumns, overwriteExisting } of mappings) {
      if (sheetFilter && !sheetFilter.includes(sheetName)) {
        console.log(`⏭️ Sheet ${sheetName} wird übersprungen (nicht im Filter enthalten).`);
        continue;
      }

      console.log(`🚀 Importiere ${sheetName} → ${tableName}`);

      if (sheetName === 'INPUT_ISSUER') {
        const workbook = XLSX.readFile(excelPath);
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet);

        for (const row of rows) {
          const ticker = row.TICKER?.trim();
          if (!ticker) continue;

          const exists = await new Promise((resolve, reject) => {
            db.get(`SELECT 1 FROM Issuer WHERE TICKER = ?`, [ticker], (err, result) => {
              if (err) reject(err);
              else resolve(!!result);
            });
          });

          if (exists) {
            await runSQL(`DELETE FROM Issuer WHERE TICKER = ?`, [ticker]);
            console.log(`♻️ Vorhandener Issuer mit TICKER ${ticker} gelöscht.`);
          }

          const columns = allowedColumns.filter(col => row[col] !== undefined);
          const placeholders = columns.map(() => "?").join(",");
          const values = columns.map(col => row[col]);

          const insertSQL = `
            INSERT INTO Issuer (${columns.join(",")})
            VALUES (${placeholders})
          `;
          await runSQL(insertSQL, values);
          console.log(`✅ Neuer Issuer eingefügt: ${ticker}`);
        }

        continue; // 👉 kein Standard-Import für dieses Sheet
      }

      // ⏩ Standardimport für alle anderen Tabellen
      await importExcelToSQLite(
        excelPath,
        sheetName,
        tableName,
        deleteCondition,
        allowedColumns,
        overwriteExisting
      );
    }

    ['DealsMain', 'ProdAll', 'EUSW', 'Issuer'].forEach(table => {
      refreshTable(table, () => {
        console.log('Refreshed table:', table);
      });
    });

    return { success: true };

  } catch (err) {
    console.error('❌ Fehler beim Excel-Import:', err);
    return { success: false, error: err.message };
  }
});



// ipcMain.handle('start-offer-import', async () => {
//   try {
//     const { canceled, filePaths } = await dialog.showOpenDialog({
//       title: 'Excel-Datei für Portfolio auswählen',
//       filters: [{ name: 'Excel Files', extensions: ['xlsx', 'xls', 'xlsm'] }],
//       properties: ['openFile']
//     });

//     if (canceled || filePaths.length === 0) {
//       return { success: false, error: 'Keine Datei gewählt.' };
//     }

//     const filePath = filePaths[0];
//     const fileName = path.basename(filePath, path.extname(filePath)); // z. B. "myportfolio"
//     const workbook = XLSX.readFile(filePath);
//     const sheet = workbook.Sheets[workbook.SheetNames[0]];
//     const rows = XLSX.utils.sheet_to_json(sheet);

//     if (rows.length === 0) {
//       return { success: false, error: 'Excel-Datei enthält keine Daten.' };
//     }

//     // Tabelle erstellen und Daten speichern
//     await createTableFromRows(fileName, rows); // ← eigene Funktion, siehe unten

//     // Spalten von ProdAll & der neuen Tabelle holen
//     const prodAllColumns = await getTableColumns('ProdAll');
//     const tempTableColumns = await getTableColumns(fileName);

//     return {
//       success: true,
//       tempTableName: fileName,
//       prodAllColumns,
//       tempTableColumns
//     };
//   } catch (err) {
//     return { success: false, error: err.message };
//   }
// });



// Temporäre Tabelle anlegen für Spaltenvergleich

// 1. Schritt: Datei auswählen und Sheetnamen zurückgeben
ipcMain.handle('select-excel-file', async () => {
  try {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Excel-Datei auswählen',
      filters: [{ name: 'Excel Files', extensions: ['xlsx', 'xls', 'xlsm'] }],
      properties: ['openFile']
    });

    if (canceled || filePaths.length === 0) {
      return { success: false, error: 'Keine Datei gewählt.' };
    }

    const filePath = filePaths[0];
    const workbook = XLSX.readFile(filePath);
    const sheetNames = workbook.SheetNames; // Alle Tabellenblattnamen

    return {
      success: true,
      filePath,
      sheetNames
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// 2. Schritt: konkretes Sheet verarbeiten und Tabelle erstellen
// ipcMain.handle('import-excel-offer-sheet', async (event, { filePath, sheetName }) => {
//   try {
//     const fileName = path.basename(filePath, path.extname(filePath));
//     const workbook = XLSX.readFile(filePath);

//     if (!workbook.Sheets[sheetName]) {
//       return { success: false, error: 'Ausgewähltes Tabellenblatt existiert nicht.' };
//     }

//     const sheet = workbook.Sheets[sheetName];
//     const rows = XLSX.utils.sheet_to_json(sheet);

//     if (rows.length === 0) {
//       return { success: false, error: 'Das Tabellenblatt enthält keine Daten.' };
//     }

//     await createTableFromRows(fileName, rows);

//     const PortfoliosColumns = await getTableColumns('Portfolios');
//     const tempTableColumns = await getTableColumns(fileName);

//     return {
//       success: true,
//       tempTableName: fileName,
//       PortfoliosColumns,
//       tempTableColumns
//     };
//   } catch (err) {
//     return { success: false, error: err.message };
//   }
// });

// inkl. Check ob Tabelle bereits vorhanden
ipcMain.handle('import-excel-offer-sheet', async (event, { filePath, sheetName, overwrite = false }) => {
  try {
    const fileName = path.basename(filePath, path.extname(filePath));
    const workbook = XLSX.readFile(filePath);

    if (!workbook.Sheets[sheetName]) {
      return { success: false, error: 'Ausgewähltes Tabellenblatt existiert nicht.' };
    }

    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet);

    if (rows.length === 0) {
      return { success: false, error: 'Das Tabellenblatt enthält keine Daten.' };
    }

    // Prüfen, ob Tabelle bereits existiert
    const tableExists = await new Promise((resolve, reject) => {
      db.get(
        `SELECT name FROM sqlite_master WHERE type='table' AND name = ?`,
        [fileName],
        (err, row) => {
          if (err) reject(err);
          else resolve(!!row);
        }
      );
    });

    if (tableExists && !overwrite) {
      return {
        success: false,
        tableExists: true,
        tempTableName: fileName
      };
    }

    // Wenn Überschreiben: alte Tabelle löschen
    if (tableExists && overwrite) {
      await runSQL(`DROP TABLE IF EXISTS "${fileName}"`);
    }

    // Neue Tabelle erstellen
    await createTableFromRows(fileName, rows);

    const PortfoliosColumns = await getTableColumns('Portfolios');
    const tempTableColumns = await getTableColumns(fileName);
    console.log("📋 Spalten der temporären Tabelle:", tempTableColumns);

    return {
      success: true,
      tempTableName: fileName,
      PortfoliosColumns,
      tempTableColumns
    };

  } catch (err) {
    return { success: false, error: err.message };
  }
});

//nur für Schnellimport (Testdatei LLB)
ipcMain.handle('import-excel-offer-sheet-quick', async (event, { filePath, sheetName, overwrite = true }) => {
  try {
    const fileName = path.basename(filePath, path.extname(filePath));
    const xlsx = require("xlsx"); // explizit importieren, falls nicht global

    const workbook = xlsx.readFile(filePath);
    if (!workbook.Sheets[sheetName]) {
      return { success: false, error: 'Ausgewähltes Tabellenblatt existiert nicht.' };
    }

    const sheet = workbook.Sheets[sheetName];

    // ❗Header korrekt interpretieren
    const rows = xlsx.utils.sheet_to_json(sheet, {
      header: 0,       // erste Zeile = Spaltennamen
      defval: "",      // leere Zellen explizit als "" setzen
      raw: false       // konvertiert z. B. Excel-Daten richtig
    });

    if (rows.length === 0) {
      return { success: false, error: 'Das Tabellenblatt enthält keine Daten.' };
    }

    // Tabelle ggf. löschen
    if (overwrite) {
      await runSQL(`DROP TABLE IF EXISTS "${fileName}"`);
    }

    // Tabelle aus vollständigen Zeilen erstellen
    await createTableFromRows(fileName, rows);

    const PortfoliosColumns = await getTableColumns("Portfolios");
    const tempTableColumns = await getTableColumns(fileName);

    return {
      success: true,
      tempTableName: fileName,
      PortfoliosColumns,
      tempTableColumns
    };

  } catch (err) {
    console.error("❌ Fehler beim Schnellimport:", err);
    return { success: false, error: err.message };
  }
});



async function createTableFromRows(tableName, rows) {
  const sample = rows[0];
  const columns = Object.keys(sample);

  const createSQL = `CREATE TABLE IF NOT EXISTS ${tableName} (${columns.map(c => `"${c}" TEXT`).join(", ")})`;
  await runSQL(createSQL);

  const insertSQL = `INSERT INTO ${tableName} (${columns.map(c => `"${c}"`).join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`;

  for (const row of rows) {
    const values = columns.map(c => row[c] ?? null);
    await runSQL(insertSQL, values);
  }
}

// Spalten einer Tabelle lesen
async function getTableColumns(tableName) {
  return new Promise((resolve, reject) => {
    db.all(`PRAGMA table_info(${tableName})`, [], (err, rows) => {
      if (err) reject(err);
      else resolve(rows.map(r => r.name));
    });
  });
}

ipcMain.handle('get-table-columns', async (event, { tableName }) => {
  try {
    const columns = await getTableColumns(tableName);
    return columns;
  } catch (err) {
    console.error(`❌ Fehler beim Abrufen der Spalten für "${tableName}":`, err);
    return [];
  }
});

// IPC-Handler: Liest alle Zeilen einer Tabelle aus der Datenbank, für Console log notwendig
ipcMain.handle('get-table-rows', async (event, { tableName }) => {
  return new Promise((resolve, reject) => {
    db.all(`SELECT * FROM "${tableName}"`, [], (err, rows) => {
      if (err) {
        console.error(`❌ Fehler beim Lesen der Tabelle ${tableName}:`, err);
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
});
// ISSUER:
//prüft alle importierten Issuer und legt sie bei Bedarf neu an
// ipcMain.handle('check-and-insert-issuers', async (event, { tableName, columnMap }) => {
//   try {
//     // Dynamische Spaltenzuordnung aus der Zuordnungstabelle
//     const tickerCol = columnMap.find(m => m.to === "TICKER")?.from;
//     const issuerCol = columnMap.find(m => m.to === "ISSUER")?.from;
//     const ratingCol = columnMap.find(m => m.to === "RATING")?.from;

//     if (!tickerCol || !issuerCol || !ratingCol) {
//       throw new Error("Erforderliche Spalten für den Issuer-Check wurden nicht vollständig zugeordnet.");
//     }

//     const sql = `
//       SELECT DISTINCT "${tickerCol}" AS TICKER, "${issuerCol}" AS ISSUER, "${ratingCol}" AS RATING 
//       FROM "${tableName}" 
//       WHERE "${tickerCol}" IS NOT NULL
//     `;

//     const rows = await new Promise((resolve, reject) => {
//       db.all(sql, [], (err, rows) => {
//         if (err) reject(err);
//         else resolve(rows);
//       });
//     });

//     for (const row of rows) {
//       const { TICKER, ISSUER, RATING } = row;

//       const existing = await new Promise((resolve, reject) => {
//         db.get(`SELECT * FROM Issuer WHERE TICKER = ?`, [TICKER], (err, result) => {
//           if (err) reject(err);
//           else resolve(result);
//         });
//       });

//       if (!existing) {
//         const insertSQL = `
//           INSERT INTO Issuer 
//           ("INCLUDE", "ISSUER", "TICKER", "RATING", "senior_unsecured") 
//           VALUES (?, ?, ?, ?, ?)
//         `;
//         await runSQL(insertSQL, [1, ISSUER, TICKER, RATING, RATING]);
//         console.log(`✅ Neuer Issuer eingefügt: ${ISSUER} (${TICKER})`);
//       } else {
//         console.log(`🔁 Issuer bereits vorhanden: ${ISSUER} (${TICKER})`);
//       }
//     }

//     return { success: true };
//   } catch (err) {
//     console.error("❌ Fehler beim Prüfen/Einfügen der Issuer:", err);
//     return { success: false, error: err.message };
//   }
// });

ipcMain.handle('check-and-insert-issuers', async (event, { tableName, columnMap }) => {
  try {
    const tickerCol = columnMap.find(m => m.to === "TICKER")?.from;
    const issuerCol = columnMap.find(m => m.to === "ISSUER")?.from;
    const ratingCol = columnMap.find(m => m.to === "RATING")?.from;

    if (!tickerCol || !issuerCol || !ratingCol) {
      throw new Error("Erforderliche Spalten für den Issuer-Check wurden nicht vollständig zugeordnet.");
    }

    const sql = `
      SELECT DISTINCT "${tickerCol}" AS TICKER, "${issuerCol}" AS ISSUER, "${ratingCol}" AS RATING 
      FROM "${tableName}" 
      WHERE "${tickerCol}" IS NOT NULL
    `;

    const rows = await new Promise((resolve, reject) => {
      db.all(sql, [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    let inserted = false;

    for (const row of rows) {
      const { TICKER, ISSUER, RATING } = row;

      const existing = await new Promise((resolve, reject) => {
        db.get(`SELECT * FROM Issuer WHERE TICKER = ?`, [TICKER], (err, result) => {
          if (err) reject(err);
          else resolve(result);
        });
      });

      if (!existing) {
        const insertSQL = `
          INSERT INTO Issuer 
          ("INCLUDE", "ISSUER", "TICKER", "RATING", "senior_unsecured") 
          VALUES (?, ?, ?, ?, ?)
        `;
        await runSQL(insertSQL, [1, ISSUER, TICKER, RATING, RATING]);
        console.log(`✅ Neuer Issuer eingefügt: ${ISSUER} (${TICKER})`);
        inserted = true;
      } else {
        console.log(`🔁 Issuer bereits vorhanden: ${ISSUER} (${TICKER})`);
      }
    }

    // ⬇️ Direkt Backend-Refresh aufrufen
    if (inserted) {
      refreshTable("Issuer");
    }

    return { success: true };
  } catch (err) {
    console.error("❌ Fehler beim Prüfen/Einfügen der Issuer:", err);
    return { success: false, error: err.message };
  }
});

// PRODUCT:
// ipcMain.handle('check-and-insert-products', async (event, { tableName, columnMap }) => {
//   try {
//     const prodIdCol     = columnMap.find(m => m.to === "PROD_ID")?.from;
//     const descCol       = columnMap.find(m => m.to === "DESCRIPTION")?.from;
//     const tickerCol     = columnMap.find(m => m.to === "TICKER")?.from;
//     const maturityCol   = columnMap.find(m => m.to === "MATURITY")?.from;
//     const couponCol     = columnMap.find(m => m.to === "COUPON")?.from;
//     const rankCol       = columnMap.find(m => m.to === "RANK")?.from;
//     const ratingProdCol = columnMap.find(m => m.to === "RATING_PROD")?.from;
//     const tenorCol      = columnMap.find(m => m.to === "TENOR")?.from;
//     const startDateCol  = columnMap.find(m => m.to === "START_DATE")?.from;

//     if (!prodIdCol || !descCol || !tickerCol) {
//       throw new Error("Erforderliche Spalten (PROD_ID, DESCRIPTION, TICKER) wurden nicht vollständig zugeordnet.");
//     }

//     const safeCol = (col, alias) => col ? `"${col}" AS ${alias}` : `'' AS ${alias}`;

//     const sql = `
//       SELECT DISTINCT 
//         ${safeCol(prodIdCol,     'PROD_ID')},
//         ${safeCol(descCol,       'DESCRIPTION')},
//         ${safeCol(tickerCol,     'TICKER')},
//         ${safeCol(maturityCol,   'MATURITY')},
//         ${safeCol(couponCol,     'COUPON')},
//         ${safeCol(rankCol,       'RANK')},
//         ${safeCol(ratingProdCol, 'RATING_PROD')},
//         ${safeCol(tenorCol,      'TENOR')},
//         ${safeCol(startDateCol,  'START_DATE')}
//       FROM "${tableName}"
//       WHERE "${prodIdCol}" IS NOT NULL
//     `;

//     const rows = await new Promise((resolve, reject) => {
//       db.all(sql, [], (err, rows) => {
//         if (err) reject(err);
//         else resolve(rows);
//       });
//     });

//     const rankMapping = {
//       "senior secured": "senior_secured",
//       "secured": "senior_secured",
//       "senior preferred": "senior_preferred",
//       "senior pref.": "senior_preferred",
//       "sr preferred": "senior_preferred",
//       "senior unsecured": "senior_unsecured",
//       "sr unsecured": "senior_unsecured",
//       "unsecured": "senior_unsecured",
//       "senior": "senior_unsecured",
//       "plain vanilla": "senior_unsecured",
//       "senior subordinated": "senior_subordinated",
//       "subordinated": "senior_subordinated",
//       "subord.": "senior_subordinated",
//       "junior subordinated": "junior_subordinated",
//     };

//     const unmappedRanks = new Set();
//     const unmappedProdIds = new Map();
//     let insertedCount = 0;

//     for (const row of rows) {
//       const { PROD_ID, TICKER } = row;

//       const matchedIssuer = await new Promise((resolve, reject) => {
//         db.get(`SELECT ISSUER FROM Issuer WHERE TICKER = ?`, [TICKER], (err, result) => {
//           if (err) reject(err);
//           else resolve(result?.ISSUER || null);
//         });
//       });

//       const formatDate = (val) => {
//         if (!val) return "";
//         if (typeof val === 'string' && /^\d{2}\.\d{2}\.\d{4}$/.test(val)) {
//           const [d, m, y] = val.split('.');
//           return `${y}-${m}-${d}`;
//         } else if (val instanceof Date) {
//           return val.toISOString().split('T')[0];
//         } else {
//           return val;
//         }
//       };

//       row.MATURITY = formatDate(row.MATURITY);
//       row.START_DATE = formatDate(row.START_DATE);

//       if (typeof row.COUPON === "string") {
//         row.COUPON = parseFloat(row.COUPON.replace(",", "."));
//       }
//       if (typeof row.COUPON === "number") {
//         row.COUPON = row.COUPON / 100;
//       }

//       const rawRank = row.RANK?.toLowerCase().trim() || "";
//       const normalizedRank = rankMapping[rawRank] || null;

//       if (!normalizedRank && rawRank) {
//         unmappedRanks.add(rawRank);
//         if (!unmappedProdIds.has(rawRank)) {
//           unmappedProdIds.set(rawRank, []);
//         }
//         unmappedProdIds.get(rawRank).push(PROD_ID);
//       }

//       // Fallbacks
//       row.DESCRIPTION   = row.DESCRIPTION   ?? "";
//       row.MATURITY      = row.MATURITY      ?? "";
//       row.START_DATE    = row.START_DATE    ?? "";
//       row.COUPON        = row.COUPON        ?? "";
//       row.TICKER        = row.TICKER        ?? "";
//       row.RATING_PROD   = (row.RATING_PROD === undefined || row.RATING_PROD === null || row.RATING_PROD === "Product_Rating") ? "" : row.RATING_PROD;
//       row.TENOR         = row.TENOR         ?? "";

//       const exists = await new Promise((resolve, reject) => {
//         db.get(`SELECT 1 FROM ProdAll WHERE PROD_ID = ?`, [PROD_ID], (err, found) => {
//           if (err) reject(err);
//           else resolve(!!found);
//         });
//       });

//       if (!exists) {
//         const insertSQL = `
//           INSERT INTO ProdAll 
//           ("INCLUDE", "PROD_ID", "DESCRIPTION", "ISSUER", "MATURITY", "START_DATE", "COUPON", "RANK", "TICKER", "RATING_PROD", "TENOR", "CouponType")
//           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
//         `;

//         await runSQL(insertSQL, [
//           1,
//           PROD_ID || "",
//           row.DESCRIPTION,
//           matchedIssuer || "",
//           row.MATURITY,
//           row.START_DATE,
//           row.COUPON,
//           normalizedRank,
//           row.TICKER,
//           row.RATING_PROD,
//           row.TENOR,
//           "FIX"
//         ]);

//         insertedCount++;
//         console.log(`➕ Produkt eingefügt: ${PROD_ID}`);
//       } else {
//         console.log(`✔️ Produkt vorhanden: ${PROD_ID}`);
//       }
//     }

//     if (unmappedRanks.size > 0) {
//       const details = Array.from(unmappedProdIds.entries())
//         .map(([rank, prodIds]) => `❓ "${rank}" → ${prodIds.join(", ")}`)
//         .join("\n");

//       const message = `⚠️ Unbekannte RANK-Werte erkannt!\nDiese Produkte wurden mit leerem RANK importiert:\n\n${details}`;
//       event.sender.send("show-rank-warning", message);
//     }

//     return { success: true, insertedCount };

//   } catch (err) {
//     console.error("❌ Fehler beim Einfügen der Produkte:", err);
//     return { success: false, error: err.message };
//   }
// });

ipcMain.handle('check-and-insert-products', async (event, { tableName, columnMap }) => {
  try {
    const prodIdCol     = columnMap.find(m => m.to === "PROD_ID")?.from;
    const descCol       = columnMap.find(m => m.to === "DESCRIPTION")?.from;
    const tickerCol     = columnMap.find(m => m.to === "TICKER")?.from;
    const maturityCol   = columnMap.find(m => m.to === "MATURITY")?.from;
    const couponCol     = columnMap.find(m => m.to === "COUPON")?.from;
    const rankCol       = columnMap.find(m => m.to === "RANK")?.from;
    const ratingProdCol = columnMap.find(m => m.to === "RATING_PROD")?.from;
    const tenorCol      = columnMap.find(m => m.to === "TENOR")?.from;
    const startDateCol  = columnMap.find(m => m.to === "START_DATE")?.from;

    if (!prodIdCol || !descCol || !tickerCol) {
      throw new Error("Erforderliche Spalten (PROD_ID, DESCRIPTION, TICKER) wurden nicht vollständig zugeordnet.");
    }

    const safeCol = (col, alias) => col ? `"${col}" AS ${alias}` : `'' AS ${alias}`;

    const sql = `
      SELECT DISTINCT 
        ${safeCol(prodIdCol,     'PROD_ID')},
        ${safeCol(descCol,       'DESCRIPTION')},
        ${safeCol(tickerCol,     'TICKER')},
        ${safeCol(maturityCol,   'MATURITY')},
        ${safeCol(couponCol,     'COUPON')},
        ${safeCol(rankCol,       'RANK')},
        ${safeCol(ratingProdCol, 'RATING_PROD')},
        ${safeCol(tenorCol,      'TENOR')},
        ${safeCol(startDateCol,  'START_DATE')}
      FROM "${tableName}"
      WHERE "${prodIdCol}" IS NOT NULL
    `;

    const rows = await new Promise((resolve, reject) => {
      db.all(sql, [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    const rankMapping = {
      "senior secured": "senior_secured",
      "secured": "senior_secured",
      "senior preferred": "senior_preferred",
      "senior pref.": "senior_preferred",
      "sr preferred": "senior_preferred",
      "senior unsecured": "senior_unsecured",
      "sr unsecured": "senior_unsecured",
      "unsecured": "senior_unsecured",
      "senior": "senior_unsecured",
      "plain vanilla": "senior_unsecured",
      "senior subordinated": "senior_subordinated",
      "subordinated": "senior_subordinated",
      "subord.": "senior_subordinated",
      "junior subordinated": "junior_subordinated",
    };

    const unmappedRanks = new Set();
    const unmappedProdIds = new Map();
    let insertedCount = 0;

    for (const row of rows) {
      const { PROD_ID, TICKER } = row;

      const matchedIssuer = await new Promise((resolve, reject) => {
        db.get(`SELECT ISSUER FROM Issuer WHERE TICKER = ?`, [TICKER], (err, result) => {
          if (err) reject(err);
          else resolve(result?.ISSUER || null);
        });
      });

      const formatDate = (val) => {
        if (!val) return "";
        if (typeof val === 'string' && /^\d{2}\.\d{2}\.\d{4}$/.test(val)) {
          const [d, m, y] = val.split('.');
          return `${y}-${m}-${d}`;
        } else if (val instanceof Date) {
          return val.toISOString().split('T')[0];
        } else {
          return val;
        }
      };

      row.MATURITY = formatDate(row.MATURITY);
      row.START_DATE = formatDate(row.START_DATE);

      if (typeof row.COUPON === "string") {
        row.COUPON = parseFloat(row.COUPON.replace(",", "."));
      }
      if (typeof row.COUPON === "number") {
        row.COUPON = row.COUPON / 100;
      }

      const rawRank = row.RANK?.toLowerCase().trim() || "";
      const normalizedRank = rankMapping[rawRank] || null;

      if (!normalizedRank && rawRank) {
        unmappedRanks.add(rawRank);
        if (!unmappedProdIds.has(rawRank)) {
          unmappedProdIds.set(rawRank, []);
        }
        unmappedProdIds.get(rawRank).push(PROD_ID);
      }

      // Fallbacks
      row.DESCRIPTION   = row.DESCRIPTION   ?? "";
      row.MATURITY      = row.MATURITY      ?? "";
      row.START_DATE    = row.START_DATE    ?? "";
      row.COUPON        = row.COUPON        ?? "";
      row.TICKER        = row.TICKER        ?? "";
      row.RATING_PROD   = (row.RATING_PROD === undefined || row.RATING_PROD === null || row.RATING_PROD === "Product_Rating") ? "" : row.RATING_PROD;
      row.TENOR         = row.TENOR         ?? "";

      const exists = await new Promise((resolve, reject) => {
        db.get(`SELECT 1 FROM ProdAll WHERE PROD_ID = ?`, [PROD_ID], (err, found) => {
          if (err) reject(err);
          else resolve(!!found);
        });
      });

      if (!exists) {
        const insertSQL = `
          INSERT INTO ProdAll 
          ("INCLUDE", "PROD_ID", "DESCRIPTION", "ISSUER", "MATURITY", "START_DATE", "COUPON", "RANK", "TICKER", "RATING_PROD", "TENOR", "CouponType")
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        await runSQL(insertSQL, [
          1,
          PROD_ID || "",
          row.DESCRIPTION,
          matchedIssuer || "",
          row.MATURITY,
          row.START_DATE,
          row.COUPON,
          normalizedRank,
          row.TICKER,
          row.RATING_PROD,
          row.TENOR,
          "FIX"
        ]);

        insertedCount++;
        console.log(`➕ Produkt eingefügt: ${PROD_ID}`);
      } else {
        console.log(`✔️ Produkt vorhanden: ${PROD_ID}`);
      }
    }

    // 🌀 Tabelle nur aktualisieren, wenn neue Produkte eingefügt wurden
    if (insertedCount > 0 && typeof refreshTable === "function") {
      refreshTable("ProdAll");
    }

    if (unmappedRanks.size > 0) {
      const details = Array.from(unmappedProdIds.entries())
        .map(([rank, prodIds]) => `❓ "${rank}" → ${prodIds.join(", ")}`)
        .join("\n");

      const message = `⚠️ Unbekannte RANK-Werte erkannt!\nDiese Produkte wurden mit leerem RANK importiert:\n\n${details}`;
      event.sender.send("show-rank-warning", message);
    }

    return { success: true, insertedCount };

  } catch (err) {
    console.error("❌ Fehler beim Einfügen der Produkte:", err);
    return { success: false, error: err.message };
  }
});






//DEALS:
// ipcMain.handle("create-deals-from-import", async (event, { tableName, columnMap }) => {
//   try {
//     // 🧼 Vor dem Einfügen: vorhandene Deals mit gleichem port_name löschen
//     await new Promise((resolve, reject) => {
//       const deleteSQL = `DELETE FROM DealsMain WHERE port_name = ?`;
//       db.run(deleteSQL, [tableName], function (err) {
//         if (err) {
//           console.error("❌ Fehler beim Löschen alter Deals:", err);
//           reject(err);
//         } else {
//           console.log(`🗑️ Vorherige Einträge mit port_name = ${tableName} wurden gelöscht.`);
//           resolve();
//         }
//       });
//     });

//     // 🔍 PRICE_BUY-Zuordnung ermitteln
//     const priceBuyCol = columnMap.find(m => m.to === "PRICE_BUY")?.from;

//     // 📥 Alle Zeilen aus der Import-Tabelle
//     const rows = await getAllRowsFromTable(tableName);

//     const validRows = rows.filter(r => r.PROD_ID);
//     let insertedCount = 0;

//     for (const row of validRows) {
//       const newRow = {
//         INCLUDE: 1,
//         PROD_ID: row.PROD_ID,
//         TRADE_DATE: new Date().toISOString().split("T")[0],
//         CATEGORY: "2_lgfr_Anlagevermögen",
//         NOTIONAL: 1000000,
//         PRICE_BUY: priceBuyCol ? row[priceBuyCol] : null,
//         Depotbank: extractDepotbank(tableName),
//         port_name: tableName
//       };

//       await new Promise((resolve, reject) => {
//         insertRowInTable(newRow, "DealsMain", (err, lastId) => {
//           if (err) {
//             console.error("❌ Fehler beim Insert in DealsMain:", err);
//             reject(err);
//           } else {
//             console.log("✅ Deal eingefügt mit ID", lastId);
//             insertedCount++;
//             resolve(lastId);
//           }
//         });
//       });
//     }

//     return {
//       success: true,
//       insertedCount
//     };

//   } catch (err) {
//     console.error("❌ Fehler beim Erstellen von Deals:", err);
//     return { success: false, error: err.message };
//   }
// });

ipcMain.handle("create-deals-from-import", async (event, { tableName, columnMap }) => {
  try {
    // 🧼 Vor dem Einfügen: vorhandene Deals mit gleichem port_name löschen
    await new Promise((resolve, reject) => {
      const deleteSQL = `DELETE FROM DealsMain WHERE port_name = ?`;
      db.run(deleteSQL, [tableName], function (err) {
        if (err) {
          console.error("❌ Fehler beim Löschen alter Deals:", err);
          reject(err);
        } else {
          console.log(`🗑️ Vorherige Einträge mit port_name = ${tableName} wurden gelöscht.`);
          resolve();
        }
      });
    });

    // 🔍 PRICE_BUY-Zuordnung ermitteln
    const priceBuyCol = columnMap.find(m => m.to === "PRICE_BUY")?.from;

    // 📥 Alle Zeilen aus der Import-Tabelle
    const rows = await getAllRowsFromTable(tableName);

    const validRows = rows.filter(r => r.PROD_ID);
    let insertedCount = 0;

    for (const row of validRows) {
      const newRow = {
        INCLUDE: 1,
        PROD_ID: row.PROD_ID,
        TRADE_DATE: new Date().toISOString().split("T")[0],
        CATEGORY: "2_lgfr_Anlagevermögen",
        NOTIONAL: 1000000,
        PRICE_BUY: priceBuyCol ? row[priceBuyCol] : null,
        Depotbank: extractDepotbank(tableName),
        port_name: tableName
      };

      await new Promise((resolve, reject) => {
        insertRowInTable(newRow, "DealsMain", (err, lastId) => {
          if (err) {
            console.error("❌ Fehler beim Insert in DealsMain:", err);
            reject(err);
          } else {
            console.log("✅ Deal eingefügt mit ID", lastId);
            insertedCount++;
            resolve(lastId);
          }
        });
      });
    }

    // ✅ Nach dem Einfügen: Tabelle neu laden (nur bei Erfolg)
    if (insertedCount > 0 && typeof refreshTable === "function") {
      refreshTable("DealsMain");
    }

    return {
      success: true,
      insertedCount
    };

  } catch (err) {
    console.error("❌ Fehler beim Erstellen von Deals:", err);
    return { success: false, error: err.message };
  }
});






// 🔧 Extrahiert Depotbank aus Dateinamen (vor erstem "_")
function extractDepotbank(fileName) {
  if (!fileName || typeof fileName !== "string") return "";
  return fileName.split("_")[0];
}


ipcMain.on('import-matched-columns', (event, { sourceTable, columnMap }) => {
  importColumnMappings[sourceTable] = columnMap;
  console.log("🧩 Spaltenzuordnung gespeichert:", columnMap);
});



function createWindow() {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 800,
    height: 700,
    icon: path.join(__dirname, 'vXp.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      devTools: true,
    },
  });

  // and load the index.html of the app.
  mainWindow.loadFile('index.html');

  // Open the DevTools.
  mainWindow.webContents.openDevTools();
}

function fetchDataAndSendEvent(query, event) {
  queryDB(query, (err, rows) => {
    if (err) {
      console.error("Error fetching data:", err.message);
      return;
    }

    if (rows.length === 0) {
      console.log("No data available.");
      return;
    }

    const formattedRows = formatColumns(rows);
    mainWindow.webContents.send(event, formattedRows);
  });
}


function sendDataToRenderer() {
  //console.log('tableNames:', tableNames);
  tableNames.forEach(tableName => {
    //console.log('query:', tableName);
    fetchDataAndSendEvent(tableName, `${tableName}Data`);
  });
}
// TABELLEN EINGABE: Loop mit fetchDataAndSendEvent
// Array of selected table names
getAllTableNames((err, receivedTableNames) => {
  if (err) {
    console.error('Error retrieving table names:', err.message);
  } else {
    //console.log('receivedTableNames:', receivedTableNames);

    // Filter out excluded table names
    const excludedTableNames = ['sqlite_sequence', 'Instruments', 'PDMain', 'sortedLossesIndicesMain']; // Add any other names you want to exclude
    tableNames = receivedTableNames.filter(tableName => !excludedTableNames.includes(tableName));
    
    sendDataToRenderer(tableNames);
  }
});

ipcMain.on('start-py-fairValue', async (event, args) => {
  //console.log('📥 start-py-fairValue: Received args:', args);

  const { tableName, CSSzenario, selectedCurve } = args;

  if (!tableName || !CSSzenario || !selectedCurve) {
    console.error('❌ Missing required arguments.');
    event.reply('py-fairValue-complete', {
      success: false,
      projectName: 'py-fairValue',
      message: 'Arguments "tableName", "CSSzenario" and "selectedCurve" are all required.'
    });
    event.reply('project-finished', {
      success: false,
      projectName: 'py-fairValue'
    });
    return;
  }

  try {
    const pythonArgs = ['--table', tableName, '--CSSzenario', CSSzenario, '--selectedCurve', selectedCurve];
    //console.log('🚀 Starting Python script with args:', pythonArgs);

    const result = await startPythonScriptWithEvent(event, 'fvo', 'py-fairValue', pythonArgs);
    //console.log('✅ Python script executed successfully:', result);

    // Tabelle nach Abschluss aktualisieren
    refreshTable('Portfolios', () => {
      //console.log('🔄 Refreshed table: Portfolios');
    });

    event.reply('py-fairValue-complete', {
      success: true,
      projectName: 'py-fairValue',
      tableName: tableName,
      result
    });

    event.reply('project-finished', {
      success: true,
      projectName: 'py-fairValue'
    });

  } catch (error) {
    console.error('❌ Error during fair value script:', error);

    event.reply('py-fairValue-complete', {
      success: false,
      projectName: 'py-fairValue',
      error: error.message || error.toString(),
      tableName
    });

    event.reply('project-finished', {
      success: false,
      projectName: 'py-fairValue'
    });
  }
});
ipcMain.on('start-py-MVaR', async (event, args) => {
  const { tableName, selectedInterval } = args;
  const tablesToRefresh = ['MarketVaR'];

  if (!tableName) {
    console.error('❌ Missing required argument: "tableName".');
    event.reply('py-mvar-complete', {
      success: false,
      projectName: 'py-MVaR',
      message: '"tableName" is required.',
    });
    return;
  }

  if (!selectedInterval) {
    console.error('❌ Missing required argument: "selectedInterval".');
    event.reply('py-mvar-complete', {
      success: false,
      projectName: 'py-MVaR',
      message: '"selectedInterval" is required.',
    });
    return;
  }

  console.log('🚀 Received start-py-MVaR with tableName:', tableName, 'and selectedInterval:', selectedInterval);

  // Baue Argumente für Python-Skript: z.B. --table <tableName> --scenario <selectedInterval>
  const pythonArgs = ['--table', tableName, '--intervalName', selectedInterval];

  startPythonScriptWithEvent(event, 'mvar', 'py-MVaR', pythonArgs)
    .then(() => {
      //console.log('Python script executed successfully');

      // Non-blocking refresh
      tablesToRefresh.forEach(table => {
        refreshTable(table, () => {
          //console.log('Refreshed table:', table);
        });
      });

      //console.log('All tables refresh initiated');
    })
    .catch(error => {
      console.error('❌ Python script execution failed:', error);
    })
    .finally(() => {
      event.reply('py-mvar-complete', { success: true, projectName: 'py-MVaR' });
      event.reply('project-finished', { success: true, projectName: 'py-MVaR' });
    });
});

ipcMain.on('start-py-CVaR', async (event, args) => {
  //console.log('start-py-CVaR:', args);

  // Define the tables to be used in the script and for refreshing
  const tablesToRefresh = [
    'EAD', 
    'CreditVaR', 
    'sortedLossesMain',
    'sortedLossesIssuerMain',
    'sortedLossesIndicesMain'
  ];

  // Extract `tableName` and `CSSzenario` from arguments
  const { tableName, CSSzenario } = args; 

  if (!tableName || !CSSzenario) {
    console.error('❌ Missing required arguments: "tableName" or "CSSzenario".');
    event.reply('py-CVaR-complete', {
      success: false,
      projectName: 'py-CVaR',
      message: 'Both "tableName" and "CSSzenario" are required.',
    });
    return; // Exit if any argument is missing
  }

  const pythonArgs = ['--table', tableName, '--CSSzenario', CSSzenario];
  //console.log('Starting Python script with arguments:', pythonArgs);

  startPythonScriptWithEvent(event, 'cvar', 'py-CVaR', pythonArgs)
    .then(() => {
      //console.log('Python script executed successfully');

      // Refresh each table using a distinct variable name
      tablesToRefresh.forEach(table => {
        refreshTable(table, () => {
          //console.log('Refreshed table:', table);
        });
      });

      //console.log('All tables refreshed successfully');
    })
    .catch(error => {
      console.error('Python script execution failed:', error);
    })
    .finally(() => {
      event.reply('py-cvar-complete', { success: true, projectName: 'py-CVaR' });
      event.reply('project-finished', { success: true, projectName: 'py-CVaR' });
    });
});
ipcMain.on('start-py-excel', (event) => {
  // Define the tables to be used in the script and for refreshing
  const tablesToRefresh = ['Portfolios', 'DealsMain', 'ProdAll', 'Issuer'];

  // Start the Python script and pass the tables array
  startPythonScriptWithEvent(event, 'excel', 'py-excel')
  .then(() => {
    //console.log('Python script executed successfully_main');

        // Refresh each table
      tablesToRefresh.forEach(tableName => {
      refreshTable(tableName);
      //console.log('tableName:', tableName);
  })
    //console.log('Python script refreshed TABLES_main');
  })
  .catch(error => {
    console.error('Python script execution failed:', error);
  })
  .finally(() => {
    event.reply('project-finished', { success: true, projectName: 'py-excel' });

  });
});
ipcMain.on('start-py-historicData', async (event, args = {}) => {
  const api = args.api || ''; // z. B. "ECB"

  const scriptArgs = [];
  if (api) {
    scriptArgs.push('--api', api);
  }

  try {
    const result = await startPythonScriptWithEvent(event, 'hist', 'py-historicData', scriptArgs);

    const tableName = 'tblTS';
    refreshTable(tableName);

    event.reply('py-historicData-complete', {
      success: true,
      projectName: 'py-historicData',
      api,
      result
    });

    event.reply('project-finished', {
      success: true,
      projectName: 'py-hist',
      buttonId: args.buttonId || 'histButton'  // falls du das vom Frontend übergibst
    });
    

  } catch (error) {
    console.error('Python script execution failed:', error);

    event.reply('py-historicData-complete', {
      success: false,
      projectName: 'py-historicData',
      error: error.message || error.toString(),
      api
    });

    event.reply('project-finished', {
      success: false,
      projectName: 'py-historicData'
    });
  }
});

ipcMain.on('start-py-cspar', async (event, args) => {
  //console.log('📥 Received arguments for py-cspar:', args);

  const { CSSzenario } = args; // Extract `name` directly
  if (!CSSzenario) {
    console.error('❌ Error: Missing CSSzenario argument.');
    event.reply('project-finished', {
      success: false,
      projectName: 'py-cspar',
      message: 'The "CSSzenario" argument is required.',
    });
    return; // Stop execution
  }

  try {
    // Call the Python script with the `CSSzenario` argument
    const pythonArgs = ['--CSSzenario', CSSzenario];
    //console.log('🚀 Starting Python CSPAR script with arguments:', pythonArgs);

    const result = await startPythonScriptWithEvent(event, 'cspar', 'py-csparData', pythonArgs);
    //console.log('✅ py-cspar executed successfully with result:', result);

    // Refresh the table
    const tableToRefresh = 'CSMatrix';
    refreshTable(tableToRefresh);
    //console.log(`🔄 Refreshed table: ${tableToRefresh}`);

    // Notify the renderer that the project is complete
    event.reply('project-finished', {
      success: true,
      projectName: 'py-cspar',
      data: result,
    });
  } catch (error) {
    console.error('❌ Python script execution failed:', error);
    event.reply('project-finished', {
      success: false,
      projectName: 'py-cspar',
      message: 'Python script execution failed.',
      error: error.message,
    });
  }
});
ipcMain.on('start-py-ml', async (event, args) => {
  const {
    tableName,
    target,
    newModel,
    modelName, 
    modelType, 
    epochs = 1,
    batch_size = 32,
    optimizer,
    loss,
    metrics,
  } = args;

  //console.log('📥 Received arguments for py-ml:', args);

  const resolvedTarget = target || 'NVDA'; // Default target

  // 🟢 **Determine final model type for a new model**
  if (newModel) {
    // 🚨 **If modelType is missing, throw an error (no default)**
    if (!modelType) {
      console.error('❌ Error: modelType is required for new models.');
      event.reply('project-finished', { 
        success: false, 
        message: 'modelType is required for new models.' 
      });
      return; // Stop execution
    }
  } else {
    // 🟢 If newModel is false, use the modelName
    if (!modelName) {
      console.error('❌ Error: modelName is required when using a pre-trained model.');
      event.reply('project-finished', { 
        success: false, 
        message: 'modelName is required for pre-trained models.' 
      });
      return; // Stop execution
    }
  }

  // 🟢 **Prepare arguments for the Python script**
  const pythonArgs = [
    '--table', tableName,
    '--target', resolvedTarget,
    '--epochs', epochs.toString(),
    '--batch_size', batch_size.toString(),
  ];

  if (newModel) {
    pythonArgs.push('--newModel'); // Include newModel flag
    pythonArgs.push('--modelType', modelType); // **Use modelType for new models**
  } else if (modelName) {
    pythonArgs.push('--modelName', modelName); // Include modelName for existing models
  }

  // 🟢 **Optional parameters**
  if (optimizer) {
    pythonArgs.push('--optimizer', JSON.stringify(optimizer)); 
  }
  if (loss) {
    pythonArgs.push('--loss', loss); 
  }
  if (metrics && metrics.length > 0) {
    pythonArgs.push('--metrics', Array.isArray(metrics) ? metrics.join(',') : metrics); 
  }

  //console.log('🚀 Starting Python ML script with arguments:', pythonArgs);

  // 🟢 **Tables to Refresh**
  const tablesToRefresh = ['ML_FuturePredictions', 'ML_MergedData', 'ML_TrainedModels'];

  try {
    const result = await startPythonScriptWithEvent(event, 'ml', 'py-ml', pythonArgs);
    //console.log('✅ Python script executed successfully with result:', result);
    
    // **🔄 Refresh each table**
    tablesToRefresh.forEach(tableName => {
      try {
        refreshTable(tableName);
        //console.log('🔄 Refreshed table:', tableName);
      } catch (error) {
        console.error(`❌ Error refreshing table ${tableName}:`, error);
      }
    });

    // **📢 Notify the renderer process that the process is complete**
    event.reply('project-finished', { success: true, projectName: 'py-ml', data: result });
  } catch (error) {
    console.error('❌ Python script execution failed:', error);
    event.reply('project-finished', { success: false, message: 'Python script execution failed.' });
  }
});

ipcMain.on('start-py-matchColumns', async (event, args) => {
  const { inputColumns, productTargetColumns, offerTargetColumns } = args;

  // 🛑 Validate inputs
  if (
    !Array.isArray(inputColumns) ||
    !Array.isArray(productTargetColumns) ||
    !Array.isArray(offerTargetColumns)
  ) {
    console.log('📥 Received payload (invalid):', args);
    console.error('❌ Missing or invalid arguments for matchColumns.');
    event.reply('py-matchColumns-complete', {
      success: false,
      projectName: 'py-matchColumns',
      message: 'Arguments "inputColumns", "productTargetColumns", and "offerTargetColumns" must be arrays.'
    });
    event.reply('project-finished', {
      success: false,
      projectName: 'py-matchColumns'
    });
    return;
  }

  try {
    // ✅ Prepare arguments for Python script
    const pythonArgs = [
      '--aicolumn_input', JSON.stringify(inputColumns),
      '--product_targets', JSON.stringify(productTargetColumns),
      '--offer_targets', JSON.stringify(offerTargetColumns)
    ];

    console.log('🚀 startPythonScriptWithEvent:', pythonArgs);

    // 🔁 Run Python script
    const result = await startPythonScriptWithEvent(event, 'aicolumn', 'py-matchColumns', pythonArgs);

    console.log('✅ Python result received:', result);

    // ✅ Reply with full match results directly
    event.reply('py-matchColumns-complete', {
      success: true,
      projectName: 'py-matchColumns',
      product_matches: result.product_matches,
      offer_matches: result.offer_matches
    });
    

    event.reply('project-finished', {
      success: true,
      projectName: 'py-matchColumns'
    });

  } catch (error) {
    console.error('❌ Error during matchColumns script:', error);

    event.reply('py-matchColumns-complete', {
      success: false,
      projectName: 'py-matchColumns',
      error: error.message || error.toString()
    });

    event.reply('project-finished', {
      success: false,
      projectName: 'py-matchColumns'
    });
  }
});










// Startet die Anzeige der Fenster
app.whenReady().then(() => {
  createWindow();
  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});
// Close the database connection when the app is quitting
app.on('before-quit', () => {
  closeDatabase();
});

// Define the event listener function
const updateDataListener = async (event, { cleanTableName, rowIndex, newData, uniqueIdentifier }) => {
  try {
    // Call the updateRecord function with a callback
    updateRecord(cleanTableName, rowIndex, newData, uniqueIdentifier, (err) => {
      //console.log('updateRecord uniqueIdentifier:', uniqueIdentifier);
      //console.log('updateRecord cleanTableName:', cleanTableName);
      if (err) {
        // Handle the error when the updateRecord function reports an error
        console.error(err.message);
        event.reply('update-data-error', err.message);
      } else {
        // Handle the success when the updateRecord function completes successfully
        event.reply('update-data-success');
        //console.log('Update:', cleanTableName, newData, uniqueIdentifier);
        //console.log('Update success');
        refreshTable(cleanTableName);
        refreshTable('ProdAll');
      }
    });
  } catch (error) {
    console.error(error.message);
    event.reply('update-data-error', error.message);
  }
};

// Attach the event listener for the "update-data" event only once during initialization
ipcMain.on('update-data', updateDataListener);

ipcMain.on('add-new-row', (event, { newRowData, cleanTableName }) => {
  console.log('Event listener triggered in main.js');
  console.log('Received data:', newRowData);

  insertRowInTable(newRowData, cleanTableName, (err) => {
    if (err) {
      console.error('Error inserting row:', err.message);
      event.reply('add-new-row-error', err.message);
    } else {
      //console.log('Row added successfully:', newRowData);
      event.reply('add-new-row-success');
      refreshTable(cleanTableName);
      refreshTable('DealsMain');
      refreshTable('MVarInput_2');
    }
  });
});





app.on('browser-window-created', (event, window) => {
  window.webContents.on('did-finish-load', () => {
    sendDataToRenderer();
  });
});
app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});
// Handle erase data request from the renderer process
ipcMain.on('erase-data', async (event, {cleanTableName, uniqueIdentifier }) => {
  try {
    await eraseRowFromDB(cleanTableName, uniqueIdentifier);
    event.reply('erase-data-success');
    refreshTable(cleanTableName)
    //ipcMain.removeListener('erase-data', eraseRowFromDB);
  } catch (error) {
    console.error(error.message);
    event.reply('erase-data-error', error.message);
  }
  ipcMain.removeListener('erase-data', eraseRowFromDB);
  //ipcMain.addListener('erase-data', eraseRowFromDB);
});

// SAVE DEALS SELECTION

ipcMain.on('save-deals-selection', async (event, selectionData) => {
  //console.log('selectionData1:', selectionData);
  const {port_name, selectedTradeIDs } = selectionData;
  
  try {
    // Insert selection into DealsMain with the correct port_name
    await insertSelection(port_name, selectedTradeIDs);

    //console.log(`✅ Selection inserted for portfolio: ${port_name}`);

    // Refresh DealsMain after inserting new data
    refreshTable('DealsMain');
  } catch (error) {
    console.error('❌ Error handling selection:', error);
  }
});

// DELETE DEALS SELECTION
ipcMain.on('delete-selected-table', (event, selectedTableName) => {
  //console.log('delete-selected-table:', selectedTableName);
  deleteTable(selectedTableName, event.sender);
});




// GET THE DATA FROM ANY TABLE:
ipcMain.on('fetch-table-data', (event, selectedTableName) => {
  console.log('fetch-table-data:', selectedTableName);

  refreshTable(selectedTableName, (data) => {
    console.log(`Sende Daten für Tabelle "${selectedTableName}" zurück`, data);

    // Wichtig: Passender Channel-Name!
    event.reply(`${selectedTableName}`, data);
  });
});


ipcMain.on('start-training', (event) => {
  const pythonProcess = spawn('python', ['path/to/your_script.py']);

  pythonProcess.stdout.on('data', (data) => {
    try {
      const message = JSON.parse(data.toString());
      if (message.progress) {
        // Send progress updates to the renderer process
        event.sender.send('training-progress', message.progress);
      }
    } catch (err) {
      console.error('Error parsing progress data:', err);
    }
  });

  pythonProcess.stderr.on('data', (data) => {
    console.error(`Python error: ${data}`);
  });

  pythonProcess.on('close', (code) => {
    //console.log(`Python process exited with code ${code}`);
    event.sender.send('training-complete', { success: code === 0 });
  });
});


const handleCSParameterUpdate = (event, { newRowData, cleanTableName }) => {
  //console.log('Event listener triggered for CSParameter update in main.js');

  // Insert the new row into the CSParameter table
  insertCSParameter(newRowData, cleanTableName, (err) => {
    if (err) {
      console.error('Error inserting CSParameter row:', err.message);
      event.reply('csparameter-update-error', err.message);
    } else {
      //console.log('CSParameter row added successfully:', newRowData);
      event.reply('csparameter-update-success');

      // Refresh the table after successful insertion
      refreshTable(cleanTableName);
    }
  });
};

// Register the event listener
ipcMain.on('csparameter-update', handleCSParameterUpdate);


function refreshTable(tableName, callback) {
  let eventIdentifier = tableName + 'Data';
  // console.log(`🔄 [refreshTable] Starting refresh for table: ${tableName} (event: ${eventIdentifier})`);

  fetchDataAndSendEvent(tableName, eventIdentifier, () => {
    // console.log(`✅ [refreshTable] Data fetched for ${eventIdentifier}`);

    if (typeof callback === 'function') {
      // console.log(`➡️ [refreshTable] Executing callback for ${tableName}`);
      callback();  // Ensure this is being called
    } else {
      console.warn(`⚠️ [refreshTable] No callback provided for ${tableName}`);
    }
  });
}

// Import Columns
ipcMain.on('import-matched-columns', async (event, args) => {
  const { sourceTable, targetTable, columnMap, additionalFields = {} } = args;

  console.log(`📥 Import from ${sourceTable} → ${targetTable}`);
  console.log('🧭 Column map:', columnMap);
  console.log('🧩 Additional fields:', additionalFields);

  try {
    const rows = await getAllRowsFromTable(sourceTable);
    if (!rows || rows.length === 0) {
      return event.reply('import-matched-columns-complete', {
        success: false,
        message: `No data in source table: ${sourceTable}`
      });
    }

    let insertedCount = 0;
    for (const row of rows) {
      const newRow = {};

      // Mapping der Spalten
      columnMap.forEach(({ from, to }) => {
        if (row.hasOwnProperty(from)) {
          newRow[to] = row[from];
        }
      });

      // Füge zusätzliche Felder wie port_name hinzu
      Object.entries(additionalFields).forEach(([key, value]) => {
        newRow[key] = value;
      });

      // Nutze deine bestehende Insert-Logik
      insertRowInTable(newRow, targetTable, (err) => {
        if (err) {
          console.error(`❌ Failed to insert row in ${targetTable}:`, err.message);
        } else {
          insertedCount++;
        }
      });
    }

    // Erfolgsmeldung
    event.reply('import-matched-columns-complete', {
      success: true,
      message: `✅ Zeilen in "${targetTable}" eingefügt.`,
    });

    refreshTable(targetTable);

  } catch (err) {
    console.error('❌ Fehler beim Import:', err);
    event.reply('import-matched-columns-complete', {
      success: false,
      error: err.message || err.toString()
    });
  }
});




ipcMain.on('update-customer-texts', async (event, { customer_id, pdf_header, pdf_footer }) => {
  console.log('📥 Event erhalten:', customer_id, pdf_header, pdf_footer);

  try {
    await updateCustomerTexts(db, customer_id, pdf_header, pdf_footer);
    console.log(`✅ PDF-Texte für Kunde ${customer_id} gespeichert.`);

    // ⬇️ Tabelle 'Customer' aktualisieren
    refreshTable('Customer', () => {
      console.log('🔄 Customer-Tabelle refreshed (main.js)');
      event.reply('update-customer-texts-success');
    });

  } catch (err) {
    console.error('❌ Fehler beim Speichern:', err.message);
    event.reply('update-customer-texts-error', err.message);
  }
});

















