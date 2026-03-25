
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

        if (astroService) {
            const loop = async () => {
                if (!this.isRunning) return;
                try {
                    if (astroService.waitForCameraIdle) {
                        await astroService.waitForCameraIdle(30000);
                    }
                    await astroService.capturePreview(exposure, gain, offset, true);
                    if (this.isRunning) {
                        onProgress(this.count);
                        setTimeout(loop, 200);
                    }
                } catch (e: any) {
                    console.error("[LiveStackingEngineAlpaca] Loop error:", e);
                    onError(e.message);
                    this.stop();
                }
            };
            loop();
        }
    }

    public stop() {
        this.isRunning = false;
        if (astroService && astroService.stopCapture) {
            astroService.stopCapture();
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

        // Alpaca用に閾値を少し下げ、星の検出数を増やす
        const stars = this.detectStars(buffer as Uint8ClampedArray, w, h);

        let tx = 0, ty = 0, angle = 0;

        if (this.count === 0) {
            if (stars.length < 1) {
                console.warn(`[LiveStackingEngineAlpaca] No stars detected in first frame.`);
                return null;
            }
            this.refStars = stars;
            console.log(`[LiveStackingEngineAlpaca] Reference stars detected: ${stars.length}`);
        } else if (stars.length >= 2 && this.refStars.length >= 2) {
            // 視野回転の計算
            const r1 = this.refStars[0];
            const r2 = this.refStars[1];
            const c1 = stars[0];
            const c2 = stars[1];

            const angleRef = Math.atan2(r2.y - r1.y, r2.x - r1.x);
            const angleCur = Math.atan2(c2.y - c1.y, c2.x - c1.x);
            angle = angleRef - angleCur;

            const cx = w / 2;
            const cy = h / 2;
            const cos = Math.cos(angle);
            const sin = Math.sin(angle);
            
            const rx = (c1.x - cx) * cos - (c1.y - cy) * sin + cx;
            const ry = (c1.x - cx) * sin + (c1.y - cy) * cos + cy;
            
            tx = r1.x - rx;
            ty = r1.y - ry;

            // Alpacaでは許容範囲を広げる (tx, ty: 200pxまで許容)
            if (Math.abs(angle) > 0.5 || Math.abs(tx) > 200 || Math.abs(ty) > 200) {
                console.warn(`[LiveStackingEngineAlpaca] Excessive movement (tx:${tx.toFixed(1)}, ty:${ty.toFixed(1)}, angle:${(angle*180/Math.PI).toFixed(1)}deg), skipping frame.`);
                return null;
            }
        } else if (stars.length >= 1 && this.refStars.length >= 1) {
            tx = this.refStars[0].x - stars[0].x;
            ty = this.refStars[0].y - stars[0].y;
            if (Math.abs(tx) > 200 || Math.abs(ty) > 200) {
                console.warn(`[LiveStackingEngineAlpaca] Excessive movement (tx:${tx.toFixed(1)}, ty:${ty.toFixed(1)}), skipping frame.`);
                return null;
            }
        } else {
            // 星が見つからない場合、前回のフレームを維持するためにnullを返すが、カウントは増やさない
            console.warn(`[LiveStackingEngineAlpaca] No stars detected, skipping frame.`);
            return null;
        }

        const sum = this.sumBuffer!;
        const cx = w / 2;
        const cy = h / 2;
        const cos = Math.cos(-angle);
        const sin = Math.sin(-angle);

        // バイリニア補間を使用してスタッキング精度を向上
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const x1 = x - tx;
                const y1 = y - ty;
                
                const sx = (x1 - cx) * cos - (y1 - cy) * sin + cx;
                const sy = (x1 - cx) * sin + (y1 - cy) * cos + cy;

                if (sx >= 0 && sx < w - 1 && sy >= 0 && sy < h - 1) {
                    const x0 = Math.floor(sx);
                    const y0 = Math.floor(sy);
                    const xf = sx - x0;
                    const yf = sy - y0;

                    const idx = (y * w + x) * 3;
                    
                    // 4画素の重み付け平均 (Bilinear)
                    for (let c = 0; c < 3; c++) {
                        const v00 = buffer[(y0 * w + x0) * 4 + c];
                        const v10 = buffer[(y0 * w + (x0 + 1)) * 4 + c];
                        const v01 = buffer[((y0 + 1) * w + x0) * 4 + c];
                        const v11 = buffer[((y0 + 1) * w + (x0 + 1)) * 4 + c];
                        
                        const val = v00 * (1 - xf) * (1 - yf) +
                                    v10 * xf * (1 - yf) +
                                    v01 * (1 - xf) * yf +
                                    v11 * xf * yf;
                        
                        sum[idx + c] += val;
                    }
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
            
            for (let i = 0; i < w * h; i++) {
                outData.data[i * 4] = Math.min(255, (sum[i * 3] / this.count) * gain);
                outData.data[i * 4 + 1] = Math.min(255, (sum[i * 3 + 1] / this.count) * gain);
                outData.data[i * 4 + 2] = Math.min(255, (sum[i * 3 + 2] / this.count) * gain);
                outData.data[i * 4 + 3] = 255;
            }
            ctx.putImageData(outData, 0, 0);
            return this.canvas.toDataURL('image/jpeg', 0.9);
        }
        return null;
    }

    private detectStars(buffer: Uint8ClampedArray, w: number, h: number): (Point & { val: number })[] {
        const stars: (Point & { val: number })[] = [];
        const step = 8; 
        
        // 適応型の閾値計算（平均輝度に基づいて調整）
        let totalBrightness = 0;
        let samples = 0;
        for (let i = 0; i < buffer.length; i += 400) {
            totalBrightness += (buffer[i] + buffer[i + 1] + buffer[i + 2]) / 3;
            samples++;
        }
        const avgBrightness = totalBrightness / samples;
        const threshold = Math.max(40, avgBrightness + 50); // 最低40、平均+50を閾値とする

        for (let y = step; y < h - step; y += step) {
            for (let x = step; x < w - step; x += step) {
                const idx = (y * w + x) * 4;
                const val = (buffer[idx] + buffer[idx + 1] + buffer[idx + 2]) / 3;
                
                if (val > threshold) {
                    // Check if it's a local maximum
                    let isMax = true;
                    for (let dy = -2; dy <= 2; dy++) {
                        for (let dx = -2; dx <= 2; dx++) {
                            if (dx === 0 && dy === 0) continue;
                            const nIdx = ((y + dy) * w + (x + dx)) * 4;
                            const nVal = (buffer[nIdx] + buffer[nIdx + 1] + buffer[nIdx + 2]) / 3;
                            if (nVal > val) {
                                isMax = false;
                                break;
                            }
                        }
                        if (!isMax) break;
                    }

                    if (isMax) {
                        // 重心計算（5x5領域）
                        let sumVal = 0;
                        let sumX = 0;
                        let sumY = 0;
                        
                        for (let dy = -2; dy <= 2; dy++) {
                            for (let dx = -2; dx <= 2; dx++) {
                                const pIdx = ((y + dy) * w + (x + dx)) * 4;
                                const pVal = (buffer[pIdx] + buffer[pIdx + 1] + buffer[pIdx + 2]) / 3;
                                sumVal += pVal;
                                sumX += (x + dx) * pVal;
                                sumY += (y + dy) * pVal;
                            }
                        }
                        
                        if (sumVal > 0) {
                            stars.push({ 
                                x: sumX / sumVal, 
                                y: sumY / sumVal, 
                                val: sumVal 
                            });
                        }
                    }
                }
            }
        }
        
        // 近すぎる星をマージ（簡易的）
        const uniqueStars: (Point & { val: number })[] = [];
        const sorted = stars.sort((a, b) => b.val - a.val);
        
        for (const s of sorted) {
            if (!uniqueStars.some(u => Math.hypot(u.x - s.x, u.y - s.y) < 20)) {
                uniqueStars.push(s);
            }
            if (uniqueStars.length >= 50) break;
        }
        return uniqueStars;
    }
}
