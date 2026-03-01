
export interface SimbadData {
    type: string;
    magnitude: string;
    ra: string;
    dec: string;
}

const PROXY_BASE = "https://corsproxy.io/?";
const BACKUP_PROXY = "https://api.allorigins.win/raw?url=";
const SIMBAD_URL = "https://cdsweb.u-strasbg.fr/cgi-bin/nph-sesame/-oxp/SNVA?";

// Mapping Simbad OTYPE codes to readable English/Japanese
const TYPE_MAPPING: Record<string, { en: string, ja: string }> = {
    'GlCl': { en: 'Globular Cluster', ja: '球状星団' },
    'OpCl': { en: 'Open Cluster', ja: '散開星団' },
    'OpC': { en: 'Open Cluster', ja: '散開星団' },
    'OC': { en: 'Open Cluster', ja: '散開星団' },
    'Cl*': { en: 'Star Cluster', ja: '星団' },
    'G': { en: 'Galaxy', ja: '銀河' },
    'Sy1': { en: 'Seyfert Galaxy', ja: 'セイファート銀河' },
    'Sy2': { en: 'Seyfert Galaxy', ja: 'セイファート銀河' },
    'SBG': { en: 'Starburst Galaxy', ja: 'スターバースト銀河' },
    'LSB': { en: 'Low Surface Brightness Galaxy', ja: '低表面輝度銀河' },
    'AGN': { en: 'Active Galaxy Nucleus', ja: '活動銀河核' },
    'QSO': { en: 'Quasar', ja: 'クエーサー' },
    'Neb': { en: 'Nebula', ja: '星雲' },
    'PlNb': { en: 'Planetary Nebula', ja: '惑星状星雲' },
    'PN': { en: 'Planetary Nebula', ja: '惑星状星雲' },
    'HII': { en: 'HII Region', ja: 'HII領域' },
    'Rn': { en: 'Reflection Nebula', ja: '反射星雲' },
    'SNR': { en: 'Supernova Remnant', ja: '超新星残骸' },
    'Star': { en: 'Star', ja: '恒星' },
    '*': { en: 'Star', ja: '恒星' },
    '**': { en: 'Double Star', ja: '二重星' },
    'V*': { en: 'Variable Star', ja: '変光星' },
    'PM*': { en: 'High Proper Motion Star', ja: '高固有運動星' },
    'Planet': { en: 'Planet', ja: '惑星' },
    'GinCl': { en: 'Galaxy in Cluster', ja: '銀河団内の銀河' },
    'LINER': { en: 'LINER Galaxy', ja: 'ライナー銀河' },
    'EmG': { en: 'Emission Line Galaxy', ja: '輝線銀河' },
    'IG': { en: 'Interacting Galaxy', ja: '相互作用銀河' },
    'RadioG': { en: 'Radio Galaxy', ja: '電波銀河' },
    'Seyfert': { en: 'Seyfert Galaxy', ja: 'セイファート銀河' },
    'PartofG': { en: 'Part of Galaxy', ja: '銀河の一部' },
    'Assoc*': { en: 'Association of Stars', ja: 'アソシエーション' },
    'PairG': { en: 'Pair of Galaxies', ja: '銀河対' },
    'GroupG': { en: 'Group of Galaxies', ja: '銀河群' },
    'ClG': { en: 'Cluster of Galaxies', ja: '銀河団' },
    'SuperClG': { en: 'Supercluster of Galaxies', ja: '超銀河団' },
    'H2G': { en: 'HII Galaxy', ja: 'HII銀河' },
    'GiC': { en: 'Galaxy in Cluster', ja: '銀河団内の銀河' },
    'BiC': { en: 'Brightest in Cluster', ja: '銀河団で最も明るい銀河' },
    'Irregular_V*': { en: 'Irregular Variable', ja: '不規則変光星' },
    'Blue': { en: 'Blue Object', ja: '青色天体' },
    'UV': { en: 'UV Source', ja: '紫外線源' },
    'X': { en: 'X-ray Source', ja: 'X線源' },
    'IR': { en: 'IR Source', ja: '赤外線源' },
    'MolCld': { en: 'Molecular Cloud', ja: '分子雲' },
    'DkNeb': { en: 'Dark Nebula', ja: '暗黒星雲' },
    'GCl': { en: 'Globular Cluster', ja: '球状星団' },
    'Nova': { en: 'Nova', ja: '新星' },
    'SN': { en: 'Supernova', ja: '超新星' }
};

