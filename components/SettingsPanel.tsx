import React, { memo, useState } from 'react';
import { useTranslation } from '../contexts/LanguageContext';
import { PlanetariumSettings, SampStatus, SampSettings, SavedSampSettings } from '../types';
import { ToggleSwitch, RangeSlider, ConnectionStatusIndicator } from './CommonUI';
import { PlusIcon } from './icons/PlusIcon';
import { TrashIcon } from './icons/TrashIcon';
import { CloseIcon } from './icons/CloseIcon';
import { SaveIcon } from './icons/SaveIcon';
import { Button } from './Button';

interface SettingsPanelProps {
    planetariumSettings: PlanetariumSettings;
    onPlanetariumSettingsChange: (settings: Partial<PlanetariumSettings>) => void;
    sampStatus: SampStatus;
    sampSettings: SampSettings;
    onSampSettingsChange: (settings: Partial<SampSettings>) => void;
    onConnectSamp: () => void;
    onConnectVirtualSamp: () => void;
    onDisconnectSamp: () => void;
    savedSampSettings: SavedSampSettings[];
    onSaveSampSettings: (name: string, settings: SampSettings) => void;
    onUpdateSavedSampSettings?: (index: number, settings: SampSettings) => void;
    onDeleteSampSettings: (index: number) => void;
}

