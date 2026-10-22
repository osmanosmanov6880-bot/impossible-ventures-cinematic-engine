import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { assertStory, STORY } from '../src/story.mjs';
import { graphAudit } from '../src/engine.mjs';

const ROOT=resolve(fileURLToPath(new URL('../',import.meta.url)));
const files=['index.html','styles.css','assets/brand.svg',
  'src/story.mjs','src/engine.mjs','src/visual.mjs','src/audio.mjs','src/app.mjs',
  ...Array.from({length:18},(_,i)=>'assets/frames/shot_'+String(i).padStart(2,'0')+'.svg')];

export async function verifyAssets(){
  const graph=graphAudit(),assets=[];
  let total=0;
  for(const path of files){
    const file=resolve(ROOT,path);
    const info=await stat(file);
    if(!info.isFile() || !info.size || info.size>1_800_000)
      throw Error('Asset missing, empty, or too large: '+path);
    const body=await readFile(file);
    const text=body.toString('utf8');
    if(path.endsWith('.svg')){
      if(!text.startsWith('<svg') || !text.includes('viewBox="0 0 1600 900"') ||
         /<script\b|<foreignObject\b|(?:xlink:)?href\s*=\s*['"](?:https?:|data:|javascript:)/i.test(text))
        throw Error('Unsafe or malformed vector painting: '+path);
    }
    if(path==='index.html'){
      for(const marker of ['id="film"','id="portalGrid"','id="choiceArea"',
        'id="mapDialog"','id="soundButton"','id="downloadRoute"']){
        if(!text.includes(marker))throw Error('Missing film control '+marker);
      }
      if(/<script(?![^>]*type="module")/.test(text))throw Error('Unexpected inline script');
    }
    if(path.startsWith('assets/frames/')){
      const n=Number(path.match(/shot_(\d\d)/)[1]);
      if(STORY['s'+String(n).padStart(2,'0')].frame!==path)throw Error('Frame manifest mismatch');
    }
    total+=info.size;
    assets.push({path,mediaType:path.endsWith('.svg')?'image/svg+xml':
      path.endsWith('.css')?'text/css':path.endsWith('.mjs')?'text/javascript':'text/html',
      bytes:info.size,sha256:createHash('sha256').update(body).digest('hex'),
      raster:false,...(path.endsWith('.svg')?{nativeVectorViewBox:'1600x900'}:{})});
  }
  if(graph.scenes!==18||graph.worlds!==7)throw Error('Story inventory mismatch');
  return {version:'1.0.0',assetCount:assets.length,bytes:total,
    visualClaim:'Original 1600x900-viewBox vector matte paintings, NOT photoreal 8K raster stills',
    paidServices:false,assets,graph};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const output=await verifyAssets();
  process.stdout.write('Asset and graph QA passed: '+output.assetCount+
    ' source files, '+output.graph.scenes+' scenes, '+output.graph.worlds+
    ' worlds; '+output.bytes+' bytes.\n');
}
