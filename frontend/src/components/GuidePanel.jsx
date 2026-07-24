import React from 'react';
import { HelpCircle, Sparkles, Zap, Flame, Calendar, CheckCircle2, Target, Bot, BarChart3, ArrowRight } from 'lucide-react';

export default function GuidePanel({ user, setIsSubOpen }) {
  const plan = user?.subscription_plan || 'free';

  const renderFreeGuide = () => (
    <div className="space-y-6 text-left">
      <div className="glass-panel p-5 border border-neon-teal/20">
        <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-2">
          <Calendar className="text-neon-teal" size={20} />
          Bienvenue sur votre espace Gratuit !
        </h3>
        <p className="text-sm text-gray-300 leading-relaxed">
          Mikiplan vous permet d'organiser votre temps de manière optimale. En tant que membre **Gratuit**, voici comment démarrer :
        </p>
        <ul className="mt-4 space-y-2.5 text-xs text-gray-400">
          <li className="flex items-start gap-2">
            <span className="text-neon-teal font-extrabold">•</span>
            <span><strong>Lecture de l'agenda</strong> : Visualisez vos événements de la semaine sur notre grille interactive en mode sombre premium.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-neon-teal font-extrabold">•</span>
            <span><strong>Le Scanner intelligent (Limite de 5/mois)</strong> : Téléchargez l'image ou insérez le texte brut de votre emploi du temps pour que l'IA en extraie automatiquement les événements.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-neon-teal font-extrabold">•</span>
            <span><strong>3 catégories personnalisées</strong> : Classez vos activités (ex: Cours, Travail, Loisirs) pour colorer votre emploi du temps.</span>
          </li>
        </ul>
      </div>

      {/* Upgrade Call to action */}
      <div className="glass-panel p-6 border border-neon-purple/20 relative overflow-hidden bg-gradient-to-r from-dark-900 to-neon-purple/5">
        <div className="absolute top-0 right-0 w-32 h-32 bg-neon-purple/10 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none"></div>
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="space-y-1">
            <h4 className="text-base font-bold text-white flex items-center gap-1.5">
              <Zap className="text-neon-teal animate-pulse" size={18} />
              Débloquez les fonctionnalités avancées
            </h4>
            <p className="text-xs text-gray-400 max-w-xl">
              Passez à l'abonnement **PRO** (scans illimités, statistiques avancées) ou **PREMIUM** (pilotez votre vie par l'IA avec l'auto-scheduling, le chatbot, le découpeur d'objectifs et le coach).
            </p>
          </div>
          <button
            onClick={() => setIsSubOpen(true)}
            className="px-5 py-2.5 bg-gradient-to-r from-neon-purple to-neon-blue text-btn-text-accent font-bold rounded-xl text-xs hover:scale-105 active:scale-95 shadow-[0_0_15px_rgba(168,85,247,0.3)] transition-all flex items-center gap-1 shrink-0 cursor-pointer"
          >
            <span>Voir les abonnements</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );

  const renderProGuide = () => (
    <div className="space-y-6 text-left">
      <div className="glass-panel p-5 border border-neon-teal/20">
        <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-2">
          <Zap className="text-neon-teal" size={20} />
          Espace PRO — Mode d'emploi
        </h3>
        <p className="text-sm text-gray-300 leading-relaxed">
          Merci pour votre soutien ! Votre forfait **PRO** vous permet une utilisation intensive sans limites :
        </p>
        <ul className="mt-4 space-y-2.5 text-xs text-gray-400">
          <li className="flex items-start gap-2">
            <span className="text-neon-teal font-extrabold">•</span>
            <span><strong>Scans illimités</strong> : Importez autant d'images ou d'emplois du temps que nécessaire, sans aucune limite mensuelle.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-neon-teal font-extrabold">•</span>
            <span><strong>Catégories illimitées</strong> : Créez un système de couleurs complet pour toutes vos activités.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-neon-teal font-extrabold">•</span>
            <span><strong>Détection des conflits</strong> : L'onglet Statistiques vous alerte immédiatement en cas de chevauchements d'horaires.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-neon-teal font-extrabold">•</span>
            <span><strong>Rapports PDF & Excel</strong> : Allez dans "Statistiques", sélectionnez une période et générez un résumé professionnel par e-mail ou à copier.</span>
          </li>
        </ul>
      </div>

      {/* Upgrade Premium Call to action */}
      <div className="glass-panel p-6 border border-neon-purple/20 relative overflow-hidden bg-gradient-to-r from-dark-900 to-neon-purple/5">
        <div className="absolute top-0 right-0 w-32 h-32 bg-neon-purple/10 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none"></div>
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="space-y-1">
            <h4 className="text-base font-bold text-white flex items-center gap-1.5">
              <Flame className="text-neon-purple animate-bounce" size={18} />
              Découvrez l'expérience IA ultime (Premium)
            </h4>
            <p className="text-xs text-gray-400 max-w-xl">
              Passez à la formule **PREMIUM** pour connecter votre Google Calendar et libérer la suite IA complète (Planification automatique des tâches, Chatbot conversationnel, Découpeur d'objectifs et Coach de vie).
            </p>
          </div>
          <button
            onClick={() => setIsSubOpen(true)}
            className="px-5 py-2.5 bg-gradient-to-r from-neon-purple to-neon-blue text-btn-text-accent font-bold rounded-xl text-xs hover:scale-105 active:scale-95 shadow-[0_0_15px_rgba(168,85,247,0.3)] transition-all flex items-center gap-1 shrink-0 cursor-pointer"
          >
            <span>Passer à Premium</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );

  const renderPremiumGuide = () => (
    <div className="space-y-6 text-left">
      <div className="glass-panel p-5 border border-neon-purple/20">
        <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-2">
          <Flame className="text-neon-purple" size={20} />
          Espace PREMIUM — Pilotez votre vie par l'IA
        </h3>
        <p className="text-sm text-gray-300 leading-relaxed">
          Vous possédez l'abonnement ultime. Voici comment utiliser chaque outil d'intelligence artificielle :
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div className="bg-white/5 p-4 rounded-xl border border-white/5">
            <h4 className="font-bold text-xs text-neon-purple flex items-center gap-1.5 uppercase tracking-wide">
              <CheckCircle2 size={14} />
              1. Auto-Schedule (Tâches)
            </h4>
            <p className="text-[11px] text-gray-400 mt-1 leading-relaxed">
              Ajoutez vos tâches libres (sans horaires) dans l'onglet **Tâches**. Cliquez sur *"Planifier avec l'IA"* : l'algorithme va combler les trous de votre calendrier en respectant vos priorités et votre charge journalière.
            </p>
          </div>

          <div className="bg-white/5 p-4 rounded-xl border border-white/5">
            <h4 className="font-bold text-xs text-neon-teal flex items-center gap-1.5 uppercase tracking-wide">
              <Bot size={14} />
              2. Assistant Chatbot
            </h4>
            <p className="text-[11px] text-gray-400 mt-1 leading-relaxed">
              Discutez en langage naturel dans l'onglet **Chatbot** pour planifier ou poser des questions. Tapez *"Bloque mon mardi après-midi pour réviser"* ou *"Qu'est-ce que j'ai de prévu demain ?"* pour gérer votre agenda à la voix.
            </p>
          </div>

          <div className="bg-white/5 p-4 rounded-xl border border-white/5">
            <h4 className="font-bold text-xs text-blue-400 flex items-center gap-1.5 uppercase tracking-wide">
              <Target size={14} />
              3. Découpeur de Projets
            </h4>
            <p className="text-[11px] text-gray-400 mt-1 leading-relaxed">
              Saisissez un grand objectif (ex: *"Apprendre le piano en 1 mois"*) dans l'onglet **Projets (IA)**. L'IA va vous générer un plan d'action hebdomadaire découpé en tâches que vous pouvez importer en un clic.
            </p>
          </div>

          <div className="bg-white/5 p-4 rounded-xl border border-white/5">
            <h4 className="font-bold text-xs text-amber-400 flex items-center gap-1.5 uppercase tracking-wide">
              <BarChart3 size={14} />
              4. Le Coach de Vie IA
            </h4>
            <p className="text-[11px] text-gray-400 mt-1 leading-relaxed">
              Allez dans l'onglet **Statistiques** et cliquez sur *"Analyser ma semaine"*. Le coach calcule votre score d'équilibre sur 10, liste vos forces, signale vos surmenages et propose des conseils concrets de bien-être.
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <HelpCircle className="text-neon-purple" />
          Guide d'Utilisation Mikiplan
        </h2>
        <p className="text-gray-400 text-sm mt-1">
          Formule actuelle : <strong className="text-white capitalize">{plan}</strong>
        </p>
      </div>

      {plan === 'free' && renderFreeGuide()}
      {plan === 'pro' && renderProGuide()}
      {plan === 'premium' && renderPremiumGuide()}
    </div>
  );
}
