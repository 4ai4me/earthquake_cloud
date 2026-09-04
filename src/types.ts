export type PoleType = 'monopole_n' | 'monopole_s' | 'dipole' | 'comet' | 'uniform';

export interface ExternalMagneticSource {
  id: string;
  name: string;
  type: PoleType;
  x: number; // in world coordinates (-5 to 5)
  y: number;
  z?: number; // for 3D
  strength: number; // magnetic charge, moment magnitude, or comet gas activity
  fieldNt?: string; // schema v2: nT at 1 R_E equator (dipole), radial 1 R_E (monopole), or uniform field
  angle?: number; // orientation angle for dipoles (degrees)
  active: boolean;
  orbiting?: boolean;
  rotating?: boolean;
  rotationSpeedDegS?: number; // signed axial rotation rate, independent of positional orbit
  orbitRadius?: number;
  orbitSpeed?: number;
  orbitPhase?: number;
  color?: string;
  cometTailLength?: number; // comet ion tail length (world units)
  cometGasActivity?: number; // outgassing & ionization rate
}

export interface MoonConfig {
  enabled: boolean;
  orbitRadius: number; // display-only orbit radius in normalized world units
  physicalDistanceEarthRadii?: number; // physical Earth-Moon center distance, mean ~60.3 R_E
  orbitPeriodDays: number; // 27.3217 days (sidereal month)
  phaseAngleDeg: number; // orbital position angle (0 to 360 deg)
  radius: number; // physical radius ~0.26 (relative to Earth 0.95, ~27% of R_E)
  remanentMoment: number; // crustal remanent magnetic dipole moment (~0.12)
  hypothesisDipoleEnabled?: boolean; // explicit legacy whole-Moon dipole hypothesis, OFF by default
  daysPerSecond?: number; // shared physical clock; synchronous lunar rotation follows phase
  remanentAngle: number; // swirl magnetic orientation angle (deg)
  tidalStressWeight: number; // solid Earth tidal gravitational stress coupling (~0.25)
  wakeCavityStrength: number; // solar wind downstream diamagnetic wake attenuation (~0.7)
  showOrbit: boolean;
  showTidalBulge: boolean;
  autoOrbit: boolean;
  orbitSpeed: number; // speed multiplier for orbital animation
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
  speedKmS?: number; // measured/assumed bulk speed used for dynamic-pressure calculation
  densityCm3?: number; // measured/assumed proton density used for dynamic-pressure calculation
  fieldVisualizationGain?: number; // legacy only; shared field ignores this amplification
}

export type InspectionViewMode = 'none' | 'cloud_density' | 'hotspot_mask' | 'cloud_vector_overlay' | 'split_3view';
export type PerspectiveViewMode = 'space_global' | 'ground_sky';
export type CloudColorPalette = 'satellite_bone' | 'pure_white' | 'deep_sky_cyan' | 'night_infrared';

export type WeatherModelProvider = 'NOAA_GFS' | 'ECMWF_IFS' | 'DWD_ICON' | 'NOAA_SWPC_REALTIME' | 'MANUAL';

export interface GlobalWeatherData {
  provider: WeatherModelProvider;
  stationName: string;
  latitude: number;
  longitude: number;
  // Atmospheric Dynamics
  windU: number; // m/s (East-West zonal wind, >0 is Westerly blowing East)
  windV: number; // m/s (North-South meridional wind, >0 is Southerly blowing North)
  windSpeed: number; // m/s
  windDirectionDeg: number; // degrees (0 = N, 90 = E, 180 = S, 270 = W)
  pressureHpa: number; // Surface/Atmospheric pressure (hPa)
  temperatureC: number; // Temperature (°C)
  relativeHumidity: number; // Relative Humidity (10% - 100%)
  cloudCoverPercent: number; // Total Cloud Cover (%)
  dewPointC: number; // Dew Point (°C)
  // Space Weather & Geomagnetic Indices (NOAA SWPC)
  kpIndex: number; // Planetary K-index (0 to 9)
  dstIndexNt: number; // Disturbance Storm Time index (nT, e.g. -150 to +30)
  solarWindSpeedKmS: number; // Solar wind speed (km/s, e.g. 350 to 800)
  solarWindDensityCm3: number; // Proton density (p/cm^3)
  imfBzNt: number; // IMF Bz component (nT, <0 is southward reconnection)
  lastUpdated: string;
  isLive: boolean;
  dataStatus?: 'preset' | 'live' | 'partial' | 'manual';
  dataWarnings?: string[];
  liveSources?: {
    atmosphere: boolean;
    kp: boolean;
    solarWind: boolean;
    imf: boolean;
    dst: boolean;
  };
  modelSourceInfo?: string;
}

