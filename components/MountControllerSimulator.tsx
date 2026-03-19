import React, { useState, useEffect } from 'react';
import { Button } from './Button';
import { StopIcon } from './icons/StopIcon';
import { useTranslation } from '../contexts/LanguageContext';
import { MountSpeed } from '../types';
import * as AstroService from '../services/AstroServiceSimulator';

interface MountControllerProps {
    isConnected: boolean;
    compact?: boolean; 
}

const DirectionButton: React.FC<{ 
    label: string; 
    direction: 'N' | 'S' | 'E' | 'W'; 
    speed: MountSpeed;
    disabled: boolean;
    className?: string; 
    compact?: boolean;
    title?: string;
}> = ({ label, direction, speed, disabled, className, compact, title }) => {
    
    const handleMouseDown = () => {
        if (!disabled) AstroService.startMotion(direction, speed);
    };

    const handleMouseUp = () => {
        if (!disabled) AstroService.stopMotion(direction);
    };

    const sizeClass = compact ? 'w-8 h-7 text-xs' : 'w-12 h-12 text-lg';

    return (
        <button
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleMouseDown}
            onTouchEnd={handleMouseUp}
            disabled={disabled}
            title={title}
            className={`${sizeClass} bg-slate-700 hover:bg-red-700 active:bg-red-600 rounded flex items-center justify-center font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed select-none ${className}`}
        >
            {label}
        </button>
    );
};

export const MountControllerSimulator: React.FC<MountControllerProps> = ({ isConnected, compact }) => {
    const { t } = useTranslation();
    const [speed, setSpeed] = useState<MountSpeed>('Slew');
    const [tracking, setTracking] = useState(false);
    const [parked, setParked] = useState(false);

    useEffect(() => {
        if (!isConnected) {
            setTracking(false);
            setParked(false);
            return;
        }

        const updateState = () => {
            const trk = AstroService.getSwitchValue('Simulator Mount', 'TELESCOPE_TRACK_STATE', 'TRACK_ON');
            const prk = AstroService.getSwitchValue('Simulator Mount', 'TELESCOPE_PARK', 'PARK');
            setTracking(trk);
            setParked(prk);
        };

        updateState();
        const interval = setInterval(updateState, 500);
        return () => clearInterval(interval);
    }, [isConnected]);

    const toggleTracking = () => {
        const newState = !tracking;
        AstroService.updateDeviceSetting('Simulator Mount', 'TELESCOPE_TRACK_STATE', {
            TRACK_ON: newState,
            TRACK_OFF: !newState
        });
    };

    const togglePark = () => {
        const newState = !parked;
        AstroService.updateDeviceSetting('Simulator Mount', 'TELESCOPE_PARK', {
            PARK: newState,
            UNPARK: !newState
        });
    };

    const handleStop = () => {
        AstroService.abortSlew();
    };

    const containerClass = compact 
        ? "bg-slate-900/80 p-1.5 rounded-lg border border-red-900/30 w-full pointer-events-auto backdrop-blur-sm shadow-xl" 
        : "bg-slate-900/50 p-4 rounded-lg border border-slate-700 space-y-4";

    const titleClass = compact
        ? "text-[9px] font-black text-red-500 border-b border-red-900/50 pb-0.5 mb-1.5 text-center uppercase tracking-widest"
        : "text-sm font-semibold text-red-400 border-b border-red-900/50 pb-2";

    const stopSize = compact ? "w-8 h-8" : "w-12 h-12";
    const iconSize = compact ? "w-3.5 h-3.5" : "w-6 h-6";

    return (
        <div className={`${containerClass} ${!isConnected ? 'opacity-50 pointer-events-none' : ''}`}>
             {compact ? <h3 className={titleClass}>Mount</h3> : <h3 className={titleClass}>{t('mountController.title')}</h3>}
             
             <div className="flex flex-col items-center gap-0.5 mb-1.5">
                <DirectionButton label="N" direction="N" speed={speed} disabled={!isConnected || parked} compact={compact} />
                <div className="flex gap-0.5">
                    <DirectionButton label="E" direction="E" speed={speed} disabled={!isConnected || parked} compact={compact} />
                    <button 
                        onClick={handleStop}
                        disabled={!isConnected}
                        className={`${stopSize} bg-red-700 hover:bg-red-600 rounded-full flex items-center justify-center text-white shadow-lg active:scale-95 transition-transform`}
                    >
                        <StopIcon className={iconSize} />
                    </button>
                    <DirectionButton label="W" direction="W" speed={speed} disabled={!isConnected || parked} compact={compact} />
                </div>
                <DirectionButton label="S" direction="S" speed={speed} disabled={!isConnected || parked} compact={compact} />
             </div>

             <div className="flex justify-between bg-slate-800/80 rounded p-0.5 mb-1.5 border border-slate-700">
                 {(['Guide', 'Center', 'Find', 'Slew'] as MountSpeed[]).map((s) => (
                     <button
                        key={s}
                        onClick={() => setSpeed(s)}
                        className={`text-[7px] sm:text-[9px] px-1 py-0.5 rounded font-black uppercase transition-colors ${speed === s ? 'bg-red-700 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                     >
                         {s === 'Slew' ? 'MAX' : s.toUpperCase()}
                     </button>
                 ))}
             </div>

             <div className="grid grid-cols-2 gap-1">
                 <button 
                    onClick={toggleTracking} 
                    className={`text-[8px] font-black py-1 rounded border transition-colors ${tracking ? 'bg-green-900 border-green-600 text-green-400' : 'bg-slate-800 border-slate-700 text-slate-500'}`}
                >
                     TRK:{tracking ? 'ON' : 'OFF'}
                 </button>
                 <button 
                    onClick={togglePark}
                    className={`text-[8px] font-black py-1 rounded border transition-colors ${parked ? 'bg-red-900 border-red-600 text-red-400' : 'bg-slate-800 border-slate-700 text-slate-500'}`}
                >
                     {parked ? 'UNPARK' : 'PARK'}
                 </button>
             </div>
        </div>
    );
};
