
import React, { useState, useEffect, useCallback } from 'react';
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
    const [refreshKey, setRefreshKey] = useState(0);

    // デバイスリストを取得する（パネルを開いた時点と更新ボタン押下時）
    const refreshDevices = useCallback(() => {
        const devs = alpacaClient.getConfiguredDevices();
        setDevices(devs);
        // 選択中のデバイスが消えた場合はリセット
        if (selectedDevice && !devs.find(d => d.uniqueId === selectedDevice.uniqueId)) {
            setSelectedDevice(null);
            setProperties({});
        }
    }, [selectedDevice]);

    useEffect(() => {
        refreshDevices();
        // デバイスリスト更新コールバックを登録
        alpacaClient.setDeviceUpdateCallback((devs) => {
            setDevices([...devs]);
        });
        return () => {
            // クリーンアップ：コールバックを解除しない（AppAlpaca側で管理）
        };
    }, []);

    const fetchProperties = useCallback(async () => {
        if (!selectedDevice) return;
        setIsLoading(true);
        try {
            let props: Record<string, any> = {};
            if (selectedDevice.deviceType === 'Telescope') {
                props = await alpacaClient.getTelescopeStatus(selectedDevice.deviceNumber) || {};
            } else if (selectedDevice.deviceType === 'Camera') {
                props = await alpacaClient.getCameraStatus(selectedDevice.deviceNumber) || {};
            } else {
                props = await alpacaClient.getDeviceStatus(selectedDevice.deviceType, selectedDevice.deviceNumber) || {};
            }
            setProperties(props);
        } finally {
            setIsLoading(false);
        }
    }, [selectedDevice]);

    useEffect(() => {
        if (selectedDevice) {
            fetchProperties();
        }
    }, [selectedDevice, refreshKey]);

    const handleUpdateProperty = async (propName: string, value: any) => {
        if (!selectedDevice) return;
        const res = await alpacaClient.putCommand(selectedDevice.deviceType, selectedDevice.deviceNumber, propName, { [propName]: value });
        if (res && res.ErrorNumber === 0) {
            setRefreshKey(k => k + 1);
        } else {
            alert(`Error updating ${propName}: ${res?.ErrorMessage || 'Unknown error'}`);
        }
    };

    const handleConnectDevice = async (dev: AlpacaDevice) => {
        const isConnected = (dev as any).connected;
        await alpacaClient.setDeviceConnected(dev.deviceType, dev.deviceNumber, !isConnected);
        refreshDevices();
        if (selectedDevice?.uniqueId === dev.uniqueId) {
            setRefreshKey(k => k + 1);
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
                    <div className="flex items-center gap-2">
                        <Button onClick={refreshDevices} variant="secondary" className="text-xs h-8 px-3">
                            Refresh Devices
                        </Button>
                        <button onClick={onClose} className="p-2 hover:bg-red-900/20 rounded-full transition-colors">
                            <CloseIcon className="w-6 h-6 text-slate-400" />
                        </button>
                    </div>
                </div>
                
                <div className="flex-1 flex overflow-hidden">
                    {/* Device List */}
                    <div className="w-64 border-r border-red-900/20 bg-slate-900/50 overflow-y-auto p-2">
                        <h3 className="text-[10px] font-bold text-slate-500 uppercase mb-2 px-2">
                            Devices ({devices.length})
                        </h3>
                        {devices.length === 0 ? (
                            <p className="text-xs text-slate-600 italic px-2 py-4">No devices found.<br/>Check connection.</p>
                        ) : (
                            devices.map((dev, i) => (
                                <div key={dev.uniqueId || i} className={`rounded mb-1 border transition-colors ${selectedDevice?.uniqueId === dev.uniqueId ? 'bg-red-900/30 border-red-900/50' : 'border-transparent hover:bg-slate-800'}`}>
                                    <button 
                                        onClick={() => setSelectedDevice(dev)}
                                        className="w-full text-left px-3 py-2 text-sm"
                                    >
                                        <div className="flex items-center gap-2">
                                            <div className={`w-2 h-2 rounded-full shrink-0 ${(dev as any).connected ? 'bg-green-500' : 'bg-slate-600'}`} />
                                            <span className={`font-bold truncate ${selectedDevice?.uniqueId === dev.uniqueId ? 'text-red-400' : 'text-slate-300'}`}>
                                                {dev.deviceName}
                                            </span>
                                        </div>
                                        <div className="text-[10px] text-slate-500 mt-0.5 pl-4">
                                            {dev.deviceType} #{dev.deviceNumber}
                                        </div>
                                    </button>
                                    <div className="px-3 pb-2">
                                        <button
                                            onClick={() => handleConnectDevice(dev)}
                                            className={`w-full text-[10px] py-1 rounded border font-bold transition-colors ${(dev as any).connected ? 'bg-red-900/40 border-red-700 text-red-400 hover:bg-red-900/60' : 'bg-slate-700 border-slate-600 text-slate-400 hover:bg-slate-600'}`}
                                        >
                                            {(dev as any).connected ? 'Disconnect' : 'Connect'}
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Properties List */}
                    <div className="flex-1 overflow-y-auto p-6 bg-slate-900">
                        {selectedDevice ? (
                            <div className="space-y-6">
                                <div className="flex justify-between items-center border-b border-slate-800 pb-4">
                                    <div>
                                        <h3 className="text-lg font-bold text-slate-200">{selectedDevice.deviceName}</h3>
                                        <p className="text-xs text-slate-500">{selectedDevice.uniqueId}</p>
                                        <p className="text-xs text-slate-500 mt-0.5">
                                            Status: <span className={(selectedDevice as any).connected ? 'text-green-400' : 'text-slate-500'}>
                                                {(selectedDevice as any).connected ? 'Connected' : 'Disconnected'}
                                            </span>
                                        </p>
                                    </div>
                                    <Button onClick={() => setRefreshKey(k => k + 1)} disabled={isLoading} variant="secondary" className="text-xs h-8">
                                        {isLoading ? 'Refreshing...' : 'Refresh'}
                                    </Button>
                                </div>

                                {isLoading ? (
                                    <div className="flex items-center justify-center py-12">
                                        <div className="w-8 h-8 border-2 border-t-transparent border-red-500 rounded-full animate-spin" />
                                    </div>
                                ) : Object.keys(properties).length === 0 ? (
                                    <div className="text-center py-12 text-slate-600 italic text-sm">
                                        {(selectedDevice as any).connected ? 'No properties available.' : 'Connect the device to view properties.'}
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {Object.entries(properties).map(([key, value]) => (
                                            <div key={key} className="bg-slate-800/40 p-3 rounded border border-slate-800 flex flex-col gap-2">
                                                <div className="flex justify-between items-center">
                                                    <span className="text-xs font-bold text-slate-400 uppercase">{key}</span>
                                                    <span className={`text-xs font-mono ${value === true ? 'text-green-400' : value === false ? 'text-slate-500' : 'text-red-400'}`}>
                                                        {String(value)}
                                                    </span>
                                                </div>
                                                
                                                {/* Toggle for boolean properties */}
                                                {typeof value === 'boolean' && (
                                                    <div className="flex gap-2">
                                                        <button 
                                                            onClick={() => handleUpdateProperty(key, true)}
                                                            className={`flex-1 py-1 text-[10px] rounded border transition-colors ${value === true ? 'bg-red-900/40 border-red-500 text-red-400' : 'bg-slate-700 border-slate-600 text-slate-400 hover:bg-slate-600'}`}
                                                        >
                                                            True
                                                        </button>
                                                        <button 
                                                            onClick={() => handleUpdateProperty(key, false)}
                                                            className={`flex-1 py-1 text-[10px] rounded border transition-colors ${value === false ? 'bg-red-900/40 border-red-500 text-red-400' : 'bg-slate-700 border-slate-600 text-slate-400 hover:bg-slate-600'}`}
                                                        >
                                                            False
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-slate-600 gap-2">
                                <p className="italic">Select a device from the list to view its properties.</p>
                                {devices.length === 0 && (
                                    <p className="text-xs text-slate-700">No devices are registered. Check your Alpaca server configuration.</p>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
