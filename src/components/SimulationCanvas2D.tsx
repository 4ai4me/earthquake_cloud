import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  AtmosphericCloudConfig,
  CrustalNode,
  EarthDipoleConfig,
  EarthquakeEvent,
  ExternalMagneticSource,
  HeatmapMetric,
  RenderMode,
  SolarWindConfig,
} from '../types';
import {
  computeTotalMagneticField,
  computeFieldGradient,
  findNeutralPoints,
  traceStreamlineRK4,
  computeInterferenceIntensity,
  computeHotspotMask,
  computeWaveCloudDensity,
} from '../physics/magneticEngine';
import { CloudParticleSystem } from '../physics/cloudParticleEngine';
import { CrustalStressManager, SeismicWave } from '../physics/crustalStressEngine';
import {
  Eye,
  Layers,
  Maximize2,
  Minimize2,
  Move,
  Play,
  Pause,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Camera,
  Activity,
  CloudSun,
  Flame,
  Info,
  Waves,
} from 'lucide-react';

interface SimulationCanvas2DProps {
  earthConfig: EarthDipoleConfig;
  setEarthConfig: React.Dispatch<React.SetStateAction<EarthDipoleConfig>>;
  sources: ExternalMagneticSource[];
  setSources: React.Dispatch<React.SetStateAction<ExternalMagneticSource[]>>;
  solarWind: SolarWindConfig;
  setSolarWind: React.Dispatch<React.SetStateAction<SolarWindConfig>>;
  cloudConfig: AtmosphericCloudConfig;
  setCloudConfig: React.Dispatch<React.SetStateAction<AtmosphericCloudConfig>>;
  stressManager: CrustalStressManager;
  particleSystem: CloudParticleSystem;
  onEarthquakeTriggered?: (event: EarthquakeEvent) => void;
  renderMode: RenderMode;
  setRenderMode: (mode: RenderMode) => void;
  heatmapMetric: HeatmapMetric;
  setHeatmapMetric: (metric: HeatmapMetric) => void;
  showNeutralPoints: boolean;
  setShowNeutralPoints: (show: boolean) => void;
  streamlineDensity: number;
}

