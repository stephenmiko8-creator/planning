const path = require('path');

// Check if we should use Supabase PostgreSQL (via DATABASE_URL) or local SQLite
const usePostgres = !!process.env.DATABASE_URL;

let db;

if (usePostgres) {
  const { Pool } = require('pg');
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  console.log('Connected to Supabase PostgreSQL database.');

  function convertSql(sql) {
    let index = 1;
    let converted = sql.replace(/\?/g, () => `$${index++}`);
    
    // SQLite syntax conversions for Postgres compatibility
    converted = converted.replace(/INTEGER PRIMARY KEY AUTOINCREMENT/gi, 'SERIAL PRIMARY KEY');
    converted = converted.replace(/INSERT OR IGNORE INTO user_profile/gi, 'INSERT INTO user_profile');
    converted = converted.replace(/INSERT OR IGNORE INTO categories/gi, 'INSERT INTO categories');
    
    // Add conflict resolution for user_profile insert if needed
    if (converted.includes('user_profile') && !converted.includes('ON CONFLICT')) {
      converted += ' ON CONFLICT (key) DO NOTHING';
    }
    
    return converted;
  }

  db = {
    get(sql, params, callback) {
      let cb = callback;
      let queryParams = [];
      if (typeof params === 'function') {
        cb = params;
      } else if (Array.isArray(params)) {
        queryParams = params;
      }
      
      const convertedSql = convertSql(sql);
      pool.query(convertedSql, queryParams, (err, res) => {
        if (err) {
          if (cb) cb(err);
          return;
        }
        const row = res.rows && res.rows.length > 0 ? res.rows[0] : null;
        if (cb) cb(null, row);
      });
    },

    all(sql, params, callback) {
      let cb = callback;
      let queryParams = [];
      if (typeof params === 'function') {
        cb = params;
      } else if (Array.isArray(params)) {
        queryParams = params;
      }
      
      const convertedSql = convertSql(sql);
      pool.query(convertedSql, queryParams, (err, res) => {
        if (err) {
          if (cb) cb(err);
          return;
        }
        if (cb) cb(null, res.rows || []);
      });
    },

    run(sql, params, callback) {
      let cb = callback;
      let queryParams = [];
      if (typeof params === 'function') {
        cb = params;
      } else if (Array.isArray(params)) {
        queryParams = params;
      }
      
      let convertedSql = convertSql(sql);
      
      // Auto-append RETURNING id for insert statements to fetch lastID
      const isInsert = /insert\s+into\s+(users|events|categories)/i.test(convertedSql);
      if (isInsert && !/returning/i.test(convertedSql)) {
        convertedSql += ' RETURNING id';
      }
      
      pool.query(convertedSql, queryParams, function(err, res) {
        if (err) {
          if (cb) cb(err);
          return;
        }
        
        const lastID = res.rows && res.rows.length > 0 && res.rows[0].id ? res.rows[0].id : null;
        const context = {
          changes: res.rowCount,
          lastID: lastID
        };
        
        if (cb) {
          cb.call(context, null);
        }
      });
    },

    prepare(sql) {
      const self = this;
      return {
        run(...args) {
          let params = args;
          let cb = null;
          
          if (args.length > 0 && typeof args[args.length - 1] === 'function') {
            cb = args.pop();
          }
          
          if (args.length === 1 && Array.isArray(args[0])) {
            params = args[0];
          }
          
          self.run(sql, params, cb);
        },
        finalize(cb) {
          if (cb) cb();
        }
      };
    },

    serialize(callback) {
      callback();
    }
  };

} else {
  const sqlite3 = require('sqlite3').verbose();
  const dbPath = path.resolve(__dirname, 'planning.db');
  db = new sqlite3.Database(dbPath);
  console.log('Connected to local SQLite database.');
}

// Database schema initialization (runs for both SQLite and Postgres)
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
    db.get(`SELECT COUNT(*) as count FROM categories`, (err, row) => {
      if (!err && row && parseInt(row.count || 0) === 0) {
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
      if (!err && row && parseInt(row.count || 0) === 0) {
        db.run(`INSERT OR IGNORE INTO user_profile (key, value) VALUES ('lifestyle_context', 'Je suis un étudiant universitaire qui travaille à mi-temps et cherche à équilibrer mes cours, mes shifts de travail et mon développement de projets personnels.')`);
      }
    });
  });
});

module.exports = db;
