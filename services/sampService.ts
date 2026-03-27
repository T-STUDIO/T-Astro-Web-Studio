
import { SampStatus, SampSettings } from '../types';

/**
 * SAMP Service
 * ROLE: Handles communication with SAMP (Simple Applications Messaging Protocol) hubs.
 * This implementation uses the samp.js library loaded in index.html.
 */

declare global {
    interface Window {
        samp: any;
    }
}

let statusCallback: ((status: SampStatus, metadata?: any) => void) | null = null;
let skyCoordCallback: ((ra: number, dec: number) => void) | null = null;
let connector: any = null;

export const setCallback = (cb: (status: SampStatus, metadata?: any) => void) => {
    statusCallback = cb;
};

export const setSkyCoordCallback = (cb: (ra: number, dec: number) => void) => {
    skyCoordCallback = cb;
};

export const init = (cb: (status: SampStatus, metadata?: any) => void) => {
    statusCallback = cb;
    if (window.samp && !connector) {
        const meta = {
            "samp.name": "T-Astro Web Studio",
            "samp.description.text": "Web-based Astronomy Control Center",
            "samp.icon.url": window.location.origin + "/favicon.ico"
        };
        // Connector handles the Web Profile (CORS, etc.)
        connector = new window.samp.Connector(meta);
    }
};

export const connect = async (settings: SampSettings) => {
    if (!window.samp) {
        console.error("[SAMP] Library not loaded");
        if (statusCallback) statusCallback('Error', { error: 'SAMP library not loaded' });
        return;
    }

    // Unregister existing connector if any
    if (connector) {
        try {
            console.log("[SAMP] Unregistering previous connector...");
            connector.unregister();
        } catch (e) {
            console.warn("[SAMP] Unregister failed (normal if already disconnected):", e);
        }
    }

    const host = settings.host || 'localhost';
    const port = settings.port || 21012;
    // Standard SAMP hub URL for Web Profile
    const hubUrl = `http://${host}:${port}/`;
    
    console.log(`[SAMP] Connecting to hub at: ${hubUrl}`);
    if (statusCallback) statusCallback('Connecting');

    const meta = {
        "samp.name": "T-Astro Web Studio",
        "samp.description.text": "Web-based Astronomy Control Center",
        "samp.icon.url": window.location.origin + "/favicon.ico"
    };

    try {
        // Connector handles the Web Profile
        connector = new window.samp.Connector(meta);
        
        // Override hub URL if specified
        if (connector.client) {
            connector.client.hubUrl = hubUrl;
        }
        
        connector.onConnectionChange = (isConnected: boolean) => {
            console.log(`[SAMP] Connection changed: ${isConnected}`);
            if (statusCallback) {
                statusCallback(isConnected ? 'Connected' : 'Disconnected');
            }
        };

        // メッセージ受信ハンドラ
        connector.onMessage = (senderId: string, message: any) => {
            const mtype = message["samp.mtype"];
            if (mtype === "coord.pointAt.sky") {
                const params = message["samp.params"];
                const ra = parseFloat(params.ra);
                const dec = parseFloat(params.dec);
                if (!isNaN(ra) && !isNaN(dec) && skyCoordCallback) {
                    console.log(`[SAMP] Received coord.pointAt.sky from ${senderId}: RA=${ra}, Dec=${dec}`);
                    skyCoordCallback(ra, dec);
                }
            }
            return {}; // 応答が必要な場合はここにデータを返す
        };

        // 購読するメッセージタイプを登録
        connector.subscriptions = {
            "coord.pointAt.sky": {}
        };

        // Attempt to register
        connector.register();
        
        // Check for connection success
        setTimeout(() => {
            if (connector && !connector.connection && statusCallback) {
                console.warn("[SAMP] Connection timeout. Trying to resolve hub...");
                // Fallback to resolveHub if direct registration didn't work immediately
                connector.resolveHub();
            }
        }, 3000);
    } catch (e: any) {
        console.error("[SAMP] Connection error:", e);
        if (statusCallback) statusCallback('Error', { error: e.message });
    }
};

