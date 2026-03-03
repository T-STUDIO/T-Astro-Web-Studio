/**
 * T-Astro INDI-to-Alpaca DB Definitions [V202.12.1-FIXED-STRICT]
 * ROLE: The Protocol Enforcer (Total Feature Parity & High Speed)
 * FIX: Syntax error in imageready.
 * FIX: Dynamic tag injection for GOTO, Exposure, Abort, and Rotator.
 */

import { INDIDevice } from './types';
import { MASTER_DICTIONARY, STATIC_GUIDS, DEVICE_TYPE_ORDER } from './AlpacaMasterDictionary';

let serverTransactionId = 1;

export class AlpacaDB {
    private static instance: AlpacaDB;
    private activeInstances: Map<string, AlpacaDeviceInstance> = new Map();
    private slots: Map<string, AlpacaDeviceInstance[]> = new Map();
    public isConstructed: boolean = false;

    public static getInstance() {
        if (!AlpacaDB.instance) AlpacaDB.instance = new AlpacaDB();
        return AlpacaDB.instance;
    }

    public updateRegistry(devices: INDIDevice[]) {
        if (!devices) return;
        const validDevices = devices.filter(d => !d.name.toLowerCase().includes('agent') && !d.name.toLowerCase().includes('watchdog'));
        let changed = false;
        
        for (const dev of validDevices) {
            let inst = this.activeInstances.get(dev.name);
            if (!inst) {
                const category = this.assignType(dev);
                if (category) {
                    inst = new AlpacaDeviceInstance(dev, category, "");
                    this.activeInstances.set(dev.name, inst);
                    changed = true;
                }
            } else {
                inst.updateSnapshot(dev);
            }
        }
        const currentNames = new Set(validDevices.map(d => d.name));
        for (const name of Array.from(this.activeInstances.keys())) {
            if (!currentNames.has(name)) { this.activeInstances.delete(name); changed = true; }
        }
        if (changed || this.slots.size === 0) this.rebuildSlots();
        this.isConstructed = this.activeInstances.size > 0;
    }

    private assignType(dev: INDIDevice): string | null {
        const p = dev.properties;
        const t = String(dev.type || "");
        const n = dev.name.toLowerCase();
        if (t === 'Rotator' || p.has('ABS_ROTATOR_POSITION') || p.has('ROTATOR_POSITION') || n.includes('rotator')) return 'Rotator';
        if (t === 'Camera' || p.has('CCD_EXPOSURE') || p.has('CCD_INFO') || n.includes('camera') || n.includes('guide')) return 'Camera';
        if (t === 'Mount' || p.has('EQUATORIAL_EOD_COORD') || p.has('EQUATORIAL_COORD') || p.has('TELESCOPE_MOTION_NS')) return 'Telescope';
        if (t === 'Focuser' || p.has('ABS_FOCUS_POSITION') || p.has('REL_FOCUS_POSITION') || p.has('FOCUS_POSITION') || n.includes('focuser')) return 'Focuser';
        if (t === 'FilterWheel' || p.has('FILTER_SLOT') || p.has('FILTER_NAME') || n.includes('filter')) return 'FilterWheel';
        if (t === 'Dome' || p.has('DOME_SHUTTER')) return 'Dome';
        return null;
    }

    private rebuildSlots() {
        this.slots.clear();
        DEVICE_TYPE_ORDER.forEach(c => this.slots.set(c, []));
        const sortedDevNames = Array.from(this.activeInstances.keys()).sort();
        let globalIdx = 0;
        sortedDevNames.forEach(name => {
            const inst = this.activeInstances.get(name)!;
            if (this.slots.has(inst.type)) {
                inst.setGuid(STATIC_GUIDS[globalIdx % STATIC_GUIDS.length]);
                this.slots.get(inst.type)!.push(inst);
                globalIdx++;
            }
        });
    }

