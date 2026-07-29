import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Loader2 } from 'lucide-react';
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
            style={{
                position: 'fixed',
                inset: 0,
                width: '100vw',
                height: '100vh',
                backgroundColor: '#000000',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                touchAction: 'none',
                userSelect: 'none'
            }}
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
                        style={{
                            maxWidth: 'none',
                            maxHeight: 'none',
                            pointerEvents: 'none'
                        }}
                        referrerPolicy="no-referrer"
                    />
                    {metadata && (
                        <div style={{
                            position: 'fixed',
                            bottom: '16px',
                            left: '16px',
                            backgroundColor: 'rgba(0, 0, 0, 0.75)',
                            backdropFilter: 'blur(4px)',
                            border: '1px solid rgba(255, 255, 255, 0.15)',
                            color: '#e2e8f0',
                            padding: '10px 14px',
                            borderRadius: '8px',
                            fontSize: '12px',
                            pointerEvents: 'none',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                            zIndex: 1000
                        }}>
                            {metadata.objectName && <div style={{ fontWeight: 600, color: '#f8fafc', marginBottom: '2px' }}>Target: {metadata.objectName}</div>}
                            {metadata.exposure && <div style={{ color: '#94a3b8' }}>Exp: {metadata.exposure}s</div>}
                        </div>
                    )}
                </div>
            ) : (
                <div 
                    style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '12px',
                        color: '#94a3b8',
                        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif'
                    }}
                >
                    <Loader2 className="animate-spin" style={{ width: '32px', height: '32px', color: '#ef4444' }} />
                    <span style={{ fontSize: '14px', fontWeight: 500, letterSpacing: '0.03em', color: '#cbd5e1' }}>
                        Waiting for image...
                    </span>
                </div>
            )}

            {/* Close Button */}
            <button 
                onClick={handleClose}
                style={{
                    position: 'fixed',
                    top: '20px',
                    right: '20px',
                    width: '44px',
                    height: '44px',
                    backgroundColor: 'rgba(185, 28, 28, 0.85)',
                    color: '#ffffff',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    boxShadow: '0 4px 15px rgba(0, 0, 0, 0.6)',
                    cursor: 'pointer',
                    zIndex: 99999,
                    outline: 'none',
                    padding: 0
                }}
                aria-label="Close"
            >
                <X style={{ width: '24px', height: '24px', strokeWidth: 2.5 }} />
            </button>
        </div>
    );
};

export default ObservationViewer;
