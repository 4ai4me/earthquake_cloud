import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import {
  AtmosphericCloudConfig,
  CrustalNode,
  EarthDipoleConfig,
  EarthquakeEvent,
  ExternalMagneticSource,
  HeatmapMetric,
  LayerVisibilityConfig,
  MoonConfig,
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
  computeNaturalWeatherCloudDensity,
  applyCloudGamma,
  getInspectionCloudColor,
} from '../physics/magneticEngine';
import { FieldContext, ResearchConfig, fieldOpacity, distanceLabel, sampleField, parseFieldNt, formatLogNt, weakBoundaryPoint, magnetopausePoint, needsLogOnly } from '../physics/fieldModel';
import { displayCloudPosition } from '../physics/atmosphereGeometry';
import { useFieldGeometry } from './useFieldGeometry';
import { FieldReadout, CoreFlowInset } from './FieldReadout';
import { CloudParticleSystem } from '../physics/cloudParticleEngine';
import { CrustalStressManager, SeismicWave } from '../physics/crustalStressEngine';
import { GroundSkyDomeView } from './GroundSkyDomeView';
import { computeMagneticPressureNPa } from '../physics/physicsCalibration';
import { computeAerosolCloudBaselineMultiplier } from '../physics/cernCloudAerosolEngine';
import { CloudInspectionSplitView } from './CloudInspectionSplitView';
import { VisualElementsGuidePanel, DEFAULT_LAYER_VISIBILITY } from './VisualElementsGuidePanel';
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
  Sparkles,
  Compass,
  Columns,
  Moon,
  Sliders,
  Wind,
  Zap,
  X,
} from 'lucide-react';

interface SimulationCanvas2DProps {
  research: ResearchConfig;
  isPlaying: boolean;
  setIsPlaying: React.Dispatch<React.SetStateAction<boolean>>;
  earthConfig: EarthDipoleConfig;
  setEarthConfig: React.Dispatch<React.SetStateAction<EarthDipoleConfig>>;
  sources: ExternalMagneticSource[];
  setSources: React.Dispatch<React.SetStateAction<ExternalMagneticSource[]>>;
  solarWind: SolarWindConfig;
  setSolarWind: React.Dispatch<React.SetStateAction<SolarWindConfig>>;
  moonConfig?: MoonConfig;
  setMoonConfig?: React.Dispatch<React.SetStateAction<MoonConfig>>;
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
  layerVisibility?: LayerVisibilityConfig;
  setLayerVisibility?: React.Dispatch<React.SetStateAction<LayerVisibilityConfig>>;
}

