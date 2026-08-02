uniform float uOpacity;
varying vec3 vColor;
varying float vAlpha;

void main() {
  vec2 p = gl_PointCoord - vec2(0.5);
  float radius = length(p) * 2.0;
  float core = 1.0 - smoothstep(0.0, 0.52, radius);
  float halo = 1.0 - smoothstep(0.05, 1.0, radius);
  float alpha = max(core, halo * 0.42) * vAlpha;
  if (alpha < 0.012) discard;
  gl_FragColor = vec4(vColor * (0.72 + core * 0.75), alpha * uOpacity);
}
