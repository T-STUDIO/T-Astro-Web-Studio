import React, { memo } from 'react';
import { useTranslation } from '../contexts/LanguageContext';
import { AstroService } from '../services/AstroService';
import { INDIDevice, INDIVector, INDIElement } from '../types';
import { Button, RangeSlider } from './CommonUI';
import { CameraIcon, StopIcon, VideoIcon } from './icons';
import { FocuserControl } from './FocuserControl';

export const ImagingPanel = memo((props: any) => {
    const { t } = useTranslation();
    const { 
        connectionStatus, isLiveViewActive, onToggleLiveView, exposure, gain, offset, binning, colorBalance,
        onSetExposure, onSetGain, onSetOffset, onSetBinning, onSetColorBalance, onPreview, isCapturing, onStartCapture, onStopCapture,
        indiDevices, isPreviewLoading, onToggleVideoStream, isVideoStreamActive, onOpenDeviceSettings
    } = props;

    const devices = (indiDevices || []) as INDIDevice[];
    const activeCameraName = AstroService.getActiveCamera();
    const activeFocuserName = AstroService.getActiveFocuser();
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
                        title={t('tooltips.deviceSettings')}
                        className="text-[10px] px-2 py-1 bg-slate-800 hover:bg-red-900/40 text-slate-300 border border-slate-700 rounded transition-colors"
                    >
                        カメラ
                    </button>
                )}
                {activeFocuserName && (
                    <button 
                        onClick={() => onOpenDeviceSettings('Focuser', activeFocuserName)}
                        title={t('tooltips.deviceSettings')}
                        className="text-[10px] px-2 py-1 bg-slate-800 hover:bg-red-900/40 text-slate-300 border border-slate-700 rounded transition-colors"
                    >
                        フォーカサー
                    </button>
                )}
                {activeMountName && (
                    <button 
                        onClick={() => onOpenDeviceSettings('Mount', activeMountName)}
                        title={t('tooltips.deviceSettings')}
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
                                    title={t('tooltips.encoder')}
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
             <RangeSlider id="cb-r" label={t('controlPanel.colorBalanceR')} title={t('tooltips.colorBalance')} value={colorBalance.r} min={0} max={255} step={1} onChange={(v) => onSetColorBalance({...colorBalance, r: v})} colorClass="bg-red-900/50" />
             <RangeSlider id="cb-g" label={t('controlPanel.colorBalanceG')} title={t('tooltips.colorBalance')} value={colorBalance.g} min={0} max={255} step={1} onChange={(v) => onSetColorBalance({...colorBalance, g: v})} colorClass="bg-green-900/50" />
             <RangeSlider id="cb-b" label={t('controlPanel.colorBalanceB')} title={t('tooltips.colorBalance')} value={colorBalance.b} min={0} max={255} step={1} onChange={(v) => onSetColorBalance({...colorBalance, b: v})} colorClass="bg-blue-900/50" />
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
