
import React from 'react';
import { TelescopeIcon } from './icons/TelescopeIcon';
import { useTranslation } from '../contexts/LanguageContext';
import { LanguageSwitcher } from './LanguageSwitcher';

interface HeaderProps {
  currentDriver: 'INDI' | 'Alpaca' | 'Simulator';
  onToggleHelp?: () => void;
  className?: string;
}

export const HeaderSimulator: React.FC<HeaderProps> = ({ currentDriver, onToggleHelp, className }) => {
  const { t } = useTranslation();
  
  return (
    <header className={`bg-slate-900/90 border-b border-red-900/50 p-3 flex items-center justify-between z-[60] shadow-lg shadow-red-900/10 ${className || ''}`}>
      <div className="flex items-center gap-3">
        <TelescopeIcon className="w-8 h-8 text-red-500" />
        <div className="flex flex-col">
          <h1 className="text-xl font-bold text-slate-100 tracking-wider font-mono leading-none">{t('header.title')}</h1>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {onToggleHelp && (
          <button
            onClick={onToggleHelp}
            title={t('tooltips.help') || 'Open Online Help Guide'}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700 hover:text-white transition-all"
          >
            <span className="text-lg font-bold">?</span>
          </button>
        )}
        <LanguageSwitcher />
      </div>
    </header>
  );
};
