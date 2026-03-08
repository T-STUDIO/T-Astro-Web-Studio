import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { ConnectionStatus, SlewStatus, CelestialObject, ConnectionSettings, DriverType, PlanetariumSettings, LocationStatus, LocationData, SampStatus, DeviceType, INDIDevice, TabType, SavedLocation, SavedConnection, SavedApiKey, INDIVector, INDIElement, SampSettings, SavedSampSettings, PlateSolverType, LocalSolverSettings, SavedLocalSolver } from '../types';
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
import { FocuserControl } from './FocuserControl';
import * as AstroService from '../services/AstroService';
import * as GoogleDriveService from '../services/GoogleDriveService';
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
        indiDevices, isPreviewLoading, onToggleVideoStream, isVideoStreamActive, onOpenDeviceSettings
    } = props;

    const devices = (indiDevices || []) as INDIDevice[];
    const activeCameraName = AstroService.getActiveCamera();
    const activeFocuserName = AstroService.getActiveFocuser();
    // 既存のリストからマウント種別のデバイスを検索して取得
    const activeMountName = devices.find(d => d.type === 'Mount')?.name;
    
    const activeCameraDevice = devices.find(d => d.name === activeCameraName);

    let formatProperty: INDIVector | undefined;
    if (activeCameraDevice?.properties) {
        ['IMAGE_FORMAT', 'CCD_FILE_FORMAT', 'CCD_TRANSFER_FORMAT'].some(key => {
            if (activeCameraDevice.properties?.has(key)) {
                formatProperty = activeCameraDevice.properties.get(key);
                return true;
            }
            return false;
        });
    }

    const compressionProperty = activeCameraDevice && !formatProperty ? activeCameraDevice.properties?.get('CCD_COMPRESSION') : undefined;
    const streamEncoderProperty = activeCameraDevice ? activeCameraDevice.properties?.get('CCD_STREAM_ENCODER') : undefined;
    const binningProperty = activeCameraDevice ? activeCameraDevice.properties?.get('CCD_BINNING') : undefined;

    let maxBinning = 1;
    if (binningProperty?.elements) {
        const el = binningProperty.elements.get('HOR_BIN') || binningProperty.elements.values().next().value;
        if (el && el.max) maxBinning = el.max;
    }

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
        
        <div className="w-full space-y-2 bg-slate-800/20 p-2 rounded-lg border border-slate-700/50">
            <h3 className="text-xs font-bold text-slate-500 uppercase">{t('controlPanel.videoStreamLabel')}</h3>
            <p className="text-[10px] text-slate-500 leading-tight mb-1">{t('tooltips.videoStream')}</p>
            <Button onClick={onToggleVideoStream} disabled={isLiveViewActive} variant={isVideoStreamActive ? "danger" : "secondary"} className="w-full text-xs" type="button" title={t('tooltips.videoStream')}>
                {isVideoStreamActive ? <><StopIcon className="w-4 h-4" /> {t('controlPanel.stopVideoStream')}</> : <><VideoIcon className="w-4 h-4" /> {t('controlPanel.videoStream')}</>}
            </Button>
            {streamEncoderProperty?.elements && (
                <div className="bg-slate-800/50 p-2 rounded border border-slate-700 flex justify-between items-center" title="Select hardware or software encoder for native INDI streaming.">
                    <span className="text-[10px] font-semibold text-slate-400">{t('controlPanel.encoder')}</span>
                    <div className="flex bg-slate-900 rounded p-1 gap-1">
                        {Array.from(streamEncoderProperty.elements.values()).map((el: INDIElement) => {
                            const isOn = el.value === true;
                            return (
                                <button
                                    key={el.name}
                                    onClick={() => AstroService.toggleVideoStreamEncoder(el.name)}
                                    className={`px-3 py-1 text-[10px] rounded transition-colors ${isOn ? 'bg-red-700 text-white font-bold shadow-sm' : 'bg-slate-700 border border-slate-600 text-slate-300 hover:bg-slate-600'}`}
                                >{el.label || el.name}</button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
        
        <div className="space-y-3 p-3 bg-slate-800/50 rounded-lg border border-slate-700">
             {binningProperty && (
                 <RangeSlider 
                    id="binning" label={t('controlPanel.binning')} value={binning} min={1} max={maxBinning} step={1} onChange={onSetBinning} 
                    title={t('tooltips.binning')}
                    onAfterChange={(val) => { 
                        if (activeCameraName && connectionStatus === 'Connected' && binningProperty.elements) {
                            const payload: Record<string, number> = {};
                            binningProperty.elements.forEach((_, key) => { payload[key] = val; });
                            AstroService.updateDeviceSetting(activeCameraName, 'CCD_BINNING', payload); 
                        }
                    }} 
                 />
             )}
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
            {formatProperty?.elements && formatProperty.type === 'Switch' && (
                <div className="bg-slate-800/50 p-2 rounded border border-slate-700 flex justify-between items-center" title="Select the primary image data format for static captures.">
                    <span className="text-[10px] font-semibold text-slate-400">{formatProperty.label || t('controlPanel.format')}</span>
                    <div className="flex flex-wrap gap-1 bg-slate-900 rounded p-1">
                        {Array.from(formatProperty.elements.values()).map((el: INDIElement) => {
                            const isOn = el.value === true;
                            return (
                                <button
                                    key={el.name}
                                    onClick={() => activeCameraName && AstroService.updateDeviceSetting(activeCameraName, formatProperty!.name, { [el.name]: true })}
                                    className={`px-3 py-1 text-[10px] rounded transition-colors ${isOn ? 'bg-blue-700 text-white font-bold' : 'text-slate-400 hover:text-slate-200'}`}
                                >{el.label || el.name}</button>
                            );
                        })}
                    </div>
                </div>
            )}
            {compressionProperty?.elements && (
                <div className="bg-slate-800/50 p-2 rounded border border-slate-700 flex justify-between items-center" title="Enable JPEG compression for faster preview downloads over slow networks.">
                    <span className="text-[10px] font-semibold text-slate-400">{t('controlPanel.transfer')}</span>
                    <div className="flex bg-slate-900 rounded p-1 gap-1">
                        <button onClick={() => activeCameraName && AstroService.updateDeviceSetting(activeCameraName, 'CCD_COMPRESSION', { 'CCD_COMPRESS': false })} className={`px-3 py-1 text-[10px] rounded transition-colors ${compressionProperty.elements.get('CCD_COMPRESS')?.value !== true ? 'bg-blue-700 text-white font-bold' : 'text-slate-400 hover:text-slate-200'}`}>FITS</button>
                        <button onClick={() => activeCameraName && AstroService.updateDeviceSetting(activeCameraName, 'CCD_COMPRESSION', { 'CCD_COMPRESS': true })} className={`px-3 py-1 text-[10px] rounded transition-colors ${compressionProperty.elements.get('CCD_COMPRESS')?.value === true ? 'bg-blue-700 text-white font-bold' : 'text-slate-400 hover:text-slate-200'}`}>JPEG</button>
                    </div>
                </div>
            )}
            <p className="text-[10px] text-slate-500 leading-tight">{t('tooltips.liveStacking')}</p>
            {!isCapturing ? (<Button onClick={onStartCapture} disabled={isVideoStreamActive} className="w-full" type="button" title={t('tooltips.liveStacking')}><CameraIcon className="w-5 h-5" /> {t('controlPanel.startLiveStacking')}</Button>) : (<Button onClick={onStopCapture} variant="danger" className="w-full" type="button" title="Stop the active live stacking session."><StopIcon className="w-5 h-5" /> {t('controlPanel.stopCapture')}</Button>)}
        </div>
        <FocuserControl isConnected={connectionStatus === 'Connected'} />
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
    const [showDriveConfig, setShowDriveConfig] = useState(false);
    const [clientIdInput, setClientIdInput] = useState('');
    
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
        indiDevices, indiMessageCount, onOpenDeviceSettings
    } = props;

    const isConnected = connectionStatus === 'Connected';
    useEffect(() => { const current = GoogleDriveService.getClientId(); if (current) setClientIdInput(current); }, []);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) onLoadFromDisk(file);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleSaveClientId = () => { if (clientIdInput.trim()) { GoogleDriveService.setClientId(clientIdInput.trim()); setShowDriveConfig(false); } };
    const handleConnectDriveWrapper = async () => { try { await onConnectDrive(); } catch (e: any) { if (e.message && (e.message.includes("Client ID") || e.message.includes("setup"))) setShowDriveConfig(true); } };
    const isDisconnected = connectionStatus === 'Disconnected' || connectionStatus === 'Error';
    const isINDI = connectionSettings?.driver === 'INDI';
    const isAlpaca = connectionSettings?.driver === 'Alpaca';
    const useDynamicDeviceList = isINDI || isAlpaca;
    const deviceTypes: DeviceType[] = ['Mount', 'Camera', 'GuideCamera', 'Focuser', 'FilterWheel', 'Dome', 'Rotator', 'Heater'];
    
    const equipmentStatusLabels = {
        Disconnected: t('status.disconnected'), Connecting: t('status.connecting'), Connected: t('status.connected'), Error: t('status.error')
    };

    return (
      <>
        <div className="flex flex-col gap-2 mb-4 p-3 bg-slate-800/60 rounded border border-slate-700 shadow-md">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">{t('controlPanel.backup')}</h2>
            <div className="flex gap-2">
                <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".json" className="hidden" />
                <Button onClick={onSaveToDisk} variant="primary" className="flex-1 text-xs py-2 h-8 font-bold gap-1" title={t('tooltips.saveToDevice')}><SaveIcon className="w-4 h-4"/> {t('controlPanel.saveToDevice')}</Button>
                <Button onClick={() => fileInputRef.current?.click()} variant="secondary" className="flex-1 text-xs py-2 h-8 font-bold gap-1" title={t('tooltips.loadFromDevice')}><ListIcon className="w-4 h-4"/> {t('controlPanel.loadFromDevice')}</Button>
            </div>
            <div className="mt-2 border-t border-slate-700/50 pt-2">
                <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-slate-500">{t('controlPanel.cloudSync')}</span>
                    <button onClick={() => setShowDriveConfig(!showDriveConfig)} className="text-[10px] text-slate-500 hover:text-slate-300 underline">{showDriveConfig ? t('controlPanel.hideSetup') : t('controlPanel.setupInfo')}</button>
                </div>
                {isDriveConnected ? (
                    <div className="flex gap-2">
                        <Button onClick={onExportSettings} variant="secondary" className="flex-1 text-[10px] py-1 h-7" title={t('tooltips.saveToDrive')}><GoogleDriveIcon className="w-3 h-3"/> {t('controlPanel.saveToDrive')}</Button>
                        <Button onClick={onImportSettings} variant="secondary" className="flex-1 text-[10px] py-1 h-7" title={t('tooltips.loadFromDrive')}><GoogleDriveIcon className="w-3 h-3"/> {t('controlPanel.loadFromDrive')}</Button>
                    </div>
                ) : (
                    <Button onClick={handleConnectDriveWrapper} variant="secondary" className="w-full text-[10px] py-1 h-7 bg-slate-700/50" title={t('tooltips.connectDrive')}><GoogleDriveIcon className="w-3 h-3"/> {t('controlPanel.connectDrive')}</Button>
                )}
                {showDriveConfig && (
                    <div className="bg-slate-900 p-2 rounded border border-slate-600 mt-2 animate-fadeIn">
                        <p className="text-[10px] text-slate-400 mb-2 leading-tight">{t('controlPanel.backupHelp')}</p>
                        <label className="block text-[10px] text-slate-300 mb-1">{t('controlPanel.googleClientId')}</label>
                        <input type="text" value={clientIdInput} onChange={(e) => setClientIdInput(e.target.value)} className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-slate-200 mb-2 select-text" placeholder="e.g. 123...apps.googleusercontent.com" title={t('tooltips.clientId')} />
                        <Button onClick={handleSaveClientId} className="w-full text-[10px] py-1 h-6">{t('controlPanel.saveClientId')}</Button>
                    </div>
                )}
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
                {isNamingApiKey ? (
                    <div className="flex gap-2 mb-2 items-center">
                        <input type="text" value={newApiKeyName} onChange={(e) => setNewApiKeyName(e.target.value)} placeholder={t('controlPanel.enterKeyName')} className="flex-1 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-slate-200 outline-none focus:border-red-500 select-text" autoFocus />
                        <button onClick={() => { if(astrometryApiKey && newApiKeyName.trim()) { onSaveApiKey(newApiKeyName.trim(), astrometryApiKey); setSelectedApiKeyIndex(String(savedApiKeys.length)); setIsNamingApiKey(false); } }} className="bg-green-700 hover:bg-green-600 text-white p-1 rounded border border-green-600"><span className="text-xs font-bold px-1">{t('common.ok')}</span></button>
                        <button onClick={() => setIsNamingApiKey(false)} className="bg-slate-700 hover:bg-slate-600 text-white p-1 rounded border border-slate-600"><CloseIcon className="w-4 h-4" /></button>
                    </div>
                ) : (
                    <div className="flex gap-2 mb-2 items-center">
                        <select className="flex-1 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-slate-200 outline-none focus:border-red-500" value={selectedApiKeyIndex} onChange={(e) => {
                            const idx = parseInt(e.target.value);
                            setSelectedApiKeyIndex(e.target.value);
                            if (!isNaN(idx) && savedApiKeys[idx]) onSetAstrometryApiKey(savedApiKeys[idx].key);
                        }}>
                            <option value="" disabled>{t('controlPanel.selectKey')}</option>
                            {savedApiKeys.map((k: any, i: number) => (<option key={i} value={String(i)}>{k.name}</option>))}
                        </select>
                        <button onClick={() => { if(astrometryApiKey) { setNewApiKeyName(''); setIsNamingApiKey(true); } }} className="bg-slate-700 hover:bg-slate-600 text-white p-1 rounded border border-slate-600" title={t('controlPanel.connectionProfiles.saveCurrent')}><PlusIcon className="w-4 h-4" /></button>
                        {selectedApiKeyIndex !== "" && (<button onClick={() => { onDeleteApiKey(Number(selectedApiKeyIndex)); setSelectedApiKeyIndex(""); }} className="bg-red-900/50 hover:bg-red-800 text-white p-1 rounded border border-red-800" title={t('controlPanel.deleteSelected')}><TrashIcon className="w-4 h-4" /></button>)}
                    </div>
                )}
                <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                    <label className="block text-xs font-medium text-slate-300 mb-1">{t('imagingView.apiKey')}</label>
                    <input type="password" value={astrometryApiKey || ''} onChange={(e) => { setSelectedApiKeyIndex(""); onSetAstrometryApiKey(e.target.value); }} className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-red-500 placeholder-slate-500 select-text" placeholder="Astrometry.net API Key" />
                </div>
                </>
            ) : (
                <>
                {isNamingLocalSolver ? (
                    <div className="flex gap-2 mb-2 items-center">
                        <input type="text" value={newLocalSolverName} onChange={(e) => setNewLocalSolverName(e.target.value)} placeholder={t('controlPanel.localSolverProfileName')} className="flex-1 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-slate-200 outline-none focus:border-red-500 select-text" autoFocus />
                        <button onClick={() => { if(newLocalSolverName.trim()) { onSaveLocalSolver(newLocalSolverName.trim(), {...localSolverSettings}); setSelectedLocalSolverIndex(String(savedLocalSolvers.length)); setIsNamingLocalSolver(false); } }} className="bg-green-700 hover:bg-green-600 text-white p-1 rounded border border-green-600"><span className="text-xs font-bold px-1">{t('common.ok')}</span></button>
                        <button onClick={() => setIsNamingLocalSolver(false)} className="bg-slate-700 hover:bg-slate-600 text-white p-1 rounded border border-slate-600"><CloseIcon className="w-4 h-4" /></button>
                    </div>
                ) : (
                    <div className="flex gap-2 mb-2 items-center">
                        <select className="flex-1 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-slate-200 outline-none focus:border-red-500" value={selectedLocalSolverIndex} onChange={(e) => {
                            const idx = parseInt(e.target.value);
                            setSelectedLocalSolverIndex(e.target.value);
                            if (!isNaN(idx) && savedLocalSolvers[idx]) onSetLocalSolverSettings(savedLocalSolvers[idx].settings);
                        }}>
                            <option value="" disabled>{t('controlPanel.localSolverSelect')}</option>
                            {savedLocalSolvers.map((s: any, i: number) => (<option key={i} value={String(i)}>{s.name}</option>))}
                        </select>
                        <button onClick={() => { setNewLocalSolverName(''); setIsNamingLocalSolver(true); }} className="bg-slate-700 hover:bg-slate-600 text-white p-1 rounded border border-slate-600" title={t('controlPanel.connectionProfiles.saveCurrent')}><PlusIcon className="w-4 h-4" /></button>
                        {selectedLocalSolverIndex !== "" && (<button onClick={() => { onDeleteLocalSolver(Number(selectedLocalSolverIndex)); setSelectedLocalSolverIndex(""); }} className="bg-red-900/50 hover:bg-red-800 text-white p-1 rounded border border-red-800" title={t('controlPanel.deleteSelected')}><TrashIcon className="w-4 h-4" /></button>)}
                    </div>
                )}
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
                </>
            )}
            <div className="px-1"><ToggleSwitch id="auto-center" label={t('controlPanel.autoCenter')} title={t('tooltips.autoCenter')} checked={isAutoCenterEnabled || false} onChange={onToggleAutoCenter} /><p className="text-[10px] text-slate-500 px-2 leading-tight mt-0.5">{t('controlPanel.autoCenterHint')}</p></div>
        </div>

        <div className="space-y-3 mt-6">
            <h2 className="text-lg font-semibold text-red-400 border-b border-red-900/50 pb-2">{t('controlPanel.locationAndTime')}</h2>
            {isNamingLocation ? (
                <div className="flex gap-2 mb-2 items-center">
                    <input type="text" value={newLocationName} onChange={(e) => setNewLocationName(e.target.value)} placeholder={t('controlPanel.location.enterName')} className="flex-1 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-slate-200 outline-none focus:border-red-500 select-text" autoFocus />
                    <button onClick={() => { if(location && newLocationName.trim()) { onSaveLocation(newLocationName.trim(), {...location}); setSelectedLocationIndex(String(savedLocations.length)); setIsNamingLocation(false); } }} className="bg-green-700 hover:bg-green-600 text-white p-1 rounded border border-green-600"><span className="text-xs font-bold px-1">{t('common.ok')}</span></button>
                    <button onClick={() => setIsNamingLocation(false)} className="bg-slate-700 hover:bg-slate-600 text-white p-1 rounded border border-slate-600"><CloseIcon className="w-4 h-4" /></button>
                </div>
            ) : (
                <div className="flex gap-2 mb-2 items-center">
                    <select className="flex-1 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-slate-200 outline-none focus:border-red-500" value={selectedLocationIndex} onChange={(e) => {
                        const idx = parseInt(e.target.value);
                        setSelectedLocationIndex(e.target.value);
                        if (!isNaN(idx) && savedLocations[idx]) {
                            const loc = savedLocations[idx].data;
                            if (onUpdateLatitude) onUpdateLatitude(loc.latitude);
                            if (onUpdateLongitude) onUpdateLongitude(loc.longitude);
                            if (onUpdateElevation) onUpdateElevation(loc.elevation || 0);
                        }
                    }}>
                        <option value="" disabled>{t('controlPanel.location.select')}</option>
                        {savedLocations.map((loc: any, i: number) => (<option key={i} value={String(i)}>{loc.name}</option>))}
                    </select>
                    {selectedLocationIndex !== "" && onUpdateSavedLocation && location && (
                        <button onClick={() => onUpdateSavedLocation(Number(selectedLocationIndex), {...location})} className="bg-blue-800 hover:bg-blue-700 text-white p-1 rounded border border-blue-700" title={t('controlPanel.connectionProfiles.overwrite')}><SaveIcon className="w-4 h-4" /></button>
                    )}
                    <button onClick={() => { if(location) { setNewLocationName(''); setIsNamingLocation(true); } }} className="bg-slate-700 hover:bg-slate-600 text-white p-1 rounded border border-slate-600" title={t('controlPanel.connectionProfiles.saveCurrent')}><PlusIcon className="w-4 h-4" /></button>
                    {selectedLocationIndex !== "" && (<button onClick={() => { onDeleteLocation(Number(selectedLocationIndex)); setSelectedLocationIndex(""); }} className="bg-red-900/50 hover:bg-red-800 text-white p-1 rounded border border-red-800" title={t('controlPanel.deleteSelected')}><TrashIcon className="w-4 h-4" /></button>)}
                </div>
            )}
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
            <div className="grid grid-cols-2 gap-2"><Button onClick={onUpdateLocation} disabled={locationStatus === 'Updating'} variant="secondary" className="text-xs">{t('controlPanel.location.updateFromDevice')}</Button><Button onClick={onUpdateLocationIP} disabled={locationStatus === 'Updating'} variant="secondary" className="text-xs">{t('controlPanel.location.updateFromWeb')}</Button></div>
            <div className="space-y-2"><Button onClick={() => onSendLocationToMount?.()} disabled={!isConnected || mountSyncStatus === 'sending'} variant={mountSyncStatus === 'success' ? 'secondary' : 'primary'} className={`w-full text-xs transition-colors ${mountSyncStatus === 'success' ? 'border-green-600 text-green-400 hover:text-green-300' : ''}`} title={t('tooltips.syncToMount')}>
                {mountSyncStatus === 'sending' ? (<><div className="w-3 h-3 border-2 border-t-transparent border-white rounded-full animate-spin"></div> {t('controlPanel.location.syncing')}</>) : mountSyncStatus === 'success' ? (<><GpsIcon className="w-4 h-4 text-green-500" /> {t('controlPanel.location.resend')}</>) : (<><GpsIcon className="w-4 h-4" /> {t('controlPanel.location.syncToMount')}</>)}
            </Button>{onToggleAutoSyncLocation && (<div className="px-1"><ToggleSwitch id="auto-sync-location" label={t('controlPanel.location.autoSync')} title={t('tooltips.autoSync')} checked={isAutoSyncLocationEnabled || false} onChange={onToggleAutoSyncLocation} /></div>)}</div>
        </div>

        <div className="space-y-3 mt-6">
            <div className="flex justify-between items-center border-b border-red-900/50 pb-2"><h2 className="text-lg font-semibold text-red-400">{t('controlPanel.equipment')}</h2><button onClick={onShowDiagnostics} className="text-[10px] text-slate-400 underline hover:text-red-400">Diagnosis</button></div>
            <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700"><ConnectionStatusIndicator status={connectionStatus} labels={equipmentStatusLabels} />{isConnected && (<p className="text-xs text-slate-400 mt-1 font-mono">{t('status.connectedTo', { driver: connectionSettings?.driver, host: connectionSettings?.host, port: connectionSettings?.port })}</p>)}</div>
            {isDisconnected && (
            <div className="space-y-4 p-3 bg-slate-800/30 rounded-lg border border-slate-700">
                <h3 className="text-sm font-semibold text-slate-300">{t('controlPanel.connectionSettings')}</h3>
                {isNamingConnection ? (
                    <div className="flex gap-2 mb-2 items-center"><input type="text" value={newConnectionName} onChange={(e) => setNewConnectionName(e.target.value)} placeholder={t('controlPanel.connectionProfiles.enterName')} className="flex-1 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-slate-200 outline-none focus:border-red-500 select-text" autoFocus /><button onClick={() => { if(newConnectionName.trim()) { onSaveConnection(newConnectionName.trim(), { ...connectionSettings }); setSelectedConnectionIndex(String(savedConnections.length)); setIsNamingConnection(false); } }} className="bg-green-700 hover:bg-green-600 text-white p-1 rounded border border-green-600"><span className="text-xs font-bold px-1">{t('common.ok')}</span></button><button onClick={() => setIsNamingConnection(false)} className="bg-slate-700 hover:bg-slate-600 text-white p-1 rounded border border-slate-600"><CloseIcon className="w-4 h-4" /></button></div>
                ) : (
                    <div className="flex gap-2 mb-2 items-center"><select className="flex-1 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-slate-200 outline-none focus:border-red-500" value={selectedConnectionIndex} onChange={(e) => {
                        const idx = parseInt(e.target.value);
                        setSelectedConnectionIndex(e.target.value);
                        if (!isNaN(idx) && savedConnections[idx]) onSettingsChange(savedConnections[idx].settings);
                    }}><option value="" disabled>{t('controlPanel.connectionProfiles.select')}</option>{savedConnections.map((conn: any, i: number) => (<option key={i} value={String(i)}>{conn.name}</option>))}</select>
                    {selectedConnectionIndex !== "" && onUpdateSavedConnection && (
                        <button onClick={() => onUpdateSavedConnection(Number(selectedConnectionIndex), {...connectionSettings})} className="bg-blue-800 hover:bg-blue-700 text-white p-1 rounded border border-blue-700" title={t('controlPanel.connectionProfiles.overwrite')}><SaveIcon className="w-4 h-4" /></button>
                    )}
                    <button onClick={() => { setNewConnectionName(''); setIsNamingConnection(true); }} className="bg-slate-700 hover:bg-slate-600 text-white p-1 rounded border border-slate-600" title={t('controlPanel.connectionProfiles.saveCurrent')}><PlusIcon className="w-4 h-4" /></button>{selectedConnectionIndex !== "" && (<button onClick={() => { onDeleteConnection(Number(selectedConnectionIndex)); setSelectedConnectionIndex(""); }} className="bg-red-900/50 hover:bg-red-800 text-white p-1 rounded border border-red-800" title={t('controlPanel.deleteSelected')}><TrashIcon className="w-4 h-4" /></button>)}</div>
                )}
                <div><label htmlFor="driver-type" className="block text-sm font-medium mb-1 text-slate-400">{t('controlPanel.driver')}</label><select id="driver-type" value={connectionSettings?.driver || 'Simulator'} onChange={(e) => { setSelectedConnectionIndex(""); onSettingsChange({ ...connectionSettings, driver: e.target.value as DriverType }); }} className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 focus:ring-2 focus:ring-red-500 focus:outline-none text-slate-200" title={t('tooltips.connectionDriver')}><option value="Simulator">Simulator</option><option value="INDI">INDI</option><option value="Alpaca">Alpaca</option></select></div>
                {connectionSettings?.driver === 'INDI' && (
                    <div><label className="block text-sm font-medium mb-1 text-slate-400">{t('controlPanel.serverType')}</label><div className="flex gap-4"><label className="flex items-center space-x-2 cursor-pointer"><input type="radio" checked={connectionSettings.serverType === 'local'} onChange={() => { setSelectedConnectionIndex(""); onSettingsChange({ ...connectionSettings, serverType: 'local' }); }} className="text-red-500 focus:ring-red-500 bg-slate-700 border-slate-600" /><span className="text-sm text-slate-300">{t('controlPanel.local')}</span></label><label className="flex items-center space-x-2 cursor-pointer"><input type="radio" checked={connectionSettings.serverType === 'remote'} onChange={() => { setSelectedConnectionIndex(""); onSettingsChange({ ...connectionSettings, serverType: 'remote' }); }} className="text-red-500 focus:ring-red-500 bg-slate-700 border-slate-600" /><span className="text-sm text-slate-300">{t('controlPanel.remote')}</span></label></div></div>
                )}
                {connectionSettings?.driver !== 'Simulator' && (
                    <><div><label htmlFor="host-input" className="block text-sm font-medium mb-1 text-slate-400">{t('controlPanel.host')}</label><input type="text" id="host-input" value={connectionSettings?.host || ''} onChange={(e) => { setSelectedConnectionIndex(""); onSettingsChange({ ...connectionSettings, host: e.target.value }); }} className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 focus:ring-2 focus:ring-red-500 focus:outline-none font-mono text-slate-200 select-text" placeholder="e.g. stellarmate.local" title={t('tooltips.host')} /></div><div><label htmlFor="port-input" className="block text-sm font-medium mb-1 text-slate-400">{t('controlPanel.port')}</label><input type="number" id="port-input" value={connectionSettings?.port || 0} onChange={(e) => { setSelectedConnectionIndex(""); onSettingsChange({ ...connectionSettings, port: Number(e.target.value) }); }} className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 focus:ring-2 focus:ring-red-500 focus:outline-none font-mono text-slate-200 select-text" title={t('tooltips.port')} /></div></>
                )}
            </div>
            )}
            {isConnected && (
            <><div className="space-y-1"><div className="flex justify-between items-center mb-2"><h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Device Controls</h3>{isINDI && (<span className="text-[10px] text-slate-500 font-mono">{t('controlPanel.receivedPackets', { count: indiMessageCount })}</span>)}</div>
                    {useDynamicDeviceList ? (
                        (indiDevices || []).length === 0 ? (
                            <div className="p-4 border border-dashed border-slate-700 rounded space-y-3"><div><div className="w-4 h-4 border-2 border-t-transparent border-slate-500 rounded-full animate-spin mx-auto mb-2"></div><span className="text-xs text-slate-500 italic">{t('controlPanel.searchingDevices')}</span></div>{isINDI && (<div className="text-[10px] text-slate-600">{t('controlPanel.receivedPackets', { count: indiMessageCount })}</div>)}<button onClick={() => AstroService.refreshIndiDevices()} className="text-xs bg-slate-700 hover:bg-slate-600 text-white px-3 py-1 rounded">{t('controlPanel.forceRefresh')}</button></div>
                        ) : (
                            <div className="space-y-2">{(indiDevices || []).map((dev) => (<div key={dev.name} className="flex items-center justify-between p-2 bg-slate-800/60 rounded border border-slate-700 hover:border-slate-600"><div className="flex items-center gap-2 overflow-hidden"><div className={`w-2 h-2 rounded-full ${dev.connected ? 'bg-green-500 shadow-[0_0_5px_rgba(34,197,94,0.6)]' : 'bg-slate-600'}`}></div><span className="text-sm text-slate-200 font-mono truncate" title={dev.name}>{dev.name}</span>{dev.type && (<span className="text-[10px] text-slate-500 bg-slate-800 px-1 rounded">{t(`deviceType.${dev.type}`)}</span>)}</div><div className="flex items-center gap-2"><button onClick={() => dev.connected ? AstroService.disconnectIndiDevice(dev.name) : AstroService.connectIndiDevice(dev.name)} className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${dev.connected ? 'bg-green-600' : 'bg-slate-600'}`} title={dev.connected ? t('controlPanel.disconnect') : t('controlPanel.connect')}><span className={`inline-block h-3 w-3 transform rounded-full bg-white transition duration-200 ease-in-out ${dev.connected ? 'translate-x-5' : 'translate-x-1'}`} /></button>{!isAlpaca && (<button className="p-1 hover:bg-slate-600 rounded text-red-400 hover:text-red-200" title={t('tooltips.deviceSettings')} onClick={() => onOpenDeviceSettings(dev.type || 'Camera', dev.name)}><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2-2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 0 2.83 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg></button>)}</div></div>))}<div className="pt-2 text-center"><button onClick={() => AstroService.refreshIndiDevices()} className="text-[10px] text-slate-500 hover:text-slate-300 underline">{t('controlPanel.refreshDeviceList')}</button></div></div>
                        )
                    ) : (
                        deviceTypes.map(device => (<div key={device} className="flex items-center justify-between p-2 bg-slate-800/60 rounded hover:bg-slate-700 transition-colors border border-transparent hover:border-red-900/30"><span className="text-sm text-slate-300">{t(`deviceType.${device}`)}</span><button onClick={() => onOpenDeviceSettings(device, device)} className="p-1 hover:bg-slate-600 rounded text-red-400 hover:text-red-300" title={t('tooltips.deviceSettings')}><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2-2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 0 2.83 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg></button></div>))
                    )}
                </div><Button onClick={onDisconnect} variant="danger" className="w-full mt-4" title="Disconnect from all network devices."><DisconnectIcon className="w-5 h-5" /> {t('controlPanel.disconnect')}</Button></>
            )}
            {isDisconnected && (
            <div className="space-y-2">{connectionStatus === 'Connecting' ? (<Button onClick={onAbortConnection} variant="danger" className="w-full animate-pulse"><CloseIcon className="w-5 h-5" /> {t('controlPanel.cancelConnection')}</Button>) : (<Button onClick={onConnect} className="w-full" title="Connect to the specified device server address."><ConnectIcon className="w-5 h-5" /> {t('controlPanel.connect')}</Button>)}</div>
            )}
        </div>
        <LogViewer />
      </>
    );
});

export const ControlPanel: React.FC<any> = (props) => {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState<TabType>('equipment');
    const { mobileTab } = props;
    const [indiDevices, setIndiDevices] = useState<INDIDevice[]>([]);
    const [indiMessageCount, setIndiMessageCount] = useState(0);

    useEffect(() => {
        const updateDevices = (devs: INDIDevice[]) => setIndiDevices([...devs]);
        const updateCount = (count: number) => setIndiMessageCount(count);
        AstroService.setIndiDeviceCallback(updateDevices);
        AstroService.setIndiMessageCountCallback(updateCount);
        setIndiDevices(AstroService.getIndiDevices());
        return () => { AstroService.setIndiDeviceCallback(null); AstroService.setIndiMessageCountCallback(null); };
    }, []);

    const passedProps = { ...props, indiDevices, indiMessageCount } as any;
    
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
