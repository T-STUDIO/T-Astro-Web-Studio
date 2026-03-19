
import React, { useState, useEffect } from 'react';
import { useTranslation } from '../contexts/LanguageContext';
import { Button } from './Button';
import { CloseIcon } from './icons/CloseIcon';
import * as AstroService from '../services/AstroService';
import { DriverType } from '../types';

interface DiagnosticsModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentSettings: { host: string; port: number; driver: DriverType };
}

export const DiagnosticsModal: React.FC<DiagnosticsModalProps> = ({ isOpen, onClose, currentSettings }) => {
    const { t } = useTranslation();
    const [logs, setLogs] = useState<string[]>([]);
    const [results, setResults] = useState<string[]>([]);
    const [isChecking, setIsChecking] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setLogs(AstroService.getDebugLogs());
            setResults([]);
        }
    }, [isOpen]);

    const handleRunDiagnostics = async () => {
        setIsChecking(true);
        setResults([t('diagnostics.running')]);
        try {
            const diagResults = await AstroService.diagnoseConnection(currentSettings.host, currentSettings.port, currentSettings.driver);
            setResults(diagResults);
        } catch (e) {
            setResults([t('diagnostics.error') + String(e)]);
        } finally {
            setIsChecking(false);
            setLogs(AstroService.getDebugLogs()); // Refresh logs as diagnosis might add some
        }
    };

    const handleRefreshLogs = () => {
        setLogs(AstroService.getDebugLogs());
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex justify-center items-center z-50 p-4" onClick={onClose}>
            <div className="bg-slate-900 border border-red-900/50 rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <header className="flex justify-between items-center p-4 border-b border-red-900/30 bg-slate-800/80 rounded-t-lg">
                    <h3 className="font-bold text-slate-100 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse"></span>
                        {t('diagnostics.title')}
                    </h3>
                    <button onClick={onClose}><CloseIcon className="w-5 h-5 text-slate-400 hover:text-white" /></button>
                </header>
                
                <div className="p-4 overflow-y-auto space-y-4 flex-1">
                    {/* Network Check Section */}
                    <div className="bg-slate-800/50 p-4 rounded border border-slate-700">
                        <h4 className="text-sm font-bold text-slate-200 mb-2">{t('diagnostics.networkCheck')}</h4>
                        <p className="text-xs text-slate-400 mb-4">
                            {t('diagnostics.target')}: <span className="font-mono text-slate-200">{currentSettings.host}:{currentSettings.port}</span> ({currentSettings.driver})
                        </p>
                        
                        <div className="bg-black/50 p-2 rounded mb-3 min-h-[60px] max-h-[150px] overflow-y-auto font-mono text-xs border border-slate-700/50">
                             {results.length === 0 ? (
                                 <span className="text-slate-500 italic">{t('diagnostics.ready')}</span>
                             ) : (
                                 results.map((line, i) => (
                                     <div key={i} className={`mb-1 ${line.includes('❌') ? 'text-red-400' : line.includes('✅') ? 'text-green-400' : 'text-slate-300'}`}>
                                         {line}
                                     </div>
                                 ))
                             )}
                        </div>

                        <Button onClick={handleRunDiagnostics} disabled={isChecking} variant="secondary" className="w-full text-xs">
                             {isChecking ? t('diagnostics.checking') : t('diagnostics.run')}
                        </Button>
                    </div>

                    {/* Logs Section */}
                    <div className="flex flex-col h-64">
                         <div className="flex justify-between items-center mb-2">
                            <h4 className="text-sm font-bold text-slate-200">{t('diagnostics.logs')}</h4>
                            <button onClick={handleRefreshLogs} className="text-xs text-red-400 hover:text-red-300 underline">{t('diagnostics.refresh')}</button>
                         </div>
                         <div className="flex-1 bg-black p-3 rounded border border-slate-700 font-mono text-[10px] md:text-xs text-slate-400 overflow-y-auto whitespace-pre-wrap leading-tight select-text cursor-text">
                            {logs.length > 0 ? logs.join('\n') : <span className="italic opacity-50">No logs yet...</span>}
                         </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
