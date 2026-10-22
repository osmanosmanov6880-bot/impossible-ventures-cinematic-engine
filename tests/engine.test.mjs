import test from 'node:test';
import assert from 'node:assert/strict';
import { getScene, WORLDS, WORLD_IDS, ALL_IDS, localize, assertStory } from '../src/story.mjs';
import {
  newGame, step, studiedWorlds, foundFragments, alignment, canVault, canReveal,
  routeReport, restoreGame, serializeGame, graphAudit, StoryError
} from '../src/engine.mjs';

function goHub(){
  let state=newGame();
  for(let i=0;i<4;i++)state=step(state,{type:'CONTINUE'});
  return state;
}
function world(state,id,which='understand',inspect=false){
  let x=step(state,{type:'ENTER_WORLD',worldId:id});
  if(inspect)x=step(x,{type:'DETAIL'});
  x=step(x,{type:'DECIDE',choiceId:which});
  return step(x,{type:'CONTINUE'});
}
test('18 independent scenes, 7 content-complete portal worlds, 2 endings and 3 languages',()=>{
  assert.deepEqual(graphAudit().possibleEndingIds,['s15','s16']);
  assert.deepEqual(assertStory(),{scenes:18,worlds:7,locales:3,endings:2});
  assert.equal(ALL_IDS.length,18);
  assert.equal(WORLD_IDS.length,7);
  assert.equal(new Set(WORLDS.map(w=>w.color)).size,7);
  for(const [id,s] of Object.entries(Object.fromEntries(ALL_IDS.map(i=>[i,getScene(i)])))){
    assert.match(s.frame,/assets\/frames\/shot_\d\d\.svg$/);
    for(const lang of ['ru','en','zh']){
      assert.ok(localize(s.title,lang).length>3,id+' '+lang);
      assert.ok(localize(s.subtitle,lang).length>3,id);
      assert.ok(localize(s.narration,lang).length>5,id);
    }
    if(s.kind==='world'){
      assert.equal(s.choices.length,2);
      assert.ok(s.fragment);
      assert.ok(s.detailLabel);
      assert.ok(s.detail);
    }
  }
});
test('intro progression S00→S04, no premature dramatic reveal',()=>{
  const initial=newGame();assert.equal(initial.scene,'s00');
  const x=goHub();
  assert.equal(x.scene,'s04');
  assert.deepEqual(x.trail,['s00','s01','s02','s03','s04']);
  assert.equal(canReveal(x),false);
  assert.throws(()=>step(x,{type:'CONTINUE'}),StoryError);
  assert.equal(studiedWorlds(x).length,0);
});
test('all seven worlds are reachable and all seven authored decisions have consequences',()=>{
  let x=goHub();
  for(let i=0;i<WORLD_IDS.length;i++){
    const id=WORLD_IDS[i];
    x=world(x,id,i%2?'command':'understand',true);
    assert.equal(x.scene,'s04');
  }
  const a=alignment(x);
  assert.equal(a.explored,7);
  assert.equal(a.discovered,7);
  assert.equal(a.respect,4);
  assert.equal(a.control,3);
  assert.equal(new Set(x.fragments).size,7);
  assert.equal(new Set(studiedWorlds(x)).size,7);
  assert.equal(canVault(x),true);
  assert.equal(canReveal(x),true);
  x=step(x,{type:'CONTINUE'});
  assert.equal(x.scene,'s12');
  x=step(x,{type:'CONTINUE',to:'vault'});
  assert.equal(x.scene,'s13');
  x=step(x,{type:'CONTINUE'});
  assert.equal(x.scene,'s14');
});
test('change a world decision without inflating visits/fragments',()=>{
  let x=goHub();
  x=world(x,'s05','command',true);
  assert.equal(alignment(x).respect,0);
  assert.equal(alignment(x).control,1);
  assert.equal(alignment(x).discovered,1);
  x=world(x,'s05','understand',true);
  assert.equal(alignment(x).respect,1);
  assert.equal(alignment(x).control,0);
  assert.equal(alignment(x).discovered,1);
  assert.equal(studiedWorlds(x).length,1);
  assert.equal(x.details.filter(v=>v==='s05').length,1);
  assert.equal(x.fragments.filter(v=>v==='key_code').length,1);
});
test('freedom ending and control ending are real separate graph states',()=>{
  let x=world(world(goHub(),'s05','understand'),'s06','understand');
  x=step(x,{type:'CONTINUE'});
  assert.equal(x.scene,'s12');
  assert.equal(canVault(x),false);
  x=step(x,{type:'CONTINUE',to:'vault'});
  assert.equal(x.scene,'s14');
  const open=step(x,{type:'DECIDE',choiceId:'open'});
  const closed=step(x,{type:'DECIDE',choiceId:'command'});
  assert.equal(open.scene,'s15');assert.equal(closed.scene,'s16');
  assert.equal(open.ending,'open');assert.equal(closed.ending,'command');
  assert.notDeepEqual(open.trail,closed.trail);
  assert.equal(step(open,{type:'CONTINUE'}).scene,'s17');
  assert.equal(step(closed,{type:'CONTINUE'}).scene,'s17');
  assert.equal(routeReport(step(open,{type:'CONTINUE'})).ending,'open');
  assert.equal(routeReport(step(closed,{type:'CONTINUE'})).ending,'command');
});
test('secret vault requires 3 found fragments, not 3 visits or 3 choices',()=>{
  let x=goHub();
  for(const id of WORLD_IDS.slice(0,3))x=world(x,id,'understand',false);
  assert.equal(alignment(x).explored,3);
  assert.equal(canVault(x),false);
  for(const id of WORLD_IDS.slice(0,3)){
    x=step(x,{type:'ENTER_WORLD',worldId:id});
    x=step(x,{type:'DETAIL'});
    x=step(x,{type:'CONTINUE'});
  }
  assert.equal(alignment(x).discovered,3);
  assert.equal(canVault(x),true);
  x=step(x,{type:'CONTINUE'});
  assert.equal(step(x,{type:'CONTINUE',to:'vault'}).scene,'s13');
});
test('back navigation returns to prior scene but story remains changeable',()=>{
  let x=goHub();
  x=step(x,{type:'ENTER_WORLD',worldId:'s07'});
  x=step(x,{type:'DECIDE',choiceId:'command'});
  x=step(x,{type:'BACK'});
  assert.equal(x.scene,'s04');
  assert.equal(x.decisions.s07,'command');
  x=step(x,{type:'ENTER_WORLD',worldId:'s07'});
  x=step(x,{type:'DECIDE',choiceId:'understand'});
  assert.equal(x.decisions.s07,'understand');
  assert.equal(studiedWorlds(x).length,1);
});
test('skip intro is deliberate and restricted',()=>{
  let x=newGame();
  x=step(x,{type:'SKIP_INTRO'});
  assert.equal(x.scene,'s04');
  assert.throws(()=>step(x,{type:'SKIP_INTRO'}),StoryError);
  x=world(x,'s05');
  x=world(x,'s06');
  x=step(x,{type:'CONTINUE'});
  x=step(x,{type:'REVISIT_HUB'});
  assert.equal(x.scene,'s04');
  assert.equal(canReveal(x),true);
});
test('invalid actions, IDs, premature choice and impossible gating are denied',()=>{
  const x=newGame();
  assert.throws(()=>step(x,{type:'DECIDE',choiceId:'open'}),StoryError);
  assert.throws(()=>step(x,{type:'ENTER_WORLD',worldId:'s05'}),StoryError);
  assert.equal(step(x,{type:'CONTINUE',to:'s17'}).scene,'s01'); // unknown next hints cannot override graph
  assert.throws(()=>step(x,{type:'HACK'}),StoryError);
  assert.throws(()=>step(x,{type:'REVISIT_HUB'}),StoryError);
  const hub=goHub();
  assert.throws(()=>step(hub,{type:'ENTER_WORLD',worldId:'s14'}),StoryError);
  const w=step(hub,{type:'ENTER_WORLD',worldId:'s05'});
  assert.throws(()=>step(w,{type:'DECIDE',choiceId:'unverified'}),StoryError);
});
test('local save validation rejects manipulated/broken JSON, but never blocks recovery',()=>{
  const initial=newGame();
  assert.deepEqual(restoreGame(serializeGame(initial)),initial);
  assert.deepEqual(restoreGame('not-json'),initial);
  assert.deepEqual(restoreGame(JSON.stringify({...initial,scene:'s99'})),initial);
  assert.deepEqual(restoreGame(JSON.stringify({...initial,trail:['s04']})),initial);
  assert.deepEqual(restoreGame(JSON.stringify({...initial,decisions:{s05:'hacked'}})),initial);
  assert.deepEqual(restoreGame(JSON.stringify({...initial,fragments:['unknown']})),initial);
  assert.deepEqual(restoreGame(JSON.stringify({...initial,details:['s05','s05']})),initial);
  assert.equal(step(initial,{type:'RESET'}).scene,'s00');
});
test('route export explicitly distinguishes narrative actions from paid performance',()=>{
  let x=world(world(goHub(),'s05','understand',true),'s09','command',false);
  x=step(x,{type:'CONTINUE'});
  x=step(x,{type:'CONTINUE'});
  x=step(x,{type:'DECIDE',choiceId:'open'});
  x=step(x,{type:'CONTINUE'});
  const report=routeReport(x);
  assert.equal(report.kind,'fictional-interactive-cinema-route');
  assert.equal(report.ending,'open');
  assert.equal(report.exploredWorlds.length,2);
  assert.equal(report.exploredWorlds[0].foundFragment,true);
  assert.equal(report.exploredWorlds[1].foundFragment,false);
  assert.equal(report.personalDataCollected,false);
  assert.equal(report.exportedByUser,true);
  assert.match(report.disclaimer,/Not real ad impressions/);
  assert.equal(JSON.stringify(report).includes('customerEmail'),false);
});
