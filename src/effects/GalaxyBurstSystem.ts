import * as THREE from 'three';
import { EffectPool } from './EffectPool';
import type { QualityProfile } from '../performance/qualityProfiles';
import vertexShader from '../rendering/shaders/particle.vert.glsl?raw';
import fragmentShader from '../rendering/shaders/particle.frag.glsl?raw';
type Galaxy = { active: boolean; x: number; y: number; age: number; rotation: number };
export class GalaxyBurstSystem {
  readonly points: THREE.Points; private readonly galaxies: Galaxy[] = Array.from({ length: 8 }, () => ({ active: false, x: 0, y: 0, age: 0, rotation: 0 })); private readonly perGalaxy = 72; private readonly positions = new Float32Array(8 * 72 * 3); private readonly colors = new Float32Array(8 * 72 * 3); private readonly sizes = new Float32Array(8 * 72);
  private readonly pool = new EffectPool(this.galaxies);
  private limit = 8; private motionScale = 1;
  constructor() { const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3)); geo.setAttribute('color', new THREE.BufferAttribute(this.colors, 3)); geo.setAttribute('pointSize', new THREE.BufferAttribute(this.sizes, 1)); const mat = new THREE.ShaderMaterial({ vertexShader, fragmentShader, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uOpacity: { value: 1 } } }); this.points = new THREE.Points(geo, mat); this.points.renderOrder = 4; this.points.frustumCulled = false; }
  spawn(x: number, y: number): void { if (this.pool.activeCount >= this.limit) return; const galaxy = this.pool.acquire(); galaxy.active = true; galaxy.x = x; galaxy.y = y; galaxy.age = 0; galaxy.rotation = 0; }
  update(deltaMs: number): void { this.galaxies.forEach((galaxy, index) => { galaxy.age += deltaMs; galaxy.rotation += deltaMs * .004 * this.motionScale; if (galaxy.age > 2200) galaxy.active = false; const progress = galaxy.age / 2200; const scale = .03 + progress * .26 * this.motionScale; const alpha = galaxy.active ? (1 - progress) : 0; for (let i = 0; i < this.perGalaxy; i++) { const point = index * this.perGalaxy + i; const p = point * 3; if (!galaxy.active) { this.positions[p] = 10; this.positions[p + 1] = 10; this.sizes[point] = 0; continue; } const arm = i % 3; const r = ((i / this.perGalaxy) * .8 + .08) * scale; const angle = i * 2.4 + arm * 2.094 + galaxy.rotation + r * 24; this.positions[p] = galaxy.x + Math.cos(angle) * r * 1.35; this.positions[p + 1] = galaxy.y + Math.sin(angle) * r; this.positions[p + 2] = .25; this.colors[p] = (0.62 + arm * .1) * alpha; this.colors[p + 1] = (.55 + (i % 5) * .07) * alpha; this.colors[p + 2] = alpha; this.sizes[point] = 3.5 + (1 - i / this.perGalaxy) * 5.5; } }); (this.points.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true; (this.points.geometry.attributes.color as THREE.BufferAttribute).needsUpdate = true; (this.points.geometry.attributes.pointSize as THREE.BufferAttribute).needsUpdate = true; }
  get count(): number { return this.pool.activeCount; }
  setQuality(quality: QualityProfile): void { this.limit = quality.galaxyLimit; this.motionScale = quality.motionScale; this.galaxies.forEach((galaxy, index) => { if (index >= this.limit) galaxy.active = false; }); }
  dispose(): void { this.points.geometry.dispose(); (this.points.material as THREE.Material).dispose(); }
}
