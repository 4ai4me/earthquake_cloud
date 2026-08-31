import { AtmosphericCloudConfig, EarthDipoleConfig, ExternalMagneticSource, SolarWindConfig } from '../types';
import { computeTotalMagneticField, computeFieldGradient, computeWaveCloudDensity } from './magneticEngine';

export interface CloudParticle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number; // Orientation of droplet/aerosol dipole
  targetAngle: number;
  charge: number; // -1 to +1
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
    const r = 0.85 + Math.random() * 3.5; // atmosphere & magnetosphere zone
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

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      p.life++;

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

        // Polarized alignment torque: tau = -k * sin(2*(angle - fieldAngle))
        const angleDiff = p.targetAngle - p.angle;
        const normalizedDiff = Math.atan2(Math.sin(angleDiff), Math.cos(angleDiff));

        // Alignment relaxation (boosted inside hotspot mask)
        const suscep = config.polarizationSusceptibility * (1 + (waveData.mask || 0) * 0.8);
        p.angle += normalizedDiff * suscep * 0.15;

        // Nematic order parameter component: cos^2(delta theta)
        const cosDelta = Math.cos(p.angle - fieldAngle);
        p.alignment = cosDelta * cosDelta; // 0 to 1
        totalAlignmentScore += 2 * p.alignment - 1;

        // Flow along field line (drift velocity)
        const driftSpeed = 0.08 * (1.0 / (1.0 + bMag * 0.2));
        const dirX = field.bx / bMag;
        const dirY = field.by / bMag;

        // Lorentz / drift force
        const forceX = dirX * driftSpeed * p.charge;
        const forceY = dirY * driftSpeed * p.charge;

        p.vx = p.vx * (1 - config.viscosity) + forceX * config.viscosity;
        p.vy = p.vy * (1 - config.viscosity) + forceY * config.viscosity;

        // Apply meteorological wind advection drift (NOAA GFS / ECMWF / DWD wind vector u, v)
        if (config.weatherData) {
          const windVx = (config.weatherData.windU || 0) * 0.0003;
          const windVy = (config.weatherData.windV || 0) * 0.0003;
          p.vx += windVx;
          p.vy += windVy;
        }

        // Wave cloud orthogonal grouping (pushing towards wave crests)
        if (config.showWaveClouds && waveData.mask > 0.1) {
          const waveForce = Math.sin(waveData.wavePhase) * 0.008 * waveData.mask;
          const nPerpX = -dirY;
          const nPerpY = dirX;
          p.vx += nPerpX * waveForce;
          p.vy += nPerpY * waveForce;
        }

        // Gradient drift (cloud condensation towards high/low gradient boundaries)
        const grad = computeFieldGradient(p.x, p.y, earthConfig, sources, solarWind);
        if (grad.gradMag > 0.01) {
          p.vx += (grad.gradX / grad.gradMag) * 0.005 * config.polarizationSusceptibility;
          p.vy += (grad.gradY / grad.gradMag) * 0.005 * config.polarizationSusceptibility;
        }

        // Condensation factor (high when aligned and field intensity is prominent, boosted by wave cloud)
        const baseCond = Math.min(1.0, p.alignment * (bMag / (bMag + config.condensationThreshold)));
        p.condensationFactor = Math.min(1.0, baseCond + (config.showWaveClouds ? waveData.density * 0.6 : 0));
      } else {
        p.vx *= 0.95;
        p.vy *= 0.95;
      }

      // Update position
      p.x += p.vx;
      p.y += p.vy;

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
