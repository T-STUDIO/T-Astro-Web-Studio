import React, { useState, useEffect, useCallback, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import { TSConnect } from '../components/TSConnect';
import { LanguageProvider, useTranslation } from '../contexts/LanguageContext';
import * as AstroService from '../services/AstroService';
import * as SettingsService from '../services/SettingsService';
import * as GoogleDriveService from '../services/GoogleDriveService';
import * as SampService from '../services/sampService';
import '../index.css';

import { 
  ConnectionStatus, ConnectionSettings, LocationData, TelescopePosition, 
  PlateSolverType, LocalSolverSettings, DeviceType, SampStatus, SampSettings,
  SavedLocation, SavedConnection, SavedApiKey, SavedLocalSolver, SavedSampSettings,
  LocationStatus, View, CelestialObject, PlanetariumSettings
} from '../types';

const TSConnectStandalone: React.FC = () => {
    const { t } = useTranslation();
    const initialSettings = SettingsService.loadSettings();

    // Connection & Devices
    const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('Disconnected');
    const [connectionSettings, setConnectionSettings] = useState<ConnectionSettings>(initialSettings.connectionSettings);
    const [shouldOpenDriverSelectorOnLoad, setShouldOpenDriverSelectorOnLoad] = useState(false);
    
    // Location, GPS & Time
    const [location, setLocation] = useState<LocationData | null>(initialSettings.location);
    const [locationStatus, setLocationStatus] = useState<LocationStatus>('Idle');
    const [localTime, setLocalTime] = useState<Date>(new Date());
    const [isTimeRunning, setIsTimeRunning] = useState(true);
    const [mountSyncStatus, setMountSyncStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');

    // Plate Solver Settings
    const [astrometryApiKey, setAstrometryApiKey] = useState(initialSettings.astrometryApiKey);
    const [plateSolverType, setPlateSolverType] = useState<PlateSolverType>(initialSettings.plateSolverType);
    const [localSolverSettings, setLocalSolverSettings] = useState<LocalSolverSettings>(initialSettings.localSolverSettings);

    // SAMP Hub Settings & State
    const [sampStatus, setSampStatus] = useState<SampStatus>('Disconnected');
    const [sampSettings, setSampSettings] = useState<SampSettings>(initialSettings.sampSettings);

    // Placeholder or dummy state for props required by TSConnect but not fully utilized in standalone view
    const [isLiveViewActive, setIsLiveViewActive] = useState(false);
    const [isVideoStreamActive, setIsVideoStreamActive] = useState(false);
    const [isPreviewLoading, setIsPreviewLoading] = useState(false);
    const [isCapturing, setIsCapturing] = useState(false);
    const [captureProgress, setCaptureProgress] = useState({ count: 0, total: 10 });
    const [latestImage, setLatestImage] = useState<string | null>(null);
    const [latestImageMetadata, setLatestImageMetadata] = useState<Record<string, any> | null>(null);
    const [latestImageFormat, setLatestImageFormat] = useState<string>('');
    const [colorBalance, setColorBalance] = useState({ r: 1.0, g: 1.0, b: 1.0 });
    const [selectedObject, setSelectedObject] = useState<CelestialObject | null>(null);
    
    // Save settings when changed
    useEffect(() => {
        const saved = SettingsService.loadSettings();
        SettingsService.saveSettings({
            ...saved,
            connectionSettings,
            location,
            astrometryApiKey,
            plateSolverType,
            localSolverSettings,
            sampSettings
        });
    }, [connectionSettings, location, astrometryApiKey, plateSolverType, localSolverSettings, sampSettings]);

    // Live clock ticks
    useEffect(() => {
        if (!isTimeRunning) return;
        const timer = setInterval(() => {
            setLocalTime(new Date());
        }, 1000);
        return () => clearInterval(timer);
    }, [isTimeRunning]);

    // GPS & IP Location Trackers
    const handleUpdateLocation = () => {
        if (!navigator.geolocation) {
            setLocationStatus('Error');
            return;
        }
        setLocationStatus('Loading');
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setLocation({
                    latitude: pos.coords.latitude,
                    longitude: pos.coords.longitude,
                    elevation: pos.coords.altitude || 0
                });
                setLocationStatus('Success');
            },
            (err) => {
                console.error('[TSConnectStandalone] Geolocation error:', err);
                setLocationStatus('Error');
            }
        );
    };

    const handleUpdateLocationIP = async () => {
        setLocationStatus('Loading');
        try {
            const res = await fetch('https://ipapi.co/json/');
            const data = await res.json();
            if (data && data.latitude && data.longitude) {
                setLocation({
                    latitude: data.latitude,
                    longitude: data.longitude,
                    elevation: 0
                });
                setLocationStatus('Success');
            } else {
                setLocationStatus('Error');
            }
        } catch (e) {
            console.error('[TSConnectStandalone] Failed to query IP location:', e);
            setLocationStatus('Error');
        }
    };

    const handleSendLocationToMount = async () => {
        if (!location || connectionStatus !== 'Connected') return;
        setMountSyncStatus('sending');
        try {
            await AstroService.sendLocation(location, new Date());
            setTimeout(() => { setMountSyncStatus('success'); }, 1000);
        } catch (e) {
            console.error('[TSConnectStandalone] Save location context failed', e);
            setMountSyncStatus('error');
        }
    };

    // Connect & Disconnect Loops
    const handleConnect = async () => {
        setConnectionStatus('Connecting');
        const ok = await AstroService.connect(connectionSettings);
        if (ok) {
            setConnectionStatus('Connected');
        } else {
            setConnectionStatus('Disconnected');
            const host = (connectionSettings.host || '').trim();
            const isLocalHost = host === '' || host === 'localhost' || host === '127.0.0.1';
            if (connectionSettings.driver === 'INDI' && isLocalHost) {
                setShouldOpenDriverSelectorOnLoad(true);
            }
        }
    };

    const handleDisconnect = () => {
        AstroService.disconnect();
        setConnectionStatus('Disconnected');
    };

    const handleConnectSamp = async () => {
        if (sampStatus === 'Connected') {
            await SampService.disconnect();
            setSampStatus('Disconnected');
        } else {
            setSampStatus('Connecting');
            try {
                await SampService.connect(sampSettings);
                setSampStatus('Connected');
            } catch (e) {
                console.error('[TSConnectStandalone] SAMP connection error', e);
                setSampStatus('Disconnected');
            }
        }
    };

    const handleOpenDeviceSettings = (type: DeviceType, name: string) => {
        console.log(`[TSConnectStandalone] Device Settings opened: ${type} - ${name}`);
    };

    return (
        <div className="w-screen h-screen overflow-hidden bg-[#020617] text-slate-100 flex flex-col">
            <header className="bg-slate-900 border-b border-slate-800 px-6 py-4 shrink-0 flex justify-between items-center z-10 shadow-md">
                <div className="flex items-center gap-3">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-600 animate-pulse"></div>
                    <h1 className="text-sm font-black tracking-widest text-slate-200 uppercase font-mono">
                        TS-Connect Standalone Panel
                    </h1>
                </div>
                <div className="text-[10px] font-mono text-slate-500 font-extrabold select-none">
                    V2026.0210
                </div>
            </header>

            <div className="flex-1 min-h-0 relative">
                <TSConnect 
                    onClose={() => {}}
                    isStandalone={true}
                    connectionStatus={connectionStatus}
                    connectionSettings={connectionSettings}
                    onSettingsChange={setConnectionSettings}
                    onConnect={handleConnect}
                    onDisconnect={handleDisconnect}
                    shouldOpenDriverSelectorOnLoad={shouldOpenDriverSelectorOnLoad}
                    onDriverSelectorOpened={() => setShouldOpenDriverSelectorOnLoad(false)}
                    location={location}
                    locationStatus={locationStatus}
                    onUpdateLatitude={(lat: number) => setLocation(prev => ({ ...prev || { latitude: 0, longitude: 0 }, latitude: lat }))}
                    onUpdateLongitude={(lon: number) => setLocation(prev => ({ ...prev || { latitude: 0, longitude: 0 }, longitude: lon }))}
                    onUpdateElevation={(elev: number) => setLocation(prev => ({ ...prev || { latitude: 0, longitude: 0 }, elevation: elev }))}
                    onUpdateLocation={handleUpdateLocation}
                    onUpdateLocationIP={handleUpdateLocationIP}
                    onSendLocationToMount={handleSendLocationToMount}
                    mountSyncStatus={mountSyncStatus}
                    localTime={localTime}
                    onSetTimeNow={() => { setLocalTime(new Date()); setIsTimeRunning(true); }}
                    isTimeRunning={isTimeRunning}
                    plateSolverType={plateSolverType}
                    onSetPlateSolverType={setPlateSolverType}
                    astrometryApiKey={astrometryApiKey}
                    onSetAstrometryApiKey={setAstrometryApiKey}
                    localSolverSettings={localSolverSettings}
                    onSetLocalSolverSettings={setLocalSolverSettings}
                    onSaveToDisk={() => {}}
                    onLoadFromDisk={() => {}}
                    isDriveConnected={false}
                    onExportSettings={() => {}}
                    onImportSettings={() => {}}
                    onConnectDrive={() => {}}
                    onShowDiagnostics={() => {}}
                    onOpenDeviceSettings={handleOpenDeviceSettings}
                    isAutoSyncLocationEnabled={false}
                    onToggleAutoSyncLocation={() => {}}
                    sampStatus={sampStatus}
                    sampSettings={sampSettings}
                    onSampSettingsChange={(s) => setSampSettings(prev => ({ ...prev, ...s }))}
                    onConnectSamp={handleConnectSamp}
                    onDisconnectSamp={async () => { await SampService.disconnect(); setSampStatus('Disconnected'); }}
                    
                    isCapturing={isCapturing}
                    captureProgress={captureProgress}
                    selectedObject={selectedObject}
                    isLiveViewActive={isLiveViewActive}
                    isVideoStreamActive={isVideoStreamActive}
                    isPreviewLoading={isPreviewLoading}
                    latestImage={latestImage}
                    latestImageMetadata={latestImageMetadata}
                    latestImageFormat={latestImageFormat}
                    colorBalance={colorBalance}
                    setActiveView={() => {}}
                />
            </div>
        </div>
    );
};

const rootEl = document.getElementById('root');
if (rootEl) {
    ReactDOM.createRoot(rootEl).render(
        <LanguageProvider>
            <TSConnectStandalone />
        </LanguageProvider>
    );
}
