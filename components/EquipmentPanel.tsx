import React, { memo } from 'react';
import { useTranslation } from '../contexts/LanguageContext';
import { AstroService } from '../services/AstroService';
import { INDIDevice } from '../types';
import { Button, SexagesimalInput, Switch } from './CommonUI';
import { DisconnectIcon, GpsIcon, ListIcon } from './icons';

export const EquipmentPanel = memo((props: any) => {
    const { t } = useTranslation();
    const { 
        connectionStatus, onDisconnect, onSyncGPS, onOpenDeviceSettings,
        indiDevices, indiMessageCount, useDynamicDeviceList, isAlpaca, isINDI
    } = props;

    const activeMountName = AstroService.getActiveMount();
    const mountDevice = (indiDevices || []).find((d: INDIDevice) => d.name === activeMountName);
    
    const raProp = mountDevice?.properties?.get('EQUATORIAL_EOD_COORD')?.elements?.get('RA');
    const decProp = mountDevice?.properties?.get('EQUATORIAL_EOD_COORD')?.elements?.get('DEC');

    const handleCoordChange = (type: 'RA' | 'DEC', value: number) => {
        if (activeMountName && connectionStatus === 'Connected') {
            AstroService.updateDeviceSetting(activeMountName, 'EQUATORIAL_EOD_COORD', { [type]: value });
        }
    };

    return (
    <div className="space-y-4">
        <div className="flex justify-between items-center border-b border-red-900/50 pb-2 mb-2">
            <h2 className="text-lg font-semibold text-red-400">{t('controlPanel.equipmentStatus')}</h2>
            {activeMountName && (
                <button 
                    onClick={() => onOpenDeviceSettings('Mount', activeMountName)}
                    title={t('tooltips.deviceSettings')}
                    className="text-[10px] px-2 py-1 bg-slate-800 hover:bg-red-900/40 text-slate-300 border border-slate-700 rounded transition-colors"
                >
                    {t('controlPanel.mountSettings')}
                </button>
            )}
        </div>

        {connectionStatus === 'Connected' && activeMountName && (
            <div className="space-y-3 p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                <div className="flex items-center justify-between mb-1">
                    <h3 className="text-xs font-bold text-slate-500 uppercase">{t('controlPanel.mountCoordinates')}</h3>
                    <span className="text-[10px] text-slate-400 font-mono">{activeMountName}</span>
                </div>
                
                <div className="grid grid-cols-1 gap-3">
                    <SexagesimalInput 
                        label="RA" 
                        value={raProp?.value || 0} 
                        isRA={true} 
                        onChange={(val) => handleCoordChange('RA', val)}
                        title={t('tooltips.ra')}
                    />
                    <SexagesimalInput 
                        label="DEC" 
                        value={decProp?.value || 0} 
                        isRA={false} 
                        onChange={(val) => handleCoordChange('DEC', val)}
                        title={t('tooltips.dec')}
                    />
                </div>
                
                <div className="pt-2 border-t border-slate-700/50 mt-2">
                    <Button onClick={onSyncGPS} variant="secondary" className="w-full text-xs" title={t('tooltips.gpsSync')}>
                        <GpsIcon className="w-4 h-4" /> {t('controlPanel.syncGPS')}
                    </Button>
                </div>
            </div>
        )}

        <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
                <h3 className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1">
                    <ListIcon className="w-3 h-3" /> {t('controlPanel.deviceList')}
                </h3>
                {isINDI && (
                    <span className="text-[10px] text-slate-600">
                        {t('controlPanel.receivedPackets', { count: indiMessageCount })}
                    </span>
                )}
            </div>
            
            <div className="max-h-[200px] overflow-y-auto pr-1 custom-scrollbar">
                {useDynamicDeviceList ? (
                    (indiDevices || []).length === 0 ? (
                        <div className="p-4 border border-dashed border-slate-700 rounded space-y-3 text-center">
                            <div className="w-4 h-4 border-2 border-t-transparent border-slate-500 rounded-full animate-spin mx-auto mb-2"></div>
                            <span className="text-xs text-slate-500 italic">{t('controlPanel.searchingDevices')}</span>
                            <button onClick={() => AstroService.refreshIndiDevices()} className="block mx-auto text-xs bg-slate-700 hover:bg-slate-600 text-white px-3 py-1 rounded">
                                {t('controlPanel.forceRefresh')}
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {(indiDevices || []).map((dev: INDIDevice) => (
                                <div key={dev.name} className="flex items-center justify-between p-2 bg-slate-800/60 rounded border border-slate-700 hover:border-slate-600">
                                    <div className="flex items-center gap-2 overflow-hidden">
                                        <div className={`w-2 h-2 rounded-full ${dev.connected ? 'bg-green-500 shadow-[0_0_5px_rgba(34,197,94,0.6)]' : 'bg-slate-600'}`}></div>
                                        <span className="text-sm text-slate-200 font-mono truncate" title={dev.name}>{dev.name}</span>
                                        {dev.type && (
                                            <span className="text-[10px] text-slate-500 bg-slate-800 px-1 rounded">
                                                {t(`deviceType.${dev.type}`)}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Switch 
                                            checked={dev.connected} 
                                            onChange={() => dev.connected ? AstroService.disconnectIndiDevice(dev.name) : AstroService.connectIndiDevice(dev.name)} 
                                            title={dev.connected ? t('controlPanel.disconnect') : t('controlPanel.connect')} 
                                        />
                                        {!isAlpaca && (
                                            <button 
                                                className="p-1 hover:bg-slate-600 rounded text-red-400 hover:text-red-200" 
                                                title={t('tooltips.deviceSettings')}
                                                onClick={() => onOpenDeviceSettings(dev.type || 'Camera', dev.name)}
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2-2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 0 2.83 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                            <div className="pt-2 text-center">
                                <button onClick={() => AstroService.refreshIndiDevices()} className="text-[10px] text-slate-500 hover:text-slate-300 underline">
                                    {t('controlPanel.refreshDeviceList')}
                                </button>
                            </div>
                        </div>
                    )
                ) : (
                    <div className="grid grid-cols-1 gap-2">
                        {['Camera', 'Mount', 'Focuser', 'FilterWheel'].map(device => (
                            <div key={device} className="flex items-center justify-between p-2 bg-slate-800/60 rounded hover:bg-slate-700 transition-colors border border-transparent hover:border-red-900/30">
                                <span className="text-sm text-slate-300">{t(`deviceType.${device}`)}</span>
                                <button 
                                    onClick={() => onOpenDeviceSettings(device, device)} 
                                    className="p-1 hover:bg-slate-600 rounded text-red-400 hover:text-red-300"
                                    title={t('tooltips.deviceSettings')}
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2-2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 0 2.83 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>

        <Button onClick={onDisconnect} variant="danger" className="w-full mt-4" title="Disconnect from all network devices.">
            <DisconnectIcon className="w-5 h-5" /> {t('controlPanel.disconnect')}
        </Button>
    </div>
    );
});
