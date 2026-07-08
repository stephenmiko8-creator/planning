import React from 'react';
import { X, Calendar, Clock, MapPin, Users, BookOpen, Flag, Bell, RefreshCw, FileText, Trash2, PlusCircle } from 'lucide-react';

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

const EventModal = ({ event, onClose, onDelete, onAddToCalendar }) => {
  if (!event) return null;

  const priority = event.priorite?.toLowerCase() || 'normale';
  const priorityStyle = PRIORITY_STYLES[priority] || PRIORITY_STYLES['normale'];
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

        {/* Content */}
        <div className="p-6 flex flex-col gap-5">
          {/* Title + Type + Priority */}
          <div>
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className={`text-xs px-2.5 py-1 rounded-full border font-bold ${priorityStyle}`}>
                {priority.charAt(0).toUpperCase() + priority.slice(1)}
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
            <div className="bg-white/5 rounded-xl p-4 border border-white/5">
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
