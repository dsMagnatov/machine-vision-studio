import { loadMedia, seekVideo } from './media.js';

// Decode timestamps in order rather than seeking from a keyframe for every output frame.
export async function createFrameReader(source, settings, signal, start = 0) {
  signal.throwIfAborted();
  let input;
  try {
    const { Input, BlobSource, ALL_FORMATS, CanvasSink } = await import('../vendor/mediabunny.js');
    signal.throwIfAborted();
    input = new Input({ formats: ALL_FORMATS, source: new BlobSource(source.file) });
    const track = await input.getPrimaryVideoTrack();
    if (!track || !await track.canDecode()) throw new Error('Use native decoder');
    const sink = new CanvasSink(track, { poolSize: 2 });
    const duration = source.media.duration;
    const timestamps = function* () {
      for (let i = 0; i < settings.frames; i++) yield (start + i / settings.fps) % duration;
    };
    const iterator = sink.canvasesAtTimestamps(timestamps());
    const canvas = document.createElement('canvas'), ctx = canvas.getContext('2d');
    const abort = () => input.dispose(); signal.addEventListener('abort', abort, { once: true });
    return {
      async frame() {
        signal.throwIfAborted();
        try {
          const { value, done } = await iterator.next();
          signal.throwIfAborted();
          if (done || !value) throw new Error('The video has no frame at the selected timestamp.');
          if (canvas.width !== value.canvas.width) canvas.width = value.canvas.width;
          if (canvas.height !== value.canvas.height) canvas.height = value.canvas.height;
          ctx.drawImage(value.canvas, 0, 0); return canvas;
        } catch (error) { signal.throwIfAborted(); throw error; }
      },
      close() {
        signal.removeEventListener('abort', abort); input.dispose(); iterator.return().catch(() => {}); canvas.width = canvas.height = 1;
      },
    };
  } catch (error) {
    input?.dispose(); signal.throwIfAborted();
    // Some codecs supported by native video are unavailable in WebCodecs.
    const copy = await loadMedia({ file: source.file, signal });
    return {
      async frame(time) { await seekVideo(copy.media, (start + time) % copy.media.duration, signal); return copy.media; },
      close() { copy.destroy(); },
    };
  }
}
