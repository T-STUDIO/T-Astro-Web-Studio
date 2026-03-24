
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

export const setCallback = (cb: (status: SampStatus, metadata?: any) => void) => {
    statusCallback = cb;
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
        // Connector handles the Web Profile (CORS, etc.)
        // We use the proxy URL as the hub URL
        connector = new window.samp.Connector(meta);
        
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

    const meta = {
        "samp.name": "T-Astro Web Studio (Internal)",
        "samp.description.text": "Web-based Astronomy Control Center (Internal Hub)",
        "samp.icon.url": window.location.origin + "/favicon.ico"
    };

    try {
        // For internal hub, we point the connector to our own server's registration endpoint
        // The samp.js Connector usually looks for the hub automatically, 
        // but we can override the registration URL if needed.
        connector = new window.samp.Connector(meta);
        
        // Override the registration URL to our internal endpoint
        const registrationUrl = `${window.location.origin}/samp-registration`;
        console.log(`[SAMP] Using internal registration URL: ${registrationUrl}`);
        
        // We need to monkey-patch or configure the connector to use our URL
        // In samp.js, the XmlRpcClient is what handles the calls.
        if (connector.client) {
            // This is a bit of a hack depending on samp.js internals, 
            // but usually we can set the hubUrl or similar.
            // For the Web Profile, it's often hardcoded to localhost:21012, 
            // so we might need to proxy it or use a custom client.
            connector.client.hubUrl = `${window.location.origin}/api/samp/xmlrpc`;
        }

        connector.onConnectionChange = (isConnected: boolean) => {
            console.log(`[SAMP] Internal connection changed: ${isConnected}`);
            if (statusCallback) {
                statusCallback(isConnected ? 'Connected' : 'Disconnected');
            }
        };

        connector.register();

        setTimeout(() => {
            if (connector && !connector.connection && statusCallback) {
                console.warn("[SAMP] Internal connection timeout");
                statusCallback('Error', { error: 'Internal Hub connection timeout.' });
            }
        }, 5000);
    } catch (e: any) {
        console.error("[SAMP] Internal connection error:", e);
        if (statusCallback) statusCallback('Error', { error: e.message });
    }
};