    public dispatchAlpaca(req: any): any {
        const { method, path, params } = req;
        const cid = parseInt(params?.ClientTransactionID || params?.clienttransactionid || 0) || 0;
        const sid = ++serverTransactionId;
        const segments = path.split('/').filter((x: string) => x.length > 0);
        const lowSegments = segments.map(s => s.toLowerCase());

        if (lowSegments[0] === 'api' && lowSegments[1] === 'v1') {
            const typeKey = DEVICE_TYPE_ORDER.find(t => {
                const tl = t.toLowerCase();
                const plural = (tl === 'switch') ? 'switches' : tl + 's';
                return tl === lowSegments[2] || plural === lowSegments[2];
            });
            const index = parseInt(lowSegments[3]) || 0;
            const inst = typeKey ? this.slots.get(typeKey)?.[index] : null;
            if (inst) {
                const action = lowSegments[4];
                if (segments.length === 4) return this.wrap(true, cid, sid);
                const res = inst.execute(method, action, params, sid, cid, req.requestId);
                if (res && res.isBinary) return res; 
                if (!res) return this.wrap(false, cid, sid, 1024, `Action ${action} not implemented`);
                return this.wrap(res.Value, cid, sid, res.ErrorNumber || 0, res.ErrorMessage || "");
            }
        }

        if (lowSegments[0] === 'management' && lowSegments[1] === 'v1') {
            if (lowSegments[2] === 'description') return this.wrap({ ServerName: "T-Astro Bridge", Manufacturer: "T-Astro", ManufacturerVersion: "2026.2.10", Location: "Internal" }, cid, sid);
            if (lowSegments[2] === 'configureddevices') {
                const list: any[] = [];
                DEVICE_TYPE_ORDER.forEach(cat => {
                    const devs = this.slots.get(cat) || [];
                    devs.forEach((inst, idx) => { list.push({ DeviceName: inst.indiName, DeviceType: cat, DeviceNumber: idx, UniqueID: inst.getGuid() }); });
                });
                return this.wrap(list, cid, sid);
            }
        }
        return this.wrap(false, cid, sid, 1028, `Not Found: ${path}`);
    }

    private wrap(val: any, cid: number, sid: number, err: number = 0, msg: string = "") {
        return { Value: (val === null || val === undefined) ? null : val, ClientTransactionID: cid, ServerTransactionID: sid, ErrorNumber: err, ErrorMessage: msg };
    }
}

class AlpacaDeviceInstance {
    private forceExposing = false;
    private connectTime = 0;
    public indiName: string;
    private snapshot: Map<string, any> = new Map();
    
    private lockedTags: Map<string, any> = new Map();
    private lockedExpProp = "";
    private lockedExpEl = "";
    private lockedRaDecProp = "";
    private lockedRaEl = "";
    private lockedDecEl = "";
    private lockedFrameProp = "";
    private lockedWEl = "";
    private lockedHEl = "";
    private lockedPosProp = "";
    private lockedPosEl = "";
    private lockedRotProp = "";
    private lockedRotEl = "";

    constructor(public indiRef: INDIDevice, public type: string, private guid: string) {
        this.indiName = indiRef.name;
        this.updateSnapshot(indiRef);
    }

    public setGuid(g: string) { this.guid = g; }
    public getGuid(): string { return this.guid; }

    public updateSnapshot(dev: INDIDevice) {
        this.indiRef = dev;
        const importantProps = [
            'CONNECTION', 'EQUATORIAL_EOD_COORD', 'EQUATORIAL_COORD', 'TELESCOPE_TRACK_STATE',
            'CCD_EXPOSURE', 'CCD_TEMPERATURE', 'FILTER_SLOT', 'FILTER_NAME', 'CCD_INFO', 'CCD_BINNING',
            'ABS_FOCUS_POSITION', 'REL_FOCUS_POSITION', 'FOCUS_POSITION', 'FOCUS_MOTION', 'ABS_ROTATOR_POSITION', 
            'ROTATOR_POSITION', 'ROTATOR_STEPS', 'ROTATOR_ANGLE', 'TELESCOPE_PARK', 'CCD_FRAME',
            'TELESCOPE_MOTION_NS', 'TELESCOPE_MOTION_WE', 'ON_COORD_SET', 'TELESCOPE_ABORT_MOTION',
            'HORIZONTAL_COORD', 'GEOGRAPHIC_COORD', 'LST', 'CCD_GAIN', 'CCD_OFFSET', 'ROTATOR_REVERSE', 
            'CCD_FRAME_TYPE', 'ROTATOR_ABORT_MOTION', 'ROTATOR_SYNC', 'FOCUS_ABORT_MOTION', 'FOCUS_TEMPERATURE'
        ];

        if (this.isBusy(this.lockedExpProp || 'CCD_EXPOSURE')) this.forceExposing = false;

        for (const propName of importantProps) {
            const vector = dev.properties.get(propName);
            if (vector) {
                for (const [elName, el] of vector.elements) {
                    this.snapshot.set(`${propName}.${elName}`, el.value);
                }
                this.snapshot.set(`${propName}.__state`, vector.state);
            }
        }
        this.snapshot.set('__connected', dev.connected);

        const typeDict = MASTER_DICTIONARY[this.type];
        if (typeDict) {
            for (const [alpacaFunc, candidates] of Object.entries(typeDict)) {
                if (!this.lockedTags.has(alpacaFunc)) {
                    for (const cand of (candidates as any[])) {
                        if (dev.properties.has(cand.p)) {
                            this.lockedTags.set(alpacaFunc, cand);
                            if (alpacaFunc === 'exposure') { this.lockedExpProp = cand.p; this.lockedExpEl = cand.e; }
                            if (alpacaFunc === 'coord') { this.lockedRaDecProp = cand.p; this.lockedRaEl = cand.e?.ra; this.lockedDecEl = cand.e?.dec; }
                            if (alpacaFunc === 'frame') { this.lockedFrameProp = cand.p; this.lockedWEl = cand.e.w; this.lockedHEl = cand.e.h; }
                            if (alpacaFunc === 'position' && this.type === 'Focuser') { this.lockedPosProp = cand.p; this.lockedPosEl = cand.e; }
                            if (alpacaFunc === 'position' && this.type === 'Rotator') { 
                                this.lockedTags.set('move_abs', cand); 
                                this.lockedRotProp = cand.p; 
                                this.lockedRotEl = cand.e; 
                            }
                            break;
                        }
                    }
                }
            }
        }
    }

