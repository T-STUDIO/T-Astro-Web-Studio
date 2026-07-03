import { CelestialObject, ConnectionStatus, LogEntry } from '../types';
import * as AstroService from './AstroService';
import { satelliteService } from './satelliteService';
import { cometService } from './cometService';
import { solarSystemService } from './solarSystemService';
import { degreesToHms, degreesToDms } from '../utils/coords';

export interface TrackerState {
    isActive: boolean;
    targetId: string | null;
    targetName: string | null;
    raDeg: number;
    decDeg: number;
}

class SatelliteTrackService {
    private intervalId: any = null;
    private state: TrackerState = {
        isActive: false,
        targetId: null,
        targetName: null,
        raDeg: 0,
        decDeg: 0
    };
    private onStateChangeCallback: ((state: TrackerState) => void) | null = null;
    private addLogCallback: ((key: string, substitutions?: any, type?: LogEntry['type']) => void) | null = null;
    private lastCommandTime = 0;

    public registerCallbacks(
        onStateChange: (state: TrackerState) => void,
        addLog: (key: string, substitutions?: any, type?: LogEntry['type']) => void
    ) {
        this.onStateChangeCallback = onStateChange;
        this.addLogCallback = addLog;
    }

    public getState(): TrackerState {
        return this.state;
    }

    /**
     * 追尾ループを開始します。
     * @param targetId 追尾対象の人工衛星、彗星、月、または惑星のID
     */
    public startTracking(targetId: string) {
        if (this.intervalId) {
            this.stopTracking();
        }

        const isSatellite = targetId.startsWith('sat_');
        const isComet = targetId.startsWith('comet_');
        const isSolarSystem = targetId === 'moon' || ['mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune'].includes(targetId);

        if (!isSatellite && !isComet && !isSolarSystem) {
            console.warn("[SatelliteTrackService] Target is not compatible with tracking:", targetId);
            return;
        }

        // 初期情報取得
        let targetName = '';
        let targetNameJa = '';
        if (isSatellite) {
            const sat = satelliteService.getSatellites().find(s => s.id === targetId);
            if (sat) {
                targetName = sat.name;
                targetNameJa = sat.nameJa;
            }
        } else if (isComet) {
            const comet = cometService.getComets().find(c => c.id === targetId);
            if (comet) {
                targetName = comet.name;
                targetNameJa = comet.nameJa;
            }
        } else if (isSolarSystem) {
            const solar = solarSystemService.calculatePositions().find(s => s.id === targetId);
            if (solar) {
                targetName = solar.name;
                targetNameJa = solar.nameJa;
            }
        }

        this.state = {
            isActive: true,
            targetId,
            targetName: targetNameJa || targetName || targetId,
            raDeg: 0,
            decDeg: 0
        };
        this.notifyState();

        if (this.addLogCallback) {
            this.addLogCallback('logs.satelliteTrackStarted', { targetName: this.state.targetName }, 'success');
        }

        // 1秒(1000ms)毎に最新のRA/Decを再計算して架台コマンドを送信
        this.intervalId = setInterval(() => {
            this.executeTrackingStep(targetId);
        }, 1000);

        // 即座に最初のステップを実行
        this.executeTrackingStep(targetId);
    }

    /**
     * 1秒ごとのトラッキングステップ
     */
    private executeTrackingStep(targetId: string) {
        let latestRa = 0;
        let latestDec = 0;

        const isSatellite = targetId.startsWith('sat_');
        const isComet = targetId.startsWith('comet_');
        const isSolarSystem = targetId === 'moon' || ['mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune'].includes(targetId);

        if (isSatellite) {
            // 人工衛星の最新位置を再計算
            const sats = satelliteService.calculatePositions();
            const sat = sats.find(s => s.id === targetId);
            if (sat) {
                latestRa = sat.ra;
                latestDec = sat.dec;
            }
        } else if (isComet) {
            // 彗星の最新位置を再計算
            const comets = cometService.calculatePositions();
            const comet = comets.find(c => c.id === targetId);
            if (comet) {
                latestRa = comet.ra;
                latestDec = comet.dec;
            }
        } else if (isSolarSystem) {
            // 月・太陽系惑星の最新位置を再計算
            const solar = solarSystemService.calculatePositions();
            const obj = solar.find(s => s.id === targetId);
            if (obj) {
                latestRa = obj.raDeg;
                latestDec = obj.decDeg;
            }
        }

        this.state = {
            ...this.state,
            raDeg: latestRa,
            decDec: latestDec // types 互換性のための内部保持
        } as any;
        this.state.raDeg = latestRa;
        this.state.decDeg = latestDec;
        this.notifyState();

        const now = Date.now();
        // 架台へ連続導入コマンド（自動導入）を送信
        // 頻繁すぎると架台通信が詰まる可能性があるため、1秒毎に確実にスルー指示。
        // Simulator/INDI/Alpacaのいずれであっても動作するように CelestialObject を模擬してslewToを叩く
        const mockCelestialObj: CelestialObject = {
            id: targetId,
            name: this.state.targetName || targetId,
            nameJa: this.state.targetName || targetId,
            type: 'Planet', // パースエラーを防ぐために標準の天体タイプを指定
            ra: degreesToHms(latestRa),
            dec: degreesToDms(latestDec),
            magnitude: 10
        };

        // 5秒に1回など頻度を調整して追尾ログを出す
        const shouldLog = (now - this.lastCommandTime) >= 5000;

        if (shouldLog && this.addLogCallback) {
            this.addLogCallback('logs.satelliteTrackTracking', {
                targetName: this.state.targetName,
                ra: mockCelestialObj.ra,
                dec: mockCelestialObj.dec
            });
            this.lastCommandTime = now;
        }

        try {
            // 自動導入コマンド送信
            AstroService.slewTo(mockCelestialObj).catch(err => {
                console.error("[SatelliteTrackService] AstroService.slewTo failed:", err);
            });
        } catch (e) {
            console.error("[SatelliteTrackService] Error in track step:", e);
        }
    }

    /**
     * 追尾ループを停止します。
     */
    public stopTracking() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }

        if (this.state.isActive) {
            if (this.addLogCallback) {
                this.addLogCallback('logs.satelliteTrackStopped', { targetName: this.state.targetName || '' }, 'info');
            }
            this.state = {
                isActive: false,
                targetId: null,
                targetName: null,
                raDeg: 0,
                decDeg: 0
            };
            this.notifyState();
        }
    }

    private notifyState() {
        if (this.onStateChangeCallback) {
            this.onStateChangeCallback({ ...this.state });
        }
    }
}

export const satelliteTrackService = new SatelliteTrackService();
