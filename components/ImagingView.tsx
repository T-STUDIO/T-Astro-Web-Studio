
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { CelestialObject, LocationData, PlateSolverType, LocalSolverSettings } from '../types';
import { useTranslation } from '../contexts/LanguageContext';
import { Button } from './Button';
import { ZoomInIcon } from './icons/ZoomInIcon';
import { ZoomOutIcon } from './icons/ZoomOutIcon';
import { ResetIcon } from './icons/ResetIcon';
import { SaveIcon } from './icons/SaveIcon';
import { ChevronUpIcon } from './icons/ChevronUpIcon';
import { ChevronDownIcon } from './icons/ChevronDownIcon';
import { ListIcon } from './icons/ListIcon'; 
import { CloseIcon } from './icons/CloseIcon';
import { HistogramIcon } from './icons/HistogramIcon';
import { solveImageAstrometryNet, solveImageLocal, CalibrationData, SolverAnnotation } from '../services/plateSolvingService';
import { calculateLST, hmsToDegrees, dmsToDegrees, raDecToAzAlt, calculateTransitTime, decimalToSexagesimal, pixelToWcs } from '../utils/coords';
import { exportFITS, exportTIFF, exportJPEG } from '../utils/imageExporter';
import { MetadataViewer } from './MetadataViewer';
import { CelestialObjectHUD } from './CelestialObjectHUD';
import * as AstroService from '../services/AstroService';

interface ImagingViewProps {
  isCapturing: boolean;
  captureProgress: { count: number, total: number };
  selectedObject: CelestialObject | null;
  onSelectObject: (object: CelestialObject | null) => void;
  onShowInfo: (objectName: string) => void;
  location?: LocationData | null;
  localTime?: Date | null;
  isLiveViewActive?: boolean;
  isVideoMode?: boolean; 
  isPreviewLoading?: boolean; 
  externalImage?: string | null; 
  externalMetadata?: Record<string, any> | null;
  apiKey?: string;
  onApiKeyChange?: (key: string) => void;
  plateSolverType?: PlateSolverType;
  localSolverSettings?: LocalSolverSettings;
  colorBalance?: { r: number, g: number, b: number };
  externalImageFormat?: string;
  isMini?: boolean; 
  onStopStream?: () => void;
}

interface HistogramStats {
    r: number[];
    g: number[];
    b: number[];
    max: number;
}

interface HitRegion {
    x: number;
    y: number;
    r: number;
    obj: CelestialObject;
}

const getDistance = (touch1: React.Touch, touch2: React.Touch) => {
    return Math.hypot(touch1.clientX - touch2.clientX, touch1.clientY - touch2.clientY);
};

