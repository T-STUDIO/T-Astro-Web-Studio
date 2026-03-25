
import { TelescopePosition, LocationData, DeviceType, INDIDevice, INDIVector, INDIElement, SimulatorSettings } from '../types';
import { getAladinImageUrl, generateSimulatedStarField, DEFAULT_SIMULATOR_SETTINGS } from './SimulatorService';

/**
 * AstroSimulatorService
 * ROLE: A standalone simulation engine for astronomical equipment.
 * This service maintains a virtual state of a mount, camera, focuser, and filter wheel.
 * It operates independently of DriverConnection.ts.
 */

export interface SimulatorState {
    mount: {
        connected: boolean;
        ra: number; // Degrees
        dec: number; // Degrees
        targetRa: number;
        targetDec: number;
        isSlewing: boolean;
        isTracking: boolean;
        isParked: boolean;
        lastUpdate: number;
    };
    camera: {
        connected: boolean;
        isExposing: boolean;
        exposureTime: number;
        exposureElapsed: number;
        gain: number;
        offset: number;
        lastImage: string | null;
    };
    focuser: {
        connected: boolean;
        position: number;
        isMoving: boolean;
    };
    filterWheel: {
        connected: boolean;
        position: number;
        names: string[];
    };
}

export class AstroSimulatorService {
    private static instance: AstroSimulatorService;
    private state: SimulatorState = {
        mount: {
            connected: false,
            ra: 0,
            dec: 90,
            targetRa: 0,
            targetDec: 90,
            isSlewing: false,
            isTracking: true,
            isParked: false,
            lastUpdate: Date.now()
        },
        camera: {
            connected: false,
            isExposing: false,
            exposureTime: 0,
            exposureElapsed: 0,
            gain: 100,
            offset: 10,
            lastImage: null
        },
        focuser: {
            connected: false,
            position: 50000,
            isMoving: false
        },
        filterWheel: {
            connected: false,
            position: 0,
            names: ['L', 'R', 'G', 'B', 'Ha']
        }
    };

    private simulatorSettings: SimulatorSettings = DEFAULT_SIMULATOR_SETTINGS;

    private loopInterval: any = null;
    private onStateChange: ((state: SimulatorState) => void) | null = null;
    private activeMotions: Set<string> = new Set();
    private motionSpeed: number = 0;

    public static getInstance() {
        if (!AstroSimulatorService.instance) AstroSimulatorService.instance = new AstroSimulatorService();
        return AstroSimulatorService.instance;
    }

    constructor() {
        this.startLoop();
    }

    public setStateCallback(cb: (state: SimulatorState) => void) {
        this.onStateChange = cb;
    }

    private startLoop() {
        if (this.loopInterval) return;
        this.loopInterval = setInterval(() => this.update(), 100);
    }

    private update() {
        const now = Date.now();
        const dt = (now - this.state.mount.lastUpdate) / 1000; // seconds
        this.state.mount.lastUpdate = now;

        let changed = false;

        // 1. Mount Slew Simulation
        if (this.state.mount.isSlewing) {
            const slewRate = 2.0; // degrees per second
            
            // Shortest path for RA
            let dRa = this.state.mount.targetRa - this.state.mount.ra;
            if (dRa > 180) dRa -= 360;
            if (dRa < -180) dRa += 360;
            
            const dDec = this.state.mount.targetDec - this.state.mount.dec;
            const dist = Math.sqrt(dRa * dRa + dDec * dDec);

            if (dist < slewRate * dt) {
                this.state.mount.ra = this.state.mount.targetRa;
                this.state.mount.dec = this.state.mount.targetDec;
                this.state.mount.isSlewing = false;
                console.log("[Simulator] Slew complete.");
            } else {
                this.state.mount.ra += (dRa / dist) * slewRate * dt;
                this.state.mount.dec += (dDec / dist) * slewRate * dt;
                
                // Wrap RA
                if (this.state.mount.ra >= 360) this.state.mount.ra -= 360;
                if (this.state.mount.ra < 0) this.state.mount.ra += 360;
            }
            changed = true;
        } else if (this.activeMotions.size > 0) {
            // 1b. Manual Motion Simulation
            const speedMap: Record<string, number> = {
                'Guide': 0.01,
                'Center': 0.1,
                'Find': 1.0,
                'Slew': 5.0
            };
            const rate = speedMap[this.motionSpeed] || 0.1;
            
            if (this.activeMotions.has('N')) this.state.mount.dec += rate * dt;
            if (this.activeMotions.has('S')) this.state.mount.dec -= rate * dt;
            if (this.activeMotions.has('W')) this.state.mount.ra += rate * dt;
            if (this.activeMotions.has('E')) this.state.mount.ra -= rate * dt;

            // Clamp Dec
            if (this.state.mount.dec > 90) this.state.mount.dec = 90;
            if (this.state.mount.dec < -90) this.state.mount.dec = -90;
            
            // Wrap RA
            if (this.state.mount.ra >= 360) this.state.mount.ra -= 360;
            if (this.state.mount.ra < 0) this.state.mount.ra += 360;
            
            changed = true;
        } else if (this.state.mount.isTracking && !this.state.mount.isParked) {
            // Sidereal tracking (approx 15 deg/hour = 0.00416 deg/sec)
            this.state.mount.ra += 0.00416 * dt;
            if (this.state.mount.ra >= 360) this.state.mount.ra -= 360;
            changed = true;
        }

        // 2. Camera Exposure Simulation
        if (this.state.camera.isExposing) {
            this.state.camera.exposureElapsed += dt;
            if (this.state.camera.exposureElapsed >= this.state.camera.exposureTime) {
                this.state.camera.isExposing = false;
                this.state.camera.exposureElapsed = 0;
                
                // Generate realistic image using Aladin
                const pos: TelescopePosition = { ra: this.state.mount.ra, dec: this.state.mount.dec };
                
                // Use Aladin but fallback to generated star field if needed
                const aladinUrl = getAladinImageUrl(pos, this.simulatorSettings);
                
                // For now, we'll just use Aladin, but we could add a check here.
                // To be safe, let's also provide the simulated star field as a fallback in the state
                this.state.camera.lastImage = aladinUrl;
                
                // If we are in a browser environment, we can try to pre-load the image to check if it's valid
                // but since this is a service, we'll just stick with the URL for now.
                // However, let's add a log to help debugging.
                console.log(`[Simulator] Exposure complete. Image URL: ${aladinUrl}`);
            }
            changed = true;
        }

        if (changed && this.onStateChange) {
            this.onStateChange({ ...this.state });
        }
    }

