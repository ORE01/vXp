export async function startOfferImport() {
  try {
    // 1. Datei auswählen & Sheetnamen abrufen
    const fileResult = await window.api.invoke('select-excel-file');

    if (!fileResult.success) {
      alert("❌ Fehler beim Öffnen der Datei: " + fileResult.error);
      return;
    }

    const { filePath, sheetNames } = fileResult;

    // 2. Sheet-Auswahl anzeigen
    const selectedSheet = await showSheetSelectionDialog(sheetNames);

    if (!selectedSheet) {
      alert("⚠️ Kein Tabellenblatt gewählt.");
      return;
    }

    // 3. Versuche Import → prüfe auf vorhandene Tabelle
    let importResult = await window.api.invoke('import-excel-offer-sheet', {
      filePath,
      sheetName: selectedSheet
    });

    // 4. Wenn Tabelle schon existiert → Nutzer fragen
    if (importResult.tableExists) {
      const userChoice = await showTableConflictDialog(importResult.tempTableName);

      if (userChoice === "cancel") {
        alert("❌ Import abgebrochen.");
        return;
      }

      if (userChoice === "useExisting") {
        alert("📂 Bestehende Tabelle wird verwendet.");
        const PortfoliosColumns = await window.api.invoke('get-table-columns', { tableName: importResult.tempTableName });
        const tempTableColumns = await window.api.invoke('get-table-columns', { tableName: importResult.tempTableName });
        showMatchingUI(PortfoliosColumns, tempTableColumns, importResult.tempTableName);
         const rows = await window.api.invoke('get-table-rows', { tableName: importResult.tempTableName });
        console.log("📊 Inhalt der bestehenden Tabelle:", rows);
        return;
      }

      if (userChoice === "overwrite") {
        importResult = await window.api.invoke('import-excel-offer-sheet', {
          filePath,
          sheetName: selectedSheet,
          overwrite: true
        });
        if (importResult.success) {
        const rows = await window.api.invoke('get-table-rows', { tableName: importResult.tempTableName });
        console.log("📊 Tabelle nach Ersetzen:", rows);
        }
      }
    }

    // 5. Import prüfen & Matching starten
    if (!importResult.success) {
      alert("❌ Fehler beim Import: " + importResult.error);
      return;
    }

    const { tempTableName, PortfoliosColumns, tempTableColumns } = importResult;

    alert(`✅ Datei erfolgreich geladen: "${tempTableName}".\nBitte Spalten zuordnen.`);
    showMatchingUI(PortfoliosColumns, tempTableColumns, tempTableName);

  } catch (err) {
    console.error("❌ Unerwarteter Fehler beim Import:", err);
    alert("❌ Unerwarteter Fehler beim Import: " + err.message);
  }
}

// zeigt den Dialog mit „Ersetzen“, „Bestehende verwenden“, „Abbrechen“
async function showTableConflictDialog(tableName) {
  return new Promise((resolve) => {
    const dialog = document.createElement("div");
    dialog.style.position = "fixed";
    dialog.style.top = "50%";
    dialog.style.left = "50%";
    dialog.style.transform = "translate(-50%, -50%)";
    dialog.style.backgroundColor = "#fff";
    dialog.style.padding = "20px";
    dialog.style.border = "1px solid #ccc";
    dialog.style.zIndex = "10000";
    dialog.style.boxShadow = "0 0 10px rgba(0,0,0,0.3)";
    dialog.style.minWidth = "360px";
    dialog.style.textAlign = "center";
    dialog.style.borderRadius = "8px";

    const title = document.createElement("div");
    title.textContent = `⚠️ Tabelle "${tableName}" existiert bereits.`;
    title.style.fontWeight = "bold";
    title.style.marginBottom = "12px";
    dialog.appendChild(title);

    const message = document.createElement("div");
    message.textContent = "Wie möchtest du fortfahren?";
    message.style.marginBottom = "20px";
    dialog.appendChild(message);

    const btnOverwrite = document.createElement("button");
    btnOverwrite.textContent = "Ersetzen";
    btnOverwrite.style.margin = "0 8px";
    btnOverwrite.onclick = () => {
      document.body.removeChild(dialog);
      resolve("overwrite");
    };

    const btnUse = document.createElement("button");
    btnUse.textContent = "Bestehende verwenden";
    btnUse.style.margin = "0 8px";
    btnUse.onclick = () => {
      document.body.removeChild(dialog);
      resolve("useExisting");
    };

    const btnCancel = document.createElement("button");
    btnCancel.textContent = "Abbrechen";
    btnCancel.style.margin = "0 8px";
    btnCancel.onclick = () => {
      document.body.removeChild(dialog);
      resolve("cancel");
    };

    dialog.appendChild(btnOverwrite);
    dialog.appendChild(btnUse);
    dialog.appendChild(btnCancel);

    document.body.appendChild(dialog);
  });
}


