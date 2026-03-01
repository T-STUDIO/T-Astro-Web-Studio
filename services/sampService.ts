
import { SampStatus, SampSettings } from '../types';

let isConnecting = false;
let clientName = "T-Astro Web Studio";
let privateKey: string | null = null;
let hubUrl: string | null = null;

// State Machine
let statusCallback: ((status: SampStatus, metadata?: any) => void) | null = null;

const log = (msg: string) => console.log(`[SAMP] ${msg}`);
const errLog = (msg: string) => console.error(`[SAMP] ${msg}`);

export const setCallback = (cb: (status: SampStatus, metadata?: any) => void) => {
    statusCallback = cb;
};

// --- XML-RPC Helpers (HTTP) ---

const createXmlRpcRequest = (methodName: string, params: any[]): string => {
    let paramXml = '';
    params.forEach(p => {
        paramXml += `<param><value>${encodeValue(p)}</value></param>`;
    });
    return `<?xml version="1.0"?><methodCall><methodName>${methodName}</methodName><params>${paramXml}</params></methodCall>`;
};

const encodeValue = (val: any): string => {
    if (typeof val === 'string') return `<string>${val}</string>`;
    if (typeof val === 'number') return val % 1 === 0 ? `<int>${val}</int>` : `<double>${val}</double>`;
    if (typeof val === 'boolean') return `<boolean>${val ? '1' : '0'}</boolean>`;
    if (Array.isArray(val)) {
        let data = '';
        val.forEach(v => { data += `<value>${encodeValue(v)}</value>`; });
        return `<array><data>${data}</data></array>`;
    }
    if (typeof val === 'object' && val !== null) {
        let members = '';
        for (const k in val) {
            members += `<member><name>${k}</name><value>${encodeValue(val[k])}</value></member>`;
        }
        return `<struct>${members}</struct>`;
    }
    return `<string>${val}</string>`;
};

const parseXmlRpcResponse = async (response: Response): Promise<any> => {
    const text = await response.text();
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(text, "text/xml");
    
    // Check for fault
    const fault = xmlDoc.getElementsByTagName("fault")[0];
    if (fault) {
        throw new Error("XML-RPC Fault: " + fault.textContent);
    }

    const params = xmlDoc.getElementsByTagName("param");
    if (params.length > 0) {
        const valueNode = params[0].getElementsByTagName("value")[0];
        return parseValueNode(valueNode);
    }
    return null;
};

const parseValueNode = (node: Element): any => {
    const child = node.firstElementChild;
    if (!child) return node.textContent; // plain value

    const tagName = child.tagName.toLowerCase();
    if (tagName === 'string') return child.textContent;
    if (tagName === 'int' || tagName === 'i4') return parseInt(child.textContent || '0', 10);
    if (tagName === 'double') return parseFloat(child.textContent || '0');
    if (tagName === 'boolean') return child.textContent === '1';
    
    if (tagName === 'struct') {
        const result: any = {};
        const members = child.getElementsByTagName("member");
        for (let i = 0; i < members.length; i++) {
            const name = members[i].getElementsByTagName("name")[0].textContent || "";
            const value = members[i].getElementsByTagName("value")[0];
            result[name] = parseValueNode(value);
        }
        return result;
    }
    
    if (tagName === 'array') {
        const result: any[] = [];
        const data = child.getElementsByTagName("data")[0];
        if (data) {
            const values = data.children; // direct value children
            for (let i = 0; i < values.length; i++) {
                if (values[i].tagName === 'value') {
                    result.push(parseValueNode(values[i]));
                }
            }
        }
        return result;
    }
    
    return child.textContent;
};

const xmlRpcCall = async (url: string, method: string, params: any[]) => {
    const xml = createXmlRpcRequest(method, params);
    
    // Using fetch with text/xml. 
    // Note: SAMP Web Profile allows CORS from localhost usually.
    // If target is HTTPS and App is HTTPS, mixed content might be an issue if Hub is HTTP.
    const res = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'text/xml'
        },
        body: xml
    });

    if (!res.ok) {
        throw new Error(`HTTP Error: ${res.status} ${res.statusText}`);
    }

    return await parseXmlRpcResponse(res);
};

