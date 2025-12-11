// export function initializeTabs() {
//   const map = {
//     'PORT_Tab': 'PORT_Modal',
//     'DATA_Tab': 'DATA_Modal',
//     'COMP_Tab': 'COMP_Modal',
//     'DataProvider_Tab': 'DataProvider_Modal',
//     'ANALYSE_Tab': 'ANALYSE_Modal',
//     'CREATE_PORTFOLIO_Tab': 'CREATE_PORTFOLIO_Modal',
//     'MARKETDATA_Tab': 'MARKETDATA_Modal',
//     'NEW_PRODUCTS_Tab': 'NEW_PRODUCTS_Modal',
//     'REPORTS_Tab': 'REPORTS_Modal',
//   };

//   const tables = document.querySelectorAll('.table');
//   tables.forEach(hideModal);

//   Object.entries(map).forEach(([tabId, modalId]) => {
//     const tab = document.getElementById(tabId);
//     const modal = document.getElementById(modalId);
//     if (!tab || !modal) {
//       console.warn(`ID fehlt: ${tabId} → ${modalId}`);
//       return;
//     }
//     tab.addEventListener('click', () => showModal(modalId, tables));
//   });
// }

// function hideModal(el) {
//   el.style.visibility = 'hidden';
//   el.style.opacity = '0';
//   el.style.height = '0';
//   el.style.overflow = 'hidden';
// }

// function showModal(targetModalId, allModals) {
//   allModals.forEach(hideModal);
//   const target = document.getElementById(targetModalId);
//   if (target) {
//     target.style.visibility = 'visible';
//     target.style.opacity = '1';
//     target.style.height = 'auto';
//     target.style.overflow = 'visible';
//   }
// }

export function initializeTabs() {
  const map = {
    'PORT_Tab': 'PORT_Modal',
    'DATA_Tab': 'DATA_Modal',
    'COMP_Tab': 'COMP_Modal',
    'DataProvider_Tab': 'DataProvider_Modal',
    'ANALYSE_Tab': 'ANALYSE_Modal',
    'CREATE_PORTFOLIO_Tab': 'CREATE_PORTFOLIO_Modal',
    'MARKETDATA_Tab': 'MARKETDATA_Modal',
    'NEW_PRODUCTS_Tab': 'NEW_PRODUCTS_Modal',
    'REPORTS_Tab': 'REPORTS_Modal',
  };

  // 1) Alle Panels (Modals) beim Start verstecken
  const allModals = document.querySelectorAll('.table');
  allModals.forEach(hideModal);

  // 2) Klick-Events für Tabs registrieren (Variante 1: nur öffnen, nichts schließen)
  Object.entries(map).forEach(([tabId, modalId]) => {
    const tab = document.getElementById(tabId);
    const modal = document.getElementById(modalId);

    if (!tab || !modal) {
      console.warn(`ID fehlt: ${tabId} → ${modalId}`);
      return;
    }

    tab.addEventListener('click', () => showModal(modalId));
  });
}

function hideModal(el) {
  el.style.visibility = 'hidden';
  el.style.opacity = '0';
  el.style.height = '0';
  el.style.overflow = 'hidden';
}

function showModal(targetModalId) {
  const target = document.getElementById(targetModalId);
  if (target) {
    target.style.visibility = 'visible';
    target.style.opacity = '1';
    target.style.height = 'auto';
    target.style.overflow = 'visible';
  }
}

