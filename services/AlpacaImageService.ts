
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
        const width = header.dimension1 || 640;
        const height = header.dimension2 || 480;
        const isRGB = header.dimension3 === 3;
        
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Could not get canvas context');

        const imageData = ctx.createImageData(width, height);
        const pixels = imageData.data;

        if (isRGB) {
            // RGB data is usually interleaved or plane-separated
            // Alpaca JSON usually returns [y][x][c] or [c][y][x]
            // If flattened, we need to know the order.
            // Let's assume it's R, G, B for each pixel if rank is 3 and dim3 is 3
            for (let i = 0; i < width * height; i++) {
                const idx = i * 4;
                const dataIdx = i * 3;
                pixels[idx] = data[dataIdx] || 0;     // R
                pixels[idx + 1] = data[dataIdx + 1] || 0; // G
                pixels[idx + 2] = data[dataIdx + 2] || 0; // B
                pixels[idx + 3] = 255; // A
            }
        } else {
            // Simple grayscale normalization for display
            let min = Infinity;
            let max = -Infinity;
            // Sample some pixels for faster min/max if data is huge
            const step = data.length > 1000000 ? 10 : 1;
            for (let i = 0; i < data.length; i += step) {
                if (data[i] < min) min = data[i];
                if (data[i] > max) max = data[i];
            }

            const range = max - min || 1;
            for (let i = 0; i < width * height; i++) {
                const val = ((data[i] - min) / range) * 255;
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
