
import { galacticToRaDec } from './coords';

export interface MilkyWayPoint {
    ra: number;
    dec: number;
    intensity: number; // 0.0 to 1.0
    width?: number; // Size multiplier for cloud effect
}

const generateMilkyWayPoints = (): MilkyWayPoint[] => {
    const points: MilkyWayPoint[] = [];
    const numPoints = 5000; // 高精細化しつつ実用的なパフォーマンスを維持
    
    let seed = 12345; // 再現可能な決定論的乱数
    const random = () => {
        const x = Math.sin(seed++) * 10000;
        return x - Math.floor(x);
    };

    const randGaussian = () => {
        let u = 0, v = 0;
        while(u === 0) u = random(); 
        while(v === 0) v = random();
        return Math.sqrt( -2.0 * Math.log( u ) ) * Math.cos( 2.0 * Math.PI * v );
    };

    // 暗黒星雲（ダストレーン）による透過率(減衰率)を計算する関数
    // 0.0 (完全な暗黒) 〜 1.0 (透明)
    const getDustOpacity = (l: number, b: number): number => {
        // 銀経を -180 ~ 180 に変換 (銀河中心 l=0 を中央にする)
        let lNormalized = l;
        if (lNormalized > 180) lNormalized -= 360;

        // 1. グレート・リフト (はくちょう座〜わし座〜へびつかい座: l = 10 ~ 85)
        // 有機的なうねりを持たせるためのノイズ
        const riftWiggle1 = Math.sin(l * 0.08) * 1.6 + Math.cos(l * 0.18) * 0.7;
        const riftWiggle2 = Math.sin(l * 0.25) * 0.4;
        const riftCenter = riftWiggle1 + riftWiggle2;
        
        if (l > 10 && l < 90) {
            const distToRift = Math.abs(b - riftCenter);
            // 銀経ごとにリフトの幅や濃さを変える
            const riftWidth = 2.5 + Math.sin(l * 0.1) * 1.0;
            if (distToRift < riftWidth) {
                // 中心に近いほど暗く
                const factor = distToRift / riftWidth;
                return 0.05 + 0.95 * Math.pow(factor, 1.5); 
            }
        }

        // 2. 銀河中心部 (いて座バルジ付近の複雑な暗黒帯)
        // バルジの前面を横切る、非対称でうねった暗黒帯
        if (Math.abs(lNormalized) < 25) {
            // バルジを上下に引き裂く、あるいは斜めに走るダスト
            const bulgeRift = -0.5 + Math.sin(lNormalized * 0.15) * 1.5 + (lNormalized * 0.05);
            const distToBulgeRift = Math.abs(b - bulgeRift);
            const bulgeRiftWidth = 1.8 + Math.cos(lNormalized * 0.2) * 0.8;
            if (distToBulgeRift < bulgeRiftWidth) {
                const factor = distToBulgeRift / bulgeRiftWidth;
                return 0.1 + 0.9 * Math.pow(factor, 1.2);
            }
        }

        // 3. コールサック (みなみじゅうじ座付近: l = 300 ~ 305, b = -2 ~ 0)
        if (l >= 300 && l <= 306) {
            const distToCoalsack = Math.sqrt(Math.pow(l - 303, 2) + Math.pow(b + 1, 2));
            if (distToCoalsack < 2.5) {
                return 0.05 + 0.95 * (distToCoalsack / 2.5);
            }
        }

        // 4. その他のランダムなダストパッチ (微細な質感を出すため)
        // 高周波の小さな暗黒斑
        const dustNoise = Math.sin(l * 0.4) * Math.cos(b * 0.4) + Math.sin(l * 1.2 + b * 0.8) * 0.5;
        if (dustNoise > 0.8 && Math.abs(b) < 5) {
            return 0.4 + 0.6 * (1.0 - (dustNoise - 0.8) / 0.7);
        }

        return 1.0;
    };

    // 銀経ごとの天の川自体の明るさの調整
    const getBaseMilkyWayBrightness = (l: number): number => {
        let lNormalized = l;
        if (lNormalized > 180) lNormalized -= 360;

        // いて座バルジ (l=0) - 最大輝度を抑えて白飛びを防ぎ、手前の星の視認性を確保
        const coreGlow = 1.35 * Math.exp(-(lNormalized * lNormalized) / (2 * 32 * 32));
        
        // はくちょう座アーム (l=80)
        const cygnusGlow = 0.7 * Math.exp(-Math.pow(l - 80, 2) / (2 * 18 * 18));

        // カシオペア〜ペルセウス座アーム (l=125) - カシオペア座の天の川を見えやすくするために追加
        const cassiopeiaGlow = 0.65 * Math.exp(-Math.pow(l - 125, 2) / (2 * 22 * 22));
        
        // りゅうこつ座・ほ座アーム (l=290)
        const carinaGlow = 0.8 * Math.exp(-Math.pow(l - 290, 2) / (2 * 20 * 20));
        
        // ぎょしゃ座（反中心部 l=180）に近づくにつれての全体的な減衰を緩和 (最低値を0.35から0.50に引き上げ)
        const distanceFactor = 0.50 + 0.50 * (1.0 - Math.abs(lNormalized) / 180);

        return (0.35 + coreGlow + cygnusGlow + cassiopeiaGlow + carinaGlow) * distanceFactor;
    };

    for (let i = 0; i < numPoints; i++) {
        // 各種レイヤーの生成割合
        // 30% 背景レイヤー (広く、淡い、大きい)
        // 50% 中景レイヤー (普通の広さ、まだら)
        // 20% 微細スタークラスタレイヤー (非常に細かく、明るい)
        const layerRand = random();

        const l = random() * 360;
        let lNormalized = l;
        if (lNormalized > 180) lNormalized -= 360;

        let b = 0;
        let intensity = 1.0;
        let width = 1.0;

        // 基本の輝度スケールを取得
        const baseBrightness = getBaseMilkyWayBrightness(l);

        if (layerRand < 0.30) {
            // --- 1. 背景ガスレイヤー ---
            // 幅広く分布
            b = randGaussian() * 9.0;
            // 大きなサイズ (円状の不自然な重なりを防ぐため適度に小さく滑らかにする)
            width = 1.8 + random() * 1.2;
            // 淡い光 (個々の点を極めて淡くし、多数重ね合わせることでスムーズな連続帯を表現)
            intensity = 0.22 * Math.exp(-(b * b) / (2 * 6.5 * 6.5)) * baseBrightness;
        } 
        else if (layerRand < 0.80) {
            // --- 2. 中景フィラメントレイヤー ---
            // 銀河面により集中
            b = randGaussian() * 4.0;
            
            // バルジ部は縦に膨らませる
            if (Math.abs(lNormalized) < 25) {
                // いて座のバルジ膨らみ
                const bulgeFactor = Math.exp(-(lNormalized * lNormalized) / (2 * 12 * 12));
                if (random() < 0.7 * bulgeFactor) {
                    b = randGaussian() * (4.0 + 8.5 * bulgeFactor);
                }
            }

            // サイズは中程度 (重なりを滑らかにするため縮小)
            width = 0.8 + random() * 0.7;
            // 基本的なガウス分布による減衰
            intensity = 0.45 * Math.exp(-(b * b) / (2 * 3.5 * 3.5)) * baseBrightness;

            // まだらなパッチワーク感(Clumping)を出す
            const patchNoise = Math.sin(l * 0.15 + b * 0.1) * Math.cos(l * 0.08 - b * 0.2);
            intensity *= (0.7 + 0.4 * patchNoise);
        } 
        else {
            // --- 3. 高密度スタークラスタ / 星屑レイヤー ---
            // 銀河面に極めて集中
            b = randGaussian() * 2.2;
            
            // バルジ付近は幅を広げる
            if (Math.abs(lNormalized) < 20) {
                const bulgeFactor = Math.exp(-(lNormalized * lNormalized) / (2 * 10 * 10));
                b = randGaussian() * (2.2 + 4.0 * bulgeFactor);
            }

            // 非常にシャープで小さい (粗い粒を無くし細かな砂嵐状にする)
            width = 0.3 + random() * 0.4;
            // 明るめ
            intensity = 0.65 * Math.exp(-(b * b) / (2 * 1.8 * 1.8)) * baseBrightness;

            // 星の塊のような濃淡
            const clusterNoise = Math.sin(l * 0.8) * Math.sin(b * 1.5) + Math.cos(l * 1.5 - b * 0.7);
            intensity *= (0.5 + 0.5 * Math.max(0, clusterNoise));
        }

        // 暗黒星雲（ダストレーン）による減衰を適用
        const dustOpacity = getDustOpacity(l, b);
        intensity *= dustOpacity;

        // 座標変換
        const { ra, dec } = galacticToRaDec(l, b);

        if (intensity > 0.02) {
            points.push({ 
                ra, 
                dec, 
                intensity: Math.min(1.0, intensity), 
                width
            });
        }
    }

    return points;
};

export const MILKY_WAY_POINTS = generateMilkyWayPoints();
