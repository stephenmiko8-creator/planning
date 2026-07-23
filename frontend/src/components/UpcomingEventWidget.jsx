import React, { useState, useEffect, useMemo } from 'react';
import { Clock, Calendar as CalendarIcon } from 'lucide-react';

const UpcomingEventWidget = ({ events }) => {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const nextEvent = useMemo(() => {
    if (!events || events.length === 0) return null;
    
    // Sort events by date and time
    const upcoming = events.filter(e => {
      const eventDate = new Date(`${e.date_absolue}T${e.heure_debut}`);
      return eventDate > now;
    }).sort((a, b) => {
      const dateA = new Date(`${a.date_absolue}T${a.heure_debut}`);
      const dateB = new Date(`${b.date_absolue}T${b.heure_debut}`);
      return dateA - dateB;
    });

    return upcoming[0] || null;
  }, [events, now]);

  if (!nextEvent) return null;

  const eventTime = new Date(`${nextEvent.date_absolue}T${nextEvent.heure_debut}`);
  const diffMs = eventTime - now;
  const diffMins = Math.floor(diffMs / 60000);
  
  let timeStr = '';
  if (diffMins < 60) {
    timeStr = `dans ${diffMins} min`;
  } else {
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    timeStr = `dans ${hours}h ${mins > 0 ? mins + 'm' : ''}`;
  }
  
  // Format the date if it's not today
  const todayStr = now.toISOString().split('T')[0];
  const isToday = nextEvent.date_absolue === todayStr;

  return (
    <div className="w-full bg-gradient-to-r from-neon-purple/10 to-neon-teal/10 border border-white/10 rounded-xl px-3 py-2 flex items-center justify-between gap-3 backdrop-blur-sm hover:border-neon-purple/30 transition-all">
      <div className="flex items-center gap-2.5 min-w-0">
        <Clock className="text-neon-teal shrink-0" size={16} />
        <span className="text-[10px] uppercase font-bold tracking-wider text-neon-purple shrink-0 hidden sm:inline">
          Prochain :
        </span>
        <span className="text-white font-bold text-sm truncate">
          {nextEvent.titre}
        </span>
        <span className="text-xs text-gray-400 shrink-0 hidden sm:flex items-center gap-1">
          <CalendarIcon size={11} />
          {isToday ? "Auj." : new Date(nextEvent.date_absolue).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })} {nextEvent.heure_debut}
        </span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold hidden md:inline ${nextEvent.color_class || 'bg-gray-500/20 border border-gray-500/40 text-gray-300'}`}>
          {nextEvent.categorie || 'Général'}
        </span>
        <span className="text-sm font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400 whitespace-nowrap">
          {timeStr}
        </span>
      </div>
    </div>
  );
};

export default React.memo(UpcomingEventWidget);
