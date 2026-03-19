
import React, { useState, useEffect, useRef, memo } from 'react';
import { 
    ConnectionStatus, ConnectionSettings, LocationStatus, LocationData, 
    DeviceType, INDIDevice, SavedLocation, SavedConnection, SavedApiKey, 
    PlateSolverType, LocalSolverSettings, SavedLocalSolver, 
    SampStatus, SampSettings, SavedSampSettings, View, CelestialObject, TelescopePosition, PlanetariumSettings
} from '../types';
import { useTranslation } from '../contexts/LanguageContext';
import { Button } from './Button';
import { ConnectIcon } from './icons/ConnectIcon';
import { DisconnectIcon } from './icons/DisconnectIcon';
import { GpsIcon } from './icons/GpsIcon';
import { PlusIcon } from './icons/PlusIcon';
import { TrashIcon } from './icons/TrashIcon';
import { CloseIcon } from './icons/CloseIcon';
import { SaveIcon } from './icons/SaveIcon'; 
import { ListIcon } from './icons/ListIcon'; 
import { SampSettingsSection } from './SampSettingsSection';
import { TelescopeIcon } from './icons/TelescopeIcon';
import * as AstroService from '../services/AstroService';
import { decimalToSexagesimal, sexagesimalToDecimal } from '../utils/coords';
import AlpacaBridge from '../AlpacaBridge.ts';

// モジュールレベルで状態を保持（画面切替時にリセットされないようにする）
let globalAlpacaActive = false;

const LargeInput = ({ label, value, onChange, type = "text", placeholder = "", title = "" }: any) => (
    <div className="space-y-1" title={title}>
        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1">{label}</label>
        <input 
            type={type} 
            value={value} 
            onChange={(e) => onChange(e.target.value)} 
            placeholder={placeholder}
            className="w-full bg-slate-800/80 border border-slate-700 rounded-lg px-4 py-2 text-lg font-mono text-slate-100 focus:outline-none focus:border-red-500 transition-all select-text"
        />
    </div>
);

const SexagesimalInput: React.FC<{
    value: number;
    onChange: (val: number) => void;
    label: string;
    title?: string;
}> = memo(({ value, onChange, label, title }) => {
    const [text, setText] = useState('');
    useEffect(() => { setText(decimalToSexagesimal(value)); }, [value]);
    const handleBlur = () => {
        const val = sexagesimalToDecimal(text);
        onChange(val); 
        setText(decimalToSexagesimal(val)); 
    };
    return (
        <div className="space-y-1" title={title}>
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1">{label}</label>
            <input 
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onBlur={handleBlur}
                onKeyDown={(e) => { if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur(); }}
                className="w-full bg-slate-800/80 border border-slate-700 rounded-lg px-4 py-2 text-lg font-mono text-slate-100 text-right focus:border-red-500 outline-none select-text"
            />
        </div>
    );
});

type TSConnectTab = 'connection' | 'location' | 'solver' | 'system';

interface TSConnectProps {
    onClose: () => void;
    onToggleHelp?: () => void;
    connectionStatus: ConnectionStatus;
    connectionSettings: ConnectionSettings;
    onSettingsChange: (s: ConnectionSettings) => void;
    onConnect: () => void;
    onDisconnect: () => void;
    location: LocationData | null;
    locationStatus: LocationStatus;
    onUpdateLatitude: (val: number) => void;
    onUpdateLongitude: (val: number) => void;
    onUpdateElevation: (val: number) => void;
    onUpdateLocation: () => void;
    onUpdateLocationIP: () => void;
    onSendLocationToMount: () => void;
    mountSyncStatus: string;
    localTime: Date;
    onSetTimeNow: () => void;
    isTimeRunning: boolean;
    plateSolverType: PlateSolverType;
    onSetPlateSolverType: (t: PlateSolverType) => void;
    astrometryApiKey: string;
    onSetAstrometryApiKey: (k: string) => void;
    localSolverSettings: LocalSolverSettings;
    onSetLocalSolverSettings: (s: LocalSolverSettings) => void;
    onSaveToDisk: () => void;
    onLoadFromDisk: (file: File) => void;
    isDriveConnected: boolean;
    onExportSettings: () => void;
    onImportSettings: () => void;
    onConnectDrive: () => void;
    onShowDiagnostics: () => void;
    onOpenDeviceSettings: (type: DeviceType, name: string) => void;
    isAutoSyncLocationEnabled?: boolean;
    onToggleAutoSyncLocation?: (enabled: boolean) => void;
    sampStatus: SampStatus;
    sampSettings: SampSettings;
    onSampSettingsChange: (settings: Partial<SampSettings>) => void;
    onConnectSamp: () => void;
    onConnectVirtualSamp?: () => void;
    onDisconnectSamp: () => void;
    savedSampSettings: SavedSampSettings[];
    onSaveSampSettings: (name: string, settings: SampSettings) => void;
    onUpdateSavedSampSettings?: (index: number, settings: SampSettings) => void;
    onDeleteSampSettings: (index: number) => void;
    
