import { fieldTravelAngle } from './field-model.js';

const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const wrap = (x, span) => ((x % span) + span) % span;
const smooth = (a, b, x) => { const t = clamp((x - a) / Math.max(.00001, b - a)); return t * t * (3 - 2 * t); };
export const fieldHash = (x, y = 0, seed = 0) => {
  let n = Math.imul((x | 0) + 1, 374761393) ^ Math.imul((y | 0) + 1, 668265263) ^ Math.imul(seed | 0, 1274126177);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
};

// Layout is measured in units per 1000px of the short edge. Preview and all
// export resolutions therefore sample the same field at the same time.
export function fieldGrid(c, width, height) {
  const unit = Math.min(width, height) / 1000, w = width / unit, h = height / unit;
  const budgetScale = Math.max(1, Math.sqrt(w * h / (c.fieldSpacing ** 2 * c.fieldAspect * 18000)));
  const sx = c.fieldSpacing * budgetScale, sy = sx * c.fieldAspect;
  return { unit, w, h, sx, sy, cols: Math.ceil(w / sx), rows: Math.ceil(h / sy), symbols: Array.from(c.fieldCharacters).filter(char => !/\s/u.test(char)) };
}
export function fieldPosition(col, row, c, grid, time) {
  const t = c.fieldAnimate && c.fieldMovement !== 'stationary' ? time : 0, angle = fieldTravelAngle(c) * Math.PI / 180;
  const phase = fieldHash(col, row, c.fieldSeed + 1) * Math.PI * 2;
  const x = (col + .5 + (fieldHash(col, row, c.fieldSeed + 2) - .5) * c.fieldJitter) * grid.sx;
  const y = (row + .5 + (fieldHash(col, row, c.fieldSeed + 3) - .5) * c.fieldJitter) * grid.sy;
  const vx = Math.cos(angle) * c.fieldSpeed, vy = Math.sin(angle) * c.fieldSpeed;
  const wobbleX = (Math.sin(t * .6 + phase) - Math.sin(phase)) * c.fieldTurbulence * grid.sx;
  const wobbleY = (Math.cos(t * .47 + phase) - Math.cos(phase)) * c.fieldTurbulence * grid.sy;
  return { x: wrap(x + vx * t + wobbleX, grid.cols * grid.sx), y: wrap(y + vy * t + wobbleY, grid.rows * grid.sy), phase };
}
const luma = rgb => (.2126 * rgb[0] + .7152 * rgb[1] + .0722 * rgb[2]) / 255;
export function fieldMask(c, x, y, sample, time) {
  if (c.fieldMask === 'uniform') return 1;
  let value;
  if (c.fieldMask === 'clouds') {
    const t = c.fieldAnimate && c.fieldMovement !== 'stationary' ? time * c.fieldSpeed / 120 : 0, offset = c.fieldSeed * .13;
    value = clamp(.5 + .27 * Math.sin(x * .006 + Math.sin(y * .008 + offset) * 1.7 + t * .12) + .23 * Math.cos(y * .012 - x * .003 + offset + t * .1));
  } else {
    const rgb = sample(x, y); if (rgb[3] < 12) return 0;
    value = luma(rgb);
    if (c.fieldMask === 'dark') value = 1 - value;
    if (c.fieldMask === 'edges') {
      const a = luma(sample(x - c.fieldSpacing, y)), b = luma(sample(x + c.fieldSpacing, y));
      const d = luma(sample(x, y - c.fieldSpacing)), e = luma(sample(x, y + c.fieldSpacing));
      value = clamp((Math.max(value, a, b, d, e) - Math.min(value, a, b, d, e)) * 3);
    }
  }
  value = clamp((value - .5) * c.fieldContrast + .5);
  if (c.fieldInvert) value = 1 - value;
  return smooth(c.fieldThreshold - c.fieldSoftness / 2, c.fieldThreshold + c.fieldSoftness / 2, value);
}
export function fieldElement(col, row, c, grid, time, sample) {
  const t = c.fieldAnimate ? time : 0, p = fieldPosition(col, row, c, grid, t);
  const mask = fieldMask(c, p.x, p.y, sample, t), density = c.fieldIntensity * mask;
  const visibility = density <= 0 ? 0 : smooth(fieldHash(col, row, c.fieldSeed) * .96, fieldHash(col, row, c.fieldSeed) * .96 + .04, density);
  const flicker = 1 - c.fieldFlicker * (.5 + .5 * Math.sin(t * 5 + p.phase));
  const alpha = visibility * c.fieldOpacity * flicker;
  const size = c.fieldSize * (.4 + .6 * mask) * (1 + c.fieldPulse * Math.sin(t * 2 + p.phase) * .45);
  const symbols = grid.symbols;
  const frame = Math.floor(t * c.fieldChangeRate + fieldHash(col, row, c.fieldSeed + 4));
  const glyph = symbols.length ? symbols[Math.floor(fieldHash(col, row, c.fieldSeed + 5 + frame) * symbols.length) % symbols.length] : '';
  const shape = c.fieldShape === 'mixed' ? ['ascii', 'square', 'dot', 'cross', 'diamond'][Math.floor(fieldHash(col, row, c.fieldSeed + 6) * 5) % 5] : c.fieldShape;
  return { ...p, alpha, size, glyph, shape };
}

