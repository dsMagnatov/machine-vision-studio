export function* audioSegments(sourceDuration, start, duration) {
  if (!(Number.isFinite(sourceDuration) && sourceDuration > 0 && Number.isFinite(duration) && duration > 0)) return;
  let sourceStart = ((start % sourceDuration) + sourceDuration) % sourceDuration, outputStart = 0;
  while (duration - outputStart > 1e-8) {
    const length = Math.min(sourceDuration - sourceStart, duration - outputStart);
    yield { sourceStart, sourceEnd: sourceStart + length, outputStart };
    outputStart += length; sourceStart = 0;
  }
}
export function audioSampleRange(sample, segment) {
  const first = Math.max(0, Math.round((segment.sourceStart - sample.timestamp) * sample.sampleRate));
  const last = Math.min(sample.numberOfFrames, Math.round((segment.sourceEnd - sample.timestamp) * sample.sampleRate));
  if (last <= first) return null;
  return { first, last, timestamp: Math.max(0, segment.outputStart + sample.timestamp + first / sample.sampleRate - segment.sourceStart) };
}
