import { EarthDipoleConfig, ExternalMagneticSource, MoonConfig, SolarWindConfig } from '../types';
import { EARTH_EQUATORIAL_FIELD_NT } from './physicsCalibration';
import { earthField, sourceField, lunarField, sampleField, normalizedComponents, traceField, moonPosition } from './fieldModel';

export const EPSILON = 0.05;
export function calculateEarthDipoleField(x: number, y: number, config: EarthDipoleConfig) {
  return normalizedComponents(earthField({ x, y, z: 0 }, config));
}
export function calculateExternalSourceField(x: number, y: number, source: ExternalMagneticSource) {
  return normalizedComponents(sourceField({ x, y, z: 0 }, source));
}
export function calculateSolarWindField(x: number, y: number, solar: SolarWindConfig, earth: EarthDipoleConfig) {
  return { bx: solar.enabled ? solar.imfBx / EARTH_EQUATORIAL_FIELD_NT : 0, by: solar.enabled ? solar.imfBz / EARTH_EQUATORIAL_FIELD_NT : 0 };
}
export function calculateMoonField(x: number, y: number, moon: MoonConfig, solar: SolarWindConfig, earth: EarthDipoleConfig) {
  const position = moonPosition(earth, moon);
  return { ...normalizedComponents(lunarField({ x, y, z: 0 }, { earth, solar, moon, sources: [] })),
    moonX: position.x, moonY: position.y, distToMoon: Math.hypot(x-position.x, y-position.y) };
}
export function computeTotalMagneticField(x: number, y: number, earth: EarthDipoleConfig, sources: ExternalMagneticSource[], solar: SolarWindConfig, moon?: MoonConfig) {
  return normalizedComponents(sampleField({ x, y, z: 0 }, { earth, sources, solar, moon }));
}

/**
 * Computes Spatial Gradient of Field Magnitude: grad |B|
 */
export function computeFieldGradient(
  x: number,
  y: number,
  earthConfig: EarthDipoleConfig,
  sources: ExternalMagneticSource[],
  solarWind: SolarWindConfig,
  moonConfig?: MoonConfig,
  h: number = 0.05
): { gradX: number; gradY: number; gradMag: number } {
  const fXPlus = computeTotalMagneticField(x + h, y, earthConfig, sources, solarWind, moonConfig).magnitude;
  const fXMinus = computeTotalMagneticField(x - h, y, earthConfig, sources, solarWind, moonConfig).magnitude;
  const fYPlus = computeTotalMagneticField(x, y + h, earthConfig, sources, solarWind, moonConfig).magnitude;
  const fYMinus = computeTotalMagneticField(x, y - h, earthConfig, sources, solarWind, moonConfig).magnitude;

  const gradX = (fXPlus - fXMinus) / (2 * h);
  const gradY = (fYPlus - fYMinus) / (2 * h);
  const gradMag = Math.sqrt(gradX * gradX + gradY * gradY);

  return { gradX, gradY, gradMag };
}

/**
 * Traces a Streamline using 4th-Order Runge-Kutta (RK4) Integration
 */
export function traceStreamlineRK4(
  startX: number, startY: number, earth: EarthDipoleConfig, sources: ExternalMagneticSource[], solar: SolarWindConfig,
  direction: 1 | -1 = 1, maxSteps = 180, step = 0.05,
  bounds = { minX: -6, maxX: 6, minY: -4, maxY: 4 }, moon?: MoonConfig
) {
  return traceField({ x: startX, y: startY, z: 0 }, { earth, sources, solar, moon }, direction, maxSteps, step,
    p => p.x >= bounds.minX && p.x <= bounds.maxX && p.y >= bounds.minY && p.y <= bounds.maxY, true);
}

/**
 * Detects Magnetic Neutral Points / X-Points where |B| ~ 0
 */
