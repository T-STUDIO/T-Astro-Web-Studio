import { CelestialObject, PlateSolverType, LocalSolverSettings, SlewStatus, LogEntry, ConnectionStatus } from '../types';
import * as AstroService from './AstroService'; // INDIドライバ用
import { solveImageAstrometryNet, solveImageLocal } from './plateSolvingService';
import { hmsToDegrees, dmsToDegrees, calculateAngularDistance } from '../utils/coords';

export interface SlewRequest {
    target: CelestialObject | null;
    isAutoCenterEnabled: boolean;
    connectionStatus: ConnectionStatus;
    exposure: number;
    gain: number;
    offset: number;
    solverType: PlateSolverType;
    apiKey: string;
    localSettings: LocalSolverSettings;
    setStatus: (status: SlewStatus) => void;
    addLog: (key: string, substitutions?: any, type?: LogEntry['type']) => void;
}

/**
 * スルー移動およびオートセンタリングの実行プロセスを管理する静的サービス。
 */
export class AutoCenterService {
    private static isRunning = false;
    private static maxAttempts = 3;
    private static toleranceDegrees = 0.05;

    /**
     * App.tsx から呼び出す唯一のエントリーポイント。
     * 設定に応じて通常のスルーまたはオートセンタリング・ワークフローを開始します。
     */
    public static async execute(req: SlewRequest) {
        if (!req.target || req.connectionStatus !== 'Connected') return;

        if (req.isAutoCenterEnabled) {
            // 自動センタリング・モード
            await this.runAutoCenter(req);
        } else {
            // 通常の GoTo モード
            await this.runStandardSlew(req);
        }
    }

    /**
     * 通常のスルー移動（GoTo）を実行します。
     */
    private static async runStandardSlew(req: SlewRequest) {
        const { target, setStatus, addLog } = req;
        if (!target) return;

        setStatus('Slewing');
        addLog('logs.slewing', { objectName: target.name });
        
        try {
            await AstroService.slewTo(target);
            setStatus('Idle');
            addLog('logs.slewComplete', { objectName: target.name }, 'success');
        } catch (e: any) {
            addLog('logs.slewError', { message: e.message }, 'error');
            setStatus('Idle');
        }
    }

    /**
     * 撮影・解析・同期・移動を繰り返すオートセンタリング・ワークフローを実行します。
     */
    private static async runAutoCenter(req: SlewRequest) {
        if (this.isRunning) return;
        this.isRunning = true;

        const { target, setStatus, addLog } = req;
        if (!target) { this.isRunning = false; return; }

        try {
            addLog('logs.centering', { objectName: target.name });
            const targetRa = hmsToDegrees(target.ra);
            const targetDec = dmsToDegrees(target.dec);

            for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
                // 1. 移動：ターゲット座標へスルー
                setStatus('Slewing');
                await AstroService.slewTo(target);
                // 架台の振動収束待ち
                await new Promise(resolve => setTimeout(resolve, 4000));

                // 2. 撮影：Plate Solving用の画像を1枚キャプチャ
                setStatus('Solving');
                await AstroService.capturePreview(req.exposure, req.gain, req.offset, true);
                // 露出時間 + 転送のバッファ待機
                await new Promise(resolve => setTimeout(resolve, req.exposure + 2500));

                // 3. 解析：最新のキャンバス画像から座標を取得
                const canvas = document.querySelector('canvas');
                if (!canvas) throw new Error("Canvas element not found for plate solving");
                const imageDataUrl = canvas.toDataURL('image/jpeg', 0.85);

                const result = (req.solverType === 'Local')
                    ? await solveImageLocal(imageDataUrl, req.localSettings.host, req.localSettings.port)
                    : await solveImageAstrometryNet(imageDataUrl, req.apiKey);

                if (!result.success || !result.calibration) {
                    throw new Error(result.error || "Plate solving failed");
                }

                const currentRa = result.calibration.ra;
                const currentDec = result.calibration.dec;
                const error = calculateAngularDistance(targetRa, targetDec, currentRa, currentDec);

                addLog('autoCenter.log.error', { error: error.toFixed(4), current: attempt });

                // 4. 収束判定：許容誤差内なら終了
                if (error <= this.toleranceDegrees) {
                    setStatus('At Target');
                    addLog('logs.slewComplete', { objectName: target.name }, 'success');
                    return;
                }

                // 5. 同期：現在の望遠鏡位置を解析結果で同期（オフセットを赤道儀に教える）
                setStatus('Centering');
                await AstroService.syncToCoordinates(currentRa, currentDec);
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                // 次のループの先頭で、補正されたオフセット込みのターゲット座標へ再導入される
            }

            // 収束しなかった場合
            addLog('autoCenter.error.convergence', {}, 'warning');
            setStatus('Idle');

        } catch (e: any) {
            console.error("AutoCenter Error:", e);
            addLog('autoCenter.error.generic', { message: e.message }, 'error');
            setStatus('Idle');
        } finally {
            this.isRunning = false;
        }
    }

    /**
     * 全てのスルー移動を中止します。
     */
    public static abort() {
        this.isRunning = false;
        AstroService.abortSlew();
    }
}
