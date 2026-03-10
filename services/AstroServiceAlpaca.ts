import { CelestialObject, MountSpeed, LocationData, TelescopePosition } from '../types';
import { hmsToDegrees, dmsToDegrees } from '../utils/coords';
import { alpacaClient } from './AlpacaClientService';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

let imageReceivedCallback: ((url: string, format: string, metadata?: any) => void) | null = null;
let telescopePositionCallback: ((pos: TelescopePosition) => void) | null = null;

export const setImageReceivedCallback = (cb: typeof imageReceivedCallback) => {
    imageReceivedCallback = cb;
};

export const setTelescopePositionCallback = (cb: typeof telescopePositionCallback) => {
    telescopePositionCallback = cb;
};

// Mock other callbacks for compatibility
export const setLogCallback = (cb: any) => {};
let deviceCallback: ((devices: any[]) => void) | null = null;
let messageCountCallback: ((count: number) => void) | null = null;

export const setDeviceCallback = (cb: any) => {
    deviceCallback = cb;
};
export const setMessageCountCallback = (cb: any) => {
    messageCountCallback = cb;
    alpacaClient.setMessageCountCallback(cb);
};
export const setFocuserUpdateCallback = (cb: any) => {};
export const setMountLocationCallback = (cb: any) => {};
export const setMountTimeCallback = (cb: any) => {};

// Compatibility aliases
export const setIndiDeviceCallback = setDeviceCallback;
export const setIndiMessageCountCallback = setMessageCountCallback;

let debugLogs: string[] = [];

const addDebugLog = (msg: string) => {
    const time = new Date().toLocaleTimeString();
    debugLogs.push(`[${time}] ${msg}`);
    if (debugLogs.length > 500) debugLogs.shift();
};

export const connect = async (settings: any): Promise<boolean> => {
    addDebugLog(`Connecting to Alpaca at ${settings.host}:${settings.port}...`);
    const ok = await alpacaClient.connect(settings);
    if (ok) addDebugLog(`Connected successfully.`);
    else addDebugLog(`Connection failed.`);
    return ok;
};

export const disconnect = async () => {
    alpacaClient.disconnect();
};

export const slewTo = async (obj: CelestialObject) => {
    const ra = hmsToDegrees(obj.ra) / 15;
    const dec = dmsToDegrees(obj.dec);
    await alpacaClient.putCommand('Telescope', 0, 'SlewToCoordinates', { RightAscension: ra, Declination: dec });
};

export const syncTo = async (obj: CelestialObject) => {
    const ra = hmsToDegrees(obj.ra) / 15;
    const dec = dmsToDegrees(obj.dec);
    await alpacaClient.putCommand('Telescope', 0, 'SyncToCoordinates', { RightAscension: ra, Declination: dec });
};

export const syncToCoordinates = async (ra: number, dec: number) => {
    await alpacaClient.putCommand('Telescope', 0, 'SyncToCoordinates', { RightAscension: ra / 15, Declination: dec });
};

export const getTelescopePosition = async (): Promise<TelescopePosition | null> => {
    const raRes = await alpacaClient.getCommand('Telescope', 0, 'RightAscension');
    const decRes = await alpacaClient.getCommand('Telescope', 0, 'Declination');
    if (raRes && decRes) {
        return { ra: raRes.Value * 15, dec: decRes.Value };
    }
    return null;
};

export const startMotion = async (dir: string, speed: MountSpeed) => {
    // Alpaca PulseGuide or MoveAxis
};

export const stopMotion = async (dir: string) => {
    // Alpaca MoveAxis with rate 0
};

export const setTracking = async (enabled: boolean) => {
    await alpacaClient.putCommand('Telescope', 0, 'Tracking', { Tracking: enabled });
};

export const setPark = async (parked: boolean) => {
    if (parked) await alpacaClient.putCommand('Telescope', 0, 'Park');
    else await alpacaClient.putCommand('Telescope', 0, 'Unpark');
};

export const capturePreview = async (exp: number, gain: number, offset: number, isStream: boolean = false) => {
    await alpacaClient.putCommand('Camera', 0, 'StartExposure', { Duration: exp / 1000, Light: true });
    // Polling for image would be needed here
};

export const startCapture = async (exp: number, gain: number, offset: number, colorBalance: any, cb: (c:number)=>void, done: ()=>void) => {
    // Implementation for sequence
};

export const stopCapture = async () => {
    await alpacaClient.putCommand('Camera', 0, 'AbortExposure');
};

export const startStream = () => {
    // Alpaca doesn't support stream easily without MJPEG
};

export const stopStream = () => {
};

export const setVideoStream = async (enabled: boolean) => {
};

export const abortSlew = async () => {
    await alpacaClient.putCommand('Telescope', 0, 'AbortSlew');
};

export const sendLocation = async (loc: LocationData, time: Date) => {
    await alpacaClient.putCommand('Telescope', 0, 'SiteLatitude', { SiteLatitude: loc.latitude });
    await alpacaClient.putCommand('Telescope', 0, 'SiteLongitude', { SiteLongitude: loc.longitude });
};

