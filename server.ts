
import express from 'express';
import http from 'http';
import https from 'https';
import { WebSocketServer, WebSocket } from 'ws';
import dgram from 'dgram';
import url from 'url';
import path from 'path';
import * as xmlrpc from 'xmlrpc';
// Use createRequire to import CommonJS modules that don't export correctly in ESM
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

let Deserializer: any;
let Serializer: any;

try {
    // Try to get them from the main xmlrpc object first
    Deserializer = (xmlrpc as any).Deserializer;
    Serializer = (xmlrpc as any).Serializer;
    
    // If not found, try to require them directly
    if (!Deserializer) {
        Deserializer = require('xmlrpc/lib/deserializer.js');
    }
    if (!Serializer) {
        Serializer = require('xmlrpc/lib/serializer.js');
    }
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
const BIND_HOST = cmdHost || '0.0.0.0';

const PORT = cmdPort || (process.env.PORT ? parseInt(process.env.PORT) : 6002);
const ALPACA_PORT = 11111;
const WS_PORT = 11112;
const DISCOVERY_PORT = 32227;

// --- SAMP Hub State ---
interface SampClient {
    id: string;
    privateKey: string;
    xmlrpcUrl: string;
    metadata: any;
    subscriptions: any;
}

const sampClients = new Map<string, SampClient>();
const sampHubSecret = 't-astro-samp-secret-' + Math.random().toString(36).substring(7);

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
        console.log('[SAMP Hub] Registration request received');
        const protocol = req.headers['x-forwarded-proto'] || req.protocol;
        const host = req.get('host');
        res.json({
            "samp.hub.xmlrpc.url": `${protocol}://${host}/api/samp/xmlrpc`,
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
            const deserializer = new Deserializer();
            deserializer.deserializeMethodCall(req, (error: any, methodName: string, params: any[]) => {
                if (error) {
                    console.error('[SAMP Hub] Deserialization error:', error);
                    res.writeHead(500);
                    return res.end();
                }

                console.log(`[SAMP Hub] Method call: ${methodName}`);
                if (this.listenerCount(methodName) > 0) {
                    this.emit(methodName, null, params, (err: any, value: any) => {
                        let xml = null;
                        if (err !== null) {
                            xml = Serializer.serializeFault(err);
                        } else {
                            xml = Serializer.serializeMethodResponse(value);
                        }
                        res.writeHead(200, { 'Content-Type': 'text/xml' });
                        res.end(xml);
                    });
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
                    // Check if client is subscribed to this mtype
                    if (client.subscriptions[mtype] || client.subscriptions['*']) {
                        const clientRpc = xmlrpc.createClient(client.xmlrpcUrl);
                        clientRpc.methodCall('samp.client.receiveNotification', [sender.id, message], (err: any, res: any) => {
                            if (err) console.error(`[SAMP Hub] Error notifying client ${client.id}:`, err);
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
                const clientRpc = xmlrpc.createClient(recipient.xmlrpcUrl);
                clientRpc.methodCall('samp.client.receiveNotification', [sender.id, message], (err: any, res: any) => {
                    if (err) console.error(`[SAMP Hub] Error notifying client ${recipient.id}:`, err);
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
                const clientRpc = xmlrpc.createClient(recipient.xmlrpcUrl);
                clientRpc.methodCall('samp.client.receiveCall', [sender.id, msgTag, message], (err: any, res: any) => {
                    if (err) console.error(`[SAMP Hub] Error calling client ${recipient.id}:`, err);
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
                        const clientRpc = xmlrpc.createClient(client.xmlrpcUrl);
                        clientRpc.methodCall('samp.client.receiveCall', [sender.id, msgTag, message], (err: any, res: any) => {
                            if (err) console.error(`[SAMP Hub] Error calling client ${client.id}:`, err);
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

    server.listen(PORT, BIND_HOST, () => {
        console.log(`Server running on http://${BIND_HOST === '0.0.0.0' ? 'localhost' : BIND_HOST}:${PORT}`);
    });
}

startServer();
