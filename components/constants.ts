
import { CelestialObject, Constellation } from './types';

// NGC to Messier Mapping for name preference
export const NGC_TO_MESSIER: Record<number, string> = {
    1952: 'M1', 7089: 'M2', 5272: 'M3', 6121: 'M4', 5904: 'M5', 6405: 'M6', 6475: 'M7', 6523: 'M8', 6333: 'M9', 6254: 'M10',
    6705: 'M11', 6218: 'M12', 6205: 'M13', 6402: 'M14', 7078: 'M15', 6611: 'M16', 6618: 'M17', 6613: 'M18', 6273: 'M19', 6514: 'M20',
    6531: 'M21', 6656: 'M22', 6494: 'M23', 6603: 'M24', 4725: 'M25', 6694: 'M26', 6853: 'M27', 6626: 'M28', 6913: 'M29', 7099: 'M30',
    224: 'M31', 221: 'M32', 598: 'M33', 1039: 'M34', 2168: 'M35', 1960: 'M36', 2099: 'M37', 1912: 'M38', 7092: 'M39',
    1976: 'M42', 1982: 'M43', 2632: 'M44', 1432: 'M45', 2437: 'M46', 2422: 'M47', 2548: 'M48', 4472: 'M49', 2323: 'M50',
    5194: 'M51', 7654: 'M52', 5024: 'M53', 6715: 'M54', 6809: 'M55', 6779: 'M56', 6720: 'M57', 4579: 'M58', 4621: 'M59', 4649: 'M60',
    4303: 'M61', 6266: 'M62', 5055: 'M63', 4826: 'M64', 3623: 'M65', 3627: 'M66', 2682: 'M67', 4590: 'M68', 6637: 'M69', 6681: 'M70',
    6838: 'M71', 6981: 'M72', 6994: 'M73', 628: 'M74', 6864: 'M75', 650: 'M76', 1068: 'M77', 2068: 'M78', 1904: 'M79', 6093: 'M80',
    3031: 'M81', 3034: 'M82', 5236: 'M83', 4374: 'M84', 4382: 'M85', 4406: 'M86', 4486: 'M87', 4501: 'M88', 4552: 'M89', 4569: 'M90',
    4548: 'M91', 6341: 'M92', 2447: 'M93', 4736: 'M94', 3351: 'M95', 3368: 'M96', 3587: 'M97', 4192: 'M98', 4254: 'M99', 4321: 'M100',
    5457: 'M101', 5866: 'M102', 581: 'M103', 4594: 'M104', 3379: 'M105', 4258: 'M106', 6171: 'M107', 3556: 'M108', 3992: 'M109', 205: 'M110'
};