// zeigt die Liste der Sheet-Namen aus der Excel-Datei
// async function showSheetSelectionDialog(sheetNames) {
//   return new Promise((resolve) => {
//     const dialog = document.createElement("div");
//     dialog.id = "sheetDialog";
//     dialog.style.position = "fixed";
//     dialog.style.top = "50%";
//     dialog.style.left = "50%";
//     dialog.style.transform = "translate(-50%, -50%)";
//     dialog.style.backgroundColor = "#fff";
//     dialog.style.padding = "20px";
//     dialog.style.border = "1px solid #ccc";
//     dialog.style.zIndex = "10000";
//     dialog.style.boxShadow = "0 0 10px rgba(0,0,0,0.3)";
//     dialog.style.minWidth = "300px";
//     dialog.style.textAlign = "center";
//     dialog.style.borderRadius = "8px";

//     const label = document.createElement("label");
//     label.textContent = "Tabellenblatt auswählen:";
//     label.style.display = "block";
//     label.style.marginBottom = "10px";
//     label.style.fontWeight = "bold";
//     dialog.appendChild(label);

//     const select = document.createElement("select");
//     select.style.padding = "5px";
//     select.style.width = "100%";
//     sheetNames.forEach((name) => {
//       const option = document.createElement("option");
//       option.value = name;
//       option.textContent = name;
//       select.appendChild(option);
//     });
//     dialog.appendChild(select);

//     const buttonContainer = document.createElement("div");
//     buttonContainer.style.marginTop = "15px";
//     buttonContainer.style.display = "flex";
//     buttonContainer.style.justifyContent = "space-between";

//     const okBtn = document.createElement("button");
//     okBtn.textContent = "OK";
//     okBtn.style.padding = "6px 12px";

//     const cancelBtn = document.createElement("button");
//     cancelBtn.textContent = "Abbrechen";
//     cancelBtn.style.padding = "6px 12px";

//     buttonContainer.appendChild(okBtn);
//     buttonContainer.appendChild(cancelBtn);
//     dialog.appendChild(buttonContainer);

//     document.body.appendChild(dialog);

//     okBtn.addEventListener("click", () => {
//       const selected = select.value;
//       document.body.removeChild(dialog);
//       resolve(selected);
//     });

