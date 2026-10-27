import { audioSegments, audioSampleRange } from './audio-timeline.js';
let softwareAac = false;

export async function createAudioExport({ file, sourceDuration, start }, duration, signal) {
  signal.throwIfAborted();
  const { Input, BlobSource, ALL_FORMATS, AudioSampleSink, AudioSampleSource, Quality, canEncodeAudio } = await import('../vendor/mediabunny.js');
  signal.throwIfAborted();
  const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(file) });
  const abort = () => input.dispose(); signal.addEventListener('abort', abort, { once: true });
  let closed = false;
  const close = () => { if (!closed) { closed = true; signal.removeEventListener('abort', abort); input.dispose(); } };
  try {
    const track = await input.getPrimaryAudioTrack();
    signal.throwIfAborted();
    if (!track) { close(); return null; }
    const config = await track.getDecoderConfig();
    if (!config || !await track.canDecode()) throw new Error('The original audio codec cannot be decoded in this browser.');
    const quality = new Quality({ bitrate: Math.min(512_000, 128_000 * config.numberOfChannels) });
    const encodingOptions = { numberOfChannels: config.numberOfChannels, sampleRate: config.sampleRate, quality };
    if (!await canEncodeAudio('aac', encodingOptions)) {
      const { registerAacEncoder } = await import('../vendor/mediabunny-aac-encoder.js'); registerAacEncoder(); softwareAac = true;
      if (!await canEncodeAudio('aac', encodingOptions)) throw new Error('The original audio format cannot be encoded as AAC.');
    }
    signal.throwIfAborted();
    const sink = new AudioSampleSink(track), source = new AudioSampleSource({ codec: 'aac', quality });
    return {
      source,
      async pump() {
        try {
          for (const segment of audioSegments(sourceDuration, start, duration)) {
            for await (const sample of sink.samples(segment.sourceStart, segment.sourceEnd)) {
              try {
                signal.throwIfAborted();
                const range = audioSampleRange(sample, segment); if (!range) continue;
                const part = sample.trim(range.first, range.last);
                // The pinned FFmpeg AAC-LC fallback buffers one 1024-sample frame.
                // Negative packet timestamps let MP4 discard that priming at playback.
                try { part.setTimestamp(range.timestamp - (softwareAac ? 1024 / sample.sampleRate : 0)); await source.add(part); }
                finally { part.close(); }
              } finally { sample.close(); }
            }
          }
          source.close();
        } catch (error) { signal.throwIfAborted(); throw error; }
      },
      close,
    };
  } catch (error) { close(); signal.throwIfAborted(); throw error; }
}
