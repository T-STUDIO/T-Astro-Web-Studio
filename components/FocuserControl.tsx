import React, { useState, useEffect } from 'react';
import { ArrowLeftIcon } from './icons/ArrowLeftIcon';
import { ArrowRightIcon } from './icons/ArrowRightIcon';
import { useTranslation } from '../contexts/LanguageContext';
import * as AstroService from '../services/AstroService';

interface FocuserControlProps {
    isConnected: boolean;
}

export const FocuserControl: React.FC<FocuserControlProps> = ({ isConnected }) => {
    const { t } = useTranslation();
    const [position, setPosition] = useState(0);
    const [stepSize, setStepSize] = useState(50); // Default, updated from driver

    useEffect(() => {
        if (isConnected) {
            const handleUpdate = () => {
                const focuser = AstroService.getActiveFocuser();
                if (focuser) {
                     const absVal = AstroService.getNumericValue(focuser, 'ABS_FOCUS_POSITION', 'FOCUS_ABSOLUTE_POSITION');
                     if (absVal !== null) setPosition(absVal);    
                }
            };
            const interval = setInterval(handleUpdate, 1000);
            return () => clearInterval(interval);
        }
    }, [isConnected, stepSize]);

    const handleMove = async (direction: 'in' | 'out') => {
        const focuser = AstroService.getActiveFocuser();
        if (!focuser) return;

        // 絶対位置での移動に変更
        // 現在の座標(position)に対してステップ量(stepSize)を加減算する
        const targetPosition = direction === 'in' 
            ? Math.max(0, position - stepSize) 
            : position + stepSize;

        // ABS_FOCUS_POSITION コマンドを送信
        let xml = `<newNumberVector device='${focuser}' name='ABS_FOCUS_POSITION'>`;
        xml += `<oneNumber name='FOCUS_ABSOLUTE_POSITION'>${targetPosition}</oneNumber>`;
        xml += `</newNumberVector>`;
        
        AstroService.sendRaw(xml);
    };

    return (
        <div className={`bg-slate-900/50 p-4 rounded-lg border border-slate-700 space-y-3 ${!isConnected ? 'opacity-50 pointer-events-none' : ''}`} title={t('tooltips.focuser')}>
            <h3 className="text-sm font-semibold text-red-400 border-b border-red-900/50 pb-2">{t('focuser.title')}</h3>
            
            <div className="flex items-center justify-between bg-slate-800 rounded p-2 border border-slate-600">
                <span className="text-xs text-slate-400">{t('focuser.currentPosition')}</span>
                <span className="text-lg font-mono font-bold text-red-400">{position}</span>
            </div>

            <div className="flex gap-2 items-end">
                <div className="flex-1">
                    <label className="block text-[10px] text-slate-400 mb-1">{t('focuser.stepSize')}</label>
                    <input 
                        type="number" 
                        value={stepSize}
                        onChange={(e) => setStepSize(Math.max(1, Number(e.target.value)))}
                        className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm text-slate-200 focus:ring-1 focus:ring-red-500 outline-none text-center"
                        title="Number of motor steps per move command."
                    />
                </div>
                
                <div className="flex gap-1">
                    <button 
                        onClick={() => handleMove('in')}
                        className="bg-slate-700 hover:bg-slate-600 text-white p-2 rounded border border-slate-600 active:bg-slate-800 transition-colors"
                        title={t('focuser.moveIn')}
                    >
                        <ArrowLeftIcon className="w-5 h-5" />
                    </button>
                    <button 
                        onClick={() => handleMove('out')}
                        className="bg-slate-700 hover:bg-slate-600 text-white p-2 rounded border border-slate-600 active:bg-slate-800 transition-colors"
                        title={t('focuser.moveOut')}
                    >
                        <ArrowRightIcon className="w-5 h-5" />
                    </button>
                </div>
            </div>
        </div>
    );
};