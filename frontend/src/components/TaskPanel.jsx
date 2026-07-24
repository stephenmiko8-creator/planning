import React, { useState, useEffect } from 'react';
import { PlusCircle, Trash2, Wand2, Clock, CheckCircle2, AlertTriangle, AlertCircle, LogIn } from 'lucide-react';

export default function TaskPanel({ API_BASE_URL, getHeaders, addToast, config, user, onScheduleComplete }) {
  const [tasks, setTasks] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isScheduling, setIsScheduling] = useState(false);
  
  // New task form state
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDuration, setNewTaskDuration] = useState(60);
  const [newTaskPriority, setNewTaskPriority] = useState('normale');

  useEffect(() => {
    if (user) {
      fetchTasks();
    }
  }, [user]);

  const fetchTasks = async () => {
    try {
      setIsLoading(true);
      const res = await fetch(`${API_BASE_URL}/api/tasks`, {
        headers: getHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setTasks(data);
      }
    } catch (err) {
      console.error(err);
      addToast('Erreur lors du chargement des tâches', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddTask = async (e) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    try {
      const res = await fetch(`${API_BASE_URL}/api/tasks`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          title: newTaskTitle.trim(),
          duration_minutes: Number(newTaskDuration),
          priority: newTaskPriority
        })
      });

      if (res.ok) {
        const newTask = await res.json();
        setTasks([newTask, ...tasks]);
        setNewTaskTitle('');
        setNewTaskDuration(60);
      } else {
        const err = await res.json();
        addToast(err.error || 'Erreur lors de l\'ajout de la tâche', 'error');
      }
    } catch (err) {
      console.error(err);
      addToast('Erreur réseau', 'error');
    }
  };

  const handleDeleteTask = async (id) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/tasks/${id}`, {
        method: 'DELETE',
        headers: getHeaders()
      });
      if (res.ok) {
        setTasks(tasks.filter(t => t.id !== id));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAutoSchedule = async () => {
    if (tasks.length === 0) return;
    setIsScheduling(true);
    addToast('L\'IA analyse votre semaine et place vos tâches...', 'info');

    try {
      const res = await fetch(`${API_BASE_URL}/api/tasks/auto-schedule`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          currentDate: new Date().toLocaleDateString('en-CA', { timeZone: config.timezone }),
          timezone: config.timezone
        })
      });

      if (res.ok) {
        const result = await res.json();
        addToast(`Magique ! ${result.events_created} tâches ont été planifiées avec succès.`, 'success', 5000);
        // Refresh tasks (should be empty now if all were scheduled)
        fetchTasks();
        // Notify parent to refresh calendar
        if (onScheduleComplete) onScheduleComplete();
      } else {
        const err = await res.json();
        addToast(err.error || 'Erreur lors de la planification automatique.', 'error');
      }
    } catch (err) {
      console.error(err);
      addToast('Erreur de connexion avec l\'assistant IA.', 'error');
    } finally {
      setIsScheduling(false);
    }
  };

  const getPriorityIcon = (priority) => {
    switch (priority) {
      case 'critique': return <AlertTriangle size={14} className="text-red-400" />;
      case 'haute': return <AlertCircle size={14} className="text-orange-400" />;
      default: return null;
    }
  };

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center space-y-4 p-8">
        <div className="w-16 h-16 bg-neon-purple/20 rounded-full flex items-center justify-center mb-2 shadow-[0_0_20px_rgba(168,85,247,0.3)]">
          <Wand2 size={32} className="text-neon-purple" />
        </div>
        <h2 className="text-2xl font-bold">Auto-Schedule IA</h2>
        <p className="text-gray-400 max-w-md">
          L'assistant de planification intelligent est réservé aux utilisateurs connectés. Connectez-vous pour laisser l'IA organiser votre semaine !
        </p>
        <button 
          onClick={() => document.querySelector('[title="Connexion"]')?.click() || document.querySelector('button:has(.lucide-log-in)')?.click()}
          className="mt-4 px-6 py-2.5 bg-gradient-to-r from-neon-purple to-neon-blue text-btn-text-accent font-bold rounded-xl shadow-[0_0_15px_rgba(168,85,247,0.4)] hover:scale-105 transition-all flex items-center gap-2"
        >
          <LogIn size={18} />
          <span>Se connecter</span>
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <CheckCircle2 className="text-neon-teal" />
            Auto-Schedule IA
          </h2>
          <p className="text-gray-400 text-sm mt-1">Ajoutez vos tâches sans horaire, l'IA les placera pour vous.</p>
        </div>
      </div>

      <div className="glass-panel p-4">
        <form onSubmit={handleAddTask} className="flex flex-col sm:flex-row gap-3 items-end">
          <div className="flex-1 w-full">
            <label className="text-xs text-gray-400 font-semibold mb-1 block">Titre de la tâche</label>
            <input 
              type="text"
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              placeholder="Ex: Séance de sport, Lire un chapitre..."
              className="w-full bg-dark-800/50 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-neon-teal/50 transition-colors"
              required
            />
          </div>
          <div className="w-full sm:w-24">
            <label className="text-xs text-gray-400 font-semibold mb-1 block">Durée (min)</label>
            <input 
              type="number"
              value={newTaskDuration}
              onChange={(e) => setNewTaskDuration(e.target.value)}
              min="15"
              step="15"
              className="w-full bg-dark-800/50 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-neon-teal/50 transition-colors"
            />
          </div>
          <div className="w-full sm:w-32">
            <label className="text-xs text-gray-400 font-semibold mb-1 block">Priorité</label>
            <select 
              value={newTaskPriority}
              onChange={(e) => setNewTaskPriority(e.target.value)}
              className="w-full bg-dark-800/50 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-neon-teal/50 transition-colors"
            >
              <option value="basse">Basse</option>
              <option value="normale">Normale</option>
              <option value="haute">Haute</option>
              <option value="critique">Critique</option>
            </select>
          </div>
          <button 
            type="submit"
            className="w-full sm:w-auto px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-xl font-bold transition-all border border-white/10 flex items-center justify-center gap-2"
          >
            <PlusCircle size={18} />
            <span className="sm:hidden">Ajouter</span>
          </button>
        </form>
      </div>

      <div className="flex-1 flex flex-col bg-dark-800/30 border border-white/5 rounded-2xl p-4 overflow-hidden">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-gray-300 flex items-center gap-2">
            Tâches en attente ({tasks.length})
          </h3>
          <button
            onClick={handleAutoSchedule}
            disabled={tasks.length === 0 || isScheduling}
            className={`relative overflow-hidden group px-4 py-2 font-bold rounded-xl transition-all flex items-center gap-2 shadow-[0_0_15px_rgba(168,85,247,0.3)] hover:shadow-[0_0_25px_rgba(168,85,247,0.6)] ${
              tasks.length === 0 || isScheduling
                ? 'opacity-50 cursor-not-allowed bg-gray-800 text-gray-500 border border-gray-700 shadow-none hover:shadow-none'
                : 'bg-gradient-to-r from-neon-purple to-neon-blue text-btn-text-accent hover:scale-105 active:scale-95'
            }`}
          >
            {tasks.length > 0 && !isScheduling && (
              <div className="absolute inset-0 w-full h-full bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.3),transparent)] -translate-x-[150%] group-hover:animate-[shimmer_2s_infinite]" />
            )}
            <Wand2 size={18} className={`relative z-10 ${isScheduling ? 'animate-pulse' : ''}`} />
            <span className="relative z-10">{isScheduling ? 'Optimisation IA...' : 'Planifier avec l\'IA'}</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto pr-2 space-y-2 no-scrollbar">
          {isLoading ? (
            <div className="text-center py-8 text-gray-500">Chargement...</div>
          ) : tasks.length === 0 ? (
            <div className="text-center py-12 flex flex-col items-center justify-center text-gray-500 border border-dashed border-gray-700/50 rounded-xl h-48">
              <CheckCircle2 size={32} className="mb-2 opacity-20" />
              <p>Aucune tâche en attente.</p>
              <p className="text-xs mt-1">Ajoutez des tâches ci-dessus pour utiliser l'Auto-Scheduling.</p>
            </div>
          ) : (
            tasks.map(task => (
              <div key={task.id} className="flex items-center justify-between p-3 bg-white/5 hover:bg-white/10 rounded-xl border border-white/5 transition-colors group">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-dark-800 flex items-center justify-center text-gray-400">
                    <Clock size={14} />
                  </div>
                  <div>
                    <div className="font-semibold text-sm text-gray-200 flex items-center gap-2">
                      {task.title}
                      {getPriorityIcon(task.priority)}
                    </div>
                    <div className="text-xs text-gray-500">{task.duration_minutes} min</div>
                  </div>
                </div>
                <button 
                  onClick={() => handleDeleteTask(task.id)}
                  className="p-2 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all rounded-lg hover:bg-red-400/10"
                  title="Supprimer la tâche"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