//     cancelBtn.addEventListener("click", () => {
//       document.body.removeChild(dialog);
//       resolve(null);
//     });
//   });
// }
async function showSheetSelectionDialog(sheetNames) {
  return new Promise((resolve) => {
    const dialog = document.createElement("div");
    dialog.id = "sheetDialog";
    dialog.style.position = "fixed";
    dialog.style.top = "50%";
    dialog.style.left = "50%";
    dialog.style.transform = "translate(-50%, -50%)";
    dialog.style.backgroundColor = "#fff";
    dialog.style.padding = "20px";
    dialog.style.border = "1px solid #ccc";
    dialog.style.zIndex = "10000";
    dialog.style.boxShadow = "0 0 10px rgba(0,0,0,0.3)";
    dialog.style.minWidth = "300px";
    dialog.style.textAlign = "center";
    dialog.style.borderRadius = "8px";

    const label = document.createElement("label");
    label.textContent = "Tabellenblatt auswählen:";
    label.style.display = "block";
    label.style.marginBottom = "10px";
    label.style.fontWeight = "bold";
    dialog.appendChild(label);

    const select = document.createElement("select");
    select.style.padding = "5px";
    select.style.width = "100%";
    sheetNames.forEach((name) => {
      const option = document.createElement("option");
      option.value = name;
      option.textContent = name;
      select.appendChild(option);
    });
    dialog.appendChild(select);

    const buttonContainer = document.createElement("div");
    buttonContainer.style.marginTop = "15px";
    buttonContainer.style.display = "flex";
    buttonContainer.style.justifyContent = "space-between";

    const okBtn = document.createElement("button");
    okBtn.textContent = "OK";
    okBtn.style.padding = "6px 12px";

    const cancelBtn = document.createElement("button");
    cancelBtn.textContent = "Abbrechen";
    cancelBtn.style.padding = "6px 12px";

    buttonContainer.appendChild(okBtn);
    buttonContainer.appendChild(cancelBtn);
    dialog.appendChild(buttonContainer);

    document.body.appendChild(dialog);

    okBtn.addEventListener("click", () => {
      const selected = select.value;
      document.body.removeChild(dialog);
      resolve(selected);
    });

    cancelBtn.addEventListener("click", () => {
      document.body.removeChild(dialog);
      resolve(null);
    });
  });
}



// function showMatchingUI(PortfoliosCols, tempTableCols, tempTableName) {
//   const container = document.getElementById("matchingContainer");
//   container.innerHTML = ""; // vorher leeren

//   const usedPortfoliosCols = new Set(); // verfolgt bereits genutzte Zuordnungen
//   const dropdowns = []; // Referenz auf alle Dropdowns

//   // Erzeuge für jede Spalte der externen Tabelle eine Zeile mit Dropdown
//   tempTableCols.forEach((sourceCol, index) => {
//     const row = document.createElement("div");
//     row.className = "match-row";
//     row.style.marginBottom = "8px";

//     const label = document.createElement("span");
//     label.textContent = sourceCol;
//     label.style.display = "inline-block";
//     label.style.width = "200px";

//     const select = document.createElement("select");
//     select.dataset.source = sourceCol;

//     const defaultOption = document.createElement("option");
//     defaultOption.value = "";
//     defaultOption.textContent = "Nicht zuordnen";
//     select.appendChild(defaultOption);

//     // Initiale Optionsliste für alle in Portfolios verfügbaren Spalten, ohne Reihung
//     // PortfoliosCols.forEach((portCol) => {
//     //   const option = document.createElement("option");
//     //   option.value = portCol;
//     //   option.textContent = portCol;
//     //   select.appendChild(option);
//     // });

//     // Initiale Optionsliste für alle in Portfolios verfügbaren Spalten, mit Reihung
//     const preferredOrder = [
//       "PROD_ID",
//       "ISSUER",
//       "COUPON",
//       "RATING",
//       "RATING_PROD",
//       "MATURITY",
//       "RANK",
//       "PRICE_BUY",
//       "TICKER",
//       "DESCRIPTION"
//     ];

//       // Erst gewünschte Reihenfolge einfügen (sofern vorhanden in der Tabelle)
//       preferredOrder
//         .filter(col => PortfoliosCols.includes(col))
//         .forEach((col) => {
//           const option = document.createElement("option");
//           option.value = col;
//           option.textContent = col;
//           select.appendChild(option);
//         });

//       // Trenner einfügen
//       const separator = document.createElement("option");
//       separator.disabled = true;
//       separator.textContent = "──────── Weitere Spalten ────────";
//       select.appendChild(separator);

//       // Alle restlichen Spalten alphabetisch anhängen (außerhalb der bevorzugten Liste)
//       PortfoliosCols
//         .filter(col => !preferredOrder.includes(col))
//         .sort()
//         .forEach((col) => {
//           const option = document.createElement("option");
//           option.value = col;
//           option.textContent = col;
//           select.appendChild(option);
//         });

