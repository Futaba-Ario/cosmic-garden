uniform vec2 uResolution;
uniform float uTime;
uniform float uOpacity;
uniform vec3 uBackground;
uniform vec3 uNebulaA;
uniform vec3 uNebulaB;
uniform float uMotionScale;
uniform float uDetail;
varying vec2 vUv;
float hash(vec2 p) { return fract(sin(dot(p, vec2(41.27, 289.11))) * 43758.5453); }
float noise(vec2 p) { vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y); }
void main() {
  vec2 uv = vUv - .5; uv.x *= uResolution.x / uResolution.y;
  vec2 motion = vec2(uTime * .018, -uTime * .012) * uMotionScale;
  float n = noise(uv * 3.0 + motion);
  if (uDetail > .01) n = mix(n, noise(uv * 6.5 - motion * 1.7), uDetail * .24);
  float cloud = smoothstep(.26, .8, n) * exp(-length(uv * vec2(.7, 1.1)) * 1.45);
  vec3 glow = mix(uNebulaA, uNebulaB, smoothstep(.15,.85, n));
  gl_FragColor = vec4(uBackground + glow * cloud * .8, uOpacity);
}
