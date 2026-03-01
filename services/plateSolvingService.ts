import { CELESTIAL_OBJECTS } from '../constants';
import { projectWcsToPixel, hmsToDegrees, dmsToDegrees } from '../utils/coords';

export interface SolverAnnotation {
    x: number;
    y: number;
    names: string[];
    type?: string;
    radius?: number;
}

export interface CalibrationData {
    ra: number;
    dec: number;
    rotation: number;
    scale: number;
    parity: number;
    radius: number;
}

export interface SolveResult {
    success: boolean;
    annotations: SolverAnnotation[];
    calibration?: CalibrationData;
    jobId?: number;
    error?: string;
    imageWidth?: number;
    imageHeight?: number;
}

const API_BASE = "https://nova.astrometry.net/api";
const PROXY_BASE = "https://corsproxy.io/?";

const safeJson = async (res: Response) => {
    const text = await res.text();
    try {
        return JSON.parse(text);
    } catch (e) {
        const preview = text.substring(0, 100).replace(/\n/g, ' ');
        throw new Error(`Invalid API Response (Not JSON): ${preview}...`);
    }
};

const fetchWithCorsFallback = async (url: string, options: RequestInit = {}): Promise<Response> => {
    if (url.includes('nova.astrometry.net')) {
        const proxyUrl = `${PROXY_BASE}${encodeURIComponent(url)}`;
        return await fetch(proxyUrl, { ...options, mode: 'cors' });
    }
    return await fetch(url, { ...options });
};

const dataURLToBlob = (dataURL: string) => {
    try {
        const arr = dataURL.split(',');
        const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/png';
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
        }
        return new Blob([u8arr], { type: mime });
    } catch (e) {
        console.error("Error converting DataURL to Blob", e);
        return null;
    }
};

const resizeImage = (dataUrl: string, maxWidth: number = 8192): Promise<{dataUrl: string, width: number, height: number}> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "Anonymous"; 
        img.onload = () => {
            try {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                if (width > maxWidth) {
                    height = (height * maxWidth) / width;
                    width = maxWidth;
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    reject(new Error("Failed to get canvas context"));
                    return;
                }
                ctx.drawImage(img, 0, 0, width, height);
                resolve({ 
                    dataUrl: canvas.toDataURL('image/jpeg', 0.85),
                    width,
                    height
                }); 
            } catch (e) {
                reject(e);
            }
        };
        img.onerror = () => reject(new Error("Image load failed for resizing."));
        img.src = dataUrl;
    });
};

export const solveImageLocal = async (
    imageDataUrl: string,
    host: string,
    port: number,
    onStatusUpdate?: (status: string) => void
): Promise<SolveResult> => {
    try {
        if (onStatusUpdate) onStatusUpdate("Processing image...");
        const resized = await resizeImage(imageDataUrl, 8192);
        const blob = dataURLToBlob(resized.dataUrl);
        if (!blob) throw new Error("Failed to process image data.");

        if (onStatusUpdate) onStatusUpdate(`Solving (Local: ${host}:${port})...`);
        const formData = new FormData();
        formData.append('file', blob, 'image.jpg');

        const response = await fetch(`http://${host}:${port}/solve`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error(`Local solver error: ${response.status} ${response.statusText}`);
        }

        const json = await response.json();
        if (json.status === 'success') {
            const calibration = json.calibration as CalibrationData;
            const jobId = json.id || json.job_id || json.jobid;
            
            // --- アノテーション取得ロジックの改善 (getAnnotations対応) ---
            let annotations: SolverAnnotation[] = json.annotations || [];
            
            // レスポンスにアノテーションがなく、IDがある場合は追加取得を試行
            if (annotations.length === 0 && jobId) {
                try {
                    if (onStatusUpdate) onStatusUpdate("Fetching annotations from local solver...");
                    const annoRes = await fetch(`http://${host}:${port}/annotations/${jobId}`);
                    if (annoRes.ok) {
                        const annoJson = await annoRes.json();
                        if (annoJson.annotations) annotations = annoJson.annotations;
                    }
                } catch (e) {
                    console.warn("Local getAnnotations fetch skipped/failed", e);
                }
            }
            
            // それでもアノテーションがない場合の内部DBフォールバック
            if (annotations.length === 0) {
                annotations = CELESTIAL_OBJECTS.map(obj => {
                    const raDeg = hmsToDegrees(obj.ra);
                    const decDeg = dmsToDegrees(obj.dec);
                    const coords = projectWcsToPixel(raDeg, decDeg, calibration, resized.width, resized.height);
                    if (coords && coords.x >= 0 && coords.x <= resized.width && coords.y >= 0 && coords.y <= resized.height) {
                        return { x: coords.x, y: coords.y, names: [obj.name], type: obj.type, radius: 15 };
                    }
                    return null;
                }).filter(a => a !== null) as SolverAnnotation[];
            }

            return {
                success: true,
                annotations, 
                calibration: calibration,
                imageWidth: resized.width,
                imageHeight: resized.height,
                jobId: typeof jobId === 'number' ? jobId : undefined
            };
        } else {
            throw new Error(json.log || "Local solving failed.");
        }
    } catch (e: any) {
        console.error("Local Solver Error:", e);
        return {
            success: false,
            annotations: [],
            error: e.message
        };
    }
};

