
import { ConnectionSettings, INDIDevice, INDIPropertyState, INDIPropertyType, INDISwitchRule, INDIPermission, LocationData, TelescopePosition, DriverType, INDIVector, INDIElement, DeviceType } from '../types';

let debugLogs: string[] = [];
let onLogCallback: ((entry: string) => void) | null = null;

// 新規追加：メインチャネルでのBLOB管理フラグ
let mainChannelBlobsDisabled = false;

/**
 * 外部（AstroService）からメインチャネルのBLOB挙動を制御します。
 */
export const setMainChannelBlobDisabled = (disabled: boolean) => {
    mainChannelBlobsDisabled = disabled;
    if (disabled && socket?.readyState === 1) {
        sendRaw('<enableBLOB>Never</enableBLOB>');
    }
};

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
let onImageProcessed: (() => void) | null = null;
let onTelescopePositionUpdate: ((pos: TelescopePosition) => void) | null = null;
let onFocuserUpdate: ((position: number, step?: number) => void) | null = null;
let onMountLocationUpdate: ((loc: LocationData) => void) | null = null;
let onMountTimeUpdate: ((time: Date) => void) | null = null;

/**
 * 新規追加：分離されたBLOBチャネルから画像データを受け入れます。
 */
export const triggerExternalImageReceived = (url: string, format: string, metadata?: any) => {
    if (onImageReceived) onImageReceived(url, format, metadata);
};

export const setIndiDeviceCallback = (cb: typeof onIndiDeviceUpdate) => { 
    onIndiDeviceUpdate = cb;
    if (cb && discoveredIndiDevices.size > 0) {
        cb(Array.from(discoveredIndiDevices.values()));
    }
};
export const setIndiMessageCountCallback = (cb: typeof onIndiMessageCount) => onIndiMessageCount = cb;
export const setImageReceivedCallback = (cb: typeof onImageReceived) => onImageReceived = cb;
export const setImageProcessedCallback = (cb: () => void) => onImageProcessed = cb;
export const setTelescopePositionCallback = (cb: typeof onTelescopePositionUpdate) => onTelescopePositionUpdate = cb;
export const setFocuserUpdateCallback = (cb: typeof onFocuserUpdate) => onFocuserUpdate = cb;
export const setMountLocationCallback = (cb: typeof onMountLocationUpdate) => onMountLocationUpdate = cb;
export const setMountTimeCallback = (cb: typeof onMountTimeUpdate) => onMountTimeUpdate = cb;

// --- State ---
let socket: WebSocket | null = null;
let messageBuffer = "";
let messageCount = 0;
let currentSettings: ConnectionSettings = { driver: 'Simulator', host: '', port: 8625, serverType: 'local' };

// --- Optimized Chunked Buffering State ---
let recvChunks: Uint8Array[] = [];
let recvLength = 0; 
let isBlobMode = false;
let blobExpectedTotalLength = 0; 

// Constants for Parsing
const ONE_BLOB_START = new TextEncoder().encode('<oneBLOB');
const CLOSE_TAG = new TextEncoder().encode('>');
const BLOB_END_TAG = new TextEncoder().encode('</oneBLOB>');

// Device State (The Source of Truth)
const discoveredIndiDevices: Map<string, INDIDevice> = new Map();
let activeMountDevice: string | null = null;
let activeCameraDevice: string | null = null;
let activeFocuserDevice: string | null = null;
let lastFitsBuffer: ArrayBuffer | null = null;
let activeDebayerPattern = 'Auto'; 

let activeCameraParams = { width: 0, height: 0, bpp: 8, format: '', pixelSize: 0 };
let updateTimeout: any = null;
const UPDATE_INTERVAL_MS = 100; 

import { AstroSimulatorService } from './AstroSimulatorService';
import * as AstroServiceSimulator from './AstroServiceSimulator';

export const getSimulatorMock = () => {
    const sim = AstroSimulatorService.getInstance();
    const state = sim.getState();
    return {
        connected: state.mount.connected || state.camera.connected,
        setLocation: (lat: number, lon: number, elev: number) => {
            // Simulator doesn't strictly track location yet, but we can store it if needed
            console.log(`[Simulator] Location set to ${lat}, ${lon}, ${elev}`);
        },
        sync: (ra: number, dec: number) => {
            sim.syncTo(ra, dec);
        },
        slew: (ra: number, dec: number) => {
            sim.slewTo(ra, dec);
        }
    };
};

export const getActiveMount = () => activeMountDevice;
export const getActiveCamera = () => activeCameraDevice;
export const setActiveCamera = (devName: string) => {
    activeCameraDevice = devName;
    scheduleUpdate();
};
export const getActiveFocuser = () => activeFocuserDevice;
export const setActiveFocuser = (devName: string) => {
    activeFocuserDevice = devName;
    scheduleUpdate();
};
export const getIndiDevices = () => Array.from(discoveredIndiDevices.values());
export const getActiveCameraParams = () => activeCameraParams;

export const getDeviceProperties = (devName: string): INDIVector[] => {
    if (currentSettings.driver === 'Simulator') {
        return AstroServiceSimulator.getDeviceProperties(devName);
    }
    const dev = discoveredIndiDevices.get(devName);
    return dev ? Array.from(dev.properties.values()) : [];
};

export const hasProperty = (dev: string, prop: string): boolean => {
    if (currentSettings.driver === 'Simulator') {
        const props = AstroServiceSimulator.getDeviceProperties(dev);
        return props.some(p => p.name === prop);
    }
    const d = discoveredIndiDevices.get(dev);
    return !!d && d.properties.has(prop);
};

export const getNumericValue = (dev: string, prop: string, element: string): number | null => {
    if (currentSettings.driver === 'Simulator') {
        return AstroServiceSimulator.getNumericValue(dev, prop, element);
    }
    const d = discoveredIndiDevices.get(dev);
    if (!d) return null;
    const vec = d.properties.get(prop);
    if (!vec || vec.type !== 'Number') return null;
    const el = vec.elements.get(element);
    return (el && typeof el.value === 'number') ? el.value : null;
};

export const getSwitchValue = (dev: string, prop: string, element: string): boolean => {
    if (currentSettings.driver === 'Simulator') {
        return AstroServiceSimulator.getSwitchValue(dev, prop, element);
    }
    const d = discoveredIndiDevices.get(dev);
    if (!d) return false;
    const vec = d.properties.get(prop);
    if (!vec || vec.type !== 'Switch') return false;
    const el = vec.elements.get(element);
    return el ? (el.value === true || el.value === 'On') : false;
};

export const getDevicesWithProperty = (propName: string): string[] => {
    const names: string[] = [];
    for (const [name, dev] of discoveredIndiDevices) {
        if (dev.properties.has(propName)) names.push(name);
    }
    return names;
};

const getCameraParams = (devName: string) => {
    const dev = discoveredIndiDevices.get(devName);
    if (!dev) return { width: 0, height: 0, bpp: 8, format: '', pixelSize: 0 };
    let width = 0, height = 0, bpp = 8, pixelSize = 0;
    const frame = dev.properties.get('CCD_FRAME');
    if (frame) {
        width = (frame.elements.get('WIDTH')?.value as number) || 0;
        height = (frame.elements.get('HEIGHT')?.value as number) || 0;
    } else {
        const cfa = dev.properties.get('CCD_CFA');
        if (cfa) {
            width = (cfa.elements.get('WIDTH')?.value as number) || 0;
            height = (cfa.elements.get('HEIGHT')?.value as number) || 0;
        }
    }
    const info = dev.properties.get('CCD_INFO');
    if (info) {
        pixelSize = (info.elements.get('PixelSize')?.value as number) || 0;
        bpp = (info.elements.get('BitsPerPixel')?.value as number) || 8;
    }
    let format = '';
    const vidFormat = dev.properties.get('CCD_VIDEO_FORMAT');
    if (vidFormat && vidFormat.type === 'Switch') {
        for (const [elName, el] of vidFormat.elements) {
            if (el.value === true) { format = elName; break; }
        }
    }
    return { width, height, bpp, pixelSize, format };
};

