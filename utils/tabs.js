export function initializeTabs() {
    const tabIds = ['DEALS_Tab', 'PORT_Tab', 'SENS_Tab', 'PROD_Tab', 'ISSUER_Tab', 'IR_Tab', 'FWD_Tab', 'TS_Tab', 'MVaR_Tab', 'CVaR_Tab', 'DATA_Tab', 'COMP_Tab', 'DataProvider_Tab', 'ML_Tab'];
    const modalIds = ['DEALS_Modal', 'PORT_Modal', 'SENS_Modal','PROD_Modal', 'ISSUER_Modal', 'IR_Modal', 'FWD_Modal','TS_Modal', 'MVaR_Modal', 'CVaR_Modal', 'DATA_Modal', 'COMP_Modal', 'DataProvider_Modal', 'ML_Modal'];
  
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

// export function initializeTabs() {
//     const tabIds = ['DEALS_Tab', 'PORT_Tab', 'SENS_Tab', 'PROD_Tab', 'ISSUER_Tab', 'IR_Tab', 'FWD_Tab', 'TS_Tab', 'MVaR_Tab', 'CVaR_Tab', 'DATA_Tab', 'COMP_Tab', 'DataProvider_Tab', 'ML_Tab'];
//     const modalIds = ['DEALS_Modal', 'PORT_Modal', 'SENS_Modal', 'PROD_Modal', 'ISSUER_Modal', 'IR_Modal', 'FWD_Modal', 'TS_Modal', 'MVaR_Modal', 'CVaR_Modal', 'DATA_Modal', 'COMP_Modal', 'DataProvider_Modal', 'ML_Modal'];
  
//     // Ensure all modals are hidden initially
//     const tables = document.querySelectorAll('.table');
//     tables.forEach((table) => {
//       table.style.visibility = 'hidden';
//       table.style.opacity = '0';
//       table.style.height = '0';
//       table.style.overflow = 'hidden';
//     });
  
//     // Add event listeners to tabs
//     tabIds.forEach((tabId, index) => {
//       const tabElement = document.getElementById(tabId);
//       const modalElement = document.getElementById(modalIds[index]);
  
//       if (tabElement && modalElement) {
//         tabElement.addEventListener('click', () => {
//           // Show the clicked modal
//           openTab(modalIds[index]);
//         });
//       }
//     });
  
//     // Attach close button logic
//     const closeBtns = document.querySelectorAll('.close');
//     closeBtns.forEach((closeBtn) => {
//       closeBtn.addEventListener('click', () => {
//         const modal = closeBtn.parentElement.parentElement;
//         closeModal(modal);
//       });
//     });
  
//     // Add draggable functionality to all draggable modals
//     const draggableModals = document.querySelectorAll('.draggable');
//     makeModalsDraggable(draggableModals);
//   }
  
//   function openTab(targetModalId) {
//     // Show the specified modal
//     const targetModal = document.getElementById(targetModalId);
//     if (targetModal) {
//       targetModal.style.visibility = 'visible';
//       targetModal.style.opacity = '1';
//       targetModal.style.height = 'auto';
//       targetModal.style.overflow = 'visible';
//     }
//   }
  
//   function closeModal(modal) {
//     // Hide the modal
//     if (modal) {
//       modal.style.visibility = 'hidden';
//       modal.style.opacity = '0';
//       modal.style.height = '0';
//       modal.style.overflow = 'hidden';
//     }
//   }
  
//   function makeModalsDraggable(draggableModals) {
//     draggableModals.forEach((draggableModal) => {
//       let isDragging = false;
//       let initialMouseX = 0;
//       let initialMouseY = 0;
//       let modalStartX = 0;
//       let modalStartY = 0;
  
//       // Mouse down event listener
//       draggableModal.addEventListener('mousedown', (e) => {
//         // Check if the clicked area isn't the close button
//         if (e.target.classList.contains('close')) return;
  
//         isDragging = true;
  
//         // Get the initial mouse and modal positions
//         initialMouseX = e.clientX;
//         initialMouseY = e.clientY;
//         modalStartX = draggableModal.offsetLeft;
//         modalStartY = draggableModal.offsetTop;
  
//         // Add a class to indicate dragging (optional, for styling)
//         draggableModal.classList.add('dragging');
//       });
  
//       // Mouse move event listener
//       window.addEventListener('mousemove', (e) => {
//         if (isDragging) {
//           // Calculate the new modal position
//           const deltaX = e.clientX - initialMouseX;
//           const deltaY = e.clientY - initialMouseY;
  
//           const newLeft = modalStartX + deltaX;
//           const newTop = modalStartY + deltaY;
  
//           // Update modal position
//           draggableModal.style.left = `${newLeft}px`;
//           draggableModal.style.top = `${newTop}px`;
//         }
//       });
  
//       // Mouse up event listener
//       window.addEventListener('mouseup', () => {
//         isDragging = false;
//         draggableModal.classList.remove('dragging'); // Remove dragging class
//       });
//     });
//   }
  
  
  
  

  
  