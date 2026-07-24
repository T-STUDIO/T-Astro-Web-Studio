import { Router, Request, Response } from 'express';
import * as https from 'https';
import * as http from 'http';
import { URL } from 'url';

/**
 * Helper function to fetch URL with automatic redirect tracking (up to maxRedirects).
 * Completely encapsulates SSL bypass, header spoofing, and safe timeouts.
 */
function fetchWithRedirects(
    targetUrl: string,
    baseHeaders: Record<string, string>,
    maxRedirects: number = 5
): Promise<{ statusCode: number; headers: http.IncomingHttpHeaders; stream: http.IncomingMessage; finalUrl: string }> {
    return new Promise((resolve, reject) => {
        try {
            const parsedUrl = new URL(targetUrl);
            const isHttps = parsedUrl.protocol === 'https:';
            const transport = isHttps ? https : http;

            const headers = { ...baseHeaders };
            headers['Host'] = parsedUrl.host;

            // Spoof Referer based on hostname
            if (parsedUrl.hostname.includes('nasa.gov')) {
                headers['Referer'] = 'https://skyview.gsfc.nasa.gov/';
            } else if (parsedUrl.hostname.includes('unistra.fr') || parsedUrl.hostname.includes('aladin')) {
                headers['Referer'] = 'https://aladin.cds.unistra.fr/';
            } else {
                headers['Referer'] = parsedUrl.origin;
            }

            // Construct exact Node options with decompiled URL parameters
            const options: https.RequestOptions = {
                protocol: parsedUrl.protocol,
                hostname: parsedUrl.hostname,
                port: parsedUrl.port || (isHttps ? 443 : 80),
                path: parsedUrl.pathname + parsedUrl.search,
                method: 'GET',
                headers,
                timeout: 20000 // 20-second timeout
            };

            // Skip SSL/TLS Verification completely
            if (isHttps) {
                options.agent = new https.Agent({ rejectUnauthorized: false });
            }

            const req = transport.request(options, (res) => {
                const statusCode = res.statusCode || 200;

                // Handle Redirects (301, 302, 303, 307, 308)
                if (statusCode >= 300 && statusCode < 400 && res.headers.location) {
                    if (maxRedirects <= 0) {
                        req.destroy();
                        return reject(new Error('Too many redirects'));
                    }
                    
                    const rawRedirectUrl = res.headers.location;
                    const originalParsed = new URL(targetUrl);
                    const redirectParsed = new URL(rawRedirectUrl, targetUrl);

                    // NASA SkyView Workaround: If the Location header is missing query parameters
                    // but the original URL had them, preserve and append them to prevent 504 / 404 errors.
                    if (!redirectParsed.search && originalParsed.search) {
                        redirectParsed.search = originalParsed.search;
                    }

                    const finalRedirectUrl = redirectParsed.toString();
                    console.log(`[DSSProxy] Redirecting from ${targetUrl} to ${finalRedirectUrl}`);
                    
                    // Consume current response data to release memory/socket
                    res.resume();
                    
                    resolve(fetchWithRedirects(finalRedirectUrl, baseHeaders, maxRedirects - 1));
                } else {
                    resolve({ statusCode, headers: res.headers, stream: res, finalUrl: targetUrl });
                }
            });

            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });

            req.on('error', (err) => {
                reject(err);
            });

            req.end();
        } catch (err) {
            reject(err);
        }
    });
}

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

        const baseHeaders = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'image/jpeg,image/png,image/*;q=0.8',
            'Connection': 'keep-alive'
        };

        let clientAborted = false;
        let remoteStream: http.IncomingMessage | null = null;

        // Cleanup resources if the client aborts
        req.on('close', () => {
            clientAborted = true;
            if (remoteStream) {
                remoteStream.destroy();
            }
        });

        try {
            const { statusCode, headers, stream } = await fetchWithRedirects(targetUrl, baseHeaders);
            remoteStream = stream;

            if (clientAborted) {
                stream.destroy();
                return;
            }

            if (statusCode >= 400) {
                console.error(`[DSSProxy] Remote server returned status ${statusCode}`);
                stream.destroy();
                if (!res.headersSent) {
                    res.status(statusCode).json({ error: `DSS target server returned status ${statusCode}` });
                }
                return;
            }

            let contentType = headers['content-type'] || 'image/jpeg';
            
            // NASA SkyView and other servers sometimes return text/html even if the payload is a binary image.
            // We inspect the requested target URL to enforce a correct image MIME type.
            const lowerUrl = targetUrl.toLowerCase();
            if (!contentType || contentType.startsWith('text/html') || contentType.startsWith('text/plain')) {
                if (lowerUrl.includes('return=jpg') || lowerUrl.includes('format=jpg') || lowerUrl.includes('.jpg') || lowerUrl.includes('.jpeg')) {
                    contentType = 'image/jpeg';
                } else if (lowerUrl.includes('f=gif') || lowerUrl.includes('mime-type=download-gif') || lowerUrl.includes('.gif')) {
                    contentType = 'image/gif';
                } else {
                    contentType = 'image/jpeg'; // Safe fallback
                }
            }
            
            res.setHeader('Content-Type', contentType);
            res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache tiles for 1 day

            // Pipe the data chunks directly to the response
            stream.pipe(res);
        } catch (error: any) {
            if (clientAborted) return;
            console.error('[DSSProxy] Error proxying tile:', error.message);
            if (!res.headersSent) {
                if (error.message === 'Request timeout') {
                    res.status(504).json({ error: 'DSS Proxy Request Timeout' });
                } else {
                    res.status(500).json({ error: 'DSS Proxy Error', details: error.message });
                }
            }
        }
    });
}