//       // Beobachte Auswahländerungen
// select.addEventListener("change", () => {
//   // Update: verwendete Spaltenliste neu berechnen
//   usedPortfoliosCols.clear();
//   dropdowns.forEach((d) => {
//     if (d.value) usedPortfoliosCols.add(d.value);
//   });

//   // Alle Dropdowns neu rendern (außer das aktuelle)
//   dropdowns.forEach((d) => {
//     const currentValue = d.value;
//     const currentSource = d.dataset.source;

//     d.innerHTML = "";

//     // Standardoption
//     const defaultOption = document.createElement("option");
//     defaultOption.value = "";
//     defaultOption.textContent = "Nicht zuordnen";
//     d.appendChild(defaultOption);

//     // ➤ Zielspalten zuerst
//     preferredFields.forEach((field) => {
//       if (!usedPortfoliosCols.has(field) || field === currentValue) {
//         const option = document.createElement("option");
//         option.value = field;
//         option.textContent = field;
//         d.appendChild(option);
//       }
//     });

//     // ➤ Trennlinie
//     const separator = document.createElement("option");
//     separator.disabled = true;
//     separator.textContent = "———— Weitere Spalten ————";
//     d.appendChild(separator);

//     // ➤ Restliche Spalten
//     PortfoliosColumns.forEach((col) => {
//       if (
//         !preferredFields.includes(col) &&
//         (!usedPortfoliosCols.has(col) || col === currentValue)
//       ) {
//         const option = document.createElement("option");
//         option.value = col;
//         option.textContent = col;
//         d.appendChild(option);
//       }
//     });

//     d.value = currentValue; // aktuelle Auswahl wiederherstellen
//   });
// });
  

//     // // Beobachte Auswahländerungen
//     // select.addEventListener("change", () => {
//     //   // Update: verwendete Spaltenliste neu berechnen
//     //   usedPortfoliosCols.clear();
//     //   dropdowns.forEach((d) => {
//     //     if (d.value) usedPortfoliosCols.add(d.value);
//     //   });

//     //   // Alle Dropdowns neu rendern (außer das aktuelle)
//     //   dropdowns.forEach((d) => {
//     //     const currentValue = d.value;
//     //     const currentSource = d.dataset.source;

//     //     d.innerHTML = "";
//     //     const optionNone = document.createElement("option");
//     //     optionNone.value = "";
//     //     optionNone.textContent = "Nicht zuordnen";
//     //     d.appendChild(optionNone);

//     //     PortfoliosCols.forEach((portCol) => {
//     //       // Wenn Spalte schon zugeordnet, dann nur, wenn es die eigene ist
//     //       if (!usedPortfoliosCols.has(portCol) || portCol === currentValue) {
//     //         const option = document.createElement("option");
//     //         option.value = portCol;
//     //         option.textContent = portCol;
//     //         d.appendChild(option);
//     //       }
//     //     });

//     //     d.value = currentValue; // aktuelle Auswahl wiederherstellen
//     //   });
//     // });

//     row.appendChild(label);
//     row.appendChild(select);
//     container.appendChild(row);
//     dropdowns.push(select);
//   });

//   // Klick auf "Import starten"
// document.getElementById("submitMatchingBtn")?.addEventListener("click", async () => {
//   const columnMap = [];

//   dropdowns.forEach((select) => {
//     const from = select.dataset.source;
//     const to = select.value;
//     if (to) {
//       columnMap.push({ from, to });
//     }
//   });

//   if (columnMap.length === 0) {
//     alert("⚠️ Keine Zuordnungen vorgenommen.");
//     return;
//   }

//   // Spaltenzuordnung an den Main-Prozess schicken
//   window.api.send("import-matched-columns", {
//     sourceTable: tempTableName,
//     targetTable: "Portfolios",
//     columnMap,
//     additionalFields: {
//       port_name: tempTableName
//     }
//   });

//   // 🔍 Issuer-Check nach Spaltenzuordnung
//   try {
//     const result = await window.api.invoke("check-and-insert-issuers", {
//       tableName: tempTableName
//     });