// Full Messier Catalog & Key Stars
export const CELESTIAL_OBJECTS: CelestialObject[] = [
  // --- Solar System ---
  { id: 'jupiter', name: 'Jupiter', nameJa: '木星', type: 'Planet', ra: 'Dynamic', dec: 'Dynamic', magnitude: -2.5, image: 'https://images.unsplash.com/photo-1614730341194-75c60740a2d3', blurryImage: '', annotations: [] },
  { id: 'saturn', name: 'Saturn', nameJa: '土星', type: 'Planet', ra: 'Dynamic', dec: 'Dynamic', magnitude: 0.5, image: 'https://images.unsplash.com/photo-1614732414444-096e6f580261', blurryImage: '', annotations: [] },

  // --- MESSIER CATALOG (Complete) ---
  { id: 'm1', name: 'M1', nameJa: 'かに星雲 (M1)', type: 'Nebula', ra: '05h 34m 32s', dec: '+22° 00′ 52″', magnitude: 8.4, size: 6 },
  { id: 'm2', name: 'M2', nameJa: 'M2', type: 'Star Cluster', ra: '21h 33m 27s', dec: '-00° 49′ 24″', magnitude: 6.3, size: 16 },
  { id: 'm3', name: 'M3', nameJa: 'M3', type: 'Star Cluster', ra: '13h 42m 11s', dec: '+28° 22′ 38″', magnitude: 6.2, size: 18 },
  { id: 'm4', name: 'M4', nameJa: 'M4', type: 'Star Cluster', ra: '16h 23m 35s', dec: '-26° 31′ 32″', magnitude: 5.9, size: 26 },
  { id: 'm5', name: 'M5', nameJa: 'M5', type: 'Star Cluster', ra: '15h 18m 33s', dec: '+02° 04′ 51″', magnitude: 5.6, size: 23 },
  { id: 'm6', name: 'M6', nameJa: 'バタフライ星団 (M6)', type: 'Star Cluster', ra: '17h 40m 18s', dec: '-32° 13′ 00″', magnitude: 4.2, size: 33 },
  { id: 'm7', name: 'M7', nameJa: 'トレミー星団 (M7)', type: 'Star Cluster', ra: '17h 53m 51s', dec: '-34° 49′ 00″', magnitude: 3.3, size: 80 },
  { id: 'm8', name: 'M8', nameJa: '干潟星雲 (M8)', type: 'Nebula', ra: '18h 03m 37s', dec: '-24° 23′ 12″', magnitude: 6.0, size: 90 },
  { id: 'm9', name: 'M9', nameJa: 'M9', type: 'Star Cluster', ra: '17h 19m 11s', dec: '-18° 30′ 59″', magnitude: 7.7, size: 12 },
  { id: 'm10', name: 'M10', nameJa: 'M10', type: 'Star Cluster', ra: '16h 57m 09s', dec: '-04° 06′ 01″', magnitude: 6.4, size: 20 },
  { id: 'm11', name: 'M11', nameJa: '野鴨星団 (M11)', type: 'Star Cluster', ra: '18h 51m 05s', dec: '-06° 16′ 12″', magnitude: 6.3, size: 14 },
  { id: 'm12', name: 'M12', nameJa: 'M12', type: 'Star Cluster', ra: '16h 47m 14s', dec: '-01° 56′ 54″', magnitude: 6.7, size: 16 },
  { id: 'm13', name: 'M13', nameJa: 'ヘルクレス座球状星団 (M13)', type: 'Star Cluster', ra: '16h 41m 41s', dec: '+36° 27′ 35″', magnitude: 5.8, size: 20 },
  { id: 'm14', name: 'M14', nameJa: 'M14', type: 'Star Cluster', ra: '17h 37m 36s', dec: '-03° 14′ 45″', magnitude: 7.6, size: 11 },
  { id: 'm15', name: 'M15', nameJa: 'M15', type: 'Star Cluster', ra: '21h 29m 58s', dec: '+12° 10′ 01″', magnitude: 6.2, size: 18 },
  { id: 'm16', name: 'M16', nameJa: 'わし星雲 (M16)', type: 'Nebula', ra: '18h 18m 48s', dec: '-13° 49′ 00″', magnitude: 6.4, size: 7 },
  { id: 'm17', name: 'M17', nameJa: 'オメガ星雲 (M17)', type: 'Nebula', ra: '18h 20m 26s', dec: '-16° 10′ 36″', magnitude: 6.0, size: 11 },
  { id: 'm18', name: 'M18', nameJa: 'M18', type: 'Star Cluster', ra: '18h 19m 54s', dec: '-17° 08′ 00″', magnitude: 7.5, size: 9 },
  { id: 'm19', name: 'M19', nameJa: 'M19', type: 'Star Cluster', ra: '17h 02m 37s', dec: '-26° 16′ 05″', magnitude: 6.8, size: 17 },
  { id: 'm20', name: 'M20', nameJa: '三裂星雲 (M20)', type: 'Nebula', ra: '18h 02m 23s', dec: '-23° 01′ 48″', magnitude: 6.3, size: 28 },
  { id: 'm21', name: 'M21', nameJa: 'M21', type: 'Star Cluster', ra: '18h 04m 36s', dec: '-22° 30′ 00″', magnitude: 6.5, size: 13 },
  { id: 'm22', name: 'M22', nameJa: 'M22', type: 'Star Cluster', ra: '18h 36m 23s', dec: '-23° 54′ 17″', magnitude: 5.1, size: 32 },
  { id: 'm23', name: 'M23', nameJa: 'M23', type: 'Star Cluster', ra: '17h 56m 48s', dec: '-19° 01′ 00″', magnitude: 6.9, size: 27 },
  { id: 'm24', name: 'M24', nameJa: 'スタークラウド (M24)', type: 'Star Cluster', ra: '18h 17m 00s', dec: '-18° 33′ 00″', magnitude: 4.6, size: 90 },
  { id: 'm25', name: 'M25', nameJa: 'M25', type: 'Star Cluster', ra: '18h 31m 30s', dec: '-19° 15′ 00″', magnitude: 4.6, size: 32 },
  { id: 'm26', name: 'M26', nameJa: 'M26', type: 'Star Cluster', ra: '18h 45m 12s', dec: '-09° 24′ 00″', magnitude: 8.0, size: 15 },
  { id: 'm27', name: 'M27', nameJa: '亜鈴状星雲 (M27)', type: 'Nebula', ra: '19h 59m 36s', dec: '+22° 43′ 16″', magnitude: 7.5, size: 8 },
  { id: 'm28', name: 'M28', nameJa: 'M28', type: 'Star Cluster', ra: '18h 24m 32s', dec: '-24° 52′ 11″', magnitude: 6.8, size: 11 },
  { id: 'm29', name: 'M29', nameJa: 'M29', type: 'Star Cluster', ra: '20h 23m 56s', dec: '+38° 31′ 24″', magnitude: 7.1, size: 7 },
  { id: 'm30', name: 'M30', nameJa: 'M30', type: 'Star Cluster', ra: '21h 40m 22s', dec: '-23° 10′ 47″', magnitude: 7.2, size: 12 },
  { id: 'm31', name: 'M31', nameJa: 'アンドロメダ銀河 (M31)', type: 'Galaxy', ra: '00h 42m 44s', dec: '+41° 16′ 09″', magnitude: 3.4, size: 190 },
  { id: 'm32', name: 'M32', nameJa: 'M32', type: 'Galaxy', ra: '00h 42m 41s', dec: '+40° 51′ 55″', magnitude: 8.1, size: 8 },
  { id: 'm33', name: 'M33', nameJa: 'さんかく座銀河 (M33)', type: 'Galaxy', ra: '01h 33m 50s', dec: '+30° 39′ 36″', magnitude: 5.7, size: 70 },
  { id: 'm34', name: 'M34', nameJa: 'M34', type: 'Star Cluster', ra: '02h 42m 00s', dec: '+42° 47′ 00″', magnitude: 5.5, size: 35 },
  { id: 'm35', name: 'M35', nameJa: 'M35', type: 'Star Cluster', ra: '06h 08m 54s', dec: '+24° 20′ 00″', magnitude: 5.3, size: 28 },
  { id: 'm36', name: 'M36', nameJa: 'M36', type: 'Star Cluster', ra: '05h 36m 12s', dec: '+34° 08′ 24″', magnitude: 6.3, size: 12 },
  { id: 'm37', name: 'M37', nameJa: 'M37', type: 'Star Cluster', ra: '05h 52m 18s', dec: '+32° 33′ 00″', magnitude: 6.2, size: 24 },
  { id: 'm38', name: 'M38', nameJa: 'M38', type: 'Star Cluster', ra: '05h 28m 42s', dec: '+35° 50′ 00″', magnitude: 7.4, size: 21 },
  { id: 'm39', name: 'M39', nameJa: 'M39', type: 'Star Cluster', ra: '21h 32m 12s', dec: '+48° 26′ 00″', magnitude: 4.6, size: 32 },
  { id: 'm40', name: 'M40', nameJa: 'M40 (二重星)', type: 'Star', ra: '12h 22m 12s', dec: '+58° 05′ 00″', magnitude: 8.4, size: 1 },
  { id: 'm41', name: 'M41', nameJa: 'M41', type: 'Star Cluster', ra: '06h 45m 59s', dec: '-20° 44′ 00″', magnitude: 4.5, size: 38 },
  { id: 'm42', name: 'M42', nameJa: 'オリオン大星雲 (M42)', type: 'Nebula', ra: '05h 35m 17s', dec: '-05° 23′ 28″', magnitude: 4.0, size: 65 },
  { id: 'm43', name: 'M43', nameJa: 'M43', type: 'Nebula', ra: '05h 35m 31s', dec: '-05° 16′ 12″', magnitude: 9.0, size: 20 },
  { id: 'm44', name: 'M44', nameJa: 'プレセペ星団 (M44)', type: 'Star Cluster', ra: '08h 40m 24s', dec: '+19° 40′ 00″', magnitude: 3.7, size: 95 },
  { id: 'm45', name: 'M45', nameJa: 'プレアデス星団 (M45)', type: 'Star Cluster', ra: '03h 47m 24s', dec: '+24° 07′ 00″', magnitude: 1.6, size: 110 },
  { id: 'm46', name: 'M46', nameJa: 'M46', type: 'Star Cluster', ra: '07h 41m 42s', dec: '-14° 49′ 00″', magnitude: 6.0, size: 27 },
  { id: 'm47', name: 'M47', nameJa: 'M47', type: 'Star Cluster', ra: '07h 36m 36s', dec: '-14° 30′ 00″', magnitude: 5.2, size: 30 },
  { id: 'm48', name: 'M48', nameJa: 'M48', type: 'Star Cluster', ra: '08h 13m 42s', dec: '-05° 48′ 00″', magnitude: 5.5, size: 54 },
  { id: 'm49', name: 'M49', nameJa: 'M49', type: 'Galaxy', ra: '12h 29m 46s', dec: '+08° 00′ 02″', magnitude: 8.4, size: 10 },
  { id: 'm50', name: 'M50', nameJa: 'M50', type: 'Star Cluster', ra: '07h 03m 12s', dec: '-08° 20′ 00″', magnitude: 5.9, size: 16 },
  { id: 'm51', name: 'M51', nameJa: '子持ち銀河 (M51)', type: 'Galaxy', ra: '13h 29m 52s', dec: '+47° 11′ 43″', magnitude: 8.4, size: 11 },
  { id: 'm52', name: 'M52', nameJa: 'M52', type: 'Star Cluster', ra: '23h 24m 48s', dec: '+61° 35′ 00″', magnitude: 7.3, size: 13 },
  { id: 'm53', name: 'M53', nameJa: 'M53', type: 'Star Cluster', ra: '13h 12m 55s', dec: '+18° 10′ 05″', magnitude: 7.6, size: 13 },
  { id: 'm54', name: 'M54', nameJa: 'M54', type: 'Star Cluster', ra: '18h 55m 03s', dec: '-30° 28′ 47″', magnitude: 7.6, size: 12 },
  { id: 'm55', name: 'M55', nameJa: 'M55', type: 'Star Cluster', ra: '19h 39m 59s', dec: '-30° 57′ 53″', magnitude: 6.3, size: 19 },
  { id: 'm56', name: 'M56', nameJa: 'M56', type: 'Star Cluster', ra: '19h 16m 35s', dec: '+30° 11′ 00″', magnitude: 8.3, size: 9 },
  { id: 'm57', name: 'M57', nameJa: '環状星雲 (M57)', type: 'Nebula', ra: '18h 53m 35s', dec: '+33° 01′ 45″', magnitude: 8.8, size: 1.4 },
  { id: 'm58', name: 'M58', nameJa: 'M58', type: 'Galaxy', ra: '12h 37m 43s', dec: '+11° 49′ 05″', magnitude: 9.7, size: 6 },
  { id: 'm59', name: 'M59', nameJa: 'M59', type: 'Galaxy', ra: '12h 42m 02s', dec: '+11° 38′ 49″', magnitude: 9.6, size: 5 },
  { id: 'm60', name: 'M60', nameJa: 'M60', type: 'Galaxy', ra: '12h 43m 39s', dec: '+11° 33′ 09″', magnitude: 8.8, size: 7 },
  { id: 'm61', name: 'M61', nameJa: 'M61', type: 'Galaxy', ra: '12h 21m 54s', dec: '+04° 28′ 25″', magnitude: 9.7, size: 6 },
  { id: 'm62', name: 'M62', nameJa: 'M62', type: 'Star Cluster', ra: '17h 01m 12s', dec: '-30° 06′ 44″', magnitude: 6.5, size: 15 },
  { id: 'm63', name: 'M63', nameJa: 'ひまわり銀河 (M63)', type: 'Galaxy', ra: '13h 15m 49s', dec: '+42° 01′ 45″', magnitude: 8.6, size: 10 },
  { id: 'm64', name: 'M64', nameJa: '黒眼銀河 (M64)', type: 'Galaxy', ra: '12h 56m 43s', dec: '+21° 40′ 58″', magnitude: 8.5, size: 10 },
  { id: 'm65', name: 'M65', nameJa: 'M65', type: 'Galaxy', ra: '11h 18m 55s', dec: '+13° 05′ 32″', magnitude: 9.3, size: 9 },
  { id: 'm66', name: 'M66', nameJa: 'M66', type: 'Galaxy', ra: '11h 20m 15s', dec: '+12° 59′ 30″', magnitude: 8.9, size: 9 },
  { id: 'm67', name: 'M67', nameJa: 'M67', type: 'Star Cluster', ra: '08h 51m 18s', dec: '+11° 49′ 00″', magnitude: 6.1, size: 30 },
  { id: 'm68', name: 'M68', nameJa: 'M68', type: 'Star Cluster', ra: '12h 39m 27s', dec: '-26° 44′ 38″', magnitude: 7.8, size: 11 },
  { id: 'm69', name: 'M69', nameJa: 'M69', type: 'Star Cluster', ra: '18h 31m 23s', dec: '-32° 20′ 53″', magnitude: 7.6, size: 10 },
  { id: 'm70', name: 'M70', nameJa: 'M70', type: 'Star Cluster', ra: '18h 43m 12s', dec: '-32° 17′ 31″', magnitude: 7.9, size: 8 },
  { id: 'm71', name: 'M71', nameJa: 'M71', type: 'Star Cluster', ra: '19h 53m 46s', dec: '+18° 46′ 45″', magnitude: 8.2, size: 7 },
  { id: 'm72', name: 'M72', nameJa: 'M72', type: 'Star Cluster', ra: '20h 53m 27s', dec: '-12° 32′ 14″', magnitude: 9.3, size: 7 },
  { id: 'm73', name: 'M73', nameJa: 'M73', type: 'Star Cluster', ra: '20h 58m 54s', dec: '-12° 38′ 00″', magnitude: 9.0, size: 3 },
  { id: 'm74', name: 'M74', nameJa: 'M74', type: 'Galaxy', ra: '01h 36m 41s', dec: '+15° 47′ 01″', magnitude: 9.4, size: 10 },
  { id: 'm75', name: 'M75', nameJa: 'M75', type: 'Star Cluster', ra: '20h 06m 04s', dec: '-21° 55′ 16″', magnitude: 8.5, size: 7 },
  { id: 'm76', name: 'M76', nameJa: '小亜鈴状星雲 (M76)', type: 'Nebula', ra: '01h 42m 19s', dec: '+51° 34′ 31″', magnitude: 10.1, size: 2.7 },
  { id: 'm77', name: 'M77', nameJa: 'M77', type: 'Galaxy', ra: '02h 42m 40s', dec: '-00° 00′ 48″', magnitude: 8.9, size: 7 },
  { id: 'm78', name: 'M78', nameJa: 'M78', type: 'Nebula', ra: '05h 46m 46s', dec: '+00° 04′ 48″', magnitude: 8.3, size: 8 },
  { id: 'm79', name: 'M79', nameJa: 'M79', type: 'Star Cluster', ra: '05h 24m 10s', dec: '-24° 31′ 27″', magnitude: 7.7, size: 9 },
  { id: 'm80', name: 'M80', nameJa: 'M80', type: 'Star Cluster', ra: '16h 17m 02s', dec: '-22° 58′ 33″', magnitude: 7.3, size: 10 },
  { id: 'm81', name: 'M81', nameJa: 'ボーデの銀河 (M81)', type: 'Galaxy', ra: '09h 55m 33s', dec: '+69° 03′ 55″', magnitude: 6.9, size: 26 },
  { id: 'm82', name: 'M82', nameJa: '葉巻銀河 (M82)', type: 'Galaxy', ra: '09h 55m 52s', dec: '+69° 40′ 47″', magnitude: 8.4, size: 11 },
  { id: 'm83', name: 'M83', nameJa: '南の回転花火銀河 (M83)', type: 'Galaxy', ra: '13h 37m 00s', dec: '-29° 51′ 57″', magnitude: 7.6, size: 13 },
  { id: 'm84', name: 'M84', nameJa: 'M84', type: 'Galaxy', ra: '12h 25m 03s', dec: '+12° 53′ 13″', magnitude: 9.1, size: 6 },
  { id: 'm85', name: 'M85', nameJa: 'M85', type: 'Galaxy', ra: '12h 25m 24s', dec: '+18° 11′ 28″', magnitude: 9.1, size: 7 },
  { id: 'm86', name: 'M86', nameJa: 'M86', type: 'Galaxy', ra: '12h 26m 11s', dec: '+12° 56′ 46″', magnitude: 8.9, size: 9 },
  { id: 'm87', name: 'M87', nameJa: 'M87', type: 'Galaxy', ra: '12h 30m 49s', dec: '+12° 23′ 28″', magnitude: 8.6, size: 8 },
  { id: 'm88', name: 'M88', nameJa: 'M88', type: 'Galaxy', ra: '12h 31m 59s', dec: '+14° 25′ 14″', magnitude: 9.6, size: 7 },
  { id: 'm89', name: 'M89', nameJa: 'M89', type: 'Galaxy', ra: '12h 35m 39s', dec: '+12° 33′ 23″', magnitude: 9.8, size: 5 },
  { id: 'm90', name: 'M90', nameJa: 'M90', type: 'Galaxy', ra: '12h 36m 49s', dec: '+13° 09′ 46″', magnitude: 9.5, size: 10 },
  { id: 'm91', name: 'M91', nameJa: 'M91', type: 'Galaxy', ra: '12h 35m 26s', dec: '+14° 29′ 47″', magnitude: 10.2, size: 5 },
  { id: 'm92', name: 'M92', nameJa: 'M92', type: 'Star Cluster', ra: '17h 17m 07s', dec: '+43° 08′ 09″', magnitude: 6.3, size: 14 },
  { id: 'm93', name: 'M93', nameJa: 'M93', type: 'Star Cluster', ra: '07h 44m 30s', dec: '-23° 51′ 00″', magnitude: 6.0, size: 22 },
  { id: 'm94', name: 'M94', nameJa: 'M94', type: 'Galaxy', ra: '12h 50m 53s', dec: '+41° 07′ 14″', magnitude: 8.2, size: 11 },
  { id: 'm95', name: 'M95', nameJa: 'M95', type: 'Galaxy', ra: '10h 43m 57s', dec: '+11° 42′ 14″', magnitude: 9.7, size: 7 },
  { id: 'm96', name: 'M96', nameJa: 'M96', type: 'Galaxy', ra: '10h 46m 45s', dec: '+11° 49′ 12″', magnitude: 9.3, size: 8 },
  { id: 'm97', name: 'M97', nameJa: 'ふくろう星雲 (M97)', type: 'Nebula', ra: '11h 14m 47s', dec: '+55° 01′ 08″', magnitude: 9.9, size: 3 },
  { id: 'm98', name: 'M98', nameJa: 'M98', type: 'Galaxy', ra: '12h 13m 48s', dec: '+14° 54′ 01″', magnitude: 10.1, size: 10 },
  { id: 'm99', name: 'M99', nameJa: 'M99', type: 'Galaxy', ra: '12h 18m 49s', dec: '+14° 24′ 59″', magnitude: 9.9, size: 5 },
  { id: 'm100', name: 'M100', nameJa: 'M100', type: 'Galaxy', ra: '12h 22m 54s', dec: '+15° 49′ 21″', magnitude: 9.3, size: 7 },
  { id: 'm101', name: 'M101', nameJa: '回転花火銀河 (M101)', type: 'Galaxy', ra: '14h 03m 12s', dec: '+54° 20′ 57″', magnitude: 7.9, size: 29 },
  { id: 'm102', name: 'M102', nameJa: 'M102 (NGC 5866)', type: 'Galaxy', ra: '15h 06m 29s', dec: '+55° 45′ 48″', magnitude: 9.9, size: 5 },
  { id: 'm103', name: 'M103', nameJa: 'M103', type: 'Star Cluster', ra: '01h 33m 24s', dec: '+60° 39′ 00″', magnitude: 7.4, size: 6 },
  { id: 'm104', name: 'M104', nameJa: 'ソンブレロ銀河 (M104)', type: 'Galaxy', ra: '12h 39m 59s', dec: '-11° 37′ 23″', magnitude: 8.0, size: 8 },
  { id: 'm105', name: 'M105', nameJa: 'M105', type: 'Galaxy', ra: '10h 47m 49s', dec: '+12° 34′ 54″', magnitude: 9.3, size: 5 },
  { id: 'm106', name: 'M106', nameJa: 'M106', type: 'Galaxy', ra: '12h 18m 57s', dec: '+47° 18′ 14″', magnitude: 8.4, size: 18 },
  { id: 'm107', name: 'M107', nameJa: 'M107', type: 'Star Cluster', ra: '16h 32m 31s', dec: '-13° 03′ 13″', magnitude: 7.9, size: 13 },
  { id: 'm108', name: 'M108', nameJa: 'M108', type: 'Galaxy', ra: '11h 11m 31s', dec: '+55° 40′ 27″', magnitude: 10.0, size: 9 },
  { id: 'm109', name: 'M109', nameJa: 'M109', type: 'Galaxy', ra: '11h 57m 35s', dec: '+53° 22′ 28″', magnitude: 9.8, size: 8 },
  { id: 'm110', name: 'M110', nameJa: 'M110', type: 'Galaxy', ra: '00h 40m 22s', dec: '+41° 41′ 07″', magnitude: 8.5, size: 17 },
  
  { id: 'double_cluster', name: 'Double Cluster', nameJa: '二重星団 (h-χ)', type: 'Star Cluster', ra: '02h 20m 00s', dec: '+57° 08′ 00″', magnitude: 3.7, size: 60, image: '', blurryImage: '', annotations: [] },

  // --- STARS (Standard 88 Constellations Support) ---
  // Ursa Major
  { id: 'dubhe', name: 'Dubhe', nameJa: 'ドゥーベ', type: 'Star', ra: '11h 03m 43s', dec: '+61° 45′ 04″', magnitude: 1.79, color: '#FFD1A3' },
  { id: 'merak', name: 'Merak', nameJa: 'メラク', type: 'Star', ra: '11h 01m 50s', dec: '+56° 22′ 57″', magnitude: 2.37, color: '#FFFFFF' },
  { id: 'phecda', name: 'Phecda', nameJa: 'フェクダ', type: 'Star', ra: '11h 53m 49s', dec: '+53° 41′ 41″', magnitude: 2.44, color: '#E0EBFF' },
  { id: 'megrez', name: 'Megrez', nameJa: 'メグレス', type: 'Star', ra: '12h 15m 25s', dec: '+57° 01′ 57″', magnitude: 3.31, color: '#CAD7FF' },
  { id: 'alioth', name: 'Alioth', nameJa: 'アリオト', type: 'Star', ra: '12h 54m 01s', dec: '+55° 57′ 35″', magnitude: 1.77, color: '#E0EBFF' },
  { id: 'mizar', name: 'Mizar', nameJa: 'ミザール', type: 'Star', ra: '13h 23m 55s', dec: '+54° 55′ 31″', magnitude: 2.27, color: '#CAD7FF' },
  { id: 'alkaid', name: 'Alkaid', nameJa: 'アルカイド', type: 'Star', ra: '13h 47m 32s', dec: '+49° 18′ 48″', magnitude: 1.86, color: '#99CCFF' },
  { id: 'muscida', name: 'Muscida', nameJa: 'ムシダ', type: 'Star', ra: '08h 30m 16s', dec: '+60° 43′ 05″', magnitude: 3.35, color: '#FFF4E8' },
  { id: 'talitha', name: 'Talitha', nameJa: 'タリタ', type: 'Star', ra: '08h 59m 12s', dec: '+48° 02′ 32″', magnitude: 3.14, color: '#FBF8FF' },
  { id: 'tania_borealis', name: 'Tania Borealis', nameJa: 'タニア・ボレアリス', type: 'Star', ra: '10h 17m 06s', dec: '+42° 54′ 52″', magnitude: 3.45, color: '#E0EBFF' },
  { id: 'tania_australis', name: 'Tania Australis', nameJa: 'タニア・アウストラリス', type: 'Star', ra: '10h 22m 19s', dec: '+41° 29′ 58″', magnitude: 3.06, color: '#FFD2A1' },
  { id: 'alula_borealis', name: 'Alula Borealis', nameJa: 'アルラ・ボレアリス', type: 'Star', ra: '11h 18m 29s', dec: '+33° 05′ 39″', magnitude: 3.49, color: '#FFD1A3' },
  { id: 'alula_australis', name: 'Alula Australis', nameJa: 'アルラ・アウストラリス', type: 'Star', ra: '11h 09m 40s', dec: '+30° 29′ 59″', magnitude: 3.79, color: '#FFF4E8' },
  { id: 'psi_uma', name: 'Psi UMa', nameJa: 'ψ UMa', type: 'Star', ra: '11h 09m 39s', dec: '+44° 29′ 54″', magnitude: 3.01, color: '#FFD1A3' },
  { id: 'theta_uma', name: 'Theta UMa', nameJa: 'θ UMa', type: 'Star', ra: '09h 32m 52s', dec: '+51° 40′ 43″', magnitude: 3.17, color: '#FBF8FF' },
  { id: 'iota_uma', name: 'Iota UMa', nameJa: 'ι UMa', type: 'Star', ra: '08h 59m 12s', dec: '+48° 02′ 30″', magnitude: 3.12, color: '#FFF4E8' }, 
  { id: 'kappa_uma', name: 'Kappa UMa', nameJa: 'κ UMa', type: 'Star', ra: '09h 03m 38s', dec: '+47° 09′ 24″', magnitude: 3.57, color: '#E0EBFF' },
  { id: 'lambda_uma', name: 'Lambda UMa', nameJa: 'λ UMa', type: 'Star', ra: '10h 17m 05s', dec: '+42° 54′ 52″', magnitude: 3.45, color: '#E0EBFF' },
  { id: 'mu_uma', name: 'Mu UMa', nameJa: 'μ UMa', type: 'Star', ra: '10h 22m 20s', dec: '+41° 29′ 58″', magnitude: 3.06, color: '#FF9980' },
  { id: 'nu_uma', name: 'Nu UMa', nameJa: 'ν UMa', type: 'Star', ra: '11h 18m 28s', dec: '+33° 05′ 39″', magnitude: 3.49, color: '#FFD1A3' },
  { id: 'chi_uma', name: 'Chi UMa', nameJa: 'χ UMa', type: 'Star', ra: '11h 46m 03s', dec: '+47° 46′ 45″', magnitude: 3.69, color: '#FFD1A3' },
  { id: '23_uma', name: 'h UMa', nameJa: 'h UMa', type: 'Star', ra: '09h 31m 32s', dec: '+63° 03′ 42″', magnitude: 3.65, color: '#FBF8FF' },
  { id: 'upsilon_uma', name: 'Upsilon UMa', nameJa: 'υ UMa', type: 'Star', ra: '09h 50m 59s', dec: '+59° 02′ 20″', magnitude: 3.78, color: '#FBF8FF' },

  // Ursa Minor
  { id: 'polaris', name: 'Polaris', nameJa: 'ポラリス (北極星)', type: 'Star', ra: '02h 31m 49s', dec: '+89° 15′ 51″', magnitude: 1.98, color: '#FBF8FF' },
  { id: 'kochab', name: 'Kochab', nameJa: 'コカブ', type: 'Star', ra: '14h 50m 42s', dec: '+74° 09′ 20″', magnitude: 2.08, color: '#FFD1A3' },
  { id: 'pherkad', name: 'Pherkad', nameJa: 'フェルカド', type: 'Star', ra: '15h 20m 43s', dec: '+71° 50′ 02″', magnitude: 3.05, color: '#CAD7FF' },
  { id: 'delta_umi', name: 'Yildun', nameJa: 'イルドゥン', type: 'Star', ra: '17h 32m 13s', dec: '+86° 35′ 11″', magnitude: 4.35, color: '#E0EBFF' },
  { id: 'epsilon_umi', name: 'Epsilon UMi', nameJa: 'ε UMi', type: 'Star', ra: '16h 45m 58s', dec: '+82° 02′ 14″', magnitude: 4.21, color: '#FFF4E8' },
  { id: 'zeta_umi', name: 'Ahfa al Farkadain', nameJa: 'ζ UMi', type: 'Star', ra: '15h 44m 03s', dec: '+77° 47′ 40″', magnitude: 4.29, color: '#CAD7FF' },
  { id: 'eta_umi', name: 'Anwar al Farkadain', nameJa: 'η UMi', type: 'Star', ra: '16h 17m 30s', dec: '+75° 45′ 19″', magnitude: 4.95, color: '#FBF8FF' },

  // Cassiopeia
  { id: 'schedar', name: 'Schedar', nameJa: 'シェダル', type: 'Star', ra: '00h 40m 30s', dec: '+56° 32′ 14″', magnitude: 2.25, color: '#FFD1A3' },
  { id: 'caph', name: 'Caph', nameJa: 'カフ', type: 'Star', ra: '00h 09m 10s', dec: '+59° 08′ 59″', magnitude: 2.27, color: '#FBF8FF' },
  { id: 'gamma_cas', name: 'Gamma Cas', nameJa: 'ツィー', type: 'Star', ra: '00h 56m 42s', dec: '+60° 43′ 00″', magnitude: 2.15, color: '#99CCFF' },
  { id: 'ruchbah', name: 'Ruchbah', nameJa: 'ルクバー', type: 'Star', ra: '01h 25m 48s', dec: '+60° 14′ 07″', magnitude: 2.68, color: '#CAD7FF' },
  { id: 'segin', name: 'Segin', nameJa: 'セギン', type: 'Star', ra: '01h 54m 23s', dec: '+63° 40′ 12″', magnitude: 3.37, color: '#99CCFF' },

  // Orion
  { id: 'rigel', name: 'Rigel', nameJa: 'リゲル', type: 'Star', ra: '05h 14m 32s', dec: '-08° 12′ 06″', magnitude: 0.13, color: '#99CCFF' },
  { id: 'betelgeuse', name: 'Betelgeuse', nameJa: 'ベテルギウス', type: 'Star', ra: '05h 55m 10s', dec: '+07° 24′ 25″', magnitude: 0.5, color: '#FFB870' },
  { id: 'bellatrix', name: 'Bellatrix', nameJa: 'ベラトリックス', type: 'Star', ra: '05h 25m 07s', dec: '+06° 20′ 59″', magnitude: 1.64, color: '#B3CFFF' },
  { id: 'saiph', name: 'Saiph', nameJa: 'サイフ', type: 'Star', ra: '05h 47m 45s', dec: '-09° 40′ 10″', magnitude: 2.09, color: '#99CCFF' },
  { id: 'alnitak', name: 'Alnitak', nameJa: 'アルニタク', type: 'Star', ra: '05h 40m 45s', dec: '-01° 56′ 34″', magnitude: 1.74, color: '#99CCFF' },
  { id: 'alnilam', name: 'Alnilam', nameJa: 'アルニラム', type: 'Star', ra: '05h 36m 12s', dec: '-01° 12′ 06″', magnitude: 1.69, color: '#99CCFF' },
  { id: 'mintaka', name: 'Mintaka', nameJa: 'ミンタカ', type: 'Star', ra: '05h 32m 00s', dec: '-00° 17′ 56″', magnitude: 2.25, color: '#99CCFF' },
  { id: 'meissa', name: 'Meissa', nameJa: 'メイサ', type: 'Star', ra: '05h 35m 08s', dec: '+09° 56′ 03″', magnitude: 3.39, color: '#B3CFFF' },
  { id: 'pi3_ori', name: 'Tabit', nameJa: 'π3 Ori', type: 'Star', ra: '04h 49m 50s', dec: '+06° 57′ 40″', magnitude: 3.19, color: '#FBF8FF' },
  { id: 'pi4_ori', name: 'Pi4 Ori', nameJa: 'π4 Ori', type: 'Star', ra: '04h 51m 12s', dec: '+05° 36′ 18″', magnitude: 3.69, color: '#B3CFFF' },
  { id: 'chi1_ori', name: 'Chi1 Ori', nameJa: 'χ1 Ori', type: 'Star', ra: '05h 54m 23s', dec: '+20° 16′ 34″', magnitude: 4.39, color: '#FFF4E8' },
  { id: 'chi2_ori', name: 'Chi2 Ori', nameJa: 'χ2 Ori', type: 'Star', ra: '06_03m 55s', dec: '+20° 08′ 18″', magnitude: 4.63, color: '#B3CFFF' },

  // Cygnus
  { id: 'deneb', name: 'Deneb', nameJa: 'デネブ', type: 'Star', ra: '20h 41m 25s', dec: '+45° 16′ 49″', magnitude: 1.25, color: '#E0EBFF' },
  { id: 'sadr', name: 'Sadr', nameJa: 'サドル', type: 'Star', ra: '20h 22m 13s', dec: '+40° 15′ 24″', magnitude: 2.23, color: '#FFF4E8' },
  { id: 'gienah', name: 'Gienah', nameJa: 'ギェナー', type: 'Star', ra: '20h 46m 12s', dec: '+33° 58′ 13″', magnitude: 2.48, color: '#FFD1A3' },
  { id: 'albireo', name: 'Albireo', nameJa: 'アルビレオ', type: 'Star', ra: '19h 30m 43s', dec: '+27° 57′ 35″', magnitude: 3.0, color: '#FFD1A3' },
  { id: 'delta_cyg', name: 'Delta Cyg', nameJa: 'デネブ・カイトス', type: 'Star', ra: '19h 44m 58s', dec: '+45° 07′ 50″', magnitude: 2.87, color: '#B3CFFF' },
  { id: 'eta_cyg', name: 'Eta Cyg', nameJa: 'η Cyg', type: 'Star', ra: '19h 56m 18s', dec: '+35° 05′ 00″', magnitude: 3.89, color: '#FFD1A3' },
  { id: 'zeta_cyg', name: 'Zeta Cyg', nameJa: 'ζ Cyg', type: 'Star', ra: '21h 12m 56s', dec: '+30° 13′ 37″', magnitude: 3.21, color: '#FFF4E8' },
  { id: 'iota_cyg', name: 'Iota Cyg', nameJa: 'ι Cyg', type: 'Star', ra: '19h 29m 42s', dec: '+51° 43′ 47″', magnitude: 3.76, color: '#E0EBFF' },
  { id: 'kappa_cyg', name: 'Kappa Cyg', nameJa: 'κ Cyg', type: 'Star', ra: '19h 17m 06s', dec: '+53° 22′ 07″', magnitude: 3.8, color: '#FFD1A3' },

  // Lyra
  { id: 'vega', name: 'Vega', nameJa: 'ベガ', type: 'Star', ra: '18h 36m 56s', dec: '+38° 47′ 01″', magnitude: 0.03, color: '#E0EBFF' },
  { id: 'sheliak', name: 'Sheliak', nameJa: 'シェリアク', type: 'Star', ra: '18h 50m 04s', dec: '+33° 21′ 46″', magnitude: 3.52, color: '#B3CFFF' },
  { id: 'sulafat', name: 'Sulafat', nameJa: 'スラファト', type: 'Star', ra: '18h 58m 56s', dec: '+32° 41′ 22″', magnitude: 3.24, color: '#B3CFFF' },
  { id: 'delta_lyr', name: 'Delta Lyr', nameJa: 'δ Lyr', type: 'Star', ra: '18h 54m 30s', dec: '+36° 53′ 55″', magnitude: 4.3, color: '#FF9980' },
  { id: 'zeta_lyr', name: 'Zeta Lyr', nameJa: 'ζ Lyr', type: 'Star', ra: '18h 44m 46s', dec: '+37° 36′ 21″', magnitude: 4.34, color: '#E0EBFF' },
  { id: 'epsilon_lyr', name: 'Epsilon Lyr', nameJa: 'ε Lyr', type: 'Star', ra: '18h 44m 20s', dec: '+39° 40′ 12″', magnitude: 4.67, color: '#E0EBFF' },

  // Aquila
  { id: 'altair', name: 'Altair', nameJa: 'アルタイル', type: 'Star', ra: '19h 50m 47s', dec: '+08° 52′ 06″', magnitude: 0.77, color: '#E0EBFF' },
  { id: 'tarazed', name: 'Tarazed', nameJa: 'タラゼド', type: 'Star', ra: '19h 46m 15s', dec: '+10° 36′ 48″', magnitude: 2.72, color: '#FFD1A3' },
  { id: 'alshain', name: 'Alshain', nameJa: 'アルシャイン', type: 'Star', ra: '19h 55m 18s', dec: '+06° 24′ 24″', magnitude: 3.71, color: '#FFF4E8' },
  { id: 'delta_aql', name: 'Delta Aql', nameJa: 'δ Aql', type: 'Star', ra: '19h 25m 30s', dec: '+03° 06′ 53″', magnitude: 3.36, color: '#FBF8FF' },
  { id: 'theta_aql', name: 'Theta Aql', nameJa: 'θ Aql', type: 'Star', ra: '20h 11m 18s', dec: '-00° 49′ 17″', magnitude: 3.24, color: '#B3CFFF' },
  { id: 'lambda_aql', name: 'Lambda Aql', nameJa: 'λ Aql', type: 'Star', ra: '19h 06m 15s', dec: '-04° 52′ 57″', magnitude: 3.43, color: '#B3CFFF' },
  { id: 'eta_aql', name: 'Eta Aql', nameJa: 'η Aql', type: 'Star', ra: '19h 52m 28s', dec: '+01° 00′ 20″', magnitude: 3.87, color: '#FFF4E8' },
  { id: 'zeta_aql', name: 'Zeta Aql', nameJa: 'ζ Aql', type: 'Star', ra: '19h 05m 24s', dec: '+13° 51′ 48″', magnitude: 2.99, color: '#E0EBFF' },
  { id: '12_aql', name: '12 Aql', nameJa: 'わし座12番星', type: 'Star', ra: '19h 01m 26s', dec: '-05° 44′ 16″', magnitude: 4.02, color: '#FFD1A3' },

  // Taurus
  { id: 'aldebaran', name: 'Aldebaran', nameJa: 'アルデバラン', type: 'Star', ra: '04h 35m 55s', dec: '+16° 30′ 33″', magnitude: 0.85, color: '#FFCFA3' },
  { id: 'elnath', name: 'Elnath', nameJa: 'エルナト', type: 'Star', ra: '05h 26m 17s', dec: '+28° 36′ 27″', magnitude: 1.65, color: '#B3CFFF' },
  { id: 'tianguan', name: 'Tianguan', nameJa: '天関', type: 'Star', ra: '05h 37m 38s', dec: '+21° 08′ 33″', magnitude: 2.9, color: '#B3CFFF' },
  { id: 'hyadum_i', name: 'Hyadum I', nameJa: 'ガンマ Tau', type: 'Star', ra: '04h 19m 47s', dec: '+15° 37′ 40″', magnitude: 3.65, color: '#FFF4E8' },
  { id: 'epsilon_tau', name: 'Ain', nameJa: 'アイン', type: 'Star', ra: '04h 28m 37s', dec: '+19° 10′ 50″', magnitude: 3.53, color: '#FFD1A3' },
  { id: 'lambda_tau', name: 'Lambda Tau', nameJa: 'λ Tau', type: 'Star', ra: '04h 00m 40s', dec: '+12° 29′ 25″', magnitude: 3.47, color: '#B3CFFF' },

  // Auriga
  { id: 'capella', name: 'Capella', nameJa: 'カペラ', type: 'Star', ra: '05h 16m 41s', dec: '+45° 59′ 53″', magnitude: 0.08, color: '#FFF4E8' },
  { id: 'menkalinan', name: 'Menkalinan', nameJa: 'メンカリナン', type: 'Star', ra: '05h 59m 31s', dec: '+44° 56′ 51″', magnitude: 1.9, color: '#CAD7FF' },
  { id: 'mahsim', name: 'Mahsim', nameJa: 'マハシム', type: 'Star', ra: '05h 59m 43s', dec: '+37° 12′ 45″', magnitude: 2.6, color: '#B3CFFF' },
  { id: 'hassaleh', name: 'Hassaleh', nameJa: 'ハサレ', type: 'Star', ra: '04h 57m 08s', dec: '+33° 09′ 58″', magnitude: 2.69, color: '#FFD1A3' },
  { id: 'almaaz', name: 'Almaaz', nameJa: 'アルマーズ', type: 'Star', ra: '05h 01m 58s', dec: '+43° 49′ 23″', magnitude: 3.03, color: '#E0EBFF' },

  // Gemini
  { id: 'pollux', name: 'Pollux', nameJa: 'ポルックス', type: 'Star', ra: '07h 45m 18s', dec: '+28° 01′ 34″', magnitude: 1.14, color: '#FFD1A3' },
  { id: 'castor', name: 'Castor', nameJa: 'カストル', type: 'Star', ra: '07h 34m 36s', dec: '+31° 53′ 18″', magnitude: 1.58, color: '#E0EBFF' },
  { id: 'alhena', name: 'Alhena', nameJa: 'アルヘナ', type: 'Star', ra: '06h 37m 42s', dec: '+16° 23′ 57″', magnitude: 1.9, color: '#E0EBFF' },
  { id: 'wasat', name: 'Wasat', nameJa: 'ワサト', type: 'Star', ra: '07h 20m 07s', dec: '+21° 58′ 56″', magnitude: 3.5, color: '#FBF8FF' },
  { id: 'mebsuta', name: 'Mebsuta', nameJa: 'メブスタ', type: 'Star', ra: '06h 43m 55s', dec: '+25° 07′ 52″', magnitude: 3.06, color: '#FFF4E8' },
  { id: 'propus', name: 'Propus', nameJa: 'プロプス', type: 'Star', ra: '06h 14m 52s', dec: '+22° 30′ 24″', magnitude: 3.3, color: '#FF9980' },
  { id: 'mekbuda', name: 'Mekbuda', nameJa: 'メクブダ', type: 'Star', ra: '07h 04m 07s', dec: '+20° 34′ 13″', magnitude: 4.01, color: '#FFF4E8' },
  { id: 'mu_gem', name: 'Tejat Posterior', nameJa: 'μ Gem', type: 'Star', ra: '06h 22m 57s', dec: '+22° 30′ 49″', magnitude: 2.87, color: '#FF9980' },
  { id: 'nu_gem', name: 'Nu Gem', nameJa: 'ν Gem', type: 'Star', ra: '06h 28m 57s', dec: '+20° 12′ 43″', magnitude: 4.15, color: '#99CCFF' },
  { id: 'xi_gem', name: 'Alzirr', nameJa: 'ξ Gem', type: 'Star', ra: '06h 45m 17s', dec: '+12° 53′ 43″', magnitude: 3.35, color: '#FBF8FF' },
  { id: 'zeta_gem', name: 'Zeta Gem', nameJa: 'ζ Gem', type: 'Star', ra: '07h 04m 06s', dec: '+20° 34′ 13″', magnitude: 4.01, color: '#FFF4E8' },
  { id: 'tau_gem', name: 'Tau Gem', nameJa: 'τ Gem', type: 'Star', ra: '07h 11m 08s', dec: '+30° 14′ 42″', magnitude: 4.42, color: '#FFD1A3' },
  { id: 'iota_gem', name: 'Iota Gem', nameJa: 'ι Gem', type: 'Star', ra: '07h 25m 43s', dec: '+27° 47′ 53″', magnitude: 3.79, color: '#FFF4E8' },
  { id: 'kappa_gem', name: 'Kappa Gem', nameJa: 'κ Gem', type: 'Star', ra: '07h 44m 26s', dec: '+24° 23′ 52″', magnitude: 3.57, color: '#FFF4E8' },

  // Canis Major
  { id: 'sirius', name: 'Sirius', nameJa: 'シリウス', type: 'Star', ra: '06h 45m 09s', dec: '-16° 42′ 58″', magnitude: -1.46, color: '#E0EBFF' },
  { id: 'adhara', name: 'Adhara', nameJa: 'アダラ', type: 'Star', ra: '06h 58m 37s', dec: '-28° 58′ 20″', magnitude: 1.5, color: '#B3CFFF' },
  { id: 'wezen', name: 'Wezen', nameJa: 'ウェズン', type: 'Star', ra: '07h 08m 23s', dec: '-26° 23′ 36″', magnitude: 1.83, color: '#FBF8FF' },
  { id: 'murzim', name: 'Murzim', nameJa: 'ミルザム', type: 'Star', ra: '06h 22m 42s', dec: '-17° 57′ 22″', magnitude: 1.98, color: '#B3CFFF' },
  { id: 'aludra', name: 'Aludra', nameJa: 'アルドラ', type: 'Star', ra: '07h 24m 05s', dec: '-29° 18′ 11″', magnitude: 2.4, color: '#99CCFF' },
  { id: 'omicron2_cma', name: 'Omicron2 CMa', nameJa: 'ο2 CMa', type: 'Star', ra: '07h 03m 01s', dec: '-23° 49′ 59″', magnitude: 3.02, color: '#99CCFF' },
  { id: 'muliphein', name: 'Muliphein', nameJa: 'ムリフェイン', type: 'Star', ra: '07h 07m 19s', dec: '-15° 38′ 30″', magnitude: 4.1, color: '#E0EBFF' },

  // Canis Minor
  { id: 'procyon', name: 'Procyon', nameJa: 'プロキオン', type: 'Star', ra: '07h 39m 18s', dec: '+05° 13′ 30″', magnitude: 0.34, color: '#FFF4E8' },
  { id: 'gomeisa', name: 'Gomeisa', nameJa: 'ゴメイサ', type: 'Star', ra: '07h 27m 09s', dec: '+08° 17′ 21″', magnitude: 2.89, color: '#99CCFF' },

  // Leo
  { id: 'regulus', name: 'Regulus', nameJa: 'レグルス', type: 'Star', ra: '10h 08m 22s', dec: '+11° 58′ 02″', magnitude: 1.35, color: '#99CCFF' },
  { id: 'denebola', name: 'Denebola', nameJa: 'デネボラ', type: 'Star', ra: '11h 49m 03s', dec: '+14° 34′ 19″', magnitude: 2.14, color: '#E0EBFF' },
  { id: 'algieba', name: 'Algieba', nameJa: 'アルギエバ', type: 'Star', ra: '10h 19m 58s', dec: '+19° 50′ 30″', magnitude: 2.2, color: '#FFD1A3' },
  { id: 'ztsma', name: 'Zosma', nameJa: 'ゾスマ', type: 'Star', ra: '11h 14m 06s', dec: '+20° 31′ 25″', magnitude: 2.56, color: '#E0EBFF' },
  { id: 'adhafera', name: 'Adhafera', nameJa: 'アダフェラ', type: 'Star', ra: '10h 16m 41s', dec: '+23° 25′ 02″', magnitude: 3.44, color: '#FBF8FF' },
  { id: 'rasalas', name: 'Rasalas', nameJa: 'ラサラス', type: 'Star', ra: '09h 52m 45s', dec: '+26° 00′ 25″', magnitude: 3.88, color: '#FFD1A3' },
  { id: 'chertan', name: 'Chertan', nameJa: 'シェルタン', type: 'Star', ra: '11h 14m 14s', dec: '+15° 25′ 46″', magnitude: 3.33, color: '#E0EBFF' },
  { id: 'eta_leo', name: 'Eta Leo', nameJa: 'η Leo', type: 'Star', ra: '10h 07m 20s', dec: '+16° 45′ 45″', magnitude: 3.48, color: '#FBF8FF' },

  // Virgo
  { id: 'spica', name: 'Spica', nameJa: 'スピカ', type: 'Star', ra: '13h 25m 11s', dec: '-11° 09′ 41″', magnitude: 0.98, color: '#99CCFF' },
  { id: 'vindemiatrix', name: 'Vindemiatrix', nameJa: 'ヴィンデミアトリックス', type: 'Star', ra: '13h 02m 10s', dec: '+10° 57′ 33″', magnitude: 2.8, color: '#FFF4E8' },
  { id: 'porrima', name: 'Porrima', nameJa: 'ポリマ', type: 'Star', ra: '12h 41m 39s', dec: '-01° 26′ 57″', magnitude: 2.74, color: '#FBF8FF' },
  { id: 'auva', name: 'Auva', nameJa: 'アウヴァ', type: 'Star', ra: '12h 55m 36s', dec: '+03° 23′ 50″', magnitude: 3.38, color: '#FF9980' },
  { id: 'heze', name: 'Heze', nameJa: 'ヘゼ', type: 'Star', ra: '13h 34m 41s', dec: '-00° 35′ 44″', magnitude: 3.38, color: '#E0EBFF' },
  { id: 'zavijava', name: 'Zavijava', nameJa: 'ザヴィジャヴァ', type: 'Star', ra: '11h 50m 41s', dec: '+01° 45′ 52″', magnitude: 3.61, color: '#FBF8FF' },
  { id: 'theta_vir', name: 'Theta Vir', nameJa: 'θ Vir', type: 'Star', ra: '13h 09m 56s', dec: '-05° 32′ 20″', magnitude: 4.38, color: '#FBF8FF' },

  // Scorpius
  { id: 'antares', name: 'Antares', nameJa: 'アンタレス', type: 'Star', ra: '16h 29m 24s', dec: '-26° 25′ 55″', magnitude: 0.96, color: '#FF9980' },
  { id: 'shaula', name: 'Shaula', nameJa: 'シャウラ', type: 'Star', ra: '17h 33m 36s', dec: '-37° 06′ 14″', magnitude: 1.62, color: '#99CCFF' },
  { id: 'sargas', name: 'Sargas', nameJa: 'サルガス', type: 'Star', ra: '17h 37m 19s', dec: '-42° 59′ 52″', magnitude: 1.86, color: '#FBF8FF' },
  { id: 'dschubba', name: 'Dschubba', nameJa: 'ジュバ', type: 'Star', ra: '16h 00m 20s', dec: '-22° 37′ 18″', magnitude: 2.29, color: '#99CCFF' },
  { id: 'wei', name: 'Wei', nameJa: 'ウェイ', type: 'Star', ra: '16h 51m 52s', dec: '-38° 02′ 50″', magnitude: 2.29, color: '#FFD1A3' },
  { id: 'acrab', name: 'Acrab', nameJa: 'アクラブ', type: 'Star', ra: '16h 05m 26s', dec: '-19° 48′ 19″', magnitude: 2.56, color: '#99CCFF' },
  { id: 'girtab', name: 'Girtab', nameJa: 'ギルタブ', type: 'Star', ra: '17h 12m 09s', dec: '-39° 11′ 18″', magnitude: 3.9, color: '#FBF8FF' },
  { id: 'lesath', name: 'Lesath', nameJa: 'レサト', type: 'Star', ra: '17h 30m 45s', dec: '-37° 17′ 44″', magnitude: 2.7, color: '#99CCFF' },
  { id: 'paikauhale', name: 'Paikauhale', nameJa: 'パイカウハレ', type: 'Star', ra: '16h 21m 11s', dec: '-25° 35′ 34″', magnitude: 2.82, color: '#FFF4E8' },
  { id: 'pi_sco', name: 'Pi Sco', nameJa: 'π Sco', type: 'Star', ra: '15h 58m 51s', dec: '-26° 06′ 50″', magnitude: 2.89, color: '#B3CFFF' },
  { id: 'tau_sco', name: 'Tau Sco', nameJa: 'τ Sco', type: 'Star', ra: '16h 35m 52s', dec: '-28° 12′ 57″', magnitude: 2.82, color: '#99CCFF' },
  { id: 'epsilon_sco', name: 'Epsilon Sco', nameJa: 'ε Sco', type: 'Star', ra: '16h 50m 10s', dec: '-34° 17′ 35″', magnitude: 2.29, color: '#FFD1A3' },
  { id: 'mu_sco', name: 'Mu Sco', nameJa: 'μ Sco', type: 'Star', ra: '16h 51m 52s', dec: '-38° 02′ 50″', magnitude: 3.0, color: '#E0EBFF' }, // Often same as Wei visually
  { id: 'zeta_sco', name: 'Zeta Sco', nameJa: 'ζ Sco', type: 'Star', ra: '16h 54m 35s', dec: '-42° 21′ 40″', magnitude: 3.62, color: '#FFD1A3' }, 
  { id: 'eta_sco', name: 'Eta Sco', nameJa: 'η Sco', type: 'Star', ra: '17h 12m 09s', dec: '-43° 14′ 21″', magnitude: 3.33, color: '#FFF4E8' },
  { id: 'kappa_sco', name: 'Kappa Sco', nameJa: 'κ Sco', type: 'Star', ra: '17h 42m 29s', dec: '-39° 01′ 47″', magnitude: 2.41, color: '#E0EBFF' },

  // Sagittarius
  { id: 'kaus_australis', name: 'Kaus Australis', nameJa: 'カウス・アウストラリス', type: 'Star', ra: '18h 24m 10s', dec: '-34° 23′ 05″', magnitude: 1.79, color: '#99CCFF' },
  { id: 'nunki', name: 'Nunki', nameJa: 'ヌンキ', type: 'Star', ra: '18h 55m 15s', dec: '-26° 17′ 48″', magnitude: 2.05, color: '#99CCFF' },
  { id: 'ascella', name: 'Ascella', nameJa: 'アスケラ', type: 'Star', ra: '19h 02m 36s', dec: '-29° 52′ 48″', magnitude: 2.6, color: '#E0EBFF' },
  { id: 'kaus_media', name: 'Kaus Media', nameJa: 'カウス・メディア', type: 'Star', ra: '18h 28m 28s', dec: '-29° 49′ 10″', magnitude: 2.7, color: '#FFD1A3' },
  { id: 'kaus_borealis', name: 'Kaus Borealis', nameJa: 'カウス・ボレアリス', type: 'Star', ra: '18h 27m 58s', dec: '-25° 25′ 18″', magnitude: 2.82, color: '#FFD1A3' },
  { id: 'alnrukkaba', name: 'Alnasl', nameJa: 'アルナスル', type: 'Star', ra: '18h 05m 48s', dec: '-30° 25′ 25″', magnitude: 2.98, color: '#FFD1A3' },
  { id: 'phi_sgr', name: 'Phi Sgr', nameJa: 'φ Sgr', type: 'Star', ra: '18h 45m 39s', dec: '-26° 59′ 26″', magnitude: 3.17, color: '#E0EBFF' },
  { id: 'tau_sgr', name: 'Tau Sgr', nameJa: 'τ Sgr', type: 'Star', ra: '19h 06m 56s', dec: '-27° 40′ 13″', magnitude: 3.32, color: '#FFD1A3' },
  
  // Bootes
  { id: 'arcturus', name: 'Arcturus', nameJa: 'アークトゥルス', type: 'Star', ra: '14h 15m 39s', dec: '+19° 10′ 56″', magnitude: -0.04, color: '#FFD1A3' },
  { id: 'izar', name: 'Izar', nameJa: 'イザール', type: 'Star', ra: '14h 44m 59s', dec: '+27° 04′ 27″', magnitude: 2.35, color: '#FFD1A3' },
  { id: 'muphrid', name: 'Muphrid', nameJa: 'ムフリッド', type: 'Star', ra: '13h 54m 41s', dec: '+18° 23′ 51″', magnitude: 2.68, color: '#FFF4E8' },
  { id: 'seginus', name: 'Seginus', nameJa: 'セギヌス', type: 'Star', ra: '14h 32m 04s', dec: '+38° 18′ 30″', magnitude: 3.0, color: '#E0EBFF' },
  { id: 'nekkar', name: 'Nekkar', nameJa: 'ネッカル', type: 'Star', ra: '15h 01m 56s', dec: '+40° 23′ 26″', magnitude: 3.5, color: '#FFF4E8' },
  { id: 'princeps', name: 'Princeps', nameJa: 'プリンケプス', type: 'Star', ra: '15h 15m 30s', dec: '+33° 18′ 53″', magnitude: 3.47, color: '#E0EBFF' },
  { id: 'rho_boo', name: 'Rho Boo', nameJa: 'ρ Boo', type: 'Star', ra: '14h 31m 49s', dec: '+30° 22′ 16″', magnitude: 3.57, color: '#FFD1A3' },

  // Corona Borealis
  { id: 'alphecca', name: 'Alphecca', nameJa: 'アルフェッカ', type: 'Star', ra: '15h 34m 41s', dec: '+26° 42′ 53″', magnitude: 2.22, color: '#E0EBFF' },
  { id: 'nusakan', name: 'Nusakan', nameJa: 'ヌサカン', type: 'Star', ra: '15h 27m 49s', dec: '+29° 06′ 20″', magnitude: 3.6, color: '#FBF8FF' },

  // Pegasus
  { id: 'markab', name: 'Markab', nameJa: 'マルカブ', type: 'Star', ra: '23h 04m 45s', dec: '+15° 12′ 19″', magnitude: 2.49, color: '#E0EBFF' },
  { id: 'scheat', name: 'Scheat', nameJa: 'シェアト', type: 'Star', ra: '23h 03m 46s', dec: '+28° 04′ 58″', magnitude: 2.44, color: '#FF9980' },
  { id: 'algenib', name: 'Algenib', nameJa: 'アルゲニブ', type: 'Star', ra: '00h 13m 14s', dec: '+15° 11′ 01″', magnitude: 2.83, color: '#99CCFF' },
  { id: 'enif', name: 'Enif', nameJa: 'エニフ', type: 'Star', ra: '21h 44m 11s', dec: '+09° 52′ 30″', magnitude: 2.38, color: '#FFD1A3' },
  { id: 'homam', name: 'Homam', nameJa: 'ホマム', type: 'Star', ra: '22h 41m 27s', dec: '+10° 49′ 53″', magnitude: 3.4, color: '#99CCFF' },
  { id: 'matar', name: 'Matar', nameJa: 'マタル', type: 'Star', ra: '22h 43m 00s', dec: '+30° 13′ 16″', magnitude: 2.9, color: '#FFF4E8' },
  { id: 'baham', name: 'Baham', nameJa: 'バハム', type: 'Star', ra: '22h 10m 12s', dec: '+06° 11′ 52″', magnitude: 3.53, color: '#E0EBFF' },
  { id: 'pi_peg', name: 'Pi Peg', nameJa: 'π Peg', type: 'Star', ra: '22h 09m 59s', dec: '+33° 10′ 23″', magnitude: 4.29, color: '#FFF4E8' },

  // Andromeda
  { id: 'alpheratz', name: 'Alpheratz', nameJa: 'アルフェラッツ', type: 'Star', ra: '00h 08m 23s', dec: '+29° 05′ 26″', magnitude: 2.07, color: '#99CCFF' },
  { id: 'mirach', name: 'Mirach', nameJa: 'ミラク', type: 'Star', ra: '01h 09m 43s', dec: '+35° 37′ 14″', magnitude: 2.07, color: '#FF9980' },
  { id: 'almach', name: 'Almach', nameJa: 'アルマク', type: 'Star', ra: '02h 03m 54s', dec: '+42° 19′ 47″', magnitude: 2.10, color: '#FFD1A3' },
  { id: 'delta_and', name: 'Delta And', nameJa: 'δ And', type: 'Star', ra: '00h 39m 19s', dec: '+30° 51′ 40″', magnitude: 3.28, color: '#FFD1A3' },
  { id: 'mu_and', name: 'Mu And', nameJa: 'μ And', type: 'Star', ra: '00h 56m 45s', dec: '+38° 29′ 58″', magnitude: 3.87, color: '#E0EBFF' },
  { id: 'nu_and', name: 'Nu And', nameJa: 'ν And', type: 'Star', ra: '00h 49m 48s', dec: '+41° 04′ 44″', magnitude: 4.53, color: '#99CCFF' },

  // Centaurus
  { id: 'rigil_kent', name: 'Rigil Kentaurus', nameJa: 'リギル・ケンタウルス', type: 'Star', ra: '14h 39m 36s', dec: '-60° 50′ 02″', magnitude: -0.01, color: '#FFF4E8' },
  { id: 'hadar', name: 'Hadar', nameJa: 'ハダル', type: 'Star', ra: '14h 03m 49s', dec: '-60° 22′ 22″', magnitude: 0.61, color: '#99CCFF' },
  { id: 'menkent', name: 'Menkent', nameJa: 'メンケント', type: 'Star', ra: '14h 06m 40s', dec: '-36° 22′ 11″', magnitude: 2.06, color: '#FFD1A3' },
  { id: 'iota_cen', name: 'Iota Cen', nameJa: 'ι Cen', type: 'Star', ra: '13h 20m 36s', dec: '-36° 42′ 43″', magnitude: 2.73, color: '#E0EBFF' },

  // Crux
  { id: 'acrux', name: 'Acrux', nameJa: 'アクルックス', type: 'Star', ra: '12h 26m 35s', dec: '-63° 05′ 56″', magnitude: 0.77, color: '#99CCFF' },
  { id: 'mimosa', name: 'Mimosa', nameJa: 'ミモザ', type: 'Star', ra: '12h 47m 43s', dec: '-59° 41′ 19″', magnitude: 1.25, color: '#99CCFF' },
  { id: 'gacrux', name: 'Gacrux', nameJa: 'ガクルックス', type: 'Star', ra: '12h 31m 09s', dec: '-57° 06′ 47″', magnitude: 1.63, color: '#FF9980' },
  { id: 'delta_cru', name: 'Delta Cru', nameJa: 'デネブ・アクルックス', type: 'Star', ra: '12h 15m 08s', dec: '-58° 44′ 56″', magnitude: 2.79, color: '#99CCFF' },
  { id: 'epsilon_cru', name: 'Epsilon Cru', nameJa: 'ε Cru', type: 'Star', ra: '12h 21m 21s', dec: '-60° 24′ 04″', magnitude: 3.59, color: '#FFD1A3' },

  // Carina
  { id: 'canopus', name: 'Canopus', nameJa: 'カノープス', type: 'Star', ra: '06h 23m 57s', dec: '-52° 41′ 44″', magnitude: -0.74, color: '#FBF8FF' },
  { id: 'miaplacidus', name: 'Miaplacidus', nameJa: 'ミアプラキドゥス', type: 'Star', ra: '09h 13m 11s', dec: '-69° 43′ 01″', magnitude: 1.67, color: '#E0EBFF' },
  { id: 'avior', name: 'Avior', nameJa: 'アヴィオール', type: 'Star', ra: '08h 22m 30s', dec: '-59° 30′ 35″', magnitude: 1.86, color: '#FFD1A3' },
  { id: 'aspidiske', name: 'Aspidiske', nameJa: 'アスピディスケ', type: 'Star', ra: '09h 17m 05s', dec: '-59° 16′ 30″', magnitude: 2.21, color: '#FBF8FF' },
  { id: 'tau_car', name: 'Tau Car', nameJa: 'τ Car', type: 'Star', ra: '10h 17m 05s', dec: '-70° 02′ 29″', magnitude: 2.92, color: '#FBF8FF' },
  { id: 'epsilon_car', name: 'Epsilon Car', nameJa: 'ε Car', type: 'Star', ra: '08h 22m 30s', dec: '-59° 30′ 34″', magnitude: 1.86, color: '#FFD1A3' },
  { id: 'iota_car', name: 'Iota Car', nameJa: 'ι Car', type: 'Star', ra: '09h 17m 05s', dec: '-59° 16′ 30″', magnitude: 2.21, color: '#FBF8FF' },
  { id: 'beta_car', name: 'Miaplacidus', nameJa: 'ミアプラキドゥス', type: 'Star', ra: '09h 13m 12s', dec: '-69° 43′ 02″', magnitude: 1.67, color: '#E0EBFF' },
  { id: 'theta_car', name: 'Theta Car', nameJa: 'θ Car', type: 'Star', ra: '10h 42m 57s', dec: '-64° 23′ 40″', magnitude: 2.74, color: '#99CCFF' },
  { id: 'omega_car', name: 'Omega Car', nameJa: 'ω Car', type: 'Star', ra: '10h 13m 44s', dec: '-70° 02′ 16″', magnitude: 3.29, color: '#E0EBFF' },

  // Eridanus
  { id: 'achernar', name: 'Achernar', nameJa: 'アケルナル', type: 'Star', ra: '01h 37m 42s', dec: '-57° 14′ 12″', magnitude: 0.45, color: '#99CCFF' },
  { id: 'cursa', name: 'Cursa', nameJa: 'クルサ', type: 'Star', ra: '05h 07m 50s', dec: '-05° 05′ 11″', magnitude: 2.78, color: '#E0EBFF' },
  { id: 'zaurak', name: 'Zaurak', nameJa: 'ザウラク', type: 'Star', ra: '03h 58m 01s', dec: '-13° 30′ 30″', magnitude: 2.9, color: '#FFD1A3' },

  // Aries
  { id: 'hamal', name: 'Hamal', nameJa: 'ハマル', type: 'Star', ra: '02h 07m 10s', dec: '+23° 27′ 44″', magnitude: 2.01, color: '#FFD1A3' },
  { id: 'sheratan', name: 'Sheratan', nameJa: 'シェラタン', type: 'Star', ra: '01h 54m 38s', dec: '+20° 48′ 29″', magnitude: 2.64, color: '#E0EBFF' },
  { id: 'mesarthim', name: 'Mesarthim', nameJa: 'メサルティム', type: 'Star', ra: '01h 53m 31s', dec: '+19° 17′ 37″', magnitude: 3.88, color: '#E0EBFF' },
  
  // Cancer
  { id: 'acubens', name: 'Acubens', nameJa: 'アクベンス', type: 'Star', ra: '08h 58m 29s', dec: '+11° 51′ 28″', magnitude: 4.25, color: '#E0EBFF' },
  { id: 'delta_cnc', name: 'Asellus Australis', nameJa: 'アセルス・アウストラリス', type: 'Star', ra: '08h 44m 41s', dec: '+18° 09′ 15″', magnitude: 3.94, color: '#FFD1A3' },
  { id: 'iota_cnc', name: 'Iota Cnc', nameJa: 'ι Cnc', type: 'Star', ra: '08h 46m 41s', dec: '+28° 45′ 36″', magnitude: 4.02, color: '#FFF4E8' },
  { id: 'gamma_cnc', name: 'Asellus Borealis', nameJa: 'アセルス・ボレアリス', type: 'Star', ra: '08h 43m 17s', dec: '+21° 28′ 06″', magnitude: 4.66, color: '#E0EBFF' },
  
  // Libra
  { id: 'zubenelgenubi', name: 'Zubenelgenubi', nameJa: 'ズベン・エル・ゲヌビ', type: 'Star', ra: '14h 50m 52s', dec: '-16° 02′ 30″', magnitude: 2.75, color: '#E0EBFF' },
  { id: 'zubeneschamali', name: 'Zubeneschamali', nameJa: 'ズベン・エス・カマリ', type: 'Star', ra: '15h 17m 00s', dec: '-09° 22′ 58″', magnitude: 2.61, color: '#99CCFF' },
  { id: 'gamma_lib', name: 'Zubenelakrab', nameJa: 'ズベン・エル・アクラブ', type: 'Star', ra: '15h 35m 31s', dec: '-14° 47′ 22″', magnitude: 3.91, color: '#FFD1A3' },
  
  // Capricornus
  { id: 'algedi', name: 'Algedi', nameJa: 'アルゲディ', type: 'Star', ra: '20h 18m 03s', dec: '-12° 32′ 41″', magnitude: 3.58, color: '#FFF4E8' },
  { id: 'dabih', name: 'Dabih', nameJa: 'ダビー', type: 'Star', ra: '20h 21m 00s', dec: '-14° 46′ 53″', magnitude: 3.08, color: '#FFD1A3' },
  { id: 'nashira', name: 'Nashira', nameJa: 'ナシラ', type: 'Star', ra: '21h 40m 05s', dec: '-16° 39′ 44″', magnitude: 3.68, color: '#E0EBFF' },
  { id: 'deneb_algedi', name: 'Deneb Algedi', nameJa: 'デネブ・アルゲディ', type: 'Star', ra: '21h 47m 02s', dec: '-16° 07′ 38″', magnitude: 2.87, color: '#E0EBFF' },
  { id: 'theta_cap', name: 'Theta Cap', nameJa: 'θ Cap', type: 'Star', ra: '21h 05m 56s', dec: '-17° 13′ 57″', magnitude: 4.07, color: '#E0EBFF' },
  { id: 'iota_cap', name: 'Iota Cap', nameJa: 'ι Cap', type: 'Star', ra: '21h 22m 14s', dec: '-16° 50′ 04″', magnitude: 4.27, color: '#FFF4E8' },
  { id: 'delta_cap', name: 'Delta Cap', nameJa: 'デネブ・アルゲディ', type: 'Star', ra: '21h 47m 02s', dec: '-16° 07′ 38″', magnitude: 2.87, color: '#E0EBFF' },

  // Aquarius
  { id: 'sadalmelik', name: 'Sadalmelik', nameJa: 'サダルメリク', type: 'Star', ra: '22h 05m 47s', dec: '-00° 19′ 11″', magnitude: 2.96, color: '#FFF4E8' },
  { id: 'sadalsuud', name: 'Sadalsuud', nameJa: 'サダルスード', type: 'Star', ra: '21h 31m 33s', dec: '-05° 34′ 16″', magnitude: 2.87, color: '#FFF4E8' },
  { id: 'skat', name: 'Skat', nameJa: 'スカト', type: 'Star', ra: '22h 54m 39s', dec: '-15° 49′ 15″', magnitude: 3.27, color: '#E0EBFF' },
  { id: 'albali', name: 'Albali', nameJa: 'アルバリ', type: 'Star', ra: '20h 47m 40s', dec: '-09° 29′ 44″', magnitude: 3.77, color: '#CAD7FF' },
  { id: 'eta_aqr', name: 'Eta Aqr', nameJa: 'η Aqr', type: 'Star', ra: '22h 35m 21s', dec: '-00° 07′ 02″', magnitude: 4.02, color: '#E0EBFF' },
  { id: 'gamma_aqr', name: 'Sadachbia', nameJa: 'サダクビア', type: 'Star', ra: '22h 21m 39s', dec: '-01° 23′ 14″', magnitude: 3.84, color: '#E0EBFF' },
  { id: 'pi_aqr', name: 'Pi Aqr', nameJa: 'π Aqr', type: 'Star', ra: '22h 25m 16s', dec: '+01° 22′ 38″', magnitude: 4.66, color: '#99CCFF' },
  { id: 'zeta_aqr', name: 'Zeta Aqr', nameJa: 'ζ Aql', type: 'Star', ra: '22h 28m 49s', dec: '-00° 01′ 12″', magnitude: 3.65, color: '#E0EBFF' },
  { id: 'beta_aqr', name: 'Sadalsuud', nameJa: 'サダルスード', type: 'Star', ra: '21h 31m 33s', dec: '-05° 34′ 16″', magnitude: 2.87, color: '#FFF4E8' },

  // Pisces
  { id: 'alpherg', name: 'Alpherg', nameJa: 'アルフェルグ', type: 'Star', ra: '01h 31m 29s', dec: '+15° 20′ 45″', magnitude: 3.62, color: '#FFF4E8' },
  { id: 'alrescha', name: 'Alrescha', nameJa: 'アルレシャ', type: 'Star', ra: '02h 02m 02s', dec: '+02° 45′ 49″', magnitude: 3.82, color: '#E0EBFF' },
  { id: 'delta_psc', name: 'Delta Psc', nameJa: 'δ Psc', type: 'Star', ra: '00h 48m 40s', dec: '+07° 35′ 06″', magnitude: 4.43, color: '#FFD1A3' },
  { id: 'epsilon_psc', name: 'Epsilon Psc', nameJa: 'ε Psc', type: 'Star', ra: '01h 02m 56s', dec: '+07° 53′ 24″', magnitude: 4.28, color: '#FFD1A3' },
  { id: 'eta_psc', name: 'Eta Psc', nameJa: 'η Psc', type: 'Star', ra: '01h 31m 29s', dec: '+15° 20′ 45″', magnitude: 3.62, color: '#FFF4E8' }, // Same as Alpherg
  { id: 'pi_psc', name: 'Pi Psc', nameJa: 'π Psc', type: 'Star', ra: '01h 37m 05s', dec: '+12° 08′ 29″', magnitude: 5.54, color: '#E0EBFF' },

  // Cepheus
  { id: 'alderamin', name: 'Alderamin', nameJa: 'アルデラミン', type: 'Star', ra: '21h 18m 34s', dec: '+62° 35′ 08″', magnitude: 2.44, color: '#E0EBFF' },
  { id: 'alfirk', name: 'Alfirk', nameJa: 'アルフィルク', type: 'Star', ra: '21h 28m 39s', dec: '+70° 33′ 38″', magnitude: 3.23, color: '#99CCFF' },
  { id: 'errai', name: 'Errai', nameJa: 'エライ', type: 'Star', ra: '23h 39m 20s', dec: '+77° 37′ 56″', magnitude: 3.21, color: '#FFD1A3' },
  { id: 'iota_cep', name: 'Iota Cep', nameJa: 'ι Cep', type: 'Star', ra: '22h 49m 40s', dec: '+66° 12′ 01″', magnitude: 3.52, color: '#FFD1A3' },
  { id: 'zeta_cep', name: 'Zeta Cep', nameJa: 'ζ Cep', type: 'Star', ra: '22h 10m 51s', dec: '+58° 12′ 07″', magnitude: 3.35, color: '#FFD1A3' },
  { id: 'epsilon_cep', name: 'Epsilon Cep', nameJa: 'ε Cep', type: 'Star', ra: '22h 15m 01s', dec: '+57° 02′ 37″', magnitude: 4.19, color: '#FBF8FF' },
  { id: 'delta_cep', name: 'Delta Cep', nameJa: 'δ Cep', type: 'Star', ra: '22h 29m 10s', dec: '+58° 24′ 54″', magnitude: 4.07, color: '#FFF4E8' },

  // Draco
  { id: 'eltanin', name: 'Eltanin', nameJa: 'エルタニン', type: 'Star', ra: '17h 56m 36s', dec: '+51° 29′ 20″', magnitude: 2.23, color: '#FFD1A3' },
  { id: 'rastaban', name: 'Rastaban', nameJa: 'ラスタバン', type: 'Star', ra: '17h 30m 25s', dec: '+52° 18′ 05″', magnitude: 2.79, color: '#FFF4E8' },
  { id: 'altais', name: 'Altais', nameJa: 'アルタイス', type: 'Star', ra: '19h 12m 33s', dec: '+67° 39′ 41″', magnitude: 3.07, color: '#FFD1A3' },
  { id: 'grumium', name: 'Grumium', nameJa: 'グルミウム', type: 'Star', ra: '17h 53m 31s', dec: '+56° 52′ 21″', magnitude: 3.75, color: '#FFD1A3' },
  { id: 'delta_dra', name: 'Delta Dra', nameJa: 'δ Dra', type: 'Star', ra: '19h 12m 33s', dec: '+67° 39′ 41″', magnitude: 3.07, color: '#FFF4E8' },
  { id: 'theta_dra', name: 'Theta Dra', nameJa: 'θ Dra', type: 'Star', ra: '16h 01m 53s', dec: '+58° 33′ 55″', magnitude: 4.01, color: '#FBF8FF' },

  // Perseus
  { id: 'mirfak', name: 'Mirfak', nameJa: 'ミルファク', type: 'Star', ra: '03h 24m 19s', dec: '+49° 51′ 40″', magnitude: 1.79, color: '#FFF4E8' },
  { id: 'algol', name: 'Algol', nameJa: 'アルゴル', type: 'Star', ra: '03h 08m 10s', dec: '+40° 57′ 20″', magnitude: 2.09, color: '#99CCFF' },
  { id: 'epsilon_per', name: 'Epsilon Per', nameJa: 'ε Per', type: 'Star', ra: '03h 57m 51s', dec: '+40° 00′ 37″', magnitude: 2.89, color: '#99CCFF' },
  { id: 'delta_per', name: 'Delta Per', nameJa: 'δ Per', type: 'Star', ra: '03h 42m 55s', dec: '+47° 47′ 15″', magnitude: 3.01, color: '#99CCFF' },
  { id: 'iota_per', name: 'Iota Per', nameJa: 'ι Per', type: 'Star', ra: '03h 09m 04s', dec: '+49° 36′ 47″', magnitude: 4.05, color: '#FFF4E8' },
  { id: 'rho_per', name: 'Rho Per', nameJa: 'ρ Per', type: 'Star', ra: '03h 05m 10s', dec: '+38° 50′ 25″', magnitude: 3.39, color: '#FF9980' },

  // Ophiuchus
  { id: 'rasalhague', name: 'Rasalhague', nameJa: 'ラス・アルハゲ', type: 'Star', ra: '17h 34m 56s', dec: '+12° 33′ 36″', magnitude: 2.08, color: '#E0EBFF' },
  { id: 'sabik', name: 'Sabik', nameJa: 'サビク', type: 'Star', ra: '17h 10m 22s', dec: '-15° 43′ 30″', magnitude: 2.43, color: '#E0EBFF' },
  { id: 'yed_prior', name: 'Yed Prior', nameJa: 'イェド・プリオル', type: 'Star', ra: '16h 14m 20s', dec: '-03° 41′ 39″', magnitude: 2.74, color: '#FFD1A3' },
  { id: 'cebalrai', name: 'Cebalrai', nameJa: 'ケバルライ', type: 'Star', ra: '17h 43m 28s', dec: '+04° 34′ 02″', magnitude: 2.77, color: '#FFD1A3' },
  { id: 'zeta_oph', name: 'Zeta Oph', nameJa: 'ζ Oph', type: 'Star', ra: '16h 37m 09s', dec: '-10° 34′ 01″', magnitude: 2.56, color: '#99CCFF' },
  { id: 'epsilon_oph', name: 'Yed Posterior', nameJa: 'イェド・ポステリオル', type: 'Star', ra: '16h 18m 19s', dec: '-04° 41′ 33″', magnitude: 3.24, color: '#FFF4E8' },
  { id: 'delta_oph', name: 'Yed Prior', nameJa: 'イェド・プリオル', type: 'Star', ra: '16h 14m 20s', dec: '-03° 41′ 39″', magnitude: 2.74, color: '#FFD1A3' },

  // Hercules
  { id: 'kornephoros', name: 'Kornephoros', nameJa: 'コルネフォロス', type: 'Star', ra: '16h 30m 13s', dec: '+21° 29′ 22″', magnitude: 2.77, color: '#FFF4E8' },
  { id: 'sarin', name: 'Sarin', nameJa: 'サリン', type: 'Star', ra: '17h 14m 38s', dec: '+14° 23′ 25″', magnitude: 3.12, color: '#E0EBFF' },
  { id: 'zeta_her', name: 'Zeta Her', nameJa: 'ζ Her', type: 'Star', ra: '16h 41m 17s', dec: '+31° 36′ 06″', magnitude: 2.81, color: '#FFF4E8' },
  { id: 'epsilon_her', name: 'Epsilon Her', nameJa: 'ε Her', type: 'Star', ra: '17h 00m 17s', dec: '+30° 55′ 58″', magnitude: 3.92, color: '#E0EBFF' },
  { id: 'pi_her', name: 'Pi Her', nameJa: 'π Her', type: 'Star', ra: '17h 15m 02s', dec: '+36° 48′ 33″', magnitude: 3.15, color: '#FFD1A3' },
  { id: 'eta_her', name: 'Eta Her', nameJa: 'η Her', type: 'Star', ra: '16h 42m 53s', dec: '+38° 55′ 19″', magnitude: 3.48, color: '#FFF4E8' },
  { id: 'gamma_her', name: 'Gamma Her', nameJa: 'γ Her', type: 'Star', ra: '16_21m 55s', dec: '+19° 09′ 10″', magnitude: 3.75, color: '#E0EBFF' },

  // Other Bright Stars
  { id: 'fomalhaut', name: 'Fomalhaut', nameJa: 'フォーマルハウト', type: 'Star', ra: '22h 57m 39s', dec: '-29° 37′ 20″', magnitude: 1.17, color: '#E0EBFF' },
  { id: 'alphard', name: 'Alphard', nameJa: 'アルファルド', type: 'Star', ra: '09h 27m 35s', dec: '-08° 39′ 30″', magnitude: 1.99, color: '#FFD1A3' },
  { id: 'diphda', name: 'Diphda', nameJa: 'ディフダ', type: 'Star', ra: '00h 43m 35s', dec: '-17° 59′ 11″', magnitude: 2.04, color: '#FFD1A3' },
  { id: 'alp_ara', name: 'Alpha Ara', nameJa: 'α Ara', type: 'Star', ra: '17h 31m 50s', dec: '-49° 52′ 34″', magnitude: 2.95, color: '#99CCFF' },
  { id: 'bet_gru', name: 'Tiaki', nameJa: 'ティアキ', type: 'Star', ra: '22h 42m 40s', dec: '-46° 53′ 04″', magnitude: 2.1, color: '#FF9980' },
  { id: 'alp_gru', name: 'Alnair', nameJa: 'アルナイル', type: 'Star', ra: '22h 08m 14s', dec: '-46° 57′ 40″', magnitude: 1.74, color: '#99CCFF' },
  { id: 'alp_pav', name: 'Peacock', nameJa: 'ピーコック', type: 'Star', ra: '20h 25m 38s', dec: '-56° 44′ 06″', magnitude: 1.94, color: '#99CCFF' },
  { id: 'alp_hyi', name: 'Alpha Hyi', nameJa: 'α Hyi', type: 'Star', ra: '01h 58m 46s', dec: '-61° 34′ 11″', magnitude: 2.9, color: '#FBF8FF' },
  { id: 'alp_phe', name: 'Ankaa', nameJa: 'アンカ', type: 'Star', ra: '00h 26m 17s', dec: '-42° 18′ 22″', magnitude: 2.39, color: '#FFD1A3' },
];

