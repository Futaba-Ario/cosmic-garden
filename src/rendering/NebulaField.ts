import * as THREE from 'three';
import vertexShader from './shaders/nebula.vert.glsl?raw';
import fragmentShader from './shaders/nebula.frag.glsl?raw';
import type { Rgb, ThemeState } from '../theme/themeTypes';
import type { QualityProfile } from '../performance/qualityProfiles';

const color = (value: Rgb) => new THREE.Color(value.r, value.g, value.b);

export class NebulaField {
  readonly material: THREE.ShaderMaterial;
  readonly mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  constructor(theme: ThemeState, width: number, height: number, quality: QualityProfile) {
    this.material = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: {
      uResolution: { value: new THREE.Vector2(width, height) }, uTime: { value: 0 }, uOpacity: { value: 0 },
      uBackground: { value: color(theme.background) }, uNebulaA: { value: color(theme.nebulaA) }, uNebulaB: { value: color(theme.nebulaB) },
      uMotionScale: { value: quality.motionScale }, uDetail: { value: quality.nebulaDetail },
    }, vertexShader, fragmentShader });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
  }
  update(theme: ThemeState, elapsed: number, opacity: number): void {
    this.material.uniforms.uTime.value = elapsed;
    this.material.uniforms.uOpacity.value = opacity;
    this.material.uniforms.uBackground.value.setRGB(theme.background.r, theme.background.g, theme.background.b);
    this.material.uniforms.uNebulaA.value.setRGB(theme.nebulaA.r, theme.nebulaA.g, theme.nebulaA.b);
    this.material.uniforms.uNebulaB.value.setRGB(theme.nebulaB.r, theme.nebulaB.g, theme.nebulaB.b);
  }
  resize(width: number, height: number): void { this.material.uniforms.uResolution.value.set(width, height); }
  setQuality(quality: QualityProfile): void { this.material.uniforms.uMotionScale.value = quality.motionScale; this.material.uniforms.uDetail.value = quality.nebulaDetail; }
  dispose(): void { this.mesh.geometry.dispose(); this.material.dispose(); }
}
