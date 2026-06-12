'use strict';

export function renderProductDeleteZone(isCreateMode) {
  if (isCreateMode) return '';

  return `
    <div class="structure-drawer-danger-zone">
      <div class="structure-drawer-danger-title">
        Danger Zone
      </div>

      <button
        id="deleteProductDrawer"
        type="button"
        class="structure-action-button structure-action-button-danger"
      >
        Delete Product
      </button>
    </div>
  `;
}

export function bindProductDeleteButton(container, prodId) {
  container
    .querySelector('#deleteProductDrawer')
    ?.addEventListener('click', () => {
      deleteProductViaExistingFlow(container, prodId);
    });
}

function deleteProductViaExistingFlow(container, prodId) {
  const note = container.querySelector('.structure-drawer-note');

  if (!prodId) {
    if (note) {
      note.textContent = 'Cannot delete before product is saved.';
    }
    return;
  }

  const confirmed =
    container.dataset.confirmDeleteProduct === String(prodId);

  if (!confirmed) {
    container.dataset.confirmDeleteProduct = String(prodId);

    if (note) {
      note.textContent = `Click Delete Product again to permanently delete ${prodId}.`;
    }

    return;
  }

  delete container.dataset.confirmDeleteProduct;

  console.log('[DELETE PRODUCT FROM DRAWER]', {
    prodId,
  });

  window.api.send('erase-data', {
    cleanTableName: 'v_PRODUCTS_APP',
    uniqueIdentifier: {
      column: 'PROD_ID',
      value: prodId,
    },
  });

  if (note) {
    note.textContent = 'Delete submitted.';
  }
}