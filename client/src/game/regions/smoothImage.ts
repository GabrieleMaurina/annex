import { RING_LIGHTEN, type Ripple } from '../animations/transitions/capture';

export interface SmoothSource {
  image: HTMLImageElement | HTMLCanvasElement;
  revision: number;
  tiles: HTMLCanvasElement | null;
  fill: {
    labels: Int16Array;
    colors: Map<number, string>;
    ripples: Map<number, Ripple>;
  } | null;
}

const SIGMA = 1.25;
const RADIUS = 3;
const THIN_FLOOR = 0.75;
const PALETTE_WIDTH = 256;
const RIPPLE_TEXELS = 3;
const RIPPLE_SCALE = 4;
const RIPPLE_OFFSET = 4096;

const IMAGE_UNIT = 0;
const TILES_UNIT = 1;
const LABELS_UNIT = 2;
const PALETTE_UNIT = 3;
const FIELD_UNIT = 4;
const AXIS_UNIT = 5;
const DIAGONAL_UNIT = 6;
const RIPPLES_UNIT = 7;
const SAMPLERS: [string, number][] = [
  ['u_image', IMAGE_UNIT],
  ['u_tiles', TILES_UNIT],
  ['u_labels', LABELS_UNIT],
  ['u_palette', PALETTE_UNIT],
  ['u_field', FIELD_UNIT],
  ['u_axis', AXIS_UNIT],
  ['u_diagonal', DIAGONAL_UNIT],
  ['u_ripples', RIPPLES_UNIT],
];
const CROSS_PASSES: [number, number[], number[]][] = [
  [AXIS_UNIT, [-1, 1, 0, 0], [0, 0, -1, 1]],
  [DIAGONAL_UNIT, [-1, 1, -1, 1], [-1, -1, 1, 1]],
];

const VERTEX_SHADER = `
attribute vec2 a_position;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const SOURCE_SHADER = `
precision highp float;
uniform sampler2D u_image;
uniform sampler2D u_tiles;
uniform sampler2D u_labels;
uniform bool u_hasTiles;
uniform bool u_hasFill;
uniform vec2 u_size;

vec4 baseColor(vec2 cell) {
  vec2 uv = (cell + 0.5) / u_size;
  vec4 color = texture2D(u_image, uv);
  if (u_hasTiles) {
    vec4 tile = texture2D(u_tiles, uv);
    color = tile + color * (1.0 - tile.a);
  }
  return color;
}

float labelOf(vec2 cell) {
  if (!u_hasFill) return -1.0;
  vec4 label = texture2D(u_labels, (cell + 0.5) / u_size);
  return floor(label.r * 255.0 + 0.5) + floor(label.a * 255.0 + 0.5) * 256.0 - 1.0;
}

bool sameColor(vec4 a, vec4 b) {
  vec4 d = abs(a - b);
  return max(max(d.r, d.g), max(d.b, d.a)) < 0.002;
}

bool sameIdentity(vec4 a, float la, vec4 b, float lb) {
  return la == lb && sameColor(a, b);
}

float weightOf(vec2 offset) {
  return exp(-dot(offset, offset) / ${(2 * SIGMA * SIGMA).toFixed(4)});
}
`;

const FIELD_SHADER = `${SOURCE_SHADER}
bool sameAs(vec2 cell, vec4 color, float label) {
  return labelOf(cell) == label && sameColor(baseColor(cell), color);
}

