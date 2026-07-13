const cron = require('node-cron');
const webpush = require('web-push');
const db = require('../database/db');

// Setup web-push
let pushConfigured = false;
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  try {
    webpush.setVapidDetails(
      'mailto:test@example.com',
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );
    pushConfigured = true;
  } catch (e) {
    console.error('Erreur lors de la configuration de Web-Push:', e);
  }
} else {
  console.warn('VAPID_PUBLIC_KEY ou VAPID_PRIVATE_KEY manquantes dans .env. Les notifications Push seront désactivées.');
}

const startNotificationCron = () => {
  // Check every minute
  cron.schedule('* * * * *', () => {
    // Current time
    const now = new Date();
    // 15 minutes from now
    const targetTime = new Date(now.getTime() + 15 * 60000);
    
    // Format to HH:MM (to match database format)
    const targetTimeString = targetTime.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
    const targetDateString = targetTime.toISOString().split('T')[0];
    
    // Query events starting exactly at targetTimeString
    db.all(
      `SELECT e.*, u.subscription_plan 
       FROM events e 
       JOIN users u ON e.user_id = u.id 
       WHERE e.date_absolue = ? AND e.heure_debut = ?`,
      [targetDateString, targetTimeString],
      (err, events) => {
        if (err) {
          console.error('Error fetching upcoming events:', err);
          return;
        }

        events.forEach(event => {
          // Push to everyone or just premium? (Let's do everyone for now, as asked in plan)
          db.all('SELECT * FROM push_subscriptions WHERE user_id = ?', [event.user_id], (err, subs) => {
            if (err) return;
            subs.forEach(sub => {
              const pushSubscription = {
                endpoint: sub.endpoint,
                keys: {
                  p256dh: sub.keys_p256dh,
                  auth: sub.keys_auth
                }
              };
              
              const payload = JSON.stringify({
                title: 'Rappel d\'événement',
                body: `L'événement "${event.titre}" commence dans 15 minutes (${event.heure_debut}).`,
                url: '/'
              });

              webpush.sendNotification(pushSubscription, payload).catch(err => {
                console.error('Error sending push notification:', err);
                if (err.statusCode === 410) {
                  // Subscription expired/unsubscribed
                  db.run('DELETE FROM push_subscriptions WHERE id = ?', [sub.id]);
                }
              });
            });
          });
        });
      }
    );
  });
};

module.exports = { startNotificationCron };
