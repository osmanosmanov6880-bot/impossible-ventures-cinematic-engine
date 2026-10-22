import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { createFilmServer } from '../scripts/serve.mjs';

async function fixture(t,{width=1440,height=900,reducedMotion='no-preference'}={}){
  const server=createFilmServer();
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser=await chromium.launch({headless:true,args:['--disable-dev-shm-usage']});
  const context=await browser.newContext({
    viewport:{width,height},reducedMotion,acceptDownloads:true,deviceScaleFactor:1
  });
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',error=>errors.push('page: '+error.message));
  page.on('console',message=>{if(message.type()==='error')errors.push('console: '+message.text())});
  t.after(async()=>{
    await context.close();await browser.close();
    await new Promise(resolve=>server.close(resolve));
  });
  return {base:'http://127.0.0.1:'+server.address().port,page,errors};
}
async function scene(page,id){
  await page.waitForFunction(id=>document.querySelector('#film')?.dataset.scene===id,id);
  return await page.locator('#sceneTitle').innerText();
}
async function introToHub(page){
  for(let i=0;i<4;i++)await page.locator('#nextButton').click();
  await scene(page,'s04');
}
async function enterWorld(page,index,{fragment=true,decision=0}={}){
  await page.locator('#portalGrid .portal-card').nth(index).click();
  const id='s'+String(index+5).padStart(2,'0');
  await scene(page,id);
  if(fragment){
    await page.locator('#detailButton').click();
    assert.equal(await page.locator('#detailPanel').isVisible(),true);
  }
  await page.locator('#choices .choice-btn').nth(decision).click();
  assert.equal(await page.locator('#consequence').isVisible(),true);
  await page.locator('#nextButton').click();
  await scene(page,'s04');
}
async function screenshot(page,file){
  await mkdir('artifacts',{recursive:true});
  await page.screenshot({path:'artifacts/'+file,fullPage:true,animations:'disabled'});
}
test('full cinematic route with three fragments, real secret archive, free ending and downloaded path',async t=>{
  const {page,base,errors}=await fixture(t);
  const remote=[];
  page.on('request',req=>{
    const url=new URL(req.url());
    if(url.origin!==new URL(base).origin)remote.push(req.url());
  });
  await page.goto(base+'/');
  await scene(page,'s00');
  assert.equal(await page.locator('#nextButton').isVisible(),true);
  assert.equal(await page.locator('#nextButton').isEnabled(),true);
  await screenshot(page,'01-prologue-desktop.png');
  await introToHub(page);
  assert.equal(await page.locator('#portalGrid button').count(),7);
  assert.equal(await page.locator('#nextButton').isDisabled(),true);
  await screenshot(page,'02-seven-doors-desktop.png');
  await enterWorld(page,0,{fragment:true,decision:0});
  assert.match(await page.locator('#fragmentsFound').innerText(),/01/);
  await enterWorld(page,2,{fragment:true,decision:1});
  assert.equal(await page.locator('#nextButton').isEnabled(),true);
  await enterWorld(page,4,{fragment:true,decision:0});
  assert.match(await page.locator('#fragmentsFound').innerText(),/03/);
  await page.locator('#nextButton').click();
  await scene(page,'s12');
  assert.equal(await page.locator('#vaultButton').isVisible(),true);
  await page.locator('#vaultButton').click();
  await scene(page,'s13');
  await screenshot(page,'03-hidden-archive-desktop.png');
  await page.locator('#detailButton').click();
  await page.locator('#nextButton').click();
  await scene(page,'s14');
  assert.equal(await page.locator('#choices .choice-btn').count(),2);
  await page.locator('#choices .choice-btn').first().click();
  await scene(page,'s15');
  await screenshot(page,'04-free-ending-desktop.png');
  await page.locator('#nextButton').click();
  await scene(page,'s17');
  assert.equal(await page.locator('#epilogueArea').isVisible(),true);
  const promise=page.waitForEvent('download');
  await page.locator('#downloadRoute').click();
  const file=await promise;
  assert.equal(file.suggestedFilename(),'impossible-ventures-protocol-zero-route.json');
  const path=await file.path();
  const report=JSON.parse(await readFile(path,'utf8'));
  assert.equal(report.ending,'open');
  assert.equal(report.exploredWorlds.length,3);
  assert.equal(report.bonusVaultSeen,true);
  assert.equal(report.alignment.discovered,3);
  assert.equal(report.personalDataCollected,false);
  assert.match(report.disclaimer,/Fictional/);
  assert.deepEqual(remote,[],'No external requests before explicitly visiting an outside website');
  assert.deepEqual(errors,[],'All real frame SVGs and JS must load without console errors');
});
test('alternate route reaches control ending with only 2 worlds and no secret',async t=>{
  const {page,base,errors}=await fixture(t);
  await page.goto(base+'/');
  await introToHub(page);
  await enterWorld(page,1,{fragment:false,decision:1});
  await enterWorld(page,6,{fragment:false,decision:1});
  await page.locator('#nextButton').click();await scene(page,'s12');
  assert.equal(await page.locator('#vaultButton').isHidden(),true);
  await page.locator('#nextButton').click();await scene(page,'s14');
  await page.locator('#choices .choice-btn').nth(1).click();
  await scene(page,'s16');
  assert.match(await page.locator('#sceneTitle').innerText(),/Контроль/);
  await screenshot(page,'05-control-ending-desktop.png');
  await page.locator('#nextButton').click();await scene(page,'s17');
  assert.match(await page.locator('#epilogueSummary').innerText(),/контроль/);
  assert.deepEqual(errors,[]);
});
test('mobile no-overflow film, locale switch, story map, intentional skip, replay and Lite quality',async t=>{
  const {page,base,errors}=await fixture(t,{width:390,height:844});
  await page.goto(base+'/');
  await scene(page,'s00');
  const fits=async()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2);
  assert.equal(await fits(),true,'Prologue fits a 390px mobile viewport');
  await page.locator('#language').selectOption('en');
  assert.equal(await page.locator('html').getAttribute('lang'),'en');
  assert.match(await page.locator('#sceneTitle').innerText(),/Before the signal/);
  await page.locator('#language').selectOption('zh');
  assert.equal(await page.locator('html').getAttribute('lang'),'zh-CN');
  await page.locator('#language').selectOption('ru');
  await page.locator('#mapButton').click();
  assert.equal(await page.locator('#mapDialog').isVisible(),true);
  assert.equal(await page.locator('#mapWorldList button').count(),7);
  await page.locator('#closeMap').click();
  await page.locator('#skipButton').click();
  await scene(page,'s04');
  assert.equal(await fits(),true,'World map fits a narrow viewport');
  await screenshot(page,'06-seven-doors-mobile.png');
  await page.locator('#portalGrid .portal-card').first().click();
  await scene(page,'s05');
  await page.locator('#choices .choice-btn').first().click();
  await page.reload();
  await scene(page,'s05');
  assert.equal(await page.locator('#choices .choice-btn.is-chosen').count(),1,'Progress restored locally');
  await page.locator('#nextButton').click();await scene(page,'s04');
  await page.locator('#portalGrid .portal-card').nth(1).click();
  await scene(page,'s06');
  assert.equal(await fits(),true,'Choice scene fits a narrow viewport');
  await page.locator('#helpButton').click();
  assert.equal(await page.locator('#helpDialog').isVisible(),true);
  await page.locator('#volume').fill('70');
  assert.equal(await page.locator('#volumeNumber').innerText(),'70%');
  await page.locator('#closeHelp').click();
  await screenshot(page,'07-interactive-scene-mobile.png');
  await page.locator('#resetButton').click();
  page.once('dialog',dialog=>dialog.accept());
  // Confirm can be browser-native; if automation immediately dismissed the
  // modal this should reveal it as an actionable dialog instead.
  await page.waitForTimeout(20);
  assert.deepEqual(errors,[]);
});
test('reduced-motion setting overrides even explicit Cinematic choice and preserves meaning',async t=>{
  const {page,base,errors}=await fixture(t,{width:1440,height:900,reducedMotion:'reduce'});
  await page.goto(base+'/');
  await page.locator('#quality').selectOption('cinematic');
  assert.equal(await page.locator('#film').getAttribute('data-quality'),'lite');
  assert.match(await page.locator('#effectiveMode').innerText(),/LITE/);
  assert.equal(await page.locator('#particles').isVisible(),false);
  await introToHub(page);
  await page.locator('#portalGrid .portal-card').first().click();
  await scene(page,'s05');
  await page.locator('#choices button').first().click();
  assert.equal(await page.locator('#consequence').isVisible(),true);
  assert.deepEqual(errors,[]);
});
test('a missing frame never blocks story, choice or scene progression',async t=>{
  const {page,base}=await fixture(t);
  await page.route('**/assets/frames/shot_02.svg',route=>route.fulfill({
    status:404,contentType:'text/plain',body:'Missing optional film still'
  }));
  await page.goto(base+'/');
  await page.locator('#nextButton').click();await scene(page,'s01');
  await page.locator('#nextButton').click();await scene(page,'s02');
  await page.waitForFunction(()=>document.querySelector('#toast')?.textContent?.includes('Изображение недоступно'));
  await page.locator('#nextButton').click();await scene(page,'s03');
  assert.equal(await page.locator('#nextButton').isEnabled(),true);
});
