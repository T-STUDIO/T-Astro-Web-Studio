import React, { useState, useEffect } from 'react';
import { CloseIcon } from './icons/CloseIcon';

interface INDIDriverSelectorProps {
    isOpen: boolean;
    onClose: () => void;
    onConnect: () => void; // Skip & Connect
    onStartSuccess: () => void; // Successfully started drivers on backend
}

interface INDIProfile {
    name: string;
    drivers: string[];
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

    // Profiles State
    const [profiles, setProfiles] = useState<INDIProfile[]>([]);
    const [selectedProfileName, setSelectedProfileName] = useState<string>('');
    const [newProfileName, setNewProfileName] = useState<string>('');

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

        // Load profiles from localStorage
        const stored = localStorage.getItem('t-astro-indi-profiles');
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                setProfiles(parsed);
                // Pre-select first profile if exists
                if (parsed.length > 0) {
                    const firstProfile = parsed[0];
                    setSelectedProfileName(firstProfile.name);
                    setSelectedDrivers(firstProfile.drivers);
                }
            } catch (e) {
                console.error("[INDIDriverSelector] Stored profiles parsing error", e);
            }
        } else {
            const defaults: INDIProfile[] = [
                { name: 'Simulators', drivers: ['indi_simulator_ccd', 'indi_simulator_focuser', 'indi_simulator_telescope'] },
            ];
            setProfiles(defaults);
            localStorage.setItem('t-astro-indi-profiles', JSON.stringify(defaults));
            setSelectedProfileName('Simulators');
            setSelectedDrivers(['indi_simulator_ccd', 'indi_simulator_focuser', 'indi_simulator_telescope']);
        }

        loadDrivers();
    }, [isOpen]);

    if (!isOpen) return null;

    const handleToggleDriverSelection = (bin: string) => {
        setSelectedDrivers(prev => {
            const next = prev.includes(bin) ? prev.filter(b => b !== bin) : [...prev, bin];
            // Check if matches any profile
            const matched = profiles.find(p => {
                if (p.drivers.length !== next.length) return false;
                return p.drivers.every(d => next.includes(d));
            });
            if (matched) {
                setSelectedProfileName(matched.name);
            } else {
                setSelectedProfileName('');
            }
            return next;
        });
    };

    const handleProfileChange = (profileName: string) => {
        setSelectedProfileName(profileName);
        if (!profileName) {
            setSelectedDrivers([]);
            return;
        }
        const prof = profiles.find(p => p.name === profileName);
        if (prof) {
            setSelectedDrivers(prof.drivers);
        }
    };

    const handleSaveProfile = () => {
        const trimmed = newProfileName.trim();
        if (!trimmed) return;
        
        const updated = [...profiles.filter(p => p.name !== trimmed)];
        updated.push({ name: trimmed, drivers: [...selectedDrivers] });
        
        setProfiles(updated);
        localStorage.setItem('t-astro-indi-profiles', JSON.stringify(updated));
        setSelectedProfileName(trimmed);
        setNewProfileName('');
    };

    const handleDeleteProfile = () => {
        if (!selectedProfileName) return;
        const updated = profiles.filter(p => p.name !== selectedProfileName);
        setProfiles(updated);
        localStorage.setItem('t-astro-indi-profiles', JSON.stringify(updated));
        setSelectedProfileName('');
        setSelectedDrivers([]);
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

                {/* Equipment Profile Area */}
                <div className="p-4 bg-slate-950/40 border-b border-slate-800/80 flex flex-col gap-3 shrink-0">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {/* Equipment Profile Select */}
                        <div>
                            <label className="text-[9px] font-black text-slate-500 uppercase tracking-wider block mb-1">Equipment Profile</label>
                            <div className="flex gap-2">
                                <select
                                    value={selectedProfileName}
                                    onChange={(e) => handleProfileChange(e.target.value)}
                                    className="flex-1 bg-slate-800 border border-slate-700 text-slate-200 text-xs font-bold rounded-xl px-3 py-2.5 focus:outline-none focus:border-red-500 appearance-none bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2364748b%22%20stroke-width%3D%223%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')] bg-[length:12px_12px] bg-[right_12px_center] bg-no-repeat pr-8"
                                >
                                    <option value="">-- Custom Profile --</option>
                                    {profiles.map(p => (
                                        <option key={p.name} value={p.name}>{p.name}</option>
                                    ))}
                                </select>
                                {selectedProfileName && (
                                    <button
                                        onClick={handleDeleteProfile}
                                        className="p-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-400 hover:text-red-400 hover:border-red-950 transition-all shrink-0 flex items-center justify-center sm:p-3"
                                        title="Delete profile"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Save Current Drivers As Setup */}
                        <div>
                            <label className="text-[9px] font-black text-slate-500 uppercase tracking-wider block mb-1">New Profile Name</label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    placeholder="e.g. My Astrophotography Rig"
                                    value={newProfileName}
                                    onChange={(e) => setNewProfileName(e.target.value)}
                                    className="flex-1 bg-slate-800 border border-slate-700 text-slate-200 placeholder:text-slate-600 text-xs font-bold rounded-xl px-3 py-2.5 focus:outline-none focus:border-red-500"
                                />
                                <button
                                    onClick={handleSaveProfile}
                                    className="px-4 py-2 bg-slate-850 hover:bg-red-950 border border-slate-700 hover:border-red-500 text-red-500 hover:text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center shrink-0"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                                    Save
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex-1 p-6 overflow-y-auto space-y-6 scrollbar-thin scrollbar-thumb-red-900 bg-slate-900/40">
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
