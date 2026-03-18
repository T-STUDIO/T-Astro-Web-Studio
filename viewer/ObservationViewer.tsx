import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BroadcastService } from './BroadcastService';

const ObservationViewer: React.FC = () => {
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [metadata, setMetadata] = useState<any>(null);
    const [scale, setScale] = useState(1);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [lastTouch, setLastTouch] = useState<{ x: number, y: number } | null>(null);
    const [lastPinchDist, setLastPinchDist] = useState<number | null>(null);
    const [lastTapTime, setLastTapTime] = useState(0);

    const containerRef = useRef<HTMLDivElement>(null);
    const imageRef = useRef<HTMLImageElement>(null);

    useEffect(() => {
        const service = BroadcastService.getInstance();
        service.setOnImageReceived((url, meta) => {
            setImageUrl(url);
            setMetadata(meta);
        });
    }, []);

    const resetView = useCallback(() => {
        setScale(1);
        setOffset({ x: 0, y: 0 });
    }, []);

    // Mouse Events
    const handleWheel = (e: React.WheelEvent) => {
        const zoomSpeed = 0.1;
        const delta = e.deltaY > 0 ? -zoomSpeed : zoomSpeed;
        const newScale = Math.max(0.1, Math.min(10, scale + delta));
        setScale(newScale);
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        if (e.button !== 0) return;
        setIsDragging(true);
        setLastTouch({ x: e.clientX, y: e.clientY });
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging || !lastTouch) return;
        const dx = e.clientX - lastTouch.x;
        const dy = e.clientY - lastTouch.y;
        setOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
        setLastTouch({ x: e.clientX, y: e.clientY });
    };

    const handleMouseUp = () => {
        setIsDragging(false);
        setLastTouch(null);
    };

    const handleDoubleClick = () => {
        resetView();
    };

    // Touch Events
    const handleTouchStart = (e: React.TouchEvent) => {
        if (e.touches.length === 1) {
            const now = Date.now();
            if (now - lastTapTime < 300) {
                resetView();
            }
            setLastTapTime(now);
            setLastTouch({ x: e.touches[0].clientX, y: e.touches[0].clientY });
        } else if (e.touches.length === 2) {
            const dist = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            setLastPinchDist(dist);
        }
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (e.touches.length === 1 && lastTouch) {
            const dx = e.touches[0].clientX - lastTouch.x;
            const dy = e.touches[0].clientY - lastTouch.y;
            setOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
            setLastTouch({ x: e.touches[0].clientX, y: e.touches[0].clientY });
        } else if (e.touches.length === 2 && lastPinchDist) {
            const dist = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            const delta = (dist - lastPinchDist) / 100;
            const newScale = Math.max(0.1, Math.min(10, scale + delta));
            setScale(newScale);
            setLastPinchDist(dist);
        }
    };

    const handleTouchEnd = () => {
        setLastTouch(null);
        setLastPinchDist(null);
    };

    const handleClose = () => {
        window.close();
        setTimeout(() => {
            window.location.href = '../index.html';
        }, 100);
    };

    return (
        <div 
            ref={containerRef}
            className="fixed inset-0 bg-black flex items-center justify-center overflow-hidden touch-none select-none"
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onDoubleClick={handleDoubleClick}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
        >
            {imageUrl ? (
                <div 
                    style={{
                        transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
                        transition: isDragging ? 'none' : 'transform 0.1s ease-out'
                    }}
                >
                    <img 
                        ref={imageRef}
                        src={imageUrl} 
                        alt="Observation" 
                        className="max-w-none pointer-events-none"
                        referrerPolicy="no-referrer"
                    />
                    {metadata && (
                        <div className="absolute top-4 left-4 bg-black/50 text-white p-2 text-xs rounded pointer-events-none">
                            {metadata.objectName && <div>Target: {metadata.objectName}</div>}
                            {metadata.exposure && <div>Exp: {metadata.exposure}s</div>}
                        </div>
                    )}
                </div>
            ) : (
                <div className="text-slate-500 text-sm animate-pulse">
                    Waiting for image...
                </div>
            )}

            {/* Close Button */}
            <button 
                onClick={handleClose}
                className="absolute top-4 right-4 w-10 h-10 bg-red-900/50 hover:bg-red-800/80 text-white rounded-full flex items-center justify-center transition-colors z-50"
                aria-label="Close"
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
        </div>
    );
};

export default ObservationViewer;
