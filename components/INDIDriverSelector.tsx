import React, { useState, useEffect } from 'react';
import { CloseIcon } from './icons/CloseIcon';

interface INDIDriverSelectorProps {
    isOpen: boolean;
    onClose: () => void;
    onConnect: () => void; // Skip & Connect
    onStartSuccess: () => void; // Successfully started drivers on backend
}

export const INDIDriverSelector: React.FC<INDIDriverSelectorProps> = ({
    isOpen,
    onClose,
    onConnect,
    onStartSuccess
}) => {
    const [availableDrivers, setAvailableDrivers] = useState<any[]>([]);
    const [selectedDrivers, setSelectedDrivers] = useState<string[]>([]);
    const [isStartingDrivers, setIsStartingDrivers] = useState(false);

    useEffect(() => {
        if (!isOpen) return;
        const loadDrivers = async () => {
            try {
                console.log("[INDIDriverSelector] Loading available drivers list...");
                const res = await fetch('/api/indi/drivers');
                const data = await res.json();
                if (data.status === 'ok') {
                    setAvailableDrivers(data.drivers || []);
                }
            } catch (e) {
                console.error("[INDIDriverSelector] Error loading available drivers", e);
            }
        };
        loadDrivers();
    }, [isOpen]);

    if (!isOpen) return null;

    const handleToggleDriverSelection = (bin: string) => {
        setSelectedDrivers(prev => 
            prev.includes(bin) ? prev.filter(b => b !== bin) : [...prev, bin]
        );
    };

    const handleStartAndConnect = async () => {
        setIsStartingDrivers(true);
        try {
            const res = await fetch('/api/indi/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ drivers: selectedDrivers })
            });
            const data = await res.json();
            if (data.status === 'ok') {
                console.log('[INDIDriverSelector] Successfully started selected drivers batch.');
                onStartSuccess();
            } else {
                onConnect();
            }
        } catch (e) {
            console.error('[INDIDriverSelector] Error launching drivers:', e);
            onConnect(); // Fallback
        } finally {
            setIsStartingDrivers(false);
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 z-[999] animate-fadeIn">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-xl max-h-[85vh] flex flex-col shadow-[0_0_50px_rgba(239,68,68,0.15)] overflow-hidden">
                <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/80">
                    <div>
                        <h3 className="text-lg font-black text-white tracking-tight uppercase">INDI Driver Selection</h3>
                        <p className="text-[10px] font-black text-red-500 uppercase tracking-widest mt-0.5">Please select drivers to start in batch</p>
                    </div>
                    <button 
                        onClick={onClose}
                        className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-700 transition-all"
                    >
                        <CloseIcon className="w-4 h-4" />
                    </button>
                </div>

                <div className="flex-1 p-6 overflow-y-auto space-y-6 scrollbar-thin scrollbar-thumb-red-900">
                    {['CCDs', 'Telescopes', 'Focusers', 'Domes', 'Filter Wheels'].map(group => {
                        const groupDrivers = availableDrivers.filter(d => {
                            if (group === 'Filter Wheels') {
                                return d.group === 'Filter Wheels' || (!['CCDs', 'Telescopes', 'Focusers', 'Domes'].includes(d.group));
                            }
                            return d.group === group;
                        });

                        if (groupDrivers.length === 0) return null;

                        return (
                            <div key={group} className="space-y-2">
                                <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1">{group}</h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {groupDrivers.map(drv => {
                                        const isSelected = selectedDrivers.includes(drv.bin);
                                        return (
                                            <button
                                                key={drv.bin}
                                                onClick={() => handleToggleDriverSelection(drv.bin)}
                                                className={`p-3.5 rounded-xl border text-left flex items-center justify-between transition-all select-none ${
                                                    isSelected 
                                                    ? 'bg-red-950/30 border-red-500 text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.05)]' 
                                                    : 'bg-slate-800/50 border-slate-700 text-slate-300 hover:bg-slate-800 hover:border-slate-600'
                                                }`}
                                            >
                                                <div className="overflow-hidden pr-2">
                                                    <div className="text-xs font-black truncate">{drv.name}</div>
                                                    <div className={`text-[8px] font-mono font-bold mt-0.5 uppercase tracking-wide ${isSelected ? 'text-red-400' : 'text-slate-500'}`}>{drv.bin}</div>
                                                </div>
                                                <div className={`w-5 h-5 rounded-md flex items-center justify-center border-2 transition-all shrink-0 ${isSelected ? 'bg-red-600 border-red-500 text-white' : 'border-slate-600 bg-black/20'}`}>
                                                    {isSelected && (
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                                    )}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="p-6 border-t border-slate-800 bg-slate-900/80 flex flex-col sm:flex-row gap-3">
                    <button
                        onClick={() => {
                            onClose();
                            onConnect();
                        }}
                        className="flex-1 py-3.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 font-extrabold text-xs uppercase tracking-widest transition-all"
                    >
                        Skip & Connect
                    </button>
                    <button
                        onClick={handleStartAndConnect}
                        disabled={isStartingDrivers}
                        className="flex-[2] py-3.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-red-900/30 transition-all disabled:opacity-50"
                    >
                        {isStartingDrivers ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                Starting...
                            </>
                        ) : (
                            <>
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                                Start & Connect
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};
