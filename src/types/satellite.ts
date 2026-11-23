export type SatellitePassId =
  | 'port_shipping'
  | 'wildfire_ridge'
  | 'polar_glacier'
  | 'desert_solar'
  | 'custom_upload';

export type SpectralBand = 'optical' | 'thermal' | 'ndvi' | 'sar';

export type ConditionType =
  | 'nominal'
  | 'thermal_spike'
  | 'orbit_slew'
  | 'downlink_burst'
  | 'cloud_mask'
  | 'safe_mode';

export type SeverityLevel = 'Nominal' | 'Advisory' | 'Alert' | 'Critical';

export type LogSource =
  | 'UPLINK'
  | 'SATELLITE'
  | 'AI_ENGINE'
  | 'TRIGGER'
  | 'TELEMETRY'
  | 'OPERATOR';

export type LogSeverity = 'Nominal' | 'Info' | 'Warning' | 'Critical';

export interface TelemetryState {
  altitudeKm: number;
  velocityKms: number;
  inclinationDeg: number;
  offNadirDeg: number;
  payloadTempC: number;
  busPowerW: number;
  batteryPct: number;
  downlinkMbps: number;
  cloudCoverPct: number;
  signalDbm: number;
  shutterOpen: boolean;
  activeCondition: ConditionType;
}

export interface TelemetryHistoryPoint {
  timeLabel: string;
  payloadTempC: number;
  downlinkMbps: number;
}

export interface SatellitePass {
  id: SatellitePassId;
  name: string;
  satelliteId: string;
  orbitNumber: number;
  region: string;
  lat: number;
  lon: number;
  gsdMeters: number;
  swathKm: number;
  captureUtc: string;
  description: string;
  defaultBand: SpectralBand;
  baselineTelemetry: TelemetryState;
}

export interface ConditionTriggerDef {
  id: ConditionType;
  label: string;
  command: string;
  shortDesc: string;
  targetSeverity: LogSeverity;
  subsystem: string;
}

export interface AiDetection {
  id: string;
  label: string;
  category: string;
  confidence: number;
  severity: SeverityLevel;
  /** Percentage bounding box: [x, y, width, height] in 0..100 */
  bbox: [number, number, number, number];
  details: string;
}

export interface AiAnalysisResult {
  id: string;
  timestampUtc: string;
  passId: SatellitePassId;
  passName: string;
  band: SpectralBand;
  condition: ConditionType;
  classification: string;
  severity: SeverityLevel;
  confidence: number;
  summary: string;
  spectralNotes: string;
  recommendedCommand: string;
  recommendedTriggerId: ConditionType;
  detections: AiDetection[];
  latencyMs: number;
}

export interface ActivityLogEntry {
  id: string;
  timestampUtc: string;
  source: LogSource;
  command: string;
  message: string;
  severity: LogSeverity;
  meta?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestampUtc: string;
  streaming?: boolean;
  error?: string;
}

export interface AutoTriggerRule {
  enabled: boolean;
  thermalThresholdC: number;
  cloudThresholdPct: number;
  autoAnalyzeOnTrigger: boolean;
}

export type WorkspaceView = 'console' | 'detections' | 'triggers' | 'logs';
