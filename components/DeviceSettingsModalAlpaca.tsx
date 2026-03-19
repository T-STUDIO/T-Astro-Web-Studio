import React, { useState, useEffect } from 'react';
import { CelestialObject, DeviceType, INDIVector, LocationData, PlanetariumSettings, SlewStatus, TelescopePosition, View } from '../types';
import { CloseIcon } from './icons/CloseIcon';
import { useTranslation } from '../contexts/LanguageContext';
import { Button } from './Button';
import * as AstroService from '../services/AstroServiceAlpaca';
import { Planetarium } from './Planetarium';
import { LinkedMiniView } from './LinkedMiniView';

interface DeviceSettingsModalProps {
    isOpen: boolean;
    deviceType: DeviceType | null;
    deviceName?: string;
    onClose: () => void;
    
    // Mini View Props
    selectedObject: CelestialObject | null;
    location: LocationData | null;
    localTime: Date | null;
    telescopePosition: TelescopePosition | null;
    planetariumSettings: PlanetariumSettings;
    latestImage: string | null;
    latestImageMetadata: Record<string, any> | null;
    latestImageFormat: string;
    isLiveViewActive: boolean;
    isCapturing: boolean;
    colorBalance: { r: number, g: number, b: number };
    onSwitchView: (view: View) => void;
    onCenter: (object: CelestialObject) => void;
    onSlew: () => void;
    isConnected: boolean;
}

