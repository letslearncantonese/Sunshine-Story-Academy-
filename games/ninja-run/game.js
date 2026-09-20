(function(){
const LANES = [-1, 0, 1];
const LANE_WIDTH = 2.35;
const CONTACT_Z = 3.6;

class Runner {
  constructor(random = Math.random) { this.random = random; this.reset(); }
  reset(level = 1, bank = 0) {
    this.level = level; this.bank = bank;
    this.phase = 'ready'; this.distance = 0; this.time = 0; this.speed = (9 + (level - 1) * 2) * 1.12;
    this.lane = 0; this.lanePosition = 0; this.jumpY = 0; this.jumpV = 0;
    this.duckTime = 0; this.duckHeld = false; this.invincible = 0;
    this.hearts = 3; this.points = 0; this.combo = 0; this.bestCombo = 0;
    this.attackCooldown = 0; this.items = []; this.events = [];
    this.nextZ = 38; this.group = 0; this.serial = 0; this.safeLane = 0;
    this.lastKind = ''; this.collected = []; this.fillTrack();
  }
  item(kind, lane, z, extra = {}) {
    const item = {id: ++this.serial, kind, lane, z, resolved: false, hit: false, ...extra};
    this.items.push(item); return item;
  }
  fillTrack() {
    const sequence = ['log','enemy','beam','wall','enemy','log','beam','enemy','wall','enemy'];
    while (this.group < 10 && this.nextZ < this.distance + 190) {
      const i = this.group++, kind = sequence[i];
      if (kind === 'wall') {
        this.safeLane = i === 3 ? -1 : 1;
        this.item(kind, null, this.nextZ, {lanes: LANES.filter(x => x !== this.safeLane), safeLane: this.safeLane});
      } else if (kind === 'enemy') {
        this.item(kind, 0, this.nextZ, {lanePosition: 0, walking: false, contactTime: 0});
      } else this.item(kind, null, this.nextZ);
      this.item('orb', 0, this.nextZ + 23, {value: (i + 1) * 4});
      const extra = this.level >= 3 && [1,4,7].includes(i) ? 'boulder' : this.level >= 2 && [2,5,8].includes(i) ? 'bat' : null;
      if (extra) this.item(extra, null, this.nextZ + 43, {drift: extra === 'bat' ? 5 : 4});
      this.nextZ += extra ? 66 : 46;
    }
  }
  nextLevel() {
    if (this.phase !== 'stageclear' || this.level >= 3) return false;
    this.reset(this.level + 1, this.score); return true;
  }
  impactTime(item) {
    return (item.z - this.distance - CONTACT_Z) / (this.speed + (item.drift || 0));
  }
  move(direction) {
    if (this.phase !== 'running' || ![-1, 1].includes(direction)) return false;
    const next = Math.max(-1, Math.min(1, this.lane + direction));
    if (next === this.lane) return false;
    this.lane = next; this.events.push({type: 'move', direction}); return true;
  }
  jump() {
    if (this.phase !== 'running' || this.jumpY > .02) return false;
    this.duckTime = 0; this.duckHeld = false; this.jumpV = 7.2; this.jumpY = .025;
    this.events.push({type: 'jump'}); return true;
  }
  duck(held = false) {
    if (this.phase !== 'running') return false;
    this.duckHeld = held; this.duckTime = 1.25;
    if (this.jumpY > 0) this.jumpV = Math.min(this.jumpV, -7);
    this.events.push({type: 'duck'}); return true;
  }
  releaseDuck() { this.duckHeld = false; }
  attack(id) {
    if (this.phase !== 'running' || this.attackCooldown > 0) return false;
    const e = this.items.find(x => x.id === id && x.kind === 'enemy' && !x.resolved);
    if (!e || e.z - this.distance < CONTACT_Z || e.z - this.distance > 12) return false;
    e.resolved = true; e.hit = true; this.attackCooldown = .2;
    this.points += 50; this.combo++; this.bestCombo = Math.max(this.bestCombo, this.combo);
    this.events.push({type: 'attack', id, lane: e.lanePosition ?? e.lane, z: e.z}); return true;
  }
  releaseEvents() { return this.events.splice(0); }
  update(dt) {
    if (this.phase !== 'running') return;
    dt = Math.min(.04, Math.max(0, dt));
    this.time += dt; this.speed = (9 + (this.level - 1) * 2 + Math.min(1.6, this.distance / 280)) * 1.12;
    const nearest = this.nearest();
    const enemy = nearest?.kind === 'enemy' && nearest.z - this.distance < 15 ? nearest : null;
    const previousZ = new Map(this.items.map(item => [item.id, item.z]));
    if (!enemy && nearest?.drift && nearest.z - this.distance < 32) nearest.z -= nearest.drift * dt;
    const before = this.distance;
    this.distance += (enemy ? 0 : this.speed) * dt;
    for (const e of this.items) {
      if (e.kind !== 'enemy' || e.resolved || e.id !== nearest?.id || e.z - this.distance > 55) continue;
      e.walking = true;
      e.lanePosition += (this.lanePosition - e.lanePosition) * (1 - Math.exp(-3 * dt));
      e.z = Math.max(this.distance + 6.2, e.z - 3.5 * dt);
      if (e.z - this.distance <= 6.21) {
        e.contactTime += dt;
        if (e.contactTime >= 3) {
          e.resolved = true; e.hit = true; this.hearts--; this.combo = 0;
          this.events.push({type:'damage',kind:'enemy'});
          if (this.hearts <= 0) { this.phase='over'; this.events.push({type:'over'}); return; }
        }
      }
    }
    this.lanePosition += (this.lane - this.lanePosition) * (1 - Math.exp(-15 * dt));
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    this.invincible = Math.max(0, this.invincible - dt);
    this.duckTime = this.duckHeld ? Math.max(this.duckTime, .12) : Math.max(0, this.duckTime - dt);
    if (this.jumpY > 0 || this.jumpV > 0) {
      this.jumpV -= 14 * dt; this.jumpY += this.jumpV * dt;
      if (this.jumpY <= 0) { this.jumpY = 0; this.jumpV = 0; }
    }
    for (const item of this.items) {
      if (item.resolved) continue;
      if (previousZ.get(item.id) - before > CONTACT_Z && item.z - this.distance <= CONTACT_Z) {
        item.resolved = true;
        const sameLane = item.lane === null || Math.abs(this.lanePosition - item.lane) < .58;
        if (item.kind === 'orb') {
          item.hit = true; this.collected.push(item.value); this.points += 40;
          this.events.push({type: 'orb', id: item.id, value: item.value});
          if (item.value === 40) { this.phase = this.level < 3 ? 'stageclear' : 'won'; this.events.push({type:this.phase}); break; }
          continue;
        }
        let collision = false;
        if (item.kind === 'log' || item.kind === 'boulder') collision = this.jumpY < .64;
        if (item.kind === 'beam' || item.kind === 'bat') collision = this.duckTime <= 0 || this.jumpY > .2;
        if (item.kind === 'wall') collision = item.lanes.some(x => Math.abs(this.lanePosition - x) < .65);
        if (item.kind === 'enemy') collision = sameLane;
        if (collision && this.invincible <= 0) {
          this.hearts--; this.combo = 0; this.invincible = 1.45;
          this.events.push({type: 'damage', kind: item.kind});
          if (this.hearts <= 0) { this.phase = 'over'; this.events.push({type: 'over'}); break; }
        } else if (!collision) {
          this.points += 20; this.combo++; this.bestCombo = Math.max(this.bestCombo, this.combo);
          this.events.push({type: 'clear', kind: item.kind});
        }
      }
    }
    this.items = this.items.filter(x => x.z > this.distance - 8); this.fillTrack();
  }
  nearest() { return this.items.filter(x => x.kind !== 'orb' && !x.resolved && x.z - this.distance > CONTACT_Z).sort((a,b) => a.z - b.z)[0]; }
  get score() { return this.bank + Math.floor(this.distance) + this.points; }
  snapshot() { return {phase: this.phase, level: this.level, distance: Math.floor(this.distance), score: this.score, hearts: this.hearts, lane: this.lane, jumping: this.jumpY > .1, crouching: this.duckTime > 0, combo: this.combo, collected: [...this.collected], nextGem: this.collected.length < 10 ? (this.collected.length + 1) * 4 : null}; }
}

const $ = id => document.getElementById(id);
const game = $('game'), canvas = $('world'), ctx = canvas.getContext('2d', {alpha:false});
const runner = new Runner();
const art = {};
let runStride=0, armSwing=0;
let w=1280, h=720, dpr=1, focal=1000, horizon=330, cameraHeight=1.7;
let ready=false, lastTime=0, visualTime=0, duckBlend=0, shake=0, feedbackTime=0;
let hitboxes=[], particles=[], punch=null, countdownLeft=0, countdownNumber=0;
let pausedFrom='running', muted=false, audioContext=null, audioBus=null, musicClock=0, stepClock=0;
const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const padButtons=[...document.querySelectorAll('[data-action]')];
const soundButton=$('sound');
const rand=(a,b)=>a+Math.random()*(b-a);
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));

