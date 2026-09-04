import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_EARTH_DIPOLE, DEFAULT_SOLAR_WIND, DEFAULT_MOON_CONFIG, DEFAULT_CLOUD_CONFIG, ExternalMagneticSource } from '../src/types';
import { parseFieldNt, sampleField, externalField, earthField, normalizedComponents, advanceMoon, advanceSource, coreResponse, DEFAULT_RESEARCH, fieldOpacity, magnetopausePoint, weakBoundaryPoint, needsLogOnly, distanceLabel } from '../src/physics/fieldModel';
import { buildFieldGeometry } from '../src/physics/fieldGeometry';
import { cloudLayerBounds, confineCloudParticle, displayCloudPosition } from '../src/physics/atmosphereGeometry';
import { CloudParticleSystem } from '../src/physics/cloudParticleEngine';
import { KNOWLEDGE, REFERENCES } from '../src/physics/knowledge';
const base={earth:{...DEFAULT_EARTH_DIPOLE,tiltAngle:0},sources:[] as ExternalMagneticSource[],solar:DEFAULT_SOLAR_WIND,moon:DEFAULT_MOON_CONFIG};
const source:ExternalMagneticSource={id:'d',name:'test',type:'dipole',x:4,y:0,angle:0,active:true,strength:1,fieldNt:'100'};

