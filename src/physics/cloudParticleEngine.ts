import { AtmosphericCloudConfig, EarthDipoleConfig, ExternalMagneticSource, SolarWindConfig } from '../types';
import { computeTotalMagneticField, computeFieldGradient, computeWaveCloudDensity } from './magneticEngine';
import { computeAerosolCloudBaselineMultiplier } from './cernCloudAerosolEngine';

export interface CloudParticle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number; // Orientation of droplet/aerosol dipole
  targetAngle: number;
  charge: number; // -1 to +1
  susceptibilitySign: -1 | 1; // diamagnetic (-) or paramagnetic/mineral-bearing (+) proxy
  size: number;
  opacity: number;
  life: number;
  maxLife: number;
  alignment: number; // 0 to 1
  condensationFactor: number; // 0 to 1
  waveCloudDensity?: number; // C(x, y)
  hotspotMask?: number; // M(x, y)
}

export class CloudParticleSystem {
  particles: CloudParticle[] = [];
  nextId: number = 0;
  globalAlignmentOrder: number = 0;
  globalHotspotCount: number = 0;
  peakInterference: number = 0;

  constructor(count: number = 600) {
    this.init(count);
  }

  init(count: number) {
    this.particles = [];
    for (let i = 0; i < count; i++) {
      this.particles.push(this.createRandomParticle(true));
    }
  }

  createRandomParticle(initial: boolean = false): CloudParticle {
    // Spawn in atmosphere zone around Earth or upstream
    const angle = Math.random() * Math.PI * 2;
    const r = 0.85 + Math.random() * 3.5; // schematic display shell; not a true atmospheric altitude scale
    const x = Math.cos(angle) * r;
    const y = Math.sin(angle) * r;

    return {
      id: this.nextId++,
      x,
      y,
      vx: (Math.random() - 0.5) * 0.01,
      vy: (Math.random() - 0.5) * 0.01,
      angle: Math.random() * Math.PI * 2,
      targetAngle: 0,
      charge: Math.random() > 0.5 ? 1 : -1,
      susceptibilitySign: Math.random() < 0.85 ? -1 : 1,
      size: 1.5 + Math.random() * 2.5,
      opacity: initial ? 0.3 + Math.random() * 0.5 : 0.05,
      life: initial ? Math.floor(Math.random() * 300) : 0,
      maxLife: 200 + Math.floor(Math.random() * 300),
      alignment: 0,
      condensationFactor: 0,
      waveCloudDensity: 0,
      hotspotMask: 0,
    };
  }

