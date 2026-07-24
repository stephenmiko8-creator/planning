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
import TaskPanel from './TaskPanel';
import AIChatPanel from './AIChatPanel';
import ProjectBreakdown from './ProjectBreakdown';
import GuidePanel from './GuidePanel';
import { CalendarCheck, CheckCircle2, LogIn, LayoutGrid, BarChart3, List, Trash2, PlusCircle, Download, Settings, LogOut, Sparkles, Crown, Bot, Target, HelpCircle, ChevronDown, Menu, User } from 'lucide-react';
import { API_BASE_URL } from '../config';
import { useToast } from './Toast';
import { Preferences } from '@capacitor/preferences';

import UpcomingEventWidget from './UpcomingEventWidget';
import Paywall from './Paywall';

const Dashboard = ({ currentTheme, onChangeTheme }) => {
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
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [token, setToken] = useState(localStorage.getItem('token') || null);
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('user')) || null;
    } catch {
      return null;
    }
  });

  const navItems = useMemo(() => [
    { id: 'calendar', icon: <LayoutGrid size={16} />, label: 'Planning' },
    { id: 'list', icon: <List size={16} />, label: 'Liste' },
    { id: 'tasks', icon: <CheckCircle2 size={16} />, label: 'Tâches (IA)', locked: user && user.subscription_plan !== 'premium' },
    { id: 'breakdown', icon: <Target size={16} />, label: 'Projets (IA)', locked: user && user.subscription_plan !== 'premium' },
    { id: 'chat', icon: <Bot size={16} />, label: 'Chatbot', locked: user && user.subscription_plan !== 'premium' },
    { id: 'stats', icon: <BarChart3 size={16} />, label: 'Statistiques', locked: user && user.subscription_plan === 'free' },
    { id: 'settings', icon: <Settings size={16} />, label: 'Paramètres' },
    { id: 'guide', icon: <HelpCircle size={16} />, label: "Guide d'utilisation" },
  ], [user]);

  // Primary tabs always visible, secondary tucked into 'Plus' dropdown
  const primaryTabIds = ['calendar', 'list', 'tasks', 'breakdown', 'chat'];
  const primaryTabs = useMemo(() => navItems.filter(item => primaryTabIds.includes(item.id)), [navItems]);
  const secondaryTabs = useMemo(() => navItems.filter(item => !primaryTabIds.includes(item.id)), [navItems]);
  const isSecondaryActive = useMemo(() => secondaryTabs.some(item => item.id === activeView), [secondaryTabs, activeView]);

  const currentViewItem = useMemo(() => navItems.find(item => item.id === activeView) || navItems[0], [navItems, activeView]);

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

  const handleLogout = async () => {
    setToken(null);
    setUser(null);
    setSavedEvents([]);
    setCategories([]);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    try { await Preferences.remove({ key: 'token' }); } catch (e) {}
    addToast('Déconnexion réussie.', 'info');
  };

  const handleAuthSuccess = async (newToken, newUser) => {
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(newUser));
    try { await Preferences.set({ key: 'token', value: newToken }); } catch (e) {}
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

  // Charger le token sauvegardé au démarrage de l'application (spécifique aux mobiles)
  useEffect(() => {
    const loadStoredAuth = async () => {
      try {
        const { value: storedToken } = await Preferences.get({ key: 'token' });
        if (storedToken) {
          setToken(storedToken);
          const storedUser = localStorage.getItem('user');
          if (storedUser) {
            setUser(JSON.parse(storedUser));
          }
        }
      } catch (e) {
        console.error('Erreur lors du chargement du token:', e);
      }
    };
    loadStoredAuth();
  }, []);

  // Close 'More' dropdown on click-outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (isMoreOpen && !event.target.closest('.more-dropdown-container')) {
        setIsMoreOpen(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [isMoreOpen]);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const sharedText = urlParams.get('text') || urlParams.get('title') || urlParams.get('url');
    if (sharedText) {
      window.history.replaceState({}, document.title, "/");
      handleScan(sharedText);
    }
    
    if (urlParams.get('stripe_success')) {
      const sessionId = urlParams.get('session_id');
      window.history.replaceState({}, document.title, "/");
      
      if (sessionId && token) {
        fetch(`${API_BASE_URL}/api/stripe/verify-session`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ sessionId })
        })
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            addToast(`Abonnement ${data.plan.toUpperCase()} activé avec succès !`, 'success', 5000);
            loadProfile(); // Refresh profile explicitly
          }
        })
        .catch(console.error);
      } else {
        addToast('Abonnement activé avec succès !', 'success', 5000);
        loadProfile();
      }
    }
    if (urlParams.get('stripe_cancel')) {
      window.history.replaceState({}, document.title, "/");
      addToast('Paiement annulé.', 'info');
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

  const handleUpdateEvent = async (id, updatedDetails) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/events/${id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(updatedDetails)
      });
      const data = await res.json();
      if (data.success) {
        addToast('Événement mis à jour avec succès.', 'success');
        loadSavedEvents();
        // Update selectedEvent state to immediately reflect changes in the details modal
        setSelectedEvent(prev => prev && (prev.id === id || prev.id === undefined) ? { ...prev, ...updatedDetails } : prev);
        return true;
      } else {
        addToast(data.error || 'Erreur lors de la mise à jour.', 'error');
        return false;
      }
    } catch (e) {
      console.log('Update error', e);
      addToast('Erreur de connexion au serveur.', 'error');
      return false;
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
    <div className="w-full max-w-full px-4 md:px-8 py-4 md:py-6 pb-24 md:pb-6 flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          {/* Mikiplan Official Logo: 4 organic blob shapes */}
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0" style={{filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))'}}>
            <defs>
              <linearGradient id="purpleToCyan" x1="0" y1="1" x2="0.5" y2="0">
                <stop offset="0%" stopColor="#a855f7" />
                <stop offset="100%" stopColor="#22d3ee" />
              </linearGradient>
            </defs>
            {/* Bottom-left: purple dot */}
            <circle cx="8" cy="24" r="5" fill="#a855f7" />
            {/* Center-bottom: connected cyan-blue blob (links purple dot to upper shapes) */}
            <rect x="4" y="13" width="14" height="9" rx="4.5" fill="url(#purpleToCyan)" />
            {/* Top-left: floating turquoise dot */}
            <circle cx="8" cy="6" r="4.5" fill="#2dd4bf" />
            {/* Top-right: floating turquoise dot */}
            <circle cx="22" cy="6" r="4.5" fill="#22d3ee" />
          </svg>

          {/* Two-Tone Brand Typography */}
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight flex items-baseline">
            <span className="text-[#0d9488] dark:text-[#2dd4bf]">Miki</span>
            <span className="text-[#0f172a] dark:text-[#cbd5e1]">plan</span>
          </h1>
          <span className="hidden lg:inline-block w-px h-6 bg-gray-300 dark:bg-white/10 mx-1" />
          <p className="hidden lg:block text-xs text-gray-500 dark:text-gray-400">Planifiez plus intelligemment grâce à l'IA — scannez, organisez, optimisez.</p>
        </div>
        <div className="flex gap-3 items-center ml-auto shrink-0 py-1">
          {/* Quick Event Planner Button (Desktop) */}
          <button 
            onClick={() => {
              setAddModalInitialValues(null);
              setIsAddModalOpen(true);
            }}
            className="hidden md:flex relative group overflow-hidden px-4 py-2 bg-gradient-to-r from-neon-purple to-neon-blue text-active-day-text font-bold rounded-xl text-xs shadow-[0_0_15px_rgba(168,85,247,0.3)] hover:shadow-[0_0_20px_rgba(168,85,247,0.5)] hover:scale-105 active:scale-95 transition-all items-center gap-1.5 shrink-0 cursor-pointer"
          >
            <div className="absolute inset-0 w-full h-full bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.3),transparent)] -translate-x-[150%] group-hover:animate-[shimmer_2s_infinite]" />
            <PlusCircle size={14} className="relative z-10" />
            <span className="relative z-10">Planifier un bloc</span>
          </button>

          {/* Account/Profile Dropdown Logo */}
          <div className="relative profile-dropdown-container">
            <button
              onClick={() => {
                setIsProfileOpen(!isProfileOpen);
                setIsMenuOpen(false);
              }}
              className="w-9 h-9 rounded-full bg-gradient-to-br from-cyan-400 to-neon-purple p-[1.5px] shadow-[0_0_10px_rgba(45,212,191,0.2)] hover:shadow-[0_0_15px_rgba(45,212,191,0.4)] transition-all flex items-center justify-center cursor-pointer shrink-0"
              title="Mon Compte"
            >
              <div className="w-full h-full bg-[#0d1322] rounded-full flex items-center justify-center text-white">
                {user ? (
                  <span className="text-[10px] font-black uppercase text-cyan-400">
                    {user.email.slice(0, 2)}
                  </span>
                ) : (
                  <User size={16} className="text-gray-400" />
                )}
              </div>
            </button>

            {isProfileOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-dark-950/95 backdrop-blur-md border border-white/10 rounded-2xl shadow-2xl py-3 z-50 animate-[fadeIn_0.15s_ease-out]">
                {user ? (
                  <div className="px-4 py-2 border-b border-white/10 mb-2 flex flex-col gap-1">
                    <span className="text-[9px] text-gray-500 font-black uppercase tracking-wider">Mon Profil</span>
                    <span className="text-xs font-bold text-white truncate" title={user.email}>{user.email}</span>
                    <div className="flex justify-between items-center mt-2 text-[10px] bg-white/3 p-2 rounded-xl border border-white/5">
                      <span className="text-gray-400">Scans restants :</span>
                      <span className={`font-extrabold ${user.subscription_plan === 'free' ? 'text-gray-300' : 'text-neon-teal'}`}>
                        {user.subscription_plan === 'free' ? `${user.scan_count_this_month || 0}/5` : 'Illimités'}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="px-4 py-2 border-b border-white/10 mb-2">
                    <p className="text-[10px] text-gray-400">Connectez-vous pour sauvegarder vos plannings.</p>
                  </div>
                )}

                <div className="flex flex-col gap-1 px-2">
                  {user ? (
                    <>
                      {/* Subscription Status & Upgrade */}
                      <button
                        onClick={() => {
                          setIsSubOpen(true);
                          setIsProfileOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-1.5 rounded-xl text-xs font-extrabold uppercase transition-all hover:bg-white/5 ${
                          user.subscription_plan === 'premium'
                            ? 'text-neon-purple'
                            : user.subscription_plan === 'pro'
                            ? 'text-neon-teal'
                            : 'text-gray-300'
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          {user.subscription_plan === 'premium' && <Crown size={12} className="animate-pulse" />}
                          {user.subscription_plan === 'pro' && <Sparkles size={12} className="animate-pulse" />}
                          <span>Plan : {user.subscription_plan}</span>
                        </div>
                        <span className="text-[9px] text-gray-500 font-bold border border-white/10 px-2 py-0.5 rounded-full">Changer</span>
                      </button>

                      {/* Google Calendar Link (for premium) */}
                      {user.subscription_plan === 'premium' && (
                        <button
                          onClick={() => {
                            handleGoogleConnect();
                            setIsProfileOpen(false);
                          }}
                          className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-xl text-left text-xs font-bold transition-all hover:bg-white/5 ${
                            isGoogleConnected ? 'text-green-400' : 'text-gray-300'
                          }`}
                        >
                          <LogIn size={12} />
                          <span>{isGoogleConnected ? 'Google Calendar connecté' : 'Lier Google Calendar'}</span>
                        </button>
                      )}

                      {/* Settings tab link */}
                      <button
                        onClick={() => {
                          setActiveView('settings');
                          setIsProfileOpen(false);
                        }}
                        className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-xl text-left text-xs font-bold transition-all hover:bg-white/5 ${
                          activeView === 'settings' ? 'text-neon-purple bg-neon-purple/5' : 'text-gray-300'
                        }`}
                      >
                        <Settings size={12} />
                        <span>Paramètres</span>
                      </button>

                      {/* Log Out */}
                      <button
                        onClick={() => {
                          handleLogout();
                          setIsProfileOpen(false);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-1.5 rounded-xl text-left text-xs font-bold text-red-400 hover:bg-red-500/10 transition-all mt-1"
                      >
                        <LogOut size={12} />
                        <span>Déconnexion</span>
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => {
                        setIsAuthOpen(true);
                        setIsProfileOpen(false);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-neon-purple to-neon-blue text-active-day-text font-bold rounded-xl text-xs hover:shadow-[0_0_15px_rgba(168,85,247,0.4)] transition-all justify-center cursor-pointer"
                    >
                      <LogIn size={12} />
                      <span>Se connecter</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Hamburger Menu Dropdown (Triple Horizontal Lines) */}
          <div className="relative menu-dropdown-container">
            <button
              onClick={() => {
                setIsMenuOpen(!isMenuOpen);
                setIsProfileOpen(false);
              }}
              className="p-2 rounded-xl border border-white/10 hover:border-white/30 bg-white/5 hover:bg-white/10 text-white transition-all flex items-center justify-center cursor-pointer shrink-0"
              title="Menu principal"
            >
              <Menu size={18} />
            </button>

            {isMenuOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-dark-950/95 backdrop-blur-md border border-white/10 rounded-2xl shadow-2xl py-2 z-50 animate-[fadeIn_0.15s_ease-out]">
                <div className="px-4 py-1.5 border-b border-white/10 mb-1 text-[9px] uppercase font-black tracking-wider text-gray-500">
                  Navigation
                </div>
                {navItems.map(item => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveView(item.id);
                      setIsMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-4 py-2.5 text-left text-sm font-semibold transition-all hover:bg-white/5 cursor-pointer ${
                      activeView === item.id
                        ? 'text-neon-purple bg-neon-purple/5'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      {item.icon}
                      <span>{item.label}</span>
                    </div>
                    {item.locked && (
                      <span className="text-[10px] text-gray-500 font-extrabold uppercase">🔒</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {activeView === 'calendar' && (
        <UpcomingEventWidget events={savedEvents} />
      )}

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
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${resultsView === 'cards' ? 'bg-neon-purple text-active-day-text shadow-md' : 'text-gray-400 hover:text-white'}`}
                    >
                      Cartes
                    </button>
                    <button 
                      onClick={() => setResultsView('table')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${resultsView === 'table' ? 'bg-neon-purple text-active-day-text shadow-md' : 'text-gray-400 hover:text-white'}`}
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
                    className="px-4 py-2 bg-neon-purple text-active-day-text font-bold rounded-xl text-sm hover:shadow-[0_0_20px_rgba(168,85,247,0.6)] transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
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
        user?.subscription_plan === 'free' ? (
          <Paywall 
            requiredPlan="pro"
            title="Statistiques de Performance Verrouillées"
            description="Analysez votre charge horaire, suivez l'évolution de vos sessions et générez des rapports professionnels par e-mail."
            features={[
              "Accès aux statistiques détaillées de productivité",
              "Générateur de rapports d'activité sur-mesure",
              "Détection des conflits et chevauchements d'agenda",
              "Exportation au format CSV de vos plannings"
            ]}
            onUpgrade={() => setIsSubOpen(true)}
          />
        ) : (
          <StatsPanel 
            events={savedEvents} 
            conflicts={conflicts} 
            categories={categories} 
            token={token} 
            user={user}
            setIsSubOpen={setIsSubOpen}
          />
        )
      )}
      {activeView === 'settings' && (
        <SettingsPanel 
          onSettingsChange={loadCategories}
          config={config}
          onConfigChange={loadConfig}
          token={token}
          currentTheme={currentTheme}
          onChangeTheme={onChangeTheme}
        />
      )}
      {activeView === 'tasks' && (
        user?.subscription_plan !== 'premium' ? (
          <Paywall 
            requiredPlan="premium"
            title="Auto-Schedule IA Verrouillé"
            description="Laissez l'intelligence artificielle organiser vos corvées et tâches libres dans les créneaux disponibles de votre calendrier."
            features={[
              "Algorithme d'organisation automatique (Auto-Scheduling)",
              "Respect intelligent de vos temps de pause et priorités",
              "Optimisation de votre équilibre pro/perso",
              "Placement intelligent des tâches en un clic"
            ]}
            onUpgrade={() => setIsSubOpen(true)}
          />
        ) : (
          <TaskPanel 
            API_BASE_URL={API_BASE_URL}
            getHeaders={getHeaders}
            addToast={addToast}
            config={config}
            user={user}
            onScheduleComplete={() => {
              loadSavedEvents();
              setActiveView('calendar');
            }}
          />
        )
      )}
      {activeView === 'breakdown' && (
        user?.subscription_plan !== 'premium' ? (
          <Paywall 
            requiredPlan="premium"
            title="Découpeur de Projets IA Verrouillé"
            description="Décomposez vos grands objectifs (ex: apprendre une langue, préparer un examen) en étapes actionnables prêtes à être planifiées."
            features={[
              "Décomposition d'objectifs complexes par l'IA",
              "Création automatique d'étapes hebdomadaires structurées",
              "Calcul d'estimations horaires réalistes",
              "Ajout direct à votre liste de planification"
            ]}
            onUpgrade={() => setIsSubOpen(true)}
          />
        ) : (
          <ProjectBreakdown 
            API_BASE_URL={API_BASE_URL}
            getHeaders={getHeaders}
            addToast={addToast}
            config={config}
            user={user}
            onTasksAdded={() => {
              setActiveView('tasks');
            }}
          />
        )
      )}
      {activeView === 'chat' && (
        user?.subscription_plan !== 'premium' ? (
          <Paywall 
            requiredPlan="premium"
            title="Assistant Chatbot IA Verrouillé"
            description="Pilotez Mikiplan en discutant en langage naturel. Planifiez des événements ou posez des questions sur votre emploi du temps."
            features={[
              "Planification d'événements par simple message",
              "Recherche intelligente d'événements dans le calendrier",
              "Compréhension fluide du langage naturel",
              "Modifications à la voix ou par message instantané"
            ]}
            onUpgrade={() => setIsSubOpen(true)}
          />
        ) : (
          <AIChatPanel 
            API_BASE_URL={API_BASE_URL}
            getHeaders={getHeaders}
            addToast={addToast}
            config={config}
            user={user}
            onRefreshCalendar={loadSavedEvents}
          />
        )
      )}
      {activeView === 'guide' && (
        <GuidePanel 
          user={user}
          setIsSubOpen={setIsSubOpen}
        />
      )}
      {/* Event Detail Modal */}
      {selectedEvent && (
        <EventModal 
          event={selectedEvent} 
          onClose={() => setSelectedEvent(null)} 
          onDelete={handleDeleteEvent}
          onAddToCalendar={handleAddToCalendar}
          onUpdate={handleUpdateEvent}
          categories={categories}
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
        className="fixed bottom-6 right-4 z-40 md:hidden p-4 bg-neon-purple text-active-day-text rounded-full shadow-[0_0_20px_rgba(168,85,247,0.6)] hover:shadow-[0_0_30px_rgba(168,85,247,0.8)] transition-all cursor-pointer"
        aria-label="Planifier un bloc"
      >
        <PlusCircle size={24} />
      </button>
    </div>
  );
};

export default Dashboard;
