
import { galacticToRaDec } from './coords';

export interface MilkyWayPoint {
    ra: number;
    dec: number;
    intensity: number; // 0.0 to 1.0
    width?: number; // Size multiplier for cloud effect
}

const generateMilkyWayPoints = (): MilkyWayPoint[] => {
    const points: MilkyWayPoint[] = [];
    const numPoints = 4000; 
    
    let seed = 9876;
    const random = () => {
        const x = Math.sin(seed++) * 10000;
        return x - Math.floor(x);
    };

    // Gaussian random
    const randGaussian = () => {
        let u = 0, v = 0;
        while(u === 0) u = random(); 
        while(v === 0) v = random();
        return Math.sqrt( -2.0 * Math.log( u ) ) * Math.cos( 2.0 * Math.PI * v );
    };

    for (let i = 0; i < numPoints; i++) {
        // Galactic Longitude: 0-360
        const l = random() * 360;
        
        // Galactic Latitude: Concentration near 0, but slightly wider for diffusion
        // Use a mix of tight and wide distributions to simulate core vs fringe
        let b = randGaussian() * 6; 
        
        // Bulge around Galactic Center (l=0)
        let lCenter = l;
        if (lCenter > 180) lCenter -= 360;
        
        if (Math.abs(lCenter) < 30) {
            // Vertical spread for central bulge
            if (random() < 0.4) b = randGaussian() * 12;
        }

        // Great Rift Simulation (Dark lane) - Make it more pronounced
        const isRift = (l > 15 && l < 75 && Math.abs(b) < 4);
        
        // Base intensity with smoother falloff
        let intensity = 0.5 * Math.exp(-(b*b)/(2*50)); 
        
        // Modulate intensity along longitude (brighter near center)
        intensity *= (0.8 + 2.0 * Math.exp(-(lCenter*lCenter)/(2*40*40)));

        if (isRift) intensity *= 0.1; // Deep dark rift

        // Vary cloud size inversely to density to fill gaps
        // Clumping/Cloudiness
        const noise = random();
        intensity *= (0.7 + 0.3 * noise);

        const { ra, dec } = galacticToRaDec(l, b);

        if (intensity > 0.05) {
            points.push({ 
                ra, 
                dec, 
                intensity, 
                // Reduced width multiplier to prevent "white screen" washout
                width: 0.5 + random() * 1.0 
            });
        }
    }

    return points;
};

export const MILKY_WAY_POINTS = generateMilkyWayPoints();
