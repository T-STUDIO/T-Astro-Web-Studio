import { Router, Request, Response } from 'express';
import * as https from 'https';
import * as http from 'http';
import { URL } from 'url';

/**
 * Registers the DSS Proxy route inside the provided Express Router.
 * This manager encapsulates NASA SkyView and CDS Aladin DSS tile proxying
 * to completely resolve CORS constraints in the browser.
 */
export function registerDssProxy(router: Router) {
    router.get('/dss/proxy', (req: Request, res: Response) => {
        const targetUrl = req.query.url as string;
        if (!targetUrl) {
            return res.status(400).json({ error: 'Missing required url parameter' });
        }

        console.log(`[DSSProxy] Fetching DSS tile: ${targetUrl}`);

        // Set permissive CORS headers for the client
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET');

        try {
            const parsedUrl = new URL(targetUrl);
            const isHttps = parsedUrl.protocol === 'https:';
            const transport = isHttps ? https : http;

            const headers: Record<string, string> = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'image/jpeg,image/png,image/*;q=0.8',
                'Connection': 'keep-alive'
            };

            // Spoof headers based on host
            if (parsedUrl.hostname.includes('nasa.gov')) {
                headers['Referer'] = 'https://skyview.gsfc.nasa.gov/';
                headers['Host'] = 'skyview.gsfc.nasa.gov';
            } else if (parsedUrl.hostname.includes('unistra.fr') || parsedUrl.hostname.includes('aladin')) {
                headers['Referer'] = 'https://aladin.cds.unistra.fr/';
                headers['Host'] = parsedUrl.host;
            } else {
                headers['Referer'] = parsedUrl.origin;
                headers['Host'] = parsedUrl.host;
            }

            const options: https.RequestOptions = {
                method: 'GET',
                headers,
                timeout: 20000 // 20-second timeout
            };

            // Skip SSL/TLS Verification completely
            if (isHttps) {
                options.agent = new https.Agent({ rejectUnauthorized: false });
            }

            let clientAborted = false;
            const proxyReq = transport.request(targetUrl, options, (proxyRes) => {
                if (clientAborted) return;

                if (proxyRes.statusCode && proxyRes.statusCode >= 400) {
                    console.error(`[DSSProxy] Remote server returned ${proxyRes.statusCode}`);
                    if (!res.headersSent) {
                        res.status(proxyRes.statusCode).json({ error: `DSS target server returned ${proxyRes.statusCode}` });
                    }
                    return;
                }

                const contentType = proxyRes.headers['content-type'] || 'image/jpeg';
                res.setHeader('Content-Type', contentType);
                res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache tiles for 1 day

                // Pipe chunks directly to client to optimize memory and performance
                proxyRes.pipe(res);
            });

            proxyReq.on('timeout', () => {
                proxyReq.destroy();
                if (!res.headersSent) {
                    res.status(504).json({ error: 'DSS Proxy Request Timeout' });
                }
            });

            proxyReq.on('error', (err: any) => {
                if (clientAborted) return;
                console.error('[DSSProxy] Error proxying tile:', err.message);
                if (!res.headersSent) {
                    res.status(500).json({ error: 'DSS Proxy Error', details: err.message });
                }
            });

            // If the client disconnects, abort the proxy request safely
            req.on('close', () => {
                clientAborted = true;
                proxyReq.destroy();
            });

            proxyReq.end();
        } catch (error: any) {
            console.error('[DSSProxy] URL parsing or execution error:', error.message);
            if (!res.headersSent) {
                res.status(500).json({ error: 'DSS Proxy Error', details: error.message });
            }
        }
    });
}
