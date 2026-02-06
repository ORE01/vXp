// src/main/services/python.service.js
'use strict';

const path = require('path');
const { spawn } = require('child_process');
const { app } = require('electron');

// ✅ Source of truth für DB-Pfad kommt aus Electron (dev + productiontest = DEV-DB)
const { getDatabasePath } = require('../main_path');

function resolvePythonExecutableAndArgs(scriptIdentifier, args = []) {
  const env = process.env.NODE_ENV
    ? process.env.NODE_ENV.trim().toLowerCase()
    : 'production';

  let pythonExecutable;
  let pythonArgs = [scriptIdentifier, ...args]; // ✅ NICHT ändern

  if (env === 'development') {
    pythonExecutable = 'C:\\Python312\\python.exe';

    const scriptPath = 'C:/Users/Ronald/riskApp/PycharmProjects/Risk/main.py';
    pythonArgs.unshift(scriptPath);
  } else if (env === 'productiontest') {
    // ✅ DEV-like, aber mit lokaler EXE
    pythonExecutable = path.normalize(
      'C:/Users/Ronald/riskApp/PycharmProjects/Risk/dist/main/main.exe'
    );
  } else if (env === 'thomasdev') {
    pythonExecutable =
      'C:/Users/wendlert/Desktop/valueXpro_dev/resources/bin/main/main.exe';
  } else {
    pythonExecutable = path.join(process.resourcesPath, 'bin', 'main', 'main.exe');
  }

  return { pythonExecutable, pythonArgs };
}

/**
 * Start python/exe and stream:
 * - progress JSON -> onProgress(msg)
 * - stdout lines -> onStdout(line)
 * - stderr lines -> onStderr(line)
 * Resolves with parsed ___RESULT___ JSON.
 */
function startPythonScript({
  scriptIdentifier,
  args = [],
  onProgress,
  onStdout,
  onStderr,
  timeoutMs = 5 * 60 * 1000, // 5 min
}) {
  const { pythonExecutable, pythonArgs } = resolvePythonExecutableAndArgs(scriptIdentifier, args);

  return new Promise((resolve, reject) => {
    let scriptOutput = '';
    let stdoutBuffer = '';
    let stderrBuffer = '';

    let proc;
    try {
      const envName = (process.env.NODE_ENV || '').trim().toLowerCase();
      const execDir = path.dirname(pythonExecutable);

      // ✅ cwd stabil pro Modus
      let cwdToUse;
      if (envName === 'development') {
        // pythonArgs[0] == main.py → Risk-Root
        cwdToUse = path.dirname(pythonArgs[0]);
      } else if (envName === 'productiontest') {
        // EXE liegt in Risk/dist/main → Risk-Root = 2 Ebenen hoch
        cwdToUse = path.resolve(execDir, '..', '..');
      } else {
        // packaged + thomasdev: exe-Ordner
        cwdToUse = execDir;
      }

      // ✅ DB-Pfad immer aus Electron (damit compiled main.exe in ungepackter Electron-App DEV-DB findet)
      const dbPathForPython = getDatabasePath();

      proc = spawn(pythonExecutable, pythonArgs, {
        windowsHide: true,
        cwd: cwdToUse,
        env: {
          ...process.env,
          UNI_DB_PATH: dbPathForPython,
        },
      });
    } catch (e) {
      return reject(e);
    }

    // ✅ wichtig: wenn spawn fehlschlägt (Pfad falsch etc.), kommt sonst nie "close"
    proc.on('error', (err) => {
      reject(new Error(`Failed to start Python process: ${err.message} | exec=${pythonExecutable}`));
    });

    // ✅ Timeout: nie wieder "steckt"
    const timer = setTimeout(() => {
      try { proc.kill('SIGKILL'); } catch {}
      reject(new Error(`Python timeout after ${timeoutMs}ms | exec=${pythonExecutable} args=${pythonArgs.join(' ')}`));
    }, timeoutMs);

    // ---------- STDOUT ----------
    proc.stdout.on('data', (data) => {
      const chunk = data.toString();
      stdoutBuffer += chunk;

      let lines = stdoutBuffer.split(/\r?\n/);
      stdoutBuffer = lines.pop(); // unvollständige Zeile bleibt

      for (const line of lines) {
        const text = line.trim();
        if (!text) continue;

        // progress json?
        try {
          const msg = JSON.parse(text);
          if (msg && typeof msg.progress !== 'undefined') {
            if (typeof onProgress === 'function') onProgress(msg);
            continue;
          }
        } catch {}

        scriptOutput += text + '\n';
        if (typeof onStdout === 'function') onStdout(text);
      }
    });

    // ---------- STDERR ----------
    proc.stderr.on('data', (data) => {
      const chunk = data.toString();
      stderrBuffer += chunk;

      let lines = stderrBuffer.split(/\r?\n/);
      stderrBuffer = lines.pop();

      for (const line of lines) {
        const text = line.trim();
        if (!text) continue;

        // progress json on stderr?
        if (text[0] === '{') {
          try {
            const msg = JSON.parse(text);
            if (msg && typeof msg.progress !== 'undefined') {
              if (typeof onProgress === 'function') onProgress(msg);
              continue;
            }
          } catch {}
        }

        if (typeof onStderr === 'function') onStderr(text);
      }
    });

    // ---------- CLOSE ----------
    proc.on('close', (code) => {
      clearTimeout(timer);

      // ✅ Restbuffer flushen (sonst fehlt RESULT oft!)
      if (stdoutBuffer.trim()) {
        const rest = stdoutBuffer.trim();
        try {
          const msg = JSON.parse(rest);
          if (msg && typeof msg.progress !== 'undefined') {
            if (typeof onProgress === 'function') onProgress(msg);
          } else {
            scriptOutput += rest + '\n';
            if (typeof onStdout === 'function') onStdout(rest);
          }
        } catch {
          scriptOutput += rest + '\n';
          if (typeof onStdout === 'function') onStdout(rest);
        }
      }

      if (stderrBuffer.trim()) {
        const restErr = stderrBuffer.trim();
        scriptOutput += '\n[STDERR]\n' + restErr + '\n';
        if (typeof onStderr === 'function') onStderr(restErr);
      }

      const match = scriptOutput.match(/___RESULT___({[\s\S]*})/);
      if (match) {
        try {
          resolve(JSON.parse(match[1]));
        } catch (err) {
          reject(new Error(`Failed to parse extracted JSON result. Snippet=${match[1].slice(0, 400)}...`));
        }
      } else {
        reject(new Error(`No ___RESULT___ found. Exit code=${code}. Output snippet=${scriptOutput.slice(0, 800)}`));
      }
    });
  });
}

module.exports = { startPythonScript };

