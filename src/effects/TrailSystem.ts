import * as THREE from 'three';
import type { PointerState } from '../interaction/PointerState';
import { EffectPool } from './EffectPool';
import type { QualityProfile } from '../performance/qualityProfiles';
import vertexShader from '../rendering/shaders/particle.vert.glsl?raw';
import fragmentShader from '../rendering/shaders/particle.frag.glsl?raw';

type Trail = { active: boolean; x: number; y: number; age: number; life: number; size: number };
export const resolveTrailLifetime = (velocity: number, scale = 1): number => (180 + Math.min(720, Math.max(0, velocity) * 580)) * scale;
export class TrailSystem {
  readonly points: THREE.Points; private readonly trails: Trail[] = Array.from({ length: 180 }, () => ({ active: false, x: 0, y: 0, age: 0, life: 0, size: 0 }));
  private readonly pool = new EffectPool(this.trails);
  private readonly positions = new Float32Array(this.trails.length * 3); private readonly colors = new Float32Array(this.trails.length * 3); private readonly sizes = new Float32Array(this.trails.length); private cooldown = 0;
  private limit = 180; private lifetimeScale = 1; private motionScale = 1;
  constructor() { const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3)); geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3)); geometry.setAttribute('pointSize', new THREE.BufferAttribute(this.sizes, 1)); const material = new THREE.ShaderMaterial({ vertexShader, fragmentShader, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uOpacity: { value: .9 } } }); this.points = new THREE.Points(geometry, material); this.points.renderOrder = 3; this.points.frustumCulled = false; }
  update(deltaMs: number, pointer: PointerState): void { this.cooldown -= deltaMs; if (pointer.active && this.cooldown <= 0 && pointer.velocity > .015 && this.pool.activeCount < this.limit) { const trail = this.pool.acquire(); trail.active = true; trail.x = pointer.worldX; trail.y = pointer.worldY; trail.age = 0; trail.life = resolveTrailLifetime(pointer.velocity, this.lifetimeScale); trail.size = 1; this.cooldown = Math.max(12, 52 - pointer.velocity * 18) / Math.max(.2, this.motionScale); }
    this.trails.forEach((trail, i) => { const p = i * 3; if (!trail.active) { this.positions[p] = 10; this.positions[p + 1] = 10; this.sizes[i] = 0; return; } trail.age += deltaMs; if (trail.age >= trail.life) { trail.active = false; this.positions[p] = 10; this.positions[p + 1] = 10; this.sizes[i] = 0; return; } const fade = 1 - trail.age / trail.life; this.positions[p] = trail.x; this.positions[p + 1] = trail.y; this.positions[p + 2] = .15; this.colors[p] = .45 * fade; this.colors[p + 1] = .82 * fade; this.colors[p + 2] = 1; this.sizes[i] = (5 + trail.size * 6) * (.5 + fade * .5); }); (this.points.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true; (this.points.geometry.attributes.color as THREE.BufferAttribute).needsUpdate = true; (this.points.geometry.attributes.pointSize as THREE.BufferAttribute).needsUpdate = true; }
  get count(): number { return this.pool.activeCount; }
  setQuality(quality: QualityProfile): void { this.limit = quality.trailLimit; this.lifetimeScale = quality.trailLifetimeScale; this.motionScale = quality.motionScale; this.trails.forEach((trail, index) => { if (index >= this.limit) trail.active = false; }); }
  dispose(): void { this.points.geometry.dispose(); (this.points.material as THREE.Material).dispose(); }
}
