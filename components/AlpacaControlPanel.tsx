
import React, { useState, useEffect } from 'react';
import { AlpacaDevice, alpacaClient } from '../services/AlpacaClientService';
import { Button } from './Button';
import { CloseIcon } from './icons/CloseIcon';
import { useTranslation } from '../contexts/LanguageContext';

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
        let props = {};
        if (selectedDevice.deviceType === 'Telescope') {
            props = await alpacaClient.getTelescopeStatus(selectedDevice.deviceNumber) || {};
        } else if (selectedDevice.deviceType === 'Camera') {
            props = await alpacaClient.getCameraStatus(selectedDevice.deviceNumber) || {};
        } else {
            props = await alpacaClient.getDeviceStatus(selectedDevice.deviceType, selectedDevice.deviceNumber) || {};
        }
        setProperties(props);
        setIsLoading(false);
    };

    const handleUpdateProperty = async (propName: string, value: any) => {
        if (!selectedDevice) return;
        
        // Simple logic to determine if it's a PUT or GET
        // In Alpaca, settings are usually PUT
        const res = await alpacaClient.putCommand(selectedDevice.deviceType, selectedDevice.deviceNumber, propName, { [propName]: value });
        if (res && res.ErrorNumber === 0) {
            fetchProperties();
        } else {
            alert(`Error updating ${propName}: ${res?.ErrorMessage || 'Unknown error'}`);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-red-900/50 rounded-xl w-full max-w-5xl h-[85vh] flex flex-col shadow-2xl overflow-hidden">
                <div className="p-4 border-b border-red-900/30 flex justify-between items-center bg-slate-800/50">
                    <div className="flex items-center gap-4">
                        <h2 className="text-xl font-bold text-red-400">Alpaca Control Panel</h2>
                        <span className="text-xs text-slate-500 font-mono">{host}:{port}</span>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-red-900/20 rounded-full transition-colors">
                        <CloseIcon className="w-6 h-6 text-slate-400" />
                    </button>
                </div>
                
                <div className="flex-1 flex overflow-hidden">
                    {/* Device List */}
                    <div className="w-64 border-r border-red-900/20 bg-slate-900/50 overflow-y-auto p-2">
                        <h3 className="text-[10px] font-bold text-slate-500 uppercase mb-2 px-2">Devices</h3>
                        {devices.map((dev, i) => (
                            <button 
                                key={i}
                                onClick={() => setSelectedDevice(dev)}
                                className={`w-full text-left px-3 py-2 rounded mb-1 text-sm transition-colors ${selectedDevice?.uniqueId === dev.uniqueId ? 'bg-red-900/30 text-red-400 border border-red-900/50' : 'text-slate-400 hover:bg-slate-800'}`}
                            >
                                <div className="font-bold truncate">{dev.deviceName}</div>
                                <div className="text-[10px] opacity-60">{dev.deviceType} #{dev.deviceNumber}</div>
                            </button>
                        ))}
                    </div>

                    {/* Properties List */}
                    <div className="flex-1 overflow-y-auto p-6 bg-slate-900">
                        {selectedDevice ? (
                            <div className="space-y-6">
                                <div className="flex justify-between items-center border-b border-slate-800 pb-4">
                                    <div>
                                        <h3 className="text-lg font-bold text-slate-200">{selectedDevice.deviceName}</h3>
                                        <p className="text-xs text-slate-500">{selectedDevice.uniqueId}</p>
                                    </div>
                                    <Button onClick={fetchProperties} disabled={isLoading} variant="secondary" className="text-xs h-8">
                                        {isLoading ? 'Refreshing...' : 'Refresh'}
                                    </Button>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {Object.entries(properties).map(([key, value]) => (
                                        <div key={key} className="bg-slate-800/40 p-3 rounded border border-slate-800 flex flex-col gap-2">
                                            <div className="flex justify-between items-center">
                                                <span className="text-xs font-bold text-slate-400 uppercase">{key}</span>
                                                <span className="text-xs font-mono text-red-400">{String(value)}</span>
                                            </div>
                                            
                                            {/* Simple input for boolean properties */}
                                            {typeof value === 'boolean' && (
                                                <div className="flex gap-2">
                                                    <button 
                                                        onClick={() => handleUpdateProperty(key, true)}
                                                        className={`flex-1 py-1 text-[10px] rounded border ${value === true ? 'bg-red-900/40 border-red-500 text-red-400' : 'bg-slate-700 border-slate-600 text-slate-400'}`}
                                                    >
                                                        True
                                                    </button>
                                                    <button 
                                                        onClick={() => handleUpdateProperty(key, false)}
                                                        className={`flex-1 py-1 text-[10px] rounded border ${value === false ? 'bg-red-900/40 border-red-500 text-red-400' : 'bg-slate-700 border-slate-600 text-slate-400'}`}
                                                    >
                                                        False
                                                    </button>
                                                </div>
                                            )}

                                            {/* Simple input for numbers (if we know they are settable) */}
                                            {/* In a real app, we'd check 'CanSet...' properties */}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="h-full flex items-center justify-center text-slate-600 italic">
                                Select a device to view properties
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
