
import { CelestialObject } from '../types';

// Deterministic Pseudo-random number generator to ensure stars are in the same place every refresh
let seed = 4567; // Changed seed
const random = () => {
    const x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
};

const formatHMS = (deg: number) => {
    const hrs = Math.floor(deg / 15);
    const mins = Math.floor((deg % 15) * 4);
    const secs = Math.floor(((deg % 15) * 4 % 1) * 60);
    return `${hrs}h ${mins}m ${secs}s`;
};

const formatDMS = (deg: number) => {
    const sign = deg >= 0 ? '+' : '-';
    const abs = Math.abs(deg);
    const d = Math.floor(abs);
    const m = Math.floor((abs - d) * 60);
    const s = Math.floor(((abs - d) * 60 % 1) * 60);
    return `${sign}${d}° ${m}′ ${s}″`;
};

// Generate high density background stars to mimic KStars database
// Magnitudes between 4.5 and 15.0 to provide depth
export const generateBackgroundStars = (): CelestialObject[] => {
    const stars: CelestialObject[] = [];
    const count = 10000; // Increase to 10,000 for realistic density up to mag 15

    for (let i = 0; i < count; i++) {
        // Random position on sphere
        // RA: 0 to 360
        const raDeg = random() * 360;
        // Dec: Acos distribution to distribute evenly on sphere surface
        const decRad = Math.acos(2 * random() - 1) - Math.PI / 2; 
        const decDeg = decRad * (180 / Math.PI);

        // Magnitude: skewed towards fainter stars
        // Range 4.5 to 15.0
        // Using a power curve to create fewer bright stars and many faint ones
        const r = random();
        const mag = 4.5 + (r * r) * 10.5; // Maps 0..1 to 4.5..15.0 roughly

        stars.push({
            id: `bg_star_${i}`,
            name: '', // Background stars don't need names
            nameJa: '', 
            type: 'Star',
            ra: formatHMS(raDeg),
            dec: formatDMS(decDeg),
            magnitude: mag,
            image: '',
            blurryImage: '',
            annotations: []
        });
    }

    return stars;
};

export const BACKGROUND_STARS = generateBackgroundStars();
