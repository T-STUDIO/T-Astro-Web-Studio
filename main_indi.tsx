
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { LanguageProvider } from './contexts/LanguageContext';
import * as SettingsService from './services/SettingsService';

// Ensure settings are set to INDI when loading this page
const settings = SettingsService.loadSettings();
const savedDriver = settings.connectionSettings.driver;

// Redirect if we are on the INDI page but another driver is selected
// This ensures that opening the root URL redirects to the last used driver app
/* 
if (savedDriver === 'Alpaca' && !window.location.pathname.includes('alpaca.html')) {
  window.location.href = './alpaca.html';
} else if (savedDriver === 'Simulator' && !window.location.pathname.includes('simulator.html')) {
  window.location.href = './simulator.html';
}
*/

if (settings.connectionSettings.driver !== 'INDI') {
  SettingsService.saveSettings({
    ...settings,
    connectionSettings: {
      ...settings.connectionSettings,
      driver: 'INDI'
    }
  });
}

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <LanguageProvider>
      <App />
    </LanguageProvider>
  );
}
