// src/main/services/python.service.js
'use strict';

const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { app } = require('electron');

// ✅ Source of truth für DB-Pfad kommt aus Electron (dev + productiontest = DEV-DB)
const { getDatabasePath } = require('../main.path');

let proc = null;
let activeResolve = null;
let activeReject = null;


function resolvePythonExecutableAndArgs() {

  const env = process.env.NODE_ENV
    ? process.env.NODE_ENV.trim().toLowerCase()
    : 'production';

  let pythonExecutable;
  let pythonArgs = ['-u', '--worker'];

  if (env === 'development') {

    pythonExecutable = 'C:\\Python312\\python.exe';

    const scriptPath = 'C:/Users/Ronald/riskApp/PycharmProjects/Risk/main.py';

    // python.exe main.py --worker
    pythonArgs.unshift(scriptPath);

  } 
  else if (env === 'productiontest') {

    // compiled python exe
    pythonExecutable = path.normalize(
      'C:/Users/Ronald/riskApp/PycharmProjects/Risk/dist/main/main.exe'
    );

    // main.exe --worker

  } 
  else if (env === 'thomasdev') {

    pythonExecutable =
      'C:/Users/wendlert/Desktop/valueXpro_dev/resources/bin/main/main.exe';

  } 
  else {

    pythonExecutable = path.join(
      process.resourcesPath,
      'bin',
      'main',
      'main.exe'
    );

  }

  return {
    pythonExecutable,
    pythonArgs
  };

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
  timeoutMs = 5 * 60 * 1000,
}) {

  const { pythonExecutable, pythonArgs } = resolvePythonExecutableAndArgs(scriptIdentifier, args);

  return new Promise((resolve, reject) => {

    activeResolve = resolve;
    activeReject = reject;

    let scriptOutput = '';
    let stdoutBuffer = '';
    let stderrBuffer = '';

    try {

      const envName = (process.env.NODE_ENV || '').trim().toLowerCase();

      // 🔧 DEV MODE: Python Worker neu starten damit Codeänderungen greifen
      if (envName === 'development' && proc) {
        proc.kill();
        proc = null;
      }

      const execDir = path.dirname(pythonExecutable);

      let cwdToUse;

      if (envName === 'development') {
        cwdToUse = path.dirname(pythonArgs[0]);
      } else if (envName === 'productiontest') {
        cwdToUse = path.resolve(execDir, '..', '..');
      } else {
        cwdToUse = execDir;
      }

      if (!proc) {

        const dbPathForPython = getDatabasePath();

        const tSpawn = Date.now();
        console.log("SPAWN START:", tSpawn);

        proc = spawn(pythonExecutable, pythonArgs, {
          windowsHide: true,
          cwd: cwdToUse,
          env: {
            ...process.env,
            UNI_DB_PATH: dbPathForPython,
          },
        });

        console.log("SPAWN CALLED after", Date.now() - tSpawn, "ms");

        // ---------- ERROR ----------
        proc.on('error', (err) => {
          if (activeReject) {
            activeReject(new Error(`Python start failed: ${err.message}`));
          }
        });

        // ---------- STDOUT ----------
        proc.stdout.on('data', (data) => {

          const chunk = data.toString();
          stdoutBuffer += chunk;

          let lines = stdoutBuffer.split(/\r?\n/);
          stdoutBuffer = lines.pop();

          for (const line of lines) {

            const text = line.trim();
            if (!text) continue;

            const match = text.match(/___RESULT___({[\s\S]*})/);

            if (match) {
              try {
                const parsed = JSON.parse(match[1]);

                clearTimeout(timeout);

                if (activeResolve) activeResolve(parsed);

              } catch (err) {
                if (activeReject) activeReject(err);
              }

              // IMPORTANT:
              // ___RESULT___ is transport JSON, not a log line.
              // Do not forward it to onStdout, otherwise large payloads like cashflows
              // flood the Electron log/console.
              continue;
            }

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

  // 👇 TRY PARSE PROGRESS JSON
  try {
    const parsed = JSON.parse(text);

    if (parsed && typeof parsed.progress !== 'undefined') {
      if (typeof onProgress === 'function') {
        onProgress(parsed); // 🔥 HIER PASSIERTS
      }
      continue; // wichtig → nicht als stderr behandeln
    }

  } catch (e) {
    // kein JSON → normal weiter
  }

  if (typeof onStderr === 'function') onStderr(text);
}
        });

      }

      // ---------- JOB SENDEN ----------

      const payload = JSON.stringify({
        argv: [scriptIdentifier, ...args]
      });

      proc.stdin.write(payload + '\n');

      // ---------- TIMEOUT ----------

      const timeout = setTimeout(() => {
        if (activeReject) {
          activeReject(new Error(`Python timeout after ${timeoutMs}ms`));
        }
      }, timeoutMs);

    } catch (err) {

      reject(err);

    }

  });

}

module.exports = { startPythonScript };

