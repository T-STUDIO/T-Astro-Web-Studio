
import React, { useState } from 'react';
import { CloseIcon } from './icons/CloseIcon';
import { ChevronDownIcon } from './icons/ChevronDownIcon';
import { ChevronUpIcon } from './icons/ChevronUpIcon';
import { useTranslation } from '../contexts/LanguageContext';

interface HelpModalProps {
    onClose: () => void;
}

interface HelpSection {
    title: string;
    subsections: { title: string; content: string }[];
}

export const HelpModal: React.FC<HelpModalProps> = ({ onClose }) => {
    const { language } = useTranslation();
    const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set([0]));

    const toggleSection = (index: number) => {
        const newExpanded = new Set(expandedSections);
        if (newExpanded.has(index)) {
            newExpanded.delete(index);
        } else {
            newExpanded.add(index);
        }
        setExpandedSections(newExpanded);
    };

    const helpContent: HelpSection[] = language === 'ja' ? [
        {
            title: '🚀 クイックスタート',
            subsections: [
                {
                    title: '初期セットアップ',
                    content: '1. [機材]タブでドライバを選択します（INDI/Alpaca/シミュレータ）\n2. ホストとポートを入力します\n3. [接続]ボタンをクリックして接続します\n4. デバイスリストから使用する機材をオンにします'
                },
                {
                    title: '天体の検索と導入',
                    content: '1. [導入]タブの検索ボックスに天体名を入力します（例：M42, NGC 7000, Vega）\n2. 検索結果から対象を選択します\n3. [天体へ移動]ボタンをクリックして望遠鏡を向けます\n4. プラネタリウム画面で現在位置を確認できます'
                },
                {
                    title: '撮影の開始',
                    content: '1. [撮影制御]タブで露出時間（ms）を設定します\n2. ゲイン、オフセット、ビニングを必要に応じて調整します\n3. [プレビュー]で単一フレームを撮影するか、[Loop]で連続撮影を開始します\n4. 撮影済み画像は画面に表示されます'
                }
            ]
        },
        {
            title: '🔌 接続設定（機材タブ）',
            subsections: [
                {
                    title: 'ドライバの選択',
                    content: '・INDI: Linux/Raspberry Piで動作するオープンソースドライバ\n・Alpaca: Windows/Macで動作する標準プロトコル\n・シミュレータ: 実機がない場合のテスト用'
                },
                {
                    title: 'Alpaca接続',
                    content: '・デフォルトホスト: localhost\n・デフォルトポート: 11111\n・リモート接続の場合はIPアドレスを入力します\n・ファイアウォール設定を確認してください'
                },
                {
                    title: 'INDI接続',
                    content: '・デフォルトホスト: localhost\n・デフォルトポート: 7624\n・INDIサーバーが起動していることを確認してください\n・複数デバイスは自動検出されます'
                },
                {
                    title: 'デバイス管理',
                    content: '・接続後、デバイスリストに利用可能な機材が表示されます\n・各デバイスの横のトグルスイッチでON/OFFを切り替えます\n・デバイス設定アイコンで詳細パラメータを調整できます\n・複数のカメラ、フォーカサー、フィルターホイールに対応'
                },
                {
                    title: '接続診断',
                    content: '・[接続診断]ボタンをクリックしてネットワーク接続をテストします\n・エラーが表示された場合、ホスト/ポート設定を確認してください\n・ファイアウォール、ルーター設定の問題がないか確認してください'
                }
            ]
        },
        {
            title: '🌌 プラネタリウム（導入タブ）',
            subsections: [
                {
                    title: '画面操作',
                    content: '・マウスドラッグ: 視野を移動\n・マウスホイール: ズームイン/アウト\n・右クリック: 中心位置をリセット\n・タッチスクリーン: ピンチズーム対応'
                },
                {
                    title: '天体検索',
                    content: '・検索ボックスに天体名を入力します\n・メシエ番号（M1～M110）に対応\n・NGC/IC番号に対応\n・星名（Vega, Altairなど）に対応\n・自動補完機能で候補が表示されます'
                },
                {
                    title: '表示設定',
                    content: '・星座線: 星座の枠線を表示/非表示\n・星ラベル: 明るい星の名前を表示\n・DSO（深空天体）ラベル: 星雲・銀河の名前を表示\n・星座名: 星座の名前を表示\n・Az/Altグリッド: 方位角・高度の格子線\n・RA/Decグリッド: 赤経・赤緯の格子線\n・地平線: 観測地点の地平線を表示'
                },
                {
                    title: 'DSS表示機能',
                    content: '・[設定]タブで「DSSを表示」をONにします\n・プラネタリウムでズームイン（2.0倍以上）します\n・星雲や銀河に実際のDigitized Sky Survey画像が重畳表示されます\n・インターネット接続が必須です\n・画像はAladin Liteサービスから取得されます'
                },
                {
                    title: '天の川表示',
                    content: '・[設定]タブで「天の川を表示」をONにします\n・「天の川の明度」スライダーで明るさを調整します\n・スライダーを右に移動させるほど明るく表示されます\n・銀河系の平面を視覚的に確認できます'
                },
                {
                    title: '推奨モード',
                    content: '・[推奨]ボタンをクリックすると、現在の観測地点から見える興味深い天体がハイライトされます\n・季節ごとに異なる天体が推奨されます\n・初心者向けの観測対象を自動選択します'
                },
                {
                    title: '天体情報',
                    content: '・プラネタリウム上の天体をクリックして選択します\n・下部パネルに天体の詳細情報が表示されます\n・赤経・赤緯、方位角・高度、等級などを確認できます\n・[天体情報を表示]ボタンでAI生成の詳細説明を表示します'
                }
            ]
        },
        {
            title: '📷 撮影制御（撮影制御タブ）',
            subsections: [
                {
                    title: '露出設定',
                    content: '・露出時間（ms）: シャッターが開いている時間\n・ゲイン: センサーの感度（高いほど暗い天体が見えやすい）\n・オフセット: 明るさの基準値（黒つぶれを防ぐ）\n・ビニング: ピクセルを統合して感度を上げる（解像度は低下）'
                },
                {
                    title: 'カラーバランス',
                    content: '・赤（R）、緑（G）、青（B）チャンネルの係数を調整\n・センサーの色かぶりを補正\n・プレビュー画像の色を最適化\n・カメラの特性に応じてカスタマイズ'
                },
                {
                    title: 'ライブビュー',
                    content: '・[ライブビュー]ボタンで連続撮影を開始\n・設定した露出で繰り返し撮影\n・リアルタイムでフォーカス調整が可能\n・[停止]ボタンで撮影を終了'
                },
                {
                    title: 'プレビュー',
                    content: '・[プレビュー]ボタンで単一フレームを撮影\n・構図確認やフォーカス調整に便利\n・撮影後、画像が画面に表示されます'
                },
                {
                    title: 'ライブスタッキング',
                    content: '・[ライブスタッキング開始]ボタンで複数フレームを自動合成\n・ノイズ低減と詳細表現が向上\n・リアルタイムで合成結果を確認\n・スタック数は自動調整されます'
                },
                {
                    title: 'ビデオストリーム',
                    content: '・[ビデオストリーム]ボタンで高速ストリーミング開始\n・フォーカシングやガイド星選択に最適\n・低遅延で実時間フィードバック'
                }
            ]
        },
        {
            title: '⚙️ 設定（設定タブ）',
            subsections: [
                {
                    title: '観測地点設定',
                    content: '・緯度・経度・標高を入力\n・[Web取得]で現在位置を自動取得\n・[デバイスから取得]で望遠鏡内部の設定を読み込み\n・[マウントに送信]で望遠鏡に設定を送信\n・正確な位置情報は天体計算の精度に影響します'
                },
                {
                    title: '時刻設定',
                    content: '・システム時刻を使用\n・[マウントに送信]で望遠鏡の時刻を同期\n・UTC時刻で内部計算\n・タイムゾーン設定は自動検出'
                },
                {
                    title: 'プラネタリウム表示設定',
                    content: '・星座線、ラベル、グリッドの表示/非表示\n・星の大きさスケール: 0.1～3.0倍\n・星の等級制限: 表示する最暗星の明るさ\n・DSO等級制限: 表示する最暗DSO\n・天の川の明度: 0～100%'
                },
                {
                    title: 'DSO表示フィルタ',
                    content: '・銀河の表示/非表示\n・星雲の表示/非表示\n・星団の表示/非表示\n・各カテゴリーを個別に制御'
                },
                {
                    title: 'バックアップ・復元',
                    content: '・[デバイスに保存]: 現在の設定をJSONファイルとしてダウンロード\n・[デバイスから読込]: 保存したJSONファイルから復元\n・[Google Driveに保存]: クラウドにバックアップ（要認証）\n・[Google Driveから読込]: クラウドから復元'
                }
            ]
        },
        {
            title: '🎯 プレートソルビング',
            subsections: [
                {
                    title: 'プレートソルビングとは',
                    content: '・撮影した画像から天体の正確な座標を自動計算\n・望遠鏡の指向精度を大幅に向上\n・自動導入の精度が向上'
                },
                {
                    title: 'ローカルソルバー',
                    content: '・ローカルコンピュータで実行\n・インターネット接続不要\n・高速処理（1～2秒）\n・Astrometry.netのローカル版を使用'
                },
                {
                    title: 'クラウドソルバー（Nova Solver）',
                    content: '・Astrometry.netクラウドサービスを使用\n・インターネット接続が必須\n・より高精度な結果\n・処理時間は数秒～数十秒'
                },
                {
                    title: '自動センタリング',
                    content: '・[自動センタリング]をONにすると以下を自動実行:\n  1. 画像を撮影\n  2. プレートソルビングで座標を計算\n  3. 望遠鏡の位置を同期\n  4. 必要に応じて望遠鏡を移動\n・目標天体を正確に中心に配置'
                }
            ]
        },
        {
            title: '🔗 INDI→Alpacaブリッジ',
            subsections: [
                {
                    title: 'ブリッジ機能とは',
                    content: '・INDIドライバで接続した機材をAlpacaプロトコルで利用可能に\n・異なるプロトコルのアプリケーション間で相互運用\n・INDI機材をAlpaca対応アプリで制御'
                },
                {
                    title: '有効化方法',
                    content: '1. INDI接続を確立します\n2. ブリッジ機能を有効化します\n3. Alpacaクライアントが自動検出\n4. INDI機材がAlpacaデバイスとして利用可能に'
                }
            ]
        },
        {
            title: '📡 WebSocket接続',
            subsections: [
                {
                    title: 'WebSocketについて',
                    content: '・リアルタイム双方向通信プロトコル\n・低遅延のデータ転送\n・ライブビューやストリーミングに最適\n・ネットワーク経由での機材制御'
                },
                {
                    title: '接続状態の確認',
                    content: '・ステータスバーで接続状態を表示\n・緑: 接続済み\n・黄: 接続中\n・赤: 切断/エラー\n・詳細は[接続診断]で確認'
                }
            ]
        },
        {
            title: '🛠️ 画像処理ツール',
            subsections: [
                {
                    title: 'ヒストグラム',
                    content: '・撮影画像の明るさ分布を表示\n・露出不足/過度を視覚的に確認\n・撮影パラメータの最適化に活用'
                },
                {
                    title: 'オートストレッチ',
                    content: '・ヒストグラムに基づいてコントラストを自動最適化\n・暗い天体の詳細が見やすくなる\n・一時的な表示調整（画像ファイルには影響しない）'
                },
                {
                    title: '画像反転',
                    content: '・水平反転: 左右を反転\n・垂直反転: 上下を反転\n・光学系の鏡像補正に使用'
                },
                {
                    title: 'RB入れ替え',
                    content: '・赤と青のチャンネルを交換\n・BGRセンサーの色補正に使用\n・カラーバランスの調整'
                },
                {
                    title: '画像保存',
                    content: '・JPEG: 圧縮形式、ファイルサイズ小\n・PNG: ロスレス圧縮、品質重視\n・TIFF: 高品質、ファイルサイズ大\n・RAW: 生データ、最高品質'
                }
            ]
        },
        {
            title: '🌍 統合機能',
            subsections: [
                {
                    title: 'SAMP（Simple Application Messaging Protocol）',
                    content: '・外部アプリケーション（Aladin, Stellarium等）との連携\n・天体座標の共有\n・観測計画の共有\n・[SAMP接続]で有効化'
                },
                {
                    title: 'Google Drive連携',
                    content: '・設定のクラウドバックアップ\n・複数デバイス間での設定同期\n・Google Cloud ConsoleでクライアントIDを取得\n・プライバシーとセキュリティに配慮'
                },
                {
                    title: 'AI天体情報',
                    content: '・Gemini AIを使用した天体情報生成\n・天体の歴史、特徴、観測のコツ\n・多言語対応\n・インターネット接続が必須'
                }
            ]
        },
        {
            title: '❓ トラブルシューティング',
            subsections: [
                {
                    title: '接続できない',
                    content: '・ホスト/ポートが正しいか確認\n・ファイアウォール設定を確認\n・ルーター設定を確認\n・[接続診断]ツールを実行\n・サーバーログを確認'
                },
                {
                    title: '天の川が表示されない',
                    content: '・[設定]タブで「天の川を表示」がONか確認\n・「天の川の明度」スライダーを右に移動\n・ズームレベルを調整\n・ブラウザキャッシュをクリア'
                },
                {
                    title: 'DSS画像が表示されない',
                    content: '・インターネット接続を確認\n・[設定]タブで「DSSを表示」がONか確認\n・ズームレベルを2.0倍以上にする\n・天体のサイズが5分角以上か確認\n・ブラウザコンソールでエラーを確認'
                },
                {
                    title: 'プレートソルビングが失敗する',
                    content: '・画像に十分な星が写っているか確認\n・ローカルソルバーのインストール確認\n・クラウドソルバーの場合、インターネット接続確認\n・画像の向きが正しいか確認'
                },
                {
                    title: 'パフォーマンスが低い',
                    content: '・表示する星の数を減らす（等級制限を上げる）\n・DSO表示を一時的に無効化\n・ブラウザのタブ数を減らす\n・コンピュータのリソース使用状況を確認\n・ブラウザを再起動'
                }
            ]
        }
    ] : [
        {
            title: '🚀 Quick Start',
            subsections: [
                {
                    title: 'Initial Setup',
                    content: '1. Select driver in [Equipment] tab (INDI/Alpaca/Simulator)\n2. Enter host and port\n3. Click [Connect] button\n4. Toggle devices you want to use in the device list'
                },
                {
                    title: 'Search and Slew to Objects',
                    content: '1. Enter object name in [Target] tab search box (e.g., M42, NGC 7000, Vega)\n2. Select target from search results\n3. Click [GoTo Target] button to slew telescope\n4. Verify current position on planetarium screen'
                },
                {
                    title: 'Start Imaging',
                    content: '1. Set exposure time (ms) in [Imaging] tab\n2. Adjust gain, offset, binning as needed\n3. Click [Preview] for single frame or [Loop] for continuous capture\n4. Captured images display on screen'
                }
            ]
        },
        {
            title: '🔌 Connection Settings (Equipment Tab)',
            subsections: [
                {
                    title: 'Driver Selection',
                    content: '・INDI: Open-source driver for Linux/Raspberry Pi\n・Alpaca: Standard protocol for Windows/Mac\n・Simulator: Test mode without hardware'
                },
                {
                    title: 'Alpaca Connection',
                    content: '・Default host: localhost\n・Default port: 11111\n・For remote connection, enter IP address\n・Verify firewall settings'
                },
                {
                    title: 'INDI Connection',
                    content: '・Default host: localhost\n・Default port: 7624\n・Verify INDI server is running\n・Multiple devices auto-detected'
                },
                {
                    title: 'Device Management',
                    content: '・Available devices appear after connection\n・Toggle switches to enable/disable devices\n・Click settings icon for detailed parameters\n・Supports multiple cameras, focusers, filter wheels'
                },
                {
                    title: 'Connection Diagnostics',
                    content: '・Click [Diagnostics] to test network connection\n・If error appears, verify host/port settings\n・Check firewall and router configuration\n・Review browser console for detailed messages'
                }
            ]
        },
        {
            title: '🌌 Planetarium (Target Tab)',
            subsections: [
                {
                    title: 'Screen Controls',
                    content: '・Mouse drag: Move view\n・Mouse wheel: Zoom in/out\n・Right-click: Reset center position\n・Touch screen: Pinch zoom supported'
                },
                {
                    title: 'Object Search',
                    content: '・Enter object name in search box\n・Messier numbers (M1-M110) supported\n・NGC/IC numbers supported\n・Star names (Vega, Altair, etc.) supported\n・Auto-complete suggestions available'
                },
                {
                    title: 'Display Settings',
                    content: '・Constellation Lines: Show/hide constellation borders\n・Star Labels: Display bright star names\n・DSO Labels: Display nebula/galaxy names\n・Constellation Names: Display constellation names\n・Az/Alt Grid: Show azimuth/altitude grid\n・RA/Dec Grid: Show RA/Dec grid\n・Horizon: Display local horizon line'
                },
                {
                    title: 'DSS Display Feature',
                    content: '・Enable "Show DSS" in [Settings] tab\n・Zoom in on planetarium (2.0x or more)\n・Real Digitized Sky Survey images overlay on nebulae/galaxies\n・Internet connection required\n・Images fetched from Aladin Lite service'
                },
                {
                    title: 'Milky Way Display',
                    content: '・Enable "Show Milky Way" in [Settings] tab\n・Adjust "Milky Way Brightness" slider\n・Move slider right for brighter display\n・Visually confirm galactic plane'
                },
                {
                    title: 'Recommended Mode',
                    content: '・Click [Recommended] to highlight interesting objects visible from current location\n・Different objects recommended by season\n・Auto-selects observing targets for beginners'
                },
                {
                    title: 'Object Information',
                    content: '・Click object on planetarium to select\n・Detailed information displays in bottom panel\n・View RA/Dec, Az/Alt, magnitude, etc.\n・Click [Object Info] for AI-generated detailed description'
                }
            ]
        },
        {
            title: '📷 Imaging Control (Imaging Tab)',
            subsections: [
                {
                    title: 'Exposure Settings',
                    content: '・Exposure Time (ms): Duration shutter remains open\n・Gain: Sensor sensitivity (higher = fainter objects visible)\n・Offset: Brightness baseline (prevents black clipping)\n・Binning: Combine pixels to increase sensitivity (reduces resolution)'
                },
                {
                    title: 'Color Balance',
                    content: '・Adjust Red (R), Green (G), Blue (B) channel coefficients\n・Correct sensor color cast\n・Optimize preview image colors\n・Customize for camera characteristics'
                },
                {
                    title: 'Live View',
                    content: '・Click [Live View] to start continuous capture\n・Repeats capture with configured exposure\n・Real-time focus adjustment possible\n・Click [Stop] to end capture'
                },
                {
                    title: 'Preview',
                    content: '・Click [Preview] to capture single frame\n・Convenient for composition check and focus adjustment\n・Image displays on screen after capture'
                },
                {
                    title: 'Live Stacking',
                    content: '・Click [Start Live Stacking] to auto-combine multiple frames\n・Reduces noise and enhances detail\n・View composite result in real-time\n・Stack count auto-adjusted'
                },
                {
                    title: 'Video Stream',
                    content: '・Click [Video Stream] to start high-speed streaming\n・Optimal for focusing and guide star selection\n・Low-latency real-time feedback'
                }
            ]
        },
        {
            title: '⚙️ Settings (Settings Tab)',
            subsections: [
                {
                    title: 'Observation Site Settings',
                    content: '・Enter latitude, longitude, elevation\n・[Get from Web] auto-detects current location\n・[Get from Device] reads telescope internal settings\n・[Send to Mount] syncs settings to telescope\n・Accurate position affects celestial calculation accuracy'
                },
                {
                    title: 'Time Settings',
                    content: '・Uses system time\n・[Send to Mount] syncs telescope time\n・Internal calculations use UTC\n・Timezone auto-detected'
                },
                {
                    title: 'Planetarium Display Settings',
                    content: '・Show/hide constellation lines, labels, grids\n・Star size scale: 0.1x to 3.0x\n・Star magnitude limit: Faintest star to display\n・DSO magnitude limit: Faintest DSO to display\n・Milky Way brightness: 0-100%'
                },
                {
                    title: 'DSO Display Filter',
                    content: '・Toggle galaxy display\n・Toggle nebula display\n・Toggle star cluster display\n・Individual control for each category'
                },
                {
                    title: 'Backup and Restore',
                    content: '・[Save to Device]: Download current settings as JSON file\n・[Load from Device]: Restore from saved JSON file\n・[Save to Drive]: Cloud backup (requires authentication)\n・[Load from Drive]: Restore from cloud'
                }
            ]
        },
        {
            title: '🎯 Plate Solving',
            subsections: [
                {
                    title: 'What is Plate Solving',
                    content: '・Auto-calculate exact celestial coordinates from captured image\n・Significantly improve telescope pointing accuracy\n・Enhance auto-goto accuracy'
                },
                {
                    title: 'Local Solver',
                    content: '・Runs on local computer\n・No internet connection required\n・Fast processing (1-2 seconds)\n・Uses local Astrometry.net version'
                },
                {
                    title: 'Cloud Solver (Nova Solver)',
                    content: '・Uses Astrometry.net cloud service\n・Internet connection required\n・Higher accuracy results\n・Processing time: several seconds to tens of seconds'
                },
                {
                    title: 'Auto-Centering',
                    content: '・Enable [Auto-Center] to auto-execute:\n  1. Capture image\n  2. Calculate coordinates via plate solving\n  3. Sync telescope position\n  4. Move telescope if needed\n・Precisely center target object'
                }
            ]
        },
        {
            title: '🔗 INDI to Alpaca Bridge',
            subsections: [
                {
                    title: 'Bridge Function',
                    content: '・Make INDI-connected equipment available via Alpaca protocol\n・Enable interoperability between different protocol applications\n・Control INDI equipment with Alpaca-compatible apps'
                },
                {
                    title: 'Enable Method',
                    content: '1. Establish INDI connection\n2. Enable bridge function\n3. Alpaca clients auto-detect\n4. INDI equipment available as Alpaca devices'
                }
            ]
        },
        {
            title: '📡 WebSocket Connection',
            subsections: [
                {
                    title: 'About WebSocket',
                    content: '・Real-time bidirectional communication protocol\n・Low-latency data transfer\n・Optimal for live view and streaming\n・Equipment control via network'
                },
                {
                    title: 'Connection Status',
                    content: '・Status bar displays connection state\n・Green: Connected\n・Yellow: Connecting\n・Red: Disconnected/Error\n・Check [Diagnostics] for details'
                }
            ]
        },
        {
            title: '🛠️ Image Processing Tools',
            subsections: [
                {
                    title: 'Histogram',
                    content: '・Display brightness distribution of captured image\n・Visually confirm under/over exposure\n・Use for optimizing capture parameters'
                },
                {
                    title: 'Auto Stretch',
                    content: '・Auto-optimize contrast based on histogram\n・Faint object details become more visible\n・Temporary display adjustment (doesn\'t affect saved image)'
                },
                {
                    title: 'Image Flip',
                    content: '・Horizontal flip: Mirror left/right\n・Vertical flip: Mirror top/bottom\n・Correct optical system mirror image'
                },
                {
                    title: 'Swap RB',
                    content: '・Exchange red and blue channels\n・Correct BGR sensor color\n・Adjust color balance'
                },
                {
                    title: 'Save Image',
                    content: '・JPEG: Compressed format, small file size\n・PNG: Lossless compression, quality priority\n・TIFF: High quality, large file size\n・RAW: Raw data, highest quality'
                }
            ]
        },
        {
            title: '🌍 Integration Features',
            subsections: [
                {
                    title: 'SAMP (Simple Application Messaging Protocol)',
                    content: '・Integrate with external applications (Aladin, Stellarium, etc.)\n・Share celestial coordinates\n・Share observation plans\n・Enable via [Connect SAMP]'
                },
                {
                    title: 'Google Drive Integration',
                    content: '・Cloud backup of settings\n・Sync settings across multiple devices\n・Obtain Client ID from Google Cloud Console\n・Privacy and security conscious'
                },
                {
                    title: 'AI Object Information',
                    content: '・Generate object information using Gemini AI\n・Object history, characteristics, observation tips\n・Multi-language support\n・Internet connection required'
                }
            ]
        },
        {
            title: '❓ Troubleshooting',
            subsections: [
                {
                    title: 'Cannot Connect',
                    content: '・Verify host/port are correct\n・Check firewall settings\n・Check router settings\n・Run [Diagnostics] tool\n・Review server logs'
                },
                {
                    title: 'Milky Way Not Displaying',
                    content: '・Verify "Show Milky Way" is enabled in [Settings]\n・Move "Milky Way Brightness" slider right\n・Adjust zoom level\n・Clear browser cache'
                },
                {
                    title: 'DSS Images Not Displaying',
                    content: '・Verify internet connection\n・Verify "Show DSS" is enabled in [Settings]\n・Zoom to 2.0x or more\n・Verify object size is 5 arcmin or larger\n・Check browser console for errors'
                },
                {
                    title: 'Plate Solving Fails',
                    content: '・Verify image contains sufficient stars\n・Verify local solver installation\n・For cloud solver, verify internet connection\n・Verify image orientation is correct'
                },
                {
                    title: 'Low Performance',
                    content: '・Reduce number of displayed stars (increase magnitude limit)\n・Temporarily disable DSO display\n・Reduce browser tab count\n・Check computer resource usage\n・Restart browser'
                }
            ]
        }
    ];

    return (
        <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-red-900/50 rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
                <div className="p-4 border-b border-red-900/30 flex justify-between items-center bg-slate-800/50 sticky top-0 z-10">
                    <h2 className="text-xl font-bold text-red-400">{language === 'ja' ? 'オンラインヘルプ - 完全ガイド' : 'Online Help - Complete Guide'}</h2>
                    <button onClick={onClose} className="p-2 hover:bg-red-900/20 rounded-full transition-colors">
                        <CloseIcon className="w-6 h-6 text-slate-400" />
                    </button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-6 space-y-2">
                    {helpContent.map((section, sectionIndex) => (
                        <div key={sectionIndex} className="border border-slate-700 rounded-lg overflow-hidden">
                            <button
                                onClick={() => toggleSection(sectionIndex)}
                                className="w-full px-4 py-3 bg-slate-800/50 hover:bg-slate-800 transition-colors flex items-center justify-between"
                            >
                                <h3 className="text-lg font-bold text-slate-200">{section.title}</h3>
                                {expandedSections.has(sectionIndex) ? (
                                    <ChevronUpIcon className="w-5 h-5 text-red-400" />
                                ) : (
                                    <ChevronDownIcon className="w-5 h-5 text-red-400" />
                                )}
                            </button>
                            
                            {expandedSections.has(sectionIndex) && (
                                <div className="bg-slate-900/50 p-4 space-y-4 border-t border-slate-700">
                                    {section.subsections.map((subsection, subIndex) => (
                                        <div key={subIndex} className="space-y-1">
                                            <h4 className="text-sm font-semibold text-red-400">{subsection.title}</h4>
                                            <p className="text-xs text-slate-400 whitespace-pre-wrap leading-relaxed pl-3 border-l-2 border-slate-700">
                                                {subsection.content}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
                
                <div className="p-4 border-t border-slate-800 bg-slate-900/50 text-center sticky bottom-0">
                    <p className="text-xs text-slate-500">T-Astro Web Studio v1.0.0 - {language === 'ja' ? '完全ガイド版' : 'Complete Guide Edition'}</p>
                </div>
            </div>
        </div>
    );
};
