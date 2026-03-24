import { CelestialObject, MountSpeed, LocationData, TelescopePosition } from '../types';
import { hmsToDegrees, dmsToDegrees } from '../utils/coords';
import { alpacaClient } from './AlpacaClientService';
import { rawFitsToDisplay } from './DriverConnection';
import AlpacaImageService from './AlpacaImageService';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

let imageReceivedCallback: ((url: string, format: string, metadata?: any) => void) | null = null;
let telescopePositionCallback: ((pos: TelescopePosition) => void) | null = null;
let cameraCapabilitiesCallback: ((caps: any) => void) | null = null;
let cameraCapabilities: any = null;
let positionInterval: any = null;

const startPositionPolling = () => {
    if (positionInterval) return;
    addDebugLog("Starting telescope position polling...");
    positionInterval = setInterval(async () => {
        try {
            const pos = await getTelescopePosition();
            if (pos && telescopePositionCallback) {
                telescopePositionCallback(pos);
            }
        } catch (e) {
            // Silent fail for polling
        }
    }, 2000);
};

const stopPositionPolling = () => {
    if (positionInterval) {
        addDebugLog("Stopping telescope position polling.");
        clearInterval(positionInterval);
        positionInterval = null;
    }
};

export const setImageReceivedCallback = (cb: typeof imageReceivedCallback) => {
    imageReceivedCallback = cb;
};

export const setTelescopePositionCallback = (cb: typeof telescopePositionCallback) => {
    telescopePositionCallback = cb;
};

export const setCameraCapabilitiesCallback = (cb: typeof cameraCapabilitiesCallback) => {
    cameraCapabilitiesCallback = cb;
    if (cameraCapabilities && cb) cb(cameraCapabilities);
};

let logCallback: ((msg: string) => void) | null = null;

export const setLogCallback = (cb: any) => {
    logCallback = cb;
};
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
    const entry = `[${time}] ${msg}`;
    debugLogs.push(entry);
    if (debugLogs.length > 500) debugLogs.shift();
    if (logCallback) logCallback(entry);
};

const getDeviceNumber = (type: string): number => {
    const device = alpacaClient.getDevices().find(d => d.deviceType.toLowerCase() === type.toLowerCase());
    return device !== undefined ? device.deviceNumber : -1;
};

export const connect = async (settings: any): Promise<boolean> => {
    addDebugLog(`Connecting to Alpaca at ${settings.host}:${settings.port}...`);
    const ok = await alpacaClient.connect(settings);
    if (ok) {
        addDebugLog(`Connected successfully. Found ${alpacaClient.getDevices().length} devices.`);
        // Try to connect primary devices
        await connectDevices();
        startPositionPolling();
    } else {
        addDebugLog(`Connection failed.`);
    }
    return ok;
};

export const connectDevices = async () => {
    const devices = alpacaClient.getDevices();
    if (devices.length === 0) {
        addDebugLog("No devices found to connect.");
        return;
    }
    for (const device of devices) {
        addDebugLog(`Connecting to ${device.deviceType} ${device.deviceNumber}...`);
        try {
            const res = await alpacaClient.putCommand(device.deviceType, device.deviceNumber, 'Connected', { Connected: true });
            if (res && res.ErrorNumber === 0) {
                addDebugLog(`✅ ${device.deviceType} ${device.deviceNumber} connected.`);
                
                // If it's a telescope, try to unpark it
                if (device.deviceType.toLowerCase() === 'telescope') {
                    addDebugLog(`Unparking telescope ${device.deviceNumber}...`);
                    await alpacaClient.putCommand('Telescope', device.deviceNumber, 'Unpark');
                }

                // If it's a camera, get capabilities
                if (device.deviceType.toLowerCase() === 'camera') {
                    addDebugLog(`Fetching camera capabilities...`);
                    cameraCapabilities = await getCameraCapabilities();
                    if (cameraCapabilities && cameraCapabilitiesCallback) {
                        cameraCapabilitiesCallback(cameraCapabilities);
                    }
                }
            } else {
                addDebugLog(`❌ Failed to connect ${device.deviceType} ${device.deviceNumber}: ${res?.ErrorMessage || 'Unknown error'}`);
            }
        } catch (e: any) {
            addDebugLog(`❌ Error connecting ${device.deviceType} ${device.deviceNumber}: ${e.message}`);
        }
    }
};

