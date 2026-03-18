
import React from 'react';
import { TelescopeIcon } from './icons/TelescopeIcon';
import { HelpIcon } from './icons/HelpIcon';
import { useTranslation } from '../contexts/LanguageContext';
import { LanguageSwitcher } from './LanguageSwitcher';
import { Tooltip } from './Tooltip';
import { HelpModal } from './HelpModal';

interface HeaderProps {
  currentDriver: 'INDI' | 'Alpaca' | 'Simulator';
  onToggleTSConect?: () => void;
  isTSConectActive?: boolean;
  className?: string;
}

export const Header: React.FC<HeaderProps> = ({ currentDriver, onToggleTSConect, isTSConectActive, className }) => {
  const [showHelp, setShowHelp] = React.useState(false);
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
        <Tooltip title={t('common.help') || 'Help'} position="bottom">
          <button 
            onClick={() => setShowHelp(true)}
            className="p-2 text-slate-400 hover:text-red-400 transition-colors"
          >
            <HelpIcon className="w-6 h-6" />
          </button>
        </Tooltip>
        {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
        {currentDriver === 'INDI' && onToggleTSConect && (
            <button 
                onClick={onToggleTSConect}
                className={`px-3 py-2 rounded-md text-sm font-bold tracking-tight transition-all whitespace-nowrap ${
                    isTSConectActive 
                    ? 'bg-red-600 text-white shadow-[0_0_15px_rgba(220,38,38,0.4)]' 
                    : 'bg-slate-800 text-red-500 border border-red-900/30 hover:bg-red-900/20'
                }`}
            >
                TS-CONNECT
            </button>
        )}
        <LanguageSwitcher />
      </div>
    </header>
  );
};
