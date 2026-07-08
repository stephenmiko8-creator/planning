/**
 * Migration script: Local SQLite → Supabase PostgreSQL
 * Copies all tables: users, events, categories, user_settings, user_profile
 */

const sqlite3 = require('sqlite3').verbose();
const { Pool } = require('pg');
const path = require('path');

const sqliteDb = new sqlite3.Database(path.resolve(__dirname, 'database/planning.db'));
const pgPool = new Pool({
  user: 'postgres',
  password: 'JPYyFGZItcrFYpRT',
  host: 'db.pfcwfmfvchgiomyoazox.supabase.co',
  port: 5432,
  database: 'postgres',
  ssl: { rejectUnauthorized: false }
});

function sqliteAll(query) {
  return new Promise((resolve, reject) => {
    sqliteDb.all(query, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
}

async function migrate() {
  console.log('🔄 Starting migration: SQLite → Supabase...\n');
  const client = await pgPool.connect();

  try {
    // === 1. Create tables in PostgreSQL ===
    console.log('📋 Creating tables...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email TEXT UNIQUE,
        password_hash TEXT,
        subscription_plan TEXT DEFAULT 'free',
        subscription_status TEXT DEFAULT 'active',
        scan_count_this_month INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS events (
        id SERIAL PRIMARY KEY,
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
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id SERIAL PRIMARY KEY,
        user_id INTEGER,
        name TEXT,
        color_class TEXT,
        FOREIGN KEY(user_id) REFERENCES users(id)
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS user_settings (
        user_id INTEGER,
        key TEXT,
        value TEXT,
        PRIMARY KEY (user_id, key),
        FOREIGN KEY(user_id) REFERENCES users(id)
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS user_profile (
        key TEXT PRIMARY KEY,
        value TEXT
      )
    `);

    console.log('✅ Tables created.\n');

    // === 2. Migrate users ===
    const users = await sqliteAll('SELECT * FROM users');
    console.log(`👤 Migrating ${users.length} users...`);
    for (const u of users) {
      await client.query(
        `INSERT INTO users (id, email, password_hash, subscription_plan, subscription_status, scan_count_this_month, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (id) DO NOTHING`,
        [u.id, u.email, u.password_hash, u.subscription_plan, u.subscription_status, u.scan_count_this_month, u.created_at]
      );
    }
    // Reset the sequence to avoid ID conflicts
    if (users.length > 0) {
      const maxId = Math.max(...users.map(u => u.id));
      await client.query(`SELECT setval('users_id_seq', $1, true)`, [maxId]);
    }
    console.log(`✅ Users migrated.\n`);

    // === 3. Migrate categories ===
    const categories = await sqliteAll('SELECT * FROM categories');
    console.log(`🏷️  Migrating ${categories.length} categories...`);
    for (const c of categories) {
      await client.query(
        `INSERT INTO categories (id, user_id, name, color_class)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (id) DO NOTHING`,
        [c.id, c.user_id, c.name, c.color_class]
      );
    }
    if (categories.length > 0) {
      const maxId = Math.max(...categories.map(c => c.id));
      await client.query(`SELECT setval('categories_id_seq', $1, true)`, [maxId]);
    }
    console.log(`✅ Categories migrated.\n`);

    // === 4. Migrate events ===
    const events = await sqliteAll('SELECT * FROM events');
    console.log(`📅 Migrating ${events.length} events...`);
    for (const e of events) {
      await client.query(
        `INSERT INTO events (id, user_id, titre, date_absolue, heure_debut, heure_fin, type, priorite, status, categorie, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (id) DO NOTHING`,
        [e.id, e.user_id, e.titre, e.date_absolue, e.heure_debut, e.heure_fin, e.type, e.priorite, e.status, e.categorie, e.notes]
      );
    }
    if (events.length > 0) {
      const maxId = Math.max(...events.map(e => e.id));
      await client.query(`SELECT setval('events_id_seq', $1, true)`, [maxId]);
    }
    console.log(`✅ Events migrated.\n`);

    // === 5. Migrate user_settings ===
    const settings = await sqliteAll('SELECT * FROM user_settings');
    console.log(`⚙️  Migrating ${settings.length} user settings...`);
    for (const s of settings) {
      await client.query(
        `INSERT INTO user_settings (user_id, key, value)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, key) DO UPDATE SET value = EXCLUDED.value`,
        [s.user_id, s.key, s.value]
      );
    }
    console.log(`✅ User settings migrated.\n`);

    // === 6. Migrate user_profile ===
    const profiles = await sqliteAll('SELECT * FROM user_profile');
    console.log(`📝 Migrating ${profiles.length} user profile entries...`);
    for (const p of profiles) {
      await client.query(
        `INSERT INTO user_profile (key, value)
         VALUES ($1, $2)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
        [p.key, p.value]
      );
    }
    console.log(`✅ User profile migrated.\n`);

    // === Summary ===
    console.log('═══════════════════════════════════════');
    console.log('🎉 MIGRATION COMPLETE!');
    console.log(`   👤 ${users.length} users`);
    console.log(`   📅 ${events.length} events`);
    console.log(`   🏷️  ${categories.length} categories`);
    console.log(`   ⚙️  ${settings.length} settings`);
    console.log(`   📝 ${profiles.length} profile entries`);
    console.log('═══════════════════════════════════════');

  } catch (error) {
    console.error('❌ Migration error:', error.message);
    throw error;
  } finally {
    client.release();
    await pgPool.end();
    sqliteDb.close();
  }
}

migrate().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
