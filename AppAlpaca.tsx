import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  View, CelestialObject, SlewStatus, PlanetariumSettings, LocationData, 
  ConnectionStatus, ConnectionSettings, TabType, LogEntry, TelescopePosition,
  PlateSolverType, LocalSolverSettings, DeviceType, SampStatus, SampSettings,
  SavedLocation, SavedConnection, SavedApiKey, SavedLocalSolver, SavedSampSettings,
  LocationStatus
} from './types';
import { HeaderAlpaca as Header } from './components/HeaderAlpaca';
import { HelpModal } from './components/HelpModal';
import { ControlPanelAlpaca as ControlPanel } from './components/ControlPanelAlpaca';
import { MainViewAlpaca as MainView } from './components/MainViewAlpaca';
import { StatusBarAlpaca as StatusBar } from './components/StatusBarAlpaca';
import { GeminiInfoModal } from './components/GeminiInfoModal';
import { DeviceSettingsModalAlpaca as DeviceSettingsModal } from './components/DeviceSettingsModalAlpaca';
import { DiagnosticsModalAlpaca as DiagnosticsModal } from './components/DiagnosticsModalAlpaca';
import { AlpacaControlPanel } from './components/AlpacaControlPanel';
import { useTranslation } from './contexts/LanguageContext';
import { StarIcon } from './components/icons/StarIcon';
import { CameraIcon } from './components/icons/CameraIcon';
import { TelescopeIcon } from './components/icons/TelescopeIcon';
import { VideoIcon } from './components/icons/VideoIcon';
import { ListIcon } from './components/icons/ListIcon';
import * as AstroService from './services/AstroServiceAlpaca';
import * as SettingsService from './services/SettingsService';
import * as GoogleDriveService from './services/GoogleDriveService';
import * as GeminiService from './services/geminiService';
import * as SampService from './services/sampService';
import { LiveStackingEngineAlpaca as LiveStackingEngine, setAstroService } from './services/LiveStackingEngineAlpaca';
import { CELESTIAL_OBJECTS } from './constants';
import { MountControllerAlpaca } from './components/MountControllerAlpaca';
import { AutoCenterService } from './services/AutoCenterService';
import { BroadcastService } from './viewer/BroadcastService';
import { hmsToDegrees, dmsToDegrees } from './utils/coords';

