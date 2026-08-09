import { BlobTransportService } from './BlobTransportService';

/**
 * INDI通信データ分離・処理層 (IndiStreamProcessor)
 * 既存のメイン機能にリスクを与えない安全なアプローチとして作成された分離モジュール。
 * 
 * 以下の3ブロック構成で処理を行ないます:
 * Block 1: 判定処理 (Packet Classifier / Router)
 * Block 2: ドライバ信号処理 (Driver Signal & XML Command Processor)
 * Block 3: Blob処理 (Binary Image Processor & BlobTransport Link)
 */
export class IndiStreamProcessor {
    private static instance: IndiStreamProcessor;

    // Callbacks
    private onDriverSignalHandler: ((text: string) => void) | null = null;
    private onBlobDataHandler: ((blobData: ArrayBuffer, format: string, deviceName: string) => void) | null = null;

    public static getInstance(): IndiStreamProcessor {
        if (!IndiStreamProcessor.instance) {
            IndiStreamProcessor.instance = new IndiStreamProcessor();
        }
        return IndiStreamProcessor.instance;
    }

    /**
     * ハンドラー登録
     */
    public setDriverSignalHandler(handler: (text: string) => void) {
        this.onDriverSignalHandler = handler;
    }

    public setBlobDataHandler(handler: (blobData: ArrayBuffer, format: string, deviceName: string) => void) {
        this.onBlobDataHandler = handler;
    }

    /**
     * 【Block 1: 判定処理 (Classifier & Router)】
     * 受信パケットがドライバ制御信号(XMLテキスト)かBlobバイナリデータかを判定し、それぞれの処理ブロックへ振り分けます。
     */
    public processIncomingPacket(data: Uint8Array | string): void {
        if (typeof data === 'string') {
            // 文字列データは即時にドライバ信号処理へ
            this.processDriverSignal(data);
            return;
        }

        const decoder = new TextDecoder("utf-8");
        const oneBlobStart = new TextEncoder().encode('<oneBLOB');

        // ByteArray内における <oneBLOB タグの有無判定
        const blobIndex = this.findSequence(data, oneBlobStart);

        if (blobIndex === -1) {
            // Blobを含まない純粋なドライバ信号（制御XML）
            const xmlText = decoder.decode(data);
            this.processDriverSignal(xmlText);
        } else {
            // Blobデータを含むパケット
            if (blobIndex > 0) {
                // Blobタグより前のテキスト部分をドライバ信号として処理
                const textPart = data.slice(0, blobIndex);
                const xmlText = decoder.decode(textPart);
                this.processDriverSignal(xmlText);
            }

            // Blob部分をBlob処理ブロックへ引き渡し
            const blobPart = data.slice(blobIndex);
            this.processBlobPayload(blobPart);
        }
    }

    /**
     * 【Block 2: ドライバ信号処理ブロック (Driver Signal Processor)】
     * INDIの制御信号（望遠鏡位置、カメラ状態、ステータス通知など）を処理します。
     */
    public processDriverSignal(xmlText: string): void {
        if (!xmlText || xmlText.trim().length === 0) return;

        if (this.onDriverSignalHandler) {
            this.onDriverSignalHandler(xmlText);
        }
    }

    /**
     * 【Block 3: Blob処理ブロック (Blob Data Processor & Transport Link)】
     * 画像等のバイナリデータ（Blob）の解析・処理・ BlobTransportService 連携を行ないます。
     */
    public processBlobPayload(blobBuffer: Uint8Array): void {
        BlobTransportService.getInstance().processIncomingChunk(blobBuffer);

        const decoder = new TextDecoder("utf-8");
        const headerEndTag = new TextEncoder().encode('>');
        const blobEndTag = new TextEncoder().encode('</oneBLOB>');

        const headerEndIdx = this.findSequence(blobBuffer, headerEndTag);
        if (headerEndIdx === -1) return;

        const headerStr = decoder.decode(blobBuffer.slice(0, headerEndIdx + 1));
        const devName = this.getAttributeValue(headerStr, 'device') || 'Unknown';
        const format = this.getAttributeValue(headerStr, 'format') || '.fits';
        const sizeMatch = headerStr.match(/size=['"](\d+)['"]/);

        if (!sizeMatch) return;
        const declaredSize = parseInt(sizeMatch[1], 10);
        const dataStart = headerEndIdx + 1;
        const searchStart = dataStart + declaredSize;

        if (blobBuffer.length < searchStart) return;

        const closeIdx = this.findSequence(blobBuffer, blobEndTag, searchStart);
        if (closeIdx !== -1) {
            const rawBlob = blobBuffer.slice(dataStart, closeIdx);
            
            // 登録されたハンドラーで画像生成処理
            if (this.onBlobDataHandler) {
                this.onBlobDataHandler(rawBlob.buffer, format, devName);
            }
        }
    }

    /**
     * BlobTransportService への連携用メソッド
     * 独立チャンネル経由でのBlob転送を安全に有効化・接続します。
     */
    public connectDedicatedBlobChannel(settings: any) {
        const blobService = BlobTransportService.getInstance();
        return blobService.connect(settings);
    }

    /**
     * 指定デバイスのBlob受信を有効化
     */
    public enableDeviceBlob(deviceName: string) {
        BlobTransportService.getInstance().enableBlobForDevice(deviceName);
    }

    /**
     * バイト配列内の特定シーケンス検索（ヘッダー解析用）
     */
    private findSequence(buffer: Uint8Array, sequence: Uint8Array, offset: number = 0): number {
        const len = buffer.length;
        const seqLen = sequence.length;
        if (offset + seqLen > len) return -1;
        for (let i = offset; i <= len - seqLen; i++) {
            let match = true;
            for (let j = 0; j < seqLen; j++) {
                if (buffer[i + j] !== sequence[j]) {
                    match = false;
                    break;
                }
            }
            if (match) return i;
        }
        return -1;
    }

    /**
     * XML属性値抽出
     */
    private getAttributeValue(xml: string, attr: string): string | null {
        const regex = new RegExp(`${attr}\\s*=\\s*['"]([^'"]*)['"]`, 'i');
        const match = xml.match(regex);
        return match ? match[1] : null;
    }
}
