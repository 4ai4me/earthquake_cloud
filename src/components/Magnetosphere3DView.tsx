import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { AtmosphericCloudConfig, EarthDipoleConfig, ExternalMagneticSource, SolarWindConfig } from '../types';
import { RotateCw, Eye, Sparkles, Orbit, Compass, Sliders, Shield } from 'lucide-react';

interface Magnetosphere3DViewProps {
  earthConfig: EarthDipoleConfig;
  sources: ExternalMagneticSource[];
  solarWind: SolarWindConfig;
  cloudConfig: AtmosphericCloudConfig;
}

export const Magnetosphere3DView: React.FC<Magnetosphere3DViewProps> = ({
  earthConfig,
  sources,
  solarWind,
  cloudConfig,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [autoRotate, setAutoRotate] = useState<boolean>(true);
  const [showBowShock, setShowBowShock] = useState<boolean>(true);
  const [showFluxTubes, setShowFluxTubes] = useState<boolean>(true);
  const [showCloudParticles, setShowCloudParticles] = useState<boolean>(true);

  // Scene references for updates
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const fieldLinesGroupRef = useRef<THREE.Group | null>(null);
  const particlesGroupRef = useRef<THREE.Points | null>(null);
  const bowShockMeshRef = useRef<THREE.Mesh | null>(null);
  const earthMeshRef = useRef<THREE.Group | null>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const width = mount.clientWidth;
    const height = mount.clientHeight;

    // 1. Setup Scene, Camera, Renderer
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x08080b);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 5, 12);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 2. Lighting
    const ambientLight = new THREE.AmbientLight(0x334155, 1.2);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xffffff, 2.5);
    sunLight.position.set(-20, 5, 10);
    scene.add(sunLight);

    const backGlow = new THREE.PointLight(0x06b6d4, 1.5, 30);
    backGlow.position.set(0, 0, 0);
    scene.add(backGlow);

    // 3. Earth Planetary Group
    const earthGroup = new THREE.Group();
    earthMeshRef.current = earthGroup;

    // Earth Sphere
    const earthGeo = new THREE.SphereGeometry(1.2, 36, 36);
    const earthMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.6,
      metalness: 0.2,
      emissive: 0x0369a1,
      emissiveIntensity: 0.15,
    });
    const earthMesh = new THREE.Mesh(earthGeo, earthMat);
    earthGroup.add(earthMesh);

    // Earth Lat/Long Wireframe Grid
    const gridGeo = new THREE.SphereGeometry(1.21, 18, 18);
    const gridMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      wireframe: true,
      transparent: true,
      opacity: 0.18,
    });
    const gridMesh = new THREE.Mesh(gridGeo, gridMat);
    earthGroup.add(gridMesh);

    // Atmosphere Glow Shell
    const atmoGeo = new THREE.SphereGeometry(1.45, 32, 32);
    const atmoMat = new THREE.MeshBasicMaterial({
      color: 0x0ea5e9,
      transparent: true,
      opacity: 0.12,
      side: THREE.BackSide,
    });
    const atmoMesh = new THREE.Mesh(atmoGeo, atmoMat);
    earthGroup.add(atmoMesh);

    // Magnetic Dipole Axis Cylinder
    const axisGeo = new THREE.CylinderGeometry(0.04, 0.04, 3.2, 16);
    const axisMat = new THREE.MeshBasicMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.7 });
    const axisMesh = new THREE.Mesh(axisGeo, axisMat);
    earthGroup.add(axisMesh);

    // Magnetic Poles (Red N, Blue S)
    const poleGeo = new THREE.SphereGeometry(0.12, 16, 16);
    const nPoleMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
    const sPoleMat = new THREE.MeshBasicMaterial({ color: 0x3b82f6 });

    const nPole = new THREE.Mesh(poleGeo, nPoleMat);
    nPole.position.set(0, 1.5, 0);
    earthGroup.add(nPole);

    const sPole = new THREE.Mesh(poleGeo, sPoleMat);
    sPole.position.set(0, -1.5, 0);
    earthGroup.add(sPole);

    scene.add(earthGroup);

    // 4. Magnetosphere Bow Shock Shell (Paraboloid)
    const bowShockGeo = new THREE.CylinderGeometry(0.1, 4.8, 6.0, 32, 1, true);
    const bowShockMat = new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      transparent: true,
      opacity: 0.15,
      wireframe: true,
      side: THREE.DoubleSide,
    });
    const bowShockMesh = new THREE.Mesh(bowShockGeo, bowShockMat);
    bowShockMesh.rotation.z = Math.PI / 2;
    bowShockMesh.position.set(-1.8, 0, 0);
    bowShockMeshRef.current = bowShockMesh;
    scene.add(bowShockMesh);

    // 5. 3D Magnetic Field Lines Group
    const fieldLinesGroup = new THREE.Group();
    fieldLinesGroupRef.current = fieldLinesGroup;
    scene.add(fieldLinesGroup);

    // 6. 3D Atmospheric / Magnetosphere Particles (Clouds & Solar Ions)
    const particleCount = 1200;
    const particleGeo = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    const particleColors = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      const r = 1.3 + Math.random() * 3.8;

      const x = r * Math.sin(phi) * Math.cos(theta);
      const y = r * Math.sin(phi) * Math.sin(theta);
      const z = r * Math.cos(phi);

      particlePositions[i * 3] = x;
      particlePositions[i * 3 + 1] = y;
      particlePositions[i * 3 + 2] = z;

      // Color gradation (Cyan atmospheric vapor to golden solar wind)
      const isSunward = x < -0.5;
      particleColors[i * 3] = isSunward ? 0.95 : 0.4;
      particleColors[i * 3 + 1] = isSunward ? 0.75 : 0.9;
      particleColors[i * 3 + 2] = isSunward ? 0.2 : 1.0;
    }

    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    particleGeo.setAttribute('color', new THREE.BufferAttribute(particleColors, 3));

    const particleMat = new THREE.PointsMaterial({
      size: 0.08,
      vertexColors: true,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
    });

    const particles = new THREE.Points(particleGeo, particleMat);
    particlesGroupRef.current = particles;
    scene.add(particles);

    // 7. Interactive Mouse Orbit Controls
    let isDragging = false;
    let previousMousePosition = { x: 0, y: 0 };
    let cameraAngle = { theta: 0.2, phi: 1.1, radius: 14 };

    const updateCameraPosition = () => {
      cameraAngle.phi = Math.max(0.1, Math.min(Math.PI - 0.1, cameraAngle.phi));
      camera.position.x = cameraAngle.radius * Math.sin(cameraAngle.phi) * Math.sin(cameraAngle.theta);
      camera.position.y = cameraAngle.radius * Math.cos(cameraAngle.phi);
      camera.position.z = cameraAngle.radius * Math.sin(cameraAngle.phi) * Math.cos(cameraAngle.theta);
      camera.lookAt(0, 0, 0);
    };
    updateCameraPosition();

    const onMouseDown = (e: MouseEvent) => {
      isDragging = true;
      previousMousePosition = { x: e.clientX, y: e.clientY };
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const deltaX = e.clientX - previousMousePosition.x;
      const deltaY = e.clientY - previousMousePosition.y;

      cameraAngle.theta -= deltaX * 0.008;
      cameraAngle.phi -= deltaY * 0.008;
      updateCameraPosition();

      previousMousePosition = { x: e.clientX, y: e.clientY };
    };

    const onMouseUp = () => {
      isDragging = false;
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      cameraAngle.radius = Math.max(4, Math.min(28, cameraAngle.radius + e.deltaY * 0.015));
      updateCameraPosition();
    };

    const domElement = renderer.domElement;
    domElement.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    domElement.addEventListener('wheel', onWheel, { passive: false });

    // 8. Animation Loop
    let animId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      const elapsed = clock.getElapsedTime();

      // Earth rotation and tilt
      if (earthMeshRef.current) {
        earthMeshRef.current.rotation.z = (earthConfig.tiltAngle * Math.PI) / 180;
        if (autoRotate) {
          earthMeshRef.current.rotation.y = elapsed * 0.25;
        }
      }

      // Particles flow along 3D field loops
      if (particlesGroupRef.current) {
        const positions = particlesGroupRef.current.geometry.attributes.position.array as Float32Array;
        for (let i = 0; i < particleCount; i++) {
          let x = positions[i * 3];
          let y = positions[i * 3 + 1];
          let z = positions[i * 3 + 2];

          // Slow drift
          y += Math.sin(elapsed + x) * 0.008;
          x += (solarWind.enabled ? -0.015 * solarWind.speed : 0) + Math.cos(elapsed + z) * 0.005;

          // Recycle particles
          if (x < -6.0 || Math.hypot(x, y, z) < 1.25) {
            const r = 1.35 + Math.random() * 3.5;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(Math.random() * 2 - 1);
            x = r * Math.sin(phi) * Math.cos(theta);
            y = r * Math.sin(phi) * Math.sin(theta);
            z = r * Math.cos(phi);
          }

          positions[i * 3] = x;
          positions[i * 3 + 1] = y;
          positions[i * 3 + 2] = z;
        }
        particlesGroupRef.current.geometry.attributes.position.needsUpdate = true;
      }

      renderer.render(scene, camera);
      animId = requestAnimationFrame(animate);
    };

    animate();

    // 9. Resize observer
    const handleResize = () => {
      if (!mount) return;
      const newW = mount.clientWidth;
      const newH = mount.clientHeight;
      camera.aspect = newW / newH;
      camera.updateProjectionMatrix();
      renderer.setSize(newW, newH);
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(mount);

    return () => {
      cancelAnimationFrame(animId);
      resizeObserver.disconnect();
      domElement.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      domElement.removeEventListener('wheel', onWheel);
      if (mount && renderer.domElement) {
        mount.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [earthConfig, solarWind, autoRotate]);

  // Update 3D Field Lines dynamically based on Earth dipole & external poles
  useEffect(() => {
    const fieldLinesGroup = fieldLinesGroupRef.current;
    if (!fieldLinesGroup) return;

    // Clear old lines
    while (fieldLinesGroup.children.length > 0) {
      fieldLinesGroup.remove(fieldLinesGroup.children[0]);
    }

    if (!showFluxTubes) return;

    // Generate 3D Dipole Field Loops
    const rings = 16;
    const lValues = [2.2, 3.2, 4.5, 6.0]; // L-Shell parameters

    for (const L of lValues) {
      for (let rIdx = 0; rIdx < rings; rIdx++) {
        const phi = (rIdx / rings) * Math.PI * 2;
        const curvePoints: THREE.Vector3[] = [];

        // Dipole field line equation: r = L * sin^2(theta)
        for (let t = 0.18; t <= Math.PI - 0.18; t += 0.08) {
          const r = L * Math.sin(t) * Math.sin(t);
          let x = r * Math.sin(t) * Math.cos(phi);
          let y = r * Math.cos(t);
          let z = r * Math.sin(t) * Math.sin(phi);

          // Solar wind day-side compression & night-side tail elongation
          if (solarWind.enabled) {
            if (x < 0) {
              // Compressed dayside
              x *= 1 / (1 + 0.35 * solarWind.pressure);
            } else {
              // Stretched magnetotail
              x *= 1 + 0.25 * solarWind.pressure;
            }
          }

          curvePoints.push(new THREE.Vector3(x, y, z));
        }

        if (curvePoints.length > 2) {
          const curve = new THREE.CatmullRomCurve3(curvePoints);
          const geometry = new THREE.TubeGeometry(curve, 32, 0.025, 6, false);

          const intensity = 1.0 / (L * 0.35);
          const material = new THREE.MeshBasicMaterial({
            color: new THREE.Color().setHSL(0.55 + intensity * 0.15, 0.9, 0.6),
            transparent: true,
            opacity: 0.45,
          });

          const tube = new THREE.Mesh(geometry, material);
          fieldLinesGroup.add(tube);
        }
      }
    }
  }, [earthConfig, sources, solarWind, showFluxTubes]);

  return (
    <div className="relative w-full h-full min-h-[520px] bg-[#08080b] rounded-lg overflow-hidden border border-[#1e1e24] shadow-2xl flex flex-col">
      {/* 3D View Controls Bar - High Density */}
      <div className="absolute top-2.5 left-2.5 right-2.5 z-20 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        <div className="flex items-center gap-1 p-1 bg-[#0f0f13] rounded border border-[#1e1e24] shadow-lg pointer-events-auto">
          <button
            id="btn-toggle-flux-tubes"
            onClick={() => setShowFluxTubes(!showFluxTubes)}
            className={`px-2.5 py-1 text-xs font-mono rounded transition-colors flex items-center gap-1.5 ${
              showFluxTubes
                ? 'bg-[#181824] text-cyan-300 border border-[#2c2c3e] font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Orbit className="w-3.5 h-3.5 text-cyan-400" />
            3D Flux Tubes
          </button>
          <button
            id="btn-toggle-bow-shock"
            onClick={() => {
              setShowBowShock(!showBowShock);
              if (bowShockMeshRef.current) bowShockMeshRef.current.visible = !showBowShock;
            }}
            className={`px-2.5 py-1 text-xs font-mono rounded transition-colors flex items-center gap-1.5 ${
              showBowShock
                ? 'bg-[#181824] text-amber-300 border border-[#2c2c3e] font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Shield className="w-3.5 h-3.5 text-amber-400" />
            Bow Shock
          </button>
          <button
            id="btn-toggle-3d-particles"
            onClick={() => {
              setShowCloudParticles(!showCloudParticles);
              if (particlesGroupRef.current) particlesGroupRef.current.visible = !showCloudParticles;
            }}
            className={`px-2.5 py-1 text-xs font-mono rounded transition-colors flex items-center gap-1.5 ${
              showCloudParticles
                ? 'bg-[#181824] text-purple-300 border border-[#2c2c3e] font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            Cloud Particles
          </button>
        </div>

        <div className="flex items-center gap-1 p-1 bg-[#0f0f13] rounded border border-[#1e1e24] shadow-lg pointer-events-auto">
          <button
            id="btn-toggle-auto-rotate"
            onClick={() => setAutoRotate(!autoRotate)}
            className={`p-1 rounded transition-colors ${
              autoRotate ? 'text-cyan-400 bg-[#181824] border border-[#2c2c3e]' : 'text-slate-400 hover:text-white'
            }`}
            title="Toggle Earth Auto-Rotation"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Mount Container */}
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing flex-1" />

      {/* Floating 3D Navigation Guide */}
      <div className="absolute bottom-2.5 left-2.5 z-20 flex items-center gap-2 p-1.5 px-2 bg-[#0f0f13] rounded border border-[#1e1e24] text-[10px] font-mono text-slate-300 shadow-xl pointer-events-none">
        <Compass className="w-3.5 h-3.5 text-cyan-400" />
        <span>Drag to orbit 3D camera | Scroll to zoom</span>
      </div>
    </div>
  );
};
