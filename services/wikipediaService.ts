
export interface WikiAstroData {
    type?: string;
    magnitude?: string;
    ra?: string;
    dec?: string;
}

export const fetchWikiImage = async (objectName: string): Promise<string | null> => {
  try {
    const searchName = objectName.split('(')[0].trim();
    
    const params = new URLSearchParams({
      action: 'query',
      format: 'json',
      prop: 'pageimages',
      generator: 'search',
      gsrsearch: searchName,
      gsrlimit: '1',
      pithumbsize: '600',
      origin: '*',
      redirects: '1'
    });

    const response = await fetch(`https://en.wikipedia.org/w/api.php?${params.toString()}`);
    const data = await response.json();

    const pages = data.query?.pages;
    if (!pages) return null;

    const pageId = Object.keys(pages)[0];
    if (!pageId || pageId === '-1') return null;

    const page = pages[pageId];
    return page.thumbnail?.source || null;

  } catch (error) {
    console.warn("Wikipedia image fetch failed:", error);
    return null;
  }
};

export const fetchWikiAstroData = async (objectName: string, lang: 'en' | 'ja' = 'en'): Promise<WikiAstroData | null> => {
    try {
        const searchName = objectName.split('(')[0].trim();
        const endpoint = `https://${lang}.wikipedia.org/w/api.php`;

        // 1. Search to get the correct Title (handling redirects via API is safer in content fetch, but search helps match relevance)
        const searchParams = new URLSearchParams({
            action: 'query',
            list: 'search',
            srsearch: searchName,
            srlimit: '1',
            format: 'json',
            origin: '*'
        });

        const searchRes = await fetch(`${endpoint}?${searchParams.toString()}`);
        const searchData = await searchRes.json();
        
        if (!searchData.query?.search?.length) return null;
        const title = searchData.query.search[0].title;

        // 2. Fetch Content (Revisions) with redirects=1 to handle aliases
        const contentParams = new URLSearchParams({
            action: 'query',
            prop: 'revisions',
            rvprop: 'content',
            rvsection: '0', // Only header/infobox section
            titles: title,
            format: 'json',
            origin: '*',
            redirects: '1' 
        });

        const contentRes = await fetch(`${endpoint}?${contentParams.toString()}`);
        const contentData = await contentRes.json();
        
        const pages = contentData.query?.pages;
        if (!pages) return null;
        
        const pageId = Object.keys(pages)[0];
        if (pageId === '-1') return null;
        
        const content = pages[pageId].revisions?.[0]?.['*'];
        if (!content) return null;

        return parseInfobox(content, lang);

    } catch (e) {
        console.warn("Wikipedia astro data fetch failed:", e);
        return null;
    }
};

export const fetchWikiSummary = async (objectName: string, lang: 'en' | 'ja' = 'en'): Promise<string | null> => {
    try {
        const searchName = objectName.split('(')[0].trim();
        const endpoint = `https://${lang}.wikipedia.org/w/api.php`;

        const params = new URLSearchParams({
            action: 'query',
            format: 'json',
            prop: 'extracts',
            exintro: '1',
            explaintext: '1',
            titles: searchName,
            redirects: '1',
            origin: '*'
        });

        const response = await fetch(`${endpoint}?${params.toString()}`);
        const data = await response.json();
        
        const pages = data.query?.pages;
        if (!pages) return null;
        
        const pageId = Object.keys(pages)[0];
        if (pageId === '-1') return null;
        
        return pages[pageId].extract || null;
    } catch (e) {
        console.warn("Wikipedia summary fetch failed:", e);
        return null;
    }
};

