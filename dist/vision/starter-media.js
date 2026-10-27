import { loadMedia } from './media.js';
import { sphereDepth } from './particle-geometry.js';

function orb() {
  const canvas=document.createElement('canvas');canvas.width=1280;canvas.height=720;
  const ctx=canvas.getContext('2d');ctx.fillStyle='#000';ctx.fillRect(0,0,1280,720);
  const gradient=ctx.createRadialGradient(580,295,15,645,365,180);
  for(const [stop,color] of [[0,'#fff'],[.4,'#b7b7b7'],[.8,'#404040'],[1,'#040404']])gradient.addColorStop(stop,color);
  ctx.fillStyle=gradient;ctx.beginPath();ctx.arc(640,360,180,0,Math.PI*2);ctx.fill();
  return {media:canvas,kind:'image',width:1280,height:720,depthMap:sphereDepth(),particleOverrides:{depthMode:'volume',relief:.75,depthSmoothing:.1},thumbnail:canvas.toDataURL('image/jpeg',.6),destroy(){canvas.width=canvas.height=1;}};
}

// This list is rebuilt on every page load. Imported files stay in the current
// session and are never added to the built-in collection.
const starters=[
  {key:'gradient',name:'Demo gradient.jpg',asset:'demo.jpg'},
  {key:'logo',name:'Kailah-logo-full.png',asset:'Kailah-logo-full.png'},
  {key:'icon',name:'Kailah-icon.png',asset:'Kailah-icon.png'},
  {key:'orb',name:'Orb · particle study',create:orb},
  {key:'flowers',name:'Flowers.png',asset:'flowers.png'},
];

export function loadStarterMedia() {
  return Promise.allSettled(starters.map(async item=>({
    ...(item.create?item.create():await loadMedia({url:new URL(`../assets/${item.asset}`,import.meta.url).href,name:item.name})),
    name:item.name,starterKey:item.key,isVisionDemo:item.key==='gradient',isParticleDemo:item.key!=='gradient',
  })));
}
