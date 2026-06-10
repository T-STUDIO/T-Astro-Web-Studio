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
                        
                        // XML内の <driver name="..." bin="..."> もしくは <deviceGroup group="..."> などを簡易パース
                        // 例： <driver name="ZWO CCD" bin="indi_zwo_ccd">
                        const driverRegex = /<driver\s+[^>]*name=["']([^"']+)["']\s+[^>]*bin=["']([^"']+)["'][^>]*>/g;
                        let match;
                        while ((match = driverRegex.exec(content)) !== null) {
                            const name = match[1];
                            const bin = match[2];
                            
                            // グループをXMLコンテンツから簡易推測
                            let group = 'CCDs'; // デフォルト
                            if (content.includes('group="Telescopes"') || content.includes('group="Mounts"')) group = 'Telescopes';
                            else if (content.includes('group="Focusers"')) group = 'Focusers';
                            else if (content.includes('group="Domes"')) group = 'Domes';
                            else if (content.includes('group="Filter Wheels"')) group = 'Filter Wheels';

                            if (!seenBins.has(bin)) {
                                seenBins.add(bin);
                                driversList.push({ name, bin, group });
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
            exec('pkill -9 -f indiserver || true', () => {
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
                        this.activeIndiProcess = spawn('indiserver', args, {
                            detached: true,
                            stdio: 'ignore'
                        });

                        this.activeIndiProcess.unref(); // 親プロセスから独立させて非同期に稼働し続ける

                        this.activeIndiProcess.on('error', (err) => {
                            console.error('[IndiDriverManager] Failed to spawn indiserver:', err);
                        });

                        this.activeIndiProcess.on('exit', (code, signal) => {
                            console.log(`[IndiDriverManager] indiserver exited with code ${code}, signal ${signal}`);
                            this.activeIndiProcess = null;
                        });

                        resolve({ status: 'ok', message: `Successfully started indiserver with ${selectedDrivers.length} drivers: ${selectedDrivers.join(', ')}` });
                    } catch (err: any) {
                        console.error('[IndiDriverManager] Error spawning indiserver:', err);
                        resolve({ status: 'error', message: `Failed to spawn indiserver: ${err.message}` });
                    }
                }, 500);
            });
        });
    }

    /**
     * 稼働中の indiserver プロセスを安全に終了
     */
    public stopIndiServer() {
        if (this.activeIndiProcess) {
            console.log('[IndiDriverManager] Stopping existing active indiserver child process...');
            try {
                // 安全にキルを送信
                process.kill(-this.activeIndiProcess.pid!); // マイナスにすることでプロセスグループ全体をキル
            } catch (e) {
                try {
                    this.activeIndiProcess.kill();
                } catch (err) {}
            }
            this.activeIndiProcess = null;
        }
    }

    /**
     * WebSocket-TCPブリッジの起動・再設定
     */
    public configureBridgePort(port: number) {
        if (this.currentBridgePort === port && this.bridgeWsServer) {
            console.log(`[IndiDriverManager] Bridge already running on port ${port}, skipping allocation.`);
            return;
        }

        console.log(`[IndiDriverManager] Reconfiguring WebSocket-TCP Bridge to port: ${port}`);
        
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

        this.currentBridgePort = port;

        try {
            // 新たな WebSocket サーバーをバインド
            this.bridgeWsServer = new WebSocketServer({ port: this.currentBridgePort, host: '0.0.0.0' });
            
            console.log(`[IndiDriverManager] WebSocket-TCP Bridge listening on ws://0.0.0.0:${this.currentBridgePort}`);

            this.bridgeWsServer.on('connection', (wsClient: WebSocket) => {
                console.log(`[IndiBridge] Browser WebSocket client linked. Opening TCP socket connection to localhost:7624...`);

                // TCPソケットで実際の INDIサーバ(TCP 7624)へ接続を中継する
                const tcpSocket = net.createConnection({ host: '127.0.0.1', port: 7624 }, () => {
                    console.log(`[IndiBridge] Connected successfully to local INDI TCP Server (127.0.0.1:7624).`);
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

                tcpSocket.on('error', (err) => {
                    console.error('[IndiBridge] INDI TCP Socket Error:', err.message);
                    wsClient.close();
                });
            });

            this.bridgeWsServer.on('error', (err: any) => {
                console.error(`[IndiDriverManager] WebSocket Bridge Server Error on port ${this.currentBridgePort}:`, err);
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

    // デフォルトポート(8625)でブリッジをロード
    manager.configureBridgePort(8625);

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
            const { port } = req.body;
            if (!port || typeof port !== 'number') {
                return res.status(400).json({ status: 'error', message: 'port parameter is required as a number.' });
            }

            manager.configureBridgePort(port);
            res.json({ status: 'ok', message: `Bridge configured to port ${port}` });
        } catch (error: any) {
            res.status(500).json({ status: 'error', message: error.message });
        }
    });
}
