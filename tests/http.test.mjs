import test from 'node:test';
import assert from 'node:assert/strict';
import { createFilmServer } from '../scripts/serve.mjs';
import { verifyAssets } from '../scripts/verify-assets.mjs';

async function setup(t){
  const server=createFilmServer();
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(async()=>new Promise(resolve=>server.close(resolve)));
  return 'http://127.0.0.1:'+server.address().port;
}
test('film serves 18 real vector shots and only its own JS/CSS/brand',async t=>{
  const base=await setup(t);
  const assets=['/','/styles.css','/assets/brand.svg',
    '/src/app.mjs','/src/story.mjs','/src/engine.mjs','/src/audio.mjs','/src/visual.mjs',
    ...Array.from({length:18},(_,i)=>'/assets/frames/shot_'+String(i).padStart(2,'0')+'.svg')];
  for(const file of assets){
    const response=await fetch(base+file);
    assert.equal(response.status,200,file);
    const body=await response.text();
    assert.ok(body.length>50,'Expected real asset '+file);
    assert.match(response.headers.get('content-security-policy'),/script-src 'self'/);
    assert.match(response.headers.get('content-security-policy'),/connect-src 'none'/);
    assert.equal(response.headers.get('x-content-type-options'),'nosniff');
    if(file.endsWith('.mjs'))assert.match(response.headers.get('content-type'),/javascript/);
    if(file.endsWith('.svg')){
      assert.match(response.headers.get('content-type'),/image\/svg\+xml/);
      assert.match(body,/viewBox="0 0 1600 900"/);
    }
  }
});
test('strict web server denies path traversal, project internals, execution and unsafe methods',async t=>{
  const base=await setup(t);
  for(const path of [
    '/package.json','/README.md','/docs/STORYBOARD.md',
    '/scripts/serve.mjs','/.git/config','/.github/workflows/ci.yml',
    '/assets/frames/shot_18.svg','/src/../../../package.json',
    '/src/private.py','/assets/brand.js','/api/v1/experiments'
  ]){
    const response=await fetch(base+path);
    assert.equal(response.status,404,path);
  }
  assert.equal((await fetch(base+'/',{method:'POST'})).status,405);
  assert.equal((await fetch(base+'/',{method:'PUT'})).status,405);
  assert.equal((await fetch(base+'/src/engine.mjs',{method:'HEAD'})).status,200);
});
test('asset manifest QA describes vector sources honestly and blocks missing files',async()=>{
  const result=await verifyAssets();
  assert.equal(result.graph.scenes,18);
  assert.equal(result.graph.worlds,7);
  assert.equal(result.graph.locales,3);
  assert.equal(result.assets.filter(a=>a.path.startsWith('assets/frames/')).length,18);
  assert.ok(result.assets.every(a=>a.bytes>0));
  assert.match(result.visualClaim,/NOT photoreal 8K raster/);
  assert.equal(result.paidServices,false);
  assert.ok(result.bytes<2_000_000,'Cheap static assets should remain compact');
});
