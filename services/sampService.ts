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

export const setSkyCoordCallback = (cb: (ra: number, dec: number) => void) => {
    skyCoordCallback = cb;
};

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
    // Handle both constructor and function calls
    if (!(this instanceof MyRequest)) {
        return new (MyRequest as any)(methodName, params);
    }
    const self = this as any;
    self.methodName = methodName;
    self.params = params;
    // Define toXml on instance for absolute certainty
    self.toXml = function() {
        let xml = '<?xml version="1.0"?><methodCall>';
        xml += `<methodName>${self.methodName}</methodName>`;
        xml += '<params>';
        if (self.params && Array.isArray(self.params)) {
            for (const p of self.params) {
                xml += `<param><value>${serialize(p)}</value></param>`;
            }
        }
        xml += '</params></methodCall>';
        return xml;
    };
};
MyRequest.prototype.toXml = function() {
    return (this as any).toXml();
};
(MyRequest as any).checkParams = function() { return true; };
(MyRequest.prototype as any).checkParams = function() { return true; };

const patchSampLibrary = () => {
    if (typeof window === 'undefined') return;
    
    // Get the samp object from window or module.exports
    const samp = window.samp || (window.module && window.module.exports);
    if (!samp) {
        console.warn("[SAMP] Library not found yet, will retry later.");
        return;
    }
    
    if (samp.__tastro_patched) return;
    
    console.log("[SAMP] Applying aggressive library patches...");

    // Force it globally
    try {
        samp.XmlRpcRequest = MyRequest;
        (window as any).XmlRpcRequest = MyRequest;
        if (samp.XmlRpc) samp.XmlRpc.XmlRpcRequest = MyRequest;
        if ((window as any).XmlRpc) (window as any).XmlRpc.XmlRpcRequest = MyRequest;
        console.log("[SAMP Patch] XmlRpcRequest overridden globally");
    } catch (e) {
        console.warn("[SAMP Patch] Failed to override XmlRpcRequest globally:", e);
    }

    // 3. Completely override XmlRpcClient prototype execute
    const patchExecute = function(this: any, methodName: string, params: any[], success: any, error: any) {
        // Determine the URL to use. Force use of the instance's endpoint if set.
        const url = this.endpoint || this.url || this.hubUrl || (window as any).XmlRpcClient_defaultUrl || "http://localhost:21012/";
        
        console.log(`[SAMP Patch] Executing ${methodName} -> ${url}`);
        
        try {
            const req = new (MyRequest as any)(methodName, params);
            if (!req || typeof req.toXml !== 'function') {
                console.error("[SAMP Patch] req is invalid or missing toXml:", req);
                // Try to force it one last time
                if (req) {
                    (req as any).toXml = MyRequest.prototype.toXml;
                }
                if (!req || typeof req.toXml !== 'function') {
                    throw new Error("req.toXml is not a function (Patched)");
                }
            }
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
                                // Fallback if deserializer is missing
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

    // Patch XmlRpcClient
    if (samp.XmlRpcClient) {
        const patchClientProto = (proto: any) => {
            if (!proto) return;
            try {
                Object.defineProperty(proto, 'execute', {
                    value: patchExecute,
                    writable: true,
                    configurable: true
                });
                // Also patch 'call' if it exists
                if (typeof proto.call === 'function') {
                    proto.call = function(methodName: string, params: any[], success: any, error: any) {
                        this.execute(methodName, params, success, error);
                    };
                }
            } catch (e) {
                proto.execute = patchExecute;
            }
        };

        patchClientProto(samp.XmlRpcClient.prototype);
        if ((window as any).XmlRpcClient) patchClientProto((window as any).XmlRpcClient.prototype);
        
        // Patch constructor
        const OriginalClient = samp.XmlRpcClient;
        const PatchedClient = function(this: any, url: string) {
            if (!(this instanceof PatchedClient)) {
                return new (PatchedClient as any)(url);
            }
            const self = this as any;
            // Use original constructor logic if possible
            try {
                OriginalClient.call(self, url);
            } catch (e) {}
            
            // Force properties
            self.endpoint = url;
            self.url = url;
            self.hubUrl = url;
            // Force method override on the instance itself
            self.execute = patchExecute;
        };
        PatchedClient.prototype = OriginalClient.prototype;
        
        try {
            samp.XmlRpcClient = PatchedClient;
            (window as any).XmlRpcClient = PatchedClient;
            console.log("[SAMP Patch] XmlRpcClient overridden globally");
        } catch (e) {
            console.warn("[SAMP Patch] Failed to override XmlRpcClient globally:", e);
        }
    }

    // 4. Patch Connector to ensure it uses the patched client and correct URL
    if (samp.Connector) {
        const originalRegister = samp.Connector.prototype.register;
        samp.Connector.prototype.register = function() {
            console.log("[SAMP Patch] Connector.register called. HubUrl:", this.hubUrl);
            if (this.client) {
                // Ensure the internal client is patched and using the correct URL
                this.client.endpoint = this.hubUrl;
                this.client.url = this.hubUrl;
                this.client.hubUrl = this.hubUrl;
                this.client.execute = patchExecute;
            }
            return originalRegister.apply(this, arguments);
        };
    }

    // 4.5 Patch Connection.prototype.call to bypass XmlRpc.checkParams
    if (samp.Connection) {
    // 1. バリデーションの根源を断つ
    samp.Connection.prototype.checkParams = () => true;

    // 2. notifyAll などの動的メソッドを「生のexecute」へ強制転送するよう上書き
   const sampMethods = ["notifyAll", "notify", "callAndWait", "callAllAndWait"];
   sampMethods.forEach(method => {
    samp.Connection.prototype[method] = function() {
        const args = Array.from(arguments); 
        // args[0] は message オブジェクト
        // args[1] は成功コールバック (success)
        // args[2] は失敗コールバック (error)
        
        const pk = this.privateKey;
        const hubMethodName = "samp.hub." + method;
        
        console.log(`[SAMP Patch] Forced Redirect: ${method} -> execute(${hubMethodName})`);
        
        // ★修正点: 第二引数の配列には [pk, message] のみを入れる
        return this.client.execute(hubMethodName, [pk, args[0]], args[1], args[2]);
    };
});
    console.log("[SAMP Patch] Connection prototype methods (notifyAll etc.) fully overridden");
}

    // 5. Patch checkParams to be a no-op everywhere to avoid signature mismatch errors
    const noopCheck = function() { 
        return true; 
    };
    
    const patchObject = (obj: any) => {
    if (!obj) return;
    try {
        // 静的メソッドの無効化
        obj.checkParams = () => true;
        // プロトタイプ（インスタンス用）の無効化
        if (obj.prototype) {
            obj.prototype.checkParams = () => true;
        }
    } catch (e) {}
};

    patchObject(samp.XmlRpc);
    patchObject(samp.XmlRpcRequest);
    patchObject(samp.XmlRpcClient);
    patchObject(samp.XmlRpcResponse);
    patchObject(samp.XmlRpcDeserializer);
    patchObject(samp.Connection);
    patchObject(samp.Connector);
    
    // Also patch globally if they exist
    patchObject((window as any).XmlRpc);
    patchObject((window as any).XmlRpcRequest);
    patchObject((window as any).XmlRpcClient);
    patchObject((window as any).XmlRpcResponse);
    patchObject((window as any).XmlRpcDeserializer);
    patchObject((window as any).XmlRpcConnection);
    patchObject((window as any).XmlRpcConnector);

    // Ensure MyRequest has checkParams too just in case
    (MyRequest as any).checkParams = noopCheck;
    (MyRequest.prototype as any).checkParams = noopCheck;
    
    // 6. Custom Deserializer to bypass buggy samp.js logic
    const customDeserialize = (xml: string): any => {
        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(xml, "text/xml");
            
            const deserializeNode = (node: Node): any => {
                const type = node.nodeName.toLowerCase();
                if (type === 'value') {
                    const child = Array.from(node.childNodes).find(n => n.nodeType === 1);
                    return child ? deserializeNode(child) : node.textContent;
                }
                if (type === 'string') return node.textContent;
                if (type === 'int' || type === 'i4') return parseInt(node.textContent || '0', 10);
                if (type === 'double') return parseFloat(node.textContent || '0');
                if (type === 'boolean') return node.textContent === '1' || node.textContent === 'true';
                if (type === 'array') {
                    const data = Array.from(node.childNodes).find(n => n.nodeName.toLowerCase() === 'data');
                    if (!data) return [];
                    return Array.from(data.childNodes)
                        .filter(n => n.nodeType === 1)
                        .map(n => deserializeNode(n));
                }
                if (type === 'struct') {
                    const obj: any = {};
                    Array.from(node.childNodes)
                        .filter(n => n.nodeName.toLowerCase() === 'member')
                        .forEach(m => {
                            const nameNode = Array.from(m.childNodes).find(n => n.nodeName.toLowerCase() === 'name');
                            const valueNode = Array.from(m.childNodes).find(n => n.nodeName.toLowerCase() === 'value');
                            if (nameNode && valueNode) {
                                obj[nameNode.textContent || ''] = deserializeNode(valueNode);
                            }
                        });
                    return obj;
                }
                return node.textContent;
            };

            const fault = doc.getElementsByTagName('fault')[0];
            if (fault) {
                const faultValue = deserializeNode(fault.getElementsByTagName('value')[0]);
                throw new Error(`XML-RPC Fault: ${faultValue.faultString} (${faultValue.faultCode})`);
            }
            
            const params = doc.getElementsByTagName('param');
            if (params.length > 0) {
                const valNode = params[0].getElementsByTagName('value')[0];
                return valNode ? deserializeNode(valNode) : null;
            }
            return null;
        } catch (e) {
            console.error("[SAMP Patch] Custom deserialization failed:", e);
            throw e;
        }
    };

    if (samp.XmlRpcDeserializer) {
        samp.XmlRpcDeserializer.deserializeResponse = customDeserialize;
        console.log("[SAMP Patch] samp.XmlRpcDeserializer.deserializeResponse replaced with custom implementation");
    }

    samp.__tastro_patched = true;
    window.samp = samp;
    console.log("[SAMP] Aggressive patches applied successfully.");
};

// Apply patches immediately if possible
if (typeof window !== 'undefined') {
    // Try patching immediately
    patchSampLibrary();
    // Also try again when DOM is ready
    window.addEventListener('DOMContentLoaded', patchSampLibrary);
    // And as a fallback, try every second for 5 seconds
    let attempts = 0;
    const interval = setInterval(() => {
        const samp = (window as any).samp || (window as any).module?.exports;
        if (samp && !samp.__tastro_patched) {
            patchSampLibrary();
        }
        if (++attempts > 5 || (samp && (samp as any).__tastro_patched)) {
            clearInterval(interval);
        }
    }, 1000);
}

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
    
    console.log('[SAMP] Initialization:');
    console.log(`  - Browser Hostname: ${window.location.hostname}`);
    console.log(`  - Server URL: ${window.location.origin}`);
    console.log(`  - SAMP Library: ${samp ? 'Loaded' : 'NOT LOADED'}`);
    
    if (samp && !connector) {
        const meta = {
            "samp.name": "T-Astro Web Studio",
            "samp.description.text": "Web-based Astronomy Control Center",
            "samp.icon.url": window.location.origin + "/favicon.ico"
        };
        // Connector handles the Web Profile (CORS, etc.)
        connector = new samp.Connector(meta);
        
        // Set up message listener
        connector.onMessage = (senderId: string, message: any, isCall: boolean) => {
            const mtype = message["samp.mtype"];
            const params = message["samp.params"];
            console.log(`[SAMP] Received message: ${mtype} from ${senderId}`);
            
            if (mtype === "coord.pointAt.sky" && skyCoordCallback) {
                const ra = parseFloat(params.ra);
                const dec = parseFloat(params.dec);
                if (!isNaN(ra) && !isNaN(dec)) {
                    console.log(`[SAMP] Sky coord received: RA=${ra}, Dec=${dec}`);
                    skyCoordCallback(ra, dec);
                }
            }
        };
        
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

    // ★ 修正: LAN環境対応 - ホストを自動検出
    const host = settings.host || window.location.hostname;
    const port = settings.port || 6002;
    const hubUrl = `http://${host}:${port}/api/samp/xmlrpc`;
    
    console.log(`[SAMP] Connecting to HUB at: ${hubUrl}`);
    console.log(`[SAMP] Settings - Host: ${host}, Port: ${port}`);
    if (statusCallback) statusCallback('Connecting', { hubUrl });

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
        connector = new samp.Connector(meta, { "samp.hub.xmlrpc.url": hubUrl });
        
        // Set up message listener
        connector.onMessage = (senderId: string, message: any, isCall: boolean) => {
            const mtype = message["samp.mtype"];
            const params = message["samp.params"];
            console.log(`[SAMP] Received message: ${mtype} from ${senderId}`);
            
            if (mtype === "coord.pointAt.sky" && skyCoordCallback) {
                const ra = parseFloat(params.ra);
                const dec = parseFloat(params.dec);
                if (!isNaN(ra) && !isNaN(dec)) {
                    console.log(`[SAMP] Sky coord received: RA=${ra}, Dec=${dec}`);
                    skyCoordCallback(ra, dec);
                }
            }
        };
        
        // CRITICAL: Force the endpoint on the connector's internal client
        if (connector.client) {
            connector.client.endpoint = hubUrl;
            connector.client.url = hubUrl;
            connector.client.hubUrl = hubUrl;
        }
        connector.hubUrl = hubUrl;
        
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
                statusCallback('Error', { error: `Connection timeout. Is SAMP Hub running at ${hubUrl}?` });
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
        try {
            connector.unregister();
        } catch (e) {
            console.warn("[SAMP] Disconnect error:", e);
        }
        connector = null;
    }
};

