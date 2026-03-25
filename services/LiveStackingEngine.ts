
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
    }

    public stop() {
        this.isRunning = false;
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
    public async processNewFrame(dataUrl: string, metadata: any): Promise<string | null> {
        if (!this.isRunning || this.isProcessing) return null;
        this.isProcessing = true;

        try {
            // RAWデータ優先で使用
            if (dataUrl === 'raw-data-available' && metadata?.rawBuffer) {
                const { rawBuffer, rawWidth, rawHeight } = metadata;
                const result = this.stackRaw(rawBuffer, rawWidth, rawHeight);
                this.isProcessing = false;
                return result;
            }
            
            // AlpacaやDataURLの場合は、Imageオブジェクトでデコードしてピクセルを取得
            if (dataUrl.startsWith('data:image')) {
                const img = new Image();
                await new Promise((resolve, reject) => {
                    img.onload = resolve;
                    img.onerror = reject;
                    img.src = dataUrl;
                });

                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = img.width;
                tempCanvas.height = img.height;
                const tempCtx = tempCanvas.getContext('2d');
                if (tempCtx) {
                    tempCtx.drawImage(img, 0, 0);
                    const imageData = tempCtx.getImageData(0, 0, img.width, img.height);
                    const result = this.stackRaw(imageData.data, img.width, img.height);
                    this.isProcessing = false;
                    return result;
                }
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
        }

        const stars = this.detectStars(buffer as Uint8ClampedArray, w, h);
        let tx = 0, ty = 0;
        const sum = this.sumBuffer!;

        if (this.count === 0) {
            this.refStars = stars;
            // 初回はそのままバッファにコピー
            for (let i = 0; i < w * h; i++) {
                sum[i * 3] = buffer[i * 4];
                sum[i * 3 + 1] = buffer[i * 4 + 1];
                sum[i * 3 + 2] = buffer[i * 4 + 2];
            }
        } else if (stars.length > 0 && this.refStars.length > 0) {
            // シンプルな位置合わせ（最初の1つの星で合わせる）
            tx = this.refStars[0].x - stars[0].x;
            ty = this.refStars[0].y - stars[0].y;
            
            // 極端な移動は無視（ノイズによる誤検出対策）
            if (Math.abs(tx) > w * 0.1 || Math.abs(ty) > h * 0.1) {
                console.warn("[LiveStackingEngine] Large shift detected, skipping alignment:", tx, ty);
                tx = 0; ty = 0;
            }

            for (let y = 0; y < h; y++) {
                const sy = Math.round(y - ty);
                if (sy < 0 || sy >= h) continue;

                for (let x = 0; x < w; x++) {
                    const sx = Math.round(x - tx);
                    if (sx < 0 || sx >= w) continue;

                    const srcIdx = (sy * w + sx) * 4;
                    const dstIdx = (y * w + x) * 3;
                    sum[dstIdx] += buffer[srcIdx];
                    sum[dstIdx + 1] += buffer[srcIdx + 1];
                    sum[dstIdx + 2] += buffer[srcIdx + 2];
                }
            }
        } else {
            // 星が見つからない場合は位置合わせなしで加算
            for (let i = 0; i < w * h; i++) {
                sum[i * 3] += buffer[i * 4];
                sum[i * 3 + 1] += buffer[i * 4 + 1];
                sum[i * 3 + 2] += buffer[i * 4 + 2];
            }
        }
        this.count++;

        if (this.canvas) {
            this.canvas.width = w;
            this.canvas.height = h;
            const ctx = this.canvas.getContext('2d')!;
            const outData = ctx.createImageData(w, h);
            const gain = this.brightnessFactor;
            for (let i = 0; i < w * h; i++) {
                outData.data[i * 4] = Math.min(255, (sum[i * 3] / this.count) * gain);
                outData.data[i * 4 + 1] = Math.min(255, (sum[i * 3 + 1] / this.count) * gain);
                outData.data[i * 4 + 2] = Math.min(255, (sum[i * 3 + 2] / this.count) * gain);
                outData.data[i * 4 + 3] = 255;
            }
            ctx.putImageData(outData, 0, 0);
            return this.canvas.toDataURL('image/jpeg', 0.85);
        }
        return null;
    }

    private detectStars(buffer: Uint8ClampedArray, w: number, h: number): (Point & { val: number })[] {
        const stars: (Point & { val: number })[] = [];
        const threshold = 180;
        const step = 8;
        
        for (let y = step; y < h - step; y += step) {
            for (let x = step; x < w - step; x += step) {
                const idx = (y * w + x) * 4;
                const val = (buffer[idx] + buffer[idx + 1] + buffer[idx + 2]) / 3;
                
                if (val > threshold) {
                    // 周囲より明るいかチェック（簡易的なピーク検出）
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
        return stars.sort((a, b) => b.val - a.val).slice(0, 20);
    }
}
