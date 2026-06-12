# ARCHITECTURE.md — DataPump → State → Render Flow

## Grundregel

Der `dataRouter` routet nur.

Er darf keine fachliche Verarbeitung, kein Store-Merging und keine Render-Logik enthalten.

Der korrekte Flow ist:

```text
DataPump Channel
→ dataRouter.js
→ Feature Handler
→ appState Store Setter
→ Feature Renderer
→ UI
```

## Verantwortlichkeiten

### 1. `rendererDataPump.js`

Liest Tabellen aus der Datenbank und sendet sie als Channel an den Renderer.

Beispiel:

```text
MarketVaR_Product
→ MarketVaR_ProductData
```

### 2. `installReceivers.js`

Empfängt IPC/DataPump Events und gibt sie an den zentralen Router weiter.

Keine fachliche Logik.

### 3. `dataRouter.js`

Mappt nur Channel auf Handler.

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

Warum falsch?

Weil der Router sonst beginnt, Feature-spezifische Store-Logik zu kennen. Dann verteilt sich der Datenfluss auf mehrere Orte.

## Handler-Regel

Der Feature Handler ist verantwortlich für:

```text
1. Input validieren
2. Store setzen
3. Render-Funktion aufrufen
```

Beispiel:

```js
export function handleMVaRProductPLData(receivedData) {
  const rows = Array.isArray(receivedData) ? receivedData : [];

  if (typeof appState.setMvarProductData !== 'function') {
    throw new Error('[MVaR ProductPL] Missing store: appState.setMvarProductData');
  }

  appState.setMvarProductData(rows);
  renderMvarProductPLPanel();
}
```

## Store-Regel

Stores speichern Daten und bieten Getter/Filter an.

Beispiel:

```text
marketRiskStore.js
- setMvarProductData(rows)
- getMvarProductData(context)
```

Der Store rendert nichts.

Der Store kennt keine DOM-Elemente.

Der Store startet keine Recalculations.

## Render-Regel

Renderer lesen nur aus `appState`.

Beispiel:

```js
export function renderMvarProductPLPanel() {
  const context = getCurrentMvarContext(appState);
  const rows = appState.getMvarProductData(context);

  renderTable(rows);
  renderChart(rows);
}
```

Renderer dürfen keine DB-Tabellen direkt laden.

Renderer dürfen keine Store-Daten heimlich verändern.

## Pflichtfunktionen vs optionale Funktionen

Für Kern-Datenflüsse keine stillen Fehler.

Richtig:

```js
if (typeof appState.setMvarProductData !== 'function') {
  throw new Error('[MVaR ProductPL] Missing store: appState.setMvarProductData');
}
```

Optional chaining ist nur für echte optionale Features erlaubt.

In Kern-Flows vermeiden:

```js
appState.setMvarProductData?.(rows);
handlers.handleMVaRProductPLData?.(rows);
```

Warum?

Weil sonst ein fehlender Handler oder Store still verschluckt wird.

## Replace vs Upsert

Runtime-/Result-Tabellen, die bei Recalculation neu erzeugt oder ersetzt werden, müssen im Frontend-Store ebenfalls ersetzt werden.

Beispiele:

```text
MarketVaR_Product
MarketVaR_FactorPL
MarketVaR_Dist
MarketVaR
```

Richtig:

```js
function setMvarProductData(rows) {
  appState.mvarProductDataAll = Array.isArray(rows) ? rows : [];
}
```

Gefährlich:

```js
appState.mvarProductDataAll = appState.mvarProductDataAll.concat(rows);
```

Oder Upsert ohne Delete.

Warum gefährlich?

Weil alte Rows im UI bleiben können, obwohl sie in der Datenbank nicht mehr existieren.

## Naming-Regel

Channel Name folgt der Tabelle:

```text
MarketVaR_ProductData
```

Feature Handler benennt die fachliche Ansicht:

```text
handleMVaRProductPLData
renderMvarProductPLPanel
```

Panel-Datei:

```text
src/renderer/features/ANALYSE_PORTFOLIO/marketRisk/mvar/mvarProductPLPanel.js
```

## Zielbild für MarketVaR_Product

```text
MarketVaR_ProductData
→ dataRouter.js
→ handleMVaRProductPLData(rows)
→ appState.setMvarProductData(rows)
→ renderMvarProductPLPanel()
→ appState.getMvarProductData(currentContext)
→ Product Table + Product Chart
```

## Anti-Patterns

Nicht erlaubt:

```text
- Store-Write im dataRouter
- DOM-Zugriff im Store
- DB-Zugriff im Renderer
- stilles Optional Chaining bei Pflichtfunktionen
- concat/upsert für vollständig neu berechnete Result-Tabellen
- Product-Panel-Code in SummaryMarketRisk.js
- mehrere Namen für denselben Flow
```

## Kurzregel

```text
Router routet.
Handler verarbeitet.
Store speichert.
Renderer rendert.
```