export const sendSkyCoord = async (ra: number, dec: number) => {
    const conn = connector?.connection;
    const client = conn?.client;

    if (conn && client) {
        try {
            const pk = conn.privateKey;
            const msg = {
                "samp.mtype": "coord.pointAt.sky",
                "samp.params": {
                    "ra": ra.toString(),
                    "dec": dec.toString()
                }
            };

            console.log(`[SAMP] Sending coord: RA=${ra}, Dec=${dec}`);

            // パッチ済みの execute を直接実行
            client.execute("samp.hub.notifyAll", [pk, msg], 
                () => console.log("[SAMP] Success: coord.pointAt.sky"),
                (err: any) => console.error("[SAMP] Failed:", err)
            );
        } catch (e) {
            console.error("[SAMP] Logic error inside sendSkyCoord:", e);
        }
    } else {
        console.warn("[SAMP] Cannot send coord: Connection not fully established.");
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
        // ★ 修正: LAN環境対応 - サーバーのホストアドレスを使用
        const host = settings.host || window.location.hostname;
        const port = settings.port || 6002;
        const hubUrl = `http://${host}:${port}/api/samp/xmlrpc`;
        
        // 1. Fetch registration info from our server
        const regResponse = await fetch(`${window.location.origin}/samp-registration`, { method: 'POST' });
        if (!regResponse.ok) throw new Error('Failed to get registration info from server');
        
        const regData = await regResponse.json();
        let returnedHubUrl = regData["samp.hub.xmlrpc.url"];
        const secret = regData["samp.secret"];
        
        console.log(`[SAMP] Server returned HUB URL: ${returnedHubUrl}`);
        
        // Smart URL correction for Cloud Run/Proxy environments
        if (returnedHubUrl && (returnedHubUrl.includes('localhost') || returnedHubUrl.includes('127.0.0.1'))) {
            try {
                const urlObj = new URL(returnedHubUrl);
                // Use current origin but keep the path
                returnedHubUrl = window.location.origin + urlObj.pathname + urlObj.search;
                console.log(`[SAMP] Corrected localhost URL to: ${returnedHubUrl}`);
            } catch (e) {
                console.warn("[SAMP] Failed to parse returnedHubUrl, using fallback:", e);
                returnedHubUrl = hubUrl;
            }
        }

        console.log(`[SAMP] Internal Hub URL: ${returnedHubUrl}`);

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
        
        // Set up message listener
        connector.onMessage = (senderId: string, message: any, isCall: boolean) => {
    const mtype = message["samp.mtype"];
    const params = message["samp.params"];
    
    if (mtype === "coord.pointAt.sky" && skyCoordCallback) {
        const ra = parseFloat(params.ra);
        const dec = parseFloat(params.dec);
        if (!isNaN(ra) && !isNaN(dec)) {
            skyCoordCallback(ra, dec);
        }
    }
};
        
        // Use the exact URL provided by the server
        connector.hubUrl = returnedHubUrl;
        if (connector.client) {
            connector.client.hubUrl = returnedHubUrl;
            connector.client.endpoint = returnedHubUrl;
            connector.client.url = returnedHubUrl;
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
        const client = new samp.XmlRpcClient(returnedHubUrl);
        client.endpoint = returnedHubUrl;
        client.url = returnedHubUrl;
        client.hubUrl = returnedHubUrl;
        
        client.execute("samp.hub.register", [secret], (result: any) => {
            console.log("[SAMP] Internal registration successful", result);
            const pk = result["samp.private-key"];

            // 1. メタデータの宣言
            client.execute("samp.hub.declareMetadata", [pk, meta], () => {
                console.log("[SAMP] Metadata declared");
            }, (err: any) => console.error("[SAMP] Metadata declaration failed:", err));

            // 2. 購読対象の宣言 (★重要: これがないとメッセージが届きません)
            const subscriptions = {
                "coord.pointAt.sky": {},
                "samp.app.ping": {},
                "samp.hub.event.shutdown": {},
                "samp.hub.event.register": {},
                "samp.hub.event.unregister": {},
                "samp.hub.event.metadata": {},
                "samp.hub.event.subscriptions": {}
            };
            client.execute("samp.hub.declareSubscriptions", [pk, subscriptions], () => {
                console.log("[SAMP] Subscriptions declared (coord.pointAt.sky)");
            }, (err: any) => console.error("[SAMP] Subscriptions declaration failed:", err));

            // 3. XML-RPCコールバックURLの登録
            // サーバー側の XML-RPC エンドポイントを指定
            const callbackUrl = `${window.location.origin}/api/samp/xmlrpc`;
            client.execute("samp.hub.setXmlrpcCallback", [pk, callbackUrl], () => {
                console.log("[SAMP] Callback registered:", callbackUrl);

                // 1. まず Connection オブジェクトを作る
                const conn = new samp.Connection(client, pk);
                
                // 2. ★超重要: statusCallback を呼ぶ「前」に connector に代入する
                // これにより、Connected イベントを受けて即座に座標を送ろうとする処理が
                // connector.connection.client を参照できるようになります。
                connector.connection = conn;

                console.log("[SAMP] Connection object established. Ready to send messages.");

                if (statusCallback) {
                    statusCallback('Connected');
                }
            }, (err: any) => {
                console.error("[SAMP] Callback registration failed:", err);
                if (statusCallback) statusCallback('Error', { error: 'Callback registration failed' });
            });
        }, (err: any) => { // ← samp.hub.register のエラーコールバックを閉じる
            console.error("[SAMP] Registration failed:", err);
            if (statusCallback) statusCallback('Error', { error: 'Registration failed' });
        });

        // タイムアウト監視は try ブロックの直下（非同期処理の外）に置く
        setTimeout(() => {
            if (connector && !connector.connection && statusCallback) {
                console.warn("[SAMP] Internal connection timeout");
                if (statusCallback) statusCallback('Error', { error: 'Internal Hub connection timeout.' });
            }
        }, 10000);
    } catch (e: any) {
        console.error("[SAMP] Internal connection error:", e);
        if (statusCallback) statusCallback('Error', { error: e.message });
    }
};