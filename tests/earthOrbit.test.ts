import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_EARTH_DIPOLE, DEFAULT_EARTH_ORBIT_CONFIG, DEFAULT_SOLAR_WIND } from '../src/types';
import { advanceEarthOrbit, computeEarthOrbitState, computeSunEarthCoupling, solveEccentricAnomaly } from '../src/physics/earthOrbit';

test('Earth orbit reaches the expected perihelion and aphelion distances', () => {
  const perihelion = computeEarthOrbitState({ ...DEFAULT_EARTH_ORBIT_CONFIG, phaseAngleDeg: 0 });
  const aphelion = computeEarthOrbitState({ ...DEFAULT_EARTH_ORBIT_CONFIG, phaseAngleDeg: 180 });
  assert.ok(Math.abs(perihelion.distanceAu - 0.9833) < 1e-10);
  assert.ok(Math.abs(aphelion.distanceAu - 1.0167) < 1e-10);
  assert.ok(perihelion.orbitalSpeedKmS > aphelion.orbitalSpeedKmS);
  assert.ok(perihelion.solarFluxRatio > aphelion.solarFluxRatio);
});

test('Earth orbit clock uses physical days and preserves disabled or paused state', () => {
  const orbit = { ...DEFAULT_EARTH_ORBIT_CONFIG, phaseAngleDeg: 0, daysPerSecond: 1 };
  assert.ok(Math.abs(advanceEarthOrbit(orbit, orbit.orbitalPeriodDays / 4).phaseAngleDeg - 90) < 1e-10);
  const paused = { ...orbit, autoOrbit: false };
  assert.equal(advanceEarthOrbit(paused, 100), paused);
  const disabled = { ...orbit, enabled: false };
  assert.equal(advanceEarthOrbit(disabled, 100), disabled);
});

test('Kepler solver satisfies the ellipse equation across the orbit', () => {
  for (const degrees of [0, 30, 90, 180, 270, 359.9]) {
    const mean = degrees * Math.PI / 180;
    const eccentric = solveEccentricAnomaly(mean, DEFAULT_EARTH_ORBIT_CONFIG.eccentricity);
    const residual = eccentric - DEFAULT_EARTH_ORBIT_CONFIG.eccentricity * Math.sin(eccentric) - mean;
    assert.ok(Math.abs(residual) < 1e-11, `${degrees}° residual ${residual}`);
  }
});

test('solar irradiance display is an inverse-square distance derivative', () => {
  const state = computeEarthOrbitState({ ...DEFAULT_EARTH_ORBIT_CONFIG, phaseAngleDeg: 72 });
  assert.ok(Math.abs(state.solarFluxRatio * state.distanceAu ** 2 - 1) < 1e-12);
  for (const value of Object.values(state)) assert.ok(Number.isFinite(value));
});

test('shared orbit clock advances sidereal rotation using the same physical time', () => {
  const orbit = { ...DEFAULT_EARTH_ORBIT_CONFIG, phaseAngleDeg: 0, rotationPhaseDeg: 0, daysPerSecond: 1 };
  const oneSiderealDay = orbit.rotationPeriodHours / 24;
  const advanced = advanceEarthOrbit(orbit, oneSiderealDay);
  assert.ok(Math.min(advanced.rotationPhaseDeg, 360 - advanced.rotationPhaseDeg) < 1e-9);
  assert.ok(advanced.phaseAngleDeg > 0);
});

test('Sun-Earth coupling shares radial wind direction, r^-2 pressure and rotating dipole projection', () => {
  const orbit = { ...DEFAULT_EARTH_ORBIT_CONFIG, phaseAngleDeg: 90, rotationPhaseDeg: 0 };
  const solar = { ...DEFAULT_SOLAR_WIND, enabled: true, pressure: 2 };
  const coupled = computeSunEarthCoupling(orbit, DEFAULT_EARTH_DIPOLE, solar);
  const state = computeEarthOrbitState(orbit);
  assert.ok(Math.abs(coupled.solarWindFlowAngleDeg - state.trueAnomalyDeg) < 1e-12);
  assert.ok(Math.abs(coupled.solarWind.pressure - solar.pressure * state.solarFluxRatio) < 1e-12);
  assert.equal(coupled.solarWind.flowAngleDeg, coupled.solarWindFlowAngleDeg);
  assert.ok(Math.abs(coupled.projectedDipoleAngleDeg - (orbit.axialTiltDeg + DEFAULT_EARTH_DIPOLE.tiltAngle)) < 1e-12);
  assert.equal(solar.flowAngleDeg, undefined, 'raw user input must not be mutated');

  const oppositeRotation = computeSunEarthCoupling({ ...orbit, rotationPhaseDeg: 180 }, DEFAULT_EARTH_DIPOLE, solar);
  assert.ok(oppositeRotation.projectedDipoleAngleDeg < coupled.projectedDipoleAngleDeg);
  const disabled = computeSunEarthCoupling({ ...orbit, couplingEnabled: false }, DEFAULT_EARTH_DIPOLE, solar);
  assert.equal(disabled.earth, DEFAULT_EARTH_DIPOLE);
  assert.equal(disabled.solarWind, solar);
});
