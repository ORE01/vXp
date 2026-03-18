'use strict';

import { handleIRSensData } from './IRSens.js';
import { handleCSSensData } from './CSSens.js';
import { handleMVaRData, handleMvarInputData } from './MVaR.js';

export const marketRiskHandlers = {
  handleIRSensData,
  handleCSSensData,
  handleMVaRData,
  handleMvarInputData,
};