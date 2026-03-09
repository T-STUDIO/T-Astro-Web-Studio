
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
    app.get('/api/alpaca/discover', (req, res) => {
        const results: any[] = [];
        const client = dgram.createSocket('udp4');
        client.on('message', (msg, rinfo) => {
            try {
                const data = JSON.parse(msg.toString());
                results.push({ host: rinfo.address, port: data.AlpacaPort, serverName: 'Discovered Server' });
            } catch (e) {}
        });
        client.bind(0);
        client.setBroadcast(true);
        const discoveryMsg = Buffer.from('alpacadiscovery1');
        client.send(discoveryMsg, 0, discoveryMsg.length, DISCOVERY_PORT, '255.255.255.255');
        
        setTimeout(() => {
            client.close();
            res.json(results);
        }, 2000);
    });

    app.all('/api/alpaca/proxy', async (req, res) => {
        const targetUrl = req.headers['x-target-url'] as string;
        if (!targetUrl) return res.status(400).send('Missing x-target-url header');

        try {
            const method = req.method;
            const response = await fetch(targetUrl, {
                method,
                headers: {
                    'Content-Type': req.headers['content-type'] as string || 'application/x-www-form-urlencoded'
                },
                body: method !== 'GET' ? new URLSearchParams(req.body).toString() : undefined
            });

            const data = await response.json();
            res.json(data);
        } catch (e: any) {
            res.status(500).json({ ErrorNumber: 0x500, ErrorMessage: e.message });
        }
    });

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