const cleanWikiText = (text: string): string => {
    if (!text) return '';
    let clean = text;
    // Remove references first to avoid extracting numbers from ref IDs
    clean = clean.replace(/<ref[^>]*>.*?<\/ref>/gs, '');
    clean = clean.replace(/<ref[^>]*\/>/g, '');
    
    // Remove comments
    clean = clean.replace(/<!--.*?-->/gs, '');
    
    // Handle specific value templates BEFORE stripping others
    // {{val|6.1}} -> 6.1
    clean = clean.replace(/{{val\s*\|\s*([^{}|]+)(?:\|[^{}]*)?}}/gi, '$1');
    clean = clean.replace(/{{val\s*\|\s*u=([^{}|]+)(?:\|[^{}]*)?}}/gi, '$1'); // u=... format
    clean = clean.replace(/{{±\|([^{}]+)}}/gi, '±$1');
    
    // Templates removal (generic)
    clean = clean.replace(/{{sfn\|.*?}}/gi, '');
    clean = clean.replace(/{{efn\|.*?}}/gi, '');
    
    // Links [[Target|Label]] -> Label
    clean = clean.replace(/\[\[(?:[^|\]]*\|)?([^\]]+)\]\]/g, '$1');
    
    // Formatting
    clean = clean.replace(/'''?/g, '');
    clean = clean.replace(/<br\s*\/?>/gi, ' ');
    clean = clean.replace(/<\/?[^>]+(>|$)/g, ""); 
    
    // General Cleanup
    clean = clean.replace(/&nbsp;/g, ' ');
    
    // Remove remaining templates but be careful not to kill the string if the template was inline
    // e.g. "6.1 {{sup|V}}" -> "6.1 "
    clean = clean.replace(/{{[^}]*}}/g, ''); 
    
    return clean.trim();
};

const parseRaDecTemplate = (value: string, type: 'RA' | 'DEC'): string | null => {
    if (!value) return null;
    let inner = value.trim();
    
    if (inner.includes('{{')) {
        const match = inner.match(/{{([^{}]+)}}/);
        if (match) {
            const parts = match[1].split('|');
            const tName = parts[0].toLowerCase().trim();
            if (['ra', 'dec', 'wikisky', 'sky', 'ras', 'decs', '赤経', '赤緯', 'ra1', 'dec1', 'deg'].includes(tName)) {
                // Handle named parameters if present, else assume positional
                // Minimal implementation for standard positionals
                const v1 = parts[1] || '0';
                const v2 = parts[2] || '0';
                const v3 = parts[3] || '0';
                if (type === 'RA') return `${v1}h ${v2}m ${v3}s`;
                if (type === 'DEC') return `${v1}° ${v2}′ ${v3}″`;
            }
        }
    }
    const cleaned = cleanWikiText(value);
    if (/\d/.test(cleaned)) return cleaned;
    return null;
};

const parseInfobox = (wikitext: string, lang: 'en' | 'ja'): WikiAstroData => {
    const data: WikiAstroData = {};
    const startMatch = wikitext.match(/{{(?:Infobox|天体[ _]*基本情報|Galaxy|Nebula|Cluster|Star|Planet|天体基本情報)/i);
    if (!startMatch || startMatch.index === undefined) return data;

    const startIdx = startMatch.index;
    let endIdx = startIdx;
    let depth = 0;
    
    for (let i = startIdx; i < wikitext.length; i++) {
        if (wikitext.substring(i, i+2) === '{{') { depth++; i++; }
        else if (wikitext.substring(i, i+2) === '}}') { depth--; i++; }
        
        if (depth === 0 && i > startIdx) {
            endIdx = i;
            break;
        }
    }

    const infoboxContent = wikitext.substring(startIdx, endIdx + 1);
    const paramMap: Record<string, string> = {};
    
    let buffer = "";
    let paramKey = "";
    let insideTemplate = 0;
    let insideLink = 0;
    let isValue = false;
    
    // Strip outer {{ and }}
    let innerContent = infoboxContent.substring(2, infoboxContent.length - 2);
    
    // Skip template name part until first pipe
    const firstPipe = innerContent.indexOf('|');
    if (firstPipe !== -1) innerContent = innerContent.substring(firstPipe + 1);

    for (let i = 0; i < innerContent.length; i++) {
        const c = innerContent[i];
        if (c === '{') insideTemplate++;
        if (c === '}') insideTemplate--;
        if (c === '[') insideLink++;
        if (c === ']') insideLink--;
        
        if (c === '=' && insideTemplate === 0 && insideLink === 0 && !isValue) {
            paramKey = buffer.trim().toLowerCase().replace(/_/g, ' ');
            buffer = "";
            isValue = true;
        } else if (c === '|' && insideTemplate === 0 && insideLink === 0) {
            if (paramKey) paramMap[paramKey] = buffer.trim();
            buffer = "";
            paramKey = "";
            isValue = false;
        } else {
            buffer += c;
        }
    }
    if (paramKey) paramMap[paramKey] = buffer.trim();

    const getKey = (keys: string[]) => {
        for (const k of keys) {
            const cleanK = k.toLowerCase().replace(/_/g, ' ');
            if (paramMap[cleanK]) return paramMap[cleanK];
        }
        return null;
    };

    const typeRaw = getKey([
        '分類', '種別', '形態', '銀河の形態', '種類', '星の分類', 'クラス', 'スペクトル分類', 
        'type', 'classification', 'class', 'objtype', 'stellar classification', 'spectral type', 'morphology'
    ]);
    if (typeRaw) {
        const cleanedType = cleanWikiText(typeRaw);
        if (!cleanedType.includes('NGC') && !cleanedType.includes('Messier')) {
            data.type = cleanedType;
        }
    }

    // Extended Magnitude keys including Japanese variants and V-band specifics
    const magRaw = getKey([
        '視等級', '実視等級', '見かけの等級 (mv)', '見かけの等級', '見かけの等級 (v)', '視等級 (v)', '実視等級 (v)',
        '光度', '等級', '明るさ', '変光範囲', 
        'appmag_v', 'app_mag_v', 'app_mag', 'v_mag', 'appmag', 'app mag', 
        'magnitude', 'apparent magnitude', 'apparent_magnitude', 
        'mv', 'mag_v', 'flux', 'vis_mag'
    ]);
    if (magRaw) data.magnitude = cleanWikiText(magRaw);

    const raRaw = getKey(['赤経', 'ra', 'right ascension', 'ra2000', 'epoch_ra']);
    if (raRaw) data.ra = parseRaDecTemplate(raRaw, 'RA') || cleanWikiText(raRaw);

    const decRaw = getKey(['赤緯', 'dec', 'declination', 'dec2000', 'epoch_dec']);
    if (decRaw) data.dec = parseRaDecTemplate(decRaw, 'DEC') || cleanWikiText(decRaw);

    return data;
};
