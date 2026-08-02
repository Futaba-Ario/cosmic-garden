import * as THREE from 'three';
import { NebulaField } from './NebulaField';
import { StarField } from './StarField';
import type { ThemeState } from '../theme/themeTypes';
import type { PointerState } from '../interaction/PointerState';
import { TrailSystem } from '../effects/TrailSystem';
import { GalaxyBurstSystem } from '../effects/GalaxyBurstSystem';
import { ChargeRing } from '../effects/ChargeRing';
import { QUALITY_PROFILES, type QualityLevel } from '../performance/qualityProfiles';

export class CosmicRenderer {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 10);
  private readonly nebula: NebulaField;
  private readonly stars: StarField;
  private readonly trails = new TrailSystem();
  private readonly galaxies = new GalaxyBurstSystem();
  private readonly chargeRing = new ChargeRing();
  private elapsed = 0;
  private readonly handleContextLost: (event: Event) => void;
  constructor(canvas: HTMLCanvasElement, theme: ThemeState, quality: QualityLevel, onContextLost: () => void) {
    this.camera.position.z = 1;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    const profile = QUALITY_PROFILES[quality];
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, profile.dprCap));
    this.nebula = new NebulaField(theme, canvas.clientWidth || window.innerWidth, canvas.clientHeight || window.innerHeight, profile);
    this.stars = new StarField(theme, profile);
    this.scene.add(this.nebula.mesh, this.stars.points, this.trails.points, this.galaxies.points, this.chargeRing.mesh);
    this.trails.setQuality(profile); this.galaxies.setQuality(profile); this.chargeRing.setQuality(profile);
    this.handleContextLost = (event) => { event.preventDefault(); onContextLost(); };
    canvas.addEventListener('webglcontextlost', this.handleContextLost);
    this.resize(window.innerWidth, window.innerHeight);
  }
  render(deltaMs: number, theme: ThemeState, opacity: number, pointer: PointerState): void { this.elapsed += deltaMs / 1000; this.nebula.update(theme, this.elapsed, opacity); this.stars.update(theme, opacity, pointer, this.elapsed); this.trails.update(deltaMs, pointer); this.galaxies.update(deltaMs); this.chargeRing.update(pointer, this.elapsed); this.renderer.render(this.scene, this.camera); }
  spawnGalaxy(x: number, y: number): void { this.galaxies.spawn(x, y); }
  get effectState(): { trails: number; galaxies: number; starDisplacement: number } { return { trails: this.trails.count, galaxies: this.galaxies.count, starDisplacement: this.stars.maxDisplacement }; }
  setQuality(level: QualityLevel): void { const profile = QUALITY_PROFILES[level]; this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, profile.dprCap)); this.nebula.setQuality(profile); this.stars.setQuality(profile); this.trails.setQuality(profile); this.galaxies.setQuality(profile); this.chargeRing.setQuality(profile); this.resize(window.innerWidth, window.innerHeight); }
  resize(width: number, height: number): void { this.renderer.setSize(width, height, false); this.nebula.resize(width * this.renderer.getPixelRatio(), height * this.renderer.getPixelRatio()); }
  dispose(): void { this.renderer.domElement.removeEventListener('webglcontextlost', this.handleContextLost); this.nebula.dispose(); this.stars.dispose(); this.trails.dispose(); this.galaxies.dispose(); this.chargeRing.dispose(); this.renderer.dispose(); }
}
