import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Wand2, RefreshCw } from 'lucide-react';

export default function AIChatPanel({ API_BASE_URL, getHeaders, addToast, config, user, onRefreshCalendar }) {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: "Bonjour ! Je suis votre assistant de planning Mikiplan. Vous pouvez me demander de créer des événements ou de vous renseigner sur votre planning. Par exemple : 'Planifie un café avec Sophie demain à 15h' ou 'Quand suis-je libre cette semaine ?'" }
  ]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || isSending) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsSending(true);

    try {
      const res = await fetch(`${API_BASE_URL}/api/tasks/chat`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          message: userMessage,
          currentDate: new Date().toLocaleDateString('en-CA', { timeZone: config?.timezone || 'Europe/Paris' }),
          timezone: config?.timezone || 'Europe/Paris'
        })
      });

      if (res.ok) {
        const result = await res.json();
        setMessages(prev => [...prev, { role: 'assistant', content: result.response }]);
        if (result.action === 'create_events' && result.events_created > 0) {
          addToast(`Événement(s) planifié(s) avec succès !`, 'success');
          if (onRefreshCalendar) onRefreshCalendar();
        }
      } else {
        const err = await res.json();
        setMessages(prev => [...prev, { role: 'assistant', content: err.error || "Une erreur est survenue." }]);
      }
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, { role: 'assistant', content: "Erreur de connexion. Impossible de joindre l'IA." }]);
    } finally {
      setIsSending(false);
    }
  };

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center space-y-4 p-8">
        <div className="w-16 h-16 bg-neon-purple/20 rounded-full flex items-center justify-center mb-2 shadow-[0_0_20px_rgba(168,85,247,0.3)]">
          <Bot size={32} className="text-neon-purple animate-pulse" />
        </div>
        <h2 className="text-2xl font-bold">Chatbot Assistant IA</h2>
        <p className="text-gray-400 max-w-md">
          Discutez avec l'IA pour gérer votre calendrier en langage naturel. Connectez-vous pour commencer !
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-200px)] max-h-[600px] border border-white/5 bg-dark-800/20 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-white/5 bg-dark-900/50 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-neon-purple/20 flex items-center justify-center text-neon-purple shadow-[0_0_15px_rgba(168,85,247,0.3)]">
          <Bot size={20} />
        </div>
        <div className="text-left">
          <h3 className="font-bold text-white">Assistant IA</h3>
          <span className="text-[10px] text-neon-teal font-extrabold uppercase tracking-widest flex items-center gap-1">
            <span className="w-1.5 h-1.5 bg-neon-teal rounded-full animate-ping"></span>
            En ligne
          </span>
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
        {messages.map((m, idx) => (
          <div key={idx} className={`flex gap-3 max-w-[85%] ${m.role === 'user' ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
              m.role === 'user' ? 'bg-neon-teal/20 text-neon-teal' : 'bg-neon-purple/20 text-neon-purple'
            }`}>
              {m.role === 'user' ? <User size={14} /> : <Bot size={14} />}
            </div>
            <div className={`p-3 rounded-2xl text-sm leading-relaxed text-left ${
              m.role === 'user'
                ? 'bg-gradient-to-br from-neon-teal/10 to-neon-blue/10 border border-neon-teal/20 text-gray-200 rounded-tr-none shadow-[0_0_10px_rgba(20,184,166,0.05)]'
                : 'bg-white/5 border border-white/5 text-gray-300 rounded-tl-none'
            }`}>
              {m.content}
            </div>
          </div>
        ))}
        {isSending && (
          <div className="flex gap-3 max-w-[85%] mr-auto">
            <div className="w-8 h-8 rounded-lg bg-neon-purple/20 text-neon-purple flex items-center justify-center animate-pulse">
              <Bot size={14} />
            </div>
            <div className="p-3 bg-white/5 border border-white/5 rounded-2xl text-sm text-gray-400 rounded-tl-none flex items-center gap-1.5">
              <RefreshCw size={12} className="animate-spin text-neon-purple" />
              <span>L'IA réfléchit...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <form onSubmit={handleSend} className="p-3 border-t border-white/5 bg-dark-900/30 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ex: Planifie une réunion demain à 9h de 2h..."
          className="flex-1 bg-dark-800/50 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-neon-purple/50 transition-colors"
          disabled={isSending}
        />
        <button
          type="submit"
          disabled={!input.trim() || isSending}
          className="p-2.5 bg-neon-purple text-active-day-text rounded-xl font-bold transition-all hover:shadow-[0_0_15px_rgba(168,85,247,0.4)] disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
        >
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}
