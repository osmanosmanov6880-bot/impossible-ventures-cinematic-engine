/**
 * Minimal camera / parallax / atmosphere system.
 * No WebGL or video API is required. Meaningful content exists outside motion.
 */
const MODES=['auto','cinematic','balanced','lite'];
const clamp=(x,lo,hi)=>Math.min(hi,Math.max(lo,x));

export class CinematicVisuals {
  constructor({stage,frame,canvas,onAssetError=()=>{}}){
    this.stage=stage;
    this.frame=frame;
    this.canvas=canvas;
    this.context=canvas.getContext('2d',{alpha:true});
    this.onAssetError=onAssetError;
    this.requestedMode='auto';
    this.mode='balanced';
    this.pointer={x:0,y:0};
    this.target={x:0,y:0};
    this.particles=[];
    this.last=0;
    this.raf=0;
    this.assetToken=0;
    this.visible=!document.hidden;
    this.motionQuery=window.matchMedia('(prefers-reduced-motion: reduce)');
    this.handlePointer=e=>{
      const box=this.stage.getBoundingClientRect();
      if(!box.width||!box.height)return;
      this.target.x=clamp((e.clientX-box.left)/box.width*2-1,-1,1);
      this.target.y=clamp((e.clientY-box.top)/box.height*2-1,-1,1);
    };
    this.handleVisibility=()=>{this.visible=!document.hidden;if(this.visible)this.start();else this.stop()};
    this.handleResize=()=>this.resize();
    this.handleReduced=()=>this.setQuality(this.requestedMode);
    this.stage.addEventListener('pointermove',this.handlePointer,{passive:true});
    document.addEventListener('visibilitychange',this.handleVisibility);
    window.addEventListener('resize',this.handleResize,{passive:true});
    this.motionQuery.addEventListener?.('change',this.handleReduced);
    this.setQuality('auto');
    this.resize();
  }
  autoMode(){
    const reducedData=navigator.connection?.saveData;
    const slow=/^(2g|slow-2g)$/.test(navigator.connection?.effectiveType||'');
    const narrow=window.matchMedia('(max-width: 650px)').matches;
    const memory=navigator.deviceMemory??4;
    if(reducedData||slow||memory<=2)return 'lite';
    if(narrow||memory<=4)return 'balanced';
    return 'cinematic';
  }
  setQuality(mode){
    if(!MODES.includes(mode))mode='auto';
    this.requestedMode=mode;
    this.mode=this.motionQuery.matches?'lite':mode==='auto'?this.autoMode():mode;
    this.stage.dataset.quality=this.mode;
    if(this.mode==='cinematic')this.start();else{this.stop();this.clear()}
    return {requested:this.requestedMode,effective:this.mode,reducedMotion:this.motionQuery.matches};
  }
  resize(){
    const rect=this.stage.getBoundingClientRect();
    const dpr=Math.min(window.devicePixelRatio||1,this.mode==='lite'?1:1.5);
    const width=Math.round(rect.width*dpr),height=Math.round(rect.height*dpr);
    if(width>0&&height>0){
      this.canvas.width=width;this.canvas.height=height;
      this.canvas.style.width=rect.width+'px';this.canvas.style.height=rect.height+'px';
      this.particles=Array.from({length:Math.min(65,Math.max(28,Math.round(rect.width/24)))},(_,i)=>({
        x:(i*.6180339%1)*width,
        y:(i*.381966%1)*height,
        r:(.2+(i%7)*.15)*dpr,
        speed:(.08+(i%5)*.03)*dpr,
        alpha:.06+(i%6)*.024
      }));
    }
    if(this.requestedMode==='auto')this.setQuality('auto');
  }
  start(){
    if(this.raf||!this.visible||this.mode!=='cinematic'||this.motionQuery.matches)return;
    this.last=0;
    this.raf=requestAnimationFrame(t=>this.animate(t));
  }
  stop(){
    if(this.raf)cancelAnimationFrame(this.raf);
    this.raf=0;this.last=0;
    this.stage.style.setProperty('--camera-x','0px');
    this.stage.style.setProperty('--camera-y','0px');
  }
  clear(){this.context?.clearRect(0,0,this.canvas.width,this.canvas.height)}
  animate(t){
    this.raf=0;
    if(this.mode!=='cinematic'||!this.visible||this.motionQuery.matches)return;
    if(this.last&&t-this.last<28){
      this.raf=requestAnimationFrame(time=>this.animate(time));return;
    }
    this.last=t;
    this.pointer.x+=(this.target.x-this.pointer.x)*.035;
    this.pointer.y+=(this.target.y-this.pointer.y)*.035;
    this.stage.style.setProperty('--camera-x',(this.pointer.x*-12).toFixed(2)+'px');
    this.stage.style.setProperty('--camera-y',(this.pointer.y*-7).toFixed(2)+'px');
    if(this.context){
      const c=this.context,w=this.canvas.width,h=this.canvas.height;
      c.clearRect(0,0,w,h);
      for(const dot of this.particles){
        dot.y-=dot.speed;
        if(dot.y<0)dot.y=h;
        c.beginPath();
        c.fillStyle='rgba(231,212,171,'+dot.alpha.toFixed(3)+')';
        c.arc(dot.x+Math.sin(t/3100+dot.x)*.5,dot.y,dot.r,0,Math.PI*2);
        c.fill();
      }
    }
    this.raf=requestAnimationFrame(time=>this.animate(time));
  }
  /** Loads just current shot; older in-flight shots are ignored. */
  show(framePath,description){
    const token=++this.assetToken;
    const abs=new URL(framePath,document.baseURI).href;
    this.frame.style.opacity='0';
    return new Promise(resolve=>{
      const img=new Image();
      const complete=(ok)=>{
        if(token!==this.assetToken){resolve(false);return}
        if(ok){
          this.frame.src=abs;
          this.frame.alt=description||'';
          requestAnimationFrame(()=>{if(token===this.assetToken)this.frame.style.opacity='1'});
        }else{
          this.frame.removeAttribute('src');
          this.onAssetError(framePath);
        }
        resolve(ok);
      };
      img.onload=()=>complete(true);
      img.onerror=()=>complete(false);
      img.src=abs;
      if(img.complete&&img.naturalWidth>0)complete(true);
    });
  }
  /** The next few, never all 18 assets. */
  preload(paths){
    for(const path of paths.slice(0,2)){
      const img=new Image();
      img.decoding='async';
      img.src=new URL(path,document.baseURI).href;
    }
  }
  dispose(){
    this.stop();
    this.stage.removeEventListener('pointermove',this.handlePointer);
    document.removeEventListener('visibilitychange',this.handleVisibility);
    window.removeEventListener('resize',this.handleResize);
    this.motionQuery.removeEventListener?.('change',this.handleReduced);
  }
}
export function supportedQualityModes(){return [...MODES]}
