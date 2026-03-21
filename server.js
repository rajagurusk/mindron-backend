const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const nodemailer = require("nodemailer");
const Razorpay = require("razorpay");
const crypto = require("crypto");
const fs = require("fs");
const generate80G = require("./utils/generate80G");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 10000;

/* ================= MIDDLEWARE ================= */
const allowedOrigins = [
  "https://mindronfoundation.com",
  "https://www.mindronfoundation.com",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`CORS not allowed for this origin: ${origin}`));
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
  })
);

app.options(/.*/, cors());

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

/* ================= DEBUG ENV CHECK ================= */
console.log("PORT:", port);
console.log("MONGODB_URI exists:", !!process.env.MONGODB_URI);
console.log("EMAIL_USER exists:", !!process.env.EMAIL_USER);
console.log("EMAIL_PASS exists:", !!process.env.EMAIL_PASS);
console.log("RAZORPAY_KEY_ID exists:", !!process.env.RAZORPAY_KEY_ID);
console.log("RAZORPAY_KEY_SECRET exists:", !!process.env.RAZORPAY_KEY_SECRET);

/* ================= MONGODB CONNECTION ================= */
async function connectDB() {
  try {
    if (!process.env.MONGODB_URI) {
      console.error("❌ MONGODB_URI missing in environment variables");
      process.exit(1);
    }

    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000,
    });

    console.log("✅ MongoDB connected successfully");
  } catch (error) {
    console.error("❌ MongoDB connection failed");
    console.error(error.message);
    process.exit(1);
  }
}

connectDB();

/* ================= SCHEMAS ================= */
const subscriberSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, trim: true },
  subscribedAt: { type: Date, default: Date.now },
});

const contactSchema = new mongoose.Schema({
  fullname: { type: String, trim: true },
  email: { type: String, trim: true },
  subject: { type: String, trim: true },
  phone: { type: String, trim: true },
  message: { type: String, trim: true },
  sentAt: { type: Date, default: Date.now },
});

const helpdeskSchema = new mongoose.Schema({
  name: { type: String, trim: true },
  phone: { type: String, trim: true },
  email: { type: String, trim: true },
  type: { type: String, trim: true },
  orgName: { type: String, trim: true },
  enquiry: { type: String, trim: true },
  sentAt: { type: Date, default: Date.now },
});

const donationSchema = new mongoose.Schema({
  fullName: { type: String, trim: true },
  mobileNumber: { type: String, trim: true },
  email: { type: String, trim: true },
  address: { type: String, trim: true },
  country: { type: String, trim: true },
  pincode: { type: String, trim: true },
  state: { type: String, trim: true },
  city: { type: String, trim: true },
  panNumber: { type: String, trim: true },
  amount: Number,
  termsAccepted: Boolean,
  communicationConsent: Boolean,
  razorpay_payment_id: String,
  razorpay_order_id: String,
  razorpay_signature: String,
  paidAt: { type: Date, default: Date.now },
});

const Subscriber = mongoose.model("Subscriber", subscriberSchema);
const Contact = mongoose.model("Contact", contactSchema);
const Helpdesk = mongoose.model("Helpdesk", helpdeskSchema);
const Donation = mongoose.model("Donation", donationSchema);

/* ================= EMAIL ================= */
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

/* ================= HELPERS ================= */
function getRazorpayInstance() {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    throw new Error(
      "Razorpay keys are missing. Please set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in Render."
    );
  }

  return new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
}

/* ================= ROUTES ================= */
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Mindron backend is running",
  });
});

app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