function resize(){
  const rect=game.getBoundingClientRect(); w=rect.width; h=rect.height;
  dpr=Math.min(window.devicePixelRatio||1,2);
  canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);
  ctx.setTransform(dpr,0,0,dpr,0,0);
}
if (window.ResizeObserver) new ResizeObserver(resize).observe(game);
else window.addEventListener('resize',resize);
resize();
async function loadArt(){
  try{
    await Promise.all(['background','enemy','hands','bat','boulder'].map(name=>new Promise((resolve,reject)=>{
      const img=new Image(); img.onload=()=>{art[name]=img;resolve();};img.onerror=reject;
      img.src='assets/'+({background:'castle.webp',enemy:'mummy.webp',hands:'hands.webp',bat:'bat.webp',boulder:'boulder.webp'}[name]);
    })));
    ready=true;$('start').disabled=false;$('startText').textContent='開始疾走';
  }catch{ $('loadError').hidden=false;$('startText').textContent='重新載入';$('start').disabled=false; }
}
loadArt();

function unlockAudio(){
  try{
    if(!audioContext){
      const AC=window.AudioContext||window.webkitAudioContext;
      if(!AC)return;
      audioContext=new AC();audioBus=audioContext.createGain();audioBus.gain.value=muted?0:.8;audioBus.connect(audioContext.destination);
    }
    if(audioContext.state==='suspended')audioContext.resume().catch(()=>{});
  }catch{}
}
function tone(freq,duration=.15,volume=.12,type='sine',endFreq=null,delay=0){
  if(!audioContext||muted||audioContext.state!=='running')return;
  const t=audioContext.currentTime+delay,osc=audioContext.createOscillator(),gain=audioContext.createGain();
  osc.type=type;osc.frequency.setValueAtTime(freq,t);
  if(endFreq)osc.frequency.exponentialRampToValueAtTime(endFreq,t+duration);
  gain.gain.setValueAtTime(.0001,t);gain.gain.exponentialRampToValueAtTime(volume,t+.006);gain.gain.exponentialRampToValueAtTime(.0001,t+duration);
  osc.connect(gain);gain.connect(audioBus);osc.start(t);osc.stop(t+duration+.03);
}
function noise(duration=.15,volume=.13){
  if(!audioContext||muted||audioContext.state!=='running')return;
  const len=Math.floor(audioContext.sampleRate*duration),buffer=audioContext.createBuffer(1,len,audioContext.sampleRate),data=buffer.getChannelData(0);
  for(let i=0;i<len;i++)data[i]=(Math.random()*2-1)*Math.pow(1-i/len,2);
  const source=audioContext.createBufferSource(),gain=audioContext.createGain(),filter=audioContext.createBiquadFilter();
  filter.type='lowpass';filter.frequency.value=1000;source.buffer=buffer;gain.gain.value=volume;
  source.connect(filter);filter.connect(gain);gain.connect(audioBus);source.start();
}
function audioTick(dt){
  if(runner.phase!=='running')return;
  musicClock+=dt;stepClock+=dt;
  if(stepClock>.31&&runner.jumpY===0){stepClock=0;tone(65,.08,.055,'sine',37);}
  if(musicClock>.63){musicClock=0;const notes=[293.66,349.23,392,440,523.25,440,392,349.23];tone(notes[Math.floor(runner.time/.63)%8],.42,.018,'sine');}
}
function setPhase(phase){
  runner.phase=phase;game.dataset.phase=phase;
  game.style.touchAction=['stageclear','won','over','paused'].includes(phase)?'pan-y':'none';
  $('welcome').hidden=phase!=='ready';$('pausePanel').hidden=phase!=='paused';$('overPanel').hidden=!['over','won','stageclear'].includes(phase);
  $('countdown').hidden=phase!=='countdown';$('pause').disabled=!['running','countdown'].includes(phase);
  padButtons.forEach(button=>{button.disabled=phase!=='running';});
  if(!['running','countdown'].includes(phase))$('cue').hidden=true;
}
function feedback(text,duration=1.1){$('feedback').textContent=text;feedbackTime=duration;}
function start(){
  if(!ready){location.reload();return false;}
  unlockAudio();runner.reset();return beginCountdown();
}
function beginCountdown(){
  runStride=0;armSwing=0;particles=[];punch=null;shake=0;duckBlend=0;musicClock=0;stepClock=0;
  lastCueId=null;feedback('');countdownLeft=3;countdownNumber=3;$('countdown').textContent='3';setPhase('countdown');tone(392,.13,.1);
  updateHUD();return true;
}
function pause(){
  if(!['running','countdown'].includes(runner.phase))return false;
  pausedFrom=runner.phase;runner.releaseDuck();clearPressed();setPhase('paused');$('resume').focus({preventScroll:true});return true;
}
function resume(){
  if(runner.phase!=='paused')return false;
  unlockAudio();setPhase(pausedFrom);lastTime=performance.now();return true;
}
function finish(won=false,stageClear=false){
  setPhase(stageClear?'stageclear':won?'won':'over');
  $('overTitle').textContent=stageClear?`第 ${runner.level} 關完成！`:won?'三關全部完成！':'再試一次，小忍者！';
  $('resultLabel').textContent=stageClear||won?'4 嘅倍數，全部集齊！':'完成今次冒險';
  $('finalSequence').hidden=!(won||stageClear);runner.releaseDuck();clearPressed();
  $('finalDistance').textContent=runner.collected.length;$('finalScore').textContent=runner.score;
  $('finalCombo').textContent=stageClear?(runner.level===1?'下一關快少少：踎低避開蝙蝠！':'最後一關再加速：跳起避開滾石！'):`最高連續成功 ${runner.bestCombo} 次`;
  $('nextLevel').hidden=!stageClear;
  $('nextLevel').textContent=`進入第 ${runner.level+1} 關`;
  $('restart').textContent=stageClear?'由第一關重新開始':'再挑戰三關';
  if(won||stageClear)[523,659,784,1047].forEach((n,i)=>tone(n,.32,.19,'triangle',null,i*.13));
  else tone(330,.25,.16,'sine',220);
  $(stageClear?'nextLevel':'restart').focus({preventScroll:true});
}
function action(name,held=false){
  unlockAudio();let accepted=false;
  if(name==='left')accepted=runner.move(-1);
  if(name==='right')accepted=runner.move(1);
  if(name==='jump')accepted=runner.jump();
  if(name==='duck')accepted=runner.duck(held);
  if(name==='attack'){
    const enemy=runner.items.filter(x=>x.kind==='enemy'&&!x.resolved&&x.z-runner.distance>CONTACT_Z&&x.z-runner.distance<=12).sort((a,b)=>a.z-b.z)[0];
    if(enemy)accepted=runner.attack(enemy.id);
  }
  return accepted;
}
function clearPressed(){padButtons.forEach(x=>x.classList.remove('pressed'));}
for(const button of padButtons){
  let lastPress=-Infinity;
  const press=e=>{
    if(button.disabled)return;
    e.preventDefault();lastPress=performance.now();
    if(action(button.dataset.action,button.dataset.action==='duck'))button.classList.add('pressed');
    if(e.pointerId!==undefined){try{button.setPointerCapture?.(e.pointerId);}catch{}}
  };
  const release=()=>{button.classList.remove('pressed');if(button.dataset.action==='duck')runner.releaseDuck();};
  if(window.PointerEvent){
    button.addEventListener('pointerdown',press);
    button.addEventListener('pointerup',release);button.addEventListener('pointercancel',release);button.addEventListener('lostpointercapture',release);
  }else{
    button.addEventListener('touchstart',press,{passive:false});
    button.addEventListener('touchend',release);button.addEventListener('touchcancel',release);
  }
  button.addEventListener('click',e=>{
    if(performance.now()-lastPress<500)return;
    if(action(button.dataset.action)){button.classList.add('pressed');setTimeout(release,140);}
  });
}
$('start').addEventListener('click',start);$('restart').addEventListener('click',start);$('restartPause').addEventListener('click',start);
$('nextLevel').addEventListener('click',()=>{unlockAudio();if(runner.nextLevel())beginCountdown();});
$('pause').addEventListener('click',pause);$('resume').addEventListener('click',resume);
soundButton.addEventListener('click',()=>{
  unlockAudio();muted=!muted;if(audioBus)audioBus.gain.value=muted?0:.8;
  soundButton.setAttribute('aria-pressed',String(muted));soundButton.setAttribute('aria-label',muted?'開啟聲音':'關閉聲音');
  soundButton.querySelector('use').setAttribute('href',muted?'#i-mute':'#i-sound');
  if(!muted)tone(523,.15,.1);
});
$('fullscreen').addEventListener('click',async()=>{
  try{
    if(document.fullscreenElement){await document.exitFullscreen();}
    else if(game.classList.contains('expanded'))game.classList.remove('expanded');
    else if(game.requestFullscreen)await game.requestFullscreen();
    else game.classList.add('expanded');
  }catch{game.classList.toggle('expanded');}
});
document.addEventListener('fullscreenchange',()=>{$('fullscreen').setAttribute('aria-label',document.fullscreenElement?'離開全螢幕':'全螢幕');resize();});
const keyMap={ArrowLeft:'left',KeyA:'left',ArrowRight:'right',KeyD:'right',ArrowUp:'jump',KeyW:'jump',Space:'jump',ArrowDown:'duck',KeyS:'duck',KeyF:'attack'};
window.addEventListener('keydown',e=>{
  if(e.code==='Escape'||e.code==='KeyP'){
    if(runner.phase==='paused')resume();else pause();return;
  }
  if(runner.phase!=='running')return;
  const name=keyMap[e.code];if(!name)return;e.preventDefault();if(e.repeat)return;
  if(action(name,name==='duck'))padButtons.find(x=>x.dataset.action===name)?.classList.add('pressed');
});
window.addEventListener('keyup',e=>{
  const name=keyMap[e.code];padButtons.find(x=>x.dataset.action===name)?.classList.remove('pressed');
  if(name==='duck')runner.releaseDuck();
});
window.addEventListener('blur',()=>{pause();runner.releaseDuck();clearPressed();});
document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
let gesture=null;
canvas.addEventListener('pointerdown',e=>{
  if(runner.phase!=='running')return;
  e.preventDefault();unlockAudio();const r=canvas.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;
  const target=[...hitboxes].reverse().find(b=>x>=b.x&&x<=b.x+b.w&&y>=b.y&&y<=b.y+b.h);
  if(target){gesture=null;if(!runner.attack(target.id))feedback('等佢行近，先出拳！');return;}
  gesture={id:e.pointerId,x,y};try{canvas.setPointerCapture?.(e.pointerId);}catch{}
});
canvas.addEventListener('pointermove',e=>{
  if(!gesture||gesture.id!==e.pointerId)return;
  const r=canvas.getBoundingClientRect(),dx=e.clientX-r.left-gesture.x,dy=e.clientY-r.top-gesture.y;
  if(Math.max(Math.abs(dx),Math.abs(dy))<30)return;
  action(Math.abs(dx)>Math.abs(dy)?(dx>0?'right':'left'):(dy>0?'duck':'jump'));gesture=null;
});
canvas.addEventListener('pointerup',()=>{gesture=null;});canvas.addEventListener('pointercancel',()=>{gesture=null;});
canvas.addEventListener('contextmenu',e=>e.preventDefault());