// --- Main Logic ---

export const connect = async (settings: SampSettings) => {
    if (isConnecting) return;
    if (privateKey) disconnect();

    // Clean host string
    let rawHost = settings.host.replace(/^[a-z0-9]+:\/\//i, '').replace(/\/+$/, '');
    
    // SAMP Standard Profile uses port 21012 by default for Web Profile too.
    // Protocol is HTTP.
    const protocol = 'http';
    const url = `${protocol}://${rawHost}:${settings.port}/xmlrpc`; // Many hubs use root or /xmlrpc
    
    hubUrl = url;
    
    log(`Connecting to SAMP Hub (Web Profile) at ${url}...`);
    
    if (statusCallback) statusCallback('Connecting');
    isConnecting = true;

    try {
        // 1. Register with Web Profile
        // Method: samp.webhub.register
        // Identity: { "samp.name": ... }
        const identity = { "samp.name": clientName };
        const result = await xmlRpcCall(url, "samp.webhub.register", [identity]);

        if (result && result["samp.private-key"]) {
            privateKey = result["samp.private-key"];
            const hubId = result["samp.hub-id"];
            const selfId = result["samp.self-id"];
            
            log(`Registered! Self ID: ${selfId}, Hub ID: ${hubId}`);
            
            // 2. Declare Metadata
            await declareMetadata();

            if (statusCallback) statusCallback('Connected', { clientName, hubId });
        } else {
            throw new Error("Registration failed. Invalid response from Hub.");
        }

    } catch (e: any) {
        errLog(`Connection failed: ${e.message}`);
        // Handle Mixed Content error hint
        let errorMsg = String(e.message);
        if (window.location.protocol === 'https:' && settings.host.includes('localhost')) {
            errorMsg += " (Mixed Content Blocked? Check browser console)";
        }
        if (statusCallback) statusCallback('Error', { error: errorMsg });
    } finally {
        isConnecting = false;
    }
};

const declareMetadata = async () => {
    if (!hubUrl || !privateKey) return;
    try {
        await xmlRpcCall(hubUrl, "samp.webhub.declareMetadata", [
            privateKey,
            {
                "samp.name": clientName,
                "samp.description.text": "T-Astro Web Studio (HTTP Client)",
                "samp.icon.url": window.location.origin + "/favicon.ico"
            }
        ]);
    } catch (e) {
        errLog("Failed to declare metadata: " + e);
    }
};

export const disconnect = async () => {
    if (hubUrl && privateKey) {
        try {
            await xmlRpcCall(hubUrl, "samp.webhub.unregister", [privateKey]);
        } catch (e) {
            console.warn("Error unregistering:", e);
        }
    }
    privateKey = null;
    isConnecting = false;
    if (statusCallback) statusCallback('Disconnected');
    log("Disconnected");
};

// --- SIMULATION ---
export const connectMock = (cb: (status: SampStatus, metadata?: any) => void) => {
    console.log("[SAMP Simulator] Connecting to Virtual Hub...");
    setCallback(cb);
    setTimeout(() => {
        if (statusCallback) statusCallback('Connected', { clientName: "T-Astro (Simulated)" });
    }, 1000);
}

export const sendSkyCoord = async (ra: number, dec: number) => {
    if (hubUrl && privateKey) {
        // Send coord.pointAt.sky
        const msg = {
            "samp.mtype": "coord.pointAt.sky",
            "samp.params": {
                "ra": String(ra),
                "dec": String(dec)
            }
        };
        
        try {
            // Using notify to broadcast to all subscribed clients
            await xmlRpcCall(hubUrl, "samp.webhub.notifyAll", [
                privateKey,
                msg
            ]);
            log(`Sent SkyCoord: RA=${ra}, Dec=${dec}`);
        } catch (e) {
            errLog("Failed to send coords: " + e);
        }

    } else if (statusCallback && !hubUrl) {
        console.log(`[SAMP Simulator] Sending Coord: RA ${ra}, Dec ${dec} (Simulated/Offline)`);
    } else {
        console.warn("SAMP not connected");
    }
};

// Initialize with a callback
export const init = (cb: (status: SampStatus, metadata?: any) => void) => {
    setCallback(cb);
};
