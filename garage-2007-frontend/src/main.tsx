import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { initTelegram } from './services/telegramService'

// Инициализируем SDK до рендера (sync)
initTelegram()

if (import.meta.env.DEV) {
  import('./dev/devConsole').then((m) => m.initDevConsole())
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