export const solveImageAstrometryNet = async (
    imageDataUrl: string,
    apiKey: string,
    onStatusUpdate?: (status: string) => void
): Promise<SolveResult> => {
    try {
        const cleanKey = apiKey.trim();
        if (!cleanKey) throw new Error("API Key is required.");

        if (onStatusUpdate) onStatusUpdate("Logging in...");
        const loginParams = new URLSearchParams();
        loginParams.append('request-json', JSON.stringify({ "apikey": cleanKey }));

        const loginRes = await fetchWithCorsFallback(`${API_BASE}/login`, { 
            method: 'POST', 
            body: loginParams, 
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });
        
        const loginJson = await safeJson(loginRes);
        if (loginJson.status !== 'success') throw new Error(`Login API Error: ${loginJson.message}`);
        const session = loginJson.session;

        if (onStatusUpdate) onStatusUpdate("Processing image...");
        const resized = await resizeImage(imageDataUrl, 8192); 
        const blob = dataURLToBlob(resized.dataUrl);
        if (!blob) throw new Error("Failed to process image data.");
        
        if (onStatusUpdate) onStatusUpdate("Uploading...");
        const uploadForm = new FormData();
        uploadForm.append('request-json', JSON.stringify({
            "publicly_visible": "y",
            "allow_commercial_use": "n",
            "allow_modifications": "n",
            "session": session,
            "scale_units": "degwidth",
            "scale_lower": "0.1",
            "scale_upper": "180.0",
            "downsample_factor": "2" 
        }));
        uploadForm.append('file', blob, 'image.jpg');

        const uploadRes = await fetchWithCorsFallback(`${API_BASE}/upload`, { method: 'POST', body: uploadForm });
        const uploadJson = await safeJson(uploadRes);
        if (uploadJson.status !== 'success') throw new Error(`Upload API Error: ${uploadJson.message}`);
        const subId = uploadJson.subid;

        if (onStatusUpdate) onStatusUpdate(`Waiting for Job ID (Sub: ${subId})...`);
        let jobId = null;
        let attempts = 0;
        while (!jobId && attempts < 30) {
            await new Promise(resolve => setTimeout(resolve, 2000));
            const subRes = await fetchWithCorsFallback(`${API_BASE}/submissions/${subId}?t=${Date.now()}`);
            if (subRes.ok) {
                const subData = await safeJson(subRes);
                if (subData.jobs && subData.jobs.length > 0 && subData.jobs[0]) jobId = subData.jobs[0];
            }
            attempts++;
        }
        
        if (!jobId) throw new Error("Timed out waiting for Job ID.");

        if (onStatusUpdate) onStatusUpdate(`Solving (Job: ${jobId})...`);
        let jobStatus = '';
        attempts = 0;
        while (attempts < 90) {
            await new Promise(resolve => setTimeout(resolve, 2000));
            const jobRes = await fetchWithCorsFallback(`${API_BASE}/jobs/${jobId}?t=${Date.now()}`);
            if (jobRes.ok) {
                const jobData = await safeJson(jobRes);
                jobStatus = jobData.status;
                if (jobStatus === 'success') break;
                if (jobStatus === 'failure') throw new Error("Plate solving failed on server.");
            }
            attempts++;
        }
        
        if (jobStatus !== 'success') throw new Error("Plate solving timed out.");

        if (onStatusUpdate) onStatusUpdate("Fetching results...");
        let annotations: SolverAnnotation[] = [];
        let calibration: CalibrationData | undefined;

        try {
            const annoRes = await fetchWithCorsFallback(`${API_BASE}/jobs/${jobId}/annotations`);
            if (annoRes.ok) {
                const annoData = await safeJson(annoRes);
                if (annoData.annotations) {
                     annotations = annoData.annotations.map((a: any) => ({
                         x: a.pixelx, y: a.pixely, names: a.names || [], type: a.type, radius: a.radius
                     }));
                }
            }
        } catch (e) { }

        try {
            const calRes = await fetchWithCorsFallback(`${API_BASE}/jobs/${jobId}/calibration`);
            if (calRes.ok) {
                const calData = await safeJson(calRes);
                calibration = {
                    ra: calData.ra, dec: calData.dec, rotation: calData.orientation,
                    scale: calData.pixscale, parity: calData.parity, radius: calData.radius
                };
            }
        } catch (e) { }

        return {
            success: true,
            annotations,
            calibration,
            jobId,
            imageWidth: resized.width,
            imageHeight: resized.height
        };

    } catch (error: any) {
        console.error("Plate Solving Error:", error);
        return {
            success: false,
            annotations: [],
            error: error.message
        };
    }
};

export enum PlateSolverType {
    LOCAL = 'LOCAL',
    ASTROMETRY_NET = 'ASTROMETRY_NET'
}