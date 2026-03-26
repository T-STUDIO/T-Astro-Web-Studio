
let astroService: any = null;

export const setAstroService = (service: any) => {
    astroService = service;
};

interface Point { x: number; y: number; }

export class LiveStackingEngine {
    private static instance: LiveStackingEngine;
    private sumBuffer: Float32Array | null = null;
    private count = 0;
    private width = 0;
    private height = 0;
    private refStars: (Point & { val: number })[] = [];
    private isRunning = false;
    private canvas: HTMLCanvasElement | null = null;
    private isProcessing = false;
    private brightnessFactor = 1.0; // 明るさ調整用

    public static getInstance() {
        if (!LiveStackingEngine.instance) LiveStackingEngine.instance = new LiveStackingEngine();
        return LiveStackingEngine.instance;
    }

    public async start(
        exposure: number, 
        gain: number, 
        offset: number, 
        colorBalance: {r: number, g: number, b: number},
        onProgress: (count: number) => void,
        onError: (msg: string) => void
    ) {
        this.reset();
        this.isRunning = true;
        this.canvas = document.createElement('canvas');
        console.log("[LiveStackingEngine] Started.");
        
        // 撮影ループを即座に開始
        if (astroService) {
            astroService.startLiveStacking(exposure, gain, offset);
        }
    }

    public stop() {
        this.isRunning = false;
        if (astroService) {
            astroService.stopLiveStacking();
        }
    }

    public setBrightness(val: number) {
        this.brightnessFactor = val;
    }

    private reset() {
        this.sumBuffer = null;
        this.count = 0;
        this.refStars = [];
        this.width = 0;
        this.height = 0;
    }

    /**
     * 到着した画像を処理する（App.tsxから呼び出し）
     */
    public processNewFrame(dataUrl: string, metadata: any): { url: string, count: number } | null {
        if (!this.isRunning || this.isProcessing) return null;
        this.isProcessing = true;

        try {
            // RAWデータ優先で使用
            if (dataUrl === 'raw-data-available' && metadata?.rawBuffer) {
                const { rawBuffer, rawWidth, rawHeight } = metadata;
                const url = this.stackRaw(rawBuffer, rawWidth, rawHeight);
                this.isProcessing = false;
                if (url) return { url, count: this.count };
            }
        } catch (e) {
            console.error("[LiveStackingEngine] Processing error:", e);
        }

        this.isProcessing = false;
        return null;
    }

