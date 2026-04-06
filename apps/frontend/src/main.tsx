import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Catch module-level / unhandled errors that happen before React mounts
// Shows a visible error page instead of blank white screen
window.addEventListener('error', (e) => {
  const root = document.getElementById('root')
  if (root && !root.hasChildNodes()) {
    root.innerHTML = `
      <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#fef2f2;padding:2rem">
        <div style="background:white;border-radius:1rem;padding:2rem;max-width:480px;width:100%;text-align:center;box-shadow:0 4px 6px rgba(0,0,0,0.1)">
          <div style="font-size:2.5rem;margin-bottom:0.75rem">⚠️</div>
          <h1 style="color:#dc2626;font-size:1.25rem;font-weight:bold;margin-bottom:0.5rem">Ralat Muat Semula</h1>
          <p style="color:#6b7280;font-size:0.875rem;margin-bottom:1rem;font-family:monospace;word-break:break-all">${e.message}</p>
          <p style="color:#9ca3af;font-size:0.75rem;margin-bottom:1.5rem">Ini berlaku kerana cache lama. Cuba muat semula.</p>
          <button onclick="window.location.reload(true)" style="background:#2563eb;color:white;padding:0.5rem 1.5rem;border-radius:0.5rem;border:none;cursor:pointer;font-size:0.875rem">
            🔄 Muat Semula Sekarang
          </button>
        </div>
      </div>
    `
  }
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
