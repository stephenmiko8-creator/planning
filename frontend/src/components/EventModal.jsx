import React, { useState, useEffect } from 'react';
import { X, Calendar, Clock, MapPin, Users, BookOpen, Flag, Bell, RefreshCw, FileText, Trash2, PlusCircle, Edit2, Check, AlertCircle } from 'lucide-react';

const PRIORITY_STYLES = {
  'critique': 'bg-red-500/20 text-red-400 border-red-500/50',
  'haute': 'bg-orange-500/20 text-orange-400 border-orange-500/50',
  'normale': 'bg-neon-teal/20 text-neon-teal border-neon-teal/50',
  'basse': 'bg-green-500/20 text-green-400 border-green-500/50',
};

const TYPE_LABELS = {
  'cours': '📚 Cours',
  'reunion': '🤝 Reunion',
  'deadline': '⏰ Deadline',
  'tache': '✅ Tache',
  'rappel': '🔔 Rappel',
  'autre': '📌 Autre',
};

const DAYS_FR = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const MONTHS_FR = ['janvier','fevrier','mars','avril','mai','juin','juillet','aout','septembre','octobre','novembre','decembre'];

function formatDateFR(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T12:00:00');
  return `${DAYS_FR[d.getDay()]} ${d.getDate()} ${MONTHS_FR[d.getMonth()]} ${d.getFullYear()}`;
}

