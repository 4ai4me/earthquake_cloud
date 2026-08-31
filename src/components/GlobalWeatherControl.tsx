import React, { useState } from 'react';
import {
  GlobalWeatherData,
  WeatherModelProvider,
  SolarWindConfig,
  AtmosphericCloudConfig,
} from '../types';
import {
  GLOBAL_WEATHER_PRESETS,
  calculateWindUV,
  calculateDewPoint,
  fetchLiveGlobalWeather,
  applyWeatherToSimulation,
  WeatherStationPreset,
} from '../physics/weatherEngine';
import {
  Cloud,
  CloudRain,
  Compass,
  Database,
  ExternalLink,
  Flame,
  Globe,
  Navigation,
  Radio,
  RefreshCw,
  Sliders,
  Sun,
  Thermometer,
  Wind,
  Zap,
} from 'lucide-react';

interface GlobalWeatherControlProps {
  weatherData: GlobalWeatherData;
  setWeatherData: React.Dispatch<React.SetStateAction<GlobalWeatherData>>;
  solarWind: SolarWindConfig;
  setSolarWind: React.Dispatch<React.SetStateAction<SolarWindConfig>>;
  cloudConfig: AtmosphericCloudConfig;
  setCloudConfig: React.Dispatch<React.SetStateAction<AtmosphericCloudConfig>>;
}

