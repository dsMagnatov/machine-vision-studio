import test from 'node:test';
import assert from 'node:assert/strict';
import { audioSegments, audioSampleRange } from '../dist/vision/audio-timeline.js';

test('audio uses the same trim start and duration as video', () => {
  assert.deepEqual([...audioSegments(10, 2.5, 3)], [{ sourceStart: 2.5, sourceEnd: 5.5, outputStart: 0 }]);
});
test('audio loops across the video boundary without shifting the second segment', () => {
  assert.deepEqual([...audioSegments(4, 3.5, 2)], [
    { sourceStart: 3.5, sourceEnd: 4, outputStart: 0 },
    { sourceStart: 0, sourceEnd: 1.5, outputStart: .5 },
  ]);
  assert.deepEqual([...audioSegments(2, 0, 5)], [
    { sourceStart: 0, sourceEnd: 2, outputStart: 0 },
    { sourceStart: 0, sourceEnd: 2, outputStart: 2 },
    { sourceStart: 0, sourceEnd: 1, outputStart: 4 },
  ]);
});
test('audio trim keeps exact PCM sample ranges and resets presentation time', () => {
  const sample = { timestamp: 1, sampleRate: 48000, numberOfFrames: 48000 };
  assert.deepEqual(audioSampleRange(sample, { sourceStart: 1.25, sourceEnd: 1.75, outputStart: 0 }), { first: 12000, last: 36000, timestamp: 0 });
  assert.deepEqual(audioSampleRange(sample, { sourceStart: 0, sourceEnd: 1.5, outputStart: .5 }), { first: 0, last: 24000, timestamp: 1.5 });
});
test('samples outside the selected segment and invalid source durations are ignored', () => {
  assert.equal(audioSampleRange({ timestamp: 0, sampleRate: 48000, numberOfFrames: 1024 }, { sourceStart: 1, sourceEnd: 2, outputStart: 0 }), null);
  assert.deepEqual([...audioSegments(0, 0, 5)], []);
  assert.deepEqual([...audioSegments(Infinity, 0, 5)], []);
});
