export function initializeTabs() {
    const tabIds = [
      'DEALS_Tab', 
      'PORT_Tab', 
      'SENS_Tab', 
      'PROD_Tab', 
      'ISSUER_Tab', 
      'IR_Tab', 
      'FWD_Tab', 
      'TS_Tab', 
      'MVaR_Tab', 
      'CVaR_Tab', 
      'DATA_Tab', 
      'COMP_Tab', 
      'DataProvider_Tab', 
      'ML_Tab', 
      'CS_Tab',
      'Liquidity_Tab',
      'Offers_Tab',
      'SUMMARY_Tab',
    ];
    const modalIds = [
      'DEALS_Modal', 
      'PORT_Modal', 
      'SENS_Modal',
      'PROD_Modal', 
      'ISSUER_Modal', 
      'IR_Modal', 
      'FWD_Modal',
      'TS_Modal',
      'MVaR_Modal', 
      'CVaR_Modal', 
      'DATA_Modal', 
      'COMP_Modal',
      'DataProvider_Modal',
      'ML_Modal', 
      'CS_Modal',
      'Liquidity_Modal',
      'Offers_Modal',
      'SUMMARY_Modal',
    ];
  
    const tables = document.querySelectorAll('.table');
    tables.forEach((table) => {
      table.style.visibility = 'hidden';
      table.style.opacity = '0';
      table.style.height = '0';
      table.style.overflow = 'hidden';
    });
  
// this block would show the first Tab which id DEALS_Tab at initial loading

    // const firstModal = document.getElementById(modalIds[0]);
    // if (firstModal) {
    //   firstModal.style.visibility = 'visible';
    //   firstModal.style.opacity = '1';
    //   firstModal.style.height = 'auto';
    //   firstModal.style.overflow = 'visible';
    // }
  
    tabIds.forEach((tabId, index) => {
      const tabElement = document.getElementById(tabId);
      const modalElement = document.getElementById(modalIds[index]);
  
      if (tabElement && modalElement) {
        tabElement.addEventListener('click', () => {
          openTab(modalIds[index], tables);
        });
      }
    });
  }
  
  function openTab(targetModalId, allModals) {
    allModals.forEach((modal) => {
      modal.style.visibility = 'hidden';
      modal.style.opacity = '0';
      modal.style.height = '0';
      modal.style.overflow = 'hidden';
    });
  
    const targetModal = document.getElementById(targetModalId);
    if (targetModal) {
      targetModal.style.visibility = 'visible';
      targetModal.style.opacity = '1';
      targetModal.style.height = 'auto';
      targetModal.style.overflow = 'visible';
    }
  }

