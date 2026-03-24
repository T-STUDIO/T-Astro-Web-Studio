
import { ConnectionSettings, INDIDevice, INDIVector, DeviceType } from '../types';

/**
 * AlpacaClientService
 * ROLE: Client-side implementation to connect to external ASCOM Alpaca devices.
 * This service handles REST API communication with Alpaca servers.
 */

export interface AlpacaDevice {
    deviceName: string;
    deviceType: string;
    deviceNumber: number;
    uniqueId: string;
    properties?: Map<string, any>;
}

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
     * Normalizes Alpaca response keys to PascalCase to handle drivers/relays 
     * that might return all lowercase keys.
     */
    private normalizeResponse(data: any): any {
        if (!data || typeof data !== 'object') return data;
        
        if (Array.isArray(data)) {
            return data.map(item => this.normalizeResponse(item));
        }

        const normalized: any = { ...data };
        const mapping: Record<string, string> = {
            'value': 'Value',
            'errornumber': 'ErrorNumber',
            'errormessage': 'ErrorMessage',
            'clienttransactionid': 'ClientTransactionID',
            'servertransactionid': 'ServerTransactionID',
            'devicename': 'deviceName',
            'devicetype': 'deviceType',
            'devicenumber': 'deviceNumber',
            'uniqueid': 'uniqueId'
        };

        for (const key of Object.keys(data)) {
            const lowerKey = key.toLowerCase();
            if (mapping[lowerKey] && normalized[mapping[lowerKey]] === undefined) {
                normalized[mapping[lowerKey]] = data[key];
            }
            // Recursively normalize nested objects/arrays (like the Value array in configureddevices)
            if (typeof data[key] === 'object' && data[key] !== null) {
                normalized[key] = this.normalizeResponse(data[key]);
            }
        }
        return normalized;
    }

    public getDevices(): AlpacaDevice[] {
        return this.devices;
    }

    public async connect(settings: ConnectionSettings): Promise<boolean> {
        // Construct base URL for Alpaca API
        let host = settings.host;
        let port = settings.port;
        
        // Handle cases where host might include protocol or port
        if (host.includes('://')) {
            const url = new URL(host);
            host = url.hostname;
            if (url.port) port = parseInt(url.port);
        }

        this.baseUrl = `http://${host}:${port}/api/v1`;
        const targetUrl = `http://${host}:${port}/management/v1/configureddevices`;
        
        console.log(`[AlpacaClient] Connecting to ${targetUrl} via proxy...`);
        try {
            const response = await fetch('/api/alpaca/proxy', {
                headers: { 'x-target-url': targetUrl }
            });
            
            if (!response.ok) {
                const text = await response.text();
                throw new Error(`Proxy returned ${response.status}: ${text}`);
            }
            
            const rawData = await response.json();
            const data = this.normalizeResponse(rawData);

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
            
            console.log(`[AlpacaClient] Connected. Found ${this.devices.length} devices.`);
            if (this.onDeviceListUpdate) {
                this.onDeviceListUpdate(this.devices);
            }
            this.startPolling();
            return true;
        } catch (error: any) {
            console.error('[AlpacaClient] Connection error:', error);
            // Fallback for local development if proxy fails or is not needed
            if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                console.log("[AlpacaClient] Retrying direct connection (Local Dev)...");
                try {
                    const directRes = await fetch(targetUrl);
                    if (directRes.ok) {
                        const data = await directRes.json();
                        this.devices = data.Value.map((d: any) => ({
                            deviceName: d.DeviceName || 'Unknown',
                            deviceType: d.DeviceType || 'Unknown',
                            deviceNumber: d.DeviceNumber,
                            uniqueId: d.UniqueID || `${d.DeviceType}-${d.DeviceNumber}`
                        }));
                        this.startPolling();
                        return true;
                    }
                } catch (e) {}
            }
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
            await this.pollStatus(); // Immediate refresh
            return true;
        }
        return false;
    }

    public async putCommand(deviceType: string, deviceNumber: number, action: string, params: Record<string, any> = {}) {
        if (!this.baseUrl) return null;
        
        // Alpaca standard says URL path segments (deviceType and action) should be lowercase.
        // However, body parameters MUST maintain their casing (usually PascalCase).
        const targetUrl = `${this.baseUrl}/${deviceType.toLowerCase()}/${deviceNumber}/${action.toLowerCase()}`;
        console.log(`[AlpacaClient] PUT ${targetUrl}`, params);
        
        const bodyParams = new URLSearchParams();
        bodyParams.append('ClientID', '24233191433'); // Unique ID for this app
        bodyParams.append('ClientTransactionID', this.getNextId().toString());
        for (const [key, value] of Object.entries(params)) {
            let val = value;
            if (typeof value === 'boolean') {
                val = value ? 'True' : 'False';
            }
            bodyParams.append(key, val.toString());
        }

        console.log(`[AlpacaClient] Body: ${bodyParams.toString()}`);

        try {
            // Try direct fetch first
            const response = await fetch('/api/alpaca/proxy', {
                method: 'PUT',
                headers: { 
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'x-target-url': targetUrl
                },
                body: bodyParams
            });
            
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                const data = await response.json();
                return this.normalizeResponse(data);
            } else {
                const text = await response.text();
                return { ErrorNumber: response.status, ErrorMessage: text };
            }
        } catch (error) {
            console.error(`[AlpacaClient] Proxy command ${action} failed:`, error);
            return null;
        }
    }

    public async getCommand(deviceType: string, deviceNumber: number, action: string, params: Record<string, any> = {}) {
        if (!this.baseUrl) return null;

        const query = new URLSearchParams(params);
        query.append('ClientTransactionID', this.getNextId().toString());
        const queryString = query.toString();
        // Alpaca standard says URL path segments should be lowercase.
        const targetUrl = `${this.baseUrl}/${deviceType.toLowerCase()}/${deviceNumber}/${action.toLowerCase()}${queryString ? '?' + queryString : ''}`;
        console.log(`[AlpacaClient] GET ${targetUrl}`);

        try {
            const response = await fetch('/api/alpaca/proxy', {
                headers: {
                    'x-target-url': targetUrl
                }
            });
            
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                const data = await response.json();
                return this.normalizeResponse(data);
            } else {
                const text = await response.text();
                return { ErrorNumber: response.status, ErrorMessage: text };
            }
        } catch (error) {
            console.error(`[AlpacaClient] Proxy query ${action} failed:`, error);
            return null;
        }
    }

    public async getDeviceStatus(deviceType: string, deviceNumber: number) {
        if (!this.baseUrl) return null;
        // Standard Alpaca status is often spread across multiple calls
        // For a generic control panel, we might want to fetch common properties
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
        const props = ['CameraState', 'CCDTemperature', 'CanAbortExposure', 'CanAsymmetricBin', 'CanGetCCDTemperature', 'CanSetCCDTemperature', 'CanStopExposure', 'CoolerOn', 'ExposureMax', 'ExposureMin', 'ExposureResolution', 'ImageReady', 'PixelSizeX', 'PixelSizeY', 'CameraXSize', 'CameraYSize'];
        const results: Record<string, any> = {};
        for (const prop of props) {
            const res = await this.getCommand('Camera', deviceNumber, prop);
            if (res && res.ErrorNumber === 0) results[prop] = res.Value;
        }
        return results;
    }

    public async getImageArray(deviceNumber: number): Promise<any> {
        if (!this.baseUrl) return null;
        const targetUrl = `${this.baseUrl}/camera/${deviceNumber}/imagearray?ClientTransactionID=${this.getNextId()}`;
        
        try {
            const response = await fetch('/api/alpaca/proxy', {
                headers: {
                    'x-target-url': targetUrl,
                    'Accept': 'application/image-bytes'
                }
            });
            
            if (!response.ok) {
                console.error(`[AlpacaClient] Image fetch failed with status ${response.status}`);
                return null;
            }

            const contentType = response.headers.get('content-type') || '';
            if (contentType.includes('application/json')) {
                const rawData = await response.json();
                const data = this.normalizeResponse(rawData);
                if (data && data.ErrorNumber !== 0) {
                    console.error(`[AlpacaClient] Alpaca error ${data.ErrorNumber}: ${data.ErrorMessage}`);
                    return null;
                }
                // If it's JSON, it's the image data as a JSON object with a Value property
                if (data && data.Value) {
                    return data.Value; // Return the raw JSON array/object
                }
                return null;
            }

            return await response.arrayBuffer();
        } catch (error) {
            console.error("[AlpacaClient] Failed to fetch image array:", error);
            return null;
        }
    }
}

export const alpacaClient = AlpacaClientService.getInstance();
export default alpacaClient;
