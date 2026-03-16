
import { ConnectionSettings, INDIDevice, INDIVector, DeviceType } from '../types';

/**
 * AlpacaClientService
 * ROLE: Client-side implementation to connect to external ASCOM Alpaca devices.
 * This service handles REST API communication with Alpaca servers.
 *
 * Connection strategy:
 *  1. Try direct fetch to the Alpaca server (works when app is served locally or CORS is allowed).
 *  2. Fall back to server-side proxy (/api/alpaca/proxy) when available (Express server mode).
 */

export interface AlpacaDevice {
    deviceName: string;
    deviceType: string;
    deviceNumber: number;
    uniqueId: string;
    properties?: Map<string, any>;
}

/** Check once whether the proxy endpoint is available. */
let proxyAvailable: boolean | null = null;

const checkProxyAvailable = async (): Promise<boolean> => {
    if (proxyAvailable !== null) return proxyAvailable;
    try {
        const res = await fetch('/api/alpaca/status', { method: 'GET' });
        if (res.ok) {
            const ct = res.headers.get('content-type') || '';
            proxyAvailable = ct.includes('application/json');
        } else {
            proxyAvailable = false;
        }
    } catch {
        proxyAvailable = false;
    }
    return proxyAvailable;
};

export class AlpacaClientService {
    private static instance: AlpacaClientService;
    private baseUrl: string = '';
    private clientTransactionId: number = 0;
    private devices: AlpacaDevice[] = [];
    private pollInterval: any = null;
    private onDeviceListUpdate: ((devices: AlpacaDevice[]) => void) | null = null;
    private onMessageCountUpdate: ((count: number) => void) | null = null;

    public static getInstance() {
        if (!AlpacaClientService.instance) AlpacaClientService.instance = new AlpacaClientService();
        return AlpacaClientService.instance;
    }

    private getNextId() {
        const id = ++this.clientTransactionId;
        if (this.onMessageCountUpdate) this.onMessageCountUpdate(id);
        return id;
    }

    /**
     * Fetch helper that tries direct connection first, then proxy.
     * For GET requests, also tries CORS mode with no-cors fallback.
     */
    private async fetchAlpaca(
        targetUrl: string,
        options: RequestInit = {}
    ): Promise<Response> {
        const method = (options.method || 'GET').toUpperCase();

        // --- 1. Try direct fetch (works when CORS is allowed or same-origin) ---
        try {
            const directRes = await fetch(targetUrl, {
                ...options,
                mode: 'cors',
                signal: options.signal,
            });
            if (directRes.ok || directRes.status < 500) return directRes;
        } catch (directErr: any) {
            // Network error or CORS block — fall through to proxy
            console.warn(`[AlpacaClient] Direct fetch (CORS) failed for ${targetUrl}: ${directErr.message}`);
        }

        
        // --- 2. For HTTP context, try no-cors mode (GET only) ---
        if (typeof window !== 'undefined' && window.location.protocol === 'http:' && method === 'GET') {
            try {
                const noCorsRes = await fetch(targetUrl, {
                    ...options,
                    mode: 'no-cors',
                    signal: options.signal,
                });
                if (noCorsRes.status === 0 || noCorsRes.ok) {
                    console.log(`[AlpacaClient] Direct fetch (no-cors) succeeded for ${targetUrl}`);
                    return noCorsRes;
                }
            } catch (noCorsErr: any) {
                console.warn(`[AlpacaClient] Direct fetch (no-cors) failed for ${targetUrl}: ${noCorsErr.message}`);
            }
        }

        // --- 3. Try server-side proxy ---
        const useProxy = await checkProxyAvailable();
        if (useProxy) {
            const proxyHeaders: Record<string, string> = {
                ...(options.headers as any || {}),
                'x-target-url': targetUrl,
            };
            
            const proxyRes = await fetch('/api/alpaca/proxy', {
                method,
                headers: proxyHeaders,
                body: options.body,
                signal: options.signal,
            });
            return proxyRes;
        }

        throw new Error(`[AlpacaClient] All connection methods failed for ${targetUrl}`);
    }

