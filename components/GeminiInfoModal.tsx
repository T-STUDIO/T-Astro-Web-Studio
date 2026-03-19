
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

      Promise.all([
          fetchWikiImage(object.name),
          resolveAstroData(object, langCode)
      ]).then(([url, stats]) => {
          if (url) setWikiImage(url);
          if (stats) setAstroData(stats);
          setIsDataLoading(false);
      });
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
      const name = language === 'ja' && object.nameJa ? object.nameJa.split('(')[0].trim() : object.name.split('(')[0].trim();
      const langPrefix = language === 'ja' ? 'ja' : 'en';
      
      // 1. Open link in new tab (existing behavior)
      const url = `https://${langPrefix}.wikipedia.org/wiki/${encodeURIComponent(name)}`;
      window.open(url, '_blank', 'noopener,noreferrer');

      // 2. Fetch and summarize (new behavior)
      setIsSummarizing(true);
      try {
          const summaryText = await fetchWikiSummary(name, langPrefix as 'en' | 'ja');
          if (summaryText) {
              const summarized = await summarizeExternalInfo(object.name, summaryText, 'Wikipedia', language);
              setDisplayContent(summarized);
          }
      } catch (e) {
          console.error("Wiki summarization failed", e);
      } finally {
          setIsSummarizing(false);
      }
  };

  const handleSearchSimbad = async () => {
      const name = object.name.split('(')[0].trim();
      
      // 1. Open link in new tab (existing behavior)
      const url = `http://simbad.cds.unistra.fr/simbad/sim-basic?Ident=${encodeURIComponent(name)}&submit=SIMBAD+search`;
      window.open(url, '_blank', 'noopener,noreferrer');

      // 2. Fetch and summarize (new behavior)
      setIsSummarizing(true);
      try {
          // SIMBAD data is mostly structured, so we fetch it and ask Gemini to explain it
          const simbadData = await fetchSimbadData(object.name, language);
          if (simbadData) {
              const aliases = simbadData.aliases ? `Aliases: ${simbadData.aliases.join(', ')}` : '';
              const rawText = `Type: ${simbadData.type}, RA: ${simbadData.ra}, Dec: ${simbadData.dec}, Magnitude: ${simbadData.magnitude}. ${aliases}`;
              const summarized = await summarizeExternalInfo(object.name, rawText, 'SIMBAD', language);
              setDisplayContent(summarized);
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
                <h2 className="text-lg md:text-xl font-bold text-slate-100 truncate">{object.name}</h2>
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
                         alt={object.name} 
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
                      {realtimeData ? `${realtimeData.azimuth} / ${realtimeData.altitude}` : '-- / --'}
                  </div>
              </div>
              <div className="bg-slate-800/80 p-2 sm:p-3">
                  <div className="text-slate-500 uppercase text-[10px] font-bold tracking-wider mb-1">{t('geminiModal.realtime.transit')}</div>
                  <div className="text-sm sm:text-base text-slate-200 font-mono">{realtimeData?.transitTime || '--:--'}</div>
              </div>
               <div className="bg-slate-800/80 p-2 sm:p-3 col-span-2">
                  <div className="text-slate-500 uppercase text-[10px] font-bold tracking-wider mb-1">{t('geminiModal.realtime.visibility')}</div>
                  <div className={`text-sm sm:text-base font-mono ${realtimeData?.isVisible ? 'text-green-500' : 'text-red-500'}`}>
                      {realtimeData ? (realtimeData.isVisible ? t('geminiModal.realtime.visible') : t('geminiModal.realtime.set')) : '---'}
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
