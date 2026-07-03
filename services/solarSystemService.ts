import { CelestialObject } from '../types';
import { degreesToHms, degreesToDms } from '../utils/coords';

export interface SolarSystemObject extends CelestialObject {
    raDeg: number;
    decDeg: number;
    description?: string;
    descriptionJa?: string;
}

// ケプラー軌道要素の定数定義
interface OrbitElements {
    id: string;
    name: string;
    nameJa: string;
    a: number; // 軌道半長径 (AU)
    e: number; // 離心率
    i: number; // 軌道傾角 (degrees)
    L0: number; // J2000での平均黄経 (degrees)
    varpi: number; // 近日点黄経 (degrees)
    Omega: number; // 昇交点黄経 (degrees)
    T: number; // 公転周期 (years)
    baseMag: number; // 標準等級
    color: string; // 描画色
    radius: number; // プラネタリウム描画時の半径
}

const PLANET_ELEMENTS: OrbitElements[] = [
    { id: 'mercury', name: 'Mercury', nameJa: '水星', a: 0.3871, e: 0.2056, i: 7.005, L0: 252.250, varpi: 77.456, Omega: 48.331, T: 0.2408, baseMag: 0.0, color: '#9ca3af', radius: 4 },
    { id: 'venus', name: 'Venus', nameJa: '金星', a: 0.7233, e: 0.0068, i: 3.395, L0: 181.979, varpi: 131.532, Omega: 76.680, T: 0.6152, baseMag: -4.0, color: '#fef08a', radius: 6 },
    { id: 'mars', name: 'Mars', nameJa: '火星', a: 1.5237, e: 0.0934, i: 1.850, L0: 355.453, varpi: 336.041, Omega: 49.578, T: 1.8808, baseMag: -1.0, color: '#f87171', radius: 5 },
    { id: 'jupiter', name: 'Jupiter', nameJa: '木星', a: 5.2034, e: 0.0484, i: 1.303, L0: 34.404, varpi: 14.753, Omega: 100.556, T: 11.8626, baseMag: -2.5, color: '#fdba74', radius: 9 },
    { id: 'saturn', name: 'Saturn', nameJa: '土星', a: 9.5371, e: 0.0541, i: 2.484, L0: 49.944, varpi: 92.431, Omega: 113.715, T: 29.4475, baseMag: 0.4, color: '#fed7aa', radius: 8 },
    { id: 'uranus', name: 'Uranus', nameJa: '天王星', a: 19.1913, e: 0.0473, i: 0.770, L0: 313.232, varpi: 170.964, Omega: 74.229, T: 84.0168, baseMag: 5.7, color: '#a5f3fc', radius: 5 },
    { id: 'neptune', name: 'Neptune', nameJa: '海王星', a: 30.0690, e: 0.0086, i: 1.769, L0: 304.880, varpi: 44.971, Omega: 131.721, T: 164.7913, baseMag: 7.8, color: '#60a5fa', radius: 5 }
];

