import * as THREE from 'three';
import { BODY_DEFINITIONS, BODY_IDS, PLANET_IDS, orbitPath, type BodyId, type BodyPosition, type Vector3Value } from '../astronomy/solarSystem';
import { QUALITY_PROFILES, type QualityLevel } from '../performance/qualityProfiles';

export interface ScreenLabel { id: BodyId; name: string; x: number; y: number; visible: boolean; selected: boolean; }

const DISPLAY_DISTANCE = (au: number): number => 4.5 + 8.8 * Math.log1p(au * 2);
const sceneVector = (position: Vector3Value): THREE.Vector3 => new THREE.Vector3(position.x, position.z, position.y);

function displayVector(position: Vector3Value): THREE.Vector3 {
  const vector = sceneVector(position);
  const distance = vector.length();
  return distance === 0 ? vector : vector.normalize().multiplyScalar(DISPLAY_DISTANCE(distance));
}

function seededRandom(seed: number): () => number {
  let value = seed >>> 0;
  return () => { value = Math.imul(1664525, value) + 1013904223 >>> 0; return value / 4294967296; };
}

export class CosmicRenderer {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(40, 1, .1, 420);
  private readonly bodyMeshes = new Map<BodyId, THREE.Mesh>();
  private readonly bodyPositions = new Map<BodyId, THREE.Vector3>();
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly orbitGroup = new THREE.Group();
  private starField: THREE.Points | null = null;
  private selectedId: BodyId | null = null;
  private yaw = -.68;
  private yawGoal = -.68;
  private pitch = .83;
  private pitchGoal = .83;
  private distance = 102;
  private distanceGoal = 102;
  private readonly target = new THREE.Vector3();
  private readonly targetGoal = new THREE.Vector3();
  private viewportWidth = window.innerWidth;
  private viewportHeight = window.innerHeight;
  private elapsed = 0;
  private reducedMotion = false;
  private currentBodies: BodyPosition[] = [];
  private readonly handleContextLost: (event: Event) => void;

