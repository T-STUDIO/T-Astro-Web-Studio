
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
            
            // Temporary RGB buffer for pixel operation pipeline
            const tempRGB = new Float32Array(w * h * 3);
            for (let i = 0; i < w * h * 3; i++) {
                tempRGB[i] = sum[i] * invCount;
            }

            // High performance automatic image processing pipeline
            this.applyDeadPixelRemoval(tempRGB, w, h);
            this.applyBackgroundGradientRemoval(tempRGB, w, h);
            this.applyNoiseReduction(tempRGB, w, h);
            this.applyAutoHistogramStretch(tempRGB, w, h);

            for (let y = 0; y < h; y++) {
                const rowOffset = y * w;
                for (let x = 0; x < w; x++) {
                    const i = rowOffset + x;
                    const idx3 = i * 3;
                    const r = Math.max(0, Math.min(255, tempRGB[idx3] * gain));
                    const g = Math.max(0, Math.min(255, tempRGB[idx3 + 1] * gain));
                    const b = Math.max(0, Math.min(255, tempRGB[idx3 + 2] * gain));
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