// Mock other functions for compatibility
export const updateDeviceSetting = (device: string, prop: string, values: any) => {};
export const getActiveCamera = () => 'Alpaca Camera';
export const getActiveFocuser = () => 'Alpaca Focuser';
export const getDeviceProperties = (device: string) => [];
export const getNumericValue = (device: string, prop: string, elem: string) => 0;
export const connectDevice = async (name: string) => {
    const devices = alpacaClient.getConfiguredDevices();
    const dev = devices.find(d => d.deviceName === name);
    if (dev) {
        await alpacaClient.setDeviceConnected(dev.deviceType, dev.deviceNumber, true);
    }
};
export const disconnectDevice = async (name: string) => {
    const devices = alpacaClient.getConfiguredDevices();
    const dev = devices.find(d => d.deviceName === name);
    if (dev) {
        await alpacaClient.setDeviceConnected(dev.deviceType, dev.deviceNumber, false);
    }
};
export const refreshDevices = async () => {
    // Polling will handle this, but can trigger manual fetch if needed
};
export const moveFocuser = async (steps: number) => {
    // Get current position first
    const posRes = await alpacaClient.getCommand('Focuser', 0, 'Position');
    if (posRes) {
        const target = posRes.Value + steps;
        await alpacaClient.putCommand('Focuser', 0, 'Move', { Position: target });
    }
};
export const reprocessRawFITS = (fmt: string) => {};
export const rawFitsToDisplay = (data: any, fmt: string, debayer: string) => ({ url: '', headers: null });
export const getDevices = (): any[] => {
    const devices = alpacaClient.getConfiguredDevices();
    return devices.map(d => ({
        deviceName: d.deviceName,
        deviceType: d.deviceType as any,
        uniqueId: d.uniqueId,
        connected: (d as any).connected || false,
        properties: new Map()
    }));
};

// Initialize callback for device updates
alpacaClient.setDeviceUpdateCallback((devs) => {
    if (deviceCallback) {
        const formatted = devs.map(d => ({
            deviceName: d.deviceName,
            deviceType: d.deviceType as any,
            uniqueId: d.uniqueId,
            connected: (d as any).connected || false,
            properties: new Map()
        }));
        deviceCallback(formatted);
    }
});
export const getCameraParams = () => ({});
export const sendRaw = (xml: string) => {};
export const diagnoseConnection = async (host: string, port: number, driver: string) => {
    const results: string[] = [];
    results.push(`Starting diagnostics for ${driver} at ${host}:${port}...`);
    
    try {
        results.push(`Checking network connectivity to proxy...`);
        const proxyCheck = await fetch('/api/alpaca/discover').catch(e => ({ ok: false, status: 0, statusText: e.message }));
        if (proxyCheck.ok) {
            results.push(`✅ Proxy server is reachable.`);
        } else {
            results.push(`❌ Proxy server is unreachable or returned error. Status: ${(proxyCheck as any).status || 'Network Error'}`);
            results.push(`   Note: If you are using Cloud Run, it cannot reach private IPs like 192.168.x.x directly.`);
            return results;
        }

        results.push(`Attempting to fetch configured devices via proxy...`);
        const targetUrl = `http://${host}:${port}/management/v1/configureddevices`;
        const response = await fetch('/api/alpaca/proxy', {
            headers: { 'x-target-url': targetUrl }
        }).catch(e => {
            return { 
                ok: false, 
                status: 0, 
                statusText: e.message,
                headers: new Headers(),
                json: async () => ({}),
                text: async () => e.message
            } as any;
        });
        
        if (response.ok) {
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                const data = await response.json();
                results.push(`✅ Successfully reached Alpaca server.`);
                if (data && Array.isArray(data.Value)) {
                    results.push(`✅ Found ${data.Value.length} devices.`);
                    data.Value.forEach((d: any) => {
                        const name = d.DeviceName || d.deviceName || 'Unknown';
                        const type = d.DeviceType || d.deviceType || 'Unknown';
                        const num = d.DeviceNumber !== undefined ? d.DeviceNumber : d.deviceNumber;
                        results.push(`  - ${name} (${type} #${num})`);
                    });
                } else {
                    results.push(`⚠️ Reached server but response format was unexpected.`);
                }
            } else {
                const text = await response.text();
                results.push(`❌ Proxy returned non-JSON response. Status: ${response.status}`);
                results.push(`  Response: ${String(text).substring(0, 100)}...`);
            }
        } else {
            const status = response.status;
            results.push(`❌ Failed to reach Alpaca server via proxy. Status: ${status || 'Network Error'}`);
            
            if (status === 500) {
                try {
                    const errorData = await response.json();
                    if (errorData && errorData.ErrorMessage) {
                        results.push(`  Error from proxy: ${errorData.ErrorMessage}`);
                        if (errorData.ErrorMessage.includes('timed out') || errorData.ErrorMessage.includes('ETIMEDOUT') || errorData.ErrorMessage.includes('EHOSTUNREACH') || errorData.ErrorMessage.includes('ENOTFOUND')) {
                            results.push(`  💡 Tip: The Linux server (${window.location.hostname}) cannot reach the Windows machine (${host}).`);
                            results.push(`  1. Check if Windows machine (${host}) is on the same network.`);
                            results.push(`  2. Check if Windows Firewall allows port ${port}.`);
                            results.push(`  3. Try pinging ${host} from the Linux terminal.`);
                        }
                    }
                } catch (e) {
                    // Not JSON
                }
            } else if (status === 0) {
                results.push(`  Error: ${response.statusText}`);
            }
        }
    } catch (e: any) {
        results.push(`❌ Diagnostics failed with unexpected error: ${String(e.message || e)}`);
    }
    
    return results;
};

export const getDebugLogs = () => debugLogs;

// Compatibility aliases
export const connectIndiDevice = connectDevice;
export const disconnectIndiDevice = disconnectDevice;
export const refreshIndiDevices = refreshDevices;
export const getIndiDevices = getDevices;
