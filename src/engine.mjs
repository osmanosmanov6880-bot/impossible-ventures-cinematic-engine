import { STORY, WORLDS, WORLD_IDS, ALL_IDS, getScene, getWorld, assertStory } from './story.mjs';

export const STORAGE_KEY = 'iv.protocol-zero.progress.v1';
export const SCHEMA = 'iv.protocol-zero.state/1';
const MAX_TRAIL = 100;
export class StoryError extends Error {
  constructor(message){super(message);this.name='StoryError'}
}
const validId = id => typeof id==='string' && Object.hasOwn(STORY,id);
const unique = xs => [...new Set(xs)];

export function newGame(){
  return {schema:SCHEMA,scene:'s00',trail:['s00'],decisions:{},fragments:[],details:[],ending:null};
}
export function studiedWorlds(state){
  assertState(state);
  return WORLD_IDS.filter(id=>Boolean(state.decisions[id]));
}
export function foundFragments(state){
  assertState(state);
  return WORLD_IDS.filter(id=>state.fragments.includes(getScene(id).fragment));
}
export function alignment(state){
  assertState(state);
  const ids = WORLD_IDS.filter(id=>state.decisions[id]);
  const respect=ids.filter(id=>state.decisions[id]==='understand').length;
  return {respect,control:ids.length-respect,discovered:state.fragments.length,
    explored:ids.length,totalWorlds:WORLD_IDS.length};
}
export function canReveal(state){return studiedWorlds(state).length>=2}
export function canVault(state){return foundFragments(state).length>=3}
export function hasDetail(state){return state.details.includes(state.scene)}

export function assertState(state){
  if(!state || typeof state!=='object' || Array.isArray(state) ||
     state.schema!==SCHEMA || !validId(state.scene) ||
     !Array.isArray(state.trail) || state.trail.length<1 || state.trail.length>MAX_TRAIL ||
     state.trail.some(id=>!validId(id)) ||
     state.trail.at(-1)!==state.scene ||
     !state.decisions || typeof state.decisions!=='object' || Array.isArray(state.decisions) ||
     !Array.isArray(state.fragments) || !Array.isArray(state.details) ||
     state.fragments.length>7 || state.details.length>18 ||
     state.fragments.some(key=>typeof key!=='string'||!WORLD_IDS.some(id=>STORY[id].fragment===key)) ||
     state.details.some(id=>!validId(id)) ||
     unique(state.details).length!==state.details.length ||
     unique(state.fragments).length!==state.fragments.length ||
     ![null,'open','command'].includes(state.ending))throw new StoryError('Invalid cinematic save');
  for(const [id,val] of Object.entries(state.decisions)){
    if(!WORLD_IDS.includes(id) && id!=='s14')throw new StoryError('Unknown scene decision');
    if(!getScene(id).choices.some(c=>c.id===val))throw new StoryError('Unknown branch decision');
  }
  return state;
}

