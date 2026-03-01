
import { CalibrationData } from '../services/plateSolvingService';
import { LocationData } from '../types';

declare const piexif: any;

// Helper to pad strings for FITS (80 chars per card)
const padString = (str: string, length: number = 80): string => {
    return str.padEnd(length, ' ');
};

/**
 * FITSヘッダーの生成 (FITS規格および天文標準に準拠)
 */
const createFitsHeader = (width: number, height: number, wcs?: CalibrationData | null, location?: LocationData | null): string => {
    const cards: string[] = [];
    cards.push(padString("SIMPLE  =                    T / Standard FITS format"));
    cards.push(padString("BITPIX  =                    8 / Character or unsigned binary integer"));
    cards.push(padString("NAXIS   =                    3 / Number of dimensions"));
    cards.push(padString(`NAXIS1  =                 ${width.toString().padStart(4, ' ')} / Image width`));
    cards.push(padString(`NAXIS2  =                 ${height.toString().padStart(4, ' ')} / Image height`));
    cards.push(padString("NAXIS3  =                    3 / RGB planes"));
    cards.push(padString("EXTEND  =                    T / Extensions are permitted"));

    // --- WCS Metadata (Celestial Coordinates - Standard TAN projection) ---
    if (wcs) {
        const scaleDeg = wcs.scale / 3600.0;
        const rotRad = -wcs.rotation * Math.PI / 180.0;
        const parity = wcs.parity || -1;

        const cd1_1 = scaleDeg * Math.cos(rotRad) * parity;
        const cd1_2 = -scaleDeg * Math.sin(rotRad) * parity;
        const cd2_1 = scaleDeg * Math.sin(rotRad);
        const cd2_2 = scaleDeg * Math.cos(rotRad);

        cards.push(padString("CTYPE1  = 'RA---TAN'           / Gnomonic projection"));
        cards.push(padString("CTYPE2  = 'DEC--TAN'           / Gnomonic projection"));
        cards.push(padString(`CRVAL1  = ${wcs.ra.toFixed(8).padStart(20, ' ')} / Ref RA (deg)`));
        cards.push(padString(`CRVAL2  = ${wcs.dec.toFixed(8).padStart(20, ' ')} / Ref Dec (deg)`));
        cards.push(padString(`CRPIX1  = ${(width / 2 + 0.5).toFixed(1).padStart(20, ' ')} / Ref pixel X`));
        cards.push(padString(`CRPIX2  = ${(height / 2 + 0.5).toFixed(1).padStart(20, ' ')} / Ref pixel Y`));
        cards.push(padString(`CD1_1   = ${cd1_1.toExponential(8).padStart(20, ' ')} / WCS CD Matrix`));
        cards.push(padString(`CD1_2   = ${cd1_2.toExponential(8).padStart(20, ' ')} / WCS CD Matrix`));
        cards.push(padString(`CD2_1   = ${cd2_1.toExponential(8).padStart(20, ' ')} / WCS CD Matrix`));
        cards.push(padString(`CD2_2   = ${cd2_2.toExponential(8).padStart(20, ' ')} / WCS CD Matrix`));
        cards.push(padString("EQUINOX =               2000.0 / Coordinate epoch"));
    }

    // --- GPS / Site Metadata (Standard Astronomical extensions) ---
    if (location) {
        cards.push(padString(`LAT-OBS = ${location.latitude.toFixed(6).padStart(20, ' ')} / [deg] Site Latitude`));
        cards.push(padString(`LONG-OBS= ${location.longitude.toFixed(6).padStart(20, ' ')} / [deg] Site Longitude`));
        if (location.elevation !== undefined) {
            cards.push(padString(`ALT-OBS = ${location.elevation.toFixed(1).padStart(20, ' ')} / [m] Site Elevation`));
        }
    }

    cards.push(padString("SOFTWARE= 'T-Astro Web Studio' / Application Name"));
    cards.push(padString(`DATE    = '${new Date().toISOString().slice(0, 19)}' / File creation date`));
    cards.push(padString("END"));

    let headerStr = cards.join("");
    // FITS blocks must be exactly 2880 bytes
    while (headerStr.length % 2880 !== 0) {
        headerStr += " ";
    }
    return headerStr;
};

