const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const db = require('../database/db');

// Middleware to authenticate
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Token manquant' });

  const token = authHeader.split(' ')[1];
  jwt.verify(token, process.env.JWT_SECRET || 'secret_key_temporaire_pour_dev', (err, decoded) => {
    if (err) return res.status(403).json({ error: 'Token invalide' });
    req.user = decoded;
    next();
  });
};

router.get('/public-key', (req, res) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY });
});

router.post('/subscribe', authenticate, (req, res) => {
  const { endpoint, keys } = req.body;

  if (!endpoint || !keys) {
    return res.status(400).json({ error: 'Invalid subscription object' });
  }

  // Check if it already exists
  db.get('SELECT id FROM push_subscriptions WHERE endpoint = ? AND user_id = ?', [endpoint, req.user.id], (err, row) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    
    if (!row) {
      db.run(
        'INSERT INTO push_subscriptions (user_id, endpoint, keys_p256dh, keys_auth) VALUES (?, ?, ?, ?)',
        [req.user.id, endpoint, keys.p256dh, keys.auth],
        (err) => {
          if (err) return res.status(500).json({ error: 'Error saving subscription' });
          res.json({ success: true });
        }
      );
    } else {
      res.json({ success: true, message: 'Already subscribed' });
    }
  });
});

module.exports = router;