const getAttr = (xml: string, attr: string): string | null => {
    const regex = new RegExp(`${attr}\\s*=\\s*(?:['"]([^'"]*)['"]|([^\\s>]+))`, 'i');
    const match = xml.match(regex);
    return match ? (match[1] || match[2]) : null;
};

export const diagnoseConnection = async (host: string, port: number, driver: string): Promise<string[]> => {
    const logs: string[] = [];
    logs.push(`Starting diagnosis for ${driver} at ${host}:${port}...`);
    if (driver === 'INDI') {
        try {
            logs.push(`ℹ️ Attempting WebSocket connection to ws://${host}:${port}/...`);
            const testSocket = new WebSocket(`ws://${host}:${port}/`);
            await new Promise<void>((resolve, reject) => {
                const timer = setTimeout(() => {
                    testSocket.close();
                    reject(new Error("Connection timed out (3s)"));
                }, 3000);
                testSocket.onopen = () => {
                    clearTimeout(timer);
                    logs.push("✅ WebSocket connection successful.");
                    testSocket.close();
                    resolve();
                };
                testSocket.onerror = (e) => {
                    clearTimeout(timer);
                    reject(new Error("WebSocket Error"));
                };
            });
        } catch (e: any) {
            logs.push(`❌ Connection Failed: ${e.message}`);
            logs.push("👉 Check if INDI Server (Web Manager) is running.");
            logs.push("👉 Check if 'websockify' is running if direct INDI.");
            logs.push("👉 Check CORS/SSL settings if using HTTPS.");
        }
    }
    return logs;
};

export const connect = async (settings: ConnectionSettings): Promise<boolean> => {
    const targetPort = Number(settings.port || 8625);
    currentSettings = { ...settings, port: targetPort };
    
    // 接続開始時にインディサーバーを一々強制キルせず、既存のWebSocket切断とクライアント側メモリ空間のクリーンアップのみを行う
    if (socket) {
        try {
            socket.close();
        } catch (e) {}
        socket = null;
    }
    cleanup();

    if (settings.driver === 'Simulator') {
        const ok = await AstroServiceSimulator.connect(currentSettings);
        if (ok) {
            AstroServiceSimulator.getIndiDevices().forEach(dev => {
                discoveredIndiDevices.set(dev.name, dev);
            });
            activeCameraDevice = AstroServiceSimulator.getActiveCamera();
            activeFocuserDevice = AstroServiceSimulator.getActiveFocuser();
            activeMountDevice = 'Simulator Mount';
            
            AstroServiceSimulator.setImageReceivedCallback(triggerExternalImageReceived);
            AstroServiceSimulator.setTelescopePositionCallback((pos) => {
                if (onTelescopePositionUpdate) onTelescopePositionUpdate(pos);
            });
        }
        return ok;
    }

    if (settings.driver === 'INDI') {
        const targetPort = Number(settings.port || 8625);
        const targetHost = (settings.host || '').trim() || '127.0.0.1';

        // 常に接続前にサーバーの WebSocket-TCP ブリッジ設定を同期します
        try {
            await fetch('/api/indi/configure-port', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ port: targetPort, host: targetHost })
            });
            log(`[DriverConnection] Synced server-side bridge to port ${targetPort}, host ${targetHost}`);
        } catch (postErr) {
            console.error('[DriverConnection] Failed to sync bridge configuration to server:', postErr);
        }

        let rawHost = '';
        if (typeof window !== 'undefined' && window.location) {
            rawHost = window.location.hostname;
        }
        if (!rawHost) {
            rawHost = '127.0.0.1';
        }
        
        let protocol = 'ws';
        if (typeof window !== 'undefined' && window.location && window.location.protocol === 'https:') {
            protocol = 'wss';
        }
        
        let path = '';
        const url = `${protocol}://${rawHost}:${targetPort}${path}`;
        log(`Connecting to INDI at ${url}...`);

        return new Promise((resolve) => {
            let isResolved = false;
            let openTimeout: any = null;

            try {
                const ws = new WebSocket(url);
                ws.binaryType = "arraybuffer"; 
                socket = ws;

                ws.onopen = () => {
                    if (socket !== ws) return;
                    log('INDI WebSocket Open. Validating backend server bridge state...');
                    
                    sendRaw('<enableBLOB>Never</enableBLOB>');
                    sendRaw('<getProperties version="1.7" />');
                    
                    // 350msの接続検証用ホールドバリア。
                    // 物理インディサーバー (TCP 7624) が起動していない場合、
                    // サーバーブリッジは接続を即座に（大体50ms以内に）切断します。
                    openTimeout = setTimeout(() => {
                        if (socket === ws && !isResolved) {
                            isResolved = true;
                            log('INDI WebSocket Connected successfully');
                            resolve(true);
                        }
                    }, 350);
                };

                ws.onmessage = (event) => {
                    if (socket !== ws) return;
                    messageCount++;
                    if (onIndiMessageCount) onIndiMessageCount(messageCount);
                    if (event.data instanceof ArrayBuffer) {
                        const chunk = new Uint8Array(event.data);
                        recvChunks.push(chunk);
                        recvLength += chunk.length;
                        processBuffer();
                    } else if (typeof event.data === 'string') {
                        parseStream(event.data);
                    }
                };

                ws.onerror = (e) => {
                    if (socket !== ws) return;
                    log(`INDI Connection Error (ReadyState: ${ws.readyState})`);
                    if (openTimeout) clearTimeout(openTimeout);
                    if (!isResolved) {
                        isResolved = true;
                        resolve(false);
                    }
                };

                ws.onclose = (e) => {
                    if (socket !== ws) return;
                    log(`INDI Connection Closed (Code: ${e.code}, Reason: ${e.reason || 'None'})`);
                    if (openTimeout) clearTimeout(openTimeout);
                    if (!isResolved) {
                        isResolved = true;
                        resolve(false);
                    }
                    cleanup();
                };
            } catch (e) {
                log(`INDI Init Error: ${e}`);
                if (openTimeout) clearTimeout(openTimeout);
                if (!isResolved) {
                    isResolved = true;
                    resolve(false);
                }
            }
        });
    }
    return false;
};

export const disconnect = async () => {
    if (currentSettings.driver === 'Simulator') {
        AstroServiceSimulator.disconnect();
        cleanup();
        return;
    }

    log("[Driver] Disconnect requested. Sending DISCONNECT to devices and stopping indiserver on backend, keeping WebSocket open.");
    
    // 1. 各INDIデバイスにDISCONNECTを送信
    for (const devName of discoveredIndiDevices.keys()) {
        disconnectIndiDevice(devName);
    }
    for (const dev of discoveredIndiDevices.values()) {
        dev.connected = false;
    }
    if (onIndiDeviceUpdate) onIndiDeviceUpdate(Array.from(discoveredIndiDevices.values()));

    // 2. サーバープロセス終了（通常のドライバ切断コマンド＝INDIドライバの終了）
    try {
        console.log("[Driver] Stopping backend indiserver child processes...");
        await fetch('/api/indi/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ drivers: [] })
        });
        console.log("[Driver] Backend driver processes cleared successfully.");
    } catch (e) {
        console.error("[Driver] Failed to stop backend indiserver:", e);
    }
    
    cleanup();
};