  update(
    config: AtmosphericCloudConfig,
    earthConfig: EarthDipoleConfig,
    sources: ExternalMagneticSource[],
    solarWind: SolarWindConfig,
    dt: number = 0.016,
    timePhase: number = 0
  ) {
    if (!config.enabled) return;

    // Adjust particle count dynamically
    if (this.particles.length < config.particleCount) {
      const diff = config.particleCount - this.particles.length;
      for (let i = 0; i < Math.min(diff, 20); i++) {
        this.particles.push(this.createRandomParticle());
      }
    } else if (this.particles.length > config.particleCount) {
      this.particles.splice(config.particleCount);
    }

    let totalAlignmentScore = 0;
    let hotspotCount = 0;
    let maxI = 0;
    const bounds = { minX: -5.5, maxX: 5.5, minY: -3.5, maxY: 3.5 };
    const aerosolBaselineMultiplier = computeAerosolCloudBaselineMultiplier(config.aerosolExperiment);

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      const stableDt = Math.max(0, Math.min(0.05, dt));
      p.life += stableDt * 60;

      // Fade in and out
      if (p.life < 30) {
        p.opacity = (p.life / 30) * config.cloudOpacity;
      } else if (p.life > p.maxLife - 40) {
        p.opacity = ((p.maxLife - p.life) / 40) * config.cloudOpacity;
      } else {
        p.opacity = config.cloudOpacity;
      }

      // Check lifecycle respawn
      if (p.life >= p.maxLife || p.x < bounds.minX || p.x > bounds.maxX || p.y < bounds.minY || p.y > bounds.maxY) {
        this.particles[i] = this.createRandomParticle();
        continue;
      }

      // Compute local magnetic field
      const field = computeTotalMagneticField(p.x, p.y, earthConfig, sources, solarWind);
      const bMag = field.magnitude;

      // Compute wave cloud pattern data
      const waveData = computeWaveCloudDensity(p.x, p.y, earthConfig, sources, solarWind, config, timePhase);
      p.waveCloudDensity = waveData.density;
      p.hotspotMask = waveData.mask;

      if (waveData.intensity > maxI) maxI = waveData.intensity;
      if (waveData.mask > 0.3) hotspotCount++;

      if (bMag > 1e-4) {
        // Field angle
        const fieldAngle = Math.atan2(field.by, field.bx);
        p.targetAngle = fieldAngle;

        // Hypothesis orientation response. Ordinary spherical water droplets do
        // not acquire this strong torque at geomagnetic field strengths.
        const angleDiff = p.targetAngle - p.angle;
        const normalizedDiff = Math.atan2(Math.sin(angleDiff), Math.cos(angleDiff));
        const hypothesisCoupling = config.hypothesisEnabled === false ? 0 : Math.max(0, Math.min(1, config.hypothesisCoupling ?? 0.6));
        const suscep = config.polarizationSusceptibility * hypothesisCoupling * (1 + (waveData.mask || 0) * 0.5);
        const orientationRelaxation = 1 - Math.exp(-Math.max(0, suscep) * stableDt);
        p.angle += normalizedDiff * orientationRelaxation;

        // Nematic order parameter component: cos^2(delta theta)
        const cosDelta = Math.cos(p.angle - fieldAngle);
        p.alignment = cosDelta * cosDelta; // 0 to 1
        totalAlignmentScore += 2 * p.alignment - 1;

        const dirX = field.bx / bMag;
        const dirY = field.by / bMag;
        const nPerpX = -dirY;
        const nPerpY = dirX;

        // Overdamped Stokes response: the carrier-air velocity is the baseline.
        // 300 simulated seconds per display second keeps meteorological motion visible.
        const windScale = 300 / 100_000;
        const windVx = (config.weatherData?.windU ?? 0) * windScale;
        const windVy = (config.weatherData?.windV ?? 0) * windScale;

        // Weak magnetophoretic proxy follows sign(Delta chi)*grad(B^2), never B itself.
        const grad = computeFieldGradient(p.x, p.y, earthConfig, sources, solarWind);
        const gradientDirectionX = grad.gradMag > 1e-9 ? grad.gradX / grad.gradMag : 0;
        const gradientDirectionY = grad.gradMag > 1e-9 ? grad.gradY / grad.gradMag : 0;
        const magneticGradientScore = Math.tanh(2 * bMag * grad.gradMag);
        const magnetophoreticSpeed = p.susceptibilitySign * magneticGradientScore * 0.00005;

        // Explicit hypothesis drift toward/away from proposed wave crests. This
        // replaces the incorrect in-plane "Lorentz force along B" implementation.
        const chargedFraction = Math.max(0, Math.min(1, config.chargeRatio));
        const hypothesisSpeed = config.showWaveClouds
          ? hypothesisCoupling * chargedFraction * Math.sin(waveData.wavePhase) * waveData.mask * 0.025
          : 0;
        const targetVx = windVx + gradientDirectionX * magnetophoreticSpeed + nPerpX * hypothesisSpeed;
        const targetVy = windVy + gradientDirectionY * magnetophoreticSpeed + nPerpY * hypothesisSpeed;
        const dragTime = Math.max(0.05, 1.5 - Math.min(1, config.viscosity) * 1.4);
        const dragRelaxation = 1 - Math.exp(-stableDt / dragTime);
        p.vx += (targetVx - p.vx) * dragRelaxation;
        p.vy += (targetVy - p.vy) * dragRelaxation;

        // Turbulent diffusion is represented by a 2-D Langevin increment.
        const diffusivity = Math.max(0, config.turbulentDiffusivity ?? 0.00002);
        const noiseScale = Math.sqrt(2 * diffusivity * stableDt);
        const randomAngle = Math.random() * Math.PI * 2;
        p.x += Math.cos(randomAngle) * noiseScale;
        p.y += Math.sin(randomAngle) * noiseScale;

        // Meteorology controls the baseline condensation proxy. The hypothesis
        // contributes only a bounded delta that is zero in control mode.
        const humidity = Math.max(0, Math.min(1, (config.weatherData?.relativeHumidity ?? 60) / 100));
        const cloudCover = Math.max(0, Math.min(1, (config.weatherData?.cloudCoverPercent ?? 50) / 100));
        const humidityActivation = 1 / (1 + Math.exp(-16 * (humidity - 0.75)));
        const meteorologicalCondensation = (0.65 * humidityActivation + 0.35 * cloudCover) * aerosolBaselineMultiplier;
        const hypothesisDelta = hypothesisCoupling * chargedFraction * waveData.density * 0.35;
        p.condensationFactor = Math.max(0, Math.min(1, meteorologicalCondensation + hypothesisDelta));
      } else {
        p.vx *= 0.95;
        p.vy *= 0.95;
      }

      // Update position
      p.x += p.vx * stableDt;
      p.y += p.vy * stableDt;

      // Prevent sinking deep inside Earth core
      const distToEarth = Math.hypot(p.x - earthConfig.x, p.y - earthConfig.y);
      if (distToEarth < earthConfig.radius * 0.9) {
        // Push outward to troposphere
        const pushAngle = Math.atan2(p.y - earthConfig.y, p.x - earthConfig.x);
        p.x = earthConfig.x + Math.cos(pushAngle) * earthConfig.radius * 0.95;
        p.y = earthConfig.y + Math.sin(pushAngle) * earthConfig.radius * 0.95;
        p.vx *= -0.5;
        p.vy *= -0.5;
      }
    }

    // Global nematic order parameter (-1 to +1)
    this.globalAlignmentOrder = this.particles.length > 0 ? totalAlignmentScore / this.particles.length : 0;
    this.globalHotspotCount = hotspotCount;
    this.peakInterference = maxI;
  }
}
