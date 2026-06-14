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
     * 保存されている分類やドライバ名一覧を available_drivers_cache.json から読み込む
     */
    public getAvailableDrivers(): DriverInfo[] {
        const cachePath = path.join(process.cwd(), 'available_drivers_cache.json');
        try {
            if (fs.existsSync(cachePath)) {
                const content = fs.readFileSync(cachePath, 'utf-8');
                return JSON.parse(content);
            }
        } catch (e) {
            console.error('[IndiDriverManager] Failed to read available_drivers_cache.json:', e);
        }
        return [];
    }

    /**
     * XMLを読み込み、分類に分けてドライバ名を抽出してファイル (available_drivers_cache.json) に保存する
     */
    public scanAndSaveDrivers(): void {
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
                        
                        // 1. devGroup ごとにブロック分割を試みる
                        const devGroupRegex = /<devGroup\s+group=["']([^"']+)["'][^>]*?>([\s\S]*?)<\/devGroup>/gi;
                        let groupMatch;
                        let hasGroups = false;
                        
                        while ((groupMatch = devGroupRegex.exec(content)) !== null) {
                            hasGroups = true;
                            const rawGroup = groupMatch[1];
                            const groupInner = groupMatch[2];
                            
                            // devGroup内の device を抽出
                            const deviceRegex = /<device\b([^>]*?)>([\s\S]*?)<\/device>/gi;
                            let deviceMatch;
                            while ((deviceMatch = deviceRegex.exec(groupInner)) !== null) {
                                const deviceAttrs = deviceMatch[1];
                                const deviceInner = deviceMatch[2];
                                
                                const deviceLabelMatch = /label=["']([^"']+)["']/i.exec(deviceAttrs);
                                const deviceLabel = deviceLabelMatch ? deviceLabelMatch[1] : '';

                                // device内の driver を抽出
                                const driverRegex = /<driver\b([^>]*?)>([\s\S]*?)<\/driver>/gi;
                                let driverMatch;
                                while ((driverMatch = driverRegex.exec(deviceInner)) !== null) {
                                    const driverAttrs = driverMatch[1];
                                    const binVal = driverMatch[2].trim();
                                    
                                    const driverNameMatch = /name=["']([^"']+)["']/i.exec(driverAttrs);
                                    const driverName = driverNameMatch ? driverNameMatch[1].trim() : (deviceLabel || binVal);
                                    
                                    if (binVal) {
                                        const group = this.mapGroup(rawGroup, deviceAttrs + " " + deviceInner);
                                        if (!seenBins.has(binVal)) {
                                            seenBins.add(binVal);
                                            driversList.push({ name: driverName, bin: binVal, group });
                                        }
                                    }
                                }
                            }
                        }
                        
                        // 2. devGroup がない、あるいはうまくパースできなかった場合のフラットな走査
                        if (!hasGroups) {
                            // device単体の走査
                            const deviceRegex = /<device\b([^>]*?)>([\s\S]*?)<\/device>/gi;
                            let deviceMatch;
                            let hasDevices = false;
                            
                            while ((deviceMatch = deviceRegex.exec(content)) !== null) {
                                hasDevices = true;
                                const deviceAttrs = deviceMatch[1];
                                const deviceInner = deviceMatch[2];
                                
                                const deviceLabelMatch = /label=["']([^"']+)["']/i.exec(deviceAttrs);
                                const deviceLabel = deviceLabelMatch ? deviceLabelMatch[1] : '';

                                const driverRegex = /<driver\b([^>]*?)>([\s\S]*?)<\/driver>/gi;
                                let driverMatch;
                                while ((driverMatch = driverRegex.exec(deviceInner)) !== null) {
                                    const driverAttrs = driverMatch[1];
                                    const binVal = driverMatch[2].trim();
                                    
                                    const driverNameMatch = /name=["']([^"']+)["']/i.exec(driverAttrs);
                                    const driverName = driverNameMatch ? driverNameMatch[1].trim() : (deviceLabel || binVal);
                                    
                                    if (binVal) {
                                        const group = this.mapGroup('', deviceAttrs + " " + deviceInner + " " + driverAttrs);
                                        if (!seenBins.has(binVal)) {
                                            seenBins.add(binVal);
                                            driversList.push({ name: driverName, bin: binVal, group });
                                        }
                                    }
                                }
                            }
                            
                            // さらに、deviceタグすらなく、driverタグだけの超フラットな個別ファイルである場合
                            if (!hasDevices) {
                                const driverRegex = /<driver\b([^>]*?)>([\s\S]*?)<\/driver>/gi;
                                let driverMatch;
                                while ((driverMatch = driverRegex.exec(content)) !== null) {
                                    const driverAttrs = driverMatch[1];
                                    const innerText = driverMatch[2].trim();
                                    
                                    let binVal = '';
                                    let driverName = '';
                                    
                                    const nameMatch = /name=["']([^"']+)["']/i.exec(driverAttrs);
                                    if (nameMatch) {
                                        driverName = nameMatch[1].trim();
                                    }
                                    
                                    // タグの中身がバイナリ名か（改行や <bin> タグがないかチェック）
                                    if (innerText.includes('<bin>')) {
                                        const binTagMatch = /<bin>([\s\S]*?)<\/bin>/i.exec(innerText);
                                        if (binTagMatch) binVal = binTagMatch[1].trim();
                                    } else if (!innerText.includes('<')) {
                                        binVal = innerText;
                                    }
                                    
                                    if (binVal) {
                                        if (!driverName) {
                                            driverName = binVal;
                                        }
                                        const group = this.mapGroup('', driverAttrs + " " + innerText);
                                        if (!seenBins.has(binVal)) {
                                            seenBins.add(binVal);
                                            driversList.push({ name: driverName, bin: binVal, group });
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        } catch (e) {
            console.error('[IndiDriverManager] Error scanning /usr/share/indi:', e);
        }

        const cachePath = path.join(process.cwd(), 'available_drivers_cache.json');
        try {
            fs.writeFileSync(cachePath, JSON.stringify(driversList, null, 2), 'utf-8');
            console.log(`[IndiDriverManager] Scanned and saved ${driversList.length} drivers to ${cachePath}`);
        } catch (e) {
            console.error('[IndiDriverManager] Failed to write available_drivers_cache.json:', e);
        }
    }

    private mapGroup(rawGroup: string, searchContext: string): string {
        const targetGroup = rawGroup || '';
        if (targetGroup) {
            const tgLower = targetGroup.toLowerCase();
            if (tgLower.includes('telescope') || tgLower.includes('mount') || tgLower.includes('lx200') || tgLower.includes('eqmod') || tgLower.includes('gps')) {
                return 'Telescopes';
            } else if (tgLower.includes('focuser') || tgLower.includes('focus')) {
                return 'Focusers';
            } else if (tgLower.includes('dome') || tgLower.includes('roll_dome')) {
                return 'Domes';
            } else if (tgLower.includes('wheel') || tgLower.includes('filter')) {
                return 'Filter Wheels';
            } else if (tgLower.includes('ccd') || tgLower.includes('camera') || tgLower.includes('video') || tgLower.includes('gphoto') || tgLower.includes('guide')) {
                return 'CCDs';
            } else if (tgLower.includes('spectrograph')) {
                return 'Spectrographs';
            } else if (tgLower.includes('rotator')) {
                return 'Rotators';
            } else if (tgLower.includes('weather')) {
                return 'Weather';
            } else if (tgLower.includes('power')) {
                return 'Power';
            } else if (tgLower.includes('auxiliary') || tgLower.includes('aux')) {
                return 'Auxiliary';
            }
        }

        const mergedLower = searchContext.toLowerCase();
        if (mergedLower.includes('telescope') || mergedLower.includes('mount') || mergedLower.includes('lx200') || mergedLower.includes('eqmod') || mergedLower.includes('gps')) {
            return 'Telescopes';
        } else if (mergedLower.includes('focuser') || mergedLower.includes('focus')) {
            return 'Focusers';
        } else if (mergedLower.includes('dome') || mergedLower.includes('roll_dome')) {
            return 'Domes';
        } else if (mergedLower.includes('wheel') || mergedLower.includes('filter')) {
            return 'Filter Wheels';
        } else if (mergedLower.includes('ccd') || mergedLower.includes('camera') || mergedLower.includes('video') || mergedLower.includes('gphoto') || mergedLower.includes('guide')) {
            return 'CCDs';
        } else if (mergedLower.includes('spectrograph')) {
            return 'Spectrographs';
        } else if (mergedLower.includes('rotator')) {
            return 'Rotators';
        } else if (mergedLower.includes('weather')) {
            return 'Weather';
        } else if (mergedLower.includes('power')) {
            return 'Power';
        } else if (mergedLower.includes('auxiliary') || mergedLower.includes('aux')) {
            return 'Auxiliary';
        }
        return 'Others';
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
        this.scanAndSaveDrivers(); // XMLをスキャンしてドライバキャッシュを保存

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
