
import React, { useEffect, useState } from 'react';
import { GeminiIcon } from './icons/GeminiIcon';
import { CloseIcon } from './icons/CloseIcon';
import { CrosshairIcon } from './icons/CrosshairIcon';
import { useTranslation } from '../contexts/LanguageContext';
import { CelestialObject, ObjectRealtimeData, SampStatus } from '../types';
import { fetchWikiImage, fetchWikiSummary } from '../services/wikipediaService';
import { resolveAstroData, AstroData } from '../services/astroDataService';
import { summarizeExternalInfo } from '../services/geminiService';
import { ResetIcon } from './icons/ResetIcon';
import { CELESTIAL_OBJECTS } from '../constants';
import { AladinIcon } from './icons/AladinIcon';
import { sendSkyCoord } from '../services/sampService';
import { hmsToDegrees, dmsToDegrees } from '../utils/coords';
import { fetchSimbadData } from '../services/simbadService';

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

const isGenericObject = (obj: CelestialObject | null) => {
  if (!obj) return false;
  const lowerName = (obj.name || '').toLowerCase();
  const lowerNameJa = (obj.nameJa || '').toLowerCase();
  const lowerId = (obj.id || '').toLowerCase();
  return !obj.name ||
         lowerName.includes('star (mag') || 
         lowerName.includes('star(mag') ||
         lowerNameJa.includes('恒星 (光度') || 
         lowerNameJa.includes('恒星(光度') || 
         lowerName.includes('background') || 
         lowerId.includes('background') ||
         lowerId.includes('server-star') ||
         lowerId.includes('bg_star') ||
         lowerId.includes('real_star');
};

interface GeminiInfoModalProps {
  isOpen: boolean;
  isLoading: boolean;
  content: string;
  object: CelestialObject | null;
  realtimeData: ObjectRealtimeData | null;
  onClose: () => void;
  onGoTo?: (object: CelestialObject) => void;
  onCenter?: (object: CelestialObject) => void;
  isConnected?: boolean;
  sampStatus?: SampStatus;
}

