/**
 * T-Astro Observation Broadcast Service
 * ROLE: Image relay between main app and viewer.
 */
export class BroadcastService {
    private static instance: BroadcastService;
    private channel: BroadcastChannel;
    private onImageReceived: ((url: string, metadata?: any) => void) | null = null;

    private constructor() {
        this.channel = new BroadcastChannel('t-astro-broadcast');
        this.channel.onmessage = (event) => {
            if (event.data.type === 'IMAGE_UPDATE' && this.onImageReceived) {
                this.onImageReceived(event.data.url, event.data.metadata);
            }
        };
    }

    public static getInstance() {
        if (!BroadcastService.instance) BroadcastService.instance = new BroadcastService();
        return BroadcastService.instance;
    }

    /**
     * メインアプリから画像を送信する
     */
    public sendImage(url: string, metadata?: any) {
        this.channel.postMessage({ type: 'IMAGE_UPDATE', url, metadata });
    }

    /**
     * ビューアーで画像を受信する
     */
    public setOnImageReceived(callback: (url: string, metadata?: any) => void) {
        this.onImageReceived = callback;
    }
}
