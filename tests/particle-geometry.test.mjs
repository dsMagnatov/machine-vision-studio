import test from 'node:test';
import assert from 'node:assert/strict';
import { contourAtlas,sphereDepth } from '../dist/vision/particle-geometry.js';
import { cloudPosition,projectParticle,cameraDistance,extrusionLength } from '../dist/vision/particle-motion.js';
import { particleDefaults } from '../dist/vision/particle-model.js';

test('extrusion has aligned front/back caps and straight walls regardless of image brightness',()=>{
  const c={...particleDefaults(),yaw:0,pitch:0,autoOrbit:false},uv={x:.65,y:.3};
  const front=cloudPosition(uv,.1,5,c,1,1),back=cloudPosition(uv,.9,5,c,1,-1),wall=cloudPosition(uv,.5,5,c,1,.2);
  assert.equal(front.x,back.x);assert.equal(front.y,back.y);assert.equal(wall.x,front.x);assert.equal(wall.y,front.y);
  assert.ok(Math.abs(front.z-back.z-extrusionLength(c))<1e-10);assert.ok(wall.z>back.z&&wall.z<front.z);
  assert.deepEqual(front,cloudPosition(uv,.9,5,c,1,1));
  const edge={...c,yaw:90};assert.ok(Math.abs(projectParticle(front,edge,1).x-projectParticle(back,edge,1).x)>.4);
  for(const layer of[-1,0,1])assert.equal(Math.abs(cloudPosition(uv,.5,5,{...c,relief:0},1,layer).z),0);
  const max={...c,relief:2,depthStretch:3};assert.ok(cameraDistance(max)-cloudPosition(uv,1,0,max,1).z>=3.2-1e-10);
});

test('marching contours include outer walls and inner holes, with outward normals',()=>{
  const width=12,height=12,image=new Uint8ClampedArray(width*height*4);
  for(let y=2;y<10;y++)for(let x=2;x<10;x++)if(x<4||x>7||y<4||y>7)image.set([255,100,30,255],(y*width+x)*4);
  const edges=contourAtlas(image,width,height);assert.ok(edges.count>40);
  let outer=0,inner=0;
  for(let i=0;i<edges.count;i++){
    const [x,y,nx,ny]=edges.data.slice(i*4,i*4+4);assert.ok(Number.isFinite(nx+ny));assert.ok(Math.hypot(nx,ny)>0);
    if(x>.34&&x<.66&&y>.34&&y<.66)inner++;else outer++;
  }
  assert.ok(inner>0&&outer>0);
  const left=Array.from({length:edges.count},(_,i)=>Array.from(edges.data.slice(i*4,i*4+4))).filter(([x,y])=>x<.18&&y>.25&&y<.75);
  assert.ok(left.length>0);assert.ok(left.every(([, ,nx])=>nx<0));
  assert.equal(contourAtlas(new Uint8ClampedArray(16),2,2).count,0);
  assert.equal(contourAtlas(image,width,height,{limit:8}).count,8);
});

test('analytic orb and AI volume produce two closed curved faces',()=>{
  const map=sphereDepth(),c={...particleDefaults(),depthMode:'volume'},front=cloudPosition({x:.5,y:.5},1,0,c,1,1),back=cloudPosition({x:.5,y:.5},1,0,c,1,-1);
  assert.equal(front.z,-back.z);assert.ok(front.z>0);
  const edge=cloudPosition({x:.75,y:.5},0,0,c,1,1);assert.ok(edge.z<front.z*.03);
  assert.ok(map.data[112*224+112]>.999);assert.equal(map.data[0],0);
});