void main() {
  vec2 cell = floor(gl_FragCoord.xy);
  vec4 color = baseColor(cell);
  float label = labelOf(cell);
  vec4 otherColor = color;
  float otherLabel = label;
  bool mixed = false;
  float own = 0.0;
  float total = 0.0;
  for (int dy = -${RADIUS}; dy <= ${RADIUS}; dy++) {
    for (int dx = -${RADIUS}; dx <= ${RADIUS}; dx++) {
      vec2 offset = vec2(float(dx), float(dy));
      float weight = weightOf(offset);
      total += weight;
      vec4 tapColor = baseColor(cell + offset);
      float tapLabel = labelOf(cell + offset);
      if (sameIdentity(tapColor, tapLabel, color, label)) {
        own += weight;
      } else if (sameIdentity(otherColor, otherLabel, color, label)) {
        otherColor = tapColor;
        otherLabel = tapLabel;
      } else if (!sameIdentity(tapColor, tapLabel, otherColor, otherLabel)) {
        mixed = true;
      }
    }
  }
  float share = own / total;
  bool left = sameAs(cell + vec2(-1.0, 0.0), color, label);
  bool right = sameAs(cell + vec2(1.0, 0.0), color, label);
  bool up = sameAs(cell + vec2(0.0, -1.0), color, label);
  bool down = sameAs(cell + vec2(0.0, 1.0), color, label);
  bool upLeft = sameAs(cell + vec2(-1.0, -1.0), color, label);
  bool upRight = sameAs(cell + vec2(1.0, -1.0), color, label);
  bool downLeft = sameAs(cell + vec2(-1.0, 1.0), color, label);
  bool downRight = sameAs(cell + vec2(1.0, 1.0), color, label);
  bool thinX = !left && !right && (upLeft || up || upRight) == (downLeft || down || downRight);
  bool thinY = !up && !down && (upLeft || left || downLeft) == (upRight || right || downRight);
  if (thinX || thinY) share = max(share, ${THIN_FLOOR.toFixed(2)});
  gl_FragColor = vec4(share, mixed ? 1.0 : 0.0, 0.0, 1.0);
}
`;

const CROSS_SHADER = `${SOURCE_SHADER}
uniform sampler2D u_field;
uniform vec4 u_dx;
uniform vec4 u_dy;

void main() {
  vec2 cell = floor(gl_FragCoord.xy);
  if (texture2D(u_field, (cell + 0.5) / u_size).g < 0.5) {
    gl_FragColor = vec4(1.0);
    return;
  }
  vec2 n0 = cell + vec2(u_dx.x, u_dy.x);
  vec2 n1 = cell + vec2(u_dx.y, u_dy.y);
  vec2 n2 = cell + vec2(u_dx.z, u_dy.z);
  vec2 n3 = cell + vec2(u_dx.w, u_dy.w);
  vec4 c0 = baseColor(n0);
  vec4 c1 = baseColor(n1);
  vec4 c2 = baseColor(n2);
  vec4 c3 = baseColor(n3);
  vec4 labels = vec4(labelOf(n0), labelOf(n1), labelOf(n2), labelOf(n3));
  vec4 shares = vec4(0.0);
  float total = 0.0;
  for (int dy = -${RADIUS}; dy <= ${RADIUS}; dy++) {
    for (int dx = -${RADIUS}; dx <= ${RADIUS}; dx++) {
      vec2 offset = vec2(float(dx), float(dy));
      float weight = weightOf(offset);
      total += weight;
      vec4 color = baseColor(cell + offset);
      float label = labelOf(cell + offset);
      shares += weight * vec4(
        float(sameIdentity(color, label, c0, labels.x)),
        float(sameIdentity(color, label, c1, labels.y)),
        float(sameIdentity(color, label, c2, labels.z)),
        float(sameIdentity(color, label, c3, labels.w))
      );
    }
  }
  gl_FragColor = shares / total;
}
`;

const DRAW_SHADER = `${SOURCE_SHADER}
uniform sampler2D u_palette;
uniform sampler2D u_field;
uniform sampler2D u_axis;
uniform sampler2D u_diagonal;
uniform sampler2D u_ripples;
uniform vec2 u_paletteSize;
uniform vec2 u_origin;
uniform float u_scale;
uniform float u_height;

vec4 c0, c1, c2, c3, labels, shares, w, wx, wy;
vec2 imagePos;

float same(vec4 a, float la, vec4 b, float lb) {
  return la == lb && sameColor(a, b) ? 1.0 : 0.0;
}

vec4 maskOf(vec4 color, float label) {
  return vec4(
    same(c0, labels.x, color, label),
    same(c1, labels.y, color, label),
    same(c2, labels.z, color, label),
    same(c3, labels.w, color, label)
  );
}