//     if (result.success) {
//       console.log("✅ Issuer-Check abgeschlossen.");
//     } else {
//       console.error("❌ Fehler beim Issuer-Check:", result.error);
//       alert("❌ Fehler beim Issuer-Check: " + result.error);
//     }
//   } catch (err) {
//     console.error("❌ Unerwarteter Fehler beim Issuer-Check:", err);
//     alert("❌ Unerwarteter Fehler beim Issuer-Check: " + err.message);
//   }

//   // Produkt-Check nach Issuer-Check
//   try {
//     const result = await window.api.invoke("check-and-insert-products", {
//       tableName: tempTableName
//     });

//     if (result.success) {
//       console.log("✅ Produkt-Check abgeschlossen.");
//     } else {
//       console.error("❌ Fehler beim Produkt-Check:", result.error);
//       alert("❌ Fehler beim Produkt-Check: " + result.error);
//     }
//   } catch (err) {
//     console.error("❌ Unerwarteter Fehler beim Produkt-Check:", err);
//     alert("❌ Unerwarteter Fehler beim Produkt-Check: " + err.message);
//   }

//   // Portfolio speichern
//   try {
//     const result = await window.api.invoke("create-portfolio-from-import", {
//       tableName: tempTableName,
//       portfolioName: tempTableName // ← entspricht Excel-Datei
//     });

//     if (result.success) {
//       console.log("✅ Portfolio-Einträge erfolgreich erstellt.");
//       alert("✅ Portfolio erfolgreich befüllt.");
//     } else {
//       console.error("❌ Fehler beim Portfolio-Import:", result.error);
//       alert("❌ Fehler beim Portfolio-Import: " + result.error);
//     }
//   } catch (err) {
//     console.error("❌ Unerwarteter Fehler beim Portfolio-Import:", err);
//     alert("❌ Unerwarteter Fehler beim Portfolio-Import: " + err.message);
//   }

// });

// }

//Matching des zu importierenden Excels mit Datenbank für Import und Durchführen Import
// function showMatchingUI(PortfoliosCols, tempTableCols, tempTableName) {
//   const container = document.getElementById("matchingContainer");
//   container.innerHTML = "";

//   const preferredFields = [
//     "PROD_ID",
//     "ISSUER",
//     "COUPON",
//     "RATING",
//     "RATING_PROD",
//     "MATURITY",
//     "RANK",
//     "PRICE_BUY",
//     "TICKER",
//     "DESCRIPTION"
//   ];

//   const usedPortfoliosCols = new Set();
//   const dropdowns = [];

//   tempTableCols.forEach((sourceCol) => {
//     const row = document.createElement("div");
//     row.className = "match-row";
//     row.style.marginBottom = "8px";

//     const label = document.createElement("span");
//     label.textContent = sourceCol;
//     label.style.display = "inline-block";
//     label.style.width = "200px";

//     const select = document.createElement("select");
//     select.dataset.source = sourceCol;

//     // Funktion zum Rendern von Optionen
//     const renderOptions = (selectEl, currentValue = "") => {
//       selectEl.innerHTML = "";

//       const defaultOption = document.createElement("option");
//       defaultOption.value = "";
//       defaultOption.textContent = "Nicht zuordnen";
//       selectEl.appendChild(defaultOption);

//       preferredFields
//         .filter(field => PortfoliosCols.includes(field))
//         .forEach((field) => {
//           if (!usedPortfoliosCols.has(field) || field === currentValue) {
//             const option = document.createElement("option");
//             option.value = field;
//             option.textContent = field;
//             selectEl.appendChild(option);
//           }
//         });

//       const separator = document.createElement("option");
//       separator.disabled = true;
//       separator.textContent = "──────── Weitere Spalten ────────";
//       selectEl.appendChild(separator);

//       PortfoliosCols
//         .filter(col => !preferredFields.includes(col))
//         .sort()
//         .forEach((col) => {
//           if (!usedPortfoliosCols.has(col) || col === currentValue) {
//             const option = document.createElement("option");
//             option.value = col;
//             option.textContent = col;
//             selectEl.appendChild(option);
//           }
//         });

