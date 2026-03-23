
/**
 * AlpacaImageService
 * ROLE: Handles binary image data from Alpaca cameras.
 * Alpaca uses a specific binary format for imagearray and imagebytes.
 */

export interface AlpacaImageHeader {
    metadataVersion: number;
    errorNumber: number;
    clientTransactionId: number;
    serverTransactionId: number;
    dataStart: number;
    imageElementType: number;
    transmissionElementType: number;
    rank: number;
    dimension1: number;
    dimension2: number;
    dimension3: number;
}

export class AlpacaImageService {
    private static instance: AlpacaImageService;

    public static getInstance() {
        if (!AlpacaImageService.instance) AlpacaImageService.instance = new AlpacaImageService();
        return AlpacaImageService.instance;
    }

    /**
     * Parses the Alpaca binary image format.
     * @param buffer The raw ArrayBuffer from the Alpaca server.
     */
    public parseBinaryImage(buffer: ArrayBuffer): { header: AlpacaImageHeader, data: Uint8Array | Int32Array | Float32Array } {
        if (buffer.byteLength < 44) {
            throw new Error(`Buffer too small for Alpaca image header: ${buffer.byteLength} bytes. Expected at least 44.`);
        }
        
        const view = new DataView(buffer);
        
        const header: AlpacaImageHeader = {
            metadataVersion: view.getUint32(0, true),
            errorNumber: view.getUint32(4, true),
            clientTransactionId: view.getUint32(8, true),
            serverTransactionId: view.getUint32(12, true),
            dataStart: view.getUint32(16, true),
            imageElementType: view.getInt32(20, true),
            transmissionElementType: view.getInt32(24, true),
            rank: view.getInt32(28, true),
            dimension1: view.getInt32(32, true),
            dimension2: view.getInt32(36, true),
            dimension3: view.getInt32(40, true),
        };

        const dataOffset = header.dataStart;
        if (dataOffset > buffer.byteLength) {
            throw new Error(`Invalid dataStart offset: ${dataOffset}. Buffer size is ${buffer.byteLength}.`);
        }
        
        const dataLength = buffer.byteLength - dataOffset;
        
        // Element Types: 1=Int16, 2=Int32, 3=Double, 4=Single, 5=Uint16, 6=Byte
        let data: any;
        try {
            switch (header.imageElementType) {
                case 1: // Int16
                    data = new Int16Array(buffer, dataOffset, Math.floor(dataLength / 2));
                    break;
                case 2: // Int32
                    data = new Int32Array(buffer, dataOffset, Math.floor(dataLength / 4));
                    break;
                case 3: // Double
                    data = new Float64Array(buffer, dataOffset, Math.floor(dataLength / 8));
                    break;
                case 4: // Single
                    data = new Float32Array(buffer, dataOffset, Math.floor(dataLength / 4));
                    break;
                case 5: // Uint16
                    data = new Uint16Array(buffer, dataOffset, Math.floor(dataLength / 2));
                    break;
                case 6: // Byte
                    data = new Uint8Array(buffer, dataOffset, dataLength);
                    break;
                default:
                    data = new Uint8Array(buffer, dataOffset, dataLength);
            }
        } catch (e: any) {
            throw new Error(`Failed to create typed array: ${e.message}. dataOffset=${dataOffset}, dataLength=${dataLength}, type=${header.imageElementType}`);
        }

        return { header, data };
    }

    /**
     * Converts the parsed Alpaca image data to a displayable format (Canvas/DataURL).
     */
    public async convertToDisplay(header: any, data: any): Promise<string> {
        // Alpaca standard: dimension1 is the first dimension (rows/height), dimension2 is the second (cols/width)
        let height = Number(header.dimension1) || 0;
        let width = Number(header.dimension2) || 0;
        
        // If it's a 3D array (RGB), dimension3 is the color channel
        // If it's a 2D array, dimension1=height, dimension2=width
        
        // Many astro cameras are landscape. If we get a portrait-like dimension set, 
        // it might be that the driver is using dimension1 for the long axis.
        // However, the standard is dimension1=rows.
        
        if (width <= 0 || height <= 0 || !data || data.length === 0) {
            console.error('[AlpacaImage] Invalid image dimensions or data:', { width, height, dataLength: data?.length });
            throw new Error(`Invalid image dimensions: ${width}x${height}`);
        }

        const isRGB = header.dimension3 === 3;
        
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Could not get canvas context');

        const imageData = ctx.createImageData(width, height);
        const pixels = imageData.data;

        if (isRGB) {
            // RGB data: Alpaca usually returns [y][x][c] or flattened as R,G,B,R,G,B...
            for (let i = 0; i < width * height; i++) {
                const idx = i * 4;
                const dataIdx = i * 3;
                pixels[idx] = data[dataIdx] || 0;     // R
                pixels[idx + 1] = data[dataIdx + 1] || 0; // G
                pixels[idx + 2] = data[dataIdx + 2] || 0; // B
                pixels[idx + 3] = 255; // A
            }
        } else {
            // Grayscale normalization
            let min = Infinity;
            let max = -Infinity;
            
            // Sample pixels for faster min/max
            const sampleSize = Math.min(data.length, 100000);
            const step = Math.max(1, Math.floor(data.length / sampleSize));
            
            const samples: number[] = [];
            for (let i = 0; i < data.length; i += step) {
                const val = data[i];
                if (val < min) min = val;
                if (val > max) max = val;
                samples.push(val);
            }

            // Use a higher percentile to avoid over-brightening
            let effectiveMax = max;
            if (max - min > 100) {
                samples.sort((a, b) => a - b);
                effectiveMax = samples[Math.floor(samples.length * 0.999)];
            }

            const range = (effectiveMax - min) || 1;
            
            // Ensure we don't go out of bounds if dimensions are slightly off
            const len = Math.min(data.length, width * height);
            for (let i = 0; i < len; i++) {
                const val = Math.max(0, Math.min(255, ((data[i] - min) / range) * 255));
                const idx = i * 4;
                pixels[idx] = val;     // R
                pixels[idx + 1] = val; // G
                pixels[idx + 2] = val; // B
                pixels[idx + 3] = 255; // A
            }
        }

        ctx.putImageData(imageData, 0, 0);
        return canvas.toDataURL('image/jpeg', 0.85);
    }
}

export default AlpacaImageService.getInstance();
