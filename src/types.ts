export type PoleType = 'monopole_n' | 'monopole_s' | 'dipole';

export interface ExternalMagneticSource {
  id: string;
  name: string;
  type: PoleType;
  x: number; // in world coordinates (-5 to 5)
  y: number;
  z?: number; // for 3D
  strength: number; // magnetic charge or moment magnitude
  angle?: number; // orientation angle for dipoles (degrees)
  active: boolean;
  orbiting?: boolean;
  orbitRadius?: number;
  orbitSpeed?: number;
  orbitPhase?: number;
  color?: string;
}

export interface EarthDipoleConfig {
  x: number;
  y: number;
  moment: number; // magnetic dipole moment m (e.g., 1.0 to 10.0)
  tiltAngle: number; // degrees (-90 to 90)
  radius: number; // physical radius of Earth (world units, e.g., 0.8)
  reversed: boolean; // geomagnetic reversal state
}

export interface SolarWindConfig {
  enabled: boolean;
  pressure: number; // dynamic pressure (0.1 to 5.0)
  imfBx: number; // interplanetary magnetic field Bx
  imfBz: number; // IMF Bz (southward < 0 triggers magnetic reconnection)
  speed: number; // solar wind flow velocity
  density: number; // particle density
}

export type InspectionViewMode = 'none' | 'cloud_density' | 'hotspot_mask' | 'cloud_vector_overlay' | 'split_3view';
export type PerspectiveViewMode = 'space_global' | 'ground_sky';
export type CloudColorPalette = 'satellite_bone' | 'pure_white' | 'deep_sky_cyan' | 'night_infrared';

export interface GroundObserverConfig {
  angleDeg: number; // 0 to 360 deg around Earth circle (0 = +X, 90 = +Y North, 180 = -X night, 270 = -Y South)
  label: string;
  altitudeKm: number; // cloud layer altitude (e.g. 5 to 12 km)
  fovDeg: number; // fish-eye field of view (e.g. 140 deg)
  azimuthOffsetDeg: number; // rotation offset in sky dome
}

export interface AtmosphericCloudConfig {
  enabled: boolean;
  particleCount: number; // 200 to 2000
  polarizationSusceptibility: number; // how strongly clouds align to B-field
  chargeRatio: number; // ionized droplet fraction
  condensationThreshold: number; // field threshold for visual cloud density
  showParticles: boolean;
  showCloudBands: boolean;
  showWaveClouds: boolean; // 국소 정렬 양떼구름 (Wave Cloud Pattern)
  interferenceThreshold: number; // I_th for hotspot sigmoid mask
  sigmoidSteepness: number; // k in sigmoid activation
  waveWavelength: number; // lambda for spatial wave periodicity
  gradientWeight: number; // alpha for gradient term in I(x, y)
  cloudOpacity: number;
  viscosity: number;
  // Inspection and Perspective enhancements
  inspectionMode?: InspectionViewMode;
  perspectiveMode?: PerspectiveViewMode;
  gamma?: number; // Non-linear gamma for contrast enhancement (default ~0.6)
  colorPalette?: CloudColorPalette;
  highResGrid?: boolean; // 500x500 high-resolution offscreen rendering
  streamlineAlpha?: number; // Low-alpha streamlines in overlay mode (0.1 to 0.8)
  groundObserver?: GroundObserverConfig;
}

export interface CrustalNode {
  id: number;
  angle: number; // angle around earth (radians)
  x: number;
  y: number;
  accumulatedStress: number; // 0 to 1 (normalized)
  ruptured: boolean;
  ruptureTime: number;
  lastMagnitude: number;
  depthKm: number;
}

export interface EarthquakeEvent {
  id: string;
  timestamp: number;
  nodeIndex: number;
  x: number;
  y: number;
  magnitude: number; // Richter scale 3.0 - 8.5
  peakStress: number;
  dominantFieldIntensity: number;
  cloudDensityAtEpicenter: number;
}

export interface SimulationPreset {
  id: string;
  name: string;
  description: string;
  earthDipole: Partial<EarthDipoleConfig>;
  sources: ExternalMagneticSource[];
  solarWind: Partial<SolarWindConfig>;
  atmosphericCloud: Partial<AtmosphericCloudConfig>;
}

export type RenderMode = 'streamlines' | 'heatmap' | 'quiver' | 'stress_only' | 'composite';
export type HeatmapMetric = 'magnitude' | 'gradient' | 'magnetic_pressure' | 'interference' | 'wave_cloud';

export interface PhysicsVector2D {
  x: number;
  y: number;
  bx: number;
  by: number;
  bTotal: number;
  gradient?: number;
  stressContribution?: number;
}

export interface AIAnalysisMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  isThinking?: boolean;
  modelUsed?: string;
}
