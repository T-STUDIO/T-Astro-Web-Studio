import { Language } from '../types';

export interface Comet {
    id: string;
    name: string;
    nameJa: string;
    ra: number;       // degrees
    dec: number;      // degrees
    magnitude: number; // estimated visual magnitude
    size: number;     // apparent size in arcminutes
    q: number;        // Perihelion distance (AU)
    e: number;        // Eccentricity
    inclination: number; // Inclination (deg)
    epoch: number;    // Epoch (days/years since standard)
    visible: boolean;
}

const STORAGE_KEY = 't_astro_comets_v3';

// 主要な彗星のデフォルトデータベース
const DEFAULT_COMETS: Comet[] = [
    { id: 'comet_1p_halley', name: '1P/Halley', nameJa: 'ハレー彗星 (1P/Halley)', ra: 142.5, dec: -10.3, magnitude: 15.0, size: 2.0, q: 0.586, e: 0.967, inclination: 162.2, epoch: 1986, visible: true },
    { id: 'comet_c2023_a3', name: 'C/2023 A3 (Tsuchinshan-ATLAS)', nameJa: '紫金山・アトラス彗星 (C/2023 A3)', ra: 245.3, dec: 12.1, magnitude: 8.5, size: 5.0, q: 0.391, e: 1.0002, inclination: 59.3, epoch: 2024, visible: true },
    { id: 'comet_29p', name: '29P/Schwassmann-Wachmann 1', nameJa: 'シュワスマン・ワハマン第1彗星 (29P)', ra: 334.8, dec: -15.4, magnitude: 11.2, size: 1.5, q: 5.72, e: 0.044, inclination: 9.4, epoch: 1902, visible: true },
    { id: 'comet_12p', name: '12P/Pons-Brooks', nameJa: 'ポン・ブルックス彗星 (12P)', ra: 84.1, dec: 28.5, magnitude: 12.0, size: 3.0, q: 0.781, e: 0.955, inclination: 74.2, epoch: 2024, visible: true },
    { id: 'comet_103p', name: '103P/Hartley 2', nameJa: 'ハートレー第2彗星 (103P)', ra: 18.4, dec: 32.7, magnitude: 13.5, size: 2.2, q: 1.059, e: 0.695, inclination: 13.6, epoch: 2023, visible: true }
];

class CometService {
    private comets: Comet[] = [];
    private intervalId: any = null;
    private onUpdateCallback: ((comets: Comet[]) => void) | null = null;

    constructor() {
        this.loadFromStorage();
    }

    private loadFromStorage() {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                this.comets = JSON.parse(saved);
            } else {
                this.comets = [...DEFAULT_COMETS];
                this.saveToStorage();
            }
        } catch (e) {
            console.warn("Failed to load comets from storage, using defaults", e);
            this.comets = [...DEFAULT_COMETS];
        }
    }

    private saveToStorage() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.comets));
        } catch (e) {
            console.error("Failed to save comets to storage", e);
        }
    }

    // 彗星情報の最新データベースを取得（NASA JPL SBDB や MPCなどを考慮したフォールバック検索）
    public async fetchLatestComets(): Promise<Comet[]> {
        try {
            // 国際天文学連合 (IAU) Minor Planet Center 等のデータを想定。
            // CORS やタイムアウトを考慮し耐障害性高く実装。
            const response = await fetch('https://www.minorplanetcenter.net/iau/MPCORB/CometEls.json', { signal: AbortSignal.timeout(5000) })
                .then(res => res.json())
                .catch(() => null);

            if (response && Array.isArray(response)) {
                // 有名な彗星の上位データを抽出
                const fetchedComets: Comet[] = response.slice(0, 10).map((item, idx) => {
                    const q = parseFloat(item.q) || 1.0;
                    const e = parseFloat(item.e) || 0.9;
                    const inc = parseFloat(item.i) || 20.0;
                    // 近日点引数や近日点座標をベースに大まかな経度・緯度にマッピング
                    return {
                        id: `comet_mpc_${idx}`,
                        name: item.Designation || `MPC ${idx}`,
                        nameJa: item.Designation ? `${item.Designation} 彗星` : `MPC 彗星 ${idx}`,
                        ra: (parseFloat(item.Node || '0') + parseFloat(item.Peri || '0')) % 360,
                        dec: (parseFloat(item.i || '0') * 0.9),
                        magnitude: parseFloat(item.g || '10.0') || 10.0,
                        size: 2.0,
                        q: q,
                        e: e,
                        inclination: inc,
                        epoch: parseInt(item.EpochYear) || 2026,
                        visible: true
                    };
                });
                
                // 重複マージ
                const mergedMap = new Map<string, Comet>();
                this.comets.forEach(c => mergedMap.set(c.id, c));
                fetchedComets.forEach(c => mergedMap.set(c.id, c));
                this.comets = Array.from(mergedMap.values());
                this.saveToStorage();
            }
        } catch (err) {
            console.warn("Could not fetch online comets database (offline mode). Default list used.", err);
        }

        this.calculatePositions();
        return this.comets;
    }

    // 軌道モデルに基づいて各彗星のRA/Decを計算
    // 彗星は公転周期が長く、1日の中ではほぼ静止に見えるが、時間の経過とともにわずかに移動する
    public calculatePositions(): Comet[] {
        const now = Date.now();
        // わずかな動き（週単位の移動）をシミュレート
        const days = now / (1000 * 60 * 60 * 24.0);
        
        this.comets = this.comets.map(comet => {
            // 各彗星固有の移動軌跡係数
            const speedCoeff = 0.05 / (comet.q + 0.1); 
            const angle = (days * speedCoeff + (comet.epoch * 123.45)) % 360.0;
            const incRad = (comet.inclination * Math.PI) / 180.0;
            const angleRad = (angle * Math.PI) / 180.0;
            
            const x = Math.cos(angleRad);
            const y = Math.sin(angleRad) * Math.cos(incRad);
            const z = Math.sin(angleRad) * Math.sin(incRad);
            
            let raDeg = (Math.atan2(y, x) * 180.0) / Math.PI;
            if (raDeg < 0) raDeg += 360.0;
            
            const decDeg = (Math.asin(z) * 180.0) / Math.PI;
            
            return {
                ...comet,
                ra: raDeg,
                dec: decDeg
            };
        });
        
        return this.comets;
    }

    public getComets(): Comet[] {
        return this.comets;
    }

    public startUpdateLoop(callback: (comets: Comet[]) => void) {
        this.onUpdateCallback = callback;
        if (this.intervalId) clearInterval(this.intervalId);
        
        // 彗星は低速移動のため、30秒間隔で更新
        this.intervalId = setInterval(() => {
            const updated = this.calculatePositions();
            if (this.onUpdateCallback) {
                this.onUpdateCallback(updated);
            }
        }, 30000);
        
        this.fetchLatestComets().then(comets => {
            if (this.onUpdateCallback) this.onUpdateCallback(comets);
        });
    }

    public stopUpdateLoop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        this.onUpdateCallback = null;
    }
}

export const cometService = new CometService();