export const disconnectDevices = async () => {
    const devices = alpacaClient.getDevices();
    for (const device of devices) {
        addDebugLog(`Disconnecting from ${device.deviceType} ${device.deviceNumber}...`);
        await alpacaClient.putCommand(device.deviceType, device.deviceNumber, 'Connected', { Connected: false });
    }
};

export const disconnect = async () => {
    stopPositionPolling();
    stopStream();
    alpacaClient.disconnect();
};

export const slewTo = async (obj: CelestialObject) => {
    const telId = getDeviceNumber('Telescope');
    if (telId === -1) {
        addDebugLog("Error: Telescope not found.");
        return;
    }
    const ra = hmsToDegrees(obj.ra) / 15;
    const dec = dmsToDegrees(obj.dec);
    addDebugLog(`Slewing to ${obj.name} (RA: ${ra.toFixed(4)}h, Dec: ${dec.toFixed(4)}°)...`);
    try {
        // Ensure tracking is ON before slewing
        await alpacaClient.putCommand('Telescope', telId, 'Tracking', { Tracking: true });
        
        let res = await alpacaClient.putCommand('Telescope', telId, 'SlewToCoordinatesAsync', { RightAscension: ra, Declination: dec });
        if (res && res.ErrorNumber !== 0) {
            addDebugLog(`SlewToCoordinatesAsync failed (Code: ${res.ErrorNumber}). Trying synchronous SlewToCoordinates...`);
            res = await alpacaClient.putCommand('Telescope', telId, 'SlewToCoordinates', { RightAscension: ra, Declination: dec });
        }
        
        if (res && res.ErrorNumber !== 0) {
            addDebugLog(`Slew failed: ${res.ErrorMessage} (Code: ${res.ErrorNumber})`);
        } else {
            addDebugLog(`Slew initiated successfully.`);
        }
    } catch (e: any) {
        addDebugLog(`Slew error: ${e.message}`);
    }
};

export const syncTo = async (obj: CelestialObject) => {
    const telId = getDeviceNumber('Telescope');
    if (telId === -1) {
        addDebugLog("Error: Telescope not found for Sync.");
        return;
    }
    const ra = hmsToDegrees(obj.ra) / 15;
    const dec = dmsToDegrees(obj.dec);
    addDebugLog(`Syncing to ${obj.name} (RA: ${ra.toFixed(4)}h, Dec: ${dec.toFixed(4)}°)...`);
    try {
        const res = await alpacaClient.putCommand('Telescope', telId, 'SyncToCoordinates', { RightAscension: ra, Declination: dec });
        if (res && res.ErrorNumber !== 0) {
            addDebugLog(`Sync failed: ${res.ErrorMessage} (Code: ${res.ErrorNumber})`);
        } else {
            addDebugLog(`Sync successful.`);
        }
    } catch (e: any) {
        addDebugLog(`Sync error: ${e.message}`);
    }
};

export const slewToCoordinates = async (ra: number, dec: number) => {
    const telId = getDeviceNumber('Telescope');
    if (telId === -1) {
        addDebugLog("Error: Telescope not found for Slew.");
        return;
    }
    addDebugLog(`Slewing to RA=${(ra/15).toFixed(4)}h, Dec=${dec.toFixed(4)}°`);
    try {
        // Check capabilities first if possible, but for now just try and catch
        // Ensure telescope is UNPARKED and tracking is ON before slewing
        addDebugLog(`Ensuring telescope is unparked and tracking is ON...`);
        try {
            await alpacaClient.putCommand('Telescope', telId, 'Unpark');
        } catch (e) {
            addDebugLog(`Unpark failed or not supported (ignoring): ${e}`);
        }
        
        try {
            await alpacaClient.putCommand('Telescope', telId, 'Tracking', { Tracking: true });
        } catch (e) {
            addDebugLog(`Set Tracking failed (ignoring): ${e}`);
        }
        
        let res = await alpacaClient.putCommand('Telescope', telId, 'SlewToCoordinatesAsync', { RightAscension: ra / 15, Declination: dec });
        if (res && res.ErrorNumber !== 0) {
            addDebugLog(`SlewToCoordinatesAsync failed (Code: ${res.ErrorNumber}). Trying synchronous SlewToCoordinates...`);
            res = await alpacaClient.putCommand('Telescope', telId, 'SlewToCoordinates', { RightAscension: ra / 15, Declination: dec });
        }
        
        if (res && res.ErrorNumber === 0) {
            addDebugLog(`Slew command sent successfully.`);
        } else if (res && res.ErrorNumber !== 0) {
            addDebugLog(`Slew failed: ${res.ErrorMessage} (Code: ${res.ErrorNumber})`);
        }
    } catch (e: any) {
        addDebugLog(`Slew error: ${e.message}`);
    }
};