    private getLocked(func: string): any { return this.lockedTags.get(func); }

    private parseIndiCoord(val: any): number {
        if (val === null || val === undefined) return 0;
        if (typeof val === 'number') return val;
        const s = String(val).trim();
        if (!s.includes(':')) return parseFloat(s) || 0;
        const parts = s.split(':').map(parseFloat);
        const sign = s.startsWith('-') ? -1 : 1;
        let deg = Math.abs(parts[0] || 0);
        if (parts.length > 1) deg += parts[1] / 60;
        if (parts.length > 2) deg += parts[2] / 3600;
        return deg * sign;
    }

    private getCached(prop: string, el: string): any { return this.snapshot.get(`${prop}.${el}`) ?? null; }
    private isBusy(prop: string): boolean { return this.snapshot.get(`${prop}.__state`) === 'Busy'; }

    private asBool(params: any, key: string): boolean | null {
        if (!params) return null;
        const lowKey = key.toLowerCase();
        let val: any = undefined;
        for (const k in params) if (k.toLowerCase() === lowKey) { val = params[k]; break; }
        if (val === undefined || val === null || val === "") return null;
        const s = String(val).toLowerCase();
        if (s === 'true' || s === '1' || s === 'on' || s === 'yes') return true;
        if (s === 'false' || s === '0' || s === 'off' || s === 'no') return false;
        return null;
    }

