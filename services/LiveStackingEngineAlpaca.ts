
let astroService: any = null;

export const setAstroService = (service: any) => {
    astroService = service;
};

interface Point { x: number; y: number; }

/**
 * Alpaca専用のライブスタッキングエンジン
 * 位置合わせ（アライメント）の精度と許容範囲を強化
 */
export class LiveStackingEngineAlpaca {
    private static instance: LiveStackingEngineAlpaca;
    private sumBuffer: Float32Array | null = null;
    private count = 0;
    private width = 0;
    private height = 0;
    private refStars: (Point & { val: number })[] = [];
    private isRunning = false;
    private canvas: HTMLCanvasElement | null = null;
    private isProcessing = false;
    private brightnessFactor = 1.0;

    public static getInstance() {
        if (!LiveStackingEngineAlpaca.instance) LiveStackingEngineAlpaca.instance = new LiveStackingEngineAlpaca();
        return LiveStackingEngineAlpaca.instance;
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
        console.log("[LiveStackingEngineAlpaca] Started.");
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

    public async processNewFrame(dataUrl: string, metadata: any): Promise<string | null> {
        if (!this.isRunning || this.isProcessing) return null;
        this.isProcessing = true;

        try {
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
            console.error("[LiveStackingEngineAlpaca] Processing error:", e);
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

        if (this.count === 0) {
            this.refStars = stars;
        } else if (stars.length > 0 && this.refStars.length > 0) {
            tx = this.refStars[0].x - stars[0].x;
            ty = this.refStars[0].y - stars[0].y;
            if (Math.abs(tx) > 150 || Math.abs(ty) > 150) {
                tx = 0; ty = 0;
            }
        }

        const sum = this.sumBuffer!;
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const sx = Math.round(x - tx);
                const sy = Math.round(y - ty);

                if (sx >= 0 && sx < w && sy >= 0 && sy < h) {
                    const srcIdx = (sy * w + sx) * 4;
                    const dstIdx = (y * w + x) * 3;
                    sum[dstIdx] += buffer[srcIdx];
                    sum[dstIdx + 1] += buffer[srcIdx + 1];
                    sum[dstIdx + 2] += buffer[srcIdx + 2];
                }
            }
        }
        this.count++;

        if (this.canvas) {
            this.canvas.width = w;
            this.canvas.height = h;
            const ctx = this.canvas.getContext('2d')!;
            const outData = ctx.createImageData(w, h);
            const gain = this.brightnessFactor;

            // Temporary RGB buffer for pixel operation pipeline
            const tempRGB = new Float32Array(w * h * 3);
            const invCount = 1.0 / this.count;
            for (let i = 0; i < w * h * 3; i++) {
                tempRGB[i] = sum[i] * invCount;
            }

            // High performance automatic image processing pipeline
            this.applyDeadPixelRemoval(tempRGB, w, h);
            this.applyBackgroundGradientRemoval(tempRGB, w, h);
            this.applyNoiseReduction(tempRGB, w, h);
            this.applyAutoHistogramStretch(tempRGB, w, h);

            for (let i = 0; i < w * h; i++) {
                outData.data[i * 4] = Math.max(0, Math.min(255, tempRGB[i * 3] * gain));
                outData.data[i * 4 + 1] = Math.max(0, Math.min(255, tempRGB[i * 3 + 1] * gain));
                outData.data[i * 4 + 2] = Math.max(0, Math.min(255, tempRGB[i * 3 + 2] * gain));
                outData.data[i * 4 + 3] = 255;
            }
            ctx.putImageData(outData, 0, 0);
            return this.canvas.toDataURL('image/jpeg', 0.9);
        }
        return null;
    }

