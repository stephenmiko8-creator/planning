import React, { useState } from 'react';
import { Calendar, Clock, MapPin, Users, PlusCircle, CheckCircle2 } from 'lucide-react';

const EventCard = ({ event, onAdd }) => {
  const [added, setAdded] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleAdd = async () => {
    if (!onAdd) return;
    setLoading(true);
    const success = await onAdd(event);
    if (success) {
      setAdded(true);
    }
    setLoading(false);
  };
  const getPriorityColor = (priority) => {
    switch (priority?.toLowerCase()) {
      case 'critique': return 'text-red-400 border-red-500/50 bg-red-500/10';
      case 'haute': return 'text-orange-400 border-orange-500/50 bg-orange-500/10';
      case 'basse': return 'text-green-400 border-green-500/50 bg-green-500/10';
      default: return 'text-neon-teal border-neon-teal/50 bg-neon-teal/10';
    }
  };

  return (
    <div className={`glass-panel p-4 flex flex-col gap-3 border-l-4 event-card-hover ${getPriorityColor(event.priorite)}`}>
      <div className="flex justify-between items-start">
        <h3 className="text-lg font-bold text-white">{event.titre}</h3>
        <span className="text-xs px-2 py-1 rounded-full bg-white/10 uppercase tracking-wider">
          {event.type}
        </span>
      </div>
      
      <div className="grid grid-cols-2 gap-2 text-sm text-gray-300">
        <div className="flex items-center gap-2">
          <Calendar size={14} className="text-neon-purple" />
          <span>{event.date_absolue}</span>
        </div>
        {(event.heure_debut || event.heure_fin) && (
          <div className="flex items-center gap-2">
            <Clock size={14} className="text-neon-purple" />
            <span>{event.heure_debut} - {event.heure_fin}</span>
          </div>
        )}
        {event.lieu && (
          <div className="flex items-center gap-2">
            <MapPin size={14} className="text-neon-teal" />
            <span>{event.lieu}</span>
          </div>
        )}
        {event.participants && event.participants.length > 0 && (
          <div className="flex items-center gap-2">
            <Users size={14} className="text-neon-teal" />
            <span>{event.participants.join(', ')}</span>
          </div>
        )}
      </div>

      {event.notes && (
        <div className="mt-2 text-xs text-gray-400 bg-dark-900/50 p-2 rounded-lg border border-white/5">
          {event.notes}
        </div>
      )}

      <div className="mt-3 flex justify-end">
        <button 
          onClick={handleAdd}
          disabled={added || loading}
          className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
            added 
              ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
              : 'bg-neon-blue/20 text-neon-blue border border-neon-blue/30 hover:bg-neon-blue/40'
          }`}
        >
          {added ? (
            <><CheckCircle2 size={16} /> Ajouté au calendrier</>
          ) : loading ? (
            <span className="animate-pulse">Ajout...</span>
          ) : (
            <><PlusCircle size={16} /> Ajouter au calendrier</>
          )}
        </button>
      </div>
    </div>
  );
};

export default EventCard;
