const range = (key, label, min, max, step, value, unit = '') => ({ key, label, type: 'range', min, max, step, default: value, unit });
const toggle = (key, label, value) => ({ key, label, type: 'toggle', default: value });
const select = (key, label, options, value) => ({ key, label, type: 'select', options: options.map(([value, label]) => ({ value, label })), default: value });

export const FIELD_PRESETS = [
  { id: 'code', label: 'ASCII drift', config: {} },
  { id: 'binary', label: 'Binary rain', config: { fieldCharacters: '01', fieldSize: 14, fieldSpacing: 22, fieldAspect: 1.35, fieldSpeed: 80, fieldDirection: 90, fieldColor: '#a7dfba', fieldTrail: .65, fieldFlicker: .25, fieldChangeRate: 5 } },
  { id: 'numbers', label: 'Telemetry', config: { fieldCharacters: '0123456789+-', fieldSize: 11, fieldSpacing: 30, fieldIntensity: .4, fieldSpeed: 15, fieldDirection: 180, fieldColor: '#b9d7ff', fieldChangeRate: 3 } },
  { id: 'pixels', label: 'Pixel dissolve', config: { fieldShape: 'square', fieldSize: 4.5, fieldSpacing: 9, fieldIntensity: .94, fieldMask: 'clouds', fieldThreshold: .43, fieldSoftness: .28, fieldColor: '#f3b9a5', fieldOpacity: .95, fieldSpeed: 8, fieldDirection: 180, fieldTurbulence: 0, fieldFlicker: 0, fieldChangeRate: 0 } },
  { id: 'raster', label: 'Image halftone', config: { fieldShape: 'square', fieldSize: 7, fieldSpacing: 10, fieldIntensity: 1, fieldMask: 'light', fieldThreshold: .25, fieldSoftness: .6, fieldSourceColor: true, fieldSpeed: 0, fieldTurbulence: 0, fieldFlicker: 0 } },
  { id: 'dots', label: 'Soft dot field', config: { fieldShape: 'dot', fieldSize: 4, fieldSpacing: 12, fieldMask: 'clouds', fieldSoftness: .55, fieldColor: '#fffbd9', fieldSpeed: 12, fieldTurbulence: .3 } },
  { id: 'mixed', label: 'Technical mix', config: { fieldShape: 'mixed', fieldCharacters: '+×.:01', fieldSize: 10, fieldSpacing: 26, fieldIntensity: .45, fieldColor: '#cccccc', fieldRotation: 45, fieldTurbulence: .5 } },
];
export const FIELD_GROUPS = [
  { id: 'field', label: 'ASCII / Raster', controls: [
    toggle('fieldEnabled', 'ASCII / Raster layer', false),
    select('fieldPreset', 'Layer preset', [['custom', 'Custom'], ...FIELD_PRESETS.map(p => [p.id, p.label])], 'custom'),
    select('fieldShape', 'Element', [['ascii', 'ASCII symbols'], ['square', 'Pixel squares'], ['dot', 'Dots'], ['cross', 'Crosses'], ['diamond', 'Diamonds'], ['mixed', 'Mixed elements']], 'ascii'),
    { key: 'fieldCharacters', label: 'Symbols', type: 'text', default: '01.:+*<>/[]{}' },
    range('fieldSize', 'Element size', 2, 60, .5, 12, 'px'),
    range('fieldIntensity', 'Intensity / density', 0, 1, .01, .55, '%'),
    { key: 'fieldColor', label: 'Element color', type: 'color', default: '#d5d5d5' },
    toggle('fieldSourceColor', 'Original image colors', false),
    range('fieldOpacity', 'Element opacity', 0, 1, .01, .7, '%'),
    select('fieldBlend', 'Layer blend', [['source-over', 'Normal'], ['screen', 'Screen'], ['multiply', 'Multiply'], ['overlay', 'Overlay'], ['lighter', 'Add light']], 'source-over'),
  ] },
  { id: 'field-layout', label: 'Raster layout & mask', controls: [
    range('fieldSpacing', 'Grid spacing', 8, 100, 1, 24, 'px'),
    range('fieldAspect', 'Row spacing ratio', .5, 3, .05, 1, '×'),
    range('fieldJitter', 'Position scatter', 0, 1, .01, .1, '%'),
    range('fieldRotation', 'Element rotation', -180, 180, 1, 0, '°'),
    select('fieldMask', 'Coverage mask', [['uniform', 'Full background'], ['clouds', 'Flowing clouds'], ['light', 'Image highlights'], ['dark', 'Image shadows'], ['edges', 'Image edges']], 'uniform'),
    range('fieldThreshold', 'Mask threshold', 0, 1, .01, .4, '%'),
    range('fieldSoftness', 'Mask softness', .01, 1, .01, .35, '%'),
    range('fieldContrast', 'Mask contrast', .25, 3, .05, 1, '×'),
    toggle('fieldInvert', 'Invert mask', false),
    range('fieldSeed', 'Pattern seed', 1, 999, 1, 42),
  ] },
  { id: 'field-motion', label: 'ASCII / Raster motion', controls: [
    toggle('fieldAnimate', 'Animate elements', true),
    range('fieldSpeed', 'Travel speed', 0, 300, 1, 30, 'px/s'),
    range('fieldDirection', 'Travel direction', 0, 360, 1, 0, '°'),
    range('fieldTurbulence', 'Flow turbulence', 0, 2, .05, .15, '×'),
    range('fieldFlicker', 'Soft flicker', 0, 1, .01, .1, '%'),
    range('fieldChangeRate', 'Symbol change rate', 0, 20, .5, 2, 'Hz'),
    range('fieldTrail', 'Motion trail', 0, 1, .01, 0, '%'),
    range('fieldPulse', 'Size pulse', 0, 1, .01, 0, '%'),
  ] },
];
export const FIELD_KEYS = new Set(FIELD_GROUPS.flatMap(group => group.controls.map(field => field.key)));
export function fieldDefaults() { return Object.fromEntries(FIELD_GROUPS.flatMap(group => group.controls.map(field => [field.key, field.default]))); }
export function fieldPreset(id) {
  const preset = FIELD_PRESETS.find(p => p.id === id);
  return preset ? { ...fieldDefaults(), ...preset.config, fieldEnabled: true, fieldPreset: id } : null;
}
export const fieldIsAnimated = c => Boolean(c.fieldEnabled && c.fieldAnimate);
