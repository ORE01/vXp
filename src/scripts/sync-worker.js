'use strict';

// Spiegelt den frischen PyInstaller-Build (PycharmProjects/Risk/dist/main) SAUBER
// nach electron_app/bin/main (das electron-builder als extraResources packt).
//
// Warum: Wird bin/main nur "drueberkopiert" statt gespiegelt, bleiben Alt-Dateien
// eines frueheren Builds im _internal liegen. Ein gemischtes alt+neu _internal
// (z.B. alte VCRUNTIME140.dll) laesst numpys C-API brechen
// ("numpy.core.multiarray failed to import") -> Worker crasht -> App-Timeout.
//
// robocopy /MIR spiegelt exakt: kopiert Neues UND loescht ueberzaehlige Alt-Dateien.

const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');

const appRoot = path.resolve(__dirname, '..', '..'); // electron_app
const src = path.resolve(appRoot, '..', 'PycharmProjects', 'Risk', 'dist', 'main');
const dst = path.resolve(appRoot, 'bin', 'main');

if (!fs.existsSync(path.join(src, 'main.exe'))) {
  console.error(
    `[sync:worker] FEHLER: kein Build gefunden unter\n  ${src}\n` +
    `Bitte zuerst PyInstaller bauen (NICHT aus dem venv):\n` +
    `  cd ..\\PycharmProjects\\Risk\n` +
    `  C:\\Python312\\python.exe -m PyInstaller main.spec --clean --noconfirm`
  );
  process.exit(1);
}

fs.mkdirSync(dst, { recursive: true });

console.log(`[sync:worker] Spiegele (robocopy /MIR)\n  ${src}\n  -> ${dst}`);
const r = spawnSync(
  'robocopy',
  [src, dst, '/MIR', '/NFL', '/NDL', '/NJH', '/NJS', '/R:1', '/W:1'],
  { stdio: 'inherit' }
);

// robocopy Exit-Codes: 0-7 = OK (7 = Dateien kopiert + Extras entfernt), >=8 = Fehler.
const code = typeof r.status === 'number' ? r.status : 8;
if (code >= 8) {
  console.error(`[sync:worker] robocopy FEHLGESCHLAGEN (exit ${code})`);
  process.exit(1);
}

// --- Pflicht-Check: die scipy-Sobol-Datendatei MUSS im gebundelten _internal liegen,
//     sonst faellt scipy.stats.qmc.Sobol (scrambled Sobol / Importance Sampling) in der
//     EXE aus und die CreditVaR-Ergebnisse weichen von der unverpackten Version ab.
//     Fehlt sie -> Build HART abbrechen (kein stiller Fehlbuild). ---
const sobolNpz = path.join(dst, '_internal', 'scipy', 'stats', '_sobol_direction_numbers.npz');
if (!fs.existsSync(sobolNpz)) {
  console.error(
    `[sync:worker] ABBRUCH: fehlende Datendatei im Build:\n  ${sobolNpz}\n` +
    `scipy.stats.qmc.Sobol (scrambled Sobol / Importance Sampling) wuerde in der EXE ` +
    `fehlschlagen. Bitte main.spec pruefen (collect_data_files('scipy')) und PyInstaller ` +
    `neu bauen:\n  cd ..\\PycharmProjects\\Risk\n` +
    `  C:\\Python312\\python.exe -m PyInstaller main.spec --clean --noconfirm`
  );
  process.exit(1);
}
console.log(`[sync:worker] OK: ${path.relative(dst, sobolNpz)} vorhanden (scrambled Sobol lauffaehig).`);

console.log(
  `[sync:worker] OK (robocopy exit ${code}) - bin/main ist jetzt ein exaktes ` +
  `Spiegelbild von dist/main (keine Alt-Dateien).`
);
process.exit(0);
