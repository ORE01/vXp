const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { spawn } = require('child_process');
const electron = require('electron');
const app = electron.app || electron.remote.app;
require('dotenv').config();


const userName = 'Ronny' //'Thomas'


// function getDevelopmentPythonPath() {
    
//     if (userName === 'Ronny') {
//         return {
//             executable: 'C:\\Python312\\python.exe',
//             scriptPath: 'C:/Users/Ronald/riskApp/PycharmProjects/Risk/main.py'
//         };
//     } else if (userName === 'Thomas') {
//         return {
//             executable: 'C:/Users/wendlert/Desktop/valueXpro_dev/resources/bin/main/main.exe',
//             scriptPath: 'C:/Users/wendlert/Desktop/valueXpro_dev/resources/bin/main/main.exe'
//         };
//     } else {
//         throw new Error('Unknown user name');
//     }
// }

function getDevelopmentPythonPath() {
    if (userName === 'Ronny') {
        return {
            executable: 'C:\\Python312\\python.exe',
            scriptPath: 'C:/Users/Ronald/riskApp/PycharmProjects/Risk/main.py'
        };
    } else if (userName === 'Thomas') {
        // Thomas nutzt immer die main.exe, aber in unterschiedlichen Pfaden
        return {
            executable: 'C:/Users/wendlert/Desktop/valueXpro_dev/resources/bin/main/main.exe'
        };
    } else {
        throw new Error('Unknown user name');
    }
}


function getDatabasePath() {
    
    if (userName === 'Ronny') {
        return 'C:/Users/Ronald/riskApp/electron_app/files/UNI.db';
    } else if (userName === 'Thomas') {
        return 'C:/Users/wendlert/Desktop/valueXpro_dev/resources/app.asar.unpacked/files/UNI.db';
    } else {
        throw new Error('Unknown user name');
    }
}

module.exports = { getDevelopmentPythonPath, getDatabasePath };