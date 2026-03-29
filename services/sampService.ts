
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

const patchSampLibrary = () => {
    if (typeof window === 'undefined') return;
    
    const samp = window.samp || (window.module && window.module.exports);
    if (!samp) return;
    
    if (samp.__tastro_patched) return;
    
    console.log("[SAMP] Applying aggressive library patches...");

    // 1. Robust XML Serialization helper
    const serialize = (v: any): string => {
        if (v === null || v === undefined) return '<nil/>';
        if (typeof v === 'string') return `<string>${v.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</string>`;
        if (typeof v === 'number') {
            if (Number.isInteger(v)) return `<int>${v}</int>`;
            return `<double>${v}</double>`;
        }
        if (typeof v === 'boolean') return `<boolean>${v ? '1' : '0'}</boolean>`;
        if (v instanceof Date) return `<dateTime.iso8601>${v.toISOString()}</dateTime.iso8601>`;
        if (Array.isArray(v)) {
            return `<array><data>${v.map(item => `<value>${serialize(item)}</value>`).join('')}</data></array>`;
        }
        if (typeof v === 'object') {
            let s = '<struct>';
            for (const k in v) {
                if (Object.prototype.hasOwnProperty.call(v, k)) {
                    s += `<member><name>${k}</name><value>${serialize(v[k])}</value></member>`;
                }
            }
            return s + '</struct>';
        }
        return `<string>${String(v)}</string>`;
    };

    // 2. Completely override XmlRpcRequest
    const MyRequest = function(this: any, methodName: string, params: any[]) {
        this.methodName = methodName;
        this.params = params;
    };
    MyRequest.prototype.toXml = function() {
        let xml = '<?xml version="1.0"?><methodCall>';
        xml += `<methodName>${this.methodName}</methodName>`;
        xml += '<params>';
        if (this.params && Array.isArray(this.params)) {
            for (const p of this.params) {
                xml += `<param><value>${serialize(p)}</value></param>`;
            }
        }
        xml += '</params></methodCall>';
        return xml;
    };

    // Force it everywhere
    samp.XmlRpcRequest = MyRequest;
    (window as any).XmlRpcRequest = MyRequest;

    // 3. Completely override XmlRpcClient prototype execute
    const patchExecute = function(this: any, methodName: string, params: any[], success: any, error: any) {
        // Determine the URL to use
        const url = this.endpoint || this.url || this.hubUrl || (window as any).XmlRpcClient_defaultUrl || "http://localhost:21012/";
        
        console.log(`[SAMP Patch] Executing ${methodName} -> ${url}`);
        
        try {
            const req = new MyRequest(methodName, params);
            const xml = req.toXml();
            
            const xhr = new XMLHttpRequest();
            xhr.open("POST", url, true);
            xhr.setRequestHeader("Content-Type", "text/xml");
            
            xhr.onreadystatechange = () => {
                if (xhr.readyState === 4) {
                    if (xhr.status === 200) {
                        try {
                            let result;
                            if (samp.XmlRpcDeserializer) {
                                result = samp.XmlRpcDeserializer.deserializeResponse(xhr.responseText);
                            } else {
                                result = xhr.responseText;
                            }
                            if (typeof success === 'function') success(result);
                        } catch (e) {
                            console.error("[SAMP Patch] Deserialization error:", e);
                            if (typeof error === 'function') error(e);
                        }
                    } else {
                        const httpErr = new Error(`HTTP ${xhr.status}: ${xhr.statusText} (Target: ${url})`);
                        console.error("[SAMP Patch] HTTP Error:", httpErr);
                        if (typeof error === 'function') error(httpErr);
                    }
                }
            };
            
            xhr.onerror = () => {
                const netErr = new Error(`Network Error connecting to ${url}`);
                console.error("[SAMP Patch] Network Error:", netErr);
                if (typeof error === 'function') error(netErr);
            };
            
            xhr.send(xml);
        } catch (e) {
            console.error("[SAMP Patch] Execution error:", e);
            if (typeof error === 'function') error(e);
        }
    };

    if (samp.XmlRpcClient) {
        if (samp.XmlRpcClient.prototype) {
            samp.XmlRpcClient.prototype.execute = patchExecute;
        }
        
        // Also patch the constructor to ensure every instance is forced to use the correct URL
        const OriginalClient = samp.XmlRpcClient;
        const PatchedClient = function(this: any, url: string) {
            const instance = new (OriginalClient as any)(url);
            instance.endpoint = url;
            instance.url = url;
            instance.hubUrl = url;
            instance.execute = patchExecute; // Force instance-level override
            return instance;
        };
        PatchedClient.prototype = OriginalClient.prototype;
        samp.XmlRpcClient = PatchedClient;
    }

    // Also patch global XmlRpcClient if it exists
    if ((window as any).XmlRpcClient && (window as any).XmlRpcClient.prototype) {
        (window as any).XmlRpcClient.prototype.execute = patchExecute;
    }
    
    // 4. Patch Connector to ensure it doesn't default to localhost
    if (samp.Connector && samp.Connector.prototype) {
        const originalRegister = samp.Connector.prototype.register;
        samp.Connector.prototype.register = function() {
            if (this.client && this.hubUrl) {
                this.client.endpoint = this.hubUrl;
                this.client.url = this.hubUrl;
                this.client.hubUrl = this.hubUrl;
            }
            return originalRegister.apply(this, arguments);
        };
    }

    samp.__tastro_patched = true;
    window.samp = samp;
    console.log("[SAMP] Aggressive patches applied successfully.");
};

