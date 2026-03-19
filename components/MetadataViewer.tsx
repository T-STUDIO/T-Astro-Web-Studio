
import React from 'react';
import { CalibrationData } from '../services/plateSolvingService';
import { CloseIcon } from './icons/CloseIcon';
import { useTranslation } from '../contexts/LanguageContext';

interface MetadataViewerProps {
    isOpen: boolean;
    onClose: () => void;
    exifData: any | null; // Piexif parsed object
    wcsData: CalibrationData | null;
    fitsHeaders?: Record<string, any> | null;
}

export const MetadataViewer: React.FC<MetadataViewerProps> = ({ isOpen, onClose, exifData, wcsData, fitsHeaders }) => {
    const { t } = useTranslation();
    if (!isOpen) return null;

    // Helper to extract readable EXIF key-values
    const formatExif = () => {
        if (!exifData) return [];
        const items: { key: string, val: string }[] = [];
        
        // 0th IFD
        if (exifData["0th"]) {
            // Model
            if(exifData["0th"][272]) items.push({ key: "Model", val: exifData["0th"][272] });
            // Make
            if(exifData["0th"][271]) items.push({ key: "Make", val: exifData["0th"][271] });
            // Software
            if(exifData["0th"][305]) items.push({ key: "Software", val: exifData["0th"][305] });
        }

        // Exif IFD
        if (exifData["Exif"]) {
            // ExposureTime (Tag 33434)
            if(exifData["Exif"][33434]) {
                const val = exifData["Exif"][33434];
                items.push({ key: "Exposure", val: `${val[0]}/${val[1]}s` });
            }
            // FNumber (Tag 33437)
            if(exifData["Exif"][33437]) {
                const val = exifData["Exif"][33437];
                items.push({ key: "FNumber", val: `f/${(val[0]/val[1]).toFixed(1)}` });
            }
             // ISO (Tag 34855)
            if(exifData["Exif"][34855]) items.push({ key: "ISO", val: String(exifData["Exif"][34855]) });
             // DateTimeOriginal (Tag 36867)
            if(exifData["Exif"][36867]) items.push({ key: "Date/Time", val: String(exifData["Exif"][36867]) });
        }

        return items;
    };

    const exifItems = formatExif();

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex justify-center items-center z-[60] p-4" onClick={onClose}>
            <div className="bg-slate-900 border border-slate-600 rounded-lg shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <header className="flex justify-between items-center p-4 border-b border-slate-700 bg-slate-800/80 rounded-t-lg">
                    <h3 className="font-bold text-slate-100">Image Metadata</h3>
                    <button onClick={onClose}><CloseIcon className="w-5 h-5 text-slate-400 hover:text-white" /></button>
                </header>
                <div className="p-4 overflow-y-auto space-y-4 font-mono text-sm">
                    {/* WCS Section */}
                    {wcsData && (
                        <div>
                            <h4 className="text-red-400 font-bold border-b border-slate-700 mb-2 pb-1">WCS / Astrometry</h4>
                            <div className="grid grid-cols-2 gap-2 text-slate-300">
                                <span>RA (Center):</span> <span className="text-right text-slate-100">{wcsData.ra.toFixed(6)}°</span>
                                <span>Dec (Center):</span> <span className="text-right text-slate-100">{wcsData.dec.toFixed(6)}°</span>
                                <span>Scale:</span> <span className="text-right text-slate-100">{wcsData.scale.toFixed(4)} "/px</span>
                                <span>Rotation:</span> <span className="text-right text-slate-100">{wcsData.rotation.toFixed(2)}°</span>
                                <span>Parity:</span> <span className="text-right text-slate-100">{wcsData.parity}</span>
                                <span>Field Radius:</span> <span className="text-right text-slate-100">{wcsData.radius.toFixed(3)}°</span>
                            </div>
                        </div>
                    )}

                    {/* FITS Headers Section */}
                    {fitsHeaders && Object.keys(fitsHeaders).length > 0 && (
                        <div>
                            <h4 className="text-blue-400 font-bold border-b border-slate-700 mb-2 pb-1">FITS Headers</h4>
                            <div className="grid grid-cols-[1fr_2fr] gap-x-4 gap-y-1 text-xs text-slate-300">
                                {Object.entries(fitsHeaders).map(([key, val]) => (
                                    <React.Fragment key={key}>
                                        <span className="font-semibold text-slate-400">{key}</span>
                                        <span className="text-right text-slate-100 truncate" title={String(val)}>{String(val)}</span>
                                    </React.Fragment>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* EXIF Section */}
                    {!fitsHeaders && (
                        <div>
                            <h4 className="text-yellow-400 font-bold border-b border-slate-700 mb-2 pb-1">EXIF Data</h4>
                            {exifItems.length > 0 ? (
                                <div className="grid grid-cols-2 gap-2 text-slate-300">
                                    {exifItems.map((item, idx) => (
                                        <React.Fragment key={idx}>
                                            <span>{item.key}:</span>
                                            <span className="text-right text-slate-100 truncate" title={item.val}>{item.val}</span>
                                        </React.Fragment>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-slate-500 italic">No standard EXIF data found.</p>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
