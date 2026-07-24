import React, { useState, useEffect } from 'react';
import { User, Tag, Plus, Trash2, Save, Check, AlertCircle, Settings, Palette } from 'lucide-react';
import { API_BASE_URL } from '../config';

const COLOR_PRESETS = [
  { name: 'Violet Néon', class: 'bg-purple-500/30 border-purple-500/60 text-purple-200', dot: 'bg-purple-500' },
  { name: 'Teal Néon', class: 'bg-teal-500/30 border-teal-500/60 text-teal-200', dot: 'bg-teal-500' },
  { name: 'Orange/Ambre', class: 'bg-amber-500/30 border-amber-500/60 text-amber-200', dot: 'bg-amber-500' },
  { name: 'Rose/Fuchsia', class: 'bg-pink-500/30 border-pink-500/60 text-pink-200', dot: 'bg-pink-500' },
  { name: 'Vert Émeraude', class: 'bg-green-500/30 border-green-500/60 text-green-200', dot: 'bg-green-500' },
  { name: 'Bleu Électrique', class: 'bg-blue-500/30 border-blue-500/60 text-blue-200', dot: 'bg-blue-500' },
  { name: 'Rouge Éclatant', class: 'bg-red-500/30 border-red-500/60 text-red-200', dot: 'bg-red-500' }
];

