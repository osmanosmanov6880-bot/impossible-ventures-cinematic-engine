import { cp, rm, mkdir, writeFile, readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyAssets } from './verify-assets.mjs';

const ROOT=resolve(fileURLToPath(new URL('../',import.meta.url)));
const OUT=resolve(ROOT,'dist');
const assets=await verifyAssets();
if(!OUT.startsWith(ROOT+'/'))throw Error('Refusing unsafe build path');
await rm(OUT,{recursive:true,force:true});
await mkdir(OUT,{recursive:true});
for(const path of ['index.html','styles.css']){
  await cp(join(ROOT,path),join(OUT,path));
}
for(const directory of ['src','assets']){
  await cp(join(ROOT,directory),join(OUT,directory),{recursive:true});
}
const manifest={
  schema:'iv.cinematic.assets/1',
  version:assets.version,
  frames:assets.assets.filter(a=>a.path.startsWith('assets/frames')),
  totalSourceBytes:assets.bytes,
  visualQualityDisclosure:assets.visualClaim,
  sourceControl:'Procedural vector illustrations are included; prompts for optional photoreal assets are in docs/ASSET_PROMPTS.md',
  analytics:'No external analytics or person-specific tracking',
  services:'No paid AI APIs or continuous video'
};
await writeFile(join(OUT,'assets','manifest.json'),JSON.stringify(manifest,null,2)+'\n','utf8');
const html=await readFile(join(OUT,'index.html'),'utf8');
if(!html.includes('./src/app.mjs')||!html.includes('PROTOCOL ZERO'))throw Error('Broken built entrypoint');
process.stdout.write('Static cinematic release built: dist/ (18 matte frames, 7 worlds, 2 endings, no backend).\n');
