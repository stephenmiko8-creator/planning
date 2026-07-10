import React, { useState, useEffect } from 'react'
import Dashboard from './components/Dashboard'
import { ToastProvider } from './components/Toast'

function App() {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('planning_theme') || 'electric';
  });

  useEffect(() => {
    localStorage.setItem('planning_theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <ToastProvider>
      <div 
        className="min-h-screen bg-dark-900 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-dark-850 to-dark-900 text-gray-300 font-sans selection:bg-neon-purple/30 selection:text-white transition-all duration-300"
        data-theme={theme}
      >
        <Dashboard currentTheme={theme} onChangeTheme={setTheme} />
      </div>
    </ToastProvider>
  )
}

export default App
