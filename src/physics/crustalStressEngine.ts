import { CrustalNode, EarthDipoleConfig, EarthquakeEvent, ExternalMagneticSource, MoonConfig, SolarWindConfig } from '../types';
import { computeTotalMagneticField, computeFieldGradient } from './magneticEngine';

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
  couplingCoefficient: number = 0.08; // alpha
  gradientCoupling: number = 0.05; // beta
  dissipationRate: number = 0.012; // gamma
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
        accumulatedStress: 0.1 + Math.random() * 0.2, // initial background tectonic stress
        ruptured: false,
        ruptureTime: 0,
        lastMagnitude: 0,
        depthKm: 10 + Math.floor(Math.random() * 30),
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

    const moonRad = moonConfig && moonConfig.enabled ? (moonConfig.phaseAngleDeg * Math.PI) / 180 : 0;
    const moonTidalWeight = moonConfig && moonConfig.enabled ? (moonConfig.tidalStressWeight ?? 0.25) : 0;

    for (let i = 0; i < this.nodes.length; i++) {
      const node = this.nodes[i];
      const radius = earthConfig.radius;
      node.x = earthConfig.x + Math.cos(node.angle) * radius;
      node.y = earthConfig.y + Math.sin(node.angle) * radius;

      // Magnetic field and gradient at crustal fault node
      const field = computeTotalMagneticField(node.x, node.y, earthConfig, sources, solarWind, moonConfig);
      const grad = computeFieldGradient(node.x, node.y, earthConfig, sources, solarWind, moonConfig);

      // Magneto-piezoelectric / piezomagnetic stress influx
      const magneticStressRate =
        this.couplingCoefficient * (field.magnitude * field.magnitude) +
        this.gradientCoupling * grad.gradMag;

      // Solid Earth Tidal Gravitational Stress contribution:
      // Delta sigma_tide ~ cos(2 * (phi - theta_moon))
      const tidalModulation = moonTidalWeight * 0.06 * Math.cos(2 * (node.angle - moonRad));

      // Continuous accumulation and viscoelastic dissipation
      node.accumulatedStress += (magneticStressRate + tidalModulation - this.dissipationRate * node.accumulatedStress) * dt * 3.0;

      // Clamp lower bound
      if (node.accumulatedStress < 0.02) node.accumulatedStress = 0.02;

      // Track max stress
      if (node.accumulatedStress > currentMax) {
        currentMax = node.accumulatedStress;
        maxIdx = i;
      }

      // Check rupture condition
      if (node.accumulatedStress >= this.ruptureThreshold) {
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
    const magnitude = parseFloat((4.5 + Math.min(node.accumulatedStress, 1.5) * 2.8).toFixed(1));
    const now = Date.now();

    node.ruptured = true;
    node.ruptureTime = now;
    node.lastMagnitude = magnitude;

    // Release stress down to baseline
    const peakStress = node.accumulatedStress;
    node.accumulatedStress = 0.15 + Math.random() * 0.1;

    const event: EarthquakeEvent = {
      id: `EQ-${now}-${node.id}`,
      timestamp: now,
      nodeIndex: node.id,
      x: node.x,
      y: node.y,
      magnitude,
      peakStress,
      dominantFieldIntensity: fieldIntensity,
      cloudDensityAtEpicenter: 0.85,
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
      this.triggerRupture(this.nodes[nodeIndex], 1.5, onEarthquakeTriggered);
    }
  }

  dischargeAllStress() {
    this.nodes.forEach((n) => {
      n.accumulatedStress = 0.1;
    });
  }
}
