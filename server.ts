
import express from 'express';
import http from 'http';
import https from 'https';
import { WebSocketServer, WebSocket } from 'ws';
import dgram from 'dgram';
import url from 'url';
import path from 'path';
import fs from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const xmlrpc = require('xmlrpc');

let Deserializer: any;
let Serializer: any;

try {
    Deserializer = xmlrpc.Deserializer || require('xmlrpc/lib/deserializer.js');
    Serializer = xmlrpc.Serializer || require('xmlrpc/lib/serializer.js');
} catch (e) {
    console.error('[Server] Error loading xmlrpc components:', e);
}

import EventEmitter from 'events';

console.log('[Server] Starting T-Astro Web Studio...');

const args = process.argv.slice(2);
const portArg = args.indexOf('--port');
const cmdPort = portArg !== -1 ? parseInt(args[portArg + 1]) : null;
const hostArg = args.indexOf('--host');
const cmdHost = hostArg !== -1 ? args[hostArg + 1] : null;
const BIND_HOST = cmdHost || '0.0.0.0';  // ★ 修正: LAN環境用に '0.0.0.0' をデフォルトに (localhostだと外部から接続不可)

const PORT = cmdPort || (process.env.PORT ? parseInt(process.env.PORT) : 6002);
const ALPACA_PORT = 11111;
const WS_PORT = 11112;
const SAMP_WS_PORT = 31000;
const DISCOVERY_PORT = 32227;

// --- SAMP Hub State ---
interface SampClient {
    id: string;
    privateKey: string;
    xmlrpcUrl: string;
    metadata: any;
    subscriptions: any;
}

let sampClients = new Map<string, SampClient>();
const sampHubSecret = 't-astro-samp-secret-fixed';

// WebSocket Server for SAMP Client Proxy
let sampWss: WebSocketServer | null = null;
const sampWsClients = new Map<string, WebSocket>(); // clientId -> WebSocket

// Track external Hub connections where our server is the client
const externalHubConnections = new Map<string, {
    hubUrl: string;
    privateKey: string;
    selfId: string;
    client: any;
}>();

function createXmlRpcClient(urlStr: string) {
    console.log(`[Server] Creating XML-RPC client for: ${urlStr}`);
    try {
        // Try to use the URL string directly first, as it's more robust for some libraries
        if (typeof xmlrpc.createClient === 'function') {
            return xmlrpc.createClient(urlStr as any);
        }
        throw new Error('xmlrpc.createClient is not a function');
    } catch (e) {
        // Fallback to manual parsing if string-based creation fails
        try {
            const u = new URL(urlStr);
            const options: any = {
                host: u.hostname,
                port: parseInt(u.port) || (u.protocol === 'https:' ? 443 : 80),
                path: u.pathname + u.search
            };
            // Basic auth support if provided in URL
            if (u.username || u.password) {
                options.basic_auth = {
                    user: u.username,
                    pass: u.password
                };
            }
            console.log(`[Server] XML-RPC client options:`, options);
            if (typeof xmlrpc.createClient === 'function') {
                return xmlrpc.createClient(options);
            }
            throw new Error('xmlrpc.createClient is not a function');
        } catch (e2) {
            console.error(`[Server] Failed to create XML-RPC client for ${urlStr}:`, e2);
            throw e2;
        }
    }
}

