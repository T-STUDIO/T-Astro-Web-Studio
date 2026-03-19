import React, { useState } from 'react';
import { SampStatus, SampSettings, SavedSampSettings } from '../types';
import { Button } from './Button';
import { PlusIcon } from './icons/PlusIcon';
import { TrashIcon } from './icons/TrashIcon';
import { CloseIcon } from './icons/CloseIcon';
import { SaveIcon } from './icons/SaveIcon';
import { useTranslation } from '../contexts/LanguageContext';

const ConnectionStatusIndicator: React.FC<{ status: SampStatus, labels: Record<string, string> }> = ({ status, labels }) => {
  const color = {
    Disconnected: 'bg-slate-500',
    Connecting: 'bg-yellow-500 animate-pulse',
    Connected: 'bg-green-500', 
    Error: 'bg-red-500',
  }[status] || 'bg-slate-500';

  return (
    <div className="flex items-center gap-2">
      <span className={`w-3 h-3 rounded-full ${color}`}></span>
      <span className="text-sm font-medium">{labels[status] || status}</span>
    </div>
  );
};

interface SampSettingsSectionProps {
    sampStatus: SampStatus;
    sampSettings: SampSettings;
    onSampSettingsChange: (settings: Partial<SampSettings>) => void;
    onConnectSamp: (settings: SampSettings) => void;
    onConnectVirtualSamp?: (settings: SampSettings) => void;
    onDisconnectSamp: () => void;
    savedSampSettings: SavedSampSettings[];
    onSaveSampSettings: (name: string, settings: SampSettings) => void;
    onUpdateSavedSampSettings?: (index: number, settings: SampSettings) => void;
    onDeleteSampSettings: (index: number) => void;
    showTitle?: boolean;
    compact?: boolean;
}

