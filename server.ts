
import express from 'express';
import { createServer as createViteServer } from 'vite';
import http from 'http';
import https from 'https';
import { WebSocketServer, WebSocket } from 'ws';
import dgram from 'dgram';
import url from 'url';
import path from 'path';

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;
const ALPACA_PORT = 11111;
const WS_PORT = 11112;
const DISCOVERY_PORT = 32227;

async function startServer() {
    const app = express();
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
        res.setHeader('Content-Type', 'application/json');
        next();
    });

    apiRouter.get('/proxy/image', async (req, res) => {
        const imageUrl = req.query.url as string;
        if (!imageUrl) return res.status(400).send('Missing url');

        const fetchImage = (url: string, depth = 0) => {
            if (depth > 5) return res.status(500).send('Too many redirects');
            
            const protocol = url.startsWith('https') ? https : http;
            protocol.get(url, (proxyRes) => {
                // Handle redirects
                if (proxyRes.statusCode && proxyRes.statusCode >= 300 && proxyRes.statusCode < 400 && proxyRes.headers.location) {
                    return fetchImage(proxyRes.headers.location, depth + 1);
                }

                if (proxyRes.statusCode !== 200) {
                    res.setHeader('Content-Type', 'application/json');
                    return res.status(proxyRes.statusCode || 500).send(JSON.stringify({ error: `Failed to fetch image: ${proxyRes.statusCode}` }));
                }

                res.setHeader('Content-Type', proxyRes.headers['content-type'] || 'image/jpeg');
                res.setHeader('Cache-Control', 'public, max-age=86400');
                proxyRes.pipe(res);
            }).on('error', (e) => {
                res.setHeader('Content-Type', 'application/json');
                res.status(500).send(JSON.stringify({ error: e.message }));
            });
        };

        try {
            fetchImage(imageUrl);
        } catch (e: any) {
            res.setHeader('Content-Type', 'application/json');
            res.status(500).send(JSON.stringify({ error: e.message }));
        }
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

    apiRouter.all('/alpaca/proxy', async (req, res) => {
        const targetUrl = req.headers['x-target-url'] as string;
        
        if (!targetUrl) {
            return res.status(400).json({ ErrorNumber: 0x400, ErrorMessage: 'Missing x-target-url header' });
        }

        try {
            const parsedUrl = new URL(targetUrl);
            const options: http.RequestOptions = {
                method: req.method,
                headers: {
                    'Accept': 'application/json'
                },
                timeout: 5000
            };

            // Alpaca requires application/x-www-form-urlencoded for PUT/POST
            if (req.method === 'PUT' || req.method === 'POST') {
                options.headers!['Content-Type'] = 'application/x-www-form-urlencoded';
            }

            const proxyReq = http.request(targetUrl, options, (proxyRes) => {
                res.status(proxyRes.statusCode || 500);
                
                // Copy headers but filter out connection-related ones
                const headers = { ...proxyRes.headers };
                delete headers['transfer-encoding'];
                delete headers['content-length'];
                delete headers['connection'];
                res.set(headers);
                
                proxyRes.pipe(res);
            });

            proxyReq.on('error', (e) => {
                console.error(`[AlpacaProxy] Error: ${e.message}`);
                res.status(500).json({ 
                    Value: null,
                    ClientTransactionID: Number(req.body?.ClientTransactionID || req.query?.ClientTransactionID || 0),
                    ServerTransactionID: 0,
                    ErrorNumber: 0x500, 
                    ErrorMessage: `Proxy Error: ${e.message}` 
                });
            });

            if (req.method === 'PUT' || req.method === 'POST') {
                // Reconstruct body ensuring ClientTransactionID is preserved
                const bodyParams = new URLSearchParams();
                
                // Merge query and body params (Alpaca allows both, but body is preferred for PUT)
                const combinedParams = { ...req.query, ...req.body };
                for (const [key, value] of Object.entries(combinedParams)) {
                    if (value !== undefined) bodyParams.append(key, String(value));
                }
                
                const bodyStr = bodyParams.toString();
                options.headers!['Content-Length'] = Buffer.byteLength(bodyStr);
                proxyReq.write(bodyStr);
            }

            proxyReq.end();
        } catch (e: any) {
            res.status(500).json({ 
                ErrorNumber: 0x500, 
                ErrorMessage: `Setup Error: ${e.message}` 
            });
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
        // Fallback to serve html files without extension in production
        app.get('/:page', (req, res, next) => {
            const pages = ['index', 'alpaca', 'simulator', 'test'];
            const page = req.params.page;
            if (pages.includes(page)) {
                res.sendFile(path.resolve(process.cwd(), 'dist', `${page}.html`));
            } else if (page === 'viewer') {
                res.sendFile(path.resolve(process.cwd(), 'dist', 'viewer', 'index.html'));
            } else {
                next();
            }
        });
        // Final fallback for SPA
        app.get('*', (req, res, next) => {
            // Strictly exclude API and static assets from SPA fallback
            if (req.path.startsWith('/api/') || req.path.includes('.')) return next();
            res.sendFile(path.resolve(process.cwd(), 'dist', 'index.html'));
        });
    }

    server.listen(PORT, '0.0.0.0', () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
}

startServer();
