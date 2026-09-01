import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import {
  DEFAULT_CLOUD_CONFIG,
  DEFAULT_EARTH_DIPOLE,
  DEFAULT_MOON_CONFIG,
  DEFAULT_SOLAR_WIND,
} from '../src/types';
import {
  calculateEarthDipoleField,
  computeInterferenceIntensity,
  computeWaveCloudDensity,
} from '../src/physics/magneticEngine';
import {
  computeLunarTidalStressKPa,
  computeMagneticPressureNPa,
  computeShueMagnetopauseRadius,
  computeSolarWindDynamicPressureNPa,
  estimateSyntheticRupture,
} from '../src/physics/physicsCalibration';
import { CrustalStressManager } from '../src/physics/crustalStressEngine';
import { buildVerificationPython } from '../src/physics/verificationScript';
import {
  CERN_CLOUD_PRESETS,
  computeAerosolCloudBaselineMultiplier,
  computeCernCloudAerosol,
  computeKappaKohlerCriticalDiameterNm,
} from '../src/physics/cernCloudAerosolEngine';

test('untilted dipole is symmetric and no longer contains the x-cubed By defect', () => {
  const config = { ...DEFAULT_EARTH_DIPOLE, tiltAngle: 0, radius: 0.95 };
  const positive = calculateEarthDipoleField(2, 0, config);
  const negative = calculateEarthDipoleField(-2, 0, config);
  assert.ok(Math.abs(positive.bx) < 1e-12);
  assert.ok(Math.abs(negative.bx) < 1e-12);
  assert.ok(Math.abs(positive.by - negative.by) < 1e-12);
  assert.ok(positive.by < 0);
});

test('physical calibration utilities reproduce expected orders of magnitude', () => {
  assert.ok(Math.abs(computeSolarWindDynamicPressureNPa(5, 400) - 1.3381) < 0.001);
  assert.ok(Math.abs(computeMagneticPressureNPa(1) - 387_319) < 10);
  const shue = computeShueMagnetopauseRadius(0, 2, 0);
  assert.ok(shue.subsolarEarthRadii > 9 && shue.subsolarEarthRadii < 12);
  assert.equal(computeLunarTidalStressKPa(0, { ...DEFAULT_MOON_CONFIG, phaseAngleDeg: 0 }), 4);
  assert.ok(Math.abs(computeLunarTidalStressKPa(Math.PI / 2, { ...DEFAULT_MOON_CONFIG, phaseAngleDeg: 0 }) + 4) < 1e-12);
  const rupture = estimateSyntheticRupture(10, 3);
  assert.ok(rupture.momentMagnitude > 6 && rupture.momentMagnitude < 7);
});

test('dimensionless interference stays bounded and null control is exactly zero', () => {
  const sources = [{ id: 'x', name: 'test dipole', type: 'dipole' as const, x: 2, y: 1, strength: 2, active: true }];
  const interference = computeInterferenceIntensity(1.4, 0.4, DEFAULT_EARTH_DIPOLE, sources, DEFAULT_SOLAR_WIND);
  assert.ok(interference.intensity >= 0 && interference.intensity <= 1);
  assert.ok(interference.shearAngleFactor >= 0 && interference.shearAngleFactor <= 1.000001);
  const control = computeWaveCloudDensity(
    1.4,
    0.4,
    DEFAULT_EARTH_DIPOLE,
    sources,
    DEFAULT_SOLAR_WIND,
    { ...DEFAULT_CLOUD_CONFIG, hypothesisEnabled: false },
    1
  );
  assert.equal(control.density, 0);
  assert.equal(control.hypothesisContribution, 0);
});

test('tidal and magnetic perturbations do not accumulate as tectonic load', () => {
  const manager = new CrustalStressManager(8);
  manager.tectonicLoadingRate = 0;
  manager.magneticHypothesisEnabled = false;
  const before = manager.nodes.map((node) => node.accumulatedStress);
  for (let index = 0; index < 20; index++) {
    manager.update(DEFAULT_EARTH_DIPOLE, [], DEFAULT_SOLAR_WIND, 0.05, undefined, DEFAULT_MOON_CONFIG);
  }
  assert.deepEqual(manager.nodes.map((node) => node.accumulatedStress), before);
  assert.ok(manager.nodes.some((node) => Math.abs(node.tidalStressKPa ?? 0) > 0));
});

test('Python export contains the same control separation and calibrated equations', () => {
  const script = buildVerificationPython(
    DEFAULT_EARTH_DIPOLE,
    [],
    DEFAULT_SOLAR_WIND,
    DEFAULT_CLOUD_CONFIG,
    DEFAULT_MOON_CONFIG
  );
  assert.match(script, /Pmag_npa = B_tesla\*\*2 \/ \(2\.0\*MU0\)/);
  assert.match(script, /Hypothesis delta/);
  assert.match(script, /A_h = 0\.0/);
  assert.match(script, /does not validate or/);
  assert.match(script, /j_sa_nh3/);
  assert.match(script, /critical_d/);
  assert.match(script, /aerosolExperiment/);

  const python = spawnSync(
    'python',
    ['-c', "import sys; compile(sys.stdin.read(), '<verification-export>', 'exec')"],
    { input: script, encoding: 'utf8' }
  );
  assert.equal(python.status, 0, python.stderr || 'generated Python failed to compile');
});

test('CERN CLOUD screening channels remain finite and respect their applicability presets', () => {
  const boundary = computeCernCloudAerosol(CERN_CLOUD_PRESETS.boundary_layer);
  const marine = computeCernCloudAerosol(CERN_CLOUD_PRESETS.marine_polar);
  const upper = computeCernCloudAerosol(CERN_CLOUD_PRESETS.upper_troposphere);
  for (const result of [boundary, marine, upper]) {
    assert.ok(Number.isFinite(result.totalNucleationRateCm3S));
    assert.ok(result.totalNucleationRateCm3S >= 0);
    assert.ok(result.growthRateNmH >= 0 && result.growthRateNmH <= 60);
    assert.ok(result.ccnActivationPotential >= 0 && result.ccnActivationPotential <= 1);
  }
  assert.equal(marine.dominantChannel, 'HIOX');
  assert.equal(upper.dominantChannel, 'IP_OOM');
  assert.ok(upper.growthRateNmH >= 3 && upper.growthRateNmH <= 60);
});

test('ion-induced aerosol formation is capped by ion-pair production and OFF is exact', () => {
  const active = computeCernCloudAerosol({ ...CERN_CLOUD_PRESETS.boundary_layer, ionPairProductionCm3S: 0.5 });
  assert.ok(active.ionInducedRateCm3S <= 0.5);
  const inactiveConfig = { ...CERN_CLOUD_PRESETS.boundary_layer, enabled: false, coupleToCloudBaseline: true };
  const inactive = computeCernCloudAerosol(inactiveConfig);
  assert.equal(inactive.totalNucleationRateCm3S, 0);
  assert.equal(inactive.ccnActivationPotential, 0);
  assert.equal(computeAerosolCloudBaselineMultiplier(inactiveConfig), 1);
});

test('kappa-Kohler activation responds monotonically to hygroscopicity and supersaturation', () => {
  const reference = computeKappaKohlerCriticalDiameterNm(278, 0.3, 0.2);
  const moreHygroscopic = computeKappaKohlerCriticalDiameterNm(278, 0.6, 0.2);
  const moreSupersaturated = computeKappaKohlerCriticalDiameterNm(278, 0.3, 0.5);
  assert.ok(reference > 50 && reference < 200);
  assert.ok(moreHygroscopic < reference);
  assert.ok(moreSupersaturated < reference);
});
