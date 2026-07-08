const express = require('express');
const router = express.Router();
const googleCalendarService = require('../services/googleCalendarService');
const jwt = require('jsonwebtoken');
const db = require('../database/db');
const authMiddleware = require('../middleware/authMiddleware');

const JWT_SECRET = process.env.JWT_SECRET || 'planning_assistant_secret_key_12345';

// Fallback in-memory token store for unauthenticated users
let globalUserTokens = null; 

router.get('/auth/google', (req, res) => {
  const token = req.query.token;
  // Pass the token as the 'state' parameter to retrieve it on callback redirect
  const url = googleCalendarService.getAuthUrl(token || '');
  res.redirect(url);
});

router.get('/auth/google/callback', async (req, res) => {
  const code = req.query.code;
  const state = req.query.state; // Contains the JWT token
  try {
    const tokens = await googleCalendarService.getTokens(code);
    
    let userId = null;
    if (state) {
      try {
        const decoded = jwt.verify(state, JWT_SECRET);
        userId = decoded.id;
      } catch (e) {
        console.error("JWT verification failed in Google OAuth callback:", e);
      }
    }
    
    if (userId) {
      // Save tokens in the database for this specific user
      db.run(
        `INSERT INTO user_settings (user_id, key, value) VALUES (?, 'google_calendar_tokens', ?)
         ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value`,
        [userId, JSON.stringify(tokens)],
        (err) => {
          if (err) console.error("Failed to save google tokens to db:", err.message);
        }
      );
    } else {
      // Fallback for unauthenticated development sessions
      globalUserTokens = tokens;
    }
    
    res.send(`
      <script>
        window.opener.postMessage("GOOGLE_AUTH_SUCCESS", "*");
        window.close();
      </script>
    `);
  } catch (error) {
    console.error("Google Auth Callback Error:", error);
    res.status(500).json({ error: "Erreur d'authentification Google" });
  }
});

router.post('/add', authMiddleware, async (req, res) => {
  try {
    const userId = req.user ? req.user.id : null;
    let tokens = globalUserTokens;
    
    if (userId) {
      // Fetch tokens from user settings
      const row = await new Promise((resolve) => {
        db.get(`SELECT value FROM user_settings WHERE user_id = ? AND key = 'google_calendar_tokens'`, [userId], (err, row) => {
          if (err) {
            console.error("Error reading google tokens from db:", err.message);
            resolve(null);
          } else {
            resolve(row || null);
          }
        });
      });
      if (row && row.value) {
        tokens = JSON.parse(row.value);
      }
    }
    
    if (!tokens) {
      return res.status(401).json({ error: 'Non authentifié à Google Calendar' });
    }
    
    const eventDetails = req.body;
    const result = await googleCalendarService.createEvent(tokens, eventDetails);
    
    res.json({ success: true, data: result });
  } catch (error) {
    console.error("Add Google Calendar Event Error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
