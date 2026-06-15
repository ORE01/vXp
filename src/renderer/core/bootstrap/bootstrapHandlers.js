// core/bootstrap/bootstrapHandlers.js

import { createIssuerProductHandlers } from '../../features/DATA_PROVIDER/issuerProductHandlers.js';
import { createCustomerHandlers } from '../../features/CUSTOMER/customerHandlers.js';
import { createDealsPortfolioActions } from '../../features/portfolio/portfolioCreationActions.js';
import { createRatesHandlers } from '../../features/MARKET_DATA/interestRates/interestRateCurveHandlers.js';
import { createSwaptionDataHandlers } from '../../features/MARKET_DATA/VOLS/swaptionDataHandlers.js';
import { createForwardsHandlers } from '../../features/MARKET_DATA/forwards/forwardCurveHandlers.js';
import { createAnalysePortfolioHandlers } from '../../features/ANALYSE_PORTFOLIO/analysePortfolioHandlers.js';
import { handlePortfolioRiskSensitivitiesData } from '../../features/ANALYSE_PORTFOLIO/marketRisk/sensitivities/portfolioRiskSensitivitiesHandler.js';

import {handleCSParameterData} from '../../features/MARKET_DATA/CREDIT_SPREADS/csParameterHandlers.js';

import { handleCustomerTableLayoutsData } from '../../features/CUSTOMER/tableLayouts/handleCustomerTableLayoutsData.js';

import {
  handleCSBaseData,
  handleCS_ACTIVEData,
  handleCSScenarioData,
} from '../../features/MARKET_DATA/CREDIT_SPREADS/csHandlers.js';

import {
  handleMVaRData,
  handleMvarInputData,
} from '../../features/ANALYSE_PORTFOLIO/marketRisk/mvar/index.js';

import { handleCVaRData, handleEADData } from '../../features/ANALYSE_PORTFOLIO/CREDIT_RISK/CVaR.js';
import { handleCvarInput } from '../../features/ANALYSE_PORTFOLIO/CREDIT_RISK/CvarInput.js';
import { handleCvarInputThresholdView } from '../../features/ANALYSE_PORTFOLIO/CREDIT_RISK/CvarInputThreshold.js';
import { handleLossIssuerMainData } from '../../features/ANALYSE_PORTFOLIO/CREDIT_RISK/LossIssuer.js';

export function bootstrapHandlers(appState, deps) {
  const {
    api,
    showMessageBox,
    showConfirmationBox,
    handleModalAction,
  } = deps;

  const issuerProdHandlers = createIssuerProductHandlers({ appState });
  const customerHandlers = createCustomerHandlers({ appState });

  const dealsActions = createDealsPortfolioActions({
    appState,
    api,
    showMessageBox,
    showConfirmationBox,
    handleModalAction,
  });

  const ratesHandlers = createRatesHandlers({ appState });

  const {
    handleSwaptionATMData,
    handleSwaptionSmileData,
    handleSwaptionCubeData,
    handleSwaptionSnapshotsData,
    handleSwaptionSmileSnapshotsData,
    handleSwaptionActiveData,
  } = createSwaptionDataHandlers({ appState });

  const forwardsHandlers = createForwardsHandlers({ appState });

  const analyseHandlers = createAnalysePortfolioHandlers({
    appState,
    handleMVaRData,
    handleCVaRData,
    handleEADData,
    handleLossIssuerMainData,
    handleCvarInput,
    handleCvarInputThresholdView,
  });

  return {
    issuerProdHandlers,
    customerHandlers,
    dealsActions,
    forwardsHandlers,
    analyseHandlers,
    ratesHandlers,

    handleCSParameterData,
    handleCS_ACTIVEData,
    handleCSBaseData,
    handleCSScenarioData,
    handleCustomerTableLayoutsData,

    // canonical Swaption names for installReceivers/dataRouter
    handleSwaptionAtmBaseData: handleSwaptionATMData,
    handleSwaptionSmileBaseData: handleSwaptionSmileData,
    handleSwaptionAtmScenarioData: handleSwaptionSnapshotsData,
    handleSwaptionSmileScenarioData: handleSwaptionSmileSnapshotsData,
    handleSwaptionActiveData,
    handleSwaptionCubeData,

    // legacy aliases, falls anderswo noch verwendet
    handleSwaptionATMData,
    handleSwaptionSmileData,
    handleSwaptionSnapshotsData,
    handleSwaptionSmileSnapshotsData,

    handlePortfolioRiskSensitivitiesData,

    handleMvarInputData,
  };
}