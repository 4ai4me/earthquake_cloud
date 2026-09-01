import { EarthDipoleConfig, ExternalMagneticSource, MoonConfig, SolarWindConfig } from '../types';
import { EARTH_EQUATORIAL_FIELD_NT } from './physicsCalibration';

export const EPSILON = 0.05; // Regularizer to prevent division by zero at singularities

/**
 * Calculates Earth's Dipole Magnetic Field at point (x, y)
 */
export function calculateEarthDipoleField(
  x: number,
  y: number,
  config: EarthDipoleConfig
): { bx: number; by: number } {
  const effectiveMoment = (config.reversed ? -1 : 1) * config.moment;
  const dx = x - config.x;
  const dy = y - config.y;
  const rSquared = dx * dx + dy * dy;
  const r = Math.sqrt(rSquared + EPSILON * EPSILON);
  const r5 = Math.pow(r, 5);

  // Rotate to dipole-aligned frame
  const rad = (config.tiltAngle * Math.PI) / 180;
  const cosT = Math.cos(rad);
  const sinT = Math.sin(rad);

  const xPrime = dx * cosT + dy * sinT;
  const yPrime = -dx * sinT + dy * cosT;

  const bxPrime = (3 * effectiveMoment * xPrime * yPrime) / r5;
  const byPrime = (effectiveMoment * (2 * yPrime * yPrime - xPrime * xPrime)) / r5;

  // Rotate back to global frame
  const bx = bxPrime * cosT - byPrime * sinT;
  const by = bxPrime * sinT + byPrime * cosT;

  return { bx, by };
}

/**
 * Calculates External Magnetic Source Field (Monopole, Dipole, or Approaching Comet) at point (x, y)
 */
export function calculateExternalSourceField(
  x: number,
  y: number,
  source: ExternalMagneticSource
): { bx: number; by: number } {
  if (!source.active) return { bx: 0, by: 0 };

  const dx = x - source.x;
  const dy = y - source.y;
  const rSquared = dx * dx + dy * dy;
  const r = Math.sqrt(rSquared + EPSILON * EPSILON);

  if (source.type === 'monopole_n' || source.type === 'monopole_s') {
    // Monopole approximation: B = q_m * r_vec / r^3
    const qm = source.type === 'monopole_n' ? source.strength : -source.strength;
    const r3 = Math.pow(r, 3);
    return {
      bx: (qm * dx) / r3,
      by: (qm * dy) / r3,
    };
  } else if (source.type === 'dipole') {
    // External Dipole source
    const r5 = Math.pow(r, 5);
    const angleRad = ((source.angle || 0) * Math.PI) / 180;
    const cosA = Math.cos(angleRad);
    const sinA = Math.sin(angleRad);

    const xPrime = dx * cosA + dy * sinA;
    const yPrime = -dx * sinA + dy * cosA;

    const bxPrime = (3 * source.strength * xPrime * yPrime) / r5;
    const byPrime = (source.strength * (2 * yPrime * yPrime - xPrime * xPrime)) / r5;

    return {
      bx: bxPrime * cosA - byPrime * sinA,
      by: bxPrime * sinA + byPrime * cosA,
    };
  } else if (source.type === 'comet') {
    // Approaching Comet with Induced Plasma Magnetosphere & Draped Ion Tail
    // Comet nucleus at (source.x, source.y)
    // Coma diamagnetic shielding + Bow Shock + Ion tail draping along anti-solar direction (+X)
    const tailLen = source.cometTailLength || 3.0;
    const gasActivity = source.cometGasActivity || source.strength || 2.5;

    // 1. Coma Diamagnetic Cavity & Outgassing Field
    const r3 = Math.pow(r, 3);
    let cbx = -(gasActivity * 0.35 * dx) / r3;
    let cby = -(gasActivity * 0.35 * dy) / r3;

    // 2. Draped Ion Tail along anti-solar (+X) direction from comet head
    if (dx > 0 && dx < tailLen) {
      const tailWidth = 0.35 + dx * 0.18;
      const tailEnvelope = Math.exp(-(dy * dy) / (2 * tailWidth * tailWidth)) * Math.exp(-dx / tailLen);
      // Draped lobes: top lobe (dy > 0) has field pointing towards nucleus (-X), bottom lobe (+X)
      const tailLobeBx = (dy > 0 ? -1 : 1) * gasActivity * 0.75 * tailEnvelope;
      const tailLobeBy = (dy / tailWidth) * gasActivity * 0.25 * tailEnvelope;
      cbx += tailLobeBx;
      cby += tailLobeBy;
    }

    // 3. Upstream Cometary Bow Shock (dx < 0)
    if (dx < 0 && dx > -0.8 && Math.abs(dy) < 1.2) {
      const shockStrength = gasActivity * 0.5 * Math.exp(-Math.hypot(dx, dy) / 0.6);
      cbx += shockStrength * 0.5;
      cby += shockStrength * (dy > 0 ? 0.3 : -0.3);
    }

    return { bx: cbx, by: cby };
  }

  return { bx: 0, by: 0 };
}

