import { gifFrameDelay } from './export-options.js';
import { createAudioExport } from './audio-export.js';

function gifWorker(signal) {
  const worker = new Worker(new URL('./gif-worker.js', import.meta.url), { type: 'module' });
  let sequence = 0;
  const waiting = new Map();
  worker.onmessage = ({ data }) => {
    const request = waiting.get(data.id); if (!request) return; waiting.delete(data.id);
    data.error ? request.reject(new Error(data.error)) : request.resolve(data.data);
  };
  const rejectAll = error => { for (const request of waiting.values()) request.reject(error); waiting.clear(); };
  worker.onerror = event => rejectAll(new Error(event.message || 'GIF encoder could not start.'));
  const abort = () => { rejectAll(signal.reason); worker.terminate(); };
  signal.addEventListener('abort', abort, { once: true });
  return {
    send(type, data, transfer = []) {
      signal.throwIfAborted(); const id = ++sequence;
      return new Promise((resolve, reject) => { waiting.set(id, { resolve, reject }); worker.postMessage({ id, type, data }, transfer); });
    },
    close() { signal.removeEventListener('abort', abort); worker.terminate(); rejectAll(new DOMException('Encoder closed', 'AbortError')); },
  };
}
export async function encodeAnimation({ canvas, settings, renderFrame, signal, onProgress, audioInput = null }) {
  let output, gif, audio;
  try {
    signal.throwIfAborted();
    let videoSource;
    if (settings.format === 'mp4') {
      const { Output, Mp4OutputFormat, BufferTarget, CanvasSource, Quality, canEncodeVideo } = await import('../vendor/mediabunny.js');
      signal.throwIfAborted();
      const quality = new Quality({ bitrate: settings.bitrate });
      if (!await canEncodeVideo('avc', { width: canvas.width, height: canvas.height, frameRate: settings.fps, quality })) {
        throw new Error(`H.264 encoding at ${canvas.width} × ${canvas.height}, ${settings.fps}fps is unavailable. Try a smaller size or lower quality, or open the studio in Chrome.`);
      }
      if (settings.bitrate * settings.duration / 8 > 256 * 1024 * 1024) throw new Error('This export may exceed 256 MB. Choose a shorter duration or lower quality.');
      output = new Output({ format: new Mp4OutputFormat({ fastStart: 'in-memory' }), target: new BufferTarget() });
      videoSource = new CanvasSource(canvas, { codec: 'avc', quality });
      output.addVideoTrack(videoSource, { frameRate: settings.fps });
      if (audioInput) audio = await createAudioExport(audioInput, settings.duration, signal);
      if (audio) output.addAudioTrack(audio.source, { name: 'Original audio' });
      await output.start();
    } else {
      gif = gifWorker(signal); await gif.send('init', { width: canvas.width, height: canvas.height, colors: settings.colors });
    }
    const encodeFrames = async () => { for (let i = 0; i < settings.frames; i++) {
      signal.throwIfAborted();
      const time = i / settings.fps, duration = Math.min(1 / settings.fps, settings.duration - time);
      await renderFrame(time);
      signal.throwIfAborted();
      if (videoSource) await videoSource.add(time, duration, { keyFrame: i % (settings.fps * 2) === 0 });
      else {
        const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data.buffer;
        await gif.send('frame', { pixels, delay: gifFrameDelay(i, settings.fps) }, [pixels]);
      }
      onProgress(Math.min(98, Math.round((i + 1) / settings.frames * 98)), `Encoding ${settings.format.toUpperCase()} · ${i + 1} / ${settings.frames} frames`);
      // Yield to controls and progress updates even for static sources.
      if (i % 3 === 0) await new Promise(resolve => setTimeout(resolve, 0));
    } videoSource?.close(); };
    await Promise.all([encodeFrames(), audio?.pump()]);
    signal.throwIfAborted(); onProgress(99, 'Finalizing file…');
    let blob;
    if (output) { await output.finalize(); blob = new Blob([output.target.buffer], { type: 'video/mp4' }); }
    else blob = new Blob([await gif.send('finish')], { type: 'image/gif' });
    signal.throwIfAborted(); onProgress(100, 'Export ready'); return blob;
  } finally {
    gif?.close();
    if (output && output.state !== 'finalized' && output.state !== 'canceled') await output.cancel().catch(() => {});
    audio?.close();
  }
}
