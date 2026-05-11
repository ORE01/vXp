import {
  closeModal,
  bindModalCloseCleanup
} from './modalUI.js';

import { getCleanTableName, getUniqueIdentifier } from '../../../utils/tableUtils.js';
import { displayErrorMessage } from './modalFeedback.js';

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

bindModalCloseCleanup();

function eraseRow(cleanTableName, uniqueIdentifier) {
  window.api.send('erase-data', { cleanTableName, uniqueIdentifier });
}
