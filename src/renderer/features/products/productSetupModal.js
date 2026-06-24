// src/renderer/features/products/productSetupModal.js

'use strict';

import { renderStructureTimelineGrid } from './structureTimeline/complexTimelineGrid.js';
import { renderProductSetupDrawer } from './structureTimeline/complexProductSetupDrawer.js';
import { renderModelSetupDrawer } from './structureTimeline/complexModelSetupDrawer.js';
import { renderSimpleFixedDrawer } from './structureTimeline/simpleFixedDrawer.js';
import { renderSimpleFrnDrawer } from './structureTimeline/simpleFrnDrawer.js';
import { renderProductValuationDrawer } from './structureTimeline/valuationDrawer.js';
import { makeModalDraggable } from '../../core/ui/modal/draggableModal.js';


let activeStructureTimelineModal = {
  modal: null,
  prodId: null,
  options: null,
};

function bindProductsAppRefreshOnce() {
  if (window.__structureTimelineProductsRefreshBound) return;
  window.__structureTimelineProductsRefreshBound = true;

  window.addEventListener('products-app-data-refreshed', (event) => {

    const detail = event.detail || {};

    const preserveNextRefresh =
      window.__preserveStructureValuationOnNextProductRefresh;

    if (
      preserveNextRefresh &&
      String(preserveNextRefresh.productId || '').trim() === String(activeStructureTimelineModal?.prodId || '').trim()
    ) {
      console.log('[STRUCTURE TIMELINE] model setup saved - preserving valuation result', {
        prodId: preserveNextRefresh.productId,
        source: preserveNextRefresh.source,
      });

      window.__preserveStructureValuationOnNextProductRefresh = null;
      return;
    }

    if (detail.preserveValuationResult === true) {
      console.log('[STRUCTURE TIMELINE] product refresh received - preserving valuation result', {
        prodId: detail.productId,
        source: detail.source,
      });
      return;
    }

    const { modal, prodId, options } = activeStructureTimelineModal || {};
    if (!modal || !document.body.contains(modal) || !prodId) return;

    const valuationDrawer = modal.querySelector('#structureProductValuationDrawer');
    const modelDrawer = modal.querySelector('#structureModelSetupDrawer');

    // Critical: force valuation drawer to read fresh appState next time.
    if (valuationDrawer) {
      valuationDrawer.dataset.renderedForProdId = '';
    }

    // If valuation drawer is currently open, re-render immediately.
    if (valuationDrawer && valuationDrawer.style.display !== 'none') {
      console.log('[STRUCTURE TIMELINE] re-render valuation after product refresh', {
        prodId,
      });

      renderProductValuationDrawer(valuationDrawer, prodId, {
        ...(options || {}),
        mode: 'edit',
      });

      valuationDrawer.dataset.renderedForProdId = String(prodId || '').trim();
      valuationDrawer.style.display = 'block';
    }

    // Optional: keep Model Setup drawer fresh too, if it is open.
    if (modelDrawer && modelDrawer.style.display !== 'none') {
      renderModelSetupDrawer(modelDrawer, prodId, {
        ...(options || {}),
        mode: 'edit',
      });

      modelDrawer.style.display = 'block';
    }
  });
}



export function handleStructureTimelineModal(prodId, options = {}) {
  const mode = options.mode || 'edit';
  const isCreateMode = mode === 'create';

  bindProductsAppRefreshOnce();

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
    modal.style.position = 'fixed';
    modal.style.top = '40px';
    modal.style.left = '40px';
    modal.style.width = '1400px';
    modal.style.height = '800px';
    modal.style.zIndex = '999999';
    modal.style.overflow = 'hidden';
    document.body.appendChild(modal);
  }

  activeStructureTimelineModal = {
    modal,
    prodId,
    options,
  };

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
        <option value="FRN">Simple FRN</option>
        <option value="COMPLEX_BOND">Complex Bond</option>
      </select>
    </div>
  `
  : '';

  modal.innerHTML = `
    <div class="structure-timeline-drag-bar modal-drag-handle">
      <span class="structure-timeline-drag-title">${titleText}</span>
      <div class="structure-timeline-header-actions">
        <button
          id="toggleFullscreenStructureTimeline"
          class="structure-timeline-fullscreen"
          type="button"
          title="Fullscreen"
          aria-label="Fullscreen"
        >⛶</button>
        <button
          id="closeStructureTimelineModal"
          class="close structure-timeline-close"
          type="button"
          aria-label="Close Structure Timeline"
        >&times;</button>
      </div>
    </div>

    <div class="structure-timeline-body">
      <div class="structure-timeline-header">
        ${productTypeSelectorHtml}