const SettingsPanel = ({ onSettingsChange, config, onConfigChange, token, currentTheme, onChangeTheme }) => {
  const [profile, setProfile] = useState('');
  const [categories, setCategories] = useState([]);
  const [newCatName, setNewCatName] = useState('');
  const [selectedColorIndex, setSelectedColorIndex] = useState(0);
  
  const [timezone, setTimezone] = useState('Europe/Paris');
  const [activeStartHour, setActiveStartHour] = useState('08:00');
  const [activeEndHour, setActiveEndHour] = useState('22:00');
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [configSuccessMsg, setConfigSuccessMsg] = useState(false);

  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);

  useEffect(() => {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      navigator.serviceWorker.ready.then(registration => {
        registration.pushManager.getSubscription().then(sub => {
          if (sub) setPushEnabled(true);
        });
      });
    }
  }, []);

  const urlBase64ToUint8Array = (base64String) => {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/\-/g, '+')
      .replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  };

  const handleTogglePush = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      alert("Les notifications Push ne sont pas supportées par votre navigateur.");
      return;
    }
    if (pushEnabled) return; // Unsubscribe logic can be added later

    setPushLoading(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') throw new Error('Permission refusée');

      const res = await fetch(`${API_BASE_URL}/api/push/public-key`, { headers: getHeaders(false) });
      const { publicKey } = await res.json();

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey)
      });

      await fetch(`${API_BASE_URL}/api/push/subscribe`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(subscription)
      });

      setPushEnabled(true);
    } catch (err) {
      console.error(err);
      alert("Erreur lors de l'activation des notifications.");
    } finally {
      setPushLoading(false);
    }
  };

  useEffect(() => {
    if (config) {
      setTimezone(config.timezone || 'Europe/Paris');
      setActiveStartHour(config.active_start_hour || '08:00');
      setActiveEndHour(config.active_end_hour || '22:00');
    }
  }, [config]);

  const getHeaders = (hasBody = true) => {
    const headers = {};
    if (hasBody) headers['Content-Type'] = 'application/json';
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  };

  const handleSaveConfig = async () => {
    setIsSavingConfig(true);
    setConfigSuccessMsg(false);
    try {
      const res = await fetch(`${API_BASE_URL}/api/settings/config`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          timezone,
          active_start_hour: activeStartHour,
          active_end_hour: activeEndHour
        })
      });
      const data = await res.json();
      if (data.success) {
        setConfigSuccessMsg(true);
        if (onConfigChange) onConfigChange();
        setTimeout(() => setConfigSuccessMsg(false), 2000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSavingConfig(false);
    }
  };
  
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    fetchProfile();
    fetchCategories();
  }, [token]);

  const fetchProfile = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/settings/profile`, {
        headers: getHeaders(false)
      });
      const data = await res.json();
      if (data.success) {
        setProfile(data.context || '');
      }
    } catch (err) {
      console.error('Error fetching profile:', err);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/settings/categories`, {
        headers: getHeaders(false)
      });
      const data = await res.json();
      if (data.success) {
        setCategories(data.categories || []);
        if (onSettingsChange) onSettingsChange();
      }
    } catch (err) {
      console.error('Error fetching categories:', err);
    }
  };

  const handleSaveProfile = async () => {
    setIsSavingProfile(true);
    setError('');
    setProfileSaved(false);
    try {
      const res = await fetch(`${API_BASE_URL}/api/settings/profile`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ context: profile })
      });
      const data = await res.json();
      if (data.success) {
        setProfileSaved(true);
        setTimeout(() => setProfileSaved(false), 2000);
      } else {
        setError(data.error || 'Erreur lors de la sauvegarde.');
      }
    } catch (err) {
      setError('Impossible de se connecter au serveur.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleAddCategory = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    if (!newCatName.trim()) {
      setError('Le nom de la catégorie ne peut pas être vide.');
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/settings/categories`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          name: newCatName.trim(),
          color_class: COLOR_PRESETS[selectedColorIndex].class
        })
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg(`Catégorie "${newCatName.trim()}" ajoutée avec succès !`);
        setNewCatName('');
        fetchCategories();
        setTimeout(() => setSuccessMsg(''), 2000);
      } else {
        setError(data.error || "Erreur lors de l'ajout.");
      }
    } catch (err) {
      setError('Impossible de contacter le serveur.');
    }
  };

  const handleDeleteCategory = async (id, name) => {
    setError('');
    setSuccessMsg('');
    
    // Prevent deleting some basic ones to keep standard UI safe (optional, let's allow but alert)
    if (['Travail', 'Formation', 'Temps Personnel', 'Développement', 'Autre'].includes(name)) {
      if (!window.confirm(`"${name}" est une catégorie système par défaut. Voulez-vous vraiment la supprimer ?`)) {
        return;
      }
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/settings/categories/${id}`, {
        method: 'DELETE',
        headers: getHeaders(false)
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg(`Catégorie supprimée.`);
        fetchCategories();
        setTimeout(() => setSuccessMsg(''), 2000);
      }
    } catch (err) {
      setError('Erreur lors de la suppression.');
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-left">
      {/* Profile Section */}
      <div className="lg:col-span-2 flex flex-col gap-6">
        <div className="glass-panel p-5 border border-neon-purple/20">
          <h4 className="text-white font-bold mb-2 flex items-center gap-2">
            <User size={18} className="text-neon-purple" /> Contexte & Objectifs de Vie (Profil IA)
          </h4>
          <p className="text-xs text-gray-400 mb-4">
            Décrivez en détail votre rythme quotidien, vos contraintes et vos objectifs (ex: étudiant, alternant, travailleur de nuit, parent). L'IA utilisera ce contexte pour classifier intelligemment vos plannings et générer vos rapports d'activité.
          </p>

          <textarea
            value={profile}
            onChange={(e) => setProfile(e.target.value)}
            placeholder="Exemple: Je suis étudiant en Master de Finance et je travaille également comme caissier chez Sephora et McDonald's les weekends. Je souhaite équilibrer mes heures de cours avec mes shifts tout en gardant du temps pour mon apprentissage du code."
            className="w-full bg-dark-900 border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-neon-purple/50 min-h-[160px] resize-y custom-scrollbar mb-4"
          />

          <div className="flex items-center justify-between">
            {error && (
              <span className="text-xs text-red-400 flex items-center gap-1">
                <AlertCircle size={14} /> {error}
              </span>
            )}
            {!error && profileSaved && (
              <span className="text-xs text-neon-teal flex items-center gap-1 animate-pulse">
                <Check size={14} /> Profil sauvegardé avec succès
              </span>
            )}
            <div className="flex-1" />
            <button
              onClick={handleSaveProfile}
              disabled={isSavingProfile}
              className="px-5 py-2 bg-neon-purple text-btn-text-accent font-bold rounded-xl text-sm hover:shadow-[0_0_20px_rgba(168,85,247,0.5)] transition-all flex items-center gap-2 disabled:opacity-40"
            >
              {isSavingProfile ? (
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <Save size={16} />
              )}
              <span>Enregistrer le profil</span>
            </button>
          </div>
        </div>

        {/* Paramètres Généraux */}
        <div className="glass-panel p-5 border border-neon-purple/20">
          <h4 className="text-white font-bold mb-2 flex items-center gap-2">
            <Settings size={18} className="text-neon-purple" /> Paramètres Généraux
          </h4>
          <p className="text-xs text-gray-400 mb-4">
            Personnalisez votre fuseau horaire et votre plage de disponibilité active par défaut.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-xs font-bold text-gray-400 mb-1">
                Fuseau Horaire
              </label>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full bg-dark-900 border border-white/10 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-neon-purple/50"
              >
                <option value="Europe/Paris">Europe/Paris</option>
                <option value="America/New_York">America/New_York</option>
                <option value="Asia/Tokyo">Asia/Tokyo</option>
                <option value="UTC">UTC</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-400 mb-1">
                Début Journée Active
              </label>
              <input
                type="time"
                value={activeStartHour}
                onChange={(e) => setActiveStartHour(e.target.value)}
                className="w-full bg-dark-900 border border-white/10 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-neon-purple/50"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-400 mb-1">
                Fin Journée Active
              </label>
              <input
                type="time"
                value={activeEndHour}
                onChange={(e) => setActiveEndHour(e.target.value)}
                className="w-full bg-dark-900 border border-white/10 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-neon-purple/50"
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            {configSuccessMsg && (
              <span className="text-xs text-neon-teal flex items-center gap-1 animate-pulse">
                <Check size={14} /> Paramètres sauvegardés avec succès
              </span>
            )}
            {!configSuccessMsg && <div className="flex-1" />}
            <button
              onClick={handleSaveConfig}
              disabled={isSavingConfig}
              className="px-5 py-2 bg-neon-purple text-btn-text-accent font-bold rounded-xl text-sm hover:shadow-[0_0_20px_rgba(168,85,247,0.5)] transition-all flex items-center gap-2 disabled:opacity-40"
            >
              {isSavingConfig ? (
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <Save size={16} />
              )}
              <span>Enregistrer les paramètres</span>
            </button>
          </div>
        </div>

        {/* Thème Visuel */}
        <div className="glass-panel p-5 border border-neon-purple/20">
          <h4 className="text-white font-bold mb-2 flex items-center gap-2">
            <Palette size={18} className="text-neon-purple" /> Thème Visuel de l'Application
          </h4>
          <p className="text-xs text-gray-400 mb-4">
            Choisissez l'univers visuel qui correspond le mieux à votre utilisation.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { id: 'electric', label: 'Gradient Électrique', desc: 'Futuriste / Techno', colors: 'from-blue-600 via-purple-600 to-pink-500' },
              { id: 'minimalist', label: 'Épure & Moderne', desc: 'Sombre & Minimaliste', colors: 'from-neutral-800 to-neutral-900' },
              { id: 'light', label: 'Pastel Doux', desc: 'Light Mode', colors: 'from-indigo-200 via-purple-100 to-amber-50' },
              { id: 'organic', label: 'Vert Nature & Terre', desc: 'Chaleureux & Organique', colors: 'from-emerald-800 via-stone-700 to-amber-900' }
            ].map(t => (
              <button
                key={t.id}
                type="button"
                onClick={() => onChangeTheme && onChangeTheme(t.id)}
                className={`p-3 rounded-xl border text-left flex flex-col gap-2 transition-all cursor-pointer ${
                  currentTheme === t.id 
                    ? 'bg-white/10 border-neon-purple shadow-[0_0_15px_rgba(168,85,247,0.3)]' 
                    : 'bg-dark-900/40 border-white/5 hover:border-white/20'
                }`}
              >
                <div className={`h-8 rounded-lg bg-gradient-to-r ${t.colors} border border-white/10`} />
                <div>
                  <div className="text-xs font-bold text-white">{t.label}</div>
                  <div className="text-[10px] text-gray-400 mt-0.5">{t.desc}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Categories Section */}
      <div className="lg:col-span-1 flex flex-col gap-6">
        {/* Categories Manager */}
        <div className="glass-panel p-5 border border-neon-teal/20">
          <h4 className="text-white font-bold mb-3 flex items-center gap-2">
            <Tag size={18} className="text-neon-teal" /> Catégories Personnalisées
          </h4>

          {/* List of categories */}
          <div className="flex flex-col gap-2 max-h-[220px] overflow-y-auto pr-1 mb-4 custom-scrollbar">
            {categories.map((cat) => (
              <div key={cat.id} className="flex justify-between items-center bg-white/3 border border-white/5 rounded-xl p-2.5 hover:bg-white/5 transition-all">
                <span className={`px-2 py-0.5 rounded text-xs border ${cat.color_class || 'border-gray-500/40 text-gray-300 bg-gray-500/20'}`}>
                  {cat.name}
                </span>
                <button
                  onClick={() => handleDeleteCategory(cat.id, cat.name)}
                  className="text-gray-400 hover:text-red-400 p-1 rounded-lg transition-colors"
                  title="Supprimer la catégorie"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>

          {/* Add Category Form */}
          <form onSubmit={handleAddCategory} className="border-t border-white/10 pt-4 flex flex-col gap-3">
            <h5 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Créer une catégorie</h5>
            
            <input
              type="text"
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              placeholder="Nom (ex: Sport, Projet X)"
              className="w-full bg-dark-900 border border-white/10 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-neon-teal/50"
              maxLength={25}
            />

            {/* Colors grid selection */}
            <div>
              <label className="block text-[10px] font-bold text-gray-500 mb-1.5 uppercase tracking-wider">Couleur néon</label>
              <div className="flex flex-wrap gap-2">
                {COLOR_PRESETS.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSelectedColorIndex(idx)}
                    className={`w-6 h-6 rounded-full flex items-center justify-center border transition-all ${preset.dot} ${
                      selectedColorIndex === idx ? 'ring-2 ring-white scale-110 border-white' : 'border-transparent opacity-60 hover:opacity-100'
                    }`}
                    title={preset.name}
                  >
                    {selectedColorIndex === idx && <Check size={10} className="text-white" />}
                  </button>
                ))}
              </div>
            </div>

            {successMsg && (
              <p className="text-[11px] text-neon-teal bg-teal-500/10 border border-teal-500/20 rounded p-1.5 text-center animate-pulse">
                {successMsg}
              </p>
            )}

            <button
              type="submit"
              className="w-full py-2 bg-neon-teal text-neutral-950 font-bold rounded-xl text-xs hover:shadow-[0_0_15px_rgba(20,184,166,0.4)] transition-all flex items-center justify-center gap-1.5"
            >
              <Plus size={14} />
              <span>Ajouter</span>
            </button>
          </form>
        </div>

        {/* Notifications Push */}
        <div className="glass-panel p-5 border border-neon-purple/20">
          <h4 className="text-white font-bold mb-2 flex items-center gap-2">
            <AlertCircle size={18} className="text-neon-purple" /> Notifications Push
          </h4>
          <p className="text-xs text-gray-400 mb-4">
            Recevez une alerte sur cet appareil 15 minutes avant le début de votre prochain événement.
          </p>
          <button
            onClick={handleTogglePush}
            disabled={pushLoading}
            className={`w-full py-2 font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 ${
              pushEnabled 
                ? 'bg-green-500/20 text-green-400 border border-green-500/50' 
                : 'bg-neon-purple text-btn-text-accent hover:shadow-[0_0_15px_rgba(168,85,247,0.4)]'
            }`}
          >
            {pushLoading ? (
               <div className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin"></div>
            ) : pushEnabled ? (
              <><Check size={14} /> Notifications Activées</>
            ) : (
              <>Activer les notifications</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsPanel;