const mapSimbadTypes = (otype: string, lang: 'en' | 'ja'): string => {
    if (!otype) return '';
    const cleanType = otype.trim();
    
    // Direct match (Case Insensitive Search)
    const keys = Object.keys(TYPE_MAPPING);
    const matchKey = keys.find(k => k.toLowerCase() === cleanType.toLowerCase());
    
    if (matchKey) {
        return TYPE_MAPPING[matchKey][lang];
    }
    
    // Heuristic mappings for unmapped types
    if (cleanType.includes('Cl') || cleanType.includes('Cluster')) return lang === 'ja' ? '星団' : 'Cluster';
    if (cleanType.includes('G') || cleanType.includes('Galaxy')) return lang === 'ja' ? '銀河' : 'Galaxy';
    if (cleanType.includes('Neb')) return lang === 'ja' ? '星雲' : 'Nebula';
    if (cleanType.includes('*') || cleanType.includes('Star')) return lang === 'ja' ? '恒星' : 'Star';
    
    // Heuristic for Galaxy morphological types often seen in raw Simbad (e.g. "Sb", "E3", "S0")
    if (cleanType.length < 5 && /^(S|E|Irr|cD|dE|dS|Pec)/i.test(cleanType)) {
         return lang === 'ja' ? '銀河' : 'Galaxy';
    }

    return cleanType; 
};

const fetchWithRetry = async (url: string): Promise<string | null> => {
    const encodedUrl = encodeURIComponent(url);
    
    try {
        const res = await fetch(`${PROXY_BASE}${encodedUrl}`);
        if (res.ok) {
            const text = await res.text();
            if (text.includes('<Sesame') || text.includes('<?xml')) return text;
        }
    } catch (e) { 
        // console.warn("Primary proxy failed"); 
    }

    try {
        const res = await fetch(`${BACKUP_PROXY}${encodedUrl}`);
        if (res.ok) {
            const text = await res.text();
            if (text.includes('<Sesame') || text.includes('<?xml')) return text;
        }
    } catch (e) { 
        console.warn("Simbad fetch failed via all proxies", e); 
    }

    return null;
};

export const fetchSimbadData = async (objectName: string, lang: 'en' | 'ja' = 'en'): Promise<SimbadData | null> => {
    try {
        const cleanName = objectName.split('(')[0].trim();
        const url = `${SIMBAD_URL}${cleanName}`; 
        
        const xmlText = await fetchWithRetry(url);
        if (!xmlText) return null;

        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, "text/xml");

        const resolvers = xmlDoc.getElementsByTagName("Resolver");
        let resolver: Element | null = null;
        
        for (let i = 0; i < resolvers.length; i++) {
            if (resolvers[i].getAttribute("name")?.includes("Simbad")) {
                resolver = resolvers[i];
                break;
            }
        }
        if (!resolver && resolvers.length > 0) resolver = resolvers[0];

        if (!resolver) return null;

        const jradeg = resolver.getElementsByTagName("jradeg")[0]?.textContent;
        const jdedeg = resolver.getElementsByTagName("jdedeg")[0]?.textContent;
        const otype = resolver.getElementsByTagName("otype")[0]?.textContent;
        
        // --- Magnitude Parsing Logic ---
        let mag = '';
        
        // STRICT REQUIREMENT: Only Visual Magnitude (V)
        // Check case-insensitive 'V', 'v', 'Visual'
        const isVisual = (val: string | null) => {
            if (!val) return false;
            return val.trim().toUpperCase() === 'V';
        };

        // 1. Check <mag> tags
        const mags = resolver.getElementsByTagName("mag");
        for (let i = 0; i < mags.length; i++) {
            const el = mags[i];
            const band = el.getAttribute("band");
            if (isVisual(band)) {
                mag = el.textContent?.trim() || '';
                break;
            }
        }

        // 2. Check <flux> tags (fallback if not in <mag> but still V band)
        if (!mag) {
            const fluxes = resolver.getElementsByTagName("flux");
            for (let i = 0; i < fluxes.length; i++) {
                const el = fluxes[i];
                const unit = el.getAttribute("unit");
                // Filters often look like 'V' or 'B' or 'J'. Sometimes 'band' attr is used instead of filter.
                const filter = el.getAttribute("filter") || el.getAttribute("band");
                
                if (unit === 'mag' && isVisual(filter)) {
                    mag = el.textContent?.trim() || '';
                    break;
                }
            }
        }
        
        // Clean magnitude string (remove brackets, <, >, whitespace)
        if (mag) {
            mag = mag.replace(/[<>~]/g, '').trim();
        }

        if (!jradeg || !jdedeg) {
            return null; 
        }

        const raVal = parseFloat(jradeg);
        const decVal = parseFloat(jdedeg);

        const raH = Math.floor(raVal / 15);
        const raM = Math.floor(((raVal / 15) - raH) * 60);
        const raS = (((raVal / 15) - raH) * 60 - raM) * 60;
        const raStr = `${raH}h ${raM}m ${raS.toFixed(2)}s`;

        const decSign = decVal >= 0 ? '+' : '-';
        const decAbs = Math.abs(decVal);
        const decD = Math.floor(decAbs);
        const decMin = Math.floor((decAbs - decD) * 60);
        const decSec = ((decAbs - decD) * 60 - decMin) * 60;
        const decStr = `${decSign}${decD}° ${decMin}′ ${decSec.toFixed(2)}″`;

        return {
            type: mapSimbadTypes(otype || '', lang),
            magnitude: mag,
            ra: raStr,
            dec: decStr
        };

    } catch (e) {
        console.warn("Simbad processing error:", e);
        return null;
    }
};
