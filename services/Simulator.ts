
import { ConnectionSettings, INDIDevice, INDIPropertyState, INDIPropertyType, INDISwitchRule, INDIPermission, LocationData, TelescopePosition, DriverType, INDIVector, INDIElement, DeviceType } from '../types';

let debugLogs: string[] = [];
let onLogCallback: ((entry: string) => void) | null = null;

const log = (msg: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const entry = `[${timestamp}] ${msg}`;
    console.log(entry); 
    debugLogs.push(entry);
    if (debugLogs.length > 200) debugLogs.shift();
    if (onLogCallback) onLogCallback(entry);
};

export const setLogCallback = (cb: (entry: string) => void) => { onLogCallback = cb; };
export const getDebugLogs = () => [...debugLogs];

// --- Callbacks for UI Sync ---
let onIndiDeviceUpdate: ((devices: INDIDevice[]) => void) | null = null;
let onIndiMessageCount: ((count: number) => void) | null = null;
let onImageReceived: ((dataUrl: string, format: string, metadata?: Record<string, any>) => void) | null = null;
let onTelescopePositionUpdate: ((pos: TelescopePosition) => void) | null = null;
let onFocuserUpdate: ((position: number, step?: number) => void) | null = null;
let onMountLocationUpdate: ((loc: LocationData) => void) | null = null;
let onMountTimeUpdate: ((time: Date) => void) | null = null;

export const setIndiDeviceCallback = (cb: typeof onIndiDeviceUpdate) => { 
    onIndiDeviceUpdate = cb;
    if (cb && discoveredDevices.size > 0) {
        cb(Array.from(discoveredDevices.values()));
    }
};
export const setIndiMessageCountCallback = (cb: typeof onIndiMessageCount) => onIndiMessageCount = cb;
export const setImageReceivedCallback = (cb: typeof onImageReceived) => onImageReceived = cb;
export const setTelescopePositionCallback = (cb: typeof onTelescopePositionUpdate) => onTelescopePositionUpdate = cb;
export const setFocuserUpdateCallback = (cb: typeof onFocuserUpdate) => onFocuserUpdate = cb;
export const setMountLocationCallback = (cb: typeof onMountLocationUpdate) => onMountLocationUpdate = cb;
export const setMountTimeCallback = (cb: typeof onMountTimeUpdate) => onMountTimeUpdate = cb;

// --- State ---
const discoveredDevices: Map<string, INDIDevice> = new Map();
let activeMountDevice: string | null = null;
let activeCameraDevice: string | null = null;
let activeFocuserDevice: string | null = null;
let simulationInterval: any = null;

// Mock Data
let currentRa = 0;
let currentDec = 0;
let targetRa = 0;
let targetDec = 0;
let isSlewing = false;

export const getActiveMount = () => activeMountDevice;
export const getActiveCamera = () => activeCameraDevice;
export const getActiveFocuser = () => activeFocuserDevice;
export const getIndiDevices = () => Array.from(discoveredDevices.values());

export const getDeviceProperties = (devName: string): INDIVector[] => {
    const dev = discoveredDevices.get(devName);
    return dev ? Array.from(dev.properties.values()) : [];
};

export const hasProperty = (dev: string, prop: string): boolean => {
    const d = discoveredDevices.get(dev);
    return !!d && d.properties.has(prop);
};

export const getNumericValue = (dev: string, prop: string, element: string): number | null => {
    const d = discoveredDevices.get(dev);
    if (!d) return null;
    const vec = d.properties.get(prop);
    if (!vec || vec.type !== 'Number') return null;
    const el = vec.elements.get(element);
    return (el && typeof el.value === 'number') ? el.value : null;
};

export const getDevicesWithProperty = (propName: string): string[] => {
    const names: string[] = [];
    for (const [name, dev] of discoveredDevices) {
        if (dev.properties.has(propName)) names.push(name);
    }
    return names;
};

