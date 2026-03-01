
import { ConnectionSettings } from '../types';
import * as DriverConnection from './DriverConnection';

/**
 * INDI BLOB Transport Service
 * Handles dedicated binary channel for images and video streams.
 */
export class BlobTransportService {
    private static instance: BlobTransportService;
    private socket: WebSocket | null = null;
    private recvChunks: Uint8Array[] = [];
    private recvLength = 0;
    private isBlobMode = false;
    private blobExpectedTotalLength = 0;

    private readonly BLOB_START = new TextEncoder().encode('<oneBLOB');
    private readonly BLOB_END = new TextEncoder().encode('</oneBLOB>');
    private readonly CLOSE_TAG = new TextEncoder().encode('>');

    public static getInstance(): BlobTransportService {
        if (!BlobTransportService.instance) {
            BlobTransportService.instance = new BlobTransportService();
        }
        return BlobTransportService.instance;
    }

    public async connect(settings: ConnectionSettings): Promise<boolean> {
        this.disconnect();
        
        let rawHost = settings.host;
        let protocol = 'ws';
        const protoMatch = rawHost.match(/^([a-z0-9]+):\/\//i);
        if (protoMatch) {
            protocol = protoMatch[1].toLowerCase();
            rawHost = rawHost.replace(/^([a-z0-9]+):\/\//i, '');
        }
        rawHost = rawHost.replace(/\/+$/, '');
        let path = '';
        const slashIdx = rawHost.indexOf('/');
        if (slashIdx !== -1) {
            path = rawHost.substring(slashIdx);
            rawHost = rawHost.substring(0, slashIdx);
        }
        
        const url = `${protocol}://${rawHost}:${settings.port}${path}`;

        return new Promise((resolve) => {
            try {
                const ws = new WebSocket(url);
                ws.binaryType = "arraybuffer";
                this.socket = ws;

                ws.onopen = () => {
                    if (this.socket !== ws) return;
                    // Primary instruction: Only receive BLOBs on this connection
                    this.sendRaw('<enableBLOB>Only</enableBLOB>');
                    resolve(true);
                };

                ws.onmessage = (event) => {
                    if (this.socket !== ws) return;
                    if (event.data instanceof ArrayBuffer) {
                        const chunk = new Uint8Array(event.data);
                        this.recvChunks.push(chunk);
                        this.recvLength += chunk.length;
                        this.processBuffer();
                    }
                };

                ws.onerror = () => resolve(false);
                ws.onclose = () => { if (this.socket === ws) this.socket = null; };
            } catch (e) {
                resolve(false);
            }
        });
    }

    public disconnect() {
        if (this.socket) {
            this.socket.close();
            this.socket = null;
        }
        this.recvChunks = [];
        this.recvLength = 0;
        this.isBlobMode = false;
    }

    private sendRaw(xml: string) {
        if (this.socket?.readyState === 1) {
            this.socket.send(new TextEncoder().encode(xml + "\n"));
        }
    }

    private findSequence(buffer: Uint8Array, sequence: Uint8Array, offset: number = 0): number {
        const len = buffer.length;
        const seqLen = sequence.length;
        if (offset + seqLen > len) return -1;
        for (let i = offset; i <= len - seqLen; i++) {
            let match = true;
            for (let j = 0; j < seqLen; j++) {
                if (buffer[i + j] !== sequence[j]) { match = false; break; }
            }
            if (match) return i;
        }
        return -1;
    }

    private flattenChunks(): Uint8Array {
        const result = new Uint8Array(this.recvLength);
        let offset = 0;
        for (const chunk of this.recvChunks) {
            result.set(chunk, offset);
            offset += chunk.length;
        }
        return result;
    }

    private processBuffer() {
        const decoder = new TextDecoder("utf-8");
        
        while (this.recvLength > 0) {
            if (this.isBlobMode) {
                if (this.recvLength >= this.blobExpectedTotalLength) {
                    const full = this.flattenChunks();
                    if (this.processSingleBlock(full, decoder)) {
                        this.isBlobMode = false;
                        continue;
                    }
                }
                break;
            }

            const full = this.flattenChunks();
            const startIdx = this.findSequence(full, this.BLOB_START);
            if (startIdx === -1) {
                this.recvChunks = []; this.recvLength = 0;
                break;
            }

            const headerEndIdx = this.findSequence(full, this.CLOSE_TAG, startIdx);
            if (headerEndIdx === -1) break;

            const headerStr = decoder.decode(full.slice(startIdx, headerEndIdx + 1));
            const sizeMatch = headerStr.match(/size=['"](\d+)['"]/);
            if (!sizeMatch) {
                const rest = full.slice(headerEndIdx + 1);
                this.recvChunks = [rest]; this.recvLength = rest.length;
                continue;
            }

            const declaredSize = parseInt(sizeMatch[1], 10);
            this.blobExpectedTotalLength = headerEndIdx + 1 + declaredSize + this.BLOB_END.length;
            this.isBlobMode = true;
        }
    }

    private processSingleBlock(buffer: Uint8Array, decoder: TextDecoder): boolean {
        const headerEndIdx = this.findSequence(buffer, this.CLOSE_TAG);
        if (headerEndIdx === -1) return false;

        const headerStr = decoder.decode(buffer.slice(0, headerEndIdx + 1));
        const sizeMatch = headerStr.match(/size=['"](\d+)['"]/);
        if (!sizeMatch) return false;

        const declaredSize = parseInt(sizeMatch[1], 10);
        const closeIdx = this.findSequence(buffer, this.BLOB_END, headerEndIdx + 1 + declaredSize);
        
        if (closeIdx !== -1) {
            const blobData = buffer.slice(headerEndIdx + 1, closeIdx);
            const format = this.getAttr(headerStr, 'format') || '.fits';
            const devName = this.getAttr(headerStr, 'device') || 'Unknown';
            
            // Bridge to main connection logic
            const params = DriverConnection.getActiveCameraParams();
            const res = DriverConnection.rawFitsToDisplay(blobData.buffer, format, 'Auto', params);
            if (res.url) {
                DriverConnection.triggerExternalImageReceived(res.url, format, res.headers);
            }

            const packetEnd = closeIdx + this.BLOB_END.length;
            const remainder = buffer.slice(packetEnd);
            this.recvChunks = [remainder];
            this.recvLength = remainder.length;
            return true;
        }
        return false;
    }

    private getAttr(xml: string, attr: string): string | null {
        const regex = new RegExp(`${attr}\\s*=\\s*['"]([^'"]*)['"]`, 'i');
        const match = xml.match(regex);
        return match ? match[1] : null;
    }
}
