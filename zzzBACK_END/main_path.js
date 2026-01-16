const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { spawn } = require('child_process');
const electron = require('electron');
const app = electron.app || electron.remote.app;
require('dotenv').config();


const userName = 'Thomas' //'Thomas'



function getDatabasePath() {
    const env = process.env.NODE_ENV || 'production'; // Fallback zu 'production'

    if (env === 'development') {
        return 'C:/Users/Ronald/riskApp/electron_app/files/UNI.db';
    } else if (env === 'thomasdev') {
        return 'C:/Users/wendlert/Desktop/valueXpro_dev/resources/app.asar.unpacked/files/UNI.db';
    } else {
        throw new Error(`Unknown environment: ${env}`);
    }
}

function getExcelPath() {
    const env = process.env.NODE_ENV || 'production'; // Fallback zu 'production'

    if (env === 'development') {
        return 'C:/Users/Ronald/riskApp/electron_app/files/UNI_DATA.xlsm';
    } else if (env === 'thomasdev') {
        return 'C:/Users/wendlert/Desktop/valueXpro_dev/resources/app.asar.unpacked/files/UNI_DATA.xlsm';
    } else {
        throw new Error(`Unknown environment: ${env}`);
    }
}


module.exports = {getDatabasePath, getExcelPath };