import { CelestialObject, MountSpeed, LocationData, TelescopePosition, SimulatorSettings, INDIVector, INDIDevice } from '../types';
import { hmsToDegrees, dmsToDegrees } from '../utils/coords';
import AstroSimulatorService from './AstroSimulatorService';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

let imageReceivedCallback: ((url: string, format: string, metadata?: any) => void) | null = null;
let telescopePositionCallback: ((pos: TelescopePosition) => void) | null = null;
let deviceCallback: ((devs: INDIDevice[]) => void) | null = null;
let messageCountCallback: ((count: number) => void) | null = null;
let messageCount = 0;

let lastImageReceived: string | null = null;

export const setImageReceivedCallback = (cb: typeof imageReceivedCallback) => {
    imageReceivedCallback = cb;
};

export const setTelescopePositionCallback = (cb: typeof telescopePositionCallback) => {
    telescopePositionCallback = cb;
};

// Mock other callbacks for compatibility
export const setLogCallback = (cb: any) => {};
export const setDeviceCallback = (cb: (devs: INDIDevice[]) => void) => {
    deviceCallback = cb;
    if (cb) cb(getDevices());
};
export const setMessageCountCallback = (cb: (count: number) => void) => {
    messageCountCallback = cb;
};
export const setFocuserUpdateCallback = (cb: any) => {};
export const setMountLocationCallback = (cb: any) => {};
export const setMountTimeCallback = (cb: any) => {};

// Compatibility aliases
export const setIndiDeviceCallback = setDeviceCallback;
export const setIndiMessageCountCallback = setMessageCountCallback;

export const connect = async (settings: any): Promise<boolean> => {
    console.log("[AstroServiceSimulator] Connecting to simulator...");
    try {
        await sleep(300); // Simulate network delay
        AstroSimulatorService.connectMount();
        AstroSimulatorService.connectCamera();
        AstroSimulatorService.connectFocuser();
        
        AstroSimulatorService.setStateCallback((state) => {
            messageCount++;
            if (messageCountCallback) messageCountCallback(messageCount);
            if (deviceCallback) deviceCallback(getDevices());

            if (telescopePositionCallback) {
                telescopePositionCallback({ ra: state.mount.ra, dec: state.mount.dec });
            }
            if (state.camera.lastImage && imageReceivedCallback && state.camera.lastImage !== lastImageReceived) {
                lastImageReceived = state.camera.lastImage;
                imageReceivedCallback(state.camera.lastImage, 'image/jpeg', {});
            }
        });
        
        console.log("[AstroServiceSimulator] Connected successfully.");
        return true;
    } catch (e) {
        console.error("[AstroServiceSimulator] Connection failed:", e);
        return false;
    }
};

export const disconnect = async () => {
    AstroSimulatorService.disconnectMount();
};

export const slewTo = async (obj: CelestialObject) => {
    const ra = hmsToDegrees(obj.ra);
    const dec = dmsToDegrees(obj.dec);
    AstroSimulatorService.slewTo(ra, dec);
};

export const syncTo = async (obj: CelestialObject) => {
    const ra = hmsToDegrees(obj.ra);
    const dec = dmsToDegrees(obj.dec);
    AstroSimulatorService.syncTo(ra, dec);
};

export const syncToCoordinates = async (ra: number, dec: number) => {
    AstroSimulatorService.syncTo(ra, dec);
};

export const getTelescopePosition = (): TelescopePosition | null => {
    const state = AstroSimulatorService.getState();
    return { ra: state.mount.ra, dec: state.mount.dec };
};

export const startMotion = (dir: string, speed: MountSpeed) => {
    AstroSimulatorService.startMotion(dir, speed);
};

export const stopMotion = (dir: string) => {
    AstroSimulatorService.stopMotion(dir);
};

export const setTracking = (enabled: boolean) => {
    AstroSimulatorService.setTracking(enabled);
};

