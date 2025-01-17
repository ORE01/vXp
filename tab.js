// window.currentActiveTabId = '';

// const tabIds = ['DEALS_Tab', 'PORT_Tab', 'SENS_Tab', 'PROD_Tab', 'ISSUER_Tab', 'IR_Tab', 'TS_Tab', 'MVaR_Tab', 'CVaR_Tab', 'DATA_Tab'];
// const modalIds = ['DEALS_Modal', 'PORT_Modal', 'SENS_Modal','PROD_Modal', 'ISSUER_Modal', 'IR_Modal', 'TS_Modal', 'MVaR_Modal', 'CVaR_Modal', 'DATA_Modal'];

// // Handle tab button click events using a loop
// for (let i = 0; i < tabIds.length; i++) {
//   const tab = document.getElementById(tabIds[i]);
//   const modal = document.getElementById(modalIds[i]);

//   tab.addEventListener('click', () => {
//     window.currentActiveTabId = tabIds[i];
//     openTab(tabIds[i]);
//   });
// }

// // Open the specified tab content
// function openTab(tabName) {
//   // Hide all tab content
//   const tables = document.querySelectorAll('.table');
//   tables.forEach((table) => {
//     table.style.display = 'none';
//   });

//   // Show the specified tab content
//   for (let i = 0; i < tabIds.length; i++) {
//     if (tabName === tabIds[i]) {
//       const modal = document.getElementById(modalIds[i]);
//       modal.style.display = 'block';
//       break;
//     }
//   }
// }


//     // Close the active modal when the close button is clicked
//     const closeBtns = document.querySelectorAll('.close');
//     closeBtns.forEach((closeBtn) => {
//       closeBtn.addEventListener('click', () =>
// {
//     const modal = closeBtn.parentElement.parentElement;
//     modal.style.display = 'none';
//   });
// });

// // Make the modal draggable
// const draggableModals = document.querySelectorAll('.draggable');
// let isDragging = false;
// let initialMouseOffsetX = 0;
// let initialMouseOffsetY = 0;
// let initialModalPosX = 0;
// let initialModalPosY = 0;

// draggableModals.forEach((draggableModal) => {
//   // Mouse down event listener
//   draggableModal.addEventListener('mousedown', (e) => {
//     isDragging = true;

//     // Calculate the initial mouse offset relative to the modal's top and left positions
//     initialMouseOffsetX = e.clientX - draggableModal.getBoundingClientRect().left;
//     initialMouseOffsetY = e.clientY - draggableModal.getBoundingClientRect().top;

//     // Store the initial position of the modal
//     initialModalPosX = draggableModal.offsetLeft;
//     initialModalPosY = draggableModal.offsetTop;
//   });

//   // Mouse move event listener
//   window.addEventListener('mousemove', (e) => {
//     if (isDragging) {
//       // Calculate the new modal position based on the mouse movement
//       const newModalX = e.clientX - initialMouseOffsetX - initialModalPosX;
//       const newModalY = e.clientY - initialMouseOffsetY - initialModalPosY;

//       // Set the modal position
//       draggableModal.style.transform = `translate(${newModalX}px, ${newModalY}px)`;
//     }
//   });

//   // Mouse up event listener
//   window.addEventListener('mouseup', () => {
//     isDragging = false;
//   });
// });