export function findNeutralPoints(
  earthConfig: EarthDipoleConfig,
  sources: ExternalMagneticSource[],
  solarWind: SolarWindConfig,
  gridStep: number = 0.35,
  bounds: { minX: number; maxX: number; minY: number; maxY: number } = { minX: -4.5, maxX: 4.5, minY: -3.5, maxY: 3.5 }
): Array<{ x: number; y: number; magnitude: number }> {
  const candidates: Array<{ x: number; y: number; magnitude: number }> = [];

  for (let x = bounds.minX; x <= bounds.maxX; x += gridStep) {
    for (let y = bounds.minY; y <= bounds.maxY; y += gridStep) {
      const distToEarth = Math.hypot(x - earthConfig.x, y - earthConfig.y);
      if (distToEarth < earthConfig.radius * 1.05) continue;

      const field = computeTotalMagneticField(x, y, earthConfig, sources, solarWind);
      if (field.magnitude < 0.09) {
        // Check if strictly smaller than all 4 neighbors
        const delta = 0.12;
        const n1 = computeTotalMagneticField(x + delta, y, earthConfig, sources, solarWind).magnitude;
        const n2 = computeTotalMagneticField(x - delta, y, earthConfig, sources, solarWind).magnitude;
        const n3 = computeTotalMagneticField(x, y + delta, earthConfig, sources, solarWind).magnitude;
        const n4 = computeTotalMagneticField(x, y - delta, earthConfig, sources, solarWind).magnitude;
        
        if (field.magnitude <= n1 && field.magnitude <= n2 && field.magnitude <= n3 && field.magnitude <= n4) {
          candidates.push({ x, y, magnitude: field.magnitude });
        }
      }
    }
  }

  // Cluster nearby candidates (Non-Maximum Suppression with minimum separation 0.75 R_E)
  const filtered: Array<{ x: number; y: number; magnitude: number }> = [];
  candidates.sort((a, b) => a.magnitude - b.magnitude);

  for (const cand of candidates) {
    const isTooClose = filtered.some((p) => Math.hypot(p.x - cand.x, p.y - cand.y) < 0.75);
    if (!isTooClose) {
      filtered.push(cand);
    }
  }

  return filtered;
}

/**
 * Dimensionless magnetic-perturbation diagnostic. The raw cross product and
 * field gradient have different units, so they must not be added directly.
 */
export function computeInterferenceIntensity(
  x: number,
  y: number,
  earthConfig: EarthDipoleConfig,
  sources: ExternalMagneticSource[],
  solarWind: SolarWindConfig,
  alpha: number = 0.5
): {
  intensity: number;
  crossProductMag: number;
  shearAngleFactor: number;
  externalFieldRatio: number;
  normalizedGradient: number;
  gradMag: number;
  earthField: { bx: number; by: number };
  extField: { bx: number; by: number };
} {
  // 1. Earth Dipole field
  const earthField = calculateEarthDipoleField(x, y, earthConfig);

  // 2. Total external field = external magnetic sources + solar wind IMF
  let extBx = 0;
  let extBy = 0;

  for (const s of sources) {
    if (s.active) {
      const sf = calculateExternalSourceField(x, y, s);
      extBx += sf.bx;
      extBy += sf.by;
    }
  }

  const sw = calculateSolarWindField(x, y, solarWind, earthConfig);
  extBx += sw.bx;
  extBy += sw.by;

  // 3. Dimensionless field shear and perturbation ratio.
  const crossProductMag = Math.abs(earthField.bx * extBy - earthField.by * extBx);
  const earthMag = Math.hypot(earthField.bx, earthField.by);
  const extMag = Math.hypot(extBx, extBy);
  const totalMag = Math.hypot(earthField.bx + extBx, earthField.by + extBy);
  const shearAngleFactor = crossProductMag / Math.max(1e-9, earthMag * extMag);
  const externalFieldRatio = extMag / Math.max(1e-9, earthMag + extMag);

  // 4. Spatial gradient of composite total field
  const grad = computeFieldGradient(x, y, earthConfig, sources, solarWind);

  // 5. L*|grad B|/|B| is dimensionless. tanh prevents singular gradients
  // near synthetic sources from dominating the diagnostic.
  const normalizedGradient = Math.tanh((Math.max(0.1, earthConfig.radius) * grad.gradMag) / Math.max(1e-6, totalMag));
  const gradientWeight = Math.max(0, Math.min(1, alpha));
  const intensity = Math.max(
    0,
    Math.min(1, externalFieldRatio * ((1 - gradientWeight) * shearAngleFactor + gradientWeight * normalizedGradient))
  );

  return {
    intensity,
    crossProductMag,
    shearAngleFactor,
    externalFieldRatio,
    normalizedGradient,
    gradMag: grad.gradMag,
    earthField,
    extField: { bx: extBx, by: extBy },
  };
}

