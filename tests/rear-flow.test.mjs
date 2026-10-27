import test from 'node:test';
import assert from 'node:assert/strict';
import { particleDefaults } from '../dist/vision/particle-model.js';
import { particleLayer,particleHash,rearParticle,cloudPosition,deformParticle,projectParticle } from '../dist/vision/particle-motion.js';

const config=()=>({...particleDefaults(),drift:0,autoOrbit:false,yaw:0,pitch:0});
const bodyID=Array.from({length:100},(_,i)=>i).find(i=>particleHash(i+101)>.46&&particleHash(i+101)<.78);
const emitterID=Array.from({length:100},(_,i)=>i).find(i=>particleLayer(i,config()).emitter);

test('extruded geometry has a front face and distributed volume with no rear cap',()=>{
  const c=config(),layers=Array.from({length:8192},(_,i)=>particleLayer(i,c));
  assert.ok(layers.filter(p=>p.layer===1).length>3000);
  assert.ok(layers.filter(p=>p.emitter).length>1500);
  assert.ok(layers.every(p=>p.layer>-1&&p.layer<=1));
  assert.ok(layers.filter(p=>!p.emitter&&p.layer<0).length>1000);
});

test('body density stays intact through its middle and dissolves towards the rear edge',()=>{
  const c=config(),uv={x:.6,y:.4},p={x:.1,y:.2,z:0};
  const opacity=layer=>rearParticle(p,uv,bodyID,c,4,layer).opacity;
  assert.equal(opacity(1),1);assert.equal(opacity(0),1);
  assert.ok(opacity(-.4)<.8&&opacity(-.4)>.3);assert.ok(opacity(-.8)<.04);assert.equal(opacity(-1),0);
  const flat=rearParticle(p,uv,emitterID,{...c,relief:0},4,-.2);assert.deepEqual(flat,{...p,opacity:1,sideFlow:1,emitter:false});
});

test('rear grains flow one way, fade out before recycling and remain independent of lateral Drift',()=>{
  const c=config(),id=emitterID,uv={x:.6,y:.4},layer=particleLayer(id,c).layer,p=cloudPosition(uv,.7,id,c,1,layer);
  const rate=.08+.18*c.rearSpeed,phase=particleHash(id+151),time=age=>(1+age-phase)/rate;
  const at=age=>rearParticle(p,uv,id,c,time(age),layer),a=at(.2),b=at(.5),d=at(.8);
  assert.ok(a.z<p.z&&b.z<a.z&&d.z<b.z);assert.ok(at(.95).opacity<at(.3).opacity*.05);
  const wrap=time(1);assert.ok(rearParticle(p,uv,id,c,wrap-.00001,layer).opacity<1e-10);assert.ok(rearParticle(p,uv,id,c,wrap+.00001,layer).opacity<1e-10);
  assert.equal(a.sideFlow,0);
  const moved=deformParticle(a,uv,id,{...c,drift:2},time(.2),{sideFlow:a.sideFlow});
  assert.equal(moved.x,a.x);assert.equal(moved.y,a.y);assert.equal(moved.z,a.z);
  assert.deepEqual(rearParticle(p,uv,id,{...c,drift:2},time(.2),layer),a);
  assert.deepEqual(at(.5),b);
});

test('tail direction rotates with the object and legacy surface mode has no rear flow',()=>{
  const c=config(),uv={x:.5,y:.5},id=emitterID,layer=particleLayer(id,c).layer,p=cloudPosition(uv,.8,id,c,1,layer);
  const tail=rearParticle(p,uv,id,{...c,rearSpread:0},4,layer);
  assert.equal(tail.x,p.x);assert.equal(tail.y,p.y);assert.ok(tail.z<p.z);
  for(const yaw of[-60,60]){
    const camera={...c,yaw},front=projectParticle(p,camera,1),back=projectParticle(tail,camera,1);
    assert.equal(Math.sign(back.x-front.x),-Math.sign(yaw));
  }
  assert.deepEqual(rearParticle(p,uv,id,{...c,depthMode:'surface'},4,layer),{...p,opacity:1,sideFlow:1,emitter:false});
});