export const syncToCoordinates = async (ra: number, dec: number) => {
    const telId = getDeviceNumber('Telescope');
    if (telId === -1) {
        addDebugLog("Error: Telescope not found for Sync.");
        return;
    }
    addDebugLog(`Syncing to RA=${(ra/15).toFixed(4)}h, Dec=${dec.toFixed(4)}°`);
    try {
        // Some mounts require tracking to be ON and unparked for sync
        addDebugLog(`Ensuring telescope is unparked and tracking is ON for sync...`);
        try {
            await alpacaClient.putCommand('Telescope', telId, 'Unpark');
        } catch (e) {}
        try {
            await alpacaClient.putCommand('Telescope', telId, 'Tracking', { Tracking: true });
        } catch (e) {}
        
        const res = await alpacaClient.putCommand('Telescope', telId, 'SyncToCoordinates', { RightAscension: ra / 15, Declination: dec });
        if (res && res.ErrorNumber !== 0) {
            addDebugLog(`Sync failed: ${res.ErrorMessage} (Code: ${res.ErrorNumber})`);
        } else {
            addDebugLog(`Sync successful.`);
        }
    } catch (e: any) {
        addDebugLog(`Sync error: ${e.message}`);
    }
};

export const getTelescopePosition = async (): Promise<TelescopePosition | null> => {
    const telId = getDeviceNumber('Telescope');
    if (telId === -1) return null;
    
    try {
        const raRes = await alpacaClient.getCommand('Telescope', telId, 'RightAscension');
        const decRes = await alpacaClient.getCommand('Telescope', telId, 'Declination');
        
        if (raRes && raRes.ErrorNumber === 0 && decRes && decRes.ErrorNumber === 0) {
            const ra = raRes.Value * 15; // Convert hours to degrees
            const dec = decRes.Value;
            
            // Log every 10th poll to avoid flooding but show it's working
            if (Math.random() < 0.1) {
                console.log(`[Alpaca] Telescope Position: RA=${ra.toFixed(4)}°, Dec=${dec.toFixed(4)}° (Raw RA=${raRes.Value}h)`);
            }
            
            return { ra, dec };
        } else if (raRes?.ErrorNumber !== 0 || decRes?.ErrorNumber !== 0) {
            console.warn(`[Alpaca] Failed to get position: RA_Err=${raRes?.ErrorNumber}, Dec_Err=${decRes?.ErrorNumber}`);
        }
    } catch (e: any) {
        console.error(`[Alpaca] Error polling position: ${e.message}`);
    }
    return null;
};

