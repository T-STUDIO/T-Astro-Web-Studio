
import React, { useState, useEffect } from 'react';
import { CelestialObject } from '../types';
import { useTranslation } from '../contexts/LanguageContext';
import { resolveAstroData, AstroData } from '../services/astroDataService';
import { CELESTIAL_OBJECTS, NGC_TO_MESSIER } from '../constants';
import { EXTENDED_DSO_CATALOG } from '../utils/dsoCatalog';
import { CloseIcon } from './icons/CloseIcon';
import { satelliteTrackService } from '../services/SatelliteTrackService';

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

const REAL_STARS_NAMES: Record<number, { en: string, ja: string }> = {
    0: { en: "Sirius", ja: "シリウス" },
    1: { en: "Canopus", ja: "カノープス" },
    2: { en: "Arcturus", ja: "アークトゥルス" },
    3: { en: "Rigil Kentaurus", ja: "リギル・ケンタウルス" },
    4: { en: "Vega", ja: "ベガ" },
    5: { en: "Capella", ja: "カペラ" },
    6: { en: "Rigel", ja: "リゲル" },
    7: { en: "Procyon", ja: "プロキオン" },
    8: { en: "Betelgeuse", ja: "ベテルギウス" },
    9: { en: "Achernar", ja: "アケルナル" },
    10: { en: "Hadar", ja: "ハダル" },
    11: { en: "Altair", ja: "アルタイル" },
    12: { en: "Acrux", ja: "アクルックス" },
    13: { en: "Aldebaran", ja: "アルデバラン" },
    14: { en: "Antares", ja: "アンタレス" },
    15: { en: "Spica", ja: "スピカ" },
    16: { en: "Pollux", ja: "ポルックス" },
    17: { en: "Fomalhaut", ja: "フォーマルハウト" },
    18: { en: "Deneb", ja: "デネブ" },
    19: { en: "Mimosa", ja: "ミモザ" },
    20: { en: "Regulus", ja: "レグルス" },
    21: { en: "Adhara", ja: "アダーラ" },
    22: { en: "Shaula", ja: "シャウラ" },
    23: { en: "Castor", ja: "カストル" },
    24: { en: "Gacrux", ja: "ガクルックス" },
    25: { en: "Elnath", ja: "エルナト" },
    26: { en: "Alnilam", ja: "アルニラム" },
    27: { en: "Alnitak", ja: "アルニタク" },
    28: { en: "Alnair", ja: "アルナイル" },
    29: { en: "Alioth", ja: "アリオト" },
    30: { en: "Dubhe", ja: "ドゥーベ" },
    31: { en: "Mirfak", ja: "ミルファク" },
    32: { en: "Kaus Australis", ja: "カウス・アウストラリス" },
    33: { en: "Wezen", ja: "ウェゼン" },
    34: { en: "Alkaid", ja: "アルカイド" },
    35: { en: "Sargas", ja: "サルガス" },
    36: { en: "Avior", ja: "アビオール" },
    37: { en: "Alhena", ja: "アルヘナ" },
    38: { en: "Menkent", ja: "メンケント" },
    39: { en: "Peacock", ja: "ピーコック" },
    40: { en: "Polaris", ja: "ポラリス (北極星)" },
    41: { en: "Alphard", ja: "アルファルド" },
    42: { en: "Hamal", ja: "ハマル" },
    43: { en: "Alpheratz", ja: "アルフェラッツ" },
    44: { en: "Schedar", ja: "シェダル" },
    45: { en: "Caph", ja: "カーフ" },
    46: { en: "Gamma Cas", ja: "ガンマ・カス" },
    47: { en: "Ruchbah", ja: "ルクバー" },
    48: { en: "Segin", ja: "セギン" },
    49: { en: "Merak", ja: "メラク" },
    50: { en: "Phecda", ja: "フェクダ" },
    51: { en: "Megrez", ja: "メグレス" },
    52: { en: "Mizar", ja: "ミザール" },
    53: { en: "Sadr", ja: "サドル" },
    54: { en: "Gienah", ja: "ギエナー" },
    55: { en: "Delta Cyg", ja: "デルタ・シグ" },
    56: { en: "Albireo", ja: "アルビレオ" },
    57: { en: "Bellatrix", ja: "ベラトリックス" },
    58: { en: "Saiph", ja: "サイフ" },
    59: { en: "Mintaka", ja: "ミンタカ" },
    60: { en: "Markab", ja: "マルカブ" },
    61: { en: "Scheat", ja: "シェアト" },
    62: { en: "Algenib", ja: "アルゲニブ" },
    63: { en: "Enif", ja: "エニフ" },
    64: { en: "Sheliak", ja: "シェリアク" },
    65: { en: "Sulafat", ja: "スラファト" },
    66: { en: "Tarazed", ja: "タラゼド" },
    67: { en: "Alshain", ja: "アルシャイン" },
    68: { en: "Mirach", ja: "ミラク" },
    69: { en: "Almach", ja: "アルマク" },
    70: { en: "Denebola", ja: "デネボラ" },
    71: { en: "Algieba", ja: "アルギエバ" },
    72: { en: "Zosma", ja: "ゾスマ" },
    73: { en: "Vindemiatrix", ja: "ヴィンデミアトリックス" },
    74: { en: "Porrima", ja: "ポリマ" },
    75: { en: "Alphecca", ja: "アルフェッカ" },
    76: { en: "Izar", ja: "イザール" },
    77: { en: "Muphrid", ja: "ムフリッド" },
    78: { en: "Dschubba", ja: "ジュバ" },
    79: { en: "Wei", ja: "ウェイ" },
    80: { en: "Nunki", ja: "ヌンキ" },
    81: { en: "Ascella", ja: "アセラ" }
};

