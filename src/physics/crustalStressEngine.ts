import { CrustalNode, EarthDipoleConfig, EarthquakeEvent, ExternalMagneticSource, MoonConfig, SolarWindConfig } from '../types';
import { calculateEarthDipoleField, computeTotalMagneticField } from './magneticEngine';
import { computeLunarTidalStressKPa, estimateSyntheticRupture } from './physicsCalibration';

export interface SeismicWave {
  id: string;
  epicenterX: number;
  epicenterY: number;
  currentRadius: number;
  maxRadius: number;
  speed: number;
  magnitude: number;
  opacity: number;
  type: 'P_wave' | 'S_wave';
}

export class CrustalStressManager {
  nodes: CrustalNode[] = [];
  earthquakes: EarthquakeEvent[] = [];
  activeWaves: SeismicWave[] = [];
  nodeCount: number = 48;
  maxStressNodeIndex: number = 0;
  maxStressValue: number = 0;
  tectonicLoadingRate: number = 0.0008; // normalized load per displayed second
  magneticHypothesisCouplingMPa: number = 0.01;
  magneticHypothesisEnabled: boolean = true;
  characteristicFailureStressMPa: number = 3;
  ruptureThreshold: number = 0.85; // critical stress threshold

  constructor(nodeCount: number = 48) {
    this.nodeCount = nodeCount;
    this.initNodes();
  }

  initNodes() {
    this.nodes = [];
    for (let i = 0; i < this.nodeCount; i++) {
      const angle = (i / this.nodeCount) * Math.PI * 2;
      this.nodes.push({
        id: i,
        angle,
        x: 0,
        y: 0,
        accumulatedStress: 0.12 + 0.12 * (0.5 + 0.5 * Math.sin(i * 2.399963)),
        ruptured: false,
        ruptureTime: 0,
        lastMagnitude: 0,
        depthKm: 8 + ((i * 7) % 33),
        failureIndex: 0,
        tidalStressKPa: 0,
        hypothesisStressMPa: 0,
      });
    }
  }

  update(
    earthConfig: EarthDipoleConfig,
    sources: ExternalMagneticSource[],
    solarWind: SolarWindConfig,
    dt: number = 0.016,
    onEarthquakeTriggered?: (event: EarthquakeEvent) => void,
    moonConfig?: MoonConfig
  ) {
    let currentMax = 0;
    let maxIdx = 0;

    for (let i = 0; i < this.nodes.length; i++) {
      const node = this.nodes[i];
      const radius = earthConfig.radius;
      node.x = earthConfig.x + Math.cos(node.angle) * radius;
      node.y = earthConfig.y + Math.sin(node.angle) * radius;

      // Tectonic loading is the baseline. Reversible tide and hypothetical
      // magnetic terms modify proximity to failure but are not accumulated.
      const field = computeTotalMagneticField(node.x, node.y, earthConfig, sources, solarWind, moonConfig);
      const earthField = calculateEarthDipoleField(node.x, node.y, earthConfig);
      const externalMagnitude = Math.hypot(field.bx - earthField.bx, field.by - earthField.by);
      const earthMagnitude = Math.hypot(earthField.bx, earthField.by);
      const perturbationRatio = externalMagnitude / Math.max(1e-9, earthMagnitude + externalMagnitude);
      node.hypothesisStressMPa = this.magneticHypothesisEnabled
        ? this.magneticHypothesisCouplingMPa * perturbationRatio
        : 0;
      node.tidalStressKPa = moonConfig ? computeLunarTidalStressKPa(node.angle, moonConfig) : 0;

      const heterogeneousLoading = this.tectonicLoadingRate * (0.8 + 0.4 * (0.5 + 0.5 * Math.sin(node.id * 1.73)));
      node.accumulatedStress = Math.max(0.02, node.accumulatedStress + heterogeneousLoading * Math.max(0, dt));
      const reversibleStressMPa = (node.tidalStressKPa / 1_000) + node.hypothesisStressMPa;
      node.failureIndex = node.accumulatedStress + reversibleStressMPa / this.characteristicFailureStressMPa;

      // Track max stress
      if (node.failureIndex > currentMax) {
        currentMax = node.failureIndex;
        maxIdx = i;
      }

      // Check rupture condition
      if (node.failureIndex >= this.ruptureThreshold) {
        this.triggerRupture(node, field.magnitude, onEarthquakeTriggered);
      }
    }

    this.maxStressValue = currentMax;
    this.maxStressNodeIndex = maxIdx;

    // Update active seismic waves
    for (let i = this.activeWaves.length - 1; i >= 0; i--) {
      const wave = this.activeWaves[i];
      wave.currentRadius += wave.speed * dt * 2.5;
      wave.opacity = Math.max(0, 1 - wave.currentRadius / wave.maxRadius);

      if (wave.currentRadius >= wave.maxRadius) {
        this.activeWaves.splice(i, 1);
      }
    }
  }