export const DeviceSettingsModalAlpaca: React.FC<DeviceSettingsModalProps> = ({ 
    isOpen, 
    deviceType, 
    deviceName, 
    onClose,
    selectedObject,
    location,
    localTime,
    telescopePosition,
    planetariumSettings,
    latestImage,
    latestImageMetadata,
    latestImageFormat,
    isLiveViewActive,
    isCapturing,
    colorBalance,
    onSwitchView,
    onCenter,
    onSlew,
    isConnected
}) => {
    const { t } = useTranslation();
    const [properties, setProperties] = useState<INDIVector[]>([]);
    const [activeGroup, setActiveGroup] = useState<string>('');
    
    // Tracking editable states to prevent overwriting by polling
    const [editingValues, setEditingValues] = useState<Record<string, string>>({});

    useEffect(() => {
        if (isOpen && deviceName) {
            const updateProps = () => {
                const props = AstroService.getDeviceProperties(deviceName);
                setProperties(props);
            };
            
            updateProps();
            const interval = setInterval(updateProps, 1000);
            return () => clearInterval(interval);
        }
    }, [isOpen, deviceName]);

    // Calculate groups
    const groups = Array.from(new Set(properties.map(p => p.group || 'Main'))).sort();
    
    useEffect(() => {
        if (groups.length > 0) {
            if (!activeGroup || !groups.includes(activeGroup)) {
                setActiveGroup(groups[0]);
            }
        }
    }, [groups, activeGroup]);

    if (!isOpen) return null;

    const filteredProperties = properties.filter(p => (p.group || 'Main') === activeGroup);

    const handleApply = (vector: INDIVector, values: Record<string, any>) => {
        if (deviceName) {
            AstroService.updateDeviceSetting(deviceName, vector.name, values);
            const newEditing = { ...editingValues };
            Object.keys(values).forEach(k => {
                delete newEditing[`${vector.name}.${k}`];
            });
            setEditingValues(newEditing);
        }
    };

    const handleInputChange = (vectorName: string, elementName: string, val: string) => {
        setEditingValues(prev => ({ ...prev, [`${vectorName}.${elementName}`]: val }));
    };

    const renderVector = (vector: INDIVector) => {
        const isRO = vector.perm === 'ro';

        return (
            <div key={vector.name} className="bg-slate-800/50 p-3 rounded border border-slate-700 space-y-2">
                <div className="flex justify-between items-center">
                    <span className="text-sm font-semibold text-slate-200" title={vector.name}>{vector.label}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded ${vector.state === 'Ok' ? 'bg-green-900 text-green-300' : vector.state === 'Busy' ? 'bg-yellow-900 text-yellow-300' : vector.state === 'Alert' ? 'bg-red-900 text-red-300' : 'bg-slate-700 text-slate-400'}`}>
                        {vector.state}
                    </span>
                </div>

                {vector.type === 'Number' && (
                    <div className="space-y-2">
                        {Array.from(vector.elements.values()).map(el => {
                            const uniqueKey = `${vector.name}.${el.name}`;
                            const val = editingValues[uniqueKey] !== undefined ? editingValues[uniqueKey] : Number(el.value);
                            return (
                                <div key={el.name} className="flex flex-col gap-1">
                                    <div className="flex justify-between text-xs text-slate-400">
                                        <span>{el.label}</span>
                                        <span>{typeof el.value === 'number' ? el.value.toFixed(2) : el.value}</span>
                                    </div>
                                    <div className="flex gap-2">
                                        <input 
                                            type="number" 
                                            value={val}
                                            onChange={(e) => handleInputChange(vector.name, el.name, e.target.value)}
                                            step={el.step || 'any'}
                                            min={el.min}
                                            max={el.max}
                                            className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1 text-xs text-slate-200 focus:border-blue-500 focus:outline-none select-text"
                                            disabled={isRO}
                                        />
                                        {!isRO && (
                                            <button 
                                                onClick={() => {
                                                    const currentVal = editingValues[uniqueKey] ?? el.value;
                                                    handleApply(vector, { [el.name]: currentVal });
                                                }}
                                                className="px-2 py-1 bg-slate-600 hover:bg-slate-500 rounded text-xs text-white"
                                            >
                                                {t('deviceSettings.set')}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {vector.type === 'Switch' && (
                    <div className="flex flex-wrap gap-2">
                         {Array.from(vector.elements.values()).map(el => {
                             const isOn = el.value === true;
                             return (
                                 <button
                                    key={el.name}
                                    onClick={() => {
                                        if (!isRO) {
                                            let newVal = true;
                                            if (vector.rule === 'AnyOfMany') newVal = !isOn;
                                            else if (vector.rule === 'AtMostOne') newVal = !isOn;
                                            else newVal = true;
                                            handleApply(vector, { [el.name]: newVal });
                                        }
                                    }}
                                    disabled={isRO}
                                    className={`px-3 py-1 text-xs rounded border transition-colors ${isOn ? 'bg-red-700 border-red-500 text-white shadow-sm' : 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600'}`}
                                 >
                                     {el.label}
                                 </button>
                             );
                         })}
                    </div>
                )}

                {vector.type === 'Text' && (
                     <div className="space-y-2">
                        {Array.from(vector.elements.values()).map(el => {
                             const uniqueKey = `${vector.name}.${el.name}`;
                             const val = editingValues[uniqueKey] !== undefined ? editingValues[uniqueKey] : String(el.value);
                             return (
                                 <div key={el.name} className="flex gap-2 items-center">
                                     <span className="text-xs text-slate-400 w-1/3 truncate" title={el.label}>{el.label}</span>
                                     <input 
                                         type="text" 
                                         value={val}
                                         onChange={(e) => handleInputChange(vector.name, el.name, e.target.value)}
                                         className="flex-1 bg-slate-700 border border-slate-600 rounded px-2 py-1 text-xs text-slate-200 focus:border-blue-500 focus:outline-none select-text"
                                         disabled={isRO}
                                     />
                                     {!isRO && <button onClick={() => {
                                          const currentVal = editingValues[uniqueKey] ?? el.value;
                                          handleApply(vector, { [el.name]: currentVal });
                                     }} className="px-2 py-1 bg-slate-600 hover:bg-slate-500 rounded text-xs text-white">{t('deviceSettings.set')}</button>}
                                 </div>
                             );
                        })}
                     </div>
                )}
            </div>
        );
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex justify-center items-center z-50 p-4" onClick={onClose}>
            <div className="bg-slate-900 border border-red-900/50 rounded-lg shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col animate-fadeIn overflow-hidden" onClick={e => e.stopPropagation()}>
                <header className="flex justify-between items-center p-4 border-b border-red-900/30 bg-slate-800/80 shrink-0">
                    <h3 className="font-bold text-slate-100 flex items-center gap-2">
                        {deviceName} ({t(`deviceType.${deviceType || 'Mount'}`)})
                    </h3>
                    <button onClick={onClose}><CloseIcon className="w-5 h-5 text-slate-400 hover:text-white" /></button>
                </header>
                
                <div className="flex-1 flex overflow-hidden">
                    <div className="flex-1 flex flex-col min-w-0 border-r border-slate-700/50">
                        <div className="flex border-b border-slate-700 overflow-x-auto shrink-0 bg-slate-900">
                            {groups.map(g => (
                                <button
                                    key={g}
                                    onClick={() => setActiveGroup(g)}
                                    className={`px-4 py-2 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${activeGroup === g ? 'border-red-500 text-red-400 bg-slate-800' : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'}`}
                                >
                                    {g}
                                </button>
                            ))}
                        </div>

                        <div className="p-4 overflow-y-auto flex-1 space-y-4">
                            {filteredProperties.length === 0 ? (
                                <div className="text-center text-slate-500 py-8 italic">No properties in this group.</div>
                            ) : (
                                filteredProperties.map(renderVector)
                            )}
                        </div>
                    </div>

                    <div className="w-72 bg-black flex flex-col border-l border-red-900/30 shrink-0 p-3 gap-3">
                        <div className="flex-1 flex flex-col gap-3 min-h-0">
                            <div className="flex-1 relative border border-slate-800 rounded-lg overflow-hidden group">
                                <Planetarium 
                                    isMini={true}
                                    selectedObject={selectedObject}
                                    settings={planetariumSettings}
                                    location={location}
                                    localTime={localTime}
                                    telescopePosition={telescopePosition}
                                    isConnected={isConnected}
                                    slewStatus={'Idle'}
                                />
                                <div className="absolute top-2 left-2 bg-black/50 text-[9px] font-black text-slate-400 px-2 py-0.5 rounded backdrop-blur-md pointer-events-none group-hover:text-white group-hover:bg-red-900/50 transition-colors uppercase tracking-widest border border-white/5">
                                    Planetarium
                                </div>
                            </div>
                            
                            <div className="flex-1 flex flex-col min-h-0">
                                <LinkedMiniView 
                                    className="flex-1 border-none rounded-lg"
                                    isCapturing={isCapturing}
                                    captureProgress={{count:0, total:10}}
                                    selectedObject={selectedObject}
                                    location={location}
                                    localTime={localTime}
                                    isLiveViewActive={isLiveViewActive}
                                    isVideoStreamActive={false}
                                    isPreviewLoading={false}
                                    latestImage={latestImage}
                                    latestImageMetadata={latestImageMetadata}
                                    latestImageFormat={latestImageFormat}
                                    colorBalance={colorBalance}
                                    plateSolverType={'Remote'}
                                    localSolverSettings={{host:'localhost', port:6000}}
                                    setActiveView={() => {}}
                                />
                                <div className="mt-1 text-[9px] font-black text-slate-500 uppercase tracking-widest text-center">
                                    Synchronized Feed
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
