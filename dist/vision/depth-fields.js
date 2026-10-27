// FastDepth predicts camera distance, so near surfaces have smaller raw values.
export function normalizeDepth(values, previousRange = null) {
  const sorted = Array.from(values).filter(Number.isFinite).sort((a,b) => a-b);
  if (!sorted.length) throw new Error('The depth model returned no valid distances.');
  let near=sorted[Math.floor((sorted.length-1)*.02)], far=sorted[Math.floor((sorted.length-1)*.98)];
  if (previousRange) { near=previousRange.near*.8+near*.2; far=previousRange.far*.8+far*.2; }
  const span=far-near, data=new Float32Array(values.length);
  for(let i=0;i<data.length;i++) data[i]=Number.isFinite(values[i])&&span>.001?Math.max(0,Math.min(1,1-(values[i]-near)/span)):.5;
  return { data, range:{near,far} };
}
export function sampleDepth(map,x,y) {
  if (!map?.data) return .5;
  const fx=Math.max(0,Math.min(map.width-1,x*(map.width-1))), fy=Math.max(0,Math.min(map.height-1,y*(map.height-1)));
  const ix=Math.floor(fx),iy=Math.floor(fy),jx=Math.min(ix+1,map.width-1),jy=Math.min(iy+1,map.height-1),dx=fx-ix,dy=fy-iy;
  const a=map.data[iy*map.width+ix]*(1-dx)+map.data[iy*map.width+jx]*dx;
  const b=map.data[jy*map.width+ix]*(1-dx)+map.data[jy*map.width+jx]*dx;
  return a*(1-dy)+b*dy;
}
export function imagePlacement(sw,sh,w,h,fit='cover',position='50% 50%') {
  const [px=.5,py=.5]=String(position).split(' ').map(value=>parseFloat(value)/100);
  const scale=fit==='contain'?Math.min(w/sw,h/sh):Math.max(w/sw,h/sh);
  return { x:(w-sw*scale)*px, y:(h-sh*scale)*py, width:sw*scale, height:sh*scale };
}
