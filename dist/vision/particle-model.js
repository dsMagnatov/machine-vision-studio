import { cloudPosition,projectParticle,transitionDuration,softer } from './particle-motion.js';
const range = (key, label, min, max, step, value, unit = '') => ({ key, label, type: 'range', min, max, step, default: value, unit });
const toggle = (key, label, value) => ({ key, label, type: 'toggle', default: value });
const color = (key, label) => ({ key, label, type: 'color', default: 'auto' });
const select = (key, label, options, value) => ({ key, label, type: 'select', options: options.map(([value, label]) => ({ value, label })), default: value });
export const PARTICLE_GROUPS = [
  { id: 'cloud', label: 'Point cloud', open: true, controls: [
    select('density', 'Particles', [['32768','32,768'],['65536','65,536'],['131072','131,072'],['262144','262,144'],['524288','524,288']], '524288'),
    range('pointSize', 'Point size', .4, 3, .1, 1.1, 'px'), range('relief', 'Depth', 0, 2, .05, 1.1),
    select('depthMode', 'Depth geometry', [['extrude','Solid extrusion'],['volume','AI volume'],['surface','AI surface']], 'extrude'),
    range('depthStretch', 'Depth stretch', .25, 3, .05, 1, '×'), range('cloudThickness', 'Interior fill', 0, .5, .01, .07),
    range('depthSmoothing', 'Depth smoothing', 0, 1, .05, .65), range('saturation', 'Image saturation', 0, 2, .05, 1),
    range('exposure', 'Exposure', .3, 3, .05, 1), range('contrast', 'Contrast', .2, 3, .05, 1),
    range('cutoff', 'Dark cutoff', 0, .8, .01, .01), toggle('invert', 'Invert luminance', false), toggle('sourceColors', 'Source colors', true),
    select('paper', 'Paper', [['dark','Black'],['light','White']], 'dark'),
  ] },
  { id: 'particle-motion', label: 'Motion & gathering', open: true, controls: [
    toggle('animate', 'Animate', true),
    range('splash', 'Splash', .1, 2, .02, .7), range('gather', 'Gather speed', .1, 2, .01, .65),
    range('transitionSoftness', 'Transition softness', 0, 1, .05, .8),
    select('travel', 'Travel', [['swarm','Swarm'],['melt','Melt']], 'swarm'),
    toggle('cycle', 'Cycle pictures', false), range('hold', 'Picture hold', 1, 12, .5, 3, 's'),
  ] },
  { id: 'particle-drift', label: 'Drift & dispersion', open: true, controls: [
    range('drift', 'Drift', 0, 2, .02, .8), range('driftSoftness', 'Edge softness', .05, 1, .05, .5),
    range('driftSpread', 'Drift spread', .1, 3, .05, 1), range('driftSpeed', 'Drift speed', .1, 2, .05, .45),
    range('turbulence', 'Turbulence', 0, 1.5, .05, .35),
  ] },
  { id: 'drift-line', label: 'Drift line', controls: [
    range('lineAngle', 'Angle', -180, 180, 1, 0, '°'), range('linePosition', 'Position', -1, 1, .02, 0), toggle('flipSide', 'Flip fading side', false),
  ] },
  { id: 'particle-draw', label: 'Drawing layers', controls: [
    toggle('trackers', 'Trackers', true), select('trackerCount', 'Tracker density', [['8','Sparse'],['24','Dense']], '8'),
    range('trackerSize', 'Tracker size', .6, 2, .05, 1), range('numberSize', 'Number size', 6, 36, 1, 12, 'px'),
    toggle('numberBackground', 'Number background', true),
    color('trackerColor', 'Tracker color'), range('trackerInk', 'Tracker opacity', 0, 1, .05, .95),
    toggle('links', 'Connecting links', true), range('linkWidth', 'Link thickness', .3, 6, .1, .8, 'px'),
    color('linkColor', 'Link color'), range('linkOpacity', 'Link opacity', 0, 1, .05, .46),
    toggle('scan', 'Scan plane', false), toggle('trails', 'Particle trails', false),
  ] },
  { id: 'particle-frame', label: 'Frame & marks', controls: [
    toggle('marks', 'Frame marks', true), color('frameColor', 'Frame color'),
    range('frameSaturation', 'Frame saturation', 0, 2, .05, 1), range('frameOpacity', 'Frame opacity', 0, 1, .05, .35),
  ] },
  { id: 'camera', label: 'Camera', controls: [
    range('yaw', 'Orbit X', -180, 180, 1, -12, '°'), range('pitch', 'Orbit Y', -70, 70, 1, 5, '°'),
    range('cameraZoom', 'Camera zoom', .3, 3, .02, 1, '×'), toggle('autoOrbit', 'Slow orbit', true),
  ] },
];
export function particleDefaults() { return { enabled: true, ...Object.fromEntries(PARTICLE_GROUPS.flatMap(g => g.controls).map(f => [f.key, f.default])) }; }
export function normalizeParticles(input = {}) {
  const output = particleDefaults();
  for (const field of PARTICLE_GROUPS.flatMap(group => group.controls)) {
    const value = input[field.key];
    if (field.type === 'range' && value !== '' && Number.isFinite(Number(value))) output[field.key] = Math.max(field.min, Math.min(field.max, Number(value)));
    else if (field.type === 'toggle' && typeof value === 'boolean') output[field.key] = value;
    else if (field.type === 'select' && field.options.some(option => option.value === String(value))) output[field.key] = String(value);
    else if (field.type === 'color' && typeof value === 'string' && (value === 'auto' || /^#[0-9a-f]{6}$/i.test(value))) output[field.key] = value.toLowerCase();
  }
  output.enabled = input.enabled !== false;
  return output;
}
export function sourceSeed(id) { let hash = 2166136261; for (const char of id) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619); return (hash >>> 0) % 65521; }
export const gatheringDuration = transitionDuration;
export const FLOW_PARAMETERS = ['drift','driftSoftness','driftSpread','driftSpeed','turbulence','relief','depthStretch','cloudThickness','depthSmoothing','splash','gather','transitionSoftness'];
export function particleConfigAt(config,tween,time){
  if(!tween || !config.animate)return config;
  const mix=softer(0,1,(time-tween.start)/tween.duration);if(mix>=1)return config;
  const resolved={...config};for(const key of FLOW_PARAMETERS)resolved[key]=tween.from[key]+(config[key]-tween.from[key])*mix;return resolved;
}
export function particlePair(items, config, time, anchor = 0, transition = null) {
  if (!items.length) return null;
  const elapsed = Math.max(0, time - anchor), duration = gatheringDuration(config);
  if (transition && elapsed < duration) return { from: transition, to: items[0], progress: elapsed / duration };
  if (config.cycle && items.length > 1) {
    const cycle = config.hold + duration, position = elapsed % cycle, index = Math.floor(elapsed / cycle) % items.length;
    return { from: items[index], to: items[(index + 1) % items.length], progress: Math.max(0, (position - config.hold) / duration) };
  }
  return { from: items[0], to: items[0], progress: 0 };
}
export function particlePose(uv, depth, config, aspect, time = 0) {
  const {x,y}=projectParticle(cloudPosition(uv,depth,0,config,aspect),config,aspect,time);return{x,y};
}