  constructor(private readonly canvas: HTMLCanvasElement, date: Date, quality: QualityLevel, onContextLost: () => void) {
    this.scene.background = new THREE.Color(0x02040a);
    this.scene.fog = new THREE.FogExp2(0x02040a, .0045);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: quality === 'high', alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: true });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.scene.add(new THREE.HemisphereLight(0x7799cc, 0x080810, .32));
    const sunlight = new THREE.PointLight(0xffd89a, 1150, 120, 1.55);
    sunlight.position.set(0, 0, 0);
    this.scene.add(sunlight, this.orbitGroup);
    this.createBodies();
    this.rebuildOrbits(date, quality);
    this.rebuildStars(QUALITY_PROFILES[quality].starCount);
    this.setQuality(quality);
    this.handleContextLost = (event) => { event.preventDefault(); onContextLost(); };
    canvas.addEventListener('webglcontextlost', this.handleContextLost);
    this.resize(window.innerWidth, window.innerHeight);
    this.resetView(true);
  }

  private createBodies(): void {
    for (const id of BODY_IDS) {
      const definition = BODY_DEFINITIONS[id];
      const material = id === 'sun'
        ? new THREE.MeshBasicMaterial({ color: definition.color })
        : new THREE.MeshStandardMaterial({ color: definition.color, roughness: id === 'earth' ? .68 : .86, metalness: 0, emissive: definition.color, emissiveIntensity: id === 'moon' ? .015 : .035 });
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(definition.radius, id === 'sun' ? 48 : 32, id === 'sun' ? 32 : 20), material);
      mesh.userData.bodyId = id;
      mesh.renderOrder = 2;
      this.bodyMeshes.set(id, mesh);
      this.scene.add(mesh);

      if (id === 'sun') {
        const corona = new THREE.Mesh(new THREE.SphereGeometry(definition.radius * 1.18, 40, 24), new THREE.MeshBasicMaterial({ color: 0xff9f38, transparent: true, opacity: .13, side: THREE.BackSide, blending: THREE.AdditiveBlending }));
        mesh.add(corona);
      }
      if (id === 'earth') {
        const atmosphere = new THREE.Mesh(new THREE.SphereGeometry(definition.radius * 1.06, 28, 18), new THREE.MeshBasicMaterial({ color: 0x63b8ff, transparent: true, opacity: .13, side: THREE.BackSide }));
        mesh.add(atmosphere);
      }
      if (id === 'saturn') {
        const ring = new THREE.Mesh(new THREE.RingGeometry(definition.radius * 1.28, definition.radius * 2.05, 64), new THREE.MeshBasicMaterial({ color: 0xd7c39a, transparent: true, opacity: .56, side: THREE.DoubleSide }));
        ring.rotation.x = Math.PI / 2.35;
        ring.rotation.y = -.18;
        mesh.add(ring);
      }
    }
  }

  private rebuildOrbits(date: Date, quality: QualityLevel): void {
    for (const child of [...this.orbitGroup.children]) {
      this.orbitGroup.remove(child);
      const line = child as THREE.Line;
      line.geometry?.dispose();
      const material = line.material as THREE.Material | THREE.Material[];
      if (Array.isArray(material)) material.forEach((entry) => entry.dispose()); else material?.dispose();
    }
    const segments = quality === 'high' ? 220 : quality === 'medium' ? 160 : 100;
    for (const id of PLANET_IDS) {
      const points = orbitPath(id, date, segments).map(displayVector);
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const color = new THREE.Color(BODY_DEFINITIONS[id].color).lerp(new THREE.Color(0x91a1bd), .7);
      const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity: id === 'earth' ? .34 : .2 });
      const line = new THREE.Line(geometry, material);
      line.userData.bodyId = id;
      this.orbitGroup.add(line);
    }
  }

  private rebuildStars(count: number): void {
    if (this.starField) {
      this.scene.remove(this.starField);
      this.starField.geometry.dispose();
      (this.starField.material as THREE.Material).dispose();
    }
    const random = seededRandom(0x51a7f00d);
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    for (let index = 0; index < count; index += 1) {
      const radius = 92 + random() * 92;
      const theta = random() * Math.PI * 2;
      const phi = Math.acos(2 * random() - 1);
      positions[index * 3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[index * 3 + 1] = radius * Math.cos(phi);
      positions[index * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
      const brightness = .58 + random() * .42;
      colors[index * 3] = brightness * (.78 + random() * .22);
      colors[index * 3 + 1] = brightness * (.82 + random() * .18);
      colors[index * 3 + 2] = brightness;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const material = new THREE.PointsMaterial({ size: .15, vertexColors: true, transparent: true, opacity: .78, sizeAttenuation: true, depthWrite: false });
    this.starField = new THREE.Points(geometry, material);
    this.scene.add(this.starField);
  }

  setBodies(bodies: BodyPosition[]): void {
    this.currentBodies = bodies;
    const earth = bodies.find((body) => body.id === 'earth');
    for (const body of bodies) {
      let displayed: THREE.Vector3;
      if (body.id === 'moon' && earth) {
        const earthDisplayed = displayVector(earth.positionAU);
        const relative = sceneVector({ x: body.positionAU.x - earth.positionAU.x, y: body.positionAU.y - earth.positionAU.y, z: body.positionAU.z - earth.positionAU.z });
        displayed = earthDisplayed.add(relative.lengthSq() > 0 ? relative.normalize().multiplyScalar(1.48) : new THREE.Vector3(1.48, 0, 0));
      } else displayed = displayVector(body.positionAU);
      this.bodyPositions.set(body.id, displayed);
      this.bodyMeshes.get(body.id)?.position.copy(displayed);
    }
    if (this.selectedId) this.targetGoal.copy(this.bodyPositions.get(this.selectedId) ?? new THREE.Vector3());
  }

  render(deltaMs: number): void {
    this.elapsed += Math.max(0, deltaMs) / 1000;
    const delta = Math.min(Math.max(deltaMs / 1000, 0), .5);
    const response = this.reducedMotion ? 1 : 1 - Math.exp(-delta * 4.8);
    this.yaw += (this.yawGoal - this.yaw) * response;
    this.pitch += (this.pitchGoal - this.pitch) * response;
    this.distance += (this.distanceGoal - this.distance) * response;
    this.target.lerp(this.targetGoal, response);
    const horizontal = Math.cos(this.pitch) * this.distance;
    this.camera.position.set(
      this.target.x + Math.sin(this.yaw) * horizontal,
      this.target.y + Math.sin(this.pitch) * this.distance,
      this.target.z + Math.cos(this.yaw) * horizontal,
    );
    this.camera.lookAt(this.target);
    this.bodyMeshes.forEach((mesh, id) => {
      if (id !== 'sun') mesh.rotation.y += delta * (id === 'jupiter' ? .32 : .18);
      if (id === 'sun') {
        const pulse = 1 + Math.sin(this.elapsed * 1.6) * .012;
        mesh.scale.setScalar(pulse);
      }
    });
    this.renderer.render(this.scene, this.camera);
  }

  rotate(deltaX: number, deltaY: number): void {
    this.yawGoal -= deltaX * .005;
    this.pitchGoal = THREE.MathUtils.clamp(this.pitchGoal + deltaY * .004, .16, 1.42);
  }

  zoom(delta: number): void {
    this.distanceGoal = THREE.MathUtils.clamp(this.distanceGoal * Math.exp(delta * .0015), 4.8, 145);
  }

  pick(clientX: number, clientY: number): BodyId | null {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.set((clientX - rect.left) / rect.width * 2 - 1, -((clientY - rect.top) / rect.height * 2 - 1));
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects([...this.bodyMeshes.values()], false);
    return (hits[0]?.object.userData.bodyId as BodyId | undefined) ?? null;
  }

  focus(id: BodyId | null, immediate = false): void {
    this.selectedId = id;
    this.targetGoal.copy(id ? this.bodyPositions.get(id) ?? new THREE.Vector3() : new THREE.Vector3());
    this.distanceGoal = id ? (id === 'sun' ? 11 : BODY_DEFINITIONS[id].radius > 1 ? 9.5 : 7.2) : this.fullViewDistance();
    if (immediate || this.reducedMotion) {
      this.target.copy(this.targetGoal);
      this.distance = this.distanceGoal;
    }
  }

  resetView(immediate = false): void {
    this.yawGoal = -.68;
    this.pitchGoal = .83;
    this.focus(null, immediate);
  }

  labels(): ScreenLabel[] {
    return BODY_IDS.map((id) => {
      const projected = (this.bodyPositions.get(id) ?? new THREE.Vector3()).clone().project(this.camera);
      return {
        id,
        name: BODY_DEFINITIONS[id].name,
        x: (projected.x * .5 + .5) * this.viewportWidth,
        y: (-projected.y * .5 + .5) * this.viewportHeight,
        visible: projected.z > -1 && projected.z < 1 && projected.x > -1.12 && projected.x < 1.12 && projected.y > -1.12 && projected.y < 1.12,
        selected: id === this.selectedId,
      };
    });
  }

  private fullViewDistance(): number { return this.viewportWidth / Math.max(this.viewportHeight, 1) < .72 ? 126 : 102; }

  get selected(): BodyPosition | null { return this.currentBodies.find((body) => body.id === this.selectedId) ?? null; }
  get cameraState(): { yaw: number; pitch: number; distance: number; target: { x: number; y: number; z: number } } {
    return { yaw: this.yaw, pitch: this.pitch, distance: this.distance, target: { x: this.target.x, y: this.target.y, z: this.target.z } };
  }

  setQuality(level: QualityLevel): void {
    const profile = QUALITY_PROFILES[level];
    this.reducedMotion = level === 'reduced';
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, profile.dprCap));
    if (this.starField && this.starField.geometry.getAttribute('position').count !== profile.starCount) this.rebuildStars(profile.starCount);
    this.resize(window.innerWidth, window.innerHeight);
  }

  resize(width: number, height: number): void {
    this.viewportWidth = Math.max(1, width);
    this.viewportHeight = Math.max(1, height);
    this.camera.aspect = this.viewportWidth / this.viewportHeight;
    this.camera.fov = this.camera.aspect < .72 ? 70 : 40;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.viewportWidth, this.viewportHeight, false);
    if (!this.selectedId) this.distanceGoal = this.fullViewDistance();
  }

  dispose(): void {
    this.canvas.removeEventListener('webglcontextlost', this.handleContextLost);
    this.scene.traverse((object) => {
      const mesh = object as THREE.Mesh;
      mesh.geometry?.dispose?.();
      const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(material)) material.forEach((entry) => entry.dispose()); else material?.dispose?.();
    });
    this.renderer.dispose();
  }
}
