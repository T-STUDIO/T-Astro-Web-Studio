import { Request, Response, Application } from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import { spawn, exec, ChildProcess } from 'child_process';
import net from 'net';
import fs from 'fs';
import path from 'path';

// Memory fallback of typical INDI Drivers for robustness in environments with no /usr/share/indi
const FALLBACK_DRIVERS = [
    { name: 'CCD Simulator', bin: 'indi_simulator_ccd', group: 'CCDs' },
    { name: 'Telescope Simulator', bin: 'indi_simulator_telescope', group: 'Telescopes' },
    { name: 'ZWO CCD', bin: 'indi_zwo_ccd', group: 'CCDs' },
    { name: 'QHY CCD', bin: 'indi_qhy_ccd', group: 'CCDs' },
    { name: 'GPhoto CCD', bin: 'indi_gphoto_ccd', group: 'CCDs' },
    { name: 'Atik CCD', bin: 'indi_atik_ccd', group: 'CCDs' },
    { name: 'SVBony CCD', bin: 'indi_svbony_ccd', group: 'CCDs' },
    { name: 'EQMod Mount', bin: 'indi_eqmod_telescope', group: 'Telescopes' },
    { name: 'LX200 Basic GP', bin: 'indi_lx200basic', group: 'Telescopes' },
    { name: 'Celestron GPS', bin: 'indi_celestron_gps', group: 'Telescopes' },
    { name: 'SynScan Mount', bin: 'indi_synscan', group: 'Telescopes' },
    { name: 'ZWO EAF Focuser', bin: 'indi_zwo_eaf', group: 'Focusers' },
    { name: 'MyFocuserPro2', bin: 'indi_myfocuserpro2', group: 'Focusers' },
    { name: 'MoonLite Focuser', bin: 'indi_moonlite', group: 'Focusers' },
    { name: 'INDI Rolldome', bin: 'indi_roll_dome', group: 'Domes' },
    { name: 'Filter Wheel (ASI)', bin: 'indi_asi_wheel', group: 'Filter Wheels' }
];

interface DriverInfo {
    name: string;
    bin: string;
    group: string;
}

export class IndiDriverManager {
    private static instance: IndiDriverManager | null = null;
    private activeIndiProcess: ChildProcess | null = null;
    private bridgeWsServer: WebSocketServer | null = null;
    private currentBridgePort: number = 8625; // デフォルト 8625
    private currentTargetHost: string = '127.0.0.1'; // デフォルト 127.0.0.1

    private constructor() {}

    public static getInstance(): IndiDriverManager {
        if (!IndiDriverManager.instance) {
            IndiDriverManager.instance = new IndiDriverManager();
        }
        return IndiDriverManager.instance;
    }

