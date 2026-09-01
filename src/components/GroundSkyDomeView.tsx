import React, { useRef, useEffect, useState, useMemo } from 'react';
import {
  AtmosphericCloudConfig,
  EarthDipoleConfig,
  ExternalMagneticSource,
  SolarWindConfig,
} from '../types';
import {
  computeTotalMagneticField,
  computeWaveCloudDensity,
  applyCloudGamma,
  getInspectionCloudColor,
  mapSkyDomeToAtmosphere,
} from '../physics/magneticEngine';
import {
  Compass,
  Eye,
  Layers,
  MapPin,
  Sliders,
  Sparkles,
  Sun,
  Waves,
  Zap,
} from 'lucide-react';

interface GroundSkyDomeViewProps {
  earthConfig: EarthDipoleConfig;
  sources: ExternalMagneticSource[];
  solarWind: SolarWindConfig;
  cloudConfig: AtmosphericCloudConfig;
  setCloudConfig: React.Dispatch<React.SetStateAction<AtmosphericCloudConfig>>;
}

export function GroundSkyDomeView({
  earthConfig,
  sources,
  solarWind,
  cloudConfig,
  setCloudConfig,
}: GroundSkyDomeViewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const [gamma, setGamma] = useState<number>(cloudConfig.gamma ?? 0.6);
  const [observerAngle, setObserverAngle] = useState<number>(
    cloudConfig.groundObserver?.angleDeg ?? 45
  );
  const [showOverheadVectors, setShowOverheadVectors] = useState<boolean>(true);
  const [showCelestialGrid, setShowCelestialGrid] = useState<boolean>(true);
  const [palette, setPalette] = useState<'satellite_bone' | 'pure_white' | 'deep_sky_cyan' | 'night_infrared'>(
    cloudConfig.colorPalette ?? 'satellite_bone'
  );
  const [resolution, setResolution] = useState<'standard' | 'high'>('high');

  // Animation phase
  const phaseRef = useRef<number>(0);

  // Observer presets
  const presets = [
    { label: '대한민국 수원 상공 (37.26°N)', angle: 37.26 },
    { label: '북반구 단층대 상공 (45°)', angle: 45 },
    { label: '지자기 북극 상공 (90°)', angle: 90 },
    { label: '태양풍 주간면 적도 (0°)', angle: 0 },
    { label: '남반구 고위도 (270°)', angle: 270 },
    { label: '야간면 자기권미 (180°)', angle: 180 },
  ];

  // Native non-passive wheel event listener to prevent outer page scroll and isolate FOV zoom
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onWheelNative = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const delta = e.deltaY < 0 ? -4 : 4;
      setCloudConfig((prev) => {
        const currentFov = prev.groundObserver?.fovDeg ?? 140;
        const nextFov = Math.max(80, Math.min(170, currentFov + delta));
        return {
          ...prev,
          groundObserver: {
            ...(prev.groundObserver || {
              angleDeg: observerAngle,
              label: '현재 지점',
              altitudeKm: 8.0,
              fovDeg: 140,
              azimuthOffsetDeg: 0,
            }),
            fovDeg: nextFov,
          },
        };
      });
    };

    canvas.addEventListener('wheel', onWheelNative, { passive: false });
    return () => {
      canvas.removeEventListener('wheel', onWheelNative);
    };
  }, [observerAngle, setCloudConfig]);

  useEffect(() => {
    let lastTime = performance.now();

    const render = (time: number) => {
      const dt = (time - lastTime) / 1000;
      lastTime = time;
      phaseRef.current += dt * 1.5;

      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const width = canvas.width;
      const height = canvas.height;
      const centerX = width / 2;
      const centerY = height / 2;
      const domeRadius = Math.min(centerX, centerY) * 0.88;

      // 1. Deep Celestial Space / Night Sky Background
      ctx.fillStyle = '#050508';
      ctx.fillRect(0, 0, width, height);

      // Clip to circular Sky Dome
      ctx.save();
      ctx.beginPath();
      ctx.arc(centerX, centerY, domeRadius, 0, Math.PI * 2);
      ctx.clip();

      // Background Sky Gradient
      const skyGrad = ctx.createRadialGradient(
        centerX,
        centerY,
        0,
        centerX,
        centerY,
        domeRadius
      );
      skyGrad.addColorStop(0, '#090d16');
      skyGrad.addColorStop(0.7, '#06080e');
      skyGrad.addColorStop(1, '#020306');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, width, height);

      // 2. Render Sky Dome Altocumulus Wave Cloud Field (High-Res sampling)
      const step = resolution === 'high' ? 4 : 6;
      const currentPhase = phaseRef.current;

      for (let py = -domeRadius; py <= domeRadius; py += step) {
        for (let px = -domeRadius; px <= domeRadius; px += step) {
          const rSq = px * px + py * py;
          if (rSq <= domeRadius * domeRadius) {
            const u = px / domeRadius;
            const v = py / domeRadius;

            // Map Fish-eye coordinate to overhead atmospheric position (wx, wy)
            const atm = mapSkyDomeToAtmosphere(
              u,
              v,
              earthConfig,
              observerAngle,
              8.0,
              cloudConfig.groundObserver?.fovDeg ?? 140
            );

            if (atm.isVisible) {
              const waveData = computeWaveCloudDensity(
                atm.wx,
                atm.wy,
                earthConfig,
                sources,
                solarWind,
                cloudConfig,
                currentPhase
              );

              if (waveData.density > 0.02) {
                // Apply Non-linear Gamma Correction: C_vis = C_density^gamma
                const visDensity = applyCloudGamma(waveData.density, gamma);

                // Perspective edge falloff near horizon
                const distNorm = Math.sqrt(u * u + v * v);
                const horizonFactor = Math.max(0.2, 1 - Math.pow(distNorm, 3) * 0.5);
                const finalAlpha = Math.min(1.0, visDensity * horizonFactor * cloudConfig.cloudOpacity);

                ctx.fillStyle = getInspectionCloudColor(visDensity, palette, finalAlpha);
                ctx.fillRect(
                  centerX + px - step / 2,
                  centerY + py - step / 2,
                  step + 0.5,
                  step + 0.5
                );
              }
            }
          }
        }
      }

      // 3. Overhead Magnetic Vector Field Overlay
      if (showOverheadVectors) {
        const vecStep = 42;
        for (let py = -domeRadius + 20; py <= domeRadius - 20; py += vecStep) {
          for (let px = -domeRadius + 20; px <= domeRadius - 20; px += vecStep) {
            const rNorm = Math.sqrt(px * px + py * py) / domeRadius;
            if (rNorm <= 0.88) {
              const u = px / domeRadius;
              const v = py / domeRadius;
              const atm = mapSkyDomeToAtmosphere(
                u,
                v,
                earthConfig,
                observerAngle,
                8.0,
                cloudConfig.groundObserver?.fovDeg ?? 140
              );

              if (atm.isVisible) {
                const field = computeTotalMagneticField(
                  atm.wx,
                  atm.wy,
                  earthConfig,
                  sources,
                  solarWind
                );

                if (field.magnitude > 0.05) {
                  const angle = Math.atan2(field.by, field.bx);
                  const len = 12;
                  const cx = centerX + px;
                  const cy = centerY + py;

                  ctx.save();
                  ctx.translate(cx, cy);
                  ctx.rotate(angle);

                  // Thin cyan streamline needle
                  ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
                  ctx.lineWidth = 1.0;
                  ctx.beginPath();
                  ctx.moveTo(-len / 2, 0);
                  ctx.lineTo(len / 2, 0);
                  ctx.stroke();

                  // Arrow head
                  ctx.fillStyle = 'rgba(56, 189, 248, 0.6)';
                  ctx.beginPath();
                  ctx.moveTo(len / 2, 0);
                  ctx.lineTo(len / 2 - 3, -2);
                  ctx.lineTo(len / 2 - 3, 2);
                  ctx.closePath();
                  ctx.fill();

                  ctx.restore();
                }
              }
            }
          }
        }
      }

      ctx.restore(); // Restore clipping

      // 4. Fish-Eye Celestial Grid & Zenith Elevation Rings
      if (showCelestialGrid) {
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.2)';
        ctx.lineWidth = 1;

        // Elevation rings: 30 deg, 60 deg, and Horizon (90 deg)
        [0.33, 0.66, 1.0].forEach((frac, idx) => {
          ctx.beginPath();
          ctx.arc(centerX, centerY, domeRadius * frac, 0, Math.PI * 2);
          ctx.stroke();

          // Altitude labels
          const elevLabel = idx === 0 ? '60°' : idx === 1 ? '30°' : 'Horizon (0°)';
          ctx.fillStyle = 'rgba(148, 163, 184, 0.5)';
          ctx.font = '9px monospace';
          ctx.fillText(elevLabel, centerX + 4, centerY - domeRadius * frac + 10);
        });

        // Crosshairs (North-South, East-West)
        ctx.beginPath();
        ctx.moveTo(centerX, centerY - domeRadius);
        ctx.lineTo(centerX, centerY + domeRadius);
        ctx.moveTo(centerX - domeRadius, centerY);
        ctx.lineTo(centerX + domeRadius, centerY);
        ctx.stroke();

        // Zenith Center Cross
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(centerX, centerY, 4, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#38bdf8';
        ctx.fillText('Zenith (90° 천정)', centerX + 8, centerY - 8);

        // Cardinal Direction Labels
        ctx.font = 'bold 11px monospace';
        ctx.fillStyle = '#e2e8f0';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        ctx.fillText('N (북)', centerX, centerY - domeRadius - 12);
        ctx.fillText('S (남)', centerX, centerY + domeRadius + 14);
        ctx.fillText('W (서)', centerX - domeRadius - 14, centerY);
        ctx.fillText('E (동)', centerX + domeRadius + 14, centerY);
      }

      // 5. Outer Dome Ring Border
      ctx.strokeStyle = '#22d3ee';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(centerX, centerY, domeRadius, 0, Math.PI * 2);
      ctx.stroke();

      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [
    earthConfig,
    sources,
    solarWind,
    cloudConfig,
    observerAngle,
    gamma,
    palette,
    showOverheadVectors,
    showCelestialGrid,
    resolution,
  ]);

  return (
    <div className="w-full h-full flex flex-col bg-[#07070a] rounded-lg overflow-hidden border border-[#1e1e24] text-slate-200">
      {/* Top Header & Observation Control Bar */}
      <div className="p-3 bg-[#0f0f14] border-b border-[#1e1e24] flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-md bg-cyan-950/60 border border-cyan-500/30 text-cyan-400">
            <Compass className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
              <span>지상 관측자 하늘 뷰 (Ground Observer Sky Dome)</span>
              <span className="px-1.5 py-0.2 rounded bg-cyan-900/60 text-cyan-300 text-[10px] font-mono border border-cyan-500/30 font-semibold">
                Fish-Eye 140°
              </span>
            </div>
            <div className="text-[10px] text-slate-400 font-mono">
              지표면 관측점 상공 대기층의 국소 자기장 정렬 파상운(양떼구름) 1인칭 투영
            </div>
          </div>
        </div>

        {/* Observer Ground Station Preset Selector */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] text-slate-400 font-mono flex items-center gap-1">
            <MapPin className="w-3 h-3 text-cyan-400" />
            관측 위치:
          </span>
          <select
            id="select-observer-preset"
            value={observerAngle}
            onChange={(e) => setObserverAngle(parseFloat(e.target.value))}
            className="bg-[#15151e] border border-[#2c2c3e] text-cyan-300 text-xs rounded px-2 py-1 font-mono focus:outline-none focus:border-cyan-400"
          >
            {presets.map((p) => (
              <option key={p.angle} value={p.angle}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Canvas Area */}
      <div className="flex-1 relative flex items-center justify-center p-2 bg-[#050508]">
        <canvas
          ref={canvasRef}
          width={640}
          height={480}
          className="w-full h-full max-h-[500px] object-contain rounded-md shadow-2xl"
        />

        {/* Top-Right Meteorological Status Badge */}
        {cloudConfig.weatherData && (
          <div className="absolute top-4 right-4 p-2 bg-[#0c0c14]/90 backdrop-blur-md rounded-lg border border-[#222232] text-[10px] font-mono text-slate-300 shadow-xl flex flex-col gap-1 pointer-events-none">
            <div className="flex items-center gap-1.5 text-cyan-300 font-bold border-b border-[#1e1e28] pb-1">
              <Compass className="w-3.5 h-3.5 text-cyan-400" />
              <span>{cloudConfig.weatherData.stationName}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-slate-500">대기 풍속 (u, v):</span>
              <strong className="text-cyan-300">({cloudConfig.weatherData.windU}, {cloudConfig.weatherData.windV}) m/s</strong>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-slate-500">풍속 / 풍향:</span>
              <strong className="text-slate-200">{cloudConfig.weatherData.windSpeed} m/s ({cloudConfig.weatherData.windDirectionDeg}°)</strong>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-slate-500">기압 / 상대습도:</span>
              <strong className="text-amber-300">{cloudConfig.weatherData.pressureHpa} hPa / {cloudConfig.weatherData.relativeHumidity}%</strong>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-slate-500">지자기 Kp / Dst:</span>
              <strong className="text-rose-400">Kp {cloudConfig.weatherData.kpIndex.toFixed(1)} / {cloudConfig.weatherData.dstIndexNt} nT</strong>
            </div>
          </div>
        )}

        {/* Floating Quick Controls Overlay */}
        <div className="absolute bottom-3 left-3 right-3 p-2 bg-[#0c0c12]/90 backdrop-blur-md rounded-lg border border-[#242432] flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Gamma Slider */}
          <div className="flex items-center gap-2 min-w-[170px]">
            <span className="text-[10px] font-mono text-slate-400">
              Gamma (γ): <strong className="text-cyan-300 font-bold">{gamma.toFixed(2)}</strong>
            </span>
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
              className="w-24 accent-cyan-400 h-1 bg-[#181822] rounded"
            />
          </div>

          {/* Palette Selector */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-slate-400 font-mono">팔레트:</span>
            <button
              onClick={() => setPalette('satellite_bone')}
              className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                palette === 'satellite_bone'
                  ? 'bg-slate-200 text-slate-900 font-bold'
                  : 'bg-[#181822] text-slate-400 border border-[#2a2a38]'
              }`}
            >
              위성 가시광선 (Bone)
            </button>
            <button
              onClick={() => setPalette('deep_sky_cyan')}
              className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                palette === 'deep_sky_cyan'
                  ? 'bg-cyan-500 text-black font-bold'
                  : 'bg-[#181822] text-slate-400 border border-[#2a2a38]'
              }`}
            >
              대기 시안
            </button>
            <button
              onClick={() => setPalette('night_infrared')}
              className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                palette === 'night_infrared'
                  ? 'bg-amber-500 text-black font-bold'
                  : 'bg-[#181822] text-slate-400 border border-[#2a2a38]'
              }`}
            >
              적외 열화상
            </button>
          </div>

          {/* Toggle Switches */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowOverheadVectors(!showOverheadVectors)}
              className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                showOverheadVectors
                  ? 'bg-sky-900/60 text-sky-300 border border-sky-500/40 font-semibold'
                  : 'bg-[#181822] text-slate-400 border border-[#2a2a38]'
              }`}
            >
              자기력선 오버레이
            </button>
            <button
              onClick={() => setShowCelestialGrid(!showCelestialGrid)}
              className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                showCelestialGrid
                  ? 'bg-cyan-900/60 text-cyan-300 border border-cyan-500/40 font-semibold'
                  : 'bg-[#181822] text-slate-400 border border-[#2a2a38]'
              }`}
            >
              천정 방위 격자
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
