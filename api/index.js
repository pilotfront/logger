const { createClient } = require('@supabase/supabase-js');
const Razorpay = require('razorpay');

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Initialize Razorpay client
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

module.exports = async (req, res) => {
  const { action } = req.query; // Determine the action based on query

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    if (action === 'signup') {
      // Handle sign-up
      const { email, password } = req.body;

      const { data, error } = await supabase.auth.signUp({ email, password });

      if (error) throw error;

      return res.status(200).json({ message: 'User registered successfully', user: data.user });
    } else if (action === 'signin') {
      // Handle sign-in
      const { email, password } = req.body;

      const { data, error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) throw error;

      return res.status(200).json({ message: 'User signed in successfully', session: data.session });
    } else if (action === 'payment') {
      // Handle payment
      const { amount, currency = 'INR', receipt } = req.body;

      const order = await razorpay.orders.create({
        amount: amount * 100, // Convert to paise
        currency,
        receipt,
      });

      return res.status(200).json(order);
    } else {
      return res.status(400).json({ error: 'Invalid action' });
    }
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
