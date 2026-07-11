import React, { useState } from 'react';
import { Mail, Lock, LogIn, UserPlus, X, Eye, EyeOff, Shield } from 'lucide-react';
import { API_BASE_URL } from '../config';
import { useToast } from './Toast';

const AuthPage = ({ isOpen, onClose, onSuccess }) => {
  const [activeTab, setActiveTab] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { addToast } = useToast();

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      addToast('Veuillez remplir tous les champs.', 'error');
      return;
    }

    setLoading(true);
    try {
      const endpoint = activeTab === 'login' ? '/api/auth/login' : '/api/auth/register';
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Une erreur est survenue.');
      }

      addToast(
        activeTab === 'login' 
          ? 'Connexion réussie ! Bienvenue.' 
          : 'Inscription réussie ! Votre compte gratuit est créé.', 
        'success'
      );
      
      onSuccess(result.token, result.user);
      onClose();
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-dark-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-md glass-panel p-8 border border-white/10 shadow-[0_0_50px_rgba(192,132,252,0.15)] flex flex-col gap-6 overflow-hidden">
        {/* Decorative Neon Blur */}
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-neon-purple/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-neon-teal/20 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
        >
          <X size={20} />
        </button>

        {/* Title */}
        <div className="text-center">
          <div className="inline-flex p-3 rounded-2xl bg-neon-purple/10 text-neon-purple mb-3 border border-neon-purple/20">
            <Shield size={24} />
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Espace Membre</h2>
          <p className="text-sm text-gray-400 mt-1">Connectez-vous pour synchroniser votre planning</p>
        </div>

        {/* Tabs */}
        <div className="flex bg-dark-900/60 p-1 rounded-xl border border-white/5">
          <button
            onClick={() => setActiveTab('login')}
            className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all flex items-center justify-center gap-2 ${
              activeTab === 'login' 
                ? 'bg-neon-purple text-active-day-text shadow-lg shadow-neon-purple/20 font-bold' 
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <LogIn size={16} />
            Connexion
          </button>
          <button
            onClick={() => setActiveTab('register')}
            className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all flex items-center justify-center gap-2 ${
              activeTab === 'register' 
                ? 'bg-neon-purple text-active-day-text shadow-lg shadow-neon-purple/20 font-bold' 
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <UserPlus size={16} />
            Inscription
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Adresse email</label>
            <div className="relative">
              <Mail size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="email"
                placeholder="nom@exemple.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-dark-900 border border-white/10 rounded-xl py-3 pl-11 pr-4 text-white placeholder-gray-500 focus:outline-none focus:border-neon-purple transition-all focus:ring-1 focus:ring-neon-purple/30"
                required
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Mot de passe</label>
            <div className="relative">
              <Lock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-dark-900 border border-white/10 rounded-xl py-3 pl-11 pr-12 text-white placeholder-gray-500 focus:outline-none focus:border-neon-purple transition-all focus:ring-1 focus:ring-neon-purple/30"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-2 w-full py-3 bg-gradient-to-r from-neon-purple to-neon-teal text-active-day-text font-bold rounded-xl text-base hover:shadow-[0_0_25px_rgba(45,212,191,0.4)] hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2"
          >
            {loading ? (
              <span className="h-5 w-5 border-2 border-active-day-text border-t-transparent rounded-full animate-spin" />
            ) : activeTab === 'login' ? (
              <>Se connecter</>
            ) : (
              <>Créer mon compte</>
            )}
          </button>
        </form>

        <p className="text-xs text-center text-gray-500 mt-2">
          En continuant, vous acceptez nos conditions d'utilisation et politique de confidentialité.
        </p>
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

export default AuthPage;
