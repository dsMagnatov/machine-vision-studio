const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const mix = (a, b, t) => a + (b - a) * t;
const TAU = Math.PI * 2;
export const hash = (x, y = 0, seed = 0) => {
  let n = Math.imul((x | 0) + 1, 374761393) ^ Math.imul((y | 0) + 1, 668265263) ^ Math.imul(seed | 0, 1274126177);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
};
const range = (key, label, min, max, step, value, unit = '') => ({ key, label, type: 'range', min, max, step, default: value, unit });
const toggle = (key, label, value) => ({ key, label, type: 'toggle', default: value });
const select = (key, label, options, value) => ({ key, label, type: 'select', options: options.map(([value, label]) => ({ value, label })), default: value });
const text = (key, label, value = '') => ({ key, label, type: 'text', default: value });
const color = (key, label, value) => ({ key, label, type: 'color', default: value });
export const GROUPS = [
  { id: 'image', label: 'Image', open: true, controls: [range('imageOpacity', 'Image opacity', 0, 1, .01, 1, '%')] },
  { id: 'motion', label: 'Motion', open: true, controls: [toggle('animate', 'Animate', true), select('motion', 'Mode', [['scan', 'Scanning'], ['flow', 'Continuous motion'], ['both', 'Scan + motion']], 'both'), range('speed', 'Speed', .1, 3, .05, .8, '×'), range('movement', 'Movement', 0, 60, 1, 12, 'px'), range('trail', 'Scan trail', .05, 1, .01, .35, '%'), range('pulse', 'Size pulse', 0, 1, .01, .15, '%'), select('scanDirection', 'Scan direction', [['down', 'Top to bottom'], ['right', 'Left to right'], ['radial', 'From center']], 'down'), toggle('scanLine', 'Scan line', true)] },
  { id: 'pixelate', label: 'Pixelate', controls: [range('pixelSize', 'Pixel size', 2, 60, 2, 16, 'px'), range('zoneSize', 'Zone size', 20, 400, 10, 100, 'px'), toggle('zoneStroke', 'Zone outlines', true)] },
  { id: 'detection', label: 'Detection', open: true, controls: [toggle('detection', 'Detection markers', true), select('detectionMode', 'Analysis', [['combined', 'Combined'], ['contrast', 'Contrast'], ['bright', 'Bright'], ['dark', 'Dark']], 'combined'), range('blockSize', 'Block size', 8, 64, 4, 16, 'px'), range('threshold', 'Threshold', 0, 80, 1, 24), range('maxCircles', 'Max markers', 5, 300, 5, 80), range('minDistance', 'Min distance', 10, 100, 5, 50, 'px')] },
  { id: 'shapes', label: 'Shapes', controls: [select('shape', 'Shape', [['circle', 'Circle'], ['square', 'Square']], 'circle'), range('minRadius', 'Min radius', 2, 30, 1, 4, 'px'), range('maxRadius', 'Max radius', 10, 120, 2, 24, 'px'), range('stroke', 'Stroke', .3, 3, .1, 1, 'px'), range('sizeSeed', 'Size seed', 1, 999, 1, 42), toggle('labels', 'Coordinate labels', false), range('labelSize', 'Label size', 4, 30, 1, 8, 'px'), toggle('animateLabels', 'Animate numbers', true), range('labelRate', 'Number update rate', 2, 20, 1, 8, 'Hz'), range('overlayOpacity', 'Overlay opacity', 0, 1, .01, .7, '%')] },
  { id: 'connections', label: 'Connections', controls: [toggle('connections', 'Connecting lines', true), range('maxDistance', 'Max distance', 0, 400, 10, 150, 'px'), range('lineWeight', 'Line weight', .2, 2, .1, .8, 'px')] },
  { id: 'chain', label: 'Circle chain', controls: [toggle('chainEnabled', 'Circle chain', false), range('count', 'Count', 3, 15, 1, 11), range('angle', 'Angle', 0, 180, 1, 45, '°'), range('baseRadius', 'Base radius', 30, 400, 5, 250, 'px'), range('sizeRatio', 'Size ratio', .5, 1.2, .01, .79, '×'), range('chainX', 'Center X', 0, 1, .01, .5, '%'), range('chainY', 'Center Y', 0, 1, .01, .5, '%'), toggle('intersections', 'Intersection markers', true), range('markerSize', 'Marker size', 2, 15, .5, 5, 'px')] },
  { id: 'frame', label: 'Crosshair frame', controls: [toggle('frameEnabled', 'Crosshair frame', false), range('frameSize', 'Frame size', 10, 100, 1, 60, '%'), range('dash', 'Dash pattern', 2, 30, 1, 8, 'px'), range('frameStroke', 'Stroke', .3, 3, .1, 1, 'px'), range('starSize', 'Center star size', 0, 200, 2, 40, 'px'), range('starPoints', 'Star points', 2, 8, 1, 4)] },
  { id: 'text', label: 'Frame text', controls: [toggle('frameText', 'Corner text', false), text('textTL', 'Top left'), text('textTR', 'Top right'), text('textBL', 'Bottom left'), text('textBR', 'Bottom right'), range('textSize', 'Text size', 6, 40, 1, 12, 'px')] },
  { id: 'palette', label: 'Palette', controls: [color('color', 'Shapes & text', '#ffffff'), color('accent', 'Lines & markers', '#ffffff'), color('background', 'Background', '#000000')] },
  { id: 'texture', label: 'Texture / noise', controls: [range('textureOpacity', 'Texture opacity', 0, 1, .01, .15, '%'), select('textureBlend', 'Blend', [['screen', 'Screen'], ['soft-light', 'Soft light'], ['multiply', 'Multiply'], ['source-over', 'Normal']], 'screen'), range('grainSize', 'Grain size', 1, 6, .25, 1.5, 'px'), range('noiseSeed', 'Noise seed', 1, 999, 1, 42), toggle('textureAnimate', 'Animate texture', false)] },
];
export const PALETTES = [
  { label: 'White / Dark', color: '#ffffff', accent: '#ffffff', background: '#141414' },
  { label: 'Black / Light', color: '#171717', accent: '#171717', background: '#eeeeea' },
  { label: 'Gold / Dark', color: '#dcc48b', accent: '#b7a36c', background: '#10110d' },
  { label: 'Green / Dark', color: '#a0dbb0', accent: '#69ba94', background: '#030d0b' },
  { label: 'Kailah Blue', color: '#b9d7ff', accent: '#69b3ff', background: '#030823' },
  { label: 'Kailah Violet', color: '#f1a5ff', accent: '#a148ff', background: '#091c8c' },
];
export function defaults() {
  return { enabled: true, zones: [], texture: 'none', ...Object.fromEntries(GROUPS.flatMap(group => group.controls).map(item => [item.key, item.default])) };
}
export function normalize(input = {}) {
  const result = defaults();
  for (const group of GROUPS) for (const field of group.controls) {
    const value = input[field.key];
    if (field.type === 'range' && Number.isFinite(Number(value))) result[field.key] = clamp(Number(value), field.min, field.max);
    if (field.type === 'toggle' && typeof value === 'boolean') result[field.key] = value;
    if (field.type === 'select' && field.options.some(item => item.value === value)) result[field.key] = value;
    if (field.type === 'text' && typeof value === 'string') result[field.key] = value.slice(0, 96);
    if (field.type === 'color' && /^#[0-9a-f]{6}$/i.test(value || '')) result[field.key] = value;
  }
  result.enabled = input.enabled !== false;
  result.minRadius = Math.min(result.minRadius, result.maxRadius);
  if (typeof input.texture === 'string') result.texture = input.texture.slice(0, 200);
  if (Array.isArray(input.zones)) result.zones = input.zones.slice(0, 24).filter(p => Number.isFinite(p.x) && Number.isFinite(p.y)).map(p => ({ x: clamp(p.x), y: clamp(p.y) }));
  return result;
}

export function detectFeatures(image, width, height, config) {
  const { width: sw, height: sh, data } = image;
  const unit = Math.min(width, height) / 1000;
  const step = Math.max(2, Math.round(config.blockSize * unit * sw / width));
  const light = (x, y) => { const i = (clamp(Math.round(y), 0, sh - 1) * sw + clamp(Math.round(x), 0, sw - 1)) * 4; return (.2126 * data[i] + .7152 * data[i + 1] + .0722 * data[i + 2]) / 255; };
  const candidates = [];
  for (let y = step; y < sh - step; y += step) for (let x = step; x < sw - step; x += step) {
    const l = light(x, y), index = (y * sw + x) * 4;
    const l0 = light(x - step, y), l1 = light(x + step, y), l2 = light(x, y - step), l3 = light(x, y + step);
    const contrast = clamp((Math.max(l, l0, l1, l2, l3) - Math.min(l, l0, l1, l2, l3)) * 4);
    const chroma = (Math.max(data[index], data[index + 1], data[index + 2]) - Math.min(data[index], data[index + 1], data[index + 2])) / 255;
    const score = config.detectionMode === 'bright' ? l : config.detectionMode === 'dark' ? 1 - l : config.detectionMode === 'contrast' ? contrast : clamp(contrast * .55 + l * .3 + chroma * .25);
    if (score * 100 < config.threshold || data[index + 3] < 12) continue;
    candidates.push({ x: x / sw, y: y / sh, score, cell: y * sw + x });
  }
  candidates.sort((a, b) => (b.score + hash(b.cell) * .015) - (a.score + hash(a.cell) * .015));
  const selected = [], distance = config.minDistance * unit;
  // Spatial buckets keep suppression fast at the reference's 300-marker maximum.
  const buckets = new Map(), bucketSize = Math.max(1, distance);
  for (const point of candidates) {
    const px = point.x * width, py = point.y * height, bx = Math.floor(px / bucketSize), by = Math.floor(py / bucketSize);
    let close = false;
    for (let oy = -1; oy <= 1 && !close; oy++) for (let ox = -1; ox <= 1 && !close; ox++) {
      for (const other of buckets.get(`${bx + ox},${by + oy}`) || []) if (Math.hypot(px - other.x * width, py - other.y * height) < distance) { close = true; break; }
    }
    if (close) continue;
    point.radius = mix(config.minRadius, config.maxRadius, Math.pow(point.score, .8)) * (.75 + hash(point.cell, 2, config.sizeSeed) * .5);
    selected.push(point);
    const key = `${bx},${by}`; if (!buckets.has(key)) buckets.set(key, []); buckets.get(key).push(point);
    if (selected.length >= config.maxCircles) break;
  }
  return selected;
}
export function circleIntersections(a, b) {
  const dx = b.x - a.x, dy = b.y - a.y, distance = Math.hypot(dx, dy);
  if (!distance || distance >= a.r + b.r || distance <= Math.abs(a.r - b.r)) return [];
  const along = (a.r * a.r - b.r * b.r + distance * distance) / (2 * distance);
  const height = Math.sqrt(Math.max(0, a.r * a.r - along * along));
  const x = a.x + dx * along / distance, y = a.y + dy * along / distance;
  return [{ x: x - dy * height / distance, y: y + dx * height / distance }, { x: x + dy * height / distance, y: y - dx * height / distance }];
}
export function scanAlpha(x, y, phase, config) {
  const position = config.scanDirection === 'right' ? x : config.scanDirection === 'radial' ? clamp(Math.hypot(x - .5, y - .5) / .7071) : y;
  const age = (phase - position + 1) % 1;
  return .08 + .92 * Math.exp(-age / Math.max(.02, config.trail) * 4);
}
export function formatReadout(point, width, height) {
  const x = String(clamp(Math.round(point.px / Math.max(1, width) * 1000), 0, 1000)).padStart(4, '0');
  const y = String(clamp(Math.round(point.py / Math.max(1, height) * 1000), 0, 1000)).padStart(4, '0');
  return `${x}, ${y}`;
}
export function sampleReadout(previous, text, time, rate) {
  if (!previous || time < previous.sampledAt) return { text, previous: text, sampledAt: time, changedAt: time };
  if (time - previous.sampledAt < 1 / Math.max(1, rate)) return previous;
  return { text, previous: text === previous.text ? previous.previous : previous.text, sampledAt: time, changedAt: text === previous.text ? previous.changedAt : time };
}
const makeBuffer = () => { const canvas = document.createElement('canvas'); return { canvas, ctx: canvas.getContext('2d', { willReadFrequently: true }) }; };
const resize = (canvas, width, height) => { if (canvas.width !== width) canvas.width = width; if (canvas.height !== height) canvas.height = height; };
function cover(ctx, source, width, height, fit = 'cover', position = '50% 50%', zoom = 1) {
  const sw = source.videoWidth || source.naturalWidth || source.width, sh = source.videoHeight || source.naturalHeight || source.height;
  if (!sw || !sh) return false;
  const scale = (fit === 'contain' ? Math.min(width / sw, height / sh) : Math.max(width / sw, height / sh)) * zoom;
  const positions = String(position).split(/\s+/).map(p => p === 'left' || p === 'top' ? 0 : p === 'right' || p === 'bottom' ? 1 : p.includes('%') ? clamp(parseFloat(p) / 100) : .5);
  ctx.drawImage(source, (width - sw * scale) * positions[0], (height - sh * scale) * (positions[1] ?? positions[0]), sw * scale, sh * scale);
  return true;
}

export class VisionRenderer {
  constructor(canvas) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d');
    this.source = makeBuffer(); this.analysis = makeBuffer(); this.pixel = makeBuffer(); this.grain = makeBuffer();
    this.features = []; this.labelStates = new Map(); this.analysisKey = ''; this.lastAnalysis = -Infinity; this.frameVersion = 0;
  }
  render(media, config, width, height, time, { dynamic = false, version = 0, textureMedia = null, fit = 'cover', position = '50% 50%', zoom = 1, clock = time } = {}) {
    const c = config, w = Math.max(1, Math.round(width)), h = Math.max(1, Math.round(height)), unit = Math.min(w, h) / 1000;
    const resized = this.canvas.width !== w || this.canvas.height !== h;
    // The standalone workspace shares one renderer across imported sources.
    if (this.media !== media) { this.features = []; this.labelStates.clear(); this.analysisKey = ''; }
    resize(this.canvas, w, h); resize(this.source.canvas, w, h);
    if (dynamic || resized || this.media !== media || this.version !== version) {
      this.source.ctx.clearRect(0, 0, w, h);
      if (!cover(this.source.ctx, media, w, h, fit, position, zoom)) return false;
      this.frameVersion++; this.media = media; this.version = version;
    }
    const key = [w, h, version, c.blockSize, c.threshold, c.maxCircles, c.minDistance, c.detectionMode, c.minRadius, c.maxRadius, c.sizeSeed].join('|');
    if (c.detection && (this.analysisKey !== key || dynamic && clock - this.lastAnalysis >= .2)) {
      const ratio = Math.min(1, 480 / w, 480 / h), aw = Math.max(2, Math.round(w * ratio)), ah = Math.max(2, Math.round(h * ratio));
      resize(this.analysis.canvas, aw, ah); this.analysis.ctx.clearRect(0, 0, aw, ah); this.analysis.ctx.drawImage(this.source.canvas, 0, 0, aw, ah);
      const detected = detectFeatures(this.analysis.ctx.getImageData(0, 0, aw, ah), w, h, c);
      const used = new Set();
      this.features = detected.map(point => {
        let nearest, best = c.minDistance * unit * 2;
        for (let index = 0; index < this.features.length; index++) {
          if (used.has(index)) continue;
          const old = this.features[index], distance = Math.hypot((old.x - point.x) * w, (old.y - point.y) * h);
          if (distance < best) { best = distance; nearest = index; }
        }
        const old = nearest === undefined ? null : this.features[nearest];
        if (old) used.add(nearest);
        return { ...point, id: old?.id ?? point.cell, fromX: old?.x ?? point.x, fromY: old?.y ?? point.y, born: old?.born ?? clock };
      });
      this.analysisKey = key; this.lastAnalysis = clock;
      const activeIDs = new Set(this.features.map(point => point.id));
      for (const id of this.labelStates.keys()) if (!activeIDs.has(id)) this.labelStates.delete(id);
    }
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = c.background; ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = c.imageOpacity; ctx.drawImage(this.source.canvas, 0, 0); ctx.globalAlpha = 1;
    const flow = c.animate && c.motion !== 'scan', scan = c.animate && c.motion !== 'flow';
    const phase = (time * c.speed / 8) % 1;
    this.drawZones(c, w, h, unit, time, flow);
    this.drawTexture(c, w, h, time, textureMedia);
    const points = c.detection ? this.features.map(point => {
      const smooth = clamp((clock - this.lastAnalysis) / .2), angle = point.id * .618;
      let x = mix(point.fromX, point.x, smooth) * w, y = mix(point.fromY, point.y, smooth) * h;
      if (flow) { x += Math.sin(time * c.speed * .7 + angle) * c.movement * unit; y += Math.cos(time * c.speed * .53 + angle * 1.7) * c.movement * unit; }
      const reveal = scan ? scanAlpha(x / w, y / h, phase, c) : 1;
      return { ...point, px: x, py: y, r: point.radius * unit * (1 + (flow ? Math.sin(time * c.speed + angle) * c.pulse * .3 : 0)), alpha: c.motion === 'both' && scan ? .4 + .6 * reveal : reveal };
    }) : [];
    ctx.save(); ctx.globalAlpha = c.overlayOpacity;
    if (c.connections && c.maxDistance > 0) this.drawConnections(points, c, unit);
    ctx.strokeStyle = c.color; ctx.fillStyle = c.color; ctx.lineWidth = c.stroke * unit;
    ctx.font = `${c.labelSize * unit}px ui-monospace, Consolas, monospace`; ctx.textBaseline = 'bottom';
    let readoutExample = '';
    for (const point of points) {
      ctx.globalAlpha = c.overlayOpacity * point.alpha;
      ctx.beginPath();
      if (c.shape === 'square') ctx.rect(point.px - point.r, point.py - point.r, point.r * 2, point.r * 2);
      else ctx.arc(point.px, point.py, point.r, 0, TAU);
      ctx.stroke();
      ctx.fillStyle = c.accent; ctx.beginPath(); ctx.arc(point.px, point.py, Math.max(.8, unit * 1.4), 0, TAU); ctx.fill();
      if (c.labels) { ctx.fillStyle = c.color; const label = this.drawReadout(point, c, w, h, unit, time); if (!readoutExample) readoutExample = label; }
    }
    ctx.globalAlpha = c.overlayOpacity;
    if (c.chainEnabled) this.drawChain(c, w, h, unit, time, flow);
    if (c.frameEnabled) this.drawFrame(c, w, h, unit, time, flow);
    if (c.frameText) this.drawText(c, w, h, unit);
    if (scan && c.scanLine) this.drawScanner(c, w, h, phase);
    ctx.restore();
    this.canvas.dataset.ready = 'true'; this.canvas.dataset.markers = String(points.length); this.canvas.dataset.zones = String(c.zones.length);
    this.canvas.dataset.motion = c.animate ? c.motion : 'still'; this.canvas.dataset.phase = phase.toFixed(4); this.canvas.dataset.analysis = c.detectionMode;
    this.canvas.dataset.readout = readoutExample; this.canvas.dataset.numberMotion = c.labels && c.animateLabels && c.animate ? 'rolling' : 'still';
    return true;
  }
  drawReadout(point, c, width, height, unit, time) {
    const ctx = this.ctx, text = formatReadout(point, width, height), x = point.px + point.r + 4 * unit, y = point.py - 3 * unit;
    if (!c.animateLabels || !c.animate) { this.labelStates.delete(point.id); ctx.fillText(text, x, y); return text; }
    const state = sampleReadout(this.labelStates.get(point.id), text, time, c.labelRate);
    this.labelStates.set(point.id, state);
    const duration = Math.min(.14, .85 / c.labelRate), progress = clamp((time - state.changedAt) / duration), ease = 1 - Math.pow(1 - progress, 3);
    if (progress >= 1 || state.text === state.previous) { ctx.fillText(state.text, x, y); return state.text; }
    const advance = ctx.measureText('0').width, lineHeight = c.labelSize * unit * 1.25;
    ctx.save(); ctx.beginPath(); ctx.rect(x - 1, y - lineHeight, advance * state.text.length + 2, lineHeight + 1); ctx.clip();
    for (let index = 0; index < state.text.length; index++) {
      const next = state.text[index], old = state.previous[index], at = x + index * advance;
      if (next === old || !/\d/.test(next)) { ctx.fillText(next, at, y); continue; }
      const start = index < 4 ? 0 : 6, direction = Number(state.text.slice(start, start + 4)) >= Number(state.previous.slice(start, start + 4)) ? 1 : -1;
      ctx.fillText(old, at, y - direction * lineHeight * ease);
      ctx.fillText(next, at, y + direction * lineHeight * (1 - ease));
    }
    ctx.restore(); return state.text;
  }
  drawConnections(points, c, unit) {
    const ctx = this.ctx, maxDistance = c.maxDistance * unit, counts = new Uint8Array(points.length);
    ctx.strokeStyle = c.accent; ctx.lineWidth = c.lineWeight * unit;
    for (let a = 0; a < points.length; a++) for (let b = a + 1; b < points.length; b++) {
      const p = points[a], q = points[b], dx = q.px - p.px, dy = q.py - p.py, distance = Math.hypot(dx, dy);
      if (distance > maxDistance || distance < p.r + q.r + 4 * unit || counts[a] >= 6 || counts[b] >= 6) continue;
      const nx = dx / distance, ny = dy / distance;
      const pr = c.shape === 'square' ? p.r / Math.max(Math.abs(nx), Math.abs(ny)) : p.r;
      const qr = c.shape === 'square' ? q.r / Math.max(Math.abs(nx), Math.abs(ny)) : q.r;
      if (pr + qr + 4 * unit >= distance) continue;
      ctx.globalAlpha = c.overlayOpacity * Math.min(p.alpha, q.alpha) * (.25 + .6 * (1 - distance / maxDistance));
      ctx.beginPath(); ctx.moveTo(p.px + nx * (pr + unit * 2), p.py + ny * (pr + unit * 2)); ctx.lineTo(q.px - nx * (qr + unit * 2), q.py - ny * (qr + unit * 2)); ctx.stroke(); counts[a]++; counts[b]++;
    }
  }
  drawZones(c, w, h, unit, time, flow) {
    const ctx = this.ctx, radius = c.zoneSize * unit, pixel = c.pixelSize * unit;
    for (const zone of c.zones) {
      const left = clamp(zone.x * w - radius, 0, w), top = clamp(zone.y * h - radius, 0, h);
      const right = clamp(zone.x * w + radius, 0, w), bottom = clamp(zone.y * h + radius, 0, h), width = right - left, height = bottom - top;
      if (!width || !height) continue;
      const pw = Math.max(1, Math.ceil(width / pixel)), ph = Math.max(1, Math.ceil(height / pixel));
      resize(this.pixel.canvas, pw, ph); this.pixel.ctx.clearRect(0, 0, pw, ph); this.pixel.ctx.drawImage(this.source.canvas, left, top, width, height, 0, 0, pw, ph);
      ctx.save(); ctx.fillStyle = c.background; ctx.fillRect(left, top, width, height); ctx.globalAlpha = c.imageOpacity; ctx.imageSmoothingEnabled = false; ctx.drawImage(this.pixel.canvas, left, top, width, height); ctx.restore();
      if (c.zoneStroke) { ctx.save(); ctx.strokeStyle = c.color; ctx.globalAlpha = c.overlayOpacity; ctx.lineWidth = c.stroke * unit; if (flow) { ctx.setLineDash([6 * unit, 4 * unit]); ctx.lineDashOffset = -time * c.speed * 8 * unit; } ctx.strokeRect(left, top, width, height); ctx.restore(); }
    }
  }
  drawChain(c, w, h, unit, time, flow) {
    const ctx = this.ctx, middle = (c.count - 1) / 2;
    const angle = (c.angle + (flow ? Math.sin(time * c.speed * .18) * 5 : 0)) * Math.PI / 180;
    const dx = Math.sin(angle), dy = Math.cos(angle), radii = Array.from({ length: Math.round(c.count) }, (_, i) => c.baseRadius * unit * Math.pow(c.sizeRatio, Math.abs(i - middle)));
    const positions = new Array(radii.length).fill(0), center = Math.floor(middle);
    for (let i = center + 1; i < radii.length; i++) positions[i] = positions[i - 1] + (radii[i] + radii[i - 1]) * .7;
    for (let i = center - 1; i >= 0; i--) positions[i] = positions[i + 1] - (radii[i] + radii[i + 1]) * .7;
    const circles = radii.map((r, i) => ({ x: c.chainX * w + dx * positions[i], y: c.chainY * h + dy * positions[i], r: r * (flow ? 1 + Math.sin(time * c.speed * .45) * c.pulse * .1 : 1) }));
    ctx.strokeStyle = c.color; ctx.lineWidth = c.stroke * unit;
    for (const circle of circles) { ctx.beginPath(); ctx.arc(circle.x, circle.y, circle.r, 0, TAU); ctx.stroke(); }
    if (c.intersections) { ctx.fillStyle = c.accent; for (let i = 1; i < circles.length; i++) for (const point of circleIntersections(circles[i - 1], circles[i])) { ctx.beginPath(); ctx.arc(point.x, point.y, c.markerSize * unit / 2, 0, TAU); ctx.fill(); } }
  }
  drawFrame(c, w, h, unit, time, flow) {
    const ctx = this.ctx, size = Math.min(w, h) * c.frameSize / 100 * (flow ? 1 + Math.sin(time * c.speed * .35) * .02 : 1);
    ctx.save(); ctx.translate(w / 2, h / 2); ctx.strokeStyle = c.color; ctx.lineWidth = c.frameStroke * unit;
    ctx.setLineDash([c.dash * unit, c.dash * unit]); ctx.lineDashOffset = flow ? -time * c.speed * 8 * unit : 0;
    ctx.strokeRect(-size / 2, -size / 2, size, size);
    ctx.beginPath(); ctx.moveTo(-w / 2, 0); ctx.lineTo(w / 2, 0); ctx.moveTo(0, -h / 2); ctx.lineTo(0, h / 2); ctx.stroke(); ctx.setLineDash([]);
    if (c.starSize) { ctx.beginPath(); for (let i = 0; i < Math.round(c.starPoints); i++) { const angle = i * Math.PI / c.starPoints + (flow ? Math.sin(time * c.speed * .2) * .15 : 0); const dx = Math.cos(angle) * c.starSize * unit / 2, dy = Math.sin(angle) * c.starSize * unit / 2; ctx.moveTo(-dx, -dy); ctx.lineTo(dx, dy); } ctx.stroke(); }
    ctx.restore();
  }
  drawText(c, w, h, unit) {
    const ctx = this.ctx, margin = 32 * unit;
    ctx.fillStyle = c.color; ctx.font = `${c.textSize * unit}px ui-monospace, Consolas, monospace`;
    for (const [text, x, y, align, baseline] of [[c.textTL, margin, margin, 'left', 'top'], [c.textTR, w - margin, margin, 'right', 'top'], [c.textBL, margin, h - margin, 'left', 'bottom'], [c.textBR, w - margin, h - margin, 'right', 'bottom']]) { ctx.textAlign = align; ctx.textBaseline = baseline; ctx.fillText(text, x, y, w / 2 - margin * 2); }
  }
  drawScanner(c, w, h, phase) {
    const ctx = this.ctx; ctx.save(); ctx.strokeStyle = c.accent; ctx.lineWidth = Math.max(.5, Math.min(w, h) / 1000); ctx.globalAlpha = c.overlayOpacity * .35;
    ctx.beginPath();
    if (c.scanDirection === 'radial') ctx.arc(w / 2, h / 2, Math.hypot(w, h) / 2 * phase, 0, TAU);
    else if (c.scanDirection === 'right') { ctx.moveTo(w * phase, 0); ctx.lineTo(w * phase, h); }
    else { ctx.moveTo(0, h * phase); ctx.lineTo(w, h * phase); }
    ctx.stroke(); ctx.restore();
  }
  drawTexture(c, w, h, time, media) {
    if (c.texture === 'none' || !c.textureOpacity) return;
    const ctx = this.ctx; ctx.save(); ctx.globalAlpha = c.textureOpacity; ctx.globalCompositeOperation = c.textureBlend;
    if (c.texture === 'grain') {
      const gw = 192, gh = 192;
      const key = `${gw}:${gh}:${c.noiseSeed}:${c.textureAnimate && c.animate ? Math.floor(time * c.speed * 12) : 0}`;
      if (key !== this.noiseKey) {
        resize(this.grain.canvas, gw, gh); const image = this.grain.ctx.createImageData(gw, gh), frame = c.textureAnimate && c.animate ? Math.floor(time * c.speed * 12) : 0;
        for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) { const i = (y * gw + x) * 4, value = hash(x, y, c.noiseSeed + frame) * 255; image.data[i] = image.data[i + 1] = image.data[i + 2] = value; image.data[i + 3] = 255; }
        this.grain.ctx.putImageData(image, 0, 0); this.noiseKey = key;
      }
      const pattern = ctx.createPattern(this.grain.canvas, 'repeat');
      ctx.scale(c.grainSize, c.grainSize); ctx.fillStyle = pattern; ctx.fillRect(0, 0, w / c.grainSize, h / c.grainSize);
    } else if (media) {
      if (c.textureAnimate && c.animate) { ctx.translate(w / 2 + Math.sin(time * c.speed * .4) * w * .015, h / 2 + Math.cos(time * c.speed * .3) * h * .015); ctx.scale(1.05, 1.05); ctx.translate(-w / 2, -h / 2); }
      cover(ctx, media, w, h);
    }
    ctx.restore();
  }
  destroy() { for (const item of [this.source, this.analysis, this.pixel, this.grain]) item.canvas.width = item.canvas.height = 1; this.features = []; this.labelStates.clear(); }
}
