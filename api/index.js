const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const Razorpay = require('razorpay');
const crypto = require('crypto');

const app = express();

// Set up CORS to allow requests only from your Webflow domain
app.use(cors({
  origin: 'https://www.pilotfront.com',  // Replace with your Webflow domain
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type']
}));

// Middleware to parse JSON request bodies
app.use(express.json());

// Ensure Supabase credentials are available in environment variables
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const RAZORPAY_KEY_ID = 'rzp_test_bk8fP9s1DQe1g9';  // Your Razorpay key ID
const RAZORPAY_KEY_SECRET = 'ugllIfJZdHueJas3hWAaTy83';  // Your Razorpay key secret

if (!SUPABASE_URL || !SUPABASE_KEY || !RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
  console.error("Missing environment variables!");
  process.exit(1);
}

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Initialize Razorpay client with your Razorpay credentials
const razorpay = new Razorpay({
  key_id: RAZORPAY_KEY_ID,
  key_secret: RAZORPAY_KEY_SECRET
});

// POST endpoint for sign-up and payment handling
app.post('/api/index', async (req, res) => {
  try {
    const { action, email, password, paymentPlan } = req.body;

    // Ensure email, password, and action are provided
    if (!email || !password || !action) {
      return res.status(400).json({ error: 'Email, password, and action are required.' });
    }

    // Sign up the user if action is 'signup'
    if (action === 'signup') {
      const { data, error } = await supabase.auth.signUp({ email, password });

      if (error) {
        return res.status(400).json({ error: error.message });
      }

      // After signing up, check the payment plan if provided
      if (paymentPlan) {
        const paymentSession = await createRazorpaySession(paymentPlan);

        if (paymentSession.error) {
          return res.status(400).json({ error: paymentSession.error });
        }

        // Store the Razorpay order ID in Supabase (so you can track the payment)
        const { data: user, error: userError } = await supabase
          .from('users')
          .update({ razorpay_order_id: paymentSession.order.id })
          .eq('email', email);

        if (userError) {
          return res.status(400).json({ error: userError.message });
        }

        return res.status(200).json({ message: 'Sign-up successful. Proceed with payment', paymentSession: paymentSession.order });
      }

      return res.status(200).json({ message: 'Sign-up successful', data });
    }

    // Handle login action if needed (not implemented in this example)
    if (action === 'login') {
      const { data, error } = await supabase.auth.signIn({ email, password });

      if (error) {
        return res.status(400).json({ error: error.message });
      }

      return res.status(200).json({ message: 'Login successful', data });
    }

    return res.status(400).json({ error: 'Invalid action' });

  } catch (error) {
    console.error('Server Error:', error);
    return res.status(500).json({ error: 'An error occurred. Please try again later.' });
  }
});

// Razorpay payment session creation for selected plans
async function createRazorpaySession(paymentPlan) {
  try {
    // Define the payment amount based on the selected plan
    let amount;
    if (paymentPlan === 'monthly') {
      amount = 500;  // Amount in INR (500 paise = 5 INR)
    } else if (paymentPlan === 'yearly') {
      amount = 5000;  // Amount in INR
    } else if (paymentPlan === 'one-time') {
      amount = 1000;  // Amount in INR
    } else {
      return { error: 'Invalid payment plan selected' };
    }

    // Create Razorpay order for the selected plan
    const options = {
      amount: amount * 100,  // Amount is in paise (100 paise = 1 INR)
      currency: 'INR',
      receipt: `receipt_${Date.now()}`,
      payment_capture: 1
    };

    const order = await razorpay.orders.create(options);
    console.log('Payment session created:', order);

    // Return the Razorpay order to the frontend for payment
    return { order };
  } catch (error) {
    console.error('Error creating payment session:', error);
    return { error: error.message };
  }
}

// Razorpay payment verification webhook
app.post('/api/payment/verify', async (req, res) => {
  const { payment_id, order_id, signature } = req.body;

  const generatedSignature = crypto.createHmac('sha256', RAZORPAY_KEY_SECRET)
    .update(`${order_id}|${payment_id}`)
    .digest('hex');

  if (generatedSignature === signature) {
    // Payment is verified, update the user in Supabase with the payment status
    const { data, error } = await supabase
      .from('users')
      .update({ payment_status: 'completed' })
      .eq('razorpay_order_id', order_id);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.status(200).json({ message: 'Payment successfully verified' });
  } else {
    return res.status(400).json({ error: 'Payment verification failed' });
  }
});

module.exports = app;
