# Daten-Update-Architektur (Konzept — noch nicht implementiert)

Status: **Analyse/Plan**. Vor Umsetzung: offene Infos vom Kollegen (u.a. thomasdev-Build-Layout, Makro/VBA-Bedarf).

## Grundprinzip (zwei Ebenen)
- `resources\templates\` = **read-only Vorlagen + `manifest.json`** (Soll-Schema-Versionen). Wird per App-Update ersetzt. KEINE Kundendaten, KEINE persönlichen Pfade.
- `userData\data\` (`AppData\Roaming\valueXpro\data`) = **Live-Dateien**. Werden nie blind überschrieben.
- `userData\valuexpro-settings.json` = User-/Runtime-State (Pfad-Overrides UNI_DATA/MARKET_DATA/ERSTE-Target, `dataSchema`-Ist-Versionen).
- `userData\cache\` = Cache (erste_cache.json).
- **App-Version (`package.json`) ≠ Daten-Schema-Version** (eigener Integer je Datensatz).

## Verhalten
- FIRST INSTALL → Template → `userData\data` kopieren; Ist := Soll.
- NORMALES APP-UPDATE (Ist == Soll) → Live-Datei NICHT anfassen.
- DATA-SCHEMA-UPDATE (Ist < Soll) → Backup, dann gezielte Migration(en); Ist := Soll.
- Downgrade (Ist > Soll) → nicht migrieren, nur warnen.

## Versionsspeicher
- Soll: `resources\templates\manifest.json`, z.B. `{ "UNI_DATA": 4, "MARKET_DATA": 1, "UNI_DB": 12 }`.
- Ist (Excel): `valuexpro-settings.json → dataSchema: { UNI_DATA: 3, ... }`.
- Ist (DB): **`PRAGMA user_version`** in UNI.db (SQLite-eingebaut).

## Migrationsmechanismus
- Beim Main-Start, vor DB-Init/erstem Worker-Lauf: `ensureDataReady()` je Datensatz (Node orchestriert: Detection, Copy, Backup, Version schreiben).
- Excel-Strukturänderungen via Python-Worker (openpyxl, `load_workbook(keep_vba=True)`) — neuer Script-Identifier `migrate_data --dataset UNI_DATA --from 3 --to 4`.
- UNI.db-Migrationen (Phase 2) im Node/SQLite-Stil (Muster: `db.schema.js`, non-destruktives ALTER, "ignore duplicate column") über `PRAGMA user_version`.
- Erkennung: Integer-Vergleich Ist vs Soll (primär); optional strukturelle Probe als Sicherheitsnetz.

## Versionierte Migrationen (additiv, non-destruktiv)
- `DataExcel/migrations/uni_data/v3_to_v4.py` -> `def migrate(path): ...` (z.B. Spalte ISSUER_COUNTRY, Sheet CONFIG, Named Range, Formel — ohne Nutzerdaten zu löschen), `v4_to_v5.py`, ...
- Runner wendet lückenlos Ist→...→Soll an.
- **Ankerpunkt der "erwarteten Struktur" = `DataExcel/import_config.py → SHEET_SCHEMA/SHEETS`.** Jede Änderung dort = Schema-Bump + Migration.
- Reales erstes Beispiel: unsere **COUNTRY-Spalte** = v3→v4.

## Backups
- Vor jeder Migrationskette: Live → `userData\data\backups\UNI_DATA_<ISO>_v<Ist>.xlsm`. Letzte N behalten (z.B. 10), rotieren.
- DB analog, aber NUR bei Strukturmigration (DB groß): `...\backups\UNI_<ISO>_v<Ist>.db`.
- FIRST INSTALL: kein Backup (keine Live-Datei).

## Build: mitliefern vs. nie überschreiben
- Mitliefern (`resources\templates\`, read-only): aktuelle UNI_DATA.xlsm, MARKET_DATA.xlsm, HISTORIC_DATA.xlsm, OFFERS_DATA.xlsm, Seed-UNI.db, ERSTE_RATES*.xlsx, `manifest.json`.
- Nie überschreiben (Live, `userData\data\`): dieselben Dateien — nur First-Install-Copy + gezielte Migration.
- NICHT mehr mitliefern: Runtime/User/Junk aus `files\` (erste_target.json, erste_cache.json, *.bak wie UNI.db.pre_fsmap_bak, datierte Kopien UNI_DATA_*.xlsm, Outputs AGG_Timeseries/PORT_HIST_METRICS/PortfolioHistoryData, Dev-Artefakte inspect_all_tables.py/db_schema_overview.txt/Screenshot.PNG, Archiv\, Risk\).
- Build-Config: `extraResources` von kuratiertem `build/templates`-Ordner → `resources\templates` (Whitelist statt `from:"files"`). `build.files` schließt `files/**` bereits aus dem asar aus.

## Relevante Ist-Code-Stellen
- Pfad-/Settings-Logik: `src/main/main.path.js` (getFilesBaseDir, getEffectiveExcelPath, read/writeSettings, getExcelEnvOverrides).
- ERSTE-Target (liegt FALSCH in files/, muss nach userData): `src/main/ipc/handlers/python.handlers.js:13-48` (_ersteTargetFile, read/writeErsteTarget, _defaultErsteTarget, clearErsteTarget) + IPC `erste:get/select/reset-target` (100-125).
- CUSTOMER-SETUP Data Sources (excelInputs, korrekt in userData): `dataSourcesPanel.js` + `excel.handlers.js:16-39` (data-inputs:get-paths/select/reset -> setExcelOverride).
- DB-Migrationsmuster (Vorlage): `src/main/services/db.service.js` ensure* + `src/main/services/db.schema.js`.
- Build-Config: `electron_app/package.json → build.files / build.extraResources`.

## Phasen (klein halten)
- Phase 0 (Vorbedingung): Pfade/ERSTE-Target/Cache → userData; Build kuratieren. Ohne das greift "nie überschreiben" nicht.
- Phase 1: Versions-Trennung + manifest.json + First-Install-Copy + Detection + Backup + Runner-Skelett + eine reale Migration (COUNTRY = v3→v4) für UNI_DATA.
- Phase 2: UNI.db → userData\data + `PRAGMA user_version`-Migrationen (größer, getrennt).

## Caveat
- Additive Excel-Änderungen (Spalten, Sheets, Named Ranges, Zell-Formeln) gehen mit openpyxl + keep_vba=True ohne Datenverlust.
- VBA-Makro-CODE ändern kann openpyxl NICHT → xlwings (Excel installiert) oder neue Makro-Vorlage, in die Daten migriert werden. Für "neues/geändertes Makro" Sonderpfad einplanen.