function project(x,y,z){z=Math.max(.6,z);return{x:w/2+(x-runner.lanePosition*LANE_WIDTH)*focal/z,y:horizon+(cameraHeight-y)*focal/z,s:focal/z};}
function polygon(points,fill,stroke=null,width=1){
  ctx.beginPath();ctx.moveTo(points[0].x,points[0].y);for(let i=1;i<points.length;i++)ctx.lineTo(points[i].x,points[i].y);ctx.closePath();ctx.fillStyle=fill;ctx.fill();
  if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.stroke();}
}
function quad(x1,x2,y,z1,z2,color,stroke=null){polygon([project(x1,y,z1),project(x2,y,z1),project(x2,y,z2),project(x1,y,z2)],color,stroke);}
function line3(a,b,color,width=1){const p=project(...a),q=project(...b);ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(q.x,q.y);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();}
function box(x,y,z,bw,bh,depth,colors=['#997647','#c5a069','#514d35']){
  const a=x-bw/2,b=x+bw/2,f=z-depth/2,bk=z+depth/2;
  if(f<.7)return;
  const p=(xx,yy,zz)=>project(xx,yy,zz);
  polygon([p(a,y,bk),p(b,y,bk),p(b,y+bh,bk),p(a,y+bh,bk)],colors[2]);
  polygon([p(a,y,f),p(a,y,bk),p(a,y+bh,bk),p(a,y+bh,f)],colors[2]);
  polygon([p(b,y,bk),p(b,y,f),p(b,y+bh,f),p(b,y+bh,bk)],colors[2]);
  polygon([p(a,y+bh,f),p(b,y+bh,f),p(b,y+bh,bk),p(a,y+bh,bk)],colors[1]);
  polygon([p(a,y,f),p(b,y,f),p(b,y+bh,f),p(a,y+bh,f)],colors[0],'#041c2460',1);
}
function backdrop(){
  if(art.background){
    const im=art.background,s=Math.max(w/im.width,h/im.height)*1.035;
    const bw=im.width*s,bh=im.height*s;
    ctx.drawImage(im,(w-bw)/2-runner.lanePosition*7,(h-bh)/2-runner.jumpY*4,bw,bh);
  }else{ctx.fillStyle='#103b43';ctx.fillRect(0,0,w,h);}
  const floor=ctx.createLinearGradient(0,h*.48,0,h);floor.addColorStop(0,'#062f3000');floor.addColorStop(.45,'#062a2da0');floor.addColorStop(1,'#051d25');ctx.fillStyle=floor;ctx.fillRect(0,h*.48,w,h*.52);
}
function track(){
  const half=LANE_WIDTH*1.5;
  quad(-half,half,0,.65,230,'#303c49');
  const slab=3.3,start=Math.floor(runner.distance/slab);
  for(let i=start+65;i>=start;i--){
    const z=i*slab-runner.distance;
    if(z<.75)continue;
    for(let lane=-1;lane<=1;lane++){
      const v=(i+lane+3)%3;
      quad(lane*LANE_WIDTH-1.12,lane*LANE_WIDTH+1.12,.01,z,z+slab-.1,['#465361','#4b5864','#3e4c59'][v],'#7c92834a');
    }
    if(i%2===0){
      for(const sign of [-1,1])quad(sign*(half+.13)-.12,sign*(half+.13)+.12,.015,z,z+slab-.1,'#7b8e70');
    }
  }
  for(const x of [-half,half]){
    line3([x,.08,.85],[x,.08,220],'#d2b87399',2);
    line3([x+.13,.1,.85],[x+.13,.1,220],'#16403b',2);
  }
  const fog=ctx.createLinearGradient(0,horizon,0,horizon+h*.13);fog.addColorStop(0,'#628781b0');fog.addColorStop(1,'#537d7300');quad(-half,half,.03,7,230,fog);
}
function label(text,x,y,color='#ffcc76',size=16){
  size=clamp(size,13,22);ctx.font=`800 ${size}px system-ui, sans-serif`;
  const tw=ctx.measureText(text).width,bw=tw+22,bh=size+16;
  x=clamp(x,bw/2+8,w-bw/2-8);y=clamp(y,55,h-100);
  ctx.fillStyle='#06252ee8';ctx.strokeStyle=color;ctx.lineWidth=1.2;ctx.beginPath();if(ctx.roundRect)ctx.roundRect(x-bw/2,y-bh/2,bw,bh,9);else ctx.rect(x-bw/2,y-bh/2,bw,bh);ctx.fill();ctx.stroke();
  ctx.fillStyle=color;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,x,y);
}
function drawOrb(item,z){
  if(item.hit)return;
  // Gems gently move into the player's path, keeping the learning sequence complete.
  const attraction=clamp((22-z)/16,0,1);
  const p=project(runner.lanePosition*LANE_WIDTH*attraction,1.05,z);
  const r=clamp(p.s*.44,6,82);
  const glow=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,r*2.4);
  glow.addColorStop(0,'#73ffe58c');glow.addColorStop(1,'#73ffe500');
  ctx.fillStyle=glow;ctx.fillRect(p.x-r*2.4,p.y-r*2.4,r*4.8,r*4.8);
  polygon([{x:p.x-r*.72,y:p.y-r*.8},{x:p.x+r*.72,y:p.y-r*.8},{x:p.x+r,y:p.y-r*.13},{x:p.x,y:p.y+r},{x:p.x-r,y:p.y-r*.13}],'#66e4d0','#dafff3',2);
  polygon([{x:p.x-r*.72,y:p.y-r*.8},{x:p.x,y:p.y-r*.13},{x:p.x+r*.72,y:p.y-r*.8}],'#c6fff0');
  if(z<70){
    const size=clamp(r*.82,20,62);
    ctx.font=`900 ${size}px system-ui,sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.lineWidth=4;ctx.strokeStyle='#e8fff1';ctx.strokeText(String(item.value),p.x,p.y);
    ctx.fillStyle='#143b4d';ctx.fillText(String(item.value),p.x,p.y);
  }
}
function drawEnemy(item,z){
  if(item.hit||!art.enemy)return;
  const feet=project((item.lanePosition??item.lane)*LANE_WIDTH,0,z),head=project((item.lanePosition??item.lane)*LANE_WIDTH,2.1,z),eh=feet.y-head.y,ew=eh*art.enemy.width/art.enemy.height;
  if(feet.x+ew/2<0||feet.x-ew/2>w)return;
  ctx.fillStyle='#021b2699';ctx.beginPath();ctx.ellipse(feet.x,feet.y,ew*.31,eh*.045,0,0,Math.PI*2);ctx.fill();
  const walking=item.walking&&z>6.3;
  const bounce=walking?-Math.abs(Math.sin(visualTime*7+item.id))*eh*.025:0;
  ctx.save();ctx.translate(feet.x,feet.y);
  if(walking)ctx.rotate(Math.sin(visualTime*7+item.id)*.025);
  ctx.drawImage(art.enemy,-ew/2,-eh+bounce,ew,eh);ctx.restore();
  if(!item.resolved&&runner.phase==='running'){
    const pad=clamp(18-eh*.02,4,18),bx=feet.x-ew*.40-pad,by=head.y+eh*.02-pad,bw=ew*.8+pad*2,bh=eh*.94+pad*2;
    hitboxes.push({id:item.id,x:bx,y:by,w:bw,h:bh});
    if(z<=12){
      const r=Math.max(20,eh*.27),cx=feet.x,cy=head.y+eh*.39;
      ctx.strokeStyle='#ffd082';ctx.lineWidth=2;ctx.globalAlpha=.8+.2*Math.sin(visualTime*5);ctx.beginPath();
      for(let i=0;i<4;i++)ctx.arc(cx,cy,r,i*Math.PI/2+.14,i*Math.PI/2+.95);
      ctx.stroke();ctx.globalAlpha=1;
      if(z>5)label('出拳！',cx,head.y-18,'#ffcf80',clamp(eh*.11,14,19));
    }
  }
}
function drawObstacle(item,z,nearest){
  const half=LANE_WIDTH*1.5;
  if(item.kind==='bat'&&art.bat){
    for(const lane of [-1,0,1]){
      const p=project(lane*LANE_WIDTH,1.9+Math.sin(visualTime*8+lane)*.07,z);
      const width=p.s*1.65, height=width*art.bat.height/art.bat.width;
      const flap=.65+Math.abs(Math.sin(visualTime*12+lane))*.35;
      ctx.drawImage(art.bat,p.x-width/2,p.y-height*flap/2,width,height*flap);
    }
    if(nearest){const p=project(0,2.6,z);label('↓ 踎低',p.x,p.y,'#d1bbff',20);}
  }
  if(item.kind==='boulder'&&art.boulder){
    for(const lane of [-1,0,1]){
      const p=project(lane*LANE_WIDTH,.48,z),size=p.s*1.1;
      ctx.save();ctx.translate(p.x,p.y);ctx.rotate(visualTime*3.5+lane);
      ctx.drawImage(art.boulder,-size/2,-size/2,size,size);ctx.restore();
    }
    if(nearest){const p=project(0,1.3,z);label('↑ 跳起',p.x,p.y,'#ffd37e',20);}
  }
  if(item.kind==='log'){
    box(0,.05,z,half*2,.56,.42,['#aa6937','#ddb272','#5b4430']);
    for(let i=-3;i<=3;i++)box(i,.05,z-.23,.14,.56,.035,['#efc777','#f6dc9b','#af824e']);
    for(const side of [-1,1])box(side*(half-.08),0,z,.2,.8,.35,['#745939','#cda476','#3e4331']);
    if(nearest){const p=project(0,1.13,z);label('↑ 跳起',p.x,p.y,'#ffd37e',clamp(p.s*.25,14,22));}
  }
  if(item.kind==='beam'){
    for(const side of [-1,1])box(side*(half-.1),0,z,.22,2.9,.42,['#235f5d','#7bc0a0','#173b41']);
    box(0,1.1,z,half*2,1.25,.48,['#256368','#73afa0','#17424b']);
    box(0,1.08,z-.26,half*2,.12,.04,['#9ee3c2','#d2f6d4','#3b897d']);
    for(let i=-3;i<=3;i++)line3([i-.25,2.02,z-.26],[i+.25,1.48,z-.26],'#9cdbb866',Math.max(2,focal/z*.065));
    if(nearest){const p=project(0,2.85,z);label('↓ 踎低',p.x,p.y,'#a5f2d0',clamp(p.s*.25,14,22));}
  }
  if(item.kind==='wall'){
    const safe=item.safeLane*LANE_WIDTH;
    quad(safe-1.02,safe+1.02,.02,z-3,z+2,'#94edb942');
    for(const lane of item.lanes){
      const x=lane*LANE_WIDTH;
      box(x,0,z,2.12,2.13,.85,['#80633f','#be9b62','#403d32']);
      box(x,.1,z-.46,1.92,.1,.03,['#cfaa6e','#e7c38a','#655031']);
      box(x,1.92,z-.46,1.92,.12,.03,['#cfaa6e','#e7c38a','#655031']);
      for(const sign of [-1,1])box(x+sign*.87,0,z-.46,.11,2.1,.04,['#bf9860','#dab780','#655031']);
      line3([x-.8,.25,z-.48],[x+.8,1.82,z-.48],'#c39f67',Math.max(1,focal/z*.12));
      line3([x+.8,.25,z-.49],[x-.8,1.82,z-.49],'#c39f67',Math.max(1,focal/z*.12));
    }
    if(nearest){const p=project(safe,1.1,z);label('呢邊！',p.x,p.y,'#b3ffd4',clamp(p.s*.24,14,21));}
  }
}
function drawWorldItems(){
  hitboxes=[];const nearest=runner.nearest();
  const sorted=runner.items.filter(x=>x.z-runner.distance>.85&&x.z-runner.distance<180).sort((a,b)=>b.z-a.z);
  for(const item of sorted){
    const z=item.z-runner.distance;
    ctx.globalAlpha=clamp((180-z)/60,0,1);
    if(item.kind==='orb')drawOrb(item,z);
    else if(item.kind==='enemy')drawEnemy(item,z);
    else drawObstacle(item,z,nearest?.id===item.id&&runner.impactTime(item)<(item.kind==='wall'?1.1:.65)&&!item.resolved);
    ctx.globalAlpha=1;
  }
}
function burst(x,y,color='#ffe4a4',amount=20){
  for(let i=0;i<amount;i++)particles.push({x,y,vx:rand(-190,190),vy:rand(-200,90),r:rand(3,8),life:rand(.3,.65),max:.65,color});
}
function hands(){
  if(!art.hands||runner.phase==='ready')return;
  const im=art.hands;
  const baseWidth=Math.max(w*1.05,h*.95),scale=baseWidth/im.width;
  const dw=im.width/2*scale,dh=im.height*scale;
  const bottomY=h-dh*.68+duckBlend*h*.1;
  const amplitude=armSwing*(reducedMotion?.009:.038)*h;
  const bob=Math.sin(runStride)*amplitude;
  for(let side=0;side<2;side++){
    let x=side===0?(w-baseWidth)/2:w/2,y=bottomY+(side===0?bob:-bob);
    const swing=side===0?1:-1;
    x+=Math.cos(runStride)*amplitude*.22*swing;
    let pscale=1;
    if(punch&&punch.side===side){
      const t=clamp(punch.age/.32,0,1),reach=Math.sin(t*Math.PI);
      const fistX=side===0?x+dw*.48:x+dw*.52,fistY=y+dh*.51;
      x+=(punch.x-fistX)*reach*.83;y+=(punch.y-fistY)*reach*.9;pscale=1+reach*.13;
    }
    const tilt=punch&&punch.side===side?0:Math.sin(runStride)*armSwing*.035*swing;
    ctx.save();ctx.translate(x+dw/2,y+dh*.7);ctx.rotate(tilt);
    ctx.drawImage(im,side*im.width/2,0,im.width/2,im.height,-dw/2,-dh*.7,dw*pscale,dh*pscale);ctx.restore();
  }
}
function drawEffects(dt){
  particles=particles.filter(p=>p.life>0);
  for(const p of particles){
    if(runner.phase!=='paused'){p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=240*dt;}
    ctx.globalAlpha=clamp(p.life/p.max,0,1);ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(p.x,p.y,p.r*(1.3-p.life),0,Math.PI*2);ctx.fill();
  }
  ctx.globalAlpha=1;
  if(punch){
    if(runner.phase!=='paused')punch.age+=dt;
    if(punch.age<.22){const t=punch.age/.22;ctx.strokeStyle=`rgba(255,228,170,${1-t})`;ctx.lineWidth=4*(1-t);ctx.beginPath();ctx.arc(punch.x,punch.y,15+t*75,0,Math.PI*2);ctx.stroke();}
    if(punch.age>.34)punch=null;
  }
}
function consumeEvents(){
  for(const event of runner.releaseEvents()){
    if(event.type==='jump'){noise(.15,.055);tone(220,.19,.085,'sine',490);}
    if(event.type==='duck')noise(.24,.06);
    if(event.type==='move')noise(.06,.04);
    if(event.type==='orb'){[784,1047,1568].forEach((n,i)=>tone(n,.19,.17,'sine',null,i*.065));feedback(event.value+'！',1.3);}
    if(event.type==='attack'){
      const b=hitboxes.find(x=>x.id===event.id),p=project(event.lane*LANE_WIDTH,1.25,event.z-runner.distance);
      const x=b?b.x+b.w*.5:p.x,y=b?b.y+b.h*.38:p.y;
      punch={x,y,age:0,side:x<w/2?0:1};burst(x,y,'#d9eee0',23);burst(x,y,'#ffcc78',13);
      noise(.2,.55);tone(145,.18,.35,'sine',42);tone(420,.075,.12,'triangle',110);feedback('命中！ +50');
    }
    if(event.type==='clear'&&runner.combo%5===0){feedback(`${runner.combo} 連續成功！`);tone(659,.22,.11);}
    if(event.type==='damage'){
      shake=.35;$('hitFlash').style.opacity='1';noise(.25,.2);tone(190,.25,.15,'sine',80);
      const hints={boulder:'跳起避開滾石！',bat:'踎低避開蝙蝠！',log:'木欄要跳過去！',beam:'橫樑要踎低！',wall:'記住左右閃避！',enemy:'撳敵人就可以出拳！'};
      feedback(hints[event.kind],1.8);
    }
    if(event.type==='over')finish();
    if(event.type==='won')finish(true);
    if(event.type==='stageclear')finish(false,true);
  }
}
function updateHUD(){
  $('stageLabel').textContent=`第 ${runner.level} 關 / 3 · 四方城堡`;
  $('distance').textContent=runner.collected.length;$('score').textContent=runner.score.toLocaleString();
  [...$('hearts').children].forEach((el,i)=>el.classList.toggle('lost',i>=runner.hearts));
  $('hearts').setAttribute('aria-label',`${runner.hearts} 個心心`);
  $('combo').hidden=runner.combo<2||runner.phase==='ready';$('comboNumber').textContent=runner.combo;
  [...$('laneDots').children].forEach((el,i)=>el.classList.toggle('active',i===runner.lane+1));
  $('laneDots').setAttribute('aria-label',['左邊路線','中間路線','右邊路線'][runner.lane+1]);
  const nearest=runner.nearest();
  if(runner.phase==='running'&&nearest){
    const time=runner.impactTime(nearest);
    const cue=$('cue');cue.hidden=time>(nearest.kind==='wall'?1.1:.65);
    let message='';
    if(nearest.kind==='log')message='↑ 跳起！';
    if(nearest.kind==='beam')message='↓ 踎低！';
    if(nearest.kind==='bat')message='↓ 踎低避蝙蝠！';
    if(nearest.kind==='boulder')message='↑ 跳過滾石！';
    if(nearest.kind==='wall')message=runner.lane===nearest.safeLane?'沿住呢條路！':nearest.safeLane<runner.lane?'← 移左！':'移右！ →';
    if(nearest.kind==='enemy'){message=nearest.z-runner.distance<=12?'✦ 出拳打木乃伊！':'木乃伊行緊過嚟！';cue.hidden=false;}
    if(!cue.hidden&&lastCueId!==nearest.id){lastCueId=nearest.id;tone(['beam','bat'].includes(nearest.kind)?330:660,.1,.14,'sine');}
    if(cue.textContent!==message)cue.textContent=message;
    cue.classList.toggle('urgent',time<.72&&nearest.kind!=='enemy');
  }else $('cue').hidden=true;
}
let hudClock=0;
let lastCueId=null;
function frame(now){
  const dt=Math.min(.04,Math.max(0,(now-lastTime)/1000||0));lastTime=now;
  const active=runner.phase==='running'||runner.phase==='countdown';
  if(active||runner.phase==='ready')visualTime+=dt;
  if(runner.phase==='countdown'){
    countdownLeft-=dt;const n=Math.ceil(countdownLeft);
    if(n!==countdownNumber&&n>0){countdownNumber=n;$('countdown').textContent=n;tone(392,.13,.1);}
    if(countdownLeft<=0){setPhase('running');tone(784,.24,.14);feedback('出發！',1.1);}
  }
  const previousDistance=runner.distance;
  runner.update(dt);consumeEvents();audioTick(dt);
  const travelled=runner.distance-previousDistance;
  const running=runner.phase==='running'&&travelled>0&&runner.jumpY<.1&&runner.duckTime<=0;
  if(runner.phase!=='paused'){
    if(running)runStride+=travelled*1.16;
    armSwing+=(Number(running)-armSwing)*(1-Math.exp(-12*dt));
  }
  if(active){
    feedbackTime-=dt;if(feedbackTime<=0)$('feedback').textContent='';
    shake=Math.max(0,shake-dt);if(shake<.23)$('hitFlash').style.opacity='0';
    duckBlend+=(Number(runner.duckTime>0)-duckBlend)*(1-Math.exp(-14*dt));
  }
  focal=Math.max(w*.8,h*.64);horizon=h*.5;
  const bob=active&&!reducedMotion&&runner.jumpY===0&&runner.duckTime<=0?Math.sin(visualTime*12)*.025:0;
  cameraHeight=1.7+runner.jumpY*.82-duckBlend*.79+bob;
  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.save();
  if(shake>0&&!reducedMotion)ctx.translate(Math.sin(now*.07)*shake*12,Math.cos(now*.09)*shake*7);
  backdrop();track();drawWorldItems();hands();drawEffects(dt);ctx.restore();
  hudClock+=dt;if(hudClock>.07){hudClock=0;updateHUD();}
  requestAnimationFrame(frame);
}
setPhase('ready');requestAnimationFrame(frame);

// Agent actions share the same game state and controls as the visible interface.
const modelContext=document.modelContext;
if(modelContext?.registerTool){
  const lifecycle=new AbortController();
  const tools=[
    {name:'read_ninja_run',title:'Read ninja game',description:'Read the current run, health, lane and score.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:false},execute:()=>runner.snapshot()},
    {name:'control_ninja_run',title:'Control ninja game',description:'Start a new run, pause, resume, or perform a ninja action in the active run. Starting resets the current score and begins the countdown.',inputSchema:{type:'object',properties:{action:{type:'string',enum:['start','pause','resume','left','right','jump','duck','attack']}},required:['action'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute:input=>{
      const allowed=['start','pause','resume','left','right','jump','duck','attack'];
      if(!input||Object.keys(input).length!==1||!allowed.includes(input.action))throw new Error('Invalid game action.');
      if(input.action==='start'&&!ready)throw new Error('Game artwork is still loading.');
      const ok=input.action==='start'?start():input.action==='pause'?pause():input.action==='resume'?resume():action(input.action);
      consumeEvents();updateHUD();return{accepted:ok,...runner.snapshot()};
    }}
  ];
  for(const tool of tools){try{Promise.resolve(modelContext.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{});}catch{}}
  window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});
}

})();
