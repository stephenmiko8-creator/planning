const express = require('express');
const router = express.Router();
const db = require('../database/db');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

// --- Profile Routes ---

// Get profile
router.get('/profile', (req, res) => {
  if (req.user) {
    db.get(`SELECT value FROM user_settings WHERE user_id = ? AND key = 'lifestyle_context'`, [req.user.id], (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, context: row ? row.value : '' });
    });
  } else {
    db.get(`SELECT value FROM user_profile WHERE key = 'lifestyle_context'`, (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, context: row ? row.value : '' });
    });
  }
});

// Update profile
router.post('/profile', (req, res) => {
  const { context } = req.body;
  if (req.user) {
    db.run(
      `INSERT INTO user_settings (user_id, key, value) VALUES (?, 'lifestyle_context', ?)
       ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value`,
      [req.user.id, context],
      function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
      }
    );
  } else {
    db.run(
      `INSERT INTO user_profile (key, value) VALUES ('lifestyle_context', ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [context],
      function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
      }
    );
  }
});

// --- Config Routes ---

// Get all config settings
router.get('/config', (req, res) => {
  if (req.user) {
    db.all(`SELECT key, value FROM user_settings WHERE user_id = ?`, [req.user.id], (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      const config = {};
      rows.forEach(r => {
        config[r.key] = r.value;
      });
      // Default values if not set
      if (!config.timezone) config.timezone = 'Europe/Paris';
      if (!config.active_start_hour) config.active_start_hour = '08:00';
      if (!config.active_end_hour) config.active_end_hour = '22:00';
      res.json({ success: true, config });
    });
  } else {
    db.all(`SELECT key, value FROM user_profile`, (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      const config = {};
      rows.forEach(r => {
        config[r.key] = r.value;
      });
      // Default values if not set
      if (!config.timezone) config.timezone = 'Europe/Paris';
      if (!config.active_start_hour) config.active_start_hour = '08:00';
      if (!config.active_end_hour) config.active_end_hour = '22:00';
      res.json({ success: true, config });
    });
  }
});

// Update config settings
router.post('/config', (req, res) => {
  const { timezone, active_start_hour, active_end_hour } = req.body;
  
  if (req.user) {
    const stmt = db.prepare(`
      INSERT INTO user_settings (user_id, key, value) VALUES (?, ?, ?)
      ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value
    `);
    
    try {
      const uid = req.user.id;
      if (timezone) stmt.run(uid, 'timezone', timezone);
      if (active_start_hour) stmt.run(uid, 'active_start_hour', active_start_hour);
      if (active_end_hour) stmt.run(uid, 'active_end_hour', active_end_hour);
      stmt.finalize();
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  } else {
    const stmt = db.prepare(`
      INSERT INTO user_profile (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `);
    
    try {
      if (timezone) stmt.run('timezone', timezone);
      if (active_start_hour) stmt.run('active_start_hour', active_start_hour);
      if (active_end_hour) stmt.run('active_end_hour', active_end_hour);
      stmt.finalize();
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
});

// --- Categories Routes ---

// Get all categories
router.get('/categories', (req, res) => {
  const userId = req.user ? req.user.id : null;
  db.all(`SELECT * FROM categories WHERE user_id = ? OR (user_id IS NULL AND ? IS NULL) ORDER BY id ASC`, [userId, userId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, categories: rows });
  });
});

// Add new category
router.post('/categories', (req, res) => {
  const { name, color_class } = req.body;
  if (!name || !color_class) {
    return res.status(400).json({ error: 'Name and color_class are required.' });
  }
  const userId = req.user ? req.user.id : null;
  db.run(`INSERT INTO categories (user_id, name, color_class) VALUES (?, ?, ?)`, [userId, name, color_class], function(err) {
    if (err) {
      if (err.message.includes('UNIQUE')) {
        return res.status(400).json({ error: 'Une catégorie avec ce nom existe déjà.' });
      }
      return res.status(500).json({ error: err.message });
    }
    res.json({ success: true, id: this.lastID });
  });
});

// Delete category
router.delete('/categories/:id', (req, res) => {
  const userId = req.user ? req.user.id : null;
  db.run(`DELETE FROM categories WHERE id = ? AND (user_id = ? OR (user_id IS NULL AND ? IS NULL))`, [req.params.id, userId, userId], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, affected: this.changes });
  });
});

module.exports = router;