export interface GroundObserverConfig {
  angleDeg: number; // 0 to 360 deg around Earth circle (0 = +X, 90 = +Y North, 180 = -X night, 270 = -Y South)
  label: string;
  altitudeKm: number; // cloud layer altitude (e.g. 5 to 12 km)
  fovDeg: number; // fish-eye field of view (e.g. 140 deg)
  azimuthOffsetDeg: number; // rotation offset in sky dome
}

export type CernCloudEnvironment = 'boundary_layer' | 'marine_polar' | 'upper_troposphere';

export interface CernCloudAerosolConfig {
  enabled: boolean;
  environment: CernCloudEnvironment;
  temperatureK: number;
  pressureHpa: number;
  relativeHumidityPercent: number;
  ionPairProductionCm3S: number;
  sulfuricAcidCm3: number;
  ammoniaPptv: number;
  dimethylaminePptv: number;
  iodineOxoacidCm3: number;
  ipOomCm3: number;
  msaCm3: number;
  condensationSinkS: number;
  vaporExposureSeconds: number;
  growthHours: number;
  ccnSupersaturationPercent: number;
  hygroscopicityKappa: number;
  coupleToCloudBaseline: boolean;
}

export interface AtmosphericCloudConfig {
  cloudAltitudeKm?: number; // prescribed near-tropopause layer, not a calculated cloud-forming altitude
  cloudLayerHalfWidthKm?: number;
  altitudeDisplayGain?: number; // visualization only, shared by 2D and 3D
  enabled: boolean;
  particleCount: number; // 200 to 2000
  polarizationSusceptibility: number; // how strongly clouds align to B-field
  chargeRatio: number; // ionized droplet fraction
  condensationThreshold: number; // field threshold for visual cloud density
  showParticles: boolean;
  showCloudBands: boolean;
  showWaveClouds: boolean; // 국소 정렬 양떼구름 (Wave Cloud Pattern)
  externalStimulusThreshold?: number; // Minimum external stimulus level required to trigger earthquake wave clouds (default: 0.5)
  interferenceThreshold: number; // I_th for hotspot sigmoid mask
  sigmoidSteepness: number; // k in sigmoid activation
  waveWavelength: number; // lambda for spatial wave periodicity
  gradientWeight: number; // alpha for gradient term in I(x, y)
  cloudOpacity: number;
  viscosity: number;
  hypothesisEnabled?: boolean; // false is the null/control run
  hypothesisCoupling?: number; // dimensionless, testable magnetic-atmospheric coupling amplitude
  turbulentDiffusivity?: number; // schematic world-unit^2 / simulation-second
  // Inspection and Perspective enhancements
  inspectionMode?: InspectionViewMode;
  perspectiveMode?: PerspectiveViewMode;
  gamma?: number; // Non-linear gamma for contrast enhancement (default ~0.6)
  colorPalette?: CloudColorPalette;
  highResGrid?: boolean; // 500x500 high-resolution offscreen rendering
  streamlineAlpha?: number; // Low-alpha streamlines in overlay mode (0.1 to 0.8)
  groundObserver?: GroundObserverConfig;
  weatherData?: GlobalWeatherData;
  useLiveWeather?: boolean;
  aerosolExperiment?: CernCloudAerosolConfig;
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
  failureIndex?: number; // normalized Coulomb-style proximity to failure
  tidalStressKPa?: number; // reversible solid-Earth tide perturbation, not accumulated tectonic stress
  hypothesisStressMPa?: number; // explicitly hypothetical magnetic coupling contribution
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
  seismicMomentNm?: number;
  ruptureRadiusKm?: number;
  stressDropMPa?: number;
  isSynthetic?: boolean;
}

