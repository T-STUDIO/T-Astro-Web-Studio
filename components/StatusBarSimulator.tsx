import React, { useState } from 'react';
import { LogEntry } from '../types';
import { ChevronUpIcon } from './icons/ChevronUpIcon';
import { ChevronDownIcon } from './icons/ChevronDownIcon';
import { useTranslation } from '../contexts/LanguageContext';

interface StatusBarProps {
  logs: LogEntry[];
}

export const StatusBarSimulator: React.FC<StatusBarProps> = ({ logs }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const { t } = useTranslation();

  const getLogColor = (type: LogEntry['type']) => {
    switch (type) {
      case 'success': return 'text-green-400';
      case 'error': return 'text-red-400';
      case 'warning': return 'text-yellow-400';
      default: return 'text-slate-400';
    }
  };

  const safeLogs = Array.isArray(logs) ? logs : [];
  const latestLog = safeLogs.length > 0 ? safeLogs[0] : { message: t('statusBar.systemStandby'), type: 'info' as const };

  return (
    <footer className={`bg-slate-800 border-t border-slate-700 transition-all duration-300 ${isExpanded ? 'h-48' : 'h-7 md:h-10'}`}>
      <div className="h-full flex flex-col">
        <div
          className="flex items-center justify-between px-4 h-full cursor-pointer hover:bg-slate-700/50 flex-shrink-0"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center gap-2 text-[10px] md:text-sm font-mono truncate">
            <span className={getLogColor(latestLog.type)}>&gt;</span>
            <span className="text-slate-300">{latestLog.message}</span>
          </div>
          <button className="text-slate-400 hover:text-white">
            {isExpanded ? <ChevronDownIcon className="w-4 h-4 md:w-5 md:h-5" /> : <ChevronUpIcon className="w-4 h-4 md:w-5 md:h-5" />}
          </button>
        </div>

        {isExpanded && (
          <div className="flex-1 overflow-y-auto p-2 md:p-4 bg-slate-900/50 select-text cursor-text">
            <ul className="space-y-1 font-mono text-[10px] md:text-sm">
              {safeLogs.map((log, index) => (
                <li key={index} className="flex gap-4">
                  <span className="text-slate-500">{log.timestamp}</span>
                  <span className={getLogColor(log.type)}>{log.message}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </footer>
  );
};
