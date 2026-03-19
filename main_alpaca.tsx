
import React from 'react';
import ReactDOM from 'react-dom/client';
import AppAlpaca from './AppAlpaca';
import { LanguageProvider } from './contexts/LanguageContext';
import * as SettingsService from './services/SettingsService';

// Ensure settings are set to Alpaca when loading this page
const settings = SettingsService.loadSettings();
if (settings.connectionSettings.driver !== 'Alpaca') {
  SettingsService.saveSettings({
    ...settings,
    connectionSettings: {
      ...settings.connectionSettings,
      driver: 'Alpaca'
    }
  });
}

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <LanguageProvider>
      <AppAlpaca />
    </LanguageProvider>
  );
}
