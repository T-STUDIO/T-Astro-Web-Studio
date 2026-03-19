
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { LanguageProvider } from './contexts/LanguageContext';
import * as SettingsService from './services/SettingsService';

// Ensure settings are set to INDI when loading this page
const settings = SettingsService.loadSettings();

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
