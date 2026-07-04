
import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { CelestialObject, SlewStatus, PlanetariumSettings, LocationData, TelescopePosition, PlateSolverType, LocalSolverSettings } from '../types';
import { CELESTIAL_OBJECTS, CONSTELLATIONS } from '../constants';
import { calculateLST, hmsToDegrees, dmsToDegrees, raDecToAzAlt, projectStereographic, calculateTransitTime, azAltToRaDec, degreesToHms, degreesToDms } from '../utils/coords';
import { ZoomInIcon } from './icons/ZoomInIcon';
import { ZoomOutIcon } from './icons/ZoomOutIcon';
import { ResetIcon } from './icons/ResetIcon';
import { SearchIcon } from './icons/SearchIcon';
import { CrosshairIcon } from './icons/CrosshairIcon';
import { StarIcon } from './icons/StarIcon';
import { TelescopeIcon } from './icons/TelescopeIcon';
import * as AstroService from '../services/AstroService';
import { loadSettings } from '../services/SettingsService';
import { satelliteService, Satellite } from '../services/satelliteService';
import { cometService, Comet } from '../services/cometService';
import { solarSystemService } from '../services/solarSystemService';
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
  plateSolverType?: PlateSolverType;
  localSolverSettings?: LocalSolverSettings;
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
    if (mag > 10) return 'rgba(255, 255, 255, 0.35)';
    if (mag > 7.5) return 'rgba(255, 255, 255, 0.55)';
    if (mag > 4.5) return '#5a5a5a';
    const colors = ['#99CCFF', '#E0EBFF', '#FBF8FF', '#FFF4E8', '#FFD1A3', '#FF9980'];
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
    MountController,
    plateSolverType,
    localSolverSettings
}) => {
    const { t, language } = useTranslation();
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const hitRegions = useRef<HitRegion[]>([]);
    
    const [viewAz, setViewAz] = useState(0); 
    const [viewAlt, setViewAlt] = useState(30);  
    const [zoom, setZoom] = useState(60 / 70); 

    const [serverStars, setServerStars] = useState<any[]>([]);
    const lastQueryRef = useRef({ ra: -1, dec: -1, fov: -1 });
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
    const [satellitesList, setSatellitesList] = useState<Satellite[]>([]);
    const [cometsList, setCometsList] = useState<Comet[]>([]);
    const promptFocalLengthRef = useRef(false);
    const [manualFocalLength, setManualFocalLength] = useState<number>(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('planetarium_manual_focal_length');
            return saved ? parseFloat(saved) : 0;
        }
        return 0;
    });

    const activeCam = AstroService.getActiveCamera();
    const lastActiveCamRef = useRef<string | null>(null);

    useEffect(() => {
        if (activeCam !== lastActiveCamRef.current) {
            promptFocalLengthRef.current = false;
            lastActiveCamRef.current = activeCam;
        }
    }, [activeCam]);

    const effLocation = location || { latitude: 35.6, longitude: 139.6 };
    const effTime = localTime || new Date();

    useEffect(() => {
        if (plateSolverType !== 'local') {
            if (serverStars.length > 0) {
                setServerStars([]);
            }
            return;
        }

        let host = localSolverSettings?.host || 'localhost';
        if (host === 'localhost' || host === '127.0.0.1') {
            if (typeof window !== 'undefined' && window.location.hostname) {
                host = window.location.hostname;
            }
        }
        const port = localSolverSettings?.port || 6001;

        const viewFov = 60 / zoom;
        if (viewFov > 30.0) {
            if (serverStars.length > 0) {
                setServerStars([]);
            }
            return;
        }

        const lst = calculateLST(effLocation.longitude, effTime);
        const center = azAltToRaDec(viewAz, viewAlt, effLocation.latitude, lst);

        const last = lastQueryRef.current;
        const dist = Math.sqrt(Math.pow(center.ra - last.ra, 2) + Math.pow(center.dec - last.dec, 2));
        const fovRatio = Math.abs(viewFov - last.fov) / viewFov;

        if (dist < viewFov * 0.15 && fovRatio < 0.15 && serverStars.length > 0) {
            return;
        }

        const delayDebounce = setTimeout(async () => {
            try {
                const radius = Math.min(10, viewFov * 0.75);
                const lastPath = localStorage.getItem("last_index_path") || "/home/astrpi64/.local/share/kstars/astrometry";
                
                const url = `http://${host}:${port}/api/planetarium/stars?ra=${center.ra}&dec=${center.dec}&radius=${radius}&path=${encodeURIComponent(lastPath)}`;
                const res = await fetch(url);
                if (res.ok) {
                    const data = await res.json();
                    if (Array.isArray(data.stars)) {
                        const processed = data.stars.map((s: any, idx: number) => {
                            const raStr = degreesToHms(s.ra);
                            const decStr = degreesToDms(s.dec);
                            
                            let name = `Star (Mag ${s.mag.toFixed(1)})`;
                            let nameJa = `恒星 (光度 ${s.mag.toFixed(1)})`;
                            
                            if (s.hd) {
                                name = `HD ${s.hd}`;
                                nameJa = `HD ${s.hd}`;
                            } else if (s.hip) {
                                name = `HIP ${s.hip}`;
                                nameJa = `HIP ${s.hip}`;
                            } else if (s.tyc) {
                                name = `TYC ${s.tyc}`;
                                nameJa = `TYC ${s.tyc}`;
                            } else if (s.ucac) {
                                name = `UCAC ${s.ucac}`;
                                nameJa = `UCAC ${s.ucac}`;
                            } else if (s.gaia) {
                                name = `Gaia DR2 ${s.gaia}`;
                                nameJa = `Gaia DR2 ${s.gaia}`;
                            }

                            return {
                                id: `server-star-${s.ra.toFixed(6)}-${s.dec.toFixed(6)}`,
                                name: name,
                                nameJa: nameJa,
                                type: 'Star',
                                ra: raStr,
                                dec: decStr,
                                raDeg: s.ra,
                                decDeg: s.dec,
                                magnitude: s.mag,
                                color: '#ffffff'
                            };
                        });
                        setServerStars(processed);
                        lastQueryRef.current = { ra: center.ra, dec: center.dec, fov: viewFov };
                    }
                }
            } catch (e) {
                console.warn("Failed to fetch server stars:", e);
            }
        }, 600);

        return () => clearTimeout(delayDebounce);
    }, [zoom, viewAz, viewAlt, plateSolverType, localSolverSettings, effLocation, effTime]);

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
        grad.addColorStop(0, 'rgba(220, 220, 240, 0.12)'); 
        grad.addColorStop(0.2, 'rgba(210, 210, 230, 0.07)');
        grad.addColorStop(0.5, 'rgba(200, 200, 220, 0.03)');
        grad.addColorStop(0.8, 'rgba(190, 190, 210, 0.005)');
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
            if (onSelectObject) {
                onSelectObject(match as any);
                if (match && (match as any).ra !== undefined && (match as any).dec !== undefined) {
                    const raVal = hmsToDegrees((match as any).ra);
                    const decVal = dmsToDegrees((match as any).dec);
                    AstroService.syncSkyCoord(raVal, decVal);
                }
            }
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
        if (settings.showSatellites) {
            satelliteService.startUpdateLoop((sats) => {
                setSatellitesList([...sats]);
            });
        } else {
            satelliteService.stopUpdateLoop();
            setSatellitesList([]);
        }
        return () => {
            satelliteService.stopUpdateLoop();
        };
    }, [settings.showSatellites]);

    useEffect(() => {
        if (settings.showComets) {
            cometService.startUpdateLoop((comets) => {
                setCometsList([...comets]);
            });
        } else {
            cometService.stopUpdateLoop();
            setCometsList([]);
        }
        return () => {
            cometService.stopUpdateLoop();
        };
    }, [settings.showComets]);

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
        
        // 1. Draw Background (only if DSS is not active or WWT not ready)
        const shouldShowWWT = !isMini && settings.showDSS && wwtInitialized && wwtControlRef.current;
        
        if (!shouldShowWWT) {
            ctx.fillStyle = '#020617';
            ctx.fillRect(0, 0, width, height);
        } else {
            // Clear for WWT transparency
            ctx.clearRect(0, 0, width, height);
        }
        
        // 1.5 Milky Way
        if (settings.showMilkyWay && milkyWaySprite) {
            ctx.save(); ctx.globalCompositeOperation = 'screen'; 
            const opacityVal = settings.milkyWayOpacity ?? 0.5; const baseOpacity = Math.pow(opacityVal, 1.5) * 0.8;
            if (baseOpacity > 0.000001) {
                MILKY_WAY_POINTS.forEach(pt => {
                    const {az, alt} = raDecToAzAlt(pt.ra, pt.dec, effLocation.latitude, lst);
                    if (alt > -10) {
                        const p = projectStereographic(alt, az, width, height, zoom, center, viewAlt, viewAz);
                        if (p && p.x > -100 && p.x < width + 100 && p.y > -100 && p.y < height + 100) {
                            const scale = 50 * zoom * (pt.width || 1.0); ctx.globalAlpha = Math.min(1, pt.intensity * baseOpacity);
                            ctx.drawImage(milkyWaySprite, p.x - scale, p.y - scale, scale * 2, scale * 2);
                        }
                    }
                });
            }
            ctx.restore();
        }

        // 2. Update WWT View
        if (shouldShowWWT) {
            const wwtCenter = azAltToRaDec(viewAz, viewAlt, effLocation.latitude, lst);
            const fov = 60 / zoom;
            if (!isNaN(wwtCenter.ra) && !isNaN(wwtCenter.dec)) {
                try {
                    // WWT uses RA in hours (0-24)
                    wwtControlRef.current.gotoRaDecZoom(wwtCenter.ra / 15, wwtCenter.dec, fov, false);
                } catch (e) {
                    // Silent fail for view updates
                }
            }
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
            if (obj.ra === 'Dynamic' || obj.dec === 'Dynamic') return;
            const isServerStar = obj.id && obj.id.startsWith('server-star-');
            const isCurated = curatedObjectIds.has(obj.id);
            const magLimit = isServerStar ? 15.0 : (['Galaxy', 'Nebula', 'Star Cluster'].includes(obj.type) ? dynamicDsoMagLimit : dynamicStarMagLimit);
            if (obj.magnitude > magLimit) { 
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
            hitRegions.current.push({ x: p.x, y: p.y, radius: Math.max(radius * 2.5, 15), object: obj });
            if (recommendedMode && isCurated && !isBackground) {
                ctx.save(); ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(p.x, p.y, radius + 4, 0, Math.PI * 2); ctx.stroke();
                ctx.globalAlpha = 0.2; ctx.fillStyle = '#fbbf24'; ctx.beginPath(); ctx.arc(p.x, p.y, radius + 8, 0, Math.PI * 2); ctx.fill(); ctx.restore();
            }
            if (isSelected) { ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x, p.y, radius + 6, 0, Math.PI * 2); ctx.stroke(); }
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
        if (serverStars && serverStars.length > 0) {
            serverStars.forEach(o => renderObject(o, false));
        } else {
            staticData.backgroundStars.forEach(o => renderObject(o, true));
        }
        staticData.dsoObjects.forEach(o => renderObject(o, false));
        staticData.priorityObjects.forEach(o => renderObject(o, false));
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
        // --- 1. 人工衛星の描画 ---
        if (settings.showSatellites && satellitesList.length > 0) {
            satellitesList.forEach(sat => {
                const { alt, az } = raDecToAzAlt(sat.ra, sat.dec, effLocation.latitude, lst);
                if (alt < 0) return;
                const p = projectStereographic(alt, az, width, height, zoom, center, viewAlt, viewAz);
                if (!p || p.x < 0 || p.x > width || p.y < 0 || p.y > height) return;

                const isLit = Math.floor(Date.now() / 250) % 2 === 0;
                
                ctx.save();
                ctx.fillStyle = isLit ? 'rgba(34, 211, 238, 1)' : 'rgba(34, 211, 238, 0.4)';
                ctx.shadowColor = 'rgba(34, 211, 238, 0.8)';
                ctx.shadowBlur = isLit ? 6 : 2;

                ctx.beginPath();
                ctx.arc(p.x, p.y, isLit ? 3.5 : 2.5, 0, Math.PI * 2);
                ctx.fill();

                if (isLit) {
                    ctx.strokeStyle = 'rgba(34, 211, 238, 0.5)';
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
                    ctx.stroke();
                }

                const isSelected = selectedObject?.id === sat.id;
                if (isSelected) {
                    ctx.strokeStyle = '#ef4444';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, 10, 0, Math.PI * 2);
                    ctx.stroke();
                }

                const mockObj: CelestialObject = {
                    id: sat.id,
                    name: sat.name,
                    nameJa: sat.nameJa,
                    type: 'Planet',
                    ra: degreesToHms(sat.ra),
                    dec: degreesToDms(sat.dec),
                    magnitude: 8
                };
                hitRegions.current.push({ x: p.x, y: p.y, radius: 15, object: mockObj });

                ctx.font = '10px monospace';
                const name = language === 'ja' ? sat.nameJa : sat.name;
                ctx.textAlign = 'left';
                ctx.textBaseline = 'middle';
                ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
                ctx.lineWidth = 3;
                ctx.strokeText(`🛰️ ${name}`, p.x + 10, p.y);
                ctx.fillStyle = '#22d3ee';
                ctx.fillText(`🛰️ ${name}`, p.x + 10, p.y);
                ctx.restore();
            });
        }

        // --- 2. 彗星の描画 ---
        if (settings.showComets && cometsList.length > 0) {
            cometsList.forEach(comet => {
                const { alt, az } = raDecToAzAlt(comet.ra, comet.dec, effLocation.latitude, lst);
                if (alt < 0) return;
                const p = projectStereographic(alt, az, width, height, zoom, center, viewAlt, viewAz);
                if (!p || p.x < 0 || p.x > width || p.y < 0 || p.y > height) return;

                ctx.save();
                ctx.fillStyle = 'rgba(74, 222, 128, 0.8)';
                ctx.strokeStyle = 'rgba(74, 222, 128, 0.4)';
                ctx.shadowColor = 'rgba(74, 222, 128, 0.6)';
                ctx.shadowBlur = 4;

                const radGlow = ctx.createRadialGradient(p.x, p.y, 1, p.x, p.y, 6);
                radGlow.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
                radGlow.addColorStop(0.3, 'rgba(74, 222, 128, 0.8)');
                radGlow.addColorStop(1, 'rgba(74, 222, 128, 0)');
                ctx.fillStyle = radGlow;
                ctx.beginPath();
                ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
                ctx.fill();

                const isSelected = selectedObject?.id === comet.id;
                if (isSelected) {
                    ctx.strokeStyle = '#ef4444';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, 12, 0, Math.PI * 2);
                    ctx.stroke();
                }

                const mockObj: CelestialObject = {
                    id: comet.id,
                    name: comet.name,
                    nameJa: comet.nameJa,
                    type: 'Planet',
                    ra: degreesToHms(comet.ra),
                    dec: degreesToDms(comet.dec),
                    magnitude: 10
                };
                hitRegions.current.push({ x: p.x, y: p.y, radius: 15, object: mockObj });

                ctx.strokeStyle = 'rgba(74, 222, 128, 0.2)';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.moveTo(p.x, p.y);
                ctx.lineTo(p.x + 10, p.y - 10);
                ctx.stroke();

                ctx.font = '10px sans-serif';
                const name = language === 'ja' ? comet.nameJa : comet.name;
                ctx.textAlign = 'left';
                ctx.textBaseline = 'middle';
                ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
                ctx.lineWidth = 3;
                ctx.strokeText(`☄️ ${name}`, p.x + 8, p.y + 6);
                ctx.fillStyle = '#4ade80';
                ctx.fillText(`☄️ ${name}`, p.x + 8, p.y + 6);
                ctx.restore();
            });
        }

        // --- 2.5. 月・太陽系惑星 of 描画 ---
        if (settings.showPlanets) {
            const solarSystemObjects = solarSystemService.calculatePositions();
            solarSystemObjects.forEach(obj => {
                const { alt, az } = raDecToAzAlt(obj.raDeg, obj.decDeg, effLocation.latitude, lst);
                if (alt < 0) return;
                const p = projectStereographic(alt, az, width, height, zoom, center, viewAlt, viewAz);
                if (!p || p.x < 0 || p.x > width || p.y < 0 || p.y > height) return;

                ctx.save();

                const isSelected = selectedObject?.id === obj.id;
                const size = obj.size || 5;

                // 天体に応じた個別描画
                if (obj.id === 'moon') {
                    // 月の描画 (満ち欠けは簡易的にクレーター風に表現)
                    const glow = ctx.createRadialGradient(p.x, p.y, size * 0.2, p.x, p.y, size);
                    glow.addColorStop(0, '#ffffff');
                    glow.addColorStop(0.5, '#fef3c7');
                    glow.addColorStop(1, 'rgba(252, 211, 77, 0)');
                    
                    ctx.fillStyle = glow;
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, size * 1.5, 0, Math.PI * 2);
                    ctx.fill();

                    // 月の本体円盤
                    ctx.fillStyle = '#fef3c7';
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, size * 0.5, 0, Math.PI * 2);
                    ctx.fill();

                    // 月の模様を少し入れる
                    ctx.fillStyle = '#d97706';
                    ctx.globalAlpha = 0.15;
                    ctx.beginPath();
                    ctx.arc(p.x - size*0.1, p.y - size*0.1, size * 0.15, 0, Math.PI * 2);
                    ctx.arc(p.x + size*0.15, p.y + size*0.05, size * 0.1, 0, Math.PI * 2);
                    ctx.fill();
                } else if (obj.id === 'saturn') {
                    // 土星の描画（環を含む）
                    ctx.shadowColor = obj.color || '#fed7aa';
                    ctx.shadowBlur = 4;
                    
                    // 環の描画
                    ctx.strokeStyle = 'rgba(254, 215, 170, 0.8)';
                    ctx.lineWidth = 1.5;
                    ctx.beginPath();
                    ctx.ellipse(p.x, p.y, size * 1.8, size * 0.6, -Math.PI / 8, 0, Math.PI * 2);
                    ctx.stroke();

                    // 本体
                    ctx.fillStyle = obj.color || '#fed7aa';
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
                    ctx.fill();
                } else if (obj.id === 'jupiter') {
                    // 木星の描画（縞模様）
                    ctx.fillStyle = obj.color || '#fdba74';
                    ctx.shadowColor = obj.color || '#fdba74';
                    ctx.shadowBlur = 4;
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
                    ctx.fill();

                    // 縞模様を描く
                    ctx.strokeStyle = '#c2410c';
                    ctx.lineWidth = 1;
                    ctx.globalAlpha = 0.4;
                    ctx.beginPath();
                    ctx.moveTo(p.x - size, p.y - size * 0.3);
                    ctx.lineTo(p.x + size, p.y - size * 0.3);
                    ctx.moveTo(p.x - size, p.y + size * 0.3);
                    ctx.lineTo(p.x + size, p.y + size * 0.3);
                    ctx.stroke();
                } else {
                    // その他の惑星の描画
                    ctx.fillStyle = obj.color || '#fff';
                    ctx.shadowColor = obj.color || '#fff';
                    ctx.shadowBlur = 4;
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
                    ctx.fill();
                }

                // 選択時の赤い枠
                if (isSelected) {
                    ctx.strokeStyle = '#ef4444';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, size + 6, 0, Math.PI * 2);
                    ctx.stroke();
                }

                // クリック用のヒット領域追加
                const hitObj: CelestialObject = {
                    id: obj.id,
                    name: obj.name,
                    nameJa: obj.nameJa,
                    type: 'Planet',
                    ra: obj.ra,
                    dec: obj.dec,
                    magnitude: obj.magnitude
                };
                hitRegions.current.push({ x: p.x, y: p.y, radius: Math.max(15, size + 4), object: hitObj });

                // 天体名ラベルの描画
                ctx.font = 'bold 10px sans-serif';
                const name = language === 'ja' ? obj.nameJa : obj.name;
                ctx.textAlign = 'left';
                ctx.textBaseline = 'middle';
                ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
                ctx.lineWidth = 3;
                ctx.strokeText(name, p.x + size + 6, p.y);
                ctx.fillStyle = isSelected ? '#f87171' : '#e2e8f0';
                ctx.fillText(name, p.x + size + 6, p.y);

                ctx.restore();
            });
        }

        // --- 3. 望遠鏡・画角指標の描画 ---
        if (telescopePosition && isConnected) {
            const { alt: tAlt, az: tAz } = raDecToAzAlt(telescopePosition.ra, telescopePosition.dec, effLocation.latitude, lst);
            const tp = projectStereographic(tAlt, tAz, width, height, zoom, center, viewAlt, viewAz);
            if (tp) {
                const activeCam = AstroService.getActiveCamera();
                const rawParams = AstroService.getCameraParams();
                const params = rawParams ? { ...rawParams } : { width: 0, height: 0, pixelSize: 0, bpp: 8, format: '' };
                
                let focalLength = 0;
                const driver = loadSettings().connectionSettings.driver;
                
                if (driver === 'Simulator') {
                    focalLength = loadSettings().simulatorSettings.focalLength || 0;
                } else {
                    // --- 読み込み最適化（インテリジェント自動スキャン） ---
                    // 1. まず標準的なキーでカメラ側から取得
                    if (activeCam) {
                        focalLength = AstroService.getNumericValue(activeCam, 'TELESCOPE_TYPE', 'TELESCOPE_FOCAL_LENGTH') || 
                                      AstroService.getNumericValue(activeCam, 'TELESCOPE_INFO', 'TELESCOPE_FOCAL_LENGTH') ||
                                      AstroService.getNumericValue(activeCam, 'FocalLength', 'FocalLength') || 0;
                    }
                    
                    // 2. マウント側からも標準的なキーで取得を試みる
                    if (focalLength === 0 || focalLength === null) {
                        const activeMount = (AstroService as any).getActiveMount?.();
                        if (activeMount) {
                            focalLength = AstroService.getNumericValue(activeMount, 'TELESCOPE_TYPE', 'TELESCOPE_FOCAL_LENGTH') || 
                                          AstroService.getNumericValue(activeMount, 'TELESCOPE_INFO', 'TELESCOPE_FOCAL_LENGTH') ||
                                          AstroService.getNumericValue(activeMount, 'FocalLength', 'FocalLength') || 0;
                        }
                    }

                    // 3. カメラ側の全プロパティから 'focal' という語を部分一致で自動スキャン
                    if ((focalLength === 0 || focalLength === null) && activeCam) {
                        const props = AstroService.getDeviceProperties(activeCam);
                        for (const prop of props) {
                            for (const [elName, el] of prop.elements.entries()) {
                                const containsFocal = elName.toLowerCase().indexOf('focal') !== -1 || 
                                                     (el.label && el.label.toLowerCase().indexOf('focal') !== -1) ||
                                                     prop.name.toLowerCase().indexOf('focal') !== -1;
                                if (containsFocal && typeof el.value === 'number' && el.value > 0) {
                                    focalLength = el.value;
                                    break;
                                }
                            }
                            if (focalLength > 0) break;
                        }
                    }

                    // 4. マウント側の全プロパティからも 'focal' という語を部分一致で自動スキャン
                    if (focalLength === 0 || focalLength === null) {
                        const activeMount = (AstroService as any).getActiveMount?.();
                        if (activeMount) {
                            const props = AstroService.getDeviceProperties(activeMount);
                            for (const prop of props) {
                                for (const [elName, el] of prop.elements.entries()) {
                                    const containsFocal = elName.toLowerCase().indexOf('focal') !== -1 || 
                                                         (el.label && el.label.toLowerCase().indexOf('focal') !== -1) ||
                                                         prop.name.toLowerCase().indexOf('focal') !== -1;
                                    if (containsFocal && typeof el.value === 'number' && el.value > 0) {
                                        focalLength = el.value;
                                        break;
                                    }
                                }
                                if (focalLength > 0) break;
                            }
                        }
                    }

                    // --- カメラに紐づいた手動パラメータの自動ロード ---
                    let cameraManualParams: any = {};
                    if (activeCam && typeof window !== 'undefined') {
                        try {
                            const savedParams = localStorage.getItem('planetarium_camera_params');
                            if (savedParams) {
                                const parsed = JSON.parse(savedParams);
                                if (parsed[activeCam]) {
                                    cameraManualParams = parsed[activeCam];
                                }
                            }
                        } catch (e) {
                            console.error("Failed to load camera parameters", e);
                        }
                    }

                    // 足りないパラメータを補完
                    if (params.width <= 0 && cameraManualParams.width > 0) {
                        params.width = cameraManualParams.width;
                    }
                    if (params.height <= 0 && cameraManualParams.height > 0) {
                        params.height = cameraManualParams.height;
                    }
                    if (params.pixelSize <= 0 && cameraManualParams.pixelSize > 0) {
                        params.pixelSize = cameraManualParams.pixelSize;
                    }

                    if (focalLength === 0 || focalLength === null) {
                        if (cameraManualParams.focalLength > 0) {
                            focalLength = cameraManualParams.focalLength;
                        } else if (manualFocalLength > 0) {
                            focalLength = manualFocalLength;
                        }
                    }
                }

                // 不足している項目の検出
                const missingParams: string[] = [];
                if (params.width <= 0) missingParams.push("解像度（横幅/Width）");
                if (params.height <= 0) missingParams.push("解像度（縦幅/Height）");
                if (params.pixelSize <= 0) missingParams.push("ピクセルサイズ（Pixel Size）");
                if (!focalLength || focalLength <= 0) missingParams.push("焦点距離（Focal Length）");

                if (isConnected && activeCam && driver !== 'Simulator' && missingParams.length > 0 && !promptFocalLengthRef.current) {
                    promptFocalLengthRef.current = true;
                    setTimeout(() => {
                        try {
                            const msg = `警告: カメラ・望遠鏡パラメータが不足しています。\n不足している項目: ${missingParams.join(', ')}\n\n正しい画角（FOV）を正確に表示するために、これらのパラメータを設定してください。\n(入力値は接続中のカメラ名「${activeCam}」に紐づけて保存されます)`;
                            window.alert(msg);
                            
                            let currentWidth = params.width > 0 ? params.width : 0;
                            let currentHeight = params.height > 0 ? params.height : 0;
                            let currentPixelSize = params.pixelSize > 0 ? params.pixelSize : 0;
                            let currentFocalLength = focalLength > 0 ? focalLength : 0;

                            if (currentWidth <= 0) {
                                const val = window.prompt("カメラの解像度（横幅のピクセル数）を入力してください:", "4656");
                                if (val) currentWidth = parseInt(val) || 0;
                            }
                            if (currentHeight <= 0) {
                                const val = window.prompt("カメラの解像度（縦幅のピクセル数）を入力してください:", "3520");
                                if (val) currentHeight = parseInt(val) || 0;
                            }
                            if (currentPixelSize <= 0) {
                                const val = window.prompt("カメラのピクセルサイズ (μm) を入力してください (例: 3.8):", "3.8");
                                if (val) currentPixelSize = parseFloat(val) || 0;
                            }
                            if (currentFocalLength <= 0) {
                                const val = window.prompt("望遠鏡の焦点距離 (mm) を入力してください (例: 180):", "180");
                                if (val) currentFocalLength = parseFloat(val) || 0;
                            }

                            if (currentWidth > 0 && currentHeight > 0 && currentPixelSize > 0 && currentFocalLength > 0) {
                                const savedParams = localStorage.getItem('planetarium_camera_params');
                                const parsed = savedParams ? JSON.parse(savedParams) : {};
                                parsed[activeCam] = {
                                    width: currentWidth,
                                    height: currentHeight,
                                    pixelSize: currentPixelSize,
                                    focalLength: currentFocalLength
                                };
                                localStorage.setItem('planetarium_camera_params', JSON.stringify(parsed));
                                localStorage.setItem('planetarium_manual_focal_length', currentFocalLength.toString());
                                setManualFocalLength(currentFocalLength);
                            }
                        } catch (e) {
                            console.warn("window.prompt is blocked in iframe sandbox.", e);
                        }
                    }, 1000);
                }

                const hasCameraParams = params && params.width > 0 && params.height > 0 && params.pixelSize > 0 && focalLength > 0;

                if (hasCameraParams) {
                    const sw = params.width * (params.pixelSize / 1000.0);
                    const sh = params.height * (params.pixelSize / 1000.0);
                    const fovWDeg = (sw / focalLength) * (180.0 / Math.PI);
                    const fovHDeg = (sh / focalLength) * (180.0 / Math.PI);

                    const wPx = fovWDeg * pixelsPerDegree;
                    const hPx = fovHDeg * pixelsPerDegree;

                    ctx.save();
                    ctx.translate(tp.x, tp.y);
                    
                    let rotationDeg = 0;
                    if (activeCam) {
                        rotationDeg = AstroService.getNumericValue(activeCam, 'CCD_ROTATOR', 'ROTATION') || 
                                      AstroService.getNumericValue(activeCam, 'ROTATOR', 'ROTATION') || 0;
                    }
                    ctx.rotate((rotationDeg * Math.PI) / 180.0);

                    ctx.strokeStyle = '#ef4444';
                    ctx.lineWidth = 1.5;
                    ctx.strokeRect(-wPx / 2, -hPx / 2, wPx, hPx);

                    const markerLen = Math.min(15, Math.min(wPx, hPx) * 0.2);
                    ctx.strokeStyle = '#ef4444';
                    ctx.lineWidth = 2.5;

                    ctx.beginPath();
                    ctx.moveTo(-wPx/2 + markerLen, -hPx/2);
                    ctx.lineTo(-wPx/2, -hPx/2);
                    ctx.lineTo(-wPx/2, -hPx/2 + markerLen);
                    ctx.stroke();

                    ctx.beginPath();
                    ctx.moveTo(wPx/2 - markerLen, -hPx/2);
                    ctx.lineTo(wPx/2, -hPx/2);
                    ctx.lineTo(wPx/2, -hPx/2 + markerLen);
                    ctx.stroke();

                    ctx.beginPath();
                    ctx.moveTo(-wPx/2 + markerLen, hPx/2);
                    ctx.lineTo(-wPx/2, hPx/2);
                    ctx.lineTo(-wPx/2, hPx/2 - markerLen);
                    ctx.stroke();

                    ctx.beginPath();
                    ctx.moveTo(wPx/2 - markerLen, hPx/2);
                    ctx.lineTo(wPx/2, hPx/2);
                    ctx.lineTo(wPx/2, hPx/2 - markerLen);
                    ctx.stroke();

                    ctx.fillStyle = 'rgba(239, 68, 68, 0.85)';
                    ctx.font = '10px monospace';
                    ctx.textAlign = 'center';
                    ctx.fillText(`FOV: ${fovWDeg.toFixed(2)}° × ${fovHDeg.toFixed(2)}° (F:${focalLength}mm)`, 0, hPx/2 + 15);

                    ctx.restore();
                } else {
                    ctx.strokeStyle = 'rgba(234, 179, 8, 0.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(tp.x, tp.y, 20, 0, Math.PI * 2); ctx.stroke();
                    ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(tp.x - 30, tp.y); ctx.lineTo(tp.x + 30, tp.y); ctx.moveTo(tp.x, tp.y - 30); ctx.lineTo(tp.x, tp.y + 30); ctx.stroke();
                }
            }
        }
    }, [dimensions, viewAz, viewAlt, zoom, settings, effLocation, effTime, selectedObject, recommendedMode, language, telescopePosition, wwtInitialized, staticData, constellationStarIds, curatedObjectIds, milkyWaySprite, isMini, isConnected, t, dssTiles, dssLoading, satellitesList, cometsList, manualFocalLength, serverStars]);

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
                let bestMatch: CelestialObject | null = null;
                let minDist = Infinity;
                let bestIsMinor = true;
                for (const region of hitRegions.current) {
                    const d = Math.hypot(x - region.x, y - region.y);
                    if (d < region.radius) {
                        const isMinor = !!(region.object.id?.startsWith('server-star-') || region.object.id?.startsWith('bg_star_'));
                        if (bestMatch === null || (bestIsMinor && !isMinor) || (bestIsMinor === isMinor && d < minDist)) {
                            minDist = d;
                            bestMatch = region.object;
                            bestIsMinor = isMinor;
                        }
                    }
                }
                if (bestMatch) {
                    const isDoubleClick = (now - lastClickTimeRef.current) < 300; lastClickTimeRef.current = now;
                    if (isDoubleClick && onCenter) { onCenter(bestMatch); }
                    else if (onSelectObject) { 
                        onSelectObject(bestMatch); 
                        if (bestMatch && bestMatch.ra !== undefined && bestMatch.dec !== undefined) {
                            const raVal = hmsToDegrees(bestMatch.ra);
                            const decVal = dmsToDegrees(bestMatch.dec);
                            AstroService.syncSkyCoord(raVal, decVal);
                        }
                    }
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
        
        const updateDss = async () => {
            if (signal.aborted) return;
            setDssLoading(true);
            
            const ra = parseFloat(center.ra.toFixed(4));
            const dec = parseFloat(center.dec.toFixed(4));
            
            const viewFov = 60 / zoom;
            // Adjust tile size based on zoom level
            // For wide fields, we need larger tiles to cover the view
            const tileFov = viewFov > 30 ? 15.0 : viewFov > 15 ? 7.5 : viewFov > 5 ? 3.0 : 1.5;
            
            // If view is wider than one tile, fetch a grid
            const offsets = viewFov > tileFov * 0.4 ? [
                {dra: 0, ddec: 0},
                {dra: tileFov, ddec: 0}, {dra: -tileFov, ddec: 0},
                {dra: 0, ddec: tileFov}, {dra: 0, ddec: -tileFov},
                {dra: tileFov, ddec: tileFov}, {dra: -tileFov, ddec: tileFov},
                {dra: tileFov, ddec: -tileFov}, {dra: -tileFov, ddec: -tileFov},
                // Add more tiles for very wide fields
                ...(viewFov > tileFov * 1.2 ? [
                    {dra: 2*tileFov, ddec: 0}, {dra: -2*tileFov, ddec: 0},
                    {dra: 0, ddec: 2*tileFov}, {dra: 0, ddec: -2*tileFov},
                    {dra: 2*tileFov, ddec: 2*tileFov}, {dra: -2*tileFov, ddec: 2*tileFov},
                    {dra: 2*tileFov, ddec: -2*tileFov}, {dra: -2*tileFov, ddec: -2*tileFov}
                ] : [])
            ] : [{dra: 0, ddec: 0}];

            const newTiles: { image: HTMLImageElement, metadata: { ra: number, dec: number, fov: number } }[] = [];

            for (const offset of offsets) {
                if (signal.aborted) return;
                
                const cosDec = Math.max(0.1, Math.cos(dec * Math.PI / 180));
                const targetRa = (ra + (offset.dra / cosDec) + 360) % 360;
                const targetDec = Math.max(-89, Math.min(89, dec + offset.ddec));
                
                const sources = [
                    {
                        name: 'NASA SkyView',
                        url: `https://skyview.gsfc.nasa.gov/cgi-bin/images?survey=DSS2%20Red&position=${targetRa},${targetDec}&pixels=512&size=${tileFov}&return=jpg`
                    },
                    {
                        name: 'Aladin',
                        url: `https://aladin.cds.unistra.fr/AladinLite/export/nph-export.cgi?ra=${targetRa}&dec=${targetDec}&fov=${tileFov}&width=512&height=512&survey=P%2FDSS2%2Fcolor&format=jpg`
                    }
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
                    if (signal.aborted || tileLoaded) break;
                    try {
                        console.log(`[Planetarium] Fetching DSS tile (${targetRa.toFixed(2)}, ${targetDec.toFixed(2)}) from ${source.name}`);
                        const proxiedUrl = `/api/proxy/image?url=${encodeURIComponent(source.url)}`;
                        const response = await fetch(proxiedUrl, { signal });
                        if (!response.ok) throw new Error(`Proxy error ${response.status}`);
                        
                        const blob = await response.blob();
                        if (blob.size < 2000) throw new Error('Invalid image data (too small)');

                        const img = new Image();
                        await new Promise((resolve, reject) => {
                            img.onload = resolve;
                            img.onerror = reject;
                            img.src = URL.createObjectURL(blob);
                            signal.addEventListener('abort', () => { img.src = ''; reject(new Error('Aborted')); });
                        });

                        if (signal.aborted) return;

                        newTiles.push({
                            image: img,
                            metadata: { ra: targetRa, dec: targetDec, fov: tileFov }
                        });
                        tileLoaded = true;
                        // Update UI incrementally
                        setDssTiles([...newTiles]);
                    } catch (e: any) {
                        if (e.name === 'AbortError') return;
                        console.warn(`[Planetarium] Tile failed from ${source.name}:`, e.message);
                    }
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
            if (window.wwtlib && !wwtInitialized && !wwtControlRef.current) {
                const canvas = document.getElementById("wwt-canvas");
                if (!canvas) return;

                console.log("[Planetarium] Initializing WWT...");
                try {
                    const scriptInterface = window.wwtlib.WWTControl.initControl("wwt-canvas");
                    scriptInterface.add_ready(() => {
                        console.log("[Planetarium] WWT Ready");
                        wwtControlRef.current = scriptInterface;
                        const ctl = window.wwtlib.WWTControl.singleton;
                        if (ctl && ctl.settings) {
                            ctl.settings.set_showConstellationFigures(false);
                            ctl.settings.set_showConstellationBoundries(false);
                            ctl.settings.set_showCrosshairs(false);
                            ctl.settings.set_showGrid(false);
                            ctl.settings.set_showSolarSystem(false);
                            ctl.settings.set_showHorizon(false);
                        }
                        scriptInterface.setBackgroundImageByName("Digitized Sky Survey (Color)");
                        setWwtInitialized(true);
                    });
                } catch (e) {
                    console.error("[Planetarium] WWT Init failed:", e);
                }
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
                        <button onClick={() => { setViewAz(0); setViewAlt(30); }} title={t('tooltips.north')} className="bg-slate-800/80 w-9 h-7 md:w-auto md:px-3 md:py-2 rounded text-[10px] md:text-xs font-bold text-red-400 border border-slate-700">{t('planetarium.directions.n')}</button>
                        <button onClick={() => { setViewAz(180); setViewAlt(30); }} title={t('tooltips.south')} className="bg-slate-800/80 w-9 h-7 md:w-auto md:px-3 md:py-2 rounded text-[10px] md:text-xs font-bold text-red-400 border border-slate-700">{t('planetarium.directions.s')}</button>
                        <button onClick={() => { setViewAz(90); setViewAlt(30); }} title={t('tooltips.east')} className="bg-slate-800/80 w-9 h-7 md:w-auto md:px-3 md:py-2 rounded text-[10px] md:text-xs font-bold text-red-400 border border-slate-700">{t('planetarium.directions.e')}</button>
                        <button onClick={() => { setViewAz(270); setViewAlt(30); }} title={t('tooltips.west')} className="bg-slate-800/80 w-9 h-7 md:w-auto md:px-3 md:py-2 rounded text-[10px] md:text-xs font-bold text-red-400 border border-slate-700">{t('planetarium.directions.w')}</button>
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
                    <button onClick={handleZoomIn} className="bg-slate-800 w-8 h-8 md:w-12 md:h-12 rounded-full text-white border border-slate-600 shadow-lg flex items-center justify-center" title={t('tooltips.zoomIn')}><ZoomInIcon className="w-4 h-4 md:w-6 md:h-6"/></button>
                    <button onClick={handleReset} className="bg-slate-800 w-8 h-8 md:w-12 md:h-12 rounded-full text-white border border-slate-600 shadow-lg flex items-center justify-center" title={t('tooltips.resetView')}><ResetIcon className="w-4 h-4 md:w-6 md:h-6"/></button>
                    <button onClick={handleZoomOut} className="bg-slate-800 w-8 h-8 md:w-12 md:h-12 rounded-full text-white border border-slate-600 shadow-lg flex items-center justify-center" title={t('tooltips.zoomOut')}><ZoomOutIcon className="w-4 h-4 md:w-6 md:h-6"/></button>
                </div>
            )}
            
            {!isMini && (
                <div 
                    className="absolute bottom-3 md:bottom-4 landscape:bottom-1.5 left-1/2 -translate-x-1/2 flex gap-1 md:gap-2 items-center z-30 w-auto max-w-[95%] md:w-auto justify-center"
                    onMouseDown={stopControlInteraction} onMouseUp={stopControlInteraction} onTouchStart={stopControlInteraction}
                >
                    <div className="relative w-24 sm:w-36 md:w-48 landscape:w-32">
                        <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearch()} placeholder={t('controlPanel.searchTarget')} className="bg-slate-800 border border-slate-600 rounded-lg pl-2 pr-7 py-1 md:py-2 text-[10px] md:text-sm text-slate-200 focus:ring-2 focus:ring-red-500 w-full outline-none shadow-lg" title={t('tooltips.search')} />
                        <button onClick={handleSearch} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 p-1" title={t('tooltips.searchNow')}><SearchIcon className="w-3 h-3 md:w-4 md:h-4" /></button>
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
