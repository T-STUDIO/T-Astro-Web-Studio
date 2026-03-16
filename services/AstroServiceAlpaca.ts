import { CelestialObject, MountSpeed, LocationData, TelescopePosition } from '../types';
import { hmsToDegrees, dmsToDegrees } from '../utils/coords';
import { alpacaClient } from './AlpacaClientService';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

let imageReceivedCallback: ((url: string, format: string, metadata?: any) => void) | null = null;
let telescopePositionCallback: ((pos: TelescopePosition) => void) | null = null;
let focuserUpdateCallback: ((position: number) => void) | null = null;

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
export const setFocuserUpdateCallback = (cb: any) => {
    focuserUpdateCallback = cb;
};
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

// ---- Telescope position polling ----
let telescopePositionPollInterval: any = null;

const startTelescopePositionPolling = () => {
    if (telescopePositionPollInterval) return;
    telescopePositionPollInterval = setInterval(async () => {
        if (!telescopePositionCallback) return;
        try {
            const pos = await getTelescopePosition();
            if (pos) telescopePositionCallback(pos);
        } catch (e) { /* silent */ }
    }, 2000);
};

const stopTelescopePositionPolling = () => {
    if (telescopePositionPollInterval) {
        clearInterval(telescopePositionPollInterval);
        telescopePositionPollInterval = null;
    }
};

// ---- Focuser position polling ----
let focuserPollInterval: any = null;

const startFocuserPolling = () => {
    if (focuserPollInterval) return;
    focuserPollInterval = setInterval(async () => {
        if (!focuserUpdateCallback) return;
        try {
            const posRes = await alpacaClient.getCommand('Focuser', 0, 'Position');
            if (posRes && posRes.ErrorNumber === 0 && posRes.Value !== undefined) {
                focuserUpdateCallback(posRes.Value);
            }
        } catch (e) { /* silent */ }
    }, 2000);
};

const stopFocuserPolling = () => {
    if (focuserPollInterval) {
        clearInterval(focuserPollInterval);
        focuserPollInterval = null;
    }
};

export const connect = async (settings: any): Promise<boolean> => {
    addDebugLog(`Connecting to Alpaca at ${settings.host}:${settings.port}...`);
    const ok = await alpacaClient.connect(settings);
    if (ok) {
        addDebugLog(`Connected successfully.`);
        startTelescopePositionPolling();
        startFocuserPolling();
    } else {
        addDebugLog(`Connection failed.`);
    }
    return ok;
};

export const disconnect = async () => {
    stopTelescopePositionPolling();
    stopFocuserPolling();
    alpacaClient.disconnect();
};

export const slewTo = async (obj: CelestialObject) => {
    const ra = hmsToDegrees(obj.ra) / 15;
    const dec = dmsToDegrees(obj.dec);
    // Try SlewToCoordinatesAsync first (non-blocking), fall back to SlewToCoordinates
    const asyncRes = await alpacaClient.putCommand('Telescope', 0, 'SlewToCoordinatesAsync', { RightAscension: ra, Declination: dec });
    if (!asyncRes || asyncRes.ErrorNumber !== 0) {
        await alpacaClient.putCommand('Telescope', 0, 'SlewToCoordinates', { RightAscension: ra, Declination: dec });
    }
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
    if (raRes && raRes.ErrorNumber === 0 && decRes && decRes.ErrorNumber === 0) {
        return { ra: raRes.Value * 15, dec: decRes.Value };
    }
    return null;
};

/**
 * MoveAxis speed mapping:
 * Guide  = 0.1°/s, Center = 0.5°/s, Find = 2.0°/s, Slew = 4.0°/s
 */
const MOUNT_SPEED_RATES: Record<MountSpeed, number> = {
    Guide: 0.1,
    Center: 0.5,
    Find: 2.0,
    Slew: 4.0,
};

/**
 * Direction → Alpaca axis/rate mapping.
 * Axis 0 = RA/Az, Axis 1 = Dec/Alt
 * Positive rate = East/North, Negative = West/South
 */
const DIR_AXIS: Record<string, { axis: number; sign: number }> = {
    N: { axis: 1, sign: 1 },
    S: { axis: 1, sign: -1 },
    E: { axis: 0, sign: 1 },
    W: { axis: 0, sign: -1 },
};

export const startMotion = async (dir: string, speed: MountSpeed) => {
    const mapping = DIR_AXIS[dir.toUpperCase()];
    if (!mapping) return;
    const rate = MOUNT_SPEED_RATES[speed] * mapping.sign;
    await alpacaClient.putCommand('Telescope', 0, 'MoveAxis', { Axis: mapping.axis, Rate: rate });
};

