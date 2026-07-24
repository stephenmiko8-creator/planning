const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../database/db');
const authMiddleware = require('../middleware/authMiddleware');

const JWT_SECRET = process.env.JWT_SECRET || 'planning_assistant_secret_key_12345';

// POST /register
router.post('/register', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ success: false, error: 'Email et mot de passe requis.' });
  }

  const cleanEmail = email.toLowerCase().trim();

  // Check if user exists
  db.get(`SELECT id FROM users WHERE email = ?`, [cleanEmail], (err, row) => {
    if (err) return res.status(500).json({ success: false, error: err.message });
    if (row) return res.status(400).json({ success: false, error: 'Un utilisateur avec cet email existe déjà.' });

    // Hash password
    bcrypt.hash(password, 10, (err, hash) => {
      if (err) return res.status(500).json({ success: false, error: err.message });

      // Insert user
      db.run(
        `INSERT INTO users (email, password_hash, subscription_plan, subscription_status) VALUES (?, ?, 'free', 'active')`,
        [cleanEmail, hash],
        function(err) {
          if (err) return res.status(500).json({ success: false, error: err.message });

          const userId = this.lastID;

          // Insert default categories for this user
          const defaults = [
            [userId, 'Travail', 'bg-purple-500/30 border-purple-500/60 text-purple-200'],
            [userId, 'Temps Personnel', 'bg-teal-500/30 border-teal-500/60 text-teal-200'],
            [userId, 'Formation', 'bg-amber-500/30 border-amber-500/60 text-amber-200'],
            [userId, 'Développement', 'bg-pink-500/30 border-pink-500/60 text-pink-200'],
            [userId, 'Autre', 'bg-indigo-500/30 border-indigo-500/60 text-indigo-200']
          ];
          
          const stmt = db.prepare(`INSERT INTO categories (user_id, name, color_class) VALUES (?, ?, ?)`);
          defaults.forEach(d => stmt.run(d));
          stmt.finalize();

          // Set default lifestyle context in user_settings
          db.run(
            `INSERT INTO user_settings (user_id, key, value) VALUES (?, 'lifestyle_context', ?)`,
            [userId, 'Je suis un étudiant universitaire qui travaille à mi-temps et cherche à équilibrer mes cours, mes shifts de travail et mon développement de projets personnels.']
          );

          // Generate Token
          const token = jwt.sign({ id: userId, email: cleanEmail }, JWT_SECRET, { expiresIn: '7d' });

          res.status(201).json({
            success: true,
            token,
            user: { id: userId, email: cleanEmail, subscription_plan: 'free', subscription_status: 'active' }
          });
        }
      );
    });
  });
});

// POST /login
router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ success: false, error: 'Email et mot de passe requis.' });
  }

  const cleanEmail = email.toLowerCase().trim();

  db.get(`SELECT * FROM users WHERE email = ?`, [cleanEmail], (err, user) => {
    if (err) return res.status(500).json({ success: false, error: err.message });
    if (!user) return res.status(401).json({ success: false, error: 'Identifiants incorrects.' });

    bcrypt.compare(password, user.password_hash, (err, isMatch) => {
      if (err) return res.status(500).json({ success: false, error: err.message });
      if (!isMatch) return res.status(401).json({ success: false, error: 'Identifiants incorrects.' });

      const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });

      res.json({
        success: true,
        token,
        user: {
          id: user.id,
          email: user.email,
          subscription_plan: user.subscription_plan,
          subscription_status: user.subscription_status,
          scan_count_this_month: user.scan_count_this_month
        }
      });
    });
  });
});

// GET /me
router.get('/me', authMiddleware, (req, res) => {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Non authentifié.' });
  }

  db.get(`SELECT id, email, subscription_plan, subscription_status, scan_count_this_month, created_at FROM users WHERE id = ?`, [req.user.id], (err, user) => {
    if (err) return res.status(500).json({ success: false, error: err.message });
    if (!user) return res.status(404).json({ success: false, error: 'Utilisateur non trouvé.' });

    res.json({ success: true, user });
  });
});

// POST /subscribe
router.post('/subscribe', authMiddleware, (req, res) => {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Non authentifié.' });
  }

  const { plan } = req.body;
  if (!['free', 'pro', 'premium'].includes(plan)) {
    return res.status(400).json({ success: false, error: 'Plan invalide.' });
  }

  db.run(
    `UPDATE users SET subscription_plan = ?, subscription_status = 'active' WHERE id = ?`,
    [plan, req.user.id],
    function(err) {
      if (err) return res.status(500).json({ success: false, error: err.message });
      
      res.json({
        success: true,
        message: `Abonnement au plan ${plan.toUpperCase()} activé avec succès.`,
        plan
      });
    }
  );
});

module.exports = router;
