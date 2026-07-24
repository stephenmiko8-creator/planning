import React, { useState } from 'react';
import { Target, Wand2, Calendar, ClipboardList, PlusCircle, Check } from 'lucide-react';

export default function ProjectBreakdown({ API_BASE_URL, getHeaders, addToast, config, user, onTasksAdded }) {
  const [description, setDescription] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [plan, setPlan] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  const handleGenerate = async (e) => {
    e.preventDefault();
    if (!description.trim() || isGenerating) return;

    setIsGenerating(true);
    setPlan(null);
    setIsSaved(false);

    try {
      const res = await fetch(`${API_BASE_URL}/api/tasks/breakdown`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          description: description.trim(),
          currentDate: new Date().toLocaleDateString('en-CA', { timeZone: config?.timezone || 'Europe/Paris' }),
          timezone: config?.timezone || 'Europe/Paris'
        })
      });

      if (res.ok) {
        const data = await res.json();
        setPlan(data);
      } else {
        const err = await res.json();
        addToast(err.error || 'Erreur lors de la décomposition', 'error');
      }
    } catch (err) {
      console.error(err);
      addToast('Erreur réseau', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAddToTasks = async () => {
    if (!plan || !plan.tasks || plan.tasks.length === 0 || isSaving) return;

    setIsSaving(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/tasks/breakdown/add`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          tasks: plan.tasks
        })
      });

      if (res.ok) {
        addToast(`${plan.tasks.length} tâches ajoutées à votre liste d'attente !`, 'success');
        setIsSaved(true);
        if (onTasksAdded) onTasksAdded();
      } else {
        const err = await res.json();
        addToast(err.error || 'Erreur lors de la sauvegarde', 'error');
      }
    } catch (err) {
      console.error(err);
      addToast('Erreur réseau', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center space-y-4 p-8">
        <div className="w-16 h-16 bg-neon-purple/20 rounded-full flex items-center justify-center mb-2 shadow-[0_0_20px_rgba(168,85,247,0.3)]">
          <Target size={32} className="text-neon-purple" />
        </div>
        <h2 className="text-2xl font-bold">Découpeur de Projets IA</h2>
        <p className="text-gray-400 max-w-md">
          Décomposez vos grands objectifs en sous-tâches réalisables directement intégrées à votre liste de planification. Connectez-vous pour commencer !
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Target className="text-neon-teal" />
          Découpeur de Projets IA
        </h2>
        <p className="text-gray-400 text-sm mt-1">Saisissez un objectif ambitieux, et l'IA va créer un plan d'action structuré sous forme de tâches.</p>
      </div>

      <div className="glass-panel p-5">
        <form onSubmit={handleGenerate} className="flex flex-col gap-4">
          <div className="text-left">
            <label className="text-xs text-gray-400 font-semibold mb-1 block">Quel est votre objectif ou projet ?</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex: Apprendre les bases de React et Node en 1 mois, Créer un site web de e-commerce, Préparer un examen..."
              rows="3"
              className="w-full bg-dark-800/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-neon-teal/50 transition-colors placeholder-gray-500"
              required
            />
          </div>
          <button
            type="submit"
            disabled={isGenerating || !description.trim()}
            className="self-end relative overflow-hidden group px-6 py-2.5 bg-gradient-to-r from-neon-purple to-neon-blue text-btn-text-accent font-bold rounded-xl text-sm transition-all hover:scale-105 active:scale-95 shadow-[0_0_15px_rgba(168,85,247,0.3)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {!isGenerating && (
              <div className="absolute inset-0 w-full h-full bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.3),transparent)] -translate-x-[150%] group-hover:animate-[shimmer_2s_infinite]" />
            )}
            <span className="relative z-10 flex items-center gap-2">
              <Wand2 size={16} />
              {isGenerating ? 'Décomposition...' : 'Décomposer avec l\'IA'}
            </span>
          </button>
        </form>
      </div>

      {plan && (
        <div className="glass-panel p-5 border border-neon-teal/20 text-left animate-fade-in space-y-4">
          <div className="flex justify-between items-start gap-4">
            <div>
              <h3 className="text-xl font-bold text-white">{plan.project_title}</h3>
              <p className="text-xs text-gray-400 mt-1 flex items-center gap-3">
                <span className="flex items-center gap-1"><ClipboardList size={12} /> {plan.tasks?.length} étapes</span>
                <span className="flex items-center gap-1"><Calendar size={12} /> Estimation : {plan.total_estimated_hours}h</span>
              </p>
            </div>
            
            <button
              onClick={handleAddToTasks}
              disabled={isSaving || isSaved}
              className={`px-4 py-2 rounded-xl font-bold text-xs transition-all flex items-center gap-2 border ${
                isSaved 
                  ? 'bg-green-500/20 text-green-400 border-green-500/30' 
                  : 'bg-neon-teal text-dark-950 border-neon-teal hover:scale-105 shadow-[0_0_15px_rgba(20,184,166,0.3)]'
              }`}
            >
              {isSaved ? <Check size={14} /> : <PlusCircle size={14} />}
              <span>{isSaved ? 'Tâches ajoutées !' : 'Ajouter à mes tâches'}</span>
            </button>
          </div>

          <p className="text-sm text-gray-300 italic bg-white/5 p-3 rounded-xl border border-white/5">
            "{plan.summary}"
          </p>

          <div className="space-y-2 mt-4 max-h-[350px] overflow-y-auto pr-1 no-scrollbar">
            {plan.tasks?.map((task, idx) => (
              <div key={idx} className="p-3 bg-white/5 border border-white/5 rounded-xl flex items-start gap-3 hover:bg-white/10 transition-colors">
                <div className="w-6 h-6 rounded-lg bg-neon-purple/20 text-neon-purple flex items-center justify-center shrink-0 text-xs font-bold font-mono">
                  {idx + 1}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-gray-200">{task.titre}</span>
                    <span className="text-[10px] text-gray-500">Semaine {task.semaine}</span>
                    {task.priorite === 'haute' && (
                      <span className="text-[9px] px-1.5 py-0.2 bg-red-500/20 text-red-400 font-extrabold uppercase rounded-full">Prioritaire</span>
                    )}
                  </div>
                  {task.description && (
                    <p className="text-xs text-gray-400 mt-1">{task.description}</p>
                  )}
                  <span className="text-[10px] text-neon-teal font-semibold mt-1 inline-block">{task.duree_minutes} minutes</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
