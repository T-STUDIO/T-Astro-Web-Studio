
import React, { useState, useEffect } from 'react';
import { AlpacaDevice, alpacaClient } from '../services/AlpacaClientService';
import { Button } from './Button';
import { CloseIcon } from './icons/CloseIcon';
import { useTranslation } from '../contexts/LanguageContext';
import { RefreshCw, AlertCircle } from 'lucide-react';

interface AlpacaControlPanelProps {
    onClose: () => void;
    host: string;
    port: number;
}

export const AlpacaControlPanel: React.FC<AlpacaControlPanelProps> = ({ onClose, host, port }) => {
    const { t } = useTranslation();
    const [devices, setDevices] = useState<AlpacaDevice[]>([]);
    const [selectedDevice, setSelectedDevice] = useState<AlpacaDevice | null>(null);
    const [properties, setProperties] = useState<Record<string, any>>({});
    const [isLoading, setIsLoading] = useState(false);

    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setDevices(alpacaClient.getConfiguredDevices());
    }, []);

    useEffect(() => {
        if (selectedDevice) {
            fetchProperties();
        }
    }, [selectedDevice]);

    const fetchProperties = async () => {
        if (!selectedDevice) return;
        setIsLoading(true);
        setError(null);
        
        try {
            let props: Record<string, any> = {};
            const deviceType = selectedDevice.deviceType;
            const deviceNumber = selectedDevice.deviceNumber;

            // Define properties to fetch based on device type
            let propList: string[] = ['Connected', 'Name', 'Description'];
            if (deviceType === 'Telescope') {
                propList = [...propList, 'AtHome', 'AtPark', 'Azimuth', 'Declination', 'RightAscension', 'Slewing', 'Tracking', 'CanSlew', 'CanPark'];
            } else if (deviceType === 'Camera') {
                propList = [...propList, 'CameraState', 'CCDTemperature', 'ImageReady', 'CoolerOn', 'CanSetCCDTemperature', 'CanAbortExposure'];
            } else if (deviceType === 'Focuser') {
                propList = [...propList, 'Position', 'IsMoving', 'MaxStep', 'StepSize', 'Temp'];
            }

            // Fetch in parallel to be faster
            const results = await Promise.all(
                propList.map(async (prop) => {
                    try {
                        const res = await alpacaClient.getCommand(deviceType, deviceNumber, prop);
                        return { prop, value: res && res.ErrorNumber === 0 ? res.Value : 'N/A' };
                    } catch (e) {
                        return { prop, value: 'Error' };
                    }
                })
            );

            results.forEach(({ prop, value }) => {
                props[prop] = value;
            });

            setProperties(props);
        } catch (error) {
            console.error("[AlpacaControlPanel] Error fetching properties:", error);
            setError("Failed to fetch properties. Check connection.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleUpdateProperty = async (propName: string, value: any) => {
        if (!selectedDevice) return;
        setError(null);
        
        try {
            const res = await alpacaClient.putCommand(selectedDevice.deviceType, selectedDevice.deviceNumber, propName, { [propName]: value });
            if (res && res.ErrorNumber === 0) {
                fetchProperties();
            } else {
                setError(`Error updating ${propName}: ${res?.ErrorMessage || 'Unknown error'}`);
            }
        } catch (e: any) {
            setError(`Failed to update ${propName}: ${e.message}`);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-2 sm:p-4">
            <div className="bg-slate-900 border border-red-900/50 rounded-xl w-full max-w-4xl h-[90vh] flex flex-col shadow-2xl overflow-hidden">
                <div className="p-3 border-b border-red-900/30 flex justify-between items-center bg-slate-800/50">
                    <div className="flex items-center gap-3">
                        <h2 className="text-base sm:text-lg font-bold text-red-400">{t('alpaca.controlPanel')}</h2>
                        <span className="hidden sm:inline text-[10px] text-slate-500 font-mono">{host}:{port}</span>
                    </div>
                    <button onClick={onClose} className="p-1.5 hover:bg-red-900/20 rounded-full transition-colors">
                        <CloseIcon className="w-5 h-5 text-slate-400" />
                    </button>
                </div>
                
                <div className="flex-1 flex flex-col sm:flex-row overflow-hidden">
                    {/* Device List */}
                    <div className="w-full sm:w-56 border-b sm:border-b-0 sm:border-r border-red-900/20 bg-slate-900/50 overflow-y-auto p-2 max-h-[150px] sm:max-h-none">
                        <div className="flex items-center justify-between mb-2 px-2">
                            <h3 className="text-[9px] font-bold text-slate-500 uppercase">{t('alpaca.devices')}</h3>
                            <button onClick={() => setDevices(alpacaClient.getConfiguredDevices())} className="text-slate-500 hover:text-slate-300">
                                <RefreshCw className="w-3 h-3" />
                            </button>
                        </div>
                        <div className="space-y-1">
                            {devices.length === 0 ? (
                                <p className="text-[10px] text-slate-600 p-2 italic">{t('alpaca.noDevices')}</p>
                            ) : (
                                devices.map((dev, i) => (
                                    <button 
                                        key={i}
                                        onClick={() => setSelectedDevice(dev)}
                                        className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors ${selectedDevice?.uniqueId === dev.uniqueId ? 'bg-red-900/30 text-red-400 border border-red-900/50' : 'text-slate-400 hover:bg-slate-800'}`}
                                    >
                                        <div className="font-bold truncate">{dev.deviceName}</div>
                                        <div className="text-[9px] opacity-60">{dev.deviceType} #{dev.deviceNumber}</div>
                                    </button>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Properties List */}
                    <div className="flex-1 overflow-y-auto p-3 sm:p-5 bg-slate-900 flex flex-col">
                        {selectedDevice ? (
                            <div className="flex flex-col h-full">
                                <div className="flex justify-between items-center border-b border-slate-800 pb-3 mb-4 shrink-0">
                                    <div className="min-w-0">
                                        <h3 className="text-base font-bold text-slate-200 truncate">{selectedDevice.deviceName}</h3>
                                        <p className="text-[10px] text-slate-500 truncate">{selectedDevice.uniqueId}</p>
                                    </div>
                                    <div className="flex gap-2 shrink-0">
                                        <Button 
                                            onClick={() => handleUpdateProperty('Connected', !properties.Connected)} 
                                            variant={properties.Connected === true ? "success" : "outline"}
                                            className="text-[10px] h-7 px-2"
                                        >
                                            {properties.Connected === true ? t('alpaca.connected') : t('alpaca.disconnected')}
                                        </Button>
                                        <Button onClick={fetchProperties} disabled={isLoading} variant="secondary" className="text-[10px] h-7 px-2">
                                            {isLoading ? t('alpaca.refresh') + '...' : t('alpaca.refresh')}
                                        </Button>
                                    </div>
                                </div>

                                {error && (
                                    <div className="mb-4 p-2 bg-red-900/20 border border-red-900/50 rounded flex items-center gap-2 text-red-400 text-xs shrink-0">
                                        <AlertCircle className="w-4 h-4" />
                                        <span>{error}</span>
                                    </div>
                                )}

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 overflow-y-auto pr-1 custom-scrollbar flex-1">
                                    {Object.entries(properties).map(([key, value]) => (
                                        <div key={key} className="bg-slate-800/40 p-2 rounded border border-slate-800 flex flex-col gap-1 h-fit">
                                            <div className="flex justify-between items-center">
                                                <span className="text-[9px] font-bold text-slate-500 uppercase">{key}</span>
                                                <span className={`text-[10px] font-mono ${typeof value === 'boolean' ? (value ? 'text-emerald-400' : 'text-red-400') : 'text-slate-300'}`}>
                                                    {String(value)}
                                                </span>
                                            </div>
                                            
                                            {typeof value === 'boolean' && (
                                                <div className="flex gap-1 mt-1">
                                                    <button 
                                                        onClick={() => handleUpdateProperty(key, true)}
                                                        disabled={isLoading}
                                                        className={`flex-1 py-1 text-[8px] rounded border transition-colors ${value === true ? 'bg-emerald-900/40 border-emerald-500 text-emerald-400' : 'bg-slate-700 border-slate-600 text-slate-400 hover:bg-slate-600'}`}
                                                    >
                                                        ON / TRUE
                                                    </button>
                                                    <button 
                                                        onClick={() => handleUpdateProperty(key, false)}
                                                        disabled={isLoading}
                                                        className={`flex-1 py-1 text-[8px] rounded border transition-colors ${value === false ? 'bg-red-900/40 border-red-500 text-red-400' : 'bg-slate-700 border-slate-600 text-slate-400 hover:bg-slate-600'}`}
                                                    >
                                                        OFF / FALSE
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-slate-600 italic gap-2">
                                <AlertCircle className="w-8 h-8 opacity-20" />
                                <p>{t('alpaca.selectDevice')}</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