/**
 * Calculates Solar Wind & IMF (Interplanetary Magnetic Field) contribution
 */
export function calculateSolarWindField(
  x: number,
  y: number,
  solarWind: SolarWindConfig,
  earthConfig: EarthDipoleConfig
): { bx: number; by: number } {
  if (!solarWind.enabled) return { bx: 0, by: 0 };

  // IMF inputs are nT, whereas the renderer uses an Earth-surface-normalized field.
  // The explicit gain keeps nT-scale vectors visible; pressure changes the
  // magnetopause boundary (Shue model), not the magnetic vector by itself.
  const displayGain = Math.max(1, solarWind.fieldVisualizationGain ?? 1_000);
  return {
    bx: (solarWind.imfBx / EARTH_EQUATORIAL_FIELD_NT) * displayGain,
    by: (solarWind.imfBz / EARTH_EQUATORIAL_FIELD_NT) * displayGain,
  };
}

/**
 * Calculates the Moon's Local Crustal Magnetic Field & Downstream Plasma Wake Cavity
 */
export function calculateMoonField(
  x: number,
  y: number,
  moonConfig: MoonConfig,
  solarWind: SolarWindConfig,
  earthConfig: EarthDipoleConfig
): { bx: number; by: number; moonX: number; moonY: number; distToMoon: number } {
  if (!moonConfig || !moonConfig.enabled) {
    return { bx: 0, by: 0, moonX: 0, moonY: 0, distToMoon: 999 };
  }

  const rad = (moonConfig.phaseAngleDeg * Math.PI) / 180;
  const moonX = earthConfig.x + moonConfig.orbitRadius * Math.cos(rad);
  const moonY = earthConfig.y + moonConfig.orbitRadius * Math.sin(rad);

  const dx = x - moonX;
  const dy = y - moonY;
  const rSquared = dx * dx + dy * dy;
  const r = Math.sqrt(rSquared + EPSILON * EPSILON);
  const r5 = Math.pow(r, 5);

  // 1. Lunar Remanent Crustal Dipole (Reiner Gamma-like swirl dipole)
  const angleRad = ((moonConfig.remanentAngle || 0) * Math.PI) / 180;
  const cosA = Math.cos(angleRad);
  const sinA = Math.sin(angleRad);

  const xPrime = dx * cosA + dy * sinA;
  const yPrime = -dx * sinA + dy * cosA;

  const bxPrime = (3 * moonConfig.remanentMoment * xPrime * yPrime) / r5;
  const byPrime = (moonConfig.remanentMoment * (2 * yPrime * yPrime - xPrime * xPrime)) / r5;

  let bx = bxPrime * cosA - byPrime * sinA;
  let by = bxPrime * sinA + byPrime * cosA;

  // 2. Lunar Plasma Wake (Diamagnetic Cavity in Solar Wind)
  // When in solar wind (or tail), Moon absorbs ions creating density depletion downstream (+X direction)
  if (solarWind.enabled && dx > 0 && dx < 2.2) {
    const wakeWidth = moonConfig.radius * 1.6 + dx * 0.15;
    if (Math.abs(dy) < wakeWidth) {
      const wakeDepth = Math.exp(-(dy * dy) / (2 * wakeWidth * wakeWidth)) * Math.exp(-dx / 1.8);
      const wakeCavityBx = -solarWind.imfBx * 0.12 * wakeDepth * (moonConfig.wakeCavityStrength || 0.7);
      const wakeCavityBy = (dy > 0 ? 0.08 : -0.08) * wakeDepth * (moonConfig.wakeCavityStrength || 0.7);
      bx += wakeCavityBx;
      by += wakeCavityBy;
    }
  }

  return { bx, by, moonX, moonY, distToMoon: r };
}

