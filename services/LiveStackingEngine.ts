
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

        // If astroService is provided, we can run the internal loop
        // Otherwise, we rely on external processNewFrame calls
        if (astroService) {
            const loop = async () => {
                if (!this.isRunning) return;

                try {
                    // カメラの準備待ち
                    if (astroService.waitForCameraIdle) {
                        const ready = await astroService.waitForCameraIdle(30000);
                        if (!ready) throw new Error("Camera timeout");
                    }

                    // 撮影リクエスト
                    await astroService.capturePreview(exposure, gain, offset, true);
                    
                    if (this.isRunning) {
                        onProgress(this.count);
                        setTimeout(loop, 200);
                    }
                } catch (e: any) {
                    console.error("[LiveStackingEngine] Loop error:", e);
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
            console.log(`[LiveStackingEngine] Initializing buffer: ${w}x${h}`);
            this.width = w;
            this.height = h;
            this.sumBuffer = new Float32Array(w * h * 3);
            this.count = 0;
            this.refStars = [];
        }

        // 1. 星の検出（重心計算によるサブピクセル精度）
        const stars = this.detectStars(buffer as Uint8ClampedArray, w, h);

        let tx = 0, ty = 0, angle = 0;

        if (this.count === 0) {
            if (stars.length < 1) return null; // 最初のフレームで星が見つからない場合はスキップ
            this.refStars = stars;
            console.log(`[LiveStackingEngine] Reference stars detected: ${stars.length}`);
        } else if (stars.length >= 2 && this.refStars.length >= 2) {
            // 2つ以上の星がある場合、視野回転（経緯台対応）を計算
            const r1 = this.refStars[0];
            const r2 = this.refStars[1];
            const c1 = stars[0];
            const c2 = stars[1];

            const angleRef = Math.atan2(r2.y - r1.y, r2.x - r1.x);
            const angleCur = Math.atan2(c2.y - c1.y, c2.x - c1.x);
            angle = angleRef - angleCur;

            // 回転後の位置合わせ（画像の中心を回転軸とする）
            const cx = w / 2;
            const cy = h / 2;
            const cos = Math.cos(angle);
            const sin = Math.sin(angle);
            
            const rx = (c1.x - cx) * cos - (c1.y - cy) * sin + cx;
            const ry = (c1.x - cx) * sin + (c1.y - cy) * cos + cy;
            
            tx = r1.x - rx;
            ty = r1.y - ry;

            // 極端な回転や移動はスキップ
            if (Math.abs(angle) > 0.2 || Math.abs(tx) > 100 || Math.abs(ty) > 100) {
                console.warn(`[LiveStackingEngine] Excessive movement (angle: ${angle.toFixed(3)}, tx: ${tx.toFixed(1)}, ty: ${ty.toFixed(1)}), skipping.`);
                return null;
            }
        } else if (stars.length >= 1 && this.refStars.length >= 1) {
            // 星が1つの場合は平行移動のみ
            tx = this.refStars[0].x - stars[0].x;
            ty = this.refStars[0].y - stars[0].y;
            
            if (Math.abs(tx) > 100 || Math.abs(ty) > 100) return null;
        } else {
            return null; // 星が見つからない
        }

        // 2. 加算（回転と移動を考慮）
        const sum = this.sumBuffer!;
        const cx = w / 2;
        const cy = h / 2;
        const cos = Math.cos(-angle); // 逆回転
        const sin = Math.sin(-angle);

        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                // ターゲット座標(x,y)からソース座標(sx,sy)を逆算
                // 1. 移動の逆
                const x1 = x - tx;
                const y1 = y - ty;
                
                // 2. 回転の逆（中心周り）
                const sx = Math.round((x1 - cx) * cos - (y1 - cy) * sin + cx);
                const sy = Math.round((x1 - cx) * sin + (y1 - cy) * cos + cy);

                if (sx >= 0 && sx < w && sy >= 0 && sy < h) {
                    const idx = (y * w + x) * 3;
                    const srcIdx = (sy * w + sx) * 4;
                    sum[idx] += buffer[srcIdx];
                    sum[idx + 1] += buffer[srcIdx + 1];
                    sum[idx + 2] += buffer[srcIdx + 2];
                }
            }
        }

        this.count++;

        // 3. 加算平均によるノイズ低減と明るさ調整
        if (this.canvas) {
            this.canvas.width = w;
            this.canvas.height = h;
            const ctx = this.canvas.getContext('2d')!;
            const outData = ctx.createImageData(w, h);
            
            // 明るさの自動調整（簡易的なストレッチ）
            // ユーザーの「加算で明るさを調整」という意図を汲み、
            // 平均値にゲインをかける（または加算結果をそのまま使う）
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
        const step = 10;
        const threshold = 180;

        for (let y = step; y < h - step; y += step) {
            for (let x = step; x < w - step; x += step) {
                const idx = (y * w + x) * 4;
                const val = (buffer[idx] + buffer[idx + 1] + buffer[idx + 2]) / 3;
                
                if (val > threshold) {
                    // 重心計算（3x3領域）
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
        
        // 近すぎる星をマージ（簡易的）
        const uniqueStars: (Point & { val: number })[] = [];
        const sorted = stars.sort((a, b) => b.val - a.val);
        
        for (const s of sorted) {
            if (!uniqueStars.some(u => Math.hypot(u.x - s.x, u.y - s.y) < 15)) {
                uniqueStars.push(s);
            }
            if (uniqueStars.length >= 15) break;
        }

        return uniqueStars;
    }
}