export const connect = async (settings: ConnectionSettings): Promise<boolean> => {
    log('[Simulator] Initializing simulation devices...');
    
    // Create Mock Mount
    const mount: INDIDevice = {
        name: 'Simulator Mount',
        connected: true,
        type: 'Mount',
        properties: new Map()
    };
    
    const mountConn: INDIVector = {
        device: 'Simulator Mount', name: 'CONNECTION', label: 'Connection', group: 'Main',
        state: 'Ok', perm: 'rw', type: 'Switch', rule: 'OneOfMany',
        elements: new Map([['CONNECT', { name: 'CONNECT', label: 'Connect', value: true }], ['DISCONNECT', { name: 'DISCONNECT', label: 'Disconnect', value: false }]])
    };
    mount.properties.set('CONNECTION', mountConn);

    const mountCoord: INDIVector = {
        device: 'Simulator Mount', name: 'EQUATORIAL_EOD_COORD', label: 'Equatorial Coordinates', group: 'Main',
        state: 'Idle', perm: 'rw', type: 'Number',
        elements: new Map([['RA', { name: 'RA', label: 'RA', value: 0 }], ['DEC', { name: 'DEC', label: 'Dec', value: 0 }]])
    };
    mount.properties.set('EQUATORIAL_EOD_COORD', mountCoord);

    discoveredDevices.set(mount.name, mount);
    activeMountDevice = mount.name;

    // Create Mock Camera
    const camera: INDIDevice = {
        name: 'Simulator Camera',
        connected: true,
        type: 'Camera',
        properties: new Map()
    };
    
    const camConn: INDIVector = {
        device: 'Simulator Camera', name: 'CONNECTION', label: 'Connection', group: 'Main',
        state: 'Ok', perm: 'rw', type: 'Switch', rule: 'OneOfMany',
        elements: new Map([['CONNECT', { name: 'CONNECT', label: 'Connect', value: true }], ['DISCONNECT', { name: 'DISCONNECT', label: 'Disconnect', value: false }]])
    };
    camera.properties.set('CONNECTION', camConn);

    const camExp: INDIVector = {
        device: 'Simulator Camera', name: 'CCD_EXPOSURE', label: 'Exposure', group: 'Main',
        state: 'Idle', perm: 'rw', type: 'Number',
        elements: new Map([['CCD_EXPOSURE_VALUE', { name: 'CCD_EXPOSURE_VALUE', label: 'Exposure (s)', value: 0 }]])
    };
    camera.properties.set('CCD_EXPOSURE', camExp);

    discoveredDevices.set(camera.name, camera);
    activeCameraDevice = camera.name;

    if (onIndiDeviceUpdate) onIndiDeviceUpdate(Array.from(discoveredDevices.values()));

    // Start Simulation Loop
    if (simulationInterval) clearInterval(simulationInterval);
    simulationInterval = setInterval(() => {
        if (isSlewing) {
            const step = 0.5;
            if (Math.abs(currentRa - targetRa) > step) currentRa += (targetRa > currentRa ? step : -step);
            else currentRa = targetRa;
            
            if (Math.abs(currentDec - targetDec) > step) currentDec += (targetDec > currentDec ? step : -step);
            else currentDec = targetDec;

            if (currentRa === targetRa && currentDec === targetDec) {
                isSlewing = false;
                log('[Simulator] Slew complete');
                const p = mount.properties.get('EQUATORIAL_EOD_COORD');
                if (p) p.state = 'Ok';
            }

            const p = mount.properties.get('EQUATORIAL_EOD_COORD');
            if (p) {
                p.elements.get('RA')!.value = currentRa / 15; // INDI RA is in hours
                p.elements.get('DEC')!.value = currentDec;
            }
            if (onTelescopePositionUpdate) onTelescopePositionUpdate({ ra: currentRa, dec: currentDec });
            if (onIndiDeviceUpdate) onIndiDeviceUpdate(Array.from(discoveredDevices.values()));
        }
    }, 200);

    return true;
};

export const disconnect = async () => {
    log('[Simulator] Disconnecting...');
    if (simulationInterval) clearInterval(simulationInterval);
    simulationInterval = null;
    discoveredDevices.clear();
    activeMountDevice = null;
    activeCameraDevice = null;
    activeFocuserDevice = null;
    if (onIndiDeviceUpdate) onIndiDeviceUpdate([]);
};

export const updateDeviceSetting = (dev: string, prop: string, val: any) => {
    const d = discoveredDevices.get(dev);
    if (!d) return;
    const vec = d.properties.get(prop);
    if (!vec) return;

    log(`[Simulator] Update ${dev}.${prop} = ${JSON.stringify(val)}`);

    if (prop === 'EQUATORIAL_EOD_COORD') {
        if (val.RA !== undefined) targetRa = val.RA * 15;
        if (val.DEC !== undefined) targetDec = val.DEC;
        isSlewing = true;
        vec.state = 'Busy';
    }

    if (prop === 'CCD_EXPOSURE') {
        const dur = val.CCD_EXPOSURE_VALUE;
        vec.state = 'Busy';
        if (onIndiDeviceUpdate) onIndiDeviceUpdate(Array.from(discoveredDevices.values()));
        setTimeout(() => {
            vec.state = 'Ok';
            log(`[Simulator] Exposure finished: ${dur}s`);
            if (onImageReceived) {
                // Return a placeholder image
                onImageReceived(`https://picsum.photos/seed/astro${Math.random()}/800/600`, 'jpg');
            }
            if (onIndiDeviceUpdate) onIndiDeviceUpdate(Array.from(discoveredDevices.values()));
        }, dur * 1000);
    }

    // Update local state
    for (const k in val) {
        const el = vec.elements.get(k);
        if (el) el.value = val[k];
    }
    if (onIndiDeviceUpdate) onIndiDeviceUpdate(Array.from(discoveredDevices.values()));
};

export const getSwitchValue = (dev: string, prop: string, el: string): boolean => {
    const d = discoveredDevices.get(dev);
    if (!d) return false;
    const vec = d.properties.get(prop);
    if (!vec || vec.type !== 'Switch') return false;
    return vec.elements.get(el)?.value === true;
};

export const refreshIndiDevices = () => {
    if (onIndiDeviceUpdate) onIndiDeviceUpdate(Array.from(discoveredDevices.values()));
};

export const moveFocuser = (steps: number, direction: 'in' | 'out') => {
    log(`[Simulator] Move focuser ${direction} by ${steps} steps`);
};

export const diagnoseConnection = async (host: string, port: number, driver: string): Promise<string[]> => {
    return ["✅ Simulator is internal. Connection OK."];
};

export const clearBuffer = () => {};
export const connectIndiDevice = (devName: string) => {};
export const disconnectIndiDevice = (devName: string) => {};
export const reprocessRawFITS = (pattern: string) => {};
export const sendRaw = (xml: string) => {};
export const injectIndiValue = (device: string, vector: string, element: string, value: any) => {};
export const triggerImageUpdate = (url: string, format: string) => {};
export const setMainChannelBlobDisabled = (disabled: boolean) => {};
export const triggerExternalImageReceived = (url: string, format: string, metadata?: any) => {};