export const disconnect = async () => {
    if (connector) {
        console.log("[SAMP] Disconnecting...");
        connector.unregister();
    }
};

export const sendSkyCoord = async (ra: number, dec: number) => {
    if (connector && connector.connection) {
        console.log(`[SAMP] Sending coord: RA=${ra}, Dec=${dec}`);
        try {
            const msg = new window.samp.Message("coord.pointAt.sky", {
                ra: ra.toString(),
                dec: dec.toString()
            });
            connector.connection.notifyAll([msg]);
        } catch (e) {
            console.error("[SAMP] Failed to send coordinates:", e);
        }
    } else {
        console.warn("[SAMP] Not connected, cannot send coordinates");
    }
};

export const isConnected = (): boolean => {
    return !!(connector && connector.connection);
};

// Simulation
export const connectMock = (cb: (status: SampStatus, metadata?: any) => void) => {
    console.log("[SAMP Simulator] Connecting to Virtual Hub...");
    setCallback(cb);
    setTimeout(() => {
        if (statusCallback) statusCallback('Connected', { clientName: "T-Astro (Simulated)" });
    }, 1000);
}

export const connectInternal = async (cb: (status: SampStatus, metadata?: any) => void, settings: SampSettings) => {
    console.log("[SAMP] Connecting to Internal Hub...");
    statusCallback = cb;
    if (statusCallback) statusCallback('Connecting');

    if (!window.samp) {
        console.error("[SAMP] Library not loaded");
        if (statusCallback) statusCallback('Error', { error: 'SAMP library not loaded' });
        return;
    }

    try {
        // 1. Fetch registration info from our server
        const regResponse = await fetch(`${window.location.origin}/samp-registration`, { method: 'POST' });
        if (!regResponse.ok) throw new Error('Failed to get registration info from server');
        
        const regData = await regResponse.json();
        const hubUrl = regData["samp.hub.xmlrpc.url"];
        const secret = regData["samp.secret"];
        
        console.log(`[SAMP] Internal Hub URL: ${hubUrl}`);

        const meta = {
            "samp.name": "T-Astro Web Studio (Internal)",
            "samp.description.text": "Web-based Astronomy Control Center (Internal Hub)",
            "samp.icon.url": window.location.origin + "/favicon.ico"
        };

        // 2. Create connector and override hub URL
        connector = new window.samp.Connector(meta);
        
        // Use the exact URL provided by the server
        if (connector.client) {
            connector.client.hubUrl = hubUrl;
        }

        connector.onConnectionChange = (isConnected: boolean) => {
            console.log(`[SAMP] Internal connection changed: ${isConnected}`);
            if (statusCallback) {
                statusCallback(isConnected ? 'Connected' : 'Disconnected');
            }
        };

        // 3. Register using the secret we got
        // We use the XmlRpcClient directly to ensure we connect to the correct server IP
        const client = new window.samp.XmlRpcClient(hubUrl);
        client.execute("samp.hub.register", [secret], (err: any, result: any) => {
            if (err) {
                console.error("[SAMP] Internal registration failed:", err);
                if (statusCallback) statusCallback('Error', { error: 'Registration failed: ' + err.message });
            } else {
                console.log("[SAMP] Internal registration successful", result);
                const conn = new window.samp.Connection(client, result["samp.private-key"]);
                connector.connection = conn;
                if (statusCallback) statusCallback('Connected');
                
                // Declare metadata and subscriptions
                conn.call("samp.hub.declareMetadata", [result["samp.private-key"], meta], () => {});
                conn.call("samp.hub.declareSubscriptions", [result["samp.private-key"], {}], () => {});
            }
        });

        setTimeout(() => {
            if (connector && !connector.connection && statusCallback) {
                console.warn("[SAMP] Internal connection timeout");
                statusCallback('Error', { error: 'Internal Hub connection timeout.' });
            }
        }, 10000);
    } catch (e: any) {
        console.error("[SAMP] Internal connection error:", e);
        if (statusCallback) statusCallback('Error', { error: e.message });
    }
};
