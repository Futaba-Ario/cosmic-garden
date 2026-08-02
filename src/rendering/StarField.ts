import * as THREE from 'three';
import type { ThemeState } from '../theme/themeTypes';
import type { PointerState } from '../interaction/PointerState';
import type { QualityProfile } from '../performance/qualityProfiles';
import vertexShader from './shaders/particle.vert.glsl?raw';
import fragmentShader from './shaders/particle.frag.glsl?raw';

export class StarField {
  readonly points: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;
  private readonly material: THREE.ShaderMaterial;
  private readonly basePositions: Float32Array;
  private quality: QualityProfile;
  private displacement = 0;
  constructor(theme: ThemeState, quality: QualityProfile, count = 8000) {
    this.quality = quality;
    const positions = new Float32Array(count * 3);
    const seed = 12457;
    let state = seed;
    const random = () => { state = (state * 1664525 + 1013904223) >>> 0; return state / 4294967296; };
    for (let i = 0; i < count; i++) { const p = i * 3; positions[p] = (random() - .5) * 2; positions[p + 1] = (random() - .5) * 2; positions[p + 2] = random() * .7 + .05; }
    this.basePositions = positions.slice();
    const colors = new Float32Array(count * 3); const sizes = new Float32Array(count);
    for (let i = 0; i < count; i++) { const brightness = .54 + random() * .46; colors[i * 3] = theme.star.r * brightness; colors[i * 3 + 1] = theme.star.g * brightness; colors[i * 3 + 2] = theme.star.b * brightness; sizes[i] = 1.7 + random() * 3.6; }
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3)); geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3)); geometry.setAttribute('pointSize', new THREE.BufferAttribute(sizes, 1)); geometry.computeBoundingSphere();
    this.material = new THREE.ShaderMaterial({ vertexShader, fragmentShader, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, uniforms: { uOpacity: { value: 0 } } });
    this.points = new THREE.Points(geometry, this.material);
    this.points.renderOrder = 1;
    this.points.frustumCulled = false;
    this.setQuality(quality);
  }
  update(theme: ThemeState, opacity: number, pointer: PointerState, elapsed: number): void {
    this.material.uniforms.uOpacity.value = opacity * Math.min(1, theme.brightness + .32);
    const colors = this.points.geometry.attributes.color.array as Float32Array;
    for (let i = 0; i < this.quality.starCount; i++) { const sparkle = .62 + .38 * Math.sin(elapsed * 1.4 + i * 1.7); colors[i * 3] = theme.star.r * sparkle; colors[i * 3 + 1] = theme.star.g * sparkle; colors[i * 3 + 2] = theme.star.b * sparkle; }
    const positions = this.points.geometry.attributes.position.array as Float32Array;
    const activeLength = Math.min(positions.length, this.quality.starCount * 3);
    let maxDisplacement = 0;
    for (let i = 0; i < activeLength; i += 3) {
      const bx = this.basePositions[i]; const by = this.basePositions[i + 1];
      const dx = pointer.worldX - bx; const dy = pointer.worldY - by; const distance = Math.hypot(dx, dy);
      const influence = pointer.active ? Math.max(0, 1 - distance / .38) : 0;
      const pull = influence * influence * .13 * this.quality.attractionScale;
      const orbit = pointer.active && pointer.velocity < .09 ? influence * .018 * this.quality.motionScale : 0;
      positions[i] += ((bx + dx * pull + Math.cos(elapsed * 3 + i) * orbit) - positions[i]) * .11;
      positions[i + 1] += ((by + dy * pull + Math.sin(elapsed * 3 + i) * orbit) - positions[i + 1]) * .11;
      maxDisplacement = Math.max(maxDisplacement, Math.hypot(positions[i] - bx, positions[i + 1] - by));
    }
    this.displacement = maxDisplacement;
    (this.points.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true; (this.points.geometry.attributes.color as THREE.BufferAttribute).needsUpdate = true;
  }
  setQuality(quality: QualityProfile): void { this.quality = quality; this.points.geometry.setDrawRange(0, quality.starCount); }
  get maxDisplacement(): number { return this.displacement; }
  dispose(): void { this.points.geometry.dispose(); this.material.dispose(); }
}