const AppAlpaca: React.FC = () => {
  const { t, language } = useTranslation();

  const initialSettings = SettingsService.loadSettings();

  const [activeView, setActiveView] = useState<View>('Planetarium');
  const [selectedObject, setSelectedObject] = useState<CelestialObject | null>(null);
  const [slewStatus, setSlewStatus] = useState<SlewStatus>('Idle');
  const [planetariumSettings, setPlanetariumSettings] = useState<PlanetariumSettings>(initialSettings.planetariumSettings);
  const [location, setLocation] = useState<LocationData | null>(initialSettings.location);
  const [locationStatus, setLocationStatus] = useState<LocationStatus>('Idle');
  const [localTime, setLocalTime] = useState<Date>(new Date());
  const [isTimeRunning, setIsTimeRunning] = useState(true);
  
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('Disconnected');
  const [connectionSettings, setConnectionSettings] = useState<ConnectionSettings>(initialSettings.connectionSettings);
  
  const handleSettingsChange = useCallback((newSettings: ConnectionSettings) => {
    console.log(`[AppAlpaca] handleSettingsChange called with driver: ${newSettings.driver}`);
    setConnectionSettings(newSettings);
  }, []);
  
  const [isLiveViewActive, setIsLiveViewActive] = useState(false);
  const [isVideoStreamActive, setIsVideoStreamActive] = useState(false);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [captureProgress, setCaptureProgress] = useState({ count: 0, total: 10 });
  
  const [latestImage, setLatestImage] = useState<string | null>(null);
  const [latestImageMetadata, setLatestImageMetadata] = useState<Record<string, any> | null>(null);
  const [latestImageFormat, setLatestImageFormat] = useState<string>('');

  const [exposure, setExposure] = useState(initialSettings.exposure);
  const [gain, setGain] = useState(initialSettings.gain);
  const [offset, setOffset] = useState(initialSettings.offset);
  const [brightness, setBrightness] = useState(initialSettings.brightnessFactor || 1.0);
  const [binning, setBinning] = useState(initialSettings.binning);
  const [colorBalance, setColorBalance] = useState(initialSettings.colorBalance);
  
  const [astrometryApiKey, setAstrometryApiKey] = useState(initialSettings.astrometryApiKey);
  const [plateSolverType, setPlateSolverType] = useState<PlateSolverType>(initialSettings.plateSolverType);
  const [localSolverSettings, setLocalSolverSettings] = useState<LocalSolverSettings>(initialSettings.localSolverSettings);
  const [isAutoCenterEnabled, setIsAutoCenterEnabled] = useState(initialSettings.isAutoCenterEnabled);
  const [isAutoSyncLocationEnabled, setIsAutoSyncLocationEnabled] = useState(initialSettings.isAutoSyncLocationEnabled);

  const [mountSyncStatus, setMountSyncStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [mobileActiveTab, setMobileActiveTab] = useState<TabType>('planetarium');
  const [telescopePosition, setTelescopePosition] = useState<TelescopePosition | null>({ ra: 0, dec: 90 });

  const [alpacaDevices, setAlpacaDevices] = useState<any[]>([]);
  const [alpacaMessageCount, setAlpacaMessageCount] = useState(0);
  const [cameraCapabilities, setCameraCapabilities] = useState<any>(null);

  useEffect(() => {
    console.log("[AppAlpaca] Rendering Alpaca App Component");
  }, []);

  const [sampStatus, setSampStatus] = useState<SampStatus>('Disconnected');
  const [sampSettings, setSampSettings] = useState<SampSettings>(initialSettings.sampSettings);

  const [savedLocations, setSavedLocations] = useState<SavedLocation[]>(initialSettings.savedLocations);
  const [savedConnections, setSavedConnections] = useState<SavedConnection[]>(initialSettings.savedConnections);
  const [savedApiKeys, setSavedApiKeys] = useState<SavedApiKey[]>(initialSettings.savedApiKeys);
  const [savedLocalSolvers, setSavedLocalSolvers] = useState<SavedLocalSolver[]>(initialSettings.savedLocalSolvers);
  const [savedSampSettings, setSavedSampSettings] = useState<SavedSampSettings[]>(initialSettings.savedSampSettings);

  const [isGeminiModalOpen, setIsGeminiModalOpen] = useState(false);
  const [geminiContent, setGeminiContent] = useState('');
  const [isGeminiLoading, setIsGeminiLoading] = useState(false);

  const [isDeviceSettingsOpen, setIsDeviceSettingsOpen] = useState(false);
  const [selectedDeviceType, setSelectedDeviceType] = useState<DeviceType | null>(null);
  const [selectedDeviceName, setSelectedDeviceName] = useState<string>('');

  const [isDiagnosticsOpen, setIsDiagnosticsOpen] = useState(false);
  const [isAlpacaControlPanelOpen, setIsAlpacaControlPanelOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isDriveConnected, setIsDriveConnected] = useState(false);

  const prevConnectionStatus = useRef<ConnectionStatus>('Disconnected');

  const addLog = useCallback((key: string, substitutions: any = {}, type: LogEntry['type'] = 'info') => {
    const entry: LogEntry = {
      timestamp: new Date().toLocaleTimeString(),
      message: t(key, substitutions),
      type
    };
    setLogs(prev => [entry, ...prev].slice(0, 100));
  }, [t]);

  const onSendLocationToMount = useCallback(async () => {
    if (!location || connectionStatus !== 'Connected') return;
    setMountSyncStatus('sending');
    addLog('logs.autoSyncTriggered');
    try {
      AstroService.sendLocation(location, new Date());
      setTimeout(() => { setMountSyncStatus('success'); }, 1000);
    } catch (e: any) {
      setMountSyncStatus('error');
      addLog('logs.locationError', { message: e.message || 'Sync failed' }, 'error');
    }
  }, [location, connectionStatus, addLog]);

  useEffect(() => {
    SampService.init((status) => {
      setSampStatus(status);
    });
    return () => {
      SampService.disconnect();
    };
  }, []);

  useEffect(() => {
    if (sampStatus === 'Connected') {
      if (telescopePosition) {
        SampService.sendSkyCoord(telescopePosition.ra, telescopePosition.dec);
      } else if (selectedObject) {
        const ra = hmsToDegrees(selectedObject.ra);
        const dec = dmsToDegrees(selectedObject.dec);
        SampService.sendSkyCoord(ra, dec);
      }
    }
  }, [sampStatus, telescopePosition, selectedObject]);

  useEffect(() => {
    if (!isAutoSyncLocationEnabled) return;
    const isConnectedNow = connectionStatus === 'Connected';
    const wasDisconnected = prevConnectionStatus.current !== 'Connected';
    if (isConnectedNow && (wasDisconnected || location)) {
      setTimeout(() => {
        onSendLocationToMount();
       }, 3000);
    }
    prevConnectionStatus.current = connectionStatus;
  }, [location, connectionStatus, isAutoSyncLocationEnabled, onSendLocationToMount]);

  useEffect(() => {
    if (connectionStatus !== 'Connected') { setMountSyncStatus('idle'); }
  }, [connectionStatus]);

  useEffect(() => {
    let timer: any;
    if (isTimeRunning) { timer = setInterval(() => { setLocalTime(new Date()); }, 1000); }
    return () => clearInterval(timer);
  }, [isTimeRunning]);

  useEffect(() => {
    setAstroService(AstroService);
  }, []);

  useEffect(() => {
    AstroService.setImageReceivedCallback(async (url, format, metadata) => {
    BroadcastService.getInstance().sendImage(url, metadata); 
        if (isCapturing) {
            const stackedUrl = await LiveStackingEngine.getInstance().processNewFrame(url, metadata);
            if (stackedUrl) {
              BroadcastService.getInstance().sendImage(stackedUrl, metadata); 
                setLatestImage(stackedUrl);
                setLatestImageFormat('jpeg');
                setIsPreviewLoading(false);
                return;
            }
        }

        // 撮影モードがすべてOFFで、プレビュー読み込み中でもない場合は、遅れて届いた古いフレームとして無視する
        if (!isLiveViewActive && !isVideoStreamActive && !isPreviewLoading) {
            console.log("[AppAlpaca] Ignoring late image frame");
            return;
        }

        setLatestImage(url);
        setLatestImageFormat(format);
        setLatestImageMetadata(metadata || null);
        setIsPreviewLoading(false);
    });
    AstroService.setTelescopePositionCallback(pos => setTelescopePosition(pos));
    AstroService.setDeviceCallback(devs => setAlpacaDevices(devs));
    AstroService.setMessageCountCallback(count => setAlpacaMessageCount(count));
    AstroService.setCameraCapabilitiesCallback(caps => setCameraCapabilities(caps));
    setAlpacaDevices(AstroService.getDevices());
    return () => {
        AstroService.setImageReceivedCallback(null);
        AstroService.setTelescopePositionCallback(null);
        AstroService.setDeviceCallback(null);
        AstroService.setMessageCountCallback(null);
        AstroService.setCameraCapabilitiesCallback(null);
    };
  }, [isCapturing, isLiveViewActive, isVideoStreamActive, isPreviewLoading]);

  useEffect(() => {
    SettingsService.saveSettings({
      connectionSettings, planetariumSettings, exposure, gain, offset, brightness, binning, colorBalance,
      astrometryApiKey, plateSolverType, localSolverSettings, isAutoCenterEnabled, isAutoSyncLocationEnabled,
      sampSettings, location, savedLocations, savedConnections, savedApiKeys, savedLocalSolvers, savedSampSettings,
      lastSaveTimestamp: new Date().toISOString()
    } as any);
  }, [connectionSettings, planetariumSettings, exposure, gain, offset, brightness, binning, colorBalance, astrometryApiKey, plateSolverType, localSolverSettings, isAutoCenterEnabled, isAutoSyncLocationEnabled, sampSettings, location, savedLocations, savedConnections, savedApiKeys, savedLocalSolvers, savedSampSettings]);

  const handleSetBrightness = (val: number) => {
    setBrightness(val);
    LiveStackingEngine.getInstance().setBrightness(val);
  };

  const stopAllImaging = useCallback(() => {
    setIsLiveViewActive(false);
    setIsVideoStreamActive(false);
    setIsCapturing(false);
    setIsPreviewLoading(false);
    AstroService.stopLoop();
    AstroService.stopStream();
    AstroService.stopCapture();
    setLatestImage(null);
    setLatestImageMetadata(null);
    LiveStackingEngine.getInstance().stop();
  }, [AstroService]);

  const handleMobileTabChange = (tab: TabType) => {
      setMobileActiveTab(tab);
      if (tab === 'planetarium') setActiveView('Planetarium');
      else if (tab === 'imaging_view') setActiveView('Imaging');
  };

  const handleUpdateLocation = useCallback(() => {
    if (!navigator.geolocation) { addLog('logs.locationNotSupported'); return; }
    setLocationStatus('Updating');
    addLog('logs.locationFetching');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const newLoc = { latitude: pos.coords.latitude, longitude: pos.coords.longitude, elevation: pos.coords.altitude || 0 };
        setLocation(newLoc); setLocationStatus('Success'); setLocalTime(new Date()); setIsTimeRunning(true);
        addLog('logs.locationSuccess', { latitude: newLoc.latitude.toFixed(4), longitude: newLoc.longitude.toFixed(4) }, 'success');
      },
      (err) => { setLocationStatus('Error'); addLog('logs.locationError', { message: err.message }, 'error'); },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }, [addLog]);

  const handleUpdateLocationIP = useCallback(async () => {
    if (!navigator.geolocation) { addLog('logs.locationNotSupported'); return; }
    setLocationStatus('Updating'); addLog('logs.locationWebFetching');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const newLoc = { latitude: pos.coords.latitude, longitude: pos.coords.longitude, elevation: pos.coords.altitude || 0 };
        setLocation(newLoc); setLocationStatus('Success'); setLocalTime(new Date()); setIsTimeRunning(true);
        addLog('logs.locationSuccess', { latitude: pos.coords.latitude.toFixed(4), longitude: pos.coords.longitude.toFixed(4) }, 'success');
      },
      (err) => { setLocationStatus('Error'); addLog('logs.locationError', { message: err.message }, 'error'); },
      { enableHighAccuracy: false, timeout: 20000, maximumAge: 0 }
    );
  }, [addLog]);

  const handleSaveToDisk = async () => {
    const currentSettings = {
      connectionSettings, planetariumSettings, exposure, gain, offset, binning, colorBalance,
      astrometryApiKey, plateSolverType, localSolverSettings, isAutoCenterEnabled, isAutoSyncLocationEnabled,
      sampSettings, location, savedLocations, savedConnections, savedApiKeys, savedLocalSolvers, savedSampSettings
    };
    await SettingsService.exportSettingsToFile(currentSettings as any);
    addLog('logs.settingsExported', { fileName: 't-astro-settings.json' }, 'success');
  };

  const handleLoadFromDisk = async (file: File) => {
    try {
      const s = await SettingsService.importSettingsFromFile(file);
      setConnectionSettings(s.connectionSettings); setPlanetariumSettings(s.planetariumSettings);
      setExposure(s.exposure); setGain(s.gain); setOffset(s.offset); setBrightness(s.brightnessFactor || 1.0); setBinning(s.binning); setColorBalance(s.colorBalance);
      setAstrometryApiKey(s.astrometryApiKey); setPlateSolverType(s.plateSolverType); setLocalSolverSettings(s.localSolverSettings);
      setIsAutoCenterEnabled(s.isAutoCenterEnabled); setIsAutoSyncLocationEnabled(s.isAutoSyncLocationEnabled);
      setSampSettings(s.sampSettings); setLocation(s.location);
      setSavedLocations(s.savedLocations || []); setSavedConnections(s.savedConnections || []);
      setSavedApiKeys(s.savedApiKeys || []); setSavedLocalSolvers(s.savedLocalSolvers || []); setSavedSampSettings(s.savedSampSettings || []);
      addLog('logs.settingsImported', {}, 'success');
    } catch (e: any) { addLog('logs.settingsImportError', { message: e.message }, 'error'); }
  };

  const handleToggleLiveView = () => {
      const targetState = !isLiveViewActive;
      stopAllImaging();
      if (targetState) { setIsLiveViewActive(true); AstroService.startStream(); setActiveView('Imaging'); setMobileActiveTab('imaging_view'); }
  };

  const handleToggleVideoStream = () => {
      const targetState = !isVideoStreamActive;
      if (targetState) {
          if (isLiveViewActive) { setIsLiveViewActive(false); AstroService.stopStream(); }
          if (isCapturing) { setIsCapturing(false); LiveStackingEngine.getInstance().stop(); }
          setIsPreviewLoading(false);
          setLatestImage(null);
          setLatestImageMetadata(null);
          setIsVideoStreamActive(true); 
          AstroService.setVideoStream(true); 
          setActiveView('Imaging'); 
          setMobileActiveTab('imaging_view'); 
      } else {
          setIsVideoStreamActive(false); 
          AstroService.setVideoStream(false);
      }
  };

  const handlePreview = async () => {
      stopAllImaging(); setIsPreviewLoading(true); setActiveView('Imaging'); setMobileActiveTab('imaging_view');
      await AstroService.capturePreview(exposure, gain, offset);
  };

  const handleStartCapture = async () => {
      stopAllImaging(); setIsCapturing(true); setActiveView('Imaging'); setMobileActiveTab('imaging_view');
      setCaptureProgress({ count: 0, total: 0 });
      addLog('logs.captureStarted', { objectName: selectedObject?.name || 'Target', total: 'Infinite', exposure, gain, offset });
      
      await LiveStackingEngine.getInstance().start(
          exposure, gain, offset, colorBalance,
          (count) => {
              setCaptureProgress(prev => ({ ...prev, count }));
              if (count > 0 && count % 5 === 0) addLog('logs.captureProgress', { count, total: '??' });
          },
          (errorMsg) => {
              setIsCapturing(false);
              addLog('logs.captureError', { message: errorMsg }, 'error');
          }
      );
  };

  const handleSlew = async () => {
    await AutoCenterService.execute({
      target: selectedObject,
      isAutoCenterEnabled,
      connectionStatus,
      exposure, gain, offset,
      solverType: plateSolverType,
      apiKey: astrometryApiKey,
      localSettings: localSolverSettings,
      setStatus: setSlewStatus,
      addLog: addLog,
      astroService: AstroService
    });
  };

  const handleShowGeminiInfo = async (name: string) => {
      const obj = CELESTIAL_OBJECTS.find(o => o.name === name) || selectedObject;
      if (!obj) return;
      setIsGeminiModalOpen(true); setIsGeminiLoading(true);
      try { const info = await GeminiService.getObjectInfo(obj.name, language); setGeminiContent(info); } 
      finally { setIsGeminiLoading(false); }
  };

  const [windowSize, setWindowSize] = useState({ 
    width: typeof window !== 'undefined' ? window.innerWidth : 1024, 
    height: typeof window !== 'undefined' ? window.innerHeight : 768 
  });

  useEffect(() => {
    const handleResize = () => setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isDesktop = windowSize.width >= 1024;
  const isTablet = windowSize.width >= 768 && windowSize.width < 1024;
  const isSmartphone = windowSize.width < 768;
  const isLandscape = windowSize.width > windowSize.height;
  const showRotateOverlay = isSmartphone && isLandscape;

  const showControlPanel = isDesktop || (isTablet && isLandscape) || (mobileActiveTab !== 'planetarium' && mobileActiveTab !== 'imaging_view');
  const showMainView = isDesktop || (isTablet && isLandscape) || (mobileActiveTab === 'planetarium' || mobileActiveTab === 'imaging_view');

  return (
    <div className="flex flex-col h-[100dvh] bg-slate-950 text-slate-200 overflow-hidden">
      {showRotateOverlay && (
          <div className="fixed inset-0 z-[100] bg-slate-950 flex flex-col items-center justify-center p-6 text-center animate-fadeIn">
              <div className="w-16 h-16 mb-6 text-red-500 animate-bounce">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
              </div>
              <h2 className="text-xl font-bold text-white mb-3">画面を縦にしてください</h2>
              <p className="text-slate-400 text-sm leading-relaxed">
                  スマートフォンでの横画面表示には対応していません。<br />
                  端末を縦向きにしてご利用ください。
              </p>
          </div>
      )}
      <Header 
        currentDriver="Alpaca" 
        onToggleHelp={() => setIsHelpOpen(true)}
      />
      <div className="flex-1 flex overflow-hidden relative">
          <>
            {showControlPanel && (
                <div className={`h-full ${isDesktop ? 'w-80 lg:w-96' : (isTablet && isLandscape) ? 'w-72' : 'w-full'} z-10 bg-slate-900 border-r border-red-900/30 shrink-0`}>
                    <ControlPanel 
                        mobileTab={mobileActiveTab}
                        connectionStatus={connectionStatus}
                        connectionSettings={connectionSettings}
                        onSettingsChange={handleSettingsChange}
                        onConnect={async () => {
                            setConnectionStatus('Connecting');
                            const ok = await AstroService.connect(connectionSettings);
                            setConnectionStatus(ok ? 'Connected' : 'Error');
                            if (ok) { addLog('logs.connectSuccess', {}, 'success'); }
                        }}
                        onDisconnect={() => { AstroService.disconnect(); setConnectionStatus('Disconnected'); }}
                        planetariumSettings={planetariumSettings}
                        onPlanetariumSettingsChange={(s: any) => setPlanetariumSettings(prev => ({ ...prev, ...s }))}
                        location={location}
                        onUpdateLatitude={(lat: number) => setLocation(prev => ({ ...prev || { latitude: 0, longitude: 0 }, latitude: lat }))}
                        onUpdateLongitude={(lon: number) => setLocation(prev => ({ ...prev || { latitude: 0, longitude: 0 }, longitude: lon }))}
                        onUpdateElevation={(elev: number) => setLocation(prev => ({ ...prev || { latitude: 0, longitude: 0 }, elevation: elev }))}
                        localTime={localTime}
                        onSetTime={setLocalTime}
                        isTimeRunning={isTimeRunning}
                        onSetTimeNow={() => { setLocalTime(new Date()); setIsTimeRunning(true); }}
                        locationStatus={locationStatus}
                        onUpdateLocation={handleUpdateLocation}
                        onUpdateLocationIP={handleUpdateLocationIP}
                        exposure={exposure} onSetExposure={setExposure}
                        gain={gain} onSetGain={setGain}
                        offset={offset} onSetOffset={setOffset}
                        brightness={brightness} onSetBrightness={handleSetBrightness}
                        binning={binning} onSetBinning={setBinning}
                        colorBalance={colorBalance} onSetColorBalance={setColorBalance}
                        isLiveViewActive={isLiveViewActive} onToggleLiveView={handleToggleLiveView}
                        isVideoStreamActive={isVideoStreamActive} onToggleVideoStream={handleToggleVideoStream}
                        isPreviewLoading={isPreviewLoading} onPreview={handlePreview}
                        isCapturing={isCapturing} onStartCapture={handleStartCapture} onStopCapture={() => setIsCapturing(false)}
                        captureProgress={captureProgress}
                        latestImage={latestImage}
                        latestImageMetadata={latestImageMetadata}
                        latestImageFormat={latestImageFormat}
                        astrometryApiKey={astrometryApiKey} onSetAstrometryApiKey={setAstrometryApiKey}
                        plateSolverType={plateSolverType} onSetPlateSolverType={setPlateSolverType}
                        localSolverSettings={localSolverSettings} onSetLocalSolverSettings={setLocalSolverSettings}
                        isAutoCenterEnabled={isAutoCenterEnabled} onToggleAutoCenter={setIsAutoCenterEnabled}
                        sampStatus={sampStatus}
                        sampSettings={sampSettings}
                        onSampSettingsChange={(s) => setSampSettings(prev => ({ ...prev, ...s }))}
                        onConnectSamp={async () => { 
                          if (sampStatus === 'Connected') {
                            SampService.disconnect();
                          } else {
                            setSampStatus('Connecting'); 
                            await SampService.connect(sampSettings);
                          }
                        }}
                        onConnectVirtualSamp={() => {
                          setSampStatus('Connecting');
                          SampService.connectInternal((status) => setSampStatus(status), sampSettings);
                        }}
                        onDisconnectSamp={() => SampService.disconnect()}
                        onSaveToDisk={handleSaveToDisk}
                        onLoadFromDisk={handleLoadFromDisk}
                        savedLocations={savedLocations} onSaveLocation={(name, data) => setSavedLocations(prev => [...prev, { name, data }])}
                        onUpdateSavedLocation={(idx, data) => setSavedLocations(prev => { const n = [...prev]; n[idx].data = data; return n; })}
                        onDeleteLocation={(idx) => setSavedLocations(prev => prev.filter((_, i) => i !== idx))}
                        savedConnections={savedConnections} onSaveConnection={(name, settings) => setSavedConnections(prev => [...prev, { name, settings }])}
                        onUpdateSavedConnection={(idx, settings) => setSavedConnections(prev => { const n = [...prev]; n[idx].settings = settings; return n; })}
                        onDeleteConnection={(idx) => setSavedConnections(prev => prev.filter((_, i) => i !== idx))}
                        savedApiKeys={savedApiKeys} onSaveApiKey={(name, key) => setSavedApiKeys(prev => [...prev, { name, key }])}
                        onDeleteApiKey={(idx) => setSavedApiKeys(prev => prev.filter((_, i) => i !== idx))}
                        savedLocalSolvers={savedLocalSolvers} onSaveLocalSolver={(name, settings) => setSavedLocalSolvers(prev => [...prev, { name, settings }])}
                        onDeleteLocalSolver={(idx) => setSavedLocalSolvers(prev => prev.filter((_, i) => i !== idx))}
                        savedSampSettings={savedSampSettings} onSaveSampSettings={(name, settings) => setSavedSampSettings(prev => [...prev, { name, settings }])}
                        onOpenDeviceSettings={(type: DeviceType, name: string) => { setSelectedDeviceType(type); setSelectedDeviceName(name); setIsDeviceSettingsOpen(true); }}
                        onOpenAlpacaControlPanel={() => setIsAlpacaControlPanelOpen(true)}
                        onShowDiagnostics={() => setIsDiagnosticsOpen(true)}
                        alpacaDevices={alpacaDevices}
                        alpacaMessageCount={alpacaMessageCount}
                        cameraCapabilities={cameraCapabilities}
                        isAutoSyncLocationEnabled={isAutoSyncLocationEnabled}
                        onToggleAutoSyncLocation={setIsAutoSyncLocationEnabled}
                        onSendLocationToMount={onSendLocationToMount}
                        mountSyncStatus={mountSyncStatus}
                        activeView={activeView}
                        setActiveView={setActiveView}
                    />
                </div>
            )}
            {showMainView && (
                <div className="flex-1 h-full">
                    <MainView 
                        activeView={activeView}
                        setActiveView={setActiveView}
                        isCapturing={isCapturing}
                        captureProgress={captureProgress}
                        selectedObject={selectedObject}
                        onSelectObject={setSelectedObject}
                        slewStatus={slewStatus}
                        planetariumSettings={planetariumSettings}
                        onAnnotationClick={handleShowGeminiInfo}
                        location={location}
                        isConnected={connectionStatus === 'Connected'}
                        onSlew={handleSlew}
                        onCenter={setSelectedObject}
                        isLiveViewActive={isLiveViewActive}
                        isVideoStreamActive={isVideoStreamActive}
                        isPreviewLoading={isPreviewLoading}
                        latestImage={latestImage}
                        latestImageMetadata={latestImageMetadata}
                        latestImageFormat={latestImageFormat}
                        telescopePosition={telescopePosition}
                        astrometryApiKey={astrometryApiKey}
                        onSetAstrometryApiKey={setAstrometryApiKey}
                        plateSolverType={plateSolverType}
                        localSolverSettings={localSolverSettings}
                        colorBalance={colorBalance}
                        isAutoCenterEnabled={isAutoCenterEnabled}
                        onToggleAutoCenter={setIsAutoCenterEnabled}
                        onStopStream={stopAllImaging}
                        MountController={MountControllerAlpaca}
                        hideTabs={isDesktop || (isTablet && isLandscape) ? false : true} 
                    />
                </div>
            )}
          </>
      </div>
      <StatusBar logs={logs} />
      
      {!isDesktop && !(isTablet && isLandscape) && (
          <nav className="h-16 bg-slate-900 border-t border-red-900/30 flex items-center justify-around z-40 px-1 shrink-0 pb-safe">
              <button onClick={() => handleMobileTabChange('planetarium')} className={`flex-1 min-w-0 flex flex-col items-center gap-1 transition-colors ${mobileActiveTab === 'planetarium' ? 'text-red-400' : 'text-slate-500'}`} title={t('tooltips.planetariumTab')}>
                  <StarIcon className="w-5 h-5 shrink-0" />
                  <span className="text-[9px] font-bold uppercase truncate w-full text-center px-0.5">{t('mainView.planetarium')}</span>
              </button>
              <button onClick={() => handleMobileTabChange('imaging_view')} className={`flex-1 min-w-0 flex flex-col items-center gap-1 transition-colors ${mobileActiveTab === 'imaging_view' ? 'text-red-400' : 'text-slate-500'}`} title={t('tooltips.imagingTab')}>
                  <CameraIcon className="w-5 h-5 shrink-0" />
                  <span className="text-[9px] font-bold uppercase truncate w-full text-center px-0.5">{t('sidebar.view') || 'View'}</span>
              </button>
              <button onClick={() => handleMobileTabChange('equipment')} className={`flex-1 min-w-0 flex flex-col items-center gap-1 transition-colors ${mobileActiveTab === 'equipment' ? 'text-red-400' : 'text-slate-500'}`} title={t('tooltips.equipmentTab')}>
                  <TelescopeIcon className="w-5 h-5 shrink-0" />
                  <span className="text-[9px] font-bold uppercase truncate w-full text-center px-0.5">{t('sidebar.equip') || 'Equip'}</span>
              </button>
              <button onClick={() => handleMobileTabChange('imaging_control')} className={`flex-1 min-w-0 flex flex-col items-center gap-1 transition-colors ${mobileActiveTab === 'imaging_control' ? 'text-red-400' : 'text-slate-500'}`} title={t('tooltips.imagingControlTab')}>
                  <VideoIcon className="w-5 h-5 shrink-0" />
                  <span className="text-[9px] font-bold uppercase truncate w-full text-center px-0.5">{t('sidebar.ctrl') || 'Ctrl'}</span>
              </button>
              <button onClick={() => handleMobileTabChange('settings')} className={`flex-1 min-w-0 flex flex-col items-center gap-1 transition-colors ${mobileActiveTab === 'settings' ? 'text-red-400' : 'text-slate-500'}`} title={t('tooltips.settingsTab')}>
                  <ListIcon className="w-5 h-5 shrink-0" />
                  <span className="text-[9px] font-bold uppercase truncate w-full text-center px-0.5">{t('sidebar.set') || 'Set'}</span>
              </button>
          </nav>
      )}

      <GeminiInfoModal 
        isOpen={isGeminiModalOpen}
        isLoading={isGeminiLoading}
        content={geminiContent}
        object={selectedObject}
        realtimeData={null}
        onClose={() => setIsGeminiModalOpen(false)}
        onGoTo={handleSlew}
        onCenter={setSelectedObject}
        isConnected={connectionStatus === 'Connected'}
      />
      <DeviceSettingsModal 
        isOpen={isDeviceSettingsOpen} 
        deviceType={selectedDeviceType} 
        deviceName={selectedDeviceName}
        onClose={() => setIsDeviceSettingsOpen(false)} 
        selectedObject={selectedObject} 
        location={location} 
        localTime={localTime} 
        telescopePosition={telescopePosition} 
        planetariumSettings={planetariumSettings} 
        latestImage={latestImage} 
        latestImageMetadata={latestImageMetadata}
        latestImageFormat={latestImageFormat}
        isLiveViewActive={isLiveViewActive} 
        isCapturing={isCapturing} 
        colorBalance={colorBalance} 
        onSwitchView={setActiveView} 
        onCenter={setSelectedObject} 
        onSlew={handleSlew} 
        isConnected={connectionStatus === 'Connected'}
      />
      <DiagnosticsModal isOpen={isDiagnosticsOpen} onClose={() => setIsDiagnosticsOpen(false)} currentSettings={connectionSettings} />
      {isAlpacaControlPanelOpen && (
        <AlpacaControlPanel 
          onClose={() => setIsAlpacaControlPanelOpen(false)}
          host={connectionSettings?.host || ''}
          port={connectionSettings?.port || 11111}
        />
      )}
      <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
    </div>
  );
};

export default AppAlpaca;