function next(state,id){
  if(!validId(id))throw new StoryError('Scene not found');
  const trail = [...state.trail,id].slice(-MAX_TRAIL);
  return assertState({...state,scene:id,trail});
}
export function step(state,action){
  assertState(state);
  if(!action || typeof action!=='object'||typeof action.type!=='string')throw new StoryError('Invalid action');
  const s=getScene(state.scene);
  switch(action.type){
    case 'RESET': return newGame();
    case 'BACK':
      if(state.trail.length<2)return {...state};
      return assertState({...state,trail:state.trail.slice(0,-1),scene:state.trail.at(-2)});
    case 'SKIP_INTRO':
      if(state.scene!=='s00'&&!['s01','s02','s03'].includes(state.scene))
        throw new StoryError('Intro can only be skipped at the beginning');
      return next(state,'s04');
    case 'DETAIL':
      if(!s.detail || state.details.includes(state.scene))return {...state};
      return assertState({
        ...state,
        details:[...state.details,state.scene],
        fragments:s.kind==='world' ? unique([...state.fragments,s.fragment]) : [...state.fragments]
      });
    case 'ENTER_WORLD':
      if(s.kind!=='hub' || !WORLD_IDS.includes(action.worldId))
        throw new StoryError('World is not available here');
      return next(state,action.worldId);
    case 'DECIDE': {
      if(!['world','threshold'].includes(s.kind) ||
         typeof action.choiceId!=='string' ||
         !s.choices.some(c=>c.id===action.choiceId)){
        throw new StoryError('Invalid story choice');
      }
      const decisions={...state.decisions,[s.id]:action.choiceId};
      if(s.kind==='world')return assertState({...state,decisions});
      const ending=action.choiceId==='open'?'open':'command';
      return next({...state,decisions,ending},ending==='open'?'s15':'s16');
    }
    case 'CONTINUE': {
      if(s.kind==='hub'){
        if(!canReveal(state))throw new StoryError('Explore at least two worlds to continue');
        return next(state,'s12');
      }
      if(s.kind==='world')return next(state,'s04');
      if(s.kind==='reveal'){
        return next(state,canVault(state)&&action.to==='vault'?'s13':'s14');
      }
      if(s.kind==='epilogue')throw new StoryError('Use reset or explore again');
      if(s.next)return next(state,s.next);
      throw new StoryError('No linear exit from this scene');
    }
    case 'REVISIT_HUB':
      if(!['reveal','vault','threshold','ending','epilogue'].includes(s.kind))
        throw new StoryError('Cannot return to world hub from this scene');
      return next(state,'s04');
    default: throw new StoryError('Unknown action');
  }
}

export function frameCandidates(state){
  assertState(state);
  const s=getScene(state.scene);
  if(s.kind==='hub')return WORLDS.filter(w=>!state.decisions[w.id]).slice(0,2).map(w=>STORY[w.id].frame);
  if(s.kind==='reveal')return [STORY[canVault(state)?'s13':'s14'].frame];
  if(s.kind==='threshold')return [STORY.s15.frame,STORY.s16.frame];
  return s.next ? [STORY[s.next].frame] : [];
}

export function restoreGame(value){
  if(!value)return newGame();
  try{
    const decoded=typeof value==='string'?JSON.parse(value):value;
    return assertState(decoded);
  }catch{return newGame()}
}
export function serializeGame(state){assertState(state);return JSON.stringify(state)}

export function routeReport(state){
  assertState(state);
  return {
    schema:'iv.protocol-zero.export/1',
    kind:'fictional-interactive-cinema-route',
    title:'IMPOSSIBLE VENTURES — PROTOCOL ZERO',
    visitedScenes:unique(state.trail),
    exploredWorlds:studiedWorlds(state).map(id=>({
      id,world:getWorld(id).name,
      decisionId:state.decisions[id],
      decisionLabel:getScene(id).choices.find(c=>c.id===state.decisions[id]).label.ru,
      foundFragment:state.fragments.includes(getScene(id).fragment)
    })),
    bonusVaultSeen:state.trail.includes('s13'),
    ending:state.ending,
    alignment:alignment(state),
    disclaimer:'Fictional, opt-in local story actions. Not real ad impressions, conversion rate, leads or paid revenue.',
    personalDataCollected:false,
    exportedByUser:true
  };
}
export function graphAudit(){
  const inv=assertStory();
  if(ALL_IDS.length!==18 || WORLD_IDS.length!==7 || !STORY.s14.choices.some(c=>c.id==='open') ||
     !STORY.s14.choices.some(c=>c.id==='command'))throw new StoryError('Story graph is malformed');
  const chain=['s00','s01','s02','s03','s04'];
  for(let i=0;i<chain.length-1;i++)if(STORY[chain[i]].next!==chain[i+1])
    throw new StoryError('Intro chain broken');
  const end=['s15','s16'];
  for(const id of end)if(STORY[id].next!=='s17')throw new StoryError('Ending without epilogue');
  if(STORY.s13.next!=='s14'||STORY.s12.next!=='s14')throw new StoryError('Reveal broken');
  return {...inv,possibleEndingIds:end,hiddenScene:'s13',worldIds:[...WORLD_IDS]};
}