export const setPark = (parked: boolean) => {
    AstroSimulatorService.setPark(parked);
};

export const capturePreview = async (exp: number, gain: number, offset: number, isStream: boolean = false) => {
    AstroSimulatorService.startExposure(exp / 1000);
};

export const startCapture = async (exp: number, gain: number, offset: number, colorBalance: any, cb: (c:number)=>void, done: ()=>void) => {
    let count = 0;
    let isCapturingLocal = true;
    
    const originalStopCapture = stopCapture;
    (window as any)._stopCapture = () => {
        isCapturingLocal = false;
        originalStopCapture();
    };

    const loop = async () => {
        if (!isCapturingLocal) { done(); return; }
        AstroSimulatorService.startExposure(exp / 1000);
        await sleep(exp + 500);
        if (!isCapturingLocal) { done(); return; }
        count++;
        cb(count);
        setTimeout(loop, 100);
    };
    loop();
};

export const stopCapture = () => {
    if ((window as any)._stopCapture) {
        (window as any)._stopCapture();
        delete (window as any)._stopCapture;
    } else {
        AstroSimulatorService.abortExposure();
    }
};

let isStreaming = false;
let streamTimeout: any = null;

export const startStream = () => {
    isStreaming = true;
    const loop = async () => {
        if (!isStreaming) return;
        AstroSimulatorService.startExposure(0.2);
        await sleep(500);
        if (isStreaming) streamTimeout = setTimeout(loop, 100);
    };
    loop();
};

export const stopStream = () => {
    isStreaming = false;
    if (streamTimeout) clearTimeout(streamTimeout);
    stopCapture();
};

export const setVideoStream = async (enabled: boolean) => {
    if (enabled) startStream();
    else stopStream();
};

export const abortSlew = () => {
    AstroSimulatorService.setPark(true);
    AstroSimulatorService.setPark(false);
};

export const sendLocation = (loc: LocationData, time: Date) => {
    // Simulator doesn't use location for math yet
};

export const updateSimulatorSettings = (settings: SimulatorSettings) => {
    AstroSimulatorService.setSimulatorSettings(settings);
};

// Mock other functions for compatibility
export const updateDeviceSetting = (device: string, prop: string, values: any) => {
    console.log(`[AstroServiceSimulator] Updating ${device} ${prop}:`, values);
    const state = AstroSimulatorService.getState();
    const settings = { ...AstroSimulatorService.getSimulatorSettings() };

    if (device === 'Simulator Camera') {
        if (prop === 'CCD_INFO') {
            if (values.pixel_width !== undefined) settings.pixelWidth = parseFloat(values.pixel_width);
            if (values.pixel_height !== undefined) settings.pixelHeight = parseFloat(values.pixel_height);
            if (values.pixel_size !== undefined) settings.pixelSize = parseFloat(values.pixel_size);
        } else if (prop === 'TELESCOPE_INFO') {
            if (values.focal_length !== undefined) settings.focalLength = parseFloat(values.focal_length);
        } else if (prop === 'CCD_GAIN') {
            if (values.GAIN !== undefined) AstroSimulatorService.setCameraGain(parseFloat(values.GAIN));
        } else if (prop === 'CCD_OFFSET') {
            if (values.OFFSET !== undefined) AstroSimulatorService.setCameraOffset(parseFloat(values.OFFSET));
        } else if (prop === 'CCD_BINNING') {
            // Binning is not strictly simulated in Aladin URL but we can store it
            console.log("[Simulator] Binning set to:", values);
        }
    } else if (device === 'Simulator Mount') {
        if (prop === 'TELESCOPE_TRACK_STATE') {
            if (values.TRACK_ON !== undefined) setTracking(values.TRACK_ON === 'On' || values.TRACK_ON === true);
            if (values.TRACK_OFF !== undefined) setTracking(!(values.TRACK_OFF === 'On' || values.TRACK_OFF === true));
        } else if (prop === 'TELESCOPE_PARK') {
            if (values.PARK !== undefined) setPark(values.PARK === 'On' || values.PARK === true);
            if (values.UNPARK !== undefined) setPark(!(values.UNPARK === 'On' || values.UNPARK === true));
        } else if (prop === 'TELESCOPE_MOTION_NS') {
            if (values.NORTH !== undefined) values.NORTH === 'On' ? startMotion('N', 'Slew') : stopMotion('N');
            if (values.SOUTH !== undefined) values.SOUTH === 'On' ? startMotion('S', 'Slew') : stopMotion('S');
        } else if (prop === 'TELESCOPE_MOTION_WE') {
            if (values.WEST !== undefined) values.WEST === 'On' ? startMotion('W', 'Slew') : stopMotion('W');
            if (values.EAST !== undefined) values.EAST === 'On' ? startMotion('E', 'Slew') : stopMotion('E');
        } else if (prop === 'EQUATORIAL_EOD_COORDS') {
            if (values.RA !== undefined && values.DEC !== undefined) {
                AstroSimulatorService.slewTo(parseFloat(values.RA) * 15, parseFloat(values.DEC));
            }
        }
    } else if (device === 'Simulator Focuser') {
        if (prop === 'ABS_FOCUS_POS') {
            if (values.focus_pos) moveFocuser(parseFloat(values.focus_pos) - state.focuser.position);
        }
    }

    AstroSimulatorService.setSimulatorSettings(settings);
};