export const startMotion = async (dir: string, speed: MountSpeed) => {
    const telId = getDeviceNumber('Telescope');
    if (telId === -1) {
        addDebugLog("Error: Telescope not found for Motion.");
        return;
    }

    let axis = 0; // 0 = RA/Az, 1 = Dec/Alt
    let rate = 0;

    // Map speed to deg/sec (approximate)
    // Some mounts might expect different units or have specific limits
    switch (speed) {
        case 'Guide': rate = 0.0042; break; // 1x sidereal is ~0.00416 deg/sec.
        case 'Center': rate = 0.1; break;
        case 'Find': rate = 1.0; break;
        case 'Slew': rate = 4.0; break;
        default: rate = 0.5;
    }

    if (dir === 'north' || dir === 'N') { axis = 1; }
    else if (dir === 'south' || dir === 'S') { axis = 1; rate = -rate; }
    else if (dir === 'west' || dir === 'W') { axis = 0; }
    else if (dir === 'east' || dir === 'E') { axis = 0; rate = -rate; }

    // Ensure rate is not 0 if direction is set
    if (rate === 0) rate = 0.1;

    addDebugLog(`Mount MoveAxis: Axis=${axis}, Rate=${rate} (Speed: ${speed}, Dir: ${dir})`);
    try {
        // Ensure telescope is UNPARKED and tracking is ON for MoveAxis
        addDebugLog(`Ensuring telescope is unparked and tracking is ON for MoveAxis...`);
        try {
            await alpacaClient.putCommand('Telescope', telId, 'Unpark');
        } catch (e) {}
        try {
            await alpacaClient.putCommand('Telescope', telId, 'Tracking', { Tracking: true });
        } catch (e) {}
        
        const res = await alpacaClient.putCommand('Telescope', telId, 'MoveAxis', { Axis: axis, Rate: rate });
        if (res && res.ErrorNumber !== 0) {
            addDebugLog(`MoveAxis failed: ${res.ErrorMessage} (Code: ${res.ErrorNumber})`);
            console.error(`[Alpaca] MoveAxis failed:`, res);
        } else {
            addDebugLog(`MoveAxis command sent successfully.`);
        }
    } catch (e: any) {
        addDebugLog(`MoveAxis error: ${e.message}`);
        console.error(`[Alpaca] MoveAxis error:`, e);
    }
};

export const stopMotion = async (dir: string) => {
    const telId = getDeviceNumber('Telescope');
    if (telId === -1) return;

    let axis = (dir === 'north' || dir === 'south' || dir === 'N' || dir === 'S') ? 1 : 0;
    addDebugLog(`Mount Stop MoveAxis: Axis=${axis} (Dir: ${dir})`);
    try {
        const res = await alpacaClient.putCommand('Telescope', telId, 'MoveAxis', { Axis: axis, Rate: 0 });
        if (res && res.ErrorNumber !== 0) {
            addDebugLog(`Stop MoveAxis failed: ${res.ErrorMessage} (Code: ${res.ErrorNumber})`);
        } else {
            addDebugLog(`Stop MoveAxis command sent successfully.`);
        }
    } catch (e: any) {
        addDebugLog(`Stop MoveAxis error: ${e.message}`);
    }
};

export const setTracking = async (enabled: boolean) => {
    await alpacaClient.putCommand('Telescope', getDeviceNumber('Telescope'), 'Tracking', { Tracking: enabled });
};

export const setPark = async (parked: boolean) => {
    if (parked) await alpacaClient.putCommand('Telescope', getDeviceNumber('Telescope'), 'Park');
    else await alpacaClient.putCommand('Telescope', getDeviceNumber('Telescope'), 'Unpark');
};

export const getCameraCapabilities = async () => {
    const camId = getDeviceNumber('Camera');
    if (camId === -1) return null;
    try {
        const canFast = await alpacaClient.getCommand('Camera', camId, 'CanFastReadout');
        const canSetTemp = await alpacaClient.getCommand('Camera', camId, 'CanSetCCDTemperature');
        const canAbort = await alpacaClient.getCommand('Camera', camId, 'CanAbortExposure');
        
        return {
            canFastReadout: canFast?.Value === true,
            canSetCCDTemperature: canSetTemp?.Value === true,
            canAbortExposure: canAbort?.Value === true
        };
    } catch (e) {
        return null;
    }
};

export const updateGain = async (gain: number) => {
    const camId = getDeviceNumber('Camera');
    if (camId !== -1) await alpacaClient.putCommand('Camera', camId, 'Gain', { Gain: gain });
};

export const updateOffset = async (offset: number) => {
    const camId = getDeviceNumber('Camera');
    if (camId !== -1) await alpacaClient.putCommand('Camera', camId, 'Offset', { Offset: offset });
};

