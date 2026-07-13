const db = require('./database/db');
const bcrypt = require('bcryptjs');

const email = 'admin@admin.com';
const newPassword = 'admin123';

bcrypt.hash(newPassword, 10, (err, hash) => {
  if (err) {
    console.error('Error hashing password:', err);
    process.exit(1);
  }
  
  db.run(
    'UPDATE users SET password_hash = ?, subscription_plan = \'premium\', subscription_status = \'active\' WHERE email = ?',
    [hash, email],
    function(err) {
      if (err) {
        console.error('Error updating database:', err);
        process.exit(1);
      }
      if (this.changes === 0) {
        // User doesn't exist, create it
        db.run(
          `INSERT INTO users (email, password_hash, subscription_plan, subscription_status) VALUES (?, ?, 'premium', 'active')`,
          [email, hash],
          function(err) {
            if (err) {
              console.error('Error creating admin user:', err);
              process.exit(1);
            }
            console.log(`Admin account ${email} created with password: ${newPassword}`);
            process.exit(0);
          }
        );
      } else {
        console.log(`Password for ${email} has been successfully reset to: ${newPassword}`);
        process.exit(0);
      }
    }
  );
});
