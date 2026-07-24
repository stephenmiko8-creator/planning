import React, { useState } from 'react';
import { Check, Sparkles, Zap, Flame, X, ShieldAlert } from 'lucide-react';
import { API_BASE_URL } from '../config';
import { useToast } from './Toast';

const SubscriptionModal = ({ isOpen, onClose, currentPlan, onPlanUpdated, token }) => {
  const [loadingPlan, setLoadingPlan] = useState(null);
  const { addToast } = useToast();

  if (!isOpen) return null;

  const handleSubscribe = async (plan) => {
    if (plan === currentPlan) {
      addToast(`Vous êtes déjà abonné au plan ${plan.toUpperCase()}.`, 'info');
      return;
    }

    if (!token) {
      addToast('Veuillez vous connecter pour souscrire à un abonnement.', 'error');
      return;
    }

    setLoadingPlan(plan);
    try {
      // Si c'est un downgrade vers gratuit, on utilise l'ancienne route
      if (plan === 'free') {
        const response = await fetch(`${API_BASE_URL}/api/auth/subscribe`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ plan })
        });

        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Erreur lors de la mise à jour.');

        addToast(`Vous êtes repassé au plan GRATUIT.`, 'info');
        onPlanUpdated(plan);
        onClose();
        return;
      }

      // Pour les plans payants, on crée une session Stripe Checkout
      const response = await fetch(`${API_BASE_URL}/api/stripe/create-checkout-session`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ plan })
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Erreur lors de la création de la session Stripe.');

      // Redirection vers Stripe
      window.location.href = result.url;

      addToast(`Félicitations ! Vous êtes passé au plan ${plan.toUpperCase()}.`, 'success');
      onPlanUpdated(plan);
      onClose();
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setLoadingPlan(null);
    }
  };

  const handleManageSubscription = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/stripe/create-portal-session`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`
        }
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Erreur lors de l\'accès au portail.');
      
      window.location.href = result.url;
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const plans = [
    {
      id: 'free',
      name: 'Gratuit',
      price: '0€',
      period: 'à vie',
      icon: <Sparkles className="text-gray-400" size={24} />,
      desc: 'Idéal pour découvrir la puissance de Mikiplan.',
      glow: 'shadow-lg border-white/10 hover:border-white/20',
      features: [
        '5 scans intelligents par mois',
        'Jusqu\'à 3 catégories personnalisées',
        'Interface calendrier dynamique',
        'Analyses de statistiques de base'
      ]
    },
    {
      id: 'pro',
      name: 'Pro',
      price: '4.99€',
      originalPrice: '9.99€',
      period: '/ mois (pendant 3 mois, puis 9.99€)',
      icon: <Zap className="text-neon-teal animate-pulse" size={24} />,
      desc: 'La solution complète pour les professionnels exigeants.',
      glow: 'shadow-[0_0_30px_rgba(45,212,191,0.2)] border-neon-teal/40 hover:border-neon-teal/70',
      tag: 'Promo -50%',
      features: [
        'Scans intelligents ILLIMITÉS',
        'Catégories illimitées',
        'Exportation CSV & Rapport de performance',
        'Détection avancée des conflits',
        'Support prioritaire par mail'
      ]
    },
    {
      id: 'premium',
      name: 'Premium',
      price: '19.99€',
      period: 'par mois',
      icon: <Flame className="text-neon-purple animate-bounce" size={24} />,
      desc: 'L\'expérience ultime de planification assistée par l\'IA.',
      glow: 'shadow-[0_0_30px_rgba(192,132,252,0.2)] border-neon-purple/40 hover:border-neon-purple/70',
      features: [
        'Tout ce qui est dans le plan Pro',
        'Synchronisation Google Calendar',
        'Conseils d\'optimisation IA personnalisés',
        'Rappels automatiques (email/push)',
        'Accès anticipé aux nouveautés'
      ]
    }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-dark-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-5xl glass-panel p-8 border border-white/10 shadow-[0_0_50px_rgba(192,132,252,0.15)] flex flex-col gap-6 overflow-hidden max-h-[90vh] overflow-y-auto">
        
        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
        >
          <X size={20} />
        </button>

        {/* Header */}
        <div className="text-center">
          <h2 className="text-3xl font-extrabold text-white tracking-tight">Choisissez votre formule</h2>
          <p className="text-sm text-gray-400 mt-2 max-w-lg mx-auto">
            Libérez tout le potentiel de Mikiplan et transformez votre manière de planifier.
          </p>
          {(currentPlan === 'pro' || currentPlan === 'premium') && (
            <button 
              onClick={handleManageSubscription}
              className="mt-4 px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-sm font-bold rounded-lg border border-white/20 transition-all"
            >
              Gérer mon abonnement (Facturation / Annulation)
            </button>
          )}
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4">
          {plans.map((plan) => {
            const isCurrent = currentPlan === plan.id;
            return (
              <div 
                key={plan.id}
                className={`relative rounded-2xl bg-dark-800/60 p-6 border flex flex-col justify-between gap-6 transition-all ${plan.glow} ${
                  isCurrent ? 'ring-2 ring-neon-purple/50 bg-dark-800/80' : ''
                }`}
              >
                {/* Ribbon Tag */}
                {plan.tag && (
                  <span className="absolute -top-3 right-6 bg-neon-teal text-neutral-950 text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full shadow-lg">
                    {plan.tag}
                  </span>
                )}

                <div className="flex flex-col gap-4">
                  <div className="flex justify-between items-center">
                    <div className="text-lg font-bold text-white uppercase tracking-wider">{plan.name}</div>
                    <div>{plan.icon}</div>
                  </div>

                  <p className="text-xs text-gray-400 leading-relaxed min-h-[40px]">{plan.desc}</p>

                  <div className="flex items-baseline gap-1 mt-2 flex-wrap">
                    {plan.originalPrice && (
                      <span className="text-xl font-bold text-gray-500 line-through mr-1">{plan.originalPrice}</span>
                    )}
                    <span className="text-4xl font-extrabold text-white">{plan.price}</span>
                    <span className="text-xs text-gray-400">{plan.period}</span>
                  </div>

                  {/* Features List */}
                  <ul className="flex flex-col gap-2.5 border-t border-white/5 pt-4 mt-2">
                    {plan.features.map((feat, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-xs text-gray-300">
                        <Check size={14} className="text-neon-teal mt-0.5 shrink-0" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <button
                  onClick={() => handleSubscribe(plan.id)}
                  disabled={loadingPlan !== null}
                  className={`w-full py-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                    isCurrent 
                      ? 'bg-white/10 text-white cursor-default border border-white/10' 
                      : plan.id === 'premium'
                      ? 'bg-neon-purple text-btn-text-accent shadow-md hover:shadow-[0_0_15px_rgba(192,132,252,0.5)] hover:brightness-115 active:scale-[0.98]'
                      : 'bg-white text-dark-900 shadow-md hover:bg-gray-100 hover:scale-[1.01] active:scale-[0.98]'
                  }`}
                >
                  {loadingPlan === plan.id ? (
                    <span className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  ) : isCurrent ? (
                    'Plan Actuel'
                  ) : (
                    `Souscrire au plan ${plan.name}`
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-fadeIn { animation: fadeIn 0.2s ease-out; }
      `}</style>
    </div>
  );
};

export default SubscriptionModal;