export const GeminiInfoModal: React.FC<GeminiInfoModalProps> = ({ isOpen, isLoading: isInitialLoading, content: initialContent, object, realtimeData, onClose, onGoTo, onCenter, isConnected, sampStatus }) => {
  const { language, t } = useTranslation();
  
  // 有名な実在恒星（Sirius, Polaris等）の名前解決を適用
  if (object) {
      tryResolveFamousStarName(object);
  }

  const [wikiImage, setWikiImage] = useState<string | null>(null);
  const [astroData, setAstroData] = useState<AstroData | null>(null);
  const [isDataLoading, setIsDataLoading] = useState(false);
  const [displayContent, setDisplayContent] = useState(initialContent);
  const [isSummarizing, setIsSummarizing] = useState(false);

  useEffect(() => {
    setDisplayContent(initialContent);
  }, [initialContent]);

  useEffect(() => {
    if (isOpen && object) {
      setWikiImage(null); 
      setAstroData(null); 
      setIsDataLoading(true);
      
      const langCode = language === 'ja' ? 'ja' : 'en';
      const generic = isGenericObject(object);

      // object.name が空か、汎用的な仮名の場合は、
      // astroDataService.ts の if (!obj.name) を通過させ、
      // solver_server.py で is_generic_star と判定されるように "Star" を設定したオブジェクトを渡す
      const queryObj = { ...object };
      if (!queryObj.name || generic) {
          queryObj.name = "Star";
      }

      if (generic) {
        resolveAstroData(queryObj, langCode).then(stats => {
          if (stats) setAstroData(stats);
          setIsDataLoading(false);
        }).catch(() => setIsDataLoading(false));
      } else {
        Promise.all([
            fetchWikiImage(object.name),
            resolveAstroData(queryObj, langCode)
        ]).then(([url, stats]) => {
            if (url) setWikiImage(url);
            if (stats) setAstroData(stats);
            setIsDataLoading(false);
        }).catch(() => setIsDataLoading(false));
      }
    }
  }, [isOpen, object, language]);

  if (!isOpen || !object) return null;

  const displayImage = wikiImage || object.image;
  const imageSourceLabel = wikiImage ? t('geminiModal.sourceWikipedia') : (object.image ? t('geminiModal.sourceCatalog') : null);
  
  // Discriminate based on DB presence
  const isDbObject = CELESTIAL_OBJECTS.some(o => o.id === object.id);
  const needsFetch = !isDbObject;

  // 表示データの決定
  let displayType: string = object.type;
  let displayMag = object.magnitude.toFixed(1);
  let displayRa = object.ra;
  let displayDec = object.dec;

  if (needsFetch) {
      if (isDataLoading) {
          displayType = t('common.loading');
          displayMag = t('common.loading');
          displayRa = t('common.loading');
          displayDec = t('common.loading');
      } else if (astroData) {
          displayType = astroData.type;
          displayMag = astroData.magnitude;
          displayRa = astroData.ra;
          displayDec = astroData.dec;
      } else {
          displayType = t('common.none');
          displayMag = t('common.none');
          displayRa = t('common.none');
          displayDec = t('common.none');
      }
  } else if (astroData) {
      displayType = astroData.type;
      displayMag = astroData.magnitude;
      displayRa = astroData.ra;
      displayDec = astroData.dec;
  }

  const handleSearchWikipedia = async () => {
      const resolvedName = (needsFetch && astroData?.resolvedName) ? astroData.resolvedName : object.name;
      const generic = isGenericObject(object);

      if (generic) {
          setIsSummarizing(true);
          try {
              const raVal = object.ra;
              const decVal = object.dec;
              const magVal = (object.magnitude !== undefined && object.magnitude !== null) ? object.magnitude.toFixed(1) : '---';
              const infoText = language === 'ja'
                  ? `天体名: ${resolvedName} (微光星・汎用天体)\n座標: 赤経 ${raVal}, 赤緯 ${decVal}\n等級: ${magVal}等星\nこの天体は個別のWikipedia記事がないため、この確定している情報をベースに、この等級や位置にある一般的な恒星としての科学的特徴（恒星の分類、色、予想される温度や性質など）を分かりやすく丁寧に日本語で解説してください。`
                  : `Celestial Object: ${resolvedName} (Background Star)\nCoordinates: RA ${raVal}, Dec ${decVal}\nMagnitude: ${magVal}\nSince there is no specific Wikipedia article for this individual star, please explain the general scientific characteristics (spectral type, color, estimated temperature, stellar physics) of a star with these general coordinates and magnitude, in educational English.`;
              
              const summarized = await summarizeExternalInfo(resolvedName, infoText, 'Wikipedia', language);
              setDisplayContent(summarized);
          } catch (e) {
              console.error("Wikipedia proxy summary failed", e);
          } finally {
              setIsSummarizing(false);
          }
          return;
      }

      const name = language === 'ja' && object.nameJa ? object.nameJa.split('(')[0].trim() : resolvedName.split('(')[0].trim();
      const langPrefix = language === 'ja' ? 'ja' : 'en';
      
      // 1. Open link in new tab (existing behavior)
      const url = `https://${langPrefix}.wikipedia.org/wiki/${encodeURIComponent(name)}`;
      window.open(url, '_blank', 'noopener,noreferrer');

      // 2. Fetch and summarize (new behavior)
      setIsSummarizing(true);
      try {
          const summaryText = await fetchWikiSummary(name, langPrefix as 'en' | 'ja');
          if (summaryText) {
              const summarized = await summarizeExternalInfo(resolvedName, summaryText, 'Wikipedia', language);
              setDisplayContent(summarized);
          } else {
              setDisplayContent(language === 'ja' ? "個別記事が見つかりませんでした。" : "No specific article found.");
          }
      } catch (e) {
          console.error("Wiki summarization failed", e);
      } finally {
          setIsSummarizing(false);
      }
  };

  const handleSearchSimbad = async () => {
      const resolvedName = (needsFetch && astroData?.resolvedName) ? astroData.resolvedName : object.name;
      const generic = isGenericObject(object);

      if (generic) {
          const raDeg = hmsToDegrees(object.ra);
          const decDeg = dmsToDegrees(object.dec);
          const sign = decDeg >= 0 ? '+' : '';
          const coordStr = `${raDeg.toFixed(6)} ${sign}${decDeg.toFixed(6)}`;
          
          // 1. Open sim-coo link in new tab using coordinates with explicit sign
          const url = `http://simbad.cds.unistra.fr/simbad/sim-coo?Coord=${encodeURIComponent(coordStr)}`;
          window.open(url, '_blank', 'noopener,noreferrer');

          // 2. Coordinates & magnitude based AI explanation
          setIsSummarizing(true);
          try {
              const raVal = object.ra;
              const decVal = object.dec;
              const magVal = (object.magnitude !== undefined && object.magnitude !== null) ? object.magnitude.toFixed(1) : '---';
              const infoText = language === 'ja'
                  ? `天体名: ${resolvedName} (汎用的な恒星)\n座標: 赤経 ${raVal} (十進: ${raDeg.toFixed(6)}°), 赤緯 ${decVal} (十進: ${decDeg.toFixed(6)}°)\n等級: ${magVal}等星\nこの天体は個別のSIMBAD名称検索にヒットしないため、座標から探した一般的な恒星の科学的性質（色、スペクトル型、光度、この天域における星野の特徴など）を、日本語でプロフェッショナルかつ分かりやすく解説してください。`
                  : `Celestial Object: ${resolvedName} (Background Star)\nCoordinates: RA ${raVal} (deg: ${raDeg.toFixed(6)}), Dec ${decVal} (deg: ${decDeg.toFixed(6)})\nMagnitude: ${magVal}\nSince this star does not have a specific named SIMBAD entry, please explain the general scientific properties of a star with these coordinates and magnitude, in educational English.`;
              
              const summarized = await summarizeExternalInfo(resolvedName, infoText, 'SIMBAD', language);
              setDisplayContent(summarized);
          } catch (e) {
              console.error("Simbad proxy summary failed", e);
          } finally {
              setIsSummarizing(false);
          }
          return;
      }

      const name = resolvedName.split('(')[0].trim();
      
      // 1. Open link in new tab (existing behavior)
      const url = `http://simbad.cds.unistra.fr/simbad/sim-basic?Ident=${encodeURIComponent(name)}&submit=SIMBAD+search`;
      window.open(url, '_blank', 'noopener,noreferrer');

      // 2. Fetch and summarize (new behavior)
      setIsSummarizing(true);
      try {
          // SIMBAD data is mostly structured, so we fetch it and ask Gemini to explain it
          const simbadData = await fetchSimbadData(resolvedName, language);
          if (simbadData) {
              const aliases = simbadData.aliases ? `Aliases: ${simbadData.aliases.join(', ')}` : '';
              const rawText = `Type: ${simbadData.type}, RA: ${simbadData.ra}, Dec: ${simbadData.dec}, Magnitude: ${simbadData.magnitude}. ${aliases}`;
              const summarized = await summarizeExternalInfo(resolvedName, rawText, 'SIMBAD', language);
              setDisplayContent(summarized);
          } else {
              setDisplayContent(language === 'ja' ? "SIMBADデータが見つかりませんでした。" : "No SIMBAD data found.");
          }
      } catch (e) {
          console.error("Simbad summarization failed", e);
      } finally {
          setIsSummarizing(false);
      }
  };

  const handleSendToSamp = () => {
      const ra = hmsToDegrees(object.ra);
      const dec = dmsToDegrees(object.dec);
      sendSkyCoord(ra, dec);
  };

  const isSampConnected = sampStatus === 'Connected';

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex justify-center items-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-slate-900 border border-red-900/50 rounded-lg shadow-2xl w-full md:w-[90%] max-w-2xl max-h-[90vh] flex flex-col animate-fadeIn"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex justify-between items-center p-4 border-b border-red-900/30 bg-slate-800/80 shrink-0">
          <div className="flex items-center gap-3">
            <GeminiIcon className="w-7 h-7 text-red-500" />
            <div className="overflow-hidden">
                <h2 className="text-lg md:text-xl font-bold text-slate-100 truncate">{(needsFetch && astroData?.resolvedName) ? astroData.resolvedName : object.name}</h2>
                <p className="text-xs text-red-400 truncate">{displayType}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-2 rounded-full transition-colors hover:bg-slate-700 touch-manipulation">
            <CloseIcon className="w-6 h-6" />
          </button>
        </header>

        <div className="p-4 md:p-6 overflow-y-auto space-y-4 scrollbar-thin scrollbar-thumb-red-900 scrollbar-track-slate-900">
           <div className="w-full h-40 md:h-48 rounded-lg overflow-hidden border border-slate-700 relative bg-black flex items-center justify-center shrink-0">
               {isDataLoading && !displayImage ? (
                   <div className="w-6 h-6 border-2 border-t-transparent border-slate-500 rounded-full animate-spin"></div>
               ) : displayImage ? (
                   <>
                       <img 
                         src={displayImage} 
                         alt={(needsFetch && astroData?.resolvedName) ? astroData.resolvedName : object.name} 
                         className="w-full h-full object-contain"
                       />
                       {imageSourceLabel && (
                           <div className="absolute bottom-0 right-0 bg-black/60 text-[10px] text-slate-400 px-2 py-1">
                             Source: {imageSourceLabel}
                           </div>
                       )}
                   </>
               ) : (
                   <div className="text-slate-600 text-sm italic">No image available</div>
               )}
           </div>

           <div className="grid grid-cols-5 gap-2">
               {onCenter && (
                  <button 
                    onClick={() => onCenter(object)} 
                    className="flex items-center justify-center gap-1 bg-slate-700 hover:bg-slate-600 text-white text-[10px] sm:text-xs px-1 py-3 rounded transition-colors border border-slate-600"
                    title={t('geminiModal.centerView')}
                  >
                      <ResetIcon className="w-3 h-3 sm:w-4 sm:h-4" />
                      <span className="hidden sm:inline truncate">{t('geminiModal.centerView')}</span>
                      <span className="sm:hidden">Center</span>
                  </button>
               )}
               {onGoTo && (
                  <button 
                    onClick={() => {
                        if (isConnected) onGoTo(object);
                    }} 
                    disabled={!isConnected}
                    className={`flex items-center justify-center gap-1 text-[10px] sm:text-xs px-1 py-3 rounded transition-colors
                        ${isConnected 
                            ? 'bg-red-700 hover:bg-red-600 text-white shadow-red-900/50 shadow-sm' 
                            : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700 opacity-70'}
                    `}
                    title={!isConnected ? 'Connect driver to use GoTo' : t('geminiModal.goTo')}
                  >
                      <CrosshairIcon className="w-3 h-3 sm:w-4 sm:h-4" />
                      <span className="hidden sm:inline truncate">{t('geminiModal.goTo')}</span>
                      <span className="sm:hidden">GoTo</span>
                  </button>
               )}
                <button 
                    onClick={handleSearchSimbad} 
                    className="flex items-center justify-center gap-1 text-[10px] sm:text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-1 py-3 rounded border border-slate-700 transition-colors"
                >
                    <span className="hidden sm:inline truncate">{t('geminiModal.searchSimbad')}</span>
                    <span className="sm:hidden">Simbad</span>
                </button>
                <button 
                    onClick={handleSearchWikipedia} 
                    className="flex items-center justify-center gap-1 text-[10px] sm:text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-1 py-3 rounded border border-slate-700 transition-colors"
                >
                    <span className="hidden sm:inline truncate">{t('geminiModal.searchWikipedia')}</span>
                    <span className="sm:hidden">Wiki</span>
                </button>
                <button 
                    onClick={handleSendToSamp}
                    disabled={!isSampConnected}
                    className={`flex items-center justify-center gap-1 text-[10px] sm:text-xs px-1 py-3 rounded transition-colors border
                        ${isSampConnected
                            ? 'bg-slate-800 hover:bg-slate-700 text-blue-300 border-blue-900/50 hover:border-blue-500' 
                            : 'bg-slate-900 text-slate-600 border-slate-800 cursor-not-allowed'}
                    `}
                    title={isSampConnected ? t('controlPanel.viewInAladin') : "SAMP Disconnected"}
                >
                    <AladinIcon className="w-3 h-3 sm:w-4 sm:h-4" />
                    <span className="hidden sm:inline truncate">Aladin</span>
                    <span className="sm:hidden">SAMP</span>
                </button>
           </div>

           <div className="grid grid-cols-4 gap-px bg-red-900/30 rounded-lg overflow-hidden border border-red-900/30 shrink-0">
              <div className="bg-slate-800/80 p-2 sm:p-3">
                  <div className="text-slate-500 uppercase text-[10px] font-bold tracking-wider mb-1">{t('controlPanel.targetInfo.type')}</div>
                  <div className="text-xs sm:text-sm text-slate-200 font-mono truncate" title={displayType}>{displayType}</div>
              </div>
              <div className="bg-slate-800/80 p-2 sm:p-3">
                  <div className="text-slate-500 uppercase text-[10px] font-bold tracking-wider mb-1">{t('geminiModal.realtime.magnitude')}</div>
                  <div className="text-sm sm:text-base text-slate-200 font-mono">{displayMag}</div>
              </div>
              <div className="bg-slate-800/80 p-2 sm:p-3">
                  <div className="text-slate-500 uppercase text-[10px] font-bold tracking-wider mb-1">{t('geminiModal.realtime.ra')}</div>
                  <div className="text-xs sm:text-sm text-slate-300 font-mono">{displayRa}</div>
              </div>
              <div className="bg-slate-800/80 p-2 sm:p-3">
                  <div className="text-slate-500 uppercase text-[10px] font-bold tracking-wider mb-1">{t('geminiModal.realtime.dec')}</div>
                  <div className="text-xs sm:text-sm text-slate-300 font-mono">{displayDec}</div>
              </div>
              
              <div className="bg-slate-800/80 p-2 sm:p-3">
                  <div className="text-slate-500 uppercase text-[10px] font-bold tracking-wider mb-1">{t('geminiModal.realtime.azAlt')}</div>
                  <div className="text-xs sm:text-sm text-slate-300 font-mono">
                      {realtimeData ? `${realtimeData.az}° / ${realtimeData.alt}°` : '-- / --'}
                  </div>
              </div>
              <div className="bg-slate-800/80 p-2 sm:p-3">
                  <div className="text-slate-500 uppercase text-[10px] font-bold tracking-wider mb-1">{t('geminiModal.realtime.transit')}</div>
                  <div className="text-sm sm:text-base text-slate-200 font-mono">{realtimeData?.transit || '--:--'}</div>
              </div>
               <div className="bg-slate-800/80 p-2 sm:p-3 col-span-2">
                  <div className="text-slate-500 uppercase text-[10px] font-bold tracking-wider mb-1">{t('geminiModal.realtime.visibility')}</div>
                  <div className={`text-sm sm:text-base font-mono ${realtimeData?.isRising ? 'text-green-500' : 'text-red-500'}`}>
                      {realtimeData ? (realtimeData.isRising ? t('geminiModal.realtime.visible') : t('geminiModal.realtime.set')) : '---'}
                  </div>
              </div>
           </div>

           {(isInitialLoading || isSummarizing) && (
            <div className="flex flex-col items-center justify-center gap-4 py-8">
              <div className="w-8 h-8 border-2 border-t-transparent border-red-500 rounded-full animate-spin"></div>
              <p className="text-red-400 text-sm animate-pulse">
                  {isSummarizing ? (language === 'ja' ? '情報を取得・要約中...' : 'Fetching & Summarizing...') : t('geminiModal.thinking')}
              </p>
            </div>
          )}
          
          {!(isInitialLoading || isSummarizing) && displayContent && (
            <div className="animate-fadeIn">
                 <h3 className="text-lg font-bold text-red-500 mb-3 border-b border-red-900/30 pb-2">{t('geminiModal.description')}</h3>
                <div className="prose prose-invert prose-sm sm:prose-base max-w-none text-slate-300 leading-relaxed" dangerouslySetInnerHTML={{ __html: displayContent.replace(/\n/g, '<br />') }}>
                </div>
            </div>
          )}
        </div>
        <footer className="p-3 bg-slate-900 border-t border-red-900/30 text-center text-xs text-slate-500 shrink-0">
            {t('geminiModal.footer')}
        </footer>
      </div>
    </div>
  );
};
