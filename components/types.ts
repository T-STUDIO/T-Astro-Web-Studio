
export interface CelestialObject {
  id: string;
  name: string;
  nameJa: string; // Added Japanese name
  type: 'Galaxy' | 'Nebula' | 'Star Cluster' | 'Planet' | 'Star';
  ra: string; // Right Ascension (J2000)
  dec: string; // Declination (J2000)
  magnitude: number; // Visual Magnitude
  size?: number; // Angular size in arcminutes (approximate max dimension)
  color?: string; // Optional hex color for stars
  image?: string; // URL to a clear image
  blurryImage?: string; // URL to a blurry/initial image
  annotations?: { x: number; y: number; label: string }[];
}

export interface TelescopePosition {
    ra: number; // Degrees
    dec: number; // Degrees
}

export type ConnectionStatus = 'Disconnected' | 'Connecting' | 'Connected' | 'Error';

export type SlewStatus = 'Idle' | 'Slewing' | 'Solving' | 'Centering' | 'At Target';

export type View = 'Planetarium' | 'Imaging';

export interface LogEntry {
  timestamp: string;
  message: string;
  type: 'info' | 'success' | 'error' | 'warning';
}

export type Language = 'en' | 'ja';

export type DriverType = 'INDI' | 'Alpaca' | 'Simulator';

export interface ConnectionSettings {
  driver: DriverType;
  host: string;
  port: number;
  serverType: 'local' | 'remote'; // Added server type
}

export interface SampSettings {
    host: string;
    port: number;
}

export interface PlanetariumSettings {
  showConstellationLines: boolean;
  showAzAltGrid: boolean;
  showRaDecGrid: boolean;
  showStarLabels: boolean; // Split from showObjectLabels
  showDSOLabels: boolean;  // Split from showObjectLabels
  showConstellationLabels: boolean;
  showHorizon: boolean;
  showDSS: boolean; 
  showMilkyWay: boolean; // New: Milky Way Toggle
  milkyWayOpacity: number; // New: Milky Way Brightness (0.0 - 1.0)
  starMagLimit: number; // Split from magLimit
  dsoMagLimit: number;  // Split from magLimit
  starScale: number;    // New: Global scale factor for star rendering size
  // New DSO Filters
  showGalaxies: boolean;
  showNebulae: boolean;
  showClusters: boolean;
}

export interface Constellation {
  name: string;
  nameJa: string; // Added Japanese name
  lines: { from: string; to: string }[]; // 'from' and 'to' are ids of CelestialObjects
}

export type LocationStatus = 'Idle' | 'Updating' | 'Success' | 'Error';

export interface LocationData {
  latitude: number;
  longitude: number;
  elevation?: number; // Added elevation
}

export type SampStatus = 'Disconnected' | 'Connecting' | 'Connected' | 'Error';

export interface ObjectRealtimeData {
  azimuth: string;
  altitude: string;
  transitTime: string;
  isVisible: boolean;
}

export type MountSpeed = 'Guide' | 'Center' | 'Find' | 'Slew';

export type DeviceType = 'Camera' | 'GuideCamera' | 'Mount' | 'Telescope' | 'Focuser' | 'FilterWheel' | 'Dome' | 'Rotator' | 'Heater';

export interface DeviceConfig {
    type: DeviceType;
    name: string;
    connected: boolean;
    properties: Record<string, any>; // Flexible property bag for now
}

// INDI Specific Types
export type INDIPropertyState = 'Idle' | 'Ok' | 'Busy' | 'Alert';
export type INDIPropertyType = 'Number' | 'Switch' | 'Text' | 'Light' | 'BLOB';
export type INDISwitchRule = 'OneOfMany' | 'AtMostOne' | 'AnyOfMany';
export type INDIPermission = 'ro' | 'wo' | 'rw';

export interface INDIElement {
    name: string;
    label?: string;
    value: string | number | boolean;
    min?: number;
    max?: number;
    step?: number;
}

export interface INDIVector {
    device: string;
    name: string;
    label?: string;
    group?: string;
    state: INDIPropertyState;
    perm: INDIPermission;
    type: INDIPropertyType;
    rule?: INDISwitchRule; // Only for Switch
    elements: Map<string, INDIElement>;
    timestamp?: string;
}

export interface INDIDevice {
    name: string;
    connected: boolean;
    type?: DeviceType;
    properties: Map<string, INDIVector>; // Key is property name
}

// Unified Mobile Tab Types
export type TabType = 'planetarium' | 'imaging_view' | 'equipment' | 'imaging_control' | 'settings';

export type PlateSolverType = 'Remote' | 'Local';

export interface LocalSolverSettings {
    host: string;
    port: number;
}

export interface SimulatorSettings {
  focalLength: number; // mm
  pixelWidth: number; // pixels
  pixelHeight: number; // pixels
  pixelSize: number; // micrometers
  focuserPosition: number; // 0 - 100000
  focuserStep: number; // 1 - 1000
}

// Saved Settings Types
export interface SavedLocation {
  name: string;
  data: LocationData;
}

export interface SavedConnection {
  name: string;
  settings: ConnectionSettings;
}

export interface SavedApiKey {
  name: string;
  key: string;
}

export interface SavedLocalSolver {
  name: string;
  settings: LocalSolverSettings;
}

export interface SavedSampSettings {
  name: string;
  settings: SampSettings;
}