    public execute(method: string, action: string, params: any, sid: number, cid: number, rid: number): any {
        const lowAction = action.toLowerCase();
        const getP = (key: string) => {
            if (!params) return undefined;
            const low = key.toLowerCase();
            for (const k in params) if (k.toLowerCase() === low) return params[k];
            return undefined;
        };

        if (method === 'GET') {
            if (lowAction === 'connected') return { Value: !!this.snapshot.get('__connected') };
            if (lowAction === 'name') return { Value: this.indiName };
            if (lowAction === 'interfaceversion') return { Value: (this.type === 'Focuser' || this.type === 'Telescope' || this.type === 'Camera') ? 3 : 2 };
            
            if (this.type === 'Camera') {
                if (lowAction === 'camerastate') return { Value: (this.forceExposing || this.isBusy(this.lockedExpProp || 'CCD_EXPOSURE')) ? 2 : 0 };
                if (lowAction === 'ccdtemperature') return { Value: Number(this.getCached('CCD_TEMPERATURE', 'CCD_TEMPERATURE_VALUE') ?? 0) };
                if (lowAction === 'binx') return { Value: Number(this.getCached('CCD_BINNING', 'HOR_BIN') ?? 1) };
                if (lowAction === 'biny') return { Value: Number(this.getCached('CCD_BINNING', 'VER_BIN') ?? 1) };
                if (lowAction === 'camerax') return { Value: Number(this.lockedFrameProp ? this.getCached(this.lockedFrameProp, this.lockedWEl) : 0) };
                if (lowAction === 'cameray') return { Value: Number(this.lockedFrameProp ? this.getCached(this.lockedFrameProp, this.lockedHEl) : 0) };
                if (lowAction === 'gain') return { Value: Number(this.getCached('CCD_GAIN', 'GAIN') ?? 0) };
                if (lowAction === 'offset') return { Value: Number(this.getCached('CCD_OFFSET', 'OFFSET') ?? 0) };
                if (lowAction === 'sensorname') return { Value: this.indiName };
                if (lowAction === 'maxbinx' || lowAction === 'maxbiny') return { Value: 4 };
                if (lowAction === 'pixelsizex' || lowAction === 'pixelsizey') return { Value: Number(this.getCached('CCD_INFO', 'CCD_PIXEL_SIZE') ?? 3.76) };
                if (lowAction === 'imageready') return { Value: (window as any).lastFitsBuffer != null && !this.isBusy(this.lockedExpProp || 'CCD_EXPOSURE') };
                if (lowAction === 'imagebytes' || lowAction === 'imagearray') {
                    const buf = (window as any).lastFitsBuffer;
                    if (!buf) return { Value: false, ErrorNumber: 1024, ErrorMessage: "No Image" };
                    return this.pack(buf, rid || cid, sid, lowAction === 'imagearray');
                }
                if (lowAction.startsWith('can')) return { Value: true };
            }

            if (this.type === 'Telescope') {
                const p = this.lockedRaDecProp || 'EQUATORIAL_EOD_COORD';
                if (lowAction === 'slewing') return { Value: this.isBusy(p) || this.isBusy('TELESCOPE_MOTION_NS') || this.isBusy('TELESCOPE_MOTION_WE') };
                if (lowAction === 'tracking') return { Value: !!this.getCached('TELESCOPE_TRACK_STATE', 'TRACK_ON') };
                if (lowAction === 'rightascension') return { Value: this.parseIndiCoord(this.getCached(p, this.lockedRaEl || 'RA')) };
                if (lowAction === 'declination') return { Value: this.parseIndiCoord(this.getCached(p, this.lockedDecEl || 'DEC')) };
                if (lowAction === 'altitude') return { Value: this.parseIndiCoord(this.getCached('HORIZONTAL_COORD', 'ALT')) };
                if (lowAction === 'azimuth') return { Value: this.parseIndiCoord(this.getCached('HORIZONTAL_COORD', 'AZ')) };
                if (lowAction === 'sitelatitude') return { Value: this.parseIndiCoord(this.getCached('GEOGRAPHIC_COORD', 'LAT')) };
                if (lowAction === 'sitelongitude') return { Value: this.parseIndiCoord(this.getCached('GEOGRAPHIC_COORD', 'LONG')) };
                if (lowAction === 'siderealtime') return { Value: this.parseIndiCoord(this.getCached('LST', 'LST_VALUE')) };
                if (lowAction === 'atpark') return { Value: !!this.getCached('TELESCOPE_PARK', 'PARK') };
                if (lowAction === 'canmoveaxis') return { Value: true };
                if (lowAction === 'axisrates') return { Value: [{ Minimum: 0, Maximum: 4 }] };
                if (lowAction === 'equatorialsystem') return { Value: 1 };
                if (lowAction.startsWith('can')) return { Value: true };
            }

            if (this.type === 'Focuser') {
                const p = this.lockedPosProp || 'ABS_FOCUS_POSITION';
                if (lowAction === 'position') return { Value: Number(this.getCached(p, this.lockedPosEl || 'FOCUS_ABSOLUTE_POSITION') || 0) };
                if (lowAction === 'ismoving') return { Value: this.isBusy(p) };
                if (lowAction === 'absolute') return { Value: true };
                if (lowAction === 'maxstep') return { Value: 100000 };
                if (lowAction === 'temperature') return { Value: Number(this.getCached('FOCUS_TEMPERATURE', 'TEMPERATURE') ?? 20) };
            }

            if (this.type === 'FilterWheel') {
                if (lowAction === 'position') return { Value: (Number(this.getCached('FILTER_SLOT', 'FILTER_SLOT_VALUE') || 1)) - 1 };
                if (lowAction === 'names') {
                    const vector = this.indiRef.properties.get('FILTER_NAME');
                    if (vector) return { Value: Array.from(vector.elements.values()).map(el => String(el.value)) };
                    return { Value: ["Filter 1", "Filter 2", "Filter 3", "Filter 4", "Filter 5"] };
                }
            }

            if (this.type === 'Rotator') {
                const p = this.lockedRotProp || 'ABS_ROTATOR_POSITION';
                if (lowAction === 'position') return { Value: Number(this.getCached(p, this.lockedRotEl || 'ROTATOR_POSITION') || 0) };
                if (lowAction === 'ismoving') return { Value: this.isBusy(p) };
            }

            return { Value: false };
        } 
        else {
            let xml = "";
            const dev = this.indiName;

            if (lowAction === 'connected') {
                const b = this.asBool(params, 'Connected');
                if (b !== null) {
                    if (b) { this.connectTime = Date.now(); xml = `<newSwitchVector device='${dev}' name='CONNECTION'><oneSwitch name='CONNECT'>On</oneSwitch></newSwitchVector>`; }
                    else { this.connectTime = 0; xml = `<newSwitchVector device='${dev}' name='CONNECTION'><oneSwitch name='DISCONNECT'>On</oneSwitch></newSwitchVector>`; }
                }
            }
            else if (this.type === 'Telescope') {
                if (lowAction === 'pulseguide') {
                    const dur = Number(getP('Duration')); const dir = getP('Direction');
                    const ra = (dir === '2') ? dur : (dir === '3' ? -dur : 0);
                    const dec = (dir === '0') ? dur : (dir === '1' ? -dur : 0);
                    xml = `<newNumberVector device='${dev}' name='TELESCOPE_PULSE_GUIDE'><oneNumber name='RA'>${ra}</oneNumber><oneNumber name='DEC'>${dec}</oneNumber></newNumberVector>`;
                }
                else if (lowAction === 'slewtocoordinates') {
                    const ra = Number(getP('RightAscension'));
                    const dec = Number(getP('Declination'));
                    const coordTag = this.getLocked('coord');
                    const p = coordTag?.p || this.lockedRaDecProp || 'EQUATORIAL_EOD_COORD';
                    const raEl = coordTag?.e?.ra || this.lockedRaEl || 'RA';
                    const decEl = coordTag?.e?.dec || this.lockedDecEl || 'DEC';
                    const setTag = this.getLocked('on_coord_set');
                    const setProp = setTag?.p || 'ON_COORD_SET';
                    const slewEl = (typeof setTag?.e === 'object') ? setTag.e.slew : (setTag?.e || 'SLEW');

                    xml = `<newSwitchVector device='${dev}' name='${setProp}'><oneSwitch name='${slewEl}'>On</oneSwitch></newSwitchVector>` +
                          `<newNumberVector device='${dev}' name='${p}'><oneNumber name='${raEl}'>${ra}</oneNumber><oneNumber name='${decEl}'>${dec}</oneNumber></newNumberVector>`;
                }
                else if (lowAction === 'moveaxis') {
                    const axis = Number(getP('Axis')); const rate = Number(getP('Rate'));
                    const isNS = (axis === 1); const vName = isNS ? 'TELESCOPE_MOTION_NS' : 'TELESCOPE_MOTION_WE';
                    const posEl = isNS ? 'MOTION_NORTH' : 'MOTION_EAST'; const negEl = isNS ? 'MOTION_SOUTH' : 'MOTION_WEST';
                    if (rate === 0) xml = `<newSwitchVector device='${dev}' name='${vName}'><oneSwitch name='${posEl}'>Off</oneSwitch><oneSwitch name='${negEl}'>Off</oneSwitch></newSwitchVector>`;
                    else xml = `<newSwitchVector device='${dev}' name='${vName}'><oneSwitch name='${rate > 0 ? posEl : negEl}'>On</oneSwitch><oneSwitch name='${rate > 0 ? negEl : posEl}'>Off</oneSwitch></newSwitchVector>`;
                }
                else if (lowAction === 'abortslew') {
                    const abTag = this.getLocked('abort');
                    xml = `<newSwitchVector device='${dev}' name='${abTag?.p || 'TELESCOPE_ABORT_MOTION'}'><oneSwitch name='${abTag?.e || 'ABORT'}'>On</oneSwitch></newSwitchVector>`;
                }
            }
            else if (this.type === 'Camera') {
                if (lowAction === 'startexposure') {
                    this.forceExposing = true;
                    const dur = Number(getP('Duration'));
                    const isLight = this.asBool(params, 'Light') ?? true;
                    const expProp = this.lockedExpProp || 'CCD_EXPOSURE';
                    const expEl = this.lockedExpEl || 'CCD_EXPOSURE_VALUE';
                    const ftTag = this.getLocked('frame_type');
                    const ftProp = ftTag?.p || 'CCD_FRAME_TYPE';
                    const ftEl = isLight ? (ftTag?.e?.light || 'FRAME_LIGHT') : (ftTag?.e?.dark || 'FRAME_DARK');

                    xml = `<newSwitchVector device='${dev}' name='${ftProp}'><oneSwitch name='${ftEl}'>On</oneSwitch></newSwitchVector>` +
                          `<newNumberVector device='${dev}' name='${expProp}'><oneNumber name='${expEl}'>${dur}</oneNumber></newNumberVector>`;
                }
                else if (lowAction === 'gain') xml = `<newNumberVector device='${dev}' name='CCD_GAIN'><oneNumber name='GAIN'>${getP('Gain')}</oneNumber></newNumberVector>`;
                else if (lowAction === 'abortexposure') {
                    const abTag = this.getLocked('abort');
                    xml = `<newSwitchVector device='${dev}' name='${abTag?.p || 'CCD_ABORT_EXPOSURE'}'><oneSwitch name='${abTag?.e || 'ABORT'}'>On</oneSwitch></newSwitchVector>`;
                }
            }
            else if (this.type === 'FilterWheel') {
                if (lowAction === 'position') xml = `<newNumberVector device='${dev}' name='FILTER_SLOT'><oneNumber name='FILTER_SLOT_VALUE'>${Number(getP('Position')) + 1}</oneNumber></newNumberVector>`;
            }
            else if (this.type === 'Rotator') {
                const rotTag = this.getLocked('move_abs');
                if (lowAction === 'moveabsolute') xml = `<newNumberVector device='${dev}' name='${rotTag?.p || 'ABS_ROTATOR_POSITION'}'><oneNumber name='${rotTag?.e || 'ROTATOR_POSITION'}'>${getP('Position')}</oneNumber></newNumberVector>`;
                else if (lowAction === 'halt') {
                    const abTag = this.getLocked('abort');
                    xml = `<newSwitchVector device='${dev}' name='${abTag?.p || 'ROTATOR_ABORT_MOTION'}'><oneSwitch name='${abTag?.e || 'ABORT'}'>On</oneSwitch></newSwitchVector>`;
                }
            }
            else if (this.type === 'Focuser') {
                const posTag = this.getLocked('position');
                if (lowAction === 'move') xml = `<newNumberVector device='${dev}' name='${posTag?.p || 'ABS_FOCUS_POSITION'}'><oneNumber name='${posTag?.e || 'FOCUS_ABSOLUTE_POSITION'}'>${getP('Position')}</oneNumber></newNumberVector>`;
                else if (lowAction === 'halt') {
                    const abTag = this.getLocked('abort');
                    xml = `<newSwitchVector device='${dev}' name='${abTag?.p || 'FOCUS_ABORT_MOTION'}'><oneSwitch name='${abTag?.e || 'ABORT'}'>On</oneSwitch></newSwitchVector>`;
                }
            }

            if (xml && (window as any).AlpacaBridge) (window as any).AlpacaBridge.sendToINDI(xml);
            return { Value: null };
        }
    }

