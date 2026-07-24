import React, { useMemo, useState } from 'react';
import { BarChart3, Clock, BookOpen, AlertTriangle, TrendingUp, Calendar, FileText, Sparkles, Copy, Check, PieChart, Activity, LogIn, RefreshCw } from 'lucide-react';
import { API_BASE_URL } from '../config';

const getCategoryColor = (catName, categories = []) => {
  const match = categories.find(c => c.name.toLowerCase() === catName.toLowerCase());
  if (match) {
    const bgMatch = match.color_class.match(/bg-\w+-\d+/);
    return bgMatch ? bgMatch[0] : 'bg-indigo-500';
  }
  const cat = catName.toLowerCase();
  if (cat.includes('travail')) return 'bg-purple-500';
  if (cat.includes('personnel')) return 'bg-teal-500';
  if (cat.includes('formation')) return 'bg-amber-500';
  if (cat.includes('développement') || cat.includes('developpement')) return 'bg-pink-500';
  if (cat.includes('dispo')) return 'bg-green-500';
  return 'bg-indigo-500';
};

const COURSE_COLORS = {
  'Comptabilite': 'bg-amber-500',
  'Business English': 'bg-emerald-500',
  'Logiciels': 'bg-blue-500',
  'default': 'bg-purple-500'
};

function matchCourse(titre) {
  if (!titre) return 'default';
  if (titre.toLowerCase().includes('comptabilit')) return 'Comptabilite';
  if (titre.toLowerCase().includes('english')) return 'Business English';
  if (titre.toLowerCase().includes('logiciel')) return 'Logiciels';
  return 'default';
}

function getEventCategory(e, categories = []) {
  if (e.categorie) {
    const match = categories.find(c => c.name.toLowerCase() === e.categorie.toLowerCase());
    if (match) return match.name;
  }
  const t = (e.titre || '').toLowerCase();
  const ty = (e.type || '').toLowerCase();
  if (t.includes('dispo') || t.includes('libre') || t.includes('disponibilit') || ty.includes('dispo')) {
    return 'Disponibilité';
  }
  if (t.includes('sephora') || t.includes('orgemont') || t.includes('macdonald') || t.includes('shift') || t.includes('travail') || ty.includes('travail')) {
    return 'Travail';
  }
  if (t.includes('comptabilit') || t.includes('english') || t.includes('logiciel') || t.includes('cours') || ty.includes('cours')) {
    return 'Formation';
  }
  if (t.includes('code') || t.includes('apprentissage') || t.includes('projet') || t.includes('développement') || t.includes('developpement')) {
    return 'Développement';
  }
  if (t.includes('perso') || t.includes('sport') || t.includes('famille') || t.includes('loisir')) {
    return 'Temps Personnel';
  }
  return 'Autre';
}

function isEventRealized(e) {
  if (e.status === 'done') return true;
  if (e.status === 'canceled') return false;
  
  const now = new Date();
  const dateStr = e.date_absolue; // 'YYYY-MM-DD'
  if (!dateStr) return false;
  
  const endTimeStr = e.heure_fin || '00:00';
  const [y, m, d] = dateStr.split('-').map(Number);
  const [h, min] = endTimeStr.split(':').map(Number);
  
  const startMin = e.heure_debut ? e.heure_debut.split(':').map(Number) : [0, 0];
  const startMinutes = startMin[0] * 60 + startMin[1];
  const endMinutes = h * 60 + min;
  
  let eventEnd = new Date(y, m - 1, d, h, min);
  if (endMinutes < startMinutes) {
    // Spans past midnight, so it ends on the following day
    eventEnd.setDate(eventEnd.getDate() + 1);
  }
  return eventEnd <= now;
}

function normalizeActivityTitle(title) {
  if (!title) return 'Sans titre';
  const t = title.toLowerCase();
  if (t.includes('macdonald') || t.includes('macdo') || t.includes('mcdonald')) {
    return "McDonald's";
  }
  if (t.includes('sephora')) {
    return 'Sephora';
  }
  return title;
}

