
import React from 'react';
import ReactDOM from 'react-dom/client';
// Fix: Importing App which will now be a proper module with a default export
import App from './App';
import { LanguageProvider } from './contexts/LanguageContext';

const startApp = () => {
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    throw new Error("Could not find root element to mount to");
  }

  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <LanguageProvider>
        <App />
      </LanguageProvider>
    </React.StrictMode>
  );

  // Register service worker after app starts
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/service-worker.js')
      .then(registration => {
        console.log('ServiceWorker registration successful with scope: ', registration.scope);
      })
      .catch(err => {
        console.log('ServiceWorker registration failed: ', err);
      });
  }
};

// Defer app start until the window 'load' event, which guarantees all scripts are loaded.
window.addEventListener('load', startApp);