export function GlobalWeatherControl({
  weatherData,
  setWeatherData,
  solarWind,
  setSolarWind,
  cloudConfig,
  setCloudConfig,
}: GlobalWeatherControlProps) {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'presets' | 'models' | 'custom' | 'sources'>('presets');

  // Handle Preset Selection
  const handleSelectPreset = (preset: WeatherStationPreset) => {
    setWeatherData(preset.data);
    applyWeatherToSimulation(preset.data, setSolarWind, setCloudConfig);
  };

  // Handle Live Fetch
  const handleFetchLive = async () => {
    setIsLoading(true);
    try {
      const live = await fetchLiveGlobalWeather(
        weatherData.latitude,
        weatherData.longitude,
        weatherData.provider,
        weatherData.stationName
      );
      setWeatherData(live);
      applyWeatherToSimulation(live, setSolarWind, setCloudConfig);
    } catch (err) {
      console.error('Error updating live weather:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Manual change handler
  const handleFieldChange = (field: keyof GlobalWeatherData, value: any) => {
    setWeatherData((prev) => {
      const updated = { ...prev, [field]: value, isLive: false };
      // If wind speed or direction changed, update u and v
      if (field === 'windSpeed' || field === 'windDirectionDeg') {
        const speed = field === 'windSpeed' ? value : updated.windSpeed;
        const dir = field === 'windDirectionDeg' ? value : updated.windDirectionDeg;
        const { u, v } = calculateWindUV(speed, dir);
        updated.windU = parseFloat(u.toFixed(2));
        updated.windV = parseFloat(v.toFixed(2));
      }
      // If u or v changed, update speed and direction
      if (field === 'windU' || field === 'windV') {
        const u = field === 'windU' ? value : updated.windU;
        const v = field === 'windV' ? value : updated.windV;
        const speed = Math.sqrt(u * u + v * v);
        // Meteorological wind direction
        let dir = (Math.atan2(-u, -v) * 180) / Math.PI;
        if (dir < 0) dir += 360;
        updated.windSpeed = parseFloat(speed.toFixed(1));
        updated.windDirectionDeg = Math.round(dir);
      }
      // Dew point calculation
      if (field === 'temperatureC' || field === 'relativeHumidity') {
        updated.dewPointC = parseFloat(
          calculateDewPoint(updated.temperatureC, updated.relativeHumidity).toFixed(1)
        );
      }
      applyWeatherToSimulation(updated, setSolarWind, setCloudConfig);
      return updated;
    });
  };

  // Kp Storm Level calculation
  const getKpStormBadge = (kp: number) => {
    if (kp < 3.0) return { label: 'Quiet (G0)', color: 'text-emerald-400 bg-emerald-950/60 border-emerald-500/40' };
    if (kp < 5.0) return { label: 'Unsettled (G0+)', color: 'text-cyan-400 bg-cyan-950/60 border-cyan-500/40' };
    if (kp < 6.0) return { label: 'Minor Storm (G1)', color: 'text-amber-400 bg-amber-950/60 border-amber-500/40' };
    if (kp < 7.0) return { label: 'Moderate Storm (G2)', color: 'text-orange-400 bg-orange-950/60 border-orange-500/40' };
    if (kp < 8.0) return { label: 'Strong Storm (G3)', color: 'text-rose-400 bg-rose-950/60 border-rose-500/40' };
    return { label: 'Severe / Extreme (G4/G5)', color: 'text-red-400 bg-red-950/80 border-red-500/60 font-bold animate-pulse' };
  };

  const kpBadge = getKpStormBadge(weatherData.kpIndex);

  return (
    <div className="flex flex-col gap-3 p-3 bg-[#0d0d12] rounded-lg border border-[#1e1e28] text-slate-200">
      {/* Header & Live Status */}
      <div className="flex items-center justify-between pb-2 border-b border-[#1c1c28]">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-md bg-cyan-950/50 border border-cyan-500/30 text-cyan-400">
            <Globe className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
              <span>세계 기상 모델 및 우주날씨 연동</span>
              <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-cyan-900/40 border border-cyan-500/30 text-cyan-300">
                GFS · ECMWF · ICON
              </span>
            </h3>
            <p className="text-[10px] text-slate-400 font-mono">
              대기 풍속 $(u, v)$, 기압, 습도 & NOAA SWPC 지자기 지수 ($Kp, Dst$)
            </p>
          </div>
        </div>

        <button
          onClick={handleFetchLive}
          disabled={isLoading}
          className="px-2.5 py-1 rounded text-xs font-mono font-semibold bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white border border-cyan-400/40 flex items-center gap-1.5 transition-all shadow-sm shadow-cyan-950"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>{isLoading ? '수신 중...' : '실시간 동기화'}</span>
        </button>
      </div>

      {/* Sub-Tabs: Presets / Models / Custom / Sources */}
      <div className="flex items-center p-0.5 bg-[#08080c] rounded-md border border-[#1a1a24] text-[11px] font-medium">
        <button
          onClick={() => setActiveTab('presets')}
          className={`flex-1 py-1 px-2 rounded transition-colors text-center ${
            activeTab === 'presets'
              ? 'bg-[#181824] text-cyan-300 border border-[#2b2b3e] font-semibold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          글로벌 단층대 관측소
        </button>
        <button
          onClick={() => setActiveTab('models')}
          className={`flex-1 py-1 px-2 rounded transition-colors text-center ${
            activeTab === 'models'
              ? 'bg-[#181824] text-cyan-300 border border-[#2b2b3e] font-semibold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          기상청 모델 선택
        </button>
        <button
          onClick={() => setActiveTab('custom')}
          className={`flex-1 py-1 px-2 rounded transition-colors text-center ${
            activeTab === 'custom'
              ? 'bg-[#181824] text-cyan-300 border border-[#2b2b3e] font-semibold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          수동 파라미터 조율
        </button>
        <button
          onClick={() => setActiveTab('sources')}
          className={`flex-1 py-1 px-2 rounded transition-colors text-center ${
            activeTab === 'sources'
              ? 'bg-[#181824] text-cyan-300 border border-[#2b2b3e] font-semibold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          데이터 다운로드 경로
        </button>
      </div>

      {/* Active Station Banner */}
      <div className="px-2.5 py-2 bg-[#12121c] rounded-md border border-[#202030] flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 font-bold text-slate-200">
            <Navigation className="w-3.5 h-3.5 text-cyan-400" />
            <span>{weatherData.stationName}</span>
          </div>
          <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono border ${kpBadge.color}`}>
            Kp {weatherData.kpIndex.toFixed(1)} · {kpBadge.label}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px] font-mono pt-1 border-t border-[#1a1a24]">
          <div>
            <span className="text-slate-500">위치:</span>{' '}
            <span className="text-slate-300">
              {weatherData.latitude > 0 ? `${weatherData.latitude.toFixed(2)}°N` : `${Math.abs(weatherData.latitude).toFixed(2)}°S`},{' '}
              {weatherData.longitude > 0 ? `${weatherData.longitude.toFixed(2)}°E` : `${Math.abs(weatherData.longitude).toFixed(2)}°W`}
            </span>
          </div>
          <div>
            <span className="text-slate-500">풍속 ($u, v$):</span>{' '}
            <span className="text-cyan-300 font-bold">
              {weatherData.windU > 0 ? `+${weatherData.windU}` : weatherData.windU},{' '}
              {weatherData.windV > 0 ? `+${weatherData.windV}` : weatherData.windV} m/s
            </span>
          </div>
          <div>
            <span className="text-slate-500">기압 / 습도:</span>{' '}
            <span className="text-amber-300 font-bold">{weatherData.pressureHpa} hPa / {weatherData.relativeHumidity}%</span>
          </div>
          <div>
            <span className="text-slate-500">지자기 $Dst$:</span>{' '}
            <span className="text-rose-300 font-bold">{weatherData.dstIndexNt} nT</span>
          </div>
        </div>
      </div>

      {/* Tab 1: Global Seismic Station Presets */}
      {activeTab === 'presets' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {GLOBAL_WEATHER_PRESETS.map((preset) => {
            const isSelected = weatherData.stationName === preset.name;
            return (
              <button
                key={preset.id}
                onClick={() => handleSelectPreset(preset)}
                className={`p-2 rounded-md border text-left transition-all flex flex-col justify-between ${
                  isSelected
                    ? 'bg-cyan-950/40 border-cyan-500/60 shadow-sm'
                    : 'bg-[#101017] border-[#1e1e28] hover:bg-[#151520] hover:border-slate-600'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-bold ${isSelected ? 'text-cyan-300' : 'text-slate-200'}`}>
                    {preset.name}
                  </span>
                  <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-[#0a0a0f] border border-[#252535] text-slate-400">
                    {preset.provider.replace('_', ' ')}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1 line-clamp-1">{preset.region}</p>
                <div className="mt-1.5 flex items-center justify-between text-[10px] font-mono text-slate-300">
                  <span>풍속 {preset.data.windSpeed}m/s ({preset.data.windDirectionDeg}°)</span>
                  <span className="text-cyan-400 font-semibold">Kp {preset.data.kpIndex}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Tab 2: Meteorological Models Selection */}
      {activeTab === 'models' && (
        <div className="flex flex-col gap-2.5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {/* NOAA GFS */}
            <button
              onClick={() => handleFieldChange('provider', 'NOAA_GFS')}
              className={`p-2.5 rounded-md border text-left transition-all ${
                weatherData.provider === 'NOAA_GFS'
                  ? 'bg-blue-950/50 border-blue-500/60'
                  : 'bg-[#101017] border-[#1e1e28] hover:bg-[#151520]'
              }`}
            >
              <div className="flex items-center gap-1.5 text-xs font-bold text-blue-300">
                <Globe className="w-3.5 h-3.5" />
                <span>미국 NOAA / NCEP</span>
              </div>
              <div className="text-[11px] font-mono font-semibold text-slate-200 mt-1">GFS 0.25° Global</div>
              <p className="text-[10px] text-slate-400 mt-1">
                전면 무료 실시간 공개. AWS Open Data Registry 및 NOMADS 서버 제공.
              </p>
            </button>

            {/* ECMWF IFS */}
            <button
              onClick={() => handleFieldChange('provider', 'ECMWF_IFS')}
              className={`p-2.5 rounded-md border text-left transition-all ${
                weatherData.provider === 'ECMWF_IFS'
                  ? 'bg-emerald-950/50 border-emerald-500/60'
                  : 'bg-[#101017] border-[#1e1e28] hover:bg-[#151520]'
              }`}
            >
              <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-300">
                <Cloud className="w-3.5 h-3.5" />
                <span>유럽 ECMWF</span>
              </div>
              <div className="text-[11px] font-mono font-semibold text-slate-200 mt-1">IFS Open Data</div>
              <p className="text-[10px] text-slate-400 mt-1">
                0.25°/0.4° 해상도 전지구 예보. ecmwf-opendata API 제공.
              </p>
            </button>

            {/* DWD ICON */}
            <button
              onClick={() => handleFieldChange('provider', 'DWD_ICON')}
              className={`p-2.5 rounded-md border text-left transition-all ${
                weatherData.provider === 'DWD_ICON'
                  ? 'bg-amber-950/50 border-amber-500/60'
                  : 'bg-[#101017] border-[#1e1e28] hover:bg-[#151520]'
              }`}
            >
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
                <Wind className="w-3.5 h-3.5" />
                <span>독일 기상청 DWD</span>
              </div>
              <div className="text-[11px] font-mono font-semibold text-slate-200 mt-1">ICON Global/EU</div>
              <p className="text-[10px] text-slate-400 mt-1">
                전 지구 및 유럽 고해상도 예보 데이터 전면 무료 공개 (opendata.dwd.de).
              </p>
            </button>
          </div>

          <div className="p-2.5 bg-[#12121a] rounded border border-[#1e1e28] text-[11px] text-slate-300">
            <span className="text-cyan-400 font-bold">모델 적용 방식: </span>
            선택된 모델의 수평 바람 벡터 (u, v) 성분은 대기 중 하전 입자 및 파동 구름의 이류(Advection Drift)를 유도하며, 상대습도 RH와 기압 P는 응결 임계치(Condensation Threshold)를 유기적으로 스케일링합니다.
          </div>
        </div>
      )}

      {/* Tab 3: Manual Parameter Tuning */}
      {activeTab === 'custom' && (
        <div className="flex flex-col gap-3">
          {/* Wind Vector Controls (u, v and Speed/Dir) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-2.5 bg-[#12121a] rounded border border-[#1e1e28]">
            <div>
              <div className="flex justify-between text-xs font-mono mb-1">
                <span className="text-slate-400">동서 풍속 성분 ($u$ / Zonal):</span>
                <strong className="text-cyan-300">{weatherData.windU} m/s</strong>
              </div>
              <input
                type="range"
                min="-40"
                max="40"
                step="0.5"
                value={weatherData.windU}
                onChange={(e) => handleFieldChange('windU', parseFloat(e.target.value))}
                className="w-full accent-cyan-400 h-1.5 bg-[#1e1e28] rounded"
              />
              <span className="text-[9px] text-slate-500 font-mono">+값: 동쪽으로 붊 (편서풍) / -값: 서쪽</span>
            </div>

            <div>
              <div className="flex justify-between text-xs font-mono mb-1">
                <span className="text-slate-400">남북 풍속 성분 ($v$ / Meridional):</span>
                <strong className="text-cyan-300">{weatherData.windV} m/s</strong>
              </div>
              <input
                type="range"
                min="-40"
                max="40"
                step="0.5"
                value={weatherData.windV}
                onChange={(e) => handleFieldChange('windV', parseFloat(e.target.value))}
                className="w-full accent-cyan-400 h-1.5 bg-[#1e1e28] rounded"
              />
              <span className="text-[9px] text-slate-500 font-mono">+값: 북쪽으로 붊 (남풍) / -값: 남쪽</span>
            </div>

            <div>
              <div className="flex justify-between text-xs font-mono mb-1">
                <span className="text-slate-400">합성 풍속 ($V$) / 풍향:</span>
                <strong className="text-cyan-300">{weatherData.windSpeed} m/s ({weatherData.windDirectionDeg}°)</strong>
              </div>
              <input
                type="range"
                min="0"
                max="50"
                step="0.5"
                value={weatherData.windSpeed}
                onChange={(e) => handleFieldChange('windSpeed', parseFloat(e.target.value))}
                className="w-full accent-cyan-400 h-1.5 bg-[#1e1e28] rounded"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs font-mono mb-1">
                <span className="text-slate-400">기압 ($P$) / 상대습도 ($RH$):</span>
                <strong className="text-amber-300">{weatherData.pressureHpa} hPa / {weatherData.relativeHumidity}%</strong>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="range"
                  min="960"
                  max="1040"
                  step="1"
                  value={weatherData.pressureHpa}
                  onChange={(e) => handleFieldChange('pressureHpa', parseFloat(e.target.value))}
                  className="w-full accent-amber-400 h-1.5 bg-[#1e1e28] rounded"
                />
                <input
                  type="range"
                  min="10"
                  max="100"
                  step="1"
                  value={weatherData.relativeHumidity}
                  onChange={(e) => handleFieldChange('relativeHumidity', parseInt(e.target.value))}
                  className="w-full accent-amber-400 h-1.5 bg-[#1e1e28] rounded"
                />
              </div>
            </div>
          </div>

          {/* Space Weather Indices (Kp, Dst) */}
          <div className="p-2.5 bg-[#12121a] rounded border border-[#1e1e28]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-rose-300 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-rose-400" />
                우주기상 지자기 지수 (NOAA SWPC $Kp$, $Dst$)
              </span>
              <span className={`px-1.5 py-0.2 rounded text-[9px] font-mono border ${kpBadge.color}`}>
                {kpBadge.label}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <div className="flex justify-between text-xs font-mono mb-1">
                  <span className="text-slate-400">행성 $Kp$ 지수 (0 ~ 9):</span>
                  <strong className="text-rose-400 font-bold">{weatherData.kpIndex.toFixed(1)}</strong>
                </div>
                <input
                  type="range"
                  min="0"
                  max="9"
                  step="0.1"
                  value={weatherData.kpIndex}
                  onChange={(e) => handleFieldChange('kpIndex', parseFloat(e.target.value))}
                  className="w-full accent-rose-500 h-1.5 bg-[#1e1e28] rounded"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs font-mono mb-1">
                  <span className="text-slate-400">지자기 $Dst$ 지수 (nT):</span>
                  <strong className="text-rose-400 font-bold">{weatherData.dstIndexNt} nT</strong>
                </div>
                <input
                  type="range"
                  min="-300"
                  max="30"
                  step="5"
                  value={weatherData.dstIndexNt}
                  onChange={(e) => handleFieldChange('dstIndexNt', parseInt(e.target.value))}
                  className="w-full accent-rose-500 h-1.5 bg-[#1e1e28] rounded"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Official Data Download Sources & Format Reference */}
      {activeTab === 'sources' && (
        <div className="flex flex-col gap-2.5 text-xs">
          <div className="p-2.5 bg-[#12121a] rounded border border-[#1e1e28]">
            <h4 className="font-bold text-slate-200 flex items-center gap-1.5 mb-1.5">
              <Database className="w-3.5 h-3.5 text-cyan-400" />
              세계 기상 데이터 다운로드 및 표준 포맷
            </h4>
            <div className="space-y-2 text-[11px] text-slate-300">
              <div className="p-1.5 rounded bg-[#0b0b10] border border-[#1a1a24]">
                <strong className="text-blue-300">1. 미국 NOAA / NCEP (GFS 모델):</strong>
                <p className="text-slate-400 mt-0.5">
                  • <strong>AWS S3 Open Data:</strong> <code className="text-cyan-300 font-mono">s3://noaa-gfs-bdp-pds/</code><br />
                  • <strong>NOAA NOMADS:</strong> <code className="text-cyan-300 font-mono">nomads.ncep.noaa.gov</code> (GRIB2 / OPeNDAP)<br />
                  • <strong>Google Cloud:</strong> NOAA Global Forecast System Public Dataset
                </p>
              </div>

              <div className="p-1.5 rounded bg-[#0b0b10] border border-[#1a1a24]">
                <strong className="text-emerald-300">2. 유럽 ECMWF (IFS Open Data):</strong>
                <p className="text-slate-400 mt-0.5">
                  • <strong>ECMWF Open Data API:</strong> Python 패키지 <code className="text-cyan-300 font-mono">pip install ecmwf-opendata</code><br />
                  • <strong>해상도:</strong> 0.25° 및 0.4° 전지구 예보 GRIB2 파일 실시간 무료 배포
                </p>
              </div>

              <div className="p-1.5 rounded bg-[#0b0b10] border border-[#1a1a24]">
                <strong className="text-amber-300">3. 독일 기상청 DWD (ICON 모델):</strong>
                <p className="text-slate-400 mt-0.5">
                  • <strong>DWD OpenData 포털:</strong> <code className="text-cyan-300 font-mono">opendata.dwd.de/weather/nwp/icon/</code><br />
                  • <strong>ICON-Global & ICON-EU:</strong> 비압축/bzip2 GRIB2 포맷 제공
                </p>
              </div>

              <div className="p-1.5 rounded bg-[#0b0b10] border border-[#1a1a24]">
                <strong className="text-purple-300">4. Python 처리 라이브러리 스택:</strong>
                <p className="text-slate-400 mt-0.5">
                  • <code className="text-cyan-300 font-mono">xarray</code>, <code className="text-cyan-300 font-mono">cfgrib</code>, <code className="text-cyan-300 font-mono">pygrib</code>, <code className="text-cyan-300 font-mono">metpy</code>, <code className="text-cyan-300 font-mono">boto3</code>
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
