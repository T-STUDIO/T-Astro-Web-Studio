
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

    apiRouter.all('/alpaca/proxy', async (req, res) => {
        const targetUrl = req.headers['x-target-url'] as string;
        
        if (!targetUrl) {
            return res.status(400).json({ ErrorNumber: 0x400, ErrorMessage: 'Missing x-target-url header' });
        }

        console.log(`[AlpacaProxy] ${req.method} -> ${targetUrl}`);

        try {
            const parsedUrl = new URL(targetUrl);
            const isHttps = parsedUrl.protocol === 'https:';
            const requester = isHttps ? https : http;

            const options: http.RequestOptions = {
                method: req.method,
                headers: {
                    'Accept': req.headers['accept'] || 'application/json',
                    'User-Agent': 'T-Astro-Web-Studio/1.0'
                },
                timeout: 10000
            };

            // Alpaca requires application/x-www-form-urlencoded for PUT/POST
            if (req.method === 'PUT' || req.method === 'POST') {
                options.headers!['Content-Type'] = 'application/x-www-form-urlencoded';
                
                // Reconstruct body ensuring ClientTransactionID is preserved
                const bodyParams = new URLSearchParams();
                
                // Merge query and body params (Alpaca allows both, but body is preferred for PUT)
                const combinedParams = { ...req.query, ...req.body };
                for (const [key, value] of Object.entries(combinedParams)) {
                    if (value !== undefined) bodyParams.append(key, String(value));
                }
                
                const bodyStr = bodyParams.toString();
                options.headers!['Content-Length'] = Buffer.byteLength(bodyStr);

                const proxyReq = requester.request(targetUrl, options, (proxyRes) => {
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

                proxyReq.write(bodyStr);
                proxyReq.end();
            } else {
                const proxyReq = requester.request(targetUrl, options, (proxyRes) => {
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

                proxyReq.end();
            }
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
            appType: 'spa', 
        });

        app.use(vite.middlewares);
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
