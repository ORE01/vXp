// Funktion ohne Auswahl Tabellenblatt
// export async function startOfferImport() {
//   try {
//     const result = await window.api.invoke('start-offer-import');

//     if (!result.success) {
//       alert("❌ Fehler beim Import: " + result.error);
//       return;
//     }

//     const { tempTableName, prodAllColumns, tempTableColumns } = result;

//     alert(`✅ Datei erfolgreich geladen: "${tempTableName}".\nBitte Spalten zuordnen.`);

//     // Öffne Matching-UI (als nächster Schritt)
//     showMatchingUI(prodAllColumns, tempTableColumns, tempTableName);

//   } catch (err) {
//     console.error("❌ Unerwarteter Fehler beim Import:", err);
//     alert("❌ Unerwarteter Fehler beim Import: " + err.message);
//   }
// }

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

    // 3. Gewähltes Sheet importieren
    const importResult = await window.api.invoke('import-excel-offer-sheet', {
      filePath,
      sheetName: selectedSheet
    });

    if (!importResult.success) {
      alert("❌ Fehler beim Import: " + importResult.error);
      return;
    }

    const { tempTableName, prodAllColumns, tempTableColumns } = importResult;

    alert(`✅ Datei erfolgreich geladen: "${tempTableName}".\nBitte Spalten zuordnen.`);
    showMatchingUI(prodAllColumns, tempTableColumns, tempTableName);

  } catch (err) {
    console.error("❌ Unerwarteter Fehler beim Import:", err);
    alert("❌ Unerwarteter Fehler beim Import: " + err.message);
  }
}

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


function showMatchingUI(prodAllCols, tempTableCols, tempTableName) {
  const container = document.getElementById("matchingContainer");
  container.innerHTML = ""; // vorher leeren

  const useprodAllCols = new Set(); // verfolgt bereits genutzte Zuordnungen
  const dropdowns = []; // Referenz auf alle Dropdowns

  // Erzeuge für jede Spalte der externen Tabelle eine Zeile mit Dropdown
  tempTableCols.forEach((sourceCol, index) => {
    const row = document.createElement("div");
    row.className = "match-row";
    row.style.marginBottom = "8px";

    const label = document.createElement("span");
    label.textContent = sourceCol;
    label.style.display = "inline-block";
    label.style.width = "200px";

    const select = document.createElement("select");
    select.dataset.source = sourceCol;

    const defaultOption = document.createElement("option");
    defaultOption.value = "";
    defaultOption.textContent = "Nicht zuordnen";
    select.appendChild(defaultOption);

    // Initiale Optionsliste
    prodAllCols.forEach((dealCol) => {
      const option = document.createElement("option");
      option.value = dealCol;
      option.textContent = dealCol;
      select.appendChild(option);
    });

    // Beobachte Auswahländerungen
    select.addEventListener("change", () => {
      // Update: verwendete Spaltenliste neu berechnen
      usedProdAllCols.clear();
      dropdowns.forEach((d) => {
        if (d.value) usedProdAllCols.add(d.value);
      });

      // Alle Dropdowns neu rendern (außer das aktuelle)
      dropdowns.forEach((d) => {
        const currentValue = d.value;
        const currentSource = d.dataset.source;

        d.innerHTML = "";
        const optionNone = document.createElement("option");
        optionNone.value = "";
        optionNone.textContent = "Nicht zuordnen";
        d.appendChild(optionNone);

        prodAllCols.forEach((dealCol) => {
          // Wenn Spalte schon zugeordnet, dann nur, wenn es die eigene ist
          if (!usedProdAllCols.has(dealCol) || dealCol === currentValue) {
            const option = document.createElement("option");
            option.value = dealCol;
            option.textContent = dealCol;
            d.appendChild(option);
          }
        });

        d.value = currentValue; // aktuelle Auswahl wiederherstellen
      });
    });

    row.appendChild(label);
    row.appendChild(select);
    container.appendChild(row);
    dropdowns.push(select);
  });

  // Klick auf "Import starten"
  document.getElementById("submitMatchingBtn")?.addEventListener("click", () => {
    const columnMap = [];

    dropdowns.forEach((select) => {
      const from = select.dataset.source;
      const to = select.value;
      if (to) {
        columnMap.push({ from, to });
      }
    });

    if (columnMap.length === 0) {
      alert("⚠️ Keine Zuordnungen vorgenommen.");
      return;
    }

    window.api.send("import-matched-columns", {
      sourceTable: tempTableName,
      targetTable: "ProdAll",
      columnMap,
      additionalFields: {
        port_name: tempTableName
      }
    });
  });
}


window.api.receive("import-matched-columns-complete", (response) => {
  if (response.success) {
    alert(response.message); // Zeigt genau das, was aus dem Main kommt
    document.getElementById("submitMatchingBtn").style.display = "none";
  } else {
    alert("❌ Fehler beim Import: " + (response.error || "Unbekannter Fehler"));
  }
});