const cleanup = () => {
    discoveredIndiDevices.clear();
    activeMountDevice = null;
    activeCameraDevice = null;
    activeFocuserDevice = null;
    messageBuffer = "";
    recvChunks = [];
    recvLength = 0;
    isBlobMode = false;
    blobExpectedTotalLength = 0;
    if (updateTimeout) {
        clearTimeout(updateTimeout);
        updateTimeout = null;
    }
    if (onIndiDeviceUpdate) onIndiDeviceUpdate([]);
};

export const clearBuffer = () => {
    recvChunks = [];
    recvLength = 0;
    messageBuffer = "";
    isBlobMode = false;
    blobExpectedTotalLength = 0;
    log("[Driver] Buffers flushed.");
};

export const connectIndiDevice = (devName: string) => {
    if (currentSettings.driver === 'Simulator') {
        AstroServiceSimulator.connectDevice(devName);
        return;
    }
    const d = discoveredIndiDevices.get(devName);
    if (!d) return;
    sendRaw(`<newSwitchVector device='${devName}' name='CONNECTION'><oneSwitch name='CONNECT'>On</oneSwitch></newSwitchVector>`);
};

export const disconnectIndiDevice = (devName: string) => {
    if (currentSettings.driver === 'Simulator') {
        AstroServiceSimulator.disconnectDevice(devName);
        return;
    }
    const d = discoveredIndiDevices.get(devName);
    if (!d) return;
    sendRaw(`<newSwitchVector device='${devName}' name='CONNECTION'><oneSwitch name='DISCONNECT'>On</oneSwitch></newSwitchVector>`);
};

export const refreshIndiDevices = () => {
    if (currentSettings.driver === 'Simulator') {
        AstroServiceSimulator.refreshDevices();
        return;
    }
    sendRaw('<getProperties version="1.7" />');
};

export const moveFocuser = (steps: number, direction: 'in' | 'out') => {
    if (!activeFocuserDevice) return;
    const dev = discoveredIndiDevices.get(activeFocuserDevice);
    if (!dev) return;
    if (dev.properties.has('FOCUS_MOTION') && dev.properties.has('REL_FOCUS_POSITION')) {
        const motionName = 'FOCUS_MOTION';
        const relName = 'REL_FOCUS_POSITION';
        let xmlDir = `<newSwitchVector device='${activeFocuserDevice}' name='${motionName}'>`;
        xmlDir += `<oneSwitch name='FOCUS_IN'>${direction === 'in' ? 'On' : 'Off'}</oneSwitch>`;
        xmlDir += `<oneSwitch name='FOCUS_OUT'>${direction === 'out' ? 'On' : 'Off'}</oneSwitch>`;
        xmlDir += `</newSwitchVector>`;
        sendRaw(xmlDir);
        let xmlMove = `<newNumberVector device='${activeFocuserDevice}' name='${relName}'>`;
        xmlMove += `<oneNumber name='FOCUS_RELATIVE_POSITION'>${steps}</oneNumber>`;
        xmlMove += `</newNumberVector>`;
        sendRaw(xmlMove);
    }
};

export const reprocessRawFITS = (pattern: string) => {
    activeDebayerPattern = pattern;
    if (lastFitsBuffer) {
        const res = rawFitsToDisplay(lastFitsBuffer, 'fits', pattern, activeCameraParams);
        if (res.url && onImageReceived) {
            onImageReceived(res.url, 'fits', { ...res.headers });
        }
    }
};

const flattenChunks = (chunks: Uint8Array[], totalLength: number): Uint8Array => {
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.length;
    }
    return result;
};

const findSequence = (buffer: Uint8Array, sequence: Uint8Array, offset: number = 0): number => {
    const len = buffer.length;
    const seqLen = sequence.length;
    if (offset + seqLen > len) return -1;
    for (let i = offset; i <= len - seqLen; i++) {
        let match = true;
        for (let j = 0; j < seqLen; j++) { if (buffer[i + j] !== sequence[j]) { match = false; break; } }
        if (match) return i;
    }
    return -1;
};