vec3 score(vec4 mask, vec4 others) {
  vec4 value = mask * shares + (1.0 - mask) * min(others, 1.0 - shares);
  return vec3(dot(value, w), dot(value, wx), dot(value, wy));
}

vec4 rippleTexel(vec2 slot, float index) {
  vec2 size = vec2(u_paletteSize.x * ${RIPPLE_TEXELS}.0, u_paletteSize.y);
  vec2 texel = vec2(slot.x * ${RIPPLE_TEXELS}.0 + index, slot.y);
  return texture2D(u_ripples, (texel + 0.5) / size);
}

float wordOf(float high, float low) {
  return (floor(high * 255.0 + 0.5) * 256.0 + floor(low * 255.0 + 0.5)) / ${RIPPLE_SCALE}.0;
}

vec4 rippled(vec4 fill, vec2 slot) {
  vec4 previous = rippleTexel(slot, 0.0);
  if (previous.a == 0.0) return fill;
  vec4 entry = rippleTexel(slot, 1.0);
  vec4 wave = rippleTexel(slot, 2.0);
  vec2 center = vec2(wordOf(entry.r, entry.g), wordOf(entry.b, entry.a)) - ${RIPPLE_OFFSET}.0;
  float radius = wordOf(wave.r, wave.g);
  float halfRing = floor(wave.a * 255.0 + 0.5) / ${RIPPLE_SCALE * 2}.0;
  float edge = 0.5 / u_scale;
  float d = distance(imagePos, center);
  vec4 color = mix(fill, previous, smoothstep(radius - edge, radius + edge, d));
  float ring = wave.b * (1.0 - smoothstep(halfRing - edge, halfRing + edge, abs(d - radius)));
  return mix(color, vec4(mix(fill.rgb, vec3(1.0), ${RING_LIGHTEN.toFixed(2)}), 1.0), ring);
}

vec4 shown(vec4 color, float label) {
  if (label >= 0.0) {
    vec2 slot = vec2(mod(label, u_paletteSize.x), floor(label / u_paletteSize.x));
    vec4 fill = texture2D(u_palette, (slot + 0.5) / u_paletteSize);
    if (fill.a > 0.0) return rippled(fill, slot);
  }
  return color;
}

vec4 fieldAt(vec2 cell) {
  return texture2D(u_field, (cell + 0.5) / u_size);
}

vec4 axisAt(vec2 cell) {
  return texture2D(u_axis, (cell + 0.5) / u_size);
}

vec4 diagonalAt(vec2 cell) {
  return texture2D(u_diagonal, (cell + 0.5) / u_size);
}

