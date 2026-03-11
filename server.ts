
import express from 'express';
import { createServer as createViteServer } from 'vite';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import dgram from 'dgram';
import url from 'url';
import path from 'path';

const PORT = 3000;
const ALPACA_PORT = 11111;
const WS_PORT = 11112;
const DISCOVERY_PORT = 32227;

async function startServer() {
    const app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    const server = http.createServer(app);

    // Request Logger
    app.use((req, res, next) => {
        if (req.path.startsWith('/api/')) {
            console.log(`[API Request] ${req.method} ${req.path}`);
        }
        next();
    });

    const wss = new WebSocketServer({ port: WS_PORT });

    let activeBridge: WebSocket | null = null;
    let pendingRequests = new Map();
    let requestIdCounter = 0;

    wss.on('connection', (ws) => {
        console.log('[Bridge] UI Linked');
        if (activeBridge) activeBridge.terminate();
        activeBridge = ws;
        ws.on('message', (data) => {
            try {
                const res = JSON.parse(data.toString());
                const ctx = pendingRequests.get(res.requestId);
                if (ctx) {
                    clearTimeout(ctx.timer);
                    ctx.resolve(res.payload);
                    pendingRequests.delete(res.requestId);
                }
            } catch (e) { console.error("[Bridge] Response error", e); }
        });
        ws.on('close', () => { if (activeBridge === ws) activeBridge = null; });
    });

    // Alpaca Discovery (UDP)
    const udp = dgram.createSocket('udp4');
    udp.on('message', (msg, rinfo) => {
        const query = msg.toString().toLowerCase();
        if (query.includes('alpacadiscovery1')) {
            const response = JSON.stringify({ AlpacaPort: ALPACA_PORT });
            udp.send(response, rinfo.port, rinfo.address);
        }
    });
    udp.bind(DISCOVERY_PORT, '0.0.0.0');

    // API Routes
    const apiRouter = express.Router();

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

    apiRouter.all('/alpaca/proxy', async (req, res) => {
        const targetUrl = req.headers['x-target-url'] as string;
        console.log(`[AlpacaProxy] Incoming request: ${req.method} for ${targetUrl || 'MISSING URL'}`);
        
        if (!targetUrl) {
            console.error('[AlpacaProxy] Error: Missing x-target-url header');
            return res.status(400).json({ ErrorNumber: 0x400, ErrorMessage: 'Missing x-target-url header' });
        }

        try {
            const options = {
                method: req.method,
                headers: {
                    'Content-Type': req.headers['content-type'] as string || 'application/x-www-form-urlencoded',
                    'Accept': 'application/json'
                },
                timeout: 5000
            };

            const proxyReq = http.request(targetUrl, options, (proxyRes) => {
                console.log(`[AlpacaProxy] Response: ${proxyRes.statusCode} from ${targetUrl}`);
                res.status(proxyRes.statusCode || 500);
                
                const headers = { ...proxyRes.headers };
                delete headers['transfer-encoding'];
                delete headers['content-length'];
                res.set(headers);
                
                proxyRes.pipe(res);
            });

            proxyReq.on('error', (e) => {
                console.error(`[AlpacaProxy] Request Error for ${targetUrl}: ${e.message}`);
                res.status(500).json({ ErrorNumber: 0x500, ErrorMessage: `Proxy Error: ${e.message}` });
            });

            proxyReq.on('timeout', () => {
                console.error(`[AlpacaProxy] Timeout for ${targetUrl}`);
                proxyReq.destroy();
                res.status(500).json({ ErrorNumber: 0x500, ErrorMessage: 'Connection timed out (5s)' });
            });

            if (req.method !== 'GET' && req.method !== 'HEAD') {
                const body = req.body;
                if (body && Object.keys(body).length > 0) {
                    const bodyStr = typeof body === 'string' ? body : 
                                   (req.is('json') ? JSON.stringify(body) : new URLSearchParams(body as any).toString());
                    proxyReq.write(bodyStr);
                }
            }
            proxyReq.end();
        } catch (e: any) {
            console.error(`[AlpacaProxy] Setup Error for ${targetUrl}: ${e.message}`);
            res.status(500).json({ ErrorNumber: 0x500, ErrorMessage: `Setup Error: ${e.message}` });
        }
    });

    // API 404 Handler (Ensures no HTML fallback for /api/*)
    apiRouter.use((req, res) => {
        res.status(404).json({ error: 'API route not found', path: req.path });
    });

    app.use('/api', apiRouter);

    // Vite middleware for development
    if (process.env.NODE_ENV !== 'production') {
        const vite = await createViteServer({
            server: { middlewareMode: true },
            appType: 'custom', 
        });

        app.use(vite.middlewares);

        // Handle specific HTML files AFTER vite.middlewares
        app.get(['/', '/index.html', '/alpaca.html', '/simulator.html', '/test.html'], async (req, res, next) => {
            const url = req.path === '/' ? '/index.html' : req.path;
            try {
                const fs = await import('fs');
                const path = await import('path');
                const templatePath = path.resolve(process.cwd(), url.substring(1));
                
                if (!fs.existsSync(templatePath)) return next();

                let template = fs.readFileSync(templatePath, 'utf-8');
                template = await vite.transformIndexHtml(url, template);
                res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
            } catch (e) {
                vite.ssrFixStacktrace(e as Error);
                next(e);
            }
        });
    } else {
        app.use(express.static('dist'));
        // Fallback to serve html files without extension in production if needed
        app.get('/:page', (req, res, next) => {
            const pages = ['index', 'alpaca', 'simulator', 'test'];
            if (pages.includes(req.params.page)) {
                res.sendFile(path.resolve(process.cwd(), 'dist', `${req.params.page}.html`));
            } else {
                next();
            }
        });
    }

    server.listen(PORT, '0.0.0.0', () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
}

startServer();
