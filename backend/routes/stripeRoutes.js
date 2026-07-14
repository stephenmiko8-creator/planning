const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const db = require('../database/db');
const authMiddleware = require('../middleware/authMiddleware');

const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

// Helper pour définir les prix (à remplacer par de vrais ID de produits Stripe)
// En production, il vaut mieux utiliser les price_id générés par Stripe (ex: price_1xyz...)
const getPriceId = (plan) => {
  // TODO: Remplacer ces valeurs par les ID de prix réels de votre Dashboard Stripe
  const prices = {
    pro: process.env.STRIPE_PRICE_PRO || 'price_pro_placeholder',
    premium: process.env.STRIPE_PRICE_PREMIUM || 'price_premium_placeholder'
  };
  return prices[plan];
};

// 1. Créer une session Checkout
router.post('/create-checkout-session', authMiddleware, async (req, res) => {
  try {
    const { plan } = req.body;
    
    if (!['pro', 'premium'].includes(plan)) {
      return res.status(400).json({ success: false, error: 'Plan invalide' });
    }

    const priceId = getPriceId(plan);

    // Get user from DB to check for existing customer ID
    db.get(`SELECT id, email, stripe_customer_id FROM users WHERE id = ?`, [req.user.id], async (err, user) => {
      if (err || !user) return res.status(500).json({ success: false, error: 'Erreur utilisateur' });

      let customerId = user.stripe_customer_id;

      // Si pas de customerId, on le crée
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user.email,
          metadata: { userId: user.id }
        });
        customerId = customer.id;
        db.run(`UPDATE users SET stripe_customer_id = ? WHERE id = ?`, [customerId, user.id]);
      }

      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ['card'],
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        mode: 'subscription',
        success_url: `${CLIENT_URL}/?stripe_success=true&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${CLIENT_URL}/?stripe_cancel=true`,
        metadata: {
          userId: user.id,
          plan: plan
        }
      });

      res.json({ success: true, url: session.url });
    });
  } catch (error) {
    console.error('Stripe checkout error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 2. Vérifier une session (Fallback pour les environnements locaux sans Webhook)
router.post('/verify-session', authMiddleware, async (req, res) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) return res.status(400).json({ success: false, error: 'Session ID manquant' });

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    
    if (session.payment_status === 'paid' && session.metadata && session.metadata.userId && session.metadata.plan) {
      const userId = session.metadata.userId;
      const plan = session.metadata.plan;

      // Force update in database (if webhook hasn't done it yet)
      db.run(`UPDATE users SET subscription_plan = ?, subscription_status = 'active' WHERE id = ?`, [plan, userId]);
      
      return res.json({ success: true, plan });
    }
    
    res.json({ success: false, status: session.payment_status });
  } catch (error) {
    console.error('Verify session error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 3. Créer une session Portail Client (pour gérer/annuler l'abonnement)
router.post('/create-portal-session', authMiddleware, async (req, res) => {
  try {
    db.get(`SELECT stripe_customer_id FROM users WHERE id = ?`, [req.user.id], async (err, user) => {
      if (err || !user || !user.stripe_customer_id) {
        return res.status(400).json({ success: false, error: 'Client Stripe non trouvé' });
      }

      const portalSession = await stripe.billingPortal.sessions.create({
        customer: user.stripe_customer_id,
        return_url: `${CLIENT_URL}/`,
      });

      res.json({ success: true, url: portalSession.url });
    });
  } catch (error) {
    console.error('Stripe portal error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 3. Webhook pour recevoir les événements de Stripe
// NOTE: Express doit utiliser le corps brut (raw body) pour cette route, ce sera configuré dans server.js
router.post('/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('⚠️  Webhook signature verification failed.', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  switch (event.type) {
    case 'checkout.session.completed':
      const session = event.data.object;
      const userId = session.metadata.userId;
      const plan = session.metadata.plan;

      if (userId && plan) {
        db.run(`UPDATE users SET subscription_plan = ?, subscription_status = 'active' WHERE id = ?`, [plan, userId]);
      }
      break;

    case 'customer.subscription.deleted':
    case 'customer.subscription.canceled':
      const subscription = event.data.object;
      const customerId = subscription.customer;

      if (customerId) {
        // Rétrograder à 'free' si l'abonnement est annulé
        db.run(`UPDATE users SET subscription_plan = 'free', subscription_status = 'canceled' WHERE stripe_customer_id = ?`, [customerId]);
      }
      break;

    case 'invoice.payment_failed':
      // Gérer l'échec de paiement (par exemple, suspendre l'accès)
      const invoice = event.data.object;
      if (invoice.customer) {
        db.run(`UPDATE users SET subscription_status = 'past_due' WHERE stripe_customer_id = ?`, [invoice.customer]);
      }
      break;

    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  res.send();
});

module.exports = router;