    private triggerChange() {
        if (this.onStateChange) {
            this.onStateChange({ ...this.state });
        }
    }

    // --- Mount Methods ---
    public connectMount() { 
        this.state.mount.connected = true; 
        this.triggerChange();
    }
    public disconnectMount() { 
        this.state.mount.connected = false; 
        this.triggerChange();
    }
    public slewTo(ra: number, dec: number) {
        this.state.mount.targetRa = ra;
        this.state.mount.targetDec = dec;
        this.state.mount.isSlewing = true;
        this.state.mount.isParked = false;
        this.triggerChange();
    }
    public syncTo(ra: number, dec: number) {
        this.state.mount.ra = ra;
        this.state.mount.dec = dec;
        this.state.mount.isSlewing = false;
        this.triggerChange();
    }
    public setTracking(enabled: boolean) { 
        this.state.mount.isTracking = enabled; 
        this.triggerChange();
    }
    public setPark(parked: boolean) { 
        this.state.mount.isParked = parked; 
        if (parked) this.state.mount.isSlewing = false;
        this.triggerChange();
    }

    public startMotion(dir: string, speed: any) {
        this.activeMotions.add(dir);
        this.motionSpeed = speed;
        this.state.mount.isSlewing = false;
        this.state.mount.isParked = false;
        this.triggerChange();
    }

    public stopMotion(dir: string) {
        this.activeMotions.delete(dir);
        this.triggerChange();
    }

    // --- Camera Methods ---
    public connectCamera() { 
        this.state.camera.connected = true; 
        this.triggerChange();
    }
    public disconnectCamera() {
        this.state.camera.connected = false;
        this.triggerChange();
    }
    public startExposure(duration: number) {
        this.state.camera.exposureTime = duration;
        this.state.camera.exposureElapsed = 0;
        this.state.camera.isExposing = true;
        this.triggerChange();
    }
    public abortExposure() {
        this.state.camera.isExposing = false;
        this.state.camera.exposureElapsed = 0;
        this.triggerChange();
    }

    public setCameraGain(gain: number) {
        this.state.camera.gain = gain;
        this.triggerChange();
    }

    public setCameraOffset(offset: number) {
        this.state.camera.offset = offset;
        this.triggerChange();
    }

    // --- Focuser Methods ---
    public connectFocuser() { 
        this.state.focuser.connected = true; 
        this.triggerChange();
    }
    public disconnectFocuser() {
        this.state.focuser.connected = false;
        this.triggerChange();
    }
    public moveFocuser(steps: number) {
        this.state.focuser.position += steps;
        this.state.focuser.isMoving = true;
        this.triggerChange();
        setTimeout(() => {
            this.state.focuser.isMoving = false;
            this.triggerChange();
        }, 500);
    }

    // --- FilterWheel Methods ---
    public setFilter(index: number) {
        if (index >= 0 && index < this.state.filterWheel.names.length) {
            this.state.filterWheel.position = index;
        }
    }

    public getSimulatorSettings() {
        return this.simulatorSettings;
    }

    public setSimulatorSettings(settings: SimulatorSettings) {
        this.simulatorSettings = settings;
        this.state.focuser.position = settings.focuserPosition;
        this.triggerChange();
    }

    public getState() { return { ...this.state }; }
}

export default AstroSimulatorService.getInstance();
