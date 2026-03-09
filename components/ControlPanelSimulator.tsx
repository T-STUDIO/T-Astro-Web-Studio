import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { ConnectionStatus, SlewStatus, CelestialObject, ConnectionSettings, DriverType, PlanetariumSettings, LocationStatus, LocationData, SampStatus, DeviceType, TabType, SavedLocation, SavedConnection, SavedApiKey, SampSettings, SavedSampSettings, PlateSolverType, LocalSolverSettings, SavedLocalSolver } from '../types';
import { Button } from './Button';
import { ConnectIcon } from './icons/ConnectIcon';
import { DisconnectIcon } from './icons/DisconnectIcon';
import { CameraIcon } from './icons/CameraIcon';
import { StopIcon } from './icons/StopIcon';
import { GpsIcon } from './icons/GpsIcon';
import { PlusIcon } from './icons/PlusIcon';
import { TrashIcon } from './icons/TrashIcon';
import { CloseIcon } from './icons/CloseIcon';
import { SaveIcon } from './icons/SaveIcon'; 
import { ListIcon } from './icons/ListIcon'; 
import { GoogleDriveIcon } from './icons/GoogleDriveIcon'; 
import { VideoIcon } from './icons/VideoIcon';
import { useTranslation } from '../contexts/LanguageContext';
import { FocuserControlSimulator } from './FocuserControlSimulator';
import { MountControllerSimulator } from './MountControllerSimulator';
import * as AstroService from '../services/AstroServiceSimulator';
import * as GoogleDriveService from '../services/GoogleDriveService';
import * as SettingsService from '../services/SettingsService';
import { decimalToSexagesimal, sexagesimalToDecimal } from '../utils/coords';

const ConnectionStatusIndicator: React.FC<{ status: ConnectionStatus | SampStatus, labels: Record<string, string> }> = ({ status, labels }) => {
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

const ToggleSwitch = memo(({ id, checked, onChange, label, title }: { id: string, checked: boolean, onChange: (checked: boolean) => void, label: string, title?: string}) => (
    <label htmlFor={id} className="flex items-center justify-between cursor-pointer w-full p-2 hover:bg-slate-800 rounded-md transition-colors" title={title}>
      <span className="text-sm font-medium text-slate-300">{label}</span>
      <div className="relative">
        <input
          id={id}
          type="checkbox"
          className="sr-only peer"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <div className="w-11 h-6 bg-slate-700 rounded-full peer peer-focus:ring-2 peer-focus:ring-red-500 peer-focus:ring-offset-2 peer-focus:ring-offset-slate-900 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-700"></div>
      </div>
    </label>
));

const RangeSlider = memo(({ id, label, value, min, max, step, onChange, unit, disabled, colorClass = 'bg-slate-700', onAfterChange, title }: { id: string; label: string; value: number; min: number; max: number; step: number; onChange: (value: number) => void; unit?: string; disabled?: boolean; colorClass?: string; onAfterChange?: (value: number) => void; title?: string }) => {
    return (
    <div className="space-y-1" title={title}>
        <label htmlFor={id} className="flex justify-between items-center text-sm font-medium text-slate-300">
            <span>{label}</span>
            <div className="flex items-center gap-1">
                <input 
                    type="number" 
                    value={value} 
                    onChange={(e) => {
                        const val = Math.max(min, Math.min(max, Number(e.target.value)));
                        onChange(val);
                    }}
                    onBlur={() => onAfterChange && onAfterChange(value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            onAfterChange && onAfterChange(value);
                            (e.target as HTMLInputElement).blur();
                        }
                    }}
                    className="w-16 bg-slate-900 border border-slate-600 rounded px-1 text-right text-xs font-mono text-red-400 focus:outline-none focus:border-red-500 select-text"
                />
                <span className="font-mono text-xs text-slate-500 w-4">{unit}</span>
            </div>
        </label>
        <input 
            type="range"
            id={id}
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
            onMouseUp={(e) => onAfterChange && onAfterChange(Number((e.currentTarget as HTMLInputElement).value))}
            onTouchEnd={(e) => onAfterChange && onAfterChange(Number((e.currentTarget as HTMLInputElement).value))}
            className={`w-full h-2 ${colorClass} rounded-lg appearance-none cursor-pointer range-thumb-red`}
            disabled={disabled}
        />
    </div>
    );
});

