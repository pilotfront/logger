const { createClient } = require('@supabase/supabase-js');
const Razorpay = require('razorpay');
const crypto = require('crypto'); // For password hashing
const jwt = require('jsonwebtoken'); // For JWT authentication

// Razorpay Configuration
const razorpay = new Razorpay({
  key_id: 'rzp_test_bk8fP9s1DQe1g9',  // Your Razorpay Key ID
  key_secret: 'ugllIfJZdHueJas3hWAaTy83',  // Your Razorpay Key Secret
});

// Supabase Configuration (using environment variables set in Vercel)
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Secret key for JWT signing
const JWT_SECRET = 'your_jwt_secret_key';  // Make sure to use a secure key

// Express server
module.exports = async (req, res) => {
  if (req.method === 'POST') {
    const { email, password, action, amount, receipt } = req.body;

    if (action === 'signup') {
      // Signup logic
      try {
        if (!email || !password) {
          return res.status(400).json({ error: 'Email and password are required.' });
        }

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
        const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');
        const { data, error } = await supabase
          .from('users')
          .insert([{ email, password: hashedPassword }]);

        if (error) throw error;

        res.status(201).json({ message: 'User registered successfully.' });
      } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({ error: 'Failed to register user.' });
      }
    } else if (action === 'login') {
      // Login logic
      try {
        if (!email || !password) {
          return res.status(400).json({ error: 'Email and password are required.' });
        }

        const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');

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

        res.status(200).json({ message: 'Login successful.', token });
      } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Failed to login.' });
      }
    } else if (action === 'payment') {
      // Payment logic (Create Razorpay order)
      try {
        if (!amount || !receipt) {
          return res.status(400).json({ error: 'Amount and receipt are required.' });
        }

        // Razorpay payment order creation
        const order = await razorpay.orders.create({
          amount, 
          currency: 'INR', 
          receipt
        });

        res.status(201).json(order);
      } catch (error) {
        console.error('Razorpay error:', error);
        res.status(500).json({ error: 'Failed to create Razorpay order.' });
      }
    } else {
      res.status(400).json({ error: 'Invalid action.' });
    }
  } else {
    // Handle other HTTP methods (GET, PUT, DELETE)
    res.status(405).json({ error: 'Method Not Allowed' });
  }
};
