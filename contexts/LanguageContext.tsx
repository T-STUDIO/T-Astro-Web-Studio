
import React, { createContext, useState, useContext, ReactNode, useCallback } from 'react';
import { en } from '../i18n/locales/en';
import { ja } from '../i18n/locales/ja';
import { Language } from '../types';

// Type definition for a deeply nested object like our translation files.
type Translations = typeof en;

const translations = { en, ja };

interface LanguageContextType {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: string, substitutions?: { [key: string]: string | number }) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

// Helper function to safely access nested properties.
const getNestedTranslation = (trans: Translations, key: string): string | object | undefined => {
  return key.split('.').reduce((obj: any, k: string) => obj && obj[k], trans);
};

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>('ja'); // Default to Japanese

  const t = useCallback((key: string, substitutions?: { [key: string]: string | number }): string => {
    let text = getNestedTranslation(translations[language], key);
    
    if (typeof text !== 'string') {
      console.warn(`Translation key '${key}' not found or not a string for language '${language}'.`);
      // Fallback to English if key not found in current language
      text = getNestedTranslation(translations.en, key);
      if (typeof text !== 'string') {
        return key; // Return the key itself if not found anywhere
      }
    }

    if (substitutions) {
      Object.entries(substitutions).forEach(([subKey, value]) => {
        text = (text as string).replace(new RegExp(`{{${subKey}}}`, 'g'), String(value));
      });
    }

    return text;
  }, [language]);

  const value = { language, setLanguage, t };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useTranslation = () => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useTranslation must be used within a LanguageProvider');
  }
  return context;
};
