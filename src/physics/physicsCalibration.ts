import { MoonConfig } from '../types';

export const MU_0 = 4 * Math.PI * 1e-7;
export const EARTH_RADIUS_KM = 6_371;
export const EARTH_EQUATORIAL_FIELD_NT = 31_200;
export const MEAN_MOON_DISTANCE_EARTH_RADII = 60.3;
export const MAX_SOLID_EARTH_TIDE_STRESS_KPA = 4;

/** Proton-only solar-wind ram pressure rho*v^2 in nPa. */
export function computeSolarWindDynamicPressureNPa(densityCm3: number, speedKmS: number): number {
  if (!Number.isFinite(densityCm3) || densityCm3 < 0 || !Number.isFinite(speedKmS) || speedKmS < 0) {
    throw new RangeError('Solar-wind density and speed must be finite non-negative values.');
  }
  return 1.67262192595e-6 * densityCm3 * speedKmS * speedKmS;
}

/** Converts the simulator's Earth-surface-normalized magnetic field to tesla. */
export function normalizedFieldToTesla(normalizedField: number): number {
  return normalizedField * EARTH_EQUATORIAL_FIELD_NT * 1e-9;
}

/** Magnetic energy density B^2/(2 mu0), returned as nPa. */
export function computeMagneticPressureNPa(normalizedField: number): number {
  const fieldTesla = normalizedFieldToTesla(normalizedField);
  return (fieldTesla * fieldTesla * 1e9) / (2 * MU_0);
}

/**
 * Shue et al. (1998), doi:10.1029/98JA01103.
 * Returns magnetopause distance in Earth radii for solar zenith angle theta.
 */
export function computeShueMagnetopauseRadius(
  thetaRad: number,
  dynamicPressureNPa: number,
  imfBzNt: number
): { radiusEarthRadii: number; subsolarEarthRadii: number; flaring: number } {
  const pressure = Math.max(0.05, dynamicPressureNPa);
  const bz = Math.max(-50, Math.min(50, imfBzNt));
  const subsolar = (10.22 + 1.29 * Math.tanh(0.184 * (bz + 8.14))) * Math.pow(pressure, -1 / 6.6);
  const flaring = (0.58 - 0.007 * bz) * (1 + 0.024 * Math.log(pressure));
  const denominator = Math.max(0.02, 1 + Math.cos(thetaRad));
  const radius = subsolar * Math.pow(2 / denominator, flaring);
  return { radiusEarthRadii: radius, subsolarEarthRadii: subsolar, flaring };
}

/**
 * A bounded quadrupolar solid-Earth-tide perturbation. The <=4 kPa calibration
 * follows Métivier et al. (2009), doi:10.1016/j.epsl.2008.12.024. It is a
 * reversible trigger perturbation and must not be accumulated as tectonic load.
 */
export function computeLunarTidalStressKPa(nodeAngleRad: number, moon: MoonConfig): number {
  if (!moon.enabled) return 0;
  const moonAngle = (moon.phaseAngleDeg * Math.PI) / 180;
  const distance = Math.max(1, moon.physicalDistanceEarthRadii ?? MEAN_MOON_DISTANCE_EARTH_RADII);
  const distanceScale = Math.pow(MEAN_MOON_DISTANCE_EARTH_RADII / distance, 3);
  const calibration = Math.max(0, Math.min(1, moon.tidalStressWeight ?? 1));
  return MAX_SOLID_EARTH_TIDE_STRESS_KPA * calibration * distanceScale * Math.cos(2 * (nodeAngleRad - moonAngle));
}

/** Circular-crack scaling plus the Hanks-Kanamori moment-magnitude relation. */
export function estimateSyntheticRupture(
  ruptureRadiusKm: number,
  stressDropMPa: number = 3
): { seismicMomentNm: number; momentMagnitude: number } {
  const radiusM = Math.max(100, ruptureRadiusKm * 1_000);
  const stressDropPa = Math.max(0.01, stressDropMPa) * 1e6;
  const seismicMomentNm = (16 / 7) * stressDropPa * Math.pow(radiusM, 3);
  const momentMagnitude = (2 / 3) * (Math.log10(seismicMomentNm) - 9.1);
  return { seismicMomentNm, momentMagnitude };
}
