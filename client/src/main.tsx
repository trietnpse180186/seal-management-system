import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import axios from 'axios'
import './index.css'
import App from './App.tsx'

// Globally redirect 'token' key from localStorage to sessionStorage to keep sessions tab-scoped
const originalGetItem = localStorage.getItem.bind(localStorage);
const originalSetItem = localStorage.setItem.bind(localStorage);
const originalRemoveItem = localStorage.removeItem.bind(localStorage);

localStorage.getItem = function(key: string) {
  if (key === 'token') {
    return sessionStorage.getItem('token');
  }
  return originalGetItem(key);
};

localStorage.setItem = function(key: string, value: string) {
  if (key === 'token') {
    return sessionStorage.setItem('token', value);
  }
  return originalSetItem(key, value);
};

localStorage.removeItem = function(key: string) {
  if (key === 'token') {
    return sessionStorage.removeItem('token');
  }
  return originalRemoveItem(key);
};

// Configure Axios globally to dynamically rewrite hardcoded local API URLs to production
axios.interceptors.request.use((config) => {
  if (config.url && config.url.startsWith('http://localhost:5000')) {
    let apiBase = import.meta.env.VITE_API_URL;
    if (!apiBase) {
      const hostname = window.location.hostname;
      if (hostname && hostname !== 'localhost' && hostname !== '127.0.0.1') {
        apiBase = window.location.origin;
      } else {
        apiBase = 'http://localhost:5000';
      }
    }
    config.url = config.url.replace('http://localhost:5000', apiBase);
  }
  return config;
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