export const getActiveCamera = () => 'Simulator Camera';
export const getActiveFocuser = () => 'Simulator Focuser';

export const getDeviceProperties = (device: string): INDIVector[] => {
    const state = AstroSimulatorService.getState();
    const settings = AstroSimulatorService.getSimulatorSettings();

    if (device === 'Simulator Camera') {
        return [
            {
                device: 'Simulator Camera',
                name: 'CONNECTION',
                label: 'Connection',
                group: 'Main',
                state: 'Ok',
                perm: 'rw',
                type: 'Switch',
                rule: 'OneOfMany',
                elements: new Map([
                    ['CONNECT', { name: 'CONNECT', label: 'Connect', value: state.camera.connected }],
                    ['DISCONNECT', { name: 'DISCONNECT', label: 'Disconnect', value: !state.camera.connected }]
                ])
            },
            {
                device: 'Simulator Camera',
                name: 'CCD_EXPOSURE',
                label: 'Exposure',
                group: 'Main',
                state: state.camera.isExposing ? 'Busy' : 'Idle',
                perm: 'rw',
                type: 'Number',
                elements: new Map([
                    ['CCD_EXPOSURE_VALUE', { name: 'CCD_EXPOSURE_VALUE', label: 'Seconds', value: state.camera.exposureTime }]
                ])
            },
            {
                device: 'Simulator Camera',
                name: 'CCD_INFO',
                label: 'CCD Info',
                group: 'Settings',
                state: 'Ok',
                perm: 'rw',
                type: 'Number',
                elements: new Map([
                    ['pixel_width', { name: 'pixel_width', label: 'Width', value: settings.pixelWidth }],
                    ['pixel_height', { name: 'pixel_height', label: 'Height', value: settings.pixelHeight }],
                    ['pixel_size', { name: 'pixel_size', label: 'Pixel Size', value: settings.pixelSize }]
                ])
            },
            {
                device: 'Simulator Camera',
                name: 'CCD_GAIN',
                label: 'Gain',
                group: 'Main',
                state: 'Ok',
                perm: 'rw',
                type: 'Number',
                elements: new Map([
                    ['GAIN', { name: 'GAIN', label: 'Gain', value: state.camera.gain, min: 0, max: 500, step: 1 }]
                ])
            },
            {
                device: 'Simulator Camera',
                name: 'CCD_OFFSET',
                label: 'Offset',
                group: 'Main',
                state: 'Ok',
                perm: 'rw',
                type: 'Number',
                elements: new Map([
                    ['OFFSET', { name: 'OFFSET', label: 'Offset', value: state.camera.offset, min: 0, max: 255, step: 1 }]
                ])
            },
            {
                device: 'Simulator Camera',
                name: 'CCD_BINNING',
                label: 'Binning',
                group: 'Main',
                state: 'Ok',
                perm: 'rw',
                type: 'Number',
                elements: new Map([
                    ['HOR_BIN', { name: 'HOR_BIN', label: 'Horizontal Binning', value: 1, min: 1, max: 4, step: 1 }],
                    ['VER_BIN', { name: 'VER_BIN', label: 'Vertical Binning', value: 1, min: 1, max: 4, step: 1 }]
                ])
            },
            {
                device: 'Simulator Camera',
                name: 'TELESCOPE_INFO',
                label: 'Telescope Info',
                group: 'Settings',
                state: 'Ok',
                perm: 'rw',
                type: 'Number',
                elements: new Map([
                    ['focal_length', { name: 'focal_length', label: 'Focal Length', value: settings.focalLength }]
                ])
            }
        ];
    } else if (device === 'Simulator Mount') {
        return [
            {
                device: 'Simulator Mount',
                name: 'CONNECTION',
                label: 'Connection',
                group: 'Main',
                state: 'Ok',
                perm: 'rw',
                type: 'Switch',
                rule: 'OneOfMany',
                elements: new Map([
                    ['CONNECT', { name: 'CONNECT', label: 'Connect', value: state.mount.connected }],
                    ['DISCONNECT', { name: 'DISCONNECT', label: 'Disconnect', value: !state.mount.connected }]
                ])
            },
            {
                device: 'Simulator Mount',
                name: 'EQUATORIAL_EOD_COORDS',
                label: 'Coordinates',
                group: 'Main',
                state: state.mount.isSlewing ? 'Busy' : 'Ok',
                perm: 'rw',
                type: 'Number',
                elements: new Map([
                    ['RA', { name: 'RA', label: 'RA', value: state.mount.ra / 15 }],
                    ['DEC', { name: 'DEC', label: 'Dec', value: state.mount.dec }]
                ])
            },
            {
                device: 'Simulator Mount',
                name: 'TELESCOPE_TRACK_STATE',
                label: 'Tracking',
                group: 'Main',
                state: 'Ok',
                perm: 'rw',
                type: 'Switch',
                rule: 'OneOfMany',
                elements: new Map([
                    ['TRACK_ON', { name: 'TRACK_ON', label: 'On', value: state.mount.isTracking }],
                    ['TRACK_OFF', { name: 'TRACK_OFF', label: 'Off', value: !state.mount.isTracking }]
                ])
            },
            {
                device: 'Simulator Mount',
                name: 'TELESCOPE_PARK',
                label: 'Park',
                group: 'Main',
                state: 'Ok',
                perm: 'rw',
                type: 'Switch',
                rule: 'OneOfMany',
                elements: new Map([
                    ['PARK', { name: 'PARK', label: 'Park', value: state.mount.isParked }],
                    ['UNPARK', { name: 'UNPARK', label: 'Unpark', value: !state.mount.isParked }]
                ])
            },
            {
                device: 'Simulator Mount',
                name: 'TELESCOPE_MOTION_NS',
                label: 'Motion N/S',
                group: 'Main',
                state: 'Ok',
                perm: 'rw',
                type: 'Switch',
                rule: 'AtMostOne',
                elements: new Map([
                    ['NORTH', { name: 'NORTH', label: 'North', value: false }],
                    ['SOUTH', { name: 'SOUTH', label: 'South', value: false }]
                ])
            },
            {
                device: 'Simulator Mount',
                name: 'TELESCOPE_MOTION_WE',
                label: 'Motion W/E',
                group: 'Main',
                state: 'Ok',
                perm: 'rw',
                type: 'Switch',
                rule: 'AtMostOne',
                elements: new Map([
                    ['WEST', { name: 'WEST', label: 'West', value: false }],
                    ['EAST', { name: 'EAST', label: 'East', value: false }]
                ])
            }
        ];
    } else if (device === 'Simulator Focuser') {
        return [
            {
                device: 'Simulator Focuser',
                name: 'CONNECTION',
                label: 'Connection',
                group: 'Main',
                state: 'Ok',
                perm: 'rw',
                type: 'Switch',
                rule: 'OneOfMany',
                elements: new Map([
                    ['CONNECT', { name: 'CONNECT', label: 'Connect', value: state.focuser.connected }],
                    ['DISCONNECT', { name: 'DISCONNECT', label: 'Disconnect', value: !state.focuser.connected }]
                ])
            },
            {
                device: 'Simulator Focuser',
                name: 'ABS_FOCUS_POS',
                label: 'Position',
                group: 'Main',
                state: state.focuser.isMoving ? 'Busy' : 'Ok',
                perm: 'rw',
                type: 'Number',
                elements: new Map([
                    ['focus_pos', { name: 'focus_pos', label: 'Steps', value: state.focuser.position }]
                ])
            }
        ];
    }
    return [];
};

