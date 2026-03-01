
import { CalibrationData } from '../services/plateSolvingService';

/**
 * Converts a Right Ascension string (HMS) to decimal degrees.
 * e.g., "05h 35m 17s" -> 83.8208
 */
export const hmsToDegrees = (hms: string): number => {
    if (hms === 'Dynamic') return 0;
    const parts = hms.match(/(\d+)/g);
    if (!parts || parts.length < 3) return 0;
  
    const h = parseFloat(parts[0]);
    const m = parseFloat(parts[1]);
    const s = parseFloat(parts[2]);
    
    return (h + m / 60 + s / 3600) * 15;
};
  
/**
 * Converts a Declination string (DMS) to decimal degrees.
 * e.g., "-05° 23′ 28″" -> -5.3911
 */
export const dmsToDegrees = (dms: string): number => {
    if (dms === 'Dynamic') return 0;
    const isNegative = dms.trim().startsWith('-');
    const parts = dms.match(/(\d+)/g);
    if (!parts || parts.length < 3) return 0;

    const d = parseFloat(parts[0]);
    const m = parseFloat(parts[1]);
    const s = parseFloat(parts[2]);
    
    const degrees = d + m / 60 + s / 3600;
    return isNegative ? -degrees : degrees;
};

/**
 * Converts decimal degrees to sexagesimal string format (dd:mm:ss.s).
 * Handles rounding and rollover (e.g. 59.99s -> 00.0s and increment minute).
 */
export const decimalToSexagesimal = (val: number, isLongitude: boolean = false): string => {
    const sign = val < 0 ? '-' : '';
    const absVal = Math.abs(val);
    let d = Math.floor(absVal);
    let m = Math.floor((absVal - d) * 60);
    let s = ((absVal - d) * 60 - m) * 60;
    
    // Round s to 1 decimal place and handle rollover
    if (parseFloat(s.toFixed(1)) >= 60) {
        s = 0;
        m += 1;
    }
    if (m >= 60) {
        m = 0;
        d += 1;
    }
    
    // Longitude often uses 3 digits for degrees in some conventions, but standard is usually 2 or 3.
    // Keeping standard 2 for lat, 3 for lon if needed, but 2 is fine for generic.
    return `${sign}${d.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toFixed(1).padStart(4, '0')}`;
};

/**
 * Converts sexagesimal string format (dd:mm:ss.s) to decimal degrees.
 */
