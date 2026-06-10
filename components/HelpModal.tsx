import React, { useState } from 'react';
import { CloseIcon } from './icons/CloseIcon';
import { ChevronDownIcon } from './icons/ChevronDownIcon';
import { ChevronUpIcon } from './icons/ChevronUpIcon';
import { useTranslation } from '../contexts/LanguageContext';

interface HelpModalProps {
    isOpen: boolean;
    onClose: () => void;
}

interface HelpSubsection {
    title: string;
    content: string;
    link?: { text: string; url: string; external?: boolean };
}

interface HelpSection {
    title: string;
    subsections: HelpSubsection[];
}

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
    const { language } = useTranslation();
    const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set([0]));

    if (!isOpen) return null;

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
            title: '🚀 クイックスタートガイド',
            subsections: [
                {
                    title: '1. 事前のドライバ起動（※最重要）',
                    content: '本アプリは事前に外部でドライバを起動しておく必要がありますが、サポートされている環境下では、INDI接続時に利用可能なドライバの「一括自動起動機能（INDI Driver Selection）」を利用してブラウザから直接、サーバー側でドライバを選んでバックエンド連携起動することも可能です。'
                },
                {
                    title: '2. 機材の接続設定',
                    content: '・[機材]タブでドライバ種別を選択します。\n・ホスト名や中継ポートを入力し、「接続」ボタンを押します。\n・接続成功後、使用するカメラやマウントの個別のスイッチをONにし、右側の歯車マークからセンサーピクセルサイズや望遠鏡焦点距離などの設定を行います。'
                },
                {
                    title: '3. 対象天体の検索と導入',
                    content: '・[導入]タブでメシエ番号（M42など）やNGC番号、星名を入力して候補から天体を選択します。\n・「天体へ移動（GoTo）」をクリックすると、望遠鏡マウントがそこへ向けて自動駆動します。'
                },
                {
                    title: '4. 撮影とライブスタックの開始',
                    content: '・[撮影制御]タブで露出時間（ms）やゲインなどを設定します。\n・「プレビュー」で構図やピントを確認し、「Loop」で連続撮影を開始します。\n・「ライブスタッキング開始」を押すと、複数撮影された画像が自動でズレ補正されながら重ね合わされ、暗い星雲や星団が鮮明に浮かび上がります。'
                }
            ]
        },
        {
            title: '🔌 ドライバ接続手順と環境設定',
            subsections: [
                {
                    title: '【重要】事前準備（ドライバの別途起動）',
                    content: 'INDI / ASCOM Alpaca ともに、本アプリを使用する前に「外部ソフト上でドライバを起動完了させておく」必要があります。\n・INDIの場合: INDI Web ManagerやKStarsなどで事前にINDIサーバーと対象機器のプロファイル等を起動させます。\n・Alpacaの場合: ASCOM Platform、ASCOM Remote、またはAlpaca対応デバイス自体を別途起動させ、ネットワーク上に公開しておく必要があります。'
                },
                {
                    title: 'INDI接続（WebSocketプロトコルについて）',
                    content: '・本アプリはブラウザ上で動作する仕様上、通常のINDIポート（TCP 7624）へ直接ソケットを繋ぐことができません。\n・そのため、事前に外部で「Websockify（ウェブソキシファイ）」などの仲介サーバー等を動かし、TCPポート(7624)を『WebSocket対応の変換ポート』へと中継・変換した上で、本アプリのINDI接続設定にその変換されたポートを指定してください。'
                },
                {
                    title: 'Alpaca接続',
                    content: '・デフォルトホスト: localhost（接続先Alpacaサーバーに合わせてIPアドレスを指定してください）\n・デフォルトポート: 11111\n・ルーター、ファイアウォールなどのネットワーク設定で11111番ポートのプライベートパケット通信が許可されている必要があります。'
                },
                {
                    title: 'セキュリティとブラウザ設定 (HttpsでのMixed Content問題)',
                    content: '・HTTPS（セキュアなインターネット接続、本AI Studioプレビューを含む）で本アプリをご利用の場合、ブラウザのセキュリティ制限（Mixed Contentブロック）により、イントラネットやローカルPC上の通信（HTTP, http://localhost:6001等）へのリクエストが強制遮断されます。\n・【対策】動作を有効にするには、ブラウザのURL欄左のセキュリティ設定（鍵マークやサイト情報など）を開き、「サイトの設定」から『安全でないコンテンツ (Insecure content)』を「許可 (Allow)」に指定するか、安全なHTTP（非セキュア）の接続で本アプリを開くようにしてください。'
                },
                {
                    title: 'INDIドライバ自動起動接続機能',
                    content: '・INDI接続を選択して「接続」ボタンを押すと、サーバー側でインストールされている利用可能ドライバ群（CCDs、Telescopes、Focusers、Domes、Filter Wheels等）の一覧をダイナミックに取得します。\n・起動したいドライバを選択し、「Start & Connect」をクリックすると、サーバーサイドで必要なデバイスドライバを自動立ち上げし、シームレスに接続を開始できます。'
                }
            ]
        },
        {
            title: '🎯 プレートソルビング（Plate Solving）',
            subsections: [
                {
                    title: 'プレートソルビングとは',
                    content: '・撮影した星野写真に含まれる星々のパターンを解析し、望遠鏡が本当に向いている「正確な天球座標（赤経・赤緯）」を算出・特定する機能です。これにより、マウントの機械的ズレを補正しながら、天体を寸分狂わず視野中央に自動導入します。'
                },
                {
                    title: 'ローカルソルバー（TSPS＋Astrometry）',
                    content: '・動作ポート：【6001】\n・お手元のPCまたは同一ネットワーク内でローカル型ソルバー「Astrometry.net」および「TSPS (T-Studio Plate Solver)」のAPIサーバーを稼働して解決します。\n・インターネットが無くても動作し、1〜2秒前後で非常に高速に解析可能です。TSPSを事前に起動しておき、本アプリの設定から6001ポートのAPIへ接続するパスを指定してください。'
                },
                {
                    title: 'リモートソルバー（nova.astrometryへのプロキシ）',
                    content: '・動作プロキシポート：【6004】\n・オンライン上のパブリックサービス「Astrometry.net（nova.astrometry）」へ画像を送信して解析・解決します。インターネット接続が必須です。\n・【ポート6004の役割】ブラウザ上でCORS制限によりnova.astrometryへの直接APIリクエストが弾かれるのを防ぐため、ローカルで実行（http://localhost:3000 や http://stellarmate.local:3000 等の運用環境）している場合、本アプリはバックエンドで立ち上がっているプロキシサーバーである「6004ポート」を仲介してnova.astrometryにアクセスします。事前にAstrometry.netの「API Key」を取得・設定しておく必要があります。\n※オンライン(GitHub Pages等の非ローカル運用環境)で実行している場合は、外部オープンWebプロキシ「AllOrigins」を介した通信へとフォールバックされます。'
                },
                {
                    title: '自動センタリング機能',
                    content: '・撮影パラメータ設定後、この機能をオンにすると「撮影 → プレートソルビング → ずれ検出 → マウント自動補正」をシームレスに自動実行し、ターゲットを完全に画面の中心に捉え続けます。'
                }
            ]
        },
        {
            title: '🔗 TS-Connect ＆ Alpacaブリッジ',
            subsections: [
                {
                    title: 'Alpacaブリッジ機能とは',
                    content: '・本アプリに接続済みのINDIドライバ対応機器を、ASCOM Alpaca互換の仮想デバイスとしてネットワーク上に再公開する機能（ブリッジ＝架け橋）です。\n・これにより、本アプリをインフラ中継機として機能させ、外部の「ASCOM / Alpaca対応の天文シミュレーション・アプリや自動導入ソフトウェア」などから、本機に繋がった実機器をシームレスに操作可能にします。'
                },
                {
                    title: 'ブリッジの起動方法',
                    content: '1. 事事前に外部でINDIサーバー及び中継機を起動し、本アプリの「機材」タブからINDI接続を確立します。\n2. TS-Connectが利用可能な状態で「Alpacaブリッジ」ボタンをクリックして開始（ブリッジ機能をONにする）します。\n3. 同一LAN内の外部Alpaca対応アプリケーション等から機器が自動検出され、外部からのコマンドをINDI機材へダイレクトに転送・制御することが可能になります。'
                },
                {
                    title: 'TS-Connect スタンドアロン管理画面（/ts-connect）',
                    content: '・コントロール用のメインUIやサイドバー等を持たず、Alpacaブリッジ、INDI接続、GPS・API同期、機材管理に特化した単一のシステム連携管理フロントエンド画面です。\n・URL: http://[本機IPアドレス]:6002/ts-connect\n\nパソコン単体で表示やテストをする場合は、以下の直接リンクを開いてください。',
                    link: { text: 'TS-Connectスタンドアロン画面（/ts-connect）を開く', url: '/ts-connect', external: true }
                }
            ]
        },
        {
            title: '🖱️ アノテーション（天体情報のクリック）',
            subsections: [
                {
                    title: 'アノテーションクリック解説',
                    content: '・プレートソルビング完了後、撮影写真のビューアー上、またはスタッキングビューアー上に実在する天体の名前や識別マーカーが表示されます。\n・これらの天体枠/文字をマウスで「クリック」すると、画面に「プレビュー天体情報（PreviewModal）」が表示され、そこから様々な天文学Webリソースへ1クリックで直行できます。'
                },
                {
                    title: 'AI 天体解説 (Gemini AI)',
                    content: '・検出された主要な天体に関して、Gemini AIが歴史、内部の物理的特徴、および初心者向けの眼視・写真観測のコツを優しくまとめた多言語の天体解説カードです（インターネット接続、及びGemini API Keyが必要）。'
                },
                {
                    title: '天文学Webリソースへの自動リンク(SIMBAD / Wiki / Aladin)',
                    content: '・[Wikiで調べる]: Wikipediaの該当地点の一般解説ページへ直接リンクします。\n・[SIMBADリンク]: プロの天文学者も使用する世界最高峰の恒星/星雲星団データベース「SIMBAD」のデータベースを参照し、正式学術データを引っ張ります。\n・[Aladinで見る / Aladin Lite]: DSS（Digitized Sky Survey）の高品質実写画像をブラウザ上でズーム操作しながら、撮影した天体の元の姿と見比べることができます。'
                }
            ]
        },
        {
            title: '🌌 プラネタリウム画面（導入タブ）',
            subsections: [
                {
                    title: '表示操作とコントロール',
                    content: '・ドラッグ: 視点をシームレスに全方位へ移動します。\n・マウスホイール: 視野をダイナミックにズームイン / ズームアウトします。\n・右クリック: プラネタリウム表示の視野中心を初期化・復元します。\n・タッチ（タブレット等）: 指2本でのピンチイン・アウトに対応しています。'
                },
                {
                    title: 'DSS実写画像表示（Digitized Sky Survey）',
                    content: '・「設定」タブから「DSSを表示」ボタンをオンにし、プラネタリウムの倍率を2.0倍以上にズームアップすると、星雲や銀河のCGの位置に、Aladin Liteから取得された『実際のカラー写真（Digitized Sky Survey）』がそのまま美しく重ね合わされて表示されます。（外部データ取得のため、インターネット接続が必要です）'
                },
                {
                    title: '天の川・星座表示の設定',
                    content: '・「天の川を表示」の切り替えと明度スライダー調整、星座線、星座ラベル、明るい恒星名、星の大きさの調整スライダー。地平線のON/OFFやRa/Dec（赤道座標系）、Az/Alt（地平座標系）グリッド線の切り替えを好みに応じてカスタマイズできます。'
                }
            ]
        },
        {
            title: '📊 タブ項目 ＆ すべてのボタン機能一覧',
            subsections: [
                {
                    title: '🔌【機材】タブ (Equipment)',
                    content: '・「接続」(Connect) /「切断」(Disconnect): 外部で起動済みの各ドライバサーバーに通信セッションを開設、または遮断します。\n・「接続診断」(Diagnostics): ネットワークやポートの疎通テストを自動診断し、どこにトラブルがあるかを可視化します。\n・「ドライバスイッチ(トグル)」: 接続された主カメラ、サブマウント、マウント、フォーカサー、ドーム、フィルターホイールを個別にON/OFFします。\n・「設定」(歯車ボタン): ピクセルサイズ、焦点距離、接続アドレス等の機材ごとの固有プロパティダイアログを開き保存します。'
                },
                {
                    title: '🔭【導入】タブ (Planetarium / Target)',
                    content: '・「天体へ移動」(GoTo Target): 現在プラネタリウムで選択されている、あるいは検索して選択した天体座標に向けて、マウント望遠鏡モーターを指定駆動（導入）させます。\n・「マウント同期」(Sync): 現在選択中の天体の位置にマウント側の持っている内部天球基準座標マップを補正同期（アライメント）させ、ずれを修正します。\n・「マウント停止」(Abort / STOP): 望遠鏡の自動導入や追尾を緊急停止させ、機材同士の干渉や暴走を防ぐ安全ボタンです。\n・「推奨」(Recommended Mode): 設置された緯度経度・現在の日付から、現時刻に空で見頃を迎えているおすすめのDSO天体（星雲や銀河）を自動分析して、プラネタリウム上で目立たせます。\n・「天体情報を表示」(Object Info / AI Explanation): 選択した天体の詳細情報、およびGemini AIによるわかりやすい天文解説パネルをポップアップ表示します。'
                },
                {
                    title: '📷【撮影制御】タブ (Imaging Control)',
                    content: '・「ライブビュー」(Live View): 超高フレームレートでカメラ撮影とデータ転送をストリーミング。ピント合わせ（合焦）や視野の中心決め、極軸合わせで利用します。\n・「プレビュー」(Preview): 設定した露出(ms)で精密画質の画像を1枚撮り、即座に画像を表示・解析にかけます。\n・「Loop」(Loop Continuous): 指定露出で連続キャプチャを行います。ピント調整のリアルタイム評価や、構図確認を連続して行うのに最適です。\n・「停止」(Stop Capture): ライブビュー、単写露出、またはループ処理の実行プロセスを途中安全に強制終了します。\n・「ライブスタッキング開始/停止」(Live Stacking): 撮り溜めた複数コマをソフトウェア内部でリアルタイム演算合成。ノイズを劇的に減らし、淡い星雲等の構造をハッキリと描画します。本エンジンでは、バックエンドで以下の高度な「自動画像補正・描画パイプライン」がバックグラウンド処理としてリアルタイム適用されます。\n  ① デッドピクセル自動除去 (極端に明るい白点や色ノイズの補正)\n  ② 背景グラデーション・アンプグロー除去 (アンプ熱や光害によるかぶりをフラットに平滑化)\n  ③ エッジ保存型ノイズ除去 (画像をシャープに保ちつつ高感度ノイズをマイルドに平滑化)\n  ④ 自動ヒストグラム調整（MTF） (非線形オートストレッチを効かせ、淡い星雲ガスを見やすく画面表示)\n・「オートストレッチ」(Auto Stretch): 暗い空に沈んだ階調から天体データを自動でコントラスト最大最適調整して表示するデジタルストレッチ。元のファイル自体はそのまま変更されません。\n・「クリア」(Clear Display): 画面に保持されている前回の表示画像（スタック中の一時データ等）を破棄し、ビューを真っ白なニュートラルな状態に戻します。\n・「保存フォーマット(JPEG / PNG / TIFF / RAW / FITS)」: システム上に展開されているリアルタイム撮影（スタック完了）画像を、選択した画像データ形式でローカルデバイスPC等にダウンロードして静的に保存します。'
                },
                {
                    title: '⚙️【設定】タブ (Settings)',
                    content: '・「Web取得」(Get from Web): ブラウザのGPS/Geolocation APIを叩き、現在の緯度・経度・高度データを自動で読み込みます。\n・「デバイスから取得」(Get from Device): マウント側に現在焼き込まれている位置・経緯度・基準時刻を吸い出します。\n・「マウントに送信」(Send to Mount): 本アプリで入力した経緯度やPC内部時刻などの現在データを、相手マウント機器内部へと転送・上書き補正します。\n・「デバイスに保存」(Save Config to Localfile): カラーバランス、星図等級制限、ピクセル比、その他の設定項目一式をJSONとしてPC内にダウンロード・保存します。\n・「デバイスから読込」(Load Config from Localfile): PC内に置かれたJSON設定ファイルをアプリ内にインポートし、以前の状態を一撃で蘇らせます。\n・「Google Driveに保存/読込」: Googleクラウド認証機能を用いて、異なるPC端末間でも同じ天体撮影設定データを同期・共有管理します。'
                }
            ]
        },
        {
            title: '🔑 Gemini APIキーの設定と管理',
            subsections: [
                {
                    title: 'Gemini APIキーの必要性',
                    content: '本アプリの「AI天体解説」などのAI情報検索・解説機能を使用するには、お客様ご自身で取得したGoogle Gemini APIキーの登録が必要です。登録されたキーはブラウザのLocalStorage内にのみ安全に保管され、外部サーバーへ送信されることはありません。'
                },
                {
                    title: 'APIキーの取得手順',
                    content: '1. Google AI Studio（https://aistudio.google.com/app/apikey）にアクセスします。\n2. 「Create API Key」ボタンを押し、規約に同意してAPIキーを生成・コピーします。'
                },
                {
                    title: '登録・変更手順（登録画面リンク）',
                    content: 'APIキーを本アプリに登録、または既存のキーを変更したい場合は、下記の登録画面リンクからダイアログを開いて入力・保存を完了してください。ブラウザURLの末尾に「?set_api_key=true」を直接入力して再読込することでも呼び出せます。',
                    link: { text: 'Gemini APIキーの設定・変更画面を開く', url: '?set_api_key=true' }
                }
            ]
        },
        {
            title: '🖥️ ビューア機能（/viewer）',
            subsections: [
                {
                    title: 'ビューア機能とは',
                    content: '本アプリからサイドバーや操作タブなどのコントロール用UIを除去し、カメラから取得された撮影画像（スタッキング表示等を含む）のみをブラウザ全画面にフィットさせて表示する専用機能です。サブモニターやタブレットなどで「星像の描画のみを全画面で常時監視したい」場合に最適です。'
                },
                {
                    title: 'アクセスポートと接続リンク',
                    content: '本アプリの動作ポートである「6002」を介して、URL「/viewer」を指定して接続します。ローカルや同一LAN内の他デバイスからアクセスする場合は、下記URL構成となります。\n\n・URL: http://[本機IPアドレス]:6002/viewer\n\nパソコン単体で表示を確認、またはテストする場合は、以下の直接リンクを開いてください。',
                    link: { text: 'ビューア画面（/viewer）へ接続する', url: '/viewer', external: true }
                }
            ]
        },
        {
            title: '❓ お困りの場合 (トラブルシューティング)',
            subsections: [
                {
                    title: 'Q. 「接続エラー」や「接続診断」でエラーが表示される',
                    content: '1. 本機に繋がる本体（INDI ServerやAlpaca Server）自体が本当に外部で起動しているか再確認してください。本アプリ単体ではドライバを立ち上げられません。\n2. INDIの場合、Websocket変換中継が起動し、変換後のWebSocketポートを指定できているか確認してください。\n3. HTTPSからHTTP(localhost等)に繋ぐ際、ブラウザ設定の「安全でないコンテンツ(Mixed Content)」を有効にする、またはセキュリティ許可の設定が完了しているか確認してください。'
                },
                {
                    title: 'Q. プレートソルビングが失敗する、解析に時間がかかる',
                    content: '・ピント（フォーカス）が緩んでいたり、雲の発生、ゲイン設定が低すぎて「星が少ない（検出に必要な星が画像にまともに写っていない）」状態だと失敗します。\n・ローカルソルバーの場合は、TSPS（ポート6001）が手元のPCで正常に起動し、本アプリと繋がっているか確認してください。\n・リモートソルバー（ポート6004プロキシ）の場合は、正しいAstrometry.net의「API Key」が入力されているか再確認し、インターネット接続状態が正常であることをご確認ください。'
                }
            ]
        }
    ] : [
        {
            title: '🚀 Quick Start Guide',
            subsections: [
                {
                    title: '1. Start Drivers First (※ Most Important)',
                    content: 'This application typically requires your astronomical hardware drivers to be running externally. However, under supported environments, you can automatically run required drivers on the server side using the dynamic "INDI Driver Selection" panel during connection.'
                },
                {
                    title: '2. Connect Your Hardware',
                    content: '・Go to the [Equipment] tab and select your driver protocol.\n・Define the correct hostname and WebSocket relay/Alpaca port, then click "Connect".\n・Once connection succeeds, toggle individual switches ON to activate your specific camera, mount, focuser etc., and click the gear icon to adjust sensor specs and focal length.'
                },
                {
                    title: '3. Slew (GoTo) Objects',
                    content: '・Under the [Target] tab, type an object index (M42, NGC, etc.) or star name, select it from auto-completion, and click "GoTo Target" to slew your mount automatically.'
                },
                {
                    title: '4. Expose and Live Stack',
                    content: '・Go to the [Imaging] tab, adjust exposure time (ms) and gain.\n・Use "Preview" to confirm, "Loop" to stream continuously.\n・Click "Start Live Stacking" to accumulate frames. The software will auto-align and mathematically blend frames to reveal faint, beautiful deep sky nebulae and star clusters.'
                }
            ]
        },
        {
            title: '🔌 Driver Setup & Requirements',
            subsections: [
                {
                    title: '【Crucial】Pre-launching Drivers Externally',
                    content: 'For both INDI and ASCOM Alpaca protocols, physical device drivers must be running in external services (e.g., INDI Web Manager, kstars, ASCOM Platform, ASCOM Remote) beforehand.'
                },
                {
                    title: 'INDI Connection (WebSocket Port Rule)',
                    content: '・Browsers cannot open direct raw TCP socket ports (like default TCP 7624).\n・You must run "Websockify" or a similar bridge utility externally to relay standard TCP port 7624 into a Web-friendly WebSocket Port, and specify that converted websocket relay port in this client application setup.'
                },
                {
                    title: 'Alpaca Connection',
                    content: '・Default Host: localhost (Specify your targeted remote Alpaca IP where ASCOM Remote is running).\n・Default Port: 11111\n・Ensure firewall settings permit private packet transactions on port 11111.'
                },
                {
                    title: 'Browser Security & HTTPS Mixed Content blocks',
                    content: '・When running this app via HTTPS (e.g. this AI Studio environment), browsers block connection attempts to unencrypted local service routes (HTTP, http://localhost:6001 etc.).\n・【Solution】Click the lock icon (site settings) next to the browser URL, go to "Site Settings", find "Insecure content" and select "Allow". Alternatively, boot this application using a standard unencrypted HTTP URL.'
                },
                {
                    title: 'Dynamic INDI Driver Selection & Launcher',
                    content: '・When selecting the INDI protocol and clicking Connect, the server queries currently installed, available drivers (CCDs, Telescopes, Focusers, Domes, Filter Wheels).\n・Toggle your target drivers and click "Start & Connect" to automatically launch and run them on the server side in a single batch.'
                }
            ]
        },
        {
            title: '🎯 Plate Solving Mechanics',
            subsections: [
                {
                    title: 'What is Plate Solving?',
                    content: '・An automated astronomical algorithm which analyzes star distributions from captured images to parse the exact coordinates (RA/Dec) of the telescope field. This aligns the sky tracker mapping accurately, correcting mechanical slues.'
                },
                {
                    title: 'Local Solver (TSPS + Astrometry)',
                    content: '・Operational Port: 【6001】\n// eslint-disable-next-line \n・Provides offline solving using local installations of Astrometry.net via "TSPS (T-Studio Plate Solver)" backend on your machine.\n・Requires no internet connection and resolves fields in just 1-2 seconds. Keep TSPS running in the background and configure the 6001 route in Settings.'
                },
                {
                    title: 'Remote Solver (nova.astrometry Proxy Gateway)',
                    content: '・Operational Proxy Port: 【6004】\n・Sends frames to the official Astrometry.net (nova.astrometry.net) web API. Requires Internet.\n・【Role of Port 6004】To prevent raw CORS restriction blocks on browser clients in local deployment, the app channels raw Astrometry.net payloads through local proxy "Port 6004" when running locally (such as http://localhost:3000 or http://stellarmate.local:3000). Pre-configure the Astrometry.net "API Key" to proceed. In online deployments (GitHub Pages), the client falls back to the "AllOrigins" CORS relay.'
                },
                {
                    title: 'Auto-Centering Mode',
                    content: '・When enabled, the application seamlessly triggers "Capture → Solve field → Resolve delta → Shift/Mount corrections" to keep the targeted object in the precise center.'
                }
            ]
        },
        {
            title: '🔗 TS-Connect ＆ Alpaca Bridge',
            subsections: [
                {
                    title: 'What is the Alpaca Bridge?',
                    content: '・A transparent bridge proxy that republishes INDI-connected physical devices as virtual ASCOM Alpaca units on the network.\n・This converts your telescope rig into an ASCOM-compliant target, allowing you to control devices using advanced external planetariums or software.'
                },
                {
                    title: 'Activation Flow',
                    content: '1. Establish an active INDI connection in the "Equipment" tab.\n2. Open TS-Connect and toggle "Alpaca Bridge" to ON.\n3. External Alpaca-compatible software inside your LAN will automatically detect the devices and relay commands straight to the physical INDI drivers.'
                },
                {
                    title: 'TS-Connect Standalone Control Panel (/ts-connect)',
                    content: '・An isolated micro-control-panel optimized solely for Alpaca bridging, INDI profile startups, GPS coordinates synchronization, and hardware connectivity without standard main app overlays.\n・URL: http://[Host_IP_Address]:6002/ts-connect\n\nTo access our dedicated TS-Connect window, follow the relative path link below:',
                    link: { text: 'Open Standalone TS-Connect Panel', url: '/ts-connect', external: true }
                }
            ]
        },
        {
            title: '🖱️ Interstellar Catalog Clicking (Annotations)',
            subsections: [
                {
                    title: 'How It Works',
                    content: '・After solving a field, a vector annotation overlay overlays known astronomical targets in the viewport.\n・Clicking on these labels/outlines opens a detail preview menu (PreviewModal), letting you deep dive into astronomical registries in 1 click.'
                },
                {
                    title: 'AI Astronomical Commentary (Gemini AI)',
                    content: '・Retrieves detailed notes, structural physics, history, and handy observation suggestions using Gemini AI (Requires Internet and Gemini API key configuration).'
                },
                {
                    title: 'Web Registry Integrations (SIMBAD / Wiki / Aladin)',
                    content: '・[Wiki Search]: Explores Wikipedia listings for historical background.\n・[SIMBAD Link]: Coordinates with SIMBAD, the gold-standard observatory catalog, for professional research logs.\n・[Aladin Viewer]: Loads an interactive Aladin Lite container, showing DSS high-fidelity images of the target to compare with your capture.'
                }
            ]
        },
        {
            title: '🌌 Interactive Planetarium (Target Tab)',
            subsections: [
                {
                    title: 'User Interface Map Navigation',
                    content: '・Drag: Panning across the celestial sphere.\n・Scroll Wheel: Seamlessly zoom-in/out to inspect fields.\n・Right Click: Resets the viewport center to default settings.\n・Touch controls: Pinch-to-zoom is supported.'
                },
                {
                    title: 'Actual DSS Overlay (Digitized Sky Survey)',
                    content: '・Toggle "Show DSS" in Settings and zoom in beyond 2.0x in the planetarium. Actual astrophotography tiles from the Digitized Sky Survey smoothly overlay on Deep Sky Objects (Requires internet connection to stream from Aladin Lite server).'
                },
                {
                    title: 'Visual Options',
                    content: '・Toggle constellation borders, star label caps, Milky Way layers, grid lines (Az/Alt horizontal or RA/Dec equatorial), local horizon indicators, and star sizing parameters to fit screen density.'
                }
            ]
        },
        {
            title: '📊 Tab Panels ＆ Every Icon Button Guide',
            subsections: [
                {
                    title: '🔌【Equipment】Tab (機材)',
                    content: '・"Connect" / "Disconnect": Open/close terminal sessions to your external ASCOM/INDI servers.\n・"Diagnostics": Runs automated diagnostic checks to catch network or mixed content blocks.\n・"Device Switches (Toggle)": Toggles power to cameras, mounts, focusers, domes, and filter wheels individually.\n・"Settings" (Gear Icon): Fine-tunes sensor pixel pitch, scope aperture, focal specs, and custom connection IPs.'
                },
                {
                    title: '🔭【Target / Planetarium】Tab (導入)',
                    content: '・"GoTo Target": Commands the mount motor to slew toward selected orbital objects.\n・"Sync": Syncs current targeted spatial coordinates to the mount mapping database to align physical points.\n・"Abort/STOP Mount": Immediately halts physical motors to protect equipment from crash risks or cable binds.\n・"Recommended": Auto-gathers and highlights seasonal star clouds and dark dust lanes optimal for your location.\n・"Object Info": Opens deep spatial details and AI commentary cards.'
                },
                {
                    title: '📷【Imaging】Tab (撮影制御)',
                    content: '・"Live View": High-speed video streaming. Used for focus tracking, star aiming, or alignment diagnostics.\n・"Preview": Snap a premium single-frame image at defined exposure parameters for analysis.\n・"Loop": Continuously capture frame data. Excellent for refining target framing or live-judging focus.\n・"Stop": Halts any active imaging streams cleanly.\n・"Start/Stop Live Stacking": Sums and average-aligns photos live. Automatically cancels background sensor noise, yielding rich deep-space nebulosities. Four key high-performance real-time processing operations are silently coordinated in the background:\n  1) Dead Pixel Removal (cleaning rogue hot & cold spots).\n  2) Background Gradient & Amp-glow Removal (smoothly flattening light pollution gradients & sensor thermal glow).\n  3) Noise Reduction (applying an edge-preserving bilateral filter to suppress static noise pixels).\n  4) Auto Histogram Stretch (utilizing MTF transfer curves to scale faint interstellar objects automatically).\n"Auto Stretch": Intelligently adjusts displays to reveal faint deep-sky nebulae. Original captured pixel counts are not compromised.\n・"Clear": Resets active stacking buffers and clears viewports.\n・"Save image formats (JPEG / PNG / TIFF / RAW)": Direct export of active frame buffers to local drive files.'
                },
                {
                    title: '⚙️【Settings】Tab (設定)',
                    content: '・"Get from Web": Runs Geolocation requests to obtain current latitude/longitude.\n・"Get from Device": Loads Mount internal alignment registers.\n・"Send to Mount": Sets coordinates and computer clock times to your physical mount registers.\n・"Save to Local Device": Exports global profile variables to setup JSON files.\n// eslint-disable-next-line \n・"Load from Local Device": Re-imports profile parameters from local JSON backups.\n・"Google Drive Sync": Backs up or loads custom calibration parameters to Google Cloud Storage.'
                }
            ]
        },
        {
            title: '🔑 Gemini API Key & Management',
            subsections: [
                {
                    title: 'Why Gemini API Key is Required?',
                    content: 'To power our dynamic astronomical AI description cards, a personal Google Gemini API key must be registered. This token is securely kept in your local browser storage (LocalStorage) and is never transmitted to other cloud servers.'
                },
                {
                    title: 'How to Retrieve an API Key',
                    content: '1. Navigate to Google AI Studio at https://aistudio.google.com/app/apikey\n2. Click "Create API Key", accept terms, and copy your API string.'
                },
                {
                    title: 'Setup & Change Procedure',
                    content: 'Open the API key setup dialogue using the link below to enter or modify your token. You can also trigger this by appending "?set_api_key=true" to your browser URL and refreshing.',
                    link: { text: 'Open Gemini API Key Registration Dialog', url: '?set_api_key=true' }
                }
            ]
        },
        {
            title: '🖥️ Standard Viewer Mode (/viewer)',
            subsections: [
                {
                    title: 'What is Viewer Mode?',
                    content: 'An independent layout displaying camera feeds / active stacks in full screen, completely omitting sidebar drawers and setup control widgets. It is designed for remote tablets or auxiliary displays strictly dedicated to viewing celestial captures.'
                },
                {
                    title: 'Operational Port & Route Link',
                    content: 'Accessible via port "6002" pointing to the "/viewer" subdirectory path. From devices in your local LAN, target:\n\n・Address: http://[Host_IP_Address]:6002/viewer\n\nTo view or debug on your active station, follow the local relative path link below.',
                    link: { text: 'Connect to Active Viewer (/viewer)', url: '/viewer', external: true }
                }
            ]
        },
        {
            title: '❓ Troubleshooting & Diagnostic Steps',
            subsections: [
                {
                    title: 'Q: Equipment fails "Diagnostics" or "Connect" operations',
                    content: '1. Verify your external INDI/Alpaca server profiles are fully operational first. This web instance cannot start physical hardware.\n2. Ensure INDI uses Websockify forwarding to convert TCP 7624 to a Websocket-ready channel.\n3. Make sure to enable "Insecure content (Mixed Content)" in your browser settings if running on HTTPS.'
                },
                {
                    title: 'Q: Plate solving fails or stays on pending loop',
                    content: '・Analyze focus and exposure. Weak star signals or star blobs make pattern parsing impossible.\n・If local, check TSPS (Port 6001) is active on your host PC.\n・If remote, ensure a correct Astrometry.net API Key is configured and your network is online.'
                }
            ]
        }
    ];

    return (
        <div className="fixed inset-0 bg-black/80 z-[200] flex items-center justify-center p-4">
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
                                            <div className="pl-3 border-l-2 border-slate-700 space-y-2">
                                                <p className="text-xs text-slate-400 whitespace-pre-wrap leading-relaxed">
                                                    {subsection.content}
                                                </p>
                                                {subsection.link && (
                                                    <div className="pt-1">
                                                        <a
                                                            href={subsection.link.url}
                                                            target={subsection.link.external ? "_blank" : undefined}
                                                            rel={subsection.link.external ? "noopener noreferrer" : undefined}
                                                            className="text-xs text-red-400 hover:text-red-300 underline inline-flex items-center gap-1 font-medium bg-red-900/10 hover:bg-red-900/20 px-2 py-1 rounded transition-colors"
                                                            onClick={subsection.link.url.startsWith('?') ? (e) => {
                                                                e.preventDefault();
                                                                window.location.search = subsection.link!.url;
                                                            } : undefined}
                                                        >
                                                            {subsection.link.text} →
                                                        </a>
                                                    </div>
                                                )}
                                            </div>
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