/**
 * Computes Composite Magnetic Vector Field (Superposition Principle)
 */
export function computeTotalMagneticField(
  x: number,
  y: number,
  earthConfig: EarthDipoleConfig,
  sources: ExternalMagneticSource[],
  solarWind: SolarWindConfig,
  moonConfig?: MoonConfig
): { bx: number; by: number; magnitude: number } {
  // 1. Earth Dipole
  const earthField = calculateEarthDipoleField(x, y, earthConfig);
  let bx = earthField.bx;
  let by = earthField.by;

  // 2. Superposition of all active external sources
  for (const source of sources) {
    if (source.active) {
      const sField = calculateExternalSourceField(x, y, source);
      bx += sField.bx;
      by += sField.by;
    }
  }

  // 3. Solar Wind & IMF contribution
  const swField = calculateSolarWindField(x, y, solarWind, earthConfig);
  bx += swField.bx;
  by += swField.by;

  // 4. Moon Crustal Magnetic Field & Plasma Wake
  if (moonConfig && moonConfig.enabled) {
    const mField = calculateMoonField(x, y, moonConfig, solarWind, earthConfig);
    bx += mField.bx;
    by += mField.by;
  }

  const magnitude = Math.sqrt(bx * bx + by * by);

  return { bx, by, magnitude };
}

export interface MagnetosphereDistortion3D {
  dx: number;
  dy: number;
  dz: number;
  influence: number;
}

/**
 * Bounded visual displacement for the 3D magnetosphere.
 *
 * This is a hypothesis visualisation coupling, not a validated prediction of
 * magnetohydrodynamic plasma motion. It projects the configured external source
 * types into 3D while using softening and a hard displacement cap so singular
 * source fields cannot tear or invert the rendered flux tubes.
 */