function getDuration(start, end) {
  if (!start || !end) return null;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const diff = (eh * 60 + em) - (sh * 60 + sm);
  if (diff <= 0) return null;
  const h = Math.floor(diff / 60);
  const m = diff % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h}h`;
  return `${h}h${m.toString().padStart(2, '0')}`;
}

const EventModal = ({ event, onClose, onDelete, onAddToCalendar, onUpdate, categories = [] }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [titre, setTitre] = useState('');
  const [categorie, setCategorie] = useState('Travail');
  const [type, setType] = useState('tache');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('17:00');
  const [priority, setPriority] = useState('normale');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState('pending');
  const [error, setError] = useState('');

  useEffect(() => {
    if (event) {
      setTitre(event.titre || '');
      setCategorie(event.categorie || 'Travail');
      setType(event.type || 'tache');
      setDate(event.date_absolue || '');
      setStartTime(event.heure_debut || '09:00');
      setEndTime(event.heure_fin || '17:00');
      setPriority(event.priorite || 'normale');
      setNotes(event.notes || '');
      setStatus(event.status || 'pending');
      setError('');
    }
  }, [event, isEditing]);

  if (!event) return null;

  const handleSave = (e) => {
    e.preventDefault();
    setError('');

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

    const [sh, sm] = startTime.split(':').map(Number);
    const [eh, em] = endTime.split(':').map(Number);
    const startMin = sh * 60 + sm;
    const endMin = eh * 60 + em;
    if (endMin <= startMin) {
      setError("L'heure de fin doit être après l'heure de début.");
      return;
    }

    if (onUpdate) {
      onUpdate(event.id, {
        titre: titre.trim(),
        date_absolue: date,
        heure_debut: startTime,
        heure_fin: endTime,
        type,
        priorite: priority,
        status,
        categorie,
        notes
      });
      setIsEditing(false);
    }
  };

  const priorityVal = event.priorite?.toLowerCase() || 'normale';
  const priorityStyle = PRIORITY_STYLES[priorityVal] || PRIORITY_STYLES['normale'];
  const typeLabel = TYPE_LABELS[event.type?.toLowerCase()] || TYPE_LABELS['autre'];
  const duration = getDuration(event.heure_debut, event.heure_fin);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      
      {/* Modal */}
      <div 
        className="relative w-full max-w-lg glass-panel rounded-2xl overflow-hidden border border-white/10 animate-in"
        onClick={(e) => e.stopPropagation()}
        style={{ animation: 'modalIn 0.25s ease-out' }}
      >
        {/* Header gradient bar */}
        <div className={`h-1.5 w-full bg-gradient-to-r ${
          event.type === 'cours' ? 'from-amber-500 to-orange-500' :
          event.type === 'reunion' ? 'from-blue-500 to-cyan-500' :
          'from-neon-purple to-neon-teal'
        }`} />

        {/* Close button */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white bg-white/10 hover:bg-white/20 rounded-full p-1.5 transition-all"
        >
          <X size={18} />
        </button>

        {isEditing ? (
          /* Form layout in edit mode */
          <form onSubmit={handleSave} className="p-6 flex flex-col gap-4 text-left">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Edit2 className="text-neon-purple" size={20} />
                Modifier l'activité
              </h2>
              <p className="text-xs text-gray-400 mt-1">Ajustez les détails de votre bloc de temps.</p>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold p-3 rounded-lg flex items-center gap-2">
                <AlertCircle size={14} />
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
                className="w-full bg-dark-900 border border-white/10 rounded-xl p-2.5 text-sm text-white focus:outline-none focus:border-neon-purple/50"
                required
              />
            </div>

            {/* Category & Type */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-400 mb-1">Catégorie</label>
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
              <div>
                <label className="block text-xs font-bold text-gray-400 mb-1">Type</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="w-full bg-dark-900 border border-white/10 rounded-xl p-2.5 text-sm text-white focus:outline-none focus:border-neon-purple/50"
                >
                  {Object.entries(TYPE_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Date */}
            <div>
              <label className="block text-xs font-bold text-gray-400 mb-1">Date</label>
              <input 
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-dark-900 border border-white/10 rounded-xl p-2.5 text-sm text-white focus:outline-none focus:border-neon-purple/50"
                required
              />
            </div>

            {/* Horaires */}
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-xs font-bold text-gray-400 mb-1">Début</label>
                <input 
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full bg-dark-900 border border-white/10 rounded-xl p-2.5 text-sm text-white focus:outline-none focus:border-neon-purple/50"
                  required
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs font-bold text-gray-400 mb-1">Fin</label>
                <input 
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full bg-dark-900 border border-white/10 rounded-xl p-2.5 text-sm text-white focus:outline-none focus:border-neon-purple/50"
                  required
                />
              </div>
            </div>

            {/* Priority & Status */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-400 mb-1">Priorité</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="w-full bg-dark-900 border border-white/10 rounded-xl p-2.5 text-sm text-white focus:outline-none focus:border-neon-purple/50"
                >
                  <option value="basse">🟢 Basse</option>
                  <option value="normale">🔵 Normale</option>
                  <option value="haute">🟡 Haute</option>
                  <option value="critique">🔴 Critique</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 mb-1">Statut</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full bg-dark-900 border border-white/10 rounded-xl p-2.5 text-sm text-white focus:outline-none focus:border-neon-purple/50"
                >
                  <option value="pending">En attente</option>
                  <option value="done">Terminé</option>
                </select>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-bold text-gray-400 mb-1">Notes / Description</label>
              <textarea 
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows="3"
                className="w-full bg-dark-900 border border-white/10 rounded-xl p-2.5 text-sm text-white focus:outline-none focus:border-neon-purple/50"
              />
            </div>

            {/* Action buttons */}
            <div className="flex gap-3 pt-2 border-t border-white/10 mt-2">
              <button 
                type="button"
                onClick={() => setIsEditing(false)}
                className="flex-1 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white font-bold text-sm transition-all"
              >
                Annuler
              </button>
              <button 
                type="submit"
                className="flex-1 py-2 bg-neon-purple text-active-day-text font-bold rounded-xl text-sm hover:shadow-[0_0_20px_rgba(168,85,247,0.5)] transition-all flex items-center justify-center gap-1.5"
              >
                <Check size={16} />
                <span>Enregistrer</span>
              </button>
            </div>
          </form>
        ) : (
          /* Normal read-only view */
          <div className="p-6 flex flex-col gap-5 text-left">
            {/* Title + Type + Priority */}
            <div>
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className={`text-xs px-2.5 py-1 rounded-full border font-bold ${priorityStyle}`}>
                  {priorityVal.charAt(0).toUpperCase() + priorityVal.slice(1)}
                </span>
                <span className="text-xs px-2.5 py-1 rounded-full bg-white/10 text-gray-300">
                  {typeLabel}
                </span>
                {event.categorie && (
                  <span className="text-xs px-2.5 py-1 rounded-full bg-neon-purple/20 text-neon-purple border border-neon-purple/30 font-bold">
                    📁 {event.categorie}
                  </span>
                )}
              </div>
              <h2 className="text-2xl font-black text-white leading-tight">{event.titre}</h2>
            </div>

            {/* Main info grid */}
            <div className="grid grid-cols-1 gap-3">
              {/* Date */}
              <div className="flex items-center gap-3 bg-white/5 rounded-xl p-3">
                <div className="bg-neon-purple/20 p-2 rounded-lg">
                  <Calendar size={18} className="text-neon-purple" />
                </div>
                <div>
                  <p className="text-xs text-gray-400">Date</p>
                  <p className="text-white font-bold">{formatDateFR(event.date_absolue)}</p>
                </div>
              </div>

              {/* Time */}
              {(event.heure_debut || event.heure_fin) && (
                <div className="flex items-center gap-3 bg-white/5 rounded-xl p-3">
                  <div className="bg-neon-teal/20 p-2 rounded-lg">
                    <Clock size={18} className="text-neon-teal" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-gray-400">Horaires</p>
                    <p className="text-white font-bold">
                      {event.heure_debut || '?'} — {event.heure_fin || '?'}
                      {duration && <span className="text-gray-400 font-normal ml-2">({duration})</span>}
                    </p>
                  </div>
                </div>
              )}

              {/* Location */}
              {event.lieu && event.lieu !== 'null' && (
                <div className="flex items-center gap-3 bg-white/5 rounded-xl p-3">
                  <div className="bg-blue-500/20 p-2 rounded-lg">
                    <MapPin size={18} className="text-blue-400" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Lieu</p>
                    <p className="text-white font-bold">{event.lieu}</p>
                  </div>
                </div>
              )}

              {/* Participants */}
              {event.participants && event.participants.length > 0 && event.participants[0] !== 'null' && (
                <div className="flex items-center gap-3 bg-white/5 rounded-xl p-3">
                  <div className="bg-pink-500/20 p-2 rounded-lg">
                    <Users size={18} className="text-pink-400" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Participants</p>
                    <p className="text-white font-bold">
                      {Array.isArray(event.participants) ? event.participants.join(', ') : event.participants}
                    </p>
                  </div>
                </div>
              )}

              {/* Source */}
              {event.source && event.source !== 'null' && (
                <div className="flex items-center gap-3 bg-white/5 rounded-xl p-3">
                  <div className="bg-white/10 p-2 rounded-lg">
                    <FileText size={18} className="text-gray-300" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Source</p>
                    <p className="text-white font-bold capitalize">{event.source}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Notes */}
            {event.notes && event.notes !== 'null' && (
              <div className="bg-white/5 rounded-xl p-4 border border-white/5 animate-fade-in">
                <p className="text-xs text-gray-400 mb-1">Notes</p>
                <p className="text-gray-200 text-sm leading-relaxed">{event.notes}</p>
              </div>
            )}

            {/* Status */}
            {event.status && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">Statut :</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                  event.status === 'done' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
                }`}>
                  {event.status === 'done' ? 'Termine' : 'En attente'}
                </span>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-3 pt-2 border-t border-white/10">
              {onUpdate && (
                <button 
                  onClick={() => setIsEditing(true)}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-neon-purple/20 text-neon-purple border border-neon-purple/30 hover:bg-neon-purple/40 font-bold text-sm transition-all"
                >
                  <Edit2 size={16} /> Modifier
                </button>
              )}
              {onAddToCalendar && (
                <button 
                  onClick={() => onAddToCalendar(event)}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-neon-purple/20 text-neon-purple border border-neon-purple/30 hover:bg-neon-purple/40 font-bold text-sm transition-all"
                >
                  <PlusCircle size={16} /> Ajouter au calendrier
                </button>
              )}
              {onDelete && event.id && (
                <button 
                  onClick={() => { onDelete(event.id); onClose(); }}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/40 font-bold text-sm transition-all"
                >
                  <Trash2 size={16} /> Supprimer
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes modalIn {
          from { opacity: 0; transform: scale(0.95) translateY(10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default EventModal;
