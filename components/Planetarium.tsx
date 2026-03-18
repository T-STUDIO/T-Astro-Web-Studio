
import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { CelestialObject, SlewStatus, PlanetariumSettings, LocationData, TelescopePosition } from '../types';
import { CELESTIAL_OBJECTS, CONSTELLATIONS } from '../constants';
import { calculateLST, hmsToDegrees, dmsToDegrees, raDecToAzAlt, projectStereographic, calculateTransitTime, azAltToRaDec } from '../utils/coords';
import { ZoomInIcon } from './icons/ZoomInIcon';
import { ZoomOutIcon } from './icons/ZoomOutIcon';
import { ResetIcon } from './icons/ResetIcon';
import { SearchIcon } from './icons/SearchIcon';
import { CrosshairIcon } from './icons/CrosshairIcon';
import { StarIcon } from './icons/StarIcon';
import { TelescopeIcon } from './icons/TelescopeIcon';
import { useTranslation } from '../contexts/LanguageContext';
import { getRealStarCatalog } from '../utils/starCatalog';
import { BACKGROUND_STARS } from '../utils/starGenerator';
import { EXTENDED_DSO_CATALOG } from '../utils/dsoCatalog';
import { MILKY_WAY_POINTS } from '../utils/milkyWayGenerator';
import { Button } from './Button';
import { CelestialObjectHUD } from './CelestialObjectHUD';

declare global {
    interface Window {
        wwtlib: any;
    }
}

interface PlanetariumProps {
  onSelectObject?: (object: CelestialObject | null) => void;
  onShowInfo?: (objectName: string) => void; 
  selectedObject: CelestialObject | null;
  slewStatus: SlewStatus;
  settings: PlanetariumSettings;
  location?: LocationData | null;
  localTime?: Date | null;
  centerRequest?: number;
  isConnected: boolean;
  onSlew?: () => void;
  onCenter?: (object: CelestialObject) => void;
  telescopePosition?: TelescopePosition | null;
  isMini?: boolean; 
  isAutoCenterEnabled?: boolean;
  onToggleAutoCenter?: (enabled: boolean) => void;
  MountController?: React.ComponentType<any>;
}

interface HitRegion {
    x: number;
    y: number;
    radius: number;
    object: CelestialObject;
}

const REAL_STARS = getRealStarCatalog();

const getStarColor = (mag: number, index: number, overrideColor?: string) => {
    if (overrideColor) return overrideColor;
    if (mag > 4.5) return '#2e2e2e';
    const colors = ['#99CCFF', '#E0EBFF', '#FBF8FF', '#FFF4E8', '#FFD1A3', '#FF9980'];
    if (mag > 10) return '#FFFFFF'; 
    return colors[index % colors.length];
};

const getDistance = (touch1: React.Touch, touch2: React.Touch) => {
    return Math.hypot(touch1.clientX - touch2.clientX, touch1.clientY - touch2.clientY);
};

