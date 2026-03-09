
/**
 * AlpacaDiscoveryService
 * ROLE: Handles discovery of Alpaca devices.
 * Since browsers cannot perform UDP discovery directly, this service 
 * provides a subnet scanning mechanism and manual entry support.
 */

export interface DiscoveryResult {
    host: string;
    port: number;
    serverName: string;
    manufacturer: string;
}

export class AlpacaDiscoveryService {
    private static instance: AlpacaDiscoveryService;
    private isScanning: boolean = false;

    public static getInstance() {
        if (!AlpacaDiscoveryService.instance) AlpacaDiscoveryService.instance = new AlpacaDiscoveryService();
        return AlpacaDiscoveryService.instance;
    }

    /**
     * Scans a specific host for Alpaca management API.
     */
    public async checkHost(host: string, port: number = 11111): Promise<DiscoveryResult | null> {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2000);

            const response = await fetch(`http://${host}:${port}/management/v1/description`, {
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);

            if (response.ok) {
                const data = await response.json();
                return {
                    host,
                    port,
                    serverName: data.Value.ServerName || 'Unknown Alpaca Server',
                    manufacturer: data.Value.Manufacturer || 'Unknown'
                };
            }
        } catch (e) {
            // Host not reachable or not an Alpaca server
        }
        return null;
    }

    /**
     * Performs a scan on the local subnet (simulated/best-effort).
     * Note: This is limited by browser security and mixed content policies.
     */
    public async scanSubnet(baseIp: string): Promise<DiscoveryResult[]> {
        if (this.isScanning) return [];
        this.isScanning = true;
        
        try {
            // Try server-side discovery first
            const response = await fetch('/api/alpaca/discover');
            if (response.ok) {
                const results = await response.json();
                if (results.length > 0) {
                    this.isScanning = false;
                    return results;
                }
            }
        } catch (e) {
            console.warn("Server-side discovery failed, falling back to subnet scan", e);
        }

        const results: DiscoveryResult[] = [];
        const parts = baseIp.split('.');
        if (parts.length !== 4) {
            this.isScanning = false;
            return [];
        }

        const subnet = `${parts[0]}.${parts[1]}.${parts[2]}`;
        const tasks = [];

        // Scan a reasonable range
        for (let i = 1; i < 255; i++) {
            const ip = `${subnet}.${i}`;
            // Common Alpaca ports
            [11111, 32227].forEach(port => {
                tasks.push(this.checkHost(ip, port).then(res => {
                    if (res) results.push(res);
                }));
            });
            
            // Limit concurrent requests to avoid browser throttling
            if (tasks.length >= 20) {
                await Promise.all(tasks);
                tasks.length = 0;
            }
        }

        await Promise.all(tasks);
        this.isScanning = false;
        return results;
    }
}

export default AlpacaDiscoveryService.getInstance();