void main() {
  vec2 p = (vec2(gl_FragCoord.x, u_height - gl_FragCoord.y) - u_origin) / u_scale;
  if (p.x < 0.0 || p.y < 0.0 || p.x > u_size.x || p.y > u_size.y) {
    gl_FragColor = vec4(0.0);
    return;
  }
  imagePos = p;
  vec2 q = p - 0.5;
  vec2 cell = floor(q);
  vec2 f = q - cell;
  vec2 right = vec2(1.0, 0.0);
  vec2 down = vec2(0.0, 1.0);
  c0 = baseColor(cell);
  c1 = baseColor(cell + right);
  c2 = baseColor(cell + down);
  c3 = baseColor(cell + right + down);
  labels = vec4(labelOf(cell), labelOf(cell + right), labelOf(cell + down), labelOf(cell + right + down));
  vec4 f0 = fieldAt(cell);
  vec4 f1 = fieldAt(cell + right);
  vec4 f2 = fieldAt(cell + down);
  vec4 f3 = fieldAt(cell + right + down);
  shares = vec4(f0.r, f1.r, f2.r, f3.r);
  w = vec4((1.0 - f.x) * (1.0 - f.y), f.x * (1.0 - f.y), (1.0 - f.x) * f.y, f.x * f.y);
  wx = vec4(f.y - 1.0, 1.0 - f.y, -f.y, f.y);
  wy = vec4(f.x - 1.0, -f.x, 1.0 - f.x, f.x);

  vec4 m0 = maskOf(c0, labels.x);
  vec4 m1 = maskOf(c1, labels.y);
  vec4 m2 = maskOf(c2, labels.z);
  vec4 m3 = maskOf(c3, labels.w);
  vec4 a0 = vec4(1.0);
  vec4 a1 = vec4(1.0);
  vec4 a2 = vec4(1.0);
  vec4 a3 = vec4(1.0);
  vec4 g0 = vec4(1.0);
  vec4 g1 = vec4(1.0);
  vec4 g2 = vec4(1.0);
  vec4 g3 = vec4(1.0);
  if (max(max(f0.g, f1.g), max(f2.g, f3.g)) > 0.5) {
    a0 = axisAt(cell);
    a1 = axisAt(cell + right);
    a2 = axisAt(cell + down);
    a3 = axisAt(cell + right + down);
    g0 = diagonalAt(cell);
    g1 = diagonalAt(cell + right);
    g2 = diagonalAt(cell + down);
    g3 = diagonalAt(cell + right + down);
  }
  vec3 s0 = score(m0, vec4(1.0, a1.x, a2.z, g3.x));
  vec3 s1 = score(m1, vec4(a0.y, 1.0, g2.y, a3.z));
  vec3 s2 = score(m2, vec4(a0.w, g1.z, 1.0, a3.x));
  vec3 s3 = score(m3, vec4(g0.w, a1.w, a2.y, 1.0));
  vec4 best = shown(c0, labels.x);
  vec4 bestMask = m0;
  vec3 sBest = s0;
  if (s1.x > sBest.x) { best = shown(c1, labels.y); bestMask = m1; sBest = s1; }
  if (s2.x > sBest.x) { best = shown(c2, labels.z); bestMask = m2; sBest = s2; }
  if (s3.x > sBest.x) { best = shown(c3, labels.w); bestMask = m3; sBest = s3; }
  vec4 second = best;
  vec3 sSecond = vec3(-1.0, 0.0, 0.0);
  if (bestMask.x < 0.5 && s0.x > sSecond.x) { second = shown(c0, labels.x); sSecond = s0; }
  if (bestMask.y < 0.5 && s1.x > sSecond.x) { second = shown(c1, labels.y); sSecond = s1; }
  if (bestMask.z < 0.5 && s2.x > sSecond.x) { second = shown(c2, labels.z); sSecond = s2; }
  if (bestMask.w < 0.5 && s3.x > sSecond.x) { second = shown(c3, labels.w); sSecond = s3; }
  if (sSecond.x < 0.0) {
    gl_FragColor = best;
    return;
  }
  vec3 d = sBest - sSecond;
  float margin = d.x * u_scale / max(length(d.yz), 0.0001);
  gl_FragColor = mix(second, best, clamp(0.5 + margin, 0.0, 1.0));
}
`;

interface Smoother {
  gl: WebGLRenderingContext;
  field: WebGLProgram;
  cross: WebGLProgram;
  draw: WebGLProgram;
  textures: WebGLTexture[];
  framebuffer: WebGLFramebuffer;
  maxSize: number;
  image: HTMLImageElement | HTMLCanvasElement | null;
  revision: number;
  tiles: HTMLCanvasElement | null;
  labels: Int16Array | null;
  paletteRows: number;
  fieldWidth: number;
  fieldHeight: number;
}

let smoother: Smoother | null | undefined;

function compile(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  return shader;
}

function link(gl: WebGLRenderingContext, fragment: string) {
  const program = gl.createProgram()!;
  gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER));
  gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, fragment));
  gl.bindAttribLocation(program, 0, 'a_position');
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
  gl.useProgram(program);
  for (const [name, unit] of SAMPLERS)
    gl.uniform1i(gl.getUniformLocation(program, name), unit);
  return program;
}

function createSmoother(): Smoother | null {
  const gl = document
    .createElement('canvas')
    .getContext('webgl', { antialias: false, depth: false });
  if (!gl) return null;
  const field = link(gl, FIELD_SHADER);
  const cross = link(gl, CROSS_SHADER);
  const draw = link(gl, DRAW_SHADER);
  if (!field || !cross || !draw) return null;

  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
    gl.STATIC_DRAW,
  );
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  const textures = SAMPLERS.map(([, unit]) => {
    const texture = gl.createTexture()!;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return texture;
  });
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  return {
    gl,
    field,
    cross,
    draw,
    textures,
    framebuffer: gl.createFramebuffer()!,
    maxSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
    image: null,
    revision: 0,
    tiles: null,
    labels: null,
    paletteRows: 1,
    fieldWidth: 0,
    fieldHeight: 0,
  };
}

function uploadSource(
  s: Smoother,
  unit: number,
  source: HTMLImageElement | HTMLCanvasElement,
) {
  const { gl } = s;
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
}

function uploadPixels(
  s: Smoother,
  unit: number,
  format: number,
  width: number,
  height: number,
  pixels: Uint8Array | null,
) {
  const { gl } = s;
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    format,
    width,
    height,
    0,
    format,
    gl.UNSIGNED_BYTE,
    pixels,
  );
}

function uploadLabels(
  s: Smoother,
  labels: Int16Array,
  width: number,
  height: number,
) {
  const pixels = new Uint8Array(labels.length * 2);
  let maxLabel = 0;
  for (let i = 0; i < labels.length; i++) {
    const value = labels[i] + 1;
    pixels[i * 2] = value & 255;
    pixels[i * 2 + 1] = value >> 8;
    if (labels[i] > maxLabel) maxLabel = labels[i];
  }
  uploadPixels(s, LABELS_UNIT, s.gl.LUMINANCE_ALPHA, width, height, pixels);
  s.paletteRows = Math.ceil((maxLabel + 1) / PALETTE_WIDTH);
}

function uploadPalette(s: Smoother, colors: Map<number, string>) {
  const pixels = new Uint8Array(PALETTE_WIDTH * s.paletteRows * 4);
  for (const [id, color] of colors) {
    pixels[id * 4] = parseInt(color.slice(1, 3), 16);
    pixels[id * 4 + 1] = parseInt(color.slice(3, 5), 16);
    pixels[id * 4 + 2] = parseInt(color.slice(5, 7), 16);
    pixels[id * 4 + 3] = 255;
  }
  uploadPixels(
    s,
    PALETTE_UNIT,
    s.gl.RGBA,
    PALETTE_WIDTH,
    s.paletteRows,
    pixels,
  );
}

function uploadRipples(s: Smoother, ripples: Map<number, Ripple>) {
  const pixels = new Uint8Array(
    PALETTE_WIDTH * RIPPLE_TEXELS * s.paletteRows * 4,
  );
  const word = (value: number) =>
    Math.max(0, Math.min(65535, Math.round(value * RIPPLE_SCALE)));
  for (const [id, ripple] of ripples) {
    const x = word(ripple.x + RIPPLE_OFFSET);
    const y = word(ripple.y + RIPPLE_OFFSET);
    const radius = word(ripple.radius);
    pixels.set(
      [
        parseInt(ripple.from.slice(1, 3), 16),
        parseInt(ripple.from.slice(3, 5), 16),
        parseInt(ripple.from.slice(5, 7), 16),
        255,
        x >> 8,
        x & 255,
        y >> 8,
        y & 255,
        radius >> 8,
        radius & 255,
        Math.round(ripple.ring * 255),
        Math.min(255, Math.round(ripple.ringWidth * RIPPLE_SCALE)),
      ],
      id * RIPPLE_TEXELS * 4,
    );
  }
  uploadPixels(
    s,
    RIPPLES_UNIT,
    s.gl.RGBA,
    PALETTE_WIDTH * RIPPLE_TEXELS,
    s.paletteRows,
    pixels,
  );
}

function selectProgram(
  s: Smoother,
  program: WebGLProgram,
  source: SmoothSource,
  width: number,
  height: number,
) {
  const { gl } = s;
  gl.useProgram(program);
  gl.uniform1i(
    gl.getUniformLocation(program, 'u_hasTiles'),
    source.tiles ? 1 : 0,
  );
  gl.uniform1i(
    gl.getUniformLocation(program, 'u_hasFill'),
    source.fill ? 1 : 0,
  );
  gl.uniform2f(gl.getUniformLocation(program, 'u_size'), width, height);
}

function renderTo(s: Smoother, unit: number) {
  const { gl } = s;
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    gl.COLOR_ATTACHMENT0,
    gl.TEXTURE_2D,
    s.textures[unit],
    0,
  );
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}

function computeField(
  s: Smoother,
  source: SmoothSource,
  width: number,
  height: number,
) {
  const { gl } = s;
  if (width !== s.fieldWidth || height !== s.fieldHeight) {
    uploadPixels(s, FIELD_UNIT, gl.RGBA, width, height, null);
    for (const [unit] of CROSS_PASSES)
      uploadPixels(s, unit, gl.RGBA, width, height, null);
    s.fieldWidth = width;
    s.fieldHeight = height;
  }
  gl.bindFramebuffer(gl.FRAMEBUFFER, s.framebuffer);
  gl.viewport(0, 0, width, height);
  selectProgram(s, s.field, source, width, height);
  renderTo(s, FIELD_UNIT);
  selectProgram(s, s.cross, source, width, height);
  for (const [unit, dx, dy] of CROSS_PASSES) {
    gl.uniform4fv(gl.getUniformLocation(s.cross, 'u_dx'), dx);
    gl.uniform4fv(gl.getUniformLocation(s.cross, 'u_dy'), dy);
    renderTo(s, unit);
  }
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
}

function sourceSize(source: HTMLImageElement | HTMLCanvasElement) {
  return source instanceof HTMLImageElement
    ? { width: source.naturalWidth, height: source.naturalHeight }
    : { width: source.width, height: source.height };
}

export function drawSmoothImage(
  ctx: CanvasRenderingContext2D,
  source: SmoothSource,
  x: number,
  y: number,
  scale: number,
): boolean {
  if (smoother?.gl.isContextLost()) smoother = undefined;
  if (smoother === undefined) smoother = createSmoother();
  if (!smoother) return false;
  const s = smoother;
  const { gl } = s;
  const { width, height } = sourceSize(source.image);
  if (width > s.maxSize || height > s.maxSize) return false;
  if (source.fill && source.fill.labels.length !== width * height) return false;

  let fieldStale = false;
  const imageChanged =
    source.image !== s.image || source.revision !== s.revision;
  if (imageChanged) {
    uploadSource(s, IMAGE_UNIT, source.image);
    s.image = source.image;
    s.revision = source.revision;
    fieldStale = true;
  }
  if (source.tiles !== s.tiles || (imageChanged && source.tiles)) {
    if (source.tiles) uploadSource(s, TILES_UNIT, source.tiles);
    s.tiles = source.tiles;
    fieldStale = true;
  }
  const labels = source.fill?.labels ?? null;
  if (labels !== s.labels) {
    if (labels) uploadLabels(s, labels, width, height);
    s.labels = labels;
    fieldStale = true;
  }
  if (source.fill) {
    uploadPalette(s, source.fill.colors);
    uploadRipples(s, source.fill.ripples);
  }
  if (fieldStale) computeField(s, source, width, height);

  const canvas = gl.canvas as HTMLCanvasElement;
  if (canvas.width !== ctx.canvas.width) canvas.width = ctx.canvas.width;
  if (canvas.height !== ctx.canvas.height) canvas.height = ctx.canvas.height;
  gl.viewport(0, 0, canvas.width, canvas.height);
  selectProgram(s, s.draw, source, width, height);
  const uniform = (name: string) => gl.getUniformLocation(s.draw, name);
  const m = ctx.getTransform();
  gl.uniform2f(uniform('u_paletteSize'), PALETTE_WIDTH, s.paletteRows);
  gl.uniform2f(uniform('u_origin'), m.a * x + m.e, m.d * y + m.f);
  gl.uniform1f(uniform('u_scale'), m.a * scale);
  gl.uniform1f(uniform('u_height'), canvas.height);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(canvas, 0, 0);
  ctx.restore();
  return true;
}
