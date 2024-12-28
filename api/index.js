// Import required libraries
const { createClient } = require('@supabase/supabase-js');
const Razorpay = require('razorpay');

// Initialize Supabase client with environment variables
const supabase = createClient(
  process.env.SUPABASE_URL,      // Supabase URL from Vercel environment variables
  process.env.SUPABASE_ANON_KEY  // Supabase anon key from Vercel environment variables
);

// Initialize Razorpay client with your Razorpay API key and secret
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,  // Razorpay key ID from environment variables
  key_secret: process.env.RAZORPAY_KEY_SECRET,  // Razorpay secret key from environment variables
});

module.exports = async (req, res) => {
  try {
    // Handle GET request for fetching user details (for role-based access)
    if (req.method === 'GET') {
      const { user_id } = req.query;

      if (!user_id) {
        return res.status(400).json({ error: 'User ID is required' });
      }

      // Fetch user data from Supabase
      const { data, error } = await supabase
        .from('users')   // Ensure your 'users' table exists in Supabase
        .select('*')
        .eq('id', user_id) // Query by user ID
        .single();

      if (error) {
        return res.status(500).json({ error: error.message });
      }

      // Check user role for content visibility (this is an example of attribute-centric logic)
      if (data.subscription_status === 'paid') {
        return res.status(200).json({ data, message: 'Paid user' });
      } else {
        return res.status(200).json({ data, message: 'Free user' });
      }
    }

    // Handle POST request for user sign-up
    if (req.method === 'POST' && req.body.action === 'signup') {
      const { email, password } = req.body;

      // Validate input
      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
      }

      // Sign up the user in Supabase
      const { user, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        return res.status(500).json({ error: error.message });
      }

      // Create user entry in your 'users' table if needed
      const { data, error: dbError } = await supabase
        .from('users')
        .upsert([{ id: user.id, email: user.email, subscription_status: 'free' }]);

      if (dbError) {
        return res.status(500).json({ error: dbError.message });
      }

      return res.status(201).json({ message: 'User signed up successfully', user });
    }

    // Handle POST request for user sign-in
    if (req.method === 'POST' && req.body.action === 'signin') {
      const { email, password } = req.body;

      // Validate input
      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
      }

      // Sign in the user via Supabase Auth
      const { user, error } = await supabase.auth.signIn({
        email,
        password,
      });

      if (error) {
        return res.status(500).json({ error: error.message });
      }

      return res.status(200).json({ message: 'User signed in successfully', user });
    }

    // Handle POST request for Razorpay payment creation (Subscription)
    if (req.method === 'POST' && req.body.action === 'payment') {
      const { amount, currency, user_id } = req.body;

      if (!amount || !currency || !user_id) {
        return res.status(400).json({ error: 'Amount, currency, and user ID are required' });
      }

      // Create a Razorpay order for subscription
      const options = {
        amount: amount * 100,  // Convert amount to paise (1 INR = 100 paise)
        currency: currency,
        receipt: `order_${new Date().getTime()}`,
        payment_capture: 1,
      };

      razorpay.orders.create(options, async (err, order) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }

        // Update the user subscription status in Supabase (set as 'paid' after successful payment)
        const { data, error } = await supabase
          .from('users')
          .update({ subscription_status: 'paid' })
          .eq('id', user_id);

        if (error) {
          return res.status(500).json({ error: error.message });
        }

        return res.status(200).json({ message: 'Payment order created successfully', order });
      });
    }

    return res.status(405).json({ error: 'Method Not Allowed' });

  } catch (err) {
    console.error('Error with Supabase or Razorpay:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};
