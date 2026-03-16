
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
        
        // Only fill background if DSS is NOT being shown via WWT
        // This prevents the canvas from hiding the WWT layer underneath
        if (!settings.showDSS || isMini || !wwtInitialized) {
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
                            const angle = Math.atan2(pNorth.y - p.y, pNorth.x - p.x) + Math.PI/2;
                            ctx.rotate(angle);
                        }
                        
                        ctx.drawImage(tile.image, -dssSizeInPixels/2, -dssSizeInPixels/2, dssSizeInPixels, dssSizeInPixels);
                        ctx.restore();
                    }
                } catch (e) {
                    // Silent fail for individual tiles
                }
            }
            ctx.restore();
        }

        // DSS Status Indicator
        if (!isMini && settings.showDSS && (dssLoading || dssTiles.length === 0)) {
            ctx.save();
            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.fillRect(10, height - 30, 150, 20);
            ctx.fillStyle = '#fff';
            ctx.font = '10px sans-serif';
            ctx.textAlign = 'left';
            ctx.fillText(dssLoading ? `DSS: Loading Tiles (${dssTiles.length})...` : 'DSS: No Data (Zoom in)', 15, height - 16);
            ctx.restore();
        }

        if (settings.showMilkyWay && milkyWaySprite) {
            ctx.save(); ctx.globalCompositeOperation = 'lighter'; 
            const opacityVal = settings.milkyWayOpacity ?? 0.5; 
            const baseOpacity = opacityVal * 0.5; // Direct linear scaling for more predictability
            if (baseOpacity > 0.01) {
                MILKY_WAY_POINTS.forEach(pt => {
                    const {az, alt} = raDecToAzAlt(pt.ra, pt.dec, effLocation.latitude, lst);
                    if (alt > -20) {
                        const p = projectStereographic(alt, az, width, height, zoom, center, viewAlt, viewAz);
                        if (p && p.x > -200 && p.x < width + 200 && p.y > -200 && p.y < height + 200) {
                            const scale = 80 * zoom * (pt.width || 1.0); 
                            ctx.globalAlpha = Math.min(1, pt.intensity * baseOpacity);
                            ctx.drawImage(milkyWaySprite, p.x - scale, p.y - scale, scale * 2, scale * 2);
                        }
                    }
                });
            }
            ctx.restore();
        }

        if (settings.showAzAltGrid) {
            ctx.strokeStyle = 'rgba(239, 68, 68, 0.15)'; ctx.fillStyle = 'rgba(239, 68, 68, 0.4)'; ctx.font = '10px monospace'; ctx.textAlign = 'center'; ctx.lineWidth = 1;
            for (let az = 0; az < 360; az += 15) {
                ctx.beginPath(); let first = true;
                for (let alt = -20; alt <= 90; alt += 5) {
                    if (alt === 0) { first = true; continue; } 
                    const p = projectStereographic(alt, az, width, height, zoom, center, viewAlt, viewAz);
                    if (p) { if (first) { ctx.moveTo(p.x, p.y); first = false; } else ctx.lineTo(p.x, p.y); if (!isMini && alt === 0 && az % 45 === 0) ctx.fillText(`${az}°`, p.x, p.y + 12); } else first = true;
                }
                ctx.stroke();
            }
            for (let alt = 0; alt <= 80; alt += 15) {
                if (alt === 0) continue; 
                ctx.beginPath(); let first = true;
                for (let az = 0; az <= 360; az += 5) {
                    const p = projectStereographic(alt, az, width, height, zoom, center, viewAlt, viewAz);
                    if (p) { if (first) { ctx.moveTo(p.x, p.y); first = false; } else ctx.lineTo(p.x, p.y); } else first = true;
                }
                ctx.stroke();
            }
        }

        if (settings.showRaDecGrid) {
            ctx.strokeStyle = 'rgba(59, 130, 246, 0.15)'; ctx.lineWidth = 1;
            for (let ra = 0; ra < 360; ra += 15) {
                ctx.beginPath(); let first = true;
                for (let dec = -80; dec <= 80; dec += 10) {
                    const { alt, az } = raDecToAzAlt(ra, dec, effLocation.latitude, lst);
                    const p = projectStereographic(alt, az, width, height, zoom, center, viewAlt, viewAz);
                    if (p) { if (first) { ctx.moveTo(p.x, p.y); first = false; } else ctx.lineTo(p.x, p.y); } else first = true;
                }
                ctx.stroke();
            }
            for (let dec = -80; dec <= 80; dec += 20) {
                ctx.beginPath(); let first = true;
                for (let ra = 0; ra <= 360; ra += 10) {
                    const { alt, az } = raDecToAzAlt(ra, dec, effLocation.latitude, lst);
                    const p = projectStereographic(alt, az, width, height, zoom, center, viewAlt, viewAz);
                    if (p) { if (first) { ctx.moveTo(p.x, p.y); first = false; } else ctx.lineTo(p.x, p.y); } else first = true;
                }
                ctx.stroke();
            }
        }

        if(settings.showHorizon) {
             ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)'; ctx.lineWidth = 1.5; ctx.beginPath(); 
             let first = true;
             for (let az = 0; az <= 360; az += 2) { 
                 const p = projectStereographic(0, az, width, height, zoom, center, viewAlt, viewAz); 
                 if (p) {
                     if (first) { ctx.moveTo(p.x, p.y); first = false; }
                     else ctx.lineTo(p.x, p.y);
                 } else {
                     first = true; 
                 }
             }
             ctx.stroke();
        }

        const userScale = settings.starScale || 1.0; const effectiveStarScale = userScale * 0.6; const viewFov = 60 / zoom; const pixelsPerDegree = Math.min(width, height) / viewFov;

        const renderObject = (obj: any, isBackground: boolean) => {
            const isCurated = curatedObjectIds.has(obj.id);
            if (obj.magnitude > (['Galaxy', 'Nebula', 'Star Cluster'].includes(obj.type) ? dynamicDsoMagLimit : dynamicStarMagLimit)) { 
                if (!constellationStarIds.has(obj.id) && !(recommendedMode && isCurated)) return; 
            }
            if (obj.type === 'Galaxy' && !settings.showGalaxies) return; 
            if (obj.type === 'Nebula' && !settings.showNebulae) return; 
            if (obj.type === 'Star Cluster' && !settings.showClusters) return;
            if (recommendedMode && !isCurated && obj.type !== 'Star' && obj.type !== 'Planet' && obj.magnitude > 6.0) return;
            const { alt, az } = raDecToAzAlt(obj.raDeg, obj.decDeg, effLocation.latitude, lst); 
            if (alt < -5) return;
            const p = projectStereographic(alt, az, width, height, zoom, center, viewAlt, viewAz); 
            if (!p || p.x < -20 || p.x > width + 20 || p.y < -20 || p.y > height + 20) return;
            if (!isBackground) starMap.set(obj.id, p);
            const isSelected = selectedObject?.id === obj.id; 
            const isDSO = ['Galaxy', 'Nebula', 'Star Cluster'].includes(obj.type);
            let radius = 1.0; let color = '#ffffff';
            if (obj.type === 'Planet') { radius = (2 + Math.max(0, (1.5 - obj.magnitude) * 1.5)) * effectiveStarScale; color = '#ffddaa'; }
            else if (isDSO) { 
                if (obj.size) radius = Math.max(4, ((obj.size / 60) * pixelsPerDegree) / 2 * Math.min(1.0, 0.07 + 0.93 * (zoom / 4.0)));
                else radius = Math.max(4, (10 - obj.magnitude) * 1.5) * Math.sqrt(zoom);
                color = obj.type === 'Galaxy' ? 'rgba(180, 60, 60, 0.5)' : obj.type === 'Star Cluster' ? 'rgba(180, 140, 20, 0.5)' : 'rgba(40, 120, 60, 0.5)';
            } else { radius = Math.max(0.6, 3.5 * Math.pow(1.6, -0.22 * obj.magnitude)) * (0.8 + 0.2 * zoom) * effectiveStarScale; color = getStarColor(obj.magnitude, 0, obj.color); }
            if (!isBackground) hitRegions.current.push({ x: p.x, y: p.y, radius: Math.max(radius * 2.5, 15), object: obj });
            if (recommendedMode && isCurated && !isBackground) {
                ctx.save(); ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(p.x, p.y, radius + 4, 0, Math.PI * 2); ctx.stroke();
                ctx.globalAlpha = 0.2; ctx.fillStyle = '#fbbf24'; ctx.beginPath(); ctx.arc(p.x, p.y, radius + 8, 0, Math.PI * 2); ctx.fill(); ctx.restore();
            }
            if (isSelected) { ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x, p.y, radius + 6, 0, Math.PI * 2); ctx.stroke(); }
            if (isDSO) {
                // DSS Background (Beta)
                if (settings.showDSS && !isMini && zoom > 2.0 && obj.size && obj.size > 5) {
                    const sizePx = (obj.size / 60) * pixelsPerDegree * (0.8 + 0.2 * zoom);
                    if (sizePx > 15) {
                        const dssUrl = `https://aladin.u-strasbg.fr/AladinLite/export/nph-export.cgi?ra=${obj.raDeg}&dec=${obj.decDeg}&fov=${obj.size/60}&width=256&height=256&format=jpg&survey=P%2FDSS2%2Fcolor`;
                        const img = new Image();
                        img.src = `/api/proxy/image?url=${encodeURIComponent(dssUrl)}`;
                        if (img.complete) {
                            ctx.save();
                            ctx.globalAlpha = 0.7;
                            ctx.translate(p.x, p.y);
                            ctx.drawImage(img, -sizePx/2, -sizePx/2, sizePx, sizePx);
                            ctx.restore();
                        }
                    }
                }
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
                ctx.strokeStyle = 'rgba(234, 179, 8, 0.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(tp.x, tp.y, 20, 0, Math.PI * 2); ctx.stroke();
                ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(tp.x - 30, tp.y); ctx.lineTo(tp.x + 30, tp.y); ctx.moveTo(tp.x, tp.y - 30); ctx.lineTo(tp.x, tp.y + 30); ctx.stroke();
            }
        }
    }, [dimensions, viewAz, viewAlt, zoom, settings, effLocation, effTime, selectedObject, recommendedMode, language, telescopePosition, wwtInitialized, staticData, constellationStarIds, curatedObjectIds, milkyWaySprite, isMini, isConnected, t]);

    const handleMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
        if ('touches' in e && e.touches.length === 2) { e.preventDefault(); lastPinchDist.current = getDistance(e.touches[0], e.touches[1]); return; }
        setIsDragging(true); 
        const cX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX; 
        const cY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
        setLastMousePos({ x: cX, y: cY }); clickStartTimeRef.current = Date.now(); setCursor('grabbing');
    };

    const handleMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
        if ('touches' in e && e.touches.length === 2) {
            e.preventDefault(); const dist = getDistance(e.touches[0], e.touches[1]); 
            if (lastPinchDist.current !== null) { const delta = (dist - lastPinchDist.current!) * 0.005; setZoom(prev => Math.max(0.5, Math.min(10, prev * (1 + delta)))); }
            lastPinchDist.current = dist; return;
        }
        const cX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX; 
        const cY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
        if (isDragging) {
            e.preventDefault(); const dx = cX - lastMousePos.x; const dy = cY - lastMousePos.y; const sens = 0.15 / zoom;
            setViewAz(prev => (prev - dx * sens + 360) % 360); setViewAlt(prev => Math.max(-90, Math.min(90, prev + dy * sens))); setLastMousePos({ x: cX, y: cY });
        } else if (containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect(); const x = cX - rect.left; const y = cY - rect.top;
            const isHover = hitRegions.current.some(r => Math.hypot(x - r.x, y - r.y) < r.radius); setCursor(isHover ? 'pointer' : 'default');
        }
    };

    const handleMouseUp = (e: React.MouseEvent | React.TouchEvent) => {
        if (lastPinchDist.current !== null) { lastPinchDist.current = null; return; }
        setIsDragging(false); setCursor('default'); 
        const now = Date.now(); const timeDiff = now - clickStartTimeRef.current;
        if (timeDiff < 300) {
            const cX = 'changedTouches' in e ? e.changedTouches[0].clientX : (e as React.MouseEvent).clientX; const cY = 'changedTouches' in e ? e.changedTouches[0].clientY : (e as React.MouseEvent).clientY;
            if (containerRef.current) {
                const rect = containerRef.current.getBoundingClientRect(); const x = cX - rect.left; const y = cY - rect.top;
                let bestMatch: CelestialObject | null = null; let minDist = Infinity;
                for (const region of hitRegions.current) {
                    const d = Math.hypot(x - region.x, y - region.y); if (d < region.radius && d < minDist) { minDist = d; bestMatch = region.object; }
                }
                if (bestMatch) {
                    const isDoubleClick = (now - lastClickTimeRef.current) < 300; lastClickTimeRef.current = now;
                    if (isDoubleClick && onCenter) { onCenter(bestMatch); }
                    else if (onSelectObject) { onSelectObject(bestMatch); }
                } else { lastClickTimeRef.current = now; }
            }
        }
    };

    const handleZoomIn = () => setZoom(prev => Math.min(10, prev * 1.5));
    const handleZoomOut = () => setZoom(prev => Math.max(0.5, prev * 0.7));
    const handleReset = () => { setViewAz(0); setViewAlt(30); setZoom(60/70); };

    useEffect(() => {
        const controller = new AbortController();
        const signal = controller.signal;

        if (isMini || !settings.showDSS) {
            if (dssTiles.length > 0) setDssTiles([]);
            setDssLoading(false);
            return () => controller.abort();
        }
        
        const lst = calculateLST(effLocation.longitude, effTime);
        const center = azAltToRaDec(viewAz, viewAlt, effLocation.latitude, lst);
        const fov = 60 / zoom;
        
        // Only update if moved significantly
        const dist = Math.hypot(center.ra - lastDssParams.current.ra, center.dec - lastDssParams.current.dec);
        const zoomDiff = Math.abs(zoom - lastDssParams.current.zoom) / zoom;
        
        if (dist < fov * 0.1 && zoomDiff < 0.1 && dssTiles.length > 0) return () => controller.abort();
        
        const fetchWithTimeout = async (url: string, timeoutMs: number, fetchSignal: AbortSignal, tryNoCors: boolean = false): Promise<Response> => {
            const timeoutController = new AbortController();
            const timeoutId = setTimeout(() => timeoutController.abort(), timeoutMs);
            // Combine the two signals
            fetchSignal.addEventListener('abort', () => timeoutController.abort());
            try {
                // Try CORS mode first
                const response = await fetch(url, { signal: timeoutController.signal, mode: 'cors' });
                clearTimeout(timeoutId);
                return response;
            } catch (e) {
                // If CORS fails and tryNoCors is true, try no-cors mode (for HTTP environments)
                if (tryNoCors) {
                    try {
                        const noCorsResponse = await fetch(url, { signal: timeoutController.signal, mode: 'no-cors' });
                        clearTimeout(timeoutId);
                        return noCorsResponse;
                    } catch (noCorsErr) {
                        clearTimeout(timeoutId);
                        throw noCorsErr;
                    }
                }
                clearTimeout(timeoutId);
                throw e;
            }
        };

        const loadImageFromUrl = (url: string, fetchSignal: AbortSignal): Promise<HTMLImageElement> => {
            return new Promise((resolve, reject) => {
                const img = new Image();
                img.crossOrigin = 'anonymous';
                const timeoutId = setTimeout(() => {
                    img.src = '';
                    reject(new Error('Image load timeout'));
                }, 15000);
                img.onload = () => { clearTimeout(timeoutId); resolve(img); };
                img.onerror = () => { clearTimeout(timeoutId); reject(new Error('Image load error')); };
                fetchSignal.addEventListener('abort', () => { clearTimeout(timeoutId); img.src = ''; reject(new Error('Aborted')); });
                img.src = url;
            });
        };

        const updateDss = async () => {
            if (signal.aborted) return;
            setDssLoading(true);
            
            const ra = parseFloat(center.ra.toFixed(4));
            const dec = parseFloat(center.dec.toFixed(4));
            
            const tileFov = 2.0;
            const viewFov = 60 / zoom;
            
            const offsets = viewFov > tileFov * 0.5 ? [
                {dra: 0, ddec: 0},
                {dra: tileFov, ddec: 0}, {dra: -tileFov, ddec: 0},
                {dra: 0, ddec: tileFov}, {dra: 0, ddec: -tileFov},
                {dra: tileFov, ddec: tileFov}, {dra: -tileFov, ddec: tileFov},
                {dra: tileFov, ddec: -tileFov}, {dra: -tileFov, ddec: -tileFov}
            ] : [{dra: 0, ddec: 0}];

            const newTiles: { image: HTMLImageElement, metadata: { ra: number, dec: number, fov: number } }[] = [];

            for (const offset of offsets) {
                if (signal.aborted) return;
                
                const cosDec = Math.max(0.1, Math.cos(dec * Math.PI / 180));
                const targetRa = (ra + (offset.dra / cosDec) + 360) % 360;
                const targetDec = Math.max(-89, Math.min(89, dec + offset.ddec));

                // Build source list: direct CORS-capable endpoints first, proxy as last resort
                const aladinUrl = `https://aladin.cds.unistra.fr/AladinLite/export/nph-export.cgi?ra=${targetRa}&dec=${targetDec}&fov=${tileFov}&width=512&height=512&survey=P%2FDSS2%2Fcolor&format=jpg`;
                const skyviewUrl = `https://skyview.gsfc.nasa.gov/cgi-bin/images?survey=DSS2%20Red&position=${targetRa},${targetDec}&pixels=512&size=${tileFov}&return=jpg`;
                const proxiedAladinUrl = `/api/proxy/image?url=${encodeURIComponent(aladinUrl)}`;
                const proxiedSkyviewUrl = `/api/proxy/image?url=${encodeURIComponent(skyviewUrl)}`;

                const sources = [
                    { name: 'Aladin (direct)', url: aladinUrl, direct: true },
                    { name: 'NASA SkyView (direct)', url: skyviewUrl, direct: true },
                    { name: 'Aladin (proxy)', url: proxiedAladinUrl, direct: false },
                    { name: 'NASA SkyView (proxy)', url: proxiedSkyviewUrl, direct: false },
                ];

                if (offsets.indexOf(offset) > 0) {
                    await new Promise(resolve => {
                        const t = setTimeout(resolve, 200);
                        signal.addEventListener('abort', () => clearTimeout(t));
                    });
                }

                if (signal.aborted) return;

                let tileLoaded = false;
                for (const source of sources) {
                    if (signal.aborted) return;
                    try {
                        let img: HTMLImageElement;
                        if (source.direct) {
                            // Try direct img tag loading first (avoids CORS preflight for img elements)
                            img = await loadImageFromUrl(source.url, signal);
                        } else {
                            // Proxy fetch approach with no-cors fallback for HTTP environments
                            const isHttpContext = window.location.protocol === 'http:';
                            const response = await fetchWithTimeout(source.url, 10000, signal, isHttpContext);
                            if (!response.ok && response.status !== 0) throw new Error(`HTTP ${response.status}`);
                            const blob = await response.blob();
                            const objectUrl = URL.createObjectURL(blob);
                            img = await loadImageFromUrl(objectUrl, signal);
                        }

                        if (signal.aborted) return;

                        newTiles.push({
                            image: img,
                            metadata: { ra: targetRa, dec: targetDec, fov: tileFov }
                        });
                        setDssTiles([...newTiles]);
                        tileLoaded = true;
                        break;
                    } catch (e: any) {
                        if (e.name === 'AbortError' || (e.message && e.message.includes('Aborted'))) return;
                        console.warn(`[Planetarium] Tile (${offset.dra},${offset.ddec}) failed from ${source.name}: ${e.message}`);
                    }
                }
                if (!tileLoaded) {
                    console.warn(`[Planetarium] All sources failed for tile (${offset.dra},${offset.ddec}), skipping.`);
                }
            }

            if (!signal.aborted) {
                setDssLoading(false);
                lastDssParams.current = { ra, dec, zoom };
            }
        };

        const timer = setTimeout(updateDss, 800);
        return () => {
            clearTimeout(timer);
            controller.abort();
        };
    }, [viewAz, viewAlt, zoom, settings.showDSS, isMini, dimensions, wwtInitialized, effLocation, effTime]);

    useEffect(() => {
        if (centerRequest && centerRequest > 0 && selectedObject) {
            const lst = calculateLST(effLocation.longitude, effTime); const ra = hmsToDegrees(selectedObject.ra); const dec = dmsToDegrees(selectedObject.dec);
            const { alt, az } = raDecToAzAlt(ra, dec, effLocation.latitude, lst); setViewAz(az); setViewAlt(alt);
        }
    }, [centerRequest, selectedObject, effLocation, effTime]);

    useEffect(() => {
        if (isMini || !settings.showDSS) { if (wwtInitialized) { setWwtInitialized(false); wwtControlRef.current = null; } return; }
        let timer: any;
        const initWWT = () => {
            if (window.wwtlib && !wwtInitialized && !wwtControlRef.current && document.getElementById("wwt-canvas")) {
                try {
                    const scriptInterface = window.wwtlib.WWTControl.initControl("wwt-canvas");
                    scriptInterface.add_ready(() => {
                        wwtControlRef.current = scriptInterface; const ctl = window.wwtlib.WWTControl.singleton;
                        if (ctl && ctl.settings) { ctl.settings.set_showConstellationFigures(false); ctl.settings.set_showConstellationBoundries(false); ctl.settings.set_showCrosshairs(false); ctl.settings.set_showGrid(false); ctl.settings.set_showSolarSystem(false); ctl.settings.set_showHorizon(false); }
                        scriptInterface.setBackgroundImageByName("Digitized Sky Survey (Color)"); setWwtInitialized(true);
                    });
                } catch (e) { }
            }
        };
        if (!wwtInitialized) timer = setInterval(initWWT, 500); return () => clearInterval(timer);
    }, [wwtInitialized, isMini, settings.showDSS]);

    const selectedObjectData = useMemo(() => {
        if (!selectedObject) return null;
        const lst = calculateLST(effLocation.longitude, effTime); const ra = hmsToDegrees(selectedObject.ra); const dec = dmsToDegrees(selectedObject.dec);
        const { alt, az } = raDecToAzAlt(ra, dec, effLocation.latitude, lst);
        return { az: az.toFixed(1), alt: alt.toFixed(1), transit: calculateTransitTime(ra, effLocation.longitude), isRising: alt > 0, ra: selectedObject.ra, dec: selectedObject.dec, type: selectedObject.type, magnitude: selectedObject.magnitude };
    }, [selectedObject, effLocation, effTime]);

    const stopControlInteraction = (e: React.MouseEvent | React.TouchEvent) => { e.stopPropagation(); };

    return (
        <div ref={containerRef} className={`w-full h-full relative overflow-hidden select-none touch-none ${!isMini && settings.showDSS ? 'bg-transparent' : 'bg-[#020617]'}`} style={{ cursor, touchAction: 'none' }} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp} onWheel={(e) => setZoom(prev => Math.max(0.5, Math.min(10, prev * (1 - e.deltaY * 0.001))))} onTouchStart={handleMouseDown} onTouchMove={handleMouseMove} onTouchEnd={handleMouseUp}>
            {!isMini && settings.showDSS && <div id="wwt-canvas" className="absolute inset-0 w-full h-full" style={{ zIndex: 0, pointerEvents: 'none' }} />}
            {dssLoading && <div className="absolute top-4 right-4 z-50 bg-black/50 px-2 py-1 rounded text-[10px] text-white animate-pulse">DSS Loading ({dssTiles.length}/9)...</div>}
            <canvas ref={canvasRef} className="absolute inset-0 w-full h-full z-10" style={{ background: 'transparent' }} />
            
            {!isMini && (
                <div 
                    className="absolute top-2 left-1/2 -translate-x-1/2 flex flex-row gap-1 md:gap-2 z-30 touch-manipulation items-center whitespace-nowrap"
                    onMouseDown={stopControlInteraction} onMouseUp={stopControlInteraction} onTouchStart={stopControlInteraction}
                >
                    <div className="flex flex-row gap-1">
                        <button onClick={() => { setViewAz(0); setViewAlt(30); }} className="bg-slate-800/80 w-9 h-7 md:w-auto md:px-3 md:py-2 rounded text-[10px] md:text-xs font-bold text-red-400 border border-slate-700">{t('planetarium.directions.n')}</button>
                        <button onClick={() => { setViewAz(180); setViewAlt(30); }} className="bg-slate-800/80 w-9 h-7 md:w-auto md:px-3 md:py-2 rounded text-[10px] md:text-xs font-bold text-red-400 border border-slate-700">{t('planetarium.directions.s')}</button>
                        <button onClick={() => { setViewAz(90); setViewAlt(30); }} className="bg-slate-800/80 w-9 h-7 md:w-auto md:px-3 md:py-2 rounded text-[10px] md:text-xs font-bold text-red-400 border border-slate-700">{t('planetarium.directions.e')}</button>
                        <button onClick={() => { setViewAz(270); setViewAlt(30); }} className="bg-slate-800/80 w-9 h-7 md:w-auto md:px-3 md:py-2 rounded text-[10px] md:text-xs font-bold text-red-400 border border-slate-700">{t('planetarium.directions.w')}</button>
                    </div>
                    {isConnected && telescopePosition && <button onClick={() => { const lst = calculateLST(effLocation.longitude, effTime); const {alt, az} = raDecToAzAlt(telescopePosition.ra, telescopePosition.dec, effLocation.latitude, lst); setViewAz(az); setViewAlt(alt); }} className="bg-red-800/90 px-2 py-1 md:px-3 md:py-2 rounded text-[10px] md:text-xs font-bold text-white border border-red-600 flex items-center gap-1 shadow-lg" title={t('tooltips.scopeTrack')}><TelescopeIcon className="w-3 h-3 md:w-4 md:h-4" />{t('planetarium.scopeButton')}</button>}
                </div>
            )}
            
            {selectedObject && !isMini && (
                <div onMouseDown={stopControlInteraction} onMouseUp={stopControlInteraction} onTouchStart={stopControlInteraction}>
                    <CelestialObjectHUD 
                        object={selectedObject} 
                        data={selectedObjectData} 
                        isConnected={isConnected} 
                        onClose={() => onSelectObject && onSelectObject(null)} 
                        MountController={MountController}
                    />
                </div>
            )}
            
            {/* 修正：アクションボタン群。ImagingViewと統一したサイズと位置 */}
            {!isMini && (
                <div 
                    className="absolute bottom-20 md:bottom-4 landscape:bottom-2 right-2 md:right-4 flex flex-col gap-1 md:gap-2 z-30 items-end"
                    onMouseDown={stopControlInteraction} onMouseUp={stopControlInteraction} onTouchStart={stopControlInteraction}
                >
                    <button onClick={() => setRecommendedMode(!recommendedMode)} className={`w-8 h-8 md:w-12 md:h-12 rounded-full border shadow-lg transition-colors flex items-center justify-center ${recommendedMode ? 'bg-yellow-500/20 border-yellow-400 text-yellow-400' : 'bg-slate-800 border-slate-600 text-slate-400 hover:text-yellow-200'}`} title={t('tooltips.recommended')}><StarIcon className="w-4 h-4 md:w-6 md:h-6" /></button>
                    <button onClick={handleZoomIn} className="bg-slate-800 w-8 h-8 md:w-12 md:h-12 rounded-full text-white border border-slate-600 shadow-lg flex items-center justify-center" title="Zoom In"><ZoomInIcon className="w-4 h-4 md:w-6 md:h-6"/></button>
                    <button onClick={handleReset} className="bg-slate-800 w-8 h-8 md:w-12 md:h-12 rounded-full text-white border border-slate-600 shadow-lg flex items-center justify-center" title="Reset View"><ResetIcon className="w-4 h-4 md:w-6 md:h-6"/></button>
                    <button onClick={handleZoomOut} className="bg-slate-800 w-8 h-8 md:w-12 md:h-12 rounded-full text-white border border-slate-600 shadow-lg flex items-center justify-center" title="Zoom Out"><ZoomOutIcon className="w-4 h-4 md:w-6 md:h-6"/></button>
                </div>
            )}
            
            {!isMini && (
                <div 
                    className="absolute bottom-3 md:bottom-4 landscape:bottom-1.5 left-1/2 -translate-x-1/2 flex gap-1 md:gap-2 items-center z-30 w-auto max-w-[95%] md:w-auto justify-center"
                    onMouseDown={stopControlInteraction} onMouseUp={stopControlInteraction} onTouchStart={stopControlInteraction}
                >
                    <div className="relative w-24 sm:w-36 md:w-48 landscape:w-32">
                        <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearch()} placeholder={t('controlPanel.searchTarget')} className="bg-slate-800 border border-slate-600 rounded-lg pl-2 pr-7 py-1 md:py-2 text-[10px] md:text-sm text-slate-200 focus:ring-2 focus:ring-red-500 w-full outline-none shadow-lg" title={t('tooltips.search')} />
                        <button onClick={handleSearch} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 p-1" title="Search Now"><SearchIcon className="w-3 h-3 md:w-4 md:h-4" /></button>
                    </div>
                    <div className="flex gap-1 md:gap-2 shrink-0">
                        <Button onClick={() => selectedObject && onShowInfo && onShowInfo(selectedObject.name)} disabled={!selectedObject} variant="secondary" className="text-[9px] md:text-xs px-1.5 py-1 md:px-3 md:py-2 h-auto shadow-lg whitespace-nowrap" title={t('tooltips.objectInfo')}>{t('controlPanel.showObjectInfo')}</Button>
                        <Button onClick={onSlew} disabled={!isConnected || !selectedObject || slewStatus !== 'Idle'} className="text-[9px] md:text-xs px-1.5 py-1 md:px-3 md:py-2 h-auto whitespace-nowrap min-w-[55px] md:min-w-[80px] shadow-lg" title={t('tooltips.goto')}><CrosshairIcon className="w-3 h-3 md:w-4 md:h-4" />{slewStatus === 'Slewing' ? t('controlPanel.slewing') : t('controlPanel.goToTarget')}</Button>
                    </div>
                </div>
            )}
            {!isMini && <div className="absolute bottom-0.5 left-0.5 text-[8px] md:text-[9px] text-slate-600 font-mono pointer-events-none z-30">{t('planetarium.hud.az')}:{viewAz.toFixed(0)} {t('planetarium.hud.alt')}:{viewAlt.toFixed(0)} {t('planetarium.hud.fov')}:{(60/zoom).toFixed(1)}°</div>}
        </div>
    );
};