export interface SimulationPreset {
  id: string;
  name: string;
  description: string;
  earthDipole: Partial<EarthDipoleConfig>;
  sources: ExternalMagneticSource[];
  solarWind: Partial<SolarWindConfig>;
  atmosphericCloud: Partial<AtmosphericCloudConfig>;
  moon?: Partial<MoonConfig>;
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

export interface LayerVisibilityConfig {
  earthBody: boolean;           // 지구 본체 및 대기 헤일로
  dipoleAxis: boolean;          // 자기 쌍극자 축 및 N/S 자극
  crustalNodes: boolean;        // 지각 단층 응력 노드 & 고응력 점멸
  streamlines: boolean;         // RK4 자기력선 및 에너지 흐름 펄스
  solarWind: boolean;           // 태양풍 이온 입자 및 IMF 유선
  neutralPoints: boolean;       // 자기 재결합 중성점 (X-Point Reconn)
  externalSources: boolean;     // 외부 단극자/다극자 소스 및 궤도
  moonBody: boolean;            // 지구 위성 달 (Moon 본체 및 지각 잔류자기)
  moonOrbit: boolean;           // 달 공전 궤도 및 위상
  lunarTideBulge: boolean;      // 달 중력 조석 팽창 타원 (Tidal Bulge)
  cloudParticles: boolean;      // 대기 에어로졸 / 하전 입자 & 극화 정렬 바늘
  cloudBands: boolean;          // 결맞음 구름 띠 (Coherent Cloud Bands)
  waveClouds: boolean;          // 국소 정렬 양떼구름 (Wave Cloud Hotspot)
  seismicWaves: boolean;        // 지진 P파/S파 충격파 파면
  gridAxes: boolean;            // 배경 좌표 격자 & 중심축
  heatmap: boolean;             // 2D 스칼라 히트맵 배경
  probeMarker: boolean;         // 우클릭 정밀 프로브 마커 & 타겟
}

export interface VisualElementGuideItem {
  id: keyof LayerVisibilityConfig;
  category: 'core' | 'field' | 'atmosphere' | 'event' | 'system';
  name: string;
  badge: string;
  color: string;
  formulaSymbol?: string;
  summary: string;
  physicsDescription: string;
}

export interface AIAnalysisMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  isThinking?: boolean;
  modelUsed?: string;
}

export const DEFAULT_EARTH_DIPOLE: EarthDipoleConfig = {
  x: 0,
  y: 0,
  moment: 1.0,
  tiltAngle: 11.5,
  radius: 1,
  reversed: false,
};

export const DEFAULT_SOLAR_WIND: SolarWindConfig = {
  enabled: false,
  pressure: 1.34,
  imfBx: 0.0,
  imfBz: 0.0,
  speed: 1.0,
  density: 1.0,
  speedKmS: 400,
  densityCm3: 5,
  fieldVisualizationGain: 1,
};

export const DEFAULT_MOON_CONFIG: MoonConfig = {
  enabled: true,
  orbitRadius: 60.3,
  physicalDistanceEarthRadii: 60.3,
  orbitPeriodDays: 27.32,
  phaseAngleDeg: 45,
  radius: 0.26,
  remanentMoment: 0,
  hypothesisDipoleEnabled: false,
  daysPerSecond: 0.5,
  remanentAngle: 15,
  tidalStressWeight: 1.0,
  wakeCavityStrength: 0.7,
  showOrbit: true,
  showTidalBulge: false,
  autoOrbit: true,
  orbitSpeed: 0.3,
};

export const DEFAULT_CLOUD_CONFIG: AtmosphericCloudConfig = {
  cloudAltitudeKm: 12,
  cloudLayerHalfWidthKm: 1.5,
  altitudeDisplayGain: 1,
  enabled: true,
  particleCount: 500,
  polarizationSusceptibility: 1.2,
  chargeRatio: 0.6,
  condensationThreshold: 0.8,
  showParticles: true,
  showCloudBands: true,
  showWaveClouds: true,
  externalStimulusThreshold: 0.3,
  interferenceThreshold: 0.35,
  sigmoidSteepness: 6.0,
  waveWavelength: 0.8,
  gradientWeight: 0.5,
  cloudOpacity: 0.85,
  viscosity: 0.08,
  hypothesisEnabled: true,
  hypothesisCoupling: 0.6,
  turbulentDiffusivity: 0.00002,
  perspectiveMode: 'space_global',
  inspectionMode: 'none',
  gamma: 0.6,
  colorPalette: 'satellite_bone',
  useLiveWeather: false,
  aerosolExperiment: {
    enabled: true,
    environment: 'boundary_layer',
    temperatureK: 278,
    pressureHpa: 965,
    relativeHumidityPercent: 58,
    ionPairProductionCm3S: 2,
    sulfuricAcidCm3: 1e7,
    ammoniaPptv: 5,
    dimethylaminePptv: 0.2,
    iodineOxoacidCm3: 1e5,
    ipOomCm3: 0,
    msaCm3: 0,
    condensationSinkS: 0.002,
    vaporExposureSeconds: 300,
    growthHours: 12,
    ccnSupersaturationPercent: 0.2,
    hygroscopicityKappa: 0.3,
    coupleToCloudBaseline: false,
  },
};