export const SimulationCanvas2D: React.FC<SimulationCanvas2DProps> = ({
  research, isPlaying, setIsPlaying,
  earthConfig,
  setEarthConfig,
  sources,
  setSources,
  solarWind,
  setSolarWind,
  moonConfig,
  setMoonConfig,
  cloudConfig,
  setCloudConfig,
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
  layerVisibility,
  setLayerVisibility,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Layer Visibility State fallback
  const [internalLayerVisibility, setInternalLayerVisibility] = useState<LayerVisibilityConfig>(DEFAULT_LAYER_VISIBILITY);
  const currentLayers = layerVisibility || internalLayerVisibility;
  const updateLayers = setLayerVisibility || setInternalLayerVisibility;
  const aerosolBaselineMultiplier = useMemo(
    () => computeAerosolCloudBaselineMultiplier(cloudConfig.aerosolExperiment),
    [cloudConfig.aerosolExperiment]
  );

  // Viewport transformation
  const [zoom, setZoom] = useState<number>(75); // pixels per world unit
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Dragging entities
  const [draggedSourceId, setDraggedSourceId] = useState<string | null>(null);
  const [isDraggingEarth, setIsDraggingEarth] = useState<boolean>(false);
  const [isDraggingMoon, setIsDraggingMoon] = useState<boolean>(false);

  // Right-click Vector Probe & Hotspot inspection state (shown ONLY on user right-click)
  const [probeInfo, setProbeInfo] = useState<{
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
  const context = useMemo<FieldContext>(() => ({ earth: earthConfig, sources, solar: solarWind, moon: moonConfig }), [earthConfig,sources,solarWind,moonConfig]);
  const field = useFieldGeometry({ context, extent: Math.min(180, Math.max(4, (containerRef.current?.clientWidth ?? 800)/zoom*0.7)), planar: true, density:streamlineDensity });
  const geometryRef = useRef(field.geometry); geometryRef.current=field.geometry;
  const contextRef = useRef(context); contextRef.current=context;
  const researchRef = useRef(research); researchRef.current=research;
  const lineCache = useRef<{ canvas: HTMLCanvasElement; geometry: typeof field.geometry; transform:string } | null>(null);
  const rasterCache = useRef(new Map<string,{ canvas:HTMLCanvasElement; at:number; transform:string }>());
  const lastRender = useRef(0);
  const animationPhaseRef = useRef<number>(0);
  const [fps, setFps] = useState<number>(60);
  const fpsCounterRef = useRef<{ frames: number; lastTime: number }>({ frames: 0, lastTime: performance.now() });
  const moonConfigRef = useRef<MoonConfig | undefined>(moonConfig);
  const lastMoonUiSyncRef = useRef<number>(0);

  // Keep manual controls and preset changes authoritative without forcing the
  // animation effect to restart for every automatic-orbit frame.
  useEffect(() => {
    moonConfigRef.current = moonConfig;
  }, [moonConfig]);

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
      if (document.hidden || now-lastRender.current < 1000/30) { animationFrameId=requestAnimationFrame(render); return; }
      lastRender.current=now-((now-lastRender.current)%(1000/30));
      const dt = Math.max(0, Math.min((now - lastTimestamp) / 1000, 0.05));
      lastTimestamp = now;
      let animationPhase = animationPhaseRef.current;
      let frameMoonConfig = moonConfigRef.current;

      // Update FPS counter
      fpsCounterRef.current.frames++;
      if (now - fpsCounterRef.current.lastTime >= 1000) {
        setFps(fpsCounterRef.current.frames);
        fpsCounterRef.current.frames = 0;
        fpsCounterRef.current.lastTime = now;
      }

      if (isPlaying) {
        animationPhase = (animationPhase + dt * 1.5) % 1000;
        animationPhaseRef.current = animationPhase;

      }

      const canvas = canvasRef.current;
      if (!canvas) {
        animationFrameId = requestAnimationFrame(render);
        return;
      }

      let ctx = canvas.getContext('2d');
      if (!ctx) {
        animationFrameId = requestAnimationFrame(render);
        return;
      }

      const width = canvas.width;
      const height = canvas.height;
      const unsafe = needsLogOnly(contextRef.current);
      const settings = researchRef.current;
      const renderCachedLayer = (name:string, draw:()=>void) => {
        const key=[width,height,zoom,pan.x,pan.y,renderMode,heatmapMetric,JSON.stringify(currentLayers),cloudConfig.inspectionMode,unsafe].join(':');
        let cache=rasterCache.current.get(name);
        if(!cache || cache.transform!==key || now-cache.at>250) {
          const buffer=cache?.canvas ?? document.createElement('canvas');
          buffer.width=width; buffer.height=height;
          const target=buffer.getContext('2d'); if(!target)return;
          const original=ctx; ctx=target;
          try { draw(); } finally { ctx=original; }
          cache={canvas:buffer,at:now,transform:key}; rasterCache.current.set(name,cache);
        }
        ctx!.drawImage(cache.canvas,0,0);
      };

      // Check for Dedicated Isolated Inspection View Modes (Cloud Only, Hotspot Mask, Cloud+Vector)
      const isInspectionMode =
        cloudConfig.inspectionMode &&
        cloudConfig.inspectionMode !== 'none' &&
        cloudConfig.inspectionMode !== 'split_3view';

      if (isInspectionMode) {
        renderCachedLayer('inspection', () => {
        if (unsafe) { ctx!.fillStyle='#050508'; ctx!.fillRect(0,0,width,height); ctx!.fillStyle='#fcd34d'; ctx!.fillText('극한 입력: 구름 정량 진단 중단',20,40); return; }
        // Deep Space Black background
        ctx.fillStyle = '#050508';
        ctx.fillRect(0, 0, width, height);

        const step = Math.max(cloudConfig.highResGrid !== false ? 4 : 8, Math.ceil(Math.sqrt(width*height/4000)));
        const currentGamma = cloudConfig.gamma ?? 0.6;
        const palette = cloudConfig.colorPalette ?? 'satellite_bone';

        for (let py = 0; py < height; py += step) {
          for (let px = 0; px < width; px += step) {
            const worldPos = canvasToWorld(px + step / 2, py + step / 2, width, height);
            const waveData = computeWaveCloudDensity(
              worldPos.wx,
              worldPos.wy,
              earthConfig,
              sources,
              solarWind,
              cloudConfig,
              animationPhase
            );

            if (cloudConfig.inspectionMode === 'cloud_density' || cloudConfig.inspectionMode === 'cloud_vector_overlay') {
              // Blend natural meteorological cloud background with stimulated earthquake wave cloud patterns
              const naturalDensity = computeNaturalWeatherCloudDensity(worldPos.wx, worldPos.wy, cloudConfig.weatherData, animationPhase, aerosolBaselineMultiplier);
              const combinedDensity = Math.max(waveData.density, naturalDensity * 0.7);

              if (combinedDensity > 0.01) {
                const visDensity = applyCloudGamma(combinedDensity, currentGamma);
                ctx.fillStyle = getInspectionCloudColor(visDensity, palette, visDensity * 0.95);
                ctx.fillRect(px, py, step, step);
              }
            } else if (cloudConfig.inspectionMode === 'hotspot_mask') {
              if (waveData.mask > 0.02) {
                const m = Math.min(1.0, waveData.mask);
                let r = 0, g = 0, b = 0;
                if (m < 0.33) {
                  const t = m / 0.33;
                  r = Math.round(80 * t);
                  b = Math.round(150 * t);
                } else if (m < 0.66) {
                  const t = (m - 0.33) / 0.33;
                  r = Math.round(80 + 175 * t);
                  g = Math.round(60 * t);
                  b = Math.round(150 * (1 - t));
                } else {
                  const t = (m - 0.66) / 0.34;
                  r = 255;
                  g = Math.round(60 + 195 * t);
                  b = Math.round(80 * t);
                }
                ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${Math.min(1.0, m * 0.95)})`;
                ctx.fillRect(px, py, step, step);
              }
            }
          }
        }

        // Low-alpha thin streamlines overlay for cloud_vector_overlay mode
        if (cloudConfig.inspectionMode === 'cloud_vector_overlay') {
          const numLines = 28;
          const seedPoints: { x: number; y: number }[] = [];
          const earthR = earthConfig.radius;
          for (let i = 0; i < numLines; i++) {
            const ang = (i / numLines) * Math.PI * 2;
            seedPoints.push({
              x: earthConfig.x + (earthR + 0.15) * Math.cos(ang),
              y: earthConfig.y + (earthR + 0.15) * Math.sin(ang),
            });
          }

          ctx.strokeStyle = `rgba(56, 189, 248, ${cloudConfig.streamlineAlpha ?? 0.35})`;
          ctx.lineWidth = 1.0;

          seedPoints.forEach((pt) => {
            let curX = pt.x;
            let curY = pt.y;
            ctx.beginPath();
            const startP = worldToCanvas(curX, curY, width, height);
            ctx.moveTo(startP.cx, startP.cy);

            for (let s = 0; s < 130; s++) {
              const f = computeTotalMagneticField(curX, curY, earthConfig, sources, solarWind);
              if (f.magnitude < 1e-4) break;
              const ds = 0.08;
              curX += (f.bx / f.magnitude) * ds;
              curY += (f.by / f.magnitude) * ds;
              const p = worldToCanvas(curX, curY, width, height);
              ctx.lineTo(p.cx, p.cy);
            }
            ctx.stroke();
          });
        }

        // Minimalist faint outline for Earth and external sources
        const ep = worldToCanvas(earthConfig.x, earthConfig.y, width, height);
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(ep.cx, ep.cy, earthConfig.radius * zoom, 0, Math.PI * 2);
        ctx.stroke();

        sources.forEach((src) => {
          if (!src.active) return;
          const sp = worldToCanvas(src.x, src.y, width, height);
          ctx.fillStyle = src.type === 'monopole_n' ? 'rgba(239, 68, 68, 0.7)' : 'rgba(59, 130, 246, 0.7)';
          ctx.beginPath();
          ctx.arc(sp.cx, sp.cy, 4, 0, Math.PI * 2);
          ctx.fill();
        });

        });
        // Request next frame and return early for inspection mode
        animationFrameId = requestAnimationFrame(render);
        return;
      }

      // Clear Canvas Background (Deep Cosmic Slate)
      ctx.fillStyle = '#030712'; // Tailwind gray-950
      ctx.fillRect(0, 0, width, height);

      // Common viewport world bounds
      const minWorld = canvasToWorld(0, height, width, height);
      const maxWorld = canvasToWorld(width, 0, width, height);

      // 1. Draw Background Grid & Coordinates
      if (currentLayers.gridAxes) {
        ctx.strokeStyle = 'rgba(30, 41, 59, 0.5)';
        ctx.lineWidth = 1;
        const origin = worldToCanvas(0, 0, width, height);

        // Grid lines
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
      }

      // 2. Render Heatmap (if active)
      if (!unsafe && currentLayers.heatmap && (renderMode === 'heatmap' || renderMode === 'composite')) renderCachedLayer('heatmap', () => {
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
              const pMagNPa = computeMagneticPressureNPa(field.magnitude);
              metricVal = Math.min(1.0, pMagNPa / 500_000);
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
      });

      // 3. Render Solar Wind Flow (Upstream Sunward Particles)
      if (solarWind.enabled && currentLayers.solarWind) {
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

      // RK4 geometry is calculated off-thread. Rasterize only on geometry/viewport changes.
      if (currentLayers.streamlines && (renderMode === 'streamlines' || renderMode === 'composite')) {
        const geometry=geometryRef.current;
        if(geometry) {
          const transform=[width,height,zoom,pan.x,pan.y].join(':');
          let cache=lineCache.current;
          if(!cache || cache.geometry!==geometry || cache.transform!==transform) {
            const buffer=cache?.canvas ?? document.createElement('canvas'); buffer.width=width; buffer.height=height;
            const pen=buffer.getContext('2d');
            if(pen) {
              const buckets=Array.from({length:16},()=>new Path2D());
              for(let l=0;l<geometry.offsets.length-1;l++) for(let j=geometry.offsets[l]+1;j<geometry.offsets[l+1];j++) {
                const strength=fieldOpacity(geometry.logs[j]); const bucket=Math.min(15,Math.floor(strength*15));
                if(bucket===0)continue;
                const a=worldToCanvas(geometry.positions[(j-1)*3],geometry.positions[(j-1)*3+1],width,height);
                const b=worldToCanvas(geometry.positions[j*3],geometry.positions[j*3+1],width,height);
                buckets[bucket].moveTo(a.cx,a.cy); buckets[bucket].lineTo(b.cx,b.cy);
              }
              pen.lineWidth=1.2;
              buckets.forEach((path,index)=>{ pen.strokeStyle='rgba(56,211,250,'+(index/15)+')'; pen.stroke(path); });
            }
            cache={canvas:buffer,geometry,transform}; lineCache.current=cache;
          }
          ctx.drawImage(cache.canvas,0,0);
          for(let i=0;i<Math.min(48,geometry.offsets.length-1);i++) {
            const start=geometry.offsets[i], length=geometry.offsets[i+1]-start; if(!length)continue;
            const k=start+Math.floor((animationPhase*15+i*7)%length);
            const p=worldToCanvas(geometry.positions[k*3],geometry.positions[k*3+1],width,height);
            ctx.fillStyle='rgba(103,232,249,'+fieldOpacity(geometry.logs[k])+')';
            ctx.beginPath();ctx.arc(p.cx,p.cy,1.8,0,Math.PI*2);ctx.fill();
          }
        }
      }

      if (settings.distances && currentLayers.gridAxes) {
        const center=worldToCanvas(earthConfig.x,earthConfig.y,width,height);
        ctx.save();ctx.setLineDash([3,6]);ctx.strokeStyle='rgba(148,163,184,0.25)';ctx.fillStyle='#94a3b8';ctx.font='10px monospace';
        for(const radius of [1,2,5,10,20,40,60,100]) {
          if(radius*zoom>Math.hypot(width,height))continue;
          ctx.beginPath();ctx.arc(center.cx,center.cy,radius*zoom,0,Math.PI*2);ctx.stroke();
          ctx.fillText(radius+' R_E · '+(radius*6371).toLocaleString()+' km',center.cx+radius*zoom+3,center.cy-3);
        }
        ctx.restore();
      }
      const boundary=(kind:'weak'|'magnetopause')=>{
        ctx.save();ctx.setLineDash(kind==='weak'?[5,5]:[]);ctx.strokeStyle=kind==='weak'?'rgba(167,139,250,0.65)':'rgba(245,158,11,0.6)';ctx.beginPath();
        let first=true;
        for(let i=0;i<=160;i++) {
          const a=i/160*Math.PI*2;
          const p=kind==='weak' ? weakBoundaryPoint(a,0,contextRef.current,settings.weakThresholdNt) : magnetopausePoint(Math.min(a,Math.PI*2-a),a>Math.PI?Math.PI:0,contextRef.current);
          if(!p)continue; const at=worldToCanvas(p.x,p.y,width,height);
          if(first){ctx.moveTo(at.cx,at.cy);first=false;}else ctx.lineTo(at.cx,at.cy);
        }
        ctx.stroke();ctx.restore();
      };
      if(settings.weakBoundary && currentLayers.streamlines)boundary('weak');
      if(settings.magnetopause && currentLayers.solarWind)boundary('magnetopause');
      if (currentLayers.streamlines && renderMode === 'quiver') {
        ctx.save();
        const step = 0.5;
        for (let qx = Math.floor(minWorld.wx); qx <= Math.ceil(maxWorld.wx); qx += step) {
          for (let qy = Math.floor(minWorld.wy); qy <= Math.ceil(maxWorld.wy); qy += step) {
            const direction=sampleField({ x:qx,y:qy,z:0 },contextRef.current);
            const field = { bx:direction.x,by:direction.y,magnitude:Math.hypot(direction.x,direction.y) };
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

      // Shared prescribed near-tropopause samples; display gain never enters physics.
      if (!unsafe && cloudConfig.enabled) renderCachedLayer('cloud',()=>{
        ctx.save();
        const center=worldToCanvas(earthConfig.x,earthConfig.y,width,height);
        const gain=cloudConfig.altitudeDisplayGain??1;
        if(currentLayers.cloudBands || currentLayers.waveClouds) for(const band of particleSystem.cloudBands) {
          const p=displayCloudPosition(band.x,band.y,earthConfig,cloudConfig);
          const r=Math.hypot(p.x-earthConfig.x,p.y-earthConfig.y)*zoom;
          const angle=-Math.atan2(p.y-earthConfig.y,p.x-earthConfig.x);
          const density=Math.max(currentLayers.cloudBands ? band.baseline : 0,currentLayers.waveClouds && cloudConfig.showWaveClouds ? band.hypothesis : 0);
          ctx.lineWidth=Math.max(1,2*(cloudConfig.cloudLayerHalfWidthKm??1.5)/6371*gain*zoom);
          ctx.strokeStyle='rgba(224,242,254,'+(density*cloudConfig.cloudOpacity)+')';
          ctx.beginPath();ctx.arc(center.cx,center.cy,r,angle-0.014,angle+0.014);ctx.stroke();
        }
        if(currentLayers.cloudParticles && cloudConfig.showParticles) for(const particle of particleSystem.particles) {
          const p=displayCloudPosition(particle.x,particle.y,earthConfig,cloudConfig);
          const screen=worldToCanvas(p.x,p.y,width,height);
          ctx.fillStyle='rgba(224,242,254,'+(particle.opacity*particle.condensationFactor)+')';
          ctx.beginPath();ctx.arc(screen.cx,screen.cy,Math.max(0.5,Math.min(2,zoom/150)),0,Math.PI*2);ctx.fill();
        }
        ctx.restore();
      });

      // 7. Render Seismic Rupture Shockwaves (P-waves & S-waves)
      if (currentLayers.seismicWaves) {
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
          ctx.arc(epic.cx, epic.cy, Math.max(0, pixelRadius), 0, Math.PI * 2);
          ctx.stroke();

          // Wavefront ripples
          ctx.strokeStyle = `rgba(254, 202, 202, ${wave.opacity * 0.4})`;
          ctx.lineWidth = 1.0;
          ctx.beginPath();
          ctx.arc(epic.cx, epic.cy, Math.max(0, pixelRadius - 10), 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();
      }

      // 8. Render Earth Planetary Body, Atmosphere Halo & Crustal Fault Ring
      const earthCanvas = worldToCanvas(earthConfig.x, earthConfig.y, width, height);
      const earthPixelRadius = earthConfig.radius * zoom;

      if (currentLayers.earthBody) {
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
        ctx.restore();
      }

      // Dipole Axis Indicator
      if (currentLayers.dipoleAxis) {
        ctx.save();
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
      }

      // 9. Render Crustal Fault Nodes & Stress Accumulation Rings
      if (currentLayers.crustalNodes) {
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
      }

      // 10. Render Neutral Points / X-Points (Magnetic Reconnection Sites)
      if (!unsafe && showNeutralPoints && currentLayers.neutralPoints) renderCachedLayer('neutral',()=>{
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
      });

      // 11. Render External Magnetic Sources (Monopoles, Dipoles, and Comets)
      if (currentLayers.externalSources) {
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

          if (s.type === 'comet') {
            // Comet nucleus & Ionized Gas Tail
            const tailLen = (s.cometTailLength ?? 3.0) * zoom;
            const gasActivity = Math.min(20,s.cometGasActivity ?? 2.5); // Display radius only; never clip the field input.

            // Ion tail (points away from Sun / along +x solar wind)
            const tailGrad = ctx.createLinearGradient(
              sCanvas.cx,
              sCanvas.cy,
              sCanvas.cx + tailLen,
              sCanvas.cy + Math.sin(animationPhase * 2) * 6
            );
            tailGrad.addColorStop(0, 'rgba(56, 189, 248, 0.75)');
            tailGrad.addColorStop(0.3, 'rgba(99, 102, 241, 0.45)');
            tailGrad.addColorStop(0.7, 'rgba(168, 85, 247, 0.2)');
            tailGrad.addColorStop(1, 'rgba(168, 85, 247, 0)');

            ctx.fillStyle = tailGrad;
            ctx.beginPath();
            ctx.moveTo(sCanvas.cx, sCanvas.cy - 7);
            ctx.lineTo(sCanvas.cx + tailLen, sCanvas.cy - 18);
            ctx.lineTo(sCanvas.cx + tailLen, sCanvas.cy + 18);
            ctx.lineTo(sCanvas.cx, sCanvas.cy + 7);
            ctx.closePath();
            ctx.fill();

            // Dust tail (curved)
            const dustGrad = ctx.createLinearGradient(
              sCanvas.cx,
              sCanvas.cy,
              sCanvas.cx + tailLen * 0.75,
              sCanvas.cy + tailLen * 0.4
            );
            dustGrad.addColorStop(0, 'rgba(253, 230, 138, 0.6)');
            dustGrad.addColorStop(1, 'rgba(253, 230, 138, 0)');
            ctx.fillStyle = dustGrad;
            ctx.beginPath();
            ctx.moveTo(sCanvas.cx, sCanvas.cy - 4);
            ctx.quadraticCurveTo(
              sCanvas.cx + tailLen * 0.4,
              sCanvas.cy + tailLen * 0.1,
              sCanvas.cx + tailLen * 0.75,
              sCanvas.cy + tailLen * 0.4
            );
            ctx.lineTo(sCanvas.cx + tailLen * 0.7, sCanvas.cy + tailLen * 0.48);
            ctx.quadraticCurveTo(
              sCanvas.cx + tailLen * 0.35,
              sCanvas.cy + tailLen * 0.15,
              sCanvas.cx,
              sCanvas.cy + 4
            );
            ctx.closePath();
            ctx.fill();

            // Coma halo
            const comaGrad = ctx.createRadialGradient(
              sCanvas.cx,
              sCanvas.cy,
              2,
              sCanvas.cx,
              sCanvas.cy,
              18 + gasActivity * 3
            );
            comaGrad.addColorStop(0, '#ffffff');
            comaGrad.addColorStop(0.3, 'rgba(103, 232, 249, 0.8)');
            comaGrad.addColorStop(0.7, 'rgba(56, 189, 248, 0.3)');
            comaGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');
            ctx.fillStyle = comaGrad;
            ctx.beginPath();
            ctx.arc(sCanvas.cx, sCanvas.cy, 18 + gasActivity * 3, 0, Math.PI * 2);
            ctx.fill();

            // Nucleus
            ctx.fillStyle = '#f8fafc';
            ctx.beginPath();
            ctx.arc(sCanvas.cx, sCanvas.cy, 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#06b6d4';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            // Label
            ctx.fillStyle = '#38bdf8';
            ctx.font = 'bold 10px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(s.name, sCanvas.cx, sCanvas.cy + 22);
            continue;
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
          const labelText = s.type === 'monopole_n' ? 'N' : s.type === 'monopole_s' ? 'S' : s.type==='uniform' ? 'B' : 'M';
          ctx.fillText(labelText, sCanvas.cx, sCanvas.cy);

          ctx.fillStyle = '#cbd5e1';
          ctx.font = '10px sans-serif';
          const strengthLabel=formatLogNt(s.fieldNt===undefined?Math.log10(Math.abs(s.strength)*31200):parseFieldNt(s.fieldNt).logNt);
          ctx.fillText(`${s.name} (${strengthLabel} nT 기준)`, sCanvas.cx, sCanvas.cy + 32);
          if(s.type==='dipole'||s.type==='uniform'){
            const a=(s.angle??0)*Math.PI/180;
            for(const sign of (s.type==='dipole'?[1,-1]:[1])) {
              const dx=-Math.sin(a)*20*sign,dy=-Math.cos(a)*20*sign;
              ctx.strokeStyle='#cbd5e1';ctx.beginPath();ctx.moveTo(sCanvas.cx,sCanvas.cy);ctx.lineTo(sCanvas.cx+dx,sCanvas.cy+dy);ctx.stroke();
              ctx.fillStyle=sign>0?'#ef4444':'#3b82f6';ctx.beginPath();ctx.arc(sCanvas.cx+dx,sCanvas.cy+dy,6,0,Math.PI*2);ctx.fill();
              ctx.fillStyle='white';ctx.fillText(s.type==='uniform'?'B':sign>0?'N':'S',sCanvas.cx+dx,sCanvas.cy+dy);
            }
          }
        }
        ctx.restore();
      }

      // 12. Render Moon Body, Lunar Orbit, and Solid Earth Tidal Bulge
      if (frameMoonConfig?.enabled) {
        const moonAngleRad = (frameMoonConfig.phaseAngleDeg * Math.PI) / 180;
        const moonDist = frameMoonConfig.physicalDistanceEarthRadii ?? 60.3;
        const moonX = earthConfig.x + Math.cos(moonAngleRad) * moonDist;
        const moonY = earthConfig.y + Math.sin(moonAngleRad) * moonDist;
        const moonCanvas = worldToCanvas(moonX, moonY, width, height);
        const moonRadiusPx = Math.max(2, 0.2727 * zoom); // minimum 2 px is a locator, not a physical size increase

        // A. Orbit Path Ring
        if (currentLayers.moonOrbit && frameMoonConfig.showOrbit !== false) {
          ctx.save();
          ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
          ctx.setLineDash([4, 4]);
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.arc(earthCanvas.cx, earthCanvas.cy, moonDist * zoom, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);

          // Orbit Distance Tag
          const tagX = earthCanvas.cx + Math.cos(moonAngleRad + 0.25) * (moonDist * zoom);
          const tagY = earthCanvas.cy + Math.sin(moonAngleRad + 0.25) * (moonDist * zoom);
          ctx.fillStyle = '#94a3b8';
          ctx.font = '9px monospace';
          ctx.fillText('Moon display orbit (physical mean = 60.3 R_E)', tagX, tagY);
          ctx.restore();
        }

        // B. Solid Earth Tidal Bulge on Earth's Crust
        if (currentLayers.lunarTideBulge && frameMoonConfig.showTidalBulge !== false) {
          ctx.save();
          const tidalWeight = frameMoonConfig.tidalStressWeight ?? 0.25;
          const earthRadiusPx = earthConfig.radius * zoom;
          const bulgeOffsetPx = earthRadiusPx * 0.12 * (tidalWeight / 0.25);

          // Tidal axis line
          ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
          ctx.setLineDash([2, 4]);
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(
            earthCanvas.cx - Math.cos(moonAngleRad) * (earthRadiusPx + bulgeOffsetPx * 1.5),
            earthCanvas.cy + Math.sin(moonAngleRad) * (earthRadiusPx + bulgeOffsetPx * 1.5)
          );
          ctx.lineTo(
            earthCanvas.cx + Math.cos(moonAngleRad) * (earthRadiusPx + bulgeOffsetPx * 1.5),
            earthCanvas.cy - Math.sin(moonAngleRad) * (earthRadiusPx + bulgeOffsetPx * 1.5)
          );
          ctx.stroke();
          ctx.setLineDash([]);

          // Tidal Ellipsoid Bulge Contour
          ctx.strokeStyle = 'rgba(56, 189, 248, 0.65)';
          ctx.fillStyle = 'rgba(56, 189, 248, 0.08)';
          ctx.lineWidth = 1.8;
          ctx.beginPath();
          ctx.ellipse(
            earthCanvas.cx,
            earthCanvas.cy,
            earthRadiusPx + bulgeOffsetPx,
            earthRadiusPx - bulgeOffsetPx * 0.5,
            -moonAngleRad,
            0,
            Math.PI * 2
          );
          ctx.fill();
          ctx.stroke();

          // Bulge arrow labels
          ctx.fillStyle = '#38bdf8';
          ctx.font = '9px monospace';
          ctx.textAlign = 'center';
          const subLunarX = earthCanvas.cx + Math.cos(moonAngleRad) * (earthRadiusPx + bulgeOffsetPx + 12);
          const subLunarY = earthCanvas.cy - Math.sin(moonAngleRad) * (earthRadiusPx + bulgeOffsetPx + 12);
          ctx.fillText('Sub-Lunar Bulge (기조력 최대)', subLunarX, subLunarY);
          ctx.restore();
        }

        // Lunar wake requires a plasma model; no synthetic wake is shown as measured physics.

        // D. Moon Celestial Body
        if (currentLayers.moonBody) {
          ctx.save();
          // Halo glow
          ctx.fillStyle = isDraggingMoon ? 'rgba(255, 255, 255, 0.35)' : 'rgba(203, 213, 225, 0.2)';
          ctx.beginPath();
          ctx.arc(moonCanvas.cx, moonCanvas.cy, moonRadiusPx + 4, 0, Math.PI * 2);
          ctx.fill();

          // Moon body base (silvery gray with subtle radial gradient)
          const moonGrad = ctx.createRadialGradient(
            moonCanvas.cx - moonRadiusPx * 0.3,
            moonCanvas.cy - moonRadiusPx * 0.3,
            moonRadiusPx * 0.1,
            moonCanvas.cx,
            moonCanvas.cy,
            moonRadiusPx
          );
          moonGrad.addColorStop(0, '#f1f5f9');
          moonGrad.addColorStop(0.5, '#cbd5e1');
          moonGrad.addColorStop(0.85, '#94a3b8');
          moonGrad.addColorStop(1, '#64748b');

          ctx.fillStyle = moonGrad;
          ctx.beginPath();
          ctx.arc(moonCanvas.cx, moonCanvas.cy, moonRadiusPx, 0, Math.PI * 2);
          ctx.fill();

          // Lunar Maria / Crater dark spots
          ctx.fillStyle = 'rgba(51, 65, 85, 0.45)';
          // Oceanus Procellarum / Mare Imbrium
          ctx.beginPath();
          ctx.arc(moonCanvas.cx - moonRadiusPx * 0.25, moonCanvas.cy - moonRadiusPx * 0.15, moonRadiusPx * 0.32, 0, Math.PI * 2);
          ctx.fill();
          // Mare Serenitatis / Tranquillitatis
          ctx.beginPath();
          ctx.arc(moonCanvas.cx + moonRadiusPx * 0.15, moonCanvas.cy - moonRadiusPx * 0.2, moonRadiusPx * 0.26, 0, Math.PI * 2);
          ctx.fill();
          // Mare Crisium
          ctx.beginPath();
          ctx.arc(moonCanvas.cx + moonRadiusPx * 0.38, moonCanvas.cy + moonRadiusPx * 0.1, moonRadiusPx * 0.16, 0, Math.PI * 2);
          ctx.fill();

          // Moon border
          ctx.strokeStyle = '#e2e8f0';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(moonCanvas.cx, moonCanvas.cy, moonRadiusPx, 0, Math.PI * 2);
          ctx.stroke();

          // Remanent Crustal Dipole Vector arrow
          if (frameMoonConfig.hypothesisDipoleEnabled && frameMoonConfig.remanentMoment && frameMoonConfig.remanentMoment > 0.01) {
            const remAngle = ((frameMoonConfig.remanentAngle ?? 15) * Math.PI) / 180;
            const arrowLen = moonRadiusPx * 1.6;
            const dx = Math.cos(remAngle) * arrowLen;
            const dy = -Math.sin(remAngle) * arrowLen;
            ctx.strokeStyle = '#f43f5e';
            ctx.lineWidth = 1.8;
            ctx.beginPath();
            ctx.moveTo(moonCanvas.cx - dx * 0.5, moonCanvas.cy - dy * 0.5);
            ctx.lineTo(moonCanvas.cx + dx * 0.5, moonCanvas.cy + dy * 0.5);
            ctx.stroke();
            // Arrowhead
            ctx.fillStyle = '#f43f5e';
            ctx.beginPath();
            ctx.arc(moonCanvas.cx + dx * 0.5, moonCanvas.cy + dy * 0.5, 2.5, 0, Math.PI * 2);
            ctx.fill();
          }

          // Moon Label & Phase info
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 10px monospace';
          ctx.textAlign = 'center';
          ctx.fillText('MOON (달)', moonCanvas.cx, moonCanvas.cy + moonRadiusPx + 14);

          ctx.fillStyle = '#94a3b8';
          ctx.font = '9px sans-serif';
          const phaseName =
            Math.abs(frameMoonConfig.phaseAngleDeg - 0) < 20
              ? '신월 (New Moon)'
              : Math.abs(frameMoonConfig.phaseAngleDeg - 90) < 20
              ? '상현 (First Qtr)'
              : Math.abs(frameMoonConfig.phaseAngleDeg - 180) < 20
              ? '보름달 (Full Moon)'
              : Math.abs(frameMoonConfig.phaseAngleDeg - 270) < 20
              ? '하현 (Third Qtr)'
              : `${Math.round(frameMoonConfig.phaseAngleDeg)}°`;
          ctx.fillText(
            `위상: ${phaseName} | 기조력 ${(frameMoonConfig.tidalStressWeight ?? 0.25).toFixed(2)}`,
            moonCanvas.cx,
            moonCanvas.cy + moonRadiusPx + 26
          );
          ctx.restore();
        }
      }

      // Render right-click probe marker target on canvas if active
      if (probeInfo && currentLayers.probeMarker) {
        const probeCanvas = worldToCanvas(probeInfo.worldX, probeInfo.worldY, canvas.width, canvas.height);
        ctx.save();
        ctx.strokeStyle = '#22d3ee';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([2, 2]);
        ctx.beginPath();
        ctx.arc(probeCanvas.cx, probeCanvas.cy, 12, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);

        // Crosshairs
        ctx.strokeStyle = 'rgba(34, 211, 238, 0.85)';
        ctx.lineWidth = 1.0;
        ctx.beginPath();
        ctx.moveTo(probeCanvas.cx - 16, probeCanvas.cy);
        ctx.lineTo(probeCanvas.cx + 16, probeCanvas.cy);
        ctx.moveTo(probeCanvas.cx, probeCanvas.cy - 16);
        ctx.lineTo(probeCanvas.cx, probeCanvas.cy + 16);
        ctx.stroke();

        // Center dot
        ctx.fillStyle = '#06b6d4';
        ctx.beginPath();
        ctx.arc(probeCanvas.cx, probeCanvas.cy, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
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
    onEarthquakeTriggered,
    probeInfo,
    currentLayers,
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

    const resizeFrame = requestAnimationFrame(handleResize);
    const observer = new ResizeObserver(handleResize);
    if (containerRef.current) observer.observe(containerRef.current);
    return () => {
      cancelAnimationFrame(resizeFrame);
      observer.disconnect();
    };
  }, [cloudConfig.perspectiveMode, cloudConfig.inspectionMode]);

  // Mouse Interaction Handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // Only handle dragging/panning on primary (left) button click
    if (e.button !== 0) return;

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

    // Check if clicked Moon
    if (moonConfig?.enabled) {
      const moonAngleRad = (moonConfig.phaseAngleDeg * Math.PI) / 180;
      const moonDist = moonConfig.physicalDistanceEarthRadii ?? 60.3;
      const moonX = earthConfig.x + Math.cos(moonAngleRad) * moonDist;
      const moonY = earthConfig.y + Math.sin(moonAngleRad) * moonDist;
      const distMoon = Math.hypot(moonX - world.wx, moonY - world.wy);
      if (distMoon < Math.max(0.35, (moonConfig.radius ?? 0.26) * 1.5)) {
        setIsDraggingMoon(true);
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

  // Right-Click Context Menu Handler: Vector Probe & Hotspot Inspector
  const handleContextMenu = (e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault(); // Prevent standard browser context menu
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;
    const world = canvasToWorld(clientX, clientY, canvas.width, canvas.height);

    // Compute magnetic field and gradient at the right-clicked coordinate
    const field = computeTotalMagneticField(world.wx, world.wy, earthConfig, sources, solarWind, moonConfig);
    const grad = needsLogOnly(context) ? { gradMag:NaN } : computeFieldGradient(world.wx, world.wy, earthConfig, sources, solarWind, moonConfig);
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
      cloudConfig.interferenceThreshold ?? 0.35,
      cloudConfig.sigmoidSteepness ?? 6.0
    );
    const waveData = computeWaveCloudDensity(
      world.wx,
      world.wy,
      earthConfig,
      sources,
      solarWind,
      cloudConfig,
      animationPhaseRef.current
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

    setProbeInfo({
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
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;
    const world = canvasToWorld(clientX, clientY, canvas.width, canvas.height);

    // Handle entity dragging
    if (draggedSourceId) {
      setSources((prev) =>
        prev.map((s) => (s.id === draggedSourceId ? { ...s, x: world.wx, y: world.wy, orbiting: false } : s))
      );
      return;
    }

    if (isDraggingMoon && moonConfig && setMoonConfig) {
      const dx = world.wx - earthConfig.x;
      const dy = world.wy - earthConfig.y;
      const newAngleDeg = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360;
      const newRadius = Math.max(1.3, Math.hypot(dx, dy));
      setMoonConfig((prev) => ({
        ...prev,
        phaseAngleDeg: Number(newAngleDeg.toFixed(1)),
        orbitRadius: Number(newRadius.toFixed(2)),
        physicalDistanceEarthRadii: Number(newRadius.toFixed(2)),
        autoOrbit: false,
      }));
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
    setIsDraggingMoon(false);
    setIsDraggingEarth(false);
    setIsPanning(false);
  };

  // Native non-passive wheel listener to strictly isolate zoom and prevent outer window scrolling
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;

    const onWheelNative = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const zoomFactor = e.deltaY < 0 ? 1.12 : 0.89;
      setZoom((prev) => Math.max(1, Math.min(220, prev * zoomFactor)));
    };

    if (canvas) {
      canvas.addEventListener('wheel', onWheelNative, { passive: false });
    }
    if (container) {
      container.addEventListener('wheel', onWheelNative, { passive: false });
    }

    return () => {
      if (canvas) {
        canvas.removeEventListener('wheel', onWheelNative);
      }
      if (container) {
        container.removeEventListener('wheel', onWheelNative);
      }
    };
  }, [cloudConfig.perspectiveMode, cloudConfig.inspectionMode]);

  const resetView = () => {
    setZoom(75);
    setPan({ x: 0, y: 0 });
    setEarthConfig((prev) => ({ ...prev, x: 0, y: 0 }));
  };

  // Handle Conditional View Rendering for Perspective Modes
  if (cloudConfig.perspectiveMode === 'ground_sky') {
    return (
      <div className="relative w-full h-full min-h-[520px] flex flex-col bg-[#070709] rounded-lg overflow-hidden border border-[#1e1e24] shadow-2xl">
        {/* Top Perspective Navigation */}
        <div className="p-2 bg-[#0e0e13] border-b border-[#1e1e24] flex items-center justify-between gap-2 z-20">
          <div className="flex items-center gap-1 p-0.5 bg-[#14141c] rounded-md border border-[#222230]">
            <button
              onClick={() => setCloudConfig((prev) => ({ ...prev, perspectiveMode: 'space_global' }))}
              className="px-2.5 py-1 text-xs font-mono rounded text-slate-400 hover:text-slate-200 hover:bg-[#1e1e2c] transition-colors flex items-center gap-1.5"
            >
              <Eye className="w-3.5 h-3.5" />
              우주 전역 (Space Global)
            </button>
            <button
              className="px-2.5 py-1 text-xs font-mono rounded bg-cyan-950/60 text-cyan-300 border border-cyan-500/40 font-semibold flex items-center gap-1.5"
            >
              <Compass className="w-3.5 h-3.5 text-cyan-400" />
              지상 관측자 하늘 (Sky Dome)
            </button>
            <button
              onClick={() => {
                setCloudConfig((prev) => ({ ...prev, perspectiveMode: 'space_global', inspectionMode: 'split_3view' }));
              }}
              className="px-2.5 py-1 text-xs font-mono rounded text-slate-400 hover:text-slate-200 hover:bg-[#1e1e2c] transition-colors flex items-center gap-1.5"
            >
              <Columns className="w-3.5 h-3.5" />
              3분할 패턴 검증 (3-Plots)
            </button>
          </div>

          <div className="text-[11px] font-mono text-slate-400 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            지상 관측 지점에서의 파동운 어안 프로젝션
          </div>
        </div>

        <div className="flex-1 w-full overflow-hidden">
          <GroundSkyDomeView
            isPlaying={isPlaying}
            earthConfig={earthConfig}
            sources={sources}
            solarWind={solarWind}
            cloudConfig={cloudConfig}
            setCloudConfig={setCloudConfig}
          />
        </div>
      </div>
    );
  }

  if (cloudConfig.inspectionMode === 'split_3view') {
    return (
      <div className="relative w-full h-full min-h-[520px] flex flex-col bg-[#070709] rounded-lg overflow-hidden border border-[#1e1e24] shadow-2xl">
        {/* Top Perspective Navigation */}
        <div className="p-2 bg-[#0e0e13] border-b border-[#1e1e24] flex items-center justify-between gap-2 z-20">
          <div className="flex items-center gap-1 p-0.5 bg-[#14141c] rounded-md border border-[#222230]">
            <button
              onClick={() => setCloudConfig((prev) => ({ ...prev, inspectionMode: 'none', perspectiveMode: 'space_global' }))}
              className="px-2.5 py-1 text-xs font-mono rounded text-slate-400 hover:text-slate-200 hover:bg-[#1e1e2c] transition-colors flex items-center gap-1.5"
            >
              <Eye className="w-3.5 h-3.5" />
              우주 전역 (Space Global)
            </button>
            <button
              onClick={() => setCloudConfig((prev) => ({ ...prev, perspectiveMode: 'ground_sky' }))}
              className="px-2.5 py-1 text-xs font-mono rounded text-slate-400 hover:text-slate-200 hover:bg-[#1e1e2c] transition-colors flex items-center gap-1.5"
            >
              <Compass className="w-3.5 h-3.5" />
              지상 관측자 하늘 (Sky Dome)
            </button>
            <button
              className="px-2.5 py-1 text-xs font-mono rounded bg-emerald-950/60 text-emerald-300 border border-emerald-500/40 font-semibold flex items-center gap-1.5"
            >
              <Columns className="w-3.5 h-3.5 text-emerald-400" />
              3분할 패턴 검증 (3-Plots)
            </button>
          </div>

          <div className="text-[11px] font-mono text-slate-400 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            수치 검증 스크립트 1:1 동기화 3-Plot 비교 화면
          </div>
        </div>

        <div className="flex-1 w-full overflow-hidden">
          <CloudInspectionSplitView
            isPlaying={isPlaying}
            earthConfig={earthConfig}
            sources={sources}
            solarWind={solarWind}
            cloudConfig={cloudConfig}
            setCloudConfig={setCloudConfig}
          />
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative w-full h-full min-h-0 bg-[#070709] rounded-lg overflow-hidden border border-[#1e1e24] shadow-2xl flex flex-col">
      <FieldReadout context={context} research={research} error={field.error} calculationMs={field.geometry?.elapsedMs} />
      {currentLayers.earthBody && <CoreFlowInset context={context} research={research} playing={isPlaying} />}
      <p className="absolute bottom-12 left-2 z-20 text-[10px] bg-slate-950/90 p-1 pointer-events-none">구름층: {(cloudConfig.cloudAltitudeKm??12)} ± {(cloudConfig.cloudLayerHalfWidthKm??1.5)} km · 고도 표시 ×{cloudConfig.altitudeDisplayGain??1} · 점 최소 크기는 위치 표식</p>
      {/* Top Floating Control Bar - High Density */}
      <div className="absolute top-2.5 left-2.5 right-2.5 z-20 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        {/* Left: Perspective and Mode Switchers */}
        <div className="flex items-center gap-1.5 flex-wrap pointer-events-auto">
          {/* Perspective Selector */}
          <div className="flex items-center gap-0.5 p-0.5 bg-[#0e0e13]/95 backdrop-blur-md rounded-md border border-[#1e1e24] shadow-md">
            <button
              onClick={() => setCloudConfig((prev) => ({ ...prev, perspectiveMode: 'space_global' }))}
              className="px-2 py-1 text-[11px] font-mono font-medium rounded bg-[#1a1a26] text-cyan-300 border border-cyan-500/40 shadow-sm font-semibold flex items-center gap-1"
              title="우주 전역 2D 뷰"
            >
              <Eye className="w-3 h-3 text-cyan-400" />
              우주전역
            </button>
            <button
              onClick={() => setCloudConfig((prev) => ({ ...prev, perspectiveMode: 'ground_sky' }))}
              className="px-2 py-1 text-[11px] font-mono font-medium rounded text-slate-400 hover:text-slate-200 hover:bg-[#14141c] transition-colors flex items-center gap-1"
              title="지상 관측자 하늘 뷰 (어안 렌즈)"
            >
              <Compass className="w-3 h-3 text-sky-400" />
              지상하늘
            </button>
            <button
              onClick={() => setCloudConfig((prev) => ({ ...prev, inspectionMode: 'split_3view' }))}
              className="px-2 py-1 text-[11px] font-mono font-medium rounded text-slate-400 hover:text-slate-200 hover:bg-[#14141c] transition-colors flex items-center gap-1"
              title="3분할 패턴 검증 뷰"
            >
              <Columns className="w-3 h-3 text-emerald-400" />
              3분할검증
            </button>
          </div>

          {/* Inspection View Mode Selector */}
          <div className="flex items-center gap-0.5 p-0.5 bg-[#0e0e13]/95 backdrop-blur-md rounded-md border border-[#1e1e24] shadow-md">
            <button
              onClick={() => setCloudConfig((prev) => ({ ...prev, inspectionMode: 'none' }))}
              className={`px-2 py-1 text-[11px] font-mono font-medium rounded transition-colors ${
                !cloudConfig.inspectionMode || cloudConfig.inspectionMode === 'none'
                  ? 'bg-[#1a1a26] text-slate-200 border border-slate-600/50 font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#14141c]'
              }`}
              title="표준 다중 물리 시뮬레이션 모드"
            >
              표준
            </button>
            <button
              onClick={() => setCloudConfig((prev) => ({ ...prev, inspectionMode: 'cloud_density' }))}
              className={`px-2 py-1 text-[11px] font-mono font-medium rounded transition-colors flex items-center gap-1 ${
                cloudConfig.inspectionMode === 'cloud_density'
                  ? 'bg-cyan-950/70 text-cyan-300 border border-cyan-500/50 font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#14141c]'
              }`}
              title="구름 레이어만 고대비 단독 렌더링 (Cloud-Only Mode)"
            >
              <Waves className="w-3 h-3 text-cyan-400" />
              구름단독
            </button>
            <button
              onClick={() => setCloudConfig((prev) => ({ ...prev, inspectionMode: 'hotspot_mask' }))}
              className={`px-2 py-1 text-[11px] font-mono font-medium rounded transition-colors flex items-center gap-1 ${
                cloudConfig.inspectionMode === 'hotspot_mask'
                  ? 'bg-orange-950/70 text-orange-300 border border-orange-500/50 font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#14141c]'
              }`}
              title="국소 활성화 마스크 M(x, y) 분석 모드"
            >
              <Flame className="w-3 h-3 text-orange-400" />
              마스크
            </button>
            <button
              onClick={() => setCloudConfig((prev) => ({ ...prev, inspectionMode: 'cloud_vector_overlay' }))}
              className={`px-2 py-1 text-[11px] font-mono font-medium rounded transition-colors flex items-center gap-1 ${
                cloudConfig.inspectionMode === 'cloud_vector_overlay'
                  ? 'bg-sky-950/70 text-sky-300 border border-sky-500/50 font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#14141c]'
              }`}
              title="구름 밀도 + 반투명 자기력선 정렬 오버레이"
            >
              <Layers className="w-3 h-3 text-sky-400" />
              벡터오버레이
            </button>
          </div>

          {/* Standard Physics Field Modes (only active when not in inspection isolated mode) */}
          {(!cloudConfig.inspectionMode || cloudConfig.inspectionMode === 'none') && (
            <div className="hidden xl:flex items-center gap-0.5 p-0.5 bg-[#0e0e13]/95 backdrop-blur-md rounded-md border border-[#1e1e24] shadow-md">
              <button
                id="btn-mode-streamlines"
                onClick={() => setRenderMode('streamlines')}
                className={`px-2 py-1 text-[11px] font-mono font-medium rounded transition-colors flex items-center gap-1 ${
                  renderMode === 'streamlines'
                    ? 'bg-[#1a1a26] text-cyan-300 border border-cyan-500/40 shadow-sm font-semibold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-[#14141c]'
                }`}
              >
                <Activity className="w-3 h-3 text-cyan-400" />
                자기력선
              </button>
              <button
                id="btn-mode-heatmap"
                onClick={() => setRenderMode('heatmap')}
                className={`px-2 py-1 text-[11px] font-mono font-medium rounded transition-colors flex items-center gap-1 ${
                  renderMode === 'heatmap'
                    ? 'bg-[#1a1a26] text-purple-300 border border-purple-500/40 shadow-sm font-semibold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-[#14141c]'
                }`}
              >
                <Flame className="w-3 h-3 text-purple-400" />
                히트맵
              </button>
              <button
                id="btn-mode-composite"
                onClick={() => setRenderMode('composite')}
                className={`px-2 py-1 text-[11px] font-mono font-medium rounded transition-colors flex items-center gap-1 ${
                  renderMode === 'composite'
                    ? 'bg-[#1a1a26] text-emerald-300 border border-emerald-500/40 shadow-sm font-semibold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-[#14141c]'
                }`}
              >
                <Layers className="w-3 h-3 text-emerald-400" />
                통합
              </button>
            </div>
          )}
        </div>

        {/* Right: Simulation Controls & Quick Gamma/Resolution */}
        <div className="flex items-center gap-1.5 p-0.5 bg-[#0e0e13]/95 backdrop-blur-md rounded-md border border-[#1e1e24] shadow-md pointer-events-auto">
          {/* Quick Gamma Slider (when in inspection mode) */}
          {cloudConfig.inspectionMode && cloudConfig.inspectionMode !== 'none' && (
            <div className="flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-mono bg-[#14141d] rounded border border-[#222230]">
              <span className="text-slate-400">γ:</span>
              <strong className="text-cyan-300">{(cloudConfig.gamma ?? 0.6).toFixed(2)}</strong>
              <input
                type="range"
                min="0.3"
                max="1.2"
                step="0.05"
                value={cloudConfig.gamma ?? 0.6}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setCloudConfig((prev) => ({ ...prev, gamma: val }));
                }}
                className="w-14 accent-cyan-400 h-1 bg-[#222232] rounded"
              />
            </div>
          )}

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
            onClick={() => setZoom((prev) => Math.max(1, prev * 0.85))}
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

      {/* Top-Right Floating Visual Elements & Layer Controller Panel */}
      <div className="absolute top-12 right-2.5 z-30 pointer-events-auto">
        <button className="absolute bottom-3 left-28 z-30 bg-slate-900 rounded border border-slate-700 px-2 py-1 text-[10px]" onClick={() => { const fitted=Math.max(1,Math.min(containerRef.current?.clientWidth??800,containerRef.current?.clientHeight??600)/((moonConfig?.physicalDistanceEarthRadii??60.3)*2.4)); setZoom(fitted); setPan({ x:-earthConfig.x*fitted,y:earthConfig.y*fitted }); }}>달 궤도 맞춤</button>
        <VisualElementsGuidePanel
          layerVisibility={currentLayers}
          setLayerVisibility={updateLayers}
        />
      </div>

      {/* Main Canvas Element */}
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onContextMenu={handleContextMenu}
        className="w-full h-full cursor-grab active:cursor-grabbing block"
      />

      {/* Floating Bottom HUD Overlay - High Density Monospace */}
      <div className="absolute bottom-2.5 left-2.5 z-20 flex items-center gap-2.5 px-2.5 py-1 bg-[#0e0e13]/90 backdrop-blur-md rounded border border-[#1e1e24] text-[10px] font-mono text-slate-300 shadow-xl pointer-events-none flex-wrap">
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
        {cloudConfig.weatherData && (
          <>
            <div className="w-px h-3 bg-[#262632]" />
            <div className="text-cyan-300 flex items-center gap-1">
              <Wind className="w-3 h-3 text-cyan-400" />
              WIND (u,v): <span className="font-bold text-white">({cloudConfig.weatherData.windU}, {cloudConfig.weatherData.windV}) m/s</span>
            </div>
            <div className="w-px h-3 bg-[#262632] hidden md:block" />
            <div className="text-rose-300 hidden md:flex items-center gap-1">
              <Zap className="w-3 h-3 text-rose-400" />
              Kp: <span className="font-bold text-white">{cloudConfig.weatherData.kpIndex.toFixed(1)}</span>
            </div>
          </>
        )}
        <div className="w-px h-3 bg-[#262632] hidden sm:block" />
        <div className="text-cyan-400/80 hidden sm:flex items-center gap-1">
          <span>우클릭: 지점 정밀 프로브 측정</span>
        </div>
      </div>

      {/* Right-Click Vector Probe & Hotspot Inspector Tooltip */}
      {probeInfo && (
        <div
          className="absolute z-30 pointer-events-auto p-2.5 bg-[#0f0f15]/98 backdrop-blur-md rounded-lg border border-cyan-500/40 shadow-2xl text-[10px] font-mono text-slate-200 min-w-[225px] select-text"
          style={{
            left: Math.min(probeInfo.x + 14, (containerRef.current?.clientWidth || 800) - 245),
            top: Math.min(probeInfo.y + 14, (containerRef.current?.clientHeight || 600) - 210),
          }}
        >
          <div className="text-cyan-400 font-bold mb-1.5 flex items-center justify-between border-b border-[#222230] pb-1">
            <div className="flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-cyan-400" />
              <span>VECTOR PROBE & HOTSPOT</span>
            </div>
            <button
              onClick={() => setProbeInfo(null)}
              className="p-0.5 text-slate-400 hover:text-white hover:bg-[#222232] rounded transition-colors"
              title="Close Probe"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-slate-300">
            <span className="text-slate-500">Coord (x, y):</span>
            <span className="text-right font-semibold">({probeInfo.worldX.toFixed(2)}, {probeInfo.worldY.toFixed(2)})</span>
            <span>중심 거리</span><span>{distanceLabel({x:probeInfo.worldX,y:probeInfo.worldY,z:0},earthConfig)}</span>
            <span className="text-slate-500">|B_total|:</span>
            <span className="text-right text-emerald-400 font-bold">{formatLogNt(sampleField({x:probeInfo.worldX,y:probeInfo.worldY,z:0},context).logNt)} nT</span>
            <span className="text-slate-500">(Bx, By):</span>
            <span className="text-right">({probeInfo.bx.toFixed(2)}, {probeInfo.by.toFixed(2)})</span>
            <span className="text-slate-500">∇|B|:</span>
            <span className="text-right text-purple-400">{probeInfo.gradMag.toFixed(3)}</span>
            <span className="text-slate-500">Interference I:</span>
            <span className="text-right text-sky-400 font-semibold">{probeInfo.interference.toFixed(3)}</span>
            <span className="text-slate-500">Mask M(x,y):</span>
            <span className={`text-right font-bold ${probeInfo.hotspotMask > 0.5 ? 'text-pink-400' : 'text-slate-400'}`}>
              {(probeInfo.hotspotMask * 100).toFixed(0)}%
            </span>
            <span className="text-slate-500">Wave Cloud C:</span>
            <span className="text-right text-cyan-300 font-bold">{probeInfo.waveCloudDensity.toFixed(3)}</span>
            {probeInfo.stressVal > 0 && (
              <>
                <span className="text-slate-500">Crust Stress:</span>
                <span className="text-right text-amber-400 font-bold">{(probeInfo.stressVal * 100).toFixed(1)}%</span>
              </>
            )}
          </div>
          <div className="mt-1.5 pt-1 border-t border-[#1e1e28] text-[9px] text-slate-500 flex items-center justify-between">
            <span>우클릭: 다른 지점 측정</span>
            <button
              onClick={() => setProbeInfo(null)}
              className="text-cyan-400 hover:underline"
            >
              닫기
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
