import {cp,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {dirname,join} from 'node:path';
const require=createRequire(import.meta.url);
const wasm=join(dirname(require.resolve('@mediapipe/tasks-vision')),'wasm');
const out=new URL('../public/vision/',import.meta.url);
await mkdir(out,{recursive:true});
await cp(wasm,out,{recursive:true});
