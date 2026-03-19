
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

console.log('[main_alpaca] Script starting...');

const rootElement = document.getElementById('root');
console.log('[main_alpaca] Root element:', rootElement);

if (rootElement) {
  console.log('[main_alpaca] Rendering AppAlpaca...');
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <LanguageProvider>
      <AppAlpaca />
    </LanguageProvider>
  );
  console.log('[main_alpaca] Render call completed.');
} else {
  console.error('[main_alpaca] Root element not found!');
}
