import test from 'node:test';
import assert from 'node:assert/strict';
import { detectFeatures, normalize } from '../dist/vision/engine.js';
import { BASE_CONFIG } from '../dist/vision/preset.js';
import { FIELD_PRESETS, fieldPreset, fieldIsAnimated } from '../dist/vision/field-model.js';
import { fieldGrid, fieldPosition, fieldElement, fieldMask } from '../dist/vision/field-renderer.js';

function flat(value, alpha = 255) {
  const data = new Uint8ClampedArray(192 * 108 * 4);
  for (let i = 0; i < data.length; i += 4) data.set([value, value, value, alpha], i);
  return { width: 192, height: 108, data };
}
const sample = () => [128, 128, 128, 255];

test('flat black, gray and white inputs retain stable decorative markers and spacing', () => {
  const c = normalize(BASE_CONFIG);
  for (const gray of [0, 64, 128, 255]) {
    const points = detectFeatures(flat(gray), 1920, 1080, c);
    assert.ok(points.length > 30 && points.length <= c.maxCircles);
    assert.ok(points.every(p => p.synthetic && p.radius > 0));
    assert.deepEqual(points, detectFeatures(flat(gray), 1920, 1080, c));
    for (let i = 0; i < points.length; i++) for (let j = 0; j < i; j++) {
      assert.ok(Math.hypot((points[i].x - points[j].x) * 1920, (points[i].y - points[j].y) * 1080) >= c.minDistance * 1.08);
    }
  }
});
test('strict detection honors threshold; empty transparency never receives fallback markers', () => {
  const c = normalize({ ...BASE_CONFIG, detectionPlacement: 'features' });
  assert.equal(detectFeatures(flat(128), 1920, 1080, c).length, 0);
  assert.equal(detectFeatures(flat(128, 0), 1920, 1080, normalize(BASE_CONFIG)).length, 0);
  const withFeatures = normalize({ ...c, threshold: 0 });
  assert.ok(detectFeatures(flat(128), 1920, 1080, withFeatures).every(p => !p.synthetic));
  assert.ok(detectFeatures(flat(128), 1920, 1080, normalize({ ...withFeatures, detectionPlacement: 'scattered' })).every(p => p.synthetic));
});
test('all field presets normalize and reset prior custom settings without changing other effects', () => {
  for (const p of FIELD_PRESETS) {
    const fields = fieldPreset(p.id), c = normalize({ ...BASE_CONFIG, ...fields });
    assert.equal(c.fieldPreset, p.id); assert.equal(c.fieldEnabled, true);
    assert.equal(c.detection, true); assert.equal(c.chainEnabled, true);
    for (const key of Object.keys(fields)) assert.equal(c[key], fields[key], `${p.id}: ${key}`);
  }
  assert.equal(fieldPreset('unknown'), null);
  const invalid = normalize({ fieldSize: 999, fieldIntensity: -1, fieldColor: 'bad', fieldShape: '<script>' });
  assert.equal(invalid.fieldSize, 60); assert.equal(invalid.fieldIntensity, 0); assert.equal(invalid.fieldColor, '#d5d5d5'); assert.equal(invalid.fieldShape, 'ascii');
});
test('field layout and element states match between preview and high resolution export', () => {
  const c = normalize(fieldPreset('mixed')), a = fieldGrid(c, 1280, 720), b = fieldGrid(c, 3840, 2160);
  assert.equal(a.cols, b.cols); assert.equal(a.rows, b.rows);
  assert.deepEqual(fieldElement(5, 8, c, a, 1.25, sample), fieldElement(5, 8, c, b, 1.25, sample));
  const wide = fieldGrid(normalize({ ...c, fieldSpacing: 8, fieldAspect: .5 }), 8192, 1024);
  assert.ok(wide.rows * wide.cols < 19000);
});
test('speed, direction, still toggle and independent animation drive predictable movement', () => {
  const c = normalize({ ...fieldPreset('code'), fieldTurbulence: 0, fieldJitter: 0, fieldSpeed: 30 }), grid = fieldGrid(c, 1920, 1080);
  const from = fieldPosition(4, 4, c, grid, 0), right = fieldPosition(4, 4, c, grid, 1);
  assert.ok(Math.abs(right.x - from.x - 30) < 1e-9); assert.equal(right.y, from.y);
  const down = fieldPosition(4, 4, { ...c, fieldDirection: 90 }, grid, 1);
  assert.ok(Math.abs(down.y - from.y - 30) < 1e-9); assert.ok(Math.abs(down.x - from.x) < 1e-9);
  assert.deepEqual(fieldPosition(4, 4, { ...c, fieldAnimate: false }, grid, 50), from);
  assert.equal(fieldIsAnimated({ ...c, animate: false }), true);
  assert.equal(fieldIsAnimated({ ...c, fieldEnabled: false }), false);
});
test('density zero hides every shape, custom symbols and time-based changes stay deterministic', () => {
  const c = normalize({ ...fieldPreset('code'), fieldCharacters: 'Ж7', fieldIntensity: 1, fieldChangeRate: 10 }), grid = fieldGrid(c, 1920, 1080);
  const seen = new Set();
  for (let i = 0; i < 30; i++) {
    const point = fieldElement(2, 3, c, grid, i / 10, sample); seen.add(point.glyph);
    assert.deepEqual(point, fieldElement(2, 3, c, grid, i / 10, sample));
    assert.equal(fieldElement(2, 3, { ...c, fieldIntensity: 0 }, grid, i, sample).alpha, 0);
  }
  assert.deepEqual(seen, new Set(['Ж', '7']));
  const at = fieldElement(2, 3, c, grid, .7, sample);
  fieldElement(2, 3, c, grid, 8, sample);
  assert.deepEqual(fieldElement(2, 3, c, grid, .7, sample), at, 'No render history is needed for trails or seeking');
});
test('image masks follow highlights, shadows, transparency, inversion and soft thresholds', () => {
  const c = normalize({ ...fieldPreset('raster'), fieldThreshold: .5, fieldSoftness: .6 });
  assert.equal(fieldMask(c, 5, 5, () => [255, 255, 255, 255], 0), 1);
  assert.equal(fieldMask(c, 5, 5, () => [0, 0, 0, 255], 0), 0);
  assert.equal(fieldMask(c, 5, 5, () => [255, 255, 255, 0], 0), 0);
  assert.equal(fieldMask({ ...c, fieldInvert: true }, 5, 5, () => [0, 0, 0, 255], 0), 1);
  const middle = fieldMask(c, 5, 5, sample, 0); assert.ok(middle > .4 && middle < .6);
  assert.equal(fieldMask({ ...c, fieldMask: 'edges' }, 5, 5, sample, 0), 0);
});
