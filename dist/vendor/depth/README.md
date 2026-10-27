# Local depth inference

All assets are served from this folder. No uploads or remote inference.

- `fastdepth.onnx`: unmodified FastDepth opset-7 model (5,775,869 bytes), distributed by Bonjour Interactive Lab in `com.bonjour-lab.monoculardepth@1.0.6-preview` on npm. Model authors: Diana Wofk, Fangchang Ma, Tien-Ju Yang, Sertac Karaman and Vivienne Sze, MIT. https://fastdepth.mit.edu/ and https://github.com/dwofk/fast-depth . Packaging: https://github.com/Bonjour-Interactive-Lab/Unity3D-MonocularDepthEstimation . Both MIT licences are included.
- `ort.wasm.min.js` and `ort-wasm-simd.wasm`: unmodified files from `onnxruntime-web@1.17.3`, Microsoft, MIT. https://github.com/microsoft/onnxruntime/tree/v1.17.3 . Licence included.

Input: RGB float32 NCHW [1,3,224,224], channels divided by 255. Output: relative camera distance, normalized with 2nd/98th percentiles and inverted so nearer parts have larger values. RGB source textures remain separate from the depth texture.

The studio's WebGL renderer, motion, controls and tracker code are original. Gather · 聚 by DAO was used as a visual reference: https://gather.be-of-dao.com/ . No Gather application source is included.
