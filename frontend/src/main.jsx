import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// --- Domain Safety & Canonical Recovery ---
if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1' && window.location.hostname !== 'lungwhisperer.netlify.app') {
  console.warn("Legacy domain detected. Redirecting to canonical host.");
  window.location.replace('https://lungwhisperer.netlify.app' + window.location.pathname);
}
// Force reload on outdated version detection
if (localStorage.getItem('app_version') !== '2.1.5') {
  localStorage.clear();
  localStorage.setItem('app_version', '2.1.5');
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
