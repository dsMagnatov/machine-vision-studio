import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeDepth,sampleDepth,imagePlacement } from '../dist/vision/depth-fields.js';
import { cloudPosition,deformParticle,projectParticle,particleHash } from '../dist/vision/particle-motion.js';
import { particleDefaults,gatheringDuration,particleConfigAt } from '../dist/vision/particle-model.js';

test('camera distances become near-to-far depth, reject invalid values and tolerate constant output',()=>{
  const map=normalizeDepth([1,2,3,4,5,NaN]);assert.equal(map.data[0],1);assert.equal(map.data[4],0);assert.equal(map.data[5],.5);
  assert.ok(Array.from(normalizeDepth([2,2,2]).data).every(value=>value===.5));assert.throws(()=>normalizeDepth([NaN]),/no valid/);
  const smoothed=normalizeDepth([2,3,4,5,6],{near:1,far:5});assert.ok(smoothed.range.near<2&&smoothed.range.near>1);
});
test('bilinear depth sampling and framing preserve alignment for crop and letterboxing',()=>{
  const map={width:2,height:2,data:new Float32Array([0,1,1,0])};assert.equal(sampleDepth(map,.5,.5),.5);assert.equal(sampleDepth(map,1,0),1);assert.equal(sampleDepth(null,.4,.3),.5);
  assert.deepEqual(imagePlacement(200,100,100,100,'contain'),{x:0,y:25,width:100,height:50});
  assert.deepEqual(imagePlacement(200,100,100,100,'cover','100% 50%'),{x:-100,y:0,width:200,height:100});
});
test('depth changes create parallax while the original front-view composition stays aligned',()=>{
  const c={...particleDefaults(),depthMode:'surface',yaw:0,pitch:0,autoOrbit:false},uv={x:.65,y:.4};
  const near=cloudPosition(uv,.9,10,c,16/9),far=cloudPosition(uv,.1,10,c,16/9);
  assert.ok(near.z-far.z>1);const frontA=projectParticle(near,c,16/9),frontB=projectParticle(far,c,16/9);
  assert.ok(Math.abs(frontA.x-frontB.x)<1e-8);assert.ok(Math.abs(frontA.y-frontB.y)<1e-8);
  const turn={...c,yaw:40};assert.ok(Math.abs(projectParticle(near,turn,16/9).x-projectParticle(far,turn,16/9).x)>.1);
});
test('drift keeps a dense core and a continuous tail instead of releasing a whole slab at once',()=>{
  const c={...particleDefaults(),drift:2},position={x:0,y:0,z:0};
  const cloud=Array.from({length:512},(_,id)=>deformParticle(position,{x:.9,y:.5},id,c,5));
  assert.ok(cloud.filter(p=>p.erosion<.05).length>80);assert.ok(cloud.filter(p=>p.erosion>.6).length>150);
  let medium=0,maximum=0;
  for(let id=0;id<512;id++){
    const held=deformParticle(position,{x:.05,y:.5},id,c,5);assert.equal(held.erosion,0);assert.equal(held.x,0);
    const mid=deformParticle(position,{x:.9,y:.5},id,{...c,drift:1},5);medium+=Math.hypot(mid.x,mid.y,mid.z);maximum+=Math.hypot(cloud[id].x,cloud[id].y,cloud[id].z);
  }
  assert.ok(maximum>medium*2);
});
test('grain lifetimes join without a position or velocity jump',()=>{
  const c={...particleDefaults(),drift:2},id=137,frequency=.035+.11*c.driftSpeed,base=particleHash(id+41),wrap=(2-base)/frequency;
  const at=t=>deformParticle({x:.1,y:.2,z:.3},{x:.9,y:.5},id,c,t),before=at(wrap-.0001),after=at(wrap+.0001);
  assert.ok(Math.hypot(after.x-before.x,after.y-before.y,after.z-before.z)<1e-7);
  const near=at(wrap-.001),seam=at(wrap);assert.ok(Math.hypot(seam.x-near.x,seam.y-near.y,seam.z-near.z)/.001<.001);
});
test('flow controls interpolate and depth stretching increases volume without crossing the camera',()=>{
  const from={...particleDefaults(),drift:0},to={...from,drift:2,linkWidth:3},tween={from,start:5,duration:.6};
  assert.equal(particleConfigAt(to,tween,5).drift,0);assert.ok(Math.abs(particleConfigAt(to,tween,5.3).drift-1)<1e-8);assert.equal(particleConfigAt(to,tween,6).drift,2);
  assert.equal(particleConfigAt(to,tween,5.1).linkWidth,3);assert.equal(particleConfigAt({...to,animate:false},tween,5).drift,2);
  const p={x:.5,y:.5},small=cloudPosition(p,.9,1,{...to,depthStretch:.25},1),large=cloudPosition(p,.9,1,{...to,depthStretch:3},1);
  assert.ok(large.z>small.z*2);assert.ok(large.z<3.2);
});
test('manual scattering gathers back exactly and motion is independent of render history',()=>{
  const c={...particleDefaults(),drift:0},position={x:.1,y:.2,z:.3},uv={x:.5,y:.5},burstStart=2;
  const blown=deformParticle(position,uv,17,c,burstStart+gatheringDuration(c)*.4,{burstStart});assert.ok(Math.hypot(blown.x-.1,blown.y-.2,blown.z-.3)>.1);
  const end=deformParticle(position,uv,17,c,burstStart+gatheringDuration(c),{burstStart});assert.equal(end.x,position.x);assert.equal(end.y,position.y);assert.equal(end.z,position.z);
  const first=deformParticle(position,uv,17,c,3,{burstStart});deformParticle(position,uv,17,c,40,{burstStart});assert.deepEqual(deformParticle(position,uv,17,c,3,{burstStart}),first);
  assert.equal(particleDefaults().sourceColors,true);
});
