const express = require('express');
const router = express.Router();
const googleCalendarService = require('../services/googleCalendarService');

// Stockage temporaire des tokens en mémoire (A remplacer par SQLite ensuite)
let userTokens = null; 

router.get('/auth/google', (req, res) => {
  const url = googleCalendarService.getAuthUrl();
  res.redirect(url);
});

router.get('/auth/google/callback', async (req, res) => {
  const code = req.query.code;
  try {
    const tokens = await googleCalendarService.getTokens(code);
    userTokens = tokens; // Stockage local du token
    res.send(`
      <script>
        window.opener.postMessage("GOOGLE_AUTH_SUCCESS", "*");
        window.close();
      </script>
    `);
  } catch (error) {
    res.status(500).json({ error: "Erreur d'authentification Google" });
  }
});

router.post('/add', async (req, res) => {
  try {
    if (!userTokens) {
      return res.status(401).json({ error: 'Non authentifié à Google Calendar' });
    }
    
    const eventDetails = req.body;
    const result = await googleCalendarService.createEvent(userTokens, eventDetails);
    
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
