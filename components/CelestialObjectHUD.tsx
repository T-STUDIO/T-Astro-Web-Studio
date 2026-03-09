
import React, { useState, useEffect } from 'react';
import { CelestialObject } from '../types';
import { useTranslation } from '../contexts/LanguageContext';
import { resolveAstroData, AstroData } from '../services/astroDataService';
import { CELESTIAL_OBJECTS, NGC_TO_MESSIER } from '../constants';
import { CloseIcon } from './icons/CloseIcon';

interface CelestialObjectHUDProps {
    object: CelestialObject;
    data: {
        type: string;
        magnitude: number;
        ra: string;
        dec: string;
        az: string;
        alt: string;
        transit: string;
        isRising: boolean;
    } | null;
    isConnected: boolean;
    compact?: boolean;
    onClose?: () => void;
    MountController?: React.ComponentType<any>;
}

export const CelestialObjectHUD: React.FC<CelestialObjectHUDProps> = ({ object, data, isConnected, compact, onClose, MountController }) => {
    const { t, language } = useTranslation();
    
    let displayName = language === 'ja' && object.nameJa ? object.nameJa : object.name;
    const ngcMatch = object.name.match(/NGC\s*(\d+)/i);
    
    if (ngcMatch) {
        const ngcNum = parseInt(ngcMatch[1]);
        const messierName = NGC_TO_MESSIER[ngcNum];
        if (messierName) {
            displayName = `${messierName} (${object.name})`;
        }
    }
    
    const isDbObject = CELESTIAL_OBJECTS.some(o => o.id === object.id);
    const needsFetch = !isDbObject && !!object.name;

    const [isLoading, setIsLoading] = useState(needsFetch);
    const [astroData, setAstroData] = useState<AstroData | null>(null);

    useEffect(() => {
        let isMounted = true;
        if (needsFetch) { setIsLoading(true); setAstroData(null); } 
        else { setIsLoading(false); setAstroData(null); }
        
        if (object && needsFetch) {
            const langCode = language === 'ja' ? 'ja' : 'en';
            resolveAstroData(object, langCode).then(res => {
                if (isMounted) { setAstroData(res); setIsLoading(false); }
            }).catch(() => { if (isMounted) setIsLoading(false); });
        }
        return () => { isMounted = false; };
    }, [object, language, needsFetch]);

    if (!object || !data) return null;

    let displayType = data.type;
    let displayMag = data.magnitude.toFixed(1);
    let displayRa = data.ra;
    let displayDec = data.dec;

    if (needsFetch) {
        if (isLoading) {
            displayType = '...'; displayMag = '...'; displayRa = '...'; displayDec = '...';
        } else if (astroData) {
            displayType = astroData.type; displayMag = astroData.magnitude; displayRa = astroData.ra; displayDec = astroData.dec;
        }
    } else if (astroData) {
        displayType = astroData.type; displayMag = astroData.magnitude; displayRa = astroData.ra; displayDec = astroData.dec;
    }

    return (
        /* 修正：横幅をw-52(MountControllerと同一)に固定し、PCでの表示を揃える。 */
        <div className="absolute top-12 md:top-4 left-2 md:left-4 z-30 flex flex-col gap-1.5 pointer-events-none w-52 max-h-[calc(100vh-100px)] overflow-y-auto scrollbar-none">
            <div className="bg-slate-900/90 p-2 md:p-3 rounded-lg border border-red-900/40 backdrop-blur-md shadow-2xl w-full pointer-events-auto box-border">
                <div className="flex justify-between items-start border-b border-red-900/30 pb-1 mb-1">
                    <h3 className="text-red-400 font-bold text-[11px] md:text-sm truncate flex-1 leading-tight pr-1" title={displayName}>
                        {displayName}
                    </h3>
                    {onClose && (
                        <button onClick={onClose} className="text-slate-500 hover:text-white shrink-0">
                            <CloseIcon className="w-3.5 h-3.5 md:w-4 md:h-4" />
                        </button>
                    )}
                </div>
                <div className="text-[10px] md:text-[11px] text-slate-300 font-mono space-y-0.5 md:space-y-1 leading-tight">
                    <div className="grid grid-cols-[45px_1fr] gap-x-1">
                        <span className="text-slate-500 text-right whitespace-nowrap">{t('controlPanel.targetInfo.type')}:</span>
                        <span className="text-slate-200 truncate">{displayType}</span>

                        <span className="text-slate-500 text-right whitespace-nowrap">Mag:</span>
                        <span className="text-slate-200">{displayMag}</span>

                        <span className="text-slate-500 text-right whitespace-nowrap">RA:</span>
                        <span className="text-slate-200 truncate">{displayRa}</span>

                        <span className="text-slate-500 text-right whitespace-nowrap">Dec:</span>
                        <span className="text-slate-200 truncate">{displayDec}</span>
                    </div>

                    <div className="border-t border-slate-700/50 mt-1 pt-1 grid grid-cols-[45px_1fr] gap-x-1">
                        <span className="text-slate-500 text-right whitespace-nowrap">Az:</span>
                        <span className="text-slate-200">{data.az}°</span>

                        <span className="text-slate-500 text-right whitespace-nowrap">Alt:</span>
                        <span className={data.isRising ? 'text-green-400' : 'text-red-400'}>{data.alt}°</span>
                    </div>
                </div>
            </div>
            
            {isConnected && MountController && (
                <div className="pointer-events-auto w-full opacity-95">
                    <MountController isConnected={isConnected} compact={true} />
                </div>
            )}
        </div>
    );
};
