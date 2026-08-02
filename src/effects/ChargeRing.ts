import * as THREE from 'three';
import type { PointerState } from '../interaction/PointerState';
import type { QualityProfile } from '../performance/qualityProfiles';

export class ChargeRing {
  readonly mesh: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
  private motionScale = 1;
  constructor() { this.mesh = new THREE.Mesh(new THREE.RingGeometry(.035, .055, 40), new THREE.MeshBasicMaterial({ color: '#d9f6ff', transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending })); this.mesh.renderOrder = 5; }
  update(pointer: PointerState, elapsed: number): void { const ratio = pointer.pressed ? pointer.holdRatio : 0; this.mesh.visible = ratio > 0; this.mesh.position.set(pointer.worldX, pointer.worldY, .3); const scale = .75 + ratio * 3.2 + Math.sin(elapsed * 10) * ratio * .12 * this.motionScale; this.mesh.scale.setScalar(scale); this.mesh.rotation.z = elapsed * (1 + ratio * 5) * this.motionScale; this.mesh.material.opacity = ratio * .9; }
  setQuality(quality: QualityProfile): void { this.motionScale = quality.motionScale; }
  dispose(): void { this.mesh.geometry.dispose(); this.mesh.material.dispose(); }
}
