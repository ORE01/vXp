'use strict';

import { handlePortfolioRiskSensitivitiesData } from './sensitivities/portfolioRiskSensitivitiesHandler.js';

import { handleIRSensData } from './sensitivities/portfolioPV01Handler.js';
import { handleCSSensData } from './sensitivities/portfolioCPV01Handler.js';
import { handleVegaSensData } from './sensitivities/portfolioVegaHandler.js';

import {
  handleMVaRData,
  handleMvarInputData,
  handleMvarModelSelectionAppData,
  handleMVaRFactorPLData,
  handleMVaRProductPLData,
  handleMarketVarFactorSeriesMapData,
} from './mvar/index.js';

export const marketRiskHandlers = {
  handlePortfolioRiskSensitivitiesData,

  handleIRSensData,
  handleCSSensData,
  handleVegaSensData,

  handleMVaRData,
  handleMvarInputData,
  handleMvarModelSelectionAppData,
  handleMVaRFactorPLData,
  handleMVaRProductPLData,
  handleMarketVarFactorSeriesMapData,
};