export const getNumericValue = (device: string, prop: string, elem: string) => {
    const props = getDeviceProperties(device);
    const vector = props.find(p => p.name === prop);
    if (vector) {
        const element = vector.elements.get(elem);
        if (element) return element.value as number;
    }
    return 0;
};

export const connectDevice = (name: string) => {
    if (name === 'Simulator Camera') AstroSimulatorService.connectCamera();
    if (name === 'Simulator Mount') AstroSimulatorService.connectMount();
    if (name === 'Simulator Focuser') AstroSimulatorService.connectFocuser();
};

export const disconnectDevice = (name: string) => {
    if (name === 'Simulator Camera') AstroSimulatorService.disconnectCamera();
    if (name === 'Simulator Mount') AstroSimulatorService.disconnectMount();
    if (name === 'Simulator Focuser') AstroSimulatorService.disconnectFocuser();
};

export const refreshDevices = () => {};
export const moveFocuser = (steps: number) => AstroSimulatorService.moveFocuser(steps);
export const reprocessRawFITS = (fmt: string) => {};
export const rawFitsToDisplay = (data: any, fmt: string, debayer: string) => ({ url: '', headers: null });

export const getPropertyValue = (device: string, prop: string, element: string): any => {
    const props = getDeviceProperties(device);
    const p = props.find(x => x.name === prop);
    if (p && p.elements) {
        return p.elements.get(element)?.value;
    }
    return undefined;
};

