
import React from 'react';
import { useTranslation } from '../contexts/LanguageContext';
import { Language } from '../types';

export const LanguageSwitcher: React.FC = () => {
  const { language, setLanguage, t } = useTranslation();

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setLanguage(e.target.value as Language);
  };

  return (
    <div className="relative">
      <select 
        value={language} 
        onChange={handleLanguageChange}
        className="bg-slate-800 border border-slate-600 rounded-md py-1.5 pl-2 pr-8 text-sm appearance-none focus:ring-2 focus:ring-red-500 focus:outline-none text-slate-300"
        aria-label="Language selector"
      >
        <option value="en">{t('lang.en')}</option>
        <option value="ja">{t('lang.ja')}</option>
      </select>
      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-400">
        <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
          <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
        </svg>
      </div>
    </div>
  );
};
