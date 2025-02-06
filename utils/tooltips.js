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
  