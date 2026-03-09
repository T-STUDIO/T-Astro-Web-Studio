
import React from 'react';
import { TelescopeIcon } from './icons/TelescopeIcon';
import { useTranslation } from '../contexts/LanguageContext';
import { LanguageSwitcher } from './LanguageSwitcher';

interface HeaderProps {
  currentDriver: 'INDI' | 'Alpaca' | 'Simulator';
  className?: string;
}

export const HeaderAlpaca: React.FC<HeaderProps> = ({ currentDriver, className }) => {
  const { t } = useTranslation();
  
  return (
    <header className={`bg-slate-900/90 border-b border-red-900/50 p-3 flex items-center justify-between z-[60] shadow-lg shadow-red-900/10 ${className || ''}`}>
      <div className="flex items-center gap-3">
        <TelescopeIcon className="w-8 h-8 text-red-500" />
        <div className="flex flex-col">
          <h1 className="text-xl font-bold text-slate-100 tracking-wider font-mono leading-none">{t('header.title')}</h1>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <LanguageSwitcher />
      </div>
    </header>
  );
};