    private detectStars(buffer: Uint8ClampedArray, w: number, h: number): (Point & { val: number })[] {
        const stars: (Point & { val: number })[] = [];
        const threshold = 160;
        const step = 10;
        for (let y = step; y < h - step; y += step) {
            for (let x = step; x < w - step; x += step) {
                const idx = (y * w + x) * 4;
                const val = (buffer[idx] + buffer[idx + 1] + buffer[idx + 2]) / 3;
                if (val > threshold) {
                    stars.push({ x, y, val });
                }
            }
        }
        return stars.sort((a, b) => b.val - a.val).slice(0, 30);
    }

    /**
     * 1. デッドピクセル除去 (白、R、G、Bなど極端な色点部分の補正)
     */
    private applyDeadPixelRemoval(rgb: Float32Array, w: number, h: number) {
        const out = new Float32Array(rgb.length);
        out.set(rgb);
        for (let y = 1; y < h - 1; y++) {
            const rowOffset = y * w;
            for (let x = 1; x < w - 1; x++) {
                const idx = (rowOffset + x) * 3;
                for (let c = 0; c < 3; c++) {
                    const val = rgb[idx + c];
                    let sum = 0;
                    let min = 255;
                    let max = 0;
                    
                    for (let dy = -1; dy <= 1; dy++) {
                        const nRow = (y + dy) * w;
                        for (let dx = -1; dx <= 1; dx++) {
                            if (dx === 0 && dy === 0) continue;
                            const nVal = rgb[(nRow + (x + dx)) * 3 + c];
                            sum += nVal;
                            if (nVal < min) min = nVal;
                            if (nVal > max) max = nVal;
                        }
                    }
                    
                    const avg = sum / 8;
                    // 周囲から40輝度以上飛び出ているドットをデッド(ホット/コールド)ピクセルとみなして補正
                    if (val > max + 40 || val < min - 40) {
                        out[idx + c] = avg;
                    }
                }
            }
        }
        rgb.set(out);
    }

    /**
     * 2. 背景グラデーション除去 (アンプグローや光害由来の傾斜を補正)
     */
    private applyBackgroundGradientRemoval(rgb: Float32Array, w: number, h: number) {
        const gridX = 4;
        const gridY = 4;
        const blockW = Math.floor(w / gridX);
        const blockH = Math.floor(h / gridY);
        const bgModel = new Float32Array(gridX * gridY * 3);

        for (let gy = 0; gy < gridY; gy++) {
            for (let gx = 0; gx < gridX; gx++) {
                const bgIdx = (gy * gridX + gx) * 3;
                let minR = 255, minG = 255, minB = 255;
                
                const startY = gy * blockH;
                const endY = Math.min(h, startY + blockH);
                const startX = gx * blockW;
                const endX = Math.min(w, startX + blockW);

                for (let y = startY; y < endY; y += 6) {
                    const rowOffset = y * w;
                    for (let x = startX; x < endX; x += 6) {
                        const idx = (rowOffset + x) * 3;
                        if (rgb[idx] < minR) minR = rgb[idx];
                        if (rgb[idx + 1] < minG) minG = rgb[idx + 1];
                        if (rgb[idx + 2] < minB) minB = rgb[idx + 2];
                    }
                }
                bgModel[bgIdx] = minR;
                bgModel[bgIdx + 1] = minG;
                bgModel[bgIdx + 2] = minB;
            }
        }

        for (let y = 0; y < h; y++) {
            const rowOffset = y * w;
            const fy = (y / h) * (gridY - 1);
            const gy0 = Math.floor(fy);
            const gy1 = Math.min(gridY - 1, gy0 + 1);
            const wy = fy - gy0;

            for (let x = 0; x < w; x++) {
                const fx = (x / w) * (gridX - 1);
                const gx0 = Math.floor(fx);
                const gx1 = Math.min(gridX - 1, gx0 + 1);
                const wx = fx - gx0;

                const idx = (rowOffset + x) * 3;

                for (let c = 0; c < 3; c++) {
                    const v00 = bgModel[(gy0 * gridX + gx0) * 3 + c];
                    const v10 = bgModel[(gy0 * gridX + gx1) * 3 + c];
                    const v01 = bgModel[(gy1 * gridX + gx0) * 3 + c];
                    const v11 = bgModel[(gy1 * gridX + gx1) * 3 + c];

                    const bgVal = (1 - wy) * ((1 - wx) * v00 + wx * v10) + wy * ((1 - wx) * v01 + wx * v11);
                    // 背景のグラデーション成分のみをゆるやかに(80%)引き算してフラットにする
                    rgb[idx + c] = Math.max(0, rgb[idx + c] - bgVal * 0.8);
                }
            }
        }
    }

