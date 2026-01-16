// generatePDF.js (Node / Main process)
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

/**
 * Small helper: safe string.
 */
function s(v) {
  return String(v ?? '').trim();
}

/**
 * Optional: format timestamp
 */
function formatDateTime(d = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Draw cover page (you can extend later with logo, subtitle, etc.)
 */
function drawCoverPage(doc, { title, subtitle, metaLines = [] }) {
  doc.addPage();

  doc.fontSize(24).text(title || 'Report', { align: 'center' });
  doc.moveDown(0.5);

  if (subtitle) {
    doc.fontSize(12).fillColor('#444').text(subtitle, { align: 'center' });
    doc.fillColor('#000');
    doc.moveDown(1);
  } else {
    doc.moveDown(1);
  }

  if (metaLines.length) {
    doc.fontSize(10).fillColor('#555');
    metaLines.forEach((line) => doc.text(line, { align: 'center' }));
    doc.fillColor('#000');
  }

  // leave some space, next content starts later (or you can keep cover alone)
  doc.moveDown(2);
}

/**
 * Render body table-ish content (placeholder; customize to your needs)
 */
function drawBody(doc, data) {
  // Start body on a new page (so cover is clean)
  doc.addPage();

  doc.fontSize(16).text('Data', { underline: true });
  doc.moveDown(0.75);

  data.forEach((item) => {
    doc.fontSize(12).text(`ID: ${s(item.id)}`);
    doc.fontSize(12).text(`Name: ${s(item.name)}`);
    doc.fontSize(12).text(`Value: ${s(item.value)}`);
    doc.moveDown();
  });
}

/**
 * Core PDF generator.
 *
 * @param {Array<object>} data - data rows
 * @param {string} outputPath - where to write the PDF
 * @param {object} options
 * @param {string} options.reportTitle - title shown on cover / header
 * @param {string} options.subtitle - optional subtitle
 */
function generatePdf(data, outputPath, options = {}) {
  const reportTitle = s(options.reportTitle) || 'Report';
  const subtitle = s(options.subtitle) || '';

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  const doc = new PDFDocument({
    autoFirstPage: false, // we control pages explicitly (cover/body)
    margins: { top: 50, bottom: 50, left: 50, right: 50 },
    size: 'A4',
  });

  doc.pipe(fs.createWriteStream(outputPath));

  // --- Cover page ---
  drawCoverPage(doc, {
    title: reportTitle,
    subtitle: subtitle || 'Customer Report',
    metaLines: [
      `Generated: ${formatDateTime(new Date())}`,
    ],
  });

  // --- Body ---
  drawBody(doc, Array.isArray(data) ? data : []);

  doc.end();
}

/**
 * Fetch rows from an arbitrary query (parametrized) and generate PDF.
 *
 * @param {string} dbPath
 * @param {string} outputPath
 * @param {object} options
 * @param {string} options.query - SQL query
 * @param {Array<any>} options.params - SQL params
 * @param {string} options.reportTitle - report title for cover/header
 * @param {string} options.subtitle - optional subtitle
 */
function fetchDataAndGeneratePdf(dbPath, outputPath, options = {}) {
  const query = options.query || 'SELECT * FROM your_table_name';
  const params = Array.isArray(options.params) ? options.params : [];

  const db = new sqlite3.Database(dbPath);

  db.all(query, params, (err, rows) => {
    // ensure close happens exactly once
    db.close(() => {});

    if (err) throw err;

    generatePdf(rows, outputPath, {
      reportTitle: options.reportTitle,
      subtitle: options.subtitle,
    });
  });
}

/**
 * Optional helper: if you only pass presetName, resolve title from CustomerReports table.
 * Assumes a table like: CustomerReports(name TEXT PRIMARY KEY, state_json TEXT, type TEXT, ...)
 *
 * @param {string} dbPath
 * @param {string} presetName
 * @returns {Promise<string>}
 */
function fetchReportTitleFromCustomerReports(dbPath, presetName) {
  const name = s(presetName);
  if (!name) return Promise.resolve('');

  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath);
    db.get(
      'SELECT name FROM CustomerReports WHERE name = ? LIMIT 1',
      [name],
      (err, row) => {
        db.close(() => {});
        if (err) return reject(err);
        resolve(s(row?.name));
      }
    );
  });
}

/**
 * Convenience: generate using presetName as title (and verify it exists in DB).
 *
 * @param {string} dbPath
 * @param {string} outputPath
 * @param {object} options
 * @param {string} options.presetName
 * @param {string} options.query
 * @param {Array<any>} options.params
 */
async function fetchDataAndGeneratePdfForPreset(dbPath, outputPath, options = {}) {
  const presetName = s(options.presetName);
  const title = await fetchReportTitleFromCustomerReports(dbPath, presetName).catch(() => presetName);

  return fetchDataAndGeneratePdf(dbPath, outputPath, {
    ...options,
    reportTitle: title || presetName || options.reportTitle,
  });
}

module.exports = {
  generatePdf,
  fetchDataAndGeneratePdf,
  fetchReportTitleFromCustomerReports,
  fetchDataAndGeneratePdfForPreset,
};