    // Imaging & System Sync Props (Interface only, not for UI)
    isCapturing: boolean;
    captureProgress: { count: number, total: number };
    selectedObject: CelestialObject | null;
    isLiveViewActive: boolean;
    isVideoStreamActive: boolean;
    isPreviewLoading: boolean;
    latestImage: string | null;
    latestImageMetadata: Record<string, any> | null;
    latestImageFormat: string;
    colorBalance: { r: number, g: number, b: number };
    setActiveView: (view: View) => void;
    telescopePosition?: TelescopePosition | null;
    planetariumSettings?: PlanetariumSettings;
}

export const TSConnect: React.FC<TSConnectProps> = (props) => {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState<TSConnectTab>('connection');
    const [indiDevices, setIndiDevices] = useState<INDIDevice[]>([]);
    const [indiMessageCount, setIndiMessageCount] = useState(0);
    const [logs, setLogs] = useState<string[]>([]);
    const [isAlpacaActive, setIsAlpacaActive] = useState(globalAlpacaActive);
    const logContainerRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const isConnected = props.connectionStatus === 'Connected';

    useEffect(() => {
        const updateDevices = (devs: INDIDevice[]) => {
            setIndiDevices([...devs]);
            if (globalAlpacaActive) AlpacaBridge.syncRegistry(devs);
        };
        const updateCount = (count: number) => setIndiMessageCount(count);
        const updateDebugLogs = (entry: string) => setLogs(prev => [...prev, entry].slice(-100));

        AstroService.setIndiDeviceCallback(updateDevices);
        AstroService.setIndiMessageCountCallback(updateCount);
        AstroService.setLogCallback(updateDebugLogs);
        
        AlpacaBridge.setLogger(updateDebugLogs);
        AlpacaBridge.setIndiSender((xml) => AstroService.sendRaw(xml));

        setIndiDevices(AstroService.getIndiDevices());
        setLogs(AstroService.getDebugLogs());

        return () => {
            AstroService.setIndiDeviceCallback(null);
            AstroService.setIndiMessageCountCallback(null);
            AstroService.setLogCallback(null);
            AlpacaBridge.setLogger(() => {});
        };
    }, []);

    useEffect(() => {
        if (logContainerRef.current) logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }, [logs, activeTab]);

    const handleToggleAlpaca = () => {
        const target = !isAlpacaActive;
        setIsAlpacaActive(target);
        globalAlpacaActive = target;
        if (target) {
            AlpacaBridge.setTargetHost(props.connectionSettings.host);
            AlpacaBridge.start();
            AlpacaBridge.syncRegistry(AstroService.getIndiDevices());
        } else {
            AlpacaBridge.stop();
        }
    };

    const TabButton = ({ id, label }: { id: TSConnectTab, label: string }) => (
        <button 
            onClick={() => setActiveTab(id)}
            className={`flex-1 py-3 text-[10px] sm:text-xs font-black transition-all border-b-2 ${activeTab === id ? 'text-red-500 border-red-500 bg-red-500/5' : 'text-slate-500 border-transparent hover:text-slate-300 hover:bg-slate-800/50'}`}
        >
            {label}
        </button>
    );

    return (
        <div className="fixed inset-0 top-16 bg-[#020617] z-[45] flex flex-col overflow-hidden animate-fadeIn select-none">
            
            <div className="flex bg-slate-900 shrink-0 border-b border-slate-800 shadow-lg items-center">
                <div className="flex-1 flex overflow-x-auto scrollbar-none">
                    <TabButton id="connection" label={t('controlPanel.equipment')} />
                    <TabButton id="location" label={t('controlPanel.locationAndTime')} />
                    <TabButton id="solver" label={t('controlPanel.plateSolvingSettings')} />
                    <TabButton id="system" label="SYSTEM" />
                </div>
                
                <div className="flex items-center gap-2 px-3 border-l border-slate-800 h-full">
                    {props.onToggleHelp && (
                        <button 
                            onClick={props.onToggleHelp}
                            title={t('tooltips.help') || 'Open Online Help Guide'}
                            className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700 hover:text-white transition-all"
                        >
                            <span className="text-lg font-bold">?</span>
                        </button>
                    )}
                    <button 
                        onClick={handleToggleAlpaca}
                        disabled={!isConnected}
                        title={t('tooltips.alpacaBridge') || 'Enable INDI-to-Alpaca Bridge'}
                        className={`px-3 py-1.5 rounded-md text-[10px] font-black tracking-tighter transition-all ${
                            isAlpacaActive 
                            ? 'bg-red-600 text-white shadow-[0_0_15px_rgba(220,38,38,0.4)]' 
                            : 'bg-slate-800 text-red-500 border border-red-900/30 hover:bg-red-900/20'
                        } disabled:opacity-30 disabled:cursor-not-allowed`}
                    >
                        {isAlpacaActive ? 'ALPACA: ON' : 'ALPACA'}
                    </button>
                    <button 
                        onClick={() => props.onToggleHelp && props.onToggleHelp()} 
                        className="p-2 text-slate-500 hover:text-white transition-colors" 
                        title={t('tooltips.help') || 'Open Help Guide'}
                    >
                        <span className="text-lg font-bold">?</span>
                    </button>
                    <button onClick={props.onClose} className="p-2 text-slate-500 hover:text-white transition-colors" title={t('common.close')}>
                        <CloseIcon className="w-5 h-5" />
                    </button>
                </div>
            </div>

            <div className="flex-1 flex flex-col overflow-hidden">
                <div className="flex-1 overflow-y-auto p-4 md:p-6 scrollbar-thin scrollbar-thumb-red-900 scrollbar-track-slate-950">
                    <div className="max-w-5xl mx-auto space-y-6 animate-fadeInFast">
                        
                        {activeTab === 'connection' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-4">
                                    <div className="p-6 bg-slate-900/60 rounded-2xl border border-slate-800 shadow-md space-y-4">
                                        <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                                            <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">{t('controlPanel.equipment')} Status</span>
                                            <div className="flex items-center gap-2">
                                                <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.6)]' : 'bg-slate-700'}`}></div>
                                                <span className="text-lg font-black text-white">{props.connectionStatus}</span>
                                            </div>
                                        </div>
                                        
                                        {props.connectionStatus !== 'Connected' ? (
                                            <div className="space-y-4">
                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1">{t('controlPanel.driver')}</label>
                                                    <select 
                                                        value={props.connectionSettings.driver} 
                                                        onChange={(e) => props.onSettingsChange({...props.connectionSettings, driver: e.target.value as any})}
                                                        title={t('tooltips.connectionDriver')}
                                                        className="w-full bg-slate-800 border border-slate-700 rounded-lg py-2 px-3 text-lg text-slate-100 outline-none focus:border-red-500 appearance-none"
                                                    >
                                                        <option value="Simulator">Simulator</option>
                                                        <option value="INDI">INDI</option>
                                                        <option value="Alpaca">Alpaca</option>
                                                    </select>
                                                </div>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <LargeInput label={t('controlPanel.host')} value={props.connectionSettings.host} onChange={(v: string) => props.onSettingsChange({...props.connectionSettings, host: v})} title={t('tooltips.host')} />
                                                    <LargeInput label={t('controlPanel.port')} value={props.connectionSettings.port} type="number" onChange={(v: string) => props.onSettingsChange({...props.connectionSettings, port: Number(v)})} title={t('tooltips.port')} />
                                                </div>
                                                <Button onClick={props.onConnect} className="w-full py-4 text-xl font-black rounded-xl shadow-lg">
                                                    <ConnectIcon className="w-6 h-6" /> {t('controlPanel.connect')}
                                                </Button>
                                            </div>
                                        ) : (
                                            <div className="space-y-4">
                                                <div className="p-3 bg-black/30 rounded-lg font-mono text-xs text-slate-400 text-center">
                                                    {props.connectionSettings.driver} @ {props.connectionSettings.host}:{props.connectionSettings.port}
                                                </div>
                                                <Button onClick={props.onDisconnect} variant="danger" className="w-full py-4 text-xl font-black rounded-xl">
                                                    <DisconnectIcon className="w-6 h-6" /> {t('controlPanel.disconnect')}
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                    <div className="text-center">
                                        <button onClick={props.onShowDiagnostics} className="text-xs text-slate-500 hover:text-red-400 underline uppercase tracking-widest font-black">Network Diagnosis</button>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-2">Device Management</h3>
                                    {!isConnected ? (
                                        <div className="p-12 text-center text-slate-600 italic border border-dashed border-slate-800 rounded-xl bg-slate-900/30">
                                            Awaiting connection...
                                        </div>
                                    ) : (
                                        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 scrollbar-thin">
                                            {indiDevices.map(dev => (
                                                <div key={dev.name} className="bg-slate-900/80 p-4 rounded-xl border border-slate-800 flex items-center justify-between hover:border-red-900/30 transition-colors">
                                                    <div className="flex items-center gap-3 overflow-hidden">
                                                        <div className={`w-2 h-2 rounded-full shrink-0 ${dev.connected ? 'bg-green-500' : 'bg-slate-700'}`}></div>
                                                        <div className="overflow-hidden">
                                                            <div className="text-sm font-black text-white font-mono truncate">{dev.name}</div>
                                                            <div className="text-[9px] font-bold text-slate-500 uppercase">{dev.type || 'Generic'}</div>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <button 
                                                            onClick={() => dev.connected ? AstroService.disconnectIndiDevice(dev.name) : AstroService.connectIndiDevice(dev.name)}
                                                            className={`px-4 py-1.5 rounded-lg text-[10px] font-black tracking-tighter shrink-0 ${dev.connected ? 'bg-red-900/40 text-red-400 border border-red-900/20' : 'bg-green-900/40 text-green-400 border border-green-900/20'}`}
                                                        >
                                                            {dev.connected ? 'OFF' : 'ON'}
                                                        </button>
                                                        <button 
                                                            className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded text-red-400 border border-slate-700"
                                                            onClick={() => props.onOpenDeviceSettings(dev.type || 'Camera', dev.name)}
                                                            title={t('tooltips.deviceSettings')}
                                                        >
                                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2-2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 0 2.83 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    <div className="pt-4 border-t border-slate-800">
                                        <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-2 mb-2">SAMP Hub</h3>
                                        <SampSettingsSection 
                                            sampStatus={props.sampStatus}
                                            sampSettings={props.sampSettings}
                                            onSampSettingsChange={props.onSampSettingsChange}
                                            onConnectSamp={props.onConnectSamp}
                                            onConnectVirtualSamp={props.onConnectVirtualSamp}
                                            onDisconnectSamp={props.onDisconnectSamp}
                                            savedSampSettings={props.savedSampSettings}
                                            onSaveSampSettings={props.onSaveSampSettings}
                                            onUpdateSavedSampSettings={props.onUpdateSavedSampSettings}
                                            onDeleteSampSettings={props.onDeleteSampSettings}
                                            showTitle={false}
                                            compact={true}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'location' && (
                            <div className="max-w-2xl mx-auto space-y-6">
                                <div className="grid grid-cols-1 gap-4 p-6 bg-slate-900/60 rounded-2xl border border-slate-800 shadow-md">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <SexagesimalInput label={t('controlPanel.location.latitude')} value={props.location?.latitude || 0} onChange={props.onUpdateLatitude} title={t('tooltips.latitude')} />
                                        <SexagesimalInput label={t('controlPanel.location.longitude')} value={props.location?.longitude || 0} onChange={props.onUpdateLongitude} title={t('tooltips.longitude')} />
                                    </div>
                                    <LargeInput label={t('controlPanel.location.elevation')} value={props.location?.elevation || 0} type="number" onChange={(v: string) => props.onUpdateElevation(Number(v))} title={t('tooltips.elevation')} />
                                    <div className="grid grid-cols-2 gap-4 pt-2">
                                        <Button onClick={props.onUpdateLocation} variant="secondary" className="py-3 text-sm font-black uppercase tracking-widest">GPS Update</Button>
                                        <Button onClick={props.onUpdateLocationIP} variant="secondary" className="py-3 text-sm font-black uppercase tracking-widest">Web IP Update</Button>
                                    </div>
                                    <div className="space-y-2 mt-2">
                                        <Button onClick={props.onSendLocationToMount} disabled={!isConnected} title={t('tooltips.syncToMount')} className="w-full py-5 text-xl font-black bg-blue-700 hover:bg-blue-600 rounded-xl shadow-lg border-b-4 border-blue-900 active:border-b-0 active:translate-y-1 transition-all">
                                            <TelescopeIcon className="w-6 h-6" /> {t('controlPanel.location.syncToMount')}
                                        </Button>
                                    </div>
                                </div>
                                <div className="p-6 bg-slate-900/60 rounded-2xl border border-slate-800 flex items-center justify-between shadow-md">
                                    <div className="space-y-1">
                                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{t('controlPanel.location.localTime')}</span>
                                        <div className="text-4xl font-mono font-black text-red-500 tabular-nums" title={t('tooltips.localTime')}>{props.localTime.toLocaleTimeString()}</div>
                                    </div>
                                    <Button onClick={props.onSetTimeNow} variant="secondary" className="h-16 px-8 text-lg font-black border border-slate-700">SET NOW</Button>
                                </div>
                            </div>
                        )}

                        {activeTab === 'solver' && (
                            <div className="max-w-2xl mx-auto space-y-6">
                                <div className="p-6 bg-slate-900/60 rounded-2xl border border-slate-800 shadow-md space-y-6">
                                    <div className="flex bg-slate-800 p-1 rounded-xl border border-slate-700">
                                        <button onClick={() => props.onSetPlateSolverType('Remote')} title={t('tooltips.novaSolver')} className={`flex-1 py-3 text-lg font-black rounded-lg transition-all ${props.plateSolverType === 'Remote' ? 'bg-red-700 text-white shadow-md' : 'text-slate-500 hover:text-slate-300'}`}>Remote (Nova)</button>
                                        <button onClick={() => props.onSetPlateSolverType('Local')} title={t('tooltips.localSolver')} className={`flex-1 py-3 text-lg font-black rounded-lg transition-all ${props.plateSolverType === 'Local' ? 'bg-red-700 text-white shadow-md' : 'text-slate-500 hover:text-slate-300'}`}>Local API</button>
                                    </div>
                                    {props.plateSolverType === 'Remote' ? (
                                        <div className="animate-fadeIn">
                                            <LargeInput label={t('imagingView.apiKey')} type="password" value={props.astrometryApiKey} onChange={props.onSetAstrometryApiKey} placeholder="nova.astrometry.net API key" />
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 gap-4 animate-fadeIn">
                                            <LargeInput label={t('controlPanel.localSolverHost')} value={props.localSolverSettings.host} onChange={(v: string) => props.onSetLocalSolverSettings({...props.localSolverSettings, host: v})} />
                                            <LargeInput label={t('controlPanel.localSolverPort')} type="number" value={props.localSolverSettings.port} onChange={(v: string) => props.onSetLocalSolverSettings({...props.localSolverSettings, port: Number(v)})} />
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {activeTab === 'system' && (
                            <div className="max-w-2xl mx-auto">
                                <div className="p-6 bg-slate-900/60 rounded-2xl border border-slate-800 shadow-md space-y-4">
                                    <h3 className="text-sm font-black text-white uppercase tracking-tighter border-b border-slate-800 pb-2">Configuration</h3>
                                    <div className="grid grid-cols-1 gap-3">
                                        <input type="file" ref={fileInputRef} onChange={(e) => { const f = e.target.files?.[0]; if(f) props.onLoadFromDisk(f); }} className="hidden" />
                                        <Button onClick={props.onSaveToDisk} variant="secondary" title={t('tooltips.saveToDevice')} className="py-3 text-sm font-black bg-slate-800">
                                            <SaveIcon className="w-5 h-5" /> {t('controlPanel.saveToDevice')}
                                        </Button>
                                        <Button onClick={() => fileInputRef.current?.click()} variant="secondary" title={t('tooltips.loadFromDevice')} className="py-3 text-sm font-black bg-slate-800">
                                            <ListIcon className="w-5 h-5" /> {t('controlPanel.loadFromDevice')}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Restored Full Width Telemetry Log at the bottom of content area */}
                <div className="h-48 bg-black border-t border-red-900/30 shrink-0 flex flex-col">
                    <div className="bg-slate-900 px-4 py-2 border-b border-slate-800 flex justify-between items-center">
                        <span className="text-[10px] font-black text-slate-500 tracking-widest uppercase flex items-center gap-2">
                            <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-green-500 shadow-[0_0_5px_green]' : 'bg-red-500'}`}></div>
                            Telemetry & INDI Messages
                        </span>
                        <div className="flex gap-4">
                            <span className="text-[9px] font-mono text-slate-500 uppercase">Host: {props.connectionSettings.host}:{props.connectionSettings.port}</span>
                            <span className="text-[9px] font-mono text-red-600 font-bold uppercase">{props.connectionStatus}</span>
                        </div>
                    </div>
                    <div ref={logContainerRef} className="flex-1 p-3 font-mono text-xs text-slate-400 overflow-y-auto whitespace-pre-wrap leading-relaxed select-text scrollbar-thin scrollbar-thumb-red-900">
                        {logs.length > 0 ? logs.map((line, i) => <div key={i} className="mb-1 opacity-80 hover:opacity-100 transition-opacity border-l border-slate-800 pl-2">{line}</div>) : <div className="text-slate-700 italic">No incoming telemetry data...</div>}
                    </div>
                </div>
            </div>
        </div>
    );
};
