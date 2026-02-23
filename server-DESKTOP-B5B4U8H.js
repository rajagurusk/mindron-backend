const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const Razorpay = require('razorpay');
const crypto = require('crypto');
require('dotenv').config(); // Load environment variables

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' })); // Increased limit for larger payloads
app.use(bodyParser.urlencoded({ extended: true }));

// MongoDB connection - FIXED: Removed deprecated options
const mongoURI = process.env.MONGODB_URI || 'mongodb+srv://mindronfoundation:mindronfoundation@mindronfoundation.wbkepnb.mongodb.net/test';

mongoose.connect(mongoURI)
  .then(() => console.log('✅ MongoDB connected successfully'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// Graceful shutdown
process.on('SIGINT', async () => {
  await mongoose.connection.close();
  console.log('MongoDB connection closed through app termination');
  process.exit(0);
});

// Subscriber schema
const subscriberSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  subscribedAt: { type: Date, default: Date.now }
});
const Subscriber = mongoose.model('Subscriber', subscriberSchema);

// Contact schema
const contactSchema = new mongoose.Schema({
  fullname: String,
  email: String,
  subject: String,
  phone: String,
  message: String,
  sentAt: { type: Date, default: Date.now }
});
const Contact = mongoose.model('Contact', contactSchema);

// Helpdesk schema
const helpdeskSchema = new mongoose.Schema({
  name: String,
  phone: String,
  email: String,
  type: String,
  orgName: String,
  enquiry: String,
  sentAt: { type: Date, default: Date.now }
});
const Helpdesk = mongoose.model('Helpdesk', helpdeskSchema);

// Donation schema
const donationSchema = new mongoose.Schema({
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
});
const Donation = mongoose.model('Donation', donationSchema);

// Nodemailer transporter - corrected function name
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'mindronfoundation@gmail.com',
    pass: process.env.EMAIL_PASS || 'lizs xfhn xvee suhg' // Move to .env file
  }
});

// Razorpay setup - Use environment variables for security
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_RhwLFisI1L3Idw',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'wwnFORSzbK6Do6xMRI7lcyqN'
});

