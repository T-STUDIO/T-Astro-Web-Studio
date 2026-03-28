/**
 * T-Astro INDI-to-Alpaca Bridge Engine [V200.3.0-FIXED]
 * ROLE: Passive Protocol Adapter. 
 * FIX: Decoupled registry syncing from bridge startup to prevent INDI interference.
 */

import { AlpacaDB } from './AlpacaDefinitions.ts';
import { INDIDevice } from './types';

export class AlpacaBridge {
    private static instance: AlpacaBridge | null = null;
    private relaySocket: WebSocket | null = null;
    private db = AlpacaDB.getInstance();
    private isStarted = false;
    private isConnecting = false;
    private uiLogger: ((msg: string) => void) | null = null;
    private indiSender: ((xml: string) => void) | null = null; 
    private targetHost: string = '';

    public static getInstance(): AlpacaBridge {
        if (!AlpacaBridge.instance) AlpacaBridge.instance = new AlpacaBridge();
        return AlpacaBridge.instance;
    }

    public setLogger(logger: (msg: string) => void) { 
        this.uiLogger = logger; 
    }

    public setIndiSender(sender: (xml: string) => void) {
        this.indiSender = sender;
        this.logToUI("[BRIDGE] UI LINK ESTABLISHED");
    }

    public logToUI(msg: string) {
        const entry = `[${new Date().toLocaleTimeString()}] ${msg}`;
        if (this.uiLogger) this.uiLogger(entry);
        console.log(`[ALPACA-LOG] ${entry}`);
    }

    public setTargetHost(host: string) {
        const finalHost = host || '';
        if (this.targetHost !== finalHost) {
            this.targetHost = finalHost;
            if (this.isStarted) {
                this.stop();
                this.start();
            }
        }
    }

    /**
     * デバイスレジストリのみを更新（起動はしない）
     */
    public syncRegistry(devices: INDIDevice[]) {
        try {
            this.db.updateRegistry(devices || []);
        } catch (e: any) { 
            this.logToUI(`[BRIDGE] Registry Sync Error: ${e.message}`); 
        }
    }

    /**
     * 旧互換メソッド
     */
    public updateFromUI(devices: INDIDevice[]) {
        this.syncRegistry(devices);
    }

    public start() {
        if (this.isStarted) return;
        this.logToUI("[BRIDGE] GATEWAY STARTING...");
        this.isStarted = true;
        this.connectRelay();
    }

    public stop() {
        this.logToUI("[BRIDGE] GATEWAY STOPPED.");
        this.isStarted = false;
        if (this.relaySocket) {
            this.relaySocket.close();
            this.relaySocket = null;
        }
        this.isConnecting = false;
    }

    private connectRelay() {
        if (!this.isStarted || this.isConnecting || (this.relaySocket && this.relaySocket.readyState <= 1)) return;
        
        this.isConnecting = true;
        const host = this.targetHost || 'localhost';
        const wsUrl = `ws://${host}:11112`;

        try {
            const ws = new WebSocket(wsUrl);
            ws.onopen = () => { 
                this.relaySocket = ws; 
                this.isConnecting = false; 
                this.logToUI("[BRIDGE] RELAY LINK ESTABLISHED. Alpaca Server is active."); 
            };
            ws.onmessage = async (e) => {
                try {
                    let raw = e.data;
                    if (raw instanceof Blob) raw = await raw.text();
                    const req = JSON.parse(raw);
                    
                    const response = await this.db.dispatchAlpaca(req);
                    
                    if (this.relaySocket?.readyState === WebSocket.OPEN) {
                        if (response instanceof Uint8Array || (response && response.isBinary)) {
                            // Setup HTML or Image Binary Path
                            this.relaySocket.send(response.data || response);
                        } else {
                            // Standard JSON response
                            this.relaySocket.send(JSON.stringify({ 
                                requestId: req.requestId, 
                                payload: response 
                            }));
                        }
                    }
                } catch (err: any) { 
                    this.logToUI(`[BRIDGE] Protocol Error: ${err.message}`); 
                }
            };
            ws.onclose = () => { 
                this.relaySocket = null; 
                this.isConnecting = false;
                if (this.isStarted) {
                    setTimeout(() => this.connectRelay(), 5000);
                }
            };
            ws.onerror = () => { this.isConnecting = false; };
        } catch (e) { this.isConnecting = false; }
    }

    public sendToINDI(xml: string) { 
        if (this.indiSender) {
            this.indiSender(xml); 
        }
    }
}

const bridge = AlpacaBridge.getInstance();
(window as any).AlpacaBridge = bridge;
export default bridge;