const PDFDocument = require('pdfkit');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

function generatePdf(data, outputPath) {
    const doc = new PDFDocument();
    doc.pipe(fs.createWriteStream(outputPath));

    doc.fontSize(25).text('Report', { align: 'center' });

    data.forEach(item => {
        doc.fontSize(12).text(`ID: ${item.id}`);
        doc.fontSize(12).text(`Name: ${item.name}`);
        doc.fontSize(12).text(`Value: ${item.value}`);
        doc.moveDown();
    });

    doc.end();
}

function fetchDataAndGeneratePdf(dbPath, outputPath) {
    let db = new sqlite3.Database(dbPath);
//REMINDER: insert selected port/compare
    db.all('SELECT * FROM your_table_name', [], (err, rows) => {
        if (err) {
            throw err;
        }
        generatePdf(rows, outputPath);
    });

    db.close();
}

module.exports = { fetchDataAndGeneratePdf };