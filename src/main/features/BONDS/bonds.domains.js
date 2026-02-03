'use strict';

// NEW clean API
const IPC_BONDS_PARSE_PDF = 'bonds:parsePdf';
const IPC_BONDS_PARSE_PDF_BATCH = 'bonds:parsePdfBatch';

// OPTIONAL legacy aliases (so you can remove index.js handlers immediately)
const IPC_BONDS_PARSE_PDF_LEGACY = 'bonds:parsePdfUrl';

module.exports = {
  IPC_BONDS_PARSE_PDF,
  IPC_BONDS_PARSE_PDF_BATCH,
  IPC_BONDS_PARSE_PDF_LEGACY,
};

