export interface SmoothSource {
  image: HTMLImageElement | HTMLCanvasElement;
  revision: number;
  tiles: HTMLCanvasElement | null;
  fill: { labels: Int16Array; colors: Map<number, string> } | null;
}

const SIGMA = 1.25;
const RADIUS = 3;
const THIN_FLOOR = 0.75;
const PALETTE_WIDTH = 256;

const IMAGE_UNIT = 0;
const TILES_UNIT = 1;
const LABELS_UNIT = 2;
const PALETTE_UNIT = 3;
const FIELD_UNIT = 4;
const SAMPLERS: [string, number][] = [
  ['u_image', IMAGE_UNIT],
  ['u_tiles', TILES_UNIT],
  ['u_labels', LABELS_UNIT],
  ['u_palette', PALETTE_UNIT],
  ['u_field', FIELD_UNIT],
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
`;

const FIELD_SHADER = `${SOURCE_SHADER}
bool sameAs(vec2 cell, vec4 color, float label) {
  return labelOf(cell) == label && sameColor(baseColor(cell), color);
}

void main() {
  vec2 cell = floor(gl_FragCoord.xy);
  vec4 color = baseColor(cell);
  float label = labelOf(cell);
  float own = 0.0;
  float total = 0.0;
  for (int dy = -${RADIUS}; dy <= ${RADIUS}; dy++) {
    for (int dx = -${RADIUS}; dx <= ${RADIUS}; dx++) {
      vec2 offset = vec2(float(dx), float(dy));
      float weight = exp(-dot(offset, offset) / ${(2 * SIGMA * SIGMA).toFixed(4)});
      total += weight;
      if (sameAs(cell + offset, color, label)) own += weight;
    }
  }
  float share = own / total;
  bool thinX = !sameAs(cell + vec2(-1.0, 0.0), color, label) && !sameAs(cell + vec2(1.0, 0.0), color, label);
  bool thinY = !sameAs(cell + vec2(0.0, -1.0), color, label) && !sameAs(cell + vec2(0.0, 1.0), color, label);
  if (thinX || thinY) share = max(share, ${THIN_FLOOR.toFixed(2)});
  gl_FragColor = vec4(share, 0.0, 0.0, 1.0);
}
`;

const DRAW_SHADER = `${SOURCE_SHADER}
uniform sampler2D u_palette;
uniform sampler2D u_field;
uniform vec2 u_paletteSize;
uniform vec2 u_origin;
uniform float u_scale;
uniform float u_height;

vec4 c0, c1, c2, c3, labels, shares, w, wx, wy;

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

vec3 score(vec4 mask) {
  vec4 value = mask * shares + (1.0 - mask) * (1.0 - shares);
  return vec3(dot(value, w), dot(value, wx), dot(value, wy));
}

vec4 shown(vec4 color, float label) {
  if (label >= 0.0) {
    vec2 slot = vec2(mod(label, u_paletteSize.x), floor(label / u_paletteSize.x));
    vec4 fill = texture2D(u_palette, (slot + 0.5) / u_paletteSize);
    if (fill.a > 0.0) return fill;
  }
  return color;
}

float shareAt(vec2 cell) {
  return texture2D(u_field, (cell + 0.5) / u_size).r;
}

void main() {
  vec2 p = (vec2(gl_FragCoord.x, u_height - gl_FragCoord.y) - u_origin) / u_scale;
  if (p.x < 0.0 || p.y < 0.0 || p.x > u_size.x || p.y > u_size.y) {
    gl_FragColor = vec4(0.0);
    return;
  }
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
  shares = vec4(shareAt(cell), shareAt(cell + right), shareAt(cell + down), shareAt(cell + right + down));
  w = vec4((1.0 - f.x) * (1.0 - f.y), f.x * (1.0 - f.y), (1.0 - f.x) * f.y, f.x * f.y);
  wx = vec4(f.y - 1.0, 1.0 - f.y, -f.y, f.y);
  wy = vec4(f.x - 1.0, -f.x, 1.0 - f.x, f.x);

  vec4 m0 = maskOf(c0, labels.x);
  vec4 m1 = maskOf(c1, labels.y);
  vec4 m2 = maskOf(c2, labels.z);
  vec4 m3 = maskOf(c3, labels.w);
  vec3 s0 = score(m0);
  vec3 s1 = score(m1);
  vec3 s2 = score(m2);
  vec3 s3 = score(m3);
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
  draw: WebGLProgram;
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
  const draw = link(gl, DRAW_SHADER);
  if (!field || !draw) return null;

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
  const framebuffer = gl.createFramebuffer()!;
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    gl.COLOR_ATTACHMENT0,
    gl.TEXTURE_2D,
    textures[FIELD_UNIT],
    0,
  );
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  return {
    gl,
    field,
    draw,
    framebuffer,
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

function computeField(
  s: Smoother,
  source: SmoothSource,
  width: number,
  height: number,
) {
  const { gl } = s;
  if (width !== s.fieldWidth || height !== s.fieldHeight) {
    uploadPixels(s, FIELD_UNIT, gl.RGBA, width, height, null);
    s.fieldWidth = width;
    s.fieldHeight = height;
  }
  selectProgram(s, s.field, source, width, height);
  gl.bindFramebuffer(gl.FRAMEBUFFER, s.framebuffer);
  gl.viewport(0, 0, width, height);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
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
  if (source.image !== s.image || source.revision !== s.revision) {
    uploadSource(s, IMAGE_UNIT, source.image);
    s.image = source.image;
    s.revision = source.revision;
    fieldStale = true;
  }
  if (source.tiles !== s.tiles) {
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
  if (source.fill) uploadPalette(s, source.fill.colors);
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