    public async connect(settings: ConnectionSettings): Promise<boolean> {
        // Reset proxy cache so each new connection attempt re-checks
        proxyAvailable = null;

        // Use same protocol as current page if possible, or allow user to specify
        const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
        // However, Alpaca devices are almost always HTTP. 
        // If we are on HTTPS, direct HTTP fetch will fail. 
        // The proxy server (if available) can handle the HTTP/HTTPS transition.
        this.baseUrl = `http://${settings.host}:${settings.port}/api/v1`;
        const targetUrl = `http://${settings.host}:${settings.port}/management/v1/configureddevices`;
        console.log(`[AlpacaClient] Connecting to ${targetUrl}...`);
        try {
            const response = await this.fetchAlpaca(targetUrl);
            
            // For no-cors, status is 0 and ok is false, but it means the request was sent.
            if (response.status === 0) {
                console.log("[AlpacaClient] Connected via no-cors (opaque response)");
                this.devices = []; // We can't know the devices yet
                return true;
            }

            if (!response.ok) {
                const text = await response.text();
                throw new Error(`Failed to fetch configured devices: ${response.status} ${text}`);
            }

            const contentType = response.headers.get('content-type');
            let data;
            if (contentType && contentType.includes('application/json')) {
                data = await response.json();
            } else {
                const text = await response.text();
                console.warn(`[AlpacaClient] Expected JSON but got ${contentType}: ${text.substring(0, 100)}`);
                try { data = JSON.parse(text); } catch(e) { throw new Error(`Invalid JSON response`); }
            }

            if (data && Array.isArray(data.Value)) {
                this.devices = data.Value.map((d: any) => ({
                    deviceName: d.DeviceName || d.deviceName || 'Unknown',
                    deviceType: d.DeviceType || d.deviceType || 'Unknown',
                    deviceNumber: d.DeviceNumber !== undefined ? d.DeviceNumber : d.deviceNumber,
                    uniqueId: d.UniqueID || d.uniqueId || `${d.DeviceType}-${d.DeviceNumber}`
                }));
            } else {
                console.warn(`[AlpacaClient] No devices found in response:`, data);
                this.devices = [];
            }
            console.log(`[AlpacaClient] Connected to ${settings.host}. Found ${this.devices.length} devices.`);

            // Notify immediately after connect so UI can update device list without waiting for first poll
            if (this.onDeviceListUpdate) this.onDeviceListUpdate(this.devices);
            this.startPolling();
            return true;
        } catch (error) {
            console.error('[AlpacaClient] Connection error:', error);
            return false;
        }
    }

    public disconnect() {
        this.stopPolling();
        this.devices = [];
        this.baseUrl = '';
    }

    public getConfiguredDevices(): AlpacaDevice[] {
        return this.devices;
    }

    public setDeviceUpdateCallback(cb: (devices: AlpacaDevice[]) => void) {
        this.onDeviceListUpdate = cb;
    }

    public setMessageCountCallback(cb: (count: number) => void) {
        this.onMessageCountUpdate = cb;
    }

    private startPolling() {
        if (this.pollInterval) clearInterval(this.pollInterval);
        this.pollInterval = setInterval(() => this.pollStatus(), 2000);
    }