    private stackRaw(buffer: Uint8ClampedArray | Uint8Array, w: number, h: number): string | null {
        if (this.width !== w || this.height !== h) {
            this.width = w;
            this.height = h;
            this.sumBuffer = new Float32Array(w * h * 3);
            this.count = 0;
            this.refStars = [];
            if (this.canvas) {
                this.canvas.width = w;
                this.canvas.height = h;
            }
        }

        const stars = this.detectStars(buffer as Uint8ClampedArray, w, h);
        let tx = 0, ty = 0;
        const sum = this.sumBuffer!;

        if (this.count === 0) {
            this.refStars = stars;
            // 初回はそのままバッファにコピー
            for (let i = 0; i < w * h; i++) {
                const srcIdx = i * 4;
                const dstIdx = i * 3;
                sum[dstIdx] = buffer[srcIdx];
                sum[dstIdx + 1] = buffer[srcIdx + 1];
                sum[dstIdx + 2] = buffer[srcIdx + 2];
            }
        } else {
            // 位置合わせ（複数の星から最適な移動量を推定）
            if (stars.length > 0 && this.refStars.length > 0) {
                // 簡易的なマッチング：最も明るい数個の星の移動量の平均をとる
                let totalTx = 0, totalTy = 0, matchCount = 0;
                const maxMatches = Math.min(5, stars.length, this.refStars.length);
                
                for (let i = 0; i < maxMatches; i++) {
                    const dx = this.refStars[i].x - stars[i].x;
                    const dy = this.refStars[i].y - stars[i].y;
                    
                    // 前回の星との相対的な距離が近いかチェック（簡易的な検証）
                    if (Math.abs(dx) < w * 0.1 && Math.abs(dy) < h * 0.1) {
                        totalTx += dx;
                        totalTy += dy;
                        matchCount++;
                    }
                }
                
                if (matchCount > 0) {
                    tx = totalTx / matchCount;
                    ty = totalTy / matchCount;
                }
            }

            // 加算処理（位置合わせあり）
            const itx = Math.round(tx);
            const ity = Math.round(ty);
            
            const startY = Math.max(0, ity);
            const endY = Math.min(h, h + ity);
            const startX = Math.max(0, itx);
            const endX = Math.min(w, w + itx);
            
            for (let y = startY; y < endY; y++) {
                const sy = y - ity;
                const rowOffset = y * w;
                const srcRowOffset = sy * w;
                for (let x = startX; x < endX; x++) {
                    const sx = x - itx;
                    const srcIdx = (srcRowOffset + sx) * 4;
                    const dstIdx = (rowOffset + x) * 3;
                    sum[dstIdx] += buffer[srcIdx];
                    sum[dstIdx + 1] += buffer[srcIdx + 1];
                    sum[dstIdx + 2] += buffer[srcIdx + 2];
                }
            }
        }
        this.count++;

        if (this.canvas) {
            const ctx = this.canvas.getContext('2d', { alpha: false })!;
            const outData = ctx.createImageData(w, h);
            const outPixels = new Uint32Array(outData.data.buffer);
            const gain = this.brightnessFactor;
            const invCount = 1.0 / this.count;
            
            for (let y = 0; y < h; y++) {
                const rowOffset = y * w;
                for (let x = 0; x < w; x++) {
                    const i = rowOffset + x;
                    const idx3 = i * 3;
                    const r = Math.min(255, (sum[idx3] * invCount) * gain);
                    const g = Math.min(255, (sum[idx3 + 1] * invCount) * gain);
                    const b = Math.min(255, (sum[idx3 + 2] * invCount) * gain);
                    // ABGR format for little-endian
                    outPixels[i] = (255 << 24) | (b << 16) | (g << 8) | r;
                }
            }
            ctx.putImageData(outData, 0, 0);
            return this.canvas.toDataURL('image/jpeg', 0.85);
        }
        return null;
    }

    private detectStars(buffer: Uint8ClampedArray, w: number, h: number): (Point & { val: number })[] {
        const stars: (Point & { val: number })[] = [];
        
        // 動的な閾値計算（画像全体の平均から算出）
        let sumVal = 0;
        const sampleSize = 2000;
        const stepS = Math.max(1, Math.floor((w * h) / sampleSize));
        for (let i = 0; i < w * h; i += stepS) {
            sumVal += (buffer[i * 4] + buffer[i * 4 + 1] + buffer[i * 4 + 2]) / 3;
        }
        const avg = sumVal / (w * h / stepS);
        const threshold = Math.max(40, avg + 50); // 背景より十分明るい場所を探す
        
        const step = 8;
        for (let y = step; y < h - step; y += step) {
            for (let x = step; x < w - step; x += step) {
                const idx = (y * w + x) * 4;
                const val = (buffer[idx] + buffer[idx + 1] + buffer[idx + 2]) / 3;
                
                if (val > threshold) {
                    // 簡易的なピーク検出
                    const up = (buffer[((y - 1) * w + x) * 4] + buffer[((y - 1) * w + x) * 4 + 1] + buffer[((y - 1) * w + x) * 4 + 2]) / 3;
                    const down = (buffer[((y + 1) * w + x) * 4] + buffer[((y + 1) * w + x) * 4 + 1] + buffer[((y + 1) * w + x) * 4 + 2]) / 3;
                    const left = (buffer[(y * w + (x - 1)) * 4] + buffer[(y * w + (x - 1)) * 4 + 1] + buffer[(y * w + (x - 1)) * 4 + 2]) / 3;
                    const right = (buffer[(y * w + (x + 1)) * 4] + buffer[(y * w + (x + 1)) * 4 + 1] + buffer[(y * w + (x + 1)) * 4 + 2]) / 3;
                    
                    if (val >= up && val >= down && val >= left && val >= right) {
                        stars.push({ x, y, val });
                    }
                }
            }
        }
        return stars.sort((a, b) => b.val - a.val).slice(0, 30);
    }
}
