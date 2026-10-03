import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Apply theme immediately (before React hydrates) to avoid FOUT
;(function () {
  let theme = 'light';
  try {
    const stored = localStorage.getItem('nwis-theme');
    if (stored === 'dark' || stored === 'light') {
      theme = stored;
    } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      theme = 'dark';
    }
  } catch (_) {}
  document.documentElement.setAttribute('data-theme', theme);
})();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
