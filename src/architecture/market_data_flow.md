⚠️ CORE PRINCIPLE

UI NEVER READS DB DIRECTLY
UI CONTRACT = ADAPTED DATA (EUSW FORMAT)

ALL DATA FLOWS THROUGH:
DB → DataPump → IPC → Router → Handler → State → UI

🔵 RUNTIME DATA FLOW (READ)

SQLite
→ rendererDataPump
→ IPC (preload bridge)
→ installReceivers
→ dataRouter
→ ratesHandlers
→ AppState
→ Charts / UI (IR.js)

🔴 RUNTIME DATA FLOW (WRITE / SCENARIOS)

UI (ScenarioPanel.js / ScenarioBuilder.js)
→ window.api.invoke / send
→ preload bridge
→ ipcMain handler (ratesActive.handlers.js)
→ SQLite (RATES_SCENARIO_DATA / RATES_ACTIVE)

→ refreshTable()

→ rendererDataPump
→ IPC Event

→ installReceivers
→ dataRouter
→ ratesHandlers
→ AppState
→ UI

🔬 SYSTEM LAYERS

① DB LAYER (Main Process)

Dateien
src/main/services/db.service.js
src/main/main.gateway.js
src/main/rendererDataPump.js

Wichtige Funktionen (rendererDataPump.js)

* sendAllTablesToRenderer()
* fetchDataAndSendEvent()
* safeSend('RATESData')
* safeSend('RATES_ACTIVEData')

Ergebnis
SQLite → IPC Event (Renderer)

② IPC / COMMAND LAYER (Main Process)

Dateien
src/preload/index.js
src/main/ipc/registerIpc.js
src/main/ipc/handlers/ratesActive.handlers.js

Aufgabe
Renderer Aktionen → DB Operationen

Handler (ratesActive.handlers.js)

WRITE

* rates:set-active-scenario
* rates:create-scenario

READ (on demand)

* rates:get-base-curve
* rates:get-scenario
* rates:get-scenarios
* rates:get-available-curves

③ IPC TRANSPORT LAYER (Renderer)

Dateien
src/preload/index.js
src/renderer/core/ipc/installReceivers.js
src/renderer/core/state/dataRouter.js

Ablauf
preload → api.receive / invoke / send
installReceivers → route('RATESData')
dataRouter → routeTableData()

Ergebnis
IPC Event → Feature Handler

④ FEATURE HANDLER LAYER

Datei
src/renderer/features/MARKET_DATA/INTEREST_RATES/interestRateCurveHandler.js

Funktionen

* handleRATESData()
* handleRATES_ACTIVEData()

Aufgabe
Raw DB Data → AppState

⑤ STATE LAYER

Dateien
src/renderer/core/state/AppState.js
src/renderer/core/state/marketDataStore.js

Funktionen

* setRATESData()
* setRatesActive()
* getRatesActive()
* getRATESData()

Ergebnis
Single Source of Truth im Renderer

⑥ UI LAYER

Dateien
src/renderer/features/MARKET_DATA/INTEREST_RATES/IR.js
src/renderer/features/MARKET_DATA/scenarios/ScenarioPanel.js
src/renderer/features/MARKET_DATA/scenarios/ScenarioBuilder.js
src/renderer/charts/LineChart.js
index.html

Funktionen

* renderInterestRateCurvePanel()
* renderIRLineChart()
* renderScenarioPanel()
* initCreateScenarioPanel()

Ergebnis
State → UI Rendering

🔁 FULL LOOP

READ
SQLite → DataPump → IPC → Router → Handler → State → UI

WRITE (Scenario)
UI → IPC → Handler → DB → refresh → DataPump → IPC → Router → Handler → State → UI

🚀 APP BOOTSTRAP

bootstrap.js
→ initApp.js
→ bootstrapIPC
→ bootstrapStores
→ bootstrapHandlers
→ bootstrapBindings
→ bootstrapUIBasics

SYSTEM READY

💣 KLARHEIT

ratesActive.handlers.js = COMMAND LAYER
NICHT Teil des passiven Datenflusses

READ = Event-driven
WRITE = Command-driven



🔵 READ FLOW (links → rechts)



┌────────────┐
│  SQLite DB │
└─────┬──────┘
      │
      ▼
┌──────────────┐
│ DataPump     │  (rendererDataPump.js)
└─────┬────────┘
      │ IPC Event
      ▼
┌──────────────┐
│ IPC Bridge   │  (preload)
└─────┬────────┘
      ▼
┌──────────────┐
│ Receivers    │  (installReceivers.js)
└─────┬────────┘
      ▼
┌──────────────┐
│ DataRouter   │
└─────┬────────┘
      ▼
┌──────────────┐
│ Handlers     │  (interestRateCurveHandler.js)
└─────┬────────┘
      ▼
┌──────────────┐
│ AppState     │
└─────┬────────┘
      ▼
┌──────────────┐
│ UI / Charts  │  (IR.js)
└──────────────┘
🔴 WRITE FLOW (User Aktion → zurück)

┌──────────────┐
│ UI           │  (ScenarioPanel / Builder)
└─────┬────────┘
      │ invoke/send
      ▼
┌──────────────┐
│ IPC Bridge   │  (preload)
└─────┬────────┘
      ▼
┌──────────────────────────────┐
│ ratesActive.handlers.js      │  🔥 COMMAND LAYER
└─────┬────────────────────────┘
      ▼
┌──────────────┐
│ db.service   │
└─────┬────────┘
      ▼
┌──────────────┐
│ SQLite       │
└─────┬────────┘
      │
      ▼
  refreshTable()
      │
      ▼
┌──────────────┐
│ DataPump     │
└─────┬────────┘
      ▼
(→ zurück in READ FLOW)



bootstrapHandlers.js import hinzufügen

csActive.Handlers.js anlegen


dataRouter.js: erweitern

AppState.js: erweitern set..; get..

ipc.allowlist.js: erweitern


🔹 1. csActive.handlers.js (Main – COMMAND LAYER)
🔹 2. ipc.allowlist.js
🔹 3. rendererDataPump.js (Main → Renderer Transport, generisch)
🔹 4. preload/index.js (IPC Bridge)
🔹 5. installReceivers.js ⚠️ (bindet Channels + Einstieg Renderer)
🔹 6. dataRouter.js (DISPATCH)
🔹 7. bootstrapHandlers.js (liefert CS Handler)
🔹 8. renderer.js ⚠️
  • destructuring
  • Übergabe an bootstrapIPC
🔹 9. csHandlers.js (Renderer – DATA → STATE)
🔹 10. marketDataStore.js (STATE LAYER)

