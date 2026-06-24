# ARCHITECTURE.md — DataPump → State → Render Flow

## Core Rule

```text
Router routet.
Handler verarbeitet.
Store speichert.
Renderer rendert.
```

Kein Layer übernimmt Aufgaben eines anderen Layers.

---

## Standard Flow

```text
DB / View
→ rendererDataPump.js
→ IPC Event
→ installReceivers.js
→ dataRouter.js
→ Feature Handler
→ appState Store Setter
→ Feature Renderer
→ UI
```

Beispiel:

```text
v_MVAR_MODEL_SELECTION_APPData
→ dataRouter.js
→ handleMvarModelSelectionAppData(rows)
→ appState.setMvarModelSelectionAppRows(rows)
→ renderMvarModelSelectionPanel()
→ UI
```

---

## Layer Responsibilities

### rendererDataPump.js

Liest Tabellen/Views aus SQLite und sendet sie als Data-Channel.

```text
Table/View: MarketVaR_Product
Channel:    MarketVaR_ProductData
```

Keine UI-Logik. Keine Transformation außer Daten senden.

---

### installReceivers.js

Empfängt DataPump/IPC Events und gibt sie an `dataRouter.js` weiter.

Keine fachliche Logik. Kein Store-Write. Kein Render.

---

### dataRouter.js

Der Router mapped nur Channel auf Handler.

Richtig:

```js
case 'MarketVaR_ProductData':
  return handlers.handleMVaRProductPLData(rows);
```

Falsch:

```js
case 'MarketVaR_ProductData':
  appState.setMvarProductData(rows);
  return handlers.handleMVaRProductPLData(rows);
```

Der Router darf keine Feature-Store-Logik kennen.

---

### Feature Handler

Der Handler macht drei Dinge:

```text
1. Daten validieren/normalisieren
2. Store setzen
3. Renderer triggern
```

Beispiel:

```js
export function handleMVaRProductPLData(rows) {
  const safeRows = Array.isArray(rows) ? rows : [];

  if (typeof appState.setMvarProductData !== 'function') {
    throw new Error('[MVaR ProductPL] Missing appState.setMvarProductData');
  }

  appState.setMvarProductData(safeRows);
  renderMvarProductPLPanel();
}
```

---

### Store

Stores speichern Daten und bieten Getter/Filter.

Beispiel:

```js
setMvarProductData(rows)
getMvarProductData(context)
```

Stores dürfen nicht:

* rendern
* DOM lesen/schreiben
* DB laden
* Recalculations starten

---

### Renderer

Renderer lesen aus `appState` und bauen UI.

```js
export function renderMvarProductPLPanel() {
  const rows = appState.getMvarProductData(getCurrentMvarContext());
  renderTable(rows);
  renderChart(rows);
}
```

Renderer dürfen nicht direkt SQLite lesen.

---

## Pflichtfunktionen

Für Kern-Flows keine stillen Fehler.

Richtig:

```js
if (typeof appState.setMvarProductData !== 'function') {
  throw new Error('[MVaR ProductPL] Missing store setter');
}
```

Falsch:

```js
appState.setMvarProductData?.(rows);
handlers.handleMVaRProductPLData?.(rows);
```

Optional chaining nur für echte optionale Features verwenden.

---

## Replace vs Upsert im Frontend

Runtime-/Result-Tabellen werden bei Recalc neu erzeugt.
Der Store muss sie daher ersetzen, nicht mergen.

Richtig:

```js
appState.mvarProductDataAll = Array.isArray(rows) ? rows : [];
```

Falsch:

```js
appState.mvarProductDataAll = appState.mvarProductDataAll.concat(rows);
```

Gilt besonders für:

```text
MarketVaR
MarketVaR_Dist
MarketVaR_Product
MarketVaR_FactorPL
```

Sonst bleiben alte Rows im UI hängen.

---

## Naming

Channel folgt Tabelle/View:

```text
MarketVaR_ProductData
v_MVAR_MODEL_SELECTION_APPData
```

Handler beschreibt fachliche Ansicht:

```text
handleMVaRProductPLData
handleMvarModelSelectionAppData
```

Renderer beschreibt Panel:

```text
renderMvarProductPLPanel
renderMvarModelSelectionPanel
```

---

## Anti-Patterns

Nicht erlaubt:

```text
- Store-Write im dataRouter
- Render-Logik im dataRouter
- DOM-Zugriff im Store
- DB-Zugriff im Renderer
- stilles Optional Chaining bei Pflichtfunktionen
- concat/upsert für Recalc-Result-Tabellen
- gleiche Daten unter mehreren Namen führen
- Feature-Code in falschen Summary-Dateien verstecken
```

## Kurzregel

```text
DataPump sendet.
Receiver empfängt.
Router routet.
Handler verarbeitet.
Store speichert.
Renderer rendert.
```