export const stopMotion = async (dir: string) => {
    const mapping = DIR_AXIS[dir.toUpperCase()];
    if (!mapping) return;
    await alpacaClient.putCommand('Telescope', 0, 'MoveAxis', { Axis: mapping.axis, Rate: 0 });
};

export const setTracking = async (enabled: boolean) => {
    await alpacaClient.putCommand('Telescope', 0, 'Tracking', { Tracking: enabled });
};

export const setPark = async (parked: boolean) => {
    if (parked) await alpacaClient.putCommand('Telescope', 0, 'Park');
    else await alpacaClient.putCommand('Telescope', 0, 'Unpark');
};

// ---- Camera: waitForCameraIdle (Alpaca implementation) ----
let cameraIdle = true;

export const waitForCameraIdle = async (timeoutMs: number = 30000): Promise<boolean> => {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        try {
            const stateRes = await alpacaClient.getCommand('Camera', 0, 'CameraState');
            // CameraState: 0=Idle, 1=Waiting, 2=Exposing, 3=Reading, 4=Download, 5=Error
            if (stateRes && stateRes.ErrorNumber === 0 && stateRes.Value === 0) {
                return true;
            }
        } catch (e) { /* silent */ }
        await sleep(500);
    }
    return false;
};

export const capturePreview = async (exp: number, gain: number, offset: number, isStream: boolean = false) => {
    addDebugLog(`[Alpaca] Starting exposure: ${exp}ms, Gain: ${gain}...`);
    cameraIdle = false;

    // Set gain if supported
    const gainRes = await alpacaClient.putCommand('Camera', 0, 'Gain', { Gain: gain }).catch(() => null);

    const startRes = await alpacaClient.putCommand('Camera', 0, 'StartExposure', { Duration: exp / 1000, Light: true });
    
    if (startRes && startRes.ErrorNumber === 0) {
        addDebugLog(`[Alpaca] Exposure started. Polling for completion...`);
        
        // Poll for ImageReady
        let ready = false;
        let attempts = 0;
        const maxAttempts = Math.ceil((exp + 10000) / 500); // exposure time + 10s overhead
        
        while (!ready && attempts < maxAttempts) {
            await sleep(500);
            attempts++;
            const statusRes = await alpacaClient.getCommand('Camera', 0, 'ImageReady');
            if (statusRes && statusRes.ErrorNumber === 0 && statusRes.Value === true) {
                ready = true;
                addDebugLog(`[Alpaca] Image is ready. Downloading...`);
                break;
            }
        }
        
        if (ready) {
            // Download image via imagearraybytes (binary) or imagearray (JSON)
            const imageUrl = await alpacaClient.getImageUrl('Camera', 0);
            if (imageUrl && imageReceivedCallback) {
                addDebugLog(`[Alpaca] Image downloaded successfully.`);
                imageReceivedCallback(imageUrl, 'jpg');
            } else {
                addDebugLog(`[Alpaca] Failed to get image URL or no callback registered.`);
            }
        } else {
            addDebugLog(`[Alpaca] Exposure timed out or failed.`);
        }
    } else {
        addDebugLog(`[Alpaca] Failed to start exposure: ${startRes?.ErrorMessage || 'Unknown error'}`);
    }
    cameraIdle = true;
};

export const startCapture = async (exp: number, gain: number, offset: number, colorBalance: any, cb: (c:number)=>void, done: ()=>void) => {
    // Continuous capture loop for live stacking
    let count = 0;
    let running = true;
    const loop = async () => {
        while (running) {
            await capturePreview(exp, gain, offset, true);
            count++;
            cb(count);
            await sleep(200);
        }
        done();
    };
    loop();
    // Return stop function via stopCapture
};

export const stopCapture = async () => {
    await alpacaClient.putCommand('Camera', 0, 'AbortExposure').catch(() => null);
};

