
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
const createFitsHeader = (width: number, height: number, wcs?: CalibrationData | null, location?: LocationData | null, flipY: boolean = false): string => {
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
        let crval1 = wcs.ra;
        let crval2 = wcs.dec;
        let crpix1 = width / 2 + 0.5;
        let crpix2 = height / 2 + 0.5;
        let cd1_1: number;
        let cd1_2: number;
        let cd2_1: number;
        let cd2_2: number;

        if (wcs.crval1 !== undefined && wcs.crval2 !== undefined && wcs.crpix1 !== undefined && wcs.crpix2 !== undefined &&
            wcs.cd1_1 !== undefined && wcs.cd1_2 !== undefined && wcs.cd2_1 !== undefined && wcs.cd2_2 !== undefined) {
            crval1 = wcs.crval1;
            crval2 = wcs.crval2;
            crpix1 = wcs.crpix1;
            crpix2 = flipY ? (height + 1.0 - wcs.crpix2) : wcs.crpix2;
            cd1_1 = wcs.cd1_1;
            cd1_2 = flipY ? -wcs.cd1_2 : wcs.cd1_2;
            cd2_1 = wcs.cd2_1;
            cd2_2 = flipY ? -wcs.cd2_2 : wcs.cd2_2;
        } else {
            const scaleDeg = wcs.scale / 3600.0;
            const rotRad = -wcs.rotation * Math.PI / 180.0;
            const parity = wcs.parity || -1;

            cd1_1 = scaleDeg * Math.cos(rotRad) * parity;
            cd1_2 = -scaleDeg * Math.sin(rotRad) * parity;
            cd2_1 = scaleDeg * Math.sin(rotRad);
            cd2_2 = scaleDeg * Math.cos(rotRad);

            if (flipY) {
                cd1_2 = -cd1_2;
                cd2_2 = -cd2_2;
            }
        }

        cards.push(padString("CTYPE1  = 'RA---TAN'           / Gnomonic projection"));
        cards.push(padString("CTYPE2  = 'DEC--TAN'           / Gnomonic projection"));
        cards.push(padString(`CRVAL1  = ${crval1.toFixed(8).padStart(20, ' ')} / Ref RA (deg)`));
        cards.push(padString(`CRVAL2  = ${crval2.toFixed(8).padStart(20, ' ')} / Ref Dec (deg)`));
        cards.push(padString(`CRPIX1  = ${crpix1.toFixed(8).padStart(20, ' ')} / Ref pixel X`));
        cards.push(padString(`CRPIX2  = ${crpix2.toFixed(8).padStart(20, ' ')} / Ref pixel Y`));
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

    const headerStr = createFitsHeader(width, height, wcs, location, true);
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

    // --- ASTROTIFF ImageDescription (天体用構造化メタデータ) の組み立て ---
    // AstroTIFF 1.0 規格における ImageDescription (Tag 270) への FITS ヘッダーの埋め込みは、
    // 規格書 (with no line terminators) に準拠し、改行コードを含まない 80文字固定長カードの完全な連続文字列として構築します。
    // WCSが提供されない場合であっても、常に画像サイズ、時刻、観測地、その他基本メタデータを含む有効なFITSヘッダーを組み立てることで、ヘッダー情報が空になるのを防止します。
    const headerStr = createFitsHeader(canvas.width, canvas.height, wcs, location, true);
    const lines: string[] = [];
    for (let i = 0; i < headerStr.length; i += 80) {
        const card = headerStr.substring(i, i + 80);
        lines.push(card);
        if (card.startsWith("END")) {
            break;
        }
    }
    const desc = lines.join("");

    const descEncoder = new TextEncoder();
    const descBytes = descEncoder.encode(desc);
    const descLen = descBytes.length; // NULL含まない長さ

    // --- 各バリューデータの正確なバイト数とオフセットの計算 (ワード境界へのアライメント) ---
    const headerSize = 8;
    const numEntries = 13;
    const ifdSize = 2 + (numEntries * 12) + 4; // 162 bytes
    
    let extraOffset = headerSize + ifdSize; // 170 (標準的な偶数境界)

    // 各アレイデータ
    const bitsPerSampleData = new Uint16Array([8, 8, 8]); // 6 bytes
    const xResData = new Uint32Array([72, 1]); // 8 bytes
    const yResData = new Uint32Array([72, 1]); // 8 bytes

    // 各データの開始オフセットをアライメントしながら動的に決定
    const bitsPerSampleOffset = extraOffset;
    extraOffset += bitsPerSampleData.byteLength; // 170 + 6 = 176

    if (extraOffset % 4 !== 0) extraOffset += (4 - (extraOffset % 4));
    const xResolutionOffset = extraOffset;
    extraOffset += xResData.byteLength; // 176 + 8 = 184

    const yResolutionOffset = extraOffset;
    extraOffset += yResData.byteLength; // 184 + 8 = 192

    const descOffset = extraOffset;
    extraOffset += (descLen + 1); // +1 は NULLターミネータ

    // Image Dataの開始位置 (StripOffsets) もワード（2バイト/4バイト）境界に必ず揃える
    if (extraOffset % 4 !== 0) extraOffset += (4 - (extraOffset % 4));
    const stripOffset = extraOffset;

    const imageSize = width * height * 3;
    const totalSize = stripOffset + imageSize;

    const buffer = new ArrayBuffer(totalSize);
    const view = new DataView(buffer);
    const bytes = new Uint8Array(buffer);

    // --- TIFF Headerの構築 (リトルエンディアン) ---
    view.setUint16(0, 0x4949, true); // II (Little Endian)
    view.setUint16(2, 42, true);
    view.setUint32(4, headerSize, true); // 第一IFD開始位置

    // --- IFD直後、アライメントに沿って余剰データを書き込む ---
    // BitsPerSample
    for (let i = 0; i < bitsPerSampleData.length; i++) {
        view.setUint16(bitsPerSampleOffset + i * 2, bitsPerSampleData[i], true);
    }
    // XResolution, YResolution
    for (let i = 0; i < xResData.length; i++) {
        view.setUint32(xResolutionOffset + i * 4, xResData[i], true);
        view.setUint32(yResolutionOffset + i * 4, yResData[i], true);
    }
    // ImageDescription (ASTROTIFF string)
    bytes.set(descBytes, descOffset);
    bytes[descOffset + descLen] = 0; // ヌル終端文字

    // --- 画像ピクセルデータ (RGB) のコピー ---
    let ptr = stripOffset;
    const data = imgData.data;
    for(let i=0; i<data.length; i+=4) {
        bytes[ptr++] = data[i];   // R
        bytes[ptr++] = data[i+1]; // G
        bytes[ptr++] = data[i+2]; // B
    }

    // --- IFD (Image File Directory) の構築 ---
    let p = headerSize;
    view.setUint16(p, numEntries, true); p += 2;
    p = writeIFD(view, p, 0x0100, 4, 1, width);
    p = writeIFD(view, p, 0x0101, 4, 1, height);
    p = writeIFD(view, p, 0x0102, 3, 3, bitsPerSampleOffset);
    p = writeIFD(view, p, 0x0103, 3, 1, 1); // No compression
    p = writeIFD(view, p, 0x0106, 3, 1, 2); // RGB
    p = writeIFD(view, p, 0x010E, 2, descLen + 1, descOffset); // ImageDescription (ASTROTIFF Data)
    p = writeIFD(view, p, 0x0111, 4, 1, stripOffset);
    p = writeIFD(view, p, 0x0115, 3, 1, 3);
    p = writeIFD(view, p, 0x0116, 4, 1, height);
    p = writeIFD(view, p, 0x0117, 4, 1, imageSize);
    p = writeIFD(view, p, 0x011A, 5, 1, xResolutionOffset);
    p = writeIFD(view, p, 0x011B, 5, 1, yResolutionOffset);
    p = writeIFD(view, p, 0x0128, 3, 1, 2); // Unit: Inch
    
    view.setUint32(p, 0, true);
    return new Blob([buffer], { type: 'image/tiff' });
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
    let blobBytes: Uint8Array | null = null;
    
    let wcsCommentText = "";
    if (wcs) {
        // Pass flipY = true so the FITS WCS header maps standard image coordinate space to the celestial sphere
        const headerStr = createFitsHeader(canvas.width, canvas.height, wcs, location, true);
        const lines: string[] = [];
        for (let i = 0; i < headerStr.length; i += 80) {
            const card = headerStr.substring(i, i + 80).trim();
            if (card) {
                lines.push(card);
            }
        }
        wcsCommentText = lines.join("\r\n");
    }

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
            if (wcsCommentText) {
                // Exif UserComment (ASCII prefix required by standard)
                exifObj["Exif"][piexif.ExifIFD.UserComment] = "ASCII\0\0\0" + wcsCommentText;
                // 0th ImageDescription
                exifObj["0th"][piexif.ImageIFD.ImageDescription] = wcsCommentText;
            }

            const exifBytes = piexif.dump(exifObj);
            const inserted = piexif.insert(exifBytes, dataURL);
            
            const byteString = atob(inserted.split(',')[1]);
            blobBytes = new Uint8Array(byteString.length);
            for (let i = 0; i < byteString.length; i++) blobBytes[i] = byteString.charCodeAt(i);
        } catch (e) {
            console.error("EXIF injection failed:", e);
        }
    }

    if (!blobBytes) {
        const byteString = atob(dataURL.split(',')[1]);
        blobBytes = new Uint8Array(byteString.length);
        for (let i = 0; i < byteString.length; i++) blobBytes[i] = byteString.charCodeAt(i);
    }

    // Always inject JPEG standard COM marker segment at binary level for absolute compliance
    if (wcsCommentText) {
        try {
            blobBytes = injectJpegComment(blobBytes, wcsCommentText);
        } catch (binaryErr) {
            console.error("Binary JPEG comment injection failed:", binaryErr);
        }
    }

    return new Blob([blobBytes], { type: 'image/jpeg' });
};