const StatsPanel = ({ events, conflicts, categories = [], token, user, setIsSubOpen }) => {
  // Report states
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [report, setReport] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [error, setError] = useState('');
  const [tableFilter, setTableFilter] = useState('realized'); // 'realized', 'pending', 'all'
  
  // Coach states
  const [coachInsights, setCoachInsights] = useState(null);
  const [isGeneratingCoach, setIsGeneratingCoach] = useState(false);
  const [coachError, setCoachError] = useState('');

  const handleGenerateCoachInsights = async () => {
    setIsGeneratingCoach(true);
    setCoachError('');
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const response = await fetch(`${API_BASE_URL}/api/scan/coach`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          events,
          currentDate: new Date().toISOString().split('T')[0]
        })
      });

      if (!response.ok) {
        throw new Error('Erreur lors de la génération des conseils');
      }

      const data = await response.json();
      if (data.success) {
        setCoachInsights(data);
      } else {
        throw new Error(data.error || "Aucun conseil généré.");
      }
    } catch (err) {
      console.error(err);
      setCoachError(err.message);
    } finally {
      setIsGeneratingCoach(false);
    }
  };

  const stats = useMemo(() => {
    let totalMinutes = 0;
    const categoryMinutes = {};
    const categoryActivities = {};
    const courseMap = {};
    const dayMap = {};

    events.forEach(e => {
      // Calculate duration
      const start = e.heure_debut ? e.heure_debut.split(':').map(Number) : [0, 0];
      const end = e.heure_fin ? e.heure_fin.split(':').map(Number) : [0, 0];
      let dur = (end[0] * 60 + end[1]) - (start[0] * 60 + start[1]);
      if (dur < 0) dur += 24 * 60; // Gérer les horaires de nuit
      
      const cat = getEventCategory(e, categories);
      if (dur > 0) {
        totalMinutes += dur;
        categoryMinutes[cat] = (categoryMinutes[cat] || 0) + dur;
      }

      // Group activities by category
      if (!categoryActivities[cat]) {
        categoryActivities[cat] = {};
      }
      const title = normalizeActivityTitle(e.titre);
      if (!categoryActivities[cat][title]) {
        categoryActivities[cat][title] = { minutes: 0, count: 0 };
      }
      categoryActivities[cat][title].minutes += dur;
      categoryActivities[cat][title].count += 1;

      // Map courses if categorized as Formation or matches study course name
      if (cat === 'Formation' || matchCourse(e.titre) !== 'default') {
        const course = matchCourse(e.titre);
        const courseLabel = course === 'default' ? normalizeActivityTitle(e.titre) : course;
        courseMap[courseLabel] = (courseMap[courseLabel] || 0) + 1;
      }

      const day = e.date_absolue;
      dayMap[day] = (dayMap[day] || 0) + 1;
    });

    const totalHours = Math.round(totalMinutes / 60 * 10) / 10;
    const categoryHours = {};
    Object.entries(categoryMinutes).forEach(([cat, mins]) => {
      categoryHours[cat] = Math.round(mins / 60 * 10) / 10;
    });

    const busiestDay = Object.entries(dayMap).sort((a, b) => b[1] - a[1])[0];
    const avgPerDay = Object.keys(dayMap).length > 0 
      ? Math.round(events.length / Object.keys(dayMap).length * 10) / 10 
      : 0;

    return { totalHours, categoryHours, categoryActivities, courseMap, busiestDay, avgPerDay, totalDays: Object.keys(dayMap).length };
  }, [events, categories]);

  const tableData = useMemo(() => {
    const dataMap = {};
    
    events.forEach(e => {
      const title = normalizeActivityTitle(e.titre);
      const cat = getEventCategory(e, categories);
      
      const start = e.heure_debut ? e.heure_debut.split(':').map(Number) : [0, 0];
      const end = e.heure_fin ? e.heure_fin.split(':').map(Number) : [0, 0];
      let dur = (end[0] * 60 + end[1]) - (start[0] * 60 + start[1]);
      if (dur < 0) dur += 24 * 60; // Gérer les horaires de nuit
      
      const realized = isEventRealized(e);
      
      if (!dataMap[title]) {
        dataMap[title] = {
          title,
          category: cat,
          totalMinutes: 0,
          totalCount: 0,
          realizedMinutes: 0,
          realizedCount: 0,
          pendingMinutes: 0,
          pendingCount: 0
        };
      }
      
      dataMap[title].totalMinutes += dur;
      dataMap[title].totalCount += 1;
      
      if (realized) {
        dataMap[title].realizedMinutes += dur;
        dataMap[title].realizedCount += 1;
      } else {
        dataMap[title].pendingMinutes += dur;
        dataMap[title].pendingCount += 1;
      }
    });
    
    return Object.values(dataMap);
  }, [events, categories]);

  const maxCategoryHours = Math.max(...Object.values(stats.categoryHours), 1);
  const maxCourseCount = Math.max(...Object.values(stats.courseMap), 1);

  // IA Report Generation Handler
  const handleGenerateReport = async () => {
    if (!startDate || !endDate) {
      setError("Veuillez sélectionner une date de début et de fin.");
      return;
    }
    if (startDate > endDate) {
      setError("La date de début doit être antérieure à la date de fin.");
      return;
    }

    setIsGenerating(true);
    setError('');
    setReport('');

    // Filter events inside date range
    const periodEvents = events.filter(e => e.date_absolue >= startDate && e.date_absolue <= endDate);

    try {
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const response = await fetch(`${API_BASE_URL}/api/scan/report`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          events: periodEvents,
          startDate,
          endDate
        })
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || `Erreur serveur (${response.status})`);
      }

      const data = await response.json();
      if (data.success && data.report) {
        setReport(data.report);
      } else {
        throw new Error(data.error || "Aucun rapport généré.");
      }
    } catch (err) {
      console.error(err);
      let msg = err.message;
      if (msg.includes("quota") || msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED")) {
        msg = "Limite de quota de l'API Gemini dépassée. Veuillez patienter une minute avant de réessayer.";
      }
      setError(msg);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyReport = () => {
    if (!report) return;
    navigator.clipboard.writeText(report);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  // Simple custom Markdown parser to keep UI beautiful and zero-dep
  const parseBoldText = (text) => {
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="text-white font-black">{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

  const renderMarkdown = (text) => {
    if (!text) return null;
    const lines = text.split('\n');
    return lines.map((line, idx) => {
      if (line.startsWith('# ')) {
        return <h1 key={idx} className="text-2xl font-black text-white mt-6 mb-3 pb-2 border-b border-white/10">{line.replace('# ', '')}</h1>;
      }
      if (line.startsWith('## ')) {
        return <h2 key={idx} className="text-xl font-bold text-neon-purple mt-5 mb-2">{line.replace('## ', '')}</h2>;
      }
      if (line.startsWith('### ')) {
        return <h3 key={idx} className="text-lg font-bold text-neon-teal mt-4 mb-2">{line.replace('### ', '')}</h3>;
      }
      if (line.startsWith('- ') || line.startsWith('* ')) {
        return (
          <li key={idx} className="text-sm text-gray-300 ml-5 list-disc mb-1.5">
            {parseBoldText(line.substring(2))}
          </li>
        );
      }
      if (line.startsWith('|')) {
        if (line.includes('---')) return null;
        const cells = line.split('|').map(c => c.trim()).filter((_, i) => i > 0 && i < line.split('|').length - 1);
        return (
          <div key={idx} className="flex border-b border-white/5 py-2 text-sm bg-white/2 hover:bg-white/5 transition-all">
            {cells.map((cell, cIdx) => (
              <div key={cIdx} className={`flex-1 text-gray-300 px-2 ${cIdx === 0 ? 'font-bold text-white' : ''}`}>
                {parseBoldText(cell)}
              </div>
            ))}
          </div>
        );
      }
      if (!line.trim()) return <div key={idx} className="h-2"></div>;
      return <p key={idx} className="text-sm text-gray-300 leading-relaxed mb-2">{parseBoldText(line)}</p>;
    });
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Coach de Vie IA Section */}
      <div className="glass-panel p-5 border border-neon-purple/20 relative overflow-hidden text-left">
        <div className="absolute top-0 right-0 w-48 h-48 bg-neon-purple/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
        
        {!token ? (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-neon-purple/20 flex items-center justify-center text-neon-purple shadow-[0_0_15px_rgba(168,85,247,0.3)] shrink-0">
                <Sparkles size={24} className="animate-pulse" />
              </div>
              <div>
                <h4 className="font-bold text-white text-lg">Coach de Vie Personnel (IA)</h4>
                <p className="text-gray-400 text-xs mt-0.5">Veuillez vous connecter pour que le Coach IA puisse analyser votre emploi du temps.</p>
              </div>
            </div>
            <button
              onClick={() => document.querySelector('[title="Connexion"]')?.click() || document.querySelector('button:has(.lucide-log-in)')?.click() || alert('Veuillez cliquer sur le bouton Connexion en haut à droite.')}
              className="px-5 py-2.5 bg-gradient-to-r from-neon-purple to-neon-blue text-btn-text-accent font-bold rounded-xl text-xs hover:scale-105 active:scale-95 shadow-[0_0_15px_rgba(168,85,247,0.3)] transition-all flex items-center gap-2 shrink-0 cursor-pointer"
            >
              <LogIn size={14} />
              Se connecter
            </button>
          </div>
        ) : user?.subscription_plan !== 'premium' ? (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-neon-purple/20 flex items-center justify-center text-neon-purple shadow-[0_0_15px_rgba(168,85,247,0.3)] shrink-0">
                <Sparkles size={24} className="animate-pulse" />
              </div>
              <div>
                <h4 className="font-bold text-white text-lg">Coach de Vie Personnel (IA)</h4>
                <p className="text-gray-400 text-xs mt-0.5">Le Coach IA est exclusif aux membres **Premium**. Il analyse votre équilibre de vie.</p>
              </div>
            </div>
            <button
              onClick={() => setIsSubOpen && setIsSubOpen(true)}
              className="px-5 py-2.5 bg-gradient-to-r from-neon-purple to-neon-blue text-btn-text-accent font-bold rounded-xl text-xs hover:scale-105 active:scale-95 shadow-[0_0_15px_rgba(168,85,247,0.3)] transition-all flex items-center gap-2 shrink-0 cursor-pointer"
            >
              <Sparkles size={14} />
              Passer à Premium
            </button>
          </div>
        ) : !coachInsights && !isGeneratingCoach ? (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-neon-purple/20 flex items-center justify-center text-neon-purple shadow-[0_0_15px_rgba(168,85,247,0.3)] shrink-0">
                <Sparkles size={24} className="animate-pulse" />
              </div>
              <div>
                <h4 className="font-bold text-white text-lg">Coach de Vie Personnel (IA)</h4>
                <p className="text-gray-400 text-xs mt-0.5">L'IA analyse votre charge de travail et vos activités pour vous conseiller sur votre équilibre.</p>
              </div>
            </div>
            <button
              onClick={handleGenerateCoachInsights}
              className="px-5 py-2.5 bg-gradient-to-r from-neon-purple to-neon-blue text-btn-text-accent font-bold rounded-xl text-xs hover:scale-105 active:scale-95 shadow-[0_0_15px_rgba(168,85,247,0.3)] transition-all flex items-center gap-2 shrink-0 cursor-pointer"
            >
              <Sparkles size={14} />
              Analyser ma semaine
            </button>
          </div>
        ) : null}

        {isGeneratingCoach && (
          <div className="flex flex-col items-center justify-center py-8 text-center gap-3">
            <RefreshCw size={24} className="animate-spin text-neon-purple" />
            <p className="text-sm font-semibold text-gray-300">Le Coach IA étudie vos habitudes et calcule votre score d'équilibre...</p>
          </div>
        )}

        {coachError && (
          <div className="flex flex-col items-center py-4 gap-2">
            <p className="text-xs font-bold text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-2.5">{coachError}</p>
            <button onClick={handleGenerateCoachInsights} className="text-xs text-neon-purple font-bold underline">Réessayer</button>
          </div>
        )}

        {coachInsights && !isGeneratingCoach && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-white/5 pb-4 gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-neon-purple/20 flex items-center justify-center text-neon-purple shadow-[0_0_15px_rgba(168,85,247,0.3)] shrink-0">
                  <Sparkles size={20} />
                </div>
                <div>
                  <h4 className="font-bold text-white">Analyse de votre équilibre</h4>
                  <p className="text-gray-400 text-xs mt-0.5">Conseils personnalisés basés sur votre planning actuel.</p>
                </div>
              </div>
              
              <div className="flex items-center gap-4 w-full md:w-auto">
                <div className="flex flex-col items-start md:items-end">
                  <span className="text-[10px] text-gray-500 font-extrabold uppercase">Score d'équilibre</span>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-black text-neon-teal">{coachInsights.score}/10</span>
                    <span className="text-xs px-2.5 py-0.5 bg-neon-teal/20 text-neon-teal border border-neon-teal/30 font-bold rounded-full">{coachInsights.score_label}</span>
                  </div>
                </div>
                <button
                  onClick={handleGenerateCoachInsights}
                  className="p-2 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white border border-white/10 rounded-xl transition-all cursor-pointer ml-auto md:ml-0"
                  title="Regénérer"
                >
                  <RefreshCw size={16} />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Positive points */}
              <div className="bg-green-500/5 border border-green-500/10 rounded-xl p-4">
                <h5 className="font-bold text-green-400 text-sm mb-3 flex items-center gap-1.5">👍 Ce qui va bien</h5>
                <ul className="space-y-2 text-xs text-gray-300">
                  {coachInsights.positifs?.map((p, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <span className="text-green-500">•</span>
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Warnings / Alerts */}
              <div className="bg-red-500/5 border border-red-500/10 rounded-xl p-4">
                <h5 className="font-bold text-red-400 text-sm mb-3 flex items-center gap-1.5">⚠️ Points d'attention</h5>
                <ul className="space-y-2 text-xs text-gray-300">
                  {coachInsights.alertes?.map((a, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <span className="text-red-500">•</span>
                      <span>{a}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Recommendations */}
            <div className="space-y-3">
              <h5 className="font-bold text-white text-sm">💡 Conseils personnalisés pour la semaine prochaine :</h5>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {coachInsights.conseils?.map((c, i) => (
                  <div key={i} className="bg-white/5 border border-white/5 rounded-xl p-3.5 hover:bg-white/10 transition-colors">
                    <span className="text-2xl mb-2 block">
                      {c.icon === 'rest' ? '🛌' : c.icon === 'sport' ? '🏃‍♂️' : c.icon === 'work' ? '💻' : c.icon === 'social' ? '🍻' : '🩺'}
                    </span>
                    <h6 className="font-bold text-sm text-gray-200">{c.titre}</h6>
                    <p className="text-xs text-gray-400 mt-1">{c.description}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Motivation Quote */}
            <p className="text-sm italic text-neon-purple text-center border-t border-white/5 pt-4 mt-2">
              "{coachInsights.motivation}"
            </p>
          </div>
        )}
      </div>

      {/* Compact KPI Summary Bar */}
      <div className="glass-panel p-4 rounded-2xl">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
          <div className="flex items-center gap-2">
            <Clock size={16} className="text-neon-purple" />
            <span className="text-sm text-gray-400">Total planifié</span>
            <span className="text-lg font-black text-white">{stats.totalHours}h</span>
          </div>
          <div className="flex items-center gap-2">
            <BookOpen size={16} className="text-neon-teal" />
            <span className="text-sm text-gray-400">Sessions</span>
            <span className="text-lg font-black text-white">{events.length}</span>
          </div>
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className={conflicts.length > 0 ? 'text-red-400' : 'text-green-400'} />
            <span className="text-sm text-gray-400">Conflits</span>
            <span className={`text-lg font-black ${conflicts.length > 0 ? 'text-red-400' : 'text-green-400'}`}>{conflicts.length}</span>
          </div>
          <div className="flex items-center gap-2">
            <Calendar size={16} className="text-blue-400" />
            <span className="text-sm text-gray-400">Jours</span>
            <span className="text-lg font-black text-white">{new Set(events.map(e => e.date_absolue)).size}</span>
          </div>
          <div className="flex items-center gap-2">
            <Activity size={16} className="text-amber-400" />
            <span className="text-sm text-gray-400">Activités</span>
            <span className="text-lg font-black text-white">{new Set(events.map(e => e.titre)).size}</span>
          </div>
          <div className="flex items-center gap-2">
            <TrendingUp size={16} className="text-green-400" />
            <span className="text-sm text-gray-400">Moy./jour</span>
            <span className="text-lg font-black text-white">{stats.avgPerDay}</span>
          </div>
        </div>
      </div>

      {/* Detailed Conflicts List */}
      {conflicts && conflicts.length > 0 && (
        <div className="glass-panel p-5 border border-red-500/20 rounded-2xl">
          <h4 className="text-red-400 font-bold mb-4 flex items-center gap-2">
            <AlertTriangle size={18} /> {conflicts.length} Conflit(s) d'agenda détecté(s)
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {conflicts.map((c, i) => (
              <div key={i} className="text-xs text-red-300 bg-red-950/20 border border-red-500/10 rounded-xl p-3 flex flex-col gap-1 shadow-sm">
                <div className="font-bold flex items-center gap-1.5 text-white">
                  <span>📅 {c.a.date_absolue}</span>
                </div>
                <div className="flex flex-col gap-1 mt-1 pl-2 border-l border-red-500/30">
                  <div className="truncate">
                    <span className="font-bold text-red-200">1.</span> {c.a.titre} <span className="opacity-75">({c.a.heure_debut} - {c.a.heure_fin})</span>
                  </div>
                  <div className="text-[10px] text-red-400 font-bold uppercase my-0.5">chevauchement avec :</div>
                  <div className="truncate">
                    <span className="font-bold text-red-200">2.</span> {c.b.titre} <span className="opacity-75">({c.b.heure_debut} - {c.b.heure_fin})</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column - Distribution & Busiest Day */}
        <div className="lg:col-span-1 flex flex-col gap-6">
          {/* Global Category Distribution */}
          <div className="glass-panel p-5">
            <h4 className="text-white font-bold mb-4 flex items-center gap-2">
              <PieChart size={18} className="text-neon-teal" /> Répartition globale du temps (h)
            </h4>
            <div className="flex flex-col gap-3">
              {Object.entries(stats.categoryHours).length === 0 ? (
                <p className="text-sm text-gray-500">Aucune donnée disponible</p>
              ) : (
                Object.entries(stats.categoryHours).map(([cat, hours]) => (
                  <div key={cat} className="flex items-center gap-3">
                    <span className="text-sm text-gray-300 w-28 truncate">{cat}</span>
                    <div className="flex-1 h-5 bg-white/5 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full ${getCategoryColor(cat, categories)} transition-all duration-700`}
                        style={{ width: `${(hours / maxCategoryHours) * 100}%` }}
                      />
                    </div>
                    <span className="text-sm font-bold text-white w-12 text-right">{hours}h</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Detailed Categorized Activities Analysis */}
          <div className="glass-panel p-5">
            <h4 className="text-white font-bold mb-3 flex items-center gap-2">
              <BarChart3 size={18} className="text-neon-purple" /> Analyse par catégorie & activité
            </h4>
            <div className="flex flex-col gap-4">
              {Object.entries(stats.categoryActivities).length === 0 ? (
                <p className="text-sm text-gray-500">Aucune donnée disponible</p>
              ) : (
                Object.entries(stats.categoryActivities).map(([cat, activities]) => {
                  const totalCatMins = Object.values(activities).reduce((sum, act) => sum + act.minutes, 0);
                  const totalCatHours = Math.round(totalCatMins / 60 * 10) / 10;
                  
                  return (
                    <div key={cat} className="flex flex-col gap-2.5 bg-white/5 p-3 rounded-xl border border-white/5 text-left">
                      <div className="flex justify-between items-center border-b border-white/10 pb-1.5">
                        <span className="text-xs font-black text-white flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full ${getCategoryColor(cat, categories)}`}></span>
                          {cat}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 font-bold text-gray-300">
                          {totalCatHours}h
                        </span>
                      </div>
                      
                      <div className="flex flex-col gap-2">
                        {Object.entries(activities).map(([title, data]) => {
                          const actHours = Math.round(data.minutes / 60 * 10) / 10;
                          const percent = totalCatMins > 0 ? (data.minutes / totalCatMins) * 100 : 0;
                          
                          return (
                            <div key={title} className="flex flex-col gap-1 text-left">
                              <div className="flex justify-between items-center text-[11px]">
                                <span className="text-gray-300 truncate max-w-[160px]" title={title}>
                                  {title}
                                </span>
                                <span className="text-gray-400 font-bold text-[10px]">
                                  {actHours}h <span className="text-[9px] opacity-60 font-normal">({data.count} {data.count > 1 ? 'sessions' : 'session'})</span>
                                </span>
                              </div>
                              <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                                <div 
                                  className={`h-full rounded-full ${getCategoryColor(cat, categories)} transition-all duration-700`}
                                  style={{ width: `${percent}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Course Subject Distribution */}
          <div className="glass-panel p-5">
            <h4 className="text-white font-bold mb-4 flex items-center gap-2">
              <BarChart3 size={18} className="text-neon-purple" /> Détail des activités (sessions)
            </h4>
            <div className="flex flex-col gap-3">
              {Object.entries(stats.courseMap).length === 0 ? (
                <p className="text-sm text-gray-500">Aucune activité enregistrée</p>
              ) : (
                Object.entries(stats.courseMap).map(([course, count]) => (
                  <div key={course} className="flex items-center gap-3">
                    <span className="text-sm text-gray-300 w-28 truncate">{course}</span>
                    <div className="flex-1 h-5 bg-white/5 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full ${COURSE_COLORS[course] || COURSE_COLORS.default} transition-all duration-700`}
                        style={{ width: `${(count / maxCourseCount) * 100}%` }}
                      />
                    </div>
                    <span className="text-sm font-bold text-white w-8 text-right">{count}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Busiest Day */}
          {stats.busiestDay && (
            <div className="glass-panel p-4 border-l-4 border-neon-teal">
              <p className="text-sm text-gray-400">Journee la plus chargee</p>
              <p className="text-lg font-bold text-white">
                {stats.busiestDay[0]} — {stats.busiestDay[1]} sessions
              </p>
            </div>
          )}
        </div>

        {/* Right column - Tracking Table & Period Report Generator */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          {/* Real-time Tracking Table */}
          <div className="glass-panel p-5">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
              <div>
                <h4 className="text-white font-bold flex items-center gap-2">
                  <Activity size={18} className="text-neon-teal animate-pulse" /> Suivi des heures & activités en temps réel
                </h4>
                <p className="text-xs text-gray-400">Suivi instantané des heures planifiées, travaillées et restantes.</p>
              </div>
              
              {/* Filter Tabs */}
              <div className="flex bg-white/5 p-1 rounded-xl border border-white/5 self-end sm:self-auto">
                {[
                  { id: 'realized', label: 'Réalisées' },
                  { id: 'pending', label: 'À venir' },
                  { id: 'all', label: 'Toutes' }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setTableFilter(tab.id)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                      tableFilter === tab.id 
                        ? 'bg-neon-teal text-dark-950 shadow-[0_0_10px_rgba(20,184,166,0.3)]' 
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Table wrapper */}
            <div className="overflow-x-auto rounded-xl border border-white/10 bg-white/5">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/10 bg-white/5 text-gray-300 text-xs font-bold uppercase tracking-wider">
                    <th className="p-3">Activité</th>
                    <th className="p-3">Catégorie</th>
                    {tableFilter === 'realized' && <th className="p-3 text-right">Heures Réalisées</th>}
                    {tableFilter === 'pending' && <th className="p-3 text-right">Heures À venir</th>}
                    {tableFilter === 'all' && (
                      <>
                        <th className="p-3 text-right">Heures Réalisées</th>
                        <th className="p-3 text-right">Heures Totales</th>
                        <th className="p-3 text-center">Progression</th>
                      </>
                    )}
                    <th className="p-3 text-center">Sessions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-sm text-gray-200">
                  {(() => {
                    // Filter table data
                    const filteredRows = tableData.filter(row => {
                      if (tableFilter === 'realized') return row.realizedMinutes > 0;
                      if (tableFilter === 'pending') return row.pendingMinutes > 0;
                      return row.totalMinutes > 0;
                    }).sort((a, b) => {
                      if (tableFilter === 'realized') return b.realizedMinutes - a.realizedMinutes;
                      if (tableFilter === 'pending') return b.pendingMinutes - a.pendingMinutes;
                      return b.totalMinutes - a.totalMinutes;
                    });

                    if (filteredRows.length === 0) {
                      return (
                        <tr>
                          <td colSpan={tableFilter === 'all' ? 6 : 4} className="p-8 text-center text-gray-500 text-xs">
                            Aucune activité correspondant au filtre
                          </td>
                        </tr>
                      );
                    }

                    return filteredRows.map(row => {
                      const totalH = Math.round(row.totalMinutes / 60 * 10) / 10;
                      const realizedH = Math.round(row.realizedMinutes / 60 * 10) / 10;
                      const pendingH = Math.round(row.pendingMinutes / 60 * 10) / 10;
                      const progress = row.totalMinutes > 0 ? (row.realizedMinutes / row.totalMinutes) * 100 : 0;
                      
                      return (
                        <tr key={row.title} className="hover:bg-white/5 transition-colors group">
                          <td className="p-3 font-bold text-white group-hover:text-neon-teal transition-colors">
                            {row.title}
                          </td>
                          <td className="p-3">
                            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/5 border border-white/10 text-gray-300`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${getCategoryColor(row.category, categories)}`}></span>
                              {row.category}
                            </span>
                          </td>
                          
                          {tableFilter === 'realized' && (
                            <td className="p-3 text-right font-black text-neon-teal">
                              {realizedH}h
                            </td>
                          )}
                          {tableFilter === 'pending' && (
                            <td className="p-3 text-right font-black text-amber-400">
                              {pendingH}h
                            </td>
                          )}
                          {tableFilter === 'all' && (
                            <>
                              <td className="p-3 text-right font-bold text-neon-teal">
                                {realizedH}h
                              </td>
                              <td className="p-3 text-right font-bold text-gray-400">
                                {totalH}h
                              </td>
                              <td className="p-3 align-middle">
                                <div className="flex items-center gap-2 justify-center max-w-[120px] mx-auto">
                                  <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden border border-white/5">
                                    <div 
                                      className="h-full bg-gradient-to-r from-neon-purple to-neon-teal rounded-full"
                                      style={{ width: `${progress}%` }}
                                    />
                                  </div>
                                  <span className="text-[10px] font-black text-white w-8 text-right">
                                    {Math.round(progress)}%
                                  </span>
                                </div>
                              </td>
                            </>
                          )}
                          
                          <td className="p-3 text-center font-bold">
                            {tableFilter === 'realized' && row.realizedCount}
                            {tableFilter === 'pending' && row.pendingCount}
                            {tableFilter === 'all' && (
                              <span className="text-xs">
                                {row.realizedCount} <span className="opacity-40">/</span> {row.totalCount}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
          </div>

          <div className="glass-panel p-5 border border-neon-purple/20">
            <h4 className="text-white font-bold mb-2 flex items-center gap-2">
              <Sparkles size={18} className="text-neon-purple" /> Générateur de Rapport de Période (IA)
            </h4>
            <p className="text-xs text-gray-400 mb-4">Sélectionnez une période pour que l'IA analyse vos shifts et génère un rapport complet.</p>

            <div className="flex flex-wrap gap-4 mb-4">
              <div className="flex-1 min-w-[150px]">
                <label className="block text-xs font-bold text-gray-400 mb-1 flex items-center gap-1">
                  <Calendar size={12} /> Date de début
                </label>
                <input 
                  type="date" 
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full bg-dark-900 border border-white/10 rounded-xl p-2.5 text-sm text-white focus:outline-none focus:border-neon-purple/50"
                />
              </div>
              <div className="flex-1 min-w-[150px]">
                <label className="block text-xs font-bold text-gray-400 mb-1 flex items-center gap-1">
                  <Calendar size={12} /> Date de fin
                </label>
                <input 
                  type="date" 
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full bg-dark-900 border border-white/10 rounded-xl p-2.5 text-sm text-white focus:outline-none focus:border-neon-purple/50"
                />
              </div>
            </div>

            {error && (
              <p className="text-xs font-bold text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-2.5 mb-4">
                {error}
              </p>
            )}

            <button 
              onClick={handleGenerateReport}
              disabled={isGenerating || !startDate || !endDate}
              className="w-full py-2.5 bg-neon-purple text-btn-text-accent font-bold rounded-xl text-sm hover:shadow-[0_0_20px_rgba(168,85,247,0.5)] transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isGenerating ? (
                <>
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                  <span>Génération du rapport en cours...</span>
                </>
              ) : (
                <>
                  <Sparkles size={16} />
                  <span>Générer le rapport d'activité</span>
                </>
              )}
            </button>
          </div>

          {/* Report Output */}
          {report && (
            <div className="glass-panel p-5 border border-neon-teal/20 flex flex-col gap-4 animate-fade-in">
              <div className="flex justify-between items-center border-b border-white/10 pb-3">
                <div className="flex items-center gap-2">
                  <FileText size={18} className="text-neon-teal" />
                  <span className="font-bold text-white text-sm">Rapport d'Activité Généré</span>
                </div>
                <button 
                  onClick={handleCopyReport}
                  className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 border border-white/10"
                >
                  {isCopied ? (
                    <>
                      <Check size={14} className="text-green-400" />
                      <span className="text-green-400">Copié !</span>
                    </>
                  ) : (
                    <>
                      <Copy size={14} />
                      <span>Copier</span>
                    </>
                  )}
                </button>
              </div>

              <div className="max-h-[400px] overflow-y-auto pr-2 custom-scrollbar text-left">
                {renderMarkdown(report)}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StatsPanel;