//       selectEl.value = currentValue;
//     };

//     renderOptions(select); // initiale Liste befüllen

//     select.addEventListener("change", () => {
//       usedPortfoliosCols.clear();
//       dropdowns.forEach((d) => {
//         if (d.value) usedPortfoliosCols.add(d.value);
//       });

//       dropdowns.forEach((d) => {
//         renderOptions(d, d.value);
//       });
//     });

//     row.appendChild(label);
//     row.appendChild(select);
//     container.appendChild(row);
//     dropdowns.push(select);
//   });
// }

  // Klick auf "Import starten"
//   document.getElementById("submitMatchingBtn")?.addEventListener("click", async () => {
//     const columnMap = [];

//     dropdowns.forEach((select) => {
//       const from = select.dataset.source;
//       const to = select.value;
//       if (to) {
//         columnMap.push({ from, to });
//       }
//     });

//     if (columnMap.length === 0) {
//       alert("⚠️ Keine Zuordnungen vorgenommen.");
//       return;
//     }

//     window.api.send("import-matched-columns", {
//       sourceTable: tempTableName,
//       targetTable: "Portfolios",
//       columnMap,
//       additionalFields: {
//         port_name: tempTableName
//       }
//     });

//     // ✅ Danach: Issuer → Produkt → Portfolio
//     try {
//       const issuerCheck = await window.api.invoke("check-and-insert-issuers", {
//         tableName: tempTableName
//       });
//       if (!issuerCheck.success) throw new Error(issuerCheck.error);

//       const prodCheck = await window.api.invoke("check-and-insert-products", {
//         tableName: tempTableName
//       });
//       if (!prodCheck.success) throw new Error(prodCheck.error);

//       const portfolioInsert = await window.api.invoke("create-portfolio-from-import", {
//         tableName: tempTableName,
//         portfolioName: tempTableName
//       });
//       if (!portfolioInsert.success) throw new Error(portfolioInsert.error);

//       alert("✅ Portfolio erfolgreich erstellt.");
//     } catch (err) {
//       console.error("❌ Fehler beim Importprozess:", err);
//       alert("❌ Fehler: " + err.message);
//     }
//   });
// }

function showMatchingUI(PortfoliosCols, tempTableCols, tempTableName) {
  const container = document.getElementById("matchingContainer");
  container.innerHTML = "";
  container.dataset.table = tempTableName; // ⬅️ wichtig für spätere Verarbeitung

  const preferredFields = [
    "PROD_ID",
    "ISSUER",
    "COUPON",
    "RATING",
    "RATING_PROD",
    "MATURITY",
    "RANK",
    "PRICE_BUY",
    "TICKER",
    "DESCRIPTION",
    "TENOR"
  ];

  const usedPortfoliosCols = new Set();
  const dropdowns = [];

  tempTableCols.forEach((sourceCol) => {
    const row = document.createElement("div");
    row.className = "match-row";
    row.style.marginBottom = "8px";

    const label = document.createElement("span");
    label.textContent = sourceCol;
    label.style.display = "inline-block";
    label.style.width = "200px";

    const select = document.createElement("select");
    select.dataset.source = sourceCol;

    const renderOptions = (selectEl, currentValue = "") => {
      selectEl.innerHTML = "";

      const defaultOption = document.createElement("option");
      defaultOption.value = "";
      defaultOption.textContent = "Nicht zuordnen";
      selectEl.appendChild(defaultOption);

      // bevorzugte Felder zuerst
      preferredFields
        .filter(field => PortfoliosCols.includes(field))
        .forEach((field) => {
          if (!usedPortfoliosCols.has(field) || field === currentValue) {
            const option = document.createElement("option");
            option.value = field;
            option.textContent = field;
            selectEl.appendChild(option);
          }
        });

      // Trennlinie
      const separator = document.createElement("option");
      separator.disabled = true;
      separator.textContent = "──────── Weitere Spalten ────────";
      selectEl.appendChild(separator);

      // restliche Spalten alphabetisch
      PortfoliosCols
        .filter(col => !preferredFields.includes(col))
        .sort()
        .forEach((col) => {
          if (!usedPortfoliosCols.has(col) || col === currentValue) {
            const option = document.createElement("option");
            option.value = col;
            option.textContent = col;
            selectEl.appendChild(option);
          }
        });

      selectEl.value = currentValue;
    };

    renderOptions(select);

    select.addEventListener("change", () => {
      usedPortfoliosCols.clear();
      dropdowns.forEach((d) => {
        if (d.value) usedPortfoliosCols.add(d.value);
      });

      dropdowns.forEach((d) => {
        renderOptions(d, d.value);
      });
    });

    row.appendChild(label);
    row.appendChild(select);
    container.appendChild(row);
    dropdowns.push(select);
  });
}