    /**
     * XMLファイルおよびフォールバック一覧からINDIドライバ情報を走査・取得する
     */
    public getAvailableDrivers(): DriverInfo[] {
        const driversList: DriverInfo[] = [];
        const seenBins = new Set<string>();
        const indiXmlDir = '/usr/share/indi';

        try {
            if (fs.existsSync(indiXmlDir)) {
                const files = fs.readdirSync(indiXmlDir);
                for (const file of files) {
                    if (file.endsWith('.xml')) {
                        const filePath = path.join(indiXmlDir, file);
                        const content = fs.readFileSync(filePath, 'utf-8');
                        
                        // ロバストな抽出処理：属性の並び順が変則的、または改行や子タグ形式になっている場合にも対応します。
                        const blockRegex = /<(driver|device)\b([^>]*?)>([\s\S]*?)<\/\1>/gi;
                        let blockMatch;
                        while ((blockMatch = blockRegex.exec(content)) !== null) {
                            const attrs = blockMatch[2];
                            const inner = blockMatch[3];
                            
                            // name の抽出：属性、または子要素から
                            let name = '';
                            const nameAttrMatch = /name=["']([^"']+)["']/i.exec(attrs);
                            if (nameAttrMatch) {
                                name = nameAttrMatch[1];
                            } else {
                                const nameTagMatch = /<name>([\s\S]*?)<\/name>/i.exec(inner);
                                if (nameTagMatch) name = nameTagMatch[1].trim();
                            }
                            
                            // bin の抽出：属性、または子要素から
                            let bin = '';
                            const binAttrMatch = /bin=["']([^"']+)["']/i.exec(attrs);
                            if (binAttrMatch) {
                                bin = binAttrMatch[1];
                            } else {
                                const binTagMatch = /<bin>([\s\S]*?)<\/bin>/i.exec(inner);
                                if (binTagMatch) bin = binTagMatch[1].trim();
                            }
                            
                            if (name && bin) {
                                // グループの自動判定
                                let group = 'CCDs'; // デフォルト
                                let rawGroup = '';
                                const groupAttrMatch = /group=["']([^"']+)["']/i.exec(attrs);
                                if (groupAttrMatch) {
                                    rawGroup = groupAttrMatch[1];
                                } else {
                                    const groupTagMatch = /<group>([\s\S]*?)<\/group>/i.exec(inner);
                                    if (groupTagMatch) {
                                        rawGroup = groupTagMatch[1].trim();
                                    }
                                }

                                if (rawGroup) {
                                    const rgLower = rawGroup.toLowerCase();
                                    if (rgLower.includes('telescope') || rgLower.includes('mount') || rgLower.includes('lx200') || rgLower.includes('eqmod') || rgLower.includes('gps')) {
                                        group = 'Telescopes';
                                    } else if (rgLower.includes('focuser') || rgLower.includes('focus')) {
                                        group = 'Focusers';
                                    } else if (rgLower.includes('dome') || rgLower.includes('roll_dome')) {
                                        group = 'Domes';
                                    } else if (rgLower.includes('wheel') || rgLower.includes('filter')) {
                                        group = 'Filter Wheels';
                                    } else if (rgLower.includes('ccd') || rgLower.includes('camera') || rgLower.includes('video') || rgLower.includes('gphoto')) {
                                        group = 'CCDs';
                                    } else {
                                        group = 'Others';
                                    }
                                } else {
                                    const mergedContent = (attrs + " " + inner).toLowerCase();
                                    if (mergedContent.includes('telescope') || mergedContent.includes('mount') || mergedContent.includes('lx200') || mergedContent.includes('eqmod') || mergedContent.includes('gps')) {
                                        group = 'Telescopes';
                                    } else if (mergedContent.includes('focuser') || mergedContent.includes('focus')) {
                                        group = 'Focusers';
                                    } else if (mergedContent.includes('dome') || mergedContent.includes('roll_dome')) {
                                        group = 'Domes';
                                    } else if (mergedContent.includes('wheel') || mergedContent.includes('filter')) {
                                        group = 'Filter Wheels';
                                    } else if (mergedContent.includes('ccd') || mergedContent.includes('camera') || mergedContent.includes('video') || mergedContent.includes('gphoto')) {
                                        group = 'CCDs';
                                    } else {
                                        group = 'Others';
                                    }
                                }
                                
                                if (!seenBins.has(bin)) {
                                    seenBins.add(bin);
                                    driversList.push({ name, bin, group });
                                }
                            }
                        }
                    }
                }
            }
        } catch (e) {
            console.error('[IndiDriverManager] Error scanning /usr/share/indi:', e);
        }

        // 足りない分・または空の場合にフォールバックデータをマージ
        for (const fDrv of FALLBACK_DRIVERS) {
            if (!seenBins.has(fDrv.bin)) {
                seenBins.add(fDrv.bin);
                driversList.push(fDrv);
            }
        }

        return driversList;
    }

