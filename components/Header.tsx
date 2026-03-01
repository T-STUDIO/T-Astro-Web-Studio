
import React from 'react';
import { TelescopeIcon } from './icons/TelescopeIcon';
import { useTranslation } from '../contexts/LanguageContext';
import { LanguageSwitcher } from './LanguageSwitcher';

interface HeaderProps {
  onToggleTSConect?: () => void;
  isTSConectActive?: boolean;
}

export const Header: React.FC<HeaderProps> = ({ onToggleTSConect, isTSConectActive }) => {
  const { t } = useTranslation();
  return (
    <header className="bg-slate-900/90 border-b border-red-900/50 p-3 flex items-center justify-between z-[60] shadow-lg shadow-red-900/10">
      <div className="flex items-center gap-3">
        <TelescopeIcon className="w-8 h-8 text-red-500" />
        <h1 className="text-xl font-bold text-slate-100 tracking-wider font-mono">{t('header.title')}</h1>
      </div>
      <div className="flex items-center gap-4">
        {onToggleTSConect && (
            <button 
                onClick={onToggleTSConect}
                className={`px-4 py-1.5 rounded-md text-xs font-black tracking-tighter transition-all ${
                    isTSConectActive 
                    ? 'bg-red-600 text-white shadow-[0_0_15px_rgba(220,38,38,0.4)]' 
                    : 'bg-slate-800 text-red-500 border border-red-900/30 hover:bg-red-900/20'
                }`}
            >
                TS-CONECT
            </button>
        )}
        <LanguageSwitcher />
      </div>
    </header>
  );
};