export const ImagingView: React.FC<ImagingViewProps> = ({ 
    isCapturing, 
    captureProgress, 
    selectedObject, 
    onSelectObject, 
    onShowInfo, 
    location,
    localTime,
    isLiveViewActive,
    isVideoMode = false,
    isPreviewLoading = false,
    externalImage,
    externalMetadata,
    apiKey = '',
    onApiKeyChange,
    plateSolverType = 'Remote',
    localSolverSettings = { host: 'localhost', port: 6000 },
    colorBalance = { r: 128, g: 128, b: 128 },
    externalImageFormat,
    isMini = false,
    onStopStream
}) => {
  const { t } = useTranslation();
  
  const [showAnnotations, setShowAnnotations] = useState(false); 
  const [wcsStatus, setWcsStatus] = useState<'Idle' | 'Solving' | 'Success' | 'Failed'>('Idle');
  const [solvingProgress, setSolvingProgress] = useState('');
  
  const [loadedImage, setLoadedImage] = useState<string | null>(null);
  const [loadedImageName, setLoadedImageName] = useState<string | null>(null);
  const [lastSafeImage, setLastSafeImage] = useState<string | null>(null); 
  
  const [imageDimensions, setImageDimensions] = useState<{width: number, height: number} | null>(null);
  const [exifBinary, setExifBinary] = useState<string | null>(null);
  const [parsedExif, setParsedExif] = useState<any | null>(null);
  const [localFitsHeaders, setLocalFitsHeaders] = useState<Record<string, any> | null>(null);
  const [showMetadataModal, setShowMetadataModal] = useState(false);
  const [showSaveMenu, setShowSaveMenu] = useState(false);

  const [solvedCalibration, setSolvedCalibration] = useState<CalibrationData | null>(null);
  const [nativeAnnotations, setNativeAnnotations] = useState<SolverAnnotation[]>([]);
  const [solverImageDimensions, setSolverImageDimensions] = useState<{width: number, height: number} | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [zoom, setZoom] = useState(1.0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false); 
  const [swapRB, setSwapRB] = useState(false); 

  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [startClickTime, setStartClickTime] = useState(0);
  const [cursor, setCursor] = useState('default');
  
  const lastPinchDist = useRef<number | null>(null);
  const hasFitImageRef = useRef<{w: number, h: number} | null>(null);
  const [showHistogram, setShowHistogram] = useState(false);
  const [histogramData, setHistogramData] = useState<HistogramStats | null>(null);
  const [blackPoint, setBlackPoint] = useState(0);
  const [midPoint, setMidPoint] = useState(1.0);
  const [whitePoint, setWhitePoint] = useState(255);
  const [debayerPattern, setDebayerPattern] = useState<string>('Auto');
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(true); 
  const [isHudOpen, setIsHudOpen] = useState(false);
  const [decodeError, setDecodeError] = useState(false);

  const [imageTick, setImageTick] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const originalImageRef = useRef<HTMLImageElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hitRegions = useRef<HitRegion[]>([]);

  const effLocation = location || { latitude: 35.6, longitude: 139.6 };
  const effTime = localTime || new Date();

  const resetImagingData = useCallback(() => {
    setLoadedImage(null);
    setLoadedImageName(null);
    setLastSafeImage(null);
    setWcsStatus('Idle');
    setSolvingProgress('');
    setSolvedCalibration(null);
    setNativeAnnotations([]);
    setSolverImageDimensions(null);
    setHistogramData(null);
    setParsedExif(null);
    setLocalFitsHeaders(null);
    setExifBinary(null);
    setImageDimensions(null);
    setDecodeError(false);
    hasFitImageRef.current = null;
    
    if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
  }, []);

  const lastActiveRef = useRef(false);
  useEffect(() => {
      const isAnyActive = isCapturing || isLiveViewActive || isVideoMode || isPreviewLoading;
      if ((isAnyActive && !lastActiveRef.current) || (isAnyActive && !externalImage)) {
          resetImagingData();
      }
      lastActiveRef.current = isAnyActive;
  }, [isCapturing, isLiveViewActive, isVideoMode, isPreviewLoading, externalImage, resetImagingData]);

  const fitImageToScreen = useCallback((imgW: number, imgH: number) => {
      if (containerRef.current) {
          const { clientWidth: cw, clientHeight: ch } = containerRef.current;
          if (cw > 0 && ch > 0 && imgW > 0 && imgH > 0) {
              const scale = Math.min(cw / imgW, ch / imgH) * 0.95; 
              setZoom(scale);
              const scaledW = imgW * scale; const scaledH = imgH * scale;
              setPan({ x: (cw - scaledW) / 2, y: (ch - scaledH) / 2 });
              hasFitImageRef.current = { w: imgW, h: imgH };
          }
      }
  }, []);

  const drawOverlays = useCallback((ctx: CanvasRenderingContext2D, width: number, height: number) => {
      hitRegions.current = []; 
      if (!showAnnotations) return;
      if (nativeAnnotations.length > 0) {
          const solverW = solverImageDimensions?.width || width;
          const solverH = solverImageDimensions?.height || height;
          const scaleX = width / solverW; const scaleY = height / solverH;
          ctx.save();
          ctx.strokeStyle = '#00ff00'; ctx.fillStyle = '#00ff00'; ctx.font = 'bold 14px sans-serif';
          ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.lineWidth = 2;
          nativeAnnotations.forEach(anno => {
              const x = anno.x * scaleX; const y = anno.y * scaleY; const r = (anno.radius || 10) * scaleX;
              ctx.beginPath(); ctx.arc(x, y, r + 5, 0, Math.PI * 2); ctx.stroke();
              if (anno.names && anno.names.length > 0) {
                  ctx.shadowColor = "black"; ctx.shadowBlur = 4; ctx.fillText(anno.names.join(', '), x + r + 8, y); ctx.shadowBlur = 0;
                  hitRegions.current.push({ x, y, r: Math.max(r, 30), obj: { id: `anno_${anno.names[0]}`, name: anno.names[0], nameJa: anno.names[0], type: 'Star', ra: '', dec: '', magnitude: 0 } });
              }
          });
          ctx.restore();
      }
  }, [showAnnotations, nativeAnnotations, solverImageDimensions]);

  const applyLutAndDraw = useCallback((ctx: CanvasRenderingContext2D, imageData: ImageData) => {
      const data = imageData.data;
      const rMult = colorBalance.r / 128; const gMult = colorBalance.g / 128; const bMult = colorBalance.b / 128;
      
      const histR = new Array(256).fill(0);
      const histG = new Array(256).fill(0);
      const histB = new Array(256).fill(0);
      
      const lut = new Uint8Array(256);
      for (let i = 0; i < 256; i++) {
          if (i <= blackPoint) lut[i] = 0;
          else if (i >= whitePoint) lut[i] = 255;
          else { const norm = (i - blackPoint) / (whitePoint - blackPoint); const val = Math.pow(norm, 1 / midPoint) * 255; lut[i] = Math.max(0, Math.min(255, val)); }
      }
      
      const len = data.length; 
      const histStep = len > 4000000 ? 4 : 1; 
      
      for (let i = 0; i < len; i += 4) {
          const srcR = swapRB ? data[i+2] : data[i]; const srcG = data[i+1]; const srcB = swapRB ? data[i] : data[i+2];
          let r = Math.min(255, Math.floor(srcR * rMult)); 
          let g = Math.min(255, Math.floor(srcG * gMult)); 
          let b = Math.min(255, Math.floor(srcB * bMult));
          
          if ((i / 4) % histStep === 0) { 
              histR[r]++; histG[g]++; histB[b]++; 
          }
          
          data[i] = lut[r]; data[i+1] = lut[g]; data[i+2] = lut[b]; data[i+3] = 255; 
      }
      
      const max = Math.max(...histR.slice(1,255), ...histG.slice(1,255), ...histB.slice(1,255)) || 1; 
      setHistogramData({ r: histR, g: histG, b: histB, max });
      
      ctx.putImageData(imageData, 0, 0); 
      drawOverlays(ctx, imageData.width, imageData.height);
  }, [blackPoint, whitePoint, midPoint, colorBalance, showAnnotations, drawOverlays, swapRB]);

  const renderRawFrame = useCallback((sourceBuffer: Uint8ClampedArray, width: number, height: number) => {
      if (!canvasRef.current || width <= 0 || height <= 0) return;
      const ctx = canvasRef.current.getContext('2d'); if (!ctx) return;
      if (canvasRef.current.width !== width || canvasRef.current.height !== height) {
          canvasRef.current.width = width; canvasRef.current.height = height; setImageDimensions({ width, height });
          if (!hasFitImageRef.current || hasFitImageRef.current.w !== width || hasFitImageRef.current.h !== height) fitImageToScreen(width, height);
      }
      const imageData = new ImageData(new Uint8ClampedArray(sourceBuffer), width, height);
      applyLutAndDraw(ctx, imageData); setDecodeError(false);
  }, [applyLutAndDraw, fitImageToScreen]);

  const renderMjpegFrame = useCallback(async (blobOrUrl: Blob | string) => {
      if (!canvasRef.current) return;
      const drawToCanvas = (drawable: CanvasImageSource, w: number, h: number) => {
          if (!canvasRef.current || w === 0 || h === 0) return;
          const ctx = canvasRef.current.getContext('2d', { willReadFrequently: true }); if (!ctx) return;
          if (canvasRef.current.width !== w || canvasRef.current.height !== h || !hasFitImageRef.current) {
              canvasRef.current.width = w; canvasRef.current.height = h; setImageDimensions({ width: w, height: h });
              if (!hasFitImageRef.current || hasFitImageRef.current.w !== w || hasFitImageRef.current.h !== h) fitImageToScreen(w, h);
          }
          ctx.drawImage(drawable, 0, 0, w, h); setDecodeError(false);
          try { 
              const imageData = ctx.getImageData(0, 0, w, h);
              applyLutAndDraw(ctx, imageData); 
          } catch(e) { console.error("Apply LUT failed", e); }
      };
      const img = new Image(); 
      img.crossOrigin = "Anonymous";
      const url = blobOrUrl instanceof Blob ? URL.createObjectURL(blobOrUrl) : blobOrUrl;
      img.onload = () => { drawToCanvas(img, img.naturalWidth || img.width, img.naturalHeight || img.height); if (blobOrUrl instanceof Blob) URL.revokeObjectURL(url); };
      img.onerror = () => setDecodeError(true); img.src = url;
  }, [fitImageToScreen, applyLutAndDraw]);

  const processImage = useCallback(() => {
      if (!canvasRef.current || !originalImageRef.current) return;
      const ctx = canvasRef.current.getContext('2d', { willReadFrequently: true }); if (!ctx) return;
      const img = originalImageRef.current;
      canvasRef.current.width = img.naturalWidth; canvasRef.current.height = img.naturalHeight;
      ctx.drawImage(img, 0, 0); applyLutAndDraw(ctx, ctx.getImageData(0, 0, img.naturalWidth, img.naturalHeight));
  }, [applyLutAndDraw]);

  useEffect(() => {
      if (externalImage) setImageTick(t => t + 1);
  }, [externalImage]);

  useEffect(() => {
      if ((isCapturing || isLiveViewActive || isPreviewLoading) && !externalImage && !loadedImage) {
          if (canvasRef.current) canvasRef.current.getContext('2d')?.clearRect(0,0,canvasRef.current.width,canvasRef.current.height);
          return;
      }
      if (externalImage) {
          setLastSafeImage(externalImage); 
          if (externalImage === 'raw-data-available' && externalMetadata?.rawBuffer) renderRawFrame(externalMetadata.rawBuffer, externalMetadata.rawWidth, externalMetadata.rawHeight);
          else renderMjpegFrame(externalImage);
      } else if (loadedImage) {
          processImage();
      }
  }, [externalImage, externalMetadata, renderRawFrame, renderMjpegFrame, loadedImage, processImage, isCapturing, isLiveViewActive, isPreviewLoading, showAnnotations, imageTick]); 

  useEffect(() => {
      if (!loadedImage || loadedImage === 'raw-data-available') return;
      const img = new Image(); img.crossOrigin = "Anonymous"; img.src = loadedImage;
      img.onload = () => { originalImageRef.current = img; setImageDimensions({ width: img.naturalWidth, height: img.naturalHeight }); fitImageToScreen(img.naturalWidth, img.naturalHeight); processImage(); };
  }, [loadedImage, processImage, fitImageToScreen]);

  const selectedObjectData = useMemo(() => {
      if (!selectedObject) return null;
      const lst = calculateLST(effLocation.longitude, effTime);
      const ra = hmsToDegrees(selectedObject.ra); const dec = dmsToDegrees(selectedObject.dec);
      const { alt, az } = raDecToAzAlt(ra, dec, effLocation.latitude, lst);
      return { type: selectedObject.type, magnitude: selectedObject.magnitude, ra: selectedObject.ra, dec: selectedObject.dec, az: az.toFixed(1), alt: alt.toFixed(1), transit: calculateTransitTime(ra, effLocation.longitude), isRising: alt > 0 };
  }, [selectedObject, effLocation, effTime]);

  const handleAutoStretch = () => {
      if (!histogramData) return;
      const combined = new Array(256).fill(0);
      for(let i=0; i<256; i++) combined[i] = histogramData.r[i] + histogramData.g[i] + histogramData.b[i];
      const total = combined.reduce((a,b)=>a+b,0);
      let min = 0, max = 255; let count = 0;
      for(let i=0; i<256; i++) { count += combined[i]; if(count > total * 0.01) { min = i; break; } }
      count = 0; for(let i=255; i>=0; i--) { count += combined[i]; if(count > total * 0.01) { max = i; break; } }
      setBlackPoint(Math.max(0, min-5)); setWhitePoint(Math.min(255, max+5)); setMidPoint(1.0);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]; if (!file) return;
      onStopStream?.();
      resetImagingData();
      const reader = new FileReader();
      if (/\.fits?$/i.test(file.name)) {
          reader.onload = (ev) => { if (ev.target?.result instanceof ArrayBuffer) { const res = AstroService.rawFitsToDisplay(ev.target.result, 'fits', debayerPattern); if (res.url) { setLoadedImage(res.url); setLoadedImageName(file.name); setLocalFitsHeaders(res.headers); } } };
          reader.readAsArrayBuffer(file);
      } else {
          reader.onload = (ev) => { if (typeof ev.target?.result === 'string') { setLoadedImage(ev.target.result); setLoadedImageName(file.name); setLocalFitsHeaders(null); } };
          reader.readAsDataURL(file);
      }
  };

  const handleSolveWCS = async () => {
      if (plateSolverType === 'Remote' && !apiKey) { alert(t('autoCenter.error.apiKey')); return; }
      let imageUrl = null;
      const defaultFrameName = t('imagingView.capturedFrame');
      if (!isCapturing && !isLiveViewActive && !isVideoMode && !isPreviewLoading && loadedImage && loadedImage !== 'raw-data-available' && loadedImageName !== defaultFrameName) imageUrl = loadedImage;
      else imageUrl = canvasRef.current?.toDataURL('image/jpeg', 0.85);
      if (!imageUrl) return;
      if (imageUrl === canvasRef.current?.toDataURL('image/jpeg', 0.85)) { 
        //onStopStream?.(); 
        setLoadedImage(imageUrl); 
        setLoadedImageName(defaultFrameName); }

      setWcsStatus('Solving'); setSolvingProgress(t('imagingView.captureInfo.solving'));
      try {
          const result = (plateSolverType === 'Local') 
              ? await solveImageLocal(imageUrl, localSolverSettings.host, localSolverSettings.port, setSolvingProgress)
              : await solveImageAstrometryNet(imageUrl, apiKey, setSolvingProgress);
          if (result.success && result.calibration) {
              setWcsStatus('Success'); setSolvedCalibration(result.calibration); setNativeAnnotations(result.annotations);
              if (result.imageWidth) setSolverImageDimensions({ width: result.imageWidth, height: result.imageHeight! });
              setShowAnnotations(true); AstroService.syncToCoordinates(result.calibration.ra, result.calibration.dec);
          } else { setWcsStatus('Failed'); setSolvingProgress(result.error || 'Unknown error'); }
      } catch (e: any) { setWcsStatus('Failed'); setSolvingProgress(e.message); }
  };

  const handleMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
      if ('touches' in e && e.touches.length === 2) { 
          e.preventDefault();
          lastPinchDist.current = getDistance(e.touches[0], e.touches[1]); 
          return; 
      }
      setIsDragging(true); 
      const cX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
      const cY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
      setDragStart({ x: cX - pan.x, y: cY - pan.y }); 
      setStartClickTime(Date.now()); 
      if (cursor !== 'pointer') setCursor('grabbing');
  };

  const handleMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
      if ('touches' in e && e.touches.length === 2) {
          e.preventDefault();
          const dist = getDistance(e.touches[0], e.touches[1]);
          if (lastPinchDist.current !== null) {
              const delta = (dist - lastPinchDist.current!) * 0.005;
              setZoom(prev => Math.max(0.01, Math.min(20, prev * (1 + delta))));
          }
          lastPinchDist.current = dist; 
          return;
      }
      const cX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
      const cY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
      if (isDragging) {
          e.preventDefault();
          setPan({ x: cX - dragStart.x, y: cY - dragStart.y }); 
          return; 
      }
      if (containerRef.current && showAnnotations && hitRegions.current.length > 0) {
          const rect = containerRef.current.getBoundingClientRect(); 
          const mX = cX - rect.left; 
          const mY = cY - rect.top;
          let isHover = false; 
          const w = imageDimensions?.width || 0;
          const h = imageDimensions?.height || 0;
          for (const hit of hitRegions.current) {
              let sX = flipH ? pan.x + (w * zoom) - (hit.x * zoom) : pan.x + (hit.x * zoom);
              let sY = flipV ? pan.y + (h * zoom) - (hit.y * zoom) : pan.y + (hit.y * zoom);
              if (Math.hypot(mX - sX, mY - sY) < Math.max(hit.r * zoom, 20)) { isHover = true; break; }
          }
          setCursor(isHover ? 'pointer' : 'grab');
      } else setCursor(isDragging ? 'grabbing' : 'grab');
  };

  const handleMouseUp = (e: React.MouseEvent | React.TouchEvent) => {
      if (lastPinchDist.current !== null) { lastPinchDist.current = null; return; }
      setIsDragging(false); if (cursor !== 'pointer') setCursor('grab');
      if (Date.now() - startClickTime < 200) {
          if (containerRef.current && showAnnotations && hitRegions.current.length > 0) {
              const cX = 'changedTouches' in e ? e.changedTouches[0].clientX : (e as React.MouseEvent).clientX;
              const cY = 'changedTouches' in e ? e.changedTouches[0].clientY : (e as React.MouseEvent).clientY;
              const rect = containerRef.current.getBoundingClientRect(); const mX = cX - rect.left; const mY = cY - rect.top;
              let bestHit = null; let minD = Infinity; 
              const w = imageDimensions?.width || 0;
              const h = imageDimensions?.height || 0;
              for (const hit of hitRegions.current) {
                  let sX = flipH ? pan.x + (w * zoom) - (hit.x * zoom) : pan.x + (hit.x * zoom);
                  let sY = flipV ? pan.y + (h * zoom) - (hit.y * zoom) : pan.y + (hit.y * zoom);
                  const dist = Math.hypot(mX - sX, mY - sY);
                  if (dist < Math.max(hit.r * zoom, 20) && dist < minD) { minD = dist; bestHit = hit; }
              }
              if (bestHit) {
                  const obj = bestHit.obj;
                  if (solvedCalibration && solverImageDimensions && imageDimensions) {
                      const wcs = pixelToWcs(bestHit.x / (imageDimensions.width/solverImageDimensions.width), bestHit.y / (imageDimensions.height/solverImageDimensions.height), solvedCalibration, solverImageDimensions.width, solverImageDimensions.height);
                      if (wcs) { obj.ra = decimalToSexagesimal(wcs.ra / 15); obj.dec = decimalToSexagesimal(wcs.dec); }
                  }
                  onSelectObject(obj); setIsHudOpen(true); return;
              }
          }
          if (selectedObject) setIsHudOpen(!isHudOpen);
      }
  };

  const handleZoomStep = useCallback((factor: number) => {
      if (!containerRef.current) return;
      const { clientWidth: cw, clientHeight: ch } = containerRef.current;
      const sx = cw / 2;
      const sy = ch / 2;

      setZoom(prevZoom => {
          const nextZoom = Math.max(0.01, Math.min(20, prevZoom * factor));
          const ratio = nextZoom / prevZoom;
          setPan(prevPan => ({
              x: sx - (sx - prevPan.x) * ratio,
              y: sy - (sy - prevPan.y) * ratio
          }));
          return nextZoom;
      });
  }, []);

  useEffect(() => {
      if (!containerRef.current) return;
      const observer = new ResizeObserver(() => {
          if (imageDimensions) {
              fitImageToScreen(imageDimensions.width, imageDimensions.height);
          }
      });
      observer.observe(containerRef.current);
      return () => observer.disconnect();
  }, [imageDimensions, fitImageToScreen]);

  const tX = pan.x + (flipH && imageDimensions ? imageDimensions.width * zoom : 0);
  const tY = pan.y + (flipV && imageDimensions ? imageDimensions.height * zoom : 0);
  const hasContent = loadedImage || lastSafeImage || (canvasRef.current && canvasRef.current.width > 0);

  const stopProp = {
      onMouseDown: (e: React.MouseEvent) => e.stopPropagation(),
      onMouseMove: (e: React.MouseEvent) => e.stopPropagation(),
      onTouchStart: (e: React.TouchEvent) => e.stopPropagation(),
      onTouchMove: (e: React.TouchEvent) => e.stopPropagation(),
  };

  return (
    <div className="relative w-full h-full bg-black overflow-hidden flex flex-col select-none">
       {!isMini && selectedObject && isHudOpen && (
           <CelestialObjectHUD object={selectedObject} data={selectedObjectData} isConnected={!!isLiveViewActive || isCapturing} onClose={() => setIsHudOpen(false)} />
       )}
       <div className="relative w-full h-full bg-[#020617] active:cursor-grabbing overflow-hidden touch-none" style={{ cursor, touchAction: 'none' }} ref={containerRef} onWheel={(e) => setZoom(prev => Math.max(0.01, Math.min(20, prev * (1 - e.deltaY * 0.001))))} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp} onTouchStart={handleMouseDown} onTouchMove={handleMouseMove} onTouchEnd={handleMouseUp}>
        <input type="file" accept="image/*,.fits,.fit,.fts" className="hidden" ref={fileInputRef} onChange={handleFileChange} />
        <canvas ref={canvasRef} className="absolute top-0 left-0 origin-top-left rendering-pixelated" style={{ transform: `translate(${tX}px, ${tY}px) scale(${zoom}) scaleX(${flipH ? -1 : 1}) scaleY(${flipV ? -1 : 1})` }} />
        {showHistogram && histogramData && !isMini && (
            <div 
                className="absolute top-20 right-2 md:right-4 bg-slate-900/90 p-3 rounded-lg border border-slate-700 shadow-xl w-72 z-40 pointer-events-auto backdrop-blur-md animate-fadeIn flex flex-col gap-2"
                {...stopProp}
            >
                <div className="flex justify-between items-center border-b border-slate-700 pb-1 mb-1"><span className="text-xs font-bold text-slate-300 flex items-center gap-2"><HistogramIcon className="w-3 h-3" />{t('imagingView.histogram')}</span><button onClick={() => setShowHistogram(false)} className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-700"><CloseIcon className="w-4 h-4" /></button></div>
                <div className="flex items-end w-full h-32 gap-px opacity-90 border-b border-slate-700 pb-1 mb-1 relative overflow-hidden">
                    <svg width="100%" height="100%" viewBox="0 0 256 100" preserveAspectRatio="none">
                        <path d={`M0,100 ${histogramData.r.map((v, i) => `L${i},${100 - (v / histogramData.max) * 100}`).join(' ')} L255,100`} fill="rgba(239, 68, 68, 0.5)" />
                        <path d={`M0,100 ${histogramData.g.map((v, i) => `L${i},${100 - (v / histogramData.max) * 100}`).join(' ')} L255,100`} fill="rgba(34, 197, 94, 0.5)" style={{mixBlendMode: 'screen'}} />
                        <path d={`M0,100 ${histogramData.b.map((v, i) => `L${i},${100 - (v / histogramData.max) * 100}`).join(' ')} L255,100`} fill="rgba(59, 130, 246, 0.5)" style={{mixBlendMode: 'screen'}} />
                    </svg>
                </div>
                <div className="space-y-1">
                    <div className="flex justify-between text-[10px] text-slate-400"><span>{t('imagingView.blackPoint')}</span><span>{blackPoint}</span></div>
                    <input type="range" min="0" max="255" value={blackPoint} onChange={(e) => setBlackPoint(Number(e.target.value))} className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer" />
                    <div className="flex justify-between text-[10px] text-slate-400"><span>{t('imagingView.midTones')}</span><span>{midPoint.toFixed(2)}</span></div>
                    <input type="range" min="0.1" max="3.0" step="0.05" value={midPoint} onChange={(e) => setMidPoint(Number(e.target.value))} className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer" />
                    <div className="flex justify-between text-[10px] text-slate-400"><span>{t('imagingView.whitePoint')}</span><span>{whitePoint}</span></div>
                    <input type="range" min="0" max="255" value={whitePoint} onChange={(e) => setWhitePoint(Number(e.target.value))} className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer" />
                </div>
                <div className="flex gap-2 mt-1"><button onClick={handleAutoStretch} className="flex-1 bg-blue-700 hover:bg-blue-600 text-white text-[10px] py-1 rounded border border-blue-600 font-bold">{t('imagingView.autoStretch')}</button><button onClick={() => { setBlackPoint(0); setWhitePoint(255); setMidPoint(1.0); }} className="flex-1 bg-slate-700 hover:bg-slate-600 text-white text-[10px] py-1 rounded border border-slate-600">{t('imagingView.reset')}</button></div>
            </div>
        )}
        {((isCapturing || isLiveViewActive || isPreviewLoading) && !externalImage && !loadedImage) && (
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-20"><div className="flex flex-col items-center gap-3"><div className="w-8 h-8 border-4 border-t-red-500 border-slate-700 rounded-full animate-spin"></div><span className="text-slate-400 animate-pulse text-sm font-mono">{isPreviewLoading ? t('controlPanel.preview') + "..." : t('imagingView.waitingForStream')}</span></div></div>
        )}
        {!loadedImage && !externalImage && !isCapturing && !isLiveViewActive && !isPreviewLoading && (<div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"><div className="text-slate-500 mb-4">{t('imagingView.noTarget')}</div></div>)}
        {decodeError && (<div className="absolute top-4 left-4 bg-red-900/80 px-3 py-1 rounded border border-red-500 flex items-center gap-2 pointer-events-none z-40"><span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span><span className="text-xs text-red-200 font-mono font-bold">{t('imagingView.decodingError')}</span></div>)}
      </div>

       {!isMini && (
           <div className="absolute bottom-4 md:bottom-4 left-1/2 -translate-x-1/2 z-30 pointer-events-auto flex gap-2 items-end">
               {!(isCapturing || isLiveViewActive || isPreviewLoading) && (
                   <Button onClick={() => fileInputRef.current?.click()} className="shadow-lg bg-slate-800/80 hover:bg-red-700 backdrop-blur-sm border border-slate-600 text-xs sm:text-sm">
                       <ListIcon className="w-4 h-4 sm:w-5 sm:h-5"/> {t('imagingView.loadImage')}
                   </Button>
               )}
               {(hasContent) && wcsStatus === 'Success' && selectedObject && (
                   <Button onClick={() => onShowInfo(selectedObject.name)} className="shadow-lg bg-red-800/80 hover:bg-red-700 backdrop-blur-sm border border-red-600 text-xs sm:text-sm">
                       {t('controlPanel.showObjectInfo')}
                   </Button>
               )}
           </div>
       )}

       {/* 修正：右側のボタン群。モバイルでは位置を下げ(bottom-20)、サイズを小型化(w-9 h-9) */}
       {!isMini && (
           <div 
               className="absolute bottom-20 md:bottom-4 right-2 md:right-4 flex flex-col gap-1 md:gap-2 z-30 pointer-events-auto items-end"
               onMouseDown={stopProp.onMouseDown} onTouchStart={stopProp.onTouchStart}
           >
                <button onClick={() => setShowMetadataModal(true)} className="w-9 h-9 md:w-12 md:h-12 flex items-center justify-center bg-slate-800 rounded-full text-white border border-slate-600 hover:bg-slate-700 shadow-lg" title={t('imagingView.metaBtn')}>
                    <span className="text-[10px] md:text-xs font-black uppercase">Meta</span>
                </button>
                <button onClick={() => setShowHistogram(!showHistogram)} className={`w-9 h-9 md:w-12 md:h-12 rounded-full border shadow-lg flex items-center justify-center transition-colors ${showHistogram ? 'bg-red-700 text-white border-red-500' : 'bg-slate-800 text-slate-400 border-slate-600'}`} title={t('tooltips.histogram')}>
                    <HistogramIcon className="w-5 h-5 md:w-6 md:h-6" />
                </button>
                {(hasContent) && (
                    <div className="relative">
                        <button onClick={() => setShowSaveMenu(!showSaveMenu)} className="w-9 h-9 md:w-12 md:h-12 flex items-center justify-center bg-slate-800 rounded-full text-white border border-slate-600 hover:bg-slate-700 shadow-lg" title={t('tooltips.saveImage')}>
                            <SaveIcon className="w-5 h-5 md:w-6 md:h-6"/>
                        </button>
                        {showSaveMenu && (
                            <div className="absolute bottom-full right-0 mb-2 bg-slate-800 rounded-lg border border-slate-600 shadow-xl overflow-hidden flex flex-col w-28 md:w-32">
                                <button className="px-3 py-2 text-xs text-left hover:bg-slate-700 text-slate-200" onClick={async () => { if (canvasRef.current) { const blob = exportJPEG(canvasRef.current, exifBinary, solvedCalibration, location); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'capture.jpg'; a.click(); } setShowSaveMenu(false); }}>JPEG</button>
                                <button className="px-3 py-2 text-xs text-left hover:bg-slate-700 text-slate-200" onClick={async () => { if (canvasRef.current) { const blob = await exportFITS(canvasRef.current, solvedCalibration, location); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'capture.fits'; a.click(); } setShowSaveMenu(false); }}>FITS</button>
                                <button className="px-3 py-2 text-xs text-left hover:bg-slate-700 text-slate-200" onClick={async () => { if (canvasRef.current) { const blob = await exportTIFF(canvasRef.current, solvedCalibration, location); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'capture.tif'; a.click(); } setShowSaveMenu(false); }}>TIFF</button>
                            </div>
                        )}
                    </div>
                )}
                <button onClick={() => handleZoomStep(1.5)} className="w-9 h-9 md:w-12 md:h-12 flex items-center justify-center bg-slate-800 rounded-full text-white border border-slate-600 hover:bg-slate-700 shadow-lg" title={t('tooltips.zoomIn')}>
                    <ZoomInIcon className="w-5 h-5 md:w-6 md:h-6"/>
                </button>
                <button onClick={() => fitImageToScreen(imageDimensions?.width || 100, imageDimensions?.height || 100)} className="w-9 h-9 md:w-12 md:h-12 flex items-center justify-center bg-slate-800 rounded-full text-white border border-slate-600 hover:bg-slate-700 shadow-lg" title={t('tooltips.resetView')}>
                    <ResetIcon className="w-5 h-5 md:w-6 md:h-6"/>
                </button>
                <button onClick={() => handleZoomStep(0.7)} className="w-9 h-9 md:w-12 md:h-12 flex items-center justify-center bg-slate-800 rounded-full text-white border border-slate-600 hover:bg-slate-700 shadow-lg" title={t('tooltips.zoomOut')}>
                    <ZoomOutIcon className="w-5 h-5 md:w-6 md:h-6"/>
                </button>
           </div>
       )}

       {!isMini && (
           <div className={`absolute top-12 left-2 md:top-auto md:bottom-4 z-30 flex flex-col items-start gap-2 transition-all duration-300`}>
               <div className="bg-slate-900/80 p-3 rounded-lg border border-red-900/30 backdrop-blur-sm shadow-lg w-44 pointer-events-auto box-border">
                   <div className="flex justify-between items-center border-b border-red-900/30 pb-2 mb-2 cursor-pointer" onClick={() => setIsPanelCollapsed(!isPanelCollapsed)}>
                       <h3 className="text-red-400 font-bold text-xs">{t('imagingView.plateSolvingTitle', { type: plateSolverType })}</h3>
                       {isPanelCollapsed ? <ChevronUpIcon className="w-3 h-3 text-slate-400"/> : <ChevronDownIcon className="w-3 h-3 text-slate-400"/>}
                   </div>
                   {!isPanelCollapsed && (
                       <div className="space-y-3">
                           <div className="flex gap-2 justify-between">
                               <button onClick={() => setFlipH(!flipH)} title={t('tooltips.flip')} className={`flex-1 text-[10px] py-1 rounded border transition-colors ${flipH ? 'bg-red-700 border-red-500 text-white' : 'bg-slate-800 border-slate-600 text-slate-300'}`}>{t('imagingView.flipH')}</button>
                               <button onClick={() => setFlipV(!flipV)} title={t('tooltips.flip')} className={`flex-1 text-[10px] py-1 rounded border transition-colors ${flipV ? 'bg-red-700 border-red-500 text-white' : 'bg-slate-800 border-slate-600 text-slate-300'}`}>{t('imagingView.flipV')}</button>
                           </div>
                           <div className="flex gap-2">
                               <button onClick={() => setSwapRB(!swapRB)} title={t('tooltips.swapRB')} className={`flex-1 text-[10px] py-1 rounded border transition-colors ${swapRB ? 'bg-blue-700 border-blue-500 text-white' : 'bg-slate-800 border-slate-600 text-slate-300'}`}>{t('imagingView.swapRB')}</button>
                           </div>
                           <div className="flex flex-col gap-1">
                               <label className="text-[10px] text-slate-400">{t('imagingView.debayerPattern')}</label>
                               <select 
                                   value={debayerPattern} title={t('tooltips.debayer')} 
                                   onChange={(e) => {
                                       setDebayerPattern(e.target.value);
                                       if (loadedImageName?.toLowerCase().endsWith('.fits') || loadedImageName?.toLowerCase().endsWith('.fit')) {
                                           AstroService.reprocessRawFITS(e.target.value);
                                       }
                                   }}
                                   className="bg-slate-800 border border-slate-600 rounded px-1 py-0.5 text-[10px] text-slate-200 outline-none focus:border-red-500"
                               >
                                   <option value="Auto">Auto</option>
                                   <option value="RGGB">RGGB</option>
                                   <option value="BGGR">BGGR</option>
                                   <option value="GRBG">GRBG</option>
                                   <option value="GBRG">GBRG</option>
                               </select>
                           </div>
                           <div className="flex justify-between items-center text-xs">
                               <span className="text-slate-400">WCS:</span>
                               <span className={wcsStatus === 'Success' ? 'text-green-400' : (wcsStatus === 'Failed' ? 'text-red-400' : 'text-slate-200')}>{wcsStatus === 'Solving' ? (solvingProgress || t('imagingView.captureInfo.solving')) : wcsStatus}</span>
                           </div>
                           {wcsStatus === 'Solving' && (<div className="w-full bg-slate-700 h-1 rounded-full overflow-hidden mt-1"><div className="h-full bg-red-500 animate-pulse w-2/3"></div></div>)}
                           {wcsStatus === 'Success' && (<div className="flex items-center gap-2"><span className="text-xs text-slate-400">Annotations</span><input type="checkbox" checked={showAnnotations} onChange={(e) => setShowAnnotations(e.target.checked)} className="rounded bg-slate-700 border-slate-600" /></div>)}
                           <div className="pt-2 border-t border-slate-700">
                               {plateSolverType === 'Remote' && (<input type="password" value={apiKey} onChange={(e) => onApiKeyChange?.(e.target.value)} className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-slate-200 mb-2 select-text" placeholder={t('imagingView.apiKey')} />)}
                               {plateSolverType === 'Local' && (<div className="text-[10px] text-slate-500 mb-2 truncate">Using: {localSolverSettings.host}:{localSolverSettings.port}</div>)}
                               <Button onClick={handleSolveWCS} disabled={wcsStatus === 'Solving'} title={t('tooltips.solveField')} className="w-full text-xs py-1 h-8">{t('imagingView.solveField')}</Button>
                           </div>
                       </div>
                   )}
               </div>
           </div>
       )}
        <MetadataViewer isOpen={showMetadataModal} onClose={() => setShowMetadataModal(false)} exifData={parsedExif} wcsData={solvedCalibration} fitsHeaders={localFitsHeaders || externalMetadata}/>
    </div>
  );
};