export const capturePreview = async (exp: number, gain: number, offset: number, isStream: boolean = false) => {
    const camId = getDeviceNumber('Camera');
    addDebugLog(`Starting ${exp/1000}s exposure on camera ${camId}...`);
    
    try {
        await updateGain(gain);
        await updateOffset(offset);
        await alpacaClient.putCommand('Camera', camId, 'StartExposure', { Duration: exp / 1000, Light: true });
        
        // Polling for image
        let ready = false;
        for (let i = 0; i < 60; i++) {
            const res = await alpacaClient.getCommand('Camera', camId, 'ImageReady');
            if (res && res.Value === true) {
                ready = true;
                break;
            }
            await sleep(1000);
        }
        
        if (!ready) {
            addDebugLog("Exposure timed out.");
            return "";
        }
        
        addDebugLog("Image ready, fetching data...");
        const rawData = await alpacaClient.getImageArray(camId);
        if (!rawData) {
            addDebugLog("Failed to fetch image array.");
            return "";
        }
        
        let header: any;
        let data: any;
        
        if (rawData instanceof ArrayBuffer) {
            const parsed = AlpacaImageService.parseBinaryImage(rawData);
            header = parsed.header;
            data = parsed.data;
        } else {
            // JSON format - rawData is the Value from Alpaca response
            // Flatten it if it's a 2D/3D array
            data = Array.isArray(rawData) ? rawData.flat(Infinity) : rawData;
            
            if (Array.isArray(rawData) && Array.isArray(rawData[0]) && Array.isArray(rawData[0][0])) {
                // 3D array (RGB) [y][x][c]
                header = {
                    dimension1: rawData.length,    // height
                    dimension2: rawData[0].length, // width
                    dimension3: rawData[0][0].length, // channels
                    rank: 3,
                    imageElementType: 0
                };
            } else if (Array.isArray(rawData) && Array.isArray(rawData[0])) {
                // 2D array (Grayscale) [y][x]
                header = {
                    dimension1: rawData.length,    // height
                    dimension2: rawData[0].length, // width
                    rank: 2,
                    imageElementType: 0
                };
            } else {
                header = {
                    dimension1: 0,
                    dimension2: 0,
                    rank: 1,
                    imageElementType: 0
                };
            }
        }
        
        // Extract metadata
        const w = header.dimension2 || 640;
        const h = header.dimension1 || 480;
        const bpp = (header.imageElementType === 1 || header.imageElementType === 5) ? 16 : 
                    (header.imageElementType === 2 || header.imageElementType === 4) ? 32 : 8;
        
        const format = bpp === 16 ? 'RAW16' : (bpp === 32 ? 'RAW32' : 'RAW8');
        
        addDebugLog(`Processing ${w}x${h} ${bpp}-bit image...`);

        // Convert to displayable URL using existing logic
        const url = await AlpacaImageService.convertToDisplay(header, data);
        
        if (url && imageReceivedCallback) {
            imageReceivedCallback(url, format, { width: w, height: h });
            addDebugLog("Image received and processed.");
        }
        
        return url || "";
    } catch (e: any) {
        addDebugLog(`Capture failed: ${e.message}`);
        return "";
    }
};

export const startCapture = async (exp: number, gain: number, offset: number, colorBalance: any, cb: (c:number)=>void, done: ()=>void) => {
    // Implementation for sequence
};

export const stopCapture = async () => {
    const camId = getDeviceNumber('Camera');
    if (camId !== -1) await alpacaClient.putCommand('Camera', camId, 'AbortExposure');
};

export const stopAllImaging = async () => {
    isStreaming = false;
    if (streamTimer) {
        clearTimeout(streamTimer);
        streamTimer = null;
    }
    await stopCapture();
    addDebugLog("All imaging operations stopped.");
};

let isStreaming = false;
let streamTimer: any = null;

export const startStream = (exp: number = 1000, gain: number = 0, offset: number = 0) => {
    if (isStreaming) return;
    isStreaming = true;
    addDebugLog("Starting live view stream...");
    
    const runStream = async () => {
        if (!isStreaming) return;
        try {
            await capturePreview(exp, gain, offset, true);
        } catch (e) {
            addDebugLog(`Stream error: ${e}`);
        }
        if (isStreaming) {
            streamTimer = setTimeout(runStream, 100);
        }
    };
    runStream();
};

