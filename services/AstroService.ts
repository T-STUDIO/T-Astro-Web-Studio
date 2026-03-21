
import { CelestialObject, MountSpeed, LocationData, TelescopePosition } from '../types';
import { hmsToDegrees, dmsToDegrees } from '../utils/coords';
import * as DriverConnection from './DriverConnection';
import { BlobTransportService } from './BlobTransportService';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const setAppData = (loc: LocationData | null, time: Date | null) => {
    if (loc) {
        const mock = DriverConnection.getSimulatorMock();
        if (mock && mock.connected) {
            mock.setLocation(loc.latitude, loc.longitude, loc.elevation || 0);
        }
    }
};

// --- Re-exports for App Compatibility ---
export { 
    diagnoseConnection, 
    setLogCallback, getDebugLogs,
    setImageReceivedCallback, setTelescopePositionCallback, setIndiDeviceCallback, setIndiMessageCountCallback, setFocuserUpdateCallback, setMountLocationCallback, setMountTimeCallback,
    updateDeviceSetting, getActiveCamera, getActiveFocuser, getDeviceProperties, getNumericValue, connectIndiDevice, disconnectIndiDevice, refreshIndiDevices, moveFocuser, reprocessRawFITS, rawFitsToDisplay,
    getIndiDevices, getActiveCameraParams as getCameraParams,
    sendRaw
} from './DriverConnection';

/**
 * 接続ロジックを拡張：メインチャネルとBLOBチャネルを分離して接続します。
 */
export const connect = async (settings: any): Promise<boolean> => {
    // INDIの場合のみ分離転送を予約
    if (settings.driver === 'INDI') {
        DriverConnection.setMainChannelBlobDisabled(true);
    }
    
    // メイン制御チャネルの接続
    const success = await DriverConnection.connect(settings);
    
    // INDIの場合、画像転送用の別チャネルを並列で立ち上げ
    if (success && settings.driver === 'INDI') {
        BlobTransportService.getInstance().connect(settings).catch(err => {
            console.error("[BLOB] Failed to connect secondary channel", err);
        });
    }
    
    return success;
};

/**
 * 切断ロジックを拡張：両方の接続をクローズします。
 */
export const disconnect = async () => {
    BlobTransportService.getInstance().disconnect();
    await DriverConnection.disconnect();
};

// Helper to wait for camera idle
export const waitForCameraIdle = async (timeoutMs: number = 30000): Promise<boolean> => {
    const cam = DriverConnection.getActiveCamera();
    if (!cam) return true; // No camera, assume idle
    
    // Check property existence first
    if (!DriverConnection.hasProperty(cam, 'CCD_EXPOSURE')) return true;

    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        const props = DriverConnection.getDeviceProperties(cam);
        const expProp = props.find(p => p.name === 'CCD_EXPOSURE');
        
        // If state is Idle or Ok, we are ready. If Busy, we wait.
        if (expProp && (expProp.state === 'Idle' || expProp.state === 'Ok')) {
            return true;
        }
        await sleep(200);
    }
    console.warn("Timeout waiting for camera idle state.");
    return false;
};

// 1. Slew (GoTo)
export const slewTo = async (obj: CelestialObject) => {
    const mount = DriverConnection.getActiveMount();
    const settings = DriverConnection.getSimulatorMock(); 
    
    if (!mount) {
        if (settings.connected) {
             settings.sync(hmsToDegrees(obj.ra), dmsToDegrees(obj.dec));
             return;
        }
        console.warn("Cannot slew: No mount connected");
        return;
    }

    const ra = hmsToDegrees(obj.ra);
    const dec = dmsToDegrees(obj.dec);
    
    DriverConnection.sendRaw(`<newSwitchVector device='${mount}' name='ON_COORD_SET'><oneSwitch name='SLEW'>On</oneSwitch></newSwitchVector>`);
    DriverConnection.sendRaw(`<newSwitchVector device='${mount}' name='TELESCOPE_TRACK_STATE'><oneSwitch name='TRACK_ON'>On</oneSwitch></newSwitchVector>`);
    DriverConnection.sendRaw(`<newNumberVector device='${mount}' name='EQUATORIAL_EOD_COORD'><oneNumber name='RA'>${ra/15}</oneNumber><oneNumber name='DEC'>${dec}</oneNumber></newNumberVector>`);
};

