import type { Dispatch, SetStateAction } from 'react';
import { GlobalWeatherData, WeatherModelProvider, SolarWindConfig, AtmosphericCloudConfig } from '../types';
import { computeSolarWindDynamicPressureNPa } from './physicsCalibration';

export interface WeatherStationPreset {
  id: string;
  name: string;
  region: string;
  latitude: number;
  longitude: number;
  provider: WeatherModelProvider;
  data: GlobalWeatherData;
}

export const GLOBAL_WEATHER_PRESETS: WeatherStationPreset[] = [
  {
    id: 'suwon_korea',
    name: '대한민국 수원 (Suwon, Korea)',
    region: '경기 남부 지자기·기상 관측 거점 (37.26° N, 127.02° E)',
    latitude: 37.26,
    longitude: 127.02,
    provider: 'NOAA_GFS',
    data: {
      provider: 'NOAA_GFS',
      stationName: '대한민국 수원 (Suwon, Korea)',
      latitude: 37.26,
      longitude: 127.02,
      windU: 6.8,
      windV: -3.2,
      windSpeed: 7.5,
      windDirectionDeg: 295,
      pressureHpa: 1016.8,
      temperatureC: 18.4,
      relativeHumidity: 62,
      cloudCoverPercent: 48,
      dewPointC: 10.8,
      kpIndex: 2.3,
      dstIndexNt: -8,
      solarWindSpeedKmS: 390,
      solarWindDensityCm3: 4.2,
      imfBzNt: 0.2,
      lastUpdated: '기상청 KMA / NOAA GFS 모델 예보',
      isLive: false,
      modelSourceInfo: 'NOAA NCEP GFS 0.25° & KMA 기상 데이터 (37.26°N, 127.02°E)',
    },
  },
  {
    id: 'pohang_korea',
    name: '포항·경주 단층대 (한반도)',
    region: '한반도 동남부 지진 다발 단층대',
    latitude: 36.019,
    longitude: 129.343,
    provider: 'NOAA_GFS',
    data: {
      provider: 'NOAA_GFS',
      stationName: '포항·경주 단층대 (한반도)',
      latitude: 36.019,
      longitude: 129.343,
      windU: 11.2,
      windV: -6.4,
      windSpeed: 12.9,
      windDirectionDeg: 300,
      pressureHpa: 1014.5,
      temperatureC: 16.2,
      relativeHumidity: 68,
      cloudCoverPercent: 55,
      dewPointC: 10.3,
      kpIndex: 3.3,
      dstIndexNt: -18,
      solarWindSpeedKmS: 420,
      solarWindDensityCm3: 4.8,
      imfBzNt: -1.8,
      lastUpdated: '실시간 GFS 모델 예보',
      isLive: false,
      modelSourceInfo: 'NOAA NCEP GFS 0.25° Global (AWS Open Data s3://noaa-gfs-bdp-pds/)',
    },
  },
  {
    id: 'tokyo_tohoku',
    name: '도쿄·도호쿠 침강대 (일본)',
    region: '태평양-유라시아 판 섭입대',
    latitude: 38.268,
    longitude: 142.421,
    provider: 'ECMWF_IFS',
    data: {
      provider: 'ECMWF_IFS',
      stationName: '도쿄·도호쿠 침강대 (일본)',
      latitude: 38.268,
      longitude: 142.421,
      windU: 18.5,
      windV: 8.2,
      windSpeed: 20.2,
      windDirectionDeg: 246,
      pressureHpa: 1008.2,
      temperatureC: 13.8,
      relativeHumidity: 78,
      cloudCoverPercent: 72,
      dewPointC: 10.0,
      kpIndex: 4.2,
      dstIndexNt: -42,
      solarWindSpeedKmS: 490,
      solarWindDensityCm3: 7.2,
      imfBzNt: -3.4,
      lastUpdated: 'ECMWF Open Data 0.25° IFS',
      isLive: false,
      modelSourceInfo: '유럽 ECMWF IFS OpenData API (ecmwf-opendata)',
    },
  },
  {
    id: 'san_andreas_ca',
    name: '샌안드레아스 단층 (미국 캘리포니아)',
    region: '북미-태평양 주향이동 단층대',
    latitude: 37.774,
    longitude: -122.419,
    provider: 'NOAA_GFS',
    data: {
      provider: 'NOAA_GFS',
      stationName: '샌안드레아스 단층 (미국 CA)',
      latitude: 37.774,
      longitude: -122.419,
      windU: 7.5,
      windV: -12.8,
      windSpeed: 14.8,
      windDirectionDeg: 330,
      pressureHpa: 1018.6,
      temperatureC: 17.5,
      relativeHumidity: 84,
      cloudCoverPercent: 65,
      dewPointC: 14.7,
      kpIndex: 2.0,
      dstIndexNt: -6,
      solarWindSpeedKmS: 360,
      solarWindDensityCm3: 3.5,
      imfBzNt: 0.8,
      lastUpdated: 'NOAA NOMADS GFS 0.25°',
      isLive: false,
      modelSourceInfo: 'NOAA NOMADS 서버 (nomads.ncep.noaa.gov)',
    },
  },
  {
    id: 'anatolian_turkey',
    name: '동아나톨리아 단층 (튀르키예)',
    region: '아라비아-유라시아 충돌 단층대',
    latitude: 37.585,
    longitude: 36.937,
    provider: 'DWD_ICON',
    data: {
      provider: 'DWD_ICON',
      stationName: '동아나톨리아 단층 (튀르키예)',
      latitude: 37.585,
      longitude: 36.937,
      windU: -9.5,
      windV: 4.8,
      windSpeed: 10.6,
      windDirectionDeg: 117,
      pressureHpa: 1022.0,
      temperatureC: 22.4,
      relativeHumidity: 38,
      cloudCoverPercent: 20,
      dewPointC: 7.1,
      kpIndex: 3.0,
      dstIndexNt: -15,
      solarWindSpeedKmS: 410,
      solarWindDensityCm3: 4.0,
      imfBzNt: -1.2,
      lastUpdated: '독일 기상청 DWD ICON Global',
      isLive: false,
      modelSourceInfo: '독일 DWD OpenData 포털 (opendata.dwd.de)',
    },
  },
  {
    id: 'chile_nazca',
    name: '나스카 판 섭입대 (칠레 발디비아)',
    region: '남태평양 초강력 지진 해구대',
    latitude: -39.814,
    longitude: -73.245,
    provider: 'ECMWF_IFS',
    data: {
      provider: 'ECMWF_IFS',
      stationName: '나스카 판 섭입대 (칠레)',
      latitude: -39.814,
      longitude: -73.245,
      windU: 15.2,
      windV: 8.6,
      windSpeed: 17.5,
      windDirectionDeg: 240,
      pressureHpa: 1011.0,
      temperatureC: 11.2,
      relativeHumidity: 65,
      cloudCoverPercent: 50,
      dewPointC: 4.8,
      kpIndex: 2.7,
      dstIndexNt: -10,
      solarWindSpeedKmS: 395,
      solarWindDensityCm3: 5.1,
      imfBzNt: -0.9,
      lastUpdated: 'ECMWF IFS Open Data',
      isLive: false,
      modelSourceInfo: 'ECMWF Open Data Portal (0.4° Res)',
    },
  },
  {
    id: 'iceland_ridge',
    name: '대서양 중앙 해령 (아이슬란드)',
    region: '발산형 판 경계 & 맨틀 열점',
    latitude: 64.146,
    longitude: -21.942,
    provider: 'DWD_ICON',
    data: {
      provider: 'DWD_ICON',
      stationName: '대서양 중앙 해령 (아이슬란드)',
      latitude: 64.146,
      longitude: -21.942,
      windU: 24.5,
      windV: 12.0,
      windSpeed: 27.3,
      windDirectionDeg: 244,
      pressureHpa: 986.5,
      temperatureC: 3.5,
      relativeHumidity: 90,
      cloudCoverPercent: 92,
      dewPointC: 2.0,
      kpIndex: 5.3,
      dstIndexNt: -58,
      solarWindSpeedKmS: 540,
      solarWindDensityCm3: 9.8,
      imfBzNt: -5.1,
      lastUpdated: 'DWD ICON High-Res 북대서양',
      isLive: false,
      modelSourceInfo: 'DWD ICON-EU Open Data',
    },
  },
  {
    id: 'tromso_aurora',
    name: '오로라 오발 지자기 관측소 (노르웨이 트롬쇠)',
    region: '극지 지자기권 극관 자기 폭풍대',
    latitude: 69.649,
    longitude: 18.955,
    provider: 'NOAA_SWPC_REALTIME',
    data: {
      provider: 'NOAA_SWPC_REALTIME',
      stationName: '트롬쇠 극지 지자기 관측소',
      latitude: 69.649,
      longitude: 18.955,
      windU: 13.0,
      windV: -6.5,
      windSpeed: 14.5,
      windDirectionDeg: 296,
      pressureHpa: 1002.0,
      temperatureC: -2.0,
      relativeHumidity: 82,
      cloudCoverPercent: 80,
      dewPointC: -4.6,
      kpIndex: 6.7,
      dstIndexNt: -115,
      solarWindSpeedKmS: 680,
      solarWindDensityCm3: 16.5,
      imfBzNt: -8.4,
      lastUpdated: 'NOAA SWPC 실시간 우주날씨',
      isLive: false,
      modelSourceInfo: 'NOAA SWPC DSCOVR/ACE & Planetary K-Index Real-Time',
    },
  },
];

