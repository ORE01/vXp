// src/renderer/features/portfolio/portfolioCreationPanel.js


export const PORTFOLIO_CREATION_IDS = {
  nameInput: 'PortfolioNameInput',
  previewContainer: 'newPortfolioDealsDataContainer',
};

export function getPortfolioCreationNameInput() {
  return document.getElementById(PORTFOLIO_CREATION_IDS.nameInput);
}

export function getPortfolioCreationName() {
  const inputEl = getPortfolioCreationNameInput();
  return String(inputEl?.value ?? '').trim();
}

export function clearPortfolioCreationName() {
  const inputEl = getPortfolioCreationNameInput();
  if (inputEl) inputEl.value = '';
}

export function focusPortfolioCreationName({ select = true } = {}) {
  const inputEl = getPortfolioCreationNameInput();
  if (!inputEl) return;

  inputEl.focus?.();

  if (select) {
    inputEl.select?.();
  }
}

export function getPortfolioCreationPreviewContainer() {
  return document.getElementById(PORTFOLIO_CREATION_IDS.previewContainer);
}

export function clearPortfolioCreationPreview() {
  const container = getPortfolioCreationPreviewContainer();
  if (container) container.innerHTML = '';
}

export function hasPortfolioCreationPanel() {
  return Boolean(
    getPortfolioCreationNameInput() &&
    getPortfolioCreationPreviewContainer()
  );
}