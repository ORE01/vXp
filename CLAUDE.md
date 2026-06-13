# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Mandatory Working Rules

- Do not modify, create, delete, move, rename, commit, or push any files unless I explicitly approve the exact action.
- Default mode is analysis-only.
- Even when I ask for a task to be done, first provide an analysis and implementation plan. Do not apply changes until I explicitly approve the proposed file changes.
- When I ask for help, first analyze the problem and explain what you found.
- Before making any file change, always show:
  - the exact file path
  - the exact function/block to change
  - what will be changed
  - why it is necessary
  - possible risks
- Wait for my explicit approval before applying changes.
- Never commit anything unless I explicitly say: "commit this".
- Never push anything.
- Do not run destructive commands.
- Do not create new architecture files, documentation files, or helper files unless I explicitly request them.


## Commands

```bash
npm start           # NODE_ENV=development, runs IPC audit, then launches Electron
npm run start:electron  # Launch Electron without IPC audit
npm run ipc:audit   # Verify IPC channel allowlists are in sync
npm run build       # Package with electron-builder → dist/ (NSIS installer)
```

No automated test framework exists. Quality assurance is manual.

## Architecture Overview

valueXpro is a Windows desktop app (Electron + Python) for pricing and risk analysis of structured financial products (IR, credit, vol). The Electron shell handles UI and orchestration; Python does all numerical work via a long-running worker process.

### Bootstrap Sequence

1. **Main process** (`src/main/index.js`): initialises SQLite, creates BrowserWindow with preload, registers all IPC handlers via `src/main/ipc/ipc.registry.js`.
2. **Preload** (`src/preload/index.js`): exposes `window.api` (allowlist-gated `send`/`invoke`/`receive`/`once`). Any new IPC channel must be added to this allowlist.
3. **Renderer** (`src/renderer/renderer.js`): initialises stores, installs IPC receivers, sets up lazy panel rendering. Entry point for all UI logic.

### Python Integration

`src/main/services/python.service.js` spawns a single persistent Python worker via `child_process.spawn()`. Executable path is environment-dependent:
- `development` → `C:\Python312\python.exe main.py --worker`
- `production` → `process.resourcesPath/bin/main/main.exe`

**Call protocol (renderer → Python → renderer):**
1. Renderer: `api.send('start-py-<script>', { ...args })`
2. Main builds `{"argv": ["scriptIdentifier", ...args]}` → writes to Python stdin
3. Python emits progress to stderr: `{"progress": 0–100, "provider": "...", "message": "..."}`
4. Python emits final result to stdout: `___RESULT___{"status":"ok","result":{...}}`
5. Main forwards events back: `py-progress`, `project-finished` (or `*-error`)
6. Timeout: 5 minutes (configurable in `src/main/ipc/main.gateway.js`)

After Python completes, handlers typically call `refreshTable(tableName)` which re-fetches the SQLite table and pushes it to the renderer.

Key `start-py-*` channels: `fairValue`, `MVaR`, `CVaR`, `excel`, `swaption`, `volcube`, `ml`, `cspar`, `matchColumns`, `historicData`. Also `price-product` for single product valuation.

### IPC Structure

All IPC handlers are registered in `src/main/ipc/ipc.registry.js` (~20 handler groups). New handler files go in `src/main/ipc/handlers/`. After adding channels, run `npm run ipc:audit` to update the audit log and verify the preload allowlist.

### State Management (Renderer)

`src/renderer/core/state/` holds all client-side state:
- `AppState.js` — central singleton, owns all stores
- `stores/` — one file per domain: `portfolioDataStore`, `portfolioRiskSensitivitiesStore`, `marketRiskStore`, `creditRiskStore`, `marketDataStore`, `productsStore`, `nameListsStore`, `customerReportsStore`, `uiStateStore`

Incoming table data flows: IPC event → `installReceivers.js` → `dataUpdatePipeline.js` → `dataRouter.js` → correct store method.

Orchestration logic (e.g. triggering cascading UI updates after a data change) lives in `src/renderer/core/orchestration/`.

### Feature Modules

`src/renderer/features/` — one folder per product area:
- `ANALYSE_PORTFOLIO/` — MVaR, CVaR, scenario analysis
- `MARKET_DATA/` — rate curves, vol surfaces, historical data, LSTM forecasts
- `portfolio/` — trade table, risk sensitivities
- `products/` — product catalog, canonical product view
- `OFFERS/` — import and column-matching of customer offer files
- `CUSTOMER/` — customer master, report generation
- `REPORTS/` — PDF/Excel customer reports
- `UPDATES/` — bulk data import workflows
- `COMPARE_PORTFOLIOS/` — scenario comparison

### Database

`better-sqlite3` singleton in `src/main/services/db.service.js`, re-exported via `src/main/ipc/main.gateway.js`. DB file: `files/UNI.db` (dev) / `process.resourcesPath/files/UNI.db` (prod). Path is passed to Python via the `UNI_DB_PATH` env variable.

## Key Conventions

- **Adding a new Python script call:** add channel to preload allowlist → add handler in `src/main/ipc/handlers/python.handlers.js` → register in `ipc.registry.js` → run `npm run ipc:audit`.
- **Adding a new data table to the renderer:** add a store method → register a route in `dataRouter.js`.
- **Panel lazy-loading:** panels register an `onPanelOpen` hook in `renderer.js`; heavy initialisation runs only on first open.
- **Environment modes:** `development`, `productiontest`, `thomasdev`, `production` — Python executable path and DB path differ per mode. Check `python.service.js` before assuming paths.
