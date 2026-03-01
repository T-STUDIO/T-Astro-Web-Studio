
import React, { useState, useEffect } from 'react';
import { View, CelestialObject, SlewStatus, PlanetariumSettings, LocationData, TelescopePosition, PlateSolverType, LocalSolverSettings } from '../types';
import { Planetarium } from './Planetarium';
import { ImagingView } from './ImagingView';
import { LinkedMiniView } from './LinkedMiniView';
import { useTranslation } from '../contexts/LanguageContext';
import { CloseIcon } from './icons/CloseIcon';

interface MainViewProps {
  activeView: View;
  setActiveView: (view: View) => void;
  isCapturing: boolean;
  captureProgress: { count: number, total: number };
  selectedObject: CelestialObject | null;
  onSelectObject: (object: CelestialObject | null) => void;
  slewStatus: SlewStatus;
  planetariumSettings: PlanetariumSettings;
  onAnnotationClick: (objectName: string) => void;
  centerRequest?: number;
  localTime?: Date | null;
  location?: LocationData | null;
  isConnected: boolean;
  onSlew: () => void;
  onCenter: (object: CelestialObject) => void;
  isLiveViewActive: boolean; 
  isVideoStreamActive?: boolean;
  isPreviewLoading?: boolean; 
  latestImage?: string | null;
  latestImageMetadata?: Record<string, any> | null;
  telescopePosition?: TelescopePosition | null;
  astrometryApiKey?: string;
  onSetAstrometryApiKey?: (key: string) => void;
  plateSolverType?: PlateSolverType;
  localSolverSettings?: LocalSolverSettings;
  colorBalance?: { r: number, g: number, b: number };
  latestImageFormat?: string; 
  hideTabs?: boolean;
  onStopStream?: () => void;
  isAutoCenterEnabled?: boolean;
  onToggleAutoCenter?: (enabled: boolean) => void;
}

export const MainView: React.FC<MainViewProps> = ({
  activeView,
  setActiveView,
  isCapturing,
  captureProgress,
  selectedObject,
  onSelectObject,
  slewStatus,
  planetariumSettings,
  onAnnotationClick,
  centerRequest,
  localTime,
  location,
  isConnected,
  onSlew,
  onCenter,
  isLiveViewActive,
  isVideoStreamActive = false,
  isPreviewLoading,
  latestImage,
  latestImageMetadata,
  telescopePosition,
  astrometryApiKey,
  onSetAstrometryApiKey,
  plateSolverType,
  localSolverSettings,
  colorBalance,
  latestImageFormat,
  hideTabs = false,
  onStopStream,
  isAutoCenterEnabled,
  onToggleAutoCenter
}) => {
  const { t } = useTranslation();
  const [miniPreviewVisible, setMiniPreviewVisible] = useState(true);

  const isActivityRunning = isLiveViewActive || isVideoStreamActive || isCapturing || isPreviewLoading;

  useEffect(() => {
      if (isActivityRunning) {
          setMiniPreviewVisible(true);
      }
  }, [isActivityRunning]);

  return (
    <main className="flex flex-col bg-black relative shrink-0 w-full h-full order-1 lg:flex-1 lg:order-2">
      
      {!hideTabs && (
        <div className="flex p-2 bg-slate-900 border-b border-red-900/30 gap-2 shrink-0">
          <button
            onClick={() => setActiveView('Planetarium')}
            disabled={isCapturing}
            className={`flex-1 px-4 py-3 text-sm font-medium rounded-md transition-colors touch-manipulation ${
              activeView === 'Planetarium' ? 'bg-red-700 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-red-300'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {t('mainView.planetarium')}
          </button>
          <button
            onClick={() => setActiveView('Imaging')}
            className={`flex-1 px-4 py-3 text-sm font-medium rounded-md transition-colors touch-manipulation ${
              activeView === 'Imaging' ? 'bg-red-700 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-red-300'
            }`}
          >
            {t('mainView.imaging')}
          </button>
        </div>
      )}

      <div className="flex-1 relative overflow-hidden">
        <div 
            className="absolute inset-0 w-full h-full"
            style={{ 
                visibility: activeView === 'Planetarium' ? 'visible' : 'hidden',
                zIndex: activeView === 'Planetarium' ? 10 : 0
            }}
        >
            <Planetarium 
                onSelectObject={(obj) => onSelectObject(obj)}
                onShowInfo={onAnnotationClick} 
                selectedObject={selectedObject} 
                slewStatus={slewStatus} 
                settings={planetariumSettings} 
                centerRequest={centerRequest}
                localTime={localTime}
                location={location}
                isConnected={isConnected}
                onSlew={onSlew}
                onCenter={onCenter}
                telescopePosition={telescopePosition}
                isAutoCenterEnabled={isAutoCenterEnabled}
                onToggleAutoCenter={onToggleAutoCenter}
            />
        </div>

        <div 
            className="absolute inset-0 w-full h-full bg-[#020617]"
            style={{ 
                visibility: activeView === 'Imaging' ? 'visible' : 'hidden',
                zIndex: activeView === 'Imaging' ? 10 : 0
            }}
        >
            <ImagingView 
                isCapturing={isCapturing} 
                captureProgress={captureProgress} 
                selectedObject={selectedObject} 
                onSelectObject={onSelectObject}
                onShowInfo={onAnnotationClick}
                location={location}
                localTime={localTime}
                isLiveViewActive={isLiveViewActive}
                isVideoMode={isVideoStreamActive}
                isPreviewLoading={isPreviewLoading}
                externalImage={latestImage}
                externalMetadata={latestImageMetadata} 
                apiKey={astrometryApiKey}
                onApiKeyChange={onSetAstrometryApiKey}
                plateSolverType={plateSolverType}
                localSolverSettings={localSolverSettings}
                colorBalance={colorBalance || {r:128,g:128,b:128}}
                externalImageFormat={latestImageFormat}
                onStopStream={onStopStream}
            />
        </div>

        {/* 修正：モバイルでのMiniビューを左端に寄せ、ボトムバーとのマージンを最適化 */}
        {activeView === 'Planetarium' && isActivityRunning && miniPreviewVisible && (
            <div className="absolute bottom-11 left-1.5 w-32 h-24 sm:w-48 sm:h-32 md:top-4 md:right-4 md:bottom-auto md:left-auto z-40 animate-fadeIn pointer-events-auto">
                <LinkedMiniView 
                    isCapturing={isCapturing}
                    captureProgress={captureProgress}
                    selectedObject={selectedObject}
                    location={location || null}
                    localTime={localTime || null}
                    isLiveViewActive={isLiveViewActive}
                    isVideoStreamActive={isVideoStreamActive}
                    isPreviewLoading={isPreviewLoading}
                    latestImage={latestImage || null}
                    latestImageMetadata={latestImageMetadata || null}
                    latestImageFormat={latestImageFormat || ''}
                    colorBalance={colorBalance || {r:128,g:128,b:128}}
                    plateSolverType={plateSolverType || 'Remote'}
                    localSolverSettings={localSolverSettings || {host:'localhost', port:6000}}
                    setActiveView={setActiveView}
                />
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        setMiniPreviewVisible(false);
                    }}
                    className="absolute -top-1 -right-1 bg-slate-900/95 hover:bg-red-700 text-white p-0.5 rounded-full border border-white/10 z-50 shadow-2xl transition-all"
                    title={t('common.close')}
                >
                    <CloseIcon className="w-3 h-3" />
                </button>
            </div>
        )}
      </div>
    </main>
  );
};
