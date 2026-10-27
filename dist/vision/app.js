import { VisionRenderer, normalize, defaults } from './engine.js';
import { BASE_CONFIG } from './preset.js';
import { createUI } from './ui.js';
import { loadMedia } from './media.js';
import { RATIOS, outputSize, previewSize, exportName } from './formats.js';
import { ANIMATED_FORMATS, animationSettings, encodingSize } from './export-options.js';
import { encodeAnimation } from './animation-export.js';
import { createFrameReader } from './video-frames.js';
import { ParticleRenderer } from './particle-engine.js';
import { particleDefaults, normalizeParticles, sourceSeed, particlePair, particleConfigAt, FLOW_PARAMETERS } from './particle-model.js';
import { DepthEstimator } from './depth-model.js';
import { loadStarterMedia } from './starter-media.js';

const clone = value => JSON.parse(JSON.stringify(value));
const sources = new Map();
let selectedID = null, loading = false, exporting = false, zoneEditing = false;
let activeTool = 'vision', particleClock = 0, particleAnchor = 0, particleTransition = null, burstStart = -100, lightStart = -100, particleDemoID = null;
const toolSelections = { vision: null, particles: null };
let lastClock = null, lastPaint = -Infinity, dirty = true, importQueue = Promise.resolve(), lastExportURL = null;
const output = { format: 'png', longEdge: 'source', quality: 'medium', duration: 5, gifDuration: 2, fullVideo: false, start: 'beginning' };
let exportController = null;
const emptyFraming = () => ({ ratio: 'original', fit: 'cover', x: .5, y: .5 });
const selected = () => sources.get(selectedID);
const ui = createUI(action);
const renderer = new VisionRenderer(ui.canvas);
let particleRenderer = null;
const depthEstimator = new DepthEstimator();
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const activeConfig = source => activeTool === 'particles' ? source.particleConfig : source.config;
const needsDepth = config => config.depthMode !== 'extrude';
function particleItems(source) {
  if (source.kind === 'video') return [source];
  return [source, ...[...sources.values()].filter(other => other !== source && other.kind === 'image' && !other.isVisionDemo && (source.isParticleDemo || !other.isParticleDemo))].slice(0,4);
}
function ensureDepth(source, force = false) {
  if (!source || !sources.has(source.id)) return Promise.resolve(null);
  if (source.depthPending) return source.depthPending;
  if (source.depthMap?.model==='Sphere' || !force && (source.depthMap || source.depthError)) return Promise.resolve(source.depthMap);
  source.depthError = null; source.depthState = source.depthMap ? 'Updating depth…' : 'Analysing AI depth…';
  source.depthAttempt = performance.now(); source.depthMediaTime = source.media.currentTime || 0;
  source.depthPending = depthEstimator.estimate(source.media, source.kind === 'video' ? source.depthMap?.range : null).then(map => {
    if (!sources.has(source.id)) return null;
    source.depthMap = map; source.depthState = 'AI depth ready · on device'; dirty = true; return map;
  }).catch(error => {
    source.depthError = error.message; source.depthState = 'Depth unavailable · retry';
    console.error('Depth inference:', error); return source.depthMap || null;
  }).finally(() => { source.depthPending = null; if (sources.has(source.id)) renderUI(); });
  renderUI(); return source.depthPending;
}

async function switchTool(tool) {
  if (!['vision','particles'].includes(tool) || tool === activeTool) return;
  toolSelections[activeTool] = selectedID; activeTool = tool; zoneEditing = false; particleTransition = null;
  const remembered = toolSelections[tool];
  const particleDefault=sources.has(particleDemoID)?particleDemoID:[...sources.values()].find(item=>item.isParticleDemo)?.id;
  const target=remembered&&sources.has(remembered)?remembered:tool==='particles'&&selected()?.isVisionDemo?particleDefault:null;
  if(target)choose(target,false);
  else { dirty = true; lastClock = null; syncPlayback(); renderUI(); }
}

