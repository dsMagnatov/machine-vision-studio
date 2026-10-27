import { GROUPS } from './engine.js';
import { ACCEPT } from './media.js';
import { RATIOS, timeLabel } from './formats.js';
import { ANIMATED_FORMATS, QUALITIES, animationSettings, qualityDescription } from './export-options.js';
import { PARTICLE_GROUPS } from './particle-model.js';

const element = (tag, cls = '', text) => {
  const node = document.createElement(tag); node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
};
const sync = (node, value) => { if (document.activeElement !== node) node.value = String(value ?? ''); };

export function createUI(onAction) {
  let view, sourceKey = '', zoom = 1, fitScale = 1, noticeTimer;
  const updates = [], particleUpdates = [], sectionNodes = new Map(), busyControls = new Map();
  const button = (text, name, action, cls = '') => {
    const node = element('button', cls, text); node.type = 'button';
    node.setAttribute('aria-label', name || text); node.addEventListener('click', action); return node;
  };
  const select = (label, choices, action, id) => {
    const wrap = element('label', 'select-row'), caption = element('span', '', label), input = element('select');
    input.setAttribute('aria-label', label); if (id) input.id = id;
    for (const [value, title] of choices) { const option = element('option', '', title); option.value = value; input.append(option); }
    input.addEventListener('change', () => action(input.value)); wrap.append(caption, input); return { wrap, input };
  };
  const section = (parent, title, open = true, id = title) => {
    const node = element('details', 'panel-section'); node.open = open;
    const summary = element('summary', '', title), content = element('div', 'section-content');
    node.append(summary, content); parent.append(node); sectionNodes.set(id, node); return content;
  };
  const workspace = element('div', 'workspace');
  const left = element('aside', 'sidebar sidebar-left'); left.setAttribute('aria-label', 'Input and effects');
  const brand = element('header', 'brand'); brand.append(element('span', '', 'Machine Vision Studio '), element('small', '', '[by trehubov]')); left.append(brand);
  const toolTabs=element('div','tool-tabs');toolTabs.setAttribute('role','tablist');toolTabs.setAttribute('aria-label','Studio tools');
  const toolButtons=[];
  for(const [id,title]of[['vision','Vision Tracking'],['particles','Particle Flow']]){
    const tab=button(title,title,()=>onAction('tool',id),'tool-tab');tab.setAttribute('role','tab');tab.setAttribute('aria-selected',String(id==='vision'));
    tab.addEventListener('keydown',event=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){event.preventDefault();const next=event.key==='Home'?'vision':event.key==='End'?'particles':id==='vision'?'particles':'vision';onAction('tool',next);toolButtons.find(item=>item.id===next)?.tab.focus();}});
    toolTabs.append(tab);toolButtons.push({id,tab});
  }left.append(toolTabs);
  const leftScroll = element('div', 'left-scroll'); left.append(leftScroll);
  const inputSection = section(leftScroll, 'Input');
  const inputStatus = element('div', 'input-status', 'Standby'); inputSection.append(inputStatus);
  const fileInput = element('input', 'file-input'); fileInput.type = 'file'; fileInput.multiple = true; fileInput.accept = ACCEPT; fileInput.id = 'media-files'; fileInput.setAttribute('aria-label', 'Import images or videos');
  fileInput.addEventListener('change', () => { onAction('import', [...fileInput.files]); fileInput.value = ''; });
  const browse = button('', 'Import images or videos', () => fileInput.click(), 'upload-zone');
  browse.append(element('span', '', 'Drop file or click to browse'), element('small', '', 'PNG, JPG, WebP, GIF, MP4, WebM'));
  inputSection.append(browse, fileInput);
  const sourceList = element('div', 'source-list'); sourceList.setAttribute('aria-label', 'Imported media'); inputSection.append(sourceList);

  const canvasSection = section(leftScroll, 'Canvas');
  const ratio = select('Aspect ratio', RATIOS, value => onAction('framing', { ratio: value }), 'aspect-ratio'); canvasSection.append(ratio.wrap);
  const fitRow = element('div', 'select-row'), fitButtons = element('div', 'segmented'); fitRow.append(element('span', '', 'Framing'));
  const fillButton = button('Fill', 'Fill canvas and crop', () => onAction('framing', { fit: 'cover' }));
  const fitButton = button('Fit', 'Fit entire image', () => onAction('framing', { fit: 'contain' }));
  fitButtons.append(fillButton, fitButton); fitRow.append(fitButtons); canvasSection.append(fitRow);
  const cropControls = [];
  for (const [key, title] of [['x', 'Position X'], ['y', 'Position Y']]) {
    const wrap = element('label', 'framing-control'), range = element('input'); range.type = 'range'; range.min = 0; range.max = 100; range.step = 1; range.value = 50; range.setAttribute('aria-label', title);
    const number = element('output', '', '50%'); wrap.append(element('span', '', title), number, range); canvasSection.append(wrap);
    range.addEventListener('input', () => { number.value = `${range.value}%`; onAction('framing', { [key]: Number(range.value) / 100 }); });
    cropControls.push({ key, range, number });
  }
  const sourceSize = element('p', 'source-size'); canvasSection.append(sourceSize);

  const flowSection=section(leftScroll,'Particle Flow');flowSection.parentElement.dataset.tool='particles';
  const depthStatus=element('div','depth-status');depthStatus.setAttribute('role','status');
  const depthText=element('span'),depthRetry=button('Retry','Retry AI depth analysis',()=>onAction('particle-depth'),'quiet-button');depthStatus.append(depthText,depthRetry);flowSection.append(depthStatus);
  const flowActions=element('div','flow-actions');flowActions.append(button('Next / reform  ␣','Next picture or reform particles',()=>onAction('particle-next')),button('Light  S','Pulse particle light',()=>onAction('particle-light')));flowSection.append(flowActions);
  flowSection.append(button('Disperse / gather  R','Disperse and gather current picture',()=>onAction('particle-burst'),'line-flip'));
  const layerButtons=[];
  for(const[key,title]of[['enabled','Point cloud'],['trackers','Trackers'],['links','Links'],['scan','Scan plane'],['trails','Trails'],['marks','Frame marks']]){
    const b=button('',`Particle ${title}`,()=>onAction(key==='enabled'?'enabled':'config',key==='enabled'?!view.config.enabled:{key,value:!view.config[key]}),'effect-item');
    b.append(element('span','effect-dot','○'),element('span','',title));flowSection.append(b);layerButtons.push({key,b});
  }
  const padSection=section(leftScroll,'Drift line',true,'line-pad');padSection.parentElement.dataset.tool='particles';
  const linePad=element('canvas','line-pad');linePad.width=240;linePad.height=110;linePad.tabIndex=0;linePad.setAttribute('role','img');linePad.setAttribute('aria-label','Drift line. Drag the center to move, drag an end to rotate. Arrow keys adjust, F flips the side.');
  padSection.append(linePad,button('Flip side','Flip particle drift side',()=>onAction('config',{key:'flipSide',value:!view.config.flipSide}),'line-flip'));
  let padDrag=null;
  const padPoint=event=>{const rect=linePad.getBoundingClientRect();return{x:(event.clientX-rect.left)/rect.width*240,y:(event.clientY-rect.top)/rect.height*110};};
  const updateLine=event=>{if(!padDrag)return;const point=padPoint(event),angle=view.config.lineAngle*Math.PI/180;
    if(padDrag==='move')onAction('config',{key:'linePosition',value:Math.max(-1,Math.min(1,((point.x-120)*Math.cos(angle)/120+(point.y-55)*Math.sin(angle)/55)))});
    else{let degrees=Math.atan2(point.y-55,point.x-120)*180/Math.PI-90;while(degrees< -180)degrees+=360;while(degrees>180)degrees-=360;onAction('config',{key:'lineAngle',value:degrees});}
  };
  linePad.addEventListener('pointerdown',event=>{if(view?.tool!=='particles'||view.exporting)return;const point=padPoint(event);padDrag=Math.hypot(point.x-120,point.y-55)<25?'move':'rotate';linePad.setPointerCapture(event.pointerId);updateLine(event);});
  linePad.addEventListener('pointermove',updateLine);linePad.addEventListener('pointerup',()=>{padDrag=null;});linePad.addEventListener('pointercancel',()=>{padDrag=null;});
  linePad.addEventListener('keydown',event=>{const c=view.config;if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','f','F'].includes(event.key)){event.preventDefault();if(event.key.toLowerCase()==='f')onAction('config',{key:'flipSide',value:!c.flipSide});else if(event.key==='ArrowLeft'||event.key==='ArrowRight')onAction('config',{key:'lineAngle',value:c.lineAngle+(event.key==='ArrowLeft'?-5:5)});else onAction('config',{key:'linePosition',value:c.linePosition+(event.key==='ArrowUp'?-.04:.04)});}});
  const drawLinePad=()=>{const ctx=linePad.getContext('2d'),c=view.config;ctx.fillStyle='#090909';ctx.fillRect(0,0,240,110);ctx.save();ctx.translate(120,55);ctx.rotate(c.lineAngle*Math.PI/180);ctx.fillStyle='#ffffff08';ctx.fillRect(c.linePosition*70,c.flipSide?-200:0,300,c.flipSide?200:300);ctx.translate(c.linePosition*70,0);ctx.strokeStyle='#aaa';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(0,-150);ctx.lineTo(0,150);ctx.stroke();for(const y of[-35,0,35]){ctx.fillStyle=y===0?'#ccc':'#0f0f0f';ctx.beginPath();ctx.arc(0,y,y===0?3:2,0,Math.PI*2);ctx.fill();ctx.stroke();}ctx.restore();ctx.strokeStyle='#292929';ctx.strokeRect(.5,.5,239,109);};

  const effectsSection = section(leftScroll, 'Effects');
  effectsSection.parentElement.dataset.tool='vision';
  const effectButtons = [];
  const effects = [
    ['vision', 'Vision', 'enabled'], ['detection', 'Detection markers', 'detection'],
    ['connections', 'Connecting lines', 'connections'], ['chain', 'Circle chain', 'chainEnabled'],
    ['frame', 'Crosshair frame', 'frameEnabled'], ['pixelate', 'Pixelate zones', 'zones'],
    ['texture', 'Texture / grain', 'texture'],
  ];
  for (const [id, title, key] of effects) {
    const b = button('', title, () => {
      if (!view?.ready) return;
      if (key === 'enabled') onAction('enabled', !view.config.enabled);
      else if (key === 'zones') onAction('zone-edit');
      else onAction('config', { key, value: key === 'texture' ? (view.config.texture === 'none' ? 'grain' : 'none') : !view.config[key] });
      const detail = sectionNodes.get(id); if (detail) { detail.open = true; detail.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
    }, `effect-item${id === 'vision' ? ' effect-item-main' : ''}`);
    b.append(element('span', 'effect-dot', '○'), element('span', '', title)); b.setAttribute('aria-pressed', 'false'); effectsSection.append(b); effectButtons.push({ b, key });
  }
  const presetsSection = section(leftScroll, 'Presets', false);
  presetsSection.parentElement.dataset.tool='vision';
  for (const [id, title] of [['default', 'Original Vision look'], ['detection', 'Detection only'], ['geometry', 'Circle geometry'], ['minimal', 'Minimal markers']]) {
    presetsSection.append(button(title, `Apply ${title} preset`, () => onAction('preset', id), 'preset-button'));
  }
  const flowPresets=section(leftScroll,'Presets',false,'particle-presets');flowPresets.parentElement.dataset.tool='particles';
  for(const[id,title]of[['sand','Sand drift'],['sculpture','Sculpture'],['smoke','Smoke & trails'],['source','Source colors']])flowPresets.append(button(title,`Apply ${title} particle preset`,()=>onAction('particle-preset',id),'preset-button'));
  const leftFooter = element('footer', 'sidebar-footer', 'Files stay on this device'); left.append(leftFooter);

  const main = element('main', 'preview-main'); main.setAttribute('aria-label', 'Image preview');
  const previewHeader = element('div', 'preview-header'), badge = element('span', 'preview-badge', '● Vision'), dimensions = element('span', 'preview-dimensions'); previewHeader.append(badge, dimensions); main.append(previewHeader);
  const tools = element('div', 'preview-tools');
  const compare = button('◐', 'Toggle effect preview', () => onAction('enabled', !view?.config.enabled), 'icon-button'); compare.title = 'Toggle effect preview';
  const fullscreen = button('⛶', 'Toggle fullscreen', () => {
    const task = document.fullscreenElement ? document.exitFullscreen() : workspace.requestFullscreen?.();
    task?.catch(() => status('Fullscreen is unavailable in this window.', true));
  }, 'icon-button'); fullscreen.title = 'Fullscreen'; tools.append(compare, fullscreen); main.append(tools);
  const stage = element('div', 'preview-stage'), surface = element('div', 'preview-surface'), canvas = element('canvas', 'vision-preview');
  canvas.width = 1600; canvas.height = 900; canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', 'Image with Vision effects'); canvas.tabIndex = 0;
  canvas.addEventListener('pointerdown', event => {
    if (!view?.zoneEditing || event.button !== 0) return;
    const rect = canvas.getBoundingClientRect(); onAction('zone-add', { x: (event.clientX - rect.left) / rect.width, y: (event.clientY - rect.top) / rect.height });
  });
  canvas.addEventListener('keydown', event => { if (view?.zoneEditing && ['Enter', ' '].includes(event.key)) { event.preventDefault(); onAction('zone-add', { x: .5, y: .5 }); } });
  let orbitDrag=null;
  canvas.addEventListener('pointerdown',event=>{if(view?.tool!=='particles'||event.button!==0||view.exporting)return;event.preventDefault();orbitDrag={x:event.clientX,y:event.clientY,yaw:view.config.yaw,pitch:view.config.pitch};canvas.setPointerCapture(event.pointerId);});
  canvas.addEventListener('pointermove',event=>{if(!orbitDrag)return;onAction('particle-camera',{yaw:orbitDrag.yaw+(event.clientX-orbitDrag.x)*.25,pitch:orbitDrag.pitch+(event.clientY-orbitDrag.y)*.2});});
  canvas.addEventListener('pointerup',()=>{orbitDrag=null;});canvas.addEventListener('pointercancel',()=>{orbitDrag=null;});
  canvas.addEventListener('wheel',event=>{if(view?.tool!=='particles'||view.exporting)return;event.preventDefault();onAction('particle-camera',{cameraZoom:view.config.cameraZoom*Math.exp(-event.deltaY*.0012)});},{passive:false});
  surface.append(canvas); stage.append(surface);
  const empty = button('', 'Choose an image or video', () => fileInput.click(), 'empty-state'); empty.append(element('span', '', 'Awaiting input'), element('small', '', 'Drop a file or select a source')); stage.append(empty); main.append(stage);
  const bottom = element('div', 'preview-bottom'), transport = element('div', 'video-transport'); transport.hidden = true;
  const play = button('Ⅱ', 'Pause video', () => onAction('playback'), 'transport-play');
  const time = element('output', 'video-time', '00:00 / 00:00'), seek = element('input', 'video-seek'); seek.type = 'range'; seek.min = 0; seek.max = 1; seek.step = .01; seek.value = 0; seek.setAttribute('aria-label', 'Video position');
  seek.addEventListener('input', () => onAction('seek', Number(seek.value))); transport.append(play, seek, time);
  const zoomTools = element('div', 'zoom-tools'), zoomLabel = element('output', '', '100%');
  const setZoom = value => { zoom = Math.max(.25, Math.min(4, value)); fit(); };
  zoomTools.append(button('−', 'Zoom out', () => setZoom(zoom - .25)), zoomLabel, button('+', 'Zoom in', () => setZoom(zoom + .25)), element('span', 'zoom-divider', '|'), button('Reset', 'Reset preview zoom', () => setZoom(1)), button('1:1', 'View at actual pixels', () => setZoom(1 / fitScale)));
  const orbitHint=element('span','orbit-hint','Drag to orbit · scroll to zoom');
  const cameraHome=button('Recenter','Recenter particle camera',()=>onAction('particle-home'),'camera-home');
  bottom.append(transport,orbitHint,cameraHome,zoomTools); main.append(bottom);
  const feedback = element('p', 'feedback'); feedback.hidden = true; feedback.setAttribute('role', 'status'); main.append(feedback);
  const drop = element('div', 'drop-overlay'); drop.hidden = true; drop.append(element('span', '', 'Drop images or videos'), element('small', '', 'Add files to your workspace')); main.append(drop);

  const right = element('aside', 'sidebar sidebar-right'); right.setAttribute('aria-label', 'Settings and export');
  const settingsHeader = element('header', 'settings-header'); settingsHeader.append(element('span', '', '− Settings'), button('Reset', 'Reset effect to base settings', () => onAction('reset'), 'quiet-button')); right.append(settingsHeader);
  const settings = element('form', 'settings-scroll'); settings.addEventListener('submit', event => event.preventDefault()); right.append(settings);
  let zoneButton, undoZone, clearZone, zoneCount;
  const groupOrder = ['detection', 'shapes', 'motion', 'connections', 'chain', 'frame', 'pixelate', 'text', 'texture', 'image'];
  for (const group of groupOrder.map(id => GROUPS.find(group => group.id === id))) {
    const body = section(settings, group.id === 'image' ? 'Image' : group.label, group.id === 'detection', group.id);
    body.parentElement.dataset.tool='vision';
    if (group.id === 'texture') {
      const texture = select('Texture source', [['none', 'None'], ['grain', 'Procedural grain']], value => onAction('config', { key: 'texture', value }), 'texture-source'); body.append(texture.wrap);
      let textureKey = '';
      updates.push(() => {
        const key = view.sources.map(s => s.id).join('|');
        if (key !== textureKey) {
          textureKey = key; texture.input.replaceChildren();
          for (const [value, title] of [['none', 'None'], ['grain', 'Procedural grain'], ...view.sources.map(s => [s.id, s.name])]) { const option = element('option', '', title); option.value = value; texture.input.append(option); }
        }
        sync(texture.input, view.config.texture); texture.input.disabled = !view.ready;
      });
    }
    for (const field of group.controls.filter(field => field.type !== 'color')) {
      const wrap = element('div', `control control-${field.type}`), id = `vision-${field.key}`;
      const label = element('label', '', field.label); label.htmlFor = id; wrap.append(label);
      let input, numeric;
      if (field.type === 'range') {
        const factor = field.unit === '%' && field.max <= 1 ? 100 : 1;
        numeric = element('input', 'number-value'); numeric.type = 'number'; numeric.min = field.min * factor; numeric.max = field.max * factor; numeric.step = field.step * factor; numeric.setAttribute('aria-label', `${field.label} value`);
        input = element('input'); input.type = 'range'; input.min = numeric.min; input.max = numeric.max; input.step = numeric.step;
        const commit = value => { const number = Number(value); if (!Number.isFinite(number)) return; onAction('config', { key: field.key, value: number / factor }); };
        input.addEventListener('input', () => { sync(numeric, input.value); commit(input.value); });
        numeric.addEventListener('input', () => { if (numeric.value !== '') { sync(input, numeric.value); commit(numeric.value); } });
        numeric.addEventListener('blur', () => { numeric.value = String(Number((view.config[field.key] * factor).toFixed(2))); });
        updates.push(() => { const value = Number((view.config[field.key] * factor).toFixed(2)); sync(input, value); sync(numeric, value); });
        wrap.append(numeric);
      } else if (field.type === 'toggle') {
        input = element('input', 'toggle'); input.type = 'checkbox'; input.addEventListener('change', () => onAction('config', { key: field.key, value: input.checked }));
        updates.push(() => { input.checked = view.config[field.key]; });
      } else if (field.type === 'select') {
        input = element('select');
        for (const option of field.options) { const item = element('option', '', option.label); item.value = option.value; input.append(item); }
        input.addEventListener('change', () => onAction('config', { key: field.key, value: input.value })); updates.push(() => sync(input, view.config[field.key]));
      } else {
        input = element('input'); input.type = 'text'; input.maxLength = 96;
        input.addEventListener('input', () => onAction('config', { key: field.key, value: input.value })); updates.push(() => sync(input, view.config[field.key]));
      }
      input.id = id; wrap.append(input); body.append(wrap);
      updates.push(() => {
        const c = view.config;
        let disabled = !view.ready;
        if (['speed','motion','movement','trail','pulse','scanDirection','scanLine'].includes(field.key)) disabled ||= !c.animate;
        if (['movement','pulse'].includes(field.key)) disabled ||= c.motion === 'scan';
        if (['trail','scanDirection','scanLine'].includes(field.key)) disabled ||= c.motion === 'flow';
        if (['count','angle','baseRadius','sizeRatio','chainX','chainY','intersections','markerSize'].includes(field.key)) disabled ||= !c.chainEnabled;
        if (['frameSize','dash','frameStroke','starSize','starPoints'].includes(field.key)) disabled ||= !c.frameEnabled;
        if (['textTL','textTR','textBL','textBR','textSize'].includes(field.key)) disabled ||= !c.frameText;
        if (['detectionMode','blockSize','threshold','maxCircles','minDistance','shape','minRadius','maxRadius','sizeSeed','labels','labelSize'].includes(field.key)) disabled ||= !c.detection || field.key === 'labelSize' && !c.labels;
        if (['animateLabels','labelRate'].includes(field.key)) disabled ||= !c.detection || !c.labels || field.key === 'labelRate' && (!c.animateLabels || !c.animate);
        if (['maxDistance','lineWeight'].includes(field.key)) disabled ||= !c.connections || !c.detection;
        if (['textureOpacity','textureBlend','textureAnimate'].includes(field.key)) disabled ||= c.texture === 'none';
        if (['grainSize','noiseSeed'].includes(field.key)) disabled ||= c.texture !== 'grain';
        input.disabled = disabled; if (numeric) numeric.disabled = disabled;
      });
    }
    if (group.id === 'pixelate') {
      const row = element('div', 'zone-actions');
      zoneButton = button('Place zones', 'Place pixelation zones', () => onAction('zone-edit'));
      undoZone = button('Undo', 'Undo last zone', () => onAction('zone-undo'));
      clearZone = button('Clear', 'Clear pixelation zones', () => onAction('zone-clear'));
      zoneCount = element('output', 'zone-count'); row.append(zoneButton, undoZone, clearZone); body.append(row, zoneCount);
    }
  }
  for(const group of PARTICLE_GROUPS){
    const body=section(settings,group.label,Boolean(group.open),group.id);body.parentElement.dataset.tool='particles';
    for(const field of group.controls){
      const wrap=element('div',`control control-${field.type}`),label=element('label','',field.label),id=`particle-${field.key}`;label.htmlFor=id;wrap.append(label);let input,numeric;
      if(field.type==='range'){
        numeric=element('input','number-value');numeric.type='number';numeric.min=field.min;numeric.max=field.max;numeric.step=field.step;numeric.setAttribute('aria-label',`Particle ${field.label} value`);
        input=element('input');input.type='range';input.min=field.min;input.max=field.max;input.step=field.step;
        const commit=value=>{if(value!==''&&Number.isFinite(Number(value)))onAction('config',{key:field.key,value:Number(value)});};
        numeric.addEventListener('input',()=>commit(numeric.value));input.addEventListener('input',()=>{sync(numeric,input.value);commit(input.value);});wrap.append(numeric);
        particleUpdates.push(()=>{sync(input,Number(view.config[field.key].toFixed(2)));sync(numeric,Number(view.config[field.key].toFixed(2)));});
      }else if(field.type==='toggle'){
        input=element('input','toggle');input.type='checkbox';input.addEventListener('change',()=>onAction('config',{key:field.key,value:input.checked}));particleUpdates.push(()=>{input.checked=view.config[field.key];});
      }else if(field.type==='color'){
        input=element('input','color-swatch');input.type='color';
        const hex=element('input','color-hex');hex.type='text';hex.maxLength=7;hex.spellcheck=false;hex.setAttribute('aria-label',`Particle ${field.label} hex`);
        const commit=value=>onAction('config',{key:field.key,value});
        for(const event of ['input','change'])input.addEventListener(event,()=>commit(input.value));
        hex.addEventListener('input',()=>{if(/^#[0-9a-f]{6}$/i.test(hex.value))commit(hex.value);});
        hex.addEventListener('blur',()=>{hex.value=view.config[field.key]==='auto'?'Auto':view.config[field.key];});
        const auto=button('Auto',`Automatic ${field.label.toLowerCase()}`,()=>commit('auto'),'quiet-button');wrap.append(hex,auto);
        particleUpdates.push(()=>{const value=view.config[field.key],automatic=value==='auto';sync(input,automatic?(view.config.paper==='light'?'#12181e':'#ecf2f8'):value);sync(hex,automatic?'Auto':value);auto.setAttribute('aria-pressed',String(automatic));auto.disabled=hex.disabled=!view.ready;});
      }else{
        input=element('select');for(const option of field.options){const node=element('option','',option.label);node.value=option.value;input.append(node);}input.addEventListener('change',()=>onAction('config',{key:field.key,value:input.value}));particleUpdates.push(()=>sync(input,view.config[field.key]));
      }
      input.id=id;input.setAttribute('aria-label',`Particle ${field.label}`);wrap.append(input);body.append(wrap);particleUpdates.push(()=>{const disabled=!view.ready||field.key==='depthSmoothing'&&view.config.depthMode==='extrude'||group.id==='rear-flow'&&view.config.depthMode==='surface';input.disabled=disabled;if(numeric)numeric.disabled=disabled;});
    }
  }
  const exportSection = section(right, 'Export', true, 'export'); exportSection.parentElement.classList.add('export-panel');
  exportSection.append(element('div', 'field-caption', 'Format'));
  const formats = element('div', 'format-options'), formatButtons = [];
  for (const [value, label, ext] of [['png', 'PNG', '.png'], ['jpeg', 'JPEG', '.jpg'], ['gif', 'GIF', '.gif'], ['mp4', 'MP4', '.mp4']]) {
    const b = button('', `Export format ${label}`, () => onAction('output', { format: value }), 'format-option'); b.append(element('span', '', label), element('small', '', ext)); formats.append(b); formatButtons.push({ value, b });
  }
  exportSection.append(formats);
  const qualityWrap = element('div', 'quality-wrap'); qualityWrap.append(element('div', 'field-caption', 'Quality'));
  const qualityOptions = element('div', 'quality-options'), qualityButtons = [];
  for (const id of ['maximum','high','medium','low']) {
    const b = button('', `Export quality ${id}`, () => onAction('output', { quality: id }), 'quality-option');
    const title = element('span'), detail = element('small'); b.append(title, detail); qualityOptions.append(b); qualityButtons.push({ id, b, title, detail });
  }
  qualityWrap.append(qualityOptions); exportSection.append(qualityWrap);
  const resolution = select('Long edge', [['source', 'Source size'], ['480', '480 px'], ['640', '640 px'], ['720', '720 px'], ['1080', '1080 px'], ['1920', '1920 px'], ['2560', '2560 px'], ['3840', '3840 px']], value => onAction('output', { longEdge: value }), 'export-size'); exportSection.append(resolution.wrap);
  const durationRow = element('label', 'select-row duration-row'), durationInput = element('input'); durationInput.type = 'number'; durationInput.step = .1; durationInput.min = .1; durationInput.max = 120; durationInput.setAttribute('aria-label', 'Export duration in seconds');
  durationInput.addEventListener('input', () => { if (durationInput.value !== '') onAction('output', { [view.output.format === 'gif' ? 'gifDuration' : 'duration']: Number(durationInput.value) }); });
  durationRow.append(element('span', '', 'Duration, seconds'), durationInput); exportSection.append(durationRow);
  const fullRow = element('label', 'full-video-row'), fullVideo = element('input', 'toggle'); fullVideo.type = 'checkbox'; fullVideo.setAttribute('aria-label', 'Export full video'); fullVideo.addEventListener('change', () => onAction('output', { fullVideo: fullVideo.checked })); fullRow.append(element('span', '', 'Full video'), fullVideo); exportSection.append(fullRow);
  const start = select('Start', [['beginning','Beginning'], ['current','Current frame']], value => onAction('output', { start: value }), 'export-start'); exportSection.append(start.wrap);
  const exportSummary = element('p', 'export-summary'), exportButton = button('Export PNG', 'Export media', () => onAction('export'), 'export-button');
  const progressWrap = element('div', 'export-progress'); progressWrap.hidden = true;
  const progressBar = element('progress'), progressLabel = element('span'), cancelExport = button('Cancel', 'Cancel export', () => onAction('cancel-export'), 'cancel-export');
  progressBar.max = 100; progressBar.value = 0; progressBar.setAttribute('aria-label', 'Export progress'); progressLabel.setAttribute('role', 'status'); progressWrap.append(progressBar, progressLabel, cancelExport);
  const resultPreview = element('div', 'export-result'); resultPreview.hidden = true;
  const download = element('a', 'last-export'); download.hidden = true; exportSection.append(exportSummary, exportButton, progressWrap, resultPreview, download);
  workspace.append(left, main, right); document.querySelector('#app').append(workspace);

  function fit() {
    if (!view?.ready) return;
    const padding = getComputedStyle(stage);
    const availableW = Math.max(1, stage.clientWidth - parseFloat(padding.paddingLeft) - parseFloat(padding.paddingRight));
    const availableH = Math.max(1, stage.clientHeight - parseFloat(padding.paddingTop) - parseFloat(padding.paddingBottom));
    fitScale = Math.min(availableW / canvas.width, availableH / canvas.height);
    surface.style.width = `${Math.round(canvas.width * fitScale * zoom)}px`; surface.style.height = `${Math.round(canvas.height * fitScale * zoom)}px`;
    zoomLabel.value = `${Math.round(zoom * 100)}%`;
  }
  const resize = new ResizeObserver(fit); resize.observe(stage);
  const canvasResize = new MutationObserver(fit); canvasResize.observe(canvas, { attributes: true, attributeFilter: ['width','height'] });
  function status(message, error = false) {
    clearTimeout(noticeTimer); feedback.textContent = message; feedback.hidden = !message; feedback.classList.toggle('feedback-error', error);
    if (message && !error) noticeTimer = setTimeout(() => { feedback.hidden = true; }, 6000);
  }
  function render(next) {
    for (const [control, disabled] of busyControls) control.disabled = disabled;
    busyControls.clear();
    view = next; const active = view.sources.find(s => s.id === view.selected);
    const particles=view.tool==='particles';workspace.dataset.tool=view.tool;canvas.dataset.tool=view.tool;
    for(const {id,tab}of toolButtons){tab.classList.toggle('active',id===view.tool);tab.setAttribute('aria-selected',String(id===view.tool));tab.tabIndex=id===view.tool?0:-1;}
    for(const panel of workspace.querySelectorAll('.panel-section[data-tool]'))panel.hidden=panel.dataset.tool!==view.tool;
    const key = JSON.stringify(view.sources.map(s => [s.id, s.name, s.thumbnail]));
    if (sourceKey !== key) {
      sourceKey = key; sourceList.replaceChildren();
      for (const source of view.sources) {
        const row = element('div', 'source-row'); row.dataset.source = source.id;
        const choose = button('', `Select ${source.name}`, () => onAction('target', source.id), 'source-choose');
        const thumb = element('img'); thumb.src = source.thumbnail; thumb.alt = '';
        const info = element('span', 'source-info'); info.append(element('span', 'source-name', source.name), element('small', '', `${source.width} × ${source.height} · ${source.kind === 'video' ? 'Video' : 'Image'}`)); choose.append(thumb, info);
        const remove = button('×', `Remove ${source.name}`, () => onAction('remove', source.id), 'source-remove'); row.append(choose, remove); sourceList.append(row);
      }
    }
    for (const row of sourceList.children) { const active = row.dataset.source === view.selected; row.classList.toggle('selected', active); row.querySelector('.source-choose').setAttribute('aria-pressed', String(active)); }
    inputStatus.textContent = view.loading ? 'Opening files…' : active ? `${view.sources.length} source${view.sources.length === 1 ? '' : 's'} / ${active.kind === 'video' ? 'Video' : 'Image'}` : 'Standby';
    browse.classList.toggle('loading', view.loading);
    sync(ratio.input, view.framing.ratio); ratio.input.disabled = !view.ready;
    fillButton.classList.toggle('active', view.framing.fit === 'cover'); fitButton.classList.toggle('active', view.framing.fit === 'contain');
    fillButton.setAttribute('aria-pressed', String(view.framing.fit === 'cover')); fitButton.setAttribute('aria-pressed', String(view.framing.fit === 'contain')); fillButton.disabled = fitButton.disabled = !view.ready;
    for (const item of cropControls) { sync(item.range, view.framing[item.key] * 100); item.number.value = `${Math.round(view.framing[item.key] * 100)}%`; item.range.disabled = !view.ready; }
    sourceSize.textContent = active ? `${active.width} × ${active.height} → ${view.size.width} × ${view.size.height}` : 'No source selected';
    if(!particles)for (const { b, key } of effectButtons) {
      const active = key === 'zones' ? view.zoneEditing || view.config.zones.length > 0 : key === 'texture' ? view.config.texture !== 'none' : view.config[key];
      b.classList.toggle('active', Boolean(active)); b.setAttribute('aria-pressed', String(Boolean(active))); b.firstChild.textContent = active ? '●' : '○'; b.disabled = !view.ready;
    }
    if(particles){depthText.textContent=view.depthState;depthRetry.hidden=!view.depthError;for(const{b,key}of layerButtons){const enabled=Boolean(view.config[key]);b.classList.toggle('active',enabled);b.setAttribute('aria-pressed',String(enabled));b.firstChild.textContent=enabled?'●':'○';b.disabled=!view.ready;}drawLinePad();}
    surface.hidden = !view.ready; empty.hidden = view.ready; compare.disabled = !view.ready;
    badge.textContent = view.config.enabled ? particles?'● Particle Flow':'● Vision Tracking' : '○ Original'; dimensions.textContent = view.ready ? `${view.size.width} × ${view.size.height}${particles?` · ${Number(view.config.density).toLocaleString('en-US')} pts`:''}` : '';
    canvas.setAttribute('aria-label', active ? `${active.name} with ${particles?'Particle Flow':'Vision Tracking'} effects` : 'Image preview');
    surface.classList.toggle('placing',!particles&&view.zoneEditing);surface.classList.toggle('orbitable',particles);
    orbitHint.hidden=cameraHome.hidden=!particles;orbitHint.classList.toggle('with-video',active?.kind==='video');
    if(!particles){zoneButton.setAttribute('aria-pressed',String(view.zoneEditing));undoZone.disabled=clearZone.disabled=!view.config.zones.length;zoneCount.value=`${view.config.zones.length} / 24 zones`;}
    for (const update of particles?particleUpdates:updates) update();
    for (const { value, b } of formatButtons) { b.classList.toggle('active', view.output.format === value); b.setAttribute('aria-pressed', String(view.output.format === value)); }
    const animated = ANIMATED_FORMATS.includes(view.output.format), options = animationSettings(view.output, active);
    qualityWrap.hidden = durationRow.hidden = !animated;
    for (const { id, b, title, detail } of qualityButtons) {
      const quality = (QUALITIES[view.output.format] || QUALITIES.mp4).find(q => q.id === id);
      title.textContent = quality.label; detail.textContent = qualityDescription(view.output.format, quality);
      b.classList.toggle('active', view.output.quality === id); b.setAttribute('aria-pressed', String(view.output.quality === id));
    }
    durationInput.max = view.output.format === 'gif' ? 20 : 120;
    sync(durationInput, view.output.format === 'gif' ? view.output.gifDuration : view.output.duration);
    fullRow.hidden = view.output.format !== 'mp4' || active?.kind !== 'video'; fullVideo.checked = view.output.fullVideo;
    durationInput.disabled = view.output.format === 'mp4' && active?.kind === 'video' && view.output.fullVideo;
    if (durationInput.disabled) sync(durationInput, Number(options.duration.toFixed(2)));
    start.wrap.hidden = !animated || active?.kind !== 'video'; sync(start.input, view.output.start); start.input.disabled = !fullRow.hidden && view.output.fullVideo;
    sync(resolution.input, view.output.longEdge);
    exportSummary.textContent = view.ready ? `${view.size.width} × ${view.size.height} · ${animated ? `${options.fps} fps · ${Number(options.duration.toFixed(2))}s${view.output.format === 'mp4' && active?.kind === 'video' ? ' · Source audio' : ''}` : active?.kind === 'video' ? 'Current video frame' : 'High quality image'}` : 'Choose a source to export';
    exportButton.textContent = view.exporting ? 'Exporting…' : `Export ${view.output.format.toUpperCase()}`;
    exportButton.disabled = !view.ready || view.exporting;
    progressWrap.hidden = !view.exporting;
    transport.hidden = active?.kind !== 'video';
    if (view.exporting) for (const control of workspace.querySelectorAll('button,input,select')) {
      if (control === cancelExport) continue;
      busyControls.set(control, control.disabled); control.disabled = true;
    }
    fit();
  }
  function playback({ playing, currentTime, duration }) {
    play.textContent = playing ? 'Ⅱ' : '▶'; play.setAttribute('aria-label', playing ? 'Pause video' : 'Play video');
    seek.max = Number.isFinite(duration) ? duration : 0; sync(seek, currentTime); seek.disabled = !Number.isFinite(duration) || duration <= 0;
    time.value = `${timeLabel(currentTime)} / ${timeLabel(duration)}`;
  }
  let dragging = 0;
  const hasFiles = event => [...(event.dataTransfer?.types || [])].includes('Files');
  document.addEventListener('dragenter', event => { if (hasFiles(event)) { event.preventDefault(); dragging++; drop.hidden = false; } });
  document.addEventListener('dragover', event => { if (hasFiles(event)) { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; } });
  document.addEventListener('dragleave', event => { if (hasFiles(event) && --dragging <= 0) { dragging = 0; drop.hidden = true; } });
  document.addEventListener('drop', event => { if (hasFiles(event)) { event.preventDefault(); dragging = 0; drop.hidden = true; onAction('import', [...event.dataTransfer.files]); } });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && view?.zoneEditing) onAction('zone-edit');
    if(view?.tool!=='particles'||view.exporting||event.target.closest?.('input,select,textarea,button,summary,a'))return;
    if(event.key===' '){event.preventDefault();onAction('particle-next');}
    else if(event.key.toLowerCase()==='s')onAction('particle-light');
    else if(event.key.toLowerCase()==='r')onAction('particle-burst');
    else if(event.key==='0')onAction('particle-home');
  });
  function showDownload(url, filename, bytes, format = 'png') {
    download.href = url; download.download = filename; download.title = filename; download.setAttribute('aria-label', 'Download last export');
    let thumb;
    resultPreview.replaceChildren(); resultPreview.hidden = format !== 'gif';
    if (format === 'mp4') {
      thumb = element('span', 'export-file-icon', 'MP4');
    } else {
      thumb = element('img', 'export-thumb'); thumb.alt = 'Last exported image'; thumb.src = url;
      if (format === 'gif') { const image = element('img', 'export-result-gif'); image.src = url; image.alt = 'Exported GIF preview'; resultPreview.append(image); }
    }
    const text = element('span', '', `↓ Download ${format.toUpperCase()}`); text.append(element('small', '', bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`));
    download.replaceChildren(thumb, text); download.hidden = false;
  }
  function progress(value, message) { progressBar.value = value; progressLabel.textContent = `${message} · ${value}%`; }
  return { canvas, render, playback, status, fit, showDownload, progress };
}