export class FieldRenderer {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    this.version = -1;
  }
  draw(ctx, source, c, width, height, time, version) {
    if (!c.fieldEnabled || !c.fieldOpacity || !c.fieldIntensity) return 0;
    const grid = fieldGrid(c, width, height), ratio = Math.min(1, 512 / width, 512 / height);
    const sw = Math.max(2, Math.round(width * ratio)), sh = Math.max(2, Math.round(height * ratio));
    if (this.version !== version || this.canvas.width !== sw || this.canvas.height !== sh) {
      this.canvas.width = sw; this.canvas.height = sh; this.ctx.drawImage(source, 0, 0, sw, sh);
      this.image = this.ctx.getImageData(0, 0, sw, sh); this.version = version;
    }
    const data = this.image.data;
    const sample = (x, y) => {
      const index = (clamp(Math.floor(y / grid.h * sh), 0, sh - 1) * sw + clamp(Math.floor(x / grid.w * sw), 0, sw - 1)) * 4;
      return [data[index], data[index + 1], data[index + 2], data[index + 3]];
    };
    const trail = c.fieldAnimate && c.fieldMovement !== 'stationary' && c.fieldTrail > 0 ? 3 : 0;
    let count = 0;
    ctx.save(); ctx.scale(grid.unit, grid.unit); ctx.globalCompositeOperation = c.fieldBlend;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `${c.fieldSize}px 'IBM Plex Mono', Consolas, monospace`;
    const rotation = c.fieldRotation * Math.PI / 180;
    for (let row = 0; row < grid.rows; row++) for (let col = 0; col < grid.cols; col++) {
      for (let echo = trail; echo >= 0; echo--) {
        // No frame accumulation: a fresh export renderer reconstructs identical
        // trails, including when seeking backwards or rendering out of order.
        const at = time - echo * c.fieldTrail * .12, p = fieldElement(col, row, c, grid, at, sample);
        if (p.alpha < .005 || p.shape === 'ascii' && !p.glyph) continue;
        const rgb = c.fieldSourceColor ? sample(p.x, p.y) : null;
        if (rgb && rgb[3] < 12) continue;
        if (!echo) count++;
        ctx.fillStyle = rgb ? `rgb(${rgb[0]},${rgb[1]},${rgb[2]})` : c.fieldColor;
        ctx.globalAlpha = p.alpha * (echo ? .28 * (1 - echo / 4) * c.fieldTrail : 1);
        ctx.save(); ctx.translate(p.x, p.y); if (rotation) ctx.rotate(rotation);
        const s = p.size, r = s / 2;
        if (p.shape === 'ascii') { ctx.scale(s / c.fieldSize, s / c.fieldSize); ctx.fillText(p.glyph, 0, 0); }
        else if (p.shape === 'square') ctx.fillRect(-r, -r, s, s);
        else if (p.shape === 'cross') { ctx.fillRect(-r, -s * .14, s, s * .28); ctx.fillRect(-s * .14, -r, s * .28, s); }
        else { ctx.beginPath(); if (p.shape === 'diamond') { ctx.moveTo(0, -r); ctx.lineTo(r, 0); ctx.lineTo(0, r); ctx.lineTo(-r, 0); ctx.closePath(); } else ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill(); }
        ctx.restore();
      }
    }
    ctx.restore(); return count;
  }
  destroy() { this.canvas.width = this.canvas.height = 1; this.image = null; }
}
