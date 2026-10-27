/* Runs locally in a dedicated worker; no pictures leave the device. */
importScripts('../vendor/depth/ort.wasm.min.js');
let sessionPromise;
async function model() {
  if (!sessionPromise) {
    ort.env.wasm.wasmPaths=new URL('../vendor/depth/',self.location.href).href;
    ort.env.wasm.numThreads=1;
    ort.env.wasm.simd=true;
    sessionPromise=ort.InferenceSession.create(new URL('../vendor/depth/fastdepth.onnx',self.location.href).href,{executionProviders:['wasm'],graphOptimizationLevel:'all'}).catch(error=>{sessionPromise=null;throw error;});
  }
  return sessionPromise;
}
self.onmessage=async ({data:{id,pixels}})=>{
  try {
    const session=await model(), input=new Float32Array(3*224*224);
    for(let i=0;i<224*224;i++)for(let c=0;c<3;c++)input[c*224*224+i]=pixels[i*4+c]/255;
    const tensor=new ort.Tensor('float32',input,[1,3,224,224]);
    const results=await session.run({[session.inputNames[0]]:tensor});
    const output=results[session.outputNames[0]], values=new Float32Array(output.data);
    self.postMessage({id,width:output.dims.at(-1),height:output.dims.at(-2),values},[values.buffer]);
    tensor.dispose?.();for(const value of Object.values(results))value.dispose?.();
  }catch(error){self.postMessage({id,error:`Depth model: ${error.message||error}`});}
};
