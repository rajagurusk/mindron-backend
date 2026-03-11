const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const fs = require('fs');
const generate80G = require('./utils/generate80G');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 5000;

/* ================= MIDDLEWARE ================= */
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

/* ================= MONGODB CONNECTION ================= */
async function connectDB() {
  try {
    if (!process.env.MONGODB_URI) {
      console.error('❌ MONGODB_URI missing in .env');
      process.exit(1);
    }

    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000
    });

    console.log('✅ MongoDB connected successfully');
  } catch (error) {
    console.error('❌ MongoDB connection failed');
    console.error(error.message);
    process.exit(1);
  }
}

connectDB();

/* ================= SCHEMAS ================= */
const Subscriber = mongoose.model(
  'Subscriber',
  new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    subscribedAt: { type: Date, default: Date.now }
  })
);

const Contact = mongoose.model(
  'Contact',
  new mongoose.Schema({
    fullname: String,
    email: String,
    subject: String,
    phone: String,
    message: String,
    sentAt: { type: Date, default: Date.now }
  })
);

const Helpdesk = mongoose.model(
  'Helpdesk',
  new mongoose.Schema({
    name: String,
    phone: String,
    email: String,
    type: String,
    orgName: String,
    enquiry: String,
    sentAt: { type: Date, default: Date.now }
  })
);

const Donation = mongoose.model(
  'Donation',
  new mongoose.Schema({
    fullName: String,
    mobileNumber: String,
    email: String,
    address: String,
    country: String,
    pincode: String,
    state: String,
    city: String,
    panNumber: String,
    amount: Number,
    termsAccepted: Boolean,
    communicationConsent: Boolean,
    razorpay_payment_id: String,
    razorpay_order_id: String,
    razorpay_signature: String,
    paidAt: { type: Date, default: Date.now }
  })
);

/* ================= EMAIL ================= */
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

/* ================= RAZORPAY ================= */
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

/* ================= ROUTES ================= */

// ================= SUBSCRIBE =================
app.post('/subscribe', async (req, res) => {
  const { email } = req.body;

  try {
    await Subscriber.create({ email });

    await transporter.sendMail({
      from: `"Mindron Foundation" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Welcome to Mindron Foundation',
      html: `
        <p>Dear Subscriber,</p>
        <p>Thank you for subscribing to <b>Mindron Foundation</b>.</p>
        <p>You’ll receive updates about our initiatives and activities.</p>
        <p>Warm regards,<br>Mindron Foundation</p>
      `
    });

    res.status(201).json({ message: 'Subscribed successfully' });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: 'Email already subscribed' });
    }
    console.error('Subscribe error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ================= CONTACT =================
app.post('/contact', async (req, res) => {
  const { fullname, email, subject, phone, message } = req.body;

  try {
    await Contact.create({ fullname, email, subject, phone, message });

    await transporter.sendMail({
      from: `"Website Contact" <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_USER,
      subject: `Contact Form: ${subject}`,
      html: `
        <h3>New Contact Form Submission</h3>
        <p><b>Name:</b> ${fullname}</p>
        <p><b>Email:</b> ${email}</p>
        <p><b>Phone:</b> ${phone}</p>
        <p><b>Message:</b> ${message}</p>
      `
    });

    res.json({ message: 'Message received successfully' });
  } catch (err) {
    console.error('Contact error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ================= HELPDESK =================
app.post('/helpdesk', async (req, res) => {
  const { name, phone, email, type, orgName, enquiry } = req.body;

  try {
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
        <p><b>Organization:</b> ${orgName}</p>
        <p><b>Enquiry:</b> ${enquiry}</p>
      `
    });

    res.json({ message: 'Helpdesk enquiry submitted' });
  } catch (err) {
    console.error('Helpdesk error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ================= DONATION ORDER =================
app.post('/donate/order', async (req, res) => {
  try {
    const order = await razorpay.orders.create({
      amount: Math.round(req.body.amount * 100),
      currency: 'INR',
      receipt: 'donation_' + Date.now()
    });

    res.json({ success: true, order });
  } catch (err) {
    console.error('Donation order error:', err.message);
    res.status(500).json({ success: false, message: 'Order creation failed' });
  }
});

// ================= DONATION VERIFY + 80G =================
app.post('/donate/verify', async (req, res) => {
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
    razorpay_signature
  } = req.body;

  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex');

  if (expectedSignature !== razorpay_signature) {
    return res.status(400).json({ success: false, message: 'Invalid signature' });
  }

  try {
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
      razorpay_signature
    });

    const is80GEligible = !!panNumber;
    let attachments = [];

    if (is80GEligible) {
      const receiptNo = `MF80G-${Date.now()}`;

      const pdfPath = await generate80G({
        receiptNo,
        panNumber,
        fullName,
        amount,
        amountWords: `Rupees ${amount} Only`,
        donationDate: new Date().toLocaleDateString('en-IN'),
        transactionId: razorpay_payment_id,
        paymentMode: 'Online (Razorpay)'
      });

      attachments.push({
        filename: '80G-Certificate.pdf',
        path: pdfPath
      });
    }

    await transporter.sendMail({
      from: `"Mindron Foundation" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: is80GEligible
        ? '80G Donation Receipt – Mindron Foundation'
        : 'Thank you for your donation!',
      html: `
        <p>Dear ${fullName},</p>
        <p>Thank you for your donation of Rs. ${amount}.</p>
        ${is80GEligible ? '<p>Your <b>80G certificate</b> is attached.</p>' : ''}
        <p>Regards,<br>Mindron Foundation</p>
      `,
      attachments
    });

    if (attachments.length && fs.existsSync(attachments[0].path)) {
      fs.unlinkSync(attachments[0].path);
    }

    res.json({ success: true, message: 'Donation successful' });
  } catch (err) {
    console.error('Donation verify error:', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.get('/', (req, res) => {
  res.json({ status: 'Backend running' });
});

/* ================= SERVER ================= */
app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});