import { SIMPLE_FIXED_BOND_TEMPLATE } from './templates/simpleFixedBondTemplate.js';
import { SIMPLE_FRN_TEMPLATE } from './templates/simpleFRNTemplate.js';
import { COMPLEX_BOND_TEMPLATE } from './templates/complexBondTemplate.js';

export const PRODUCT_TEMPLATE_KEYS = {
  FIXED_BOND: 'FIXED_BOND',
  FRN: 'FRN',
  COMPLEX_BOND: 'COMPLEX_BOND',
};

export const PRODUCT_TEMPLATES = {
  [PRODUCT_TEMPLATE_KEYS.FIXED_BOND]: SIMPLE_FIXED_BOND_TEMPLATE,
  [PRODUCT_TEMPLATE_KEYS.FRN]: SIMPLE_FRN_TEMPLATE,
  [PRODUCT_TEMPLATE_KEYS.COMPLEX_BOND]: COMPLEX_BOND_TEMPLATE,
};

export function getProductTemplate(templateName) {
  return PRODUCT_TEMPLATES[templateName] || PRODUCT_TEMPLATES.COMPLEX_BOND;
}

export function getTemplateFieldSection(templateName, fieldName) {
  const template = getProductTemplate(templateName);

  if (!template?.sections) return null;

  for (const [sectionName, fields] of Object.entries(template.sections)) {
    if (Array.isArray(fields) && fields.includes(fieldName)) {
      return sectionName;
    }
  }

  return null;
}