/**
 * ② 국소 활성화 마스크 (Local Hotspot Mask):
 * M(x, y) = 1 / (1 + exp(-k * (I(x, y) - I_th)))
 */
export function computeHotspotMask(
  intensity: number,
  threshold: number = 0.35,
  steepness: number = 10.0
): number {
  const diff = intensity - threshold;
  // Guard against exp overflow
  const clampedExp = Math.max(-50, Math.min(50, -steepness * diff));
  return 1 / (1 + Math.exp(clampedExp));
}

/**
 * ③ 자기력선 수직 방향의 정렬 파동 (Sheep/Wave Cloud Pattern / 양떼구름·지진운):
 * C(x, y) = M(x, y) * [(1 + cos(k_perp · r - omega*t)) / 2]
 * 
 * 조건화: 외부 자극원(외부 자기원, 태양풍 이상 폭풍 등)의 총 자극 강도가 
 * 임계치(externalStimulusThreshold, 기본값 0.5) 이상일 때만 지진운 파동이 발현됩니다.
 * 평상시에는 억제되고 세계 기상 데이터 기반의 자연 대기 구름이 표시됩니다.
 */
export function computeWaveCloudDensity(
  x: number,
  y: number,
  earthConfig: EarthDipoleConfig,
  sources: ExternalMagneticSource[],
  solarWind: SolarWindConfig,
  cloudConfig: {
    interferenceThreshold?: number;
    sigmoidSteepness?: number;
    waveWavelength?: number;
    gradientWeight?: number;
    externalStimulusThreshold?: number;
    hypothesisEnabled?: boolean;
    hypothesisCoupling?: number;
    weatherData?: { windU?: number; windV?: number };
  },
  time: number = 0
): {
  density: number; // C(x, y) in [0, 1]
  mask: number; // M(x, y) in [0, 1]
  intensity: number; // I(x, y)
  stimulusLevel: number; // S_ext
  isStimulated: boolean;
  bTotal: number;
  bx: number;
  by: number;
  kPerpX: number;
  kPerpY: number;
  wavePhase: number;
  hypothesisContribution: number;
} {
  const alpha = cloudConfig.gradientWeight ?? 0.5;
  const threshold = cloudConfig.interferenceThreshold ?? 0.35;
  const steepness = cloudConfig.sigmoidSteepness ?? 10.0;
  const wavelength = Math.max(0.05, cloudConfig.waveWavelength ?? 0.3);
  const minStimulus = cloudConfig.externalStimulusThreshold ?? 0.3;

  // Compute field & interference
  const field = computeTotalMagneticField(x, y, earthConfig, sources, solarWind);
  const interf = computeInterferenceIntensity(x, y, earthConfig, sources, solarWind, alpha);

  // The driver is dimensionless and based on the local external/total ratio,
  // angular shear, and bounded space-weather conditions—not source UI values.
  const spaceWeatherDriver = solarWind.enabled
    ? Math.min(1, 0.5 * (solarWind.pressure / 5) + 0.5 * (Math.max(0, -solarWind.imfBz) / 20))
    : 0;
  const stimulusLevel = Math.min(
    1,
    0.7 * interf.externalFieldRatio + 0.2 * interf.shearAngleFactor + 0.1 * spaceWeatherDriver
  );
  const isStimulated = stimulusLevel >= minStimulus;

  let mask = computeHotspotMask(interf.intensity, threshold, steepness);

  // If external stimulus is below threshold, suppress the seismic wave cloud mask
  if (stimulusLevel < minStimulus) {
    const attenuation = Math.max(0, Math.min(1, stimulusLevel / Math.max(0.01, minStimulus)));
    mask *= attenuation * attenuation;
  }

  if (field.magnitude < 1e-4) {
    return {
      density: 0,
      mask,
      intensity: interf.intensity,
      stimulusLevel,
      isStimulated,
      bTotal: 0,
      bx: 0,
      by: 0,
      kPerpX: 0,
      kPerpY: 0,
      wavePhase: 0,
      hypothesisContribution: 0,
    };
  }

  // Unit vector b_hat along total field
  const bHatX = field.bx / field.magnitude;
  const bHatY = field.by / field.magnitude;

  // Orthogonal unit vector n_perp perpendicular to b_hat: (-b_y, b_x)
  const nPerpX = -bHatY;
  const nPerpY = bHatX;

  // Wave vector k_perp = (2*pi / lambda) * n_perp
  const kMag = (2 * Math.PI) / wavelength;
  const kPerpX = kMag * nPerpX;
  const kPerpY = kMag * nPerpY;

  // Spatial phase with a simple advected wave speed. This is a pattern
  // hypothesis, not a claim that the magnetic field creates gravity waves.
  const spatialPhase = kPerpX * x + kPerpY * y;
  const windProjection =
    (cloudConfig.weatherData?.windU ?? 0) * nPerpX + (cloudConfig.weatherData?.windV ?? 0) * nPerpY;
  const angularFrequency = kMag * Math.max(-0.2, Math.min(0.2, windProjection * 0.002 + 0.03));
  const wavePhase = spatialPhase - time * angularFrequency;

  // Periodic wave value in [0, 1]
  const waveFactor = (1 + Math.cos(wavePhase)) / 2;

  // The null/control run is exactly zero. The coupled run exposes a bounded,
  // dimensionless coefficient so sensitivity can be measured and falsified.
  const coupling = cloudConfig.hypothesisEnabled === false ? 0 : Math.max(0, Math.min(1, cloudConfig.hypothesisCoupling ?? 0.6));
  const hypothesisContribution = coupling * mask * waveFactor;
  const density = Math.max(0, Math.min(1, hypothesisContribution));

  return {
    density,
    mask,
    intensity: interf.intensity,
    stimulusLevel,
    isStimulated,
    bTotal: field.magnitude,
    bx: field.bx,
    by: field.by,
    kPerpX,
    kPerpY,
    wavePhase,
    hypothesisContribution,
  };
}

