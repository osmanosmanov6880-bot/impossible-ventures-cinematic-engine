/**
 * Original in-browser synthesis. No audio files, license-dependent tracks,
 * microphones, external requests or autoplay.
 */
const MOODS = {
  silence:[55,82.4],dread:[48,72],mystery:[62,93],
  awe:[65.4,98],possibility:[73.4,110],suspense:[58.3,87.3],
  judgment:[65.4,97.9],intimacy:[69.3,103.8],dramatic:[73.4,110],
  wonder:[82.4,123.5],calm:[98,146.8],collective:[87.3,131],
  inversion:[54,81],secret:[60,89.8],responsibility:[61.7,92.5],
  dawn:[87.3,130.8],closed:[51.9,77.8],resolve:[98,146.8]
};
const clamp=(x,min,max)=>Math.min(max,Math.max(min,x));

export class Soundscape {
  constructor(){
    this.ctx=null;
    this.main=null;
    this.pad=[];
    this.enabled=false;
    this.volume=.23;
    this.mood='silence';
  }
  async toggle(){
    if(this.enabled){
      this.enabled=false;
      if(this.main&&this.ctx)this.main.gain.setTargetAtTime(0,this.ctx.currentTime,.18);
      return false;
    }
    const Audio=window.AudioContext||window.webkitAudioContext;
    if(!Audio)return false;
    try{
      if(!this.ctx){
        this.ctx=new Audio();
        const filter=this.ctx.createBiquadFilter();
        filter.type='lowpass';filter.frequency.value=580;filter.Q.value=.6;
        this.main=this.ctx.createGain();
        this.main.gain.value=0;
        this.main.connect(filter);filter.connect(this.ctx.destination);
        for(let i=0;i<2;i++){
          const oscillator=this.ctx.createOscillator();
          const voice=this.ctx.createGain();
          oscillator.type=i?'triangle':'sine';
          voice.gain.value=i?.12:.4;
          oscillator.connect(voice);voice.connect(this.main);
          oscillator.start();
          this.pad.push(oscillator);
        }
      }
      await this.ctx.resume();
      this.enabled=true;
      this.setMood(this.mood);
      this.main.gain.setTargetAtTime(this.volume*.14,this.ctx.currentTime,.24);
      this.chime('start');
      return true;
    }catch{
      this.enabled=false;
      return false;
    }
  }
  setMood(mood){
    this.mood=mood in MOODS?mood:'silence';
    if(!this.ctx||!this.pad.length)return;
    const values=MOODS[this.mood];
    this.pad.forEach((voice,i)=>{
      voice.frequency.setTargetAtTime(values[i],this.ctx.currentTime,.3);
    });
    if(this.enabled)this.main.gain.setTargetAtTime(this.volume*.14,this.ctx.currentTime,.25);
  }
  setVolume(value){
    this.volume=clamp(Number(value)||0,0,1);
    if(this.ctx&&this.main&&this.enabled)
      this.main.gain.setTargetAtTime(this.volume*.14,this.ctx.currentTime,.12);
  }
  chime(kind='choice'){
    if(!this.enabled||!this.ctx)return;
    const t=this.ctx.currentTime;
    const freqs=kind==='reveal'?[261.63,392]:kind==='start'?[440,659.25]:
      kind==='warning'?[220,164.81]:[523.25,783.99];
    for(let i=0;i<freqs.length;i++){
      const osc=this.ctx.createOscillator(),g=this.ctx.createGain();
      osc.type='sine';osc.frequency.setValueAtTime(freqs[i],t+i*.07);
      g.gain.setValueAtTime(.0001,t+i*.07);
      g.gain.exponentialRampToValueAtTime(Math.max(.0002,this.volume*.025),t+i*.07+.025);
      g.gain.exponentialRampToValueAtTime(.0001,t+i*.07+.4);
      osc.connect(g);g.connect(this.ctx.destination);
      osc.start(t+i*.07);osc.stop(t+i*.07+.43);
    }
  }
  stop(){
    this.enabled=false;
    try{
      if(this.ctx){this.pad.forEach(v=>v.stop());void this.ctx.close();}
    }catch{}
    this.ctx=null;this.main=null;this.pad=[];
  }
}
