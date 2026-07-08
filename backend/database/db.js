const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'planning.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  // Table users
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE,
    password_hash TEXT,
    subscription_plan TEXT DEFAULT 'free',
    subscription_status TEXT DEFAULT 'active',
    scan_count_this_month INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);

  // Table events
  db.run(`CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    titre TEXT,
    date_absolue TEXT,
    heure_debut TEXT,
    heure_fin TEXT,
    type TEXT,
    priorite TEXT,
    status TEXT DEFAULT 'pending',
    categorie TEXT,
    notes TEXT,
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`);
  
  // Ensure table columns exist
  db.run(`ALTER TABLE events ADD COLUMN user_id INTEGER`, () => {});
  db.run(`ALTER TABLE events ADD COLUMN categorie TEXT`, () => {});
  db.run(`ALTER TABLE events ADD COLUMN notes TEXT`, () => {});

  // Table categories
  db.run(`CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    name TEXT,
    color_class TEXT,
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`, () => {
    // Check if name column is UNIQUE (older schema might have UNIQUE on name, which we want to allow per user)
    // To keep it simple, we just insert system-wide defaults if empty
    db.get(`SELECT COUNT(*) as count FROM categories`, (err, row) => {
      if (!err && row && row.count === 0) {
        const defaults = [
          [null, 'Travail', 'bg-purple-500/30 border-purple-500/60 text-purple-200'],
          [null, 'Temps Personnel', 'bg-teal-500/30 border-teal-500/60 text-teal-200'],
          [null, 'Formation', 'bg-amber-500/30 border-amber-500/60 text-amber-200'],
          [null, 'Développement', 'bg-pink-500/30 border-pink-500/60 text-pink-200'],
          [null, 'Autre', 'bg-indigo-500/30 border-indigo-500/60 text-indigo-200']
        ];
        const stmt = db.prepare(`INSERT OR IGNORE INTO categories (user_id, name, color_class) VALUES (?, ?, ?)`);
        defaults.forEach(d => stmt.run(d));
        stmt.finalize();
      }
    });
  });
  db.run(`ALTER TABLE categories ADD COLUMN user_id INTEGER`, () => {});

  // Table user_settings (multi-user config & lifestyle context)
  db.run(`CREATE TABLE IF NOT EXISTS user_settings (
    user_id INTEGER,
    key TEXT,
    value TEXT,
    PRIMARY KEY (user_id, key),
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`);

  // Table user_profile (legacy fallback)
  db.run(`CREATE TABLE IF NOT EXISTS user_profile (
    key TEXT PRIMARY KEY,
    value TEXT
  )`, () => {
    db.get(`SELECT COUNT(*) as count FROM user_profile WHERE key = 'lifestyle_context'`, (err, row) => {
      if (!err && row && row.count === 0) {
        db.run(`INSERT OR IGNORE INTO user_profile (key, value) VALUES ('lifestyle_context', 'Je suis un étudiant universitaire qui travaille à mi-temps et cherche à équilibrer mes cours, mes shifts de travail et mon développement de projets personnels.')`);
      }
    });
  });
});

module.exports = db;
