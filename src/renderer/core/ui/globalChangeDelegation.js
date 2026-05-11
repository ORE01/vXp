import { handleScenarioCheckboxChange } from './changeHandlers/scenarioCheckboxChange.js';
import { handleRatesSelectorChange } from './changeHandlers/ratesSelectorChange.js';
import { createOffersDropdownChangeHandler } from './changeHandlers/offersDropdownChange.js';

let isChangeDelegationBound = false;

export function bindGlobalChangeDelegation({ appState, handleEUSWData }) {
  if (isChangeDelegationBound) return;
  isChangeDelegationBound = true;

  const handleOffersDropdownChange = createOffersDropdownChangeHandler({ appState });

  document.addEventListener('change', (event) => {
    const target = event.target;
    if (!target) return;

    if (handleScenarioCheckboxChange(target)) return;
    if (handleRatesSelectorChange(target, { appState, handleEUSWData })) return;
    if (handleOffersDropdownChange(target)) return;
  }, false);
}