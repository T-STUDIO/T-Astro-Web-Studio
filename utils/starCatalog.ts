
import { CelestialObject } from '../types';
import { REAL_STARS_DATA } from '../data/realStarsData';

const formatHMS = (h: number, m: number) => `${h}h ${m}m 00s`;
const formatDMS = (d: number, m: number) => {
    const sign = d >= 0 ? '+' : '-';
    return `${sign}${Math.abs(d)}° ${Math.abs(m)}′ 00″`;
};

export const getRealStarCatalog = (): CelestialObject[] => {
    const catalog: CelestialObject[] = [];
    const step = 5; // Entries per star: RA_H, RA_M, Dec_D, Dec_M, Mag
    
    for (let i = 0; i < REAL_STARS_DATA.length; i += step) {
        const raH = REAL_STARS_DATA[i];
        const raM = REAL_STARS_DATA[i+1];
        const decD = REAL_STARS_DATA[i+2];
        const decM = REAL_STARS_DATA[i+3];
        const mag = REAL_STARS_DATA[i+4];
        
        const id = `real_star_${i/step}_${raH}_${decD}`;
        
        catalog.push({
            id,
            name: '',
            nameJa: '',
            type: 'Star',
            ra: formatHMS(raH, raM),
            dec: formatDMS(decD, decM),
            magnitude: mag,
            image: '',
            blurryImage: '',
            annotations: []
        });
    }
    return catalog;
};