const processBuffer = () => {
    const decoder = new TextDecoder("utf-8");
    let iterations = 0;
    while(iterations < 20) {
        iterations++;
        if (recvLength === 0) return;
        if (isBlobMode) {
            if (recvLength >= blobExpectedTotalLength) {
                const fullBuffer = flattenChunks(recvChunks, recvLength);
                const success = processSingleBlock(fullBuffer, decoder);
                if (success) {
                    isBlobMode = false; blobExpectedTotalLength = 0; return;
                } else {
                    recvChunks = [fullBuffer]; recvLength = fullBuffer.length;
                    if (recvLength > blobExpectedTotalLength + 5000000) {
                        recvChunks = []; recvLength = 0; isBlobMode = false; blobExpectedTotalLength = 0;
                    }
                }
            } else { return; }
        }
        const peekLen = Math.min(recvLength, 2048); 
        let headBuffer: Uint8Array;
        if (recvChunks[0].length >= peekLen) { headBuffer = recvChunks[0].slice(0, peekLen); } 
        else {
            headBuffer = new Uint8Array(peekLen);
            let offset = 0;
            for (const chunk of recvChunks) {
                const needed = peekLen - offset;
                if (needed <= 0) break;
                const toCopy = Math.min(needed, chunk.length);
                headBuffer.set(chunk.slice(0, toCopy), offset);
                offset += toCopy;
            }
        }
        const blobStartIdx = findSequence(headBuffer, ONE_BLOB_START);
        if (blobStartIdx === -1) {
            if (recvLength > 0) {
                const text = decoder.decode(flattenChunks(recvChunks, recvLength));
                parseStream(text);
                recvChunks = []; recvLength = 0;
            }
            return;
        }
        if (blobStartIdx > 0) {
            const fullBuffer = flattenChunks(recvChunks, recvLength);
            const textPart = fullBuffer.slice(0, blobStartIdx);
            const text = decoder.decode(textPart);
            parseStream(text);
            const rest = fullBuffer.slice(blobStartIdx);
            recvChunks = [rest]; recvLength = rest.length;
            continue;
        }
        const headerEndIdx = findSequence(headBuffer, CLOSE_TAG);
        if (headerEndIdx === -1) return;
        const headerStr = decoder.decode(headBuffer.slice(0, headerEndIdx + 1));
        const sizeMatch = headerStr.match(/size=['"](\d+)['"]/);
        if (!sizeMatch) {
            const fullBuffer = flattenChunks(recvChunks, recvLength);
            const rest = fullBuffer.slice(headerEndIdx + 1);
            recvChunks = [rest]; recvLength = rest.length;
            continue;
        }
        const declaredSize = parseInt(sizeMatch[1], 10);
        const minNeeded = headerEndIdx + 1 + declaredSize + BLOB_END_TAG.length;
        const fullBuffer = flattenChunks(recvChunks, recvLength);
        const success = processSingleBlock(fullBuffer, decoder);
        if (!success) {
            recvChunks = [fullBuffer]; recvLength = fullBuffer.length;
            isBlobMode = true; blobExpectedTotalLength = minNeeded; return;
        }
    }
};

const processSingleBlock = (buffer: Uint8Array, decoder: TextDecoder): boolean => {
    const headerEndIdx = findSequence(buffer, CLOSE_TAG);
    if (headerEndIdx === -1) return false; 
    const headerStr = decoder.decode(buffer.slice(0, headerEndIdx + 1));
    const sizeMatch = headerStr.match(/size=['"](\d+)['"]/);
    if (!sizeMatch) return false;
    const declaredSize = parseInt(sizeMatch[1], 10);
    const dataStart = headerEndIdx + 1;
    const searchStart = dataStart + declaredSize;
    if (buffer.length < searchStart) return false;
    const closeIdx = findSequence(buffer, BLOB_END_TAG, searchStart);
    if (closeIdx !== -1) {
        let blobData = new Uint8Array(buffer.slice(dataStart, closeIdx));
        const devName = getAttr(headerStr, 'device') || 'Unknown';
        const format = getAttr(headerStr, 'format') || '.fits';
        const bufferCopy = blobData.buffer;
        lastFitsBuffer = bufferCopy;
        (window as any).lastFitsBuffer = bufferCopy;
        const deviceParams = getCameraParams(devName);
        if (devName === activeCameraDevice) Object.assign(activeCameraParams, deviceParams);
        const res = rawFitsToDisplay(bufferCopy, format, activeDebayerPattern, deviceParams);
        if (res.url && onImageReceived) onImageReceived(res.url, format, res.headers);
        const packetEnd = closeIdx + BLOB_END_TAG.length;
        if (packetEnd < buffer.length) {
            const remainder = buffer.slice(packetEnd);
            recvChunks = [remainder]; recvLength = remainder.length;
            setTimeout(processBuffer, 0); 
        } else { recvChunks = []; recvLength = 0; }
        return true;
    }
    return false;
};

export const sendRaw = (xml: string) => {
    if (socket && socket.readyState === 1) { 
        if (!xml.startsWith('<newNumberVector device=\'INDI Webcam\'')) log(`[TX] ${xml}`);
        const encoder = new TextEncoder();
        const data = encoder.encode(xml + "\n");
        socket.send(data);
    }
};

export const injectIndiValue = (device: string, vector: string, element: string, value: any) => {
    const dev = discoveredIndiDevices.get(device);
    if (!dev) return;
    const vec = dev.properties.get(vector);
    if (vec) {
        const el = vec.elements.get(element);
        if (el) {
            el.value = value;
            log(`[Local Update] ${device}.${vector}.${element} = ${value}`);
            scheduleUpdate();
            if (vector === 'TIME_UTC' && element === 'UTC' && onMountTimeUpdate) {
                const d = new Date(value);
                if (!isNaN(d.getTime())) onMountTimeUpdate(d);
            }
        }
    }
};

export const updateDeviceSetting = (dev: string, prop: string, val: any) => {
    if (currentSettings.driver === 'Simulator') {
        AstroServiceSimulator.updateDeviceSetting(dev, prop, val);
        return;
    }
    const d = discoveredIndiDevices.get(dev);
    if (!d) return;
    const vec = d.properties.get(prop);
    if (!vec) return;
    let changed = false;
    if (vec.type === 'Switch' && typeof val === 'object') {
        for (const k in val) {
            const el = vec.elements.get(k);
            if (el) { el.value = val[k]; changed = true; }
        }
        if (vec.rule === 'OneOfMany') {
            const onKey = Object.keys(val).find(k => val[k] === true);
            if (onKey) { for (const [k, el] of vec.elements) { if (k !== onKey) el.value = false; } }
        }
    } else if ((vec.type === 'Number' || vec.type === 'Text') && typeof val === 'object') {
        for (const k in val) {
            const el = vec.elements.get(k);
            if (el) { el.value = val[k]; changed = true; }
        }
    }
    if (changed) scheduleUpdate();
    if (vec.type === 'Switch') {
        let xml = `<newSwitchVector device='${dev}' name='${prop}'>`;
        if (typeof val === 'object') for(const k in val) xml += `<oneSwitch name='${k}'>${val[k] ? 'On' : 'Off'}</oneSwitch>`;
        xml += `</newSwitchVector>`;
        sendRaw(xml);
    } else if (vec.type === 'Number') {
        let xml = `<newNumberVector device='${dev}' name='${prop}'>`;
        for(const k in val) xml += `<oneNumber name='${k}'>${val[k]}</oneNumber>`;
        xml += `</newNumberVector>`;
        sendRaw(xml);
    } else if (vec.type === 'Text') {
        let xml = `<newTextVector device='${dev}' name='${prop}'>`;
        for(const k in val) xml += `<oneText name='${k}'>${val[k]}</oneText>`;
        xml += `</newTextVector>`;
        sendRaw(xml);
    }
};

const parseStream = (chunk: string) => {
    messageBuffer += chunk;
    let loopGuard = 0;
    while (loopGuard < 10000) {
        loopGuard++;
        const startIdx = messageBuffer.indexOf('<');
        if (startIdx === -1) { if (messageBuffer.length > 50000) messageBuffer = ""; break; }
        if (startIdx > 0) messageBuffer = messageBuffer.substring(startIdx);
        if (messageBuffer.startsWith('<?xml')) {
            const endDecl = messageBuffer.indexOf('?>');
            if (endDecl !== -1) { messageBuffer = messageBuffer.substring(endDecl + 2); continue; } else break;
        }
        const endTagIdx = messageBuffer.indexOf('>');
        if (endTagIdx === -1) break;
        if (messageBuffer[endTagIdx - 1] === '/') {
            const packet = messageBuffer.substring(0, endTagIdx + 1);
            parseIndiPacket(packet);
            messageBuffer = messageBuffer.substring(endTagIdx + 1);
            continue;
        }
        const tagContent = messageBuffer.substring(1, endTagIdx);
        const tagName = tagContent.split(/[\s/]/)[0];
        const closingTag = `</${tagName}>`;
        const closingTagIdx = messageBuffer.indexOf(closingTag);
        if (closingTagIdx === -1) break;
        const packetEnd = closingTagIdx + closingTag.length;
        const packet = messageBuffer.substring(0, packetEnd);
        parseIndiPacket(packet);
        messageBuffer = messageBuffer.substring(packetEnd);
    }
};

const parseIndiPacket = (packet: string) => {
    if (packet.startsWith('<delProperty')) {
         const devName = getAttr(packet, 'device');
         const propName = getAttr(packet, 'name');
         if (devName) {
             if (propName) discoveredIndiDevices.get(devName)?.properties.delete(propName);
             else {
                 discoveredIndiDevices.delete(devName);
                 if (activeMountDevice === devName) activeMountDevice = null;
                 if (activeCameraDevice === devName) activeCameraDevice = null;
                 if (activeFocuserDevice === devName) activeFocuserDevice = null;
                 log(`[INDI] Device Removed: ${devName}`);
             }
             scheduleUpdate();
         }
         return;
    }
    const devName = getAttr(packet, 'device');
    const name = getAttr(packet, 'name');
    if (packet.startsWith('<message')) {
        const msg = getAttr(packet, 'message');
        if (devName && msg) log(`[INDI] ${devName}: ${msg}`);
        return;
    }
    if (!devName) return;
    let device = discoveredIndiDevices.get(devName);
    if (!device) {
        if (packet.startsWith('<def') || packet.startsWith('<set') || packet.startsWith('<new')) {
            device = { name: devName, connected: false, properties: new Map() };
            discoveredIndiDevices.set(devName, device);
        } else return;
    }
    let type: INDIPropertyType | null = null;
    if (packet.includes('NumberVector')) type = 'Number';
    else if (packet.includes('SwitchVector')) type = 'Switch';
    else if (packet.includes('TextVector')) type = 'Text';
    else if (packet.includes('LightVector')) type = 'Light';
    else if (packet.includes('BLOBVector')) type = 'BLOB';
    if (!type || !name) return;
    let vector = device.properties.get(name);
    if (!vector) {
        vector = {
            device: devName, name: name,
            label: getAttr(packet, 'label') || name,
            group: getAttr(packet, 'group') || 'Main',
            state: 'Idle', perm: 'rw', type: type, elements: new Map(),
            rule: getAttr(packet, 'rule') as INDISwitchRule 
        };
        device.properties.set(name, vector);
    }
    const state = getAttr(packet, 'state');
    if (state) vector.state = state as INDIPropertyState;
    if (type === 'BLOB') return;
    const elementRegex = /<(?:def|one|set)(Number|Switch|Text|Light)\s+([^>]+)>([^<]*)<\/(?:def|one|set)(?:Number|Switch|Text|Light)>/g;
    let match;
    while ((match = elementRegex.exec(packet)) !== null) {
        const attrStr = match[2];
        const valueStr = match[3];
        const elName = getAttr(`<tag ${attrStr}`, 'name');
        const elLabel = getAttr(`<tag ${attrStr}`, 'label') || elName;
        if (elName) {
            let el = vector.elements.get(elName);
            if (!el) { el = { name: elName, label: elLabel!, value: '' }; vector.elements.set(elName, el); }
            if (type === 'Number') {
                el.value = parseFloat(valueStr.trim());
                const minStr = getAttr(`<tag ${attrStr}`, 'min');
                const maxStr = getAttr(`<tag ${attrStr}`, 'max');
                const stepStr = getAttr(`<tag ${attrStr}`, 'step');
                if(minStr) el.min = parseFloat(minStr);
                if(maxStr) el.max = parseFloat(maxStr);
                if(stepStr) el.step = parseFloat(stepStr);
                if (devName === activeCameraDevice) {
                    if (name === 'CCD_FRAME' || name === 'CCD_CFA') {
                        if (elName === 'WIDTH') activeCameraParams.width = el.value as number;
                        if (elName === 'HEIGHT') activeCameraParams.height = el.value as number;
                    }
                    if (name === 'CCD_INFO') {
                        if (elName === 'PixelSize') activeCameraParams.pixelSize = el.value as number;
                        if (elName === 'BitsPerPixel') activeCameraParams.bpp = el.value as number;
                    }
                }
                if (name === 'ABS_FOCUS_POSITION' && elName === 'FOCUS_ABSOLUTE_POSITION') {
                    if (onFocuserUpdate && activeFocuserDevice === devName) onFocuserUpdate(el.value as number);
                }
            } else if (type === 'Switch') {
                el.value = (valueStr.trim() === 'On');
                if (devName === activeCameraDevice && name === 'CCD_VIDEO_FORMAT' && el.value === true) activeCameraParams.format = elName;
            } else el.value = valueStr.trim();
        }
    }
    if (name === 'CONNECTION') {
        const c = vector.elements.get('CONNECT');
        if (c) {
            const isConn = (c.value === true);
            if (device.connected !== isConn) {
                device.connected = isConn;
                if (isConn) {
                    log(`[INDI] ${devName} Connected.`);
                }
            }
        }
    }
    detectDevice(device, name); scheduleUpdate(); 
    if (device.type === 'Mount') {
        if (name === 'EQUATORIAL_EOD_COORD' || name === 'EQUATORIAL_COORD') {
             const ra = vector.elements.get('RA')?.value;
             const dec = vector.elements.get('DEC')?.value;
             if (typeof ra === 'number' && typeof dec === 'number' && onTelescopePositionUpdate) onTelescopePositionUpdate({ ra: ra * 15, dec: dec });
        }
        if (name === 'GEOGRAPHIC_COORD') {
             const lat = vector.elements.get('LAT')?.value;
             const lon = vector.elements.get('LONG')?.value;
             const elev = vector.elements.get('ELEV')?.value;
             if (typeof lat === 'number' && typeof lon === 'number' && onMountLocationUpdate) onMountLocationUpdate({ latitude: lat, longitude: lon, elevation: typeof elev === 'number' ? elev : 0 });
        }
        if (name === 'TIME_UTC') {
             const utc = vector.elements.get('UTC')?.value;
             if (typeof utc === 'string' && onMountTimeUpdate) {
                 const d = new Date(utc);
                 if (!isNaN(d.getTime())) if (d.getFullYear() >= 2020) onMountTimeUpdate(d);
             }
        }
    }
};

const detectDevice = (device: INDIDevice, prop: string) => {
    // すでに種別が確定している場合は、重複判定およびログ出力を回避するため即座に終了します
    if (device.type && device.type !== 'Auxiliary') {
        return;
    }

    // 1. DRIVER_INFO項目のDRIVER_EXECの名称末尾を参照する確実な種別判定（最優先・絶対判定）
    const driverInfo = device.properties.get('DRIVER_INFO');
    if (driverInfo) {
        const execEl = driverInfo.elements.get('DRIVER_EXEC');
        if (execEl && typeof execEl.value === 'string' && execEl.value.trim() !== '') {
            const execVal = execEl.value.trim().toLowerCase();
            const parts = execVal.split(/[_.-]/);
            const tail = parts[parts.length - 1] || execVal;

            let determinedType: DeviceType | null = null;
            if (tail === 'ccd' || tail === 'camera' || tail === 'cam' || tail === 'video' || tail === 'webcam' || tail === 'gphoto' || tail === 'dslr' || tail === 'imager' || execVal.endsWith('ccd') || execVal.endsWith('camera')) {
                determinedType = 'Camera';
            } else if (tail === 'telescope' || tail === 'mount' || tail === 'scope' || tail === 'eqmod' || tail === 'synscan' || tail === 'lx200' || tail === 'nexstar' || tail === 'ioptron' || execVal.endsWith('telescope') || execVal.endsWith('mount')) {
                determinedType = 'Mount';
            } else if (tail === 'focuser' || tail === 'focus' || tail === 'eaf' || tail === 'fc' || execVal.endsWith('focuser') || execVal.endsWith('focus')) {
                determinedType = 'Focuser';
            } else if (tail === 'wheel' || tail === 'filter' || tail === 'filterwheel' || tail === 'fw' || tail === 'efw' || execVal.endsWith('wheel') || execVal.endsWith('filterwheel') || execVal.endsWith('filter')) {
                determinedType = 'FilterWheel';
            } else if (tail === 'dome' || tail === 'shutter' || tail === 'roof' || tail === 'rollroof' || execVal.endsWith('dome') || execVal.endsWith('shutter') || execVal.endsWith('roof')) {
                determinedType = 'Dome';
            } else if (tail === 'rotator' || tail === 'rot' || execVal.endsWith('rotator') || execVal.endsWith('rot')) {
                determinedType = 'Rotator';
            } else if (tail === 'sqm' || tail === 'weather' || tail === 'meteo' || tail === 'aag' || tail === 'seeing' || tail === 'environment' || tail === 'cloud' || execVal.endsWith('weather') || execVal.endsWith('meteo') || execVal.endsWith('sqm')) {
                determinedType = 'Weather';
            } else if (tail === 'heater' || tail === 'dew' || tail === 'dewheater' || execVal.endsWith('heater') || execVal.endsWith('dew')) {
                determinedType = 'Heater';
            } else if (tail === 'aux' || tail === 'gps' || tail === 'box' || tail === 'switch' || tail === 'relay' || tail === 'cover' || tail === 'flat' || execVal.endsWith('aux')) {
                determinedType = 'Auxiliary';
            }

            if (determinedType) {
                device.type = determinedType;
                log(`[INDI] Device '${device.name}' type identified as '${determinedType}' by DRIVER_EXEC tail ('${execVal}')`);
                if (determinedType === 'Mount' && !activeMountDevice) {
                    activeMountDevice = device.name;
                    log(`[INDI] Active Mount detected by EXEC tail: ${device.name}`);
                }
                if (determinedType === 'Camera' && !activeCameraDevice) {
                    activeCameraDevice = device.name;
                    log(`[INDI] Active Camera detected by EXEC tail: ${device.name}`);
                }
                if (determinedType === 'Focuser' && !activeFocuserDevice) {
                    activeFocuserDevice = device.name;
                }
                return;
            }
        }
    }

    // DRIVER_EXEC末尾参照等ですでに種別が確定している場合は保持
    if (device.type && device.type !== 'Auxiliary') {
        return;
    }

    const propUpper = prop.toUpperCase();
    const nameLower = device.name.toLowerCase();

    const isCameraName = nameLower.includes('camera') || nameLower.includes('ccd') || nameLower.includes('qhy') || nameLower.includes('zwo') || nameLower.includes('asi') || nameLower.includes('webcam') || nameLower.includes('video') || nameLower.includes('cam') || nameLower.includes('guide');
    const isFocuserName = nameLower.includes('focuser') || nameLower.includes('focus') || nameLower.includes('eaf');
    const isMountName = nameLower.includes('telescope') || nameLower.includes('mount') || nameLower.includes('skywatcher') || nameLower.includes('celestron') || nameLower.includes('ioptron') || nameLower.includes('eqmod') || nameLower.includes('alt-az') || nameLower.includes('lx200');

    // 2. 明確なカメラプロパティ（露光設定など）がある場合
    if (propUpper.includes('CCD_EXPOSURE') || propUpper.includes('CCD_FRAME') || propUpper.includes('CCD_IMAGE')) {
        device.type = 'Camera';
        if (!activeCameraDevice) {
            activeCameraDevice = device.name; log(`[INDI] Active Camera detected: ${device.name}`);
        }
        return;
    }

    // 3. 明確なマウントプロパティ（赤経・赤緯座標など）があり、カメラやフォーカサー名でない場合
    if ((propUpper.includes('EQUATORIAL') || propUpper.includes('HORIZONTAL') || propUpper.startsWith('TELESCOPE_EOD') || propUpper.includes('MOUNT_COORD')) && !isCameraName && !isFocuserName) {
        device.type = 'Mount';
        if (!activeMountDevice) { activeMountDevice = device.name; log(`[INDI] Active Mount detected: ${device.name}`); }
        return;
    }

    // 4. 明確なフォーカサープロパティ
    if (propUpper.includes('FOCUS_POSITION') || propUpper.includes('FOCUS_SPEED') || propUpper.includes('FOCUS_MOTION')) {
        device.type = 'Focuser';
        if (!activeFocuserDevice) activeFocuserDevice = device.name;
        return;
    }

    // 5. フィルターホイール
    if (propUpper.includes('FILTER_SLOT') || propUpper.includes('FILTER_NAME')) {
        device.type = 'FilterWheel';
        return;
    }

    // 6. デバイス名からの明確な判定
    if (isCameraName) {
        device.type = 'Camera';
        if (!activeCameraDevice) {
            activeCameraDevice = device.name; log(`[INDI] Active Camera detected by name: ${device.name}`);
        }
    } else if (isMountName) {
        device.type = 'Mount';
        if (!activeMountDevice) { activeMountDevice = device.name; log(`[INDI] Active Mount detected by name: ${device.name}`); }
    } else if (isFocuserName) {
        device.type = 'Focuser';
        if (!activeFocuserDevice) activeFocuserDevice = device.name;
    } else {
        // 判別できないものは安全のために AUX (Auxiliary) に設定する
        device.type = 'Auxiliary';
    }
};

const scheduleUpdate = () => {
    if (!updateTimeout) {
        updateTimeout = setTimeout(() => {
            if (onIndiDeviceUpdate) onIndiDeviceUpdate(Array.from(discoveredIndiDevices.values()));
            updateTimeout = null;
        }, UPDATE_INTERVAL_MS);
    }
};

export const triggerImageUpdate = (url: string, format: string) => { if (onImageReceived) onImageReceived(url, format); };

function isBase64(u8: Uint8Array) {
    let start = 0;
    while(start < Math.min(u8.length, 20) && (u8[start] === 10 || u8[start] === 13 || u8[start] === 32)) start++;
    if (u8.length - start >= 6 && u8[start] === 83 && u8[start+1] === 73 && u8[start+2] === 77 && u8[start+3] === 80 && u8[start+4] === 76 && u8[start+5] === 69) return false; 
    if (u8.length < 50) return false;
    for(let i=0; i<Math.min(u8.length, 100); i++) {
        const c = u8[i];
        if ((c >= 65 && c <= 90) || (c >= 97 && c <= 122) || (c >= 48 && c <= 57) || c === 43 || c === 47 || c === 61 || c === 10 || c === 13 || c === 32) {
            if (c === 61 && i < u8.length - 2) return false; 
            continue;
        }
        return false;
    }
    return true;
}

function scanForFitsHeader(u8: Uint8Array): number {
    const limit = Math.min(u8.length, 2048);
    const simpleSig = [83, 73, 77, 80, 76, 69];
    for(let i=0; i < limit - 80; i++) {
        let match = true;
        for(let j=0; j<6; j++) { if (u8[i+j] !== simpleSig[j]) { match = false; break; } }
        if (match) {
            for(let k=i+6; k<i+80; k++) { if (u8[k] === 61) return i; }
            if (u8[i+6] === 32) return i;
        }
    }
    return -1;
}

const STANDARD_RESOLUTIONS = [
    { w: 1304, h: 976 }, { w: 640, h: 480 }, { w: 320, h: 240 }, { w: 800, h: 600 }, { w: 1024, h: 768 }, { w: 1280, h: 720 }, { w: 1280, h: 960 }, { w: 1920, h: 1080 }, { w: 128, h: 96 }, { w: 2592, h: 1944 }, { w: 3840, h: 2160 }, { w: 3096, h: 2080 }, { w: 4144, h: 2822 }, { w: 1936, h: 1216 }, { w: 1936, h: 1096 }, { w: 1296, h: 976 }, { w: 1280, h: 1024 }, { w: 1600, h: 1200 }, { w: 960, h: 540 }
];

export const rawFitsToDisplay = (
    buffer: ArrayBuffer, 
    format: string, 
    debayerPattern?: string,
    deviceParams?: { width: number, height: number, bpp: number, format: string }
): { url: string | null, headers: Record<string,any> } => {
    try {
        let u8 = new Uint8Array(buffer);
        // Ensure that we work with a precise slice of the ArrayBuffer, resetting any offset to 0
        const normalizedBuffer = buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength);
        u8 = new Uint8Array(normalizedBuffer);
        buffer = normalizedBuffer;
        const formatLower = format.toLowerCase();
        let jpegStart = -1;
        
        // Prioritize dimensions from deviceParams (INDI properties)
        let localParams = deviceParams ? { ...deviceParams } : { width: 0, height: 0, bpp: 8, format: '', pixelSize: 0 };
        
        let expectedRawSize = (localParams.width > 0) ? localParams.width * localParams.height : 0;
        let scanLimit = 2048; 
        if (expectedRawSize > 0) {
            if (buffer.byteLength < expectedRawSize * 0.8) scanLimit = Math.min(u8.length, 131072);
            else scanLimit = 1024;
        } else { if (buffer.byteLength < 500000) scanLimit = u8.length; }

        if (u8.length > 2 && u8[0] === 0xFF && u8[1] === 0xD8) jpegStart = 0;
        else {
            const limit = Math.min(u8.length - 1, scanLimit);
            for(let i = 0; i < limit; i++) { if (u8[i] === 0xFF && u8[i+1] === 0xD8) { jpegStart = i; break; } }
        }
        if (jpegStart !== -1) {
             let blobBuffer = buffer;
             if (jpegStart > 0) { u8 = u8.slice(jpegStart); blobBuffer = u8.buffer; }
             const blob = new Blob([blobBuffer], { type: 'image/jpeg' });
             const url = URL.createObjectURL(blob);
             return { url, headers: { format: 'blob', declaredType: 'image/jpeg', blob: blob } };
        }
        if (u8.length > 8 && u8[0] === 0x89 && u8[1] === 0x50 && u8[2] === 0x4E && u8[3] === 0x47) {
             const blob = new Blob([buffer], { type: 'image/png' });
             const url = URL.createObjectURL(blob);
             return { url, headers: { format: 'blob', declaredType: 'image/png', blob: blob } };
        }
        if (isBase64(u8)) {
            try {
                const textDecoder = new TextDecoder();
                const b64Str = textDecoder.decode(u8);
                const binaryStr = atob(b64Str.replace(/\s/g, ''));
                const len = binaryStr.length;
                const bytes = new Uint8Array(len);
                for (let i = 0; i < len; i++) bytes[i] = binaryStr.charCodeAt(i);
                u8 = bytes; buffer = u8.buffer;
                if (u8.length > 2 && u8[0] === 0xFF && u8[1] === 0xD8) {
                     const blob = new Blob([buffer], { type: 'image/jpeg' });
                     const url = URL.createObjectURL(blob);
                     return { url, headers: { format: 'blob', declaredType: 'image/jpeg', blob: blob } };
                }
            } catch (e) { }
        }
        let isFits = formatLower.includes('fits') || formatLower.includes('fit') || formatLower.includes('.bin') || formatLower.includes('.stream');
        let fitsOffset = scanForFitsHeader(u8);
        if (fitsOffset >= 0) {
            isFits = true;
            const headerChunk = new TextDecoder("ascii").decode(u8.slice(fitsOffset, Math.min(u8.length, fitsOffset + 2880)));
            const naxis1 = parseInt(headerChunk.match(/NAXIS1\s*=\s*(\d+)/)?.[1] || '0');
            const naxis2 = parseInt(headerChunk.match(/NAXIS2\s*=\s*(\d+)/)?.[1] || '0');
            const bitpix = parseInt(headerChunk.match(/BITPIX\s*=\s*(-?\d+)/)?.[1] || '0');
            if (naxis1 > 0 && naxis2 > 0) { localParams.width = naxis1; localParams.height = naxis2; if (bitpix !== 0) localParams.bpp = Math.abs(bitpix); }
            if (fitsOffset > 0) { u8 = u8.slice(fitsOffset); buffer = u8.buffer; }
        }
        if (isFits) {
            try {
                const headers: Record<string, any> = {};
                const decoder = new TextDecoder("ascii");
                let offset = 0; let parsed = false;
                while (offset < buffer.byteLength) {
                    const block = new Uint8Array(buffer, offset, 2880);
                    const blockStr = decoder.decode(block);
                    let endFound = false;
                    for (let i = 0; i < 2880; i += 80) {
                        const line = blockStr.substring(i, i + 80);
                        if (line.startsWith("END")) { endFound = true; break; }
                        if (line.includes("=")) {
                            const [key, valRaw] = line.split("=");
                            if (key && valRaw) {
                                const k = key.trim();
                                let v = valRaw.split("/")[0].trim().replace(/'/g, "");
                                const num = parseFloat(v); headers[k] = isNaN(num) ? v : num;
                            }
                        }
                    }
                    offset += 2880; if (endFound) { parsed = true; break; }
                }
                if (parsed) {
                    const width = headers['NAXIS1'] as number; const height = headers['NAXIS2'] as number;
                    const bitpix = headers['BITPIX'] as number; const bzero = (headers['BZERO'] as number) || 0;
                    const bscale = (headers['BSCALE'] as number) || 1; const naxis3 = (headers['NAXIS3'] as number) || 0;
                    const numPixels = width * height; const numChannels = (naxis3 === 3) ? 3 : 1;
                    const rawRgbaBuffer = new Uint8ClampedArray(width * height * 4);
                    let dataOffset = offset; 
                    const channels: Float32Array[] = [];
                    for(let c=0; c<numChannels; c++) channels.push(new Float32Array(numPixels));
                    const view = new DataView(buffer);
                    let minVal = Infinity;
                    let maxVal = -Infinity;
                    let sumVal = 0;
                    for (let c = 0; c < numChannels; c++) {
                        const target = channels[c];
                        if (bitpix === 8) { 
                            for (let i = 0; i < numPixels; i++) { 
                                if (dataOffset >= buffer.byteLength) break; 
                                const v = u8[dataOffset++] * bscale + bzero;
                                target[i] = v;
                                if (v < minVal) minVal = v; if (v > maxVal) maxVal = v;
                                sumVal += v;
                            } 
                        } 
                        else if (bitpix === 16) { 
                            const hasBZero = (headers['BZERO'] !== undefined);
                            const actualBZero = hasBZero ? bzero : 0;
                            for (let i = 0; i < numPixels; i++) { 
                                if (dataOffset + 2 > buffer.byteLength) break; 
                                const rawVal = hasBZero ? view.getInt16(dataOffset, false) : view.getUint16(dataOffset, false);
                                const v = rawVal * bscale + actualBZero;
                                target[i] = v; dataOffset += 2;
                                if (v < minVal) minVal = v; if (v > maxVal) maxVal = v;
                                sumVal += v;
                            } 
                        } 
                        else if (bitpix === 32) { 
                            for (let i = 0; i < numPixels; i++) { 
                                if (dataOffset + 4 > buffer.byteLength) break; 
                                const v = view.getInt32(dataOffset, false) * bscale + bzero;
                                target[i] = v; dataOffset += 4;
                                if (v < minVal) minVal = v; if (v > maxVal) maxVal = v;
                                sumVal += v;
                            } 
                        } 
                        else if (bitpix === -32) { 
                            for (let i = 0; i < numPixels; i++) { 
                                if (dataOffset + 4 > buffer.byteLength) break; 
                                const v = view.getFloat32(dataOffset, false) * bscale + bzero;
                                target[i] = v; dataOffset += 4;
                                if (v < minVal) minVal = v; if (v > maxVal) maxVal = v;
                                sumVal += v;
                            } 
                        } 
                    }
                    
                    if (maxVal <= minVal) {
                        minVal = 0;
                        maxVal = (bitpix === 8) ? 255 : (Math.abs(bitpix) === 16 ? 65535 : 1);
                    }

                    let displayMin = minVal;
                    let displayMax = maxVal;

                    let displayRange = displayMax - displayMin;
                    if (displayRange <= 0) displayRange = 1;
                    
                    const isRGB = (naxis3 === 3); 
                    let bayerPat = debayerPattern;
                    if (!isRGB && (!bayerPat || bayerPat === 'Auto')) {
                        bayerPat = (headers['BAYERPAT'] as string)?.trim() || (headers['COLORTYP'] as string)?.trim();
                    }
                    
                    let code = -1; 
                    if (!isRGB) { 
                        if (bayerPat === 'RGGB') code = 0; 
                        else if (bayerPat === 'GBRG') code = 1; 
                        else if (bayerPat === 'GRBG') code = 2; 
                        else if (bayerPat === 'BGGR') code = 3; 
                    }
                    
                    const ch0 = channels[0]; 
                    const ch1 = isRGB ? channels[1] : null; 
                    const ch2 = isRGB ? channels[2] : null;
                    
                    const invRange = 1.0 / displayRange;
                    const displayCh0 = new Float32Array(width * height);
                    const displayCh1 = new Float32Array(width * height);
                    const displayCh2 = new Float32Array(width * height);

                    for (let y = 0; y < height; y++) {
                        const fitsY = height - 1 - y; 
                        const rowOffset = y * width; 
                        const fitsRowOffset = fitsY * width; 
                        const isEvenRow = (y % 2 === 0);
                        
                        for (let x = 0; x < width; x++) {
                            const canvasIdx = (rowOffset + x) << 2; 
                            const pixelIdx = fitsRowOffset + x;
                            let r, g, b;
                            let rvRaw, gvRaw, bvRaw;
                            
                            if (isRGB && ch1 && ch2) {
                                let rv = ch0[pixelIdx];
                                let gv = ch1[pixelIdx];
                                let bv = ch2[pixelIdx];
                                rvRaw = rv; gvRaw = gv; bvRaw = bv;
                                
                                r = (rv - displayMin) * invRange * 255;
                                g = (gv - displayMin) * invRange * 255;
                                b = (bv - displayMin) * invRange * 255;
                            } else {
                                const val = ch0[pixelIdx];
                                const norm = (val - displayMin) * invRange * 255;
                                rvRaw = val; gvRaw = val; bvRaw = val;
                                
                                r = norm; g = norm; b = norm;
                            }
                            const outIdx = rowOffset + x;
                            displayCh0[outIdx] = rvRaw;
                            displayCh1[outIdx] = gvRaw;
                            displayCh2[outIdx] = bvRaw;

                            rawRgbaBuffer[canvasIdx] = r; 
                            rawRgbaBuffer[canvasIdx + 1] = g; 
                            rawRgbaBuffer[canvasIdx + 2] = b; 
                            rawRgbaBuffer[canvasIdx + 3] = 255;
                        }
                    }
                    headers['rawBuffer'] = rawRgbaBuffer; 
                    headers['rawWidth'] = width; 
                    headers['rawHeight'] = height; 
                    headers['rawFitsData'] = {
                        ch0: displayCh0,
                        ch1: displayCh1,
                        ch2: displayCh2,
                        width,
                        height,
                        minVal,
                        maxVal
                    };
                    return { url: 'raw-data-available', headers };
                }
            } catch (e) { }
        }
        if (localParams.width === 0 || localParams.height === 0) {
            const size = buffer.byteLength;
            for (const res of STANDARD_RESOLUTIONS) {
                const s8 = res.w * res.h;
                if (size >= s8 && size < s8 + 8192) { localParams.width = res.w; localParams.height = res.h; break; }
                if (size >= s8 * 2 && size < s8 * 2 + 8192) { localParams.width = res.w; localParams.height = res.h; break; }
                if (size >= s8 * 3 && size < s8 * 3 + 8192) { localParams.width = res.w; localParams.height = res.h; break; }
                if (size >= s8 * 6 && size < s8 * 6 + 8192) { localParams.width = res.w; localParams.height = res.h; break; }
            }
        }
        if (localParams.width > 0 && localParams.height > 0) {
            const w = localParams.width; const h = localParams.height; const size = buffer.byteLength;
            const size8 = w * h; const size16 = w * h * 2; const size24 = w * h * 3; const size48 = w * h * 6;
            const tolerance = 8192; 
            if (size >= size8 && size < size8 + tolerance) {
                const rawRgbaBuffer = new Uint8ClampedArray(w * h * 4);
                const offset = Math.max(0, size - size8); const safeOffset = offset < size ? offset : 0;
                const pixelView = new Uint32Array(rawRgbaBuffer.buffer);
                for(let i=0; i<w*h; i++) { const val = u8[safeOffset + i]; pixelView[i] = (255 << 24) | (val << 16) | (val << 8) | val; }
                return { url: 'raw-data-available', headers: { rawBuffer: rawRgbaBuffer, rawWidth: w, rawHeight: h, format: 'RAW8' } };
            }
            if (size >= size16 && size < size16 + tolerance) {
                const isLikelyYUYV = formatLower.includes('yuyv') || formatLower.includes('yuv') || (!formatLower.includes('16') && !formatLower.includes('raw'));
                const offset = Math.max(0, size - size16); const safeOffset = offset < size ? offset : 0;
                if (isLikelyYUYV) {
                    const rawRgbaBuffer = new Uint8ClampedArray(w * h * 4);
                    let ptr = 0; const loopLimit = w * h * 2;
                    for (let i = 0; i < loopLimit; i += 4) {
                        const y0 = u8[safeOffset + i]; const u = u8[safeOffset + i+1]; const y1 = u8[safeOffset + i+2]; const v = u8[safeOffset + i+3];
                        const c = y0 - 16; const d = u - 128; const e = v - 128;
                        const r0 = (298 * c + 409 * e + 128) >> 8; const g0 = (298 * c - 100 * d - 208 * e + 128) >> 8; const b0 = (298 * c + 516 * d + 128) >> 8;
                        rawRgbaBuffer[ptr++] = Math.max(0, Math.min(255, r0)); rawRgbaBuffer[ptr++] = Math.max(0, Math.min(255, g0)); rawRgbaBuffer[ptr++] = Math.max(0, Math.min(255, b0)); rawRgbaBuffer[ptr++] = 255;
                        const c1 = y1 - 16; const r1 = (298 * c1 + 409 * e + 128) >> 8; const g1 = (298 * c1 - 100 * d - 208 * e + 128) >> 8; const b1 = (298 * c1 + 516 * d + 128) >> 8;
                        rawRgbaBuffer[ptr++] = Math.max(0, Math.min(255, r1)); rawRgbaBuffer[ptr++] = Math.max(0, Math.min(255, g1)); rawRgbaBuffer[ptr++] = Math.max(0, Math.min(255, b1)); rawRgbaBuffer[ptr++] = 255;
                    }
                    return { url: 'raw-data-available', headers: { rawBuffer: rawRgbaBuffer, rawWidth: w, rawHeight: h, format: 'YUYV' } };
                }
                const rawRgbaBuffer = new Uint8ClampedArray(w * h * 4); const pixelView = new Uint32Array(rawRgbaBuffer.buffer); const view = new DataView(buffer); let srcPtr = safeOffset; const limit = Math.min(w * h, Math.floor((size - safeOffset) / 2));
                for(let i=0; i<limit; i++) { const val = view.getUint16(srcPtr, true); srcPtr += 2; const norm = val >> 8; pixelView[i] = (255 << 24) | (norm << 16) | (norm << 8) | norm; }
                return { url: 'raw-data-available', headers: { rawBuffer: rawRgbaBuffer, rawWidth: w, rawHeight: h, format: 'RAW16' } };
            }
            if (size >= size24 && size < size24 + tolerance) {
                const rawRgbaBuffer = new Uint8ClampedArray(w * h * 4); const pixelView = new Uint32Array(rawRgbaBuffer.buffer); const offset = Math.max(0, size - size24); let srcPtr = offset < size ? offset : 0; const limit = Math.min(w * h, Math.floor((size - srcPtr) / 3));
                for(let i=0; i<limit; i++) { const r = u8[srcPtr++]; const g = u8[srcPtr++]; const b = u8[srcPtr++]; pixelView[i] = (255 << 24) | (b << 16) | (g << 8) | r; }
                return { url: 'raw-data-available', headers: { rawBuffer: rawRgbaBuffer, rawWidth: w, rawHeight: h, format: 'RGB24' } };
            }
            if (size >= size48 && size < size48 + tolerance) {
                const rawRgbaBuffer = new Uint8ClampedArray(w * h * 4); const pixelView = new Uint32Array(rawRgbaBuffer.buffer); const view = new DataView(buffer); const offset = Math.max(0, size - size48); let srcPtr = offset < size ? offset : 0; const limit = Math.min(w * h, Math.floor((size - srcPtr) / 6));
                for(let i=0; i<limit; i++) { const r = view.getUint16(srcPtr, true) >> 8; const g = view.getUint16(srcPtr + 2, true) >> 8; const b = view.getUint16(srcPtr + 4, true) >> 8; srcPtr += 6; pixelView[i] = (255 << 24) | (b << 16) | (g << 8) | r; }
                return { url: 'raw-data-available', headers: { rawBuffer: rawRgbaBuffer, rawWidth: w, rawHeight: h, format: 'RGB48' } };
            }
        }
        const blob = new Blob([buffer], { type: 'application/octet-stream' }); const url = URL.createObjectURL(blob); return { url, headers: { format: 'blob', forcedType: 'unknown', blob: blob } };
    } catch (e) { return { url: null, headers: {} }; }
};
