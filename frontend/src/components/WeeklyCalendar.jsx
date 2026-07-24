import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Calendar, Clock, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';

const HOURS = Array.from({ length: 24 }, (_, i) => i); // 0h -> 23h
const DAYS_FR = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const MONTHS_FR = ['Janvier', 'Fevrier', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Aout', 'Septembre', 'Octobre', 'Novembre', 'Decembre'];

function getCourseColor(titre, type, categorie, categories = []) {
  if (categorie) {
    const match = categories.find(c => c.name.toLowerCase() === categorie.toLowerCase());
    if (match) {
      const cls = match.color_class;
      if (cls.includes('purple')) return 'event-purple';
      if (cls.includes('teal')) return 'event-teal';
      if (cls.includes('amber')) return 'event-amber';
      if (cls.includes('pink')) return 'event-pink';
      if (cls.includes('green')) return 'event-green';
      if (cls.includes('blue')) return 'event-blue';
      return 'event-indigo';
    }
  }

  const cat = (categorie || '').toLowerCase();
  if (cat.includes('travail')) return 'event-purple';
  if (cat.includes('personnel')) return 'event-teal';
  if (cat.includes('formation')) return 'event-amber';
  if (cat.includes('développement') || cat.includes('developpement')) return 'event-pink';

  const t = (titre || '').toLowerCase();
  const ty = (type || '').toLowerCase();

  if (
    t.includes('dispo') ||
    t.includes('libre') ||
    t.includes('disponibilit') ||
    ty.includes('dispo') ||
    ty.includes('libre') ||
    ty.includes('disponibilit')
  ) {
    return 'event-green';
  }
  if (t.includes('comptabilit')) return 'event-amber';
  if (t.includes('english')) return 'event-amber';
  if (t.includes('logiciel')) return 'event-blue';
  return 'event-indigo';
}

function getWeekDates(offset = 0, timezone = 'Europe/Paris') {
  // Récupérer la date du jour au fuseau configuré
  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: timezone });
  const today = new Date(todayStr + 'T12:00:00');
  const day = today.getDay();
  // En France, la semaine commence le lundi. 
  // Si on est dimanche (day === 0), on considère que c'est le 7ème jour de la semaine.
  const dayAdjusted = day === 0 ? 7 : day;

  const monday = new Date(today);
  monday.setDate(today.getDate() - dayAdjusted + 1 + offset * 7);

  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function formatDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function timeToMinutes(t) {
  if (!t) return 0;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function layoutDayEvents(dayEvents) {
  if (!dayEvents || dayEvents.length === 0) return [];

  // Trier par heure de début
  const sorted = [...dayEvents].sort((a, b) => timeToMinutes(a.heure_debut) - timeToMinutes(b.heure_debut));

  // Regrouper les événements qui se chevauchent mutuellement
  const groups = [];
  sorted.forEach(event => {
    const start = timeToMinutes(event.heure_debut);
    const end = timeToMinutes(event.heure_fin);

    let addedToGroup = false;
    for (const group of groups) {
      const overlaps = group.some(e => {
        const eStart = timeToMinutes(e.heure_debut);
        const eEnd = timeToMinutes(e.heure_fin);
        return start < eEnd && eStart < end;
      });
      if (overlaps) {
        group.push(event);
        addedToGroup = true;
        break;
      }
    }
    if (!addedToGroup) {
      groups.push([event]);
    }
  });

  // Distribuer les événements de chaque groupe dans des colonnes distinctes
  groups.forEach(group => {
    const cols = [];
    group.forEach(event => {
      let colIdx = 0;
      while (true) {
        if (!cols[colIdx]) {
          cols[colIdx] = [];
        }
        const overlaps = cols[colIdx].some(e => {
          const eStart = timeToMinutes(e.heure_debut);
          const eEnd = timeToMinutes(e.heure_fin);
          const start = timeToMinutes(event.heure_debut);
          const end = timeToMinutes(event.heure_fin);
          return start < eEnd && eStart < end;
        });
        if (!overlaps) {
          cols[colIdx].push(event);
          event.colIdx = colIdx;
          break;
        }
        colIdx++;
      }
    });
    group.forEach(event => {
      event.totalCols = cols.length;
    });
  });

  return sorted;
}

function getNoteStyles(priority) {
  const p = (priority || '').toLowerCase();
  switch (p) {
    case 'critique':
      return {
        icon: '🚨',
        badgeClass: 'bg-red-600 text-white font-black animate-pulse shadow-[0_0_8px_rgba(220,38,38,0.5)] border border-red-400/50'
      };
    case 'haute':
      return {
        icon: '⚠️',
        badgeClass: 'bg-orange-500 text-white font-black shadow-[0_0_6px_rgba(249,115,22,0.4)] border border-orange-400/30'
      };
    case 'basse':
      return {
        icon: 'ℹ️',
        badgeClass: 'bg-green-500/20 text-green-300 border border-green-500/30 font-medium'
      };
    default: // normale
      return {
        icon: '📝',
        badgeClass: 'bg-cyan-400 text-slate-950 font-black shadow-[0_0_6px_rgba(34,211,238,0.4)]'
      };
  }
}

function getDayEventsWithSpillovers(date, weekEvents) {
  const dateKey = formatDateKey(date);
  const dayEvents = weekEvents.filter(e => e.date_absolue === dateKey);

  const previousDate = new Date(date);
  previousDate.setDate(date.getDate() - 1);
  const previousDateKey = formatDateKey(previousDate);

  const spillingEvents = weekEvents.filter(e => {
    if (e.date_absolue !== previousDateKey) return false;
    const startMin = timeToMinutes(e.heure_debut);
    const endMin = timeToMinutes(e.heure_fin);
    return endMin < startMin; // Spills over past midnight
  }).map(e => {
    return {
      ...e,
      id: `${e.id}_spill`,
      heure_debut: '00:00',
      heure_fin: e.heure_fin,
      date_absolue: dateKey,
      isSpill: true,
      originalEvent: e
    };
  });

  return [...dayEvents, ...spillingEvents];
}

const WeeklyCalendar = ({ events, conflicts, onDeleteEvent, onSelectEvent, categories = [], onTimeSlotClick, config, onRefresh }) => {
  const [weekOffset, setWeekOffset] = useState(0);
  const [viewMode, setViewMode] = useState('week'); // Default to week view on all devices to match the promo image
  const [selectedDayIndex, setSelectedDayIndex] = useState(() => {
    if (typeof window !== 'undefined') {
      const day = new Date().getDay();
      return day === 0 ? 6 : day - 1;
    }
    return 0;
  }); // 0 = Lun, 6 = Dim
  const [isRefreshing, setIsRefreshing] = useState(false);

  const scrollContainerRef = useRef(null);

  const tz = config?.timezone || 'Europe/Paris';
  const todayKey = new Date().toLocaleDateString('en-CA', { timeZone: tz });
  const weekDates = getWeekDates(weekOffset, tz);

  const weekStart = formatDateKey(weekDates[0]);
  const weekEnd = formatDateKey(weekDates[6]);

  const weekEvents = useMemo(() => {
    const [y, m, d] = weekStart.split('-').map(Number);
    const prevDay = new Date(y, m - 1, d);
    prevDay.setDate(prevDay.getDate() - 1);
    const prevDayKey = formatDateKey(prevDay);
    return events.filter(e => e.date_absolue >= prevDayKey && e.date_absolue <= weekEnd);
  }, [events, weekStart, weekEnd]);

  // Scroll to active hours on initial mount, when switching weeks/days or when events update
  useEffect(() => {
    const handleScroll = () => {
      if (!scrollContainerRef.current) return;
      
      const targetEvents = viewMode === 'day' 
        ? (processedSingleDay?.dayEvents || []) 
        : weekEvents;

      // Find the earliest event time
      const earliestMinutes = targetEvents.reduce((earliest, e) => {
        const mins = timeToMinutes(e.heure_debut);
        return mins < earliest ? mins : earliest;
      }, 24 * 60);
      
      let scrollTargetMinutes = 0;
      if (earliestMinutes < 24 * 60) {
        // Scroll to 1 hour before the first event of the day/week
        scrollTargetMinutes = Math.max(earliestMinutes - 60, 0);
      } else {
        // No events — scroll to active start hour (default 07:00 / 08:00)
        const startHourStr = config?.active_start_hour || '08:00';
        const [h] = startHourStr.split(':').map(Number);
        scrollTargetMinutes = Math.max(h - 1, 0) * 60;
      }
      
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = scrollTargetMinutes;
      }
    };

    handleScroll();
    const t1 = setTimeout(handleScroll, 50);
    const t2 = setTimeout(handleScroll, 200);
    const t3 = setTimeout(handleScroll, 500);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [weekOffset, selectedDayIndex, viewMode, weekEvents, config]);

  // Adjust scrollbar width CSS variable for header alignment
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (el && el.parentElement) {
      const scrollbarWidth = el.offsetWidth - el.clientWidth;
      el.parentElement.style.setProperty('--scrollbar-width', `${scrollbarWidth}px`);
    }
  }, [viewMode]);

  const [showAvailabilities, setShowAvailabilities] = useState(false);
  const [showNotes, setShowNotes] = useState(() => {
    try {
      const saved = localStorage.getItem('calendar_show_notes');
      return saved !== null ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });

  useEffect(() => {
    localStorage.setItem('calendar_show_notes', JSON.stringify(showNotes));
  }, [showNotes]);

  const handleGoToToday = () => {
    setWeekOffset(0);
    const today = new Date();
    let day = today.getDay(); // 0 is Sun, 1 is Mon...
    const frDayIndex = day === 0 ? 6 : day - 1;
    setSelectedDayIndex(frDayIndex);
  };

  const minutesToTimeStr = (mins) => {
    const h = Math.floor(mins / 60).toString().padStart(2, '0');
    const m = (mins % 60).toString().padStart(2, '0');
    return `${h}:${m}`;
  };

  const formatDuration = (mins) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h${m.toString().padStart(2, '0')}`;
  };

  const getFreeSlots = (dayEvents) => {
    const sorted = [...dayEvents].sort((a, b) => timeToMinutes(a.heure_debut) - timeToMinutes(b.heure_debut));

    const startHourStr = config?.active_start_hour || '08:00';
    const endHourStr = config?.active_end_hour || '22:00';
    const [startH, startM] = startHourStr.split(':').map(Number);
    const [endH, endM] = endHourStr.split(':').map(Number);

    const activeStart = startH * 60 + startM;
    const activeEnd = endH * 60 + endM;
    let currentStart = activeStart;
    const slots = [];

    sorted.forEach(e => {
      const start = timeToMinutes(e.heure_debut);
      const end = timeToMinutes(e.heure_fin);
      if (start > currentStart) {
        slots.push({ start: currentStart, end: Math.min(start, activeEnd) });
      }
      if (end > currentStart) {
        currentStart = Math.max(currentStart, end);
      }
    });

    if (currentStart < activeEnd) {
      slots.push({ start: currentStart, end: activeEnd });
    }

    return slots.filter(s => (s.end - s.start) >= 30);
  };

  // Cache processed events layout per week to avoid recalculating overlapping columns on every re-render
  const processedWeekDays = useMemo(() => {
    return weekDates.map((date) => {
      const dateKey = formatDateKey(date);
      const dayEvents = getDayEventsWithSpillovers(date, weekEvents);
      const processedEvents = layoutDayEvents(dayEvents);
      const freeSlots = showAvailabilities ? getFreeSlots(dayEvents) : [];
      return {
        date,
        dateKey,
        dayEvents,
        processedEvents,
        freeSlots
      };
    });
  }, [weekDates, weekEvents, showAvailabilities, config]);

  const processedSingleDay = useMemo(() => {
    const date = weekDates[selectedDayIndex];
    if (!date) return null;
    const dateKey = formatDateKey(date);
    const dayEvents = getDayEventsWithSpillovers(date, weekEvents);
    const processedEvents = layoutDayEvents(dayEvents);
    const freeSlots = showAvailabilities ? getFreeSlots(dayEvents) : [];
    return {
      date,
      dateKey,
      dayEvents,
      processedEvents,
      freeSlots
    };
  }, [weekDates, selectedDayIndex, weekEvents, showAvailabilities, config]);

  // Calendar variables already declared above for useEffect use

  const conflictSet = useMemo(() => {
    const set = new Set();
    conflicts.forEach(c => { set.add(c.a.id); set.add(c.b.id); });
    return set;
  }, [conflicts]);


  return (
    <div className="flex flex-col gap-1.5 md:gap-4">
      {/* Header navigation */}
      <div className="flex items-center justify-between gap-2 sticky-calendar-header">
        {/* Left: Navigation Controls */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              if (viewMode === 'week') {
                setWeekOffset(w => w - 1);
              } else {
                if (selectedDayIndex > 0) {
                  setSelectedDayIndex(selectedDayIndex - 1);
                } else {
                  setWeekOffset(w => w - 1);
                  setSelectedDayIndex(6);
                }
              }
            }}
            className="glass-panel p-1.5 hover:bg-white/10 transition-all rounded-xl cursor-pointer"
            title="Précédent"
          >
            <ChevronLeft size={16} />
          </button>
          
          <button
            onClick={handleGoToToday}
            className="px-2.5 py-1.5 glass-panel text-[11px] font-extrabold hover:bg-white/10 text-white rounded-xl transition-all cursor-pointer"
          >
            Aujourd'hui
          </button>

          <button
            onClick={() => {
              if (viewMode === 'week') {
                setWeekOffset(w => w + 1);
              } else {
                if (selectedDayIndex < 6) {
                  setSelectedDayIndex(selectedDayIndex + 1);
                } else {
                  setWeekOffset(w => w + 1);
                  setSelectedDayIndex(0);
                }
              }
            }}
            className="glass-panel p-1.5 hover:bg-white/10 transition-all rounded-xl cursor-pointer"
            title="Suivant"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Center: Date title formatted concisely */}
        <div className="text-center flex flex-col items-center">
          <span className="text-[9px] md:text-xs font-black tracking-[0.15em] text-neon-purple uppercase drop-shadow-[0_0_8px_rgba(168,85,247,0.4)]">
            {viewMode === 'week' ? 'Weekly View' : 'Daily View'}
          </span>
          <h3 className="text-[11px] md:text-sm font-bold text-gray-300 mt-0.5 notranslate truncate max-w-[140px] md:max-w-none" translate="no">
            {viewMode === 'week' ? (
              `${weekDates[0].getDate()} - ${weekDates[6].getDate()} ${MONTHS_FR[weekDates[6].getMonth()]} ${weekDates[6].getFullYear()}`
            ) : (
              `${DAYS_FR[selectedDayIndex]} ${weekDates[selectedDayIndex].getDate()} ${MONTHS_FR[weekDates[selectedDayIndex].getMonth()]} ${weekDates[selectedDayIndex].getFullYear()}`
            )}
          </h3>
        </div>

        {/* Right: Quick actions for Dispos, Notes, and View Modes */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Segmented view mode toggle (Desktop) */}
          <div className="hidden md:flex bg-white/5 border border-white/10 p-0.5 rounded-xl">
            <button
              onClick={() => setViewMode('day')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'day'
                  ? 'bg-neon-purple text-white shadow-md'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Jour
            </button>
            <button
              onClick={() => setViewMode('week')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'week'
                  ? 'bg-neon-purple text-white shadow-md'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Semaine
            </button>
          </div>

          {/* Availability Dispos Toggle (Mobile & Desktop) */}
          <button
            onClick={() => setShowAvailabilities(!showAvailabilities)}
            className={`px-2 md:px-3 py-1.5 md:py-2 rounded-xl font-extrabold text-[10px] md:text-xs transition-all flex items-center gap-1 border cursor-pointer ${showAvailabilities
                ? 'event-green border-solid shadow-[0_0_10px_var(--event-green-border)]'
                : 'glass-panel text-gray-400 hover:text-white hover:bg-white/10 border-transparent'
              }`}
            title={showAvailabilities ? "Masquer les créneaux disponibles" : "Afficher les créneaux disponibles"}
          >
            <Clock size={13} />
            <span className="notranslate" translate="no">{showAvailabilities ? 'Dispos' : '+Dispos'}</span>
          </button>

          {/* Priority Notes Toggle (Mobile & Desktop) */}
          <button
            onClick={() => setShowNotes(!showNotes)}
            className={`px-2 md:px-3 py-1.5 md:py-2 rounded-xl font-extrabold text-[10px] md:text-xs transition-all flex items-center gap-1 border cursor-pointer ${showNotes
                ? 'bg-neon-purple/20 text-neon-purple border-neon-purple/30 shadow-[0_0_10px_rgba(168,85,247,0.2)]'
                : 'glass-panel text-gray-400 hover:text-white hover:bg-white/10 border-transparent'
              }`}
            title={showNotes ? "Masquer les notes" : "Afficher les notes"}
          >
            <span className="text-xs">📝</span>
            <span className="notranslate" translate="no">{showNotes ? 'Notes' : '+Notes'}</span>
          </button>
        </div>
      </div>

      {/* Notes Ticker Banner for reading complete notes without truncation */}
      {showNotes && (
        <div className="bg-neon-purple/10 border border-neon-purple/20 rounded-xl px-3 py-1.5 flex items-center gap-2 overflow-x-auto no-scrollbar text-xs shadow-sm">
          <span className="text-[10px] uppercase font-black text-neon-purple shrink-0 flex items-center gap-1">
            <span>📝</span> Notes :
          </span>
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar shrink-0">
            {(viewMode === 'day' ? (processedSingleDay?.dayEvents || []) : weekEvents)
              .filter(e => e.notes)
              .slice(0, 5)
              .map((evt, idx) => (
                <button
                  key={idx}
                  onClick={() => onSelectEvent && onSelectEvent(evt.isSpill ? evt.originalEvent : evt)}
                  className="bg-white/5 hover:bg-white/10 px-2 py-0.5 rounded-lg text-[10px] text-gray-200 border border-white/10 shrink-0 flex items-center gap-1.5 cursor-pointer transition-all"
                  title={`Cliquer pour voir : ${evt.titre} - ${evt.notes}`}
                >
                  <strong className="text-white font-extrabold">{evt.titre}:</strong>
                  <span className="text-gray-300">{evt.notes}</span>
                </button>
              ))}
            {(viewMode === 'day' ? (processedSingleDay?.dayEvents || []) : weekEvents).filter(e => e.notes).length === 0 && (
              <span className="text-[10px] text-gray-400">Aucune note spécifique pour les événements affichés.</span>
            )}
          </div>
        </div>
      )}

      {/* Calendar Grid Container (Horizontally Scrollable Container for 100% Aligned Columns) */}
      <div className="w-full overflow-x-auto no-scrollbar scroll-smooth">
        <div className={`glass-panel rounded-2xl overflow-hidden flex flex-col ${viewMode === 'week' ? 'min-w-[640px] md:min-w-full' : 'min-w-full'}`}>
          {/* Unified Aligned Table Grid Header */}
          <div 
            className="grid border-b border-white/20 sticky-calendar-days bg-[#0b1222]/95 shadow-sm" 
            style={{ 
              gridTemplateColumns: viewMode === 'week' ? '50px repeat(7, 1fr)' : '50px 1fr',
              paddingRight: 'var(--scrollbar-width, 0px)' 
            }}
          >
            {/* Hour column header — shows month/year, 7D/1D toggle, and handles refresh */}
            <div 
              className="sticky left-0 bg-[#0b1222] z-30 p-1.5 text-center border-r border-white/20 flex flex-col items-center justify-center gap-1 shrink-0"
              title="Aller aux événements"
            >
              <div 
                className="cursor-pointer flex flex-col items-center justify-center leading-none"
                onClick={() => {
                  if (!scrollContainerRef.current) return;
                  setIsRefreshing(true);
                  if (onRefresh) onRefresh();
                  
                  const earliestMinutes = weekEvents.reduce((earliest, e) => {
                    const mins = timeToMinutes(e.heure_debut);
                    return mins < earliest ? mins : earliest;
                  }, 24 * 60);
                  
                  if (earliestMinutes < 24 * 60) {
                    const targetScroll = Math.max((earliestMinutes - 60), 0);
                    scrollContainerRef.current.scrollTo({ top: targetScroll, behavior: 'smooth' });
                  } else {
                    const startHourStr = config?.active_start_hour || '08:00';
                    const [h] = startHourStr.split(':').map(Number);
                    scrollContainerRef.current.scrollTo({ top: Math.max(h - 1, 0) * 60, behavior: 'smooth' });
                  }
                  
                  setTimeout(() => setIsRefreshing(false), 800);
                }}
              >
                {isRefreshing ? (
                  <span className="text-[10px] text-white animate-spin">↻</span>
                ) : (
                  <>
                    <span className="text-[9px] font-black uppercase text-neon-purple tracking-wider">
                      {weekDates[0].toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '')}
                    </span>
                    <span className="text-[9px] font-bold text-gray-500 mt-0.5">
                      {weekDates[0].getFullYear().toString().slice(-2)}
                    </span>
                  </>
                )}
              </div>

              {/* View Mode Toggle Pill (7D vs 1D) */}
              <button
                onClick={() => setViewMode(v => v === 'week' ? 'day' : 'week')}
                className={`px-1 py-0.5 rounded text-[8px] font-black uppercase tracking-tighter transition-all border shrink-0 ${
                  viewMode === 'week'
                    ? 'bg-neon-purple/20 text-neon-purple border-neon-purple/40 shadow-[0_0_6px_rgba(168,85,247,0.3)]'
                    : 'bg-cyan-500/20 text-cyan-400 border-cyan-400/40'
                }`}
                title={viewMode === 'week' ? "Afficher 1 Jour (Cliquez pour zoomer)" : "Afficher 7 Jours"}
              >
                {viewMode === 'week' ? '7D' : '1D'}
              </button>
            </div>

            {/* Day headers — Perfectly 1-to-1 aligned with calendar columns directly below */}
            {viewMode === 'week' ? (
              weekDates.map((date, i) => {
                const isToday = formatDateKey(date) === todayKey;
                const isSelected = selectedDayIndex === i;
                const isWeekend = i >= 5; // Sam=5, Dim=6
                return (
                  <div
                    key={i}
                    onClick={() => {
                      setSelectedDayIndex(i);
                      // Tapping a day switches to single day schedule plan view on mobile
                      if (typeof window !== 'undefined' && window.innerWidth < 768) {
                        setViewMode('day');
                      }
                    }}
                    className={`p-1.5 md:p-2 text-center border-r border-white/20 cursor-pointer hover:bg-white/5 transition-all flex flex-col items-center justify-center ${isToday && !isSelected ? 'bg-neon-purple/5' : ''}`}
                    title={`Programme du ${DAYS_FR[i]} ${date.getDate()}`}
                  >
                    <div className={`flex flex-col items-center justify-center w-full py-1 px-1 transition-all ${
                      isSelected 
                        ? 'border-2 border-neon-purple bg-neon-purple/20 rounded-xl shadow-[0_0_12px_rgba(168,85,247,0.3)] font-bold scale-105' 
                        : isToday
                        ? 'border border-neon-purple/40 rounded-xl bg-neon-purple/5'
                        : 'rounded-xl'
                    }`}>
                      <span className={`text-[9px] md:text-[10px] uppercase tracking-wider notranslate ${
                        isSelected ? 'text-neon-purple font-extrabold' : 'text-gray-400'
                      }`} translate="no">
                        {DAYS_FR[i]}
                      </span>
                      <span className={`text-xs md:text-base font-bold mt-0.5 notranslate ${
                        isSelected ? 'text-white font-black' : isToday ? 'text-neon-purple font-extrabold' : isWeekend ? 'text-gray-400' : 'text-white'
                      }`} translate="no">
                        {date.getDate()}
                      </span>
                    </div>
                  </div>
                );
              })
            ) : (
              (() => {
                const date = weekDates[selectedDayIndex];
                const isToday = formatDateKey(date) === todayKey;
                return (
                  <div 
                    className={`p-2 text-center border-r border-white/20 flex items-center justify-between px-4 ${isToday ? 'bg-neon-purple/10' : ''}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400 uppercase font-bold notranslate" translate="no">{DAYS_FR[selectedDayIndex]}</span>
                      <span className={`text-base font-extrabold notranslate ${isToday ? 'text-neon-purple' : 'text-white'}`} translate="no">
                        {date.getDate()} {MONTHS_FR[date.getMonth()]}
                      </span>
                    </div>
                    <button
                      onClick={() => setViewMode('week')}
                      className="px-2 py-1 bg-white/5 hover:bg-white/10 text-cyan-400 border border-cyan-400/30 rounded-xl text-[10px] font-bold transition-all"
                    >
                      ← Voir les 7 Jours
                    </button>
                  </div>
                );
              })()
            )}
          </div>

        {/* Scrollable container for time rows grid */}
        <div
          ref={scrollContainerRef}
          className="overflow-y-scroll calendar-scroll"
          style={{ height: '600px', scrollbarGutter: 'stable' }}
        >
          {/* Time rows grid */}
          <div className="relative" style={{ minHeight: `${HOURS.length * 60}px` }}>
            {/* Background Grid */}
            {HOURS.map((hour, hi) => {
              const h = parseInt(hour);
              const getPeriod = (h) => {
                if (h >= 0 && h < 6) return { label: 'Nuit', color: 'text-indigo-400', border: 'border-l-indigo-500/60', bg: 'bg-indigo-500/5', icon: '🌙' };
                if (h >= 6 && h < 12) return { label: 'Matin', color: 'text-yellow-400', border: 'border-l-yellow-500/60', bg: 'bg-yellow-500/5', icon: '☀️' };
                if (h >= 12 && h < 18) return { label: 'Après-midi', color: 'text-orange-400', border: 'border-l-orange-500/60', bg: 'bg-orange-500/5', icon: '🌤️' };
                return { label: 'Soirée', color: 'text-purple-400', border: 'border-l-purple-500/60', bg: 'bg-purple-500/5', icon: '🌆' };
              };
              const period = getPeriod(h);
              const isBoundary = h === 0 || h === 6 || h === 12 || h === 18;

              return (
                <div 
                  key={hi} 
                  className={`grid border-b border-white/30 ${period.bg}`} 
                  style={{ 
                    height: '60px',
                    gridTemplateColumns: viewMode === 'week' ? '50px repeat(7, 1fr)' : '50px 1fr'
                  }}
                >
                  <div className={`sticky left-0 bg-[#0b1222] z-20 p-1 text-right text-xs border-r border-white/25 pr-2 pt-0 border-l-2 ${period.border} flex flex-col items-end justify-start`}>
                    <span className={`${period.color} font-semibold`}>{hour}:00</span>
                    {isBoundary && (
                      <span className={`${period.color} text-[9px] opacity-70 mt-0.5`}>
                        {period.icon} {period.label}
                      </span>
                    )}
                  </div>
                  {viewMode === 'week' ? (
                    Array.from({ length: 7 }).map((_, di) => {
                      const date = weekDates[di];
                      const dateKey = formatDateKey(date);
                      const isToday = dateKey === todayKey;

                      return (
                        <div
                          key={di}
                          onClick={() => {
                            const startHour = hour.toString().padStart(2, '0') + ':00';
                            const endHour = (hour + 1).toString().padStart(2, '0') + ':00';
                            onTimeSlotClick && onTimeSlotClick(dateKey, startHour, endHour);
                          }}
                          className={`border-r border-white/20 cursor-pointer hover:bg-white/5 transition-colors bg-dark-900 ${isToday ? 'relative after:absolute after:inset-0 after:bg-neon-purple/20' : ''
                            }`}
                        />
                      );
                    })
                  ) : (
                    (() => {
                      const date = weekDates[selectedDayIndex];
                      const dateKey = formatDateKey(date);
                      const isToday = dateKey === todayKey;

                      return (
                        <div
                          onClick={() => {
                            const startHour = hour.toString().padStart(2, '0') + ':00';
                            const endHour = (hour + 1).toString().padStart(2, '0') + ':00';
                            onTimeSlotClick && onTimeSlotClick(dateKey, startHour, endHour);
                          }}
                          className={`border-r border-white/20 cursor-pointer hover:bg-white/5 transition-colors bg-dark-900 ${isToday ? 'relative after:absolute after:inset-0 after:bg-neon-purple/20' : ''
                            }`}
                        />
                      );
                    })()
                  )}
                </div>
              );
            })}

            {/* Absolute Events Overlay */}
            <div 
              className="absolute top-0 left-0 right-0 bottom-0 pointer-events-none grid"
              style={{
                gridTemplateColumns: viewMode === 'week' ? '50px repeat(7, 1fr)' : '50px 1fr'
              }}
            >
              {/* Hour labels spacer column */}
              <div className="border-r border-white/20" />

              {/* columns for events */}
              {viewMode === 'week' ? (
                processedWeekDays.map(({ dateKey, processedEvents, freeSlots }, di) => {
                  return (
                    <div key={di} className="relative h-full pointer-events-none">
                      {/* Render Free Slots */}
                      {freeSlots.map((slot, si) => {
                        const topOffset = slot.start;
                        const duration = slot.end - slot.start;
                        const startStr = minutesToTimeStr(slot.start);
                        const endStr = minutesToTimeStr(slot.end);

                        return (
                          <div
                            key={`free-${si}`}
                            onClick={(ev) => {
                              ev.stopPropagation();
                              onTimeSlotClick && onTimeSlotClick(dateKey, startStr, endStr);
                            }}
                            className="absolute rounded-md border border-dashed cursor-pointer pointer-events-auto p-1 text-center transition-all flex flex-col justify-center items-center hover:z-20 event-green opacity-90 hover:opacity-100 group"
                            style={{
                              top: `${topOffset}px`,
                              height: `${duration}px`,
                              left: '2%',
                              width: '96%',
                              zIndex: 2
                            }}
                          >
                            <span className="text-[10px] font-bold flex items-center gap-1 text-current">
                              <Clock size={10} /> Dispo ({formatDuration(duration)})
                            </span>
                            <span className="text-[9px] opacity-80 text-current">
                              {startStr} - {endStr}
                            </span>
                          </div>
                        );
                      })}
                      {/* Dark backgrounds for events to mask the green grid */}
                      {processedEvents.map((e, ei) => {
                        const startMin = timeToMinutes(e.heure_debut);
                        const endMin = timeToMinutes(e.heure_fin);
                        const topOffset = startMin;
                        const duration = Math.max(endMin >= startMin ? (endMin - startMin) : (1440 - startMin), 30);
                        const widthPercent = 100 / e.totalCols;
                        const leftPercent = e.colIdx * widthPercent;
                        const animDelay = `${(di * 0.12) + (ei * 0.04)}s`;

                        return (
                          <div
                            key={`mask-${e.id || ei}`}
                            className="absolute bg-dark-900 rounded-md animate-sky-panel"
                            style={{
                              top: `${topOffset}px`,
                              height: `${duration}px`,
                              left: `${leftPercent}%`,
                              width: `${widthPercent - 1}%`,
                              zIndex: 0,
                              animationDelay: animDelay
                            }}
                          />
                        );
                      })}

                      {processedEvents.map((e, ei) => {
                        const startMin = timeToMinutes(e.heure_debut);
                        const endMin = timeToMinutes(e.heure_fin);
                        const topOffset = startMin;
                        const duration = Math.max(endMin >= startMin ? (endMin - startMin) : (1440 - startMin), 30);
                        const isConflict = conflictSet.has(e.isSpill ? e.originalEvent.id : e.id);

                        const widthPercent = 100 / e.totalCols;
                        const leftPercent = e.colIdx * widthPercent;

                        const animDelay = `${(di * 0.12) + (ei * 0.04)}s`;
                        return (
                          <div
                            key={e.id || ei}
                            className={`absolute rounded-md border px-1 py-0.5 text-xs overflow-hidden cursor-pointer pointer-events-auto group transition-all hover:z-20 hover:shadow-lg animate-sky-panel event-card-hover ${getCourseColor(e.titre, e.type, e.categorie, categories)} ${isConflict ? 'ring-2 ring-red-500 animate-pulse' : ''}`}
                            style={{
                              top: `${topOffset}px`,
                              height: `${duration}px`,
                              left: `${leftPercent}%`,
                              width: `${widthPercent - 1}%`,
                              zIndex: isConflict ? 10 : 1,
                              animationDelay: animDelay
                            }}
                            onClick={() => onSelectEvent && onSelectEvent(e.isSpill ? e.originalEvent : e)}
                            title={`${e.titre}\n${e.heure_debut} - ${e.heure_fin}${e.notes ? `\nNote: ${e.notes}` : ''}`}
                          >
                            <div className="font-bold truncate flex items-center gap-1" style={{ fontSize: '10px' }}>
                              <span className="truncate">{e.isSpill ? `🌙 ${e.titre}` : e.titre}</span>
                              {showNotes && e.notes && (
                                <span className="text-[8px] flex-shrink-0 animate-pulse" title={e.notes}>
                                  {getNoteStyles(e.priorite).icon}
                                </span>
                              )}
                            </div>
                            <div className="opacity-70" style={{ fontSize: '9px' }}>{e.heure_debut}-{e.heure_fin}</div>
                            {showNotes && e.notes && (
                              <div 
                                className={`mt-1 px-1 py-0.5 rounded text-[9px] leading-tight break-words whitespace-normal flex items-start gap-1 shadow-sm ${getNoteStyles(e.priorite).badgeClass}`}
                                title={e.notes}
                              >
                                <span className="text-[9px] flex-shrink-0 mt-0.5">{getNoteStyles(e.priorite).icon}</span>
                                <span className="break-words line-clamp-3 flex-1">{e.notes}</span>
                              </div>
                            )}
                            {onDeleteEvent && (
                              <button
                                onClick={(ev) => { ev.stopPropagation(); onDeleteEvent(e.isSpill ? e.originalEvent.id : e.id); }}
                                className="absolute top-0.5 right-0.5 opacity-100 md:opacity-0 md:group-hover:opacity-100 bg-red-600 rounded p-0.5 transition-opacity"
                              >
                                <Trash2 size={10} />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })
              ) : (
                (() => {
                  if (!processedSingleDay) return null;
                  const { dateKey, processedEvents, freeSlots } = processedSingleDay;

                  return (
                    <div className="relative h-full pointer-events-none">
                      {/* Render Free Slots */}
                      {freeSlots.map((slot, si) => {
                        const topOffset = slot.start;
                        const duration = slot.end - slot.start;
                        const startStr = minutesToTimeStr(slot.start);
                        const endStr = minutesToTimeStr(slot.end);

                        return (
                          <div
                            key={`free-${si}`}
                            onClick={(ev) => {
                              ev.stopPropagation();
                              onTimeSlotClick && onTimeSlotClick(dateKey, startStr, endStr);
                            }}
                            className="absolute rounded-md border border-dashed cursor-pointer pointer-events-auto p-1 text-center transition-all flex flex-col justify-center items-center hover:z-20 event-green opacity-90 hover:opacity-100 group"
                            style={{
                              top: `${topOffset}px`,
                              height: `${duration}px`,
                              left: '2%',
                              width: '96%',
                              zIndex: 2
                            }}
                          >
                            <span className="text-[11px] font-bold flex items-center gap-1 text-current">
                              <Clock size={11} /> Disponible ({formatDuration(duration)})
                            </span>
                            <span className="text-[10px] opacity-80 text-current">
                              {startStr} - {endStr}
                            </span>
                          </div>
                        );
                      })}
                      {/* Dark backgrounds for events to mask the green grid */}
                      {processedEvents.map((e, ei) => {
                        const startMin = timeToMinutes(e.heure_debut);
                        const endMin = timeToMinutes(e.heure_fin);
                        const topOffset = startMin;
                        const duration = Math.max(endMin >= startMin ? (endMin - startMin) : (1440 - startMin), 30);
                        const widthPercent = 100 / e.totalCols;
                        const leftPercent = e.colIdx * widthPercent;

                        return (
                          <div
                            key={`mask-${e.id || ei}`}
                            className="absolute bg-dark-900 rounded-md animate-sky-panel"
                            style={{
                              top: `${topOffset}px`,
                              height: `${duration}px`,
                              left: `${leftPercent}%`,
                              width: `${widthPercent - 1}%`,
                              zIndex: 0
                            }}
                          />
                        );
                      })}

                      {processedEvents.map((e, ei) => {
                        const startMin = timeToMinutes(e.heure_debut);
                        const endMin = timeToMinutes(e.heure_fin);
                        const topOffset = startMin;
                        const duration = Math.max(endMin >= startMin ? (endMin - startMin) : (1440 - startMin), 30);
                        const isConflict = conflictSet.has(e.isSpill ? e.originalEvent.id : e.id);

                        const widthPercent = 100 / e.totalCols;
                        const leftPercent = e.colIdx * widthPercent;

                        return (
                          <div
                            key={e.id || ei}
                            className={`absolute rounded-md border px-1 py-0.5 text-xs overflow-hidden cursor-pointer pointer-events-auto group transition-all hover:z-20 hover:shadow-lg animate-sky-panel event-card-hover ${getCourseColor(e.titre, e.type, e.categorie, categories)} ${isConflict ? 'ring-2 ring-red-500 animate-pulse' : ''}`}
                            style={{
                              top: `${topOffset}px`,
                              height: `${duration}px`,
                              left: `${leftPercent}%`,
                              width: `${widthPercent - 1}%`,
                              zIndex: isConflict ? 10 : 1
                            }}
                            onClick={() => onSelectEvent && onSelectEvent(e.isSpill ? e.originalEvent : e)}
                            title={`${e.titre}\n${e.heure_debut} - ${e.heure_fin}${e.notes ? `\nNote: ${e.notes}` : ''}`}
                          >
                            <div className="font-bold truncate flex items-center gap-1" style={{ fontSize: '10px' }}>
                              <span className="truncate">{e.isSpill ? `🌙 ${e.titre}` : e.titre}</span>
                              {showNotes && e.notes && (
                                <span className="text-[8px] flex-shrink-0 animate-pulse" title={e.notes}>
                                  {getNoteStyles(e.priorite).icon}
                                </span>
                              )}
                            </div>
                            <div className="opacity-70" style={{ fontSize: '9px' }}>{e.heure_debut}-{e.heure_fin}</div>
                            {showNotes && e.notes && (
                              <div 
                                className={`mt-1 px-1 py-0.5 rounded text-[9px] leading-tight break-words whitespace-normal flex items-start gap-1 shadow-sm ${getNoteStyles(e.priorite).badgeClass}`}
                                title={e.notes}
                              >
                                <span className="text-[9px] flex-shrink-0 mt-0.5">{getNoteStyles(e.priorite).icon}</span>
                                <span className="break-words line-clamp-3 flex-1">{e.notes}</span>
                              </div>
                            )}
                            {onDeleteEvent && (
                              <button
                                onClick={(ev) => { ev.stopPropagation(); onDeleteEvent(e.isSpill ? e.originalEvent.id : e.id); }}
                                className="absolute top-0.5 right-0.5 opacity-100 md:opacity-0 md:group-hover:opacity-100 bg-red-600 rounded p-0.5 transition-opacity"
                              >
                                <Trash2 size={10} />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })()
              )}
            </div>
          </div>
        </div>
      </div>
    </div>

      <style>{`
        @keyframes skyPanelIn {
          0% {
            opacity: 0;
            transform: perspective(1200px) translate3d(60px, -250px, 500px) rotateX(-65deg) rotateY(15deg);
            filter: blur(6px);
          }
          100% {
            opacity: 1;
            transform: perspective(1200px) translate3d(0, 0, 0) rotateX(0deg) rotateY(0deg);
            filter: blur(0);
          }
        }
        .animate-sky-panel {
          animation: skyPanelIn 0.75s cubic-bezier(0.16, 1, 0.3, 1) both;
          transform-style: preserve-3d;
          backface-visibility: hidden;
        }
        /* Custom scrollbar styling for calendar */
        .calendar-scroll::-webkit-scrollbar {
          width: 6px;
        }
        .calendar-scroll::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.02);
          border-radius: 8px;
        }
        .calendar-scroll::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 8px;
        }
        .calendar-scroll::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.2);
        }
      `}</style>
    </div>
  );
};

export default WeeklyCalendar;
