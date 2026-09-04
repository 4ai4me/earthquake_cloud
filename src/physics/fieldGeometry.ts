import { FieldContext, Point3, traceField } from './fieldModel';
export interface GeometryRequest { context: FieldContext; extent: number; planar: boolean; density: number }
export interface FieldGeometry { positions: Float32Array; logs: Float32Array; offsets: number[]; elapsedMs: number }
/** Bounded geometry work, independent of field amplitude. Executed off the UI thread. */
export function buildFieldGeometry(request: GeometryRequest): FieldGeometry {
  const started = performance.now();
  const { context, planar } = request;
  const extent = Math.max(3, Math.min(180, request.extent));
  const seeds: Point3[] = [];
  const count = Math.max(12, Math.min(32, request.density));
  const shells = [context.earth.radius*1.03, Math.min(3, extent*0.4), extent*0.72];
  for (const radius of shells) for (let i = 0; i < count; i++) {
    const a = i/count*Math.PI*2;
    const phi = planar ? 0 : (i%4)/4*Math.PI*2;
    seeds.push({ x: context.earth.x+radius*Math.sin(a)*Math.cos(phi), y: context.earth.y+radius*Math.cos(a), z: radius*Math.sin(a)*Math.sin(phi) });
  }
  // Budget is shared by every active source, so adding sources cannot multiply seed count without bound.
  const active = context.sources.filter(s => s.active && s.type !== 'uniform');
  for (let i = 0; i < Math.min(32, active.length*8); i++) {
    const source = active[i % active.length];
    const a = i/Math.max(1, active.length)*Math.PI/4;
    seeds.push({ x: source.x+0.3*Math.cos(a), y: source.y+0.3*Math.sin(a), z: planar ? 0 : source.z ?? 0 });
  }
  const positions: number[] = [], logs: number[] = [], offsets = [0];
  const inside = (p: Point3) => Math.hypot(p.x-context.earth.x, p.y-context.earth.y, p.z) <= extent*1.6;
  const step = Math.max(0.035, extent/160);
  for (const seed of seeds) {
    const line = [...traceField(seed, context, -1, 260, step, inside, planar).reverse(), ...traceField(seed, context, 1, 260, step, inside, planar).slice(1)];
    for (const p of line) { positions.push(p.x, p.y, p.z); logs.push(p.logNt); }
    offsets.push(logs.length);
  }
  return { positions: Float32Array.from(positions), logs: Float32Array.from(logs), offsets, elapsedMs: performance.now()-started };
}
