
import { SimulatorSettings, TelescopePosition } from '../types';

export const DEFAULT_SIMULATOR_SETTINGS: SimulatorSettings = {
  focalLength: 200,
  pixelWidth: 1920,
  pixelHeight: 1080,
  pixelSize: 3.75,
  focuserPosition: 50000,
  focuserStep: 50
};

/**
 * Calculate Field of View (FOV) in arcminutes
 * FOV (arcmin) = (Sensor Size (mm) / Focal Length (mm)) * 3438
 */
export function calculateFOV(settings: SimulatorSettings): { width: number; height: number } {
  const sensorWidth = (settings.pixelWidth * settings.pixelSize) / 1000; // mm
  const sensorHeight = (settings.pixelHeight * settings.pixelSize) / 1000; // mm
  
  const fovWidth = (sensorWidth / settings.focalLength) * 3438;
  const fovHeight = (sensorHeight / settings.focalLength) * 3438;
  
  return { width: fovWidth, height: fovHeight };
}

/**
 * Generate Aladin image URL based on position and FOV
 */
export function getAladinImageUrl(position: TelescopePosition, settings: SimulatorSettings): string {
  const fov = calculateFOV(settings);
  // Use a larger FOV to ensure coverage, or use the calculated one
  // Aladin export API: https://aladin.u-strasbg.fr/AladinLite/doc/API/
  // We'll use a placeholder or a known DSS tile service if possible, 
  // but for simulation, we can use the DSS2 service via Aladin's export.
  
  const ra = isNaN(position.ra) ? 0 : position.ra;
  const dec = isNaN(position.dec) ? 0 : position.dec;
  const width = Math.max(1, Math.min(4096, settings.pixelWidth || 1920));
  const height = Math.max(1, Math.min(4096, settings.pixelHeight || 1080));
  
  // FOV in degrees for the URL
  const fovDeg = Math.max(0.01, Math.min(180, fov.width / 60));
  
  // Use Aladin Lite export API which is generally more stable
  const aladinUrl = `https://aladin.u-strasbg.fr/AladinLite/export/nph-export.cgi?ra=${ra}&dec=${dec}&fov=${fovDeg}&width=${width}&height=${height}&format=jpg&survey=P%2FDSS2%2Fcolor`;
  
  // Use server-side proxy to bypass CORS
  const url = `/api/proxy/image?url=${encodeURIComponent(aladinUrl)}`;
  
  console.log(`[Simulator] Generated Proxied Aladin URL: ${url}`);
  return url;
}

/**
 * Generate a simulated star field as a data URL fallback
 */
export function generateSimulatedStarField(position: TelescopePosition, settings: SimulatorSettings): string {
  const width = settings.pixelWidth || 1920;
  const height = settings.pixelHeight || 1080;
  
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // Background
  ctx.fillStyle = '#020617';
  ctx.fillRect(0, 0, width, height);

  // Seeded random based on RA/Dec
  const seed = Math.floor((position.ra * 1000) + (position.dec * 1000));
  const seededRandom = (s: number) => {
    const x = Math.sin(s) * 10000;
    return x - Math.floor(x);
  };

  // Draw stars
  const starCount = 500;
  for (let i = 0; i < starCount; i++) {
    const x = seededRandom(seed + i) * width;
    const y = seededRandom(seed + i + 1000) * height;
    const mag = seededRandom(seed + i + 2000);
    const size = mag * 1.5 + 0.5;
    const opacity = mag * 0.8 + 0.2;

    ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();

    // Add some color to some stars
    if (i % 10 === 0) {
      const colorType = i % 3;
      if (colorType === 0) ctx.fillStyle = `rgba(150, 200, 255, ${opacity * 0.5})`; // Blue
      else if (colorType === 1) ctx.fillStyle = `rgba(255, 200, 150, ${opacity * 0.5})`; // Red/Orange
      else ctx.fillStyle = `rgba(255, 255, 200, ${opacity * 0.5})`; // Yellow
      
      ctx.beginPath();
      ctx.arc(x, y, size * 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  return canvas.toDataURL('image/jpeg', 0.8);
}

/**
 * Calculate blur amount based on focuser position
 * 50000 is perfect focus. +/- 1000 is max blur.
 */
export function calculateBlur(position: number): number {
  const diff = Math.abs(position - 50000);
  if (diff === 0) return 0;
  
  // Scale: 1000 diff = 10px blur (max)
  const blur = (diff / 1000) * 10;
  return Math.min(blur, 10); // Cap at 10px
}
