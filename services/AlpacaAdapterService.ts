
import { INDIDevice, INDIVector, INDIElement, DeviceType } from '../types';
import { AlpacaDevice, AlpacaClientService } from './AlpacaClientService';

/**
 * AlpacaAdapterService
 * ROLE: Adapts Alpaca device data to the application's INDI-based internal structures.
 * This allows the existing UI to display and control Alpaca devices as if they were INDI devices.
 */

export class AlpacaAdapterService {
    private static instance: AlpacaAdapterService;
    private alpacaClient = AlpacaClientService.getInstance();

    public static getInstance() {
        if (!AlpacaAdapterService.instance) AlpacaAdapterService.instance = new AlpacaAdapterService();
        return AlpacaAdapterService.instance;
    }

    /**
     * Converts an Alpaca device list to an array of INDIDevice objects.
     */
    public async convertToIndiDevices(alpacaDevices: AlpacaDevice[]): Promise<INDIDevice[]> {
        const indiDevices: INDIDevice[] = [];

        for (const dev of alpacaDevices) {
            const indiDev: INDIDevice = {
                name: dev.deviceName,
                connected: false, // Will be updated by polling
                type: this.mapAlpacaTypeToIndi(dev.deviceType),
                properties: new Map<string, INDIVector>()
            };

            // Fetch basic properties to populate the device
            await this.populateBasicProperties(indiDev, dev);
            indiDevices.push(indiDev);
        }

        return indiDevices;
    }

    private mapAlpacaTypeToIndi(alpacaType: string): DeviceType {
        switch (alpacaType.toLowerCase()) {
            case 'camera': return 'Camera';
            case 'telescope': return 'Mount';
            case 'focuser': return 'Focuser';
            case 'filterwheel': return 'FilterWheel';
            case 'dome': return 'Dome';
            case 'rotator': return 'Rotator';
            default: return 'Camera'; // Default fallback
        }
    }

    private async populateBasicProperties(indiDev: INDIDevice, alpacaDev: AlpacaDevice) {
        // Create a basic CONNECTION property
        const connectionVector: INDIVector = {
            device: indiDev.name,
            name: 'CONNECTION',
            label: 'Connection',
            group: 'Main',
            state: 'Idle',
            perm: 'rw',
            type: 'Switch',
            rule: 'OneOfMany',
            elements: new Map<string, INDIElement>()
        };

        connectionVector.elements.set('CONNECT', { name: 'CONNECT', label: 'Connect', value: false });
        connectionVector.elements.set('DISCONNECT', { name: 'DISCONNECT', label: 'Disconnect', value: true });
        
        indiDev.properties.set('CONNECTION', connectionVector);

        // Add more properties based on device type
        if (indiDev.type === 'Camera') {
            this.addCameraProperties(indiDev);
        } else if (indiDev.type === 'Mount') {
            this.addMountProperties(indiDev);
        }
    }

    private addCameraProperties(indiDev: INDIDevice) {
        const exposureVector: INDIVector = {
            device: indiDev.name,
            name: 'CCD_EXPOSURE',
            label: 'Exposure',
            group: 'Main',
            state: 'Idle',
            perm: 'rw',
            type: 'Number',
            elements: new Map<string, INDIElement>()
        };
        exposureVector.elements.set('CCD_EXPOSURE_VALUE', { name: 'CCD_EXPOSURE_VALUE', label: 'Duration', value: 0, min: 0, max: 3600, step: 0.1 });
        indiDev.properties.set('CCD_EXPOSURE', exposureVector);
    }

    private addMountProperties(indiDev: INDIDevice) {
        const coordVector: INDIVector = {
            device: indiDev.name,
            name: 'EQUATORIAL_EOD_COORD',
            label: 'Coordinates',
            group: 'Main',
            state: 'Idle',
            perm: 'rw',
            type: 'Number',
            elements: new Map<string, INDIElement>()
        };
        coordVector.elements.set('RA', { name: 'RA', label: 'RA', value: 0 });
        coordVector.elements.set('DEC', { name: 'DEC', label: 'DEC', value: 0 });
        indiDev.properties.set('EQUATORIAL_EOD_COORD', coordVector);
    }
}

export default AlpacaAdapterService.getInstance();
