const { createClient } = require('@supabase/supabase-js');
const Razorpay = require('razorpay');
const cors = require('cors');

// Razorpay Configuration
const razorpay = new Razorpay({
  key_id: 'rzp_test_bk8fP9s1DQe1g9',
  key_secret: 'ugllIfJZdHueJas3hWAaTy83',
});

// Supabase Configuration
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// CORS middleware configuration
const corsMiddleware = cors({
  origin: 'https://www.pilotfront.com', // Your Webflow URL (replace as needed)
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
});

module.exports = async (req, res) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  corsMiddleware(req, res, async () => {
    if (req.method === 'POST') {
      const { action } = req.body;
      
      if (action === 'signup') {
        // Handle signup logic
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
          const { data, error } = await supabase
            .from('users')
            .insert([{ email, password }]);

          if (error) throw error;

          res.status(201).json({ message: 'User signed up successfully.' });
        } catch (error) {
          console.error('Signup error:', error);
          res.status(500).json({ error: 'Failed to sign up user.' });
        }
      } else if (action === 'login') {
        // Handle login logic
        const { email, password } = req.body;

        if (!email || !password) {
          return res.status(400).json({ error: 'Email and password are required.' });
        }

        try {
          const { data: user, error } = await supabase
            .from('users')
            .select('*')
            .eq('email', email)
            .eq('password', password)
            .single();

          if (!user) {
            return res.status(401).json({ error: 'Invalid email or password.' });
          }

          res.status(200).json({ message: 'Login successful.', user });
        } catch (error) {
          console.error('Login error:', error);
          res.status(500).json({ error: 'Failed to login.' });
        }
      } else if (action === 'payment') {
        // Handle payment logic
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
      } else {
        res.status(400).json({ error: 'Invalid action.' });
      }
    } else {
      res.status(405).json({ error: 'Method Not Allowed' });
    }
  });
};


// Export the app for Vercel
module.exports = app;