/* ================= SUBSCRIBE ================= */
app.post("/subscribe", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    await Subscriber.create({ email });

    await transporter.sendMail({
      from: `"Mindron Foundation" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Welcome to Mindron Foundation",
      html: `
        <p>Dear Subscriber,</p>
        <p>Thank you for subscribing to <b>Mindron Foundation</b>.</p>
        <p>You’ll receive updates about our initiatives and activities.</p>
        <p>Warm regards,<br>Mindron Foundation</p>
      `,
    });

    res.status(201).json({ message: "Subscribed successfully" });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: "Email already subscribed" });
    }

    console.error("Subscribe error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/* ================= CONTACT ================= */
app.post("/contact", async (req, res) => {
  try {
    const { fullname, email, subject, phone, message } = req.body;

    if (!fullname || !email || !subject || !message) {
      return res.status(400).json({
        error: "Full name, email, subject and message are required",
      });
    }

    await Contact.create({ fullname, email, subject, phone, message });

    await transporter.sendMail({
      from: `"Website Contact" <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_USER,
      subject: `Contact Form: ${subject}`,
      html: `
        <h3>New Contact Form Submission</h3>
        <p><b>Name:</b> ${fullname}</p>
        <p><b>Email:</b> ${email}</p>
        <p><b>Phone:</b> ${phone || "N/A"}</p>
        <p><b>Message:</b> ${message}</p>
      `,
    });

    res.status(200).json({ message: "Message received successfully" });
  } catch (err) {
    console.error("Contact error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/* ================= HELPDESK ================= */
app.post("/helpdesk", async (req, res) => {
  try {
    const { name, phone, email, type, orgName, enquiry } = req.body;

    if (!name || !phone || !email || !type || !enquiry) {
      return res.status(400).json({
        error: "Name, phone, email, type and enquiry are required",
      });
    }

    await Helpdesk.create({ name, phone, email, type, orgName, enquiry });

    await transporter.sendMail({
      from: `"Helpdesk" <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_USER,
      subject: `Helpdesk Enquiry (${type})`,
      html: `
        <h3>New Helpdesk Enquiry</h3>
        <p><b>Name:</b> ${name}</p>
        <p><b>Email:</b> ${email}</p>
        <p><b>Phone:</b> ${phone}</p>
        <p><b>Type:</b> ${type}</p>
        <p><b>Organization:</b> ${orgName || "N/A"}</p>
        <p><b>Enquiry:</b> ${enquiry}</p>
      `,
    });

    res.status(200).json({ message: "Helpdesk enquiry submitted" });
  } catch (err) {
    console.error("Helpdesk error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/* ================= DONATION ORDER ================= */
app.post("/donate/order", async (req, res) => {
  try {
    const { amount } = req.body;

    if (!amount || Number(amount) <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid donation amount is required",
      });
    }

    const razorpay = getRazorpayInstance();

    const order = await razorpay.orders.create({
      amount: Math.round(Number(amount) * 100),
      currency: "INR",
      receipt: `donation_${Date.now()}`,
    });

    res.status(200).json({ success: true, order });
  } catch (err) {
    console.error("Donation order error:", err);
    res.status(500).json({
      success: false,
      message: err.message || "Order creation failed",
    });
  }
});

/* ================= DONATION VERIFY ================= */
app.post("/donate/verify", async (req, res) => {
  let pdfPath = null;

  try {
    const {
      fullName,
      mobileNumber,
      email,
      address,
      country,
      pincode,
      state,
      city,
      panNumber,
      amount,
      termsAccepted,
      communicationConsent,
      razorpay_payment_id,
      razorpay_order_id,
      razorpay_signature,
    } = req.body;

    if (
      !fullName ||
      !mobileNumber ||
      !email ||
      !amount ||
      !razorpay_payment_id ||
      !razorpay_order_id ||
      !razorpay_signature
    ) {
      return res.status(400).json({
        success: false,
        message: "Missing required payment details",
      });
    }

    if (!process.env.RAZORPAY_KEY_SECRET) {
      return res.status(500).json({
        success: false,
        message: "RAZORPAY_KEY_SECRET missing in server environment",
      });
    }

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: "Invalid signature",
      });
    }

    await Donation.create({
      fullName,
      mobileNumber,
      email,
      address,
      country,
      pincode,
      state,
      city,
      panNumber,
      amount,
      termsAccepted,
      communicationConsent,
      razorpay_payment_id,
      razorpay_order_id,
      razorpay_signature,
    });

    const is80GEligible = !!panNumber?.trim();
    const attachments = [];

    if (is80GEligible) {
      const receiptNo = `MF80G-${Date.now()}`;

      pdfPath = await generate80G({
        receiptNo,
        panNumber,
        fullName,
        amount,
        amountWords: `Rupees ${amount} Only`,
        donationDate: new Date().toLocaleDateString("en-IN"),
        transactionId: razorpay_payment_id,
        paymentMode: "Online (Razorpay)",
      });

      attachments.push({
        filename: "80G-Certificate.pdf",
        path: pdfPath,
      });
    }

    await transporter.sendMail({
      from: `"Mindron Foundation" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: is80GEligible
        ? "80G Donation Receipt – Mindron Foundation"
        : "Thank you for your donation!",
      html: `
        <p>Dear ${fullName},</p>
        <p>Thank you for your donation of Rs. ${amount}.</p>
        ${
          is80GEligible
            ? "<p>Your <b>80G certificate</b> is attached with this email.</p>"
            : ""
        }
        <p>Regards,<br>Mindron Foundation</p>
      `,
      attachments,
    });

    if (pdfPath && fs.existsSync(pdfPath)) {
      fs.unlinkSync(pdfPath);
    }

    res.status(200).json({
      success: true,
      message: "Donation successful",
    });
  } catch (err) {
    if (pdfPath && fs.existsSync(pdfPath)) {
      fs.unlinkSync(pdfPath);
    }

    console.error("Donation verify error:", err);
    res.status(500).json({
      success: false,
      message: err.message || "Server error",
    });
  }
});

/* ================= 404 ================= */
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

/* ================= GLOBAL ERROR HANDLER ================= */
app.use((err, req, res, next) => {
  console.error("Global error:", err);
  res.status(500).json({
    success: false,
    message: err.message || "Internal server error",
  });
});

app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});