// export async function handleSubmitMatching() {
//   const dropdowns = Array.from(document.querySelectorAll(".match-row select"));
//   const columnMap = [];
//   console.log("🧭 Aktuelles Mapping:", columnMap);


//   dropdowns.forEach((select) => {
//     const from = select.dataset.source;
//     const to = select.value;
//     if (to) {
//       columnMap.push({ from: from.trim(), to: to.trim() });
//     }
//   });

//   if (columnMap.length === 0) {
//     alert("⚠️ Keine Zuordnungen vorgenommen.");
//     return;
//   }

//   const tempTableName = document.getElementById("matchingContainer")?.dataset.table;
//   if (!tempTableName) {
//     alert("❌ Fehler: Tabellenname nicht gefunden.");
//     return;
//   }

//   window.api.send("import-matched-columns", {
//     sourceTable: tempTableName,
//     targetTable: "DealsMain",
//     columnMap,
//     additionalFields: {
//       port_name: tempTableName
//     }
//   });

//   try {
//     const issuerCheck = await window.api.invoke("check-and-insert-issuers", {
//       tableName: tempTableName,
//       columnMap
//     });
//     if (!issuerCheck.success) throw new Error(issuerCheck.error);

//     const prodCheck = await window.api.invoke("check-and-insert-products", {
//       tableName: tempTableName,
//       columnMap
//     });
//     if (!prodCheck.success) throw new Error(prodCheck.error);

//     // const portfolioInsert = await window.api.invoke("create-portfolio-from-import", {
//     //   tableName: tempTableName,
//     //   portfolioName: tempTableName
//     // });
//     // if (!portfolioInsert.success) throw new Error(portfolioInsert.error);

//     const dealsInsert = await window.api.invoke("create-deals-from-import", {
//   tableName: tempTableName,
//   fileName: tempTableName, // Dateiname = Tabellenname = z. B. LLB_Graz_…
//   columnMap
// });
// if (!dealsInsert.success) throw new Error(dealsInsert.error);

//     alert("✅ Deals erfolgreich erstellt.");
//   } catch (err) {
//     console.error("❌ Fehler beim Importprozess:", err);
//     alert("❌ Fehler: " + err.message);
//   }
// }


