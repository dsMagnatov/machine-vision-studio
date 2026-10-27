import test from 'node:test';
import assert from 'node:assert/strict';
import { animationSettings, encodingSize, gifFrameDelay } from '../dist/vision/export-options.js';
import { exportName } from '../dist/vision/formats.js';
import { seekVideo } from '../dist/vision/media.js';
import { encodeAnimation } from '../dist/vision/animation-export.js';

test('MP4 quality presets select real frame rates, bitrates and frame counts', () => {
  const settings = animationSettings({ format: 'mp4', quality: 'medium', duration: 5 });
  assert.equal(settings.fps, 30); assert.equal(settings.bitrate, 8_000_000); assert.equal(settings.frames, 150);
  const high = animationSettings({ format: 'mp4', quality: 'high', duration: 2 });
  assert.equal(high.fps, 60); assert.equal(high.bitrate, 16_000_000); assert.equal(high.frames, 120);
});
test('full-video export preserves source duration and GIF stays within its duration limit', () => {
  const full = animationSettings({ format: 'mp4', quality: 'low', fullVideo: true }, { kind: 'video', duration: 182.5 });
  assert.equal(full.duration, 182.5); assert.equal(full.frames, 4380);
  const gif = animationSettings({ format: 'gif', quality: 'medium', gifDuration: 100 });
  assert.equal(gif.duration, 20); assert.equal(gif.fps, 15); assert.equal(gif.colors, 128);
  const switched = animationSettings({ format: 'gif', quality: 'low', gifDuration: 2, fullVideo: true }, { kind: 'video', duration: 182.5 });
  assert.equal(switched.duration, 2); assert.equal(switched.frames, 20);
});
test('GIF centisecond rounding preserves total duration at 15, 24 and 30 fps', () => {
  for (const fps of [10, 15, 24, 30]) {
    const total = Array.from({ length: fps * 2 }, (_, frame) => gifFrameDelay(frame, fps)).reduce((a, b) => a + b, 0);
    assert.equal(total, 2000);
  }
});
test('video dimensions are even and animation size limits do not alter still exports', () => {
  assert.deepEqual(encodingSize({ width: 271, height: 481 }, 'mp4'), { width: 272, height: 482 });
  assert.deepEqual(encodingSize({ width: 3840, height: 2160 }, 'gif'), { width: 1280, height: 720 });
  assert.deepEqual(encodingSize({ width: 8000, height: 4000 }, 'mp4'), { width: 3840, height: 1920 });
  assert.deepEqual(encodingSize({ width: 8000, height: 4000 }, 'png'), { width: 8000, height: 4000 });
  assert.match(exportName('clip.mov', { width: 1280, height: 720 }, 'mp4'), /\.mp4$/);
  assert.match(exportName('clip.mov', { width: 1280, height: 720 }, 'gif'), /\.gif$/);
});
class FakeVideo extends EventTarget {
  duration = 2;
  readyState = 2;
  seeking = false;
  time = 0;
  seeks = 0;
  get currentTime() { return this.time; }
  set currentTime(value) {
    this.time = value; this.seeks++; this.seeking = true;
    queueMicrotask(() => { this.seeking = false; this.dispatchEvent(new Event('seeked')); });
  }
}
test('frame seeking waits for decoding, avoids redundant seeks and clamps the last frame', async () => {
  const video = new FakeVideo();
  await seekVideo(video, 0); assert.equal(video.seeks, 0);
  await seekVideo(video, .5); assert.equal(video.currentTime, .5); assert.equal(video.seeking, false);
  await seekVideo(video, 3); assert.ok(video.currentTime < 2); assert.ok(video.currentTime > 1.99);
});
test('canceling before export prevents frame rendering and decoder work', async () => {
  const controller = new AbortController(); controller.abort(); let rendered = false;
  await assert.rejects(encodeAnimation({ canvas: {}, settings: {}, signal: controller.signal, renderFrame: () => { rendered = true; }, onProgress() {} }), { name: 'AbortError' });
  await assert.rejects(seekVideo(new FakeVideo(), .5, controller.signal), { name: 'AbortError' });
  assert.equal(rendered, false);
});