// 2. Sync (Object)
export const syncTo = async (obj: CelestialObject) => {
    const mount = DriverConnection.getActiveMount();
    if (!mount) return;
    const ra = hmsToDegrees(obj.ra);
    const dec = dmsToDegrees(obj.dec);
    
    DriverConnection.sendRaw(`<newSwitchVector device='${mount}' name='ON_COORD_SET'><oneSwitch name='SYNC'>On</oneSwitch></newSwitchVector>`);
    DriverConnection.sendRaw(`<newNumberVector device='${mount}' name='EQUATORIAL_EOD_COORD'><oneNumber name='RA'>${ra/15}</oneNumber><oneNumber name='DEC'>${dec}</oneNumber></newNumberVector>`);
};

// 2b. Sync (Coordinates) - for Auto Center
export const syncToCoordinates = async (ra: number, dec: number) => {
    const mount = DriverConnection.getActiveMount();
    if (!mount) return;
    DriverConnection.sendRaw(`<newSwitchVector device='${mount}' name='ON_COORD_SET'><oneSwitch name='SYNC'>On</oneSwitch></newSwitchVector>`);
    DriverConnection.sendRaw(`<newNumberVector device='${mount}' name='EQUATORIAL_EOD_COORD'><oneNumber name='RA'>${ra/15}</oneNumber><oneNumber name='DEC'>${dec}</oneNumber></newNumberVector>`);
};

// Helper: Get Current Telescope Coordinates (Instant)
export const getTelescopePosition = (): TelescopePosition | null => {
    const mount = DriverConnection.getActiveMount();
    if (!mount) {
        const sim = DriverConnection.getSimulatorMock();
        if (sim.connected) {
            return null; 
        }
        return null;
    }
    const raVal = DriverConnection.getNumericValue(mount, 'EQUATORIAL_EOD_COORD', 'RA');
    const decVal = DriverConnection.getNumericValue(mount, 'EQUATORIAL_EOD_COORD', 'DEC');
    
    if (raVal !== null && decVal !== null) {
        return { ra: raVal * 15, dec: decVal };
    }
    return null;
};

// 3. Motion Control
export const startMotion = (dir: string, speed: MountSpeed) => {
    const mount = DriverConnection.getActiveMount();
    if (!mount) return;
    const axis = (dir === 'N' || dir === 'S') ? 'NS' : 'WE';
    const sw = dir === 'N' ? 'MOTION_NORTH' : dir === 'S' ? 'MOTION_SOUTH' : dir === 'W' ? 'MOTION_WEST' : 'MOTION_EAST';
    DriverConnection.sendRaw(`<newSwitchVector device='${mount}' name='TELESCOPE_MOTION_${axis}'><oneSwitch name='${sw}'>On</oneSwitch></newSwitchVector>`);
};

export const stopMotion = (dir: string) => {
    const mount = DriverConnection.getActiveMount();
    if (!mount) return;
    const axis = (dir === 'N' || dir === 'S') ? 'NS' : 'WE';
    const sw = dir === 'N' ? 'MOTION_NORTH' : dir === 'S' ? 'MOTION_SOUTH' : dir === 'W' ? 'MOTION_WEST' : 'MOTION_EAST';
    DriverConnection.sendRaw(`<newSwitchVector device='${mount}' name='TELESCOPE_MOTION_${axis}'><oneSwitch name='${sw}'>Off</oneSwitch></newSwitchVector>`);
};

export const setTracking = (enabled: boolean) => {
    const mount = DriverConnection.getActiveMount();
    if (mount) DriverConnection.sendRaw(`<newSwitchVector device='${mount}' name='TELESCOPE_TRACK_STATE'><oneSwitch name='${enabled ? 'TRACK_ON' : 'TRACK_OFF'}'>On</oneSwitch></newSwitchVector>`);
};

export const setPark = (parked: boolean) => {
    const mount = DriverConnection.getActiveMount();
    if (mount) DriverConnection.sendRaw(`<newSwitchVector device='${mount}' name='TELESCOPE_PARK'><oneSwitch name='${parked ? 'PARK' : 'UNPARK'}'>On</oneSwitch></newSwitchVector>`);
};

// 4. Capture
const fetchAladinImage = async (ra: number, dec: number): Promise<string> => {
    const images = [
        'https://images.unsplash.com/photo-1627003489379-3388a1f8b656?q=80&w=2560&auto=format&fit=crop',
    ];
    await new Promise(resolve => setTimeout(resolve, 500));
    return images[0];
};

