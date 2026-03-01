
import { CelestialObject } from '../types';
import { fetchWikiAstroData } from './wikipediaService';
import { fetchSimbadData } from './simbadService';
import { CELESTIAL_OBJECTS, NGC_TO_MESSIER } from '../constants';

export interface AstroData {
    type: string;
    magnitude: string;
    ra: string;
    dec: string;
    source: 'Database' | 'Wikipedia' | 'Simbad' | 'Wiki+Simbad';
    isLoading?: boolean;
}

const TYPE_MAP_JA: Record<string, string> = {
    'Galaxy': '銀河',
    'Nebula': '星雲',
    'Star Cluster': '星団',
    'Open Cluster': '散開星団',
    'Globular Cluster': '球状星団',
    'Planet': '惑星',
    'Star': '恒星',
    'Double Star': '二重星',
    'Supernova Remnant': '超新星残骸'
};

export const resolveAstroData = async (obj: CelestialObject, lang: 'en' | 'ja'): Promise<AstroData> => {
    // 内部データベースの正規の天体かどうかを検索
    const dbObject = CELESTIAL_OBJECTS.find(o => 
        o.id === obj.id || 
        o.name === obj.name || 
        (o.nameJa && obj.nameJa && o.nameJa === obj.nameJa)
    );

    let internalType = dbObject ? dbObject.type : obj.type;
    if (lang === 'ja' && TYPE_MAP_JA[internalType]) {
        internalType = TYPE_MAP_JA[internalType] as any;
    }
    
    // Internal DB priority
    if (dbObject) {
        return {
            type: internalType,
            magnitude: dbObject.magnitude.toFixed(1),
            ra: dbObject.ra,
            dec: dbObject.dec,
            source: 'Database',
            isLoading: false
        };
    }

    if (!obj.name) {
        return {
            type: internalType,
            magnitude: obj.magnitude ? obj.magnitude.toFixed(1) : '---',
            ra: obj.ra,
            dec: obj.dec,
            source: 'Database',
            isLoading: false
        };
    }

    // --- Search Name Resolution with NGC->Messier Preference ---
    let searchName = obj.name;
    const ngcMatch = obj.name.match(/NGC\s*(\d+)/i);
    if (ngcMatch) {
        const ngcNum = parseInt(ngcMatch[1]);
        // If it's an NGC object that is also a Messier object, prefer the Messier name for lookup
        // as it often yields better results in Wikipedia/Simbad for popular objects.
        if (NGC_TO_MESSIER[ngcNum]) {
            searchName = NGC_TO_MESSIER[ngcNum];
        }
    }

    // Clean name for Simbad (remove parens)
    const cleanSimbadName = searchName.split('(')[0].trim(); 
    
    // For Japanese Wikipedia search
    if (lang === 'ja' && obj.nameJa) {
        searchName = obj.nameJa.split('(')[0].trim();
    } else {
        searchName = searchName.split('(')[0].trim();
    }

    // Parallel Fetch
    const [wikiData, simbadData] = await Promise.all([
        fetchWikiAstroData(searchName, lang).catch(() => null),
        fetchSimbadData(cleanSimbadName, lang).catch(() => null)
    ]);

    const finalData: AstroData = {
        type: '---',
        magnitude: '---',
        ra: '---',
        dec: '---',
        source: 'Simbad',
        isLoading: false
    };

    let hasExternalData = false;

    // 1. Coordinates (Simbad priority)
    if (simbadData?.ra && simbadData?.dec) {
        finalData.ra = simbadData.ra;
        finalData.dec = simbadData.dec;
        hasExternalData = true;
    } else if (wikiData?.ra && wikiData?.dec) {
        finalData.ra = wikiData.ra;
        finalData.dec = wikiData.dec;
        hasExternalData = true;
    }

    // 2. Magnitude (Wikipedia priority)
    if (wikiData?.magnitude && wikiData.magnitude.trim() !== '') {
        finalData.magnitude = wikiData.magnitude;
        hasExternalData = true;
    } else if (simbadData?.magnitude && simbadData.magnitude.trim() !== '') {
        finalData.magnitude = simbadData.magnitude;
        hasExternalData = true;
    }

    // 3. Type (Wikipedia priority)
    if (wikiData?.type && wikiData.type.trim() !== '') {
        finalData.type = wikiData.type;
        hasExternalData = true;
    } else if (simbadData?.type && simbadData.type.trim() !== '') {
        finalData.type = simbadData.type;
        hasExternalData = true;
    } else {
        finalData.type = internalType; 
    }

    if (hasExternalData) {
        if (wikiData && simbadData) finalData.source = 'Wiki+Simbad';
        else if (simbadData) finalData.source = 'Simbad';
        else if (wikiData) finalData.source = 'Wikipedia';
    }

    return finalData;
};