export const SimulationCanvas2D: React.FC<SimulationCanvas2DProps> = ({
  earthConfig,
  setEarthConfig,
  sources,
  setSources,
  solarWind,
  cloudConfig,
  stressManager,
  particleSystem,
  onEarthquakeTriggered,
  renderMode,
  setRenderMode,
  heatmapMetric,
  setHeatmapMetric,
  showNeutralPoints,
  setShowNeutralPoints,
  streamlineDensity,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Viewport transformation
  const [zoom, setZoom] = useState<number>(75); // pixels per world unit
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Dragging entities
  const [draggedSourceId, setDraggedSourceId] = useState<string | null>(null);
  const [isDraggingEarth, setIsDraggingEarth] = useState<boolean>(false);

  // Hover inspect state
  const [hoverInfo, setHoverInfo] = useState<{
    x: number;
    y: number;
    worldX: number;
    worldY: number;
    bx: number;
    by: number;
    bMag: number;
    gradMag: number;
    stressVal: number;
    interference: number;
    hotspotMask: number;
    waveCloudDensity: number;
  } | null>(null);

  // Animation loop controls
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [animationPhase, setAnimationPhase] = useState<number>(0);
  const [fps, setFps] = useState<number>(60);
  const fpsCounterRef = useRef<{ frames: number; lastTime: number }>({ frames: 0, lastTime: performance.now() });

  // Convert World coordinates to Canvas pixels
  const worldToCanvas = useCallback(
    (wx: number, wy: number, width: number, height: number) => {
      const cx = width / 2 + pan.x + wx * zoom;
      const cy = height / 2 + pan.y - wy * zoom; // Invert Y for physics coordinate
      return { cx, cy };
    },
    [pan, zoom]
  );

  // Convert Canvas pixels to World coordinates
  const canvasToWorld = useCallback(
    (cx: number, cy: number, width: number, height: number) => {
      const wx = (cx - width / 2 - pan.x) / zoom;
      const wy = -(cy - height / 2 - pan.y) / zoom;
      return { wx, wy };
    },
    [pan, zoom]
  );

  // Heatmap Colormap Evaluator (Turbo / Plasma / Electric Cyan-Magenta)
  const getColormapColor = useCallback((val: number, alpha: number = 0.6) => {
    // Clamped 0 to 1
    const t = Math.max(0, Math.min(1, val));
    let r = 0,
      g = 0,
      b = 0;

    if (t < 0.25) {
      const f = t / 0.25;
      r = Math.floor(10 + 15 * f);
      g = Math.floor(25 + 120 * f);
      b = Math.floor(100 + 155 * f);
    } else if (t < 0.5) {
      const f = (t - 0.25) / 0.25;
      r = Math.floor(25 + 30 * f);
      g = Math.floor(145 + 100 * f);
      b = Math.floor(255 - 100 * f);
    } else if (t < 0.75) {
      const f = (t - 0.5) / 0.25;
      r = Math.floor(55 + 200 * f);
      g = Math.floor(245 - 60 * f);
      b = Math.floor(155 - 130 * f);
    } else {
      const f = (t - 0.75) / 0.25;
      r = Math.floor(255);
      g = Math.floor(185 - 150 * f);
      b = Math.floor(25 + 60 * f);
    }

    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }, []);

  // Main Render Routine
  useEffect(() => {
    let animationFrameId: number;
    let lastTimestamp = performance.now();

    const render = (now: number) => {
      const dt = Math.min((now - lastTimestamp) / 1000, 0.05);
      lastTimestamp = now;

      // Update FPS counter
      fpsCounterRef.current.frames++;
      if (now - fpsCounterRef.current.lastTime >= 1000) {
        setFps(fpsCounterRef.current.frames);
        fpsCounterRef.current.frames = 0;
        fpsCounterRef.current.lastTime = now;
      }

      if (isPlaying) {
        setAnimationPhase((prev) => (prev + dt * 1.5) % 1000);

        // Update external orbiting sources
        setSources((prev) =>
          prev.map((s) => {
            if (s.active && s.orbiting && s.orbitRadius && s.orbitSpeed) {
              const currentPhase = (s.orbitPhase || 0) + s.orbitSpeed * dt;
              return {
                ...s,
                orbitPhase: currentPhase,
                x: earthConfig.x + Math.cos(currentPhase) * s.orbitRadius,
                y: earthConfig.y + Math.sin(currentPhase) * s.orbitRadius,
              };
            }
            return s;
          })
        );

        // Update atmospheric cloud particles
        particleSystem.update(cloudConfig, earthConfig, sources, solarWind, dt, animationPhase);

        // Update crustal stress and check seismic ruptures
        stressManager.update(earthConfig, sources, solarWind, dt, onEarthquakeTriggered);
      }

      const canvas = canvasRef.current;
      if (!canvas) {
        animationFrameId = requestAnimationFrame(render);
        return;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        animationFrameId = requestAnimationFrame(render);
        return;
      }

      const width = canvas.width;
      const height = canvas.height;

      // Clear Canvas Background (Deep Cosmic Slate)
      ctx.fillStyle = '#030712'; // Tailwind gray-950
      ctx.fillRect(0, 0, width, height);

      // 1. Draw Background Grid & Coordinates
      ctx.strokeStyle = 'rgba(30, 41, 59, 0.5)';
      ctx.lineWidth = 1;
      const origin = worldToCanvas(0, 0, width, height);

      // Grid lines
      const minWorld = canvasToWorld(0, height, width, height);
      const maxWorld = canvasToWorld(width, 0, width, height);

      for (let x = Math.floor(minWorld.wx); x <= Math.ceil(maxWorld.wx); x++) {
        const p1 = worldToCanvas(x, minWorld.wy, width, height);
        const p2 = worldToCanvas(x, maxWorld.wy, width, height);
        ctx.beginPath();
        ctx.moveTo(p1.cx, p1.cy);
        ctx.lineTo(p2.cx, p2.cy);
        ctx.stroke();
      }
      for (let y = Math.floor(minWorld.wy); y <= Math.ceil(maxWorld.wy); y++) {
        const p1 = worldToCanvas(minWorld.wx, y, width, height);
        const p2 = worldToCanvas(maxWorld.wx, y, width, height);
        ctx.beginPath();
        ctx.moveTo(p1.cx, p1.cy);
        ctx.lineTo(p2.cx, p2.cy);
        ctx.stroke();
      }

      // Origin axes
      ctx.strokeStyle = 'rgba(71, 85, 105, 0.6)';
      ctx.beginPath();
      ctx.moveTo(0, origin.cy);
      ctx.lineTo(width, origin.cy);
      ctx.moveTo(origin.cx, 0);
      ctx.lineTo(origin.cx, height);
      ctx.stroke();

      // 2. Render Heatmap (if active)
      if (renderMode === 'heatmap' || renderMode === 'composite') {
        const cellSize = 16;
        const cols = Math.ceil(width / cellSize);
        const rows = Math.ceil(height / cellSize);

        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const pixelX = c * cellSize + cellSize / 2;
            const pixelY = r * cellSize + cellSize / 2;
            const worldPos = canvasToWorld(pixelX, pixelY, width, height);

            let metricVal = 0;
            if (heatmapMetric === 'magnitude') {
              const field = computeTotalMagneticField(worldPos.wx, worldPos.wy, earthConfig, sources, solarWind);
              metricVal = Math.min(1.0, field.magnitude / 3.5);
            } else if (heatmapMetric === 'magnetic_pressure') {
              const field = computeTotalMagneticField(worldPos.wx, worldPos.wy, earthConfig, sources, solarWind);
              // B^2 / 2
              const pMag = (field.magnitude * field.magnitude) * 0.5;
              metricVal = Math.min(1.0, pMag / 4.0);
            } else if (heatmapMetric === 'gradient') {
              const grad = computeFieldGradient(worldPos.wx, worldPos.wy, earthConfig, sources, solarWind);
              metricVal = Math.min(1.0, grad.gradMag / 2.5);
            } else if (heatmapMetric === 'interference') {
              const interf = computeInterferenceIntensity(
                worldPos.wx,
                worldPos.wy,
                earthConfig,
                sources,
                solarWind,
                cloudConfig.gradientWeight ?? 0.5
              );
              metricVal = Math.min(1.0, interf.intensity / 2.2);
            } else if (heatmapMetric === 'wave_cloud') {
              const waveData = computeWaveCloudDensity(
                worldPos.wx,
                worldPos.wy,
                earthConfig,
                sources,
                solarWind,
                cloudConfig,
                animationPhase
              );
              metricVal = waveData.density;
            }

            ctx.fillStyle = getColormapColor(metricVal, renderMode === 'composite' ? 0.25 : 0.65);
            ctx.fillRect(c * cellSize, r * cellSize, cellSize, cellSize);
          }
        }
      }

      // 3. Render Solar Wind Flow (Upstream Sunward Particles)
      if (solarWind.enabled) {
        ctx.save();
        const swCount = 24;
        for (let i = 0; i < swCount; i++) {
          const swY = minWorld.wy + ((maxWorld.wy - minWorld.wy) * i) / swCount;
          const offset = ((animationPhase * 2.5 + i * 1.7) % 5) - 6;
          const p = worldToCanvas(offset, swY, width, height);

          // Solar wind ion arrow
          ctx.fillStyle = 'rgba(251, 191, 36, 0.6)';
          ctx.beginPath();
          ctx.arc(p.cx, p.cy, 2.5, 0, Math.PI * 2);
          ctx.fill();

          ctx.strokeStyle = 'rgba(251, 191, 36, 0.3)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(p.cx - 15, p.cy);
          ctx.lineTo(p.cx, p.cy);
          ctx.stroke();
        }
        ctx.restore();
      }

      // 4. Render Magnetic Streamlines (RK4)
      if (renderMode === 'streamlines' || renderMode === 'composite') {
        const seedAngles = streamlineDensity || 24;
        const startDistances = [earthConfig.radius * 1.05, earthConfig.radius * 1.4, earthConfig.radius * 2.2];

        ctx.save();
        for (const dist of startDistances) {
          for (let i = 0; i < seedAngles; i++) {
            const angle = (i / seedAngles) * Math.PI * 2 + (earthConfig.tiltAngle * Math.PI) / 180;
            const sx = earthConfig.x + Math.cos(angle) * dist;
            const sy = earthConfig.y + Math.sin(angle) * dist;

            // Trace forward and backward
            const lineForward = traceStreamlineRK4(sx, sy, earthConfig, sources, solarWind, 1, 140, 0.06);
            const lineBackward = traceStreamlineRK4(sx, sy, earthConfig, sources, solarWind, -1, 140, 0.06);
            const fullLine = [...lineBackward.reverse(), ...lineForward];

            if (fullLine.length > 2) {
              ctx.beginPath();
              const first = worldToCanvas(fullLine[0].x, fullLine[0].y, width, height);
              ctx.moveTo(first.cx, first.cy);

              for (let j = 1; j < fullLine.length; j++) {
                const pt = worldToCanvas(fullLine[j].x, fullLine[j].y, width, height);
                ctx.lineTo(pt.cx, pt.cy);
              }

              // Color based on average field strength & streamline glow
              const avgB = fullLine[Math.floor(fullLine.length / 2)]?.bMag || 1.0;
              const intensityFactor = Math.min(1.0, avgB / 2.5);
              ctx.strokeStyle = `rgba(${Math.floor(60 + 195 * intensityFactor)}, ${Math.floor(180 + 75 * (1 - intensityFactor))}, 255, ${0.45 + 0.35 * intensityFactor})`;
              ctx.lineWidth = 1.4;
              ctx.stroke();

              // Animated streamline particle flow pulses
              const pulseIdx = Math.floor((animationPhase * 40 + i * 12) % fullLine.length);
              const pulsePt = fullLine[pulseIdx];
              if (pulsePt) {
                const pulseCanvas = worldToCanvas(pulsePt.x, pulsePt.y, width, height);
                ctx.fillStyle = '#67e8f9';
                ctx.shadowColor = '#06b6d4';
                ctx.shadowBlur = 6;
                ctx.beginPath();
                ctx.arc(pulseCanvas.cx, pulseCanvas.cy, 2.5, 0, Math.PI * 2);
                ctx.fill();
                ctx.shadowBlur = 0;
              }
            }
          }
        }

        // Additional streamlines originating from external magnetic sources
        for (const s of sources) {
          if (!s.active) continue;
          const extSeeds = 12;
          for (let k = 0; k < extSeeds; k++) {
            const extAngle = (k / extSeeds) * Math.PI * 2;
            const esx = s.x + Math.cos(extAngle) * 0.25;
            const esy = s.y + Math.sin(extAngle) * 0.25;
            const extLine = traceStreamlineRK4(esx, esy, earthConfig, sources, solarWind, s.type === 'monopole_s' ? -1 : 1, 100, 0.06);

            if (extLine.length > 2) {
              ctx.beginPath();
              const first = worldToCanvas(extLine[0].x, extLine[0].y, width, height);
              ctx.moveTo(first.cx, first.cy);
              for (let j = 1; j < extLine.length; j++) {
                const pt = worldToCanvas(extLine[j].x, extLine[j].y, width, height);
                ctx.lineTo(pt.cx, pt.cy);
              }
              ctx.strokeStyle = s.type === 'monopole_n' ? 'rgba(239, 68, 68, 0.45)' : 'rgba(59, 130, 246, 0.45)';
              ctx.lineWidth = 1.2;
              ctx.stroke();
            }
          }
        }
        ctx.restore();
      }

      // 5. Render Quiver Vector Needles (if in quiver mode)
      if (renderMode === 'quiver') {
        ctx.save();
        const step = 0.5;
        for (let qx = Math.floor(minWorld.wx); qx <= Math.ceil(maxWorld.wx); qx += step) {
          for (let qy = Math.floor(minWorld.wy); qy <= Math.ceil(maxWorld.wy); qy += step) {
            const field = computeTotalMagneticField(qx, qy, earthConfig, sources, solarWind);
            if (field.magnitude < 1e-4) continue;

            const p = worldToCanvas(qx, qy, width, height);
            const len = Math.min(18, field.magnitude * 6 + 4);
            const angle = Math.atan2(-field.by, field.bx); // Invert Y for canvas

            ctx.strokeStyle = getColormapColor(Math.min(1.0, field.magnitude / 3.0), 0.8);
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(p.cx, p.cy);
            const tipX = p.cx + Math.cos(angle) * len;
            const tipY = p.cy + Math.sin(angle) * len;
            ctx.lineTo(tipX, tipY);
            ctx.stroke();

            // Arrow head
            ctx.fillStyle = ctx.strokeStyle;
            ctx.beginPath();
            ctx.arc(tipX, tipY, 1.8, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        ctx.restore();
      }

      // 6. Render Atmospheric Cloud Particles & Coherent Bands ("가상 지진운" & "양떼구름 파동")
      if (cloudConfig.enabled) {
        ctx.save();

        // A. Draw Wave Cloud (양떼구름) Hotspot Ripples & Altocumulus Wave Billows
        if (cloudConfig.showWaveClouds) {
          // Render periodic wave billow bands perpendicular to local B-field
          const stepSize = 0.45;
          const kPerpFactor = (2 * Math.PI) / (cloudConfig.waveWavelength || 0.8);
          
          for (let wx = -4.5; wx <= 4.5; wx += stepSize) {
            for (let wy = -3.0; wy <= 3.0; wy += stepSize) {
              const interf = computeInterferenceIntensity(
                wx,
                wy,
                earthConfig,
                sources,
                solarWind,
                cloudConfig.gradientWeight ?? 0.5
              );
              const mask = computeHotspotMask(
                interf.intensity,
                cloudConfig.interferenceThreshold ?? 0.85,
                cloudConfig.sigmoidSteepness ?? 6.0
              );

              if (mask > 0.08) {
                const centerCanvas = worldToCanvas(wx, wy, width, height);
                const field = computeTotalMagneticField(wx, wy, earthConfig, sources, solarWind);
                
                if (field.magnitude > 0.02) {
                  // Unit vector perp to field line
                  const bxNorm = field.bx / field.magnitude;
                  const byNorm = field.by / field.magnitude;
                  const nPerpX = -byNorm;
                  const nPerpY = bxNorm;

                  // Wave spatial phase
                  const kDotR = (nPerpX * wx + nPerpY * wy) * kPerpFactor;
                  const waveMod = (1 + Math.cos(kDotR - animationPhase * 0.8)) * 0.5;
                  const density = mask * waveMod;

                  if (density > 0.15) {
                    // Draw altocumulus sheep puff (양떼구름 조각)
                    const puffRadius = (8 + density * 12) * (zoom / 75);
                    const puffAlpha = density * cloudConfig.cloudOpacity * 0.65;
                    
                    const grad = ctx.createRadialGradient(
                      centerCanvas.cx,
                      centerCanvas.cy,
                      0,
                      centerCanvas.cx,
                      centerCanvas.cy,
                      puffRadius
                    );
                    grad.addColorStop(0, `rgba(224, 242, 254, ${puffAlpha})`);
                    grad.addColorStop(0.5, `rgba(186, 230, 253, ${puffAlpha * 0.5})`);
                    grad.addColorStop(1, 'rgba(186, 230, 253, 0)');

                    ctx.fillStyle = grad;
                    ctx.beginPath();
                    ctx.arc(centerCanvas.cx, centerCanvas.cy, puffRadius, 0, Math.PI * 2);
                    ctx.fill();

                    // Wave ridge contour line
                    if (density > 0.45) {
                      const ridgeLen = 10 * (zoom / 75);
                      const anglePerp = Math.atan2(-nPerpY, nPerpX); // inverted Y for canvas
                      ctx.strokeStyle = `rgba(255, 255, 255, ${density * 0.4})`;
                      ctx.lineWidth = 1.5;
                      ctx.beginPath();
                      ctx.moveTo(
                        centerCanvas.cx - Math.cos(anglePerp) * ridgeLen,
                        centerCanvas.cy - Math.sin(anglePerp) * ridgeLen
                      );
                      ctx.lineTo(
                        centerCanvas.cx + Math.cos(anglePerp) * ridgeLen,
                        centerCanvas.cy + Math.sin(anglePerp) * ridgeLen
                      );
                      ctx.stroke();
                    }
                  }
                }
              }
            }
          }
        }

        // B. Draw Coherent Cloud Band Ridges (Connecting highly aligned nearby particles)
        if (cloudConfig.showCloudBands) {
          ctx.strokeStyle = 'rgba(224, 242, 254, 0.18)'; // Pale cyan vapor
          ctx.lineWidth = 4.0;
          ctx.lineCap = 'round';

          const alignedParticles = particleSystem.particles.filter((p) => p.condensationFactor > 0.4);
          for (let i = 0; i < alignedParticles.length; i += 3) {
            const p1 = alignedParticles[i];
            const p1Canvas = worldToCanvas(p1.x, p1.y, width, height);

            // Find close aligned neighbor along orientation axis
            for (let j = i + 1; j < Math.min(i + 10, alignedParticles.length); j++) {
              const p2 = alignedParticles[j];
              const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y);

              if (dist < 0.85 && Math.abs(p1.angle - p2.angle) < 0.4) {
                const p2Canvas = worldToCanvas(p2.x, p2.y, width, height);
                ctx.beginPath();
                ctx.moveTo(p1Canvas.cx, p1Canvas.cy);
                ctx.lineTo(p2Canvas.cx, p2Canvas.cy);
                ctx.stroke();
              }
            }
          }
        }

        // C. Draw Individual Aerosol / Cloud Droplet Particles
        if (cloudConfig.showParticles) {
          for (const p of particleSystem.particles) {
            const pCanvas = worldToCanvas(p.x, p.y, width, height);
            const radius = p.size * (1 + p.condensationFactor * 0.8);

            // Glow around aligned polarized droplets (boosted in wave cloud hotspots)
            const isWaveHotspot = (p.waveCloudDensity || 0) > 0.35;
            if (p.condensationFactor > 0.5 || isWaveHotspot) {
              ctx.fillStyle = isWaveHotspot
                ? `rgba(147, 197, 253, ${p.opacity * 0.6})`
                : `rgba(186, 230, 253, ${p.opacity * 0.4})`;
              ctx.beginPath();
              ctx.arc(pCanvas.cx, pCanvas.cy, radius * (isWaveHotspot ? 3.0 : 2.5), 0, Math.PI * 2);
              ctx.fill();
            }

            // Core droplet
            ctx.fillStyle = p.charge > 0
              ? `rgba(224, 242, 254, ${p.opacity})` // Ionized vapor
              : `rgba(254, 240, 138, ${p.opacity * 0.8})`; // Charged aerosol

            ctx.beginPath();
            ctx.arc(pCanvas.cx, pCanvas.cy, radius, 0, Math.PI * 2);
            ctx.fill();

            // Needle indicating droplet polarization alignment axis
            if (p.alignment > 0.6) {
              const needleLen = 5 + p.alignment * 6;
              const angle = -p.angle; // Canvas Y invert
              ctx.strokeStyle = `rgba(255, 255, 255, ${p.opacity * 0.7})`;
              ctx.lineWidth = 1.0;
              ctx.beginPath();
              ctx.moveTo(pCanvas.cx - Math.cos(angle) * needleLen, pCanvas.cy - Math.sin(angle) * needleLen);
              ctx.lineTo(pCanvas.cx + Math.cos(angle) * needleLen, pCanvas.cy + Math.sin(angle) * needleLen);
              ctx.stroke();
            }
          }
        }
        ctx.restore();
      }

      // 7. Render Seismic Rupture Shockwaves (P-waves & S-waves)
      ctx.save();
      for (const wave of stressManager.activeWaves) {
        const epic = worldToCanvas(wave.epicenterX, wave.epicenterY, width, height);
        const pixelRadius = wave.currentRadius * zoom;

        ctx.strokeStyle =
          wave.type === 'P_wave'
            ? `rgba(239, 68, 68, ${wave.opacity * 0.85})` // Crimson P-wave
            : `rgba(249, 115, 22, ${wave.opacity * 0.75})`; // Amber S-wave
        ctx.lineWidth = wave.type === 'P_wave' ? 3.0 : 2.0;

        ctx.beginPath();
        ctx.arc(epic.cx, epic.cy, pixelRadius, 0, Math.PI * 2);
        ctx.stroke();

        // Wavefront ripples
        ctx.strokeStyle = `rgba(254, 202, 202, ${wave.opacity * 0.4})`;
        ctx.lineWidth = 1.0;
        ctx.beginPath();
        ctx.arc(epic.cx, epic.cy, Math.max(0, pixelRadius - 10), 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();

      // 8. Render Earth Planetary Body, Atmosphere Halo & Crustal Fault Ring
      const earthCanvas = worldToCanvas(earthConfig.x, earthConfig.y, width, height);
      const earthPixelRadius = earthConfig.radius * zoom;

      ctx.save();
      // Outer Atmosphere Glow Halo
      const atmoGrad = ctx.createRadialGradient(
        earthCanvas.cx,
        earthCanvas.cy,
        earthPixelRadius * 0.9,
        earthCanvas.cx,
        earthCanvas.cy,
        earthPixelRadius * 1.5
      );
      atmoGrad.addColorStop(0, 'rgba(56, 189, 248, 0.4)');
      atmoGrad.addColorStop(0.6, 'rgba(14, 165, 233, 0.15)');
      atmoGrad.addColorStop(1, 'rgba(3, 105, 161, 0)');
      ctx.fillStyle = atmoGrad;
      ctx.beginPath();
      ctx.arc(earthCanvas.cx, earthCanvas.cy, earthPixelRadius * 1.5, 0, Math.PI * 2);
      ctx.fill();

      // Planet Sphere Fill
      const earthGrad = ctx.createRadialGradient(
        earthCanvas.cx - earthPixelRadius * 0.3,
        earthCanvas.cy - earthPixelRadius * 0.3,
        earthPixelRadius * 0.1,
        earthCanvas.cx,
        earthCanvas.cy,
        earthPixelRadius
      );
      earthGrad.addColorStop(0, '#1e293b'); // Lithosphere / Oceans
      earthGrad.addColorStop(0.7, '#0f172a');
      earthGrad.addColorStop(1, '#020617');
      ctx.fillStyle = earthGrad;
      ctx.beginPath();
      ctx.arc(earthCanvas.cx, earthCanvas.cy, earthPixelRadius, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2.0;
      ctx.stroke();

      // Dipole Axis Indicator
      const radTilt = (earthConfig.tiltAngle * Math.PI) / 180;
      const poleDist = earthPixelRadius * 0.85;

      // North Magnetic Pole (Positive / Red)
      const npX = earthCanvas.cx + Math.sin(radTilt) * poleDist;
      const npY = earthCanvas.cy - Math.cos(radTilt) * poleDist;
      // South Magnetic Pole (Negative / Blue)
      const spX = earthCanvas.cx - Math.sin(radTilt) * poleDist;
      const spY = earthCanvas.cy + Math.cos(radTilt) * poleDist;

      // Magnetic Axis Line
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.4)';
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(npX, npY);
      ctx.lineTo(spX, spY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Pole Markers
      ctx.fillStyle = earthConfig.reversed ? '#3b82f6' : '#ef4444';
      ctx.beginPath();
      ctx.arc(npX, npY, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(earthConfig.reversed ? 'S' : 'N', npX, npY);

      ctx.fillStyle = earthConfig.reversed ? '#ef4444' : '#3b82f6';
      ctx.beginPath();
      ctx.arc(spX, spY, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.fillText(earthConfig.reversed ? 'N' : 'S', spX, spY);

      // Planet Label
      ctx.fillStyle = '#94a3b8';
      ctx.font = '11px sans-serif';
      ctx.fillText('Earth Dipole', earthCanvas.cx, earthCanvas.cy);
      ctx.restore();

      // 9. Render Crustal Fault Nodes & Stress Accumulation Rings
      ctx.save();
      for (const node of stressManager.nodes) {
        const nodeCanvas = worldToCanvas(node.x, node.y, width, height);

        // Stress level color from green to fiery crimson
        const stressRatio = Math.min(1.0, node.accumulatedStress / stressManager.ruptureThreshold);
        let nodeColor = '#22c55e'; // Safe green
        if (stressRatio > 0.8) {
          nodeColor = '#ef4444'; // Critical red
        } else if (stressRatio > 0.5) {
          nodeColor = '#f59e0b'; // Elevated amber
        } else if (stressRatio > 0.3) {
          nodeColor = '#06b6d4'; // Low cyan
        }

        const nodeRadius = 3 + stressRatio * 5;

        // Pulsing glow for high stress fault
        if (stressRatio > 0.75) {
          ctx.fillStyle = `rgba(239, 68, 68, ${0.4 + 0.4 * Math.sin(animationPhase * 8)})`;
          ctx.beginPath();
          ctx.arc(nodeCanvas.cx, nodeCanvas.cy, nodeRadius * 2.2, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.fillStyle = nodeColor;
        ctx.beginPath();
        ctx.arc(nodeCanvas.cx, nodeCanvas.cy, nodeRadius, 0, Math.PI * 2);
        ctx.fill();

        // Node ID or Stress Indicator
        if (node.id === stressManager.maxStressNodeIndex) {
          ctx.strokeStyle = '#f87171';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      }
      ctx.restore();

      // 10. Render Neutral Points / X-Points (Magnetic Reconnection Sites)
      if (showNeutralPoints) {
        const neutrals = findNeutralPoints(earthConfig, sources, solarWind);
        ctx.save();
        for (const np of neutrals) {
          const npCanvas = worldToCanvas(np.x, np.y, width, height);
          const pulse = (Math.sin(animationPhase * 6) + 1) * 0.5;

          // X-Point Crosshair
          ctx.strokeStyle = `rgba(236, 72, 153, ${0.7 + pulse * 0.3})`; // Hot pink
          ctx.lineWidth = 2.0;

          ctx.beginPath();
          ctx.arc(npCanvas.cx, npCanvas.cy, 8 + pulse * 4, 0, Math.PI * 2);
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(npCanvas.cx - 6, npCanvas.cy - 6);
          ctx.lineTo(npCanvas.cx + 6, npCanvas.cy + 6);
          ctx.moveTo(npCanvas.cx + 6, npCanvas.cy - 6);
          ctx.lineTo(npCanvas.cx - 6, npCanvas.cy + 6);
          ctx.stroke();

          ctx.fillStyle = '#f472b6';
          ctx.font = '9px monospace';
          ctx.fillText('X-Point (Reconn)', npCanvas.cx, npCanvas.cy - 12);
        }
        ctx.restore();
      }

      // 11. Render External Magnetic Sources (Monopoles & Dipoles)
      ctx.save();
      for (const s of sources) {
        if (!s.active) continue;
        const sCanvas = worldToCanvas(s.x, s.y, width, height);

        // Orbit path ring if orbiting
        if (s.orbiting && s.orbitRadius) {
          ctx.strokeStyle = 'rgba(100, 116, 139, 0.25)';
          ctx.setLineDash([3, 3]);
          ctx.beginPath();
          ctx.arc(earthCanvas.cx, earthCanvas.cy, s.orbitRadius * zoom, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        // Handle Aura Glow
        const isHovered = draggedSourceId === s.id;
        ctx.fillStyle = isHovered
          ? 'rgba(255, 255, 255, 0.2)'
          : s.type === 'monopole_n'
          ? 'rgba(239, 68, 68, 0.25)'
          : s.type === 'monopole_s'
          ? 'rgba(59, 130, 246, 0.25)'
          : 'rgba(168, 85, 247, 0.25)';
        ctx.beginPath();
        ctx.arc(sCanvas.cx, sCanvas.cy, 18, 0, Math.PI * 2);
        ctx.fill();

        // Main Source Node
        ctx.fillStyle = s.type === 'monopole_n' ? '#ef4444' : s.type === 'monopole_s' ? '#3b82f6' : '#a855f7';
        ctx.beginPath();
        ctx.arc(sCanvas.cx, sCanvas.cy, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.0;
        ctx.stroke();

        // Label
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const labelText = s.type === 'monopole_n' ? 'N' : s.type === 'monopole_s' ? 'S' : 'M';
        ctx.fillText(labelText, sCanvas.cx, sCanvas.cy);

        ctx.fillStyle = '#cbd5e1';
        ctx.font = '10px sans-serif';
        ctx.fillText(`${s.name} (${s.strength}q)`, sCanvas.cx, sCanvas.cy + 18);
      }
      ctx.restore();

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animationFrameId);
  }, [
    isPlaying,
    earthConfig,
    sources,
    solarWind,
    cloudConfig,
    stressManager,
    particleSystem,
    renderMode,
    heatmapMetric,
    showNeutralPoints,
    streamlineDensity,
    worldToCanvas,
    canvasToWorld,
    getColormapColor,
    draggedSourceId,
    pan,
    zoom,
    animationPhase,
    onEarthquakeTriggered,
  ]);

  // Handle Canvas Resize
  useEffect(() => {
    const handleResize = () => {
      const container = containerRef.current;
      const canvas = canvasRef.current;
      if (container && canvas) {
        const rect = container.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;
      }
    };

    handleResize();
    const observer = new ResizeObserver(handleResize);
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Mouse Interaction Handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;
    const world = canvasToWorld(clientX, clientY, canvas.width, canvas.height);

    // Check if clicked an external source
    for (const s of sources) {
      if (!s.active) continue;
      const dist = Math.hypot(s.x - world.wx, s.y - world.wy);
      if (dist < 0.45) {
        setDraggedSourceId(s.id);
        return;
      }
    }

    // Check if clicked Earth
    const distEarth = Math.hypot(earthConfig.x - world.wx, earthConfig.y - world.wy);
    if (distEarth < earthConfig.radius * 1.1) {
      setIsDraggingEarth(true);
      return;
    }

    // Otherwise initiate panning
    setIsPanning(true);
    setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;
    const world = canvasToWorld(clientX, clientY, canvas.width, canvas.height);

    // Update hover HUD state
    const field = computeTotalMagneticField(world.wx, world.wy, earthConfig, sources, solarWind);
    const grad = computeFieldGradient(world.wx, world.wy, earthConfig, sources, solarWind);
    const interf = computeInterferenceIntensity(
      world.wx,
      world.wy,
      earthConfig,
      sources,
      solarWind,
      cloudConfig.gradientWeight ?? 0.5
    );
    const mask = computeHotspotMask(
      interf.intensity,
      cloudConfig.interferenceThreshold ?? 0.85,
      cloudConfig.sigmoidSteepness ?? 6.0
    );
    const waveData = computeWaveCloudDensity(
      world.wx,
      world.wy,
      earthConfig,
      sources,
      solarWind,
      cloudConfig,
      animationPhase
    );

    // Closest crustal node stress
    let minNodeDist = Infinity;
    let nodeStress = 0;
    for (const n of stressManager.nodes) {
      const d = Math.hypot(n.x - world.wx, n.y - world.wy);
      if (d < minNodeDist) {
        minNodeDist = d;
        nodeStress = n.accumulatedStress;
      }
    }

    setHoverInfo({
      x: clientX,
      y: clientY,
      worldX: world.wx,
      worldY: world.wy,
      bx: field.bx,
      by: field.by,
      bMag: field.magnitude,
      gradMag: grad.gradMag,
      stressVal: minNodeDist < 1.0 ? nodeStress : 0,
      interference: interf.intensity,
      hotspotMask: mask,
      waveCloudDensity: waveData.density,
    });

    // Handle entity dragging
    if (draggedSourceId) {
      setSources((prev) =>
        prev.map((s) => (s.id === draggedSourceId ? { ...s, x: world.wx, y: world.wy, orbiting: false } : s))
      );
      return;
    }

    if (isDraggingEarth) {
      setEarthConfig((prev) => ({ ...prev, x: world.wx, y: world.wy }));
      return;
    }

    // Handle view panning
    if (isPanning) {
      setPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    setDraggedSourceId(null);
    setIsDraggingEarth(false);
    setIsPanning(false);
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.12 : 0.89;
    setZoom((prev) => Math.max(25, Math.min(220, prev * zoomFactor)));
  };

  const resetView = () => {
    setZoom(75);
    setPan({ x: 0, y: 0 });
    setEarthConfig((prev) => ({ ...prev, x: 0, y: 0 }));
  };

  return (
    <div ref={containerRef} className="relative w-full h-full min-h-[520px] bg-[#070709] rounded-lg overflow-hidden border border-[#1e1e24] shadow-2xl flex flex-col">
      {/* Top Floating Control Bar - High Density */}
      <div className="absolute top-2.5 left-2.5 right-2.5 z-20 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        {/* Left: Mode Switchers */}
        <div className="flex items-center gap-1 p-0.5 bg-[#0e0e13]/95 backdrop-blur-md rounded-md border border-[#1e1e24] shadow-md pointer-events-auto">
          <button
            id="btn-mode-streamlines"
            onClick={() => setRenderMode('streamlines')}
            className={`px-2.5 py-1 text-xs font-mono font-medium rounded transition-colors flex items-center gap-1.5 ${
              renderMode === 'streamlines'
                ? 'bg-[#1a1a26] text-cyan-300 border border-cyan-500/40 shadow-sm font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-[#14141c]'
            }`}
          >
            <Activity className="w-3.5 h-3.5 text-cyan-400" />
            Streamlines
          </button>
          <button
            id="btn-mode-heatmap"
            onClick={() => setRenderMode('heatmap')}
            className={`px-2.5 py-1 text-xs font-mono font-medium rounded transition-colors flex items-center gap-1.5 ${
              renderMode === 'heatmap'
                ? 'bg-[#1a1a26] text-purple-300 border border-purple-500/40 shadow-sm font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-[#14141c]'
            }`}
          >
            <Flame className="w-3.5 h-3.5 text-purple-400" />
            Heatmap
          </button>
          <button
            id="btn-mode-composite"
            onClick={() => setRenderMode('composite')}
            className={`px-2.5 py-1 text-xs font-mono font-medium rounded transition-colors flex items-center gap-1.5 ${
              renderMode === 'composite'
                ? 'bg-[#1a1a26] text-emerald-300 border border-emerald-500/40 shadow-sm font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-[#14141c]'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-emerald-400" />
            Composite
          </button>
          <button
            id="btn-mode-quiver"
            onClick={() => setRenderMode('quiver')}
            className={`px-2.5 py-1 text-xs font-mono font-medium rounded transition-colors flex items-center gap-1.5 ${
              renderMode === 'quiver'
                ? 'bg-[#1a1a26] text-amber-300 border border-amber-500/40 shadow-sm font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-[#14141c]'
            }`}
          >
            <Move className="w-3.5 h-3.5 text-amber-400" />
            Quiver
          </button>
        </div>

        {/* Right: Simulation Controls & Neutral Points Toggle */}
        <div className="flex items-center gap-1 p-0.5 bg-[#0e0e13]/95 backdrop-blur-md rounded-md border border-[#1e1e24] shadow-md pointer-events-auto">
          {/* Neutral Points Toggle */}
          <button
            id="btn-toggle-neutral-points"
            onClick={() => setShowNeutralPoints(!showNeutralPoints)}
            className={`px-2 py-1 text-xs font-mono font-medium rounded transition-colors flex items-center gap-1.5 ${
              showNeutralPoints
                ? 'bg-pink-950/40 text-pink-300 border border-pink-500/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-[#14141c]'
            }`}
            title="Toggle Magnetic Neutral Points & Reconnection X-Sites"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-pink-400 animate-pulse"></span>
            X-Points
          </button>

          <div className="w-px h-3.5 bg-[#262632] mx-0.5" />

          {/* Play/Pause */}
          <button
            id="btn-play-pause-sim"
            onClick={() => setIsPlaying(!isPlaying)}
            className="p-1 text-slate-300 hover:text-white hover:bg-[#181822] rounded transition-colors"
            title={isPlaying ? 'Pause Simulation' : 'Resume Simulation'}
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5 text-cyan-400" /> : <Play className="w-3.5 h-3.5 text-emerald-400" />}
          </button>

          {/* Zoom In/Out/Reset */}
          <button
            id="btn-zoom-in"
            onClick={() => setZoom((prev) => Math.min(220, prev * 1.15))}
            className="p-1 text-slate-300 hover:text-white hover:bg-[#181822] rounded transition-colors"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            id="btn-zoom-out"
            onClick={() => setZoom((prev) => Math.max(25, prev * 0.85))}
            className="p-1 text-slate-300 hover:text-white hover:bg-[#181822] rounded transition-colors"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            id="btn-reset-view"
            onClick={resetView}
            className="p-1 text-slate-300 hover:text-white hover:bg-[#181822] rounded transition-colors"
            title="Reset Canvas View"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Canvas Element */}
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        className="w-full h-full cursor-grab active:cursor-grabbing block"
      />

      {/* Floating Bottom HUD Overlay - High Density Monospace */}
      <div className="absolute bottom-2.5 left-2.5 z-20 flex items-center gap-2.5 px-2.5 py-1 bg-[#0e0e13]/90 backdrop-blur-md rounded border border-[#1e1e24] text-[10px] font-mono text-slate-300 shadow-xl pointer-events-none">
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
          <span className="text-emerald-400 font-bold">{fps} FPS</span>
        </div>
        <div className="w-px h-3 bg-[#262632]" />
        <div>
          PEAK STRESS: <span className="font-bold text-amber-400">{(stressManager.maxStressValue * 100).toFixed(1)}%</span>
        </div>
        <div className="w-px h-3 bg-[#262632]" />
        <div>
          NEMATIC ORDER: <span className="font-bold text-cyan-400">S = {particleSystem.globalAlignmentOrder.toFixed(2)}</span>
        </div>
        {cloudConfig.showWaveClouds && (
          <>
            <div className="w-px h-3 bg-[#262632]" />
            <div className="text-sky-300 flex items-center gap-1">
              <Waves className="w-3 h-3 text-sky-400" />
              HOTSPOT: <span className="font-bold text-white">{particleSystem.globalHotspotCount} drops</span> (I_pk={particleSystem.peakInterference.toFixed(2)})
            </div>
          </>
        )}
        <div className="w-px h-3 bg-[#262632] hidden sm:block" />
        <div className="text-slate-500 hidden sm:block">
          Interactive RK4 Field Tracer
        </div>
      </div>

      {/* Hover Inspector Tooltip - High Density */}
      {hoverInfo && (
        <div
          className="absolute z-30 pointer-events-none p-2 bg-[#0f0f15]/98 backdrop-blur-md rounded border border-[#2c2c3e] shadow-2xl text-[10px] font-mono text-slate-200 min-w-[210px]"
          style={{
            left: Math.min(hoverInfo.x + 14, (containerRef.current?.clientWidth || 800) - 230),
            top: Math.min(hoverInfo.y + 14, (containerRef.current?.clientHeight || 600) - 190),
          }}
        >
          <div className="text-cyan-400 font-bold mb-1 flex items-center gap-1 border-b border-[#222230] pb-0.5">
            <Info className="w-3 h-3" /> VECTOR PROBE & HOTSPOT
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-slate-300">
            <span className="text-slate-500">Coord (x, y):</span>
            <span className="text-right">({hoverInfo.worldX.toFixed(2)}, {hoverInfo.worldY.toFixed(2)})</span>
            <span className="text-slate-500">|B_total|:</span>
            <span className="text-right text-emerald-400 font-bold">{hoverInfo.bMag.toFixed(3)} T</span>
            <span className="text-slate-500">(Bx, By):</span>
            <span className="text-right">({hoverInfo.bx.toFixed(2)}, {hoverInfo.by.toFixed(2)})</span>
            <span className="text-slate-500">∇|B|:</span>
            <span className="text-right text-purple-400">{hoverInfo.gradMag.toFixed(3)}</span>
            <span className="text-slate-500">Interference I:</span>
            <span className="text-right text-sky-400 font-semibold">{hoverInfo.interference.toFixed(3)}</span>
            <span className="text-slate-500">Mask M(x,y):</span>
            <span className={`text-right font-bold ${hoverInfo.hotspotMask > 0.5 ? 'text-pink-400' : 'text-slate-400'}`}>
              {(hoverInfo.hotspotMask * 100).toFixed(0)}%
            </span>
            <span className="text-slate-500">Wave Cloud C:</span>
            <span className="text-right text-cyan-300 font-bold">{hoverInfo.waveCloudDensity.toFixed(3)}</span>
            {hoverInfo.stressVal > 0 && (
              <>
                <span className="text-slate-500">Crust Stress:</span>
                <span className="text-right text-amber-400 font-bold">{(hoverInfo.stressVal * 100).toFixed(1)}%</span>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
