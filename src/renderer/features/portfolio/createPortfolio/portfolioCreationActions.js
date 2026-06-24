// portfolio/portfolioCreationActions.js
// Kompositions-Wurzel des Trade-Editors (Create / Change Portfolio).
// Setzt die fokussierten Module zusammen und liefert das (unveränderte)
// Handler-Objekt für Bootstrap / IPC-Router / Button-Wiring.

import { bindTradeIpcFeedbackOnce } from '../trades/tradeIpcFeedback.js';
import { createTradeActions } from '../trades/tradeActions.js';
import { createTradeDataHandlers } from '../trades/tradeDataHandlers.js';

export function createTradePortfolioActions(deps = {}) {
  const { appState, api } = deps;
  if (!appState) throw new Error('[createTradePortfolioActions] appState missing');
  if (!api) throw new Error('[createTradePortfolioActions] api missing');

  // Einmalige Erfolg/Fehler-Toasts (Delete/Add/Fill).
  bindTradeIpcFeedbackOnce(deps);

  // Gleiche Keys wie bisher → Konsumenten (Router/Receiver/Buttons) unverändert.
  return {
    ...createTradeDataHandlers(deps),
    ...createTradeActions(deps),
  };
}
