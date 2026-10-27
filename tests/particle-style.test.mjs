import test from 'node:test';
import assert from 'node:assert/strict';
import { inkRGB } from '../dist/vision/particle-style.js';
import { normalizeParticles } from '../dist/vision/particle-model.js';

test('custom colors, paper contrast and saturation produce bounded RGB colors',()=>{
  assert.equal(inkRGB('#ff0000',[0,0,0]),'255,0,0');assert.equal(inkRGB('auto',[18,24,30]),'18,24,30');
  assert.equal(inkRGB('#ff0000',[0,0,0],0),'54,54,54');assert.equal(inkRGB('#ff0000',[0,0,0],2),'255,0,0');
  assert.equal(normalizeParticles({linkColor:'#aAbBcC',frameColor:'url(bad)',trackerColor:'auto',linkOpacity:0,frameOpacity:0,trackerInk:0}).linkColor,'#aabbcc');
  const c=normalizeParticles({frameColor:'url(bad)',linkOpacity:0,frameOpacity:0,trackerInk:0});assert.equal(c.frameColor,'auto');assert.equal(c.linkOpacity,0);assert.equal(c.frameOpacity,0);assert.equal(c.trackerInk,0);
});
