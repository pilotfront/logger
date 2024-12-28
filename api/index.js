const { createClient } = require('@supabase/supabase-js');
const Razorpay = require('razorpay');
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();

// CORS Configuration: Allow only www.pilotfront.com
const allowedOrigins = ['https://www.pilotfront.com'];
const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
};

app.use(cors(corsOptions));  // Enable CORS with restricted domains
app.use(bodyParser.json());  // Parse JSON body

// Supabase Configuration (replace with environment variables in Vercel)
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Razorpay Configuration (replace with environment variables in Vercel)
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID, // Your Razorpay Key ID
  key_secret: process.env.RAZORPAY_KEY_SECRET // Your Razorpay Key Secret
});

// Sign-up Route
app.post('/api/index', async (req, res) => {
  const { action, email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  try {
    if (action === 'signup') {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        console.error('Sign-up Error:', error);
        return res.status(500).json({ error: 'Sign-up failed. Please try again later.' });
      }

      console.log('Sign-up Success:', data);
      return res.status(200).json({ message: 'Sign-up successful. Please check your email to verify your account.' });
    }

    if (action === 'signin') {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('Sign-in Error:', error);
        return res.status(500).json({ error: 'Sign-in failed. Please check your credentials.' });
      }

      console.log('Sign-in Success:', data);
      return res.status(200).json({ message: 'Sign-in successful.' });
    }

    if (action === 'payment') {
      // Process Razorpay Payment
      const { amount, currency, user_id } = req.body;
      if (!amount || !currency || !user_id) {
        return res.status(400).json({ error: 'Amount, currency, and user_id are required.' });
      }

      // Create Razorpay order
      const orderOptions = {
        amount: amount * 100, // Razorpay expects amount in the smallest currency unit (paise)
        currency: currency,
        receipt: `receipt_${Math.random().toString(36).substring(7)}`,
      };

      razorpay.orders.create(orderOptions, async (err, order) => {
        if (err) {
          console.error('Razorpay Order Error:', err);
          return res.status(500).json({ error: 'Payment initiation failed. Please try again later.' });
        }

        // Log Razorpay order creation success
        console.log('Razorpay Order Created:', order);

        return res.status(200).json({ message: 'Payment initiation successful.', order });
      });
    }

    // If no valid action is provided
    return res.status(400).json({ error: 'Invalid action.' });
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: 'An error occurred. Please try again later.' });
  }
});

// Server setup
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

module.exports = app;