/**
 * 평상시 세계 기상 데이터 기반 자연 대기 구름 밀도 (Natural Meteorological Cloud Density):
 * - 운량 (Cloud Cover %), 상대습도 (Relative Humidity %), 기압 (hPa), 온도 (°C)
 * - 풍향 및 풍속 (u, v) 벡터에 따른 유기적 대기 이류 노이즈 패턴
 */
export function computeNaturalWeatherCloudDensity(
  x: number,
  y: number,
  weatherData?: any,
  time: number = 0,
  aerosolBaselineMultiplier: number = 1
): number {
  const aerosolFactor = Math.max(0.7, Math.min(1, aerosolBaselineMultiplier));
  if (!weatherData) return 0.35 * aerosolFactor;

  const cloudCover = Math.max(0, Math.min(100, weatherData.cloudCoverPercent ?? 50)) / 100;
  const humidity = Math.max(10, Math.min(100, weatherData.relativeHumidity ?? 60)) / 100;
  const windU = (weatherData.windU ?? 5) * 0.05;
  const windV = (weatherData.windV ?? -2) * 0.05;

  // Wind-advected atmospheric frame
  const advX = x - windU * time * 0.04;
  const advY = y - windV * time * 0.04;

  // Multi-frequency harmonic atmospheric density field
  const n1 = Math.sin(advX * 1.1 + advY * 0.7) * Math.cos(advX * 0.5 - advY * 1.3);
  const n2 = Math.sin(advX * 2.6 - advY * 1.8 + 0.8) * 0.45;
  const n3 = Math.cos(advX * 4.8 + advY * 3.9 + 1.9) * 0.25;
  const rawHarmonic = (n1 + n2 + n3 + 1.7) / 3.4; // 0 to 1

  // Pressure factor: low pressure storms increase cloud thickness
  const pressure = weatherData.pressureHpa ?? 1013;
  const pressureFactor = Math.max(0.7, Math.min(1.4, 1.0 + (1020 - pressure) / 40));

  const naturalDensity = Math.max(0, Math.min(1, rawHarmonic * cloudCover * (0.35 + humidity * 0.65) * pressureFactor));
  return naturalDensity * aerosolFactor;
}

/**
 * Applies non-linear gamma curve to cloud density for high-contrast inspection:
 * C_vis = C_density^gamma (gamma approx 0.5 - 0.7)
 */
export function applyCloudGamma(density: number, gamma: number = 0.6): number {
  const clamped = Math.max(0, Math.min(1, density));
  return Math.pow(clamped, Math.max(0.1, gamma));
}

