import { Router, Request, Response } from 'express';

/**
 * Registers the DSS Proxy route inside the provided Express Router.
 * This manager encapsulates NASA SkyView and CDS Aladin DSS tile proxying
 * to completely resolve CORS constraints in the browser.
 */
export function registerDssProxy(router: Router) {
    router.get('/dss/proxy', async (req: Request, res: Response) => {
        const targetUrl = req.query.url as string;
        if (!targetUrl) {
            return res.status(400).json({ error: 'Missing required url parameter' });
        }

        console.log(`[DSSProxy] Fetching DSS tile: ${targetUrl}`);

        // Set permissive CORS headers for the client
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET');

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000); // 20-second timeout

        // Cancel the remote request if the client disconnects prematurely
        req.on('close', () => controller.abort());

        try {
            const response = await fetch(targetUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'image/jpeg,image/png,image/*;q=0.8',
                    'Connection': 'keep-alive'
                },
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`DSS target server returned ${response.status} ${response.statusText}`);
            }

            const contentType = response.headers.get('content-type') || 'image/jpeg';
            res.setHeader('Content-Type', contentType);
            res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache tiles for 1 day

            const arrayBuffer = await response.arrayBuffer();
            res.send(Buffer.from(arrayBuffer));
        } catch (error: any) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
                if (!res.headersSent) {
                    res.status(504).json({ error: 'DSS Proxy Request Timeout or Client Aborted' });
                }
            } else {
                console.error('[DSSProxy] Error proxying tile:', error.message);
                if (!res.headersSent) {
                    res.status(500).json({ error: 'DSS Proxy Error', details: error.message });
                }
            }
        }
    });
}
