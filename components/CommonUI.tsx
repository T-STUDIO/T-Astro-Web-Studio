import React, { memo, useEffect, useState } from 'react';
import { ConnectionStatus, SampStatus } from '../types';
import { decimalToSexagesimal, sexagesimalToDecimal } from '../utils/coords';

export const ConnectionStatusIndicator: React.FC<{ status: ConnectionStatus | SampStatus, labels: Record<string, string> }> = ({ status, labels }) => {
  const color = {
    Disconnected: 'bg-slate-500',
    Connecting: 'bg-yellow-500 animate-pulse',
    Connected: 'bg-green-500', 
    Error: 'bg-red-500',
  }[status] || 'bg-slate-500';

  return (
    <div className="flex items-center gap-2">
      <span className={`w-3 h-3 rounded-full ${color}`}></span>
      <span className="text-sm font-medium">{labels[status] || status}</span>
    </div>
  );
};

export const ToggleSwitch = memo(({ id, checked, onChange, label, title, disabled }: { id: string, checked: boolean, onChange: (checked: boolean) => void, label: string, title?: string, disabled?: boolean }) => (
    <label htmlFor={id} className={`flex items-center justify-between cursor-pointer w-full p-2 hover:bg-slate-800 rounded-md transition-colors ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`} title={title}>
      <span className="text-sm font-medium text-slate-300">{label}</span>
      <Switch id={id} checked={checked} onChange={onChange} disabled={disabled} />
    </label>
));

export const Switch = memo(({ id, checked, onChange, disabled, title }: { id: string, checked: boolean, onChange: (checked: boolean) => void, disabled?: boolean, title?: string }) => (
  <div className="relative" title={title}>
    <input
      id={id}
      type="checkbox"
      className="sr-only peer"
      checked={checked}
      onChange={(e) => !disabled && onChange(e.target.checked)}
      disabled={disabled}
    />
    <div className={`w-11 h-6 bg-slate-700 rounded-full peer peer-focus:ring-2 peer-focus:ring-red-500 peer-focus:ring-offset-2 peer-focus:ring-offset-slate-900 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-700 ${disabled ? 'opacity-50' : ''}`}></div>
  </div>
));

export const RangeSlider = memo(({ id, label, value, min, max, step, onChange, unit, disabled, colorClass = 'bg-slate-700', onAfterChange, title }: { id: string; label: string; value: number; min: number; max: number; step: number; onChange: (value: number) => void; unit?: string; disabled?: boolean; colorClass?: string; onAfterChange?: (value: number) => void; title?: string }) => {
    return (
    <div className="space-y-1" title={title}>
        <label htmlFor={id} className="flex justify-between items-center text-sm font-medium text-slate-300">
            <span>{label}</span>
            <div className="flex items-center gap-1">
                <input 
                    type="number" 
                    value={value} 
                    onChange={(e) => {
                        const val = Math.max(min, Math.min(max, Number(e.target.value)));
                        onChange(val);
                    }}
                    onBlur={() => onAfterChange && onAfterChange(value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            onAfterChange && onAfterChange(value);
                            (e.target as HTMLInputElement).blur();
                        }
                    }}
                    className="w-16 bg-slate-900 border border-slate-600 rounded px-1 text-right text-xs font-mono text-red-400 focus:outline-none focus:border-red-500 select-text"
                />
                <span className="font-mono text-xs text-slate-500 w-4">{unit}</span>
            </div>
        </label>
        <input 
            type="range"
            id={id}
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
            onMouseUp={(e) => onAfterChange && onAfterChange(Number((e.currentTarget as HTMLInputElement).value))}
            onTouchEnd={(e) => onAfterChange && onAfterChange(Number((e.currentTarget as HTMLInputElement).value))}
            className={`w-full h-2 ${colorClass} rounded-lg appearance-none cursor-pointer range-thumb-red`}
            disabled={disabled}
        />
    </div>
    );
});

export const Button = memo(({ children, onClick, variant = 'primary', className = '', disabled, type = 'button', title }: { children: React.ReactNode, onClick?: () => void, variant?: 'primary' | 'secondary' | 'danger' | 'success', className?: string, disabled?: boolean, type?: 'button' | 'submit' | 'reset', title?: string }) => {
  const baseClasses = "flex items-center justify-center gap-2 px-4 py-2 rounded-md font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95";
  const variants = {
    primary: "bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-900/20",
    secondary: "bg-slate-700 hover:bg-slate-600 text-slate-100 border border-slate-600",
    danger: "bg-red-900/40 hover:bg-red-900/60 text-red-200 border border-red-800/50",
    success: "bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-900/20"
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`${baseClasses} ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
});

export const SexagesimalInput: React.FC<{
    label?: string;
    value: number;
    onChange: (val: number) => void;
    unit?: string;
    onAction?: () => void;
    title?: string;
    isRA?: boolean;
}> = memo(({ label, value, onChange, unit, onAction, title, isRA }) => {
    const [text, setText] = useState('');
    
    useEffect(() => {
        setText(decimalToSexagesimal(value, isRA));
    }, [value, isRA]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setText(e.target.value);
    };

    const handleBlur = () => {
        const val = sexagesimalToDecimal(text);
        onChange(val); 
        setText(decimalToSexagesimal(val, isRA)); 
        if (onAction) onAction();
    };

    return (
        <div className="space-y-1" title={title}>
            {label && <label className="text-xs font-medium text-slate-400 block">{label}</label>}
            <div className="flex items-center gap-1 w-full">
                <input 
                    type="text"
                    value={text}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            (e.currentTarget as HTMLInputElement).blur();
                        }
                    }}
                    className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm font-mono text-slate-200 text-right focus:border-red-500 outline-none select-text"
                    placeholder={isRA ? "hh:mm:ss.s" : "dd:mm:ss.s"}
                />
                {unit && <span className="text-xs text-slate-500 w-4">{unit}</span>}
            </div>
        </div>
    );
});

export const LogViewer: React.FC<{ 
    logs: string[], 
    title: string, 
    readyMessage: string 
}> = memo(({ logs, title, readyMessage }) => {
    const logContainerRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        if (logContainerRef.current) {
            logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
        }
    }, [logs]);

    return (
        <div className="space-y-1 pt-4 border-t border-slate-700 pb-20 lg:pb-0">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{title}</h3>
            <div 
                ref={logContainerRef}
                className="bg-black/50 p-2 rounded border border-slate-800 h-32 overflow-y-auto font-mono text-[10px] text-slate-400 whitespace-pre-wrap leading-tight select-text cursor-text"
            >
                {logs.length === 0 ? (
                    <span className="italic opacity-50">{readyMessage}</span>
                ) : (
                    logs.map((line, i) => (
                        <div key={i} className={`mb-0.5 ${line.includes('Error') ? 'text-red-400' : line.includes('TX') ? 'text-blue-400' : line.includes('RX') ? 'text-green-400' : 'text-slate-400'}`}>
                            {line}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
});