function injectJpegComment(jpegBytes: Uint8Array, commentStr: string): Uint8Array {
    const encoder = new TextEncoder();
    const commentBytes = encoder.encode(commentStr);
    
    // Check for SOI (FF D8)
    if (jpegBytes[0] !== 0xFF || jpegBytes[1] !== 0xD8) {
        return jpegBytes;
    }
    
    const markerLength = commentBytes.length + 2;
    const comHeader = new Uint8Array([0xFF, 0xFE, (markerLength >> 8) & 0xFF, markerLength & 0xFF]);
    
    const newBytes = new Uint8Array(2 + comHeader.length + commentBytes.length + (jpegBytes.length - 2));
    newBytes[0] = 0xFF;
    newBytes[1] = 0xD8;
    newBytes.set(comHeader, 2);
    newBytes.set(commentBytes, 2 + comHeader.length);
    newBytes.set(jpegBytes.subarray(2), 2 + comHeader.length + commentBytes.length);
    
    return newBytes;
}

// --- PNG WCS COMMENT INJECTION SUPPORT (CRC-32 & Chunk Builders) ---

let crcTable: Int32Array | null = null;
function makeCrcTable() {
    crcTable = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) {
            if (c & 1) {
                c = 0xedb88320 ^ (c >>> 1);
            } else {
                c = c >>> 1;
            }
        }
        crcTable[n] = c;
    }
}

