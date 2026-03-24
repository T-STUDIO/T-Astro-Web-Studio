
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

export const connect = async (settings: SampSettings, isInternal: boolean = false) => {
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

    let hubUrl = '';
    if (isInternal) {
        // Internal hub on the same server
        hubUrl = `${window.location.origin}/`;
        console.log(`[SAMP] Connecting to INTERNAL hub at: ${hubUrl}`);
    } else {
        const host = settings.host || 'localhost';
        const port = settings.port || 21012;
        // Standard SAMP hub URL is usually the root or /xmlrpc
        hubUrl = `http://${host}:${port}/`;
        console.log(`[SAMP] Connecting to EXTERNAL hub at: ${hubUrl}`);
    }
    
    // Use proxy for SAMP to bypass CORS only if on HTTPS and NOT internal
    const isHttps = window.location.protocol === 'https:';
    const proxyUrl = (isHttps && !isInternal)
        ? `${window.location.origin}/api/samp/proxy?target=${encodeURIComponent(hubUrl)}`
        : hubUrl;
    
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

// Internal Hub Support
export const connectInternal = (cb: (status: SampStatus, metadata?: any) => void, settings: SampSettings) => {
    console.log("[SAMP] Connecting to Internal Hub...");
    setCallback(cb);
    connect(settings, true);
}
