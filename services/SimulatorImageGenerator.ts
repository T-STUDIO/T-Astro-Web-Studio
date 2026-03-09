
/**
 * SimulatorImageGenerator
 * ROLE: Generates simulated astronomical images (star fields) for the camera simulator.
 * This can be used to provide realistic feedback during slewing and centering.
 */

export class SimulatorImageGenerator {
    private static instance: SimulatorImageGenerator;

    public static getInstance() {
        if (!SimulatorImageGenerator.instance) SimulatorImageGenerator.instance = new SimulatorImageGenerator();
        return SimulatorImageGenerator.instance;
    }

    /**
     * Generates a simulated star field image based on coordinates.
     * @param ra Right Ascension in degrees
     * @param dec Declination in degrees
     * @param fov Field of View in degrees
     */
    public generateStarField(ra: number, dec: number, fov: number = 1.0): string {
        const canvas = document.createElement('canvas');
        canvas.width = 800;
        canvas.height = 600;
        const ctx = canvas.getContext('2d');
        if (!ctx) return '';

        // Background
        ctx.fillStyle = '#02040a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Seeded random based on coordinates to keep the field consistent
        let currentSeed = Math.floor(ra * 1000 + dec * 1000);
        const random = () => {
            const x = Math.sin(currentSeed++) * 10000;
            return x - Math.floor(x);
        };

        // Draw stars
        const numStars = 200;
        for (let i = 0; i < numStars; i++) {
            const x = random() * canvas.width;
            const y = random() * canvas.height;
            const size = random() * 2;
            const brightness = 0.5 + random() * 0.5;

            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 255, 255, ${brightness})`;
            ctx.fill();

            // Add a subtle glow to brighter stars
            if (size > 1.5) {
                ctx.beginPath();
                ctx.arc(x, y, size * 2, 0, Math.PI * 2);
                const gradient = ctx.createRadialGradient(x, y, 0, x, y, size * 2);
                gradient.addColorStop(0, `rgba(255, 255, 255, ${brightness * 0.3})`);
                gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
                ctx.fillStyle = gradient;
                ctx.fill();
            }
        }

        // Add some "DSO" blobs
        if (random() > 0.7) {
            const dx = random() * canvas.width;
            const dy = random() * canvas.height;
            const dSize = 20 + random() * 40;
            const dColor = random() > 0.5 ? 'rgba(255, 100, 100, 0.1)' : 'rgba(100, 100, 255, 0.1)';

            ctx.beginPath();
            ctx.arc(dx, dy, dSize, 0, Math.PI * 2);
            const dGradient = ctx.createRadialGradient(dx, dy, 0, dx, dy, dSize);
            dGradient.addColorStop(0, dColor);
            dGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.fillStyle = dGradient;
            ctx.fill();
        }

        // Add some noise
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const pixels = imageData.data;
        for (let i = 0; i < pixels.length; i += 4) {
            const noise = (Math.random() - 0.5) * 10;
            pixels[i] = Math.max(0, Math.min(255, pixels[i] + noise));
            pixels[i+1] = Math.max(0, Math.min(255, pixels[i+1] + noise));
            pixels[i+2] = Math.max(0, Math.min(255, pixels[i+2] + noise));
        }
        ctx.putImageData(imageData, 0, 0);

        return canvas.toDataURL('image/jpeg', 0.8);
    }
}

export default SimulatorImageGenerator.getInstance();