export const exportFITS = async (canvas: HTMLCanvasElement, wcs?: CalibrationData | null, location?: LocationData | null): Promise<Blob> => {
    const width = canvas.width;
    const height = canvas.height;
    const ctx = canvas.getContext('2d');
    if(!ctx) throw new Error("Context acquisition failed");
    const imgData = ctx.getImageData(0,0, width, height);
    const data = imgData.data;

    const headerStr = createFitsHeader(width, height, wcs, location);
    const headerEncoder = new TextEncoder();
    const headerBytes = headerEncoder.encode(headerStr);
    
    const planeSize = width * height;
    const dataBytes = new Uint8Array(planeSize * 3);
    
    // FITS stores Y-axis bottom-up (Standard requirement)
    for (let y = 0; y < height; y++) {
        const canvasRow = y; 
        const fitsRow = height - 1 - y;
        for (let x = 0; x < width; x++) {
            const idx = (canvasRow * width + x) * 4;
            const fitsIdx = fitsRow * width + x;
            dataBytes[fitsIdx] = data[idx];               // Red
            dataBytes[planeSize + fitsIdx] = data[idx+1]; // Green
            dataBytes[2 * planeSize + fitsIdx] = data[idx+2]; // Blue
        }
    }

    const dataLen = dataBytes.length;
    const padding = (2880 - (dataLen % 2880)) % 2880;
    const parts = [headerBytes, dataBytes];
    if (padding > 0) parts.push(new Uint8Array(padding));
    return new Blob(parts, { type: 'application/fits' });
};

const writeIFD = (view: DataView, offset: number, tag: number, type: number, count: number, value: number) => {
    view.setUint16(offset, tag, true);
    view.setUint16(offset + 2, type, true);
    view.setUint32(offset + 4, count, true);
    view.setUint32(offset + 8, value, true);
    return offset + 12;
};

/**
 * TIFFの保存 (ASTROTIFF推奨形式に準拠)
 */
export const exportTIFF = async (canvas: HTMLCanvasElement, wcs?: CalibrationData | null, location?: LocationData | null): Promise<Blob> => {
    const width = canvas.width;
    const height = canvas.height;
    const ctx = canvas.getContext('2d');
    if(!ctx) throw new Error("Context acquisition failed");
    const imgData = ctx.getImageData(0,0, width, height);
    
    const headerSize = 8;
    const numEntries = 12; 
    const ifdSize = 2 + (numEntries * 12) + 4;
    const extraDataSize = 2048; 
    const imageSize = width * height * 3;
    const totalSize = headerSize + ifdSize + extraDataSize + imageSize;
    
    const buffer = new ArrayBuffer(totalSize);
    const view = new DataView(buffer);
    const bytes = new Uint8Array(buffer);

    view.setUint16(0, 0x4949, true); // Little Endian
    view.setUint16(2, 42, true);
    const ifdOffset = headerSize;
    view.setUint32(4, ifdOffset, true);

    let extraOffset = ifdOffset + ifdSize;
    const writeArray = (arr: number[], typeSize: number) => {
        const start = extraOffset;
        arr.forEach(val => {
            if(typeSize === 2) { view.setUint16(extraOffset, val, true); extraOffset += 2; }
            if(typeSize === 4) { view.setUint32(extraOffset, val, true); extraOffset += 4; }
        });
        return start;
    };
    
    const bitsPerSampleOffset = writeArray([8,8,8], 2);
    const resolutionOffset = writeArray([72, 1], 4);

    // --- ASTROTIFF ImageDescription (天体用構造化メタデータ) ---
    let desc = "ASTROTIFF by T-Astro Web Studio.";
    if (wcs) {
        desc += ` WCS[RA=${wcs.ra.toFixed(6)},Dec=${wcs.dec.toFixed(6)},Scale=${wcs.scale.toFixed(4)},Rot=${wcs.rotation.toFixed(2)}]`;
    }
    if (location) {
        desc += ` SITE[Lat=${location.latitude.toFixed(6)},Lon=${location.longitude.toFixed(6)},Alt=${location.elevation || 0}]`;
    }
    
    const descEncoder = new TextEncoder();
    const descBytes = descEncoder.encode(desc);
    const descOffset = extraOffset;
    bytes.set(descBytes, extraOffset);
    extraOffset += descBytes.length + 1;

    // Image Data (RGB)
    const stripOffset = extraOffset;
    let ptr = stripOffset;
    const data = imgData.data;
    for(let i=0; i<data.length; i+=4) {
        bytes[ptr++] = data[i];   // R
        bytes[ptr++] = data[i+1]; // G
        bytes[ptr++] = data[i+2]; // B
    }
    
    let p = ifdOffset;
    view.setUint16(p, numEntries, true); p += 2;
    p = writeIFD(view, p, 0x0100, 4, 1, width);
    p = writeIFD(view, p, 0x0101, 4, 1, height);
    p = writeIFD(view, p, 0x0102, 3, 3, bitsPerSampleOffset);
    p = writeIFD(view, p, 0x0103, 3, 1, 1); // No compression
    p = writeIFD(view, p, 0x0106, 3, 1, 2); // RGB
    p = writeIFD(view, p, 0x010E, 2, descBytes.length, descOffset); // ImageDescription (ASTROTIFF Data)
    p = writeIFD(view, p, 0x0111, 4, 1, stripOffset);
    p = writeIFD(view, p, 0x0115, 3, 1, 3);
    p = writeIFD(view, p, 0x0116, 4, 1, height);
    p = writeIFD(view, p, 0x0117, 4, 1, imageSize);
    p = writeIFD(view, p, 0x011A, 5, 1, resolutionOffset);
    p = writeIFD(view, p, 0x011B, 5, 1, resolutionOffset);
    p = writeIFD(view, p, 0x0128, 3, 1, 2); // Unit: Inch
    
    view.setUint32(p, 0, true);
    return new Blob([buffer.slice(0, stripOffset + imageSize)], { type: 'image/tiff' });
};

