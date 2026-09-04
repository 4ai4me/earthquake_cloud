import { EarthDipoleConfig, ExternalMagneticSource, MoonConfig, SolarWindConfig } from '../types';
import { EARTH_EQUATORIAL_FIELD_NT, EARTH_RADIUS_KM, MU_0, computeShueMagnetopauseRadius } from './physicsCalibration';

export const MODEL_SCHEMA_VERSION = 2;
const LOG_REFERENCE = Math.log10(EARTH_EQUATORIAL_FIELD_NT);
export interface Point3 { x: number; y: number; z: number }
export interface FieldSample extends Point3 { logNt: number; indeterminate?: boolean }
export interface FieldContext {
  earth: EarthDipoleConfig;
  sources: ExternalMagneticSource[];
  solar: SolarWindConfig;
  moon?: MoonConfig;
}
export interface ResearchConfig {
  distances: boolean;
  weakBoundary: boolean;
  weakThresholdNt: number;
  magnetopause: boolean;
  coreVisible: boolean;
  coreSpeedKmYear: number;
  coreHypothesis: boolean;
  coreTransmission: number;
  coreCoupling: number;
  coreResponseYears: number;
}
export const DEFAULT_RESEARCH: ResearchConfig = {
  distances: true, weakBoundary: true, weakThresholdNt: 10, magnetopause: true,
  coreVisible: false, coreSpeedKmYear: 15, coreHypothesis: false,
  coreTransmission: 0, coreCoupling: 0, coreResponseYears: 1,
};

/** Logarithmic input avoids a fabricated nT ceiling and preserves values such as 1e1000.
 * Infinity is an explicitly selected asymptotic experiment, not a finite measurement.
 * Exponents must be exactly representable integers; exceeding that is an input error.
 */
export function parseFieldNt(input: string): { logNt: number; error?: string } {
  const value = input.trim();
  if (/^(∞|infinity|inf)$/i.test(value)) return { logNt: Infinity };
  const match = /^(\+?\d*\.?\d+)(?:e([+-]?\d+))?$/i.exec(value);
  if (!match) return { logNt: NaN, error: '0 이상의 nT를 입력하세요. 예: 10, 1e1000, ∞' };
  const exponent = Number(match[2] ?? 0);
  if (!Number.isSafeInteger(exponent)) return { logNt: NaN, error: '지수를 정확하게 표현할 수 없습니다. ∞ 극한 모드를 사용하세요.' };
  const [integer, fraction = ''] = match[1].replace('+', '').split('.');
  const digits = integer + fraction;
  const first = digits.search(/[1-9]/);
  if (first < 0) return { logNt: -Infinity };
  const significant = digits.slice(first, first + 15);
  const logNt = exponent + integer.length - first - 1 + Math.log10(Number(significant) / 10 ** (significant.length - 1));
  if (!Number.isFinite(logNt)) return { logNt: NaN, error: '수치 표현 범위를 초과했습니다.' };
  return { logNt };
}

export function formatLogNt(logNt: number): string {
  if (logNt === -Infinity) return '0';
  if (logNt === Infinity) return '∞ (극한)';
  if (!Number.isFinite(logNt)) return '미정';
  if (logNt >= -2 && logNt < 6) return (10 ** logNt).toLocaleString('en-US', { maximumFractionDigits: 2 });
  const e = Math.floor(logNt);
  return `${(10 ** (logNt - e)).toFixed(3)}e${e}`;
}

const zero = (): FieldSample => ({ x: 0, y: 0, z: 0, logNt: -Infinity });
function vectorField(x: number, y: number, z: number, scaleLogNt: number): FieldSample {
  const length = Math.hypot(x, y, z);
  if (!length || scaleLogNt === -Infinity) return zero();
  return { x: x / length, y: y / length, z: z / length, logNt: scaleLogNt + Math.log10(length) };
}

