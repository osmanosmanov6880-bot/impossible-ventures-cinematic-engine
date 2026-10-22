import { STORY, WORLDS, WORLD_IDS, VERSION, getScene, getWorld, localize } from './story.mjs';
import {
  STORAGE_KEY, newGame, restoreGame, serializeGame, step, alignment, canReveal, canVault,
  frameCandidates, studiedWorlds, routeReport, hasDetail
} from './engine.mjs';
import { CinematicVisuals } from './visual.mjs';
import { Soundscape } from './audio.mjs';

const $=id=>document.getElementById(id);
const ui={
  film:$('film'),frame:$('frameImage'),particles:$('particles'),
  lang:$('language'),quality:$('quality'),mode:$('effectiveMode'),
  title:$('sceneTitle'),chapter:$('chapterLabel'),narrative:$('sceneNarration'),
  sequence:$('sequenceLabel'),counter:$('chapterCounter'),
  progress:$('progressFill'),
  portalArea:$('portalArea'),portalGrid:$('portalGrid'),portalHeading:$('portalHeading'),portalCount:$('portalCount'),
  choiceArea:$('choiceArea'),choices:$('choices'),choiceHeading:$('choiceHeading'),consequence:$('consequence'),
  detailArea:$('detailArea'),detailButton:$('detailButton'),detailLabel:$('detailLabel'),detailPanel:$('detailPanel'),
  revealArea:$('revealArea'),vaultButton:$('vaultButton'),
  next:$('nextButton'),nextLabel:$('nextLabel'),skip:$('skipButton'),hub:$('hubButton'),
  epilogue:$('epilogueArea'),epilogueSummary:$('epilogueSummary'),fiction:$('fictionDisclaimer'),
  download:$('downloadRoute'),restartFinal:$('restartFinal'),platform:$('platformLink'),
  visitCount:$('worldsVisited'),fragmentCount:$('fragmentsFound'),alignment:$('orientationValue'),
  signalLabel:$('signalLabel'),visitedLabel:$('visitedLabel'),fragmentLabel:$('fragmentLabel'),
  orientationLabel:$('orientationLabel'),footnote:$('intelFootnote'),
  back:$('backButton'),backLabel:$('backLabel'),map:$('mapButton'),mapLabel:$('mapLabel'),
  reset:$('resetButton'),resetLabel:$('resetLabel'),help:$('helpButton'),
  saveNote:$('saveNote'),toast:$('toast'),sound:$('soundButton'),soundIcon:$('soundIcon'),
  mapDialog:$('mapDialog'),mapTitle:$('mapTitle'),mapDescription:$('mapDescription'),
  mapList:$('mapWorldList'),mapFooter:$('mapFooter'),closeMap:$('closeMap'),
  helpDialog:$('helpDialog'),helpTitle:$('helpTitle'),helpCopy:$('helpCopy'),closeHelp:$('closeHelp'),
  volume:$('volume'),volumeLabel:$('volumeLabel'),volumeNumber:$('volumeNumber'),privacyHelp:$('privacyHelp')
};
const LANG={
  ru:{
    enter:'ВОЙТИ В ИСТОРИЮ',next:'СЛЕДОВАТЬ ЗА СИГНАЛОМ',skip:'ПРОПУСТИТЬ ВСТУПЛЕНИЕ →',
    explore:'ВЫБРАТЬ ДРУГОЙ МИР',return:'ВЕРНУТЬСЯ К СЕМИ ДВЕРЯМ',
    reveal:'РАСКРЫТЬ ИСТОЧНИК',need:'ИССЛЕДУЙ ЕЩЁ {n} МИР(А)',
    threshold:'ПЕРЕЙТИ К РЕШАЮЩЕМУ ВЫБОРУ',finale:'УВИДЕТЬ ЭПИЛОГ',
    vault:'ОТКРЫТЬ СЕКРЕТНОЕ ХРАНИЛИЩЕ',hub:'ВЕРНУТЬСЯ К МИРАМ →',
    back:'НАЗАД',map:'КАРТА ИСТОРИИ',reset:'СБРОСИТЬ',portals:'СЕМЬ ДОСТУПНЫХ МИРОВ',
    choice:'ВЫБЕРИ ПРИНЦИП',worldChoice:'ТВОЁ РЕШЕНИЕ',available:'НЕ ИССЛЕДОВАН',
    visited:'ИССЛЕДОВАН',fragment:'НАЙДЕН ОСКОЛОК',noFragment:'МОЖНО НАЙТИ ОСКОЛОК',
    revealReady:'ДВА МИРА ИССЛЕДОВАНЫ. ИСТОЧНИК ОТКРЫТ.',
    scoreLabel:'СТАТУС СИГНАЛА',visitedLabel:'ИССЛЕДОВАНО МИРОВ',fragmentLabel:'ОСКОЛКИ ПАМЯТИ',
    orientationLabel:'ХОД ИСТОРИИ',orientationOpen:'ОТКРЫТЫЙ',orientationCommand:'КОНТРОЛЬ',orientationNeutral:'ВЫБОР НЕ СДЕЛАН',
    footnote:'Только художественные решения. Не аналитика реальной рекламы.',
    save:'Ваш игровой путь хранится только в этом браузере.',saveFail:'Браузер запретил сохранение. Игра продолжится без него.',
    soundOn:'ВЫКЛЮЧИТЬ ЗВУК',soundOff:'ВКЛЮЧИТЬ ЗВУК',soundFail:'Звук недоступен на этом устройстве.',
    mode:'РЕЖИМ',assetError:'Изображение недоступно. Сюжет и кнопки продолжают работать.',
    detailDone:'Архивный осколок добавлен в вашу локальную карту.',detailElse:'Открыта дополнительная запись.',
    epilogueOpen:'Вы выбрали свободу. Исследовано миров: {worlds}. Найдено архивных фрагментов: {fragments}.',
    epilogueCommand:'Вы выбрали контроль. Даже этот путь можно пересмотреть. Исследовано миров: {worlds}.',
    epilogueUnknown:'Ваш маршрут существует только как вымышленная история.',
    platform:'ИЗУЧИТЬ ПЛАТФОРМУ',download:'СКАЧАТЬ МОЙ МАРШРУТ',restart:'ПЕРЕИГРАТЬ ИСТОРИЮ',
    fiction:'Фантастический фильм. Ни одной реальной конверсии или продажи не заявлено.',
    mapTitle:'Карта семи миров',mapDesc:'Можно исследовать любой мир и изменить свой выбор. Найдите три осколка для тайного хранилища.',
    mapStatus:'Исследовано {worlds}/7 миров. Осколки: {fragments}/7. Для раскрытия сигнала нужно исследовать два мира.',
    helpTitle:'Как управлять историей',help:[
      'Выбирайте действия прямо в кадре. Они действительно меняют сюжет и две возможные концовки.',
      'Клавиатура: стрелка → продолжить, стрелка ← вернуться, в хабе клавиши 1–7 выбирают мир. Все функции доступны также кнопками.',
      'Экранная карта показывает исследованные миры. Архивные осколки можно найти в каждом мире; три открывают бонусную сцену.',
      'Режимы CINEMATIC / BALANCED / LITE управляют только атмосферой. Уменьшенное движение в системе всегда в приоритете.',
      'Звук включается только по нажатию ♪. Можно смотреть фильм без звука: все важные реплики показаны текстом.'
    ],
    volume:'ГРОМКОСТЬ',privacy:'В localStorage сохраняются только вымышленные игровые решения. Нет профилей, обращений к маркетинговому API или сторонней аналитики. «Сбросить» очищает прогресс.',
    confirmReset:'Сбросить сюжетные решения, фрагменты и локальное сохранение?',
    clipSaved:'Путь скачан на устройство.',worldSaved:'Выбранное решение изменило будущий рассказ.',
    error:'Этот переход недоступен.',introSkipped:'Вступление пропущено. Все семь миров открыты.',
    hintRevisit:'К выбору можно вернуться через карту.'
  },
  en:{
    enter:'ENTER THE STORY',next:'FOLLOW THE SIGNAL',skip:'SKIP THE INTRO →',
    explore:'EXPLORE ANOTHER WORLD',return:'RETURN TO THE SEVEN DOORS',
    reveal:'DISCOVER THE SOURCE',need:'EXPLORE {n} MORE WORLD(S)',
    threshold:'MAKE THE FINAL CHOICE',finale:'WATCH THE EPILOGUE',
    vault:'ENTER THE HIDDEN ARCHIVE',hub:'RETURN TO THE WORLDS →',
    back:'BACK',map:'STORY MAP',reset:'RESET',portals:'SEVEN AVAILABLE WORLDS',
    choice:'CHOOSE A PRINCIPLE',worldChoice:'YOUR DECISION',available:'NOT EXPLORED',
    visited:'EXPLORED',fragment:'FRAGMENT FOUND',noFragment:'FRAGMENT AVAILABLE',
    revealReady:'TWO WORLDS EXPLORED. SOURCE UNLOCKED.',
    scoreLabel:'SIGNAL STATUS',visitedLabel:'WORLDS EXPLORED',fragmentLabel:'MEMORY FRAGMENTS',
    orientationLabel:'STORY ORIENTATION',orientationOpen:'OPEN SIGNAL',orientationCommand:'CONTROL',orientationNeutral:'UNDECIDED',
    footnote:'Fictional story choices only. Not real advertising analytics.',
    save:'Your fictional progress stays in this browser only.',saveFail:'Local saving is blocked. The film remains playable.',
    soundOn:'TURN OFF SOUND',soundOff:'TURN ON SOUND',soundFail:'Audio unavailable on this device.',
    mode:'MODE',assetError:'Image unavailable. Story and choices still work.',
    detailDone:'An archive fragment was added to your local story.',detailElse:'You discovered an optional record.',
    epilogueOpen:'You chose freedom. Worlds explored: {worlds}. Fragments found: {fragments}.',
    epilogueCommand:'You chose control. This path can still be revised. Worlds explored: {worlds}.',
    epilogueUnknown:'Your journey is a fictional local experience.',
    platform:'EXPLORE THE PLATFORM',download:'DOWNLOAD MY STORY PATH',restart:'REPLAY THE FILM',
    fiction:'Fictional interactive film. No real sales or conversion claims.',
    mapTitle:'Map of seven worlds',mapDesc:'Explore worlds freely and revise your choices. Three fragments unlock a hidden archive.',
    mapStatus:'Explored: {worlds}/7. Fragments: {fragments}/7. Explore two worlds to discover the Signal.',
    helpTitle:'How to explore',help:[
      'Make real narrative choices within the scene. They change the story and the two possible endings.',
      'Keyboard: → next, ← back, keys 1–7 select a world from the hub. Every function is also available as a button.',
      'The story map tracks worlds. Optional fragments reveal a secret scene when three are found.',
      'CINEMATIC / BALANCED / LITE affect atmosphere, not story. Reduced-motion preferences always take priority.',
      'Audio starts only when you click ♪. Important information is always available as text.'
    ],
    volume:'VOLUME',privacy:'Only fictional game choices are stored in localStorage. No profiling, marketing API or analytics SDK. Reset clears progress.',
    confirmReset:'Clear your story choices, fragments and local progress?',
    clipSaved:'Your story route was downloaded.',worldSaved:'Your choice changed the narrative.',
    error:'This transition is not available.',introSkipped:'Introduction skipped. The seven doors await.',
    hintRevisit:'You can revisit this decision through the story map.'
  },
  zh:{
    enter:'进入故事',next:'追随信号',skip:'跳过片头 →',
    explore:'探索另一世界',return:'返回七扇门',
    reveal:'发现信号源',need:'还需探索 {n} 个世界',
    threshold:'作出最终选择',finale:'观看尾声',
    vault:'进入秘密档案',hub:'返回七个世界 →',
    back:'返回',map:'故事地图',reset:'重置',portals:'七个可探索世界',
    choice:'选择原则',worldChoice:'您的决定',available:'尚未探索',
    visited:'已探索',fragment:'已找到碎片',noFragment:'可发现碎片',
    revealReady:'已经探索两个世界，信号源已解锁。',
    scoreLabel:'信号状态',visitedLabel:'已探索的世界',fragmentLabel:'记忆碎片',
    orientationLabel:'故事走向',orientationOpen:'开放',orientationCommand:'控制',orientationNeutral:'未选择',
    footnote:'仅是虚构的故事选择，并非真实广告数据。',
    save:'虚构游戏进度仅保存在此浏览器。',saveFail:'无法保存到本地，但仍可继续观看。',
    soundOn:'关闭声音',soundOff:'开启声音',soundFail:'此设备无法播放声音。',
    mode:'质量模式',assetError:'图像加载失败，故事和选项仍可使用。',
    detailDone:'档案碎片已加入本地故事地图。',detailElse:'发现了一份可选记录。',
    epilogueOpen:'您选择了自由。已探索世界：{worlds}。已找到碎片：{fragments}。',
    epilogueCommand:'您选择了控制，但仍可重新选择。已探索世界：{worlds}。',
    epilogueUnknown:'您的旅程只是一段保存在本地的虚构故事。',
    platform:'了解平台',download:'下载故事路线',restart:'重新开始',
    fiction:'虚构互动电影，不代表真实销售或转化。',
    mapTitle:'七个世界的地图',mapDesc:'自由探索并修改选择。找到三个碎片即可解锁秘密档案。',
    mapStatus:'已探索：{worlds}/7，碎片：{fragments}/7。探索两个世界后可发现信号。',
    helpTitle:'如何互动',help:[
      '在画面中做出真正影响剧情的选择，通向两种不同结局。',
      '键盘：→ 下一步，← 返回；在枢纽中按1–7选择世界。所有功能都有可点击按钮。',
      '故事地图记录已探索世界。三个碎片可解锁秘密场景。',
      'CINEMATIC / BALANCED / LITE 只改变视觉氛围；系统减少动画设置始终优先。',
      '点击 ♪ 才能开启音频。无声观看时也能阅读所有重要对白。'
    ],
    volume:'音量',privacy:'localStorage 仅保存虚构游戏选择。没有用户画像、营销API或分析SDK。重置可清除进度。',
    confirmReset:'清除所有选择、碎片和本地进度？',
    clipSaved:'故事路线已下载。',worldSaved:'您的选择改变了故事。',
    error:'当前无法进行该操作。',introSkipped:'已跳过片头，七个世界已开启。',
    hintRevisit:'可通过故事地图重新选择。'
  }
};

