const express = require('express');
const router = express.Router();
const db = require('../database/db');
const authMiddleware = require('../middleware/authMiddleware');
const aiService = require('../services/aiService');

router.use(authMiddleware);

// Get all pending tasks for a user
router.get('/', async (req, res) => {
  try {
    const rows = await db.asyncAll(
      `SELECT * FROM tasks WHERE user_id = ? AND status = 'pending' ORDER BY created_at DESC`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add a new task
router.post('/', async (req, res) => {
  try {
    const { title, duration_minutes, priority } = req.body;
    if (!title) return res.status(400).json({ error: 'Le titre est requis.' });
    
    const duration = duration_minutes || 60;
    const prio = priority || 'normale';

    const result = await db.asyncRun(
      `INSERT INTO tasks (user_id, title, duration_minutes, priority, status) VALUES (?, ?, ?, ?, 'pending')`, 
      [req.user.id, title, duration, prio]
    );

    const row = await db.asyncGet(`SELECT * FROM tasks WHERE id = ?`, [result.lastID]);
    if (!row) return res.status(500).json({ error: 'Erreur lors de la récupération de la tâche créée.' });
    res.status(201).json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update a task (e.g. status)
router.put('/:id', async (req, res) => {
  try {
    const { title, duration_minutes, priority, status } = req.body;
    
    await db.asyncRun(
      `UPDATE tasks SET title = COALESCE(?, title), duration_minutes = COALESCE(?, duration_minutes), priority = COALESCE(?, priority), status = COALESCE(?, status) WHERE id = ? AND user_id = ?`,
      [title, duration_minutes, priority, status, req.params.id, req.user.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a task
router.delete('/:id', async (req, res) => {
  try {
    await db.asyncRun(
      `DELETE FROM tasks WHERE id = ? AND user_id = ?`,
      [req.params.id, req.user.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Auto-schedule tasks using AI
router.post('/auto-schedule', async (req, res) => {
  const { currentDate, timezone } = req.body;
  const userId = req.user.id;
  
  try {
    // 1. Get pending tasks
    const tasks = await new Promise((resolve, reject) => {
      db.all(`SELECT * FROM tasks WHERE user_id = ? AND status = 'pending'`, [userId], (err, rows) => {
        if (err) return reject(err);
        resolve(rows || []);
      });
    });

    if (tasks.length === 0) {
      return res.status(400).json({ error: 'Aucune tâche en attente à planifier.' });
    }

    // 2. Get existing events for the week (simplification: get all events from today onwards)
    // For a real implementation, we'd bound this to the current week
    const existingEvents = await new Promise((resolve, reject) => {
      db.all(`SELECT * FROM events WHERE user_id = ? AND date_absolue >= ?`, [userId, currentDate], (err, rows) => {
        if (err) return reject(err);
        resolve(rows || []);
      });
    });

    // 3. Get user profile and categories
    const categories = await new Promise((resolve) => {
      db.all(`SELECT * FROM categories WHERE user_id = ? OR user_id IS NULL`, [userId], (err, rows) => resolve(rows || []));
    });

    const profile = await new Promise((resolve) => {
      db.get(`SELECT value FROM user_settings WHERE user_id = ? AND key = 'lifestyle_context'`, [userId], (err, row) => resolve(row ? row.value : ''));
    });

    // 4. Call AI
    const result = await aiService.autoScheduleTasks(tasks, existingEvents, categories, currentDate, timezone || 'Europe/Paris', profile);

    if (!result.scheduled_tasks || result.scheduled_tasks.length === 0) {
      return res.status(400).json({ error: 'L\'IA n\'a pas pu planifier ces tâches.' });
    }

    // 5. Save the new events and update tasks
    const newEvents = [];
    for (const st of result.scheduled_tasks) {
      const { task_id, titre, date_absolue, heure_debut, heure_fin, duree_minutes, categorie } = st;
      
      // Save event
      await new Promise((resolve, reject) => {
        db.run(`INSERT INTO events (user_id, titre, date_absolue, heure_debut, heure_fin, duree_minutes, categorie) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [userId, titre, date_absolue, heure_debut, heure_fin, duree_minutes, categorie],
          function(err) {
            if (err) return reject(err);
            const id = this.lastID;
            newEvents.push({ id, user_id: userId, titre, date_absolue, heure_debut, heure_fin, duree_minutes, categorie });
            resolve();
          }
        );
      });

      // Update task status
      if (task_id) {
        await new Promise((resolve) => {
          db.run(`UPDATE tasks SET status = 'scheduled' WHERE id = ? AND user_id = ?`, [task_id, userId], () => resolve());
        });
      }
    }

    res.json({ success: true, events_created: newEvents.length, events: newEvents });

  } catch (error) {
    console.error('Error in auto-schedule route:', error);
    res.status(500).json({ error: error.message });
  }
});

// AI Chat Assistant
router.post('/chat', async (req, res) => {
  const { message, currentDate, timezone } = req.body;
  const userId = req.user.id;

  if (!message) return res.status(400).json({ error: 'Le message est requis.' });

  try {
    const existingEvents = await new Promise((resolve) => {
      db.all(`SELECT * FROM events WHERE user_id = ?`, [userId], (err, rows) => resolve(rows || []));
    });

    const profile = await new Promise((resolve) => {
      db.get(`SELECT value FROM user_settings WHERE user_id = ? AND key = 'lifestyle_context'`, [userId], (err, row) => resolve(row ? row.value : ''));
    });

    const result = await aiService.chatWithAI(message, existingEvents, currentDate, timezone || 'Europe/Paris', profile);

    // If AI wants to create events, save them
    if (result.action === 'create_events' && result.events && result.events.length > 0) {
      const created = [];
      for (const ev of result.events) {
        await new Promise((resolve, reject) => {
          db.run(`INSERT INTO events (user_id, titre, date_absolue, heure_debut, heure_fin, duree_minutes, categorie) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [userId, ev.titre, ev.date_absolue, ev.heure_debut, ev.heure_fin, ev.duree_minutes, ev.categorie || 'Autre'],
            function(err) {
              if (err) return reject(err);
              created.push(ev);
              resolve();
            }
          );
        });
      }
      res.json({ success: true, action: 'create_events', response: result.response, events_created: created.length });
    } else {
      res.json({ success: true, action: 'answer', response: result.response });
    }
  } catch (error) {
    console.error('Error in chat route:', error);
    res.status(500).json({ error: error.message });
  }
});

// AI Project Breakdown
router.post('/breakdown', async (req, res) => {
  const { description, currentDate, timezone } = req.body;
  const userId = req.user.id;

  if (!description) return res.status(400).json({ error: 'La description du projet est requise.' });

  try {
    const profile = await new Promise((resolve) => {
      db.get(`SELECT value FROM user_settings WHERE user_id = ? AND key = 'lifestyle_context'`, [userId], (err, row) => resolve(row ? row.value : ''));
    });

    const result = await aiService.breakdownProject(description, currentDate, timezone || 'Europe/Paris', profile);

    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Error in breakdown route:', error);
    res.status(500).json({ error: error.message });
  }
});

// Add breakdown tasks to pending tasks
router.post('/breakdown/add', async (req, res) => {
  const { tasks: breakdownTasks } = req.body;
  const userId = req.user.id;

  if (!breakdownTasks || breakdownTasks.length === 0) {
    return res.status(400).json({ error: 'Aucune tâche à ajouter.' });
  }

  try {
    for (const t of breakdownTasks) {
      await new Promise((resolve, reject) => {
        db.run(`INSERT INTO tasks (user_id, title, duration_minutes, priority, status) VALUES (?, ?, ?, ?, 'pending')`,
          [userId, t.titre, t.duree_minutes || 60, t.priorite || 'normale'],
          function(err) {
            if (err) return reject(err);
            resolve();
          }
        );
      });
    }
    res.json({ success: true, tasks_added: breakdownTasks.length });
  } catch (error) {
    console.error('Error adding breakdown tasks:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
