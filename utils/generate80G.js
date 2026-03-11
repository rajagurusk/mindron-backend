const fs = require("fs");
const path = require("path");
const { PDFDocument, rgb, StandardFonts } = require("pdf-lib");

module.exports = async function generate80G(data) {
  const {
    receiptNo = "",
    panNumber = "",
    fullName = "",
    amount = "",
    donationDate = "",
    transactionId = "",
    paymentMode = ""
  } = data;

  const templatePath = path.join(__dirname, "../templates/80g.pdf");
  const outputDir = path.join(__dirname, "../certificates/generated");

  if (!fs.existsSync(templatePath)) {
    throw new Error(`80G template not found at: ${templatePath}`);
  }

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const safeReceiptNo = String(receiptNo).replace(/[^\w-]/g, "_");
  const outputPath = path.join(outputDir, `80G_${safeReceiptNo || "receipt"}.pdf`);

  const templateBytes = fs.readFileSync(templatePath);
  const pdfDoc = await PDFDocument.load(templateBytes);
  const page = pdfDoc.getPages()[0];

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const black = rgb(0, 0, 0);

  const pageHeight = page.getHeight();

  function sanitize(value) {
    return String(value ?? "").replace(/₹/g, "Rs.");
  }

  function fitFontSize(text, maxWidth, startSize = 10, minSize = 7, useFont = font) {
    let size = startSize;
    while (size > minSize && useFont.widthOfTextAtSize(text, size) > maxWidth) {
      size -= 0.5;
    }
    return size;
  }

  /**
   * Draw text inside a box
   * x, y = top-left of box (from PDF bottom-left converted internally)
   */
  function drawTextInBox({
    text,
    x,
    y,
    width,
    height = 12,
    align = "left", // left, center, right
    valign = "middle", // top, middle, bottom
    size = 10,
    minSize = 7,
    useFont = font,
    color = black,
    padding = 2
  }) {
    text = sanitize(text);

    const fittedSize = fitFontSize(text, width - padding * 2, size, minSize, useFont);
    const textWidth = useFont.widthOfTextAtSize(text, fittedSize);
    const textHeight = fittedSize;

    let drawX = x + padding;
    if (align === "center") {
      drawX = x + (width - textWidth) / 2;
    } else if (align === "right") {
      drawX = x + width - textWidth - padding;
    }

    let drawY;
    if (valign === "top") {
      drawY = pageHeight - y - textHeight;
    } else if (valign === "bottom") {
      drawY = pageHeight - y - height + padding;
    } else {
      drawY = pageHeight - y - (height / 2) - (textHeight / 2) + 1;
    }

    page.drawText(text, {
      x: drawX,
      y: drawY,
      size: fittedSize,
      font: useFont,
      color
    });
  }

  /* =========================================================
     FIELD POSITIONS
     These values are based on your shown template.
     If needed, adjust only these values by 2-5 points.
     x, y here are from TOP-LEFT for easier adjustment.
  ========================================================= */

  const fields = {
    // Top left details
    receiptNo: { x: 115, y: 78, width: 120, height: 14, align: "left" },
    panNumber: { x: 115, y: 95, width: 140, height: 14, align: "left" },

    // Under "Dear"
    fullNameTop: { x: 65, y: 140, width: 180, height: 14, align: "left" },

    // Thank you line amount after "Rs"
    amountTop: { x: 300, y: 145, width: 60, height: 14, align: "center" },

    // Date near left signature area
    receiptDateTop: { x: 95, y: 330, width: 110, height: 14, align: "left" },

    // Middle heading line transaction id beside pay_
    transactionTop: { x: 378, y: 356, width: 145, height: 14, align: "left" },

    // Name in middle sentence "from Mr/Ms/Mrs ____"
    fullNameMiddle: { x: 105, y: 392, width: 150, height: 14, align: "left" },

    // Amount in middle sentence before "as per details below"
    amountMiddle: { x: 450, y: 392, width: 70, height: 14, align: "center" },

    // Right column of table
    tableDonationDate: { x: 332, y: 455, width: 210, height: 20, align: "center" },
    tableTransactionId: { x: 332, y: 480, width: 210, height: 20, align: "center" },
    tablePaymentMode: { x: 332, y: 503, width: 210, height: 20, align: "center" },
    tableAmountNumber: { x: 332, y: 525, width: 210, height: 20, align: "center" },
    tableAmountWords: { x: 332, y: 548, width: 210, height: 20, align: "center" }
  };

  /* ================= HEADER ================= */

  drawTextInBox({
    text: receiptNo,
    ...fields.receiptNo,
    size: 10
  });

  drawTextInBox({
    text: panNumber || "-",
    ...fields.panNumber,
    size: 10
  });

  /* ================= DEAR NAME ================= */

  drawTextInBox({
    text: fullName,
    ...fields.fullNameTop,
    size: 10
  });

  /* ================= THANK YOU LINE AMOUNT ================= */

  drawTextInBox({
    text: amount,
    ...fields.amountTop,
    size: 10
  });

  /* ================= LOWER DATE ================= */

  drawTextInBox({
    text: donationDate,
    ...fields.receiptDateTop,
    size: 9
  });

  /* ================= DONATION RECEIPT TXN ================= */

  drawTextInBox({
    text: transactionId,
    ...fields.transactionTop,
    size: 9
  });

  /* ================= MIDDLE NAME + AMOUNT ================= */

  drawTextInBox({
    text: fullName,
    ...fields.fullNameMiddle,
    size: 9
  });

  drawTextInBox({
    text: amount,
    ...fields.amountMiddle,
    size: 9
  });

  /* ================= TABLE RIGHT COLUMN ================= */

  drawTextInBox({
    text: donationDate,
    ...fields.tableDonationDate,
    size: 9
  });

  drawTextInBox({
    text: transactionId,
    ...fields.tableTransactionId,
    size: 8
  });

  drawTextInBox({
    text: paymentMode,
    ...fields.tablePaymentMode,
    size: 9
  });

  drawTextInBox({
    text: `INR ${amount}`,
    ...fields.tableAmountNumber,
    size: 9
  });

  drawTextInBox({
    text: `${amount} Only`,
    ...fields.tableAmountWords,
    size: 9
  });

  /* ================= SAVE ================= */

  const finalPdf = await pdfDoc.save();
  fs.writeFileSync(outputPath, finalPdf);

  return outputPath;
};