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
  const [viewMode, setViewMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < 768 ? 'day' : 'week';
    }
    return 'week';
  }); // 'week' or 'day'
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

  // Scroll to active hours on initial mount and when switching weeks
  useEffect(() => {
    const handleScroll = () => {
      if (!scrollContainerRef.current) return;
      
      // Find the earliest event time in the current week
      const earliestMinutes = weekEvents.reduce((earliest, e) => {
        const mins = timeToMinutes(e.heure_debut);
        return mins < earliest ? mins : earliest;
      }, 24 * 60);
      
      let scrollTargetMinutes = 0;
      if (earliestMinutes < 24 * 60) {
        // Scroll to 1 hour before the first event of the week
        scrollTargetMinutes = Math.max(earliestMinutes - 60, 0);
      } else {
        // No events — scroll to 1 hour before active start hour
        const startHourStr = config?.active_start_hour || '08:00';
        const [h] = startHourStr.split(':').map(Number);
        scrollTargetMinutes = Math.max(h - 1, 0) * 60;
      }
      
      scrollContainerRef.current.scrollTop = scrollTargetMinutes;
    };

    handleScroll();
    const timer = setTimeout(handleScroll, 100);
    return () => clearTimeout(timer);
  }, [weekOffset, config]);

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
        const gap = start - currentStart;
        if (gap >= 30) {
          slots.push({ start: currentStart, end: start });
        }
      }
      currentStart = Math.max(currentStart, end);
    });

    if (currentStart < activeEnd) {
      const gap = activeEnd - currentStart;
      if (gap >= 30) {
        slots.push({ start: currentStart, end: activeEnd });
      }
    }
    return slots;
  };

  // Calendar variables already declared above for useEffect use

  const conflictSet = useMemo(() => {
    const set = new Set();
    conflicts.forEach(c => { set.add(c.a.id); set.add(c.b.id); });
    return set;
  }, [conflicts]);


  return (
    <div className="flex flex-col gap-4">
      {/* Header navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3 sticky-calendar-header">
        {/* Left: Navigation Controls */}
        <div className="flex items-center gap-1.5">
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
            className="glass-panel p-2 hover:bg-white/10 transition-all rounded-xl"
            title="Précédent"
          >
            <ChevronLeft size={16} />
          </button>
          
          <button
            onClick={handleGoToToday}
            className="px-3 py-2 glass-panel text-xs font-bold hover:bg-white/10 text-white rounded-xl transition-all"
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
            className="glass-panel p-2 hover:bg-white/10 transition-all rounded-xl"
            title="Suivant"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Center: Date title */}
        <div className="text-center">
          <h3 className="text-sm md:text-lg font-extrabold text-white whitespace-nowrap notranslate" translate="no">
            {viewMode === 'week' ? (
              `${weekDates[0].getDate()} - ${weekDates[6].getDate()} ${MONTHS_FR[weekDates[6].getMonth()]} ${weekDates[6].getFullYear()}`
            ) : (
              `${DAYS_FR[selectedDayIndex]} ${weekDates[selectedDayIndex].getDate()} ${MONTHS_FR[weekDates[selectedDayIndex].getMonth()]} ${weekDates[selectedDayIndex].getFullYear()}`
            )}
          </h3>
        </div>

        {/* Right: Toggle actions */}
        <div className="flex items-center gap-2">
          {viewMode === 'day' && (
            <button
              onClick={() => setViewMode('week')}
              className="px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-xs font-bold hover:bg-white/10 text-white transition-all"
            >
              ← Semaine
            </button>
          )}
          <button
            onClick={() => setShowAvailabilities(!showAvailabilities)}
            className={`px-3 py-2 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5 border ${showAvailabilities
                ? 'event-green border-solid shadow-[0_0_10px_var(--event-green-border)]'
                : 'glass-panel text-gray-400 hover:text-white hover:bg-white/10 border-transparent'
              }`}
          >
            <Clock size={14} />
            <span className="notranslate" translate="no">{showAvailabilities ? 'Masquer dispos' : 'Afficher dispos'}</span>
          </button>
          <button
            onClick={() => setShowNotes(!showNotes)}
            className={`px-3 py-2 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5 border ${showNotes
                ? 'bg-neon-purple/20 text-neon-purple border-neon-purple/30 shadow-[0_0_10px_rgba(168,85,247,0.2)]'
                : 'glass-panel text-gray-400 hover:text-white hover:bg-white/10 border-transparent'
              }`}
          >
            <span>📝</span>
            <span className="notranslate" translate="no">{showNotes ? 'Masquer notes' : 'Afficher notes'}</span>
          </button>
        </div>
      </div>



      {/* Mobile Day Selector Bar */}
      <div className={`flex md:hidden justify-between bg-dark-900/60 p-2 rounded-xl border border-white/5 gap-1 mb-2 ${viewMode === 'week' ? 'hidden' : ''}`}>
        {weekDates.map((date, i) => {
          const isSelected = selectedDayIndex === i && viewMode === 'day';
          const isToday = formatDateKey(date) === todayKey;
          return (
            <button
              key={i}
              onClick={() => {
                setSelectedDayIndex(i);
                setViewMode('day');
              }}
              className={`flex-1 py-1.5 px-0.5 flex flex-col items-center justify-center transition-all rounded-lg ${
                isSelected ? 'text-neon-purple' : 'text-gray-400 hover:text-white'
              }`}
            >
              <span className="text-[10px] uppercase font-semibold mb-1">{DAYS_FR[i]}</span>
              <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                isSelected 
                  ? 'bg-neon-purple text-active-day-text shadow-md font-black ring-2 ring-neon-purple/30' 
                  : isToday
                  ? 'border border-neon-purple/50 text-neon-purple font-bold'
                  : ''
              }`}>
                {date.getDate()}
              </span>
            </button>
          );
        })}
      </div>

      {/* Calendar Grid */}
      <div className="glass-panel rounded-2xl overflow-hidden flex flex-col">
        <div 
          className={`grid border-b border-white/30 sticky-calendar-days ${viewMode === 'day' ? 'hidden md:grid' : ''}`} 
          style={{ 
            gridTemplateColumns: viewMode === 'week' ? '50px repeat(7, 1fr)' : '50px 1fr',
            paddingRight: 'var(--scrollbar-width, 0px)' 
          }}
        >
          {/* Hour column header — hidden scroll-to-events button */}
          <div 
            className="p-2 text-center text-xs text-gray-500 border-r border-white/20 cursor-pointer relative group"
            onClick={() => {
              if (!scrollContainerRef.current) return;
              setIsRefreshing(true);
              if (onRefresh) onRefresh();
              
              // Find the earliest event time in the current week
              const earliestMinutes = weekEvents.reduce((earliest, e) => {
                const mins = timeToMinutes(e.heure_debut);
                return mins < earliest ? mins : earliest;
              }, 24 * 60);
              
              if (earliestMinutes < 24 * 60) {
                // Scroll to 1 hour before the first event for context
                const targetScroll = Math.max((earliestMinutes - 60), 0);
                scrollContainerRef.current.scrollTo({ top: targetScroll, behavior: 'smooth' });
              } else {
                // No events — scroll to active start hour
                const startHourStr = config?.active_start_hour || '08:00';
                const [h] = startHourStr.split(':').map(Number);
                scrollContainerRef.current.scrollTo({ top: Math.max(h - 1, 0) * 60, behavior: 'smooth' });
              }
              
              setTimeout(() => setIsRefreshing(false), 800);
            }}
            title="Aller aux événements"
          >
            <span className={`transition-all duration-300 text-[10px] text-white ${isRefreshing ? 'opacity-60 animate-spin inline-block' : 'opacity-0 group-hover:opacity-40'}`}>↻</span>
          </div>
          {/* Day headers */}
          {viewMode === 'week' ? (
            weekDates.map((date, i) => {
              const isToday = formatDateKey(date) === todayKey;
              const isWeekend = i >= 5; // Sam=5, Dim=6
              return (
                <div
                  key={i}
                  onClick={() => {
                    setSelectedDayIndex(i);
                    setViewMode('day');
                  }}
                  className={`p-3 text-center border-r border-white/20 cursor-pointer hover:bg-white/5 transition-all ${isToday ? 'bg-neon-purple/20' : ''} ${isWeekend ? 'bg-white/3 opacity-40' : ''}`}
                >
                  <div className="text-xs text-gray-400 notranslate" translate="no">{DAYS_FR[i]}</div>
                  <div className={`text-lg font-bold notranslate ${isToday ? 'text-neon-purple' : isWeekend ? 'text-gray-600' : 'text-white'}`} translate="no">
                    {date.getDate()}
                  </div>
                </div>
              );
            })
          ) : (
            (() => {
              const date = weekDates[selectedDayIndex];
              const isToday = formatDateKey(date) === todayKey;
              return (
                <div className={`p-3 text-center border-r border-white/20 ${isToday ? 'bg-neon-purple/20' : ''}`}>
                  <div className="text-xs text-gray-400 notranslate" translate="no">{DAYS_FR[selectedDayIndex]}</div>
                  <div className={`text-lg font-bold notranslate ${isToday ? 'text-neon-purple' : 'text-white'}`} translate="no">
                    {date.getDate()}
                  </div>
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
                  <div className={`p-1 text-right text-xs border-r border-white/25 pr-2 pt-0 border-l-2 ${period.border} flex flex-col items-end justify-start`}>
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
                weekDates.map((date, di) => {
                  const dateKey = formatDateKey(date);
                  const dayEvents = getDayEventsWithSpillovers(date, weekEvents);
                  const processedEvents = layoutDayEvents(dayEvents);
                  const freeSlots = showAvailabilities ? getFreeSlots(dayEvents) : [];

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
                            {showNotes && duration >= 50 && e.notes && (
                              <div 
                                className={`mt-1.5 px-1 py-0.5 rounded text-[9px] truncate flex items-center gap-1 shadow-sm ${getNoteStyles(e.priorite).badgeClass}`}
                                title={e.notes}
                              >
                                <span className="text-[10px] flex-shrink-0">{getNoteStyles(e.priorite).icon}</span>
                                <span className="truncate flex-1">{e.notes}</span>
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
                  const date = weekDates[selectedDayIndex];
                  const dateKey = formatDateKey(date);
                  const dayEvents = getDayEventsWithSpillovers(date, weekEvents);
                  const processedEvents = layoutDayEvents(dayEvents);
                  const freeSlots = showAvailabilities ? getFreeSlots(dayEvents) : [];

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
                            {showNotes && duration >= 50 && e.notes && (
                              <div 
                                className={`mt-1.5 px-1 py-0.5 rounded text-[9px] truncate flex items-center gap-1 shadow-sm ${getNoteStyles(e.priorite).badgeClass}`}
                                title={e.notes}
                              >
                                <span className="text-[10px] flex-shrink-0">{getNoteStyles(e.priorite).icon}</span>
                                <span className="truncate flex-1">{e.notes}</span>
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
            </div></div>
        </div></div><style>{`
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