export const capturePreview = async (exp: number, gain: number, offset: number, isStream: boolean = false) => {
    const cam = DriverConnection.getActiveCamera();
    if (!cam) {
         const mock = DriverConnection.getSimulatorMock();
         if (mock.connected) {
             const url = await fetchAladinImage(0, 0);
             DriverConnection.triggerImageUpdate(url, 'image/jpeg');
         }
         return;
    }
    
    if (!isStream) {
        await setVideoStream(false);
        await waitForCameraIdle(5000);
    }

    if (DriverConnection.hasProperty(cam, 'CCD_VIDEO_STREAM')) {
         const isStreamOn = DriverConnection.getSwitchValue(cam, 'CCD_VIDEO_STREAM', 'STREAM_ON');
         if (isStreamOn) {
             DriverConnection.updateDeviceSetting(cam, 'CCD_VIDEO_STREAM', { 'STREAM_OFF': true });
             if (!isStream) await sleep(200); 
         }
    }

    if (DriverConnection.hasProperty(cam, 'CCD_COMPRESSION')) {
         const isCompressed = DriverConnection.getSwitchValue(cam, 'CCD_COMPRESSION', 'CCD_COMPRESS');
         if (!isCompressed) {
             DriverConnection.updateDeviceSetting(cam, 'CCD_COMPRESSION', { 'CCD_COMPRESS': true });
             await sleep(500); 
         }
    }

    const currentGain = DriverConnection.getNumericValue(cam, 'CCD_GAIN', 'GAIN');
    if (currentGain !== null && currentGain !== gain) {
        DriverConnection.updateDeviceSetting(cam, 'CCD_GAIN', {'GAIN': gain});
    }

    const currentOffset = DriverConnection.getNumericValue(cam, 'CCD_OFFSET', 'OFFSET');
    if (currentOffset !== null && currentOffset !== offset) {
        DriverConnection.updateDeviceSetting(cam, 'CCD_OFFSET', {'OFFSET': offset});
    }
    
    DriverConnection.sendRaw(`<newNumberVector device='${cam}' name='CCD_EXPOSURE'><oneNumber name='CCD_EXPOSURE_VALUE'>${exp/1000}</oneNumber></newNumberVector>`);
};

export const startCapture = async (exp: number, gain: number, offset: number, colorBalance: any, cb: (c:number)=>void, done: ()=>void) => {
    let count = 0;
    await waitForCameraIdle(5000);

    const loop = async () => {
        if(count >= 10) { done(); return; }
        
        const isReady = await waitForCameraIdle(30000); 
        if (!isReady) {
            done();
            return;
        }

        await capturePreview(exp, gain, offset, true);
        await sleep(exp + 200); 
        const downloadDone = await waitForCameraIdle(30000); 
        
        if (!downloadDone) {
             console.warn("Frame download timed out...");
        } else {
             count++;
             cb(count);
        }

        setTimeout(loop, 100); 
    };
    loop();
};

export const stopCapture = () => {
    const cam = DriverConnection.getActiveCamera();
    if (cam) DriverConnection.sendRaw(`<newSwitchVector device='${cam}' name='CCD_ABORT_EXPOSURE'><oneSwitch name='ABORT'>On</oneSwitch></newSwitchVector>`);
    setTimeout(() => DriverConnection.clearBuffer(), 100); 
};

let isLooping = false;
let loopTimeout: ReturnType<typeof setTimeout> | null = null;

export const startLoop = (exp: number, gain: number, offset: number) => {
    const cam = DriverConnection.getActiveCamera();
    if (cam) {
        // Ensure Video Stream is OFF when starting LOOP
        setVideoStream(false);
        
        isLooping = true;
        if (DriverConnection.hasProperty(cam, 'CCD_COMPRESSION')) {
             const isCompressed = DriverConnection.getSwitchValue(cam, 'CCD_COMPRESSION', 'CCD_COMPRESS');
             if (!isCompressed) {
                 DriverConnection.updateDeviceSetting(cam, 'CCD_COMPRESSION', { 'CCD_COMPRESS': true });
             }
        }

        const loop = async () => {
            if (!isLooping) return;
            const ready = await waitForCameraIdle(5000);
            if (ready) {
                try {
                    // Use actual parameters instead of hardcoded 200, 300, 0
                    await capturePreview(exp, gain, offset, true); 
                } catch (e) {
                    console.error("[AstroService] Loop capture error:", e);
                }
            }
            if (isLooping) {
                loopTimeout = setTimeout(loop, 500); 
            }
        };
        loop();
    }
};

