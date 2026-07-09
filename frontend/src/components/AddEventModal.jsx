import React, { useState } from 'react';
import { X, Calendar, Clock, Sparkles, Tag, AlertOctagon } from 'lucide-react';

const PRIORITY_OPTIONS = [
  { value: 'basse', label: '🟢 Basse' },
  { value: 'normale', label: '🔵 Normale' },
  { value: 'haute', label: '🟡 Haute' },
  { value: 'critique', label: '🔴 Critique' }
];

const AddEventModal = ({ onClose, onSave, categories = [], initialValues }) => {
  const [titre, setTitre] = useState('');
  const [categorie, setCategorie] = useState(categories[0]?.name || 'Travail');
  const [date, setDate] = useState(initialValues?.date || new Date().toISOString().split('T')[0]);
  const [startTime, setStartTime] = useState(initialValues?.startTime || '09:00');
  const [endTime, setEndTime] = useState(initialValues?.endTime || '17:00');
  const [priority, setPriority] = useState('normale');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!titre.trim()) {
      setError("Le titre de l'activité est requis.");
      return;
    }
    if (!date) {
      setError("La date est requise.");
      return;
    }
    if (!startTime || !endTime) {
      setError("Les horaires de début et de fin sont requis.");
      return;
    }
    // Validate start is before end (unless overnight shift)
    const [sh, sm] = startTime.split(':').map(Number);
    const [eh, em] = endTime.split(':').map(Number);
    const startMin = sh * 60 + sm;
    const endMin = eh * 60 + em;
    if (endMin <= startMin) {
      setError("L'heure de fin doit être après l'heure de début.");
      return;
    }

    onSave({
      titre,
      date_absolue: date,
      heure_debut: startTime,
      heure_fin: endTime,
      type: 'tache',
      priorite: priority,
      categorie,
      notes
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" />

      {/* Modal Container */}
      <div 
        className="relative w-full max-w-lg glass-panel rounded-2xl overflow-hidden border border-white/10 animate-in"
        onClick={(e) => e.stopPropagation()}
        style={{ animation: 'modalIn 0.2s ease-out' }}
      >
        <div className="h-1.5 w-full bg-gradient-to-r from-neon-purple to-neon-teal" />

        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white bg-white/10 hover:bg-white/20 rounded-full p-1.5 transition-all"
        >
          <X size={18} />
        </button>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Sparkles className="text-neon-purple" size={20} />
              Planifier un bloc / temps
            </h2>
            <p className="text-xs text-gray-400 mt-1">Structurez proactivement votre temps professionnel et personnel.</p>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold p-3 rounded-lg flex items-center gap-2">
              <AlertOctagon size={14} />
              <span>{error}</span>
            </div>
          )}

          {/* Activity Title */}
          <div>
            <label className="block text-xs font-bold text-gray-400 mb-1">Activité / Titre</label>
            <input 
              type="text"
              value={titre}
              onChange={(e) => setTitre(e.target.value)}
              placeholder="Ex: Shift Orgemont, Séance Sport, Lecture..."
              className="w-full bg-dark-900/50 border border-white/10 rounded-xl p-2.5 text-sm text-white focus:outline-none focus:border-neon-purple/50 focus:shadow-[0_0_10px_rgba(168,85,247,0.15)]"
              required
            />
          </div>

          {/* Category Selector */}
          <div>
            <label className="block text-xs font-bold text-gray-400 mb-1 flex items-center gap-1">
              <Tag size={12} /> Catégorie (Type de temps)
            </label>
            <select
              value={categorie}
              onChange={(e) => setCategorie(e.target.value)}
              className="w-full bg-dark-900 border border-white/10 rounded-xl p-2.5 text-sm text-white focus:outline-none focus:border-neon-purple/50"
            >
              {categories.map(cat => (
                <option key={cat.id} value={cat.name}>{cat.name}</option>
              ))}
              {categories.length === 0 && (
                <>
                  <option value="Travail">💼 Travail</option>
                  <option value="Temps Personnel">🏡 Temps Personnel</option>
                  <option value="Formation">📚 Formation</option>
                  <option value="Développement">🚀 Développement</option>
                  <option value="Autre">📌 Autre</option>
                </>
              )}
            </select>
          </div>

          {/* Date Selector */}
          <div>
            <label className="block text-xs font-bold text-gray-400 mb-1 flex items-center gap-1">
              <Calendar size={12} /> Date
            </label>
            <input 
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-dark-900 border border-white/10 rounded-xl p-2.5 text-sm text-white focus:outline-none focus:border-neon-purple/50"
              required
            />
          </div>

          {/* Time pickers */}
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-xs font-bold text-gray-400 mb-1 flex items-center gap-1">
                <Clock size={12} /> Début
              </label>
              <input 
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full bg-dark-900 border border-white/10 rounded-xl p-2.5 text-sm text-white focus:outline-none focus:border-neon-purple/50"
                required
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-bold text-gray-400 mb-1 flex items-center gap-1">
                <Clock size={12} /> Fin
              </label>
              <input 
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full bg-dark-900 border border-white/10 rounded-xl p-2.5 text-sm text-white focus:outline-none focus:border-neon-purple/50"
                required
              />
            </div>
          </div>

          {/* Priority */}
          <div>
            <label className="block text-xs font-bold text-gray-400 mb-1">Priorité</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="w-full bg-dark-900 border border-white/10 rounded-xl p-2.5 text-sm text-white focus:outline-none focus:border-neon-purple/50"
            >
              {PRIORITY_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-bold text-gray-400 mb-1">Notes / Description</label>
            <textarea 
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Informations additionnelles, employeur, détails du projet..."
              rows="3"
              className="w-full bg-dark-900/50 border border-white/10 rounded-xl p-2.5 text-sm text-white focus:outline-none focus:border-neon-purple/50"
            />
          </div>

          {/* Action buttons */}
          <div className="flex gap-3 pt-2 border-t border-white/10 mt-2">
            <button 
              type="button"
              onClick={onClose}
              className="flex-1 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white font-bold text-sm transition-all"
            >
              Annuler
            </button>
            <button 
              type="submit"
              className="flex-1 py-2 bg-neon-purple text-active-day-text font-bold rounded-xl text-sm hover:shadow-[0_0_20px_rgba(168,85,247,0.5)] transition-all"
            >
              Enregistrer
            </button>
          </div>
        </form>
      </div>

      <style>{`
        @keyframes modalIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
};

export default AddEventModal;
