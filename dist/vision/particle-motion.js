const clamp=x=>Math.max(0,Math.min(1,x));
export const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t);};
export const softer=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*t*(t*(t*6-15)+10);};
export function particleHash(n){let x=(Math.max(0,n)+1)>>>0;x^=x>>>16;x=Math.imul(x,0x7feb352d);x^=x>>>15;x=Math.imul(x,0x846ca68b);x^=x>>>16;return(x&0x00ffffff)/16777216;}
export const transitionDuration=c=>(1.6+2*(c.transitionSoftness??.8))/(.4+c.gather*.85);
export const extrusionLength=c=>c.relief*(c.depthStretch??1)*1.2;
export const cameraDistance=c=>3.2+(c.depthMode==='surface'?0:extrusionLength(c)*.5);
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
export function deformParticle(position,uv,id,c,time,{progress=0,burstStart=-100}={}){
  const hash=particleHash,angle=c.lineAngle*Math.PI/180,nx=Math.cos(angle),ny=Math.sin(angle);
  const feather=.025+(c.driftSoftness??.5)*.55,strength=clamp(c.drift/2);
  let side=smooth(-feather,feather,(uv.x-.5)*nx+(uv.y-.5)*ny-c.linePosition*.5);if(c.flipSide)side=1-side;
  const threshold=hash(id+39)*.72,release=softer(threshold,threshold+.28,side*strength);
  // Each particle has its own age. The quintic flight returns to its anchor
  // with zero velocity and acceleration, including at the lifetime seam.
  const age=(time*(.035+.11*(c.driftSpeed??.45))+hash(id+41))%1;
  const back=Math.max(.2,Math.min(.65,.42/(.35+c.gather))),out=1-back;
  const flight=softer(0,1,age<out?age/out:(1-age)/back),erosion=release*flight;
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
  float halfDepth=uCloud.x*uVolume.x*.6*(uGeometry.x>.5?max(.025,depth):1.0);
  return vec3((uv.x-.5)*1.8*uSize.x/uSize.y,(.5-uv.y)*1.8,halfDepth*layer);
 }
 float raw=(depth-.5)*uCloud.x*1.6*uVolume.x;
 float z=2.2*raw/sqrt(4.84+raw*raw)+(hash(id+27.0)-.5)*uVolume.y*uCloud.x,ray=(3.2-z)/3.2;
 return vec3((uv.x-.5)*1.8*uSize.x/uSize.y*ray,(.5-uv.y)*1.8*ray,z);
}
float burstEnvelope(float t,float id){
 float softness=uMotion.w,lag=hash(id+81.0)*softness*.14;
 float outgoing=clamp(.55/(.6+uMotion.y),.16,.7)*(.4+.6*softness);
 return softer(lag,min(.8,lag+outgoing),t)*(1.0-softer(.36+softness*.16+lag*.4,1.0,t));
}
vec4 deformParticle(vec3 pos,vec2 uv,float id){
 float feather=.025+uDrift.x*.55,strength=clamp(uMotion.x/2.0,0.0,1.0);
 float side=smoothstep(-feather,feather,dot(uv-.5,uLine.xy)-uLine.z*.5);if(uLine.w>.5)side=1.0-side;
 float threshold=hash(id+39.0)*.72,release=softer(threshold,threshold+.28,side*strength);
 float age=fract(uTime*(.035+.11*uDrift.z)+hash(id+41.0)),back=clamp(.42/(.35+uMotion.z),.2,.65),outbound=1.0-back;
 float flight=softer(0.0,1.0,age<outbound?age/outbound:(1.0-age)/back),erosion=release*flight;
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
