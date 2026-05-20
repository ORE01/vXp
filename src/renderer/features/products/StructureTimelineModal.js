// src/renderer/features/products/StructureTimelineModal.js

'use strict';

import { renderStructureTimelineGrid } from './structureTimeline/structureTimelineGrid.js';
import { renderProductSetupDrawer } from './structureTimeline/structureProductSetupDrawer.js';
import { renderModelSetupDrawer } from './structureTimeline/structureModelSetupDrawer.js';
import { renderSimpleFixedDrawer } from './structureTimeline/structureSimpleFixedDrawer.js';
import { renderSimpleFrnDrawer } from './structureTimeline/structureSimpleFrnDrawer.js';
import { renderProductValuationDrawer } from './structureTimeline/structureProductValuationDrawer.js';

export function handleStructureTimelineModal(prodId, options = {}) {
  const mode = options.mode || 'edit';
  const isCreateMode = mode === 'create';

  console.log('[STRUCTURE TIMELINE MODAL]', {
    prodId,
    mode,
    options,
  });

  let modal = document.getElementById('structureTimelineModal');

  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'structureTimelineModal';
    modal.className = 'structure-timeline-modal';

    document.body.appendChild(modal);
  }

  const titleText = isCreateMode
    ? 'New Product'
    : `Structure Timeline · ${prodId}`;

    const productTypeSelectorHtml = isCreateMode
  ? `
    <div class="structure-product-type-row">
      <label class="structure-drawer-label">
        Product Type
      </label>

      <select
        id="structureProductTypeSelect"
        class="structure-drawer-input"
      >
        <option value="">-- Select Product Type --</option>
        <option value="FIXED_BOND">Simple Fixed Bond</option>
        <option value="COMPLEX_BOND">Complex Bond</option>
        <option value="FRN">Simple FRN</option>
      </select>
    </div>
  `
  : '';

  // Keep positioning here for now.
  // Visual styling belongs to css/products/structureTimeline.css
  modal.style.position = 'fixed';
  modal.style.top = '40px';
  modal.style.left = '40px';
  modal.style.width = '1400px';
  modal.style.height = '800px';
  modal.style.zIndex = '999999';
  modal.style.overflow = 'auto';

  modal.innerHTML = `
    <button
      id="closeStructureTimelineModal"
      class="close structure-timeline-close"
      type="button"
      aria-label="Close Structure Timeline"
    >
      &times;
    </button>

    <div class="structure-timeline-header">
      <h2 class="structure-timeline-title">
        ${titleText}
      </h2>

      ${productTypeSelectorHtml}

<div class="structure-timeline-actions">
  ${
    isCreateMode || options.templateName === 'COMPLEX_BOND' || !options.templateName
      ? `
        <button
          id="toggleProductSetupDrawer"
          class="structure-action-button"
          type="button"
        >
          Product Setup
        </button>

        <button
          id="toggleModelSetupDrawer"
          class="structure-action-button"
          type="button"
          ${isCreateMode ? 'disabled' : ''}
          title="${isCreateMode ? 'Create and save the product first.' : ''}"
        >
          Model Setup
        </button>
      `
      : `
        <button
          id="toggleSimpleProductDataDrawer"
          class="structure-action-button"
          type="button"
        >
          Product Data
        </button>
      `
  }

  <button
    id="toggleProductValuationDrawer"
    class="structure-action-button"
    type="button"
    ${isCreateMode ? 'disabled' : ''}
    title="${isCreateMode ? 'Create and save the product first.' : ''}"
  >
    Valuation
  </button>
</div>
    </div>

    <div
      id="structureProductSetupDrawer"
      class="structure-setup-drawer"
      style="display:none;"
    ></div>

    <div
      id="structureModelSetupDrawer"
      class="structure-setup-drawer"
      style="display:none;"
    ></div>

    <div
      id="structureProductValuationDrawer"
      class="structure-setup-drawer"
      style="display:none;"
    ></div>

    <div class="table structure-timeline-table-shell">
      <div
        id="structureTimelineContainer"
        class="data-container structure-timeline-container"
      ></div>
    </div>
  `;

  document
    .getElementById('closeStructureTimelineModal')
    ?.addEventListener('click', () => {
      modal.remove();
    });

  const productSetupDrawer = document.getElementById('structureProductSetupDrawer');
  const modelSetupDrawer = document.getElementById('structureModelSetupDrawer');
  const timelineContainer = document.getElementById('structureTimelineContainer');
  const productValuationDrawer = document.getElementById('structureProductValuationDrawer');

  function reopenAfterCreate(newProdId, templateName = options.templateName || 'COMPLEX_BOND') {
    if (!newProdId) return;

    setTimeout(() => {
      handleStructureTimelineModal(newProdId, {
        mode: 'edit',
        source: 'after-create',
        templateName,
      });
    }, 900);
  }

  function openProductSetupDrawer() {
    if (!productSetupDrawer) return;

    if (modelSetupDrawer) {
      modelSetupDrawer.style.display = 'none';
    }

    if (productValuationDrawer) {
      productValuationDrawer.style.display = 'none';
    }

    renderProductSetupDrawer(productSetupDrawer, prodId, {
      ...options,
      onCreated: (newProdId) => reopenAfterCreate(
        newProdId,
        options.templateName || 'COMPLEX_BOND'
      ),
    });
    productSetupDrawer.style.display = 'block';
  }

  function openModelSetupDrawer() {
    if (isCreateMode) return;
    if (!modelSetupDrawer) return;

    if (productSetupDrawer) {
      productSetupDrawer.style.display = 'none';
    }

    if (productValuationDrawer) {
      productValuationDrawer.style.display = 'none';
    }

    renderModelSetupDrawer(modelSetupDrawer, prodId, options);
    modelSetupDrawer.style.display = 'block';
  }

  function openProductValuationDrawer() {
    if (isCreateMode) return;
    if (!productValuationDrawer) return;

    if (productSetupDrawer) {
      productSetupDrawer.style.display = 'none';
    }

    if (modelSetupDrawer) {
      modelSetupDrawer.style.display = 'none';
    }

    renderProductValuationDrawer(productValuationDrawer, prodId, {
      ...options,
      mode: 'edit',
      onClose: () => {
        const templateName = options.templateName || '';

        if (!productSetupDrawer) return;

        if (templateName === 'FIXED_BOND') {
          renderSimpleFixedDrawer(productSetupDrawer, prodId, {
            ...options,
            mode: 'edit',
            templateName: 'FIXED_BOND',
          });

          productSetupDrawer.style.display = 'block';
          return;
        }

        if (templateName === 'FRN') {
          renderSimpleFrnDrawer(productSetupDrawer, prodId, {
            ...options,
            mode: 'edit',
            templateName: 'FRN',
          });

          productSetupDrawer.style.display = 'block';
          return;
        }

        renderProductSetupDrawer(productSetupDrawer, prodId, {
          ...options,
          mode: 'edit',
          templateName: 'COMPLEX_BOND',
          onCreated: (newProdId) => reopenAfterCreate(
            newProdId,
            options.templateName || 'COMPLEX_BOND'
          ),
        });

        productSetupDrawer.style.display = 'block';
      },
    });

    productValuationDrawer.style.display = 'block';
  }

  document
    .getElementById('toggleProductSetupDrawer')
    ?.addEventListener('click', () => {
      if (!productSetupDrawer) return;

      const isOpen = productSetupDrawer.style.display !== 'none';

      if (isOpen) {
        productSetupDrawer.style.display = 'none';
        return;
      }

      openProductSetupDrawer();
    });

  document
    .getElementById('toggleModelSetupDrawer')
    ?.addEventListener('click', () => {
      if (!modelSetupDrawer || isCreateMode) return;

      const isOpen = modelSetupDrawer.style.display !== 'none';

      if (isOpen) {
        modelSetupDrawer.style.display = 'none';
        return;
      }

      openModelSetupDrawer();
    });
    
  document
    .getElementById('toggleSimpleProductDataDrawer')
    ?.addEventListener('click', () => {
      if (isCreateMode || !productSetupDrawer) return;

      if (productValuationDrawer) {
        productValuationDrawer.style.display = 'none';
      }

      if (modelSetupDrawer) {
        modelSetupDrawer.style.display = 'none';
      }

      const isOpen = productSetupDrawer.style.display !== 'none';

      if (isOpen) {
        productSetupDrawer.style.display = 'none';
        return;
      }

      if (options.templateName === 'FIXED_BOND') {
        renderSimpleFixedDrawer(productSetupDrawer, prodId, {
          ...options,
          mode: 'edit',
          templateName: 'FIXED_BOND',
        });

        productSetupDrawer.style.display = 'block';
        return;
      }

      if (options.templateName === 'FRN') {
        renderSimpleFrnDrawer(productSetupDrawer, prodId, {
          ...options,
          mode: 'edit',
          templateName: 'FRN',
        });

        productSetupDrawer.style.display = 'block';
      }
    });

  document
    .getElementById('toggleProductValuationDrawer')
    ?.addEventListener('click', () => {
      if (!productValuationDrawer || isCreateMode) return;

      const isOpen = productValuationDrawer.style.display !== 'none';

      if (isOpen) {
        productValuationDrawer.style.display = 'none';
        return;
      }

      openProductValuationDrawer();
    });  

  if (isCreateMode) {
    const productTypeSelect = document.getElementById('structureProductTypeSelect');

    if (timelineContainer) {
      timelineContainer.innerHTML = `
        <div style="padding:16px; opacity:0.75;">
          Select a Product Type above to start creating a new product.
        </div>
      `;
    }

    productTypeSelect?.addEventListener('change', () => {
      const templateName = productTypeSelect.value;

      if (!templateName || !productSetupDrawer) return;

      if (modelSetupDrawer) {
        modelSetupDrawer.style.display = 'none';
      }

      if (templateName === 'FIXED_BOND') {
        renderSimpleFixedDrawer(productSetupDrawer, null, {
          ...options,
          mode: 'create',
          templateName: 'FIXED_BOND',
          onCreated: (newProdId) => reopenAfterCreate(newProdId, 'FIXED_BOND'),
        });

        productSetupDrawer.style.display = 'block';

        if (timelineContainer) {
          timelineContainer.innerHTML = `
            <div style="padding:16px; opacity:0.75;">
              Simple Fixed Bond does not require a structure timeline.
            </div>
          `;
        }

        return;
      }

      if (templateName === 'FRN') {
        renderSimpleFrnDrawer(productSetupDrawer, null, {
          ...options,
          mode: 'create',
          templateName: 'FRN',
          onCreated: (newProdId) => reopenAfterCreate(newProdId, 'FRN'),
        });

        productSetupDrawer.style.display = 'block';

        if (timelineContainer) {
          timelineContainer.innerHTML = `
            <div style="padding:16px; opacity:0.75;">
              Simple FRN does not require a structure timeline.
            </div>
          `;
        }

        return;
      }

      if (templateName === 'COMPLEX_BOND') {
        renderProductSetupDrawer(productSetupDrawer, null, {
          ...options,
          mode: 'create',
          templateName: 'COMPLEX_BOND',
          onCreated: (newProdId) => reopenAfterCreate(newProdId, 'COMPLEX_BOND'),
        });

        productSetupDrawer.style.display = 'block';

        if (timelineContainer) {
          timelineContainer.innerHTML = `
            <div style="padding:16px; opacity:0.75;">
              Create and save the product first. The structure timeline will become available after the product exists.
            </div>
          `;
        }
      }
    });



    return;
  }

  const editTemplateName =
    options.templateName ||
    '';

  if (editTemplateName === 'FIXED_BOND') {
    if (productSetupDrawer) {
      renderSimpleFixedDrawer(productSetupDrawer, prodId, {
        ...options,
        mode: 'edit',
        templateName: 'FIXED_BOND',
      });

      productSetupDrawer.style.display = 'block';
    }

    if (timelineContainer) {
      timelineContainer.innerHTML = `
        <div style="padding:16px; opacity:0.75;">
          Simple Fixed Bond does not require a structure timeline.
        </div>
      `;
    }

    return;
  }

  if (editTemplateName === 'FRN') {
    if (productSetupDrawer) {
      renderSimpleFrnDrawer(productSetupDrawer, prodId, {
        ...options,
        mode: 'edit',
        templateName: 'FRN',
      });

      productSetupDrawer.style.display = 'block';
    }

    if (timelineContainer) {
      timelineContainer.innerHTML = `
        <div style="padding:16px; opacity:0.75;">
          Simple FRN does not require a structure timeline.
        </div>
      `;
    }

    return;
  }

  renderStructureTimelineGrid(
    timelineContainer,
    prodId
  );
}