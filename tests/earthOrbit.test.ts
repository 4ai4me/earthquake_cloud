import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_EARTH_ORBIT_CONFIG } from '../src/types';
import { advanceEarthOrbit, computeEarthOrbitState, solveEccentricAnomaly } from '../src/physics/earthOrbit';

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
