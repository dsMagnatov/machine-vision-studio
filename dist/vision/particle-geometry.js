// A contour atlas supplies the side walls of the extrusion. Sampling only
// random image pixels creates two caps with an empty gap when viewed edge-on.
export function contourAtlas(image,width,height,{cutoff=.01,invert=false,limit=32768}={}){
  const mask=new Float32Array(width*height),threshold=cutoff+.018;
  for(let i=0;i<mask.length;i++){
    const k=i*4,l=(image[k]*.2126+image[k+1]*.7152+image[k+2]*.0722)/255;
    mask[i]=(invert?1-l:l)*image[k+3]/255;
  }
  const value=(x,y)=>x<0||y<0||x>=width||y>=height?0:mask[y*width+x];
  const sample=(x,y)=>{
    const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy;
    return(value(ix,iy)*(1-fx)+value(ix+1,iy)*fx)*(1-fy)+(value(ix,iy+1)*(1-fx)+value(ix+1,iy+1)*fx)*fy;
  };
  const segments=[];
  const segment=(a,b)=>{
    const dx=(b.x-a.x)/width,dy=(b.y-a.y)/height,mx=(a.x+b.x)/2,my=(a.y+b.y)/2;
    let nx=dy,ny=-dx;
    const length=Math.hypot(nx*width,ny*height)||1;
    if(sample(mx+nx*width/length*.6,my+ny*height/length*.6)>sample(mx-nx*width/length*.6,my-ny*height/length*.6)){nx=-nx;ny=-ny;}
    segments.push((mx+.5)/width,(my+.5)/height,nx,ny);
  };
  for(let y=-1;y<height;y++)for(let x=-1;x<width;x++){
    const v0=value(x,y),v1=value(x+1,y),v2=value(x+1,y+1),v3=value(x,y+1);
    const bits=(v0>=threshold?1:0)|(v1>=threshold?2:0)|(v2>=threshold?4:0)|(v3>=threshold?8:0);
    if(bits===0||bits===15)continue;
    const corners=[{x,y},{x:x+1,y},{x:x+1,y:y+1},{x,y:y+1}],values=[v0,v1,v2,v3],crossings=[];
    for(let i=0;i<4;i++){
      const j=(i+1)%4;if((values[i]>=threshold)===(values[j]>=threshold))continue;
      const t=(threshold-values[i])/(values[j]-values[i]);
      crossings.push({x:corners[i].x+(corners[j].x-corners[i].x)*t,y:corners[i].y+(corners[j].y-corners[i].y)*t});
    }
    if(crossings.length===2)segment(crossings[0],crossings[1]);
    else if(crossings.length===4){segment(crossings[0],crossings[1]);segment(crossings[2],crossings[3]);}
  }
  const total=segments.length/4,count=Math.min(limit,total),atlasWidth=256,atlasHeight=Math.max(1,Math.ceil(count/atlasWidth)),data=new Float32Array(atlasWidth*atlasHeight*4);
  for(let i=0;i<count;i++){const k=Math.floor(i*total/count)*4;data.set(segments.slice(k,k+4),i*4);}
  return{data,width:atlasWidth,height:atlasHeight,count,pixel:[1/width,1/height]};
}

export function sphereDepth(width=224,height=224){
  const data=new Float32Array(width*height);
  // The built-in orb occupies a circle of radius 180 in its 1280×720 source.
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const nx=((x+.5)/width-.5)*1280/180,ny=((y+.5)/height-.5)*720/180;
    data[y*width+x]=Math.sqrt(Math.max(0,1-nx*nx-ny*ny));
  }
  return{width,height,data,model:'Sphere'};
}
