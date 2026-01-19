src/
  main/        ← Electron Main Process (App, Window, IPC, FS)
  preload/     ← contextBridge, sichere APIs
  renderer/    ← UI, Panels, AppState
python/        ← Rechen-Engine (extern, bewusst getrennt)
assets/
dist/