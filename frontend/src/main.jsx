import React, { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// --- Storage Safety & Recovery Logic ---
const safeStorageClear = () => {
  try {
    localStorage.clear();
  } catch (e) {
    console.error("Storage blocked by browser security.", e);
  }
};

const safeGetItem = (key) => {
  try {
    return localStorage.getItem(key);
  } catch (e) {
    return null;
  }
};

const safeSetItem = (key, val) => {
  try {
    localStorage.setItem(key, val);
  } catch (e) {
    // Fail silently
  }
};

// Version Migration & Environmental Purge
if (safeGetItem('env_rev') !== '3.0.6') {
  safeStorageClear();
  safeSetItem('env_rev', '3.0.6');
}

// Global Canonical Redirection
const CANONICAL_HOST = 'lungwhisperer.netlify.app';
if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1' && window.location.hostname !== CANONICAL_HOST) {
  window.location.replace(`https://${CANONICAL_HOST}${window.location.pathname}${window.location.search}`);
}

try {
  const container = document.getElementById('root');
  if (!container) throw new Error("Mounting point inaccessible.");
  
  const root = createRoot(container);
  root.render(
    <StrictMode>
      <App />
    </StrictMode>
  );
} catch (error) {
  console.error("Neural Sync Critical Failure:", error);
  document.body.innerHTML = `
    <div style="height: 100vh; background: #010409; color: #7d8590; display: flex; align-items: center; justify-content: center; font-family: -apple-system, blinkmacsystemfont, 'Segoe UI', roboto, helvetica, arial, sans-serif;">
      <div style="text-align: center; max-width: 440px; padding: 32px;">
        <h1 style="color: #f0f6fc; font-size: 24px; margin-bottom: 8px;">Neural Link Interrupted</h1>
        <p style="margin-bottom: 24px; line-height: 1.5;">A version conflict has been detected. The environment requires a hard reset.</p>
        <button onclick="localStorage.clear(); window.location.href='/';" style="background: #238636; border: 1px solid rgba(240,246,242,0.1); border-radius: 6px; color: #ffffff; cursor: pointer; font-size: 14px; font-weight: 500; padding: 5px 16px;">Perform Environmental Reset</button>
      </div>
    </div>
  `;
}