export const stopStream = () => {
    isStreaming = false;
    if (streamTimer) {
        clearTimeout(streamTimer);
        streamTimer = null;
    }
    addDebugLog("Live view stream stopped.");
};

export const setVideoStream = async (enabled: boolean) => {
};

export const abortSlew = async () => {
    await alpacaClient.putCommand('Telescope', getDeviceNumber('Telescope'), 'AbortSlew');
};

export const sendLocation = async (loc: LocationData, time: Date) => {
    await alpacaClient.putCommand('Telescope', getDeviceNumber('Telescope'), 'SiteLatitude', { SiteLatitude: loc.latitude });
    await alpacaClient.putCommand('Telescope', getDeviceNumber('Telescope'), 'SiteLongitude', { SiteLongitude: loc.longitude });
};

// Mock other functions for compatibility
export const getActiveCamera = () => 'Alpaca Camera';
export const getActiveFocuser = () => 'Alpaca Focuser';
export const getDeviceProperties = (device: string): any[] => {
    const devices = alpacaClient.getDevices();
    const dev = devices.find(d => d.deviceName === device);
    if (!dev) return [];

    // Map Alpaca properties to INDI-like vectors for the UI
    // This is a simplified mapping so DeviceSettingsModalAlpaca can display them
    const vectors: any[] = [];

    // Connection Status
    vectors.push({
        device: dev.deviceName,
        name: 'CONNECTION',
        label: 'Connection',
        group: 'Main',
        state: (dev as any).connected ? 'Ok' : 'Idle',
        perm: 'rw',
        type: 'Switch',
        rule: 'OneOfMany',
        elements: new Map([
            ['CONNECT', { name: 'CONNECT', label: 'Connect', value: (dev as any).connected === true }],
            ['DISCONNECT', { name: 'DISCONNECT', label: 'Disconnect', value: (dev as any).connected === false }]
        ])
    });

    // Info
    vectors.push({
        device: dev.deviceName,
        name: 'INFO',
        label: 'Device Info',
        group: 'Main',
        state: 'Ok',
        perm: 'ro',
        type: 'Text',
        elements: new Map([
            ['NAME', { name: 'NAME', label: 'Name', value: dev.deviceName }],
            ['TYPE', { name: 'TYPE', label: 'Type', value: dev.deviceType }],
            ['ID', { name: 'ID', label: 'Unique ID', value: dev.uniqueId }]
        ])
    });

    return vectors;
};
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
export const getFocuserPosition = async (): Promise<number> => {
    let focId = getDeviceNumber('Focuser');
    
    // If not found, wait a bit and retry (in case device list is still being populated)
    if (focId === -1) {
        await sleep(1000);
        focId = getDeviceNumber('Focuser');
    }
    
    if (focId === -1) return 0;
    try {
        const res = await alpacaClient.getCommand('Focuser', focId, 'Position');
        if (res && res.ErrorNumber === 0) return Number(res.Value);
        else addDebugLog(`Focuser position error: ${res?.ErrorMessage || 'Unknown error'}`);
    } catch (e: any) {
        addDebugLog(`Focuser position exception: ${e.message}`);
    }
    return 0;
};