export async function handleSubmitMatching() {
  const dropdowns = Array.from(document.querySelectorAll(".match-row select"));
  const columnMap = [];

  dropdowns.forEach((select) => {
    const from = select.dataset.source;
    const to = select.value;
    if (to) {
      columnMap.push({ from: from.trim(), to: to.trim() });
    }
  });

  if (columnMap.length === 0) {
    alert("⚠️ Keine Zuordnungen vorgenommen.");
    return;
  }

  const tempTableName = document.getElementById("matchingContainer")?.dataset.table;
  if (!tempTableName) {
    alert("❌ Fehler: Tabellenname nicht gefunden.");
    return;
  }

  window.api.send("import-matched-columns", {
    sourceTable: tempTableName,
    targetTable: "DealsMain",
    columnMap,
    additionalFields: {
      port_name: tempTableName
    }
  });

  try {
    // 🧱 ISSUER einfügen
    const issuerCheck = await window.api.invoke("check-and-insert-issuers", {
      tableName: tempTableName,
      columnMap
    });
    if (!issuerCheck.success) throw new Error(issuerCheck.error);

    // 📦 PRODUCTS einfügen
    const prodCheck = await window.api.invoke("check-and-insert-products", {
      tableName: tempTableName,
      columnMap
    });
    if (!prodCheck.success) throw new Error(prodCheck.error);

    // 💰 DEALS erstellen
    const dealsInsert = await window.api.invoke("create-deals-from-import", {
      tableName: tempTableName,
      fileName: tempTableName,
      columnMap
    });
    if (!dealsInsert.success) throw new Error(dealsInsert.error);

    // ✅ Zusammenfassung anzeigen
    let summary = `✅ ${prodCheck.insertedCount} neue Produkte importiert.\n`;
    summary += `✅ ${dealsInsert.insertedCount} Produkte in neues Portfolio eingefügt.\n`;

    if (prodCheck.rankWarnings && prodCheck.rankWarnings.length > 0) {
      summary += `\n⚠️ RANK manuell prüfen für:\n` + prodCheck.rankWarnings.join(", ");
    }

    alert(summary);
  } catch (err) {
    console.error("❌ Fehler beim Importprozess:", err);
    alert("❌ Fehler: " + err.message);
  }
}


// // UI zur Zuordnung von Import-Issuern mit DB-Issuern
// export async function showIssuerMatching(tempTableName) {
//   const result = await window.api.invoke('match-issuers', { tableName: tempTableName });

//   if (!result.success) {
//     alert("❌ Fehler beim Abrufen der Issuer-Daten: " + result.error);
//     return;
//   }

//   const { importedIssuers, existingIssuers } = result;

//   const container = document.getElementById("matchingContainer");
//   container.innerHTML = "<h3>Issuer-Zuordnung</h3>";

//   const issuerMappings = {};

//   importedIssuers.forEach((importedName) => {
//     const row = document.createElement("div");
//     row.style.marginBottom = "10px";

//     const label = document.createElement("span");
//     label.textContent = importedName;
//     label.style.display = "inline-block";
//     label.style.width = "250px";

//     const select = document.createElement("select");
//     const defaultOption = document.createElement("option");
//     defaultOption.value = "";
//     defaultOption.textContent = "➕ Neuen Issuer anlegen";
//     select.appendChild(defaultOption);

//     existingIssuers.forEach((issuer) => {
//       const option = document.createElement("option");
//       option.value = issuer.id;
//       option.textContent = `${issuer.name} (${issuer.ticker})`;
//       select.appendChild(option);
//     });

//     select.addEventListener("change", () => {
//       issuerMappings[importedName] = select.value;
//     });

//     row.appendChild(label);
//     row.appendChild(select);
//     container.appendChild(row);
//   });

//   // Button: Zuordnung speichern
//   const btn = document.createElement("button");
//   btn.textContent = "Issuer-Zuordnung speichern";
//   btn.style.marginTop = "20px";
//   btn.addEventListener("click", async () => {
//     const confirmed = confirm("Möchtest du die Zuordnungen jetzt anwenden?");
//     if (!confirmed) return;

//     const response = await window.api.invoke('apply-issuer-mapping', {
//       tableName: tempTableName,
//       mapping: issuerMappings
//     });

//     if (response.success) {
//       alert("✅ Issuer erfolgreich zugeordnet.");
//     } else {
//       alert("❌ Fehler beim Speichern: " + response.error);
//     }
//   });

//   container.appendChild(btn);
// }


// // ✅ [RENDERER] checkAndInsertProducts – ruft Produktprüfung auf und zeigt Ergebnis
// export async function checkAndInsertProducts(tempTableName) {
//   const result = await window.api.invoke('check-and-insert-products', { tableName: tempTableName });

//   if (result.success) {
//     alert("✅ Produkte verarbeitet:\n" + result.message);
//   } else {
//     alert("❌ Fehler beim Verarbeiten der Produkte: " + result.error);
//   }
// }