const degToRational = (deg: number) => {
    const abs = Math.abs(deg);
    const d = Math.floor(abs);
    const m = Math.floor((abs - d) * 60);
    const s = Math.round((abs - d - m/60) * 3600 * 100);
    return [[d, 1], [m, 1], [s, 100]];
};

/**
 * JPEGの保存 (Exif & WCS Comment)
 */
export const exportJPEG = (
    canvas: HTMLCanvasElement, 
    originalExifStr: string | null,
    wcs?: CalibrationData | null,
    location?: LocationData | null
): Blob => {
    const dataURL = canvas.toDataURL("image/jpeg", 0.95);
    
    if (typeof piexif !== 'undefined') {
        try {
            let exifObj: any = { "0th": {}, "Exif": {}, "GPS": {} };
            
            if (originalExifStr) {
                try {
                    exifObj = piexif.load(originalExifStr);
                } catch (e) {
                    console.warn("EXIF load failed, creating new object.");
                }
            }

            // --- GPS情報はExifとして保存 (Standard compliance) ---
            if (location) {
                exifObj["GPS"][piexif.GPSIFD.GPSLatitudeRef] = location.latitude >= 0 ? "N" : "S";
                exifObj["GPS"][piexif.GPSIFD.GPSLatitude] = degToRational(location.latitude);
                exifObj["GPS"][piexif.GPSIFD.GPSLongitudeRef] = location.longitude >= 0 ? "E" : "W";
                exifObj["GPS"][piexif.GPSIFD.GPSLongitude] = degToRational(location.longitude);
                if (location.elevation !== undefined) {
                    exifObj["GPS"][piexif.GPSIFD.GPSAltitudeRef] = location.elevation >= 0 ? 0 : 1;
                    exifObj["GPS"][piexif.GPSIFD.GPSAltitude] = [Math.round(Math.abs(location.elevation)), 1];
                }
            }

            // --- WCSはコメント情報として保存 ---
            if (wcs) {
                const wcsComment = `WCS[RA=${wcs.ra.toFixed(6)},Dec=${wcs.dec.toFixed(6)},Scale=${wcs.scale.toFixed(4)},Rot=${wcs.rotation.toFixed(2)}]`;
                // Exif UserComment (ASCII prefix required by standard)
                exifObj["Exif"][piexif.ExifIFD.UserComment] = "ASCII\0\0\0" + wcsComment;
                // 0th ImageDescription
                exifObj["0th"][piexif.ImageIFD.ImageDescription] = wcsComment;
            }

            const exifBytes = piexif.dump(exifObj);
            const inserted = piexif.insert(exifBytes, dataURL);
            
            const byteString = atob(inserted.split(',')[1]);
            const ab = new ArrayBuffer(byteString.length);
            const ia = new Uint8Array(ab);
            for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
            return new Blob([ab], { type: 'image/jpeg' });
        } catch (e) {
            console.error("EXIF injection failed:", e);
        }
    }

    // Fallback if piexif is missing
    const byteString = atob(dataURL.split(',')[1]);
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
    return new Blob([ab], { type: 'image/jpeg' });
};
