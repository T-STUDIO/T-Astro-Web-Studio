import { raDecToAzAlt, azAltToRaDec, projectStereographic } from '../utils/coords';

export interface GlobalTile {
  key: string;
  ra: number;
  dec: number;
  fov: number;
  canvas: HTMLCanvasElement;
}

class GlobalDssService {
  private cache: Map<string, GlobalTile> = new Map();
  private loadingKeys: Set<string> = new Set();
  private queuedKeys: Set<string> = new Set();
  private queue: Array<{ ra: number; dec: number }> = [];
  private activeCount = 0;
  private readonly MAX_CONCURRENT = 4;
  private onUpdateListeners: Array<() => void> = [];
  private gridRaStep = 20;  // RA grid step in degrees
  private gridDecStep = 20; // DEC grid step in degrees
  private tileFov = 25;     // Base tile FOV in degrees

  /**
   * Register listener for tile load updates
   */
  public subscribeUpdate(listener: () => void): () => void {
    this.onUpdateListeners.push(listener);
    return () => {
      this.onUpdateListeners = this.onUpdateListeners.filter(l => l !== listener);
    };
  }

  private notifyUpdate(): void {
    this.onUpdateListeners.forEach(cb => {
      try { cb(); } catch (e) {}
    });
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('dss-tile-loaded'));
    }
  }

  /**
   * Process and colorize raw DSS image for astronomical aesthetic
   */
  private processTileImage(img: HTMLImageElement): Promise<HTMLCanvasElement> {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const width = img.naturalWidth || 512;
      const height = img.naturalHeight || 512;
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(canvas);
        return;
      }

      ctx.drawImage(img, 0, 0);

      try {
        const imgData = ctx.getImageData(0, 0, width, height);
        const data = imgData.data;

        // Check if error image (high cyan component)
        let cyanPixels = 0;
        const cyanStep = 8;
        let sampleCount = 0;
        for (let i = 0; i < data.length; i += 4 * cyanStep) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          sampleCount++;
          if (g > 70 && b > 70 && r < g * 0.7 && Math.abs(g - b) < 45) {
            cyanPixels++;
          }
        }
        if (cyanPixels / sampleCount > 0.18) {
          (canvas as any)._isError = true;
          resolve(canvas);
          return;
        }

        // Negative check
        const corners = [
          0,
          (width - 1) * 4,
          (height - 1) * width * 4,
          ((height - 1) * width + (width - 1)) * 4
        ];
        let bgBrightness = 0;
        for (const offset of corners) {
          bgBrightness += (data[offset] * 299 + data[offset + 1] * 587 + data[offset + 2] * 114) / 1000;
        }
        const isNegative = (bgBrightness / 4) > 110;

        if (isNegative) {
          for (let i = 0; i < data.length; i += 4) {
            data[i] = 255 - data[i];
            data[i + 1] = 255 - data[i + 1];
            data[i + 2] = 255 - data[i + 2];
          }
        }

        // Noise gate & Luma adjustments
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const luma = (r * 299 + g * 587 + b * 114) / 1000;
          if (luma < 45) {
            const factor = Math.max(0, (luma - 10) / 35);
            data[i] = Math.round(r * factor);
            data[i + 1] = Math.round(g * factor);
            data[i + 2] = Math.round(b * factor);
          }
        }

        // Astronomical colorization
        let isMonochrome = true;
        const checkStep = 16;
        for (let i = 0; i < data.length; i += 4 * checkStep) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          if (Math.abs(r - g) > 20 || Math.abs(g - b) > 20 || Math.abs(r - b) > 20) {
            isMonochrome = false;
            break;
          }
        }

        if (isMonochrome) {
          for (let i = 0; i < data.length; i += 4) {
            const luma = data[i];
            if (luma < 30) {
              const factor = luma / 30;
              data[i] = Math.round(6 * factor);
              data[i + 1] = Math.round(10 * factor);
              data[i + 2] = Math.round(28 * factor);
            } else if (luma < 90) {
              const factor = (luma - 30) / 60;
              data[i] = Math.round(6 + 34 * factor);
              data[i + 1] = Math.round(10 + 80 * factor);
              data[i + 2] = Math.round(28 + 162 * factor);
            } else if (luma < 180) {
              const factor = (luma - 90) / 90;
              data[i] = Math.round(40 + 160 * factor);
              data[i + 1] = Math.round(90 + 115 * factor);
              data[i + 2] = Math.round(190 + 55 * factor);
            } else {
              const factor = (luma - 180) / 75;
              data[i] = Math.round(200 + 55 * factor);
              data[i + 1] = Math.round(205 + 50 * factor);
              data[i + 2] = 255;
            }
          }
        }

        ctx.putImageData(imgData, 0, 0);
        resolve(canvas);
      } catch (e) {
        resolve(canvas);
      }
    });
  }

  /**
   * Enqueue tile load request with concurrent throttling
   */
  public preloadTile(ra: number, dec: number): void {
    const key = `global_${ra}_${dec}`;
    if (this.cache.has(key) || this.loadingKeys.has(key) || this.queuedKeys.has(key)) return;

    this.queuedKeys.add(key);
    this.queue.push({ ra, dec });
    this.processQueue();
  }

  private processQueue(): void {
    while (this.activeCount < this.MAX_CONCURRENT && this.queue.length > 0) {
      const task = this.queue.shift();
      if (!task) break;
      this.activeCount++;
      this.fetchAndProcessTile(task.ra, task.dec).finally(() => {
        this.activeCount--;
        this.processQueue();
      });
    }
  }

  private async fetchAndProcessTile(ra: number, dec: number): Promise<void> {
    const key = `global_${ra}_${dec}`;
    this.queuedKeys.delete(key);
    this.loadingKeys.add(key);

    try {
      const url = `/api/dss/proxy?ra=${ra}&dec=${dec}&fov=${this.tileFov}&pixels=512&source=aladin`;
      const img = new Image();
      img.crossOrigin = 'anonymous';

      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Failed to load tile'));
        img.src = url;
      });

      const processedCanvas = await this.processTileImage(img);
      if (!(processedCanvas as any)._isError) {
        this.cache.set(key, {
          key,
          ra,
          dec,
          fov: this.tileFov,
          canvas: processedCanvas
        });
        this.notifyUpdate();
      }
    } catch (e) {
      // Ignore background fetch error gracefully
    } finally {
      this.loadingKeys.delete(key);
    }
  }

  /**
   * Preload all global sky grid tiles iteratively, optionally prioritizing center coordinate
   */
  public preloadGlobalMap(centerRa?: number, centerDec?: number): void {
    const tiles: Array<{ ra: number; dec: number; dist: number }> = [];
    for (let dec = -80; dec <= 80; dec += this.gridDecStep) {
      for (let ra = 0; ra < 360; ra += this.gridRaStep) {
        let dist = 0;
        if (centerRa !== undefined && centerDec !== undefined) {
          let dra = Math.abs(ra - centerRa);
          if (dra > 180) dra = 360 - dra;
          const ddec = dec - centerDec;
          dist = Math.hypot(dra * Math.cos(centerDec * Math.PI / 180), ddec);
        }
        tiles.push({ ra, dec, dist });
      }
    }

    if (centerRa !== undefined && centerDec !== undefined) {
      // Sort so tiles closest to current center are loaded first
      tiles.sort((a, b) => a.dist - b.dist);
    }

    tiles.forEach(t => this.preloadTile(t.ra, t.dec));
  }

  /**
   * Render cached global DSS tiles onto the planetarium canvas
   */
  public renderGlobalMap(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    zoom: number,
    viewAz: number,
    viewAlt: number,
    latitude: number,
    lst: number
  ): void {
    const center = { x: 0, y: 0 };

    // Request missing nearby tiles around current view center
    const currentCenter = azAltToRaDec(viewAz, viewAlt, latitude, lst);
    const approxRa = Math.round(currentCenter.ra / this.gridRaStep) * this.gridRaStep;
    const approxDec = Math.round(currentCenter.dec / this.gridDecStep) * this.gridDecStep;

    for (let dDec = -20; dDec <= 20; dDec += this.gridDecStep) {
      for (let dRa = -20; dRa <= 20; dRa += this.gridRaStep) {
        const targetRa = (approxRa + dRa + 360) % 360;
        const targetDec = Math.max(-80, Math.min(80, approxDec + dDec));
        this.preloadTile(targetRa, targetDec);
      }
    }

    // Render visible tiles
    this.cache.forEach((tile) => {
      try {
        const { alt, az } = raDecToAzAlt(tile.ra, tile.dec, latitude, lst);
        const p = projectStereographic(alt, az, width, height, zoom, center, viewAlt, viewAz);

        if (p) {
          const rad = Math.PI / 180;
          const lambda = az * rad;
          const phi = alt * rad;
          const lambda0 = viewAz * rad;
          const phi0 = viewAlt * rad;
          const cosC = Math.max(0.1, Math.sin(phi0) * Math.sin(phi) + Math.cos(phi0) * Math.cos(phi) * Math.cos(lambda - lambda0));
          const kTile = 2 / (1 + cosC);

          const baseScale = Math.min(width, height) / 2;
          const pixelsPerDegree = baseScale * zoom * (Math.PI / 180);
          const dssSizeInPixels = tile.fov * pixelsPerDegree * kTile * 1.02 + 2;

          const halfSize = dssSizeInPixels / 2;
          if (p.x + halfSize < 0 || p.x - halfSize > width || p.y + halfSize < 0 || p.y - halfSize > height) {
            return;
          }

          ctx.save();
          ctx.translate(p.x, p.y);

          const northPoint = raDecToAzAlt(tile.ra, Math.min(89.9, tile.dec + 0.1), latitude, lst);
          const pNorth = projectStereographic(northPoint.alt, northPoint.az, width, height, zoom, center, viewAlt, viewAz);
          if (pNorth) {
            const dx = pNorth.x - p.x;
            const dy = pNorth.y - p.y;
            if (Math.hypot(dx, dy) > 0.001) {
              const angle = Math.atan2(dy, dx) + Math.PI / 2;
              if (!isNaN(angle)) {
                ctx.rotate(angle);
              }
            }
          }

          ctx.globalAlpha = 0.95;
          ctx.globalCompositeOperation = 'source-over';
          ctx.drawImage(tile.canvas, -halfSize, -halfSize, dssSizeInPixels, dssSizeInPixels);

          ctx.restore();
        }
      } catch (e) {
        // Safe skip for single tile rendering errors
      }
    });
  }

  /**
   * Clear cache when DSS is turned off
   */
  public clearCache(): void {
    this.cache.clear();
    this.loadingKeys.clear();
    this.queuedKeys.clear();
    this.queue = [];
  }
}

export const globalDssService = new GlobalDssService();
