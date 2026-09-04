import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { AtmosphericCloudConfig, EarthDipoleConfig, ExternalMagneticSource, SolarWindConfig, MoonConfig, LayerVisibilityConfig } from '../types';
import { FieldContext, ResearchConfig, needsLogOnly, distanceLabel, fieldOpacity, magnetopausePoint, moonPosition, weakBoundaryPoint } from '../physics/fieldModel';
import { displayCloudPosition } from '../physics/atmosphereGeometry';
import { useFieldGeometry } from './useFieldGeometry';
import { VisualElementsGuidePanel } from './VisualElementsGuidePanel';
import { CoreFlowInset, FieldReadout } from './FieldReadout';
import { CloudParticleSystem } from '../physics/cloudParticleEngine';

interface Magnetosphere3DViewProps {
  earthConfig: EarthDipoleConfig; sources: ExternalMagneticSource[]; solarWind: SolarWindConfig;
  cloudConfig: AtmosphericCloudConfig; moonConfig: MoonConfig; research: ResearchConfig;
  isPlaying: boolean; setIsPlaying: React.Dispatch<React.SetStateAction<boolean>>;
  setLayerVisibility: React.Dispatch<React.SetStateAction<LayerVisibilityConfig>>;
  layerVisibility: LayerVisibilityConfig; particleSystem: CloudParticleSystem;
}
function disposeGroup(group: THREE.Object3D) {
  group.traverse(object => {
    const mesh = object as THREE.Mesh;
    mesh.geometry?.dispose();
    const materials = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
    materials.forEach(material => { (material as THREE.SpriteMaterial).map?.dispose(); material.dispose(); });
  });
  group.clear();
}
function labelSprite(text: string) {
  const canvas = document.createElement('canvas'); canvas.width=512; canvas.height=64;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle='#cbd5e1'; ctx.font='22px monospace'; ctx.fillText(text, 4, 40);
  const texture = new THREE.CanvasTexture(canvas);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map:texture, transparent:true, depthTest:false }));
  sprite.scale.set(6,0.75,1); return sprite;
}
export const Magnetosphere3DView: React.FC<Magnetosphere3DViewProps> = (props) => {
  const { earthConfig, sources, solarWind, moonConfig, research, isPlaying, setIsPlaying, layerVisibility, particleSystem } = props;
  const mountRef = useRef<HTMLDivElement>(null);
  const [extent,setExtent] = useState(18);
  const [autoRotate,setAutoRotate] = useState(false);
  const showFlux=layerVisibility.streamlines, showBoundary=layerVisibility.solarWind;
  const showParticles=layerVisibility.cloudParticles||layerVisibility.cloudBands||layerVisibility.waveClouds;
  const [error,setError] = useState<string|null>(null);
  const [probe,setProbe] = useState('');
  const [fps,setFps] = useState(0);
  const context = useMemo<FieldContext>(() => ({ earth:earthConfig, sources, solar:solarWind, moon:moonConfig }),[earthConfig,sources,solarWind,moonConfig]);
  const field = useFieldGeometry({ context, extent, planar:false, density:24 });
  const latest = useRef(props); latest.current=props;
  const refs = useRef<{ scene:THREE.Scene; renderer:THREE.WebGLRenderer; camera:THREE.PerspectiveCamera; controls:OrbitControls;
    earth:THREE.Group; moon:THREE.Mesh; sources:THREE.Group; boundaries:THREE.Group; lines:THREE.Group; cloud:THREE.Points; pulses:THREE.Points }|null>(null);

  useEffect(() => {
    const mount=mountRef.current; if(!mount) return;
    let renderer:THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias:true, alpha:false }); }
    catch(cause) { console.error('3D renderer initialization failed',cause); setError('WebGL을 시작할 수 없습니다. 2D 화면을 사용하거나 하드웨어 가속을 확인하세요.'); return; }
    renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
    mount.appendChild(renderer.domElement);
    const scene=new THREE.Scene(); scene.background=new THREE.Color('#050a12');
    const camera=new THREE.PerspectiveCamera(45,1,0.01,2000); camera.position.set(0,6,24);
    const controls=new OrbitControls(camera,renderer.domElement); controls.enableDamping=true; controls.minDistance=2; controls.maxDistance=450;
    const earth=new THREE.Group();
    earth.add(new THREE.Mesh(new THREE.SphereGeometry(1,32,24),new THREE.MeshBasicMaterial({ color:0x12314f })));
    earth.add(new THREE.Mesh(new THREE.SphereGeometry(1.005,16,12),new THREE.MeshBasicMaterial({ color:0x38bdf8,wireframe:true,transparent:true,opacity:0.18 })));
    scene.add(earth);
    const moon=new THREE.Mesh(new THREE.SphereGeometry(0.2727,20,16),new THREE.MeshBasicMaterial({ color:0xcbd5e1, wireframe:true })); scene.add(moon);
    const sourceGroup=new THREE.Group(), boundaries=new THREE.Group(), lines=new THREE.Group();
    scene.add(sourceGroup,boundaries,lines);
    const cloudGeometry=new THREE.BufferGeometry(); cloudGeometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(3000*3),3)); cloudGeometry.setDrawRange(0,0);
    cloudGeometry.setAttribute('color',new THREE.BufferAttribute(new Float32Array(3000*3),3));
    const cloud=new THREE.Points(cloudGeometry,new THREE.PointsMaterial({ vertexColors:true, size:0.014, transparent:true, opacity:0.7 })); scene.add(cloud);
    const pulseGeo=new THREE.BufferGeometry(); pulseGeo.setAttribute('position',new THREE.BufferAttribute(new Float32Array(64*3),3)); pulseGeo.setDrawRange(0,0);
    const pulses=new THREE.Points(pulseGeo,new THREE.PointsMaterial({ color:0x67e8f9,size:0.055,transparent:true,opacity:0.55 })); scene.add(pulses);
    refs.current={ scene,renderer,camera,controls,earth,moon,sources:sourceGroup,boundaries,lines,cloud,pulses };
    let frame=0, previous=performance.now(), count=0, mark=previous, phase=0;
    const draw=(now:number) => {
      frame=requestAnimationFrame(draw);
      if(document.hidden) { previous=now; return; }
      const dt=Math.min(0.05,(now-previous)/1000); previous=now;
      const state=latest.current;
      if(state.isPlaying) phase+=dt;
      const position=moonPosition(state.earthConfig,state.moonConfig);
      earth.position.set(state.earthConfig.x,state.earthConfig.y,0); earth.scale.setScalar(state.earthConfig.radius);
      earth.visible=state.layerVisibility.earthBody;
      moon.position.set(position.x,position.y,0); moon.rotation.z=state.moonConfig.phaseAngleDeg*Math.PI/180;
      moon.visible=state.moonConfig.enabled && state.layerVisibility.moonBody;
      // Same planar atmospheric particles as 2D, not invented independent 3D dynamics.
      const cloudPositions=cloudGeometry.getAttribute('position') as THREE.BufferAttribute;
      const cloudColors=cloudGeometry.getAttribute('color') as THREE.BufferAttribute;
      const particles=state.particleSystem.particles, bands=state.particleSystem.cloudBands;
      const n=state.layerVisibility.cloudParticles && state.cloudConfig.showParticles ? Math.min(2700,particles.length) : 0;
      let drawn=0;
      for(let i=0;i<n;i++) {
        const at=displayCloudPosition(particles[i].x,particles[i].y,state.earthConfig,state.cloudConfig);
        cloudPositions.setXYZ(drawn,at.x,at.y,0);
        const light=particles[i].condensationFactor*particles[i].opacity;
        cloudColors.setXYZ(drawn,light*0.8,light*0.93,light);drawn++;
      }
      if(state.layerVisibility.cloudBands || state.layerVisibility.waveClouds) for(const band of bands) {
        if(drawn>=3000)break;
        const at=displayCloudPosition(band.x,band.y,state.earthConfig,state.cloudConfig);
        const light=Math.max(state.layerVisibility.cloudBands ? band.baseline : 0,state.layerVisibility.waveClouds && state.cloudConfig.showWaveClouds ? band.hypothesis : 0);
        cloudPositions.setXYZ(drawn,at.x,at.y,0);cloudColors.setXYZ(drawn,light*0.8,light*0.93,light);drawn++;
      }
      cloudPositions.needsUpdate=true;cloudColors.needsUpdate=true;cloudGeometry.setDrawRange(0,drawn);
      const currentGeometry=geometryRef.current;
      if(currentGeometry) {
        const positions=pulseGeo.getAttribute('position') as THREE.BufferAttribute;
        const count=Math.min(64,currentGeometry.offsets.length-1);
        for(let i=0;i<count;i++) {
          const start=currentGeometry.offsets[i], length=currentGeometry.offsets[i+1]-start;
          const index=length ? start+Math.floor((phase*15+i*7)%length) : 0;
          positions.setXYZ(i,currentGeometry.positions[index*3]??0,currentGeometry.positions[index*3+1]??0,currentGeometry.positions[index*3+2]??0);
        }
        positions.needsUpdate=true; pulseGeo.setDrawRange(0,count);
      }
      controls.update(); renderer.render(scene,camera);
      count++; if(now-mark>=1000) { setFps(Math.round(count*1000/(now-mark))); count=0; mark=now; }
    };
    frame=requestAnimationFrame(draw);
    const resize=()=> { const w=mount.clientWidth,h=mount.clientHeight; if(w<1||h<1)return; renderer.setSize(w,h); camera.aspect=w/h; camera.updateProjectionMatrix(); };
    const observer=new ResizeObserver(resize); observer.observe(mount); resize();
    const onEnd=()=>setExtent(Math.min(180,Math.max(4,controls.getDistance()*0.75)));
    controls.addEventListener('end',onEnd);
    const onContext=(event:MouseEvent)=>{
      event.preventDefault();
      const rect=renderer.domElement.getBoundingClientRect();
      const mouse=new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);
      const ray=new THREE.Raycaster(); ray.setFromCamera(mouse,camera);
      const at=ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,0,1),0),new THREE.Vector3());
      setProbe(at ? 'z=0 단면 측정: '+distanceLabel(at,latest.current.earthConfig) : '현재 시선은 z=0 단면과 평행합니다.');
    };
    renderer.domElement.addEventListener('contextmenu',onContext);
    return ()=>{ cancelAnimationFrame(frame); observer.disconnect(); controls.removeEventListener('end',onEnd); controls.dispose();
      renderer.domElement.removeEventListener('contextmenu',onContext); disposeGroup(scene); renderer.dispose(); renderer.domElement.remove(); refs.current=null; };
  }, []);
  const geometryRef=useRef(field.geometry); geometryRef.current=field.geometry;

  useEffect(()=>{
    const ref=refs.current, geometry=field.geometry; if(!ref||!geometry)return;
    disposeGroup(ref.lines);
    const positions:number[]=[], alphas:number[]=[];
    for(let l=0;l<geometry.offsets.length-1;l++) for(let j=geometry.offsets[l]+1;j<geometry.offsets[l+1];j++) {
      for(const k of [j-1,j]) { positions.push(geometry.positions[3*k],geometry.positions[3*k+1],geometry.positions[3*k+2]); alphas.push(fieldOpacity(geometry.logs[k])); }
    }
    const geo=new THREE.BufferGeometry(); geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3)); geo.setAttribute('strengthAlpha',new THREE.Float32BufferAttribute(alphas,1));
    const mat=new THREE.ShaderMaterial({ transparent:true, depthWrite:false,
      vertexShader:'attribute float strengthAlpha; varying float alpha; void main(){alpha=strengthAlpha; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader:'varying float alpha; void main(){gl_FragColor=vec4(0.22,0.83,0.98,alpha);}' });
    ref.lines.add(new THREE.LineSegments(geo,mat));
  },[field.geometry]);

  useEffect(()=>{
    const ref=refs.current; if(!ref)return;
    const active=sources.filter(s=>s.active&&s.type!=='uniform');
    for(const child of [...ref.sources.children]) if(!active.some(s=>s.id===child.name)){disposeGroup(child);ref.sources.remove(child);}
    for(const source of active) {
      let marker=ref.sources.getObjectByName(source.id) as THREE.Group;
      if(!marker) {
        marker=new THREE.Group();marker.name=source.id;
        const dipole=source.type==='dipole';
        const north=new THREE.Mesh(new THREE.SphereGeometry(0.12,10,8),new THREE.MeshBasicMaterial({color:dipole?0xef4444:0xf59e0b}));
        north.position.y=dipole?0.24:0;marker.add(north);
        if(dipole){const south=new THREE.Mesh(new THREE.SphereGeometry(0.12,10,8),new THREE.MeshBasicMaterial({color:0x3b82f6}));south.position.y=-0.24;marker.add(south);}
        ref.sources.add(marker);
      }
      marker.position.set(source.x,source.y,source.z??0);marker.rotation.z=(source.angle??0)*Math.PI/180;
    }
  },[sources]);

  useEffect(()=>{
    const ref=refs.current; if(!ref)return;
    disposeGroup(ref.boundaries);
    const line=(points:THREE.Vector3[],color:number,dashed=false)=>{
      const geometry=new THREE.BufferGeometry().setFromPoints(points);
      const material=dashed ? new THREE.LineDashedMaterial({ color, dashSize:0.35,gapSize:0.2, transparent:true,opacity:0.5 }) : new THREE.LineBasicMaterial({ color,transparent:true,opacity:0.35 });
      const object=new THREE.Line(geometry,material); object.computeLineDistances(); ref.boundaries.add(object);
    };
    if(research.distances && layerVisibility.gridAxes) for(const radius of [1,2,5,10,20,40,60]) {
      if(radius>extent*1.5)continue;
      const points=Array.from({length:97},(_,i)=>{ const a=i/96*Math.PI*2; return new THREE.Vector3(earthConfig.x+radius*Math.cos(a),earthConfig.y+radius*Math.sin(a),0); });
      line(points,0x64748b,true);
      const label=labelSprite(radius+' R_E · '+(radius*6371).toLocaleString()+' km'); label.position.set(earthConfig.x+radius,earthConfig.y,0); ref.boundaries.add(label);
    }
    if(research.weakBoundary && layerVisibility.streamlines) for(let phi=0;phi<Math.PI*2;phi+=Math.PI/4) {
      line(Array.from({length:97},(_,i)=>{ const p=weakBoundaryPoint(i/96*Math.PI,phi,context,research.weakThresholdNt); return new THREE.Vector3(p.x,p.y,p.z); }),0xa78bfa,true);
    }
    if(research.magnetopause && showBoundary && layerVisibility.solarWind) for(let phi=0;phi<Math.PI*2;phi+=Math.PI/4) {
      const points:THREE.Vector3[]=[];
      for(let theta=0;theta<2.8;theta+=0.04) { const p=magnetopausePoint(theta,phi,context); if(p && Math.hypot(p.x-earthConfig.x,p.y-earthConfig.y,p.z)<extent*3)points.push(new THREE.Vector3(p.x,p.y,p.z)); }
      if(points.length>1)line(points,0xf59e0b);
    }
    if(moonConfig.enabled && moonConfig.showOrbit && layerVisibility.moonOrbit) {
      const radius=moonConfig.physicalDistanceEarthRadii??60.3;
      line(Array.from({length:129},(_,i)=>new THREE.Vector3(earthConfig.x+radius*Math.cos(i/128*Math.PI*2),earthConfig.y+radius*Math.sin(i/128*Math.PI*2),0)),0xcbd5e1,true);
    }
  },[earthConfig,solarWind,research,extent,showBoundary,moonConfig.enabled,moonConfig.showOrbit,moonConfig.physicalDistanceEarthRadii,layerVisibility.gridAxes,layerVisibility.moonOrbit,layerVisibility.streamlines,layerVisibility.solarWind]);
  useEffect(()=>{
    const ref=refs.current;if(!ref)return;
    ref.controls.autoRotate=autoRotate && isPlaying;
    ref.lines.visible=showFlux && layerVisibility.streamlines; ref.pulses.visible=ref.lines.visible;
    ref.sources.visible=layerVisibility.externalSources;
    ref.cloud.visible=showParticles && (layerVisibility.cloudParticles||layerVisibility.cloudBands||layerVisibility.waveClouds) && props.cloudConfig.enabled && !needsLogOnly(context);
  },[autoRotate,isPlaying,showFlux,showParticles,layerVisibility,props.cloudConfig.enabled,sources]);
  const fit=(radius:number)=>{ const ref=refs.current;if(!ref)return; ref.controls.target.set(earthConfig.x,earthConfig.y,0); ref.camera.position.set(earthConfig.x,earthConfig.y+radius*0.3,radius*2.6); ref.controls.update();setExtent(radius*1.25); };
  return <div className="relative w-full h-full min-h-0 bg-[#050a12] overflow-hidden">
    <div ref={mountRef} className="absolute inset-0" />
    <div className="absolute top-2 left-2 right-2 z-20 flex flex-wrap gap-1 text-[10px]">
      <button id="btn-toggle-flux-tubes" aria-pressed={showFlux} onClick={()=>props.setLayerVisibility(v=>({...v,streamlines:!v.streamlines}))} className="bg-slate-900 border rounded p-1">3D RK4 자기력선</button>
      <button id="btn-toggle-bow-shock" aria-pressed={showBoundary} onClick={()=>props.setLayerVisibility(v=>({...v,solarWind:!v.solarWind}))} className="bg-slate-900 border rounded p-1">자기권계면</button>
      <button id="btn-toggle-3d-particles" aria-pressed={showParticles} onClick={()=>props.setLayerVisibility(v=>({...v,cloudParticles:!showParticles,cloudBands:!showParticles,waveClouds:!showParticles}))} className="bg-slate-900 border rounded p-1">공유 입자 (z=0)</button>
      <button id="btn-toggle-auto-rotate" aria-pressed={autoRotate} onClick={()=>setAutoRotate(v=>!v)} className="bg-slate-900 border rounded p-1">카메라 회전</button>
      <button onClick={()=>setIsPlaying(v=>!v)} className="bg-slate-900 border rounded p-1">{isPlaying?'일시정지':'재생'}</button>
      <button onClick={()=>fit(18)} className="bg-slate-900 border rounded p-1">자기권 맞춤</button>
      <button onClick={()=>fit(moonConfig.physicalDistanceEarthRadii??60.3)} className="bg-slate-900 border rounded p-1">달 궤도 맞춤</button>
    </div>
    <FieldReadout context={context} research={research} error={error??field.error} calculationMs={field.geometry?.elapsedMs} />
    {layerVisibility.earthBody && <CoreFlowInset context={context} research={research} playing={isPlaying} />}
    <div className="absolute top-28 right-2 z-40 max-w-[95%]"><VisualElementsGuidePanel layerVisibility={layerVisibility} setLayerVisibility={props.setLayerVisibility} supportedLayers={['earthBody','streamlines','solarWind','externalSources','moonBody','moonOrbit','cloudParticles','cloudBands','waveClouds','gridAxes','probeMarker']} /></div>
    <p className="absolute bottom-10 left-2 text-[10px] bg-slate-950/90 p-1 pointer-events-none">공유 구름 단면: {props.cloudConfig.cloudAltitudeKm??12} ± {props.cloudConfig.cloudLayerHalfWidthKm??1.5} km · 고도 표시 ×{props.cloudConfig.altitudeDisplayGain??1}</p>
    <p className="absolute bottom-3 left-2 text-[10px] bg-slate-950/90 p-1 pointer-events-none">{fps} FPS · 드래그 회전 / 휠 확대 · 우클릭: 중심 거리<br/>{layerVisibility.probeMarker ? probe : ''}</p>
  </div>;
};