function crc32(bytes: Uint8Array): number {
    if (!crcTable) {
        makeCrcTable();
    }
    let crc = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) {
        crc = (crcTable![(crc ^ bytes[i]) & 0xff]) ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
}

function createTxtChunk(keyword: string, text: string): Uint8Array {
    const encoder = new TextEncoder();
    const keywordBytes = encoder.encode(keyword);
    const textBytes = encoder.encode(text);
    
    // tEXt chunk layout: Keyword (1-79 bytes) + 0x00 + Text (n bytes)
    const dataLength = keywordBytes.length + 1 + textBytes.length;
    
    const chunkBytes = new Uint8Array(4 + 4 + dataLength + 4);
    const view = new DataView(chunkBytes.buffer);
    
    // 1. Length (4 bytes)
    view.setUint32(0, dataLength, false); // Big Endian
    
    // 2. Chunk Type "tEXt" (注: 3文字目は大文字の 'X' (88) です)
    chunkBytes[4] = 116; // 't'
    chunkBytes[5] = 69;  // 'E'
    chunkBytes[6] = 88;  // 'X'
    chunkBytes[7] = 116; // 't'
    
    // 3. Keyword
    chunkBytes.set(keywordBytes, 8);
    // 4. Null separator
    chunkBytes[8 + keywordBytes.length] = 0;
    // 5. Text
    chunkBytes.set(textBytes, 8 + keywordBytes.length + 1);
    
    // 6. CRC (Chunk Type + Chunk Data)
    const crcData = chunkBytes.subarray(4, 8 + dataLength);
    const crcVal = crc32(crcData);
    view.setUint32(8 + dataLength, crcVal, false); // Big Endian
    
    return chunkBytes;
}

