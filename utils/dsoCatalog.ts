
import { CelestialObject } from '../types';

// Utility to create a large distribution of Deep Sky Objects (NGC/IC)
// simulating a full sky catalog down to Magnitude 15.

const generateDSOCatalog = (): CelestialObject[] => {
    const dsos: CelestialObject[] = [];
    const count = 3000; // Number of faint DSOs to generate

    // Seeded random for consistency
    let seed = 9999;
    const random = () => {
        const x = Math.sin(seed++) * 10000;
        return x - Math.floor(x);
    };

    const types: CelestialObject['type'][] = ['Galaxy', 'Nebula', 'Star Cluster'];
    
    // Helper to format coordinates
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

    for (let i = 0; i < count; i++) {
        // Distribution logic: Galaxies spread everywhere but avoided near galactic plane (simplified here as random)
        // Nebulae/Clusters concentrated near galactic plane (simplified)
        
        const raDeg = random() * 360;
        const decRad = Math.acos(2 * random() - 1) - Math.PI / 2;
        const decDeg = decRad * (180 / Math.PI);

        // Magnitude distribution: Power law (more faint objects)
        // Range: 8.0 to 15.0
        const mag = 8.0 + (random() * random()) * 7.0;

        const typeIndex = Math.floor(random() * 3);
        const type = types[typeIndex];

        // Generate a fake NGC/IC ID
        const catalogNumber = Math.floor(random() * 7000) + 1;
        const name = `NGC ${catalogNumber}`;

        dsos.push({
            id: `ngc_${catalogNumber}_${i}`,
            name: name,
            nameJa: `${name} (${type === 'Galaxy' ? '銀河' : type === 'Nebula' ? '星雲' : '星団'})`,
            type: type,
            ra: formatHMS(raDeg),
            dec: formatDMS(decDeg),
            magnitude: mag,
            image: '',
            blurryImage: '',
            annotations: []
        });
    }

    return dsos;
};

export const EXTENDED_DSO_CATALOG = generateDSOCatalog();
