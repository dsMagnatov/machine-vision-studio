import { motionGLSL } from './particle-motion.js';
export const vertex=`#version 300 es
precision highp float;precision highp int;precision highp sampler2D;
uniform sampler2D uA;uniform sampler2D uB;uniform sampler2D uDepthA;uniform sampler2D uDepthB;
uniform sampler2D uEdgesA;uniform sampler2D uEdgesB;
uniform vec2 uGrid;uniform vec2 uSize;
uniform vec4 uCloud;uniform vec4 uMotion;uniform vec4 uLine;uniform vec4 uCamera;uniform vec4 uTone;uniform vec4 uEvents;uniform vec4 uFitA;uniform vec4 uFitB;uniform vec4 uSeeds;
uniform vec4 uDrift;uniform vec4 uVolume;uniform vec4 uGeometry;uniform vec4 uEdges;uniform vec4 uEdgePixels;
uniform float uTime;uniform float uProgress;uniform float uGain;uniform float uInvert;out vec4 vColor;
${motionGLSL}
vec2 coord(float id,float seed){
 vec2 grid=(vec2(mod(id,uGrid.x),floor(id/uGrid.x))+vec2(hash(id+7.0),hash(id+17.0)))/uGrid;
 return uSeeds.z>.5?vec2(hash(id+seed*1.73+5.0),hash(id+seed*2.93+9.0)):grid;
}
float filteredDepth(sampler2D map,vec2 uv){
 vec2 radius=vec2(.004+.03*uVolume.z);float centre=texture(map,uv).r;
 float neighbours=texture(map,uv+vec2(radius.x,0.0)).r+texture(map,uv-vec2(radius.x,0.0)).r+texture(map,uv+vec2(0.0,radius.y)).r+texture(map,uv-vec2(0.0,radius.y)).r;
 float diagonals=texture(map,uv+radius).r+texture(map,uv-radius).r+texture(map,uv+vec2(radius.x,-radius.y)).r+texture(map,uv+vec2(-radius.x,radius.y)).r;
 return mix(centre,centre*.25+neighbours*.125+diagonals*.0625,uVolume.z);
}
vec4 geometry(sampler2D edges,float count,float width,vec2 pixel,vec2 uv,float id){
 // Front and back caps, contour walls, and a small amount of interior grain.
 // At zero depth these converge on the original flat image continuously.
 float kind=hash(id+101.0),layer=1.0,shade=1.0,amount=softer(0.0,.18,uCloud.x*uVolume.x);
 if(uGeometry.x>1.5)return vec4(uv,layer,shade);
 if(kind>.46&&kind<.71){layer=-1.0;shade=mix(1.0,.72,amount);}
 else if(kind>=.71&&kind<1.0-uVolume.y*.36&&count>.5){
  float index=min(count-1.0,floor(hash(id+103.0)*count));
  vec4 edge=texelFetch(edges,ivec2(int(mod(index,width)),int(floor(index/width))),0);
  vec2 normal=normalize(edge.zw+vec2(.00000001)),wall=edge.xy+vec2(-edge.w,edge.z)*(hash(id+107.0)-.5)-normal*pixel*1.35;
  uv=mix(uv,wall,amount);layer=hash(id+109.0)*2.0-1.0;
  shade=mix(1.0,.42+.36*abs(dot(normal,normalize(vec2(-.5,-.8)))),amount);
 }else if(kind>=.71){layer=hash(id+113.0)*2.0-1.0;shade=mix(1.0,.66,amount);}
 return vec4(uv,layer,shade);
}
void main(){
 float id=float(gl_VertexID);vec2 a=coord(id,uSeeds.x),b=coord(id,uSeeds.y);
 vec4 ga=geometry(uEdgesA,uEdges.y,uEdges.x,uEdgePixels.xy,a,id),gb=geometry(uEdgesB,uEdges.w,uEdges.z,uEdgePixels.zw,b,id);a=ga.xy;b=gb.xy;
 vec4 ca=texture(uA,a),cb=texture(uB,b);
 float da=filteredDepth(uDepthA,(a-uFitA.xy)/uFitA.zw),db=uProgress>.0001?filteredDepth(uDepthB,(b-uFitB.xy)/uFitB.zw):da;
 float p=softer(0.0,1.0,uProgress);vec2 uv=mix(a,b,p);vec3 pos=mix(cloudPosition(a,da,id,ga.z),cloudPosition(b,db,id,gb.z),p);
 vec4 moved=deformParticle(pos,uv,id);pos=moved.xyz;vec4 source=mix(ca,cb,p);
 float l=dot(source.rgb,vec3(.2126,.7152,.0722));l=mix(l,1.0-l,uInvert);float weight=smoothstep(max(0.0,uTone.y-.005),uTone.y+.025,l)*source.a;
 float yaw=uCamera.x,pitch=uCamera.y;vec3 q=vec3(pos.x*cos(yaw)+pos.z*sin(yaw),pos.y,-pos.x*sin(yaw)+pos.z*cos(yaw));
 vec3 r=vec3(q.x,q.y*cos(pitch)-q.z*sin(pitch),q.y*sin(pitch)+q.z*cos(pitch));float depth=max(.4,uCamera.w-r.z);
 gl_Position=vec4(r.x*2.6*uCamera.z/(uSize.x/uSize.y),r.y*2.6*uCamera.z,1.004008*depth-.2004008,depth);
 float flash=0.0;if(uEvents.z>=0.0){float f=uTime-uEvents.z;flash=exp(-max(0.0,f)*2.0)*step(0.0,f)*max(0.0,1.0-length(uv-.5)*1.4);}
 if(uCloud.w>.5){float scan=abs(r.z-(-1.0+2.0*fract(uTime*.13)));flash+=exp(-scan*scan*200.0)*.65;}
 vec3 rgb=mix(vec3(1.0-uTone.w),source.rgb,uTone.z);float grey=dot(rgb,vec3(.2126,.7152,.0722));rgb=mix(vec3(grey),rgb,uVolume.w);rgb=clamp((rgb-.5)*uTone.x+.5,0.0,1.0)*uCloud.z;
 rgb*=mix(ga.w,gb.w,p);vColor=vec4(mix(rgb,vec3(.78,.87,1.0),min(.45,flash)),weight*(1.0-moved.w*.68)*uGain);
 gl_PointSize=clamp(uCloud.y*max(.5,uSize.y/900.0)*(1.0+flash*.35)*3.2/depth,.6,12.0);
 if(weight<.006){vColor.a=0.0;gl_Position=vec4(3.0,3.0,0.0,1.0);}
}`;
export const fragment=`#version 300 es
precision highp float;in vec4 vColor;out vec4 color;
void main(){float r=length(gl_PointCoord-.5)*2.0;if(r>1.0||vColor.a<.006)discard;color=vec4(vColor.rgb,vColor.a*(1.0-smoothstep(.65,1.0,r)));}`;