export const startStream = () => {
    // Alpaca doesn't support MJPEG stream natively
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
    // Get current position first, then move to absolute position
    const posRes = await alpacaClient.getCommand('Focuser', 0, 'Position');
    if (posRes && posRes.ErrorNumber === 0 && posRes.Value !== undefined) {
        const target = Math.max(0, posRes.Value + steps);
        const moveRes = await alpacaClient.putCommand('Focuser', 0, 'Move', { Position: target });
        if (moveRes && moveRes.ErrorNumber === 0 && focuserUpdateCallback) {
            // Update position after move
            setTimeout(async () => {
                const newPosRes = await alpacaClient.getCommand('Focuser', 0, 'Position');
                if (newPosRes && newPosRes.ErrorNumber === 0 && focuserUpdateCallback) {
                    focuserUpdateCallback(newPosRes.Value);
                }
            }, 500);
        }
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
        const isLocalIp = host.startsWith('192.168.') || host.startsWith('10.') || host.startsWith('172.') || host === 'localhost' || host === '127.0.0.1';
        if (isLocalIp && !window.location.hostname.includes('localhost')) {
            results.push(`⚠️ Warning: You are trying to connect to a local IP (${host}) from a cloud-hosted app (${window.location.hostname}).`);
            results.push(`   This will NOT work unless you have a tunnel or bridge set up.`);
            results.push(`   💡 Tip: Run this app locally on your StellarMate/Linux machine to connect to local devices.`);
        }

        results.push(`Checking network connectivity to proxy...`);
        const proxyCheck = await fetch('/api/alpaca/status').catch(e => ({ ok: false, status: 0, statusText: e.message }));
        let proxyAvailable = false;
        
        if (proxyCheck.ok) {
            const contentType = (proxyCheck as any).headers?.get('content-type') || '';
            if (contentType.includes('application/json')) {
                results.push(`✅ Proxy server is reachable and responding with JSON.`);
                proxyAvailable = true;
            } else {
                results.push(`⚠️ Proxy server returned non-JSON (likely static host / GitHub Pages).`);
                results.push(`   Falling back to direct connection mode.`);
            }
        } else {
            results.push(`⚠️ Proxy server is unreachable (Status: ${(proxyCheck as any).status || 'Network Error'}).`);
            results.push(`   Attempting direct connection to Alpaca server...`);
        }

        // --- Direct connection check (works when CORS is allowed) ---
        results.push(`Attempting direct connection to Alpaca server at http://${host}:${port}...`);
        try {
            const directController = new AbortController();
            const directTimeout = setTimeout(() => directController.abort(), 5000);
            const directRes = await fetch(`http://${host}:${port}/management/v1/configureddevices`, {
                signal: directController.signal,
                mode: 'cors'
            }).catch(e => null as any);
            clearTimeout(directTimeout);

            if (directRes && directRes.ok) {
                const data = await directRes.json();
                results.push(`✅ Direct connection to Alpaca server succeeded!`);
                if (data && Array.isArray(data.Value)) {
                    results.push(`✅ Found ${data.Value.length} devices.`);
                    data.Value.forEach((d: any) => {
                        const name = d.DeviceName || d.deviceName || 'Unknown';
                        const type = d.DeviceType || d.deviceType || 'Unknown';
                        const num = d.DeviceNumber !== undefined ? d.DeviceNumber : d.deviceNumber;
                        results.push(`  - ${name} (${type} #${num})`);
                    });
                } else {
                    results.push(`⚠️ Connected but no devices found in response.`);
                }
                return results;
            } else if (directRes) {
                results.push(`⚠️ Direct connection returned status ${directRes.status}.`);
            } else {
                results.push(`⚠️ Direct connection failed (CORS blocked or network error).`);
                results.push(`   💡 To allow direct browser access, enable CORS on your Alpaca server.`);
                results.push(`   💡 For ASCOM Remote: set 'Allow CORS' in the server settings.`);
                results.push(`   💡 For N.I.N.A.: enable the Alpaca server with CORS support.`);
            }
        } catch (e: any) {
            results.push(`⚠️ Direct connection error: ${e.message}`);
        }

        if (!proxyAvailable) {
            results.push(``);
            results.push(`--- 接続できない場合の対処法 ---`);
            results.push(`⚠️ 静的ホスト（GitHub Pages等）からローカルAlpacaサーバーへの接続には制限があります。`);
            results.push(`💡 解決策1: Alpacaサーバー側でCORSを有効にする（推奨）。`);
            results.push(`💡 解決策2: StellarMate/ローカルPCで 'npm run dev' を実行しローカルアクセスする。`);
            results.push(`💡 解決策3: ngrokなどのトンネルを使用してプロキシ経由でアクセスする。`);
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
                headers: { get: () => null },
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
                    results.push(`   Response: ${JSON.stringify(data).substring(0, 100)}...`);
                }
            } else {
                const text = await response.text();
                results.push(`❌ Proxy returned non-JSON response. Status: ${response.status}`);
                if (text.includes('<!DOCTYPE html>')) {
                    results.push(`  ⚠️ Warning: The proxy returned an HTML page instead of JSON.`);
                    results.push(`  This usually means the API route was not found or redirected.`);
                    results.push(`  💡 Tip: If you are using Cloud Run, ensure you are accessing the app via the correct URL.`);
                }
                results.push(`  Response preview: ${String(text).substring(0, 100)}...`);
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
                            results.push(`  💡 Tip: The Linux server cannot reach the Windows machine (${host}).`);
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
