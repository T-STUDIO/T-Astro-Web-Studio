
import { CelestialObject } from '../types';
import { fetchWikiAstroData } from './wikipediaService';
import { fetchSimbadData } from './simbadService';
import { CELESTIAL_OBJECTS, NGC_TO_MESSIER } from '../constants';
import { EXTENDED_DSO_CATALOG } from '../utils/dsoCatalog';
import { solarSystemService } from './solarSystemService';
import { degreesToHms, degreesToDms, hmsToDegrees, dmsToDegrees } from '../utils/coords';

export interface AstroData {
    type: string;
    magnitude: string;
    ra: string;
    dec: string;
    source: 'Database' | 'Wikipedia' | 'Simbad' | 'Wiki+Simbad';
    isLoading?: boolean;
    resolvedName?: string;
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

export const resolveAstroData = async (obj: CelestialObject, lang: 'en' | 'ja', localSolverSettings?: { host: string; port: number }): Promise<AstroData> => {
    const isSolarSystem = obj.id === 'moon' || ['mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune'].includes(obj.id || '');
    if (isSolarSystem) {
        const solarObj = solarSystemService.calculatePositions().find(s => s.id === obj.id);
        if (solarObj) {
            return {
                type: lang === 'ja' ? '惑星' : 'Planet',
                magnitude: solarObj.magnitude.toFixed(1),
                ra: solarObj.ra,
                dec: solarObj.dec,
                source: 'Database',
                isLoading: false
            };
        }
    }

    // 内部データベースの正規の天体かどうかを検索
    const dbObject = CELESTIAL_OBJECTS.find(o => 
        o.id === obj.id || 
        o.name === obj.name || 
        (o.nameJa && obj.nameJa && o.nameJa === obj.nameJa)
    ) || EXTENDED_DSO_CATALOG.find(o => 
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

    const isBgStar = obj.id?.startsWith('bg_star_') || obj.id?.startsWith('real_star_');
    const isServerStar = obj.id?.startsWith('server-star-');

    let queryName = obj.name || '';
    if (!queryName && (isBgStar || isServerStar)) {
        queryName = 'Star';
    }

    if (!queryName) {
        return {
            type: internalType,
            magnitude: obj.magnitude ? obj.magnitude.toFixed(1) : '---',
            ra: obj.ra,
            dec: obj.dec,
            source: 'Database',
            isLoading: false
        };
    }

    // --- Try Local SQLite Database Resolve First (Zero-Network, Instant) ---
    try {
        const cleanQueryName = queryName.split('(')[0].split('（')[0].trim();
        const host = localSolverSettings?.host || 'localhost';
        const port = localSolverSettings?.port || 6001;
        let url = `http://${host}:${port}/api/resolve_name?name=${encodeURIComponent(cleanQueryName)}`;
        if (obj.ra && obj.dec) {
            const raDeg = typeof obj.ra === 'number' ? obj.ra : hmsToDegrees(obj.ra);
            const decDeg = typeof obj.dec === 'number' ? obj.dec : dmsToDegrees(obj.dec);
            if (!isNaN(raDeg) && !isNaN(decDeg)) {
                url += `&ra=${raDeg}&dec=${decDeg}`;
            }
        }
        const localRes = await fetch(url);
        const localData = await localRes.json();
        if (localData && localData.status === 'success') {
            let dispType = localData.type || '---';
            if (lang === 'ja' && TYPE_MAP_JA[dispType]) {
                dispType = TYPE_MAP_JA[dispType];
            }
            
            // SQLite returns floats for RA/Dec degrees, format them into HMS/DMS for HUD
            const rawRa = Number(localData.ra);
            const rawDec = Number(localData.dec);
            const formattedRa = isNaN(rawRa) ? (localData.ra || '---') : degreesToHms(rawRa);
            const formattedDec = isNaN(rawDec) ? (localData.dec || '---') : degreesToDms(rawDec);

            return {
                type: dispType,
                magnitude: (localData.mag !== undefined && localData.mag !== null && !isNaN(Number(localData.mag))) ? Number(localData.mag).toFixed(1) : '---',
                ra: formattedRa,
                dec: formattedDec,
                source: 'Database',
                isLoading: false,
                resolvedName: localData.name
            };
        }
    } catch (e) {
        console.warn("Failed to query resolve_name from local SQLite API:", e);
    }

    const isAnno = obj.id?.startsWith('anno_');
    if (isAnno) {
        const cleanSimbadName = obj.name.split('(')[0].trim();
        try {
            const simbadData = await fetchSimbadData(cleanSimbadName, lang);
            if (simbadData) {
                return {
                    type: simbadData.type || obj.type || '---',
                    magnitude: simbadData.magnitude || '---',
                    ra: simbadData.ra || '---',
                    dec: simbadData.dec || '---',
                    source: 'Simbad',
                    isLoading: false
                };
            }
        } catch (simbadErr) {
            console.warn("Failed online SIMBAD query for anno, falling back to original annotation details:", simbadErr);
        }
        
        // If SIMBAD lookup fails or is offline, instantly return the original annotated values to prevent infinite loading
        return {
            type: obj.type || '---',
            magnitude: (obj.magnitude !== undefined && obj.magnitude !== null) ? obj.magnitude.toFixed(1) : '---',
            ra: obj.ra || '---',
            dec: obj.dec || '---',
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
    } else {
        if (obj.ra) finalData.ra = obj.ra;
        if (obj.dec) finalData.dec = obj.dec;
    }

    // 2. Magnitude (Wikipedia priority)
    if (wikiData?.magnitude && wikiData.magnitude.trim() !== '') {
        finalData.magnitude = wikiData.magnitude;
        hasExternalData = true;
    } else if (simbadData?.magnitude && simbadData.magnitude.trim() !== '') {
        finalData.magnitude = simbadData.magnitude;
        hasExternalData = true;
    } else {
        if (obj.magnitude !== undefined && obj.magnitude !== null) {
            finalData.magnitude = obj.magnitude.toFixed(1);
        }
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
