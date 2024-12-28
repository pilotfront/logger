const { createClient } = require('@supabase/supabase-js');
const Razorpay = require('razorpay');
const jwt = require('jsonwebtoken');

const supabase = createClient('YOUR_SUPABASE_URL', 'YOUR_SUPABASE_ANON_KEY');
const razorpay = new Razorpay({
  key_id: 'rzp_test_bk8fP9s1DQe1g9',
  key_secret: 'ugllIfJZdHueJas3hWAaTy83',
});

const JWT_SECRET = 'your_jwt_secret';

const authenticateJWT = (req, res, next) => {
  const token = req.headers.authorization;
  if (!token) return res.status(401).send('Unauthorized');
  
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).send('Forbidden');
    req.user = user;
    next();
  });
};

const checkSubscription = async (req, res, next) => {
  const user = req.user;
  const { data, error } = await supabase
    .from('subscriptions')
    .select('status')
    .eq('user_id', user.id)
    .single();

  if (error || data.status !== 'paid') {
    return res.status(403).send('Forbidden');
  }
  
  next();
};

module.exports = async (req, res) => {
  const { method } = req;
  
  if (method === 'POST' && req.url === '/signup') {
    const { email, password } = req.body;
    const { user, error } = await supabase.auth.signUp({ email, password });

    if (error) return res.status(400).json({ error: error.message });

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '1d' });
    return res.status(200).json({ token });
  }
  
  if (method === 'POST' && req.url === '/login') {
    const { email, password } = req.body;
    const { user, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) return res.status(400).json({ error: error.message });

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '1d' });
    return res.status(200).json({ token });
  }
  
  if (method === 'GET' && req.url === '/premium-content') {
    await authenticateJWT(req, res, () => {});
    await checkSubscription(req, res, () => {});
    return res.send('<div class="premium-content">This is premium content</div>');
  }

  if (method === 'GET' && req.url === '/free-content') {
    return res.send('<div class="free-content">This is free content</div>');
  }

  if (method === 'POST' && req.url === '/create-subscription') {
    const { plan_id } = req.body;
    const subscription = await razorpay.subscriptions.create({
      plan_id,
      total_count: 12,
      customer_notify: 1,
    });

    return res.status(200).json(subscription);
  }
  
  res.status(404).send('Not Found');
};