export const getSwitchValue = (device: string, prop: string, element: string): boolean => {
    const val = getPropertyValue(device, prop, element);
    return val === true || val === 'On';
};

export const getDevices = (): INDIDevice[] => {
    const state = AstroSimulatorService.getState();
    return [
        { name: 'Simulator Camera', connected: state.camera.connected, type: 'Camera', properties: new Map() },
        { name: 'Simulator Mount', connected: state.mount.connected, type: 'Mount', properties: new Map() },
        { name: 'Simulator Focuser', connected: state.focuser.connected, type: 'Focuser', properties: new Map() }
    ];
};

export const getCameraParams = () => {
    const settings = AstroSimulatorService.getSimulatorSettings();
    return {
        pixelWidth: settings.pixelWidth,
        pixelHeight: settings.pixelHeight,
        pixelSize: settings.pixelSize,
        focalLength: settings.focalLength
    };
};
export const sendRaw = (xml: string) => {};
export const diagnoseConnection = async (host: string, port: number, driver: string) => ({ status: 'ok' });
export const getDebugLogs = () => [];

// Compatibility aliases
export const connectIndiDevice = connectDevice;
export const disconnectIndiDevice = disconnectDevice;
export const refreshIndiDevices = refreshDevices;
export const getIndiDevices = getDevices;
