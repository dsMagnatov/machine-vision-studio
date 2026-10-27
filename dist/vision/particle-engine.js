import { vertex,fragment } from './particle-shaders.js';
import { cloudPosition,deformParticle,projectParticle,cameraDistance,particleHash,smooth,softer,transitionDuration } from './particle-motion.js';
import { sampleDepth,imagePlacement } from './depth-fields.js';
import { inkRGB } from './particle-style.js';
import { contourAtlas } from './particle-geometry.js';

function shader(gl,type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s;}
const sourceWidth=media=>media.videoWidth||media.naturalWidth||media.width;
const sourceHeight=media=>media.videoHeight||media.naturalHeight||media.height;
const mix=(a,b,t)=>a+(b-a)*t;
export class ParticleRenderer{
  constructor(canvas){
    this.canvas=canvas;this.ctx=canvas.getContext('2d');this.gpu=document.createElement('canvas');
    const gl=this.gl=this.gpu.getContext('webgl2',{alpha:true,premultipliedAlpha:true,preserveDrawingBuffer:true,antialias:false});
    if(!gl)throw new Error('Particle Flow needs WebGL 2. Enable hardware acceleration in your browser.');
    this.program=gl.createProgram();const vs=shader(gl,gl.VERTEX_SHADER,vertex),fs=shader(gl,gl.FRAGMENT_SHADER,fragment);
    gl.attachShader(this.program,vs);gl.attachShader(this.program,fs);gl.linkProgram(this.program);gl.deleteShader(vs);gl.deleteShader(fs);
    if(!gl.getProgramParameter(this.program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(this.program));
    this.uniforms=new Map();this.entries=new Map();gl.useProgram(this.program);this.vao=gl.createVertexArray();gl.bindVertexArray(this.vao);
    gl.enable(gl.BLEND);gl.blendFuncSeparate(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA,gl.ONE,gl.ONE_MINUS_SRC_ALPHA);gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);
  }
  uniform(name,values){
    const gl=this.gl;if(!this.uniforms.has(name))this.uniforms.set(name,gl.getUniformLocation(this.program,name));const location=this.uniforms.get(name);
    if(typeof values==='number')gl.uniform1f(location,values);else if(values.length===2)gl.uniform2fv(location,values);else gl.uniform4fv(location,values);
  }
  createTexture(nearest=false){const gl=this.gl,t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,nearest?gl.NEAREST:gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,nearest?gl.NEAREST:gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);return t;}
  texture(media,width,height,options,clock){
    const gl=this.gl;let entry=this.entries.get(media);
    if(!entry){const canvas=document.createElement('canvas'),analysis=document.createElement('canvas');entry={canvas,ctx:canvas.getContext('2d',{willReadFrequently:true}),analysis,analysisCtx:analysis.getContext('2d',{willReadFrequently:true}),texture:this.createTexture(),depthTexture:this.createTexture(),edgeTexture:this.createTexture(true),key:'',points:[],sampled:-Infinity};this.entries.set(media,entry);}
    const sw=sourceWidth(media),sh=sourceHeight(media);if(!sw||!sh)return null;
    const ratio=Math.min(1,1536/width,1536/height),w=Math.max(2,Math.round(width*ratio)),h=Math.max(2,Math.round(height*ratio));
    const key=[w,h,options.fit,options.position,options.version,options.analysisInvert,options.cutoff].join('|'),changed=entry.key!==key,dynamic=media instanceof HTMLVideoElement||options.dynamic;
    entry.smoothing=options.depthSmoothing??.65;
    const placement=imagePlacement(sw,sh,w,h,options.fit,options.position);entry.fit=[placement.x/w,placement.y/h,placement.width/w,placement.height/h];
    const depthChanged=entry.depth!==options.depthMap;
    if(depthChanged||!entry.depthInitialized){
      entry.depth=options.depthMap;const map=entry.depth,bytes=map?Uint8Array.from(map.data,v=>Math.round(v*255)):new Uint8Array([128]);
      gl.bindTexture(gl.TEXTURE_2D,entry.depthTexture);gl.pixelStorei(gl.UNPACK_ALIGNMENT,1);gl.texImage2D(gl.TEXTURE_2D,0,gl.R8,map?.width||1,map?.height||1,0,gl.RED,gl.UNSIGNED_BYTE,bytes);entry.depthInitialized=true;
    }
    if(changed||dynamic){
      if(entry.canvas.width!==w)entry.canvas.width=w;if(entry.canvas.height!==h)entry.canvas.height=h;
      entry.ctx.clearRect(0,0,w,h);entry.ctx.drawImage(media,placement.x,placement.y,placement.width,placement.height);
      gl.bindTexture(gl.TEXTURE_2D,entry.texture);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,entry.canvas);entry.key=key;
    }
    const analysisClock=media instanceof HTMLVideoElement?media.currentTime:clock;
    const updateGeometry=changed||!entry.edges||dynamic&&Math.abs(analysisClock-entry.sampled)>.2;
    if(updateGeometry){
      const scale=Math.min(1,512/w,512/h),aw=Math.max(2,Math.round(w*scale)),ah=Math.max(2,Math.round(h*scale));
      entry.analysis.width=aw;entry.analysis.height=ah;entry.analysisCtx.drawImage(entry.canvas,0,0,aw,ah);
      entry.edges=contourAtlas(entry.analysisCtx.getImageData(0,0,aw,ah).data,aw,ah,{cutoff:options.cutoff,invert:options.analysisInvert});
      gl.bindTexture(gl.TEXTURE_2D,entry.edgeTexture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA32F,entry.edges.width,entry.edges.height,0,gl.RGBA,gl.FLOAT,entry.edges.data);
    }
    if(updateGeometry||depthChanged){this.features(entry,options);entry.sampled=analysisClock;}
    return entry;
  }
  depthAt(entry,uv){
    const x=(uv.x-entry.fit[0])/entry.fit[2],y=(uv.y-entry.fit[1])/entry.fit[3],s=entry.smoothing??.65,r=.004+.03*s;
    const centre=sampleDepth(entry.depth,x,y),neighbours=sampleDepth(entry.depth,x+r,y)+sampleDepth(entry.depth,x-r,y)+sampleDepth(entry.depth,x,y+r)+sampleDepth(entry.depth,x,y-r);
    const diagonals=sampleDepth(entry.depth,x+r,y+r)+sampleDepth(entry.depth,x-r,y-r)+sampleDepth(entry.depth,x+r,y-r)+sampleDepth(entry.depth,x-r,y+r);
    return mix(centre,centre*.25+neighbours*.125+diagonals*.0625,s);
  }
  features(entry,options){
    const {width:w,height:h}=entry.canvas,image=entry.ctx.getImageData(0,0,w,h).data,candidates=[],step=Math.max(5,Math.round(Math.min(w,h)/42));
    const luma=i=>(image[i]*.2126+image[i+1]*.7152+image[i+2]*.0722)/255;
    for(let y=step;y<h-step;y+=step)for(let x=step;x<w-step;x+=step){
      const i=(y*w+x)*4,raw=luma(i),l=options.analysisInvert?1-raw:raw;if(image[i+3]<80||l<Math.max(.025,options.cutoff||0))continue;
      const point={x:x/w,y:y/h},d=this.depthAt(entry,point),edge=Math.abs(raw-luma(i+step*4))+Math.abs(raw-luma(i+step*w*4));
      const de=Math.abs(d-this.depthAt(entry,{x:(x+step)/w,y:y/h}));candidates.push({...point,score:edge*2+de*1.7+particleHash(x+y*w)*.22});
    }
    candidates.sort((a,b)=>b.score-a.score);entry.points=[];
    for(const point of candidates){if(entry.points.every(other=>Math.hypot(point.x-other.x,point.y-other.y)>.055))entry.points.push(point);if(entry.points.length>=64)break;}
  }
  render(media,c,width,height,time,options={}){
    const gl=this.gl,w=Math.max(1,Math.round(width)),h=Math.max(1,Math.round(height));
    if(this.canvas.width!==w)this.canvas.width=w;if(this.canvas.height!==h)this.canvas.height=h;
    if(this.gpu.width!==w)this.gpu.width=w;if(this.gpu.height!==h)this.gpu.height=h;
    const ctx=this.ctx;ctx.setTransform(1,0,0,1,0,0);ctx.globalAlpha=1;ctx.fillStyle=c.paper==='light'?'#f4f3ef':'#050505';ctx.fillRect(0,0,w,h);
    if(!c.enabled){const sw=sourceWidth(media),sh=sourceHeight(media);if(!sw||!sh)return false;const p=imagePlacement(sw,sh,w,h,options.fit,options.position);ctx.drawImage(media,p.x,p.y,p.width,p.height);this.canvas.dataset.particles='0';return true;}
    const textureOptions={...options,analysisInvert:c.invert,cutoff:c.cutoff,depthSmoothing:c.depthSmoothing};
    const a=this.texture(media,w,h,textureOptions,time),b=options.nextMedia&&options.nextMedia!==media?this.texture(options.nextMedia,w,h,{...textureOptions,depthMap:options.nextDepthMap,version:options.nextVersion||0,dynamic:options.nextDynamic},time):a;
    if(!a||!b)return false;
    gl.viewport(0,0,w,h);gl.depthMask(true);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(this.program);
    for(const [unit,name,texture]of[[0,'uA',a.texture],[1,'uB',b.texture],[2,'uDepthA',a.depthTexture],[3,'uDepthB',b.depthTexture],[4,'uEdgesA',a.edgeTexture],[5,'uEdgesB',b.edgeTexture]]){gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,texture);gl.uniform1i(gl.getUniformLocation(this.program,name),unit);}
    const count=Number(c.density),gridWidth=Math.ceil(Math.sqrt(count*w/h));
    this.uniform('uGrid',[gridWidth,Math.ceil(count/gridWidth)]);this.uniform('uSize',[w,h]);this.uniform('uFitA',a.fit);this.uniform('uFitB',b.fit);
    this.uniform('uCloud',[c.relief,c.pointSize,c.exposure,c.scan?1:0]);this.uniform('uMotion',[c.drift,c.splash,c.gather,c.transitionSoftness??.8]);
    this.uniform('uDrift',[c.driftSoftness??.5,c.driftSpread??1,c.driftSpeed??.45,c.turbulence??.35]);
    this.uniform('uVolume',[c.depthStretch??1,c.cloudThickness??.07,c.depthSmoothing??.65,c.saturation??1]);
    this.uniform('uGeometry',[c.depthMode==='surface'?2:c.depthMode==='volume'?1:0,0,0,0]);
    this.uniform('uEdges',[a.edges.width,a.edges.count,b.edges.width,b.edges.count]);this.uniform('uEdgePixels',[...a.edges.pixel,...b.edges.pixel]);
    const angle=c.lineAngle*Math.PI/180;this.uniform('uLine',[Math.cos(angle),Math.sin(angle),c.linePosition,c.flipSide?1:0]);
    this.uniform('uCamera',[(c.yaw+(c.autoOrbit?Math.sin(time*.19)*10:0))*Math.PI/180,c.pitch*Math.PI/180,c.cameraZoom,cameraDistance(c)]);
    this.uniform('uTone',[c.contrast,c.cutoff,c.sourceColors?1:0,c.paper==='light'?1:0]);this.uniform('uInvert',c.invert?1:0);
    this.uniform('uEvents',[options.burstStart??-100,transitionDuration(c),options.lightStart??-100,.5]);
    this.uniform('uSeeds',[options.seed||0,options.nextSeed??options.seed??0,c.travel==='swarm'?1:0,.5]);this.uniform('uProgress',options.progress||0);
    if(c.trails){gl.depthMask(false);for(let i=4;i>0;i--){this.uniform('uTime',Math.max(0,time-i*.045));this.uniform('uGain',.12*(1-i/5));gl.drawArrays(gl.POINTS,0,count);}gl.depthMask(true);}
    this.uniform('uTime',time);this.uniform('uGain',1);gl.drawArrays(gl.POINTS,0,count);ctx.drawImage(this.gpu,0,0);
    this.overlays(a,b,c,w,h,time,options);
    Object.assign(this.canvas.dataset,{particles:String(count),phase:time.toFixed(4),renderer:'particles',transition:String(options.progress||0),depth:c.depthMode==='extrude'?'extrusion':a.depth?.model||'pending',geometry:c.depthMode,contours:String(a.edges.count),trackers:String(c.trackers?Math.min(Number(c.trackerCount),a.points.length):0)});
    return true;
  }
  anchor(entry,index,time){
    if(!entry.points.length)return{x:.5,y:.5};
    const phase=time*(.22+particleHash(index+13)*.08)+index*.13,epoch=Math.floor(phase),t=smooth(.08,.88,phase-epoch),points=entry.points;
    const a=points[(index*7+epoch*13)%points.length],b=points[(index*7+(epoch+1)*13)%points.length];return{x:mix(a.x,b.x,t),y:mix(a.y,b.y,t)};
  }
  overlays(a,b,c,w,h,time,options){
    const ctx=this.ctx,light=c.paper==='light',base=light?[18,24,30]:[236,242,248],ink=inkRGB(c.trackerColor,base),unit=Math.max(.65,Math.min(w,h)/900),alpha=c.trackerInk??.95;
    const linkInk=inkRGB(c.linkColor,base),linkAlpha=c.linkOpacity??.46,frameInk=inkRGB(c.frameColor,base,c.frameSaturation??1),frameAlpha=c.frameOpacity??.35;
    const numberSize=Math.max(8,12*unit)*(c.numberSize??12)/12,linkWidth=(c.linkWidth??.8)*unit;
    ctx.save();ctx.lineWidth=Math.max(.8,unit);ctx.font=`500 ${numberSize}px "IBM Plex Mono",monospace`;
    const count=Math.min(Number(c.trackerCount),Math.max(a.points.length,b.points.length)),progress=options.progress||0,p=softer(0,1,progress);
    const points=Array.from({length:count},(_,index)=>{
      const ua=this.anchor(a,index,time),ub=this.anchor(b,index,time),id=3000+index*117;
      const pa=cloudPosition(ua,this.depthAt(a,ua),id,c,w/h),pb=cloudPosition(ub,this.depthAt(b,ub),id,c,w/h),uv={x:mix(ua.x,ub.x,p),y:mix(ua.y,ub.y,p)};
      const pos=deformParticle({x:mix(pa.x,pb.x,p),y:mix(pa.y,pb.y,p),z:mix(pa.z,pb.z,p)},uv,id,c,time,options);
      return{...projectParticle(pos,c,w/h,time),id:index+1,erosion:pos.erosion};
    }).filter(point=>point.x>.03&&point.x<.97&&point.y>.04&&point.y<.96);
    if(c.links && linkAlpha>0){const edges=new Set();for(let i=0;i<points.length;i++){
      const nearest=points.map((point,j)=>({j,d:Math.hypot(point.x-points[i].x,point.y-points[i].y)})).filter(p=>p.j!==i&&p.d<.48).sort((a,b)=>a.d-b.d).slice(0,2);
      for(const {j}of nearest){const key=[Math.min(i,j),Math.max(i,j)].join(':');if(edges.has(key))continue;edges.add(key);ctx.beginPath();ctx.moveTo(points[i].x*w,points[i].y*h);ctx.lineTo(points[j].x*w,points[j].y*h);ctx.strokeStyle=light?`rgba(255,255,255,${linkAlpha*.8})`:`rgba(0,0,0,${linkAlpha*.8})`;ctx.lineWidth=linkWidth+1.7*unit;ctx.stroke();ctx.lineWidth=linkWidth;ctx.strokeStyle=`rgba(${linkInk},${linkAlpha})`;ctx.stroke();}
    }}
    const labelBoxes=[];
    if(c.trackers && alpha>0)points.forEach(point=>{
      const x=point.x*w,y=point.y*h,size=(c.trackerSize||1)*unit*(10+particleHash(point.id)*7+Math.sin(time*1.7+point.id)*2)*Math.max(.8,point.scale),r=size,l=size*.42;
      ctx.strokeStyle=`rgba(${ink},${alpha*.22})`;ctx.lineWidth=.65*unit;ctx.strokeRect(x-r,y-r,r*2,r*2);
      ctx.beginPath();for(const dx of[-1,1])for(const dy of[-1,1]){ctx.moveTo(x+dx*r,y+dy*(r-l));ctx.lineTo(x+dx*r,y+dy*r);ctx.lineTo(x+dx*(r-l),y+dy*r);}
      ctx.strokeStyle=`rgba(${ink},${alpha})`;ctx.lineWidth=1.25*unit;ctx.shadowColor=light?'#fff':'#000';ctx.shadowBlur=3*unit;ctx.stroke();ctx.shadowBlur=0;
      ctx.fillStyle=`rgba(${ink},${alpha})`;ctx.fillRect(x-unit,y-unit,2*unit,2*unit);
      const signed=value=>`${value<0?'−':'+'}${Math.abs(value).toFixed(2)}`,label=`${String(point.id).padStart(2,'0')} ${signed(point.x*2-1)} ${signed(1-point.y*2)} ${signed(point.z)}`,tw=ctx.measureText(label).width+8*unit,th=numberSize*1.4;
      let lx=Math.max(4,Math.min(w-tw-4,x+r+5*unit)),ly=y-r-2*unit;
      const origin=ly;
      for(let attempt=0;attempt<=count*2;attempt++){
        const offset=(attempt%2?1:-1)*Math.ceil(attempt/2)*th;
        ly=Math.max(th,Math.min(h-th,origin+offset));
        if(!labelBoxes.some(box=>lx<box.x+box.w&&lx+tw>box.x&&ly-th<box.y+box.h&&ly>box.y))break;
      }
      labelBoxes.push({x:lx,y:ly-th,w:tw,h:th});
      if(c.numberBackground!==false){ctx.fillStyle=light?`rgba(247,247,244,${alpha*.87})`:`rgba(3,6,9,${alpha*.78})`;ctx.fillRect(lx-3*unit,ly-th+3*unit,tw,th);}
      ctx.fillStyle=`rgba(${ink},${alpha})`;ctx.fillText(label,lx,ly);
    });
    if(c.marks && frameAlpha>0){
      const margin=Math.min(w,h)*.1,x=margin,y=margin,fw=w-margin*2,fh=h-margin*2;ctx.strokeStyle=`rgba(${frameInk},${frameAlpha})`;ctx.lineWidth=.6*unit;ctx.setLineDash([1,6*unit]);ctx.strokeRect(x,y,fw,fh);ctx.setLineDash([]);
      for(let i=0;i<=40;i++){const tick=i%5===0?8:3;ctx.beginPath();ctx.moveTo(x+fw*i/40,y);ctx.lineTo(x+fw*i/40,y-tick*unit);ctx.moveTo(x+fw*i/40,y+fh);ctx.lineTo(x+fw*i/40,y+fh+tick*unit);ctx.stroke();}
      ctx.font=`${Math.max(7,10*unit)}px "IBM Plex Mono",monospace`;ctx.fillStyle=`rgba(${frameInk},${Math.min(1,frameAlpha*1.8)})`;ctx.fillText(`${Number(c.density).toLocaleString('en-US')} PTS`,x,y+fh+20*unit);ctx.fillText(`${c.depthMode==='extrude'?'EXTRUSION':a.depth?'DEPTH':'ANALYSING DEPTH'} ${c.relief.toFixed(2)} × ${Number((c.depthStretch??1).toFixed(2))}   ORBIT ${Math.round(c.yaw)}°`,x,y-14*unit);
    }
    if(c.scan){const y=(.15+.7*((time*.13)%1))*h;ctx.strokeStyle=`rgba(${ink},.4)`;ctx.beginPath();ctx.moveTo(w*.1,y);ctx.lineTo(w*.9,y);ctx.stroke();}ctx.restore();
  }
  release(media){const entry=this.entries.get(media);if(entry){this.gl.deleteTexture(entry.texture);this.gl.deleteTexture(entry.depthTexture);this.gl.deleteTexture(entry.edgeTexture);entry.canvas.width=entry.canvas.height=entry.analysis.width=entry.analysis.height=1;this.entries.delete(media);}}
  destroy(){for(const media of this.entries.keys())this.release(media);this.gl.deleteVertexArray(this.vao);this.gl.deleteProgram(this.program);this.gl.getExtension('WEBGL_lose_context')?.loseContext();this.gpu.width=this.gpu.height=1;}
}
