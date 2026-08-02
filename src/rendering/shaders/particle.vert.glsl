attribute vec3 color;
attribute float pointSize;
varying vec3 vColor;
varying float vAlpha;

void main() {
  vColor = color;
  vAlpha = max(max(color.r, color.g), color.b);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = pointSize;
}
