const fs = require("fs");
const path = require("path");
const { PDFDocument, rgb, StandardFonts } = require("pdf-lib");

module.exports = async function generate80G(data) {
  const {
    receiptNo,
    panNumber,
    fullName,
    amount,
    donationDate,
    transactionId,
    paymentMode
  } = data;

  const templatePath = path.join(__dirname, "../templates/80g.pdf");
  const outputDir = path.join(__dirname, "../certificates/generated");

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const outputPath = path.join(outputDir, `80G_${receiptNo}.pdf`);

  const templateBytes = fs.readFileSync(templatePath);
  const pdfDoc = await PDFDocument.load(templateBytes);
  const page = pdfDoc.getPages()[0];

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const black = rgb(0, 0, 0);
  const size = 10;

  /* ================= HEADER ================= */

  // Receipt No
  page.drawText(receiptNo, {
    x: 140,
    y: 742,
    size,
    font,
    color: black
  });

  // PAN No
  page.drawText(panNumber || "-", {
    x: 140,
    y: 724,
    size,
    font,
    color: black
  });

  /* ================= DEAR NAME ================= */

  page.drawText(fullName, {
    x: 85,
    y: 690,
    size,
    font,
    color: black
  });

  /* ================= AMOUNT IN THANK YOU LINE ================= */

  page.drawText(`${amount}`, {
    x: 310,  // EXACT blank space after Rs
    y: 668,
    size,
    font,
    color: black
  });

  /* ================= TABLE RIGHT COLUMN ================= */

  const tableX = 360; // left padding inside right box

  page.drawText(donationDate, {
    x: tableX,
    y: 600,
    size,
    font,
    color: black
  });

  page.drawText(transactionId, {
    x: tableX,
    y: 460,
    size,
    font,
    color: black
  });

  page.drawText(paymentMode, {
    x: tableX,
    y: 565,
    size,
    font,
    color: black
  });

  page.drawText(`INR ${amount}`, {
    x: tableX,
    y: 550,
    size,
    font,
    color: black
  });

  /* ================= NAME BESIDE MR/MS/MRS ================= */

  page.drawText(fullName, {
    x: 270,   // exactly after Mr/Ms/Mrs
    y: 360,
    size,
    font,
    color: black
  });

  /* ================= SAVE ================= */

  const finalPdf = await pdfDoc.save();
  fs.writeFileSync(outputPath, finalPdf);

  return outputPath;
};
