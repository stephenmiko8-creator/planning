import React from 'react'
import Dashboard from './components/Dashboard'
import { ToastProvider } from './components/Toast'

function App() {
  return (
    <ToastProvider>
      <div className="min-h-screen bg-dark-900 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-dark-800 to-dark-900 text-gray-100 font-sans selection:bg-neon-purple/30 selection:text-white">
        <Dashboard />
      </div>
    </ToastProvider>
  )
}

export default App
