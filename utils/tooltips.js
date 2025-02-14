export function addTooltipsForTruncatedText(container) {
    const cells = container.querySelectorAll('td');
    cells.forEach((cell) => {
      //console.log(`Cell content: "${cell.textContent}", scrollWidth: ${cell.scrollWidth}, clientWidth: ${cell.clientWidth}`);
      if (cell.scrollWidth > cell.clientWidth) {
        cell.setAttribute('title', cell.textContent);
        //console.log(`Tooltip added: "${cell.textContent}"`);
      }
    });
  }

// export function addProdIdTooltips(container) {
//     if (!container) {
//       console.error('Container is undefined or null.');
//       return;
//     }
  
//     // Fetch product data from appState
//     const prodAllData = appState.getProdData();
    
//     if (!prodAllData || prodAllData.length === 0) {
//       console.error('prodAllData is empty or undefined!');
//       return; // Exit the function early to prevent errors
//     }
  
//     // Find the correct column index for PROD_ID
//     const headerRow = container.querySelector('thead tr'); // Get table header
//     if (!headerRow) {
//       console.error('No table header found in container.');
//       return;
//     }
  
//     const headers = Array.from(headerRow.querySelectorAll('th'));
//     const prodIdColumnIndex = headers.findIndex(th => th.textContent.trim().toUpperCase() === 'PROD_ID');
  
//     if (prodIdColumnIndex === -1) {
//       console.error('No "PROD_ID" column found in this table.');
//       return;
//     }
  
//     // Select all rows and get the corresponding `td` in the correct column
//     const rows = container.querySelectorAll('tbody tr');
  
//     rows.forEach(row => {
//       const prodIdElement = row.querySelectorAll('td')[prodIdColumnIndex]; // Get the correct column
  
//       if (!prodIdElement) return;
  
//       const prodId = prodIdElement.textContent.trim();
//       const productDetails = prodAllData.find(prod => prod.PROD_ID === prodId);
  
//       if (productDetails) {
//         const tooltipContent = `
//           Product ID: ${productDetails.PROD_ID || 'N/A'}\n
//           Description: ${productDetails.DESCRIPTION || 'N/A'}\n
//           Coupon Type: ${productDetails.CouponType || 'N/A'}\n
//           Maturity: ${productDetails.MATURITY || 'N/A'}\n
//           Issuer: ${productDetails.ISSUER || 'N/A'}\n
//           Rank: ${productDetails.RANK || 'N/A'}\n
//           Rating: ${productDetails.RATING_PROD || 'N/A'}\n
//         `;
  
//         prodIdElement.setAttribute('title', tooltipContent);
//       } else {
//         console.warn(`No details found for PROD_ID: ${prodId}`);
//       }
//     });
//   }

// export function addProdIdTooltips(container) {
//   if (!container) {
//     console.error('Container is undefined or null.');
//     return;
//   }

//   // Fetch product data from appState
//   const prodAllData = appState.getProdData();

//   if (!prodAllData || prodAllData.length === 0) {
//     console.error('prodAllData is empty or undefined!');
//     return; // Exit the function early to prevent errors
//   }

//   // Find the correct column index for PROD_ID
//   const headerRow = container.querySelector('thead tr'); // Get table header
//   if (!headerRow) {
//     showToastMessage('No table header found in the portfolio.', 'warning');
//     return;
//   }

//   const headers = Array.from(headerRow.querySelectorAll('th'));
//   const prodIdColumnIndex = headers.findIndex(th => th.textContent.trim().toUpperCase() === 'PROD_ID');

//   if (prodIdColumnIndex === -1) {
//     showToastMessage('No "PROD_ID" column found in this portfolio.', 'warning');
//     return;
//   }

//   // Select all rows and get the corresponding `td` in the correct column
//   const rows = container.querySelectorAll('tbody tr');

//   rows.forEach(row => {
//     const prodIdElement = row.querySelectorAll('td')[prodIdColumnIndex]; // Get the correct column

//     if (!prodIdElement) return;

//     const prodId = prodIdElement.textContent.trim();
//     const productDetails = prodAllData.find(prod => prod.PROD_ID === prodId);

