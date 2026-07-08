import React, { useState, useEffect, createContext, useContext, useCallback } from 'react';
import { CheckCircle2, AlertTriangle, X, Info } from 'lucide-react';

const ToastContext = createContext();

const TOAST_STYLES = {
  success: {
    bg: 'bg-green-500/15 border-green-500/40',
    icon: <CheckCircle2 size={18} className="text-green-400" />,
    bar: 'bg-green-500'
  },
  error: {
    bg: 'bg-red-500/15 border-red-500/40',
    icon: <AlertTriangle size={18} className="text-red-400" />,
    bar: 'bg-red-500'
  },
  info: {
    bg: 'bg-sky-500/15 border-sky-500/40',
    icon: <Info size={18} className="text-sky-400" />,
    bar: 'bg-sky-500'
  }
};

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type, duration }]);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      {/* Toast Container */}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm">
        {toasts.map(toast => (
          <ToastItem key={toast.id} toast={toast} onRemove={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
};

const ToastItem = ({ toast, onRemove }) => {
  const [isExiting, setIsExiting] = useState(false);
  const style = TOAST_STYLES[toast.type] || TOAST_STYLES.info;

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsExiting(true);
      setTimeout(() => onRemove(toast.id), 300);
    }, toast.duration);
    return () => clearTimeout(timer);
  }, [toast, onRemove]);

  return (
    <div 
      className={`relative border rounded-xl px-4 py-3 shadow-xl backdrop-blur-md flex items-start gap-3 transition-all duration-300 ${style.bg} ${
        isExiting ? 'opacity-0 translate-x-4' : 'opacity-100 translate-x-0 animate-slideIn'
      }`}
    >
      <div className={`h-full w-1 absolute left-0 top-0 bottom-0 rounded-l-xl ${style.bar}`} />
      <div className="mt-0.5">{style.icon}</div>
      <p className="text-sm text-white flex-1 leading-relaxed">{toast.message}</p>
      <button 
        onClick={() => { setIsExiting(true); setTimeout(() => onRemove(toast.id), 300); }}
        className="text-gray-400 hover:text-white transition-colors mt-0.5"
      >
        <X size={14} />
      </button>
      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(40px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .animate-slideIn { animation: slideIn 0.3s ease-out; }
      `}</style>
    </div>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within a ToastProvider');
  return context;
};
