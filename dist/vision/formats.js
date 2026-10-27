export const RATIOS = [
  ['original', 'Original'], ['1:1', '1:1 · Square'], ['4:5', '4:5 · Portrait'],
  ['3:4', '3:4 · Portrait'], ['2:3', '2:3 · Portrait'], ['9:16', '9:16 · Story'],
  ['16:9', '16:9 · Widescreen'], ['4:3', '4:3 · Landscape'], ['3:2', '3:2 · Landscape'],
];
export function aspectRatio(value, width, height) {
  if (value === 'original') return width / height;
  const pair = RATIOS.find(item => item[0] === value)?.[0].split(':').map(Number);
  return pair ? pair[0] / pair[1] : width / height;
}
export function outputSize(source, framing, longEdge = 'source') {
  const aspect = aspectRatio(framing.ratio, source.width, source.height);
  const desired = longEdge === 'source' ? Math.max(source.width, source.height) : Number(longEdge);
  // Keep very large imports within a predictable browser canvas memory budget.
  const edge = Math.max(1, Math.min(Number.isFinite(desired) ? desired : 1920, 8192, Math.sqrt(24_000_000 * Math.max(aspect, 1 / aspect))));
  return aspect >= 1 ? { width: Math.max(1, Math.round(edge)), height: Math.max(1, Math.round(edge / aspect)) } : { width: Math.max(1, Math.round(edge * aspect)), height: Math.max(1, Math.round(edge)) };
}
export function previewSize(size, maxEdge = 1600) {
  const scale = Math.min(1, maxEdge / Math.max(size.width, size.height));
  return { width: Math.max(1, Math.round(size.width * scale)), height: Math.max(1, Math.round(size.height * scale)) };
}
export function exportName(name, size, format, tool = 'vision') {
  const base = name.replace(/\.[^.]+$/, '').replace(/[^\p{L}\p{N}._-]+/gu, '-').slice(0, 100) || 'image';
  const extension = { png: 'png', jpeg: 'jpg', mp4: 'mp4', gif: 'gif' }[format] || 'png';
  return `${base}-${tool === 'particles' ? 'particle-flow' : 'vision'}-${size.width}x${size.height}.${extension}`;
}
export function timeLabel(seconds) {
  const value = Math.max(0, Number.isFinite(seconds) ? seconds : 0);
  return `${Math.floor(value / 60).toString().padStart(2, '0')}:${Math.floor(value % 60).toString().padStart(2, '0')}`;
}