export const Planetarium: React.FC<PlanetariumProps> = ({
    onSelectObject,
    onShowInfo,
    selectedObject, 
    slewStatus, 
    settings,
    location,
    localTime,
    centerRequest,
    isConnected,
    onSlew,
    onCenter,
    telescopePosition,
    isMini = false,
    isAutoCenterEnabled,
    onToggleAutoCenter,
  MountController
}) => {
    const { t, language } = useTranslation();
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const hitRegions = useRef<HitRegion[]>([]);
    
    const [viewAz, setViewAz] = useState(0); 
    const [viewAlt, setViewAlt] = useState(30);  
    const [zoom, setZoom] = useState(60 / 70); 

    const [recommendedMode, setRecommendedMode] = useState(false);
    
    const [isDragging, setIsDragging] = useState(false);
    const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });
    const clickStartTimeRef = useRef(0);
    const lastClickTimeRef = useRef(0); 
    const [cursor, setCursor] = useState('default');
    
    const lastPinchDist = useRef<number | null>(null);
    const wwtControlRef = useRef<any>(null);
    const [wwtInitialized, setWwtInitialized] = useState(false);
    const [dssTiles, setDssTiles] = useState<{ image: HTMLImageElement, metadata: { ra: number, dec: number, fov: number } }[]>([]);
    const [dssLoading, setDssLoading] = useState(false);
    const lastDssParams = useRef({ ra: -1, dec: -1, zoom: -1 });
    const [searchQuery, setSearchQuery] = useState('');

    const effLocation = location || { latitude: 35.6, longitude: 139.6 };
    const effTime = localTime || new Date();

    const constellationStarIds = useMemo(() => {
        const ids = new Set<string>();
        CONSTELLATIONS.forEach(c => {
            c.lines.forEach(l => { ids.add(l.from); ids.add(l.to); });
        });
        return ids;
    }, []);

    const curatedObjectIds = useMemo(() => new Set(CELESTIAL_OBJECTS.map(o => o.id)), []);

    const milkyWaySprite = useMemo(() => {
        if (typeof document === 'undefined') return null;
        const size = 64; const half = size / 2;
        const c = document.createElement('canvas'); c.width = size; c.height = size;
        const ctx = c.getContext('2d'); if (!ctx) return null;
        const grad = ctx.createRadialGradient(half, half, 0, half, half, half);
        grad.addColorStop(0, 'rgba(210, 210, 230, 0.01)'); 
        grad.addColorStop(0.3, 'rgba(200, 200, 220, 0.005)');
        grad.addColorStop(0.7, 'rgba(190, 190, 210, 0.001)');
        grad.addColorStop(1, 'rgba(180, 180, 200, 0)');
        ctx.fillStyle = grad; ctx.fillRect(0, 0, size, size);
        return c;
    }, []);

    const staticData = useMemo(() => {
        const uniqueRealStars = REAL_STARS.filter(r => {
            const rRa = hmsToDegrees(r.ra); const rDec = dmsToDegrees(r.dec);
            return !CELESTIAL_OBJECTS.some(c => {
                if (c.type !== 'Star' && c.type !== 'Planet') return false; 
                const cRa = hmsToDegrees(c.ra); const cDec = dmsToDegrees(c.dec);
                let diffRa = Math.abs(rRa - cRa); if (diffRa > 180) diffRa = 360 - diffRa;
                const diffDec = Math.abs(rDec - cDec); return diffDec < 0.2 && diffRa < 0.2;
            });
        });
        const process = (list: CelestialObject[]) => list.map(o => ({ ...o, raDeg: hmsToDegrees(o.ra), decDeg: dmsToDegrees(o.dec) }));
        return { priorityObjects: process([...CELESTIAL_OBJECTS, ...uniqueRealStars]).sort((a, b) => b.magnitude - a.magnitude), dsoObjects: process(EXTENDED_DSO_CATALOG), backgroundStars: process(BACKGROUND_STARS) };
    }, []);

    const handleSearch = useCallback(() => {
        if (!searchQuery.trim()) return;
        const q = searchQuery.toLowerCase().trim();
        const allObjects = [...staticData.priorityObjects, ...staticData.dsoObjects];
        const match = allObjects.find(obj => 
            obj.name.toLowerCase() === q || 
            (obj.nameJa && obj.nameJa.toLowerCase() === q) ||
            obj.id.toLowerCase() === q ||
            (obj.nameJa && obj.nameJa.toLowerCase().includes(q)) ||
            obj.name.toLowerCase().includes(q)
        );

        if (match) {
            if (onSelectObject) onSelectObject(match as any);
            const lst = calculateLST(effLocation.longitude, effTime);
            const { alt, az } = raDecToAzAlt(match.raDeg, match.decDeg, effLocation.latitude, lst);
            setViewAz(az); setViewAlt(alt);
        }
    }, [searchQuery, staticData, onSelectObject, effLocation, effTime]);

    useEffect(() => {
        if (!containerRef.current) return;
        const observer = new ResizeObserver((entries) => {
            const { width, height } = entries[0].contentRect;
            if (width > 0 && height > 0) {
                setDimensions({ width, height });
            }
        });
        observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, []);

    const fetchDssImage = useCallback(async (ra: number, dec: number, fov: number) => {
        setDssLoading(true);
        const targetUrl = `https://aladin.cds.unistra.fr/AladinLite/export/nph-export.cgi?ra=${ra}&dec=${dec}&fov=${fov}&width=512&height=512&survey=P%2FDSS2%2Fcolor&format=jpg`;
        const proxyUrl = `/api/dss/proxy?url=${encodeURIComponent(targetUrl)}`;

        const loadImage = (url: string, isProxy: boolean): Promise<HTMLImageElement> => {
            return new Promise((resolve, reject) => {
                const img = new Image();
                img.crossOrigin = 'anonymous';
                const timeout = setTimeout(() => {
                    reject(new Error(`Image load timeout (${isProxy ? 'proxy' : 'direct'})`));
                    img.src = ''; // Abort image loading
                }, 15000); // 15秒のタイムアウト

                img.onload = () => {
                    clearTimeout(timeout);
                    resolve(img);
                };
                img.onerror = () => {
                    clearTimeout(timeout);
                    reject(new Error(`Image load error (${isProxy ? 'proxy' : 'direct'})`));
                };
                img.src = url;
            });
        };

        let image: HTMLImageElement | null = null;
        let attempt = 0;
        const maxAttempts = 3;

        while (attempt < maxAttempts) {
            attempt++;
            try {
                console.log(`[DSS] Attempt ${attempt}: Trying direct load for ${targetUrl}`);
                image = await loadImage(targetUrl, false);
                console.log(`[DSS] ✓ Direct load succeeded for ${targetUrl}`);
                break;
            } catch (directErr: any) {
                console.warn(`[DSS] Attempt ${attempt}: Direct load failed for ${targetUrl}: ${directErr.message}`);
                try {
                    console.log(`[DSS] Attempt ${attempt}: Trying proxy load for ${proxyUrl}`);
                    image = await loadImage(proxyUrl, true);
                    console.log(`[DSS] ✓ Proxy load succeeded for ${proxyUrl}`);
                    break;
                } catch (proxyErr: any) {
                    console.warn(`[DSS] Attempt ${attempt}: Proxy load failed for ${proxyUrl}: ${proxyErr.message}`);
                    if (attempt < maxAttempts) {
                        console.log(`[DSS] Retrying in 2 seconds...`);
                        await new Promise(resolve => setTimeout(resolve, 2000));
                    }
                }
            }
        }

        setDssLoading(false);

        if (image) {
            setDssTiles(prev => [...prev, { image, metadata: { ra, dec, fov } }]);
        } else {
            console.error(`[DSS] All attempts failed for ${targetUrl}`);
        }
    }, []);

    useEffect(() => {
        if (!canvasRef.current || dimensions.width === 0 || dimensions.height === 0) return;
        const canvas = canvasRef.current; const ctx = canvas.getContext('2d', { alpha: true }); if (!ctx) return;
        const dpr = window.devicePixelRatio || 1; canvas.width = dimensions.width * dpr; canvas.height = dimensions.height * dpr; ctx.scale(dpr, dpr);
        hitRegions.current = [];
        const lst = calculateLST(effLocation.longitude, effTime); const center = { x: 0, y: 0 }; const width = dimensions.width; const height = dimensions.height;
        const zoomFactor = Math.log2(Math.max(1, zoom)); const dynamicStarMagLimit = settings.starMagLimit + (zoomFactor * 1.5);
        const calcDsoLimit = 5.0 + 2.5 * Math.log2(Math.max(0.5, zoom) / 0.5); const dynamicDsoMagLimit = Math.min(settings.dsoMagLimit, calcDsoLimit);
        const starMap = new Map<string, {x: number, y: number}>();
        ctx.clearRect(0, 0, width, height);
        
        // Always fill background initially to avoid transparency issues
        // If WWT is active, it will be rendered behind this canvas
        // We only use transparent background if WWT is actually initialized and ready
        // If DSS is enabled, we only fill if no tiles are loaded yet
        if (!settings.showDSS || isMini || (!wwtInitialized && dssTiles.length === 0)) {
            ctx.fillStyle = '#020617';
            ctx.fillRect(0, 0, width, height);
        }

        if (!isMini && settings.showDSS && wwtInitialized && wwtControlRef.current) {
            const wwtCenter = azAltToRaDec(viewAz, viewAlt, effLocation.latitude, lst);
            const fov = 60 / zoom;
            if (!isNaN(wwtCenter.ra) && !isNaN(wwtCenter.dec)) { try { wwtControlRef.current.gotoRaDecZoom(wwtCenter.ra / 15, wwtCenter.dec, fov, false); } catch (e) { } }
        }

        // DSS rendering
        if (!isMini && settings.showDSS && dssTiles.length > 0) {
            ctx.save();
            ctx.globalAlpha = 1.0;
            
            for (const tile of dssTiles) {
                try {
                    const { alt, az } = raDecToAzAlt(tile.metadata.ra, tile.metadata.dec, effLocation.latitude, lst);
                    const p = projectStereographic(alt, az, width, height, zoom, center, viewAlt, viewAz);
                    
                    if (p) {
                        const viewFov = 60 / zoom;
                        const pixelsPerDegree = Math.min(width, height) / viewFov;
                        const dssSizeInPixels = tile.metadata.fov * pixelsPerDegree;
                        
                        ctx.save();
                        ctx.translate(p.x, p.y);
                        
                        // Calculate rotation to match North orientation
                        const northPoint = raDecToAzAlt(tile.metadata.ra, Math.min(89.9, tile.metadata.dec + 0.1), effLocation.latitude, lst);
                        const pNorth = projectStereographic(northPoint.alt, northPoint.az, width, height, zoom, center, viewAlt, viewAz);
                        if (pNorth) {
                            const angleRad = Math.atan2(pNorth.y - p.y, pNorth.x - p.x) + Math.PI / 2; // Add 90 degrees to align North up
                            ctx.rotate(angleRad);
                        }
                        
                        ctx.drawImage(tile.image, -dssSizeInPixels / 2, -dssSizeInPixels / 2, dssSizeInPixels, dssSizeInPixels);
                        ctx.restore();
                    }
                } catch (e) {
                    console.error("[DSS] Error rendering tile:", e);
                }
            }
            ctx.restore();
        }

        // Milky Way rendering
        if (settings.showMilkyWay && milkyWaySprite && !isMini) {
            ctx.save();
            ctx.globalCompositeOperation = 'lighter'; // Use lighter for a glowing effect
            ctx.globalAlpha = 0.05; // Overall opacity

            MILKY_WAY_POINTS.forEach(point => {
                const { alt, az } = raDecToAzAlt(point.ra, point.dec, effLocation.latitude, lst);
                if (alt > -20) { // Render if above -20 degrees altitude
                    const p = projectStereographic(alt, az, width, height, zoom, center, viewAlt, viewAz);
                    if (p) {
                        const size = (point.brightness * 0.5 + 0.5) * (80 / zoom); // Scale with zoom
                        ctx.drawImage(milkyWaySprite, p.x - size / 2, p.y - size / 2, size, size);
                    }
                }
            });
            ctx.restore();
        }

        // Render celestial objects
        const renderObject = (obj: CelestialObject, isBackground: boolean) => {
            const { alt, az } = raDecToAzAlt(obj.raDeg, obj.decDeg, effLocation.latitude, lst);
            if (alt < -10) return; // Don't render objects below -10 degrees altitude

            const p = projectStereographic(alt, az, width, height, zoom, center, viewAlt, viewAz);
            if (!p) return;

            const isSelected = selectedObject && selectedObject.id === obj.id;
            const isCurated = curatedObjectIds.has(obj.id);
            const isDSO = obj.type === 'Nebula' || obj.type === 'Galaxy' || obj.type === 'Star Cluster';

            let radius = 3; // Default radius
            let color = getStarColor(obj.magnitude, obj.id.charCodeAt(0));

            if (isDSO) {
                if (obj.magnitude > dynamicDsoMagLimit) return; // Filter faint DSOs
                radius = 5 + (dynamicDsoMagLimit - obj.magnitude) * 2; // Scale DSO size by magnitude
                color = '#FFD700'; // Gold for DSOs
            } else if (obj.type === 'Planet') {
                radius = 7; // Planets are larger
                color = '#87CEEB'; // Light blue for planets
            } else if (obj.type === 'Star') {
                if (obj.magnitude > dynamicStarMagLimit) return; // Filter faint stars
                radius = Math.max(1, 5 - obj.magnitude); // Scale star size by magnitude
                if (isSelected) radius = 8; // Selected star is larger
            }

            if (isSelected) color = '#f87171'; // Red for selected object

            // Draw hit region for interaction
            hitRegions.current.push({ x: p.x, y: p.y, radius: radius + 5, object: obj });

            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
            ctx.fill();

            if (isDSO) {
                ctx.strokeStyle = color; ctx.lineWidth = 1.5;
                if (obj.type === 'Nebula') ctx.strokeRect(p.x - radius, p.y - radius, radius * 2, radius * 2);
                else { ctx.beginPath(); if(obj.type === 'Star Cluster') ctx.setLineDash([3, 2]); ctx.arc(p.x, p.y, radius, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); }
            } else {
                if (obj.magnitude < 0.5) { ctx.save(); const glow = ctx.createRadialGradient(p.x, p.y, radius * 0.5, p.x, p.y, radius * 3); glow.addColorStop(0, color); glow.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = glow; ctx.globalAlpha = 0.3; ctx.beginPath(); ctx.arc(p.x, p.y, radius * 3, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
                ctx.fillStyle = color; ctx.beginPath(); ctx.arc(p.x, p.y, radius, 0, Math.PI * 2); ctx.fill();
            }
            let showLabel = isSelected || (recommendedMode && isCurated && !isBackground) ||
                           (!isMini && ((isDSO && settings.showDSOLabels && (curatedObjectIds.has(obj.id) || zoom > 3.0)) || 
                               (!isDSO && obj.type !== 'Planet' && settings.showStarLabels && !isBackground && (obj.magnitude <= 2.0 || (obj.magnitude < 3.5 && zoom > 2.0))) || 
                               (obj.type === 'Planet' && settings.showStarLabels)));
            if (showLabel) {
                const isImportant = isSelected || isCurated; 
                ctx.font = `${isImportant ? 'bold' : ''} ${isImportant ? 12 : 10}px sans-serif`;
                const name = language === 'ja' && obj.nameJa ? obj.nameJa : obj.name; 
                ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; 
                ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)'; ctx.lineWidth = 3; ctx.strokeText(name, p.x + radius + 8, p.y); 
                ctx.fillStyle = isSelected ? '#f87171' : (recommendedMode && isCurated) ? '#fbbf24' : '#e2e8f0'; ctx.fillText(name, p.x + radius + 8, p.y);
            }
        };
        staticData.backgroundStars.forEach(o => renderObject(o, true)); staticData.dsoObjects.forEach(o => renderObject(o, false)); staticData.priorityObjects.forEach(o => renderObject(o, false));
        if (settings.showConstellationLines) {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)'; ctx.lineWidth = 1; ctx.beginPath();
            CONSTELLATIONS.forEach(c => c.lines.forEach(line => { const p1 = starMap.get(line.from); const p2 = starMap.get(line.to); if (p1 && p2) { ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); } }));
            ctx.stroke();
        }
        if (settings.showConstellationLabels && !isMini) {
            ctx.font = 'italic 12px sans-serif'; ctx.fillStyle = 'rgba(255, 255, 255, 0.4)'; ctx.textAlign = 'center';
            CONSTELLATIONS.forEach(c => {
                const starId = c.lines[0]?.from; const p = starMap.get(starId);
                if (p && p.x > 0 && p.x < width && p.y > 0 && p.y < height) {
                    const name = language === 'ja' ? c.nameJa : c.name; ctx.fillText(name, p.x, p.y - 20);
                }
            });
        }
        if (telescopePosition && isConnected) {
            const { alt: tAlt, az: tAz } = raDecToAzAlt(telescopePosition.ra, telescopePosition.dec, effLocation.latitude, lst);
            const tp = projectStereographic(tAlt, tAz, width, height, zoom, center, viewAlt, viewAz);
            if (tp) {
                ctx.fillStyle = 'lime';
                ctx.beginPath();
                ctx.arc(tp.x, tp.y, 7, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = 'lime';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(tp.x - 15, tp.y);
                ctx.lineTo(tp.x + 15, tp.y);
                ctx.moveTo(tp.x, tp.y - 15);
                ctx.lineTo(tp.x, tp.y + 15);
                ctx.stroke();
            }
        }

        // Handle clicks and drags
        const getObjectAtPoint = (x: number, y: number): CelestialObject | null => {
            for (const region of hitRegions.current) {
                const dist = Math.sqrt(Math.pow(x - region.x, 2) + Math.pow(y - region.y, 2));
                if (dist < region.radius) {
                    return region.object;
                }
            }
            return null;
        };

        const handleMouseDown = (e: React.MouseEvent) => {
            setIsDragging(true);
            setLastMousePos({ x: e.clientX, y: e.clientY });
            clickStartTimeRef.current = Date.now();
        };

        const handleMouseMove = (e: React.MouseEvent) => {
            if (!isDragging) return;
            const dx = e.clientX - lastMousePos.x;
            const dy = e.clientY - lastMousePos.y;
            setLastMousePos({ x: e.clientX, y: e.clientY });

            const sensitivity = 0.1; 
            setViewAz(prev => (prev - dx * sensitivity + 360) % 360);
            setViewAlt(prev => Math.max(-90, Math.min(90, prev + dy * sensitivity)));
        };

        const handleMouseUp = (e: React.MouseEvent) => {
            setIsDragging(false);
            const clickDuration = Date.now() - clickStartTimeRef.current;
            if (clickDuration < 200) { // Treat as a click if duration is short
                const rect = canvas.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                const clickedObject = getObjectAtPoint(x, y);
                if (onSelectObject) onSelectObject(clickedObject);
            }
        };

        const handleMouseLeave = () => {
            setIsDragging(false);
        };

        const handleDoubleClick = (e: React.MouseEvent) => {
            const rect = canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const clickedObject = getObjectAtPoint(x, y);
            if (clickedObject && onCenter) {
                onCenter(clickedObject);
            }
        };

        const handleWheel = (e: React.WheelEvent) => {
            e.preventDefault();
            const zoomAmount = e.deltaY * -0.001; 
            setZoom(prev => Math.max(0.1, Math.min(100, prev * Math.exp(zoomAmount))));
        };

        const handleTouchStart = (e: React.TouchEvent) => {
            if (e.touches.length === 1) {
                setIsDragging(true);
                setLastMousePos({ x: e.touches[0].clientX, y: e.touches[0].clientY });
                clickStartTimeRef.current = Date.now();
            } else if (e.touches.length === 2) {
                lastPinchDist.current = getDistance(e.touches[0], e.touches[1]);
            }
        };

        const handleTouchMove = (e: React.TouchEvent) => {
            e.preventDefault();
            if (e.touches.length === 1 && isDragging) {
                const dx = e.touches[0].clientX - lastMousePos.x;
                const dy = e.touches[0].clientY - lastMousePos.y;
                setLastMousePos({ x: e.touches[0].clientX, y: e.touches[0].clientY });

                const sensitivity = 0.1; 
                setViewAz(prev => (prev - dx * sensitivity + 360) % 360);
                setViewAlt(prev => Math.max(-90, Math.min(90, prev + dy * sensitivity)));
            } else if (e.touches.length === 2 && lastPinchDist.current) {
                const currentPinchDist = getDistance(e.touches[0], e.touches[1]);
                const pinchDiff = currentPinchDist - lastPinchDist.current;
                lastPinchDist.current = currentPinchDist;

                const zoomAmount = pinchDiff * 0.005; 
                setZoom(prev => Math.max(0.1, Math.min(100, prev * Math.exp(zoomAmount))));
            }
        };

        const handleTouchEnd = (e: React.TouchEvent) => {
            setIsDragging(false);
            lastPinchDist.current = null;
            const clickDuration = Date.now() - clickStartTimeRef.current;
            if (clickDuration < 200 && e.changedTouches.length === 1) { 
                const rect = canvas.getBoundingClientRect();
                const x = e.changedTouches[0].clientX - rect.left;
                const y = e.changedTouches[0].clientY - rect.top;
                const clickedObject = getObjectAtPoint(x, y);
                if (onSelectObject) onSelectObject(clickedObject);
            }
        };

        canvas.addEventListener('mousedown', handleMouseDown);
        canvas.addEventListener('mousemove', handleMouseMove);
        canvas.addEventListener('mouseup', handleMouseUp);
        canvas.addEventListener('mouseleave', handleMouseLeave);
        canvas.addEventListener('dblclick', handleDoubleClick);
        canvas.addEventListener('wheel', handleWheel, { passive: false });
        canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
        canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
        canvas.addEventListener('touchend', handleTouchEnd);

        return () => {
            canvas.removeEventListener('mousedown', handleMouseDown);
            canvas.removeEventListener('mousemove', handleMouseMove);
            canvas.removeEventListener('mouseup', handleMouseUp);
            canvas.removeEventListener('mouseleave', handleMouseLeave);
            canvas.removeEventListener('dblclick', handleDoubleClick);
            canvas.removeEventListener('wheel', handleWheel);
            canvas.removeEventListener('touchstart', handleTouchStart);
            canvas.removeEventListener('touchmove', handleTouchMove);
            canvas.removeEventListener('touchend', handleTouchEnd);
        };
    }, [dimensions, zoom, viewAz, viewAlt, selectedObject, effLocation, effTime, settings, isMini, onSelectObject, onCenter, telescopePosition, isConnected, language, recommendedMode, staticData, wwtInitialized, wwtControlRef, dssTiles]);

    useEffect(() => {
        if (centerRequest && selectedObject) {
            const lst = calculateLST(effLocation.longitude, effTime);
            const { alt, az } = raDecToAzAlt(selectedObject.raDeg, selectedObject.decDeg, effLocation.latitude, lst);
            setViewAz(az);
            setViewAlt(alt);
        }
    }, [centerRequest, selectedObject, effLocation, effTime]);

    useEffect(() => {
        if (!isMini && settings.showDSS && !dssLoading) {
            const lst = calculateLST(effLocation.longitude, effTime);
            const { ra, dec } = azAltToRaDec(viewAz, viewAlt, effLocation.latitude, lst);
            const fov = 60 / zoom;

            // Only fetch new DSS tiles if parameters have changed significantly
            const threshold = 0.1; // degrees
            const fovThreshold = 0.5; // degrees

            if (Math.abs(ra - lastDssParams.current.ra) > threshold ||
                Math.abs(dec - lastDssParams.current.dec) > threshold ||
                Math.abs(fov - lastDssParams.current.fov) > fovThreshold) {
                
                lastDssParams.current = { ra, dec, fov };
                setDssTiles([]); // Clear existing tiles when view changes
                fetchDssImage(ra, dec, fov);
            }
        }
    }, [viewAz, viewAlt, zoom, settings.showDSS, effLocation, effTime, isMini, fetchDssImage, dssLoading]);

    useEffect(() => {
        if (!isMini && settings.showWWT && !wwtInitialized) {
            const script = document.createElement('script');
            script.src = 'https://web.wwtassets.org/engine/3.0.29/wwtlib.js';
            script.async = true;
            script.onload = () => {
                if (window.wwtlib) {
                    const wwt = new window.wwtlib.WWTControl('wwtcanvas');
                    wwtControlRef.current = wwt;
                    setWwtInitialized(true);
                    console.log('[WWT] Initialized');
                }
            };
            document.body.appendChild(script);
            return () => {
                document.body.removeChild(script);
            };
        }
    }, [isMini, settings.showWWT, wwtInitialized]);

    return (
        <div ref={containerRef} className="relative w-full h-full overflow-hidden bg-black select-none touch-none">
            <canvas
                ref={canvasRef}
                className="absolute top-0 left-0 w-full h-full"
            />
            {settings.showWWT && !isMini && (
                <canvas id="wwtcanvas" className="absolute top-0 left-0 w-full h-full pointer-events-none" style={{ zIndex: -1 }} />
            )}

            {selectedObject && (
                <CelestialObjectHUD 
                    object={selectedObject}
                    onSlew={onSlew}
                    onCenter={onCenter}
                    onShowInfo={onShowInfo}
                    slewStatus={slewStatus}
                    isConnected={isConnected}
                    isAutoCenterEnabled={isAutoCenterEnabled}
                    onToggleAutoCenter={onToggleAutoCenter}
                />
            )}

            <div className="absolute top-4 left-4 flex flex-col space-y-2 z-10">
                <Button onClick={() => setZoom(prev => Math.max(0.1, prev / 1.2))}><ZoomOutIcon /></Button>
                <Button onClick={() => setZoom(prev => Math.min(100, prev * 1.2))}><ZoomInIcon /></Button>
                <Button onClick={() => { setViewAz(0); setViewAlt(30); setZoom(60 / 70); }}><ResetIcon /></Button>
            </div>

            <div className="absolute top-4 right-4 flex flex-col space-y-2 z-10">
                <div className="relative">
                    <input
                        type="text"
                        placeholder={t('planetarium.searchPlaceholder')}
                        className="p-2 pr-10 rounded-md bg-gray-800 text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                                handleSearch();
                            }
                        }}
                    />
                    <Button onClick={handleSearch} className="absolute right-0 top-0 h-full px-3 rounded-l-none"><SearchIcon /></Button>
                </div>
                {MountController && <MountController />}
            </div>

            {dssLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 z-20">
                    <div className="text-white text-lg">{t('planetarium.loadingDSS')}</div>
                </div>
            )}
        </div>
    );
};