// Corrected Constellation Lines (Standard Stick Figures)
export const CONSTELLATIONS: Constellation[] = [
    {
        name: 'Ursa Major',
        nameJa: 'おおぐま座',
        lines: [
            // The Big Dipper
            { from: 'dubhe', to: 'merak' }, { from: 'merak', to: 'phecda' }, { from: 'phecda', to: 'megrez' },
            { from: 'megrez', to: 'alioth' }, { from: 'megrez', to: 'dubhe' }, { from: 'alioth', to: 'mizar' },
            { from: 'mizar', to: 'alkaid' },
            // Front Legs/Head
            { from: 'dubhe', to: 'muscida' }, 
            { from: 'merak', to: 'theta_uma' }, { from: 'theta_uma', to: 'talitha' }, 
            { from: 'talitha', to: 'kappa_uma' }, { from: 'kappa_uma', to: 'iota_uma' }, 
            // Rear Legs
            { from: 'phecda', to: 'chi_uma' }, { from: 'chi_uma', to: 'psi_uma' }, 
            { from: 'psi_uma', to: 'mu_uma' }, { from: 'mu_uma', to: 'lambda_uma' }, 
            // Connection to body
            { from: 'megrez', to: 'chi_uma' } 
        ]
    },
    {
        name: 'Ursa Minor',
        nameJa: 'こぐま座',
        lines: [
            { from: 'polaris', to: 'delta_umi' }, { from: 'delta_umi', to: 'epsilon_umi' }, { from: 'epsilon_umi', to: 'zeta_umi' },
            { from: 'zeta_umi', to: 'eta_umi' }, { from: 'eta_umi', to: 'pherkad' }, { from: 'pherkad', to: 'kochab' }, { from: 'kochab', to: 'zeta_umi' } 
        ]
    },
    {
        name: 'Cassiopeia',
        nameJa: 'カシオペヤ座',
        lines: [
            { from: 'caph', to: 'schedar' }, { from: 'schedar', to: 'gamma_cas' }, { from: 'gamma_cas', to: 'ruchbah' }, { from: 'ruchbah', to: 'segin' }
        ]
    },
    {
        name: 'Orion',
        nameJa: 'オリオン座',
        lines: [
            // Body
            { from: 'betelgeuse', to: 'alnitak' }, { from: 'bellatrix', to: 'mintaka' }, { from: 'alnitak', to: 'alnilam' },
            { from: 'alnilam', to: 'mintaka' }, { from: 'alnitak', to: 'saiph' }, { from: 'mintaka', to: 'rigel' },
            { from: 'saiph', to: 'rigel' }, { from: 'betelgeuse', to: 'meissa' }, { from: 'bellatrix', to: 'meissa' }, // Head
            // Shield
            { from: 'bellatrix', to: 'pi3_ori' }, { from: 'pi3_ori', to: 'pi4_ori' }, 
            // Club (simplified)
            { from: 'betelgeuse', to: 'chi2_ori' }, 
        ]
    },
    {
        name: 'Cygnus',
        nameJa: 'はくちょう座',
        lines: [
            { from: 'deneb', to: 'sadr' }, { from: 'sadr', to: 'albireo' }, 
            { from: 'delta_cyg', to: 'sadr' }, { from: 'sadr', to: 'epsilon_cyg' }, // Crossbar
            { from: 'epsilon_cyg', to: 'zeta_cyg' }, { from: 'delta_cyg', to: 'iota_cyg' }, { from: 'iota_cyg', to: 'kappa_cyg' },
            { from: 'deneb', to: 'eta_cyg' } // Tail
        ]
    },
    {
        name: 'Lyra',
        nameJa: 'こと座',
        lines: [
            { from: 'vega', to: 'epsilon_lyr' }, 
            { from: 'vega', to: 'zeta_lyr' }, 
            { from: 'zeta_lyr', to: 'sheliak' }, { from: 'sheliak', to: 'sulafat' }, 
            { from: 'sulafat', to: 'delta_lyr' }, { from: 'delta_lyr', to: 'zeta_lyr' } 
        ]
    },
    {
        name: 'Aquila',
        nameJa: 'わし座',
        lines: [
            { from: 'altair', to: 'tarazed' }, { from: 'altair', to: 'alshain' }, 
            { from: 'altair', to: 'delta_aql' }, { from: 'delta_aql', to: 'lambda_aql' }, { from: 'lambda_aql', to: '12_aql' }, 
            { from: 'delta_aql', to: 'theta_aql' }, { from: 'theta_aql', to: 'eta_aql' }, { from: 'delta_aql', to: 'zeta_aql' }
        ]
    },
    {
        name: 'Pegasus',
        nameJa: 'ペガスス座',
        lines: [
            // Great Square
            { from: 'markab', to: 'scheat' }, { from: 'scheat', to: 'alpheratz' }, { from: 'alpheratz', to: 'algenib' }, { from: 'algenib', to: 'markab' }, 
            // Neck/Head
            { from: 'markab', to: 'homam' }, { from: 'homam', to: 'baham' }, { from: 'baham', to: 'enif' },
            // Legs
            { from: 'scheat', to: 'matar' }, { from: 'matar', to: 'pi_peg' }
        ]
    },
    {
        name: 'Andromeda',
        nameJa: 'アンドロメダ座',
        lines: [
            { from: 'alpheratz', to: 'delta_and' }, { from: 'delta_and', to: 'mirach' }, { from: 'mirach', to: 'almach' }, // Main chain
            { from: 'mirach', to: 'mu_and' }, { from: 'mu_and', to: 'nu_and' } // Belt
        ]
    },
    {
        name: 'Gemini',
        nameJa: 'ふたご座',
        lines: [
            { from: 'castor', to: 'pollux' }, 
            { from: 'castor', to: 'mebsuta' }, { from: 'mebsuta', to: 'mu_gem' }, { from: 'mu_gem', to: 'nu_gem' }, { from: 'nu_gem', to: 'propus' }, // Castor side
            { from: 'pollux', to: 'wasat' }, { from: 'wasat', to: 'mekbuda' }, { from: 'mekbuda', to: 'zeta_gem' }, { from: 'zeta_gem', to: 'alhena' } // Pollux side
        ]
    },
    {
        name: 'Leo',
        nameJa: 'しし座',
        lines: [
            { from: 'regulus', to: 'eta_leo' }, { from: 'eta_leo', to: 'algieba' }, { from: 'algieba', to: 'adhafera' }, { from: 'adhafera', to: 'rasalas' }, // Sickle (Head)
            { from: 'algieba', to: 'ztsma' }, { from: 'ztsma', to: 'denebola' }, { from: 'denebola', to: 'chertan' }, { from: 'chertan', to: 'regulus' } // Body
        ]
    },
    {
        name: 'Virgo',
        nameJa: 'おとめ座',
        lines: [
             { from: 'vindemiatrix', to: 'porrima' }, { from: 'porrima', to: 'zavijava' }, 
             { from: 'porrima', to: 'auva' }, { from: 'auva', to: 'heze' }, { from: 'heze', to: 'spica' },
             { from: 'spica', to: 'theta_vir' }
        ]
    },
    {
        name: 'Scorpius',
        nameJa: 'さそり座',
        lines: [
            { from: 'acrab', to: 'dschubba' }, { from: 'dschubba', to: 'pi_sco' }, { from: 'pi_sco', to: 'antares' },
            { from: 'antares', to: 'tau_sco' }, { from: 'tau_sco', to: 'epsilon_sco' }, { from: 'epsilon_sco', to: 'mu_sco' },
            { from: 'mu_sco', to: 'zeta_sco' }, { from: 'zeta_sco', to: 'eta_sco' }, { from: 'eta_sco', to: 'sargas' },
            { from: 'sargas', to: 'kappa_sco' }, { from: 'kappa_sco', to: 'shaula' }
        ]
    },
    {
        name: 'Sagittarius',
        nameJa: 'いて座',
        lines: [
            // Teapot
            { from: 'kaus_media', to: 'kaus_australis' }, { from: 'kaus_australis', to: 'ascella' }, { from: 'ascella', to: 'phi_sgr' }, { from: 'phi_sgr', to: 'kaus_borealis' }, { from: 'kaus_borealis', to: 'kaus_media' },
            { from: 'phi_sgr', to: 'nunki' }, { from: 'nunki', to: 'tau_sgr' }, // Handle
            { from: 'kaus_media', to: 'alnrukkaba' } // Spout
        ]
    },
    {
        name: 'Auriga',
        nameJa: 'ぎょしゃ座',
        lines: [
            { from: 'capella', to: 'menkalinan' }, { from: 'menkalinan', to: 'mahsim' }, { from: 'mahsim', to: 'elnath' }, 
            { from: 'elnath', to: 'hassaleh' }, { from: 'hassaleh', to: 'almaaz' }, { from: 'almaaz', to: 'capella' }
        ]
    },
    {
        name: 'Taurus',
        nameJa: 'おうし座',
        lines: [
            { from: 'aldebaran', to: 'epsilon_tau' }, { from: 'epsilon_tau', to: 'hyadum_i' }, { from: 'epsilon_tau', to: 'elnath' },
            { from: 'hyadum_i', to: 'tianguan' }, { from: 'aldebaran', to: 'hyadum_i' }, { from: 'hyadum_i', to: 'lambda_tau' }
        ]
    },
    {
        name: 'Canis Major',
        nameJa: 'おおいぬ座',
        lines: [
            { from: 'sirius', to: 'murzim' }, { from: 'sirius', to: 'muliphein' }, 
            { from: 'sirius', to: 'wezen' }, { from: 'wezen', to: 'adhara' }, { from: 'wezen', to: 'aludra' }, 
            { from: 'wezen', to: 'omicron2_cma' }
        ]
    },
    {
        name: 'Canis Minor',
        nameJa: 'こいぬ座',
        lines: [
            { from: 'procyon', to: 'gomeisa' }
        ]
    },
    {
        name: 'Crux',
        nameJa: 'みなみじゅうじ座',
        lines: [
            { from: 'acrux', to: 'gacrux' }, { from: 'mimosa', to: 'delta_cru' }, { from: 'acrux', to: 'mimosa' } // Cross
        ]
    },
    {
        name: 'Carina',
        nameJa: 'りゅうこつ座',
        lines: [
            { from: 'canopus', to: 'tau_car' }, { from: 'tau_car', to: 'epsilon_car' }, { from: 'epsilon_car', to: 'iota_car' },
            { from: 'iota_car', to: 'beta_car' }, { from: 'beta_car', to: 'theta_car' }, { from: 'theta_car', to: 'omega_car' }
        ]
    },
    {
        name: 'Bootes',
        nameJa: 'うしかい座',
        lines: [
            { from: 'arcturus', to: 'muphrid' }, { from: 'arcturus', to: 'izar' }, { from: 'izar', to: 'princeps' }, { from: 'princeps', to: 'nekkar' },
            { from: 'nekkar', to: 'seginus' }, { from: 'seginus', to: 'rho_boo' }, { from: 'rho_boo', to: 'izar' }
        ]
    },
    {
        name: 'Centaurus',
        nameJa: 'ケンタウルス座',
        lines: [
            { from: 'rigil_kent', to: 'hadar' }, { from: 'hadar', to: 'menkent' }, { from: 'menkent', to: 'iota_cen' }
        ]
    },
    {
        name: 'Aries',
        nameJa: 'おひつじ座',
        lines: [{ from: 'hamal', to: 'sheratan' }, { from: 'sheratan', to: 'mesarthim' }] 
    },
    {
        name: 'Cancer',
        nameJa: 'かに座',
        lines: [{ from: 'acubens', to: 'delta_cnc' }, { from: 'delta_cnc', to: 'iota_cnc' }, { from: 'delta_cnc', to: 'gamma_cnc' }]
    },
    {
        name: 'Libra',
        nameJa: 'てんびん座',
        lines: [{ from: 'zubenelgenubi', to: 'zubeneschamali' }, { from: 'zubenelgenubi', to: 'gamma_lib' }, { from: 'zubeneschamali', to: 'gamma_lib' }]
    },
    {
        name: 'Capricornus',
        nameJa: 'やぎ座',
        lines: [
            { from: 'algedi', to: 'dabih' }, { from: 'dabih', to: 'theta_cap' }, { from: 'theta_cap', to: 'iota_cap' },
            { from: 'iota_cap', to: 'nashira' }, { from: 'nashira', to: 'deneb_algedi' }, { from: 'deneb_algedi', to: 'delta_cap' }
        ]
    },
    {
        name: 'Aquarius',
        nameJa: 'みずがめ座',
        lines: [
            { from: 'sadalmelik', to: 'sadalsuud' }, { from: 'sadalmelik', to: 'eta_aqr' }, { from: 'eta_aqr', to: 'gamma_aqr' }, 
            { from: 'gamma_aqr', to: 'pi_aqr' }, { from: 'pi_aqr', to: 'zeta_aqr' }, // Jar
            { from: 'sadalsuud', to: 'beta_aqr' } // Shoulders
        ]
    },
    {
        name: 'Pisces',
        nameJa: 'うお座',
        lines: [
            { from: 'alrescha', to: 'delta_psc' }, { from: 'delta_psc', to: 'epsilon_psc' }, // Southern Fish
            { from: 'alrescha', to: 'eta_psc' }, { from: 'eta_psc', to: 'pi_psc' }, { from: 'pi_psc', to: 'alpherg' } // Northern Fish
        ]
    },
    {
        name: 'Cepheus',
        nameJa: 'ケフェウス座',
        lines: [
            { from: 'alderamin', to: 'alfirk' }, { from: 'alfirk', to: 'iota_cep' }, { from: 'iota_cep', to: 'zeta_cep' }, 
            { from: 'zeta_cep', to: 'epsilon_cep' }, { from: 'epsilon_cep', to: 'delta_cep' }, { from: 'delta_cep', to: 'alderamin' }
        ]
    },
    {
        name: 'Draco',
        nameJa: 'りゅう座',
        lines: [
            { from: 'rastaban', to: 'eltanin' }, { from: 'eltanin', to: 'grumium' }, { from: 'grumium', to: 'rastaban' }, // Head
            { from: 'rastaban', to: 'delta_dra' }, { from: 'delta_dra', to: 'altais' }, { from: 'altais', to: 'theta_dra' }
        ]
    },
    {
        name: 'Perseus',
        nameJa: 'ペルセウス座',
        lines: [
            { from: 'mirfak', to: 'delta_per' }, { from: 'mirfak', to: 'epsilon_per' }, { from: 'mirfak', to: 'iota_per' },
            { from: 'mirfak', to: 'algol' }, { from: 'algol', to: 'rho_per' }
        ]
    },
    {
        name: 'Ophiuchus',
        nameJa: 'へびつかい座',
        lines: [
            { from: 'rasalhague', to: 'cebalrai' }, { from: 'cebalrai', to: 'sabik' }, { from: 'sabik', to: 'zeta_oph' },
            { from: 'zeta_oph', to: 'yed_prior' }, { from: 'yed_prior', to: 'epsilon_oph' }, { from: 'epsilon_oph', to: 'delta_oph' },
            { from: 'delta_oph', to: 'cebalrai' }
        ]
    },
    {
        name: 'Hercules',
        nameJa: 'ヘルクレス座',
        lines: [
            { from: 'kornephoros', to: 'zeta_her' }, { from: 'zeta_her', to: 'epsilon_her' }, { from: 'epsilon_her', to: 'pi_her' },
            { from: 'pi_her', to: 'eta_her' }, { from: 'eta_her', to: 'zeta_her' }, // Keystone
            { from: 'kornephoros', to: 'gamma_her' } // Arm
        ]
    }
];