// --- Subscriber Route with custom welcome message
app.post('/subscribe', async (req, res) => {
  const { email } = req.body;
  const emailRegex = /^[\w-.]+@([\w-]+\.)+[\w-]{2,4}$/;

  if (!email) return res.status(400).json({ error: 'Email is required' });
  if (!emailRegex.test(email)) return res.status(400).json({ error: 'Invalid email address' });

  try {
    const newSubscriber = new Subscriber({ email });
    await newSubscriber.save();

    const mailOptions = {
      from: '"Mindron Foundation" <mindronfoundation@gmail.com>',
      to: email,
      subject: 'Welcome to Mindron Foundation!',
      html: `
        <p>Dear <b>${email}</b>,</p>
        <p>
          Thank you for joining the Mindron Foundation community!<br><br>
          Your subscription helps us create and share valuable updates, initiatives, and opportunities to make a difference. We appreciate your support and commitment to our mission.<br><br>
          You'll be among the first to know about our latest projects, events, and ways you can get involved.<br><br>
          If you have any questions or suggestions, feel free to reply to this email.<br><br>
          Warm regards,<br>
          Mindron Foundation Team
        </p>
      `
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) console.error('Email not sent:', error);
      else console.log('✅ Thank you email sent:', info.response);
    });

    res.status(201).json({ message: 'Subscribed successfully' });
  } catch (err) {
    if (err.code === 11000)
      return res.status(409).json({ error: 'Email already subscribed' });
    console.error('Subscription error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// --- Contact Route
app.post('/contact', async (req, res) => {
  const { fullname, email, subject, phone, message } = req.body;
  if (!fullname || !email || !subject || !message) {
    return res.status(400).json({ error: 'Please fill out all required fields.' });
  }

  try {
    const contactEntry = new Contact({ fullname, email, subject, phone, message });
    await contactEntry.save();

    const mailOptions = {
      from: `"Contact Form" <${email}>`,
      to: 'mindronfoundation@gmail.com',
      subject: `Contact Form Submission: ${subject}`,
      text: `
        Full Name: ${fullname}
        Email: ${email}
        Phone: ${phone}
        Subject: ${subject}
        Message: ${message}
      `,
      html: `
        <h2>Contact Form Submission</h2>
        <p><b>Full Name:</b> ${fullname}</p>
        <p><b>Email:</b> ${email}</p>
        <p><b>Phone:</b> ${phone}</p>
        <p><b>Subject:</b> ${subject}</p>
        <p><b>Message:</b> ${message}</p>
      `
    };

    await transporter.sendMail(mailOptions);
    res.json({ message: 'Form submitted successfully. We will get back to you soon!' });
  } catch (err) {
    console.error('Contact form error:', err);
    res.status(500).json({ error: 'Server error, please try again later.' });
  }
});

// --- Helpdesk Route
app.post('/helpdesk', async (req, res) => {
  const { name, phone, email, type, orgName, enquiry } = req.body;
  if (!name || !email || !type || !orgName || !enquiry) {
    return res.status(400).json({ error: 'Please fill all required fields.' });
  }

  try {
    const helpdeskEntry = new Helpdesk({ name, phone, email, type, orgName, enquiry });
    await helpdeskEntry.save();

    const mailOptions = {
      from: `"Helpdesk Enquiry" <${email}>`,
      to: 'mindronfoundation@gmail.com',
      subject: `Helpdesk Enquiry from ${name} (${type})`,
      text: `
        Name: ${name}
        Phone: ${phone}
        Email: ${email}
        Type: ${type}
        Organization/Company/Charity: ${orgName}
        Enquiry Regarding: ${enquiry}
      `,
      html: `
        <h2>Helpdesk Enquiry</h2>
        <p><b>Name:</b> ${name}</p>
        <p><b>Phone:</b> ${phone}</p>
        <p><b>Email:</b> ${email}</p>
        <p><b>Type:</b> ${type}</p>
        <p><b>Organization/Company/Charity:</b> ${orgName}</p>
        <p><b>Enquiry Regarding:</b> ${enquiry}</p>
      `
    };

    await transporter.sendMail(mailOptions);
    res.json({ message: 'Helpdesk enquiry sent successfully. We will contact you soon!' });
  } catch (err) {
    console.error('Helpdesk error:', err);
    res.status(500).json({ error: 'Server error, please try again later.' });
  }
});

// --- Razorpay: Create Order (for donation checkout)
app.post('/donate/order', async (req, res) => {
  const { amount } = req.body;

  if (!amount || amount < 1) {
    return res.status(400).json({ success: false, message: 'Valid amount is required' });
  }

  const options = {
    amount: Math.round(amount * 100), // in paise
    currency: 'INR',
    receipt: 'donation_' + Date.now()
  };

  try {
    const order = await razorpay.orders.create(options);
    res.json({ success: true, order });
  } catch (err) {
    console.error('Razorpay order creation error:', err);
    res.status(500).json({ success: false, message: 'Error creating Razorpay order' });
  }
});

// --- Razorpay: Verify & Save Donation (after payment) & Send Thank You Email
app.post('/donate/verify', async (req, res) => {
  const {
    fullName, mobileNumber, email, address, country, pincode, state, city, panNumber, amount,
    termsAccepted, communicationConsent,
    razorpay_payment_id, razorpay_order_id, razorpay_signature
  } = req.body;

  if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
    return res.status(400).json({ success: false, message: 'Payment details missing' });
  }

  const generatedSignature = crypto.createHmac('sha256', razorpay.key_secret)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex');

  if (generatedSignature !== razorpay_signature) {
    return res.status(400).json({ success: false, message: 'Invalid payment signature' });
  }

  try {
    const donation = new Donation({
      fullName, mobileNumber, email, address, country, pincode, state, city, panNumber, amount,
      termsAccepted, communicationConsent,
      razorpay_payment_id, razorpay_order_id, razorpay_signature
    });
    await donation.save();

    const mailOptions = {
      from: '"Mindron Foundation" <mindronfoundation@gmail.com>',
      to: email,
      subject: 'Thank you for your donation!',
      html: `
        <h2>Thank You for Donating!</h2>
        <p><b>Amount:</b> ₹${amount}</p>
        <p><b>Name:</b> ${fullName}</p>
        <p><b>Order ID:</b> ${razorpay_order_id}</p>
        <p>We appreciate your support.<br>Mindron Foundation</p>
      `
    };

    await transporter.sendMail(mailOptions);
    res.json({ success: true, message: 'Donation recorded and thank you email sent!' });
  } catch (err) {
    console.error('Donation verification error:', err);
    res.status(500).json({ success: false, message: 'Server error saving donation' });
  }
});

app.get('/', (req, res) => {
  res.json({ message: 'Mindron Foundation Backend Running!', status: 'OK' });
});

app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
  console.log(`📊 MongoDB connected and ready`);
});
 