export class SolarSystemService {
    /**
     * 月と惑星の現在位置を再計算して取得します。
     */
    public calculatePositions(): SolarSystemObject[] {
        const now = Date.now();
        // ユリウス日 (JD) の計算
        const jd = (now / 86400000.0) + 2440587.5;
        // J2000.0からの経過日数 d
        const d = jd - 2451545.0;

        // 赤道傾角 (弧度)
        const eps = (23.4392911 - 0.000000356263 * d) * Math.PI / 180.0;

        const results: SolarSystemObject[] = [];

        // 1. 月の位置計算 (簡易地心黄道座標からの変換)
        const L_moon = (218.316 + 13.176396 * d) % 360;
        const M_moon = (134.963 + 13.064993 * d) % 360;
        const F_moon = (93.272 + 13.229350 * d) % 360;

        const lam_moon = (L_moon + 6.289 * Math.sin(M_moon * Math.PI / 180.0)) * Math.PI / 180.0;
        const bet_moon = (5.128 * Math.sin(F_moon * Math.PI / 180.0)) * Math.PI / 180.0;

        const x_m = Math.cos(bet_moon) * Math.cos(lam_moon);
        const y_m = Math.cos(bet_moon) * Math.sin(lam_moon) * Math.cos(eps) - Math.sin(bet_moon) * Math.sin(eps);
        const z_m = Math.cos(bet_moon) * Math.sin(lam_moon) * Math.sin(eps) + Math.sin(bet_moon) * Math.cos(eps);

        let ra_moon = Math.atan2(y_m, x_m) * 180.0 / Math.PI;
        if (ra_moon < 0) ra_moon += 360.0;
        const dec_moon = Math.asin(z_m) * 180.0 / Math.PI;

        results.push({
            id: 'moon',
            name: 'Moon',
            nameJa: '月',
            type: 'Planet', // Planet型として扱うことで既存UIと調和
            ra: degreesToHms(ra_moon),
            dec: degreesToDms(dec_moon),
            magnitude: -12.0,
            raDeg: ra_moon,
            decDeg: dec_moon,
            color: '#fef3c7',
            size: 8, // 描画時の特別サイズ (以前の30から1/4に変更)
            description: 'The Earth\'s only natural satellite.',
            descriptionJa: '地球唯一の自然衛星であり、最も近い天体です。'
        });

        // 2. 地球の日心位置
        const M_earth = (100.464 + 0.985647 * d - 102.937) * Math.PI / 180.0;
        const e_earth = 0.0167086;
        const v_earth = M_earth + 2.0 * e_earth * Math.sin(M_earth);
        const R_earth = 1.000001018 * (1.0 - e_earth * e_earth) / (1.0 + e_earth * Math.cos(v_earth));
        const theta_earth = v_earth + 102.937 * Math.PI / 180.0;
        
        const x_e = R_earth * Math.cos(theta_earth);
        const y_e = R_earth * Math.sin(theta_earth);

        // 3. 各惑星の位置計算
        for (const p of PLANET_ELEMENTS) {
            const M = (p.L0 + (360.0 / p.T) * (d / 365.25) - p.varpi) * Math.PI / 180.0;
            const v = M + 2.0 * p.e * Math.sin(M);
            const r = p.a * (1.0 - p.e * p.e) / (1.0 + p.e * Math.cos(v));

            const u = v + (p.varpi - p.Omega) * Math.PI / 180.0;
            const inc = p.i * Math.PI / 180.0;
            const node = p.Omega * Math.PI / 180.0;

            const x_hel = r * (Math.cos(u) * Math.cos(node) - Math.sin(u) * Math.sin(node) * Math.cos(inc));
            const y_hel = r * (Math.cos(u) * Math.sin(node) + Math.sin(u) * Math.cos(node) * Math.cos(inc));
            const z_hel = r * (Math.sin(u) * Math.sin(inc));

            // 地心黄道座標
            const x_geo = x_hel - x_e;
            const y_geo = y_hel - y_e;
            const z_geo = z_hel;

            // 地心赤道座標への変換
            const x_eq = x_geo;
            const y_eq = y_geo * Math.cos(eps) - z_geo * Math.sin(eps);
            const z_eq = y_geo * Math.sin(eps) + z_geo * Math.cos(eps);

            const dist = Math.sqrt(x_eq * x_eq + y_eq * y_eq + z_eq * z_eq);
            let ra = Math.atan2(y_eq, x_eq) * 180.0 / Math.PI;
            if (ra < 0) ra += 360.0;
            const dec = Math.asin(z_eq / dist) * 180.0 / Math.PI;

            // 距離に基づき等級を簡易補正
            const phase_corr = p.id === 'mercury' || p.id === 'venus' ? 5 * Math.log10(r * dist) : 5 * Math.log10(r * dist);
            const mag = p.baseMag + phase_corr;

            results.push({
                id: p.id,
                name: p.name,
                nameJa: p.nameJa,
                type: 'Planet',
                ra: degreesToHms(ra),
                dec: degreesToDms(dec),
                magnitude: parseFloat(mag.toFixed(1)),
                raDeg: ra,
                decDeg: dec,
                color: p.color,
                size: p.radius,
                description: `Solar System planet ${p.name}.`,
                descriptionJa: `太陽系の第${PLANET_ELEMENTS.indexOf(p) + (PLANET_ELEMENTS.indexOf(p) >= 2 ? 2 : 1)}惑星「${p.nameJa}」です。`
            });
        }

        return results;
    }
}

export const solarSystemService = new SolarSystemService();
