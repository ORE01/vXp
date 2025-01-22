import { appState } from './renderer.js';

export function handleLiquidityData() {
// Daten von appState abrufen
const filteredPortData = appState.getFilteredPortData();

// Daten in der Konsole ausgeben
console.log('Daten aus appState:', filteredPortData);
}