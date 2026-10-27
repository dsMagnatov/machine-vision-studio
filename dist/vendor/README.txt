Local, unmodified browser dependencies:

Mediabunny 1.62.1 — Mozilla Public License 2.0
https://mediabunny.dev/
https://github.com/Vanilagy/mediabunny
Source archive: mediabunny-source.tgz (the original npm package including src/)
https://registry.npmjs.org/mediabunny/-/mediabunny-1.62.1.tgz

gifenc 1.0.3 — MIT License
https://github.com/mattdesl/gifenc
https://registry.npmjs.org/gifenc/-/gifenc-1.0.3.tgz

Both encoders are served from this folder. Media is encoded on the device.

@mediabunny/aac-encoder 1.62.1 — Mozilla Public License 2.0
https://mediabunny.dev/guide/extensions/aac-encoder
https://registry.npmjs.org/@mediabunny/aac-encoder/-/aac-encoder-1.62.1.tgz
Source archive: aac-encoder-source.tgz (original package including src/)
Local change in mediabunny-aac-encoder.js: bare imports from "mediabunny"
are redirected to "./mediabunny.js". The bundled WASM encoder runs offline
and is loaded only when native AAC encoding is unavailable.