export const sexagesimalToDecimal = (input: string): number => {
    let str = input.trim();
    if (!str) return 0;
    
    let sign = 1;
    if (str.startsWith('-')) {
        sign = -1;
        str = str.substring(1);
    } else if (str.startsWith('+')) {
        str = str.substring(1);
    }

    // Split by common separators (colon, space, symbols)
    const parts = str.split(/[:\s°'"′″]+/).filter(p => p.length > 0).map(parseFloat);
    
    let d = 0, m = 0, s = 0;
    if (parts.length > 0) d = parts[0] || 0;
    if (parts.length > 1) m = parts[1] || 0;
    if (parts.length > 2) s = parts[2] || 0;

    return sign * (d + m / 60 + s / 3600);
};

/**
 * Calculates Local Sidereal Time (LST) in degrees.
 * @param longitude Observer's longitude in degrees (East is positive).
 * @param time Date object.
 */
export const calculateLST = (longitude: number, time: Date): number => {
    // Julian Date calculation
    const t = time.getTime() / 1000; // unix timestamp in seconds
    const jd = (t / 86400) + 2440587.5;
    
    // Days since J2000.0
    const d = jd - 2451545.0;
    
    // GMST in degrees
    let gmst = 280.46061837 + 360.98564736629 * d;
    gmst = gmst % 360;
    if (gmst < 0) gmst += 360;

    // Local Sidereal Time
    let lst = gmst + longitude;
    return (lst % 360 + 360) % 360;
};

export interface HorizonCoordinates {
    alt: number; // Altitude in degrees
    az: number;  // Azimuth in degrees (0 = North, 90 = East)
}

/**
 * Converts Equatorial Coordinates (RA/Dec) to Horizontal Coordinates (Az/Alt).
 */
export const raDecToAzAlt = (
    ra: number, 
    dec: number, 
    lat: number, 
    lst: number
): HorizonCoordinates => {
    const rad = Math.PI / 180;
    const ha = (lst - ra + 360) % 360; // Hour Angle

    const sinDec = Math.sin(dec * rad);
    const cosDec = Math.cos(dec * rad);
    const sinLat = Math.sin(lat * rad);
    const cosLat = Math.cos(lat * rad);
    const sinHa = Math.sin(ha * rad);
    const cosHa = Math.cos(ha * rad);

    // Altitude
    const sinAlt = sinDec * sinLat + cosDec * cosLat * cosHa;
    const altRad = Math.asin(sinAlt);
    const alt = altRad / rad;

    // Azimuth
    const cosAlt = Math.cos(altRad);
    const clampedCosAlt = Math.abs(cosAlt) < 1e-6 ? 1e-6 : cosAlt;
    
    let cosAz = (sinDec - sinAlt * sinLat) / (clampedCosAlt * cosLat);
    cosAz = Math.max(-1, Math.min(1, cosAz));
    
    const azRad = Math.acos(cosAz);
    let az = azRad / rad;
    
    if (Math.sin(ha * rad) > 0) {
        az = 360 - az;
    }

    return { alt, az };
};

/**
 * Inverse Transformation: Converts Horizontal (Az/Alt) to Equatorial (RA/Dec).
 * Used for determining where the camera is looking in celestial coordinates for DSS.
 */
export const azAltToRaDec = (
    az: number,
    alt: number,
    lat: number,
    lst: number
): { ra: number, dec: number } => {
    const rad = Math.PI / 180;
    const deg = 180 / Math.PI;

    const sinAlt = Math.sin(alt * rad);
    const cosAlt = Math.cos(alt * rad);
    const sinLat = Math.sin(lat * rad);
    const cosLat = Math.cos(lat * rad);
    const cosAz = Math.cos(az * rad); 
    const cosAzCalc = -Math.cos(az * rad);

    // Declination
    const sinDec = sinAlt * sinLat + cosAlt * cosLat * cosAzCalc;
    const decRad = Math.asin(sinDec);
    const dec = decRad * deg;

    // Hour Angle (H)
    const sinDecVal = Math.sin(decRad);
    const cosDecVal = Math.cos(decRad);
    
    let cosH = (sinAlt - sinLat * sinDecVal) / (cosLat * cosDecVal);
    cosH = Math.max(-1, Math.min(1, cosH));
    const hRad = Math.acos(cosH);
    let h = hRad * deg;

    if (Math.sin(az * rad) > 0) {
        h = 360 - h;
    }

    // RA = LST - H
    let ra = lst - h;
    if (ra < 0) ra += 360;
    if (ra >= 360) ra -= 360;

    return { ra, dec };
};

/**
 * Convert Galactic Coordinates (l, b) to Equatorial Coordinates (RA, Dec)
 * J2000 Epoch
 * @param l Galactic Longitude (degrees)
 * @param b Galactic Latitude (degrees)
 * @returns {ra, dec} in degrees
 */
export const galacticToRaDec = (l: number, b: number): { ra: number, dec: number } => {
    const rad = Math.PI / 180;
    const deg = 180 / Math.PI;

    // Galactic North Pole in J2000
    // Alpha_p = 192.85948 degrees
    // Delta_p = 27.12825 degrees
    // l_cp = 122.93192 degrees (Longitude of celestial pole)
    
    const alphaP = 192.85948 * rad;
    const deltaP = 27.12825 * rad;
    const lCP = 122.93192 * rad;
    
    const lRad = l * rad;
    const bRad = b * rad;

    const sinDelta = Math.cos(deltaP) * Math.cos(bRad) * Math.sin(lRad - lCP) + Math.sin(deltaP) * Math.sin(bRad);
    const decRad = Math.asin(sinDelta);

    const y = Math.cos(bRad) * Math.cos(lRad - lCP);
    const x = Math.sin(deltaP) * Math.cos(bRad) * Math.sin(lRad - lCP) - Math.cos(deltaP) * Math.sin(bRad);
    
    let alphaRad = Math.atan2(y, x) + alphaP;
    
    // Normalize alpha
    let ra = alphaRad * deg;
    const dec = decRad * deg;
    
    while(ra < 0) ra += 360;
    while(ra >= 360) ra -= 360;
    
    return { ra, dec };
};


/**
 * Projects 3D sky coordinates to 2D screen coordinates using Stereographic projection.
 * Supports arbitrary center of projection (Camera View).
 * Orientation: Standard Planetarium View (East is Left).
 */
export const projectStereographic = (
    alt: number, 
    az: number, 
    width: number, 
    height: number,
    zoom: number = 1,
    pan: { x: number, y: number } = { x: 0, y: 0 },
    centerAlt: number = 90,
    centerAz: number = 180 
): { x: number, y: number } | null => {
    
    const rad = Math.PI / 180;
    const lambda = az * rad;
    const phi = alt * rad;
    const lambda0 = centerAz * rad;
    const phi0 = centerAlt * rad;

    // Calculate angular distance 'c' from center
    const cosC = Math.sin(phi0) * Math.sin(phi) + Math.cos(phi0) * Math.cos(phi) * Math.cos(lambda - lambda0);
    
    // Clip points that are significantly behind the camera.
    // Standard hemisphere is cosC >= 0.
    // Allowing down to -0.5 (120 deg) lets off-screen points project far out,
    // which prevents large objects/lines from being cut off at the exact screen edge.
    if (cosC < -0.5) return null;

    // Stereographic scale factor k
    const k = 2 / (1 + cosC);

    // Coordinate on projection plane
    const xProj = k * Math.cos(phi) * Math.sin(lambda - lambda0);
    const yProj = k * (Math.cos(phi0) * Math.sin(phi) - Math.sin(phi0) * Math.cos(phi) * Math.cos(lambda - lambda0));
    
    const baseScale = Math.min(width, height) / 2;
    const finalScale = baseScale * zoom;

    // Map to screen coordinates
    // We add xProj to align with standard sky charts (East Left of South)
    const x = (width / 2 + pan.x) + xProj * finalScale; 
    const y = (height / 2 + pan.y) - yProj * finalScale;

    return { x, y };
};

/**
 * Projects sky coordinates (RA/Dec) to Image Pixels using WCS Calibration.
 * Uses a standard Tangent (Gnomonic) projection approximation based on center, scale, and rotation.
 */
export const projectWcsToPixel = (
    ra: number, 
    dec: number, 
    calibration: CalibrationData,
    imgWidth: number,
    imgHeight: number
): { x: number, y: number } | null => {
    
    const rad = Math.PI / 180;
    
    // 1. Convert to Standard Coordinates (xi, eta) relative to tangent point (CRVAL)
    const ra0 = calibration.ra * rad;
    const dec0 = calibration.dec * rad;
    const raRad = ra * rad;
    const decRad = dec * rad;

    const cosDec = Math.cos(decRad);
    const sinDec = Math.sin(decRad);
    const cosDec0 = Math.cos(dec0);
    const sinDec0 = Math.sin(dec0);
    const deltaRA = raRad - ra0;
    const cosDeltaRA = Math.cos(deltaRA);
    const sinDeltaRA = Math.sin(deltaRA);

    // Denominator for projection
    const denom = sinDec * sinDec0 + cosDec * cosDec0 * cosDeltaRA;
    
    // Objects > 90 deg away are behind the projection plane
    if (denom <= 0) return null; 

    // Standard Coordinates (radians)
    const xi = (cosDec * sinDeltaRA) / denom;
    const eta = (sinDec * cosDec0 - cosDec * sinDec0 * cosDeltaRA) / denom;

    // 2. Apply Rotation and Scale (CD Matrix Approximation)
    // calibration.scale is arcsec/pixel
    // calibration.rotation is orientation (degrees East of North)
    
    const scaleDegPerPix = calibration.scale / 3600.0;
    const scaleRadPerPix = scaleDegPerPix * rad;
    
    // Astrometry.net orientation: 
    // rotation = 0 means North is UP, East is LEFT (Standard astronomical)
    const rotRad = -calibration.rotation * rad; 
    const parity = calibration.parity || -1; 

    // Apply rotation
    const cosRot = Math.cos(rotRad);
    const sinRot = Math.sin(rotRad);

    // Intermediate rotated coords (still in radians/scale units)
    const xRot = (xi * cosRot - eta * sinRot) * parity;
    const yRot = (xi * sinRot + eta * cosRot);

    // 3. Convert to Pixels
    // Shift by CRPIX (center of image)
    const crpix1 = imgWidth / 2 + 0.5;
    const crpix2 = imgHeight / 2 + 0.5;

    // Pixel coordinates relative to center
    const dx = xRot / scaleRadPerPix;
    const dy = -yRot / scaleRadPerPix; // Flip Y because canvas Y is down, Sky Y (Dec) is Up

    // Final Pixel
    const x = crpix1 + dx;
    const y = crpix2 + dy;

    return { x, y };
};

/**
 * Reverse Transformation: Converts Image Pixels (x, y) to Equatorial (RA/Dec)
 * using WCS Calibration (Inverse Gnomonic).
 */
export const pixelToWcs = (
    x: number,
    y: number,
    calibration: CalibrationData,
    imgWidth: number,
    imgHeight: number
): { ra: number, dec: number } | null => {
    
    const rad = Math.PI / 180;
    const deg = 180 / Math.PI;

    // 1. Pixel to Standard Coordinates (xi, eta)
    const crpix1 = imgWidth / 2 + 0.5;
    const crpix2 = imgHeight / 2 + 0.5;

    const dx = x - crpix1;
    const dy = y - crpix2;

    const scaleDegPerPix = calibration.scale / 3600.0;
    const scaleRadPerPix = scaleDegPerPix * rad;
    const rotRad = -calibration.rotation * rad; 
    const parity = calibration.parity || -1;

    // Intermediate rotated coords
    // dx = xRot / scaleRadPerPix
    // dy = -yRot / scaleRadPerPix
    
    const xRot = dx * scaleRadPerPix;
    const yRot = -dy * scaleRadPerPix;

    // Invert Rotation
    // xRot/parity = xi cos - eta sin
    // yRot        = xi sin + eta cos
    
    const cosRot = Math.cos(rotRad);
    const sinRot = Math.sin(rotRad);
    
    const xp = xRot / parity;
    
    const xi = xp * cosRot + yRot * sinRot;
    const eta = yRot * cosRot - xp * sinRot;

    // 2. Standard Coordinates to RA/Dec
    const rho = Math.sqrt(xi*xi + eta*eta);
    const c = Math.atan(rho); 

    const ra0 = calibration.ra * rad;
    const dec0 = calibration.dec * rad;
    
    const cosDec0 = Math.cos(dec0);
    const sinDec0 = Math.sin(dec0);
    const cosC = Math.cos(c);
    const sinC = Math.sin(c);

    // Dec
    // sin(dec) = cos(c) sin(dec0) + (eta * sin(c) * cos(dec0)) / rho
    const term1 = cosC * sinDec0;
    const term2 = (rho === 0) ? 0 : (eta * sinC * cosDec0) / rho;
    const sinDec = term1 + term2;
    const decRad = Math.asin(Math.max(-1, Math.min(1, sinDec)));
    
    // RA
    // tan(ra - ra0) = (xi * sin(c)) / (rho * cos(dec0) * cos(c) - eta * sin(dec0) * sin(c))
    const num = (rho === 0) ? 0 : xi * sinC;
    const den = (rho === 0) ? 1 : rho * cosDec0 * cosC - eta * sinDec0 * sinC; // rho*cosDec0 if c=0
    
    const dRA = Math.atan2(num, den);
    const raRad = ra0 + dRA;

    let ra = raRad * deg;
    let dec = decRad * deg;

    // Normalize RA
    if (ra < 0) ra += 360;
    if (ra >= 360) ra -= 360;

    return { ra, dec };
};

/**
 * Calculates transit time (time when object crosses meridian due South).
 * Returns string HH:MM
 */
export const calculateTransitTime = (ra: number, longitude: number): string => {
    const now = new Date();
    const currentLst = calculateLST(longitude, now);
    
    // Hour Angle = LST - RA
    // Transit happens when HA = 0 => LST = RA
    let diff = ra - currentLst;
    while (diff < 0) diff += 360;
    while (diff >= 360) diff -= 360;
    
    const siderealHours = diff / 15;
    const solarHours = siderealHours * 0.99727;
    
    const transitTime = new Date(now.getTime() + solarHours * 3600 * 1000);
    return transitTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

/**
 * Calculates the angular distance between two points on the sphere.
 * Uses simple Euclidean distance for small angles, or spherical law of cosines.
 * @returns Distance in degrees
 */
export const calculateAngularDistance = (ra1: number, dec1: number, ra2: number, dec2: number): number => {
    const rad = Math.PI / 180;
    const d1 = dec1 * rad;
    const d2 = dec2 * rad;
    const r1 = ra1 * rad;
    const r2 = ra2 * rad;

    const cosA = Math.sin(d1) * Math.sin(d2) + Math.cos(d1) * Math.cos(d2) * Math.cos(r1 - r2);
    const distRad = Math.acos(Math.max(-1, Math.min(1, cosA)));
    return distRad * (180 / Math.PI);
};