const getSamp = () => {
    const s = window.samp || (window.module && window.module.exports);
    if (s && !window.samp) {
        window.samp = s;
    }
    if (s) patchSampLibrary();
    return s;
};

const ensureXmlRpcRequest = () => {
    patchSampLibrary();
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
        ensureXmlRpcRequest();
        
        // Connector handles the Web Profile (CORS, etc.)
        // Pass hubUrl in options to ensure it's used from the start
        connector = new samp.Connector(meta, { "samp.hub.xmlrpc.url": proxyUrl });
        
        // CRITICAL: Force the endpoint on the connector's internal client
        if (connector.client) {
            connector.client.endpoint = proxyUrl;
            connector.client.url = proxyUrl;
            connector.client.hubUrl = proxyUrl;
        }
        connector.hubUrl = proxyUrl;
        
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
        }, 10000);
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
        let hubUrl = regData["samp.hub.xmlrpc.url"];
        const secret = regData["samp.secret"];
        
        // Fix localhost issue if it comes from the server
        if (hubUrl.includes('localhost') || hubUrl.includes('127.0.0.1')) {
            try {
                const urlObj = new URL(hubUrl);
                hubUrl = window.location.origin + urlObj.pathname + urlObj.search;
            } catch (e) {
                console.warn("[SAMP] Failed to parse hubUrl, using relative path fallback");
                hubUrl = window.location.origin + "/api/samp/xmlrpc";
            }
        }
        
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
        connector.hubUrl = hubUrl;
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
        client.endpoint = hubUrl;
        client.url = hubUrl;
        client.hubUrl = hubUrl;
        
        client.execute("samp.hub.register", [secret], (result: any) => {
            console.log("[SAMP] Internal registration successful", result);
            const conn = new samp.Connection(client, result["samp.private-key"]);
            connector.connection = conn;
            if (statusCallback) statusCallback('Connected');
            
            // Declare metadata and subscriptions
            conn.call("samp.hub.declareMetadata", [result["samp.private-key"], meta], () => {});
            conn.call("samp.hub.declareSubscriptions", [result["samp.private-key"], {}], () => {});
        }, (err: any) => {
            console.error("[SAMP] Internal registration failed:", err);
            if (statusCallback) statusCallback('Error', { error: 'Registration failed: ' + (err.message || err) });
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
