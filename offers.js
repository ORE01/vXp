export async function startOfferImport() {
  try {
    const result = await window.api.invoke('start-offer-import');

    if (!result.success) {
      alert("❌ Fehler beim Import: " + result.error);
      return;
    }

    const { tempTableName, dealsMainColumns, tempTableColumns } = result;

    alert(`✅ Datei erfolgreich geladen: "${tempTableName}".\nBitte Spalten zuordnen.`);

    // Öffne Matching-UI (als nächster Schritt)
    showMatchingUI(dealsMainColumns, tempTableColumns, tempTableName);

  } catch (err) {
    console.error("❌ Unerwarteter Fehler beim Import:", err);
    alert("❌ Unerwarteter Fehler beim Import: " + err.message);
  }
}

function showMatchingUI(dealsMainCols, tempTableCols, tempTableName) {
  const container = document.getElementById("matchingContainer");
  container.innerHTML = ""; // vorher leeren

  const usedDealsMainCols = new Set(); // verfolgt bereits genutzte Zuordnungen
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
    dealsMainCols.forEach((dealCol) => {
      const option = document.createElement("option");
      option.value = dealCol;
      option.textContent = dealCol;
      select.appendChild(option);
    });

    // Beobachte Auswahländerungen
    select.addEventListener("change", () => {
      // Update: verwendete Spaltenliste neu berechnen
      usedDealsMainCols.clear();
      dropdowns.forEach((d) => {
        if (d.value) usedDealsMainCols.add(d.value);
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

        dealsMainCols.forEach((dealCol) => {
          // Wenn Spalte schon zugeordnet, dann nur, wenn es die eigene ist
          if (!usedDealsMainCols.has(dealCol) || dealCol === currentValue) {
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
      targetTable: "DealsMain",
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