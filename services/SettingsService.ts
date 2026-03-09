
import { ConnectionSettings, PlanetariumSettings, LocationData, SavedLocation, SavedConnection, SavedApiKey, SampSettings, SavedSampSettings, PlateSolverType, LocalSolverSettings, SavedLocalSolver, SimulatorSettings } from '../types';
import { DEFAULT_SIMULATOR_SETTINGS } from './SimulatorService';

const STORAGE_KEY = 't_astro_settings_v3';

export interface AppSettings {
    connectionSettings: ConnectionSettings;
    planetariumSettings: PlanetariumSettings;
    exposure: number;
    gain: number;
    offset: number;
    binning: number;
    colorBalance: { r: number, g: number, b: number };
    astrometryApiKey: string;
    plateSolverType: PlateSolverType;
    localSolverSettings: LocalSolverSettings;
    isAutoCenterEnabled: boolean;
    isAutoSyncLocationEnabled: boolean;
    sampSettings: SampSettings;
    location: LocationData | null;
    savedLocations: SavedLocation[];
    savedConnections: SavedConnection[];
    savedApiKeys: SavedApiKey[];
    savedLocalSolvers: SavedLocalSolver[];
    savedSampSettings: SavedSampSettings[]; 
    simulatorSettings: SimulatorSettings;
    lastSaveTimestamp: string;
}

const DEFAULT_SETTINGS: AppSettings = {
    connectionSettings: {
        driver: 'INDI',
        host: 'localhost',
        port: 7624,
        serverType: 'local'
    },
    planetariumSettings: {
        showConstellationLines: true,
        showAzAltGrid: true,
        showRaDecGrid: true,
        showStarLabels: true,
        showDSOLabels: false,
        showConstellationLabels: true,
        showHorizon: false,
        showDSS: false,
        showMilkyWay: true,
        milkyWayOpacity: 0.5,
        starMagLimit: 5.5,
        dsoMagLimit: 10,
        starScale: 1.0,
        showGalaxies: true,
        showNebulae: true,
        showClusters: true,
    },
    exposure: 1000,
    gain: 100,
    offset: 10,
    binning: 1,
    colorBalance: { r: 128, g: 128, b: 128 },
    astrometryApiKey: '',
    plateSolverType: 'Remote',
    localSolverSettings: {
        host: 'localhost',
        port: 6000
    },
    isAutoCenterEnabled: false,
    isAutoSyncLocationEnabled: true, 
    sampSettings: {
        host: 'localhost',
        port: 8080
    },
    location: null,
    savedLocations: [],
    savedConnections: [],
    savedApiKeys: [],
    savedLocalSolvers: [],
    savedSampSettings: [],
    simulatorSettings: DEFAULT_SIMULATOR_SETTINGS,
    lastSaveTimestamp: new Date().toISOString()
};

export const loadSettings = (): AppSettings => {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            const parsed = JSON.parse(saved);
            return { 
                ...DEFAULT_SETTINGS, 
                ...parsed, 
                sampSettings: { ...DEFAULT_SETTINGS.sampSettings, ...parsed.sampSettings },
                planetariumSettings: { ...DEFAULT_SETTINGS.planetariumSettings, ...parsed.planetariumSettings },
                connectionSettings: { ...DEFAULT_SETTINGS.connectionSettings, ...parsed.connectionSettings },
                localSolverSettings: { ...DEFAULT_SETTINGS.localSolverSettings, ...parsed.localSolverSettings },
                simulatorSettings: { ...DEFAULT_SETTINGS.simulatorSettings, ...parsed.simulatorSettings },
                savedSampSettings: Array.isArray(parsed.savedSampSettings) ? parsed.savedSampSettings : [],
                savedLocalSolvers: Array.isArray(parsed.savedLocalSolvers) ? parsed.savedLocalSolvers : []
            };
        }
    } catch (e) {
        console.warn("Failed to load settings from local storage", e);
    }
    return DEFAULT_SETTINGS;
};

export const saveSettings = (settings: AppSettings) => {
    try {
        const toSave = { ...settings, lastSaveTimestamp: new Date().toISOString() };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
    } catch (e) {
        console.error("Failed to save settings to local storage", e);
    }
};

export const exportSettingsToFile = async (settings: Partial<AppSettings>) => {
    const fullSettings = { ...loadSettings(), ...settings, lastSaveTimestamp: new Date().toISOString() };
    const jsonStr = JSON.stringify(fullSettings, null, 2);
    const fileName = `t-astro-settings-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    const blob = new Blob([jsonStr], { type: 'application/json' });

    if (navigator.canShare && navigator.share) {
        try {
            const file = new File([blob], fileName, { type: 'application/json' });
            if (navigator.canShare({ files: [file] })) {
                await navigator.share({
                    files: [file],
                    title: 'T-Astro Settings',
                    text: 'Backup of T-Astro Web Studio settings.'
                });
                return;
            }
        } catch (e) {
            console.warn("Web Share API failed, falling back to download.", e);
        }
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

export const importSettingsFromFile = async (file: File): Promise<AppSettings> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const text = ev.target?.result as string;
                const data = JSON.parse(text);
                if (typeof data !== 'object') throw new Error("Invalid JSON structure");
                
                const merged: AppSettings = {
                    ...DEFAULT_SETTINGS,
                    ...data,
                    savedLocations: Array.isArray(data.savedLocations) ? data.savedLocations : [],
                    savedConnections: Array.isArray(data.savedConnections) ? data.savedConnections : [],
                    savedApiKeys: Array.isArray(data.savedApiKeys) ? data.savedApiKeys : [],
                    savedLocalSolvers: Array.isArray(data.savedLocalSolvers) ? data.savedLocalSolvers : [],
                    savedSampSettings: Array.isArray(data.savedSampSettings) ? data.savedSampSettings : [],
                    sampSettings: { ...DEFAULT_SETTINGS.sampSettings, ...data.sampSettings },
                    planetariumSettings: { ...DEFAULT_SETTINGS.planetariumSettings, ...data.planetariumSettings },
                    connectionSettings: { ...DEFAULT_SETTINGS.connectionSettings, ...data.connectionSettings },
                    localSolverSettings: { ...DEFAULT_SETTINGS.localSolverSettings, ...data.localSolverSettings }
                };
                
                saveSettings(merged);
                resolve(merged);
            } catch (err) {
                reject(new Error("JSON parsing error: " + (err as Error).message));
            }
        };
        reader.onerror = () => reject(new Error("Failed to read file"));
        reader.readAsText(file);
    });
};
