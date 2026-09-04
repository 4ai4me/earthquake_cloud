import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { buildVerificationPython } from '../src/physics/verificationScript';
import { normalizedComponents, sampleField } from '../src/physics/fieldModel';
import { mapSkyDomeToAtmosphere } from '../src/physics/magneticEngine';
import { DEFAULT_EARTH_DIPOLE, DEFAULT_MOON_CONFIG, DEFAULT_CLOUD_CONFIG, DEFAULT_SOLAR_WIND, ExternalMagneticSource } from '../src/types';

// Execute the actual exported field functions with a scalar NumPy-compatible
// adapter, so CI needs only Python's standard library, not plotting packages.
const scalarNumpy = `import math, types
np=types.SimpleNamespace(pi=math.pi,sin=math.sin,cos=math.cos,radians=math.radians,sqrt=math.sqrt,exp=math.exp,maximum=max,sign=lambda x: (x>0)-(x<0),where=lambda c,a,b:a if c else b)
`;
function scalarExport(sources:ExternalMagneticSource[]) {
  const earth={...DEFAULT_EARTH_DIPOLE,x:0.2,y:-0.1,tiltAngle:23};
  const solar={...DEFAULT_SOLAR_WIND,enabled:true,imfBx:3,imfBz:-7,fieldVisualizationGain:1000};
  const moon={...DEFAULT_MOON_CONFIG,hypothesisDipoleEnabled:true,remanentMoment:0.2,phaseAngleDeg:170};
  let script=buildVerificationPython(earth,sources,solar,DEFAULT_CLOUD_CONFIG,moon);
  script=script.slice(0,script.indexOf('Bx_e, By_e, Bz_e ='));
  script=script.replace('import numpy as np',scalarNumpy).replace('import matplotlib.pyplot as plt','');
  script=script.replace(/x = np.linspace[\s\S]*?(?=from decimal)/,'');
  return {script,context:{earth,sources,solar,moon}};
}
test('exported Python reproduces rotated dipoles, IMF, comet, monopoles, uniform and lunar hypothesis',()=>{
  const base={id:'s',name:'한글 자기원',x:3,y:-1,z:0.4,strength:0.7,active:true,angle:57};
  const sources:ExternalMagneticSource[]=[
    {...base,type:'dipole',fieldNt:'1.2e5'},
    {...base,id:'n',type:'monopole_n',x:-4,fieldNt:'700'},
    {...base,id:'s2',type:'monopole_s',x:-2,strength:-0.4},
    {...base,id:'u',type:'uniform',fieldNt:'12'},
    {...base,id:'c',type:'comet',x:-2,z:0,cometGasActivity:0.6,cometTailLength:4},
  ];
  const {script,context}=scalarExport(sources);
  const points=[{x:2,y:0.4,z:0},{x:0.1,y:-2,z:0},{x:3.1,y:-0.9,z:0}];
  const output=spawnSync('python',['-X','utf8','-c',script+'\nprint(json.dumps([total_field(p[0],p[1]) for p in '+JSON.stringify(points.map(p=>[p.x,p.y]))+']))'],{encoding:'utf8'});
  assert.equal(output.status,0,output.stderr);
  const actual=JSON.parse(output.stdout) as number[][];
  points.forEach((p,i)=>{
    const expected=normalizedComponents(sampleField(p,context));
    [expected.bx,expected.by,expected.bz].forEach((value,j)=>assert.ok(Math.abs(actual[i][j]-value)<=1e-11*Math.max(1,Math.abs(value)),`${i}/${j}: ${actual[i][j]} vs ${value}`));
  });
});
test('Python export explicitly refuses extreme quantitative arithmetic without losing its snapshot',()=>{
  const {script}=scalarExport([{id:'s',name:'extreme',type:'uniform',x:4,y:0,strength:1,active:true,fieldNt:'1e1000'}]);
  assert.match(script,/1e1000/);
  assert.match(script,/schemaVersion/);
  const output=spawnSync('python',['-X','utf8','-c',script],{encoding:'utf8'});
  assert.notEqual(output.status,0);
  assert.match(output.stderr,/Extreme\/log-direction mode/);
});
test('ground sky samples the requested cloud altitude instead of a giant visual atmosphere',()=>{
  const earth={...DEFAULT_EARTH_DIPOLE,x:2,y:-1};
  for(const [u,v] of [[0,0],[0.8,0],[0.2,0.7]]) {
    const p=mapSkyDomeToAtmosphere(u,v,earth,38,12,140);
    assert.equal(p.isVisible,true);
    assert.ok(Math.abs((Math.hypot(p.wx-earth.x,p.wy-earth.y)-earth.radius)*6371-12)<1e-8);
  }
  assert.equal(mapSkyDomeToAtmosphere(2,2,earth,38).isVisible,false);
});
