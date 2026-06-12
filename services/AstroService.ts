
import { CelestialObject, MountSpeed, LocationData, TelescopePosition, INDIDevice, INDIVector } from '../types';
import * as Indi from './AstroServiceIndi';
import * as Alpaca from './AstroServiceAlpaca';
import * as Simulator from './AstroServiceSimulator';
import { loadSettings } from './SettingsService';

import * as sampService from './sampService';

const getService = () => {
    const driver = loadSettings().connectionSettings.driver;
    if (driver === 'Alpaca') return Alpaca;
    if (driver === 'Simulator') return Simulator;
    return Indi;
};

// --- Callbacks ---
// These need special handling because they are set once but the service might change
export const setImageReceivedCallback = (cb: any) => {
    Indi.setImageReceivedCallback(cb);
    Alpaca.setImageReceivedCallback(cb);
    Simulator.setImageReceivedCallback(cb);
};

export const setTelescopePositionCallback = (cb: any) => {
    Indi.setTelescopePositionCallback(cb);
    Alpaca.setTelescopePositionCallback(cb);
    Simulator.setTelescopePositionCallback(cb);
};

export const setSampSkyCoordReceivedCallback = (cb: any) => {
    sampService.setSkyCoordCallback(cb);
};

export const setLogCallback = (cb: any) => {
    Indi.setLogCallback(cb);
    Alpaca.setLogCallback(cb);
    Simulator.setLogCallback(cb);
};

export const setDeviceCallback = (cb: any) => {
    Indi.setIndiDeviceCallback(cb);
    Alpaca.setDeviceCallback(cb);
    Simulator.setDeviceCallback(cb);
};

export const setMessageCountCallback = (cb: any) => {
    Indi.setIndiMessageCountCallback(cb);
    Alpaca.setMessageCountCallback(cb);
    Simulator.setMessageCountCallback(cb);
};

// Aliases for compatibility
export const setIndiDeviceCallback = setDeviceCallback;
export const setIndiMessageCountCallback = setMessageCountCallback;

export const setFocuserUpdateCallback = (cb: any) => {
    Indi.setFocuserUpdateCallback(cb);
    Alpaca.setFocuserUpdateCallback(cb);
    Simulator.setFocuserUpdateCallback(cb);
};

export const setMountLocationCallback = (cb: any) => {
    Indi.setMountLocationCallback(cb);
    Alpaca.setMountLocationCallback(cb);
    Simulator.setMountLocationCallback(cb);
};

export const setMountTimeCallback = (cb: any) => {
    Indi.setMountTimeCallback(cb);
    Alpaca.setMountTimeCallback(cb);
    Simulator.setMountTimeCallback(cb);
};

// --- Core Functions ---
export const connect = (settings: any) => getService().connect(settings);
export const disconnect = () => getService().disconnect();
export const slewTo = (obj: CelestialObject) => getService().slewTo(obj);
export const syncTo = (obj: CelestialObject) => getService().syncTo(obj);
export const syncToCoordinates = (ra: number, dec: number) => getService().syncToCoordinates(ra, dec);
export const getTelescopePosition = () => getService().getTelescopePosition();
export const startMotion = (dir: string, speed: MountSpeed) => getService().startMotion(dir, speed);
export const stopMotion = (dir: string) => getService().stopMotion(dir);
export const setTracking = (enabled: boolean) => getService().setTracking(enabled);
export const setPark = (parked: boolean) => getService().setPark(parked);
export const updateGain = (gain: number) => getService().updateGain(gain);
export const updateOffset = (offset: number) => getService().updateOffset(offset);
export const capturePreview = (exp: number, gain: number, offset: number, isStream: boolean = false) => getService().capturePreview(exp, gain, offset, isStream);
export const startCapture = (exp: number, gain: number, offset: number, colorBalance: any, cb: (c:number)=>void, done: ()=>void) => getService().startCapture(exp, gain, offset, colorBalance, cb, done);
export const stopCapture = () => getService().stopCapture();
export const startLoop = (exp: number, gain: number, offset: number) => (getService() as any).startLoop(exp, gain, offset);
export const stopLoop = () => (getService() as any).stopLoop();
export const stopAllImaging = () => {
    const s = getService();
    if ('stopAllImaging' in s) (s as any).stopAllImaging();
    else s.stopCapture();
};
export const startStream = (exp?: number, gain?: number, offset?: number) => {
    const s = getService();
    if ('startStream' in s) (s as any).startStream(exp, gain, offset);
    else if ('setVideoStream' in s) (s as any).setVideoStream(true);
};
export const stopStream = () => {
    const s = getService();
    if ('stopStream' in s) (s as any).stopStream();
    else if ('setVideoStream' in s) (s as any).setVideoStream(false);
};
export const setVideoStream = (enabled: boolean) => getService().setVideoStream(enabled);
export const abortSlew = () => getService().abortSlew();
export const sendLocation = (loc: LocationData, time: Date) => getService().sendLocation(loc, time);
export const getActiveCamera = () => getService().getActiveCamera();
export const getActiveFocuser = () => getService().getActiveFocuser();
export const getDeviceProperties = (device: string) => getService().getDeviceProperties(device);
export const getNumericValue = (device: string, prop: string, elem: string) => getService().getNumericValue(device, prop, elem);
export const connectDevice = (name: string) => (getService() as any).connectDevice(name);
export const disconnectDevice = (name: string) => (getService() as any).disconnectDevice(name);
export const refreshDevices = () => (getService() as any).refreshDevices();
export const moveFocuser = (steps: number) => (getService() as any).moveFocuser(steps);
export const reprocessRawFITS = (fmt: string) => (getService() as any).reprocessRawFITS(fmt);
export const getDevices = () => (getService() as any).getDevices();
export const getCameraParams = () => (getService() as any).getCameraParams();
export const syncSkyCoord = (ra: number, dec: number) => (getService() as any).syncSkyCoord(ra, dec);
export const sendRaw = (xml: string) => {
    const s = getService();
    if ('sendRaw' in s) (s as any).sendRaw(xml);
};
export const diagnoseConnection = (host: string, port: number, driver: string) => getService().diagnoseConnection(host, port, driver);
export const getDebugLogs = () => getService().getDebugLogs();
export const updateDeviceSetting = (device: string, prop: string, valueOrElem: any, value?: any) => (getService() as any).updateDeviceSetting?.(device, prop, valueOrElem, value);
export const toggleVideoStreamEncoder = (enabledOrName: any) => (getService() as any).toggleVideoStreamEncoder?.(enabledOrName);
export const rawFitsToDisplay = (data: any, fmt: string, debayer?: string) => (getService() as any).rawFitsToDisplay?.(data, fmt, debayer);

export const startAutoConnect = (settings: any) => {
    // 永続化されたバックグラウンドWebSocketチャンネルの常時待機を呼び出します
    const s = getService();
    if (s && 'startAutoConnect' in s) {
        (s as any).startAutoConnect(settings);
    }
};

export const stopAutoConnect = () => {
    // チャンネルを意図的に維持しつつ自動追従追跡のみをサスペンドします
    const s = getService();
    if (s && 'stopAutoConnect' in s) {
        (s as any).stopAutoConnect();
    }
};

// Compatibility aliases
export const connectIndiDevice = connectDevice;
export const disconnectIndiDevice = disconnectDevice;
export const refreshIndiDevices = refreshDevices;
export const getIndiDevices = getDevices;