    private pack(buf: ArrayBuffer | null, cid: number, sid: number, isArray: boolean): any {
        const iBytes = buf ? new Uint8Array(buf) : new Uint8Array(0);
        const dataLen = iBytes.length;
        const w = Number(this.lockedFrameProp ? this.getCached(this.lockedFrameProp, this.lockedWEl) : 0) || 640; 
        const h = Number(this.lockedFrameProp ? this.getCached(this.lockedFrameProp, this.lockedHEl) : 0) || 480;
        const headerLen = 44;
        const buffer = new ArrayBuffer(headerLen + dataLen);
        const view = new DataView(buffer);
        view.setUint32(0, 1, true); 
        view.setUint32(4, buf ? 0 : 1024, true); 
        view.setUint32(8, cid, true); 
        view.setUint32(12, sid, true);
        view.setUint32(16, 44, true);
        view.setInt32(20, 1, true);
        view.setInt32(24, 1, true);
        view.setInt32(28, 2, true);
        view.setInt32(32, w, true);
        view.setInt32(36, h, true);
        view.setInt32(40, 0, true);
        
        if (buf) {
            const dst = new Uint8Array(buffer, headerLen);
            // FITS(Big-Endian) to Alpaca(Little-Endian) byte swap for 16-bit
            for (let i = 0; i < dataLen; i += 2) {
                dst[i] = iBytes[i + 1];
                dst[i + 1] = iBytes[i];
            }
        }
        return { isBinary: true, data: new Uint8Array(buffer) };
    }
}