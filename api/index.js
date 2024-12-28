const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const crypto = require('crypto'); // For password hashing
const jwt = require('jsonwebtoken'); // For JWT authentication
const { createClient } = require('@supabase/supabase-js');
const Razorpay = require('razorpay');

// Razorpay Configuration
const razorpay = new Razorpay({
  key_id: 'rzp_test_bk8fP9s1DQe1g9',  // Use your actual Razorpay key_id
  key_secret: 'ugllIfJZdHueJas3hWAaTy83',  // Use your actual Razorpay key_secret
});

// Supabase Configuration
const SUPABASE_URL = process.env.SUPABASE_URL;  // Make sure to set these in your environment variables
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;  // Set this in your environment variables

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const app = express();

// Middleware for CORS - Allowing Webflow domain
app.use(cors({
  origin: 'https://www.pilotfront.com',  // Replace with your actual Webflow URL
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(bodyParser.json());  // Middleware to parse JSON bodies

// Utility: Hash password
function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// Secret key for JWT signing (you can set it in your environment variables)
const JWT_SECRET = 'your_jwt_secret_key';  // Make sure to use a secure key

// Signup endpoint
app.post('/api/signup', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  try {
    // Check if the email is already registered
    const { data: existingUser } = await supabase
      .from('users')
      .select('email')
      .eq('email', email)
      .single();

    if (existingUser) {
      return res.status(400).json({ error: 'Email is already registered.' });
    }

    // Insert new user into the database
    const hashedPassword = hashPassword(password);
    const { data, error } = await supabase
      .from('users')
      .insert([{ email, password: hashedPassword }]);

    if (error) throw error;

    res.status(201).json({ message: 'User registered successfully.' });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Failed to register user.' });
  }
});

// Login endpoint
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  try {
    const hashedPassword = hashPassword(password);

    // Check if the user exists with the correct password
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .eq('password', hashedPassword)
      .single();

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // Generate a JWT token
    const token = jwt.sign({ email: user.email, id: user.id }, JWT_SECRET, { expiresIn: '1h' });

    // Send the token back to the client
    res.status(200).json({ message: 'Login successful.', token });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Failed to login.' });
  }
});

// Payment integration with Razorpay
app.post('/api/payment', async (req, res) => {
  const { amount, currency = 'INR', receipt } = req.body;

  if (!amount || !receipt) {
    return res.status(400).json({ error: 'Amount and receipt are required.' });
  }

  try {
    const order = await razorpay.orders.create({ amount, currency, receipt });
    res.status(201).json(order);
  } catch (error) {
    console.error('Razorpay error:', error);
    res.status(500).json({ error: 'Failed to create Razorpay order.' });
  }
});

// Handle preflight OPTIONS request
app.options('/api/*', (req, res) => {
  res.header('Access-Control-Allow-Origin', 'https://www.pilotfront.com');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.sendStatus(200);
});

// Export the app for Vercel
module.exports = app;