/**
 * Calculates (u, v) wind vector components from wind speed (m/s) and meteorological direction (deg).
 * In meteorology, wind direction theta is WHERE THE WIND COMES FROM.
 * u = -speed * sin(rad) (positive means blowing to the East)
 * v = -speed * cos(rad) (positive means blowing to the North)
 */
export function calculateWindUV(speed: number, directionDeg: number): { u: number; v: number } {
  const rad = (directionDeg * Math.PI) / 180;
  const u = -speed * Math.sin(rad);
  const v = -speed * Math.cos(rad);
  return { u, v };
}

/**
 * Calculates Dew Point (°C) using the Magnus-Tetens approximation.
 */
export function calculateDewPoint(tempC: number, rhPercent: number): number {
  const a = 17.27;
  const b = 237.7;
  const alpha = (a * tempC) / (b + tempC) + Math.log(Math.max(1, Math.min(100, rhPercent)) / 100);
  return (b * alpha) / (a - alpha);
}

async function fetchJsonWithTimeout(url: string, timeoutMs: number = 8_000): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

function latestProductValue(data: unknown, field: string): number | undefined {
  if (!Array.isArray(data) || data.length < 2 || !Array.isArray(data[0])) return undefined;
  const fieldIndex = data[0].indexOf(field);
  if (fieldIndex < 0) return undefined;
  for (let index = data.length - 1; index >= 1; index--) {
    const row = data[index];
    if (!Array.isArray(row)) continue;
    const value = Number(row[fieldIndex]);
    if (Number.isFinite(value)) return value;
  }
  return undefined;
}