export const SampSettingsSection: React.FC<SampSettingsSectionProps> = ({
    sampStatus,
    sampSettings,
    onSampSettingsChange,
    onConnectSamp,
    onConnectVirtualSamp,
    onDisconnectSamp,
    savedSampSettings,
    onSaveSampSettings,
    onUpdateSavedSampSettings,
    onDeleteSampSettings,
    showTitle = true,
    compact = false
}) => {
    const { t } = useTranslation();
    const [isNamingSamp, setIsNamingSamp] = useState(false);
    const [newSampName, setNewSampName] = useState('');
    const [selectedSampIndex, setSelectedSampIndex] = useState<string>("");

    return (
        <div className={`space-y-2 ${!compact ? 'p-3 bg-slate-800/50 rounded-lg border border-slate-700' : ''}`}>
            {showTitle && <h3 className="text-sm font-semibold text-slate-300 border-b border-slate-700 pb-1">{t('controlPanel.integrations')}</h3>}
            <p className="text-[10px] text-slate-500 mb-2 leading-tight">{t('tooltips.samp')}</p>
            
            {sampStatus !== 'Connected' && (
                <div className="space-y-2 mb-2">
                    {isNamingSamp ? (
                        <div className="flex gap-2 mb-2 items-center">
                            <input type="text" value={newSampName} onChange={(e) => setNewSampName(e.target.value)} placeholder={t('controlPanel.connectionProfiles.enterName')} className="flex-1 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-slate-200 outline-none focus:border-red-500 select-text" autoFocus />
                            <button onClick={() => { if(newSampName.trim()) { onSaveSampSettings(newSampName.trim(), { ...sampSettings }); setSelectedSampIndex(String(savedSampSettings.length)); setIsNamingSamp(false); } }} className="bg-green-700 hover:bg-green-600 text-white p-1 rounded border border-green-600" title={t('common.ok')} type="button"><span className="text-xs font-bold px-1">{t('common.ok')}</span></button>
                            <button onClick={() => { setIsNamingSamp(false); }} className="bg-slate-700 hover:bg-slate-600 text-white p-1 rounded border border-slate-600" title={t('common.cancel')} type="button"><CloseIcon className="w-4 h-4" /></button>
                        </div>
                    ) : (
                        <div className="flex gap-2 mb-2 items-center">
                            <select className="flex-1 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-slate-200 outline-none focus:border-red-500" value={selectedSampIndex} onChange={(e) => {
                                const idxStr = e.target.value;
                                setSelectedSampIndex(idxStr);
                                const idx = parseInt(idxStr);
                                if (!isNaN(idx) && savedSampSettings[idx]) onSampSettingsChange(savedSampSettings[idx].settings);
                            }}>
                                <option value="" disabled>{t('controlPanel.connectionProfiles.select')}</option>
                                {savedSampSettings && savedSampSettings.map((prof, i) => (<option key={`${prof.name}-${i}`} value={String(i)}>{prof.name}</option>))}
                            </select>
                            {selectedSampIndex !== "" && onUpdateSavedSampSettings && (
                                <button onClick={() => onUpdateSavedSampSettings(Number(selectedSampIndex), {...sampSettings})} className="bg-blue-800 hover:bg-blue-700 text-white p-1 rounded border border-blue-700" title={t('controlPanel.connectionProfiles.overwrite')} type="button"><SaveIcon className="w-4 h-4" /></button>
                            )}
                            <button onClick={() => { setNewSampName(''); setIsNamingSamp(true); }} className="bg-slate-700 hover:bg-slate-600 text-white p-1 rounded border border-slate-600" title={t('controlPanel.connectionProfiles.saveCurrent')} type="button"><PlusIcon className="w-4 h-4" /></button>
                            {selectedSampIndex !== "" && (<button onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDeleteSampSettings(Number(selectedSampIndex)); setSelectedSampIndex(""); }} className="bg-red-900/50 hover:bg-red-800 text-white p-1 rounded border border-red-800" title={t('controlPanel.deleteSelected')} type="button"><TrashIcon className="w-4 h-4" /></button>)}
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="block text-[10px] text-slate-400 mb-1">{t('controlPanel.host')}</label>
                            <input type="text" value={sampSettings?.host || 'localhost'} onChange={(e) => { setSelectedSampIndex(""); onSampSettingsChange({ host: e.target.value }); }} className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-slate-200" placeholder="localhost" autoComplete="off" title={t('tooltips.host')} />
                        </div>
                        <div>
                            <label className="block text-[10px] text-slate-400 mb-1">{t('controlPanel.port')} (WebSockify)</label>
                            <input 
                                type="number" 
                                value={sampSettings?.port} 
                                onChange={(e) => { setSelectedSampIndex(""); onSampSettingsChange({ port: Number(e.target.value) }); }} 
                                className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-slate-200" 
                                placeholder="8080" 
                                autoComplete="off"
                                title={t('tooltips.port')}
                            />
                        </div>
                    </div>
                </div>
            )}

            <div className="flex gap-2">
                <Button onClick={() => onConnectSamp(sampSettings)} disabled={sampStatus === 'Connecting'} variant="secondary" className="flex-1 text-xs" type="button" title={t('tooltips.samp')}>
                    {sampStatus === 'Connecting' ? t('samp.status.connecting') : t('controlPanel.connectSampHub')}
                </Button>
                {onConnectVirtualSamp && (
                    <Button onClick={() => onConnectVirtualSamp(sampSettings)} disabled={sampStatus === 'Connected' || sampStatus === 'Connecting'} variant="secondary" className="flex-1 text-xs" type="button" title="Simulate a SAMP hub for testing.">
                        {t('controlPanel.connectVirtualSamp')}
                    </Button>
                )}
            </div>
             <div className="bg-slate-900 p-2 rounded flex justify-between items-center text-xs mt-2 border border-slate-700">
                 <span className="text-slate-400">{t('controlPanel.sampStatus')}</span>
                 <ConnectionStatusIndicator status={sampStatus} labels={{
                     Disconnected: t('samp.status.disconnected'),
                     Connecting: t('samp.status.connecting'),
                     Connected: t('samp.status.connected'),
                     Error: t('samp.status.error')
                 }} />
             </div>
             {sampStatus === 'Connected' && (
                 <Button onClick={onDisconnectSamp} variant="danger" className="w-full text-xs mt-2" type="button">{t('controlPanel.disconnectSamp')}</Button>
             )}
        </div>
    );
};