const SexagesimalInput: React.FC<{
    value: number;
    onChange: (val: number) => void;
    unit?: string;
    onAction?: () => void;
    title?: string;
}> = memo(({ value, onChange, unit, onAction, title }) => {
    const [text, setText] = useState('');
    
    useEffect(() => {
        setText(decimalToSexagesimal(value));
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setText(e.target.value);
    };

    const handleBlur = () => {
        const val = sexagesimalToDecimal(text);
        onChange(val); 
        setText(decimalToSexagesimal(val)); 
        if (onAction) onAction();
    };

    return (
        <div className="flex items-center gap-1 w-full" title={title}>
            <input 
                type="text"
                value={text}
                onChange={handleChange}
                onBlur={handleBlur}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                        (e.currentTarget as HTMLInputElement).blur();
                    }
                }}
                className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm font-mono text-slate-200 text-right focus:border-red-500 outline-none select-text"
                placeholder="dd:mm:ss.s"
            />
            {unit && <span className="text-xs text-slate-500 w-4">{unit}</span>}
        </div>
    );
});

const LogViewer: React.FC = memo(() => {
    const { t } = useTranslation();
    const [liveLogs, setLiveLogs] = useState<string[]>([]);
    const logContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setLiveLogs(AstroService.getDebugLogs());
        const cb = (entry: string) => {
            setLiveLogs(prev => [...prev, entry].slice(-50));
        };
         AstroService.setLogCallback(cb);
        return () => AstroService.setLogCallback(() => {});
    }, []);

    useEffect(() => {
        if (logContainerRef.current) {
            logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
        }
    }, [liveLogs]);

    return (
        <div className="space-y-1 pt-4 border-t border-slate-700 pb-20 lg:pb-0">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('diagnostics.logs')}</h3>
            <div 
                ref={logContainerRef}
                className="bg-black/50 p-2 rounded border border-slate-800 h-32 overflow-y-auto font-mono text-[10px] text-slate-400 whitespace-pre-wrap leading-tight select-text cursor-text"
            >
                {liveLogs.length === 0 ? (
                    <span className="italic opacity-50">{t('diagnostics.ready')}</span>
                ) : (
                    liveLogs.map((line, i) => (
                        <div key={i} className={`mb-0.5 ${line.includes('Error') ? 'text-red-400' : line.includes('TX') ? 'text-blue-400' : line.includes('RX') ? 'text-green-400' : 'text-slate-400'}`}>
                            {line}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
});

const toLocalISOString = (date: Date) => {
    const offset = date.getTimezoneOffset() * 60000;
    const localISO = new Date(date.getTime() - offset).toISOString().slice(0, 16);
    return localISO;
};

const SettingsPanel = memo((props: any) => {
    const { t } = useTranslation();
    const { planetariumSettings, onPlanetariumSettingsChange, sampStatus, sampSettings, onSampSettingsChange, onConnectSamp, onConnectVirtualSamp, onDisconnectSamp, savedSampSettings, onSaveSampSettings, onUpdateSavedSampSettings, onDeleteSampSettings } = props;
    
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

const ImagingPanel = memo((props: any) => {
    const { t } = useTranslation();
    const { 
        connectionStatus, isLiveViewActive, onToggleLiveView, exposure, gain, offset, binning, colorBalance,
        onSetExposure, onSetGain, onSetOffset, onSetBinning, onSetColorBalance, onPreview, isCapturing, onStartCapture, onStopCapture,
        simulatorDevices, isPreviewLoading, onToggleVideoStream, isVideoStreamActive, onOpenDeviceSettings
    } = props;

    const devices = (simulatorDevices || []) as any[];
    const activeCameraName = AstroService.getActiveCamera();
    const activeFocuserName = AstroService.getActiveFocuser();
    const activeMountName = devices.find(d => d.type === 'Mount')?.name;
    
    const activeCameraDevice = devices.find(d => d.name === activeCameraName);

    return (
    <div className="space-y-4">
        <div className="flex justify-between items-center border-b border-red-900/50 pb-2 mb-2">
            <h2 className="text-lg font-semibold text-red-400">{t('controlPanel.imagingControl')}</h2>
            <div className="flex gap-1">
                {activeCameraName && (
                    <button 
                        onClick={() => onOpenDeviceSettings('Camera', activeCameraName)}
                        className="text-[10px] px-2 py-1 bg-slate-800 hover:bg-red-900/40 text-slate-300 border border-slate-700 rounded transition-colors"
                    >
                        カメラ
                    </button>
                )}
                {activeFocuserName && (
                    <button 
                        onClick={() => onOpenDeviceSettings('Focuser', activeFocuserName)}
                        className="text-[10px] px-2 py-1 bg-slate-800 hover:bg-red-900/40 text-slate-300 border border-slate-700 rounded transition-colors"
                    >
                        フォーカサー
                    </button>
                )}
                {activeMountName && (
                    <button 
                        onClick={() => onOpenDeviceSettings('Mount', activeMountName)}
                        className="text-[10px] px-2 py-1 bg-slate-800 hover:bg-red-900/40 text-slate-300 border border-slate-700 rounded transition-colors"
                    >
                        マウント
                    </button>
                )}
            </div>
        </div>
        
        <div className="space-y-3 p-3 bg-slate-800/50 rounded-lg border border-slate-700">
             <RangeSlider id="exposure" label={t('controlPanel.exposureTime')} title={t('tooltips.exposure')} value={exposure} min={1} max={60000} step={100} onChange={onSetExposure} unit="ms" />
             <RangeSlider id="gain" label={t('controlPanel.gain')} title={t('tooltips.gain')} value={gain} min={0} max={500} step={1} onChange={onSetGain} onAfterChange={(val) => { const cam = AstroService.getActiveCamera(); if (cam && connectionStatus === 'Connected') AstroService.updateDeviceSetting(cam, 'CCD_GAIN', { 'GAIN': val }); }} />
             <RangeSlider id="offset" label={t('controlPanel.offset')} title={t('tooltips.offset')} value={offset} min={0} max={255} step={1} onChange={onSetOffset} onAfterChange={(val) => { const cam = AstroService.getActiveCamera(); if (cam && connectionStatus === 'Connected') AstroService.updateDeviceSetting(cam, 'CCD_OFFSET', { 'OFFSET': val }); }} />
        </div>
        
        <div className="space-y-3 p-3 bg-slate-800/50 rounded-lg border border-slate-700">
            <h3 className="text-sm font-semibold text-slate-300">{t('controlPanel.colorBalance')}</h3>
            <p className="text-[10px] text-slate-500 leading-tight">{t('tooltips.colorBalance')}</p>
             <RangeSlider id="cb-r" label={t('controlPanel.colorBalanceR')} value={colorBalance.r} min={0} max={255} step={1} onChange={(v) => onSetColorBalance({...colorBalance, r: v})} colorClass="bg-red-900/50" />
             <RangeSlider id="cb-g" label={t('controlPanel.colorBalanceG')} value={colorBalance.g} min={0} max={255} step={1} onChange={(v) => onSetColorBalance({...colorBalance, g: v})} colorClass="bg-green-900/50" />
             <RangeSlider id="cb-b" label={t('controlPanel.colorBalanceB')} value={colorBalance.b} min={0} max={255} step={1} onChange={(v) => onSetColorBalance({...colorBalance, b: v})} colorClass="bg-blue-900/50" />
        </div>

        <div className="space-y-3 p-3 bg-slate-800/50 rounded-lg border border-slate-700">
             <h3 className="text-sm font-semibold text-slate-300">シミュレーションカメラ設定</h3>
             <RangeSlider id="focal-length" label="焦点距離" value={props.simulatorSettings.focalLength} min={10} max={5000} step={10} onChange={(v) => props.onSimulatorSettingsChange({ focalLength: v })} unit="mm" />
             <RangeSlider id="pixel-width" label="ピクセル数 (横)" value={props.simulatorSettings.pixelWidth} min={640} max={8192} step={1} onChange={(v) => props.onSimulatorSettingsChange({ pixelWidth: v })} unit="px" />
             <RangeSlider id="pixel-height" label="ピクセル数 (縦)" value={props.simulatorSettings.pixelHeight} min={480} max={8192} step={1} onChange={(v) => props.onSimulatorSettingsChange({ pixelHeight: v })} unit="px" />
             <RangeSlider id="pixel-size" label="撮像素子サイズ" value={props.simulatorSettings.pixelSize} min={0.1} max={20} step={0.01} onChange={(v) => props.onSimulatorSettingsChange({ pixelSize: v })} unit="μm" />
        </div>

        <div className="w-full space-y-2 bg-slate-800/20 p-2 rounded-lg border border-slate-700/50">
            <h3 className="text-xs font-bold text-slate-500 uppercase">{t('controlPanel.staticCapture')}</h3>
            <div className="grid grid-cols-2 gap-2">
                <Button onClick={onPreview} disabled={isCapturing || isPreviewLoading || isVideoStreamActive} variant="secondary" className="w-full text-xs" type="button" title={t('tooltips.preview')}>
                    {isPreviewLoading ? <div className="w-4 h-4 border-2 border-t-transparent border-white rounded-full animate-spin"></div> : <CameraIcon className="w-5 h-5" />} 
                    {isPreviewLoading ? ` ${t('controlPanel.loading')}` : t('controlPanel.preview')}
                </Button>
                <Button onClick={onToggleLiveView} disabled={isVideoStreamActive} variant={isLiveViewActive ? "danger" : "secondary"} className="w-full text-xs" type="button" title={t('tooltips.liveView')}>
                    {isLiveViewActive ? <><StopIcon className="w-4 h-4" /> {t('controlPanel.stopLiveView')}</> : <><CameraIcon className="w-4 h-4" /> {t('controlPanel.liveView')}</>}
                </Button>
            </div>
            {!isCapturing ? (<Button onClick={onStartCapture} disabled={isVideoStreamActive} className="w-full" type="button" title={t('tooltips.liveStacking')}><CameraIcon className="w-5 h-5" /> {t('controlPanel.startLiveStacking')}</Button>) : (<Button onClick={onStopCapture} variant="danger" className="w-full" type="button" title="Stop the active live stacking session."><StopIcon className="w-5 h-5" /> {t('controlPanel.stopCapture')}</Button>)}
        </div>
        <FocuserControlSimulator 
            isConnected={connectionStatus === 'Connected'} 
            simulatorSettings={props.simulatorSettings}
            onSimulatorSettingsChange={props.onSimulatorSettingsChange}
        />
    </div>
    );
});

const EquipmentPanel = memo((props: any) => {
    const { t } = useTranslation();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isNamingLocation, setIsNamingLocation] = useState(false);
    const [newLocationName, setNewLocationName] = useState('');
    const [isNamingConnection, setIsNamingConnection] = useState(false);
    const [newConnectionName, setNewConnectionName] = useState('');
    const [isNamingApiKey, setIsNamingApiKey] = useState(false);
    const [newApiKeyName, setNewApiKeyName] = useState('');
    const [isNamingLocalSolver, setIsNamingLocalSolver] = useState(false);
    const [newLocalSolverName, setNewLocalSolverName] = useState('');
    
    const [selectedLocationIndex, setSelectedLocationIndex] = useState<string>("");
    const [selectedConnectionIndex, setSelectedConnectionIndex] = useState<string>("");
    const [selectedApiKeyIndex, setSelectedApiKeyIndex] = useState<string>("");
    const [selectedLocalSolverIndex, setSelectedLocalSolverIndex] = useState<string>("");

    const {
        onSaveToDisk, onLoadFromDisk, isDriveConnected, onExportSettings, onImportSettings, onConnectDrive,
        savedApiKeys, onSaveApiKey, onDeleteApiKey, astrometryApiKey, onSetAstrometryApiKey, 
        plateSolverType, onSetPlateSolverType, localSolverSettings, onSetLocalSolverSettings, savedLocalSolvers, onSaveLocalSolver, onDeleteLocalSolver,
        onToggleAutoCenter, isAutoCenterEnabled,
        savedLocations, onSaveLocation, onUpdateSavedLocation, onDeleteLocation, location, onUpdateLatitude, onUpdateLongitude, onUpdateElevation,
        localTime, onSetTime, isTimeRunning, onSetTimeNow, locationStatus, onUpdateLocation, onUpdateLocationIP,
        onSendLocationToMount, mountSyncStatus, onToggleAutoSyncLocation, isAutoSyncLocationEnabled,
        connectionStatus, onShowDiagnostics, connectionSettings, onSettingsChange, onConnect, onDisconnect, onAbortConnection,
        savedConnections, onSaveConnection, onUpdateSavedConnection, onDeleteConnection,
        simulatorDevices, simulatorMessageCount, onOpenDeviceSettings
    } = props;

    const isConnected = connectionStatus === 'Connected';

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) onLoadFromDisk(file);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const isDisconnected = connectionStatus === 'Disconnected' || connectionStatus === 'Error';
    
    const equipmentStatusLabels = {
        Disconnected: t('status.disconnected'), Connecting: t('status.connecting'), Connected: t('status.connected'), Error: t('status.error')
    };

    const deviceTypes: DeviceType[] = ['Mount', 'Camera', 'Focuser', 'FilterWheel'];

    return (
      <>
        <div className="flex flex-col gap-2 mb-4 p-3 bg-slate-800/60 rounded border border-slate-700 shadow-md">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">{t('controlPanel.backup')}</h2>
            <div className="flex gap-2">
                <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".json" className="hidden" />
                <Button onClick={onSaveToDisk} variant="primary" className="flex-1 text-xs py-2 h-8 font-bold gap-1" title={t('tooltips.saveToDevice')}><SaveIcon className="w-4 h-4"/> {t('controlPanel.saveToDevice')}</Button>
                <Button onClick={() => fileInputRef.current?.click()} variant="secondary" className="flex-1 text-xs py-2 h-8 font-bold gap-1" title={t('tooltips.loadFromDevice')}><ListIcon className="w-4 h-4"/> {t('controlPanel.loadFromDevice')}</Button>
            </div>
        </div>

        <div className="space-y-3">
            <div className="flex justify-between items-center border-b border-red-900/50 pb-2">
                <h2 className="text-lg font-semibold text-red-400">{t('controlPanel.plateSolvingSettings')}</h2>
                <div className="flex bg-slate-800 rounded p-0.5 border border-slate-700">
                    <button onClick={() => onSetPlateSolverType('Remote')} className={`px-2 py-0.5 text-[10px] rounded font-bold transition-colors ${plateSolverType === 'Remote' ? 'bg-red-700 text-white' : 'text-slate-500 hover:text-slate-300'}`} title={t('tooltips.novaSolver')}>Nova</button>
                    <button onClick={() => onSetPlateSolverType('Local')} className={`px-2 py-0.5 text-[10px] rounded font-bold transition-colors ${plateSolverType === 'Local' ? 'bg-red-700 text-white' : 'text-slate-500 hover:text-slate-300'}`} title={t('tooltips.localSolver')}>Local</button>
                </div>
            </div>

            {plateSolverType === 'Remote' ? (
                <>
                <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                    <label className="block text-xs font-medium text-slate-300 mb-1">{t('imagingView.apiKey')}</label>
                    <input type="password" value={astrometryApiKey || ''} onChange={(e) => { setSelectedApiKeyIndex(""); onSetAstrometryApiKey(e.target.value); }} className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-red-500 placeholder-slate-500 select-text" placeholder="Astrometry.net API Key" />
                </div>
                </>
            ) : (
                <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700 space-y-2">
                    <div className="flex gap-2">
                        <div className="flex-1">
                            <label className="block text-[10px] text-slate-400 mb-1">{t('controlPanel.localSolverHost')}</label>
                            <input type="text" value={localSolverSettings?.host || ''} onChange={(e) => { setSelectedLocalSolverIndex(""); onSetLocalSolverSettings({...localSolverSettings, host: e.target.value}); }} className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1 text-xs text-slate-200 select-text" placeholder="localhost" title={t('tooltips.host')} />
                        </div>
                        <div className="w-20">
                            <label className="block text-[10px] text-slate-400 mb-1">{t('controlPanel.localSolverPort')}</label>
                            <input type="number" value={localSolverSettings?.port || 0} onChange={(e) => { setSelectedLocalSolverIndex(""); onSetLocalSolverSettings({...localSolverSettings, port: Number(e.target.value)}); }} className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1 text-xs text-slate-200 select-text" placeholder="6000" title={t('tooltips.port')} />
                        </div>
                    </div>
                </div>
            )}
            <div className="px-1"><ToggleSwitch id="auto-center" label={t('controlPanel.autoCenter')} title={t('tooltips.autoCenter')} checked={isAutoCenterEnabled || false} onChange={onToggleAutoCenter} /></div>
        </div>

        <div className="space-y-3 mt-6">
            <h2 className="text-lg font-semibold text-red-400 border-b border-red-900/50 pb-2">{t('controlPanel.locationAndTime')}</h2>
            <div className="p-3 bg-slate-800/50 rounded-lg space-y-2 text-sm border border-slate-700">
                <div className="flex justify-between items-center"><span className="font-semibold text-slate-400 w-16">{t('controlPanel.location.latitude')}:</span><div className="flex-1 max-w-[140px]"><SexagesimalInput value={location?.latitude || 0} unit="°" title={t('tooltips.latitude')} onChange={(val) => { setSelectedLocationIndex(""); if (onUpdateLatitude) onUpdateLatitude(val); }} /></div></div>
                <div className="flex justify-between items-center"><span className="font-semibold text-slate-400 w-16">{t('controlPanel.location.longitude')}:</span><div className="flex-1 max-w-[140px]"><SexagesimalInput value={location?.longitude || 0} unit="°" title={t('tooltips.longitude')} onChange={(val) => { setSelectedLocationIndex(""); if (onUpdateLongitude) onUpdateLongitude(val); }} /></div></div>
                <div className="flex justify-between items-center"><span className="font-semibold text-slate-400">{t('controlPanel.location.elevation')}:</span><div className="flex items-center gap-1"><input type="number" value={location?.elevation || 0} onChange={(e) => { setSelectedLocationIndex(""); if(onUpdateElevation) onUpdateElevation(Number(e.target.value)); }} className="w-24 bg-slate-800 border border-slate-600 rounded px-1 py-0.5 text-xs font-mono text-slate-200 text-right focus:border-red-500 outline-none select-text" title={t('tooltips.elevation')} /><span className="text-xs text-slate-500">m</span></div></div>
                <div className="space-y-1 mt-2 border-t border-slate-700 pt-2">
                    <label className="font-semibold text-slate-400 block">{t('controlPanel.location.localTime')}:</label>
                    <div className="flex gap-2"><input type="datetime-local" value={localTime ? toLocalISOString(localTime) : ''} onChange={(e) => onSetTime(new Date(e.target.value))} className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs font-mono text-slate-200 focus:border-red-500 outline-none select-text" title={t('tooltips.localTime')} /></div>
                    <Button onClick={onSetTimeNow} variant={isTimeRunning ? 'primary' : 'secondary'} className="w-full text-xs h-8 mt-2">{isTimeRunning ? t('controlPanel.liveView') : t('deviceSettings.set')}</Button>
                </div>
            </div>
            <div className="space-y-2 mt-2"><Button onClick={() => onSendLocationToMount?.()} disabled={!isConnected || mountSyncStatus === 'sending'} variant={mountSyncStatus === 'success' ? 'secondary' : 'primary'} className={`w-full text-xs transition-colors ${mountSyncStatus === 'success' ? 'border-green-600 text-green-400 hover:text-green-300' : ''}`} title={t('tooltips.syncToMount')}>
                {mountSyncStatus === 'sending' ? (<><div className="w-3 h-3 border-2 border-t-transparent border-white rounded-full animate-spin"></div> {t('controlPanel.location.syncing')}</>) : mountSyncStatus === 'success' ? (<><GpsIcon className="w-4 h-4 text-green-500" /> {t('controlPanel.location.resend')}</>) : (<><GpsIcon className="w-4 h-4" /> {t('controlPanel.location.syncToMount')}</>)}
            </Button></div>
        </div>

        <div className="space-y-3 mt-6">
            <div className="flex justify-between items-center border-b border-red-900/50 pb-2"><h2 className="text-lg font-semibold text-red-400">{t('controlPanel.equipment')}</h2><button onClick={onShowDiagnostics} className="text-[10px] text-slate-400 underline hover:text-red-400">Diagnosis</button></div>
            <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700"><ConnectionStatusIndicator status={connectionStatus} labels={equipmentStatusLabels} />{isConnected && (<p className="text-xs text-slate-400 mt-1 font-mono">{t('status.connectedTo', { driver: 'Simulator', host: 'Local', port: 'N/A' })}</p>)}</div>
            
            {isConnected && props.telescopePosition && (
                <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700 space-y-2">
                    <h3 className="text-sm font-semibold text-slate-300 border-b border-slate-700 pb-1">マウント状態</h3>
                    <div className="grid grid-cols-2 gap-2">
                        <div className="bg-slate-900 p-2 rounded">
                            <div className="text-[10px] text-slate-500 uppercase">RA</div>
                            <div className="text-sm font-mono text-red-400">{decimalToSexagesimal(props.telescopePosition.ra / 15)}</div>
                        </div>
                        <div className="bg-slate-900 p-2 rounded">
                            <div className="text-[10px] text-slate-500 uppercase">DEC</div>
                            <div className="text-sm font-mono text-red-400">{decimalToSexagesimal(props.telescopePosition.dec)}</div>
                        </div>
                    </div>
                    <div className="pt-2">
                        <MountControllerSimulator isConnected={isConnected} />
                    </div>
                </div>
            )}

            {isDisconnected && (
            <div className="space-y-4 p-3 bg-slate-800/30 rounded-lg border border-slate-700">
                <h3 className="text-sm font-semibold text-slate-300">{t('controlPanel.connectionSettings')}</h3>
                <div className="space-y-3">
                    <div>
                        <label htmlFor="driver-type" className="block text-sm font-medium mb-1 text-slate-400">{t('controlPanel.driver')}</label>
                        <select id="driver-type" value={connectionSettings?.driver || 'Simulator'} onChange={(e) => { 
                            const newDriver = e.target.value as any; 
                            console.log(`[ControlPanelSimulator] Switching to: ${newDriver}`);
                            
                            // Save driver setting before navigating
                            const settings = SettingsService.loadSettings();
                            SettingsService.saveSettings({
                                ...settings,
                                connectionSettings: {
                                    ...settings.connectionSettings,
                                    driver: newDriver
                                }
                            });

                            // Navigate to the correct page for the driver
                            const pageMap: Record<string, string> = {
                                'INDI': '/index.html',
                                'Alpaca': '/alpaca.html',
                                'Simulator': '/simulator.html'
                            };
                            window.location.href = pageMap[newDriver] || '/index.html';
                        }} className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 focus:ring-2 focus:ring-red-500 focus:outline-none text-slate-200" title={t('tooltips.connectionDriver')}>
                            <option value="Simulator">Simulator</option>
                            <option value="INDI">INDI</option>
                            <option value="Alpaca">Alpaca</option>
                        </select>
                    </div>
                    <p className="text-xs text-slate-400 italic">Simulator driver is running locally.</p>
                </div>
            </div>
            )}
            {isConnected && (
            <><div className="space-y-1"><div className="flex justify-between items-center mb-2"><h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Device Controls</h3></div>
                    <div className="space-y-2">
                        {(simulatorDevices || []).map((dev: any) => (
                            <div key={dev.name} className="flex items-center justify-between p-2 bg-slate-800/60 rounded hover:bg-slate-700 transition-colors border border-transparent hover:border-red-900/30">
                                <div className="flex items-center gap-2 overflow-hidden">
                                    <div className={`w-2 h-2 rounded-full ${dev.connected ? 'bg-green-500 shadow-[0_0_5px_rgba(34,197,94,0.6)]' : 'bg-slate-600'}`}></div>
                                    <span className="text-sm text-slate-200 font-mono truncate" title={dev.name}>{dev.name}</span>
                                    {dev.type && (<span className="text-[10px] text-slate-500 bg-slate-800 px-1 rounded">{t(`deviceType.${dev.type}`)}</span>)}
                                </div>
                                <div className="flex items-center gap-2">
                                    <button 
                                        onClick={() => dev.connected ? AstroService.disconnectDevice(dev.name) : AstroService.connectDevice(dev.name)} 
                                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${dev.connected ? 'bg-green-600' : 'bg-slate-600'}`} 
                                        title={dev.connected ? t('controlPanel.disconnect') : t('controlPanel.connect')}
                                    >
                                        <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition duration-200 ease-in-out ${dev.connected ? 'translate-x-5' : 'translate-x-1'}`} />
                                    </button>
                                    <button 
                                        className="p-1 hover:bg-slate-600 rounded text-red-400 hover:text-red-200" 
                                        title={t('tooltips.deviceSettings')} 
                                        onClick={() => onOpenDeviceSettings(dev.type || 'Camera', dev.name)}
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2-2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 0 2.83 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div><Button onClick={onDisconnect} variant="danger" className="w-full mt-4" title="Disconnect from simulator."><DisconnectIcon className="w-5 h-5" /> {t('controlPanel.disconnect')}</Button></>
            )}
            {isDisconnected && (
            <div className="space-y-2">{connectionStatus === 'Connecting' ? (<Button onClick={onAbortConnection} variant="danger" className="w-full animate-pulse"><CloseIcon className="w-5 h-5" /> {t('controlPanel.cancelConnection')}</Button>) : (<Button onClick={() => onConnect()} className="w-full" title="Connect to the simulator."><ConnectIcon className="w-5 h-5" /> {t('controlPanel.connect')}</Button>)}</div>
            )}
        </div>
        <LogViewer />
      </>
    );
});

export const ControlPanelSimulator: React.FC<any> = (props) => {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState<TabType>('equipment');
    const { mobileTab } = props;
    const [simulatorDevices, setSimulatorDevices] = useState<any[]>([]);
    const [simulatorMessageCount, setSimulatorMessageCount] = useState(0);

    useEffect(() => {
        const updateDevices = (devs: any[]) => setSimulatorDevices([...devs]);
        const updateCount = (count: number) => setSimulatorMessageCount(count);
        AstroService.setDeviceCallback(updateDevices);
        AstroService.setMessageCountCallback(updateCount);
        setSimulatorDevices(AstroService.getDevices());
        return () => { AstroService.setDeviceCallback(null); AstroService.setMessageCountCallback(null); };
    }, []);

    const passedProps = { ...props, simulatorDevices, simulatorMessageCount } as any;
    
    const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 1024;
    const isLandscape = typeof window !== 'undefined' && window.innerWidth > window.innerHeight && window.innerHeight < 600;
    const showTabs = isDesktop || isLandscape;
    
    let currentTab: 'equipment' | 'imaging' | 'settings' = activeTab === 'imaging_control' ? 'imaging' : activeTab as any;
    
    if (!showTabs && mobileTab) {
        if (mobileTab === 'equipment') currentTab = 'equipment';
        if (mobileTab === 'imaging_control') currentTab = 'imaging';
        if (mobileTab === 'settings') currentTab = 'settings';
    }

    return (
        <div className="flex flex-col h-full bg-slate-900 border-r border-red-900/30 w-full lg:w-96 shrink-0 text-slate-200">
            {showTabs && (
                <div className="flex border-b border-red-900/30 shrink-0">
                    <button onClick={() => setActiveTab('equipment')} className={`flex-1 py-3 text-[10px] md:text-xs font-bold uppercase tracking-wider transition-colors ${currentTab === 'equipment' ? 'bg-red-900/20 text-red-400 border-b-2 border-red-500' : 'text-slate-500 hover:text-slate-300'}`}>{t('controlPanel.tabs.equipment')}</button>
                    <button onClick={() => setActiveTab('imaging' as any)} className={`flex-1 py-3 text-[10px] md:text-xs font-bold uppercase tracking-wider transition-colors ${currentTab === 'imaging' ? 'bg-red-900/20 text-red-400 border-b-2 border-red-500' : 'text-slate-500 hover:text-slate-300'}`}>{t('controlPanel.tabs.imaging')}</button>
                    <button onClick={() => setActiveTab('settings')} className={`flex-1 py-3 text-[10px] md:text-xs font-bold uppercase tracking-wider transition-colors ${currentTab === 'settings' ? 'bg-red-900/20 text-red-400 border-b-2 border-red-500' : 'text-slate-500 hover:text-slate-300'}`}>{t('controlPanel.tabs.settings')}</button>
                </div>
            )}
            <div className="flex-1 overflow-y-auto p-4 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent touch-pan-y" style={{ WebkitOverflowScrolling: 'touch' }}>
                {currentTab === 'equipment' && <EquipmentPanel {...passedProps} />}
                {currentTab === 'imaging' && <ImagingPanel {...passedProps} />}
                {currentTab === 'settings' && <SettingsPanel {...passedProps} />}
            </div>
        </div>
    );
};
