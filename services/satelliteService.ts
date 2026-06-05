import { Language } from '../types';

export interface Satellite {
    id: string;
    name: string;
    nameJa: string;
    ra: number;  // Equatorial Coordinate RA in degrees (0 - 360)
    dec: number; // Equatorial Coordinate Dec in degrees (-90 to +90)
    inclination: number; // Orbit inclination
    period: number;      // Orbital period in minutes
    phase: number;       // Orbit phase offset
    visible: boolean;
}

const STORAGE_KEY = 't_astro_satellites_v3';

// 主要な人工衛星のデフォルトリスト（インターネット未接続時・初期エントリ用）
const DEFAULT_SATELLITES: Satellite[] = [
    { id: 'sat_iss', name: 'ISS (ZARYA)', nameJa: '国際宇宙ステーション (ISS)', ra: 0, dec: 0, inclination: 51.64, period: 92.8, phase: 0.1, visible: true },
    { id: 'sat_hst', name: 'Hubble Space Telescope', nameJa: 'ハッブル宇宙望遠鏡 (HST)', ra: 0, dec: 0, inclination: 28.47, period: 95.4, phase: 0.45, visible: true },
    { id: 'sat_starlink_1', name: 'STARLINK-30232', nameJa: 'スターリンク衛星 30232', ra: 0, dec: 0, inclination: 53.0, period: 91.2, phase: 0.7, visible: true },
    { id: 'sat_starlink_2', name: 'STARLINK-30245', nameJa: 'スターリンク衛星 30245', ra: 0, dec: 0, inclination: 53.0, period: 91.2, phase: 0.85, visible: true },
    { id: 'sat_noaa19', name: 'NOAA 19', nameJa: '気象衛星 NOAA-19', ra: 0, dec: 0, inclination: 98.7, period: 102.0, phase: 0.3, visible: true },
    { id: 'sat_tiangong', name: 'Tiangong (CSS)', nameJa: '中国宇宙ステーション (天宮)', ra: 0, dec: 0, inclination: 41.5, period: 91.5, phase: 0.55, visible: true }
];

class SatelliteService {
    private satellites: Satellite[] = [];
    private intervalId: any = null;
    private onUpdateCallback: ((sats: Satellite[]) => void) | null = null;

    constructor() {
        this.loadFromStorage();
    }

    private loadFromStorage() {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                this.satellites = JSON.parse(saved);
            } else {
                this.satellites = [...DEFAULT_SATELLITES];
                this.saveToStorage();
            }
        } catch (e) {
            console.warn("Failed to load satellites from storage, using defaults", e);
            this.satellites = [...DEFAULT_SATELLITES];
        }
    }

    private saveToStorage() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.satellites));
        } catch (e) {
            console.error("Failed to save satellites to storage", e);
        }
    }

    // 最新の人工衛星データベースを取得する関数（Celestrakなどからの取得を模擬・拡張可能）
    public async fetchLatestSatellites(): Promise<Satellite[]> {
        try {
            // Celestrak等のパブリックAPIからの主要衛星TLE取得を想定（CORSなどの制約を考慮し、フェイルセーフとして模擬フェッチを含める）
            // ネット環境がある場合はAPIにアクセスし、最新構造をマージまたは追加する。
            const response = await fetch('https://celestrak.org/NORAD/elements/gp.php?GROUP=visual&FORMAT=json', { signal: AbortSignal.timeout(5000) })
                .then(res => res.json())
                .catch(() => null);

            if (response && Array.isArray(response)) {
                // TLE/GPから最新の衛星データを最大20個程度抽出しマージする
                const fetchedSats: Satellite[] = response.slice(0, 15).map((item, idx) => {
                    const inc = item.INCLINATION || 50.0;
                    const period = item.PERIOD || 90.0;
                    return {
                        id: `sat_fetched_${idx}`,
                        name: item.OBJECT_NAME || `SAT-${item.OBJECT_ID}`,
                        nameJa: item.OBJECT_NAME || `人工衛星-${item.OBJECT_ID}`,
                        ra: 0,
                        dec: 0,
                        inclination: inc,
                        period: period,
                        phase: Math.random(),
                        visible: true
                    };
                });
                
                // 既存のユニークなデータを維持しつつマージ
                const mergedMap = new Map<string, Satellite>();
                this.satellites.forEach(s => mergedMap.set(s.id, s));
                fetchedSats.forEach(s => mergedMap.set(s.id, s));
                this.satellites = Array.from(mergedMap.values());
                this.saveToStorage();
            }
        } catch (err) {
            console.warn("Could not fetch online satellites database (offline mode). Default list used.", err);
        }
        
        this.calculatePositions();
        return this.satellites;
    }

    // 物理的にリアルな衛星の現時点における赤道座標 (RA/Dec) の計算を行います。
    // 衛星はケプラー軌道に近い等速円運動として、傾斜角と経過時間から位置を推算
    public calculatePositions(): Satellite[] {
        const now = Date.now();
        this.satellites = this.satellites.map(sat => {
            // 1分あたりの角速度 (360度 / 周期) 
            const degreesPerSec = 360.0 / (sat.period * 60.0);
            const elapsedSeconds = now / 1000.0;
            
            // 相対的な位相角
            const orbitalAngle = (elapsedSeconds * degreesPerSec + sat.phase * 360) % 360;
            const orbitalAngleRad = (orbitalAngle * Math.PI) / 180.0;
            const incRad = (sat.inclination * Math.PI) / 180.0;
            
            // 地球の中心を原点とした軌道平面上の位置
            const x_orb = Math.cos(orbitalAngleRad);
            const y_orb = Math.sin(orbitalAngleRad);
            
            // 赤道座標系(RA/Dec)への変換
            // Z軸、Y軸を軌道傾斜角(inclination)で回転
            const x_eq = x_orb;
            const y_eq = y_orb * Math.cos(incRad);
            const z_eq = y_orb * Math.sin(incRad);
            
            // 天球投影(RA 0~360度, Dec -90~90度)
            let raDeg = (Math.atan2(y_eq, x_eq) * 180.0) / Math.PI;
            if (raDeg < 0) raDeg += 360.0;
            
            const decDeg = (Math.asin(z_eq) * 180.0) / Math.PI;
            
            return {
                ...sat,
                ra: raDeg,
                dec: decDeg
            };
        });
        
        return this.satellites;
    }

    public getSatellites(): Satellite[] {
        return this.satellites;
    }

    public startUpdateLoop(callback: (sats: Satellite[]) => void) {
        this.onUpdateCallback = callback;
        if (this.intervalId) clearInterval(this.intervalId);
        
        // 人工衛星は高速移動のため、200ms間隔で描画・更新を行います
        this.intervalId = setInterval(() => {
            const updated = this.calculatePositions();
            if (this.onUpdateCallback) {
                this.onUpdateCallback(updated);
            }
        }, 200);
        
        this.fetchLatestSatellites().then(sats => {
            if (this.onUpdateCallback) this.onUpdateCallback(sats);
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

export const satelliteService = new SatelliteService();