test('scientific input has no artificial nT ceiling and rejects invalid values without truncation',()=>{
  assert.equal(parseFieldNt('1e1000').logNt,1000);assert.equal(parseFieldNt('1e-1000').logNt,-1000);
  assert.equal(parseFieldNt('∞').logNt,Infinity);assert.equal(parseFieldNt('0').logNt,-Infinity);
  assert.ok(Math.abs(parseFieldNt('0.00123e5').logNt-Math.log10(123))<1e-12);
  for(const invalid of ['', '-1', 'NaN','1e','1e1.5','5 nT','1e999999999999999999999999']) assert.ok(parseFieldNt(invalid).error,invalid);
});
test('dipole decay remains inverse cube outside the softened center in all dimensions',()=>{
  for(const p of [{x:2,y:0,z:0},{x:0,y:0,z:2},{x:0,y:2,z:0}]){
    const a=earthField(p,base.earth),b=earthField({x:p.x*2,y:p.y*2,z:p.z*2},base.earth);
    assert.ok(Math.abs(10**(b.logNt-a.logNt)-1/8)<0.0003);
  }
});
test('IMF nT is not multiplied by a visualization gain',()=>{
  const a=externalField({x:2,y:0,z:0},{...base,solar:{...base.solar,enabled:true,imfBx:3,imfBz:4,fieldVisualizationGain:1000}});
  assert.ok(Math.abs(a.logNt-Math.log10(5))<1e-12);
});
test('Moon orbit does not invent a global field; explicit lunar hypothesis uses physical distance',()=>{
  const a=sampleField({x:2,y:0,z:0},base),b=sampleField({x:2,y:0,z:0},{...base,moon:{...base.moon,phaseAngleDeg:180,orbitRadius:3.5}});
  assert.deepEqual(a,b);
  const context={...base,moon:{...base.moon,hypothesisDipoleEnabled:true,remanentMoment:0.08,phaseAngleDeg:0}};
  const physical=externalField({x:0,y:0,z:0},context);
  const displayMoved=externalField({x:0,y:0,z:0},{...context,moon:{...context.moon,orbitRadius:2}});
  assert.deepEqual(physical,displayMoved);assert.ok(10**physical.logNt<0.02);
});
test('moon clock follows days/second and orbit period; OFF does not advance',()=>{
  const moon={...base.moon,phaseAngleDeg:0,daysPerSecond:1,orbitPeriodDays:27.32};
  assert.ok(Math.abs(advanceMoon(moon,27.32/4).phaseAngleDeg-90)<1e-10);
  const paused={...moon,autoOrbit:false};assert.equal(advanceMoon(paused,100),paused);
});
test('dipole axial rotation is independent of positional orbit, signed and shared by both fields',()=>{
  const rotating={...source,rotating:true,rotationSpeedDegS:90};
  const moved=advanceSource(rotating,base.earth,1);
  assert.equal(moved.x,source.x);assert.equal(moved.y,source.y);assert.equal(moved.angle,90);
  assert.equal(advanceSource({...rotating,rotationSpeedDegS:-90},base.earth,1).angle,270);
  assert.equal(advanceSource({...source,active:false,rotating:true},base.earth,1).angle,0);
  const a=sampleField({x:5,y:0,z:0},{...base,sources:[{...rotating,fieldNt:'1e9'}]});
  const b=sampleField({x:5,y:0,z:0},{...base,sources:[{...moved,fieldNt:'1e9'}]});
  assert.ok(Math.abs(a.x-b.x)>0.9);
});
test('huge finite fields retain logarithmic magnitude; infinite cancellation is explicitly indeterminate',()=>{
  const strong={...base,sources:[{...source,type:'uniform' as const,fieldNt:'1e1000'}]};
  assert.equal(sampleField({x:3,y:2,z:1},strong).logNt,1000);
  assert.ok(needsLogOnly(strong));
  const infinite={...source,type:'uniform' as const,fieldNt:'∞'};
  const f=sampleField({x:3,y:2,z:1},{...base,sources:[infinite]});
  assert.equal(f.logNt,Infinity);assert.equal(f.y,1);
  const cancellation=sampleField({x:3,y:2,z:1},{...base,sources:[infinite,{...infinite,id:'opposite',angle:180}]});
  assert.ok(cancellation.indeterminate);
});
test('field gradient fading and weak contour are distinct from a zero boundary',()=>{
  assert.ok(fieldOpacity(0)<fieldOpacity(3));assert.equal(fieldOpacity(-Infinity),0);
  const p=weakBoundaryPoint(Math.PI/2,0,base,10);
  assert.ok(Math.abs(10**earthField(p,base.earth).logNt-10)<0.01);
  assert.equal(magnetopausePoint(0,0,base),null);
  assert.equal(magnetopausePoint(0,0,{...base,solar:{...base.solar,enabled:true,imfBz:1000}}),null);
});
test('core coupling OFF and zero transmission preserve the null control even for infinity',()=>{
  const context={...base,sources:[{...source,type:'uniform' as const,fieldNt:'∞'}]};
  assert.equal(coreResponse(context,DEFAULT_RESEARCH).delta,0);
  assert.equal(coreResponse(context,{...DEFAULT_RESEARCH,coreHypothesis:true,coreCoupling:1,coreTransmission:0}).delta,0);
  const regular={...base,sources:[{...source,type:'uniform' as const,fieldNt:'100'}]};
  assert.ok(coreResponse(regular,{...DEFAULT_RESEARCH,coreHypothesis:true,coreCoupling:1,coreTransmission:0.01}).delta>0);
  assert.ok(coreResponse(regular,{...DEFAULT_RESEARCH,coreHypothesis:true,coreCoupling:-1,coreTransmission:0.01}).delta<0);
});
test('cloud particles stay in the prescribed physical altitude, display gain does not move physics',()=>{
  const system=new CloudParticleSystem(10), cloud={...DEFAULT_CLOUD_CONFIG,particleCount:10};
  system.update(cloud,base.earth,[],base.solar,0.1,0);
  const bounds=cloudLayerBounds(base.earth,cloud);
  for(const p of system.particles)assert.ok(Math.hypot(p.x,p.y)>=bounds.min-1e-12&&Math.hypot(p.x,p.y)<=bounds.max+1e-12);
  const point={x:3,y:1};confineCloudParticle(point,base.earth,cloud);const saved={...point};
  const shown=displayCloudPosition(point.x,point.y,base.earth,{...cloud,altitudeDisplayGain:100});
  assert.deepEqual(point,saved);assert.ok(Math.hypot(shown.x,shown.y)>Math.hypot(point.x,point.y));
  assert.equal(system.cloudBands.length,240);
});
test('distance readout is from Earth center, including translated Earth',()=>{
  assert.match(distanceLabel({x:5,y:2,z:0},{...base.earth,x:3,y:2}),/2.00 R_E.*12,742 km/);
});
test('geometry is finite and work is bounded for finite/huge/infinite external stimuli in both views',()=>{
  for(const planar of [true,false])for(const fieldNt of ['100','1e1000','∞']) {
    const geometry=buildFieldGeometry({context:{...base,sources:[{...source,fieldNt}]},extent:20,planar,density:12});
    assert.ok(geometry.positions.length>0);assert.ok(geometry.positions.length<3*130*520);
    assert.ok(geometry.positions.every(Number.isFinite));
    assert.ok(geometry.logs.every(value=>!Number.isNaN(value)));
  }
});
test('guide references resolve and hypothesis entries are explicit',()=>{
  assert.ok(KNOWLEDGE.length>50);
  for(const entry of KNOWLEDGE)for(const id of entry.sources??[])assert.ok(REFERENCES[id]?.url.startsWith('https://'));
  assert.ok(KNOWLEDGE.some(e=>e.terms.includes('단극자')&&e.evidence==='반드시 가설'));
  assert.ok(KNOWLEDGE.some(e=>e.terms.includes('외부장–외핵')&&e.evidence==='반드시 가설'));
});
