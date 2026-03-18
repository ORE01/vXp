⚠️ UI NEVER READS RATES DIRECTLY
UI CONTRACT = EUSW FORMAT
RATES MUST PASS ADAPTER


✅ Flow:
DB → DataPump → IPC → Router → Handler → State → UI

SQLite → rendererDataPump → IPC (preload bridge) → installReceivers → dataRouter → ratesHandlers → AppState → Charts/UI (IR.js)


Runtime Data Flow

① DB LAYER (Main Process): SQLite Daten werden gelesen und an den Renderer gesendet.

   Dateien
      src/main/services/db.service.js
      src/main/main.orchestrator.js
      src/main/rendererDataPump.js
   Wichtige Funktionen

      rendererDataPump.js
         sendAllTablesToRenderer()
         fetchDataAndSendEvent()
         safeSend('RATESData')
   Ergebnis
      SQLite → Electron IPC Event

② IPC TRANSPORT LAYER: Der Prozessübergang zwischen Main Process und Renderer Process.

   Dateien
      src/preload/index.js
      src/renderer/core/ipc/installReceivers.js
      src/renderer/core/state/dataRouter.js
   Ablauf
      preload/index.js
         api.receive()
      installReceivers.js
         route('RATESData')
      dataRouter.js
         routeTableData()  (daten zu handler)
   Ergebnis
      IPC Event → Feature Handler

③ FEATURE HANDLER LAYER: Hier betreten die Daten die Renderer Domain.

   Datei
      src/renderer/features/MARKET_DATA/INTEREST_RATES/ratesHandlers.js
   Funktion
      handleRATESData()
   Aufgabe
      Raw Market Data → AppState

④ STATE LAYER: Zentraler Store für Renderer-Daten.
   Dateien
      src/renderer/core/state/AppState.js
      src/renderer/core/state/marketDataStore.js
   Wichtige Funktionen
      setRATESData()
      setRatesActive()
      getRatesActive()
   Ergebnis
      Market Data → zentraler Renderer State

⑤ UI LAYER: Die UI liest ausschließlich aus dem State.

   Dateien
      src/renderer/features/MARKET_DATA/INTEREST_RATES/IR.js
      src/renderer/charts/LineChart.js
      index.html
   Funktionen
      renderIRPanel()
      renderIRLineChart()
   Ergebnis
      State → UI Rendering



APP BOOTSTRAP

bootstrap.js
→ initApp.js
→ bootstrapIPC
→ bootstrapStores
→ bootstrapHandlers
→ bootstrapBindings
→ bootstrapUIBasics

SYSTEM READY


RUNTIME DATA FLOW

SQLite
→ rendererDataPump
→ IPC
→ installReceivers
→ dataRouter
→ ratesHandlers
→ AppState
→ IR.js
→ Charts/UI

RÜCKWEG:

UI → IPC → Main Handler → DB
DB → DataPump → IPC → Router → Handler → State → UI

ScenarioPanel.js → Renderer Event → IPC invoke (preload bridge) → ipcMain handler → SQLite (RATES_ACTIVE update) 

→ refreshTable 

→ rendererDataPump → IPC Event (RATES_ACTIVEData) → installReceivers → dataRouter → ratesHandlers → AppState → IR.js → Charts/UI