    private stopPolling() {
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = null;
        }
    }

    private async pollStatus() {
        if (!this.baseUrl) return;

        let changed = false;
        const newDevices = [...this.devices];

        for (let i = 0; i < newDevices.length; i++) {
            const dev = newDevices[i];
            try {
                const res = await this.getCommand(dev.deviceType, dev.deviceNumber, 'Connected');
                if (res && res.ErrorNumber === 0) {
                    const isConnected = !!res.Value;
                    if ((dev as any).connected !== isConnected) {
                        (newDevices[i] as any).connected = isConnected;
                        changed = true;
                    }
                }
            } catch (e) {
                if ((newDevices[i] as any).connected !== false) {
                    (newDevices[i] as any).connected = false;
                    changed = true;
                }
            }
        }

        if (changed) {
            this.devices = newDevices;
            if (this.onDeviceListUpdate) this.onDeviceListUpdate(this.devices);
        }
    }

    public async setDeviceConnected(deviceType: string, deviceNumber: number, connected: boolean): Promise<boolean> {
        const res = await this.putCommand(deviceType, deviceNumber, 'Connected', { Connected: connected });
        if (res && res.ErrorNumber === 0) {
            await this.pollStatus();
            return true;
        }
        return false;
    }

    public async putCommand(deviceType: string, deviceNumber: number, action: string, params: Record<string, any> = {}) {
        if (!this.baseUrl) return null;

        const targetUrl = `${this.baseUrl}/${deviceType.toLowerCase()}/${deviceNumber}/${action.toLowerCase()}`;

        // Build URL-encoded body (Alpaca standard for PUT)
        const bodyParams = new URLSearchParams();
        bodyParams.append('ClientTransactionID', this.getNextId().toString());
        for (const [key, value] of Object.entries(params)) {
            bodyParams.append(key, value.toString());
        }
        const bodyStr = bodyParams.toString();

        try {
            const response = await this.fetchAlpaca(targetUrl, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: bodyStr,
            });

            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                return await response.json();
            } else {
                const text = await response.text();
                return { ErrorNumber: response.status, ErrorMessage: text };
            }
        } catch (error) {
            console.error(`[AlpacaClient] PUT command ${action} failed:`, error);
            return null;
        }
    }

    public async getCommand(deviceType: string, deviceNumber: number, action: string, params: Record<string, any> = {}) {
        if (!this.baseUrl) return null;

        const query = new URLSearchParams(params);
        query.append('ClientTransactionID', this.getNextId().toString());
        const queryString = query.toString();
        const targetUrl = `${this.baseUrl}/${deviceType.toLowerCase()}/${deviceNumber}/${action.toLowerCase()}${queryString ? '?' + queryString : ''}`;

        try {
            const response = await this.fetchAlpaca(targetUrl, { method: 'GET' });

            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                return await response.json();
            } else {
                const text = await response.text();
                return { ErrorNumber: response.status, ErrorMessage: text };
            }
        } catch (error) {
            console.error(`[AlpacaClient] GET command ${action} failed:`, error);
            return null;
        }
    }

    public async getDeviceStatus(deviceType: string, deviceNumber: number) {
        if (!this.baseUrl) return null;
        const commonProps = ['Connected', 'Name', 'Description', 'DriverInfo', 'DriverVersion', 'InterfaceVersion'];
        const results: Record<string, any> = {};

        for (const prop of commonProps) {
            const res = await this.getCommand(deviceType, deviceNumber, prop);
            if (res && res.ErrorNumber === 0) {
                results[prop] = res.Value;
            }
        }
        return results;
    }

    public async getTelescopeStatus(deviceNumber: number) {
        const props = ['AtHome', 'AtPark', 'Azimuth', 'CanSetDeclinationRate', 'CanSetGuideRate', 'CanSetPark', 'CanSetRightAscensionRate', 'CanSetTracking', 'CanSlew', 'CanSlewAsync', 'CanSync', 'Declination', 'RightAscension', 'Slewing', 'Tracking'];
        const results: Record<string, any> = {};
        for (const prop of props) {
            const res = await this.getCommand('Telescope', deviceNumber, prop);
            if (res && res.ErrorNumber === 0) results[prop] = res.Value;
        }
        return results;
    }

    public async getCameraStatus(deviceNumber: number) {
        const props = ['CameraState', 'CCDTemperature', 'CanAbortExposure', 'CanAsymmetricBin', 'CanGetCCDTemperature', 'CanSetCCDTemperature', 'CanStopExposure', 'CoolerOn', 'ExposureMax', 'ExposureMin', 'ExposureResolution', 'ImageReady', 'PixelSizeX', 'PixelSizeY'];
        const results: Record<string, any> = {};
        for (const prop of props) {
            const res = await this.getCommand('Camera', deviceNumber, prop);
            if (res && res.ErrorNumber === 0) results[prop] = res.Value;
        }
        return results;
    }

    /**
     * Convert Alpaca imagearray JSON data to a canvas data URL.
     * imagearray returns a 2D or 3D array of pixel values.
     */
    private imageArrayToDataUrl(data: any): string | null {
        try {
            const arr = data.Value;
            if (!arr || !Array.isArray(arr)) return null;
            // Rank 2: grayscale [row][col], Rank 3: color [row][col][channel]
            const rank = data.Rank || (Array.isArray(arr[0]) && Array.isArray(arr[0][0]) ? 3 : 2);
            const height = arr.length;
            const width = arr[0].length;
            if (!height || !width) return null;
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) return null;
            const imgData = ctx.createImageData(width, height);
            const pixels = imgData.data;
            if (rank === 2) {
                // Grayscale
                for (let y = 0; y < height; y++) {
                    for (let x = 0; x < width; x++) {
                        const v = Math.min(255, Math.max(0, Math.round(arr[y][x])));
                        const i = (y * width + x) * 4;
                        pixels[i] = v; pixels[i+1] = v; pixels[i+2] = v; pixels[i+3] = 255;
                    }
                }
            } else {
                // Color [row][col][channel] or [channel][row][col]
                for (let y = 0; y < height; y++) {
                    for (let x = 0; x < width; x++) {
                        const i = (y * width + x) * 4;
                        if (Array.isArray(arr[y][x])) {
                            // [row][col][channel]
                            pixels[i]   = Math.min(255, Math.max(0, Math.round(arr[y][x][0])));
                            pixels[i+1] = Math.min(255, Math.max(0, Math.round(arr[y][x][1] || 0)));
                            pixels[i+2] = Math.min(255, Math.max(0, Math.round(arr[y][x][2] || 0)));
                            pixels[i+3] = 255;
                        } else {
                            const v = Math.min(255, Math.max(0, Math.round(arr[y][x])));
                            pixels[i] = v; pixels[i+1] = v; pixels[i+2] = v; pixels[i+3] = 255;
                        }
                    }
                }
            }
            ctx.putImageData(imgData, 0, 0);
            return canvas.toDataURL('image/jpeg', 0.92);
        } catch (e) {
            console.error('[AlpacaClient] imageArrayToDataUrl error:', e);
            return null;
        }
    }

    /**
     * Get image data from Alpaca camera.
     * Tries imagearraybytes (binary FITS/PNG) first, then imagearray (JSON), then proxy fallback.
     */
    public async getImageUrl(deviceType: string, deviceNumber: number): Promise<string | null> {
        if (!this.baseUrl) return null;
        const base = `${this.baseUrl}/${deviceType.toLowerCase()}/${deviceNumber}`;
        const txId = this.getNextId();

        // 1. Try imagearraybytes (binary, most efficient)
        const bytesUrl = `${base}/imagearraybytes?ClientTransactionID=${txId}`;
        try {
            const res = await fetch(bytesUrl, { mode: 'cors' });
            if (res.ok) {
                const contentType = res.headers.get('content-type') || '';
                if (contentType.includes('image/') || contentType.includes('application/octet-stream')) {
                    const blob = await res.blob();
                    return URL.createObjectURL(blob);
                }
            }
        } catch { /* fall through */ }

        // 2. Try imagearray (JSON pixel data)
        const arrayUrl = `${base}/imagearray?ClientTransactionID=${txId}`;
        try {
            const res = await fetch(arrayUrl, { mode: 'cors' });
            if (res.ok) {
                const contentType = res.headers.get('content-type') || '';
                if (contentType.includes('application/json')) {
                    const data = await res.json();
                    if (data && data.ErrorNumber === 0) {
                        const dataUrl = this.imageArrayToDataUrl(data);
                        if (dataUrl) return dataUrl;
                    }
                } else {
                    // Binary response from imagearray endpoint
                    const blob = await res.blob();
                    return URL.createObjectURL(blob);
                }
            }
        } catch { /* fall through */ }

        // 3. Proxy fallback (server-side proxy can handle CORS)
        const useProxy = await checkProxyAvailable();
        if (useProxy) {
            // Use proxy image endpoint for binary download
            return `/api/proxy/image?url=${encodeURIComponent(bytesUrl)}`;
        }

        return null;
    }
}

export const alpacaClient = AlpacaClientService.getInstance();
export default alpacaClient;