export function computeExternalMagnetosphereDistortion3D(
  x: number,
  y: number,
  z: number,
  sources: ExternalMagneticSource[],
  maxDisplacement: number = 1.8
): MagnetosphereDistortion3D {
  let dx = 0;
  let dy = 0;
  let dz = 0;
  let influence = 0;

  for (const source of sources) {
    if (!source.active) continue;

    const rx = x - source.x;
    const ry = y - source.y;
    const rz = z - (source.z ?? 0);
    const softenedR2 = rx * rx + ry * ry + rz * rz + 0.45 * 0.45;
    const r = Math.sqrt(softenedR2);
    const sourceScale = Math.tanh(Math.max(0, Math.abs(source.strength)) / 3);
    const falloff = sourceScale / (1 + 0.28 * softenedR2);

    if (source.type === 'monopole_n' || source.type === 'monopole_s') {
      const polarity = source.type === 'monopole_n' ? 1 : -1;
      const gain = polarity * falloff * 1.35;
      dx += (rx / r) * gain;
      dy += (ry / r) * gain;
      dz += (rz / r) * gain;
      influence += Math.abs(gain);
    } else if (source.type === 'dipole') {
      const angle = ((source.angle ?? 0) * Math.PI) / 180;
      const mx = Math.cos(angle);
      const my = Math.sin(angle);
      const dot = (mx * rx + my * ry) / r;
      const gain = falloff * 1.15;
      dx += (3 * dot * (rx / r) - mx) * gain;
      dy += (3 * dot * (ry / r) - my) * gain;
      dz += 3 * dot * (rz / r) * gain;
      influence += Math.abs(gain);
    } else if (source.type === 'comet') {
      const tailLength = Math.max(1, source.cometTailLength ?? 3);
      const tailEnvelope = rx > 0
        ? Math.exp(-rx / tailLength) * Math.exp(-(ry * ry + rz * rz) / 2.2)
        : 0;
      const cavityGain = falloff * 0.9;
      dx -= (rx / r) * cavityGain;
      dy -= (ry / r) * cavityGain;
      dz -= (rz / r) * cavityGain;
      dx += tailEnvelope * sourceScale * 0.85;
      dy += Math.sign(ry || 1) * tailEnvelope * sourceScale * 0.18;
      influence += Math.abs(cavityGain) + tailEnvelope * sourceScale;
    }
  }

  const length = Math.hypot(dx, dy, dz);
  if (length > maxDisplacement && length > 0) {
    const scale = maxDisplacement / length;
    dx *= scale;
    dy *= scale;
    dz *= scale;
  }

  return { dx, dy, dz, influence: Math.min(influence, 4) };
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
  startX: number,
  startY: number,
  earthConfig: EarthDipoleConfig,
  sources: ExternalMagneticSource[],
  solarWind: SolarWindConfig,
  direction: 1 | -1 = 1,
  maxSteps: number = 180,
  stepSize: number = 0.05,
  bounds: { minX: number; maxX: number; minY: number; maxY: number } = { minX: -6, maxX: 6, minY: -4, maxY: 4 },
  moonConfig?: MoonConfig
): Array<{ x: number; y: number; bMag: number }> {
  const points: Array<{ x: number; y: number; bMag: number }> = [];
  let currX = startX;
  let currY = startY;

  for (let i = 0; i < maxSteps; i++) {
    const f0 = computeTotalMagneticField(currX, currY, earthConfig, sources, solarWind, moonConfig);
    if (f0.magnitude < 1e-4) break;

    points.push({ x: currX, y: currY, bMag: f0.magnitude });

    // Out of bounds check
    if (
      currX < bounds.minX ||
      currX > bounds.maxX ||
      currY < bounds.minY ||
      currY > bounds.maxY
    ) {
      break;
    }

    // Check if entered Earth core
    const distToEarth = Math.hypot(currX - earthConfig.x, currY - earthConfig.y);
    if (distToEarth < earthConfig.radius * 0.4 && i > 3) {
      break;
    }

    // RK4 Integration Steps
    const h = stepSize * direction;

    // k1
    const k1x = (f0.bx / f0.magnitude) * h;
    const k1y = (f0.by / f0.magnitude) * h;

    // k2
    const f1 = computeTotalMagneticField(currX + 0.5 * k1x, currY + 0.5 * k1y, earthConfig, sources, solarWind, moonConfig);
    if (f1.magnitude < 1e-4) break;
    const k2x = (f1.bx / f1.magnitude) * h;
    const k2y = (f1.by / f1.magnitude) * h;

    // k3
    const f2 = computeTotalMagneticField(currX + 0.5 * k2x, currY + 0.5 * k2y, earthConfig, sources, solarWind, moonConfig);
    if (f2.magnitude < 1e-4) break;
    const k3x = (f2.bx / f2.magnitude) * h;
    const k3y = (f2.by / f2.magnitude) * h;

    // k4
    const f3 = computeTotalMagneticField(currX + k3x, currY + k3y, earthConfig, sources, solarWind, moonConfig);
    if (f3.magnitude < 1e-4) break;
    const k4x = (f3.bx / f3.magnitude) * h;
    const k4y = (f3.by / f3.magnitude) * h;

    currX += (k1x + 2 * k2x + 2 * k3x + k4x) / 6;
    currY += (k1y + 2 * k2y + 2 * k3y + k4y) / 6;
  }

  return points;
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
  
  // Convert atmospheric altitude (e.g. 8 km scaled to R_E units where R_E ~ 6371km => 8/6371 ~ 0.00125 * scale)
  const atmAltitudeUnits = earthR * 0.22; // Scaled atmospheric layer for 2D visual fidelity
  
  // Displacement along horizon (tangent) and zenith (normal)
  const zenithOffset = Math.cos(zenithAngleRad) * atmAltitudeUnits;
  const horizonOffset = Math.sin(zenithAngleRad) * Math.cos(azimuthRad) * (atmAltitudeUnits * 3.2);

  // Observer center position
  const ox = earthConfig.x + earthR * Math.cos(obsRad);
  const oy = earthConfig.y + earthR * Math.sin(obsRad);

  // Normal (zenith) and Tangent (horizon) unit vectors
  const normX = Math.cos(obsRad);
  const normY = Math.sin(obsRad);
  const tangX = -Math.sin(obsRad);
  const tangY = Math.cos(obsRad);

  const wx = ox + normX * zenithOffset + tangX * horizonOffset;
  const wy = oy + normY * zenithOffset + tangY * horizonOffset;

  return {
    wx,
    wy,
    zenithAngleRad,
    azimuthRad,
    isVisible: true,
  };
}


