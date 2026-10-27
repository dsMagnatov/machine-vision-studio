const clamp=x=>Math.max(0,Math.min(1,x));
export const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t);};
export const softer=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*t*(t*(t*6-15)+10);};
export function particleHash(n){let x=(Math.max(0,n)+1)>>>0;x^=x>>>16;x=Math.imul(x,0x7feb352d);x^=x>>>15;x=Math.imul(x,0x846ca68b);x^=x>>>16;return(x&0x00ffffff)/16777216;}
export const transitionDuration=c=>(1.6+2*(c.transitionSoftness??.8))/(.4+c.gather*.85);
export const FRONT_LAYER_END=.46,REAR_EMITTER_START=.78;
export const extrusionLength=c=>c.relief*(c.depthStretch??1)*(c.depthMode==='extrude'?.72:1.2);
export const cameraDistance=c=>3.2+(c.depthMode==='surface'?0:extrusionLength(c)*.5);
export function particleLayer(id,c){
  const kind=particleHash(id+101),emitter=c.depthMode!=='surface'&&kind>=REAR_EMITTER_START;
  return{emitter,layer:c.depthMode==='surface'||kind<FRONT_LAYER_END?1:emitter?-.28*particleHash(id+109):1-2*particleHash(id+109)};
}
export function rearParticle(position,uv,id,c,time,layer=1){
  const length=extrusionLength(c),amount=c.depthMode==='surface'?0:softer(0,.18,length),emitter=particleLayer(id,c).emitter;
  if(!amount)return{...position,opacity:1,sideFlow:1,emitter:false};
  if(emitter){
    // Recycle only after fading to zero. Motion always runs along local -Z,
    // before projection, so changing the camera cannot change the wind.
    const age=(time*(.08+.18*(c.rearSpeed??.6))+particleHash(id+151))%1;
    const birth=softer(0,.13,age),death=1-softer(.3,1,age);
    const angle=particleHash(id+163)*Math.PI*2,radius=Math.sqrt(-2*Math.log(Math.max(.003,particleHash(id+167))));
    const spread=length*(c.rearSpread??.5)*(.015+.18*age+.12*age*age),curl=Math.sin(uv.y*8+particleHash(id+173)*6.283+time*.4+age*3);
    const opacity=.44*(c.rearEmission??.8)*birth*death*(.8+.2*particleHash(id+179));
    return{x:position.x+amount*spread*(Math.cos(angle)*radius+curl*.3),y:position.y+amount*spread*(Math.sin(angle)*radius+Math.cos(curl+uv.x*9)*.3),z:position.z-amount*length*(.35+(c.rearLength??.8)*.9)*age,opacity:1+(opacity-1)*amount,sideFlow:1-amount,emitter:true};
  }
  const fade=softer(.5,1,(1-layer)*.5),grain=length*(c.rearSpread??.5)*fade*.12;
  return{x:position.x+grain*Math.sin(id*1.37+time*.31),y:position.y+grain*Math.cos(id*2.19-time*.27),z:position.z-grain*(.5+.5*Math.sin(id*.73+time*.2)),opacity:1+(Math.pow(1-fade,1.6)-1)*amount,sideFlow:1,emitter:false};
}
export function cloudPosition(uv,depth,id,c,aspect,layer=1){
  if(c.depthMode!=='surface'){
    const half=extrusionLength(c)*.5*(c.depthMode==='volume'?Math.max(.025,depth):1);
    return{x:(uv.x-.5)*1.8*aspect,y:(.5-uv.y)*1.8,z:half*layer};
  }
  const raw=(depth-.5)*c.relief*1.6*(c.depthStretch??1);
  const surface=2.2*raw/Math.sqrt(2.2*2.2+raw*raw);
  const z=surface+(particleHash(id+27)-.5)*(c.cloudThickness??.07)*c.relief,ray=(3.2-z)/3.2;
  return {x:(uv.x-.5)*1.8*aspect*ray,y:(.5-uv.y)*1.8*ray,z};
}
function burstEnvelope(t,id,c){
  const softness=c.transitionSoftness??.8,lag=particleHash(id+81)*softness*.14;
  const outgoing=Math.max(.16,Math.min(.7,.55/(.6+c.splash)))*(.4+.6*softness);
  return softer(lag,Math.min(.8,lag+outgoing),t)*(1-softer(.36+softness*.16+lag*.4,1,t));
}
export function deformParticle(position,uv,id,c,time,{progress=0,burstStart=-100,sideFlow=1}={}){
  const hash=particleHash,angle=c.lineAngle*Math.PI/180,nx=Math.cos(angle),ny=Math.sin(angle);
  const feather=.025+(c.driftSoftness??.5)*.55,strength=clamp(c.drift/2);
  let side=smooth(-feather,feather,(uv.x-.5)*nx+(uv.y-.5)*ny-c.linePosition*.5);if(c.flipSide)side=1-side;
  const threshold=hash(id+39)*.72,release=softer(threshold,threshold+.28,side*strength);
  // Each particle has its own age. The quintic flight returns to its anchor
  // with zero velocity and acceleration, including at the lifetime seam.
  const age=(time*(.035+.11*(c.driftSpeed??.45))+hash(id+41))%1;
  const back=Math.max(.2,Math.min(.65,.42/(.35+c.gather))),out=1-back;
  const flight=softer(0,1,age<out?age/out:(1-age)/back),erosion=release*flight*sideFlow;
  const distance=erosion*(c.driftSpread??1)*(.3+strength*1.9);
  const radius=Math.min(2.8,.25-Math.log(Math.max(.005,1-hash(id+51)))*.55),turbulence=c.turbulence??.35;
  const curl=Math.sin(uv.y*9+uv.x*5+time*.45+hash(id+52)*6.283);
  const curl2=Math.cos(uv.x*8-uv.y*4-time*.38+hash(id+53)*6.283);
  const wind={x:nx*radius+curl*turbulence*.45,y:-ny*radius+curl2*turbulence*.45-.12*flight*hash(id+54),z:(hash(id+55)-.5)*radius*.65+curl*turbulence*.3};
  let burst=burstEnvelope(progress,id,c);
  const t=(time-burstStart)/transitionDuration(c);if(t>=0&&t<1)burst=Math.max(burst,burstEnvelope(t,id,c));
  // Radial exponential distribution avoids the old box-shaped explosion.
  const azimuth=hash(id+63)*Math.PI*2,vertical=hash(id+64)*2-1,ring=Math.sqrt(Math.max(0,1-vertical*vertical));
  const reach=Math.min(3,.2-Math.log(Math.max(.005,1-hash(id+65)))*.7),scatter=burst*(.4+c.splash*.8)*reach;
  return {x:position.x+wind.x*distance+Math.cos(azimuth)*ring*scatter,y:position.y+wind.y*distance+vertical*scatter,z:position.z+wind.z*distance+Math.sin(azimuth)*ring*scatter,erosion};
}
export function projectParticle(pos,c,aspect,time=0){
  const yaw=(c.yaw+(c.autoOrbit?Math.sin(time*.19)*10:0))*Math.PI/180,pitch=c.pitch*Math.PI/180;
  const rx=pos.x*Math.cos(yaw)+pos.z*Math.sin(yaw),rz=-pos.x*Math.sin(yaw)+pos.z*Math.cos(yaw);
  const ry=pos.y*Math.cos(pitch)-rz*Math.sin(pitch),dz=pos.y*Math.sin(pitch)+rz*Math.cos(pitch),scale=2.6*c.cameraZoom/Math.max(.4,cameraDistance(c)-dz);
  return{x:.5+rx*scale/aspect/2,y:.5-ry*scale/2,z:dz,scale};
}
// The exact same field positions tracking anchors and GPU points. No integration
// or previous-frame dependency: exports, seeks and preview share one timeline.
export const motionGLSL=`
float hash(float n){uint x=uint(max(0.0,n)+1.0);x^=x>>16;x*=0x7feb352du;x^=x>>15;x*=0x846ca68bu;x^=x>>16;return float(x&0x00ffffffu)/16777216.0;}
float softer(float a,float b,float x){float t=clamp((x-a)/(b-a),0.0,1.0);return t*t*t*(t*(t*6.0-15.0)+10.0);}
vec3 cloudPosition(vec2 uv,float depth,float id,float layer){
 if(uGeometry.x<1.5){
  float halfDepth=uCloud.x*uVolume.x*(uGeometry.x<.5?.36:.6)*(uGeometry.x>.5?max(.025,depth):1.0);
  return vec3((uv.x-.5)*1.8*uSize.x/uSize.y,(.5-uv.y)*1.8,halfDepth*layer);
 }
 float raw=(depth-.5)*uCloud.x*1.6*uVolume.x;
 float z=2.2*raw/sqrt(4.84+raw*raw)+(hash(id+27.0)-.5)*uVolume.y*uCloud.x,ray=(3.2-z)/3.2;
 return vec3((uv.x-.5)*1.8*uSize.x/uSize.y*ray,(.5-uv.y)*1.8*ray,z);
}
float rearLength(){return uCloud.x*uVolume.x*(uGeometry.x<.5?.72:1.2);}
float particleLayer(float id){float kind=hash(id+101.0);return uGeometry.x>1.5||kind<${FRONT_LAYER_END}?1.0:kind>=${REAR_EMITTER_START}?-.28*hash(id+109.0):1.0-2.0*hash(id+109.0);}
vec4 rearParticle(vec3 pos,vec2 uv,float id,float layer){
 float length=rearLength(),amount=uGeometry.x>1.5?0.0:softer(0.0,.18,length);if(amount<=0.0)return vec4(pos,1.0);
 if(hash(id+101.0)>=${REAR_EMITTER_START}){
  float age=fract(uTime*(.08+.18*uRear.w)+hash(id+151.0)),birth=softer(0.0,.13,age),death=1.0-softer(.3,1.0,age);
  float angle=hash(id+163.0)*6.28318530718,radius=sqrt(-2.0*log(max(.003,hash(id+167.0))));
  float spread=length*uRear.z*(.015+.18*age+.12*age*age),curl=sin(uv.y*8.0+hash(id+173.0)*6.283+uTime*.4+age*3.0);
  pos.xy+=amount*spread*vec2(cos(angle)*radius+curl*.3,sin(angle)*radius+cos(curl+uv.x*9.0)*.3);
  pos.z-=amount*length*(.35+uRear.y*.9)*age;
  float opacity=.44*uRear.x*birth*death*(.8+.2*hash(id+179.0));return vec4(pos,mix(1.0,opacity,amount));
 }
 float fade=softer(.5,1.0,(1.0-layer)*.5),grain=length*uRear.z*fade*.12;
 pos+=grain*vec3(sin(id*1.37+uTime*.31),cos(id*2.19-uTime*.27),-(.5+.5*sin(id*.73+uTime*.2)));
 return vec4(pos,mix(1.0,pow(1.0-fade,1.6),amount));
}
float burstEnvelope(float t,float id){
 float softness=uMotion.w,lag=hash(id+81.0)*softness*.14;
 float outgoing=clamp(.55/(.6+uMotion.y),.16,.7)*(.4+.6*softness);
 return softer(lag,min(.8,lag+outgoing),t)*(1.0-softer(.36+softness*.16+lag*.4,1.0,t));
}
vec4 deformParticle(vec3 pos,vec2 uv,float id,float sideFlow){
 float feather=.025+uDrift.x*.55,strength=clamp(uMotion.x/2.0,0.0,1.0);
 float side=smoothstep(-feather,feather,dot(uv-.5,uLine.xy)-uLine.z*.5);if(uLine.w>.5)side=1.0-side;
 float threshold=hash(id+39.0)*.72,release=softer(threshold,threshold+.28,side*strength);
 float age=fract(uTime*(.035+.11*uDrift.z)+hash(id+41.0)),back=clamp(.42/(.35+uMotion.z),.2,.65),outbound=1.0-back;
 float flight=softer(0.0,1.0,age<outbound?age/outbound:(1.0-age)/back),erosion=release*flight*sideFlow;
 float distance=erosion*uDrift.y*(.3+strength*1.9);
 float radius=min(2.8,.25-log(max(.005,1.0-hash(id+51.0)))*.55);
 float curl=sin(uv.y*9.0+uv.x*5.0+uTime*.45+hash(id+52.0)*6.283);
 float curl2=cos(uv.x*8.0-uv.y*4.0-uTime*.38+hash(id+53.0)*6.283);
 vec3 wind=vec3(uLine.x*radius+curl*uDrift.w*.45,-uLine.y*radius+curl2*uDrift.w*.45-.12*flight*hash(id+54.0),(hash(id+55.0)-.5)*radius*.65+curl*uDrift.w*.3);
 float burst=burstEnvelope(uProgress,id),t=(uTime-uEvents.x)/uEvents.y;if(t>=0.0&&t<1.0)burst=max(burst,burstEnvelope(t,id));
 float azimuth=hash(id+63.0)*6.28318530718,vertical=hash(id+64.0)*2.0-1.0,ring=sqrt(max(0.0,1.0-vertical*vertical));
 float reach=min(3.0,.2-log(max(.005,1.0-hash(id+65.0)))*.7),scatter=burst*(.4+uMotion.y*.8)*reach;
 pos+=wind*distance+vec3(cos(azimuth)*ring,vertical,sin(azimuth)*ring)*scatter;
 return vec4(pos,erosion);
}`;
