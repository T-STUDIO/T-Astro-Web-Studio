
import { INDIDevice, INDIVector, INDIElement, DeviceType } from '../types';
import { AstroSimulatorService, SimulatorState } from './AstroSimulatorService';

/**
 * AstroSimulatorAdapter
 * ROLE: Adapts the AstroSimulatorService state to the INDI-based internal structures.
 * This allows the UI to interact with the simulator as if it were a real INDI device.
 */

export class AstroSimulatorAdapter {
    private static instance: AstroSimulatorAdapter;
    private simulator = AstroSimulatorService.getInstance();

    public static getInstance() {
        if (!AstroSimulatorAdapter.instance) AstroSimulatorAdapter.instance = new AstroSimulatorAdapter();
        return AstroSimulatorAdapter.instance;
    }

    /**
     * Converts the current simulator state to an array of INDIDevice objects.
     */
    public getIndiDevices(): INDIDevice[] {
        const state = this.simulator.getState();
        const indiDevices: INDIDevice[] = [];

        // 1. Simulated Mount
        const mount: INDIDevice = {
            name: 'Simulator Mount',
            connected: state.mount.connected,
            type: 'Mount',
            properties: new Map<string, INDIVector>()
        };
        this.addMountProperties(mount, state);
        indiDevices.push(mount);

        // 2. Simulated Camera
        const camera: INDIDevice = {
            name: 'Simulator Camera',
            connected: state.camera.connected,
            type: 'Camera',
            properties: new Map<string, INDIVector>()
        };
        this.addCameraProperties(camera, state);
        indiDevices.push(camera);

        // 3. Simulated Focuser
        const focuser: INDIDevice = {
            name: 'Simulator Focuser',
            connected: state.focuser.connected,
            type: 'Focuser',
            properties: new Map<string, INDIVector>()
        };
        this.addFocuserProperties(focuser, state);
        indiDevices.push(focuser);

        return indiDevices;
    }

    private addMountProperties(dev: INDIDevice, state: SimulatorState) {
        // CONNECTION
        const conn: INDIVector = {
            device: dev.name, name: 'CONNECTION', label: 'Connection', group: 'Main',
            state: 'Idle', perm: 'rw', type: 'Switch', rule: 'OneOfMany',
            elements: new Map<string, INDIElement>()
        };
        conn.elements.set('CONNECT', { name: 'CONNECT', label: 'Connect', value: state.mount.connected });
        conn.elements.set('DISCONNECT', { name: 'DISCONNECT', label: 'Disconnect', value: !state.mount.connected });
        dev.properties.set('CONNECTION', conn);

        // EQUATORIAL_EOD_COORD
        const coord: INDIVector = {
            device: dev.name, name: 'EQUATORIAL_EOD_COORD', label: 'Coordinates', group: 'Main',
            state: state.mount.isSlewing ? 'Busy' : 'Ok', perm: 'rw', type: 'Number',
            elements: new Map<string, INDIElement>()
        };
        coord.elements.set('RA', { name: 'RA', label: 'RA', value: state.mount.ra / 15 });
        coord.elements.set('DEC', { name: 'DEC', label: 'DEC', value: state.mount.dec });
        dev.properties.set('EQUATORIAL_EOD_COORD', coord);

        // TELESCOPE_TRACK_STATE
        const track: INDIVector = {
            device: dev.name, name: 'TELESCOPE_TRACK_STATE', label: 'Tracking', group: 'Main',
            state: 'Ok', perm: 'rw', type: 'Switch', rule: 'OneOfMany',
            elements: new Map<string, INDIElement>()
        };
        track.elements.set('TRACK_ON', { name: 'TRACK_ON', label: 'On', value: state.mount.isTracking });
        track.elements.set('TRACK_OFF', { name: 'TRACK_OFF', label: 'Off', value: !state.mount.isTracking });
        dev.properties.set('TELESCOPE_TRACK_STATE', track);
    }

    private addCameraProperties(dev: INDIDevice, state: SimulatorState) {
        // CONNECTION
        const conn: INDIVector = {
            device: dev.name, name: 'CONNECTION', label: 'Connection', group: 'Main',
            state: 'Idle', perm: 'rw', type: 'Switch', rule: 'OneOfMany',
            elements: new Map<string, INDIElement>()
        };
        conn.elements.set('CONNECT', { name: 'CONNECT', label: 'Connect', value: state.camera.connected });
        conn.elements.set('DISCONNECT', { name: 'DISCONNECT', label: 'Disconnect', value: !state.camera.connected });
        dev.properties.set('CONNECTION', conn);

        // CCD_EXPOSURE
        const exp: INDIVector = {
            device: dev.name, name: 'CCD_EXPOSURE', label: 'Exposure', group: 'Main',
            state: state.camera.isExposing ? 'Busy' : 'Idle', perm: 'rw', type: 'Number',
            elements: new Map<string, INDIElement>()
        };
        exp.elements.set('CCD_EXPOSURE_VALUE', { name: 'CCD_EXPOSURE_VALUE', label: 'Duration', value: state.camera.exposureTime });
        dev.properties.set('CCD_EXPOSURE', exp);
    }

    private addFocuserProperties(dev: INDIDevice, state: SimulatorState) {
        // ABS_FOCUS_POSITION
        const pos: INDIVector = {
            device: dev.name, name: 'ABS_FOCUS_POSITION', label: 'Position', group: 'Main',
            state: state.focuser.isMoving ? 'Busy' : 'Ok', perm: 'rw', type: 'Number',
            elements: new Map<string, INDIElement>()
        };
        pos.elements.set('FOCUS_ABSOLUTE_POSITION', { name: 'FOCUS_ABSOLUTE_POSITION', label: 'Position', value: state.focuser.position });
        dev.properties.set('ABS_FOCUS_POSITION', pos);
    }
}

export default AstroSimulatorAdapter.getInstance();