/**
 * Returns RGBA color for high-contrast cloud inspection palettes:
 * - 'satellite_bone': Visible satellite meteorological bone/grayscale palette
 * - 'pure_white': Deep space contrast with pure crisp white vapor
 * - 'deep_sky_cyan': Atmospheric ozone & cyan vapor glow
 * - 'night_infrared': Thermal infrared brightness temperature colormap
 */
export function getInspectionCloudColor(
  visDensity: number,
  palette: 'satellite_bone' | 'pure_white' | 'deep_sky_cyan' | 'night_infrared' = 'satellite_bone',
  alphaMultiplier: number = 1.0
): string {
  const d = Math.max(0, Math.min(1, visDensity));
  const alpha = Math.min(1.0, d * alphaMultiplier);

  if (palette === 'satellite_bone') {
    // Meteorological visible satellite bone colormap
    const r = Math.round(d * 245 + 10);
    const g = Math.round(d * 248 + 7);
    const b = Math.round(d * 255);
    return `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(3)})`;
  } else if (palette === 'pure_white') {
    const v = Math.round(d * 255);
    return `rgba(${v}, ${v}, ${v}, ${alpha.toFixed(3)})`;
  } else if (palette === 'deep_sky_cyan') {
    // Electric atmospheric cyan
    const r = Math.round(d * 180 + 30);
    const g = Math.round(d * 230 + 25);
    const b = Math.round(d * 255);
    return `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(3)})`;
  } else {
    // Night infrared thermal palette (black -> dark blue -> orange -> white)
    if (d < 0.25) {
      const t = d / 0.25;
      return `rgba(${Math.round(20 * t)}, ${Math.round(40 * t)}, ${Math.round(160 * t)}, ${alpha.toFixed(3)})`;
    } else if (d < 0.65) {
      const t = (d - 0.25) / 0.4;
      return `rgba(${Math.round(20 + 200 * t)}, ${Math.round(40 + 120 * t)}, ${Math.round(160 * (1 - t))}, ${alpha.toFixed(3)})`;
    } else {
      const t = (d - 0.65) / 0.35;
      return `rgba(255, ${Math.round(160 + 95 * t)}, ${Math.round(95 * t)}, ${alpha.toFixed(3)})`;
    }
  }
}

/**
 * Maps Ground Observer Sky Dome Fish-Eye Normalized Coordinates (u, v) with u^2 + v^2 <= 1
 * into physical 2D atmospheric space above the observer.
 */
export function mapSkyDomeToAtmosphere(
  u: number,
  v: number,
  earthConfig: EarthDipoleConfig,
  observerAngleDeg: number,
  altitudeKm: number = 8.0,
  fovDeg: number = 140
): { wx: number; wy: number; zenithAngleRad: number; azimuthRad: number; isVisible: boolean } {
  const rNorm = Math.sqrt(u * u + v * v);
  if (rNorm > 1.0) {
    return { wx: 0, wy: 0, zenithAngleRad: Math.PI / 2, azimuthRad: 0, isVisible: false };
  }

  // Zenith angle: 0 at center (u=0, v=0), max zenith at dome edge
  const maxZenithRad = ((fovDeg / 2) * Math.PI) / 180;
  const zenithAngleRad = rNorm * maxZenithRad;
  const azimuthRad = Math.atan2(v, u);

  // Observer on Earth surface
  const obsRad = (observerAngleDeg * Math.PI) / 180;
  const earthR = earthConfig.radius;
  
  // Intersection with the physical cloud shell in the 2D meridian.
  // Azimuth is projected: this is not a full 3D atmosphere.
  const altitude = Math.max(0,altitudeKm)/6371;
  const normal = Math.cos(zenithAngleRad), tangent = Math.sin(zenithAngleRad)*Math.cos(azimuthRad);
  const length = Math.hypot(normal,tangent)||1, nr=normal/length,tr=tangent/length;
  const travel = -earthR*nr+Math.sqrt((earthR*nr)**2+2*earthR*altitude+altitude**2);
  const ox=earthConfig.x+earthR*Math.cos(obsRad),oy=earthConfig.y+earthR*Math.sin(obsRad);
  const wx=ox+travel*(nr*Math.cos(obsRad)-tr*Math.sin(obsRad));
  const wy=oy+travel*(nr*Math.sin(obsRad)+tr*Math.cos(obsRad));

  return {
    wx,
    wy,
    zenithAngleRad,
    azimuthRad,
    isVisible: true,
  };
}


