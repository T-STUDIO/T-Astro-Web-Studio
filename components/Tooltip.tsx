
import React, { useState, useRef, useEffect } from 'react';

interface TooltipProps {
    children: React.ReactNode;
    title: string;
    position?: 'top' | 'bottom' | 'left' | 'right';
    className?: string;
}

export const Tooltip: React.FC<TooltipProps> = ({ children, title, position = 'top', className = '' }) => {
    const [isVisible, setIsVisible] = useState(false);
    const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
    const containerRef = useRef<HTMLDivElement>(null);
    const tooltipRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!isVisible || !containerRef.current || !tooltipRef.current) return;

        const containerRect = containerRef.current.getBoundingClientRect();
        const tooltipRect = tooltipRef.current.getBoundingClientRect();
        
        let top = 0;
        let left = 0;
        const gap = 8;

        switch (position) {
            case 'top':
                top = containerRect.top - tooltipRect.height - gap;
                left = containerRect.left + containerRect.width / 2 - tooltipRect.width / 2;
                break;
            case 'bottom':
                top = containerRect.bottom + gap;
                left = containerRect.left + containerRect.width / 2 - tooltipRect.width / 2;
                break;
            case 'left':
                top = containerRect.top + containerRect.height / 2 - tooltipRect.height / 2;
                left = containerRect.left - tooltipRect.width - gap;
                break;
            case 'right':
                top = containerRect.top + containerRect.height / 2 - tooltipRect.height / 2;
                left = containerRect.right + gap;
                break;
        }

        // Keep tooltip within viewport
        if (left < 0) left = 8;
        if (left + tooltipRect.width > window.innerWidth) left = window.innerWidth - tooltipRect.width - 8;
        if (top < 0) top = 8;
        if (top + tooltipRect.height > window.innerHeight) top = window.innerHeight - tooltipRect.height - 8;

        setTooltipPos({ top, left });
    }, [isVisible, position]);

    return (
        <div
            ref={containerRef}
            className={`relative w-full ${className}`}
            onMouseEnter={() => setIsVisible(true)}
            onMouseLeave={() => setIsVisible(false)}
        >
            {children}
            {isVisible && (
                <div
                    ref={tooltipRef}
                    className="fixed z-[999] px-3 py-2 text-xs font-medium text-white bg-slate-800 border border-slate-600 rounded shadow-lg whitespace-nowrap pointer-events-none"
                    style={{
                        top: `${tooltipPos.top}px`,
                        left: `${tooltipPos.left}px`,
                    }}
                >
                    {title}
                    <div
                        className="absolute w-2 h-2 bg-slate-800 border-r border-b border-slate-600 transform rotate-45"
                        style={{
                            ...(position === 'top' && { bottom: '-5px', left: '50%', marginLeft: '-4px' }),
                            ...(position === 'bottom' && { top: '-5px', left: '50%', marginLeft: '-4px' }),
                            ...(position === 'left' && { right: '-5px', top: '50%', marginTop: '-4px' }),
                            ...(position === 'right' && { left: '-5px', top: '50%', marginTop: '-4px' }),
                        }}
                    />
                </div>
            )}
        </div>
    );
};
