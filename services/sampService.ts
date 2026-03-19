
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

    if (!connector) {
        init(statusCallback!);
    }

    const host = settings.host || 'localhost';
    const port = settings.port || 21013;

    if (statusCallback) statusCallback('Connecting');

    try {
        // Set up connection change listener
        connector.onConnectionChange = (isConnected: boolean) => {
            console.log(`[SAMP] Connection changed: ${isConnected}`);
            if (statusCallback) {
                statusCallback(isConnected ? 'Connected' : 'Disconnected');
            }
        };

        console.log(`[SAMP] Attempting to register with hub at ${host}:${port}`);
        
        // For Web Profile, Aladin listens on 21012 (HTTPS) or 21013 (HTTP)
        // Standard XML-RPC is 12121.
        
        const protocol = window.location.protocol === 'https:' ? 'https' : 'http';
        let hubUrl = '';

        if (port === 12121) {
            hubUrl = `${protocol}://${host}:${port}/samp/xmlrpc`;
        } else {
            hubUrl = `${protocol}://${host}:${port}/`;
        }
        
        console.log(`[SAMP] Using hub URL: ${hubUrl}`);
        
        // Manually set the hub finder to ensure the specified port is used
        if (window.samp.XmlRpcHubFinder && port === 12121) {
            connector.hubFinder = new window.samp.XmlRpcHubFinder(hubUrl);
        } else if (window.samp.WebHubFinder) {
            connector.hubFinder = new window.samp.WebHubFinder([hubUrl]);
        }

        connector.register();
        
        // Check if already connected
        if (connector.connection && statusCallback) {
            statusCallback('Connected');
        }
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
export const connectVirtual = async (settings: SampSettings) => {
    console.log("[SAMP Simulator] Connecting to Virtual Hub...", settings);
    if (statusCallback) {
        statusCallback('Connecting');
        setTimeout(() => {
            if (statusCallback) statusCallback('Connected', { clientName: "T-Astro (Simulated)" });
        }, 1000);
    }
}
