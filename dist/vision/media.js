const imageTypes = /^(image\/(png|jpeg|webp|gif|bmp|avif|x-ms-bmp))$/i;
const imageNames = /\.(png|jpe?g|webp|gif|bmp|avif)$/i;
const videoTypes = /^video\//i;
const videoNames = /\.(mp4|webm|mov|m4v|ogv|ogg)$/i;
export const ACCEPT = 'image/png,image/jpeg,image/webp,image/gif,image/bmp,image/avif,video/mp4,video/webm,video/ogg,video/quicktime,.m4v,.mov';
export function mediaKind(file) {
  if (/svg/i.test(file.type) || /\.svgz?$/i.test(file.name)) throw new Error('Use a raster image: PNG, JPG, WebP, GIF, BMP, or AVIF.');
  if (videoTypes.test(file.type) || videoNames.test(file.name)) return 'video';
  if (imageTypes.test(file.type) || imageNames.test(file.name)) return 'image';
  throw new Error('Choose a raster image or a video file.');
}
export async function loadMedia({ file, url, name = 'Demo gradient.jpg', signal }) {
  signal?.throwIfAborted();
  const kind = file ? mediaKind(file) : 'image';
  const objectURL = file ? URL.createObjectURL(file) : null;
  const media = document.createElement(kind === 'video' ? 'video' : 'img');
  if (kind === 'video') {
    media.defaultMuted = media.muted = true; media.setAttribute('muted', ''); media.loop = true; media.playsInline = true; media.preload = 'auto'; media.tabIndex = -1;
    // Keep decoder-backed media attached: embedded browsers can suspend detached video elements.
    let depot = document.querySelector('.media-depot');
    if (!depot) { depot = document.createElement('div'); depot.className = 'media-depot'; depot.setAttribute('aria-hidden', 'true'); document.body.append(depot); }
    depot.append(media);
  }
  else media.decoding = 'async';
  const destroy = () => {
    if (kind === 'video') media.pause();
    media.removeAttribute('src');
    if (kind === 'video') media.load();
    media.remove();
    if (objectURL) URL.revokeObjectURL(objectURL);
  };
  try {
    await new Promise((resolve, reject) => {
      const event = kind === 'video' ? 'loadeddata' : 'load';
      const cleanup = () => { clearTimeout(timer); media.removeEventListener(event, loaded); media.removeEventListener('error', failed); signal?.removeEventListener('abort', aborted); };
      const loaded = () => { cleanup(); resolve(); };
      const failed = () => { cleanup(); reject(new Error(kind === 'video' ? 'This video cannot be decoded. Try an MP4 (H.264) or WebM file.' : 'This image cannot be opened. Try PNG, JPG, or WebP.')); };
      const aborted = () => { cleanup(); reject(signal.reason); };
      const timer = setTimeout(() => { cleanup(); reject(new Error('The file took too long to open. Try a smaller file.')); }, 30000);
      media.addEventListener(event, loaded, { once: true }); media.addEventListener('error', failed, { once: true });
      signal?.addEventListener('abort', aborted, { once: true });
      media.src = objectURL || url;
    });
    const width = media.videoWidth || media.naturalWidth, height = media.videoHeight || media.naturalHeight;
    if (!width || !height) throw new Error('The file has no readable image frames.');
    const thumb = document.createElement('canvas'); thumb.width = 96; thumb.height = Math.max(1, Math.round(96 * height / width));
    // Thumbnails stay bounded even for unusually tall imports.
    if (thumb.height > 160) { thumb.width = Math.max(1, Math.round(96 * 160 / thumb.height)); thumb.height = 160; }
    thumb.getContext('2d').drawImage(media, 0, 0, thumb.width, thumb.height);
    const thumbnail = thumb.toDataURL('image/jpeg', .7);
    return { media, kind, width, height, thumbnail, file, name: file?.name || name, destroy };
  } catch (error) { destroy(); throw error; }
}

export async function seekVideo(media, time, signal) {
  signal?.throwIfAborted();
  const target = Math.max(0, Math.min(Number.isFinite(media.duration) ? Math.max(0, media.duration - .0001) : time, time));
  if (Math.abs(media.currentTime - target) < .0001 && media.readyState >= 2 && !media.seeking) return;
  await new Promise((resolve, reject) => {
    const cleanup = () => { clearTimeout(timer); media.removeEventListener('seeked', loaded); media.removeEventListener('error', failed); signal?.removeEventListener('abort', aborted); };
    const loaded = () => { cleanup(); resolve(); };
    const failed = () => { cleanup(); reject(new Error('The video frame could not be decoded.')); };
    const aborted = () => { cleanup(); reject(signal.reason); };
    const timer = setTimeout(() => { cleanup(); reject(new Error('Timed out while decoding a video frame.')); }, 15000);
    media.addEventListener('seeked', loaded, { once: true }); media.addEventListener('error', failed, { once: true }); signal?.addEventListener('abort', aborted, { once: true });
    try { media.currentTime = target; } catch (error) { cleanup(); reject(error); }
  });
}
