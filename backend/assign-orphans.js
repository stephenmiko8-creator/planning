/**
 * Utility script: assign-orphans.js
 * Assigns all default events and categories (where user_id IS NULL) to a specific user by email.
 * Works with both local SQLite and Supabase PostgreSQL.
 *
 * Usage: node assign-orphans.js <user-email>
 */

const db = require('./database/db');

const email = process.argv[2];

if (!email) {
  console.error('\n❌ Error: Please specify the user email.');
  console.error('Usage: node assign-orphans.js <user-email>\n');
  process.exit(1);
}

console.log(`🔍 Searching for user with email: "${email}"...`);

db.get('SELECT id FROM users WHERE email = ?', [email], (err, user) => {
  if (err) {
    console.error('❌ Database error:', err.message);
    process.exit(1);
  }

  if (!user) {
    console.error(`❌ Error: User with email "${email}" not found in the database.`);
    console.error('Please make sure this user has registered or logged in via Google Auth first.');
    process.exit(1);
  }

  const userId = user.id;
  console.log(`✅ Found user: ID = ${userId}`);
  console.log('🔄 Assigning orphan records (user_id IS NULL)...');

  db.serialize(() => {
    // 1. Update events
    db.run(
      'UPDATE events SET user_id = ? WHERE user_id IS NULL',
      [userId],
      function (err) {
        if (err) {
          console.error('❌ Error updating events:', err.message);
        } else {
          console.log(`📅 Events: Updated ${this.changes || 0} default events.`);
        }
      }
    );

    // 2. Update categories
    db.run(
      'UPDATE categories SET user_id = ? WHERE user_id IS NULL',
      [userId],
      function (err) {
        if (err) {
          console.error('❌ Error updating categories:', err.message);
        } else {
          console.log(`🏷️  Categories: Updated ${this.changes || 0} default categories.`);
        }
      }
    );

    // 3. Seed default user settings if not present
    db.get(
      "SELECT value FROM user_settings WHERE user_id = ? AND key = 'lifestyle_context'",
      [userId],
      (err, row) => {
        if (!err && !row) {
          db.run(
            "INSERT OR IGNORE INTO user_settings (user_id, key, value) VALUES (?, 'lifestyle_context', ?)",
            [
              userId,
              'Je suis un étudiant universitaire qui travaille à mi-temps et cherche à équilibrer mes cours, mes shifts de travail et mon développement de projets personnels.',
            ],
            function (err) {
              if (!err) {
                console.log('⚙️  Settings: Seeded default lifestyle context.');
              }
            }
          );
        } else {
          console.log('⚙️  Settings: User already has lifestyle context settings.');
        }
      }
    );
  });
});
