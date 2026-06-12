PYTHON/execution/receivers.js

Diese Datei empfängt Python-Completion-Events.

Wichtige Events:

py-fairValue-complete
project-finished
py-mvar-complete
py-cvar-complete

Für FairValue ist wichtig:

py-fairValue-complete
→ handleFairValueComplete(data)
→ fetch.fetchAndUpdateFairValueData(port_name)

Außerdem feuert das System zusätzlich manchmal:

project-finished py-fairValue

Deshalb gibt es einen Duplicate-Guard:

_lastFairValueRefreshAt

Damit wird verhindert, dass FairValue zweimal refreshed.

Wichtig:

receivers.js darf fetch.fetchAndUpdatePortfolioRiskSensitivitiesData() nicht zusätzlich parallel zu fetchAndUpdateFairValueData() aufrufen.

Der korrekte Ablauf ist:

receivers.js
→ fetchAndUpdateFairValueData(port_name)

und fetchAndUpdateFairValueData() kümmert sich intern sequenziell um Portfolios und PortfolioRiskSensitivities.

PYTHON/execution/fetch.js

Diese Datei steuert die Renderer-seitigen Table-Reloads nach Python-Success.

Wichtigste Funktion:

fetchAndUpdateFairValueData(port_name)

Korrekte Reihenfolge:

1. PortfoliosData anfordern
2. PortfoliosData empfangen
3. appState.setAllPortfolioData(...)
4. appState.setSelectedPortTableName(port_name)
5. appState.setSelectedDealsTableName(port_name)
6. PortfolioRiskSensitivitiesData anfordern
7. PortfolioRiskSensitivitiesData empfangen
8. handlePortfolioRiskSensitivitiesData(rows)
9. erst danach appState.updatePortDataTable(filteredData)

Warum diese Reihenfolge wichtig ist:

appState.updatePortDataTable(filteredData) triggert den portfolioUIOrchestrator.

Der portfolioUIOrchestrator ruft PV01, CPV01 und Vega Handler auf.

Wenn der Store zu diesem Zeitpunkt noch leer ist, loggen die Handler:

storeRows: 0
availablePorts: []
riskTypes: []

Deshalb muss PortfolioRiskSensitivities vorher im Store sein.

PYTHON/execution/index.js

Diese Datei verdrahtet Router, Fetch und Receiver.

Wichtig:

handlePortfolioRiskSensitivitiesData muss an createPythonExecutionFetch(...) übergeben werden.

Sonst zeigt der Log:

hasHandlePortfolioRiskSensitivitiesData: false

Korrekt ist:

hasHandlePortfolioRiskSensitivitiesData: true

Dafür muss in PYTHON/execution/index.js importiert werden:

import { handlePortfolioRiskSensitivitiesData } from '../../src/renderer/features/ANALYSE_PORTFOLIO/marketRisk/sensitivities/portfolioRiskSensitivitiesHandler.js';

und dann in den Fetch-Context:

const fetch = createPythonExecutionFetch({
  ...ctx,
  appState,
  once,
  handlePortfolioRiskSensitivitiesData,
});
3. Main Process / IPC / DataPump
src/main/ipc/ipc.registry.js

Der db Handler muss refreshTable bekommen.

Falsch:

{
  name: 'db',
  register: require('./handlers/db.handlers'),
  getCtx: ({ ipcMain }) => ({ ipcMain }),
}

Richtig:

{
  name: 'db',
  register: require('./handlers/db.handlers'),
  getCtx: ({ ipcMain, refreshTable }) => ({
    ipcMain,
    refreshTable,
  }),
}
src/main/ipc/handlers/db.handlers.js

Diese Datei darf fetch-table-data nicht blockieren.

Der Fehler war:

Legacy DB IPC is disabled

und fetch-table-data wurde nur mit Fehler beantwortet.

Richtig:

fetch-table-data
→ refreshTable(tableName)

Der aktive Handler muss sinngemäß so laufen:

ipcMain.on('fetch-table-data', (_event, tableName) => {
  const safeTableName = String(tableName || '').trim();

  if (!safeTableName) {
    console.warn('[DB HANDLER] fetch-table-data skipped: tableName missing');
    return;
  }

  console.log('[DB HANDLER] fetch-table-data', {
    tableName: safeTableName,
  });

  refreshTable(safeTableName);
});
src/main/rendererDataPump.js

Diese Datei lädt Tabellen aus der DB und sendet sie an den Renderer.

Wichtige Funktion:

refreshTable(tableName)

Für:

PortfolioRiskSensitivities

muss sie senden:

PortfolioRiskSensitivitiesData

Ablauf:

refreshTable('PortfolioRiskSensitivities')
→ resolved = 'PortfolioRiskSensitivities'
→ eventIdentifier = 'PortfolioRiskSensitivitiesData'
→ fetchDataAndSendEvent(...)
→ win.webContents.send('PortfolioRiskSensitivitiesData', rows)

PortfolioRiskSensitivities darf nicht in excluded stehen.

4. Renderer Store / Handler / UI
src/renderer/features/ANALYSE_PORTFOLIO/marketRisk/sensitivities/portfolioRiskSensitivitiesHandler.js

Diese Datei empfängt die frischen Rows aus PortfolioRiskSensitivitiesData.

Verantwortung:

Rows entgegennehmen
→ safeRows bilden
→ portfolioRiskSensitivitiesStore.setRows(safeRows)

Diese Datei soll nicht selbst komplex rendern.

src/renderer/core/state/portfolioRiskSensitivitiesStore.js

Der Store hält alle PortfolioRiskSensitivities.

Wichtige Methoden:

setRows(rows)
getRows()
getPorts()
getRiskTypes()
getByPortfolio(portName)
getByPortfolioAndType(portName, riskType)
getTotalByPortfolioAndType(portName, riskType)

Der Store muss Portfolionamen normalisieren:

Portfolios_UNI → UNI

und RiskTypes uppercase behandeln:

PV01
CPV01
VEGA_PARALLEL

Nach setRows() soll ein Event ausgelöst werden:

portfolio-risk-sensitivities-data-refreshed
src/renderer/features/ANALYSE_PORTFOLIO/marketRisk/marketRiskRefresh.js

Diese Datei ist der UI-Orchestrator für Market Risk Sensitivities.

Sie hört auf:

portfolio-risk-sensitivities-data-refreshed
portfolio-context-changed

Dann ruft sie:

handleIRSensData(appState, port);
handleCSSensData(appState, port);
handleVegaSensData(appState, port);

Tabs dürfen nur zentral initialisiert werden, nicht in jedem Handler.

PV01 / CPV01 / Vega Handler

Dateien:

portfolioPV01Handler.js
portfolioCPV01Handler.js
portfolioVegaHandler.js

Jeder Handler muss denselben Vertrag erfüllen:

1. selectedPort bestimmen
2. Rows aus portfolioRiskSensitivitiesStore holen
3. Wenn keine Rows: eigene Details + eigenen Chart clearen
4. Wenn Rows: berechnen
5. KPI aktualisieren
6. Details mounten
7. Chart nach Mount rendern

Wichtig:

Keine Handler dürfen initMarketRiskSensitivityTabs() aufrufen.

Wichtig:

Wenn keine Daten vorhanden sind, darf der Handler nicht einfach return machen. Er muss alte Anzeige löschen.

Beispiel:

clearPV01Details();
clearPV01Chart();
return;
5. Debug-Logs: Richtiger Ablauf

Nach einer erfolgreichen FairValue-Berechnung müssen diese Logs in etwa so erscheinen:

[PY RECEIVER] py-fairValue complete -> refresh start
[PY RECEIVER] calling fetchAndUpdateFairValueData
[FETCH] fetchAndUpdateFairValueData START { hasHandlePortfolioRiskSensitivitiesData: true }
[FETCH] PortfoliosData received in fetchAndUpdateFairValueData
[FETCH] Portfolio context set before PRS reload
[FETCH] requesting PortfolioRiskSensitivitiesData
[DB HANDLER] fetch-table-data { tableName: 'PortfolioRiskSensitivities' }
[FETCH] PortfolioRiskSensitivitiesData received after python run
[PRS HANDLER] PortfolioRiskSensitivitiesData handled
[PRS STORE] rows replaced
[marketRiskRefresh] portfolio-risk-sensitivities-data-refreshed received
[IR SENS] selected portfolio resolved { storeRows: > 0 }
[CP SENS] selected portfolio resolved { storeRows: > 0 }
[VEGA SENS] selected portfolio resolved { storeRows: > 0 }
6. Typische Fehlerbilder
Fehlerbild A
hasHandlePortfolioRiskSensitivitiesData: false

Ursache:

handlePortfolioRiskSensitivitiesData wurde nicht in PYTHON/execution/index.js an createPythonExecutionFetch(...) übergeben.

Fix:

Handler importieren und in den Fetch-Context geben.

Fehlerbild B
[FETCH] requesting PortfolioRiskSensitivitiesData

aber kein:

[FETCH] PortfolioRiskSensitivitiesData received after python run

Ursache:

fetch-table-data erreicht den DataPump nicht oder wird blockiert.

Fix:

src/main/ipc/handlers/db.handlers.js prüfen.
fetch-table-data muss refreshTable(tableName) aufrufen.

Fehlerbild C
storeRows: 0
availablePorts: []
riskTypes: []

Ursache:

PortfolioRiskSensitivitiesStore ist leer.

Mögliche Gründe:

PortfolioRiskSensitivitiesData wurde nicht geladen
handlePortfolioRiskSensitivitiesData fehlt im ctx
db.handlers.js blockiert fetch-table-data
DataPump sendet anderes Event
Python schreibt in falsche DB
Tabelle ist leer
Fehlerbild D
storeRows: 39
availablePorts: ['CANONICAL_TEST']
selectedPort: 'UNI'

Ursache:

Store enthält noch alte Daten von anderem Portfolio.

Fix:

Nach jeder Python-Berechnung PortfolioRiskSensitivities neu laden.
Nicht nur UI neu rendern.

Fehlerbild E
ReferenceError: clearPV01Details is not defined

Ursache:

clearPV01Details() wurde innerhalb einer anderen Funktion definiert oder fehlt.

Fix:

clearPV01Details() und clearPV01Chart() müssen auf Top-Level in portfolioPV01Handler.js stehen.

7. Kernregel für zukünftige Erweiterungen

Wenn Python eine Tabelle schreibt, muss der Completion-Receiver einen Refresh-Contract auslösen.

Nicht:

Python fertig
→ UI refresh

sondern:

Python fertig
→ betroffene Tabellen neu laden
→ Store aktualisieren
→ Store Event
→ UI refresh

Für FairValue / Portfolio Valuation mindestens:

Portfolios
PortfolioRiskSensitivities

Für MVaR mindestens:

MarketVaR
MarketVaR_Dist
PortfolioRiskSensitivities, falls Sensitivities sichtbar/abhängig sind
8. Merksatz

UI darf nie aus der DB direkt lesen.
Python darf nie Renderer-Stores direkt aktualisieren.
Nach Python-Success werden Read-Model-Tabellen neu geladen.
Stores werden über <TableName>Data aktualisiert.
UI rendert nur aus Stor