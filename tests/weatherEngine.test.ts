import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateDewPoint, calculateWindUV, fetchLiveGlobalWeather } from '../src/physics/weatherEngine';

test('meteorological wind direction converts to u/v in m/s', () => {
  const westWind = calculateWindUV(10, 270);
  assert.ok(Math.abs(westWind.u - 10) < 1e-10);
  assert.ok(Math.abs(westWind.v) < 1e-10);
  assert.ok(calculateDewPoint(20, 50) < 20);
});

test('live weather reports partial provenance instead of claiming all values are live', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = String(input);
    if (url.includes('open-meteo')) {
      assert.match(url, /wind_speed_unit=ms/);
      return new Response(JSON.stringify({
        current: {
          temperature_2m: 20,
          relative_humidity_2m: 50,
          surface_pressure: 1012,
          wind_speed_10m: 10,
          wind_direction_10m: 270,
          cloud_cover: 40,
        },
      }), { status: 200 });
    }
    if (url.includes('planetary-k')) {
      return new Response(JSON.stringify([['time_tag', 'Kp'], ['now', '4.0']]), { status: 200 });
    }
    if (url.includes('plasma')) {
      return new Response(JSON.stringify([['time_tag', 'density', 'speed'], ['now', '6.2', '450']]), { status: 200 });
    }
    return new Response(JSON.stringify([['time_tag', 'bz_gsm'], ['now', '-3.5']]), { status: 200 });
  }) as typeof fetch;

  try {
    const result = await fetchLiveGlobalWeather(37.26, 127.02);
    assert.equal(result.dataStatus, 'partial');
    assert.equal(result.isLive, false);
    assert.equal(result.liveSources?.atmosphere, true);
    assert.equal(result.liveSources?.dst, false);
    assert.equal(result.windSpeed, 10);
    assert.equal(result.solarWindSpeedKmS, 450);
    assert.equal(result.imfBzNt, -3.5);
    assert.ok(result.dataWarnings?.some((warning) => warning.includes('Dst')));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('live weather preserves current UI state by rejecting a total outage', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    throw new Error('offline');
  }) as typeof fetch;
  try {
    await assert.rejects(() => fetchLiveGlobalWeather(37.26, 127.02), /모두 수신하지 못했습니다/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