    /**
     * 指定されたドライバを indiserver コマンドで一括起動する（安全な終了・起動）
     */
    public startIndiServer(selectedDrivers: string[]): Promise<{ status: string; message: string }> {
        return new Promise((resolve) => {
            console.log(`[IndiDriverManager] Starting indiserver with drivers:`, selectedDrivers);
            
            // 1. 既存の indiserver プロセス、および今回のドライバ関連の古いプロセスを安全クリーンアップ
            this.stopIndiServer();

            // 外部コマンドで強制的なキルも叩いておく
            exec('pkill -9 indiserver || true', () => {
                // pkill が終わったら起動
                setTimeout(() => {
                    if (selectedDrivers.length === 0) {
                        return resolve({ status: 'ok', message: 'All driver processes cleared.' });
                    }

                    // 2. indiserver をバックグラウンドで起動
                    // indiserver -p 7624 がデフォルト
                    const args = ['-p', '7624', '-v', ...selectedDrivers];
                    
                    try {
                        console.log(`[IndiDriverManager] Spawning: indiserver ${args.join(' ')}`);
                        const proc = spawn('indiserver', args, {
                            detached: true,
                            stdio: 'ignore'
                        });

                        this.activeIndiProcess = proc;
                        proc.unref(); // 親プロセスから独立させて非同期に稼働し続ける

                        let hasErrored = false;
                        const errorHandler = (err: any) => {
                            console.error('[IndiDriverManager] Failed to spawn indiserver:', err);
                            hasErrored = true;
                            if (this.activeIndiProcess === proc) {
                                this.activeIndiProcess = null;
                            }
                            resolve({ status: 'error', message: `Failed to spawn indiserver: ${err.message}` });
                        };

                        proc.on('error', errorHandler);

                        proc.on('exit', (code, signal) => {
                            console.log(`[IndiDriverManager] indiserver exited with code ${code}, signal ${signal}`);
                            if (this.activeIndiProcess === proc) {
                                this.activeIndiProcess = null;
                            }
                        });

                        // 300ms 待ってエラーが起きなければ、無事 spawn 成功したと見なして resolve する
                        setTimeout(() => {
                            if (proc && proc.off) {
                                proc.off('error', errorHandler); // 初期起動監視終了のためリスナー解除
                            }
                            if (!hasErrored) {
                                resolve({ status: 'ok', message: `Successfully started indiserver with ${selectedDrivers.length} drivers: ${selectedDrivers.join(', ')}` });
                            }
                        }, 300);

                    } catch (err: any) {
                        console.error('[IndiDriverManager] Error spawning indiserver:', err);
                        resolve({ status: 'error', message: `Failed to spawn indiserver: ${err.message}` });
                    }
                }, 500);
            });
        });
    }

    public stopIndiServer(): void {
        if (this.activeIndiProcess) {
            console.log('[IndiDriverManager] Stopping active indiserver process...');
            try {
                this.activeIndiProcess.kill('SIGTERM');
            } catch (err) {
                console.error('[IndiDriverManager] Error killing indiserver process:', err);
            }
            this.activeIndiProcess = null;
        }
    }

    /**
     * WebSocket-TCPブリッジ of 起動・再設定
     */
    public configureBridgePort(port: number, host?: string) {
        if (host) {
            const trimmedHost = host.trim();
            this.currentTargetHost = trimmedHost === '' || trimmedHost === 'localhost' ? '127.0.0.1' : trimmedHost;
        }

        let solvedPort = port;
        // 開発環境のWeb Consoleポート(3000)やExpressサーバーポート(6002)との競合・起動不全を防ぐための安全な補正
        if (solvedPort === 3000 || solvedPort === 6002) {
            console.warn(`[IndiDriverManager] Port ${solvedPort} is restricted or busy by web servers. Overriding to safe default port 8625.`);
            solvedPort = 8625;
        }

        // 保存された設定ファイルに永続化させる
        const CONFIG_FILE = path.join(process.cwd(), 'indi_config.json');
        try {
            fs.writeFileSync(CONFIG_FILE, JSON.stringify({ port: solvedPort, host: this.currentTargetHost }), 'utf-8');
            console.log(`[IndiDriverManager] Saved configuration to ${CONFIG_FILE}: port ${solvedPort}, host ${this.currentTargetHost}`);
        } catch (e) {
            console.error('[IndiDriverManager] Failed to write config file:', e);
        }

        if (this.currentBridgePort === solvedPort && this.bridgeWsServer) {
            console.log(`[IndiDriverManager] Bridge already running on port ${solvedPort} targeting ${this.currentTargetHost}, skipping allocation.`);
            return;
        }

        console.log(`[IndiDriverManager] Reconfiguring WebSocket-TCP Bridge to port: ${solvedPort} targeting ${this.currentTargetHost}`);
        
        // 既存の WebSocket サーバーを安全に閉じる
        if (this.bridgeWsServer) {
            try {
                this.bridgeWsServer.close(() => {
                    console.log('[IndiDriverManager] Previous WebSocket Bridge shut down successfully.');
                });
            } catch (e) {
                console.error('[IndiDriverManager] Error closing previous WS server:', e);
            }
            this.bridgeWsServer = null;
        }

        this.currentBridgePort = solvedPort;

        try {
            // 新たな WebSocket サーバーをバインド
            const wsServer = new WebSocketServer({ port: this.currentBridgePort, host: '0.0.0.0' });
            this.bridgeWsServer = wsServer;
            
            console.log(`[IndiDriverManager] WebSocket-TCP Bridge listening on ws://0.0.0.0:${this.currentBridgePort} proxying to ${this.currentTargetHost}:7624`);

            wsServer.on('error', (err: any) => {
                console.error(`[IndiDriverManager] WebSocket Bridge Server Error on port ${this.currentBridgePort}:`, err);
            });

            wsServer.on('connection', (wsClient: WebSocket) => {
                console.log(`[IndiBridge] Browser WebSocket client linked. Opening TCP socket connection to ${this.currentTargetHost}:7624...`);

                // TCPソケットで実際の INDIサーバ(TCP 7624)へ接続を中継する
                const tcpSocket = net.createConnection({ host: this.currentTargetHost, port: 7624 }, () => {
                    console.log(`[IndiBridge] Connected successfully to INDI TCP Server (${this.currentTargetHost}:7624).`);
                });

                // プロセス破壊を防ぐ重大なエラーハンドリング
                tcpSocket.on('error', (err: any) => {
                    console.error(`[IndiBridge] TCP Socket Error on ${this.currentTargetHost}:7624:`, err.message);
                    wsClient.close();
                });

                // WebSocket -> TCP
                wsClient.on('message', (message: any, isBinary: boolean) => {
                    if (tcpSocket.writable) {
                        tcpSocket.write(message);
                    }
                });

                // TCP -> WebSocket
                tcpSocket.on('data', (data: Buffer) => {
                    if (wsClient.readyState === WebSocket.OPEN) {
                        wsClient.send(data, { binary: true });
                    }
                });

                // クローズ、エラー連動処理
                wsClient.on('close', () => {
                    console.log(`[IndiBridge] Browser WS Client disconnected.`);
                    tcpSocket.destroy();
                });

                wsClient.on('error', (err) => {
                    console.error('[IndiBridge] Browser WS Error:', err.message);
                    tcpSocket.destroy();
                });

                tcpSocket.on('close', () => {
                    console.log(`[IndiBridge] INDI TCP Server connection closed.`);
                    wsClient.close();
                });
            });

        } catch (err) {
            console.error(`[IndiDriverManager] Error binding WebSocket Bridge Server to port ${this.currentBridgePort}:`, err);
        }
    }
}

