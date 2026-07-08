const express = require('express');
const router = express.Router();
const db = require('../database/db');

const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

// Sauvegarder un événement (avec anti-duplication)
router.post('/add', (req, res) => {
  const { titre, date_absolue, heure_debut, heure_fin, type, priorite, status, categorie, notes } = req.body;
  const userId = req.user ? req.user.id : null;
  
  // Vérifier si un événement identique existe déjà
  const checkQuery = `SELECT id FROM events WHERE titre = ? AND date_absolue = ? AND heure_debut = ? AND (user_id = ? OR (user_id IS NULL AND ? IS NULL))`;
  db.get(checkQuery, [titre, date_absolue, heure_debut, userId, userId], (err, existing) => {
    if (err) return res.status(500).json({ error: err.message });
    
    if (existing) {
      // Doublon détecté, on skip
      return res.json({ success: true, id: existing.id, duplicate: true });
    }

    const insertQuery = `INSERT INTO events (user_id, titre, date_absolue, heure_debut, heure_fin, type, priorite, status, categorie, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    db.run(insertQuery, [userId, titre, date_absolue, heure_debut, heure_fin, type, priorite, status || 'pending', categorie || null, notes || null], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, id: this.lastID, duplicate: false });
    });
  });
});

// Supprimer un evenement
router.delete('/:id', (req, res) => {
  const userId = req.user ? req.user.id : null;
  db.run(`DELETE FROM events WHERE id = ? AND (user_id = ? OR (user_id IS NULL AND ? IS NULL))`, [req.params.id, userId, userId], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, deleted: this.changes });
  });
});

// Tout supprimer
router.post('/purge', (req, res) => {
  const userId = req.user ? req.user.id : null;
  db.run(`DELETE FROM events WHERE user_id = ? OR (user_id IS NULL AND ? IS NULL)`, [userId, userId], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, removed: this.changes });
  });
});

// Récupérer TOUS les événements
router.get('/all', (req, res) => {
  const userId = req.user ? req.user.id : null;
  db.all(`SELECT * FROM events WHERE user_id = ? OR (user_id IS NULL AND ? IS NULL) ORDER BY date_absolue ASC, heure_debut ASC`, [userId, userId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, events: rows });
  });
});

// Supprimer les doublons existants
router.post('/cleanup', (req, res) => {
  const userId = req.user ? req.user.id : null;
  const cleanupQuery = `
    DELETE FROM events WHERE (user_id = ? OR (user_id IS NULL AND ? IS NULL)) AND id NOT IN (
      SELECT MIN(id) FROM events WHERE (user_id = ? OR (user_id IS NULL AND ? IS NULL)) GROUP BY titre, date_absolue, heure_debut
    )
  `;
  db.run(cleanupQuery, [userId, userId, userId, userId], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, removed: this.changes });
  });
});

// Récupérer les KPIs
router.get('/kpi', (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const userId = req.user ? req.user.id : null;
  
  db.all(`SELECT * FROM events WHERE user_id = ? OR (user_id IS NULL AND ? IS NULL)`, [userId, userId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    
    const totalEvents = rows.length;
    const completedEvents = rows.filter(r => r.status === 'done').length;
    const completionRate = totalEvents === 0 ? 0 : Math.round((completedEvents / totalEvents) * 100);
    
    let conflits = 0;
    const slots = new Set();
    rows.forEach(r => {
      const slot = `${r.date_absolue}-${r.heure_debut}`;
      if (slots.has(slot)) conflits++;
      else slots.add(slot);
    });

    // Calculate real free slots for today
    const todayEvents = rows.filter(r => r.date_absolue === today);
    const sortedToday = todayEvents.sort((a, b) => {
      const tA = a.heure_debut ? a.heure_debut.split(':').map(Number) : [0,0];
      const tB = b.heure_debut ? b.heure_debut.split(':').map(Number) : [0,0];
      return (tA[0]*60+tA[1]) - (tB[0]*60+tB[1]);
    });
    
    // Get active hours for the user from user_settings or defaults
    db.all(`SELECT key, value FROM user_settings WHERE user_id = ?`, [userId], (err, configRows) => {
      const config = {};
      if (!err && configRows) {
        configRows.forEach(c => config[c.key] = c.value);
      }
      const startHourStr = config.active_start_hour || '08:00';
      const endHourStr = config.active_end_hour || '22:00';
      const [shH, shM] = startHourStr.split(':').map(Number);
      const [ehH, ehM] = endHourStr.split(':').map(Number);
      
      const activeStart = shH * 60 + shM;
      const activeEnd = ehH * 60 + ehM;
      let currentStart = activeStart;
      let freeSlotCount = 0;
      
      sortedToday.forEach(e => {
        const [sh, sm] = (e.heure_debut || '0:0').split(':').map(Number);
        const [eh, em] = (e.heure_fin || '0:0').split(':').map(Number);
        const start = sh * 60 + sm;
        const end = eh * 60 + em;
        if (start > currentStart && (start - currentStart) >= 30) {
          freeSlotCount++;
        }
        currentStart = Math.max(currentStart, end);
      });
      if (currentStart < activeEnd && (activeEnd - currentStart) >= 30) {
        freeSlotCount++;
      }

      res.json({
        total_week: totalEvents,
        conflicts: conflits,
        completion_rate: completionRate,
        free_slots: freeSlotCount
      });
    });
  });
});

module.exports = router;