export function sumFields(fields: FieldSample[]): FieldSample {
  if (fields.some(f => Number.isNaN(f.logNt) || f.indeterminate)) return { ...zero(), logNt: NaN, indeterminate: true };
  // Multiple infinite sources need relative growth rates, even if not exactly opposite.
  if(fields.filter(f=>f.logNt===Infinity).length>1)return {...zero(),logNt:NaN,indeterminate:true};
  const scale = Math.max(-Infinity, ...fields.map(f => f.logNt));
  if (scale === -Infinity) return zero();
  let x = 0, y = 0, z = 0;
  for (const field of fields) {
    const weight = scale === Infinity ? Number(field.logNt === Infinity) : 10 ** (field.logNt - scale);
    x += field.x * weight; y += field.y * weight; z += field.z * weight;
  }
  const length = Math.hypot(x, y, z);
  // Infinite opposing fields have no unique limit without a relative growth rate.
  if (scale === Infinity && length < 1e-12) return { ...zero(), logNt: NaN, indeterminate: true };
  return vectorField(x, y, z, scale);
}

/** Softened 3D dipole. At z=0 this is exactly the 2D formula, including regularization. */
export function dipoleField(point: Point3, center: Point3, angle: number, logNt: number, sign = 1): FieldSample {
  const dx = point.x - center.x, dy = point.y - center.y, dz = point.z - center.z;
  const a = angle * Math.PI / 180;
  const mx = -Math.sin(a) * sign, my = Math.cos(a) * sign;
  const r2 = dx * dx + dy * dy + dz * dz;
  const dot = mx * dx + my * dy;
  const r5 = (r2 + 0.05 ** 2) ** 2.5;
  return vectorField((3 * dx * dot - mx * r2) / r5, (3 * dy * dot - my * r2) / r5, 3 * dz * dot / r5, logNt);
}

export function earthField(point: Point3, earth: EarthDipoleConfig): FieldSample {
  return dipoleField(point, { x: earth.x, y: earth.y, z: 0 }, earth.tiltAngle,
    LOG_REFERENCE + Math.log10(Math.abs(earth.moment)), (earth.reversed ? -1 : 1) * Math.sign(earth.moment));
}

export function sourceField(point: Point3, source: ExternalMagneticSource): FieldSample {
  if (!source.active) return zero();
  const logNt = source.fieldNt === undefined ? LOG_REFERENCE + Math.log10(Math.abs(source.strength)) : parseFieldNt(source.fieldNt).logNt;
  const sign = source.fieldNt === undefined ? Math.sign(source.strength) : 1;
  const a = (source.angle ?? 0) * Math.PI / 180;
  if (source.type === 'uniform') return vectorField(-Math.sin(a), Math.cos(a), 0, logNt);
  const center = { x: source.x, y: source.y, z: source.z ?? 0 };
  if (source.type === 'dipole') return dipoleField(point, center, source.angle ?? 0, logNt, sign);
  const dx = point.x - center.x, dy = point.y - center.y, dz = point.z - center.z;
  const r3 = (dx * dx + dy * dy + dz * dz + 0.05 ** 2) ** 1.5;
  if (source.type === 'monopole_n' || source.type === 'monopole_s') {
    const polarity = (source.type === 'monopole_s' ? -1 : 1) * sign;
    return vectorField(polarity * dx / r3, polarity * dy / r3, polarity * dz / r3, logNt);
  }
  // Existing coma/tail proxy, extended radially in z. Explicitly a hypothesis, not MHD.
  const activity = source.cometGasActivity ?? source.strength;
  let x = -0.35 * activity * dx / r3, y = -0.35 * activity * dy / r3, z = -0.35 * activity * dz / r3;
  const tailLength = source.cometTailLength ?? 3;
  if (dx > 0 && dx < tailLength) {
    const width = 0.35 + dx * 0.18;
    const tail = Math.exp(-(dy * dy + dz * dz) / (2 * width * width)) * Math.exp(-dx / tailLength);
    x += activity * 0.15 * tail;
    y += Math.sign(dy) * activity * 0.08 * tail;
    z += Math.sign(dz) * activity * 0.08 * tail;
  }
  return vectorField(x, y, z, LOG_REFERENCE);
}

export function moonPosition(earth: EarthDipoleConfig, moon: MoonConfig): Point3 {
  const a = moon.phaseAngleDeg * Math.PI / 180;
  const distance = moon.physicalDistanceEarthRadii ?? 60.3;
  return { x: earth.x + distance * Math.cos(a), y: earth.y + distance * Math.sin(a), z: 0 };
}