/**
 * Express への API エンドポイント登録と初期バインド用
 */
export function registerIndiDriverManager(app: Application) {
    const manager = IndiDriverManager.getInstance();

    // 保管された設定ファイルを読み込む
    const CONFIG_FILE = path.join(process.cwd(), 'indi_config.json');
    let initPort = 8625;
    let initHost = '127.0.0.1';
    try {
        if (fs.existsSync(CONFIG_FILE)) {
            const configData = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
            if (configData.port && typeof configData.port === 'number') {
                initPort = configData.port;
            }
            if (configData.host && typeof configData.host === 'string') {
                initHost = configData.host;
            }
            console.log(`[IndiDriverManager] Loaded saved startup configuration: port ${initPort}, host ${initHost}`);
        }
    } catch (e) {
        console.error('[IndiDriverManager] Error reading startup configuration:', e);
    }

    // 保存ポートまたはデフォルトポートでブリッジを常時起動
    manager.configureBridgePort(initPort, initHost);

    // 1. 利用可能なドライバ一覧の取得 API
    app.get('/api/indi/drivers', (req: Request, res: Response) => {
        try {
            const drivers = manager.getAvailableDrivers();
            res.json({ status: 'ok', drivers });
        } catch (error: any) {
            res.status(500).json({ status: 'error', message: error.message });
        }
    });

    // 2. ドライバの一括起動&停止 API
    app.post('/api/indi/start', async (req: Request, res: Response) => {
        try {
            const { drivers } = req.body;
            if (!Array.isArray(drivers)) {
                return res.status(400).json({ status: 'error', message: 'drivers parameter must be an array of binary strings.' });
            }

            const result = await manager.startIndiServer(drivers);
            res.json(result);
        } catch (error: any) {
            res.status(500).json({ status: 'error', message: error.message });
        }
    });

    // 3. 中継ポートの再バインド API
    app.post('/api/indi/configure-port', (req: Request, res: Response) => {
        try {
            const { port, host } = req.body;
            if (!port || typeof port !== 'number') {
                return res.status(400).json({ status: 'error', message: 'port parameter is required as a number.' });
            }

            manager.configureBridgePort(port, host);
            res.json({ status: 'ok', message: `Bridge configured on port ${port} target to ${host || 'default'}` });
        } catch (error: any) {
            res.status(500).json({ status: 'error', message: error.message });
        }
    });
}
