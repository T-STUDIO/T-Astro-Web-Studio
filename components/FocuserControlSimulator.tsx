import React, { useState, useEffect } from 'react';
import { ArrowLeftIcon } from './icons/ArrowLeftIcon';
import { ArrowRightIcon } from './icons/ArrowRightIcon';
import { useTranslation } from '../contexts/LanguageContext';
import * as AstroService from '../services/AstroServiceSimulator';

import { SimulatorSettings } from '../types';

interface FocuserControlProps {
    isConnected: boolean;
    simulatorSettings: SimulatorSettings;
    onSimulatorSettingsChange: (s: Partial<SimulatorSettings>) => void;
}

export const FocuserControlSimulator: React.FC<FocuserControlProps> = ({ isConnected, simulatorSettings, onSimulatorSettingsChange }) => {
    const { t } = useTranslation();

    const handleMove = async (direction: 'in' | 'out') => {
        const delta = direction === 'in' ? -simulatorSettings.focuserStep : simulatorSettings.focuserStep;
        const newPos = Math.max(0, Math.min(100000, simulatorSettings.focuserPosition + delta));
        onSimulatorSettingsChange({ focuserPosition: newPos });
        AstroService.moveFocuser(delta);
    };

    return (
        <div className={`bg-slate-900/50 p-4 rounded-lg border border-slate-700 space-y-3 ${!isConnected ? 'opacity-50 pointer-events-none' : ''}`} title={t('tooltips.focuser')}>
            <h3 className="text-sm font-semibold text-red-400 border-b border-red-900/50 pb-2">{t('focuser.title')}</h3>
            
            <div className="flex items-center justify-between bg-slate-800 rounded p-2 border border-slate-600">
                <span className="text-xs text-slate-400">{t('focuser.currentPosition')}</span>
                <span className="text-lg font-mono font-bold text-red-400">{simulatorSettings.focuserPosition}</span>
            </div>

            <div className="flex gap-2 items-end">
                <div className="flex-1">
                    <label className="block text-[10px] text-slate-400 mb-1">{t('focuser.stepSize')}</label>
                    <input 
                        type="number" 
                        value={simulatorSettings.focuserStep}
                        onChange={(e) => onSimulatorSettingsChange({ focuserStep: Math.max(1, Math.min(1000, Number(e.target.value))) })}
                        className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm text-slate-200 focus:ring-1 focus:ring-red-500 outline-none text-center"
                    />
                </div>
                
                <div className="flex gap-1">
                    <button 
                        onClick={() => handleMove('in')}
                        className="bg-slate-700 hover:bg-slate-600 text-white p-2 rounded border border-slate-600 active:bg-slate-800 transition-colors"
                    >
                        <ArrowLeftIcon className="w-5 h-5" />
                    </button>
                    <button 
                        onClick={() => handleMove('out')}
                        className="bg-slate-700 hover:bg-slate-600 text-white p-2 rounded border border-slate-600 active:bg-slate-800 transition-colors"
                    >
                        <ArrowRightIcon className="w-5 h-5" />
                    </button>
                </div>
            </div>
        </div>
    );
};
