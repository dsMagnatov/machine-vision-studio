import { GIFEncoder, quantize, applyPalette } from '../vendor/gifenc.js';
let encoder, width, height, colors;
self.onmessage = event => {
  const { id, type, data } = event.data;
  try {
    if (type === 'init') {
      ({ width, height, colors } = data); encoder = GIFEncoder(); self.postMessage({ id });
    } else if (type === 'frame') {
      const rgba = new Uint8Array(data.pixels), palette = quantize(rgba, colors);
      encoder.writeFrame(applyPalette(rgba, palette), width, height, { palette, delay: data.delay, repeat: 0, dispose: 1 });
      if (encoder.bytesView().byteLength > 256 * 1024 * 1024) throw new Error('The GIF is too large. Choose a shorter duration or smaller image size.');
      self.postMessage({ id });
    } else if (type === 'finish') {
      encoder.finish(); const bytes = encoder.bytes(); self.postMessage({ id, data: bytes.buffer }, [bytes.buffer]); encoder = null;
    }
  } catch (error) { self.postMessage({ id, error: error.message }); }
};
