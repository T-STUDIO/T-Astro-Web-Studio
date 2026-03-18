
import * as AstroService from './AstroService';

interface Point { x: number; y: number; }

export class LiveStackingEngine {
    private static instance: LiveStackingEngine;
    private sumBuffer: Float32Array | null = null;
    private count = 0;
    private width = 0;
    private height = 0;
    private refStars: Point[] = [];
    private isRunning = false;
    private canvas: HTMLCanvasElement | null = null;

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

        const loop = async () => {
            if (!this.isRunning) return;

            try {
                // カメラの準備待ち
                const ready = await AstroService.waitForCameraIdle(30000);
                if (!ready) throw new Error("Camera timeout");

                // 撮影リクエスト
                await AstroService.capturePreview(exposure, gain, offset, true);
                
                // 画像取得まで待機（ポーリング）
                // 既存のAstroService.setImageReceivedCallbackを通じて画像が届くのを待つ
                // ここでは、AstroServiceが最新画像をトリガーするまで待機する仕組みが必要
                // 簡易化のためsleepを使用（実際の更新はグローバルコールバックでフックされる）
                await new Promise(resolve => setTimeout(resolve, exposure + 1000));

                if (this.isRunning) {
                    onProgress(this.count);
                    setTimeout(loop, 200);
                }
            } catch (e: any) {
                onError(e.message);
                this.stop();
            }
        };

        loop();
    }

    public stop() {
        this.isRunning = false;
        AstroService.stopCapture();
    }

    private reset() {
        this.sumBuffer = null;
        this.count = 0;
        this.refStars = [];
    }

    /**
     * 到着した画像を処理する（App.tsxから呼び出し）
     */
    public processNewFrame(dataUrl: string, metadata: any): string | null {
        if (!this.isRunning) return null;
        if (!this.canvas) return null;

        // RAWデータ優先で使用
        if (dataUrl === 'raw-data-available' && metadata?.rawBuffer) {
            const { rawBuffer, rawWidth, rawHeight } = metadata;
            return this.stackRaw(rawBuffer, rawWidth, rawHeight);
        }
        
        return null; // 非RAWは表示ロジックに任せる
    }

    private stackRaw(buffer: Uint8ClampedArray, w: number, h: number): string | null {
        if (this.width !== w || this.height !== h) {
            this.width = w;
            this.height = h;
            this.sumBuffer = new Float32Array(w * h * 3);
            this.count = 0;
            this.refStars = [];
        }

        const currentFrame = new Float32Array(w * h * 3);
        for (let i = 0; i < w * h; i++) {
            currentFrame[i * 3] = buffer[i * 4];
            currentFrame[i * 3 + 1] = buffer[i * 4 + 1];
            currentFrame[i * 3 + 2] = buffer[i * 4 + 2];
        }

        // 簡易アライメント（重心検出）
        const stars = this.detectStars(buffer, w, h);
        let shiftX = 0;
        let shiftY = 0;

        if (this.count === 0) {
            this.refStars = stars;
        } else if (stars.length > 0 && this.refStars.length > 0) {
            // 最も明るい星のズレを計算
            shiftX = Math.round(this.refStars[0].x - stars[0].x);
            shiftY = Math.round(this.refStars[0].y - stars[0].y);
        }

        // 加算
        const sum = this.sumBuffer!;
        for (let y = 0; y < h; y++) {
            const srcY = y - shiftY;
            if (srcY < 0 || srcY >= h) continue;
            for (let x = 0; x < w; x++) {
                const srcX = x - shiftX;
                if (srcX < 0 || srcX >= w) continue;
                
                const idx = (y * w + x) * 3;
                const srcIdx = (srcY * w + srcX) * 3;
                sum[idx] += currentFrame[srcIdx];
                sum[idx + 1] += currentFrame[srcIdx + 1];
                sum[idx + 2] += currentFrame[srcIdx + 2];
            }
        }

        this.count++;

        // 平均化して表示用キャンバスへ
        this.canvas!.width = w;
        this.canvas!.height = h;
        const ctx = this.canvas!.getContext('2d')!;
        const outData = ctx.createImageData(w, h);
        for (let i = 0; i < w * h; i++) {
            outData.data[i * 4] = sum[i * 3] / this.count;
            outData.data[i * 4 + 1] = sum[i * 3 + 1] / this.count;
            outData.data[i * 4 + 2] = sum[i * 3 + 2] / this.count;
            outData.data[i * 4 + 3] = 255;
        }
        ctx.putImageData(outData, 0, 0);
        return this.canvas!.toDataURL('image/jpeg', 0.85);
    }

    private detectStars(buffer: Uint8ClampedArray, w: number, h: number): Point[] {
        const stars: {x: number, y: number, val: number}[] = [];
        const step = 4; // 高速化のため間引く
        const threshold = 180;

        for (let y = step; y < h - step; y += step) {
            for (let x = step; x < w - step; x += step) {
                const idx = (y * w + x) * 4;
                const val = (buffer[idx] + buffer[idx + 1] + buffer[idx + 2]) / 3;
                if (val > threshold) {
                    stars.push({ x, y, val });
                }
            }
        }
        // 明るい順にソート
        return stars.sort((a, b) => b.val - a.val).slice(0, 10);
    }
}
