import React, { useMemo, useState } from 'react';
import { BarChart3, Clock, BookOpen, AlertTriangle, TrendingUp, Calendar, FileText, Sparkles, Copy, Check, PieChart } from 'lucide-react';
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

const StatsPanel = ({ events, conflicts, categories = [], token }) => {
  // Report states
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [report, setReport] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [error, setError] = useState('');

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
      const title = e.titre || 'Sans titre';
      if (!categoryActivities[cat][title]) {
        categoryActivities[cat][title] = { minutes: 0, count: 0 };
      }
      categoryActivities[cat][title].minutes += dur;
      categoryActivities[cat][title].count += 1;

      // Map courses if categorized as Formation or matches study course name
      if (cat === 'Formation' || matchCourse(e.titre) !== 'default') {
        const course = matchCourse(e.titre);
        const courseLabel = course === 'default' ? e.titre : course;
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
      {/* Stat Cards Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="glass-panel p-4 text-center">
          <Clock className="mx-auto text-neon-purple mb-2" size={28} />
          <p className="text-3xl font-black text-white">{stats.totalHours}h</p>
          <p className="text-xs text-gray-400">Total planifié</p>
        </div>
        <div className="glass-panel p-4 text-center">
          <BookOpen className="mx-auto text-neon-teal mb-2" size={28} />
          <p className="text-3xl font-black text-white">{events.length}</p>
          <p className="text-xs text-gray-400">Sessions totales</p>
        </div>
        <div className="glass-panel p-4 text-center">
          <AlertTriangle className="mx-auto text-red-400 mb-2" size={28} />
          <p className="text-3xl font-black text-red-400">{conflicts.length}</p>
          <p className="text-xs text-gray-400">Conflits d'agenda</p>
        </div>
        <div className="glass-panel p-4 text-center">
          <TrendingUp className="mx-auto text-green-400 mb-2" size={28} />
          <p className="text-3xl font-black text-white">{stats.avgPerDay}</p>
          <p className="text-xs text-gray-400">Activités/jour (moy.)</p>
        </div>
      </div>

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

        {/* Right column - Period Report Generator */}
        <div className="lg:col-span-2 flex flex-col gap-6">
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
              className="w-full py-2.5 bg-neon-purple text-active-day-text font-bold rounded-xl text-sm hover:shadow-[0_0_20px_rgba(168,85,247,0.5)] transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isGenerating ? (
                <>
                  <div className="w-4 h-4 border-2 border-dark-950 border-t-transparent rounded-full animate-spin"></div>
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