    /**
     * 3. ノイズ除去 (エッジ保存型簡易バイラテラルフィルタ)
     */
    private applyNoiseReduction(rgb: Float32Array, w: number, h: number) {
        const out = new Float32Array(rgb.length);
        out.set(rgb);
        const sigmaR = 15; // 色差閾値
        for (let y = 1; y < h - 1; y++) {
            const rowOffset = y * w;
            for (let x = 1; x < w - 1; x++) {
                const idx = (rowOffset + x) * 3;
                const r0 = rgb[idx];
                const g0 = rgb[idx + 1];
                const b0 = rgb[idx + 2];

                let sumR = 0, sumG = 0, sumB = 0;
                let weightSum = 0;

                for (let dy = -1; dy <= 1; dy++) {
                    const nRow = (y + dy) * w;
                    for (let dx = -1; dx <= 1; dx++) {
                        const nIdx = (nRow + (x + dx)) * 3;
                        const nr = rgb[nIdx];
                        const ng = rgb[nIdx + 1];
                        const nb = rgb[nIdx + 2];

                        const diff = Math.sqrt((nr - r0) ** 2 + (ng - g0) ** 2 + (nb - b0) ** 2);
                        const weight = Math.exp(-(diff * diff) / (2 * sigmaR * sigmaR));
                        
                        sumR += nr * weight;
                        sumG += ng * weight;
                        sumB += nb * weight;
                        weightSum += weight;
                    }
                }

                if (weightSum > 0) {
                    out[idx] = sumR / weightSum;
                    out[idx + 1] = sumG / weightSum;
                    out[idx + 2] = sumB / weightSum;
                }
            }
        }
        rgb.set(out);
    }

    /**
     * 4. ライブスタッキング中のヒストグラム調整 (Auto Histogram stretching via MTF)
     */
    private applyAutoHistogramStretch(rgb: Float32Array, w: number, h: number) {
        const step = 20;
        const samples: number[] = [];
        for (let i = 0; i < rgb.length; i += step * 3) {
            samples.push((rgb[i] + rgb[i + 1] + rgb[i + 2]) / 3);
        }
        if (samples.length === 0) return;
        samples.sort((a, b) => a - b);

        const shadowIdx = Math.floor(samples.length * 0.15);
        const shadowVal = samples[shadowIdx] || 5;

        const highlightIdx = Math.floor(samples.length * 0.995);
        const highlightVal = samples[highlightIdx] || 250;

        const range = highlightVal - shadowVal;
        if (range <= 0) return;

        const baseAvg = samples.reduce((a, b) => a + b, 0) / samples.length;
        let m = 0.05; // 暗い画像をしっかり引き上げるため強めのデフォルト
        if (baseAvg > 45) m = 0.15;
        else if (baseAvg > 18) m = 0.1;

        for (let i = 0; i < rgb.length; i += 3) {
            for (let c = 0; c < 3; c++) {
                const val = rgb[i + c];
                let normalized = (val - shadowVal) / range;
                if (normalized < 0) normalized = 0;
                if (normalized > 1) normalized = 1;

                if (normalized > 0) {
                    // Midtone Transfer Function
                    const stretched = ((m - 1) * normalized) / ((2 * m - 1) * normalized - m);
                    rgb[i + c] = Math.max(0, Math.min(255, stretched * 255));
                } else {
                    rgb[i + c] = 0;
                }
            }
        }
    }
}