async function loadDefaults() {
  loading=true;renderUI();
  try {
    const results=await loadStarterMedia(),errors=[];
    for(const result of results){
      if(result.status==='fulfilled'){
        const source=addSource(result.value,{select:false});
        if(source.starterKey==='logo')particleDemoID=source.id;
      }else errors.push(result.reason?.message||'A starter image could not be opened.');
    }
    if(!selectedID){const target=activeTool==='particles'&&sources.has(particleDemoID)?particleDemoID:sources.keys().next().value;if(target)choose(target,false);}
    if(errors.length)ui.status(errors.join(' '),true);
  }finally{loading=false;renderUI();}
}

function renderUI() {
  const source = selected();
  ui.render({
    sources: [...sources.values()].map(({ id, name, kind, width, height, thumbnail, media }) => ({ id, name, kind, width, height, thumbnail, duration: kind === 'video' ? media.duration : 0 })),
    selected: selectedID, tool: activeTool,
    depthState: source?.particleConfig.depthMode==='extrude'?'Extruded flow · ready':source?.depthMap?.model==='Sphere'?'3D sphere · ready':source?.depthState || 'AI depth · waiting for a picture', depthError: source?.particleConfig.depthMode!=='extrude' && Boolean(source?.depthError),
    ready: Boolean(source), loading, exporting, zoneEditing,
    config: source ? activeConfig(source) : activeTool === 'particles' ? particleDefaults() : normalize(BASE_CONFIG),
    framing: source?.framing || emptyFraming(), output,
    size: source ? encodingSize(outputSize(source, source.framing, output.longEdge), output.format) : { width: 0, height: 0 },
  });
  updatePlaybackUI();
}
function updatePlaybackUI() {
  const source = selected();
  if (source?.kind === 'video') ui.playback({ playing: !source.media.paused, currentTime: source.media.currentTime, duration: source.media.duration });
}
function syncPlayback() {
  const current = selected();
  for (const source of sources.values()) {
    if (source.kind !== 'video') continue;
    const usedAsTexture = activeTool === 'vision' && current?.config.enabled && current.config.texture === source.id;
    const active = !exporting && !document.hidden && (source === current && source.playingWanted || usedAsTexture && source !== current);
    if (active && source.media.paused && !source.playPending) {
      source.playPending = true;
      source.media.play().catch(error => {
        if (source === selected() && !exporting && source.playingWanted && error.name !== 'AbortError') {
          source.playingWanted = false;
          ui.status('Video playback was paused by the browser. Press Play below the preview to start it.', true);
        }
      }).finally(() => { source.playPending = false; updatePlaybackUI(); });
    }
    else if (!active && !source.media.paused) source.media.pause();
  }
}
function choose(id, transition = true) {
  if (!sources.has(id)) return;
  const previous=selected();
  if(activeTool==='particles'){particleTransition=transition&&sources.get(id).particleConfig.animate&&previous?.id!==id?previous:null;particleAnchor=particleClock;burstStart=-100;}
  selectedID = id; zoneEditing = false; dirty = true; lastClock = null;
  toolSelections[activeTool]=id;
  syncPlayback(); renderUI();
  if(activeTool==='particles'&&needsDepth(selected().particleConfig))ensureDepth(selected());
}
function addSource(data, { select = true } = {}) {
  const source = {
    ...data, id: crypto.randomUUID(), config: normalize(clone(BASE_CONFIG)), particleConfig: normalizeParticles({...particleDefaults(),...data.particleOverrides}),
    framing: emptyFraming(), phase: 0, version: 1, playingWanted: true, lastMediaTime: -1,
  };
  if (reducedMotion) source.config.animate = false;
  if (reducedMotion) source.particleConfig.animate = false;
  sources.set(source.id, source);
  if (source.kind === 'video') {
    source.media.addEventListener('seeked', () => { source.version++; dirty = true; updatePlaybackUI(); });
    for (const event of ['play', 'pause', 'durationchange', 'timeupdate']) source.media.addEventListener(event, updatePlaybackUI);
    source.media.addEventListener('error', () => { if (selected() === source) ui.status('The video could not be decoded. Try an MP4 (H.264) or WebM file.', true); });
    if (source.media.requestVideoFrameCallback) {
      const decodedFrame = () => {
        if (!sources.has(source.id)) return;
        if (source === selected()) dirty = true;
        source.videoFrameCallback = source.media.requestVideoFrameCallback(decodedFrame);
      };
      source.videoFrameCallback = source.media.requestVideoFrameCallback(decodedFrame);
    }
  }
  if (select) choose(source.id); else renderUI();
  return source;
}
async function importFiles(files) {
  if (!files.length) return;
  loading = true; renderUI();
  let imported = 0; const errors = [];
  for (const file of files) {
    try { addSource(await loadMedia({ file })); imported++; }
    catch (error) { errors.push(`${file.name}: ${error.message}`); }
  }
  loading = false; renderUI();
  if (errors.length) ui.status(errors.join(' '), true);
  else if (imported) ui.status(`${imported} file${imported === 1 ? '' : 's'} added.`, false);
}
function setConfig(patch) {
  const source = selected(); if (!source) return;
  if(activeTool==='particles'){
    const from=particleConfigAt(source.particleConfig,source.particleTween,particleClock);
    source.particleConfig=normalizeParticles({...source.particleConfig,...patch});
    if(source.particleConfig.animate && FLOW_PARAMETERS.some(key=>key in patch))source.particleTween={from:{...from},start:particleClock,duration:.18+source.particleConfig.transitionSoftness*.6};
    else if(!source.particleConfig.animate)source.particleTween=null;
  }
  else {source.config = normalize({ ...source.config, ...patch });source.version++;}
  dirty = true; syncPlayback(); renderUI();
}
function applyPreset(id) {
  const config = clone(BASE_CONFIG);
  if (id === 'detection') Object.assign(config, { chainEnabled: false, frameEnabled: false, texture: 'none' });
  if (id === 'geometry') Object.assign(config, { detection: false, connections: false, frameEnabled: true, chainEnabled: true, texture: 'none' });
  if (id === 'minimal') Object.assign(config, { chainEnabled: false, frameEnabled: false, texture: 'none', connections: false, maxCircles: 35, minRadius: 5, maxRadius: 16, labels: false, stroke: .8, overlayOpacity: .85 });
  const source = selected(); if (!source) return;
  source.phase = 0; zoneEditing = false; setConfig(config);
}
function removeSource(id) {
  const source = sources.get(id); if (!source) return;
  sources.delete(id);
  particleRenderer?.release(source.media);
  if(particleTransition?.id===id)particleTransition=null;
  if (source.videoFrameCallback !== undefined) source.media.cancelVideoFrameCallback?.(source.videoFrameCallback);
  for (const other of sources.values()) if (other.config.texture === id) { other.config.texture = 'none'; other.version++; }
  source.destroy();
  if (selectedID === id) { const remaining=[...sources.values()];selectedID=(activeTool==='particles'?remaining.find(item=>!item.isVisionDemo):remaining[0])?.id || remaining[0]?.id || null; zoneEditing = false; lastClock = null; }
  dirty = true; syncPlayback(); renderUI();
}
function renderInto(source, target, size, clock, options = {}) {
  const tool=source.tool || activeTool;
  let c = source.tool ? source.config : activeConfig(source);
  if(tool==='particles'){
    const time=options.phase ?? particleClock,items=source.particleSequence || particleItems(source);
    c=particleConfigAt(c,source.particleTween,time);
    const pair=particlePair(items,c,time,source.particleAnchor ?? particleAnchor,source.tool ? source.particleTransition : particleTransition);
    const mediaFor=record=>record.id===source.id ? options.media || source.media : record.media;
    return target.render(mediaFor(pair.from),c,size.width,size.height,time,{
      dynamic:pair.from.kind==='video',version:pair.from.version,fit:source.framing.fit,position:`${source.framing.x*100}% ${source.framing.y*100}%`,
      nextMedia:mediaFor(pair.to),nextDynamic:pair.to.kind==='video',nextVersion:pair.to.version,seed:sourceSeed(pair.from.id),nextSeed:sourceSeed(pair.to.id),progress:pair.progress,
      depthMap:pair.from.depthMap,nextDepthMap:pair.to.depthMap,
      burstStart:source.tool ? source.burstStart : burstStart,lightStart:source.tool ? source.lightStart : lightStart,
    });
  }
  const config = c.enabled ? c : { ...defaults(), imageOpacity: 1, background: c.background, detection: false, connections: false, chainEnabled: false, frameEnabled: false, frameText: false, scanLine: false, texture: 'none', zones: [], animate: false };
  const texture = sources.get(config.texture);
  return target.render(options.media || source.media, config, size.width, size.height, options.phase ?? source.phase, {
    dynamic: source.kind === 'video', version: source.version,
    textureMedia: options.textureMedia || texture?.media,
    fit: source.framing.fit, position: `${source.framing.x * 100}% ${source.framing.y * 100}%`, clock,
  });
}
async function exportImage() {
  const source = selected(); if (!source || exporting) return;
  if (source.kind === 'video' && source.media.seeking) { ui.status('Wait for the video frame to finish seeking, then export again.', true); return; }
  const size = encodingSize(outputSize(source, source.framing, output.longEdge), output.format);
  const format = output.format, filename = exportName(source.name, size, format, activeTool);
  const snapshot = { ...source, tool:activeTool,config: clone(activeConfig(source)), framing: clone(source.framing),phase:activeTool==='particles'?particleClock:source.phase,
    particleSequence:particleItems(source),particleAnchor,particleTransition,burstStart,lightStart };
  const settings = animationSettings(output, { ...source, duration: source.kind === 'video' ? source.media.duration : 0 });
  const start = format === 'mp4' && output.fullVideo || output.start === 'beginning' ? 0 : source.media.currentTime || 0;
  exporting = true; exportController = new AbortController(); syncPlayback(); renderUI(); ui.progress(0, 'Preparing export…');
  const canvas = document.createElement('canvas');let pass;
  const readers = [];
  try {
    if(snapshot.tool==='particles' && snapshot.config.enabled && needsDepth(snapshot.config)){
      ui.progress(0,'Preparing AI depth…');
      const sequence=snapshot.config.cycle?snapshot.particleSequence:[source,particleTransition].filter(Boolean);
      for(const item of sequence){
        const map=await ensureDepth(item);if(!map)throw new Error(item.depthError||'AI depth is not ready. Retry depth analysis.');
        exportController.signal.throwIfAborted();
        if(item.id===source.id)snapshot.depthMap=map;
      }
      snapshot.particleSequence=snapshot.particleSequence.map(item=>item.id===source.id?snapshot:item);
    }
    pass=activeTool==='particles'?new ParticleRenderer(canvas):new VisionRenderer(canvas);
    let blob;
    if (ANIMATED_FORMATS.includes(format)) {
      canvas.width = size.width; canvas.height = size.height;
      let media = source.media, textureMedia = activeTool==='vision'?sources.get(source.config.texture)?.media:null;
      const signal = exportController.signal;
      const reader = source.kind === 'video' ? await createFrameReader(source, settings, signal, start) : null;
      if (reader) readers.push(reader);
      const textureSource = activeTool==='vision'?sources.get(source.config.texture):null;
      const textureReader = textureSource?.kind === 'video' && textureSource !== source ? await createFrameReader(textureSource, settings, signal) : null;
      if (textureReader) readers.push(textureReader);
      const audioInput = format === 'mp4' && source.kind === 'video' ? { file: source.file, sourceDuration: source.media.duration, start } : null;
      let depthFrame = -Infinity;
      blob = await encodeAnimation({ canvas, settings, signal, audioInput, onProgress: ui.progress, renderFrame: async time => {
        if (reader) media = await reader.frame(time);
        if(reader && snapshot.tool==='particles' && snapshot.config.enabled && needsDepth(snapshot.config) && time-depthFrame>=.2){snapshot.depthMap=await depthEstimator.estimate(media,snapshot.depthMap?.range);depthFrame=time;}
        if (textureSource === source) textureMedia = media;
        else if (textureReader) textureMedia = await textureReader.frame(time);
        if (!renderInto(snapshot, pass, size, time, { media, textureMedia, phase: snapshot.phase + time })) throw new Error('The source frame is not ready.');
      } });
    } else {
      if (!renderInto(snapshot, pass, size, performance.now() / 1000)) throw new Error('The source is not ready.');
      blob = await new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('The browser could not create the image.')), format === 'jpeg' ? 'image/jpeg' : 'image/png', .95));
    }
    if (lastExportURL) URL.revokeObjectURL(lastExportURL);
    const url = lastExportURL = URL.createObjectURL(blob), anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; document.body.append(anchor);
    ui.showDownload(url, filename, blob.size, format); anchor.click(); anchor.remove();
    ui.status(`Export ready · ${filename}`);
  } catch (error) {
    if (error.name === 'AbortError') ui.status('Export canceled.');
    else { console.error('Media export:', error); ui.status(`Export failed: ${error.message}`, true); }
  } finally {
    for (const reader of readers) reader.close(); pass?.destroy(); canvas.width = canvas.height = 1;
    exporting = false; exportController = null; lastClock = null; dirty = true; syncPlayback(); renderUI();
  }
}
function action(type, value) {
  const source = selected();
  if (type === 'cancel-export') { exportController?.abort(new DOMException('Export canceled', 'AbortError')); return; }
  if (exporting) return;
  if(type==='tool'){switchTool(value).catch(error=>ui.status(error.message,true));return;}
  if (type === 'import') { importQueue = importQueue.then(() => importFiles(value)).catch(error => { loading = false; renderUI(); ui.status(error.message, true); }); return; }
  if (type === 'target') { choose(value); return; }
  if (type === 'remove') { removeSource(value); return; }
  if (type === 'output') {
    if (['png','jpeg','gif','mp4'].includes(value.format)) output.format = value.format;
    if (['source','480','640','720','1080','1920','2560','3840'].includes(value.longEdge)) output.longEdge = value.longEdge;
    if (['maximum','high','medium','low'].includes(value.quality)) output.quality = value.quality;
    for (const key of ['duration','gifDuration']) if (Number.isFinite(Number(value[key]))) output[key] = Math.max(.1, Math.min(key === 'gifDuration' ? 20 : 120, Number(value[key])));
    if (typeof value.fullVideo === 'boolean') output.fullVideo = value.fullVideo;
    if (['beginning','current'].includes(value.start)) output.start = value.start;
    dirty = true; renderUI(); return;
  }
  if (!source) return;
  if(type==='particle-next'){
    source.particleConfig.animate=true;const items=particleItems(source);
    if(items.length>1){items[1].particleConfig.animate=true;choose(items[1].id);}else{burstStart=particleClock;dirty=true;renderUI();}return;
  }
  if(type==='particle-burst'){burstStart=particleClock;source.particleConfig.animate=true;dirty=true;renderUI();return;}
  if(type==='particle-light'){lightStart=particleClock;source.particleConfig.animate=true;dirty=true;renderUI();return;}
  if(type==='particle-depth'){ensureDepth(source,true);return;}
  if(type==='particle-camera'){setConfig(value);return;}
  if(type==='particle-home'){setConfig({yaw:-12,pitch:5,cameraZoom:1});return;}
  if(type==='particle-preset'){
    const preset={...particleDefaults(),...source.particleOverrides,...(value==='sculpture'?{drift:0,relief:1.4,yaw:-25,pitch:8}:value==='smoke'?{drift:1.6,splash:1.2,gather:.35,trails:true,pointSize:.7}:value==='source'?{sourceColors:true,cutoff:.01,exposure:1.3}:{})};
    setConfig(preset);return;
  }
  if (type === 'config') setConfig({ [value.key]: value.value, enabled: true });
  else if (type === 'enabled') setConfig({ enabled: value });
  else if (type === 'reset') { source.phase = 0; zoneEditing = false; if(activeTool==='particles'){burstStart=lightStart=-100;particleAnchor=particleClock;particleTransition=null;setConfig({...particleDefaults(),...source.particleOverrides});}else setConfig(clone(BASE_CONFIG));ui.status('Base effect restored.'); }
  else if (type === 'preset') applyPreset(value);
  else if (type === 'framing') {
    if (RATIOS.some(item => item[0] === value.ratio)) source.framing.ratio = value.ratio;
    if (['cover','contain'].includes(value.fit)) source.framing.fit = value.fit;
    for (const key of ['x','y']) if (Number.isFinite(value[key])) source.framing[key] = Math.max(0, Math.min(1, value[key]));
    source.version++; dirty = true; renderUI();
  }
  else if (type === 'zone-edit') { zoneEditing = !zoneEditing; renderUI(); if (zoneEditing) ui.status('Click the image to place a pixelation zone. Escape finishes editing.'); }
  else if (type === 'zone-add' && source.config.zones.length < 24) setConfig({ zones: [...source.config.zones, value], enabled: true });
  else if (type === 'zone-undo') setConfig({ zones: source.config.zones.slice(0, -1) });
  else if (type === 'zone-clear') setConfig({ zones: [] });
  else if (type === 'playback' && source.kind === 'video') { source.playingWanted = source.media.paused; syncPlayback(); updatePlaybackUI(); }
  else if (type === 'seek' && source.kind === 'video' && Number.isFinite(source.media.duration)) { source.media.currentTime = Math.max(0, Math.min(source.media.duration, value)); dirty = true; updatePlaybackUI(); }
  else if (type === 'export') exportImage();
}
function tick(now) {
  requestAnimationFrame(tick);
  const source = selected();
  if (!source || document.hidden || exporting) { lastClock = null; return; }
  const elapsed = lastClock === null ? 0 : Math.min(.12, (now - lastClock) / 1000); lastClock = now;
  const config=activeConfig(source);
  if(activeTool==='particles' && config.enabled && needsDepth(config)){
    const items=config.cycle?particleItems(source):[source,particleTransition].filter(Boolean);
    for(const item of items)ensureDepth(item);
    if(source.kind==='video'&&!source.depthPending&&!source.depthError&&now-(source.depthAttempt||0)>800&&Math.abs(source.media.currentTime-(source.depthMediaTime||0))>.25)ensureDepth(source,true);
  }
  if (config.animate && config.enabled) {if(activeTool==='particles')particleClock+=elapsed;else source.phase+=elapsed;}
  const texture = activeTool==='vision'?sources.get(source.config.texture):null;
  const videoChanged = source.kind === 'video' && source.media.currentTime !== source.lastMediaTime;
  const animated = config.enabled && config.animate || texture?.kind === 'video' && !texture.media.paused;
  if (!dirty && !videoChanged && !animated || now - lastPaint < 1000 / (activeTool==='particles'?60:24)) return;
  try {
    let size = previewSize(encodingSize(outputSize(source, source.framing, output.longEdge), output.format));
    // Particle annotations should stay crisp even when the input or chosen
    // export size is smaller than the canvas displayed in the workspace.
    if(activeTool==='particles'){const upscale=Math.max(1,1280/Math.max(size.width,size.height));size={width:Math.round(size.width*upscale),height:Math.round(size.height*upscale)};}
    if(activeTool==='particles'&&!particleRenderer)particleRenderer=new ParticleRenderer(ui.canvas);
    if (renderInto(source, activeTool==='particles'?particleRenderer:renderer, size, now / 1000)) {
      ui.canvas.dataset.renderer=activeTool;
      source.lastMediaTime = source.kind === 'video' ? source.media.currentTime : 0;
      ui.canvas.dataset.sourceName = source.name; ui.canvas.dataset.sourceKind = source.kind;
      ui.canvas.dataset.videoTime = source.kind === 'video' ? String(source.media.currentTime) : '';
      dirty = false; lastPaint = now;
    }
    updatePlaybackUI();
  } catch (error) {
    // A failed frame does not replace the last valid preview or remove an imported file.
    config.animate = false; source.playingWanted = false; syncPlayback(); dirty = false; lastPaint = now;
    console.error('Vision render:', error); ui.status('This frame could not be processed. Try another source or reset the effect.', true);
  }
}
document.addEventListener('visibilitychange', () => { lastClock = null; dirty = true; syncPlayback(); });
window.addEventListener('beforeunload', () => { depthEstimator.destroy(); for (const source of sources.values()) source.destroy(); renderer.destroy(); particleRenderer?.destroy(); if (lastExportURL) URL.revokeObjectURL(lastExportURL); });
renderUI(); requestAnimationFrame(tick);
importQueue=loadDefaults().catch(error=>ui.status(error.message,true));