export const stopLoop = () => {
    isLooping = false;
    if (loopTimeout) {
        clearTimeout(loopTimeout);
        loopTimeout = null;
    }
    stopCapture();
    setTimeout(() => DriverConnection.clearBuffer(), 100); 
};

export const setVideoStream = async (enabled: boolean) => {
    const cam = DriverConnection.getActiveCamera();
    if (cam) {
        DriverConnection.refreshIndiDevices();
        if (enabled) {
             // Ensure LOOP is OFF when starting Video Stream
             stopLoop();
             
             DriverConnection.sendRaw(`<enableBLOB device='${cam}'>Also</enableBLOB>`);
             if (DriverConnection.hasProperty(cam, 'CCD_COMPRESSION')) {
                 const isCompressed = DriverConnection.getSwitchValue(cam, 'CCD_COMPRESSION', 'CCD_COMPRESS');
                 if (!isCompressed) {
                     DriverConnection.updateDeviceSetting(cam, 'CCD_COMPRESSION', { 'CCD_COMPRESS': true });
                 }
             }
        }
        await sleep(100); 
        DriverConnection.updateDeviceSetting(cam, 'CCD_VIDEO_STREAM', { 'STREAM_ON': enabled, 'STREAM_OFF': !enabled });
        if (!enabled) {
             await sleep(500);
             DriverConnection.clearBuffer();
        } else {
             await sleep(500);
        }
    }
};

export const toggleVideoStreamEncoder = async (encoderName: string) => {
    const cam = DriverConnection.getActiveCamera();
    if (!cam) return;
    DriverConnection.updateDeviceSetting(cam, 'CCD_STREAM_ENCODER', { [encoderName]: true });
    await sleep(200);
};

export const abortSlew = () => {
    const mount = DriverConnection.getActiveMount();
    if (mount) DriverConnection.sendRaw(`<newSwitchVector device='${mount}' name='TELESCOPE_ABORT_MOTION'><oneSwitch name='ABORT'>On</oneSwitch></newSwitchVector>`);
};

export const sendLocation = (loc: LocationData, time: Date) => {
    const mock = DriverConnection.getSimulatorMock();
    if (mock.connected) {
        mock.setLocation(loc.latitude, loc.longitude, loc.elevation || 0);
    }

    const geoDevices = DriverConnection.getDevicesWithProperty('GEOGRAPHIC_COORD');
    geoDevices.forEach(device => {
        let xml = `<newNumberVector device='${device}' name='GEOGRAPHIC_COORD'>`;
        xml += `<oneNumber name='LAT'>${loc.latitude}</oneNumber>`;
        xml += `<oneNumber name='LONG'>${loc.longitude}</oneNumber>`;
        xml += `<oneNumber name='ELEV'>${loc.elevation || 0}</oneNumber>`;
        xml += `</newNumberVector>`;
        DriverConnection.sendRaw(xml);
    });

    setTimeout(() => {
        const pad = (n: number) => n.toString().padStart(2, '0');
        const y = time.getUTCFullYear();
        const m = pad(time.getUTCMonth() + 1);
        const d = pad(time.getUTCDate());
        const h = pad(time.getUTCHours());
        const min = pad(time.getUTCMinutes());
        const s = pad(time.getUTCSeconds());
        
        const utcStr = `${y}-${m}-${d}T${h}:${min}:${s}`;
        const offset = -time.getTimezoneOffset() / 60;
        const offsetStr = offset.toFixed(2);
        
        const timeDevices = DriverConnection.getDevicesWithProperty('TIME_UTC');
        
        timeDevices.forEach(device => {
            const timeXml = `<newTextVector device='${device}' name='TIME_UTC'>` + 
                            `<oneText name='UTC'>${utcStr}</oneText>` + 
                            `<oneText name='OFFSET'>${offsetStr}</oneText>` + 
                            `</newTextVector>`;
            DriverConnection.sendRaw(timeXml);
            DriverConnection.injectIndiValue(device, 'TIME_UTC', 'UTC', utcStr);
            DriverConnection.injectIndiValue(device, 'TIME_UTC', 'OFFSET', offsetStr);
        });
    }, 1000);
};

export interface FitsConversionResult {
    url: string | null;
    headers: Record<string, any>;
}

export const reprocessLastFITS = (fmt: string) => {
    DriverConnection.reprocessRawFITS(fmt);
};
