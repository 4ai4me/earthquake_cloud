import React, { useRef, useEffect, useState, useMemo } from 'react';
import {
  AtmosphericCloudConfig,
  EarthDipoleConfig,
  ExternalMagneticSource,
  SolarWindConfig,
} from '../types';
import {
  computeTotalMagneticField,
  computeFieldGradient,
  computeInterferenceIntensity,
  computeHotspotMask,
  computeWaveCloudDensity,
  computeNaturalWeatherCloudDensity,
  applyCloudGamma,
  getInspectionCloudColor,
} from '../physics/magneticEngine';
import { computeAerosolCloudBaselineMultiplier } from '../physics/cernCloudAerosolEngine';
import {
  Columns,
  Eye,
  Layers,
  Maximize2,
  Sliders,
  Sparkles,
  Waves,
  Zap,
} from 'lucide-react';

interface CloudInspectionSplitViewProps {
  earthConfig: EarthDipoleConfig;
  sources: ExternalMagneticSource[];
  solarWind: SolarWindConfig;
  cloudConfig: AtmosphericCloudConfig;
  setCloudConfig: React.Dispatch<React.SetStateAction<AtmosphericCloudConfig>>;
}

export function CloudInspectionSplitView({
  earthConfig,
  sources,
  solarWind,
  cloudConfig,
  setCloudConfig,
}: CloudInspectionSplitViewProps) {
  const canvas1Ref = useRef<HTMLCanvasElement | null>(null);
  const canvas2Ref = useRef<HTMLCanvasElement | null>(null);
  const canvas3Ref = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const aerosolBaselineMultiplier = useMemo(
    () => computeAerosolCloudBaselineMultiplier(cloudConfig.aerosolExperiment),
    [cloudConfig.aerosolExperiment]
  );

  // Wheel isolation
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const preventScroll = (e: WheelEvent) => {
      e.stopPropagation();
    };
    el.addEventListener('wheel', preventScroll, { passive: true });
    return () => el.removeEventListener('wheel', preventScroll);
  }, []);

  const [gamma, setGamma] = useState<number>(cloudConfig.gamma ?? 0.6);
  const [streamlineAlpha, setStreamlineAlpha] = useState<number>(
    cloudConfig.streamlineAlpha ?? 0.4
  );
  const [resolution, setResolution] = useState<'normal' | 'high'>('high');

  // Animation phase
  const phaseRef = useRef<number>(0);

  useEffect(() => {
    let animId: number;
    let lastTime = performance.now();

    const render = (time: number) => {
      const dt = (time - lastTime) / 1000;
      lastTime = time;
      phaseRef.current += dt * 1.2;
      const animPhase = phaseRef.current;

      const c1 = canvas1Ref.current;
      const c2 = canvas2Ref.current;
      const c3 = canvas3Ref.current;
      if (!c1 || !c2 || !c3) return;

      const ctx1 = c1.getContext('2d');
      const ctx2 = c2.getContext('2d');
      const ctx3 = c3.getContext('2d');
      if (!ctx1 || !ctx2 || !ctx3) return;

      const w = c1.width;
      const h = c1.height;
      const step = resolution === 'high' ? 4 : 6;

      // Clear dark backgrounds
      [ctx1, ctx2, ctx3].forEach((ctx) => {
        ctx.fillStyle = '#050507';
        ctx.fillRect(0, 0, w, h);
      });

      // World coordinate bounding box (-5 to 5, -3.8 to 3.8)
      const minX = -5.0;
      const maxX = 5.0;
      const minY = -3.8;
      const maxY = 3.8;

      const canvasToWorld = (px: number, py: number) => {
        const wx = minX + (px / w) * (maxX - minX);
        const wy = maxY - (py / h) * (maxY - minY);
        return { wx, wy };
      };

      const worldToCanvas = (wx: number, wy: number) => {
        const px = ((wx - minX) / (maxX - minX)) * w;
        const py = ((maxY - wy) / (maxY - minY)) * h;
        return { px, py };
      };

      // 1. Grid Pixel Loop across 2D plane
      for (let py = 0; py < h; py += step) {
        for (let px = 0; px < w; px += step) {
          const { wx, wy } = canvasToWorld(px + step / 2, py + step / 2);

          const waveData = computeWaveCloudDensity(
            wx,
            wy,
            earthConfig,
            sources,
            solarWind,
            cloudConfig,
            animPhase
          );

          // [View 1] Pure Cloud Pattern with Gamma (Natural Weather Background + Stimulated Wave Cloud)
          const naturalDensity = computeNaturalWeatherCloudDensity(wx, wy, cloudConfig.weatherData, animPhase, aerosolBaselineMultiplier);
          const totalCloudDensity = Math.max(waveData.density, naturalDensity * 0.65);

          if (totalCloudDensity > 0.01) {
            const visDensity = applyCloudGamma(totalCloudDensity, gamma);
            ctx1.fillStyle = getInspectionCloudColor(visDensity, 'satellite_bone', visDensity * 0.95);
            ctx1.fillRect(px, py, step, step);
          }

          // [View 2] Localized Hotspot Trigger Zone Mask M(x, y)
          if (waveData.mask > 0.02) {
            const m = Math.min(1.0, waveData.mask);
            // Inferno colormap: black -> purple -> orange -> yellow
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
            ctx2.fillStyle = `rgba(${r}, ${g}, ${b}, ${Math.min(1.0, m * 0.95)})`;
            ctx2.fillRect(px, py, step, step);
          }

          // [View 3] Cloud Base for Vector Overlay
          if (totalCloudDensity > 0.01) {
            const visDensity = applyCloudGamma(totalCloudDensity, gamma);
            ctx3.fillStyle = getInspectionCloudColor(visDensity, 'satellite_bone', visDensity * 0.85);
            ctx3.fillRect(px, py, step, step);
          }
        }
      }

      // [View 3] Streamlines Vector Overlay
      const numLines = 22;
      const seedPoints: { x: number; y: number }[] = [];
      const earthR = earthConfig.radius;

      // Seed points around Earth dipole
      for (let i = 0; i < numLines; i++) {
        const ang = (i / numLines) * Math.PI * 2;
        seedPoints.push({
          x: earthConfig.x + (earthR + 0.15) * Math.cos(ang),
          y: earthConfig.y + (earthR + 0.15) * Math.sin(ang),
        });
      }

      ctx3.strokeStyle = `rgba(56, 189, 248, ${streamlineAlpha})`;
      ctx3.lineWidth = 1.0;

      seedPoints.forEach((pt) => {
        // Forward RK4 trace
        let curX = pt.x;
        let curY = pt.y;
        ctx3.beginPath();
        const startP = worldToCanvas(curX, curY);
        ctx3.moveTo(startP.px, startP.py);

        for (let s = 0; s < 120; s++) {
          const f = computeTotalMagneticField(curX, curY, earthConfig, sources, solarWind);
          if (f.magnitude < 1e-4) break;
          const ds = 0.08;
          curX += (f.bx / f.magnitude) * ds;
          curY += (f.by / f.magnitude) * ds;

          if (curX < minX || curX > maxX || curY < minY || curY > maxY) break;
          const p = worldToCanvas(curX, curY);
          ctx3.lineTo(p.px, p.py);
        }
        ctx3.stroke();
      });

      // Subtle Source & Earth markers in View 2 & 3
      [ctx2, ctx3].forEach((ctx) => {
        const ep = worldToCanvas(earthConfig.x, earthConfig.y);
        ctx.strokeStyle = '#0284c7';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(ep.px, ep.py, ((earthR) / (maxX - minX)) * w, 0, Math.PI * 2);
        ctx.stroke();

        sources.forEach((src) => {
          if (!src.active) return;
          const sp = worldToCanvas(src.x, src.y);
          ctx.fillStyle = src.type === 'monopole_n' ? '#ef4444' : '#3b82f6';
          ctx.beginPath();
          ctx.arc(sp.px, sp.py, 4, 0, Math.PI * 2);
          ctx.fill();
        });
      });

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [earthConfig, sources, solarWind, cloudConfig, gamma, streamlineAlpha, resolution]);

  return (
    <div ref={containerRef} className="w-full h-full flex flex-col bg-[#07070a] rounded-lg overflow-hidden border border-[#1e1e24] text-slate-200">
      {/* Top Header */}
      <div className="p-3 bg-[#0f0f14] border-b border-[#1e1e24] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-md bg-emerald-950/60 border border-emerald-500/30 text-emerald-400">
            <Columns className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
              <span>지진운(양떼구름) 전용 3분할 패턴 검증 뷰 (Cloud Inspection 3-Plots)</span>
              <span className="px-1.5 py-0.2 rounded bg-emerald-900/60 text-emerald-300 text-[10px] font-mono border border-emerald-500/30 font-semibold">
                500x500 Matrix
              </span>
            </div>
            <div className="text-[10px] text-slate-400 font-mono">
              수치 검증 스크립트와 1:1 동기화된 순수 구름, 핫스팟 트리거 마스크, 자기력선 정렬 오버레이
            </div>
          </div>
        </div>

        {/* Quick Tuning Controls */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="text-[10px] text-slate-400">Gamma (γ):</span>
            <strong className="text-cyan-300 font-bold">{gamma.toFixed(2)}</strong>
            <input
              type="range"
              min="0.3"
              max="1.2"
              step="0.05"
              value={gamma}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                setGamma(val);
                setCloudConfig((prev) => ({ ...prev, gamma: val }));
              }}
              className="w-20 accent-cyan-400 h-1 bg-[#181822] rounded"
            />
          </div>

          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="text-[10px] text-slate-400">벡터 투명도:</span>
            <strong className="text-sky-300 font-bold">{streamlineAlpha.toFixed(2)}</strong>
            <input
              type="range"
              min="0.1"
              max="0.9"
              step="0.05"
              value={streamlineAlpha}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                setStreamlineAlpha(val);
                setCloudConfig((prev) => ({ ...prev, streamlineAlpha: val }));
              }}
              className="w-20 accent-sky-400 h-1 bg-[#181822] rounded"
            />
          </div>
        </div>
      </div>

      {/* 3-Plots Synchronous Grid */}
      <div className="flex-1 p-2 grid grid-cols-1 md:grid-cols-3 gap-2 bg-[#050508] overflow-hidden">
        {/* Pane 1: Pure Cloud Pattern */}
        <div className="flex flex-col bg-[#0b0b10] rounded border border-[#1e1e28] overflow-hidden">
          <div className="px-2.5 py-1.5 bg-[#12121a] border-b border-[#1e1e28] flex items-center justify-between">
            <div className="text-[11px] font-bold text-slate-200 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-slate-300" />
              1. Pure Cloud Pattern (가시광선 모드)
            </div>
            <span className="text-[9px] font-mono text-slate-400">Bone Colormap</span>
          </div>
          <div className="flex-1 relative flex items-center justify-center p-1">
            <canvas ref={canvas1Ref} width={380} height={380} className="w-full h-full object-contain" />
          </div>
        </div>

        {/* Pane 2: Hotspot Mask */}
        <div className="flex flex-col bg-[#0b0b10] rounded border border-[#1e1e28] overflow-hidden">
          <div className="px-2.5 py-1.5 bg-[#12121a] border-b border-[#1e1e28] flex items-center justify-between">
            <div className="text-[11px] font-bold text-orange-300 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-orange-400" />
              2. Localized Hotspot Mask M(x, y)
            </div>
            <span className="text-[9px] font-mono text-orange-400">Inferno Zone</span>
          </div>
          <div className="flex-1 relative flex items-center justify-center p-1">
            <canvas ref={canvas2Ref} width={380} height={380} className="w-full h-full object-contain" />
          </div>
        </div>

        {/* Pane 3: Vector Overlay */}
        <div className="flex flex-col bg-[#0b0b10] rounded border border-[#1e1e28] overflow-hidden">
          <div className="px-2.5 py-1.5 bg-[#12121a] border-b border-[#1e1e28] flex items-center justify-between">
            <div className="text-[11px] font-bold text-sky-300 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-sky-400" />
              3. Cloud & Field Alignment Overlay
            </div>
            <span className="text-[9px] font-mono text-sky-400">Low-Alpha B-Lines</span>
          </div>
          <div className="flex-1 relative flex items-center justify-center p-1">
            <canvas ref={canvas3Ref} width={380} height={380} className="w-full h-full object-contain" />
          </div>
        </div>
      </div>
    </div>
  );
}
