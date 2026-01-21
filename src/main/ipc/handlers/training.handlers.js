// src/main/ipc/handlers/training.handlers.js
'use strict';

const { spawn } = require('child_process');

module.exports = function registerTrainingHandlers({ ipcMain }) {
  if (!ipcMain) throw new Error('[training.handlers] ipcMain missing');

  // Airbag gegen doppelte Registrierung
  try { ipcMain.removeAllListeners('start-training'); } catch {}

  ipcMain.on('start-training', (event) => {
    // TODO: hier muss ein echter Script-Pfad rein (aktuell Placeholder)
    const pythonProcess = spawn('python', ['path/to/your_script.py']);

    pythonProcess.stdout.on('data', (data) => {
      try {
        const message = JSON.parse(data.toString());
        if (message.progress) {
          event.sender.send('training-progress', message.progress);
        }
      } catch (err) {
        console.error('[training] Error parsing progress data:', err);
      }
    });

    pythonProcess.stderr.on('data', (data) => {
      console.error(`[training] Python error: ${data}`);
    });

    pythonProcess.on('close', (code) => {
      event.sender.send('training-complete', { success: code === 0 });
    });
  });
};