//     if (productDetails) {
//       const tooltipContent = `
//         Product ID: ${productDetails.PROD_ID || 'N/A'}\n
//         Description: ${productDetails.DESCRIPTION || 'N/A'}\n
//         Coupon Type: ${productDetails.CouponType || 'N/A'}\n
//         Maturity: ${productDetails.MATURITY || 'N/A'}\n
//         Issuer: ${productDetails.ISSUER || 'N/A'}\n
//         Rank: ${productDetails.RANK || 'N/A'}\n
//         Rating: ${productDetails.RATING_PROD || 'N/A'}\n
//       `;

//       prodIdElement.setAttribute('title', tooltipContent);
//     } else {
//       console.warn(`No details found for PROD_ID: ${prodId}`);
//     }
//   });
// }
export function addProdIdTooltips(container) {
  if (!container) {
    console.warn('⚠️ Warning: Container is undefined or null.');
    return;
  }

  // Fetch product data from appState
  const prodAllData = appState.getProdData();

  if (!Array.isArray(prodAllData) || prodAllData.length === 0) {
    console.warn('⚠️ Warning: prodAllData is empty or undefined.');
    return; // Stop execution to prevent further errors
  }

  // Find the correct column index for PROD_ID
  const headerRow = container.querySelector('thead tr');
  if (!headerRow) {
    showToastMessage('⚠️ Warning: No table header found in the portfolio.', 'warning');
    return;
  }

  const headers = Array.from(headerRow.querySelectorAll('th'));
  const prodIdColumnIndex = headers.findIndex(th => th.textContent.trim().toUpperCase() === 'PROD_ID');

  if (prodIdColumnIndex === -1) {
    showToastMessage('⚠️ Warning: No "PROD_ID" column found in this portfolio.', 'warning');
    return;
  }

  // Select all rows and get the corresponding `td` in the correct column
  const rows = container.querySelectorAll('tbody tr');
  const missingProdIds = []; // Liste für fehlende PROD_IDs

  rows.forEach(row => {
    const prodIdElement = row.querySelectorAll('td')[prodIdColumnIndex];
    if (!prodIdElement) return;

    const prodId = prodIdElement.textContent.trim();
    const productDetails = prodAllData.find(prod => prod.PROD_ID === prodId);

    if (productDetails) {
      const tooltipContent = `
        Product ID: ${productDetails.PROD_ID || 'N/A'}\n
        Description: ${productDetails.DESCRIPTION || 'N/A'}\n
        Coupon Type: ${productDetails.CouponType || 'N/A'}\n
        Maturity: ${productDetails.MATURITY || 'N/A'}\n
        Issuer: ${productDetails.ISSUER || 'N/A'}\n
        Rank: ${productDetails.RANK || 'N/A'}\n
        Rating: ${productDetails.RATING_PROD || 'N/A'}\n
      `;

      prodIdElement.setAttribute('title', tooltipContent);
    } else {
      missingProdIds.push(prodId);
    }
  });

  // Falls PROD_IDs fehlen, eine Warnung mit der Liste anzeigen
  if (missingProdIds.length > 0) {
    console.warn(`⚠️ Warning: No details found for the following PROD_IDs: ${missingProdIds.join(', ')}`);
    showToastMessage(`⚠️ Warning: Missing product details for PROD_IDs: ${missingProdIds.join(', ')}`, 'warning');
  }
}

function showToastMessage(message, type = 'info') {
  const toast = document.createElement('div');
  toast.textContent = message;

  // Basic styling for the toast
  toast.style.position = 'absolute';
  toast.style.bottom = '20px';
  toast.style.right = '20px';
  toast.style.backgroundColor = type === 'warning' ? '#ff9800' : '#4CAF50';  // Orange for warnings, green for success
  toast.style.color = 'white';
  toast.style.padding = '10px 20px';
  toast.style.borderRadius = '5px';
  toast.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';
  toast.style.fontFamily = '"Your Font Name", sans-serif';
  toast.style.fontSize = '13px';
  toast.style.opacity = '0';
  toast.style.transition = 'opacity 0.3s ease';
  toast.style.zIndex = '1000';

  // Append to app container
  const appContainer = document.getElementById('app') || document.body;
  appContainer.appendChild(toast);

  // Fade in
  setTimeout(() => {
    toast.style.opacity = '1';
  }, 100);

  // Auto-remove after 3 seconds
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => appContainer.removeChild(toast), 300);
  }, 3000);
}

  
  
  
  
  