export const SettingsPanel = memo((props: SettingsPanelProps) => {
    const { t } = useTranslation();
    const { 
        planetariumSettings, onPlanetariumSettingsChange, 
        sampStatus, sampSettings, onSampSettingsChange, 
        onConnectSamp, onConnectVirtualSamp, onDisconnectSamp, 
        savedSampSettings, onSaveSampSettings, onUpdateSavedSampSettings, onDeleteSampSettings 
    } = props;
    
    const [isNamingSamp, setIsNamingSamp] = useState(false);
    const [newSampName, setNewSampName] = useState('');
    const [selectedSampIndex, setSelectedSampIndex] = useState<string>("");

    const handleDownloadManifest = async () => {
        try {
            const response = await fetch('/app-definition.json');
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'app-definition.json';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (e) {
            console.error("Failed to download manifest", e);
        }
    };

    return (
      <div className="space-y-4">
          <h2 className="text-lg font-semibold text-red-400 border-b border-red-900/50 pb-2">{t('controlPanel.planetariumSettings')}</h2>
          <div className="p-3 bg-slate-800/50 rounded-lg space-y-2 border border-slate-700">
            <ToggleSwitch id="const-lines" label={t('controlPanel.constellationLines')} title={t('tooltips.constellationLines')} checked={planetariumSettings.showConstellationLines} onChange={(v) => onPlanetariumSettingsChange({ showConstellationLines: v })} />
            <ToggleSwitch id="star-labels" label={t('controlPanel.starLabels')} title={t('tooltips.starLabels')} checked={planetariumSettings.showStarLabels} onChange={(v) => onPlanetariumSettingsChange({ showStarLabels: v })} />
            <ToggleSwitch id="dso-labels" label={t('controlPanel.dsoLabels')} title={t('tooltips.dsoLabels')} checked={planetariumSettings.showDSOLabels} onChange={(v) => onPlanetariumSettingsChange({ showDSOLabels: v })} />
            <ToggleSwitch id="const-labels" label={t('controlPanel.constellationLabels')} title={t('tooltips.constellationLines')} checked={planetariumSettings.showConstellationLabels} onChange={(v) => onPlanetariumSettingsChange({ showConstellationLabels: v })} />
            <ToggleSwitch id="az-alt-grid" label={t('controlPanel.azAltGrid')} title={t('tooltips.grids')} checked={planetariumSettings.showAzAltGrid} onChange={(v) => onPlanetariumSettingsChange({ showAzAltGrid: v })} />
            <ToggleSwitch id="ra-dec-grid" label={t('controlPanel.raDecGrid')} title={t('tooltips.grids')} checked={planetariumSettings.showRaDecGrid} onChange={(v) => onPlanetariumSettingsChange({ showRaDecGrid: v })} />
            <ToggleSwitch id="horizon" label={t('controlPanel.showHorizon')} title={t('tooltips.horizon')} checked={planetariumSettings.showHorizon} onChange={(v) => onPlanetariumSettingsChange({ showHorizon: v })} />
            <ToggleSwitch id="milky-way" label={t('controlPanel.showMilkyWay')} title={t('tooltips.milkyWay')} checked={planetariumSettings.showMilkyWay} onChange={(v) => onPlanetariumSettingsChange({ showMilkyWay: v })} />
            <ToggleSwitch id="dss" label={t('controlPanel.showDSS')} title={t('tooltips.dssBackground')} checked={planetariumSettings.showDSS} onChange={(v) => onPlanetariumSettingsChange({ showDSS: v })} />
          </div>

          <div className="space-y-3 p-3 bg-slate-800/50 rounded-lg border border-slate-700">
             <h3 className="text-sm font-semibold text-slate-300">{t('controlPanel.visibilityLimits')}</h3>
             <RangeSlider id="star-mag" label={t('controlPanel.starMagLimit')} title={t('tooltips.visibilityLimits')} value={planetariumSettings.starMagLimit} min={2} max={10} step={0.5} onChange={(v) => onPlanetariumSettingsChange({ starMagLimit: v })} />
             <RangeSlider id="dso-mag" label={t('controlPanel.dsoMagLimit')} title={t('tooltips.visibilityLimits')} value={planetariumSettings.dsoMagLimit} min={2} max={15} step={0.5} onChange={(v) => onPlanetariumSettingsChange({ dsoMagLimit: v })} />
             <RangeSlider id="star-scale" label={t('controlPanel.starSize')} title={t('tooltips.starSize')} value={planetariumSettings.starScale || 1.0} min={0.1} max={3.0} step={0.1} onChange={(v) => onPlanetariumSettingsChange({ starScale: v })} />
             <RangeSlider id="mw-opacity" label={t('controlPanel.milkyWayBrightness')} title={t('tooltips.milkyWay')} value={planetariumSettings.milkyWayOpacity} min={0} max={1} step={0.1} onChange={(v) => onPlanetariumSettingsChange({ milkyWayOpacity: v })} />
          </div>

          <div className="space-y-2 p-3 bg-slate-800/50 rounded-lg border border-slate-700">
             <h3 className="text-sm font-semibold text-slate-300">{t('controlPanel.dsoTypes')}</h3>
             <ToggleSwitch id="show-galaxies" label={t('controlPanel.showGalaxies')} checked={planetariumSettings.showGalaxies} onChange={(v) => onPlanetariumSettingsChange({ showGalaxies: v })} />
             <ToggleSwitch id="show-nebulae" label={t('controlPanel.showNebulae')} checked={planetariumSettings.showNebulae} onChange={(v) => onPlanetariumSettingsChange({ showNebulae: v })} />
             <ToggleSwitch id="show-clusters" label={t('controlPanel.showClusters')} checked={planetariumSettings.showClusters} onChange={(v) => onPlanetariumSettingsChange({ showClusters: v })} />
          </div>
          
          <div className="space-y-2 p-3 bg-slate-800/50 rounded-lg border border-slate-700">
            <h3 className="text-sm font-semibold text-slate-300 border-b border-slate-700 pb-1">{t('controlPanel.integrations')}</h3>
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
                                {savedSampSettings && savedSampSettings.map((prof: SavedSampSettings, i: number) => (<option key={`${prof.name}-${i}`} value={String(i)}>{prof.name}</option>))}
                            </select>
                            {selectedSampIndex !== "" && onUpdateSavedSampSettings && (
                                <button onClick={() => onUpdateSavedSampSettings(Number(selectedSampIndex), {...sampSettings})} className="bg-blue-800 hover:bg-blue-700 text-white p-1 rounded border border-blue-700" title={t('controlPanel.connectionProfiles.overwrite')} type="button"><SaveIcon className="w-4 h-4" /></button>
                            )}
                            <button onClick={() => { setNewSampName(''); setIsNamingSamp(true); }} className="bg-slate-700 hover:bg-slate-600 text-white p-1 rounded border border-slate-600" title={t('controlPanel.connectionProfiles.saveCurrent')} type="button"><PlusIcon className="w-4 h-4" /></button>
                            {selectedSampIndex !== "" && (<button onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDeleteSampSettings(Number(selectedSampIndex)); setSelectedSampIndex(""); }} className="bg-red-900/50 hover:bg-red-800 text-white p-1 rounded border border-red-800" title={t('controlPanel.deleteSelected')} type="button"><TrashIcon className="w-4 h-4" /></button>)}
                        </div>
                    )}

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
            )}

            <div className="flex gap-2">
                <Button onClick={onConnectSamp} disabled={sampStatus === 'Connecting'} variant="secondary" className="flex-1 text-xs" type="button" title={t('tooltips.samp')}>
                    {sampStatus === 'Connecting' ? t('samp.status.connecting') : t('controlPanel.connectSampHub')}
                </Button>
                <Button onClick={onConnectVirtualSamp} disabled={sampStatus === 'Connected' || sampStatus === 'Connecting'} variant="secondary" className="flex-1 text-xs" type="button" title="Simulate a SAMP hub for testing.">
                    {t('controlPanel.connectVirtualSamp')}
                </Button>
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

             <div className="pt-4 mt-4 border-t border-slate-700">
                <h3 className="text-sm font-semibold text-slate-300 mb-2">{t('controlPanel.systemAsset')}</h3>
                <Button onClick={handleDownloadManifest} variant="secondary" className="w-full text-xs font-bold gap-2" title={t('tooltips.manifest')}>
                    <SaveIcon className="w-4 h-4" /> {t('controlPanel.saveManifest')}
                </Button>
                <p className="text-[10px] text-slate-500 mt-1 leading-tight">{t('controlPanel.saveManifestHint')}</p>
             </div>
          </div>
      </div>
    );
});