let language='ru';
let game;
try{game=restoreGame(localStorage.getItem(STORAGE_KEY))}catch{game=newGame()}
const sound=new Soundscape();
const visual=new CinematicVisuals({
  stage:ui.film,frame:ui.frame,canvas:ui.particles,
  onAssetError:()=>notify(tr('assetError'),true)
});
let toastTimer=null;
const tr=key=>LANG[language][key]??LANG.ru[key]??key;
function withNumbers(value,data){
  return Object.entries(data).reduce((s,[k,v])=>s.replaceAll('{'+k+'}',String(v)),value);
}
function node(tag,className='',value){
  const el=document.createElement(tag);
  if(className)el.className=className;
  if(value!==undefined)el.textContent=String(value);
  return el;
}
function notify(message,error=false){
  ui.toast.textContent=message;
  ui.toast.style.borderColor=error?'#ff9f9f':'#b8a584';
  ui.toast.classList.add('show');
  if(toastTimer)clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>ui.toast.classList.remove('show'),3900);
}
function save(){
  try{localStorage.setItem(STORAGE_KEY,serializeGame(game));return true}
  catch{notify(tr('saveFail'),true);return false}
}
function apply(action,alert=''){
  try{
    const old=game.scene;
    game=step(game,action);
    save();
    if(old!==game.scene){
      sound.setMood(STORY[game.scene].mood);
      sound.chime(STORY[game.scene].kind==='reveal'?'reveal':'choice');
    }else if(action.type==='DECIDE'){sound.chime('choice')}
    render();
    if(alert)notify(tr(alert));
  }catch(err){
    notify(err?.message||tr('error'),true);
  }
}
function openWorld(id){
  try{
    const kind=STORY[game.scene].kind;
    if(kind==='intro'||['s01','s02','s03'].includes(game.scene)){
      game=step(game,{type:'SKIP_INTRO'});
    }else if(kind==='world'){
      game=step(game,{type:'CONTINUE'});
    }else if(game.scene!=='s04'){
      game=step(game,{type:'REVISIT_HUB'});
    }
    game=step(game,{type:'ENTER_WORLD',worldId:id});
    save();sound.setMood(STORY[id].mood);sound.chime('choice');render();
  }catch(err){notify(err?.message||tr('error'),true)}
}
function renderPortals(){
  ui.portalGrid.replaceChildren();
  ui.portalArea.hidden=game.scene!=='s04';
  if(ui.portalArea.hidden)return;
  ui.portalHeading.textContent=tr('portals');
  ui.portalCount.textContent=String(studiedWorlds(game).length).padStart(2,'0')+' / 07';
  for(const world of WORLDS){
    const visited=Boolean(game.decisions[world.id]);
    const btn=node('button','portal-card'+(visited?' is-visited':''));btn.type='button';
    btn.style.setProperty('--portal-color',world.color);
    const glyph=node('span','portal-glyph',world.symbol);
    glyph.setAttribute('aria-hidden','true');
    const copy=node('span','portal-content');
    copy.append(node('strong','',world.name),
      node('small','',visited?tr('visited'):localize(world.tag,language)));
    btn.append(glyph,copy);
    btn.setAttribute('aria-label',localize(world.tag,language)+' — '+(visited?tr('visited'):tr('available')));
    btn.addEventListener('mouseenter',()=>visual.preload([STORY[world.id].frame]),{passive:true});
    btn.addEventListener('click',()=>openWorld(world.id));
    ui.portalGrid.append(btn);
  }
}
function renderChoices(scene){
  const visible=scene.kind==='world'||scene.kind==='threshold';
  ui.choiceArea.hidden=!visible;
  ui.choices.replaceChildren();
  ui.consequence.hidden=true;
  if(!visible)return;
  ui.choiceHeading.textContent=tr(scene.kind==='threshold'?'choice':'worldChoice');
  for(let index=0;index<scene.choices.length;index++){
    const c=scene.choices[index];
    const selected=game.decisions[scene.id]===c.id;
    const btn=node('button','choice-btn'+(selected?' is-chosen':''));btn.type='button';
    btn.setAttribute('aria-pressed',String(selected));
    btn.append(node('span','choice-index',String(index+1).padStart(2,'0')),
      node('strong','',localize(c.label,language)),node('span','choice-arrow','↗'));
    btn.addEventListener('click',()=>{
      apply({type:'DECIDE',choiceId:c.id},
        scene.kind==='world'?'worldSaved':'');
    });
    ui.choices.append(btn);
  }
  if(scene.kind==='world'&&game.decisions[scene.id]){
    const c=scene.choices.find(x=>x.id===game.decisions[scene.id]);
    ui.consequence.hidden=false;
    ui.consequence.textContent=localize(c.consequence,language)+' '+tr('hintRevisit');
  }
}
function renderDetail(scene){
  ui.detailArea.hidden=!scene.detail;
  if(!scene.detail)return;
  ui.detailLabel.textContent=localize(scene.detailLabel,language);
  const opened=hasDetail(game);
  ui.detailButton.hidden=opened;
  ui.detailPanel.hidden=!opened;
  ui.detailPanel.textContent=opened?localize(scene.detail,language):'';
}
function renderActions(scene){
  const kind=scene.kind;
  ui.skip.hidden=!(['s00','s01','s02','s03'].includes(scene.id));
  ui.skip.textContent=tr('skip');
  ui.hub.hidden=!['reveal','vault','threshold','ending','epilogue'].includes(kind);
  ui.hub.textContent=tr('hub');
  ui.revealArea.hidden=kind!=='reveal'||!canVault(game);
  ui.vaultButton.hidden=kind!=='reveal'||!canVault(game);
  ui.vaultButton.textContent=tr('vault');
  ui.epilogue.hidden=kind!=='epilogue';
  ui.next.hidden=kind==='threshold'||kind==='epilogue';
  ui.next.disabled=false;
  let label=tr('next');
  if(scene.id==='s00')label=tr('enter');
  else if(kind==='hub'){
    const count=studiedWorlds(game).length;
    ui.next.disabled=!canReveal(game);
    label=canReveal(game)?tr('reveal'):withNumbers(tr('need'),{n:Math.max(0,2-count)});
  }else if(kind==='world'){
    ui.next.disabled=!game.decisions[scene.id];
    label=game.decisions[scene.id]?tr('return'):tr('choice');
  }else if(kind==='reveal'||kind==='vault')label=tr('threshold');
  else if(kind==='ending')label=tr('finale');
  ui.nextLabel.textContent=label;
  ui.back.disabled=game.trail.length<2;
  ui.backLabel.textContent=tr('back');
  ui.mapLabel.textContent=tr('map');
  ui.resetLabel.textContent=tr('reset');
  ui.download.textContent=tr('download')+' ↓';
  ui.restartFinal.textContent=tr('restart')+' ↻';
  ui.platform.firstChild.textContent=tr('platform')+' ';
  ui.fiction.textContent=tr('fiction');
  const progress=alignment(game);
  ui.epilogueSummary.textContent=game.ending==='open'
    ?withNumbers(tr('epilogueOpen'),{worlds:progress.explored,fragments:progress.discovered})
    :game.ending==='command'
     ?withNumbers(tr('epilogueCommand'),{worlds:progress.explored,fragments:progress.discovered})
     :tr('epilogueUnknown');
}
function renderIntel(){
  const a=alignment(game);
  ui.signalLabel.textContent=tr('scoreLabel');
  ui.visitedLabel.textContent=tr('visitedLabel');
  ui.fragmentLabel.textContent=tr('fragmentLabel');
  ui.orientationLabel.textContent=tr('orientationLabel');
  ui.visitCount.innerHTML='';ui.fragmentCount.innerHTML='';
  ui.visitCount.append(node('span','',String(a.explored).padStart(2,'0')),node('small','',' / 07'));
  ui.fragmentCount.append(node('span','',String(a.discovered).padStart(2,'0')),node('small','',' / 07'));
  ui.alignment.textContent=a.explored===0||a.respect===a.control
    ?tr('orientationNeutral'):a.respect>a.control?tr('orientationOpen'):tr('orientationCommand');
  ui.footnote.textContent=tr('footnote');
  ui.saveNote.textContent=tr('save');
}
function renderMap(){
  ui.mapTitle.textContent=tr('mapTitle');
  ui.mapDescription.textContent=tr('mapDesc');
  const a=alignment(game);
  ui.mapFooter.textContent=withNumbers(tr('mapStatus'),{worlds:a.explored,fragments:a.discovered});
  ui.mapList.replaceChildren();
  for(const w of WORLDS){
    const visited=Boolean(game.decisions[w.id]);
    const item=node('button','map-item'+(visited?' is-complete':''));item.type='button';
    item.append(node('strong','',w.number+' / '+localize(w.tag,language)),
      node('small','',visited?tr('visited'):tr('available')));
    item.addEventListener('click',()=>{ui.mapDialog.close();openWorld(w.id)});
    ui.mapList.append(item);
  }
}
function renderHelp(){
  ui.helpTitle.textContent=tr('helpTitle');
  ui.helpCopy.replaceChildren();
  for(const line of tr('help'))ui.helpCopy.append(node('p','',line));
  ui.volumeLabel.textContent=tr('volume');
  ui.privacyHelp.textContent=tr('privacy');
  ui.volumeNumber.textContent=ui.volume.value+'%';
  ui.sound.setAttribute('aria-label',tr(sound.enabled?'soundOn':'soundOff'));
  ui.sound.setAttribute('aria-pressed',String(sound.enabled));
  ui.soundIcon.textContent=sound.enabled?'♫':'♪';
}
function render(initial=false){
  const scene=getScene(game.scene);
  document.documentElement.lang=language==='zh'?'zh-CN':language;
  document.title=localize(scene.title,language)+' — IMPOSSIBLE VENTURES';
  ui.chapter.textContent=localize(scene.subtitle,language);
  ui.title.textContent=localize(scene.title,language);
  ui.narrative.textContent=localize(scene.narration,language);
  ui.film.dataset.scene=scene.id;
  ui.film.dataset.mood=scene.mood;
  const index=Number(scene.id.slice(1));
  ui.sequence.textContent=String(index).padStart(2,'0')+' / 17';
  ui.counter.textContent='SCENE '+String(index+1).padStart(2,'0')+' / 18';
  const pct=scene.id==='s04'?Math.max(28,studiedWorlds(game).length*8+28):
    scene.kind==='world'?Math.max(28,studiedWorlds(game).length*8+28):
    Math.round((index+1)/18*100);
  ui.progress.style.width=Math.min(pct,100)+'%';
  renderPortals();renderChoices(scene);renderDetail(scene);renderActions(scene);renderIntel();renderMap();renderHelp();
  const info=visual.setQuality(ui.quality.value);
  ui.mode.textContent=tr('mode')+' / '+info.effective.toUpperCase();
  if(initial||scene.id!==ui.frame.dataset.scene||!ui.frame.getAttribute('src')){
    ui.frame.dataset.scene=scene.id;
    void visual.show(scene.frame,localize(scene.title,language));
    visual.preload(frameCandidates(game));
    if(!initial)ui.title.focus({preventScroll:true});
  }else{
    ui.frame.alt=localize(scene.title,language);
  }
}
function reset(ask=true){
  if(ask&&!window.confirm(tr('confirmReset')))return;
  try{localStorage.removeItem(STORAGE_KEY)}catch{}
  game=newGame();save();
  sound.setMood(STORY.s00.mood);
  render();
}
ui.lang.addEventListener('change',()=>{language=ui.lang.value;render()});
ui.quality.addEventListener('change',()=>{
  const mode=visual.setQuality(ui.quality.value);
  ui.mode.textContent=tr('mode')+' / '+mode.effective.toUpperCase();
});
ui.sound.addEventListener('click',async()=>{
  const enabled=await sound.toggle();
  if(!enabled&&!sound.ctx)notify(tr('soundFail'),true);
  renderHelp();
});
ui.volume.addEventListener('input',()=>{
  sound.setVolume(Number(ui.volume.value)/100);
  ui.volumeNumber.textContent=ui.volume.value+'%';
});
ui.next.addEventListener('click',()=>apply({type:'CONTINUE'}));
ui.skip.addEventListener('click',()=>apply({type:'SKIP_INTRO'},'introSkipped'));
ui.hub.addEventListener('click',()=>apply({type:'REVISIT_HUB'}));
ui.back.addEventListener('click',()=>apply({type:'BACK'}));
ui.reset.addEventListener('click',()=>reset(true));
ui.restartFinal.addEventListener('click',()=>reset(false));
ui.vaultButton.addEventListener('click',()=>apply({type:'CONTINUE',to:'vault'}));
ui.detailButton.addEventListener('click',()=>{
  const kind=STORY[game.scene].kind;
  apply({type:'DETAIL'},kind==='world'?'detailDone':'detailElse');
});
ui.download.addEventListener('click',()=>{
  const content=routeReport(game);
  const blob=new Blob([JSON.stringify(content,null,2)+'\n'],{type:'application/json;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const link=document.createElement('a');
  link.href=url;link.download='impossible-ventures-protocol-zero-route.json';
  document.body.append(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1200);
  notify(tr('clipSaved'));
});
ui.map.addEventListener('click',()=>{renderMap();ui.mapDialog.showModal()});
ui.closeMap.addEventListener('click',()=>ui.mapDialog.close());
ui.help.addEventListener('click',()=>{renderHelp();ui.helpDialog.showModal()});
ui.closeHelp.addEventListener('click',()=>ui.helpDialog.close());
for(const dlg of [ui.mapDialog,ui.helpDialog]){
  dlg.addEventListener('click',e=>{if(e.target===dlg)dlg.close()});
}
window.addEventListener('keydown',event=>{
  if(ui.mapDialog.open||ui.helpDialog.open||event.altKey||event.ctrlKey||event.metaKey)return;
  if(['INPUT','TEXTAREA','SELECT','BUTTON','A'].includes(document.activeElement?.tagName))return;
  if(event.key==='ArrowLeft'&&!ui.back.disabled){event.preventDefault();ui.back.click()}
  else if(event.key==='ArrowRight'&&!ui.next.hidden&&!ui.next.disabled){
    event.preventDefault();ui.next.click();
  }else if(game.scene==='s04'&&/^[1-7]$/.test(event.key)){
    event.preventDefault();openWorld(WORLD_IDS[Number(event.key)-1]);
  }
});
window.addEventListener('resize',()=>{
  const mode=visual.mode;ui.mode.textContent=tr('mode')+' / '+mode.toUpperCase();
},{passive:true});
window.addEventListener('pagehide',()=>{visual.dispose();sound.stop()},{once:true});
sound.setMood(STORY[game.scene].mood);
render(true);