/**
 * Fetches real-time weather and space weather data via Open-Meteo & NOAA SWPC APIs
 */
export async function fetchLiveGlobalWeather(
  latitude: number,
  longitude: number,
  provider: WeatherModelProvider = 'NOAA_GFS',
  stationName: string = '사용자 지정 위치'
): Promise<GlobalWeatherData> {
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    throw new Error('위도는 -90에서 90 사이의 유한한 숫자여야 합니다.');
  }
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw new Error('경도는 -180에서 180 사이의 유한한 숫자여야 합니다.');
  }

  let modelParam = 'gfs_seamless';
  let providerName = 'NOAA NCEP GFS';
  if (provider === 'ECMWF_IFS') {
    modelParam = 'ecmwf_ifs025';
    providerName = 'ECMWF IFS (OpenData)';
  } else if (provider === 'DWD_ICON') {
    modelParam = 'dwd_icon';
    providerName = 'DWD ICON Global';
  }

  const warnings: string[] = [];
  const liveSources = { atmosphere: false, kp: false, solarWind: false, imf: false, dst: false };

  // 1. Fetch atmospheric weather via Open-Meteo Public CORS API.
  let tempC = 18.0;
  let rh = 65.0;
  let pressureHpa = 1013.25;
  let windSpeed = 10.0;
  let windDir = 270.0;
  let cloudCover = 50.0;

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude.toFixed(4)}&longitude=${longitude.toFixed(4)}&current=temperature_2m,relative_humidity_2m,surface_pressure,wind_speed_10m,wind_direction_10m,cloud_cover&wind_speed_unit=ms&models=${modelParam}`;
    const data = (await fetchJsonWithTimeout(url)) as { current?: Record<string, unknown> };
    if (!data.current) throw new Error('current weather data missing');
    const numeric = (key: string, fallback: number) => {
      const value = Number(data.current?.[key]);
      return Number.isFinite(value) ? value : fallback;
    };
    tempC = numeric('temperature_2m', tempC);
    rh = numeric('relative_humidity_2m', rh);
    pressureHpa = numeric('surface_pressure', pressureHpa);
    windSpeed = numeric('wind_speed_10m', windSpeed);
    windDir = numeric('wind_direction_10m', windDir);
    cloudCover = numeric('cloud_cover', cloudCover);
    liveSources.atmosphere = true;
  } catch {
    warnings.push('대기 기상 자료를 받지 못해 안전한 기본값을 유지했습니다.');
  }

  // 2. Fetch each NOAA SWPC product independently. Never derive unrelated measurements from Kp.
  let kp = 3.0;
  let dst = -15;
  let swSpeed = 420;
  let swDensity = 5.0;
  let imfBz = -1.5;

  const [kpResult, plasmaResult, magResult] = await Promise.allSettled([
    fetchJsonWithTimeout('https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json'),
    fetchJsonWithTimeout('https://services.swpc.noaa.gov/products/solar-wind/plasma-7-day.json'),
    fetchJsonWithTimeout('https://services.swpc.noaa.gov/products/solar-wind/mag-7-day.json'),
  ]);

  if (kpResult.status === 'fulfilled') {
    const value = latestProductValue(kpResult.value, 'Kp') ?? latestProductValue(kpResult.value, 'kp');
    if (value !== undefined) {
      kp = Math.max(0, Math.min(9, value));
      liveSources.kp = true;
    }
  }
  if (!liveSources.kp) warnings.push('NOAA Kp 자료를 받지 못해 기존 기준값을 사용했습니다.');

  if (plasmaResult.status === 'fulfilled') {
    const speed = latestProductValue(plasmaResult.value, 'speed');
    const density = latestProductValue(plasmaResult.value, 'density');
    if (speed !== undefined && density !== undefined) {
      swSpeed = speed;
      swDensity = density;
      liveSources.solarWind = true;
    }
  }
  if (!liveSources.solarWind) warnings.push('NOAA 태양풍 속도·밀도 자료를 받지 못해 기존 기준값을 사용했습니다.');

  if (magResult.status === 'fulfilled') {
    const bz = latestProductValue(magResult.value, 'bz_gsm');
    if (bz !== undefined) {
      imfBz = bz;
      liveSources.imf = true;
    }
  }
  if (!liveSources.imf) warnings.push('NOAA IMF Bz 자료를 받지 못해 기존 기준값을 사용했습니다.');
  warnings.push('Dst는 실시간 수신값이 아니므로 기준값으로 표시됩니다.');

  const liveCount = Object.values(liveSources).filter(Boolean).length;
  if (liveCount === 0) {
    throw new Error('실시간 기상·우주기상 자료를 모두 수신하지 못했습니다. 현재 화면 값은 변경되지 않았습니다.');
  }

  const { u, v } = calculateWindUV(windSpeed, windDir);
  const dewPoint = calculateDewPoint(tempC, rh);

  return {
    provider,
    stationName,
    latitude,
    longitude,
    windU: parseFloat(u.toFixed(2)),
    windV: parseFloat(v.toFixed(2)),
    windSpeed: parseFloat(windSpeed.toFixed(1)),
    windDirectionDeg: Math.round(windDir),
    pressureHpa: parseFloat(pressureHpa.toFixed(1)),
    temperatureC: parseFloat(tempC.toFixed(1)),
    relativeHumidity: Math.round(rh),
    cloudCoverPercent: Math.round(cloudCover),
    dewPointC: parseFloat(dewPoint.toFixed(1)),
    kpIndex: parseFloat(kp.toFixed(1)),
    dstIndexNt: dst,
    solarWindSpeedKmS: parseFloat(swSpeed.toFixed(1)),
    solarWindDensityCm3: parseFloat(swDensity.toFixed(2)),
    imfBzNt: parseFloat(imfBz.toFixed(2)),
    lastUpdated: new Date().toISOString(),
    isLive: Object.values(liveSources).every(Boolean),
    dataStatus: warnings.length === 0 ? 'live' : 'partial',
    dataWarnings: warnings,
    liveSources,
    modelSourceInfo: `${providerName} (Open-Meteo) · NOAA SWPC Kp/태양풍/IMF 개별 수신`,
  };
}

/**
 * Applies weather parameters to the electromagnetic & atmospheric cloud simulation
 */
export function applyWeatherToSimulation(
  weather: GlobalWeatherData,
  setSolarWind: Dispatch<SetStateAction<SolarWindConfig>>,
  setCloudConfig: Dispatch<SetStateAction<AtmosphericCloudConfig>>
) {
  // 1. Compute proton ram pressure from independently measured density and speed.
  setSolarWind((prev) => {
    const pressure = Math.max(
      0.05,
      Math.min(20, computeSolarWindDynamicPressureNPa(weather.solarWindDensityCm3, weather.solarWindSpeedKmS))
    );
    const speed = Math.max(0.5, Math.min(3.5, weather.solarWindSpeedKmS / 400));
    const density = Math.max(0.4, Math.min(4.0, weather.solarWindDensityCm3 / 5.0));
    const imfBz = weather.imfBzNt;

    return {
      ...prev,
      enabled: true,
      pressure,
      speed,
      density,
      speedKmS: weather.solarWindSpeedKmS,
      densityCm3: weather.solarWindDensityCm3,
      imfBz,
    };
  });

  // 2. Modulate Atmospheric Cloud condensation and opacity from Humidity, Cloud Cover & Pressure
  setCloudConfig((prev) => {
    // Relative Humidity > 70% lowers condensation threshold (clouds form more easily)
    const condensationThreshold = Math.max(0.3, Math.min(1.8, 1.4 - (weather.relativeHumidity / 100) * 0.9));
    const cloudOpacity = Math.max(0.3, Math.min(1.0, 0.4 + (weather.cloudCoverPercent / 100) * 0.6));

    return {
      ...prev,
      weatherData: weather,
      useLiveWeather: weather.dataStatus === 'live' || weather.dataStatus === 'partial',
      condensationThreshold,
      cloudOpacity,
      showCloudBands: true,
      showWaveClouds: true,
    };
  });
}
