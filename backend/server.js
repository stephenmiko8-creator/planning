const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const stripeRoutes = require('./routes/stripeRoutes');
const taskRoutes = require('./routes/taskRoutes');

const app = express();
app.use(cors());

// Webhook Stripe doit parser le body en brut, AVANT express.json()
// On utilise app.use spécifiquement pour le path du webhook
app.use('/api/stripe/webhook', express.raw({ type: 'application/json' }));

app.use(express.json());

const PORT = process.env.PORT || 3001;

const scanRoutes = require('./routes/scanRoutes');
const calendarRoutes = require('./routes/calendarRoutes');
const eventRoutes = require('./routes/eventRoutes');
const settingsRoutes = require('./routes/settingsRoutes');
const authRoutes = require('./routes/authRoutes');

// Base route
app.get('/', (req, res) => {
  res.send({ status: 'Mikiplan API is running' });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/scan', scanRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/stripe', stripeRoutes);
app.use('/api/tasks', taskRoutes);

const pushRoutes = require('./routes/pushRoutes');
const notificationService = require('./services/notificationService');

app.use('/api/push', pushRoutes);

// Start notification cron job
notificationService.startNotificationCron();

// Start server
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = app;
