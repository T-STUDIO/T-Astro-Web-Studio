
import React from 'react';
import ReactDOM from 'react-dom/client';
import AppSimulator from './AppSimulator';
import { LanguageProvider } from './contexts/LanguageContext';
import * as SettingsService from './services/SettingsService';

// Ensure settings are set to Simulator when loading this page
const settings = SettingsService.loadSettings();
if (settings.connectionSettings.driver !== 'Simulator') {
  SettingsService.saveSettings({
    ...settings,
    connectionSettings: {
      ...settings.connectionSettings,
      driver: 'Simulator'
    }
  });
}

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <LanguageProvider>
      <AppSimulator />
    </LanguageProvider>
  );
}