<div class="structure-timeline-actions">
  ${
    isCreateMode || options.templateName === 'COMPLEX_BOND' || !options.templateName
      ? `
        <button
          id="toggleProductSetupDrawer"
          class="section-trigger structure-action-button"
          type="button"
        >
          <span class="section-header">Product Setup</span>
        </button>
      `
      : `
        <button
          id="toggleSimpleProductDataDrawer"
          class="section-trigger structure-action-button"
          type="button"
        >
          <span class="section-header">Product Data</span>
        </button>
      `
  }

  <button
    id="toggleModelSetupDrawer"
    class="section-trigger structure-action-button"
    type="button"
    ${isCreateMode ? 'disabled' : ''}
    title="${isCreateMode ? 'Create and save the product first.' : ''}"
  >
    <span class="section-header">Model Setup</span>
  </button>

  <button
    id="toggleProductValuationDrawer"
    class="section-trigger structure-action-button"
    type="button"
    ${isCreateMode ? 'disabled' : ''}
    title="${isCreateMode ? 'Create and save the product first.' : ''}"
  >
    <span class="section-header">Valuation</span>
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
    </div>
  `;

  makeModalDraggable(modal);

  document
    .getElementById('closeStructureTimelineModal')
    ?.addEventListener('click', () => {
      modal.remove();
    });

  // Fullscreen-Toggle: schaltet nur die Modifier-Klasse auf dem Root-Modal +
  // tauscht Symbol/Tooltip. Reiner UI-State, keine Logikänderung.
  document
    .getElementById('toggleFullscreenStructureTimeline')
    ?.addEventListener('click', (e) => {
      const btn = e.currentTarget;
      const isFullscreen = modal.classList.toggle('structure-timeline-modal--fullscreen');

      if (isFullscreen) {
        btn.textContent = '🗗';
        btn.title = 'Exit fullscreen';
        btn.setAttribute('aria-label', 'Exit fullscreen');
      } else {
        btn.textContent = '⛶';
        btn.title = 'Fullscreen';
        btn.setAttribute('aria-label', 'Fullscreen');
      }
    });

  const productSetupDrawer = document.getElementById('structureProductSetupDrawer');
  const modelSetupDrawer = document.getElementById('structureModelSetupDrawer');
  const timelineContainer = document.getElementById('structureTimelineContainer');
  const productValuationDrawer = document.getElementById('structureProductValuationDrawer');


  function setActiveDrawer(activeDrawer) {
  if (productSetupDrawer) {
    productSetupDrawer.style.display =
      activeDrawer === 'product' ? 'block' : 'none';
  }

  if (modelSetupDrawer) {
    modelSetupDrawer.style.display =
      activeDrawer === 'model' ? 'block' : 'none';
  }

  if (productValuationDrawer) {
    productValuationDrawer.style.display =
      activeDrawer === 'valuation' ? 'block' : 'none';
  }

  document
    .querySelectorAll(
      '#toggleProductSetupDrawer, #toggleSimpleProductDataDrawer, #toggleModelSetupDrawer, #toggleProductValuationDrawer'
    )
    .forEach((btn) => btn.classList.remove('active'));

  if (activeDrawer === 'product') {
    document.getElementById('toggleProductSetupDrawer')?.classList.add('active');
    document.getElementById('toggleSimpleProductDataDrawer')?.classList.add('active');
  }

  if (activeDrawer === 'model') {
    document.getElementById('toggleModelSetupDrawer')?.classList.add('active');
  }

  if (activeDrawer === 'valuation') {
    document.getElementById('toggleProductValuationDrawer')?.classList.add('active');
  }
}

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

    renderProductSetupDrawer(productSetupDrawer, prodId, {
      ...options,
      onCreated: (newProdId) => reopenAfterCreate(
        newProdId,
        options.templateName || 'COMPLEX_BOND'
      ),
    });

    setActiveDrawer('product');
  }

  function openModelSetupDrawer() {
    if (isCreateMode) return;
    if (!modelSetupDrawer) return;

    renderModelSetupDrawer(modelSetupDrawer, prodId, options);
    setActiveDrawer('model');
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

    const currentProdId = String(prodId || '').trim();
    const renderedForProdId = productValuationDrawer.dataset.renderedForProdId || '';

    if (renderedForProdId !== currentProdId) {
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

      productValuationDrawer.dataset.renderedForProdId = currentProdId;
    }

    setActiveDrawer('valuation');
  }

  document
    .getElementById('toggleProductSetupDrawer')
    ?.addEventListener('click', () => {
      if (!productSetupDrawer) return;
      openProductSetupDrawer();
    });

  document
    .getElementById('toggleModelSetupDrawer')
    ?.addEventListener('click', () => {
      if (!modelSetupDrawer || isCreateMode) return;
      openModelSetupDrawer();
    });
    
  document
    .getElementById('toggleSimpleProductDataDrawer')
    ?.addEventListener('click', () => {
      if (isCreateMode || !productSetupDrawer) return;

      if (options.templateName === 'FIXED_BOND') {
        renderSimpleFixedDrawer(productSetupDrawer, prodId, {
          ...options,
          mode: 'edit',
          templateName: 'FIXED_BOND',
        });

        setActiveDrawer('product');
        return;
      }

      if (options.templateName === 'FRN') {
        renderSimpleFrnDrawer(productSetupDrawer, prodId, {
          ...options,
          mode: 'edit',
          templateName: 'FRN',
        });

        setActiveDrawer('product');
      }
    });

  document
    .getElementById('toggleProductValuationDrawer')
    ?.addEventListener('click', () => {
      if (!productValuationDrawer || isCreateMode) return;
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

      setActiveDrawer('product');
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

      setActiveDrawer('product');
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