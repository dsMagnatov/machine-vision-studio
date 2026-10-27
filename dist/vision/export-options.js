export const ANIMATED_FORMATS = ['mp4', 'gif'];
export const QUALITIES = {
  mp4: [
    { id: 'maximum', label: 'Maximum', fps: 60, bitrate: 32_000_000 },
    { id: 'high', label: 'High', fps: 60, bitrate: 16_000_000 },
    { id: 'medium', label: 'Medium', fps: 30, bitrate: 8_000_000 },
    { id: 'low', label: 'Low', fps: 24, bitrate: 4_000_000 },
  ],
  gif: [
    { id: 'maximum', label: 'Maximum', fps: 30, colors: 256 },
    { id: 'high', label: 'High', fps: 24, colors: 256 },
    { id: 'medium', label: 'Medium', fps: 15, colors: 128 },
    { id: 'low', label: 'Low', fps: 10, colors: 64 },
  ],
};
export function animationSettings(output, source) {
  const format = ANIMATED_FORMATS.includes(output.format) ? output.format : 'mp4';
  const quality = QUALITIES[format].find(q => q.id === output.quality) || QUALITIES[format][2];
  const fullVideo = format === 'mp4' && output.fullVideo && source?.kind === 'video' && Number.isFinite(source.duration);
  const requested = fullVideo ? source.duration : Number(format === 'gif' ? output.gifDuration : output.duration);
  const limit = format === 'gif' ? 20 : fullVideo ? Infinity : 120;
  const duration = Math.max(.1, Math.min(limit, Number.isFinite(requested) ? requested : format === 'gif' ? 2 : 5));
  return { ...quality, format, duration, frames: Math.max(1, Math.ceil(duration * quality.fps)) };
}
export function encodingSize(size, format) {
  if (!ANIMATED_FORMATS.includes(format)) return size;
  const maxEdge = format === 'gif' ? 1280 : 3840;
  const scale = Math.min(1, maxEdge / Math.max(size.width, size.height));
  const round = value => format === 'mp4' ? Math.max(2, Math.round(value / 2) * 2) : Math.max(1, Math.round(value));
  return { width: round(size.width * scale), height: round(size.height * scale) };
}
export const qualityDescription = (format, quality) => format === 'mp4' ? `${quality.fps}fps, ${quality.bitrate / 1_000_000}Mbps` : `${quality.fps}fps, ${quality.colors} colors`;
export const gifFrameDelay = (frame, fps) => (Math.round((frame + 1) * 100 / fps) - Math.round(frame * 100 / fps)) * 10;
