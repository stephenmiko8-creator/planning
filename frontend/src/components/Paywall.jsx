import React from 'react';
import { Zap } from 'lucide-react';

const Paywall = ({ requiredPlan, title, description, features, onUpgrade }) => {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center max-w-xl mx-auto space-y-6 animate-[fadeIn_0.5s_ease-out]">
      <div className="relative">
        <div className="w-20 h-20 bg-neon-purple/10 rounded-2xl border border-neon-purple/20 flex items-center justify-center text-neon-purple shadow-[0_0_30px_rgba(168,85,247,0.2)] animate-pulse">
          <Zap size={36} className={requiredPlan === 'premium' ? 'text-neon-purple' : 'text-neon-teal'} />
        </div>
      </div>
      
      <div className="space-y-2">
        <h2 className="text-2xl font-black text-white">{title}</h2>
        <p className="text-sm text-gray-400 leading-relaxed">{description}</p>
      </div>

      <div className="w-full bg-white/5 border border-white/5 rounded-2xl p-5 text-left space-y-3">
        <span className="text-[10px] text-gray-500 font-extrabold uppercase tracking-wider">Avantages débloqués :</span>
        <ul className="space-y-2.5 text-xs text-gray-300">
          {features.map((feat, idx) => (
            <li key={idx} className="flex items-start gap-2">
              <span className={requiredPlan === 'premium' ? 'text-neon-purple' : 'text-neon-teal'}>✔</span>
              <span>{feat}</span>
            </li>
          ))}
        </ul>
      </div>

      <button
        onClick={onUpgrade}
        className={`w-full py-3 rounded-xl font-bold text-sm transition-all hover:scale-105 active:scale-95 shadow-lg cursor-pointer ${
          requiredPlan === 'premium'
            ? 'bg-gradient-to-r from-neon-purple to-neon-blue text-btn-text-accent shadow-[0_0_15px_rgba(168,85,247,0.3)]'
            : 'bg-neon-teal text-dark-950 shadow-[0_0_15px_rgba(20,184,166,0.3)]'
        }`}
      >
        Débloquer la formule {requiredPlan.toUpperCase()}
      </button>
    </div>
  );
};

export default React.memo(Paywall);
