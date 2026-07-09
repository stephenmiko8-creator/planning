import React, { useState, useEffect, useMemo } from 'react';
import ScannerInput from './ScannerInput';
import EventCard from './EventCard';
import WeeklyCalendar from './WeeklyCalendar';
import StatsPanel from './StatsPanel';
import SettingsPanel from './SettingsPanel';
import EventModal from './EventModal';
import AddEventModal from './AddEventModal';
import AuthPage from './AuthPage';
import SubscriptionModal from './SubscriptionModal';
import { CalendarCheck, ShieldAlert, CheckCircle2, Clock, LogIn, Activity, Coffee, LayoutGrid, BarChart3, List, Trash2, PlusCircle, Download, Settings, LogOut, Sparkles, Crown } from 'lucide-react';
import { API_BASE_URL } from '../config';
import { useToast } from './Toast';

const Dashboard = () => {
  const { addToast } = useToast();
  const [events, setEvents] = useState([]);
  const [savedEvents, setSavedEvents] = useState([]);
  const [categories, setCategories] = useState([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isGoogleConnected, setIsGoogleConnected] = useState(false);
  const [activeView, setActiveView] = useState('calendar');
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [resultsView, setResultsView] = useState('cards');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addModalInitialValues, setAddModalInitialValues] = useState(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isSubOpen, setIsSubOpen] = useState(false);
  const [token, setToken] = useState(localStorage.getItem('token') || null);
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('user')) || null;
    } catch {
      return null;
    }
  });

  const [config, setConfig] = useState({
    timezone: 'Europe/Paris',
    active_start_hour: '08:00',
    active_end_hour: '22:00'
  });

  const getHeaders = (hasBody = true) => {
    const headers = {};
    if (hasBody) headers['Content-Type'] = 'application/json';
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  };

  const loadSavedEvents = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/events/all`, {
        headers: getHeaders(false)
      });
      const data = await res.json();
      if (data.success) setSavedEvents(data.events);
    } catch (e) {
      console.log('Events fetch error', e);
    }
  };

  const loadCategories = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/settings/categories`, {
        headers: getHeaders(false)
      });
      const data = await res.json();
      if (data.success) setCategories(data.categories || []);
    } catch (e) {
      console.log('Categories fetch error', e);
    }
  };

  const loadConfig = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/settings/config`, {
        headers: getHeaders(false)
      });
      const data = await res.json();
      if (data.success && data.config) setConfig(data.config);
    } catch (e) {
      console.log('Config fetch error', e);
    }
  };

  const loadProfile = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/me`, {
        headers: getHeaders(false)
      });
      const data = await res.json();
      if (data.success) {
        setUser(data.user);
        localStorage.setItem('user', JSON.stringify(data.user));
      } else {
        // Token expired/invalid
        handleLogout();
      }
    } catch (e) {
      console.log('Profile fetch error', e);
    }
  };

  const handleLogout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    addToast('Déconnexion réussie.', 'info');
  };

  const handleAuthSuccess = (newToken, newUser) => {
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(newUser));
  };

  // Calcul intelligent des conflits (chevauchements reels)
  const conflicts = useMemo(() => {
    const result = [];
    const sorted = [...savedEvents].sort((a, b) => {
      if (a.date_absolue !== b.date_absolue) return a.date_absolue.localeCompare(b.date_absolue);
      return (a.heure_debut || '').localeCompare(b.heure_debut || '');
    });

    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        const a = sorted[i];
        const b = sorted[j];
        if (a.date_absolue !== b.date_absolue) break;

        const aStart = timeToMin(a.heure_debut);
        const aEnd = timeToMin(a.heure_fin);
        const bStart = timeToMin(b.heure_debut);
        const bEnd = timeToMin(b.heure_fin);

        // Vrai chevauchement : A commence avant la fin de B ET B commence avant la fin de A
        if (aStart < bEnd && bStart < aEnd) {
          result.push({ a, b });
        }
      }
    }
    return result;
  }, [savedEvents]);

  function timeToMin(t) {
    if (!t) return 0;
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  }

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const sharedText = urlParams.get('text') || urlParams.get('title') || urlParams.get('url');
    if (sharedText) {
      window.history.replaceState({}, document.title, "/");
      handleScan(sharedText);
    }

    loadSavedEvents();
    loadCategories();
    loadConfig();
    loadProfile();

    const handleMessage = (event) => {
      if (event.data === 'GOOGLE_AUTH_SUCCESS') {
        setIsGoogleConnected(true);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [token]);

  const handleGoogleConnect = () => {
    const url = token 
      ? `${API_BASE_URL}/api/calendar/auth/google?token=${encodeURIComponent(token)}` 
      : `${API_BASE_URL}/api/calendar/auth/google`;
    window.open(url, 'Google Auth', 'width=500,height=600');
  };

  const [isPushingAll, setIsPushingAll] = useState(false);

  const handleAddToCalendar = async (eventDetails) => {
    try {
      // 1. Sauvegarder dans la base locale d'abord
      const localResponse = await fetch(`${API_BASE_URL}/api/events/add`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(eventDetails)
      });
      await localResponse.json();
      loadSavedEvents(); // Recharger la vue calendrier

      // 2. Si Google Calendar est connecté, on y pousse l'événement
      if (isGoogleConnected) {
        const response = await fetch(`${API_BASE_URL}/api/calendar/add`, {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify(eventDetails)
        });
        const result = await response.json();
        return result.success;
      }
      return true;
    } catch (error) {
      console.error("Erreur lors de l'ajout de l'événement:", error);
      return false;
    }
  };

  const handlePushAllToCalendar = async () => {
    if (events.length === 0) return;
    setIsPushingAll(true);
    let successCount = 0;
    try {
      for (const evt of events) {
        const success = await handleAddToCalendar(evt);
        if (success) successCount++;
      }
      // Vider les événements de la dernière analyse une fois importés
      setEvents([]);
    } catch (error) {
      console.error("Erreur d'importation globale:", error);
    } finally {
      setIsPushingAll(false);
    }
  };

  const handleDeleteEvent = async (id) => {
    try {
      await fetch(`${API_BASE_URL}/api/events/${id}`, { 
        method: 'DELETE',
        headers: getHeaders(false)
      });
      loadSavedEvents();
    } catch (e) {
      console.log('Delete error', e);
    }
  };

  const handleExportCSV = () => {
    if (events.length === 0) return;
    
    const headers = ["Employeur / Activite", "Date", "Heure Debut", "Heure Fin", "Duree (h)"];
    const rows = events.map(evt => {
      const start = evt.heure_debut ? evt.heure_debut.split(':').map(Number) : [0,0];
      const end = evt.heure_fin ? evt.heure_fin.split(':').map(Number) : [0,0];
      let durMin = (end[0]*60 + end[1]) - (start[0]*60 + start[1]);
      if (durMin < 0) durMin += 24*60;
      const durHrs = Math.round(durMin / 60 * 10) / 10;
      return [
        `"${evt.titre.replace(/"/g, '""')}"`,
        `"${evt.date_absolue}"`,
        `"${evt.heure_debut}"`,
        `"${evt.heure_fin}"`,
        durHrs
      ];
    });
    
    const totalMin = events.reduce((acc, evt) => {
      const start = evt.heure_debut ? evt.heure_debut.split(':').map(Number) : [0,0];
      const end = evt.heure_fin ? evt.heure_fin.split(':').map(Number) : [0,0];
      let durMin = (end[0]*60 + end[1]) - (start[0]*60 + start[1]);
      if (durMin < 0) durMin += 24*60;
      return acc + durMin;
    }, 0);
    const totalHrs = Math.round(totalMin / 60 * 10) / 10;
    rows.push([
      `"Total Heures Calculees"`,
      `""`,
      `""`,
      `""`,
      totalHrs
    ]);
    
    const csvContent = [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `rapport_heures_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleScan = async (content, type = 'text') => {
    setIsScanning(true);
    try {
      const isImage = type === 'image';
      const body = isImage 
        ? { imageBase64: content.base64, mimeType: content.mimeType, type: 'image' }
        : { text: content, type: type };

      const response = await fetch(`${API_BASE_URL}/api/scan`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ 
          ...body,
          currentDate: new Date().toLocaleDateString('en-CA', { timeZone: config.timezone }),
          timezone: config.timezone
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Erreur serveur (code ${response.status})`);
      }

      const result = await response.json();
      if (result.success && result.data?.events) {
        setEvents(result.data.events);
        loadSavedEvents();
        loadProfile(); // Refresh profile to get updated scan count
      } else {
        throw new Error(result.error || "Une réponse invalide a été reçue.");
      }
    } catch (error) {
      console.error("Erreur de scan:", error);
      let errorMsg = error.message;
      if (errorMsg.includes("quota") || errorMsg.includes("RESOURCE_EXHAUSTED") || errorMsg.includes("429")) {
        errorMsg = "Limite de quota de l'API Gemini dépassée. Veuillez patienter une minute avant de réessayer ou fournir une clé API valide dans le fichier .env du backend.";
      }
      addToast(errorMsg, 'error', 6000);
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 pb-24 md:pb-6 flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-neon-purple to-neon-teal">
            Planning Assistant
          </h1>
          <p className="text-xs md:text-sm text-gray-400 mt-1">Votre agent personnel d'extraction et d'optimisation de temps.</p>
        </div>
        <div className="flex gap-2 items-center w-full md:w-auto overflow-x-auto no-scrollbar py-1">
          {/* User Auth Section */}
          {user ? (
            <div className="flex items-center gap-2 bg-dark-800/40 border border-white/5 p-1.5 pl-3 rounded-2xl shrink-0">
              <div className="flex flex-col text-right hidden sm:flex">
                <span className="text-xs font-semibold text-gray-300 max-w-[120px] truncate">{user.email}</span>
                {user.subscription_plan === 'free' ? (
                  <span className="text-[10px] text-gray-500 font-bold">
                    {user.scan_count_this_month || 0}/10 scans
                  </span>
                ) : (
                  <span className="text-[10px] text-neon-teal font-bold">
                    Scans illimités
                  </span>
                )}
              </div>
              
              {/* Plan badge, clickable to change subscription */}
              <button
                onClick={() => setIsSubOpen(true)}
                className={`px-2 py-0.5 text-[10px] font-extrabold uppercase rounded-full transition-all flex items-center gap-1 cursor-pointer shrink-0 ${
                  user.subscription_plan === 'premium'
                    ? 'bg-neon-purple/20 text-neon-purple border border-neon-purple/50 shadow-[0_0_10px_rgba(168,85,247,0.3)]'
                    : user.subscription_plan === 'pro'
                    ? 'bg-neon-teal/20 text-neon-teal border border-neon-teal/50 shadow-[0_0_10px_rgba(20,184,166,0.3)]'
                    : 'bg-white/5 text-gray-400 border border-white/10'
                }`}
              >
                {user.subscription_plan === 'premium' && <Crown size={10} className="animate-pulse" />}
                {user.subscription_plan === 'pro' && <Sparkles size={10} className="animate-pulse" />}
                <span>{user.subscription_plan}</span>
              </button>

              <button 
                onClick={handleLogout}
                title="Déconnexion"
                className="p-1.5 text-gray-400 hover:text-red-400 transition-colors rounded-xl"
              >
                <LogOut size={14} />
              </button>
            </div>
          ) : (
            <button 
              onClick={() => setIsAuthOpen(true)}
              className="px-3 py-1.5 border border-neon-purple/30 text-neon-purple hover:bg-neon-purple/10 font-bold rounded-xl text-xs transition-all flex items-center gap-1.5 shrink-0"
            >
              <LogIn size={14} />
              <span>Connexion</span>
            </button>
          )}

          <button 
            onClick={() => {
              setAddModalInitialValues(null);
              setIsAddModalOpen(true);
            }}
            className="hidden md:flex px-4 py-2 bg-neon-purple text-dark-950 font-bold rounded-xl text-sm hover:shadow-[0_0_20px_rgba(168,85,247,0.6)] transition-all items-center gap-2 shrink-0"
          >
            <PlusCircle size={18} />
            <span>Planifier un bloc</span>
          </button>
          
          {(!user || user.subscription_plan === 'premium') && (
            <button 
              onClick={handleGoogleConnect}
              className={`px-3 py-1.5 flex items-center gap-1.5 rounded-xl transition-all font-bold text-xs shrink-0 ${
                isGoogleConnected 
                  ? 'bg-green-500/20 text-green-400 border border-green-500/50' 
                  : 'glass-panel text-white hover:bg-white/10'
              }`}
            >
              {isGoogleConnected ? <CheckCircle2 size={14} /> : <LogIn size={14} />}
              <span>{isGoogleConnected ? 'Google OK' : 'Connexion Google'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Quick Stats Bar */}
      <div className="hidden md:grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="glass-panel p-3 flex items-center gap-3">
          <div className="bg-neon-purple/20 p-2 rounded-lg"><CalendarCheck className="text-neon-purple" size={20} /></div>
          <div>
            <p className="text-xs text-gray-400">Evenements</p>
            <p className="text-xl font-black">{savedEvents.length}</p>
          </div>
        </div>
        <div className="glass-panel p-3 flex items-center gap-3">
          <div className="bg-red-500/20 p-2 rounded-lg"><ShieldAlert className="text-red-400" size={20} /></div>
          <div>
            <p className="text-xs text-gray-400">Conflits</p>
            <p className="text-xl font-black text-red-400">{conflicts.length}</p>
          </div>
        </div>
        <div className="glass-panel p-3 flex items-center gap-3">
          <div className="bg-neon-teal/20 p-2 rounded-lg"><Activity className="text-neon-teal" size={20} /></div>
          <div>
            <p className="text-xs text-gray-400">Jours couverts</p>
            <p className="text-xl font-black">{new Set(savedEvents.map(e => e.date_absolue)).size}</p>
          </div>
        </div>
        <div className="glass-panel p-3 flex items-center gap-3">
          <div className="bg-white/10 p-2 rounded-lg"><Coffee className="text-gray-300" size={20} /></div>
          <div>
            <p className="text-xs text-gray-400">Matieres</p>
            <p className="text-xl font-black">{new Set(savedEvents.map(e => e.titre)).size}</p>
          </div>
        </div>
      </div>

      {/* View Tabs - Desktop Only */}
      <div className="hidden md:flex gap-2">
        {[
          { id: 'calendar', icon: <LayoutGrid size={16} />, label: 'Calendrier' },
          { id: 'list', icon: <List size={16} />, label: 'Liste' },
          { id: 'stats', icon: <BarChart3 size={16} />, label: 'Statistiques' },
          { id: 'settings', icon: <Settings size={16} />, label: 'Paramètres' },
        ].map(tab => (
          <button 
            key={tab.id}
            onClick={() => setActiveView(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all ${
              activeView === tab.id 
                ? 'bg-neon-purple/30 text-neon-purple border border-neon-purple/50' 
                : 'glass-panel text-gray-400 hover:text-white hover:bg-white/10'
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Main Content */}
      {activeView === 'calendar' && (
        <WeeklyCalendar 
          events={savedEvents} 
          conflicts={conflicts} 
          onDeleteEvent={handleDeleteEvent} 
          onSelectEvent={setSelectedEvent} 
          categories={categories} 
          config={config}
          onRefresh={loadSavedEvents}
          onTimeSlotClick={(date, start, end) => {
            setAddModalInitialValues({ date, startTime: start, endTime: end });
            setIsAddModalOpen(true);
          }}
        />
      )}

      {activeView === 'list' && (
        <div className="flex flex-col gap-6">
          {/* Scanner */}
          <ScannerInput onScan={handleScan} />
          
          {/* Last scan results */}
          {events.length > 0 && (
            <div>
              <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <CheckCircle2 size={20} className="text-neon-purple" /> Derniere Analyse ({events.length})
                </h2>
                <div className="flex gap-2 items-center flex-wrap">
                  <div className="flex bg-white/5 rounded-xl p-0.5 border border-white/10 mr-2">
                    <button 
                      onClick={() => setResultsView('cards')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${resultsView === 'cards' ? 'bg-neon-purple text-dark-950 shadow-md' : 'text-gray-400 hover:text-white'}`}
                    >
                      Cartes
                    </button>
                    <button 
                      onClick={() => setResultsView('table')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${resultsView === 'table' ? 'bg-neon-purple text-dark-950 shadow-md' : 'text-gray-400 hover:text-white'}`}
                    >
                      Tableau
                    </button>
                  </div>
                  {resultsView === 'table' && (
                    <button 
                      onClick={handleExportCSV}
                      className="px-4 py-2 bg-neon-teal/20 text-neon-teal border border-neon-teal/30 font-bold rounded-xl text-sm hover:bg-neon-teal/30 hover:border-neon-teal/50 hover:shadow-[0_0_15px_rgba(20,184,166,0.3)] transition-all flex items-center gap-2"
                    >
                      <Download size={16} />
                      <span>Exporter CSV</span>
                    </button>
                  )}
                  <button 
                    onClick={() => setEvents([])}
                    className="px-4 py-2 bg-red-500/20 text-red-400 border border-red-500/30 font-bold rounded-xl text-sm hover:bg-red-500/30 hover:border-red-500/50 transition-all flex items-center gap-2"
                  >
                    <Trash2 size={16} />
                    <span>Effacer la liste</span>
                  </button>
                  <button 
                    onClick={handlePushAllToCalendar}
                    disabled={isPushingAll}
                    className="px-4 py-2 bg-neon-purple text-dark-950 font-bold rounded-xl text-sm hover:shadow-[0_0_20px_rgba(168,85,247,0.6)] transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <PlusCircle size={16} /> 
                    <span>{isPushingAll ? "Importation..." : "Tout importer"}</span>
                  </button>
                </div>
              </div>

              {resultsView === 'table' ? (
                <div className="glass-panel p-4 overflow-x-auto rounded-xl">
                  <table className="w-full text-left text-sm text-gray-300">
                    <thead>
                      <tr className="border-b border-white/10 text-white font-bold">
                        <th className="py-2 px-3">Employeur / Activite</th>
                        <th className="py-2 px-3">Date</th>
                        <th className="py-2 px-3">Horaires</th>
                        <th className="py-2 px-3">Durée</th>
                        <th className="py-2 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {events.map((evt, idx) => {
                        const start = evt.heure_debut ? evt.heure_debut.split(':').map(Number) : [0,0];
                        const end = evt.heure_fin ? evt.heure_fin.split(':').map(Number) : [0,0];
                        let durMin = (end[0]*60 + end[1]) - (start[0]*60 + start[1]);
                        if (durMin < 0) durMin += 24*60; // Gérer les horaires de nuit
                        const durHrs = Math.round(durMin / 60 * 10) / 10;
                        return (
                          <tr key={idx} className="border-b border-white/5 hover:bg-white/5 transition-all">
                            <td className="py-2 px-3 font-semibold text-white">{evt.titre}</td>
                            <td className="py-2 px-3">{evt.date_absolue}</td>
                            <td className="py-2 px-3">{evt.heure_debut} - {evt.heure_fin}</td>
                            <td className="py-2 px-3">{durHrs} h</td>
                            <td className="py-2 px-3 text-right">
                              <button 
                                onClick={(e) => { e.stopPropagation(); handleAddToCalendar(evt); }}
                                className="px-2 py-1 bg-neon-purple/20 text-neon-purple border border-neon-purple/30 rounded text-xs hover:bg-neon-purple/40 font-bold"
                              >
                                Importer
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                      <tr className="bg-white/5 font-bold text-white">
                        <td className="py-3 px-3" colSpan="3">Total Heures Calculees</td>
                        <td className="py-3 px-3" colSpan="2">
                          {Math.round(events.reduce((acc, evt) => {
                            const start = evt.heure_debut ? evt.heure_debut.split(':').map(Number) : [0,0];
                            const end = evt.heure_fin ? evt.heure_fin.split(':').map(Number) : [0,0];
                            let durMin = (end[0]*60 + end[1]) - (start[0]*60 + start[1]);
                            if (durMin < 0) durMin += 24*60;
                            return acc + durMin;
                          }, 0) / 60 * 10) / 10} h
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {events.map((evt, idx) => (
                    <div key={`new-${idx}`} onClick={() => setSelectedEvent(evt)} className="cursor-pointer">
                      <EventCard event={evt} onAdd={handleAddToCalendar} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          
          {/* All saved events */}
          <div>
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <CalendarCheck size={20} className="text-neon-teal" /> Tous mes evenements ({savedEvents.length})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {savedEvents.length === 0 ? (
                <div className="glass-panel p-8 text-center text-gray-500 col-span-3">
                  <CalendarCheck size={48} className="opacity-20 mx-auto mb-3" />
                  <p>Aucun evenement. Scannez une page pour commencer.</p>
                </div>
              ) : (
                savedEvents.map((evt, idx) => (
                  <div key={`saved-${evt.id || idx}`} onClick={() => setSelectedEvent(evt)} className="cursor-pointer">
                    <EventCard event={evt} onAdd={handleAddToCalendar} />
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {activeView === 'stats' && (
        <StatsPanel events={savedEvents} conflicts={conflicts} categories={categories} token={token} />
      )}
      {activeView === 'settings' && (
        <SettingsPanel 
          onSettingsChange={loadCategories}
          config={config}
          onConfigChange={loadConfig}
          token={token}
        />
      )}
      {/* Event Detail Modal */}
      {selectedEvent && (
        <EventModal 
          event={selectedEvent} 
          onClose={() => setSelectedEvent(null)} 
          onDelete={handleDeleteEvent}
          onAddToCalendar={handleAddToCalendar}
        />
      )}
      {/* Add Event Modal */}
      {isAddModalOpen && (
        <AddEventModal 
          onClose={() => setIsAddModalOpen(false)}
          onSave={handleAddToCalendar}
          categories={categories}
          initialValues={addModalInitialValues}
        />
      )}

      {/* Auth Modal */}
      <AuthPage 
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onSuccess={handleAuthSuccess}
      />

      {/* Subscription Modal */}
      <SubscriptionModal 
        isOpen={isSubOpen}
        onClose={() => setIsSubOpen(false)}
        currentPlan={user?.subscription_plan || 'free'}
        onPlanUpdated={loadProfile}
        token={token}
      />

      {/* Floating Action Button (FAB) for Mobile */}
      <button 
        onClick={() => {
          setAddModalInitialValues(null);
          setIsAddModalOpen(true);
        }}
        className="fixed bottom-20 right-4 z-40 md:hidden p-4 bg-neon-purple text-dark-950 rounded-full shadow-[0_0_20px_rgba(168,85,247,0.6)] hover:shadow-[0_0_30px_rgba(168,85,247,0.8)] transition-all cursor-pointer"
        aria-label="Planifier un bloc"
      >
        <PlusCircle size={24} />
      </button>

      {/* Bottom Nav Bar for Mobile */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-dark-950/95 backdrop-blur-md border-t border-white/10 flex justify-around p-2 pb-safe md:hidden shadow-[0_-5px_15px_rgba(0,0,0,0.5)]">
        {[
          { id: 'calendar', icon: <LayoutGrid size={20} />, label: 'Calendrier' },
          { id: 'list', icon: <List size={20} />, label: 'Liste' },
          { id: 'stats', icon: <BarChart3 size={20} />, label: 'Stats' },
          { id: 'settings', icon: <Settings size={20} />, label: 'Paramètres' },
        ].map(tab => (
          <button 
            key={tab.id}
            onClick={() => setActiveView(tab.id)}
            className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-all ${
              activeView === tab.id 
                ? 'text-neon-purple' 
                : 'text-gray-400 hover:text-white'
            }`}
          >
            {tab.icon}
            <span className="text-[10px] font-bold">{tab.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default Dashboard;
