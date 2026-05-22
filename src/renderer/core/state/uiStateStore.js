

export function installUIStateStore({ appState } = {}) {
  if (!appState) throw new Error('[uiStateStore] appState fehlt');

  function setActiveElementId(elementId) {
    appState.activeElementId = elementId;
  }

  function getActiveElementId() {
    return appState.activeElementId;
  }

  appState.setActiveElementId = setActiveElementId;
  appState.getActiveElementId = getActiveElementId;

  return { setActiveElementId, getActiveElementId };
}