  triggerRupture(
    node: CrustalNode,
    fieldIntensity: number,
    onEarthquakeTriggered?: (event: EarthquakeEvent) => void
  ) {
    const peakFailureIndex = node.failureIndex ?? node.accumulatedStress;
    const ruptureRadiusKm = 2 + 18 * Math.max(0, Math.min(1, (peakFailureIndex - 0.45) / 0.65));
    const stressDropMPa = 3;
    const rupture = estimateSyntheticRupture(ruptureRadiusKm, stressDropMPa);
    const magnitude = Number(rupture.momentMagnitude.toFixed(1));
    const now = Date.now();

    node.ruptured = true;
    node.ruptureTime = now;
    node.lastMagnitude = magnitude;

    // Release stress down to baseline
    const peakStress = peakFailureIndex;
    node.accumulatedStress = 0.14 + 0.06 * (0.5 + 0.5 * Math.sin(node.id * 3.17));
    node.failureIndex = node.accumulatedStress;

    const event: EarthquakeEvent = {
      id: `EQ-${now}-${node.id}`,
      timestamp: now,
      nodeIndex: node.id,
      x: node.x,
      y: node.y,
      magnitude,
      peakStress,
      dominantFieldIntensity: fieldIntensity,
      cloudDensityAtEpicenter: 0,
      seismicMomentNm: rupture.seismicMomentNm,
      ruptureRadiusKm,
      stressDropMPa,
      isSynthetic: true,
    };

    this.earthquakes.unshift(event);
    if (this.earthquakes.length > 50) this.earthquakes.pop();

    // Spawn P-wave and S-wave ripples
    this.activeWaves.push({
      id: `wave-P-${now}`,
      epicenterX: node.x,
      epicenterY: node.y,
      currentRadius: 0.05,
      maxRadius: 3.5,
      speed: 1.8, // P-wave is faster
      magnitude,
      opacity: 0.9,
      type: 'P_wave',
    });

    this.activeWaves.push({
      id: `wave-S-${now}`,
      epicenterX: node.x,
      epicenterY: node.y,
      currentRadius: 0.02,
      maxRadius: 2.8,
      speed: 1.1, // S-wave is slower with larger amplitude
      magnitude,
      opacity: 0.8,
      type: 'S_wave',
    });

    if (onEarthquakeTriggered) {
      onEarthquakeTriggered(event);
    }
  }

  manualTriggerNode(nodeIndex: number, onEarthquakeTriggered?: (event: EarthquakeEvent) => void) {
    if (this.nodes[nodeIndex]) {
      this.nodes[nodeIndex].failureIndex = Math.max(this.ruptureThreshold, this.nodes[nodeIndex].failureIndex ?? 0);
      this.triggerRupture(this.nodes[nodeIndex], 1.5, onEarthquakeTriggered);
    }
  }

  dischargeAllStress() {
    this.nodes.forEach((n) => {
      n.accumulatedStress = 0.1;
      n.failureIndex = 0.1;
      n.tidalStressKPa = 0;
      n.hypothesisStressMPa = 0;
    });
  }
}
