
import React from 'react';
import { ImagingView } from './ImagingView';
import { View, CelestialObject, LocationData, PlateSolverType, LocalSolverSettings } from '../types';

interface LinkedMiniViewProps {
  isCapturing: boolean;
  captureProgress: { count: number, total: number };
  selectedObject: CelestialObject | null;
  location: LocationData | null;
  localTime: Date | null;
  isLiveViewActive: boolean;
  isVideoStreamActive: boolean;
  isPreviewLoading: boolean;
  latestImage: string | null;
  latestImageMetadata: Record<string, any> | null;
  latestImageFormat: string;
  colorBalance: { r: number, g: number, b: number };
  plateSolverType: PlateSolverType;
  localSolverSettings: LocalSolverSettings;
  setActiveView: (view: View) => void;
  className?: string;
}

export const LinkedMiniView: React.FC<LinkedMiniViewProps> = (props) => {
  const isActivityRunning = props.isLiveViewActive || props.isVideoStreamActive || props.isCapturing || props.isPreviewLoading;
  const hasContent = !!props.latestImage || isActivityRunning;

  return (
    <div 
      className={`relative w-full h-full bg-black border border-red-900/40 rounded-lg overflow-hidden cursor-pointer group hover:border-red-500 transition-all shadow-2xl ${props.className || ''}`}
      onClick={() => props.setActiveView('Imaging')}
      title="Click to switch to Full Image View"
    >
      {hasContent ? (
        <ImagingView 
          isMini={true}
          isCapturing={props.isCapturing}
          captureProgress={props.captureProgress}
          selectedObject={null}
          onSelectObject={() => {}}
          onShowInfo={() => {}}
          location={props.location}
          localTime={props.localTime}
          isLiveViewActive={props.isLiveViewActive}
          isVideoMode={props.isVideoStreamActive}
          isPreviewLoading={props.isPreviewLoading}
          externalImage={props.latestImage}
          externalMetadata={props.latestImageMetadata}
          externalImageFormat={props.latestImageFormat}
          colorBalance={props.colorBalance}
          plateSolverType={props.plateSolverType}
          localSolverSettings={props.localSolverSettings}
        />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#020617]">
          {/* Scanning lines effect for "professional monitor" feel */}
          <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06))', backgroundSize: '100% 2px, 3px 100%' }} />
          <div className="w-8 h-8 border border-red-900/40 rounded mb-2 flex items-center justify-center">
             <div className="w-1.5 h-1.5 bg-red-950 rounded-full animate-pulse" />
          </div>
          <span className="text-[10px] font-black text-red-950 tracking-[0.2em] uppercase italic">Standby</span>
        </div>
      )}
      
      {/* Overlay status bar */}
      <div className="absolute top-0 left-0 right-0 p-1.5 flex justify-between items-start pointer-events-none z-20">
        <div className="flex gap-1">
          <div className={`text-white text-[9px] px-2 py-0.5 rounded shadow-lg font-black tracking-tighter backdrop-blur-md border border-white/10 ${isActivityRunning ? 'bg-red-600 animate-pulse' : 'bg-slate-800 opacity-80'}`}>
            {props.isLiveViewActive || props.isVideoStreamActive ? 'LIVE' : isActivityRunning ? 'BUSY' : 'STANDBY'}
          </div>
          {props.isCapturing && props.captureProgress && (
            <div className="bg-red-950/80 text-red-400 text-[9px] px-2 py-0.5 rounded shadow-lg font-black tracking-tighter border border-red-500/30 backdrop-blur-md">
              {props.captureProgress.count} / {props.captureProgress.total === 0 ? '∞' : props.captureProgress.total}
            </div>
          )}
          {props.latestImage && !isActivityRunning && (
            <div className="bg-blue-600 text-white text-[9px] px-2 py-0.5 rounded shadow-lg font-black tracking-tighter border border-blue-400/50 backdrop-blur-md">
              SYNCED
            </div>
          )}
        </div>
      </div>
      
      <div className="absolute inset-0 bg-red-500/0 group-hover:bg-red-500/5 transition-colors pointer-events-none" />
    </div>
  );
};