async function startServer() {
    const app = express();

    // CORS for SAMP Web Profile
    app.use((req, res, next) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, POST, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', '*');
        if (req.method === 'OPTIONS') return res.status(200).end();
        next();
    });

    // Proxy routes BEFORE body parsers to allow piping raw streams (crucial for SAMP and Alpaca PUT/POST)
    app.all('/api/alpaca/proxy', async (req, res) => {
        if (req.method === 'OPTIONS') {
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, POST, DELETE, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', '*');
            return res.status(200).end();
        }

        const targetUrl = (req.query.target as string) || (req.headers['x-target-url'] as string);
        if (!targetUrl) {
            return res.status(400).json({ error: 'Missing target URL' });
        }

        console.log(`[Alpaca Proxy] ${req.method} -> ${targetUrl}`);
        try {
            const parsedUrl = new URL(targetUrl);
            const isHttps = parsedUrl.protocol === 'https:';
            const transport = isHttps ? https : http;

            const options: any = {
                method: req.method,
                headers: { ...req.headers },
                timeout: 30000
            };

            // Clean up headers for proxying
            delete options.headers.host;
            delete options.headers['x-target-url'];
            // Keep content-length if it exists to avoid chunked encoding issues with some Alpaca servers
            options.headers.host = parsedUrl.host;
            options.headers.connection = 'keep-alive';

            const proxyReq = transport.request(targetUrl, options, (proxyRes) => {
                // Forward status and headers
                const headers = { ...proxyRes.headers };
                headers['Access-Control-Allow-Origin'] = '*';
                headers['Access-Control-Allow-Methods'] = 'GET, PUT, POST, DELETE, OPTIONS';
                headers['Access-Control-Allow-Headers'] = '*';
                res.writeHead(proxyRes.statusCode || 200, headers);
                proxyRes.pipe(res);
            });

            proxyReq.on('error', (err) => {
                console.error(`[Alpaca Proxy Error] ${err.message} for ${targetUrl}`);
                if (!res.headersSent) {
                    res.status(502).json({ 
                        ErrorNumber: 0x400, 
                        ErrorMessage: `Proxy Error: ${err.message}`,
                        DriverException: err.stack
                    });
                }
            });

            // Pipe the original request body to the proxy request
            req.pipe(proxyReq);
        } catch (err: any) {
            console.error(`[Alpaca Proxy Fatal] ${err.message}`);
            if (!res.headersSent) res.status(500).json({ error: err.message });
        }
    });

    app.all('/api/samp/proxy', async (req, res) => {
        if (req.method === 'OPTIONS') {
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, POST, DELETE, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', '*');
            return res.status(200).end();
        }

        const targetUrl = (req.query.target as string) || (req.headers['x-target-url'] as string);
        if (!targetUrl) {
            return res.status(400).json({ error: 'Missing target URL' });
        }

        // Note: Localhost proxying is allowed to support local server installations.
        console.log(`[SAMP Proxy] ${req.method} -> ${targetUrl}`);
        try {
            const parsedUrl = new URL(targetUrl);
            const transport = parsedUrl.protocol === 'https:' ? https : http;

            const options: any = {
                method: req.method,
                headers: {
                    ...req.headers,
                },
                timeout: 15000
            };
            
            // Clean up headers for proxying
            delete options.headers.host;
            delete options.headers['x-target-url'];
            // Keep content-length if it exists to avoid chunked encoding issues with some XML-RPC servers
            options.headers.host = parsedUrl.host;
            options.headers.connection = 'keep-alive';

            const proxyReq = transport.request(targetUrl, options, (proxyRes) => {
                // Forward status and headers
                const headers = { ...proxyRes.headers };
                headers['Access-Control-Allow-Origin'] = '*';
                headers['Access-Control-Allow-Methods'] = 'GET, PUT, POST, DELETE, OPTIONS';
                headers['Access-Control-Allow-Headers'] = '*';
                res.writeHead(proxyRes.statusCode || 200, headers);
                proxyRes.pipe(res);
            });

            proxyReq.on('error', (err) => {
                console.error(`[SAMP Proxy Error] ${err.message} for ${targetUrl}`);
                if (!res.headersSent) {
                    res.status(502).json({ error: `SAMP Proxy Error: ${err.message}` });
                }
            });

            // Pipe the original request body to the proxy request
            req.pipe(proxyReq);
        } catch (err: any) {
            console.error(`[SAMP Proxy Fatal] ${err.message}`);
            if (!res.headersSent) res.status(500).json({ error: err.message });
        }
    });

    // --- SAMP Web Profile Registration ---
    app.post('/samp-registration', (req, res) => {
        const protocol = req.headers['x-forwarded-proto'] || req.protocol;
        const host = req.get('host');
        const hubUrl = `${protocol}://${host}/api/samp/xmlrpc`;
        console.log(`[SAMP Hub] Registration request received. Returning hubUrl: ${hubUrl}`);
        res.json({
            "samp.hub.xmlrpc.url": hubUrl,
            "samp.secret": sampHubSecret,
            "samp.private-key": "t-astro-private-" + Math.random().toString(36).substring(7)
        });
    });

    // --- SAMP XML-RPC Hub Implementation ---
    class SampXmlRpcHub extends EventEmitter {
        constructor() {
            super();
        }

        handleRequest(req: any, res: any) {
            const url = new URL(req.url, `http://${req.headers.host}`);
            const proxyId = url.searchParams.get('proxyId');
            
            const deserializer = new Deserializer();
            deserializer.deserializeMethodCall(req, (error: any, methodName: string, params: any[]) => {
                if (error) {
                    console.error('[SAMP Hub] Deserialization error:', error);
                    res.writeHead(500);
                    return res.end();
                }

                console.log(`[SAMP Hub] Method call: ${methodName}${proxyId ? ' (Proxy: ' + proxyId + ')' : ''}`);
                const listeners = this.listeners(methodName);
                if (listeners.length > 0) {
                    const listener = listeners[0] as any;
                    listener(null, params, (err: any, value: any) => {
                        let xml = null;
                        if (err !== null) {
                            xml = Serializer.serializeFault(err);
                        } else {
                            xml = Serializer.serializeMethodResponse(value);
                        }
                        res.writeHead(200, { 'Content-Type': 'text/xml' });
                        res.end(xml);
                    }, proxyId);
                } else {
                    console.warn(`[SAMP Hub] Method not found: ${methodName}`);
                    res.writeHead(404);
                    res.end();
                }
            });
        }
    }

    let xmlRpcServer: any;
    try {
        console.log('[SAMP Hub] Initializing XML-RPC server...');
        xmlRpcServer = new SampXmlRpcHub();
        console.log('[SAMP Hub] XML-RPC server initialized successfully');
        
        // Verify components
        if (!Serializer || !Deserializer) {
            console.error('[SAMP Hub] WARNING: Serializer or Deserializer is missing. XML-RPC will not work.');
        } else {
            console.log('[SAMP Hub] XML-RPC Serializer/Deserializer loaded.');
        }
    } catch (e: any) {
        console.error('[SAMP Hub] Critical Error during initialization:', e.message);
    }
    
    if (xmlRpcServer) {
        // Helper to find client by private key
        const getClientByPk = (pk: string) => {
            for (const client of sampClients.values()) {
                if (client.privateKey === pk) return client;
            }
            return null;
        };

        // Register method
        xmlRpcServer.on('samp.hub.register', (err: any, params: any[], callback: any) => {
            const secret = params[0];
            console.log(`[SAMP Hub] Register attempt with secret: ${secret}`);
            if (secret !== sampHubSecret) {
                console.warn('[SAMP Hub] Invalid secret provided');
                return callback(new Error('Invalid secret'), null);
            }
            
            const clientId = 'client-' + Math.random().toString(36).substring(7);
            const privateKey = 'pk-' + Math.random().toString(36).substring(7);
            
            sampClients.set(clientId, {
                id: clientId,
                privateKey,
                xmlrpcUrl: '',
                metadata: {},
                subscriptions: {}
            });
            
            console.log(`[SAMP Hub] Client registered: ${clientId}`);
            callback(null, {
                "samp.self-id": clientId,
                "samp.private-key": privateKey,
                "samp.hub-id": "t-astro-hub"
            });
        });

        // Unregister method
        xmlRpcServer.on('samp.hub.unregister', (err: any, params: any[], callback: any) => {
            const privateKey = params[0];
            const client = getClientByPk(privateKey);
            if (client) {
                sampClients.delete(client.id);
                console.log(`[SAMP Hub] Client unregistered: ${client.id}`);
            }
            callback(null, "");
        });

        // Declare Metadata
        xmlRpcServer.on('samp.hub.declareMetadata', (err: any, params: any[], callback: any) => {
            const privateKey = params[0];
            const metadata = params[1];
            const client = getClientByPk(privateKey);
            if (client) {
                client.metadata = metadata;
                console.log(`[SAMP Hub] Metadata declared for ${client.id}: ${metadata['samp.name']}`);
            }
            callback(null, "");
        });

        // Declare Subscriptions
        xmlRpcServer.on('samp.hub.declareSubscriptions', (err: any, params: any[], callback: any) => {
            const privateKey = params[0];
            const subs = params[1];
            const client = getClientByPk(privateKey);
            if (client) {
                client.subscriptions = subs;
                console.log(`[SAMP Hub] Subscriptions declared for ${client.id}`);
            }
            callback(null, "");
        });

        // Set XML-RPC Callback
        xmlRpcServer.on('samp.hub.setXmlrpcCallback', (err: any, params: any[], callback: any) => {
            const privateKey = params[0];
            const url = params[1];
            const client = getClientByPk(privateKey);
            if (client) {
                client.xmlrpcUrl = url;
                console.log(`[SAMP Hub] XML-RPC callback set for ${client.id}: ${url}`);
            }
            callback(null, "");
        });

        // Get Registered Clients
        xmlRpcServer.on('samp.hub.getRegisteredClients', (err: any, params: any[], callback: any) => {
            const privateKey = params[0];
            const client = getClientByPk(privateKey);
            if (!client) return callback(new Error('Invalid private key'), null);
            
            const ids = Array.from(sampClients.keys()).filter(id => id !== client.id);
            callback(null, ids);
        });

        // Get Metadata
        xmlRpcServer.on('samp.hub.getMetadata', (err: any, params: any[], callback: any) => {
            const privateKey = params[0];
            const targetId = params[1];
            const client = getClientByPk(privateKey);
            if (!client) return callback(new Error('Invalid private key'), null);
            
            const target = sampClients.get(targetId);
            callback(null, target ? target.metadata : {});
        });

        // --- SAMP Client Methods (Relay to Browser via WebSocket) ---
        
        xmlRpcServer.on('samp.client.receiveNotification', (err: any, params: any[], callback: any, proxyId: string) => {
            const senderId = params[0];
            const message = params[1];
            console.log(`[SAMP Hub] Client Relay: receiveNotification from ${senderId}${proxyId ? ' for proxy ' + proxyId : ''}`);
            
            // Broadcast to connected browser clients via WebSocket
            const payload = JSON.stringify({
                type: 'samp.notification',
                senderId,
                message
            });
            
            if (proxyId && sampWsClients.has(proxyId)) {
                const ws = sampWsClients.get(proxyId);
                if (ws && ws.readyState === WebSocket.OPEN) {
                    ws.send(payload);
                }
            } else {
                sampWsClients.forEach((ws) => {
                    if (ws.readyState === WebSocket.OPEN) {
                        ws.send(payload);
                    }
                });
            }
            
            callback(null, "");
        });

        xmlRpcServer.on('samp.client.receiveCall', (err: any, params: any[], callback: any, proxyId: string) => {
            const senderId = params[0];
            const msgTag = params[1];
            const message = params[2];
            console.log(`[SAMP Hub] Client Relay: receiveCall from ${senderId}, tag=${msgTag}${proxyId ? ' for proxy ' + proxyId : ''}`);
            
            // Forward to browser via WebSocket
            const payload = JSON.stringify({
                type: 'samp.call',
                senderId,
                msgTag,
                message
            });
            
            if (proxyId && sampWsClients.has(proxyId)) {
                const ws = sampWsClients.get(proxyId);
                if (ws && ws.readyState === WebSocket.OPEN) {
                    ws.send(payload);
                }
            } else {
                sampWsClients.forEach((ws) => {
                    if (ws.readyState === WebSocket.OPEN) {
                        ws.send(payload);
                    }
                });
            }
            
            // For now, we just acknowledge the call. 
            // Real SAMP calls expect a response later via samp.hub.reply.
            callback(null, "");
        });

        xmlRpcServer.on('samp.client.receiveResponse', (err: any, params: any[], callback: any, proxyId: string) => {
            const responderId = params[0];
            const msgTag = params[1];
            const response = params[2];
            console.log(`[SAMP Hub] Client Relay: receiveResponse from ${responderId}, tag=${msgTag}${proxyId ? ' for proxy ' + proxyId : ''}`);
            
            const payload = JSON.stringify({
                type: 'samp.response',
                responderId,
                msgTag,
                response
            });
            
            if (proxyId && sampWsClients.has(proxyId)) {
                const ws = sampWsClients.get(proxyId);
                if (ws && ws.readyState === WebSocket.OPEN) {
                    ws.send(payload);
                }
            } else {
                sampWsClients.forEach((ws) => {
                    if (ws.readyState === WebSocket.OPEN) {
                        ws.send(payload);
                    }
                });
            }
            
            callback(null, "");
        });

        // Notify All (Broadcast)
        xmlRpcServer.on('samp.hub.notifyAll', (err: any, params: any[], callback: any) => {
            const privateKey = params[0];
            const message = params[1];
            
            const sender = getClientByPk(privateKey);
            if (!sender) return callback(new Error('Invalid private key'), null);

            const mtype = message['samp.mtype'];
            console.log(`[SAMP Hub] Broadcast from ${sender.id}: ${mtype}`);
            
            // Broadcast to all other clients
            for (const client of sampClients.values()) {
                if (client.id !== sender.id && client.xmlrpcUrl) {
                    // ★修正ポイント：座標メッセージ(coord.pointAt.sky)は購読チェックをスルーして強制転送する
                    const isCoord = mtype === 'coord.pointAt.sky';
                    
                    if (isCoord || client.subscriptions[mtype] || client.subscriptions['*']) {
                        console.log(`[SAMP Hub] Forwarding ${mtype} from ${sender.id} to ${client.id} at ${client.xmlrpcUrl}`);
                        
                        const clientRpc = createXmlRpcClient(client.xmlrpcUrl);
                        // 第1引数は送信元のID、第2引数はメッセージ本体
                        clientRpc.methodCall('samp.client.receiveNotification', [sender.id, message], (err: any, res: any) => {
                            if (err) console.error(`[SAMP Hub] Error notifying client ${client.id} at ${client.xmlrpcUrl}:`, err.message);
                        });
                    }
                }
            }
            
            callback(null, "");
        });

        // Notify (Direct)
        xmlRpcServer.on('samp.hub.notify', (err: any, params: any[], callback: any) => {
            const privateKey = params[0];
            const recipientId = params[1];
            const message = params[2];
            
            const sender = getClientByPk(privateKey);
            if (!sender) return callback(new Error('Invalid private key'), null);

            const recipient = sampClients.get(recipientId);
            if (recipient && recipient.xmlrpcUrl) {
                console.log(`[SAMP Hub] Forwarding direct notify from ${sender.id} to ${recipient.id} at ${recipient.xmlrpcUrl}`);
                const clientRpc = createXmlRpcClient(recipient.xmlrpcUrl);
                clientRpc.methodCall('samp.client.receiveNotification', [sender.id, message], (err: any, res: any) => {
                    if (err) console.error(`[SAMP Hub] Error notifying client ${recipient.id} at ${recipient.xmlrpcUrl}:`, err.message);
                });
            }
            callback(null, "");
        });

        // Call (Direct)
        xmlRpcServer.on('samp.hub.call', (err: any, params: any[], callback: any) => {
            const privateKey = params[0];
            const recipientId = params[1];
            const msgTag = params[2];
            const message = params[3];
            
            const sender = getClientByPk(privateKey);
            if (!sender) return callback(new Error('Invalid private key'), null);

            const recipient = sampClients.get(recipientId);
            if (recipient && recipient.xmlrpcUrl) {
                console.log(`[SAMP Hub] Forwarding direct call from ${sender.id} to ${recipient.id} at ${recipient.xmlrpcUrl}`);
                const clientRpc = createXmlRpcClient(recipient.xmlrpcUrl);
                clientRpc.methodCall('samp.client.receiveCall', [sender.id, msgTag, message], (err: any, res: any) => {
                    if (err) console.error(`[SAMP Hub] Error calling client ${recipient.id} at ${recipient.xmlrpcUrl}:`, err.message);
                });
            }
            callback(null, "msg-" + Math.random().toString(36).substring(7));
        });

        // Call All
        xmlRpcServer.on('samp.hub.callAll', (err: any, params: any[], callback: any) => {
            const privateKey = params[0];
            const msgTag = params[1];
            const message = params[2];
            
            const sender = getClientByPk(privateKey);
            if (!sender) return callback(new Error('Invalid private key'), null);

            const mtype = message['samp.mtype'];
            console.log(`[SAMP Hub] Call All from ${sender.id}: ${mtype}`);
            
            const responses: Record<string, any> = {};
            
            for (const client of sampClients.values()) {
                if (client.id !== sender.id && client.xmlrpcUrl) {
                    if (client.subscriptions[mtype] || client.subscriptions['*']) {
                        console.log(`[SAMP Hub] Forwarding callAll ${mtype} from ${sender.id} to ${client.id} at ${client.xmlrpcUrl}`);
                        const clientRpc = createXmlRpcClient(client.xmlrpcUrl);
                        clientRpc.methodCall('samp.client.receiveCall', [sender.id, msgTag, message], (err: any, res: any) => {
                            if (err) console.error(`[SAMP Hub] Error calling client ${client.id} at ${client.xmlrpcUrl}:`, err.message);
                        });
                    }
                }
            }
            
            callback(null, responses);
        });

        // Mount the XML-RPC server to Express
        app.post('/api/samp/xmlrpc', (req, res) => {
            if (!xmlRpcServer) {
                return res.status(503).json({ error: 'SAMP Hub not initialized' });
            }
            console.log('[SAMP Hub] XML-RPC request received at /api/samp/xmlrpc');
            xmlRpcServer.handleRequest(req, res);
        });
    }

    // Body parsers AFTER SAMP Hub and Proxy routes to avoid consuming streams
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));


    const server = http.createServer(app);

    // Request Logger for Alpaca Proxy Debugging
    app.use((req, res, next) => {
        if (req.path.startsWith('/api/alpaca')) {
            console.log(`[Alpaca API] ${req.method} ${req.path}`);
        }
        next();
    });

    // API Routes
    const apiRouter = express.Router();

    // Ensure API errors return JSON, not HTML
    apiRouter.use((req, res, next) => {
        // Default to JSON for most API routes, but allow overrides for proxy routes
        if (!req.path.includes('/proxy/image') && !req.path.includes('/alpaca/proxy')) {
            res.setHeader('Content-Type', 'application/json');
        }
        next();
    });

    apiRouter.get('/proxy/image', async (req, res) => {
        const imageUrl = req.query.url as string;
        if (!imageUrl) return res.status(400).send('Missing url');

        console.log(`[ImageProxy] Fetching: ${imageUrl}`);
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET');

        const fetchWithRetry = async (url: string, retries = 2): Promise<void> => {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 25000);
            
            // Link client disconnect to our fetch
            req.on('close', () => controller.abort());

            try {
                const response = await fetch(url, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        'Accept': 'image/jpeg,image/png,image/*;q=0.8',
                        'Connection': 'keep-alive'
                    },
                    signal: controller.signal
                });

                clearTimeout(timeoutId);

                if (!response.ok) {
                    if (retries > 0 && (response.status === 503 || response.status === 429 || response.status === 500)) {
                        console.log(`[ImageProxy] Retrying ${url} due to status ${response.status} (${retries} left)`);
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        return fetchWithRetry(url, retries - 1);
                    }
                    throw new Error(`Remote server returned ${response.status} ${response.statusText}`);
                }

                const contentType = response.headers.get('content-type');
                if (contentType) res.setHeader('Content-Type', contentType);
                res.setHeader('Cache-Control', 'public, max-age=86400');
                
                const arrayBuffer = await response.arrayBuffer();
                res.send(Buffer.from(arrayBuffer));
            } catch (error: any) {
                clearTimeout(timeoutId);
                if (error.name === 'AbortError') {
                    if (!res.headersSent) res.status(504).json({ error: 'Gateway Timeout or Client Abort' });
                    return;
                }

                if (retries > 0 && (error.message.includes('socket hang up') || error.message.includes('ECONNRESET') || error.message.includes('ETIMEDOUT'))) {
                    console.log(`[ImageProxy] Retrying ${url} due to network error: ${error.message} (${retries} left)`);
                    await new Promise(resolve => setTimeout(resolve, 1500));
                    return fetchWithRetry(url, retries - 1);
                }

                console.error(`[ImageProxy] Final error for ${url}:`, error.message);
                if (!res.headersSent) {
                    res.status(500).json({ error: error.message, url });
                }
            }
        };

        await fetchWithRetry(imageUrl);
    });

    apiRouter.use((req, res, next) => {
        res.setHeader('X-Backend-Type', 'Express-Alpaca-Proxy');
        next();
    });

    apiRouter.post('/samp/stop', (req, res) => {
        console.log('[SAMP Hub] Stopping hub and clearing clients...');
        sampClients.clear();
        
        // Also clear external connections
        for (const conn of externalHubConnections.values()) {
            try {
                conn.client.methodCall('samp.hub.unregister', [conn.privateKey], () => {});
            } catch (e) {}
        }
        externalHubConnections.clear();
        
        res.json({ status: 'ok', message: 'SAMP Hub and External connections cleared' });
    });

    // --- SAMP External Hub Proxy Endpoints ---
    
    apiRouter.post('/samp/proxy/register', async (req, res) => {
        try {
            const { hubUrl, secret } = req.body;
            if (!hubUrl) return res.status(400).json({ error: 'Missing hubUrl' });

            console.log(`[SAMP Proxy] Registering with external hub: ${hubUrl}`);
            const client = createXmlRpcClient(hubUrl);
            
            console.log(`[SAMP Proxy] Calling samp.hub.register at ${hubUrl}...`);
            // Use provided secret or empty string
            const regParams = (secret && secret !== "") ? [secret] : [""];
            client.methodCall('samp.hub.register', regParams, (err: any, result: any) => {
                if (err) {
                    console.error(`[SAMP Proxy] Registration failed at ${hubUrl}:`, err.message);
                    return res.status(500).json({ error: `Registration failed: ${err.message}` });
                }

                console.log(`[SAMP Proxy] Registration result from ${hubUrl}:`, result);
                if (!result || !result["samp.private-key"]) {
                    console.error(`[SAMP Proxy] Registration returned invalid result from ${hubUrl}`);
                    return res.status(500).json({ error: 'Invalid registration result from hub' });
                }

                const privateKey = result["samp.private-key"];
                const selfId = result["samp.self-id"];
                
                console.log(`[SAMP Proxy] Registered with ${hubUrl}. PrivateKey: ${privateKey}, SelfId: ${selfId}`);
                
                // Store connection
                externalHubConnections.set(selfId, { hubUrl, privateKey, selfId, client });

                // Declare Metadata
                const meta = {
                    "samp.name": "T-Astro Web Studio (Proxy)",
                    "samp.description.text": "Web-based Astronomy Control Center Proxy",
                    "samp.icon.url": "https://picsum.photos/seed/astro/64/64"
                };
                client.methodCall('samp.hub.declareMetadata', [privateKey, meta], (err: any) => {
                    if (err) console.error(`[SAMP Proxy] Metadata declaration failed:`, err.message);
                });

                // Declare Subscriptions
                const subs = {
                    "coord.pointAt.sky": {},
                    "samp.app.ping": {},
                    "samp.hub.event.shutdown": {}
                };
                client.methodCall('samp.hub.declareSubscriptions', [privateKey, subs], (err: any) => {
                    if (err) console.error(`[SAMP Proxy] Subscriptions declaration failed:`, err.message);
                });

                // Set Callback URL
                const protocol = req.headers['x-forwarded-proto'] || req.protocol;
                const host = req.get('host');
                const callbackUrl = `${protocol}://${host}/api/samp/xmlrpc?proxyId=${selfId}`;
                
                client.methodCall('samp.hub.setXmlrpcCallback', [privateKey, callbackUrl], (err: any) => {
                    if (err) console.error(`[SAMP Proxy] Callback registration failed:`, err.message);
                    else console.log(`[SAMP Proxy] Callback registered: ${callbackUrl}`);
                });

                res.json({ status: 'ok', selfId, privateKey });
            });
        } catch (error: any) {
            console.error(`[SAMP Proxy] Unexpected error in register:`, error);
            res.status(500).json({ error: error.message || 'Internal server error' });
        }
    });

    apiRouter.post('/samp/proxy/notifyAll', (req, res) => {
        const { selfId, message } = req.body;
        const conn = externalHubConnections.get(selfId);
        if (!conn) return res.status(404).json({ error: 'Connection not found' });

        console.log(`[SAMP Proxy] Forwarding notifyAll to ${conn.hubUrl}: ${message['samp.mtype']}`);
        conn.client.methodCall('samp.hub.notifyAll', [conn.privateKey, message], (err: any) => {
            if (err) {
                console.error(`[SAMP Proxy] notifyAll failed:`, err.message);
                return res.status(500).json({ error: err.message });
            }
            res.json({ status: 'ok' });
        });
    });

    apiRouter.get('/samp/lockfile', (req, res) => {
        const protocol = req.headers['x-forwarded-proto'] || req.protocol;
        const host = req.get('host') || 'localhost';
        // Use the host from the request to build the URL
        const hubUrl = `${protocol}://${host.split(':')[0]}:21012/api/samp/xmlrpc`;
        
        const content = [
            `# SAMP Standard Profile lockfile for T-Astro`,
            `samp.secret=${sampHubSecret}`,
            `samp.hub.xmlrpc.url=${hubUrl}`,
            `samp.profile.version=1.3`
        ].join('\n');
        
        res.setHeader('Content-Type', 'text/plain');
        res.send(content);
    });

    apiRouter.get('/alpaca/discover', (req, res) => {
        console.log('[AlpacaDiscovery] Starting UDP scan...');
        const results: any[] = [];
        const client = dgram.createSocket('udp4');
        
        client.on('error', (err) => {
            console.error('[AlpacaDiscovery] UDP Error:', err);
            client.close();
        });

        client.on('message', (msg, rinfo) => {
            console.log(`[AlpacaDiscovery] Received response from ${rinfo.address}`);
            try {
                const data = JSON.parse(msg.toString());
                results.push({ 
                    host: rinfo.address, 
                    port: data.AlpacaPort, 
                    serverName: 'Discovered Server',
                    manufacturer: 'Unknown'
                });
            } catch (e) {}
        });

        try {
            client.bind(0);
            client.setBroadcast(true);
            const discoveryMsg = Buffer.from('alpacadiscovery1');
            client.send(discoveryMsg, 0, discoveryMsg.length, DISCOVERY_PORT, '255.255.255.255');
        } catch (e) {
            console.error('[AlpacaDiscovery] Send Error:', e);
        }
        
        setTimeout(() => {
            try { client.close(); } catch(e) {}
            console.log(`[AlpacaDiscovery] Scan complete. Found ${results.length} servers.`);
            res.json(results);
        }, 2000);
    });

    apiRouter.get('/alpaca/status', (req, res) => {
        res.json({ 
            status: 'ok', 
            message: 'Alpaca proxy is active', 
            env: process.env.NODE_ENV || 'development',
            nodeVersion: process.version,
            timestamp: new Date().toISOString()
        });
    });
    
    // API 404 Handler (Ensures no HTML fallback for /api/*)
    apiRouter.use((req, res) => {
        res.status(404).json({ error: 'API route not found', path: req.path });
    });

    app.use('/api', apiRouter);

    // Vite middleware for development
    if (process.env.NODE_ENV !== 'production') {
        try {
            const { createServer: createViteServer } = await import('vite');
            const vite = await createViteServer({
                server: { middlewareMode: true },
                appType: 'spa', 
            });
            app.use(vite.middlewares);
            console.log('[Server] Vite middleware loaded (Development)');
        } catch (e) {
            console.error('[Server] Failed to load Vite middleware:', e);
            // Fallback to static serving if vite is missing even in non-production
            app.use(express.static(path.resolve(process.cwd(), 'dist')));
        }
    } else {
        const distPath = path.resolve(process.cwd(), 'dist');
        console.log(`[Server] Serving static files from: ${distPath}`);
        app.use(express.static(distPath));
        
        // Fallback to serve html files without extension in production
        app.get('/:page', (req, res, next) => {
            const pages = ['index', 'alpaca', 'simulator', 'test'];
            const page = req.params.page;
            if (pages.includes(page)) {
                res.sendFile(path.resolve(distPath, `${page}.html`));
            } else if (page === 'viewer') {
                res.sendFile(path.resolve(distPath, 'viewer', 'index.html'));
            } else {
                next();
            }
        });
        
        // Final fallback for SPA
        app.use((req, res, next) => {
            // Strictly exclude API and static assets from SPA fallback
            if (req.path.startsWith('/api/') || req.path.includes('.')) return next();
            res.sendFile(path.resolve(distPath, 'index.html'));
        });
    }

    server.on('error', (err: any) => {
        if (err.code === 'EADDRINUSE') {
            console.error(`[Server] Error: Port ${PORT} is already in use. Please kill the existing process or use a different port.`);
        } else {
            console.error(`[Server] Fatal Error:`, err);
        }
        process.exit(1);
    });
    const sampProfilePath = path.join(process.env.HOME || '', '.samp');
    const profileContent = [
        `samp.hub.xmlrpc.url=http://${BIND_HOST === '0.0.0.0' ? '127.0.0.1' : BIND_HOST}:21012/api/samp/xmlrpc`,
        `samp.secret=${sampHubSecret}`, 
        `samp.profile.version=1.3`
    ].join('\n');

    try {
        fs.writeFileSync(sampProfilePath, profileContent);
        console.log(`[SAMP] Profile written to ${sampProfilePath}`);
    } catch (e) {
        console.error(`[SAMP] Failed to write profile: ${e}`);
    }

    server.listen(PORT, BIND_HOST, () => {
        console.log(`[Main] Server running on http://${BIND_HOST === '0.0.0.0' ? 'localhost' : BIND_HOST}:${PORT}`);
    });

    // Initialize SAMP WebSocket Server
    sampWss = new WebSocketServer({ port: SAMP_WS_PORT });
    sampWss.on('connection', (ws) => {
        console.log('[SAMP WS] Browser client linked');
        
        ws.on('message', (data) => {
            try {
                const msg = JSON.parse(data.toString());
                if (msg.type === 'register') {
                    const clientId = msg.clientId;
                    if (clientId) {
                        sampWsClients.set(clientId, ws);
                        console.log(`[SAMP WS] Client registered: ${clientId}`);
                    }
                }
            } catch (e) {
                console.error('[SAMP WS] Message error:', e);
            }
        });

        ws.on('close', () => {
            // Find the clientId for this ws
            let clientIdToCleanup = null;
            for (const [id, clientWs] of sampWsClients.entries()) {
                if (clientWs === ws) {
                    clientIdToCleanup = id;
                    break;
                }
            }
            
            if (clientIdToCleanup) {
                sampWsClients.delete(clientIdToCleanup);
                console.log(`[SAMP WS] Browser client ${clientIdToCleanup} disconnected`);
                
                // If it was an external proxy connection, unregister it
                const conn = externalHubConnections.get(clientIdToCleanup);
                if (conn) {
                    console.log(`[SAMP Proxy] Unregistering proxy connection for ${clientIdToCleanup}`);
                    try {
                        conn.client.methodCall('samp.hub.unregister', [conn.privateKey], () => {
                            externalHubConnections.delete(clientIdToCleanup);
                        });
                    } catch (e) {
                        externalHubConnections.delete(clientIdToCleanup);
                    }
                }
            }
        });
    });
    console.log(`[SAMP WS] WebSocket server listening on port ${SAMP_WS_PORT}`);

    const SAMP_PORT = 21012;
    const sampHttpServer = http.createServer(app); // 既存のExpress(app)を21012でも受け付けるようにする

    sampHttpServer.on('error', (err: any) => {
        console.error(`[SAMP] Port ${SAMP_PORT} error:`, err.message);
    });

    sampHttpServer.listen(SAMP_PORT, BIND_HOST, () => {
        console.log(`[SAMP] Standard Hub Port 21012 is now listening on ${BIND_HOST}`);
    });
}

startServer();