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

export function addProdIdTooltips(container) {
    if (!container) {
      console.error('Container is undefined or null.');
      return;
    }
  
    // Fetch product data from appState
    const prodAllData = appState.getProdData();
    
    if (!prodAllData || prodAllData.length === 0) {
      console.error('prodAllData is empty or undefined!');
      return; // Exit the function early to prevent errors
    }
  
    // Find the correct column index for PROD_ID
    const headerRow = container.querySelector('thead tr'); // Get table header
    if (!headerRow) {
      console.error('No table header found in container.');
      return;
    }
  
    const headers = Array.from(headerRow.querySelectorAll('th'));
    const prodIdColumnIndex = headers.findIndex(th => th.textContent.trim().toUpperCase() === 'PROD_ID');
  
    if (prodIdColumnIndex === -1) {
      console.error('No "PROD_ID" column found in this table.');
      return;
    }
  
    // Select all rows and get the corresponding `td` in the correct column
    const rows = container.querySelectorAll('tbody tr');
  
    rows.forEach(row => {
      const prodIdElement = row.querySelectorAll('td')[prodIdColumnIndex]; // Get the correct column
  
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
        console.warn(`No details found for PROD_ID: ${prodId}`);
      }
    });
  }

  // export function addProdIdTooltips(container) {
  //   if (!container) {
  //     console.error('Container is undefined or null.');
  //     return;
  //   }
  
  //   // Fetch product data from appState
  //   const prodAllData = appState.getProdData();
    
  //   if (!prodAllData || prodAllData.length === 0) {
  //     console.error('prodAllData is empty or undefined!');
  //     return;
  //   }
  
  //   // Find the correct column index for PROD_ID
  //   const headerRow = container.querySelector('thead tr'); 
  //   if (!headerRow) {
  //     console.error('No table header found in container.');
  //     return;
  //   }
  
  //   const headers = Array.from(headerRow.querySelectorAll('th'));
  //   const prodIdColumnIndex = headers.findIndex(th => th.textContent.trim().toUpperCase() === 'PROD_ID');
  
  //   if (prodIdColumnIndex === -1) {
  //     console.error('No "PROD_ID" column found in this table.');
  //     return;
  //   }
  
  //   // Select all rows and get the corresponding `td` in the correct column
  //   const rows = container.querySelectorAll('tbody tr');
  //   const missingProdIds = []; // Array to collect missing PROD_IDs
  
  //   rows.forEach(row => {
  //     const prodIdElement = row.querySelectorAll('td')[prodIdColumnIndex];
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
  //       // Collect missing PROD_IDs
  //       missingProdIds.push(prodId);
  //     }
  //   });
  
  //   // Display a message box if there are missing PROD_IDs
  //   if (missingProdIds.length > 0) {
  //     const missingIdsMessage = `The following PROD_IDs were not found in the product data:\n\n${missingProdIds.join('\n')}`;
  //     alert(missingIdsMessage);
  //   }
  // }

  // export function addProdIdTooltips(container) {
  //   if (!container) {
  //     console.error('Container is undefined or null.');
  //     return;
  //   }
  
  //   // Fetch product data from appState
  //   const prodAllData = appState.getProdData();
    
  //   if (!prodAllData || prodAllData.length === 0) {
  //     console.error('prodAllData is empty or undefined!');
  //     return;
  //   }
  
  //   // Find the correct column index for PROD_ID
  //   const headerRow = container.querySelector('thead tr');
  //   if (!headerRow) {
  //     console.error('No table header found in container.');
  //     return;
  //   }
  
  //   const headers = Array.from(headerRow.querySelectorAll('th'));
  //   const prodIdColumnIndex = headers.findIndex(th => th.textContent.trim().toUpperCase() === 'PROD_ID');
  
  //   if (prodIdColumnIndex === -1) {
  //     console.error('No "PROD_ID" column found in this table.');
  //     return;
  //   }
  
  //   // Select all rows and get the corresponding `td` in the correct column
  //   const rows = container.querySelectorAll('tbody tr');
  //   const missingProdIds = [];
  
  //   rows.forEach(row => {
  //     const prodIdElement = row.querySelectorAll('td')[prodIdColumnIndex];
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
  //       // Collect missing PROD_IDs
  //       missingProdIds.push(prodId);
  //     }
  //   });
  
  //   // Display a floating message box if there are missing PROD_IDs
  //   if (missingProdIds.length > 0) {
  //     createFloatingMessageBox(missingProdIds);
  //   }
  // }

  // function createFloatingMessageBox(missingProdIds) {
  //   // Create the message box container
  //   const messageBox = document.createElement('div');
  //   messageBox.style.position = 'fixed';
  //   messageBox.style.bottom = '20px';
  //   messageBox.style.right = '20px';
  //   messageBox.style.width = '300px';
  //   messageBox.style.maxHeight = '400px';
  //   messageBox.style.overflowY = 'auto';
  //   messageBox.style.backgroundColor = '#f8d7da';
  //   messageBox.style.color = '#721c24';
  //   messageBox.style.border = '1px solid #f5c6cb';
  //   messageBox.style.borderRadius = '8px';
  //   messageBox.style.padding = '15px';
  //   messageBox.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.2)';
  //   messageBox.style.zIndex = '1000';
  
  //   // Message title
  //   const title = document.createElement('h4');
  //   title.textContent = 'Missing PROD_IDs';
  //   title.style.marginTop = '0';
  //   messageBox.appendChild(title);
  
  //   // List of missing PROD_IDs
  //   const list = document.createElement('ul');
  //   missingProdIds.forEach(prodId => {
  //     const listItem = document.createElement('li');
  //     listItem.textContent = prodId;
  //     list.appendChild(listItem);
  //   });
  //   messageBox.appendChild(list);
  
  //   // Close button
  //   const closeButton = document.createElement('button');
  //   closeButton.textContent = 'Close';
  //   closeButton.style.marginTop = '10px';
  //   closeButton.style.padding = '5px 10px';
  //   closeButton.style.backgroundColor = '#721c24';
  //   closeButton.style.color = 'white';
  //   closeButton.style.border = 'none';
  //   closeButton.style.borderRadius = '4px';
  //   closeButton.style.cursor = 'pointer';
  
  //   closeButton.addEventListener('click', () => {
  //     document.body.removeChild(messageBox);  // Remove the message box when clicked
  //   });
  
  //   messageBox.appendChild(closeButton);
  
  //   // Append the message box to the body
  //   document.body.appendChild(messageBox);
  // }
  
  
  
  