export const moveFocuser = async (steps: number) => {
    const focId = getDeviceNumber('Focuser');
    if (focId === -1) {
        addDebugLog("Focuser not connected.");
        return;
    }

    try {
        addDebugLog(`Fetching current focuser position for relative move of ${steps}...`);
        const posRes = await alpacaClient.getCommand('Focuser', focId, 'Position');
        if (posRes && posRes.ErrorNumber === 0) {
            const currentPos = Number(posRes.Value);
            const target = currentPos + steps;
            addDebugLog(`Moving focuser from ${currentPos} to ${target}...`);
            const moveRes = await alpacaClient.putCommand('Focuser', focId, 'Move', { Position: target });
            if (moveRes && moveRes.ErrorNumber !== 0) {
                addDebugLog(`Focuser move failed: ${moveRes.ErrorMessage}`);
            }
        } else {
            addDebugLog(`Failed to get focuser position: ${posRes?.ErrorMessage || 'Unknown error'}`);
        }
    } catch (e: any) {
        addDebugLog(`Focuser move error: ${e.message}`);
    }
};
export const reprocessRawFITS = (fmt: string) => {};
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
export const updateDeviceSetting = async (deviceName: string, property: string, values: Record<string, any>) => {
    // Map INDI-style property updates to Alpaca commands
    const devices = alpacaClient.getDevices();
    const device = devices.find(d => d.deviceName === deviceName);
    if (!device) return;

    const type = device.deviceType;
    const num = device.deviceNumber;

    if (property === 'CCD_GAIN' || property === 'GAIN') {
        const val = values['GAIN'] !== undefined ? values['GAIN'] : Object.values(values)[0];
        await alpacaClient.putCommand(type, num, 'Gain', { Gain: val });
    } else if (property === 'CCD_OFFSET' || property === 'OFFSET') {
        const val = values['OFFSET'] !== undefined ? values['OFFSET'] : Object.values(values)[0];
        await alpacaClient.putCommand(type, num, 'Offset', { Offset: val });
    } else if (property === 'CCD_BINNING') {
        const val = values['HOR_BIN'] || values['BIN'] || Object.values(values)[0];
        await alpacaClient.putCommand(type, num, 'BinX', { BinX: val });
        await alpacaClient.putCommand(type, num, 'BinY', { BinY: val });
    }
};
export const sendRaw = (xml: string) => {};
export const diagnoseConnection = async (host: string, port: number, driver: string) => {
    const results: string[] = [];
    results.push(`Starting diagnostics for ${driver} at ${host}:${port}...`);
    
    try {
    const isLocalIp = host.startsWith('192.168.') || host.startsWith('10.') || host.startsWith('172.') || host === 'localhost' || host === '127.0.0.1';
    const isCloud = window.location.hostname.includes('.run.app') || window.location.hostname.includes('github.io');
    
    if (isLocalIp && isCloud) {
        results.push(`⚠️ Warning: You are trying to connect to a local IP (${host}) from a cloud-hosted app (${window.location.hostname}).`);
        results.push(`   This will NOT work unless you have a tunnel or bridge set up.`);
        results.push(`   💡 Tip: Run this app locally on your StellarMate/Linux machine to connect to local devices.`);
    }

    results.push(`Checking network connectivity to proxy...`);
    const proxyCheck = await fetch('/api/alpaca/status').catch(e => ({ ok: false, status: 0, statusText: e.message }));
    
    if (proxyCheck.ok) {
        const backendType = (proxyCheck as any).headers?.get('x-backend-type');
        const contentType = (proxyCheck as any).headers?.get('content-type') || '';
        
        if (backendType === 'Express-Alpaca-Proxy') {
            results.push(`✅ Proxy server is reachable and confirmed as Express-Alpaca-Proxy.`);
        } else if (contentType.includes('application/json')) {
            results.push(`✅ Proxy server is reachable and responding with JSON.`);
        } else {
            const text = await (proxyCheck as any).text();
            results.push(`❌ CRITICAL ERROR: Proxy returned HTML instead of JSON.`);
            results.push(`   Response Preview: ${text.substring(0, 100)}...`);
            results.push(`   --------------------------------------------------`);
            results.push(`   ⚠️ 原因: APIリクエストがNode.jsサーバーに届いていません。`);
            results.push(`   ⚠️ 可能性1: nginx等の別サーバーが静的ファイルのみを返している。`);
            results.push(`   ⚠️ 可能性2: 'npm run dev' ではなく 'npx vite' 等でフロントのみ起動している。`);
            results.push(`   💡 解決策: StellarMateのターミナルで 'npm run dev' が動いているか確認してください。`);
            results.push(`   💡 ログに 'Server running on http://localhost:6002' と出ている必要があります。`);
            results.push(`   --------------------------------------------------`);
            return results;
        }
    } else {
            results.push(`❌ Proxy server is unreachable or returned error. Status: ${(proxyCheck as any).status || 'Network Error'}`);
            results.push(`   Note: Ensure the web server is running on port 6002.`);
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
