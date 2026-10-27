import test from 'node:test';
import assert from 'node:assert/strict';
import { particleDefaults, normalizeParticles, sourceSeed, gatheringDuration, particlePair, particlePose } from '../dist/vision/particle-model.js';
import { exportName } from '../dist/vision/formats.js';

test('particle settings clamp unsafe values and remain separate from tracking settings', () => {
  const c = normalizeParticles({ density: 131072, yaw: 900, drift: -10, pointSize: NaN, sourceColors: true, threshold: 3 });
  assert.equal(c.density, '131072'); assert.equal(c.yaw, 180); assert.equal(c.drift, 0);
  assert.equal(c.pointSize, particleDefaults().pointSize); assert.equal(c.sourceColors, true); assert.equal('threshold' in c, false);
  assert.equal(normalizeParticles({ density: '99999999', travel: 'unknown' }).density, '524288');
});
test('manual picture transitions finish on the selected picture', () => {
  const c=particleDefaults(),a={id:'a'},b={id:'b'},duration=gatheringDuration(c);
  const middle=particlePair([b],c,10+duration/2,10,a);
  assert.equal(middle.from,a);assert.equal(middle.to,b);assert.ok(Math.abs(middle.progress-.5)<1e-8);
  const finished=particlePair([b],c,10+duration+.1,10,a);
  assert.equal(finished.from,b);assert.equal(finished.to,b);assert.equal(finished.progress,0);
});
test('picture cycling holds each source then gathers into the next one', () => {
  const c={...particleDefaults(),cycle:true,hold:1},a={id:'a'},b={id:'b'},duration=gatheringDuration(c);
  assert.equal(particlePair([a,b],c,.5).progress,0);
  assert.ok(Math.abs(particlePair([a,b],c,1+duration/2).progress-.5)<1e-8);
  assert.equal(particlePair([a,b],c,1+duration+.1).from,b);
  assert.equal(particlePair([],c,0),null);
});
test('camera projection supports centered, mirrored, zoomed and rotated geometry', () => {
  const c={...particleDefaults(),yaw:0,pitch:0,relief:0};
  assert.deepEqual(particlePose({x:.5,y:.5},.5,c,16/9),{x:.5,y:.5});
  const left=particlePose({x:.3,y:.5},.5,c,16/9),right=particlePose({x:.7,y:.5},.5,c,16/9);
  assert.ok(Math.abs((.5-left.x)-(right.x-.5))<1e-8);
  const zoom=particlePose({x:.7,y:.5},.5,{...c,cameraZoom:2},16/9);
  assert.ok(Math.abs((zoom.x-.5)-2*(right.x-.5))<1e-8);
  const side=particlePose({x:.7,y:.5},.5,{...c,yaw:90},16/9);assert.ok(Math.abs(side.x-.5)<1e-8);
});
test('source seeds and particle file names are stable and distinct', () => {
  assert.equal(sourceSeed('a'),sourceSeed('a'));assert.notEqual(sourceSeed('a'),sourceSeed('b'));
  assert.ok(sourceSeed('sample')>=0&&sourceSeed('sample')<65521);
  assert.equal(exportName('image.png',{width:1920,height:1080},'mp4','particles'),'image-particle-flow-1920x1080.mp4');
});
