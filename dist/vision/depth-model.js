import { normalizeDepth } from './depth-fields.js';

export class DepthEstimator {
  constructor(){this.worker=null;this.pending=new Map();this.serial=Promise.resolve();this.nextID=0;}
  async estimate(media,previousRange=null){
    // Capture before queuing: a playing video may advance while inference is busy.
    const canvas=document.createElement('canvas');canvas.width=canvas.height=224;
    const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.fillStyle='#000';ctx.fillRect(0,0,224,224);ctx.drawImage(media,0,0,224,224);
    const pixels=ctx.getImageData(0,0,224,224).data;canvas.width=canvas.height=1;
    const result=this.serial.then(()=>this.run(pixels));this.serial=result.catch(()=>{});
    const raw=await result, normalized=normalizeDepth(raw.values,previousRange);
    return {width:raw.width,height:raw.height,...normalized,model:'FastDepth'};
  }
  run(pixels){
    if(!this.worker){
      this.worker=new Worker(new URL('./depth-worker.js',import.meta.url));
      this.worker.onmessage=({data})=>{const pending=this.pending.get(data.id);if(!pending)return;this.pending.delete(data.id);clearTimeout(pending.timeout);data.error?pending.reject(new Error(data.error)):pending.resolve(data);};
      this.worker.onerror=event=>this.fail(new Error(event.message||'Could not start local depth inference.'));
    }
    return new Promise((resolve,reject)=>{
      const id=++this.nextID,timeout=setTimeout(()=>this.fail(new Error('Depth inference timed out. Retry depth analysis.')),45000);
      this.pending.set(id,{resolve,reject,timeout});this.worker.postMessage({id,pixels},[pixels.buffer]);
    });
  }
  fail(error){for(const task of this.pending.values()){clearTimeout(task.timeout);task.reject(error);}this.pending.clear();this.worker?.terminate();this.worker=null;}
  destroy(){this.fail(new Error('Depth estimator closed.'));}
}
