import { EarthDipoleConfig, EarthOrbitConfig, SolarWindConfig } from '../types';

export const ASTRONOMICAL_UNIT_KM = 149_597_870.7;
const SOLAR_GRAVITATIONAL_PARAMETER_KM3_S2 = 132_712_440_018;

export interface EarthOrbitState {
  xAu: number;
  yAu: number;
  distanceAu: number;
  distanceKm: number;
  trueAnomalyDeg: number;
  orbitalSpeedKmS: number;
  solarFluxRatio: number;
}

export interface SunEarthCouplingState {
  earth: EarthDipoleConfig;
  solarWind: SolarWindConfig;
  solarWindFlowAngleDeg: number;
  solarWindPressureRatio: number;
  projectedDipoleAngleDeg: number;
}

const normalizeDegrees = (degrees: number) => ((degrees % 360) + 360) % 360;

/** Solves M = E - e sin(E). The UI constrains e to a bound where Newton iteration is stable. */
export function solveEccentricAnomaly(meanAnomalyRad: number, eccentricity: number): number {
  const e = Math.max(0, Math.min(0.95, eccentricity));
  const m = ((meanAnomalyRad % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  let eccentricAnomaly = e < 0.8 ? m : Math.PI;
  for (let iteration = 0; iteration < 12; iteration += 1) {
    const correction = (eccentricAnomaly - e * Math.sin(eccentricAnomaly) - m) /
      (1 - e * Math.cos(eccentricAnomaly));
    eccentricAnomaly -= correction;
    if (Math.abs(correction) < 1e-12) break;
  }
  return eccentricAnomaly;
}

export function computeEarthOrbitState(config: EarthOrbitConfig): EarthOrbitState {
  const semiMajorAxisAu = Math.max(1e-6, config.semiMajorAxisAu);
  const eccentricity = Math.max(0, Math.min(0.95, config.eccentricity));
  const meanAnomaly = normalizeDegrees(config.phaseAngleDeg) * Math.PI / 180;
  const eccentricAnomaly = solveEccentricAnomaly(meanAnomaly, eccentricity);
  const xAu = semiMajorAxisAu * (Math.cos(eccentricAnomaly) - eccentricity);
  const yAu = semiMajorAxisAu * Math.sqrt(1 - eccentricity ** 2) * Math.sin(eccentricAnomaly);
  const distanceAu = Math.hypot(xAu, yAu);
  const distanceKm = distanceAu * ASTRONOMICAL_UNIT_KM;
  const semiMajorAxisKm = semiMajorAxisAu * ASTRONOMICAL_UNIT_KM;
  const orbitalSpeedKmS = Math.sqrt(
    SOLAR_GRAVITATIONAL_PARAMETER_KM3_S2 * (2 / distanceKm - 1 / semiMajorAxisKm)
  );
  const trueAnomalyDeg = normalizeDegrees(Math.atan2(yAu, xAu) * 180 / Math.PI);
  return {
    xAu,
    yAu,
    distanceAu,
    distanceKm,
    trueAnomalyDeg,
    orbitalSpeedKmS,
    solarFluxRatio: 1 / (distanceAu ** 2),
  };
}

export function advanceEarthOrbit(config: EarthOrbitConfig, seconds: number): EarthOrbitConfig {
  if (!config.enabled || !config.autoOrbit || seconds <= 0) return config;
  const days = seconds * config.daysPerSecond;
  if (!Number.isFinite(days) || days === 0) return config;
  return {
    ...config,
    phaseAngleDeg: normalizeDegrees(config.phaseAngleDeg + 360 * days / Math.max(0.01, config.orbitalPeriodDays)),
    rotationPhaseDeg: normalizeDegrees((config.rotationPhaseDeg ?? 0) + 360 * days * 24 / Math.max(0.01, config.rotationPeriodHours ?? 23.9344696)),
  };
}

/**
 * Projects Sun-Earth geometry into the app's shared x-y slice.
 * The solar-wind pressure correction assumes a steady radial flow: density and
 * therefore ram pressure dilute as r^-2 while the user-provided speed/IMF stay
 * untouched. This is a visual/diagnostic coupling, not a global MHD solution.
 */
export function computeSunEarthCoupling(
  config: EarthOrbitConfig,
  earth: EarthDipoleConfig,
  solarWind: SolarWindConfig,
): SunEarthCouplingState {
  if (!config.enabled || config.couplingEnabled === false) {
    return {
      earth,
      solarWind,
      solarWindFlowAngleDeg: solarWind.flowAngleDeg ?? 0,
      solarWindPressureRatio: 1,
      projectedDipoleAngleDeg: earth.tiltAngle,
    };
  }

  const orbit = computeEarthOrbitState(config);
  const rotationPhaseRad = normalizeDegrees(config.rotationPhaseDeg ?? 0) * Math.PI / 180;
  // Ecliptic-plane projection: fixed spin-axis obliquity plus the rotating
  // geomagnetic-axis offset configured by the user.
  const projectedDipoleAngleDeg = Math.max(-89.9, Math.min(
    89.9,
    config.axialTiltDeg + earth.tiltAngle * Math.cos(rotationPhaseRad),
  ));
  const solarWindFlowAngleDeg = orbit.trueAnomalyDeg;
  const solarWindPressureRatio = orbit.solarFluxRatio;

  return {
    earth: { ...earth, tiltAngle: projectedDipoleAngleDeg },
    solarWind: {
      ...solarWind,
      pressure: solarWind.pressure * solarWindPressureRatio,
      flowAngleDeg: solarWindFlowAngleDeg,
    },
    solarWindFlowAngleDeg,
    solarWindPressureRatio,
    projectedDipoleAngleDeg,
  };
}