const tryResolveFamousStarName = (obj: any) => {
    if (!obj || !obj.id) return;
    if (obj.id.startsWith('real_star_')) {
        const parts = obj.id.split('_');
        const idx = parseInt(parts[2], 10);
        if (!isNaN(idx) && REAL_STARS_NAMES[idx]) {
            obj.name = REAL_STARS_NAMES[idx].en;
            obj.nameJa = REAL_STARS_NAMES[idx].ja;
        }
    }
};

export const CelestialObjectHUD: React.FC<CelestialObjectHUDProps> = ({ object, data, isConnected, compact, onClose, MountController }) => {
    const { t, language } = useTranslation();
    
    // 有名な実在恒星（Sirius, Polaris等）の名前解決を最優先で適用
    tryResolveFamousStarName(object);

    // 早期に object.name を仮名で初期化して、以降の判定や親コンポーネントでの undefined によるクラッシュを防ぐ
    if (object && !object.name) {
        object.name = `Star (Mag ${object.magnitude?.toFixed(1)})`;
    }

    const isBgStar = object.id?.startsWith('bg_star_') || object.id?.startsWith('real_star_');
    const isServerStar = object.id?.startsWith('server-star-');
    const isDbObject = CELESTIAL_OBJECTS.some(o => o.id === object.id) || 
                       EXTENDED_DSO_CATALOG.some(o => o.id === object.id || (object.name && o.name === object.name));
    
    // 恒星の汎用名であるか判定
    const isGeneric = !object.name || 
                      object.name.toLowerCase().includes('star (mag') || 
                      object.name.toLowerCase().includes('star(mag') ||
                      object.name.toLowerCase().includes('background') ||
                      object.name.toLowerCase().includes('unnamed') ||
                      (object.nameJa && (object.nameJa.includes('恒星 (光度') || object.nameJa.includes('恒星(光度')));

    const needsFetch = !isDbObject && (!!object.name || isBgStar || isServerStar || isGeneric);

    const [isLoading, setIsLoading] = useState(needsFetch);
    const [astroData, setAstroData] = useState<AstroData | null>(null);

    useEffect(() => {
        let isMounted = true;
        if (needsFetch) { setIsLoading(true); setAstroData(null); } 
        else { setIsLoading(false); setAstroData(null); }
        
        if (object && needsFetch) {
            const langCode = language === 'ja' ? 'ja' : 'en';
            
            // object.name が空か、汎用的な仮名の場合は、
            // astroDataService.ts の if (!obj.name) を通過させ、
            // solver_server.py で is_generic_star と判定されるように "Star" を設定したオブジェクトを渡す
            const queryObj = { ...object };
            if (!queryObj.name || isGeneric) {
                queryObj.name = "Star";
            }

            resolveAstroData(queryObj, langCode).then(res => {
                if (isMounted) { 
                    setAstroData(res); 
                    setIsLoading(false); 
                    // データベースで解決された実名を親の selectedObject にも即時反映する
                    if (res && res.resolvedName) {
                        object.name = res.resolvedName;
                    }
                }
            }).catch(() => { if (isMounted) setIsLoading(false); });
        }
        return () => { isMounted = false; };
    }, [object.id, language, needsFetch]);

    const [isTracking, setIsTracking] = useState(false);

    useEffect(() => {
        const updateTrackStatus = () => {
            const state = satelliteTrackService.getState();
            setIsTracking(state.isActive && state.targetId === object.id);
        };

        updateTrackStatus();
        const interval = setInterval(updateTrackStatus, 500);
        return () => clearInterval(interval);
    }, [object]);

    if (!object || !data) return null;

    let displayName = language === 'ja' && object.nameJa ? object.nameJa : object.name;
    if (astroData && astroData.resolvedName) {
        displayName = astroData.resolvedName;
    }

    if (!displayName) {
        if (isBgStar || isServerStar) {
            displayName = language === 'ja' ? `恒星 (光度 ${object.magnitude?.toFixed(1)})` : `Star (Mag ${object.magnitude?.toFixed(1)})`;
        } else {
            displayName = language === 'ja' ? '未知の天体' : 'Unknown Object';
        }
    }

    const nameForNgcMatch = (astroData && astroData.resolvedName) ? astroData.resolvedName : object.name;
    const ngcMatch = nameForNgcMatch?.match(/NGC\s*(\d+)/i);
    
    if (ngcMatch) {
        const ngcNum = parseInt(ngcMatch[1]);
        const messierName = NGC_TO_MESSIER[ngcNum];
        if (messierName) {
            displayName = `${messierName} (${nameForNgcMatch})`;
        }
    }

    let displayType = data.type;
    let displayMag = (data.magnitude !== undefined && data.magnitude !== null && !isNaN(Number(data.magnitude))) 
        ? Number(data.magnitude).toFixed(1) 
        : '---';
    let displayRa = data.ra || '---';
    let displayDec = data.dec || '---';

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
                    <h3 className="text-red-400 font-bold text-[11px] md:text-sm truncate flex-1 leading-tight pr-1 flex items-center gap-1.5" title={displayName}>
                        <span>{displayName}</span>
                        {isTracking && (
                            <span className="shrink-0 inline-flex items-center gap-0.5 px-1 py-0.5 rounded bg-green-500/10 border border-green-500/20 text-[7px] text-green-400 font-black tracking-widest uppercase animate-pulse leading-none">
                                ● {language === 'ja' ? '追尾中' : 'TRACK' }
                            </span>
                        )}
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

                    {isTracking && (
                        <div className="border-t border-red-950/40 mt-1.5 pt-1.5">
                            <button
                                onClick={() => satelliteTrackService.stopTracking()}
                                className="w-full bg-red-950/80 hover:bg-red-900 border border-red-500/30 text-red-200 font-black text-[9px] py-1 rounded transition-colors uppercase tracking-widest flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
                                {language === 'ja' ? '自動追尾を停止' : 'STOP TRACKING'}
                            </button>
                        </div>
                    )}
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