function injectPngMetadata(pngBytes: Uint8Array, keyword: string, text: string): Uint8Array {
    // Check PNG signature
    if (pngBytes[0] !== 0x89 || pngBytes[1] !== 0x50 || pngBytes[2] !== 0x4E || pngBytes[3] !== 0x47 ||
        pngBytes[4] !== 0x0D || pngBytes[5] !== 0x0A || pngBytes[6] !== 0x1A || pngBytes[7] !== 0x0A) {
        return pngBytes; // Invalid PNG
    }
    
    const textChunk = createTxtChunk(keyword, text);
    
    // Find first chunk end (usually IHDR)
    const view = new DataView(pngBytes.buffer, pngBytes.byteOffset, pngBytes.byteLength);
    const firstChunkLength = view.getUint32(8, false);
    const firstChunkType = String.fromCharCode(pngBytes[12], pngBytes[13], pngBytes[14], pngBytes[15]);
    
    if (firstChunkType !== "IHDR") {
        return pngBytes; // Unexpected PNG structure
    }
    
    const ihdrEndOffset = 8 + 4 + 4 + firstChunkLength + 4; // usually 33
    
    const newBytes = new Uint8Array(pngBytes.length + textChunk.length);
    newBytes.set(pngBytes.subarray(0, ihdrEndOffset), 0);
    newBytes.set(textChunk, ihdrEndOffset);
    newBytes.set(pngBytes.subarray(ihdrEndOffset), ihdrEndOffset + textChunk.length);
    
    return newBytes;
}

/**
 * PNGの保存 (Aladin等で利用可能なDescription / CommentへのWCSメタデータ注入)
 */
export const exportPNG = async (canvas: HTMLCanvasElement, wcs?: CalibrationData | null, location?: LocationData | null): Promise<Blob> => {
    const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((b) => resolve(b), "image/png");
    });
    if (!blob) throw new Error("PNG conversion failed");
    
    let wcsCommentText = "";
    if (wcs) {
        // Aladin やその他天体ツールが WCS 情報を確実に自動同期できるように、
        // 各レコードが 80 文字固定長で改行コード \r\n で区切られた WCS 文字列を生成します。
        const headerStr = createFitsHeader(canvas.width, canvas.height, wcs, location, true);
        const lines: string[] = [];
        for (let i = 0; i < headerStr.length; i += 80) {
            const card = headerStr.substring(i, i + 80);
            lines.push(card);
            if (card.startsWith("END")) {
                break;
            }
        }
        wcsCommentText = lines.join("\r\n");
    }

    if (!wcsCommentText) {
        return blob;
    }

    const arrayBuffer = await blob.arrayBuffer();
    let pngBytes = new Uint8Array(arrayBuffer);
    
    try {
        // 各種天体ツールがメタデータを参照して自動的に座標検出・同期表示を行えるよう、
        // \r\n で区切った WCS メタデータを標準の Comment、Description などのチャンクに注入します。
        pngBytes = injectPngMetadata(pngBytes, "FITS", wcsCommentText);
        pngBytes = injectPngMetadata(pngBytes, "WCS", wcsCommentText);
        pngBytes = injectPngMetadata(pngBytes, "FITSHeader", wcsCommentText);
        pngBytes = injectPngMetadata(pngBytes, "Description", wcsCommentText);
        pngBytes = injectPngMetadata(pngBytes, "Comment", wcsCommentText);
    } catch (e) {
        console.error("PNG metadata injection failed:", e);
    }

    return new Blob([pngBytes], { type: 'image/png' });
};