export function lunarField(point: Point3, context: FieldContext): FieldSample {
  const moon = context.moon;
  // No measured global lunar dipole is asserted. Ocean/ionosphere tides are not this term.
  if (!moon?.enabled || !moon.hypothesisDipoleEnabled) return zero();
  return dipoleField(point, moonPosition(context.earth, moon), moon.remanentAngle + moon.phaseAngleDeg,
    LOG_REFERENCE + Math.log10(Math.abs(moon.remanentMoment)), Math.sign(moon.remanentMoment));
}

export function externalField(point: Point3, context: FieldContext): FieldSample {
  const fields = context.sources.map(source => sourceField(point, source));
  if (context.solar.enabled) fields.push(vectorField(context.solar.imfBx, context.solar.imfBz, 0, 0));
  fields.push(lunarField(point, context));
  return sumFields(fields);
}
export function sampleField(point: Point3, context: FieldContext): FieldSample {
  return sumFields([earthField(point, context.earth), externalField(point, context)]);
}

/** Only conventional-number consumers use this adapter; extreme modes must not run those solvers. */
export function normalizedComponents(field: FieldSample) {
  const magnitude = 10 ** (field.logNt - LOG_REFERENCE);
  return { bx: field.x === 0 ? 0 : field.x * magnitude, by: field.y === 0 ? 0 : field.y * magnitude,
    bz: field.z === 0 ? 0 : field.z * magnitude, magnitude };
}
export function needsLogOnly(context: FieldContext): boolean {
  return context.sources.some(s => s.active && s.fieldNt !== undefined &&
    (!Number.isFinite(parseFieldNt(s.fieldNt).logNt) && parseFieldNt(s.fieldNt).logNt !== -Infinity || parseFieldNt(s.fieldNt).logNt > 100));
}

export interface TracePoint extends Point3 { logNt: number; bMag: number }
export function traceField(seed: Point3, context: FieldContext, direction: 1 | -1, maxSteps: number, step: number,
  inside: (p: Point3) => boolean, planar = false): TracePoint[] {
  const result: TracePoint[] = [];
  let p = seed;
  const tangent = (at: Point3) => {
    const f = sampleField(at, context);
    const norm = planar ? Math.hypot(f.x, f.y) : Math.hypot(f.x, f.y, f.z);
    if (!norm || f.indeterminate) return null;
    return { x: f.x / norm, y: f.y / norm, z: planar ? 0 : f.z / norm, logNt: f.logNt };
  };
  const add = (a: Point3, b: Point3, h: number) => ({ x: a.x + b.x * h, y: a.y + b.y * h, z: a.z + b.z * h });
  for (let i = 0; i < maxSteps && inside(p); i++) {
    if (i > 0 && Math.hypot(p.x - context.earth.x, p.y - context.earth.y, p.z) < context.earth.radius) break;
    const k1 = tangent(p); if (!k1) break;
    result.push({ ...p, logNt: k1.logNt, bMag: 10 ** (k1.logNt - LOG_REFERENCE) });
    const h = step * direction;
    const k2 = tangent(add(p, k1, h / 2)); if (!k2) break;
    const k3 = tangent(add(p, k2, h / 2)); if (!k3) break;
    const k4 = tangent(add(p, k3, h)); if (!k4) break;
    p = { x: p.x + h * (k1.x + 2*k2.x + 2*k3.x + k4.x)/6,
      y: p.y + h * (k1.y + 2*k2.y + 2*k3.y + k4.y)/6,
      z: p.z + h * (k1.z + 2*k2.z + 2*k3.z + k4.z)/6 };
  }
  return result;
}

