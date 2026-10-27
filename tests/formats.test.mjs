import test from 'node:test';
import assert from 'node:assert/strict';
import { aspectRatio, outputSize, previewSize, exportName, timeLabel } from '../dist/vision/formats.js';
import { mediaKind } from '../dist/vision/media.js';

test('original, square, landscape and portrait export dimensions', () => {
  const source = { width: 4032, height: 3024 };
  assert.deepEqual(outputSize(source, { ratio: 'original' }), source);
  assert.deepEqual(outputSize(source, { ratio: '1:1' }, '1920'), { width: 1920, height: 1920 });
  assert.deepEqual(outputSize(source, { ratio: '16:9' }, '1920'), { width: 1920, height: 1080 });
  assert.deepEqual(outputSize(source, { ratio: '9:16' }, '1920'), { width: 1080, height: 1920 });
  assert.deepEqual(outputSize(source, { ratio: '4:5' }, '1080'), { width: 864, height: 1080 });
  assert.equal(aspectRatio('invalid', 300, 200), 1.5);
});
test('large imports respect memory bounds while preview keeps the frame', () => {
  const size = outputSize({ width: 80000, height: 80000 }, { ratio: 'original' });
  assert.ok(size.width <= 8192);
  assert.ok(size.width * size.height <= 24_010_000);
  assert.deepEqual(previewSize({ width: 1080, height: 1920 }), { width: 900, height: 1600 });
  assert.deepEqual(previewSize({ width: 320, height: 240 }), { width: 320, height: 240 });
});
test('file names preserve Ukrainian, remove path characters and use the selected extension', () => {
  assert.equal(exportName('Мій кадр.jpg', { width: 1080, height: 1920 }, 'png'), 'Мій-кадр-vision-1080x1920.png');
  assert.equal(exportName('a/b?c.png', { width: 100, height: 100 }, 'jpeg'), 'a-b-c-vision-100x100.jpg');
  assert.equal(timeLabel(125.9), '02:05');
  assert.equal(timeLabel(Infinity), '00:00');
});
test('raster and video classification covers blank MIME types and rejects vector and invalid files', () => {
  assert.equal(mediaKind({ name: 'photo.JPG', type: '' }), 'image');
  assert.equal(mediaKind({ name: 'photo', type: 'image/webp' }), 'image');
  assert.equal(mediaKind({ name: 'clip.MOV', type: '' }), 'video');
  assert.equal(mediaKind({ name: 'clip', type: 'video/webm' }), 'video');
  assert.throws(() => mediaKind({ name: 'logo.svg', type: 'image/png' }), /raster/);
  assert.throws(() => mediaKind({ name: 'fake.png', type: 'image/svg+xml' }), /raster/);
  assert.throws(() => mediaKind({ name: 'notes.txt', type: 'text/plain' }), /raster image or a video/);
});
