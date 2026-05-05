export function createOffersDropdownChangeHandler({ appState }) {
  let lastOffersPort = null;

  return function handleOffersDropdownChange(target) {
    if (target?.id !== 'createdOffersDropdown') return false;

    const portName = target.value;

    if (portName === lastOffersPort) return true;
    lastOffersPort = portName;

    try {
      appState?.setSelectedDealsTableName?.(portName);
      appState?.setSelectedPortTableName?.(portName);

      const allDeals = appState?.getAllDealsData?.() || [];
      const rows = allDeals.filter((row) => row?.port_name === portName);

      appState?.handleDealsData?.(rows, portName);
    } catch (err) {
      console.error('Offers dropdown handling failed:', err);
    }

    return true;
  };
}