
let isErasing = false;


export const eraseButtonHandler = (selectedTableName, rowIndex, data) => async () => {
  console.log('Erase attempt for:', data);
  if (isErasing) return;
  isErasing = true;

  try {
    const cleanTableName = getCleanTableName(selectedTableName);
    let uniqueIdentifier = getUniqueIdentifier(data, selectedTableName);
    console.log('selectedTableName, uniqueIdentifier:', selectedTableName, uniqueIdentifier);

    // ✅ Keep existing logic for erasing from ProdAll
    await eraseRow(cleanTableName, uniqueIdentifier);

    // ✅ NEW: Also check and erase from ProdCouponSchedules
    console.log('Checking existence in ProdCouponSchedules for:', uniqueIdentifier);

    let uniqueValue = uniqueIdentifier;
    if (typeof uniqueIdentifier === 'object' && uniqueIdentifier !== null) {
      uniqueValue = uniqueIdentifier.value; // Extract actual ID value
    }
    uniqueValue = String(uniqueValue).trim(); // Ensure it's a string

    // Get all coupon data
    const couponData = appState.getCouponData();
    console.log('Available rows in ProdCouponSchedules:', couponData);

    // Find matching rows
    const matchingRows = couponData.filter(row => {
      console.log('Checking row:', row); // Debugging log
      return row.PROD_ID && String(row.PROD_ID).trim() === uniqueValue;
    });

    if (matchingRows.length > 0) {
      console.log(`Found ${matchingRows.length} matching rows in ProdCouponSchedules. Deleting...`);
      for (const row of matchingRows) {
        console.log('Attempting to delete row:', row);

        if (!row.ID) {
          console.error('❌ ERROR: Row missing ID:', row);
          continue; // Skip this row to prevent errors
        }

        // ✅ Convert ID to a number (removing commas if needed)
        const numericID = Number(String(row.ID).replace(/,/g, '')); // Removes commas and converts to a number
        console.log(`Deleting row from ProdCouponSchedules where ID = ${numericID}`);

        // ✅ Ensure `eraseRow` receives column + value
        await eraseRow('ProdCouponSchedules', { column: 'ID', value: numericID });
      }
    } else {
      console.log('❌ No matching rows found in ProdCouponSchedules.');
    }

    closeModal();
  } catch (error) {
    console.error('❌ Error in eraseButtonHandler:', error);
    displayErrorMessage(`Failed to erase row: ${error.message}`);
  } finally {
    isErasing = false;
  }
};

function getCleanTableName(tableName) {
  // Additional check to ensure tableName is not undefined
  if (typeof tableName === 'string') {
    return tableName.endsWith('Data') ? tableName.slice(0, -4) : tableName;
  } else {
    console.error("tableName is not a string.");
    return ''; // Return an empty string or handle this case as needed
  }
}

function getUniqueIdentifier(newData, selectedTableName) {
  console.log('newData, selectedTableName:', newData, selectedTableName);
  // Determine the column name based on the selected table name
  let uniqueIdentifierColumn;
  
  // Check if selectedTableName starts with "Deals"
  if (selectedTableName.startsWith('Deals')) {
      uniqueIdentifierColumn = 'TRADE_ID';
  } else {
      switch (selectedTableName) {
          case 'Issuer':
              uniqueIdentifierColumn = 'TICKER';
              break;
          case 'ProdAll':
              uniqueIdentifierColumn = 'PROD_ID';
              break;
          case 'CSParameter':
            uniqueIdentifierColumn = 'CSSzenario';
            break;    
          case 'ecb':
            uniqueIdentifierColumn = 'ID';
            break;    
          case 'fed':
            uniqueIdentifierColumn = 'ID';
            break;   
          case 'yahoo':
            uniqueIdentifierColumn = 'ID';
            break;  
          case 'ProdCouponSchedules': 
            uniqueIdentifierColumn = 'ID'; 
            break;   
          // Add more cases as needed for different tables
          default:
              console.error('Unknown table:', selectedTableName);
              return null; // Or handle this situation as appropriate
      }
  }

  // Assuming uniqueIdentifierColumn is correctly determined
  if (uniqueIdentifierColumn && newData.hasOwnProperty(uniqueIdentifierColumn)) {
      return {
          column: uniqueIdentifierColumn,
          value: newData[uniqueIdentifierColumn]
      };
  } else {
      console.error('Unable to determine the unique identifier for:', selectedTableName);
      return null;
  }
}


function closeModal() {
  const modal = document.getElementById('modal');
  if (modal) {
    modal.style.display = 'none';
  }
}





function removeCouponButton() {
  const couponButton = document.getElementById('coupon-button');
  if (couponButton) {
      couponButton.remove();
      console.log("Coupon button removed.");
  }
}

// **Attach event to close button to remove coupon button**
document.addEventListener("DOMContentLoaded", () => {
  const closeButton = document.querySelector(".close"); 
  if (closeButton) {
      closeButton.addEventListener("click", removeCouponButton);
  }
});