export function fieldOpacity(logNt: number): number {
  if (Number.isNaN(logNt) || logNt === -Infinity) return 0;
  // Fixed log legend: 0.01 nT invisible, 31,200 nT fully bright. No zoom-dependent gain.
  return Math.max(0, Math.min(1, (logNt + 2) / (LOG_REFERENCE + 2)));
}
export function weakBoundaryPoint(theta: number, phi: number, context: FieldContext, threshold: number): Point3 {
  const radius = Math.cbrt(EARTH_EQUATORIAL_FIELD_NT * Math.abs(context.earth.moment) * Math.sqrt(1 + 3*Math.cos(theta)**2) / threshold);
  const x = radius*Math.sin(theta)*Math.cos(phi), y = radius*Math.cos(theta), z = radius*Math.sin(theta)*Math.sin(phi);
  const a = context.earth.tiltAngle * Math.PI / 180;
  return { x: context.earth.x + x*Math.cos(a)-y*Math.sin(a), y: context.earth.y+x*Math.sin(a)+y*Math.cos(a), z };
}
export function magnetopausePoint(theta: number, phi: number, context: FieldContext): Point3 | null {
  const { solar } = context;
  // Explicit application guard, not an asserted fit-domain theorem. Never clamp an extreme input.
  if (!solar.enabled || solar.pressure < 0.05 || solar.pressure > 100 || Math.abs(solar.imfBz) > 50) return null;
  const r = computeShueMagnetopauseRadius(theta, solar.pressure, solar.imfBz).radiusEarthRadii;
  return { x: context.earth.x-r*Math.cos(theta), y: context.earth.y+r*Math.sin(theta)*Math.cos(phi), z: r*Math.sin(theta)*Math.sin(phi) };
}

export function distanceLabel(point: Point3, earth: EarthDipoleConfig): string {
  const re = Math.hypot(point.x-earth.x, point.y-earth.y, point.z);
  return `${re.toFixed(2)} R_E · ${(re*EARTH_RADIUS_KM).toLocaleString('en-US', { maximumFractionDigits: 0 })} km`;
}
export function advanceMoon(moon: MoonConfig, seconds: number): MoonConfig {
  if (!moon.enabled || !moon.autoOrbit) return moon;
  const days = seconds * (moon.daysPerSecond ?? 0.5);
  return { ...moon, phaseAngleDeg: ((moon.phaseAngleDeg + 360*days / Math.max(0.01, moon.orbitPeriodDays)) % 360 + 360) % 360 };
}

export function advanceSource(source: ExternalMagneticSource, earth: EarthDipoleConfig, seconds: number): ExternalMagneticSource {
  if (!source.active) return source;
  const orbit = source.orbiting && source.type !== 'uniform';
  const rotate = source.rotating && (source.type === 'dipole' || source.type === 'uniform');
  if (!orbit && !rotate) return source;
  const phase = (source.orbitPhase ?? Math.atan2(source.y-earth.y,source.x-earth.x)) + (source.orbitSpeed ?? 0.3)*seconds;
  const radius = source.orbitRadius ?? Math.hypot(source.x-earth.x,source.y-earth.y);
  return { ...source,
    ...(orbit ? { orbitPhase:phase,x:earth.x+radius*Math.cos(phase),y:earth.y+radius*Math.sin(phase) } : {}),
    ...(rotate ? { angle:(((source.angle??0)+(source.rotationSpeedDegS??15)*seconds)%360+360)%360 } : {}) };
}

export function coreResponse(context: FieldContext, config: ResearchConfig) {
  const external = externalField({ x: context.earth.x, y: context.earth.y, z: 0 }, context);
  // Hypothesis: delta-u = kappa * T^2 * Pext * tau / (rho L), steady response only.
  // rho=11000 kg/m3, L=2.26e6 m; tau and T are user assumptions, not inferred coupling.
  const active = config.coreHypothesis && config.coreTransmission > 0 && config.coreCoupling !== 0 && config.coreResponseYears > 0;
  const year = 365.25*86400;
  const deltaLogKmYear = active ? 2*(external.logNt-9)+2*Math.log10(config.coreTransmission)
    -Math.log10(2*MU_0*11000*2.26e6)+Math.log10(config.coreResponseYears*year*year/1000)+Math.log10(Math.abs(config.coreCoupling)) : -Infinity;
  const delta = Math.sign(config.coreCoupling)*10**deltaLogKmYear;
  return { base: config.coreSpeedKmYear, deltaLogKmYear, delta, speed: config.coreSpeedKmYear + delta, external };
}
