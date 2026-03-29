
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
let connector: any = null;

const getSamp = () => {
    const s = window.samp || (window.module && window.module.exports);
    if (s && !window.samp) {
        window.samp = s;
    }
    return s;
};

const ensureXmlRpcRequest = () => {
    const samp = getSamp();
    if (samp && samp.XmlRpcRequest && typeof window !== 'undefined' && !(window as any).XmlRpcRequest) {
        (window as any).XmlRpcRequest = samp.XmlRpcRequest;
    }
};

export const setCallback = (cb: (status: SampStatus, metadata?: any) => void) => {
    statusCallback = cb;
};

export const init = (cb: (status: SampStatus, metadata?: any) => void) => {
    statusCallback = cb;
    const samp = getSamp();
    ensureXmlRpcRequest();
    
    if (samp && !connector) {
        const meta = {
            "samp.name": "T-Astro Web Studio",
            "samp.description.text": "Web-based Astronomy Control Center",
            "samp.icon.url": window.location.origin + "/favicon.ico"
        };
        // Connector handles the Web Profile (CORS, etc.)
        connector = new samp.Connector(meta);
        
        // Set up connection change listener
        connector.onConnectionChange = (isConnected: boolean) => {
            console.log(`[SAMP] Connection changed: ${isConnected}`);
            if (statusCallback) {
                statusCallback(isConnected ? 'Connected' : 'Disconnected');
            }
        };
    }
};

export const connect = async (settings: SampSettings) => {
    const samp = getSamp();
    ensureXmlRpcRequest();
    
    if (!samp) {
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
    // Standard SAMP hub URL is usually the root or /xmlrpc
    const hubUrl = `http://${host}:${port}/`;
    
    // Use proxy for SAMP to bypass CORS only if on HTTPS
    const isHttps = window.location.protocol === 'https:';
    const proxyUrl = isHttps 
        ? `${window.location.origin}/api/samp/proxy?target=${encodeURIComponent(hubUrl)}`
        : hubUrl;
    
    console.log(`[SAMP] Connecting to hub at: ${hubUrl} ${isHttps ? '(via proxy)' : '(direct)'}`);
    if (statusCallback) statusCallback('Connecting');

    const meta = {
        "samp.name": "T-Astro Web Studio",
        "samp.description.text": "Web-based Astronomy Control Center",
        "samp.icon.url": window.location.origin + "/favicon.ico"
    };

    try {
        const samp = getSamp();
        // Connector handles the Web Profile (CORS, etc.)
        // We use the proxy URL as the hub URL
        connector = new samp.Connector(meta);
        
        // Manually set the hub URL on the connector's client
        if (connector.client) {
            connector.client.hubUrl = proxyUrl;
        }
        
        // Set up connection change listener
        connector.onConnectionChange = (isConnected: boolean) => {
            console.log(`[SAMP] Connection changed: ${isConnected}`);
            if (statusCallback) {
                statusCallback(isConnected ? 'Connected' : 'Disconnected');
            }
        };

        // Register with the hub
        connector.register();
        
        // Timeout for connection
        setTimeout(() => {
            if (connector && !connector.connection && statusCallback) {
                console.warn("[SAMP] Connection timeout");
                statusCallback('Error', { error: 'Connection timeout. Is Aladin/SAMP Hub running with Web Profile enabled?' });
            }
        }, 5000);
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
    const samp = getSamp();
    if (connector && connector.connection && samp) {
        console.log(`[SAMP] Sending coord: RA=${ra}, Dec=${dec}`);
        try {
            const msg = new samp.Message("coord.pointAt.sky", {
                ra: ra.toString(),
                dec: dec.toString()
            });
            // Standard SAMP notifyAll takes a message object, not an array
            connector.connection.notifyAll(msg);
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

    const samp = getSamp();
    ensureXmlRpcRequest();

    if (!samp) {
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
        if (!samp.Connector) {
            throw new Error('SAMP library components not found');
        }

        connector = new samp.Connector(meta);
        
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
        if (!samp.XmlRpcClient) {
            throw new Error('SAMP XmlRpcClient not found');
        }
        const client = new samp.XmlRpcClient(hubUrl);
        
        client.execute("samp.hub.register", [secret], (err: any, result: any) => {
            if (err) {
                console.error("[SAMP] Internal registration failed:", err);
                if (statusCallback) statusCallback('Error', { error: 'Registration failed: ' + err.message });
            } else {
                console.log("[SAMP] Internal registration successful", result);
                const conn = new samp.Connection(client, result["samp.private-key"]);
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
