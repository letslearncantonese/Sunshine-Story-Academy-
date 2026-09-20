'use strict';
const $=id=>document.getElementById(id);
const canvas=$('gameCanvas'),ctx=canvas.getContext('2d');
const tracks={dragon:{url:'audio/dragon-dash.mp3',name:'Dragon Dash'},formation:{url:'audio/four-formation-long.mp3',name:'四象陣法齊出2'},rap:{url:'audio/four-rap.mp3',name:'四象rap'}};
const BASE_BPM=129.2, FIRST_BEAT_OFFSET=.279, BASE_BEAT_SECONDS=60/BASE_BPM;
const ROLL_SUBDIVISIONS=4, PREP_BEATS=4;
let playbackRate=1,effectiveBPM=BASE_BPM,effectiveBeatDuration=BASE_BEAT_SECONDS;
let previewSource=null,bgmSource=null,previewToken=0,flowToken=0,state='menu',gameLoopId=0;
let TARGET_X=0,NOTE_RADIUS=35,pixelsPerBeat=100,pixelsPerMs=0,MS_PER_BEAT=BASE_BEAT_SECONDS*1000,HIT_WINDOW=MS_PER_BEAT*.6;
let score=0,combo=0,notes=[],scheduledBeats=[],rollSections=[],particles=[],texts=[],flashUntil=0;
let song='dragon',endAt=Infinity,successStartedAt=0;
const beatTime=beat=>FIRST_BEAT_OFFSET+beat*BASE_BEAT_SECONDS;
const musicTime=()=>musicPlayer.currentTime*1000;
function status(message){$('audioStatus').textContent=message;}
let sfxContext=null,sfxGain=null,sfxLoading=null;
const sampleBuffers=new Map(),sfxVoices=new Set();
function initAudio(){
 if(!sfxContext){const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return Promise.resolve();sfxContext=new AC({latencyHint:'interactive'});sfxGain=sfxContext.createGain();sfxGain.gain.value=Number($('sfxVolume').value)/100;sfxGain.connect(sfxContext.destination);}
 const resumed=sfxContext.state==='running'?Promise.resolve():sfxContext.resume();
 if(!sfxLoading)sfxLoading=Promise.all(['don','ka','wrong','finish'].map(async kind=>{const r=await fetch('audio/'+kind+'.wav');if(!r.ok)throw Error('sample');sampleBuffers.set(kind,await sfxContext.decodeAudioData(await r.arrayBuffer()));})).catch(()=>{});
 return Promise.all([resumed,sfxLoading]);
}
function setSpeed(rate){
 if(![.8,.9,1,1.1].includes(Number(rate)))return;
 playbackRate=Number(rate);effectiveBPM=BASE_BPM*playbackRate;effectiveBeatDuration=60/effectiveBPM;
 musicPlayer.playbackRate=playbackRate;musicPlayer.defaultPlaybackRate=playbackRate;
 $('speedSelect').value=String(playbackRate);
}
// Native media playback: real WAV drums and MP3 music, independent of Web Audio output.
const musicPlayer=new Audio();musicPlayer.preload='auto';musicPlayer.loop=false;musicPlayer.setAttribute('playsinline','');
const drumPools={};const poolIndex={};
for(const kind of ['don','ka','wrong','finish']){drumPools[kind]=Array.from({length:kind==='don'||kind==='ka'?6:1},()=>{const a=new Audio('audio/'+kind+'.wav');a.preload='auto';a.setAttribute('playsinline','');return a;});poolIndex[kind]=0;}
function mediaError(error){if(error&&error.name==='AbortError')return;status('播聲受阻：請撳「重新開聲」');$('startMessage').textContent='如果仍然冇聲，請用 Safari 開呢個遊戲，再撳「試鼓聲」。';}
function playSample(kind){
 if(sfxContext?.state==='running'&&sampleBuffers.has(kind)){
  const voice=sfxContext.createBufferSource();voice.buffer=sampleBuffers.get(kind);voice.connect(sfxGain);sfxVoices.add(voice);voice.onended=()=>{sfxVoices.delete(voice);voice.disconnect();};voice.start();return;
 }
 const pool=drumPools[kind],a=pool[poolIndex[kind]++%pool.length];a.pause();a.currentTime=0;a.volume=Number($('sfxVolume').value)/100;a.muted=false;const playing=a.play();if(playing)playing.catch(mediaError);}
function playDon(){playSample('don');}function playKa(){playSample('ka');}function playWrong(){playSample('wrong');}function playFinish(){playSample('finish');}
function stopDrums(){for(const voice of sfxVoices){try{voice.stop();}catch{}}sfxVoices.clear();for(const pool of Object.values(drumPools))for(const a of pool)a.pause();}
function loadTrack(key){return Promise.resolve(key);}
function stopPreview(){previewToken++;if(previewSource){musicPlayer.pause();previewSource=null;}$('previewBtn').textContent='▶ 試聽音樂';}
function stopMusic(){musicPlayer.pause();bgmSource=null;}
function prepareMusic(key,prime=false){const actualKey=key==='none'?'dragon':key;const url=new URL(tracks[actualKey].url,document.baseURI).href;if(musicPlayer.src!==url)musicPlayer.src=url;musicPlayer.playbackRate=playbackRate;musicPlayer.volume=Number($('musicVolume').value)/100;musicPlayer.muted=prime||key==='none'||Number($('musicVolume').value)===0;return musicPlayer.play();}
function soundError(error){status('聲音未開到');$('startMessage').textContent=error.message||'請再撳一次，或者調高裝置音量。';}
$('musicVolume').addEventListener('input',()=>{musicPlayer.volume=Number($('musicVolume').value)/100;musicPlayer.muted=song==='none'||Number($('musicVolume').value)===0;});
$('sfxVolume').addEventListener('input',()=>{if(sfxGain)sfxGain.gain.value=Number($('sfxVolume').value)/100;for(const pool of Object.values(drumPools))for(const a of pool)a.volume=Number($('sfxVolume').value)/100;});
let testToggle=true;
$('testAudioBtn').addEventListener('click',()=>{initAudio().catch(soundError);if(testToggle)playDon();else playKa();$('testAudioBtn').textContent=testToggle?'🔴 咚！再撳試鼓邊':'🔵 咔！再撳試鼓面';testToggle=!testToggle;});
$('previewBtn').addEventListener('click',()=>{if(previewSource){stopPreview();return;}const key=$('trackSelect').value;if(key==='none'){status('已揀淨係鼓聲');return;}const token=++previewToken;initAudio().catch(soundError);const playing=prepareMusic(key);previewSource=musicPlayer;$('previewBtn').textContent='■ 停止試聽';playing.then(()=>{if(token===previewToken)status('試聽：'+tracks[key].name);}).catch(e=>{if(token===previewToken){stopPreview();mediaError(e);}});});
$('trackSelect').addEventListener('change',()=>{stopPreview();$('startMessage').textContent='';});
$('unlockAudioBtn').addEventListener('click',()=>{initAudio().catch(soundError);playDon();if(['playing','success'].includes(state))prepareMusic(song).catch(mediaError);});
class Note{
 constructor(type,targetTime,isRoll=false,word=''){Object.assign(this,{type,targetTime,isRoll,word,active:true,x:canvas.width+NOTE_RADIUS,y:canvas.height/2});}
 update(time){
  this.x=TARGET_X+(this.targetTime-time)*pixelsPerMs;this.y=canvas.height/2;
  const lateWindow=this.isRoll?MS_PER_BEAT/ROLL_SUBDIVISIONS*.95:HIT_WINDOW;
  if(this.active&&time>this.targetTime+lateWindow){this.active=false;if(!this.isRoll){combo=0;updateScore();addFloatingText('錯過咗',TARGET_X,this.y-65,'#a1a1aa');}}
 }

 draw(){if(!this.active||this.x<-NOTE_RADIUS||this.x>canvas.width+NOTE_RADIUS)return;const sprite=getNoteSprite(this);ctx.drawImage(sprite,this.x-sprite.width/2,this.y-sprite.height/2);}

}

const spriteCache=new Map();
function getNoteSprite(note){
 const radius=NOTE_RADIUS;
 const key=note.isRoll?'roll:'+radius:'number:'+NOTE_RADIUS+':'+note.word;
 if(spriteCache.has(key))return spriteCache.get(key);
 const sprite=document.createElement('canvas');sprite.width=sprite.height=Math.ceil((radius+12)*2);const c=sprite.getContext('2d');c.translate(sprite.width/2,sprite.height/2);
 c.beginPath();c.arc(0,7*radius/NOTE_RADIUS,radius,0,Math.PI*2);c.fillStyle='#0007';c.fill();
 const grad=c.createRadialGradient(-8*radius/NOTE_RADIUS,-8*radius/NOTE_RADIUS,3*radius/NOTE_RADIUS,0,0,radius);grad.addColorStop(0,note.isRoll?'#fde047':'#fff');grad.addColorStop(1,note.isRoll?'#ca8a04':'#d1d5db');
 c.beginPath();c.arc(0,0,radius,0,Math.PI*2);c.fillStyle=grad;c.fill();c.lineWidth=3*radius/NOTE_RADIUS;c.strokeStyle='#fff';c.stroke();
 if(!note.isRoll){c.fillStyle='#111827';c.font=`900 ${NOTE_RADIUS*1.07*1.5}px system-ui`;c.textAlign='center';c.textBaseline='middle';c.fillText(note.word,0,1,NOTE_RADIUS*1.7);}
 spriteCache.set(key,sprite);return sprite;
}

function updateScore(){$('scoreDisplay').textContent=score;$('comboDisplay').textContent=combo;}
function addFloatingText(text,x,y,color){texts.push({text,x,y,color,born:musicTime()});}
function spawnParticles(x,y,color){if(particles.length>64)particles.splice(0,particles.length-64);for(let i=0;i<8;i++)particles.push({x,y,born:musicTime(),vx:(Math.random()-.5)*12,vy:(Math.random()-.5)*12,life:1,color,size:Math.random()*5+3});}
function buildBeatSequence(){
 scheduledBeats=[];rollSections=[];let beat=PREP_BEATS;
 const roll=(length,final=false)=>{const start=beat;rollSections.push({start,end:start+length,final});
  for(let r=0;r<(final?length*ROLL_SUBDIVISIONS:3*ROLL_SUBDIVISIONS+1);r++)scheduledBeats.push({beat:start+r/ROLL_SUBDIVISIONS,type:'roll',final});
  beat+=length;
 };
 for(let i=1;i<=40;i++){
  scheduledBeats.push({beat,type:i%4===0?'ka':'don',word:String(i)});beat+=2;
  if(i%8===0&&i!==40)roll(4);
 }
 roll(7,true);endAt=beatTime(beat)*1000;
 // Pre-create the full chart. No frame-based spawning or independently accumulated clock.
 notes=scheduledBeats.map(n=>new Note(n.type==='roll'?'don':n.type,beatTime(n.beat)*1000,n.type==='roll',n.word));
}
function syncNotes(time){for(const n of notes){if(!n.active)continue;if(n.targetTime-time>(canvas.width-TARGET_X+NOTE_RADIUS)/pixelsPerMs)break;n.update(time);}}
function hitTarget(type){
 if(state!=='playing'||musicPlayer.paused||musicPlayer.seeking||musicPlayer.readyState<2)return;const time=musicTime();if(time<beatTime(PREP_BEATS)*1000)return;syncNotes(time);flashUntil=time+100*playbackRate;
 let hitNote=null,minDistance=Infinity;for(const n of notes){if(!n.active)continue;const delta=time-n.targetTime,distance=Math.abs(delta);const eligible=n.isRoll?(delta>=-0.000001&&delta<=MS_PER_BEAT/ROLL_SUBDIVISIONS*.95):(delta>=-Math.min(80,MS_PER_BEAT*.15)&&delta<HIT_WINDOW);if(eligible&&distance<minDistance){minDistance=distance;hitNote=n;}}
 if(!hitNote)return;hitNote.active=false;
 if(hitNote.isRoll){score+=50;spawnParticles(TARGET_X,canvas.height/2,'#fbbf24');}
 else if(hitNote.type===type){combo++;score+=minDistance/playbackRate<=80?300:100;spawnParticles(TARGET_X,canvas.height/2,type==='don'?'#ef4444':'#3b82f6');addFloatingText(minDistance/playbackRate<=80?'太準喇！':'答啱喇！',TARGET_X,canvas.height/2-65,minDistance/playbackRate<=80?'#fbbf24':'#34d399');}
 else{combo=0;playWrong();addFloatingText('錯掣喇！',TARGET_X,canvas.height/2-65,'#f87171');}updateScore();
}
function resizeCanvas(){const w=canvas.parentElement.clientWidth,h=canvas.parentElement.clientHeight;if(canvas.width===w&&canvas.height===h)return;canvas.width=w;canvas.height=h;spriteCache.clear();TARGET_X=canvas.width/2;NOTE_RADIUS=canvas.height<200?27:35;pixelsPerBeat=Math.max(NOTE_RADIUS*2+22,canvas.width/10);pixelsPerMs=pixelsPerBeat/MS_PER_BEAT;if(state==='menu')drawScene(0,0);}
function drawScene(time,dt){
 ctx.clearRect(0,0,canvas.width,canvas.height);const y=canvas.height/2;
 ctx.fillStyle='#ffffff12';ctx.fillRect(0,y-NOTE_RADIUS-5,canvas.width,NOTE_RADIUS*2+10);ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(canvas.width,y);ctx.strokeStyle='#ffffff50';ctx.lineWidth=2;ctx.stroke();
 ctx.save();ctx.beginPath();ctx.arc(TARGET_X,y,NOTE_RADIUS+10,0,Math.PI*2);ctx.strokeStyle='#ffffffe0';ctx.lineWidth=time<flashUntil?8:4;if(time<flashUntil){ctx.shadowColor='#fff';ctx.shadowBlur=24;ctx.fillStyle='#ffffff50';ctx.fill();}ctx.stroke();ctx.restore();
 if(state==='playing'){ctx.fillStyle='#a1a1aa';ctx.font='700 14px system-ui';ctx.textAlign='right';ctx.fillText('數字到中間就打鼓',canvas.width-15,24);}
 for(const n of notes){if(n.targetTime-time>(canvas.width-TARGET_X+NOTE_RADIUS)/pixelsPerMs)break;n.draw();}
 particles=particles.filter(p=>time-p.born<416.675);for(const p of particles){const age=Math.max(0,time-p.born),step=age/16.667;ctx.globalAlpha=Math.max(0,1-age/416.675);ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(p.x+p.vx*step,p.y+p.vy*step,p.size,0,Math.PI*2);ctx.fill();}ctx.globalAlpha=1;
 texts=texts.filter(t=>time-t.born<833.35);for(const t of texts){const age=Math.max(0,time-t.born);ctx.save();ctx.globalAlpha=Math.max(0,1-age/833.35);ctx.font='900 27px system-ui';ctx.textAlign='center';ctx.fillStyle=t.color;ctx.strokeStyle='#18181b';ctx.lineWidth=5;ctx.strokeText(t.text,t.x,t.y-2*age/16.667);ctx.fillText(t.text,t.x,t.y-2*age/16.667);ctx.restore();}
}
function update(){
 if(!['playing','success'].includes(state))return;
 const time=musicTime();syncNotes(time);drawScene(time,0);
 if(state==='playing'){
  if(time>=endAt&&notes.every(n=>!n.active))beginSuccess();
 }else{
  const progress=Math.min(1,Math.max(0,(time-successStartedAt)/800));
  $('successTitle').style.transform='scale('+(1+.12*Math.sin(progress*Math.PI))+')';
  $('successTitle').style.filter='drop-shadow(0 0 '+(24*Math.sin(progress*Math.PI))+'px #facc15)';
  if(progress>=1){endGame();return;}
 }
 gameLoopId=requestAnimationFrame(update);
}
let countdownElapsed=0,countdownFrameTime=0,countdownLabel='',countdownToken=0;
function countFrame(now){
 if(state!=='countdown')return;
 if(countdownFrameTime)countdownElapsed+=now-countdownFrameTime;countdownFrameTime=now;
 const index=Math.min(3,Math.floor(countdownElapsed/1000));const label=['3','2','1','開始！'][index];
 if(label!==countdownLabel){countdownLabel=label;$('countdownText').textContent=label;index<3?playKa():playDon();}
 const phase=(countdownElapsed%1000)/1000;$('countdownText').style.transform='scale('+(1+.15*(1-phase))+')';
 if(countdownElapsed>=4000){startMusicAfterCountdown(countdownToken);return;}
 gameLoopId=requestAnimationFrame(countFrame);
}
async function startMusicAfterCountdown(token){
 if(token!==flowToken||state!=='countdown')return;state='starting';
 musicPlayer.currentTime=0;
 try{
  await prepareMusic(song);if(token!==flowToken)return;
  $('countdownScreen').classList.add('hidden');state='playing';bgmSource=musicPlayer;
  status(song==='none'?'鼓聲模式':'♫ '+tracks[song].name);cancelAnimationFrame(gameLoopId);update();
 }catch(e){if(token!==flowToken)return;musicPlayer.pause();state='paused';pausedState='playing';$('countdownScreen').classList.add('hidden');$('pauseScreen').classList.remove('hidden');status('撳「繼續玩」開始音樂');}
}
async function startCountdown(selectedRate){
 if(state!=='menu')return;state='loading';const token=++flowToken;stopPreview();stopMusic();stopDrums();
 $('startMessage').textContent='準備音樂同鼓聲…';document.querySelectorAll('.level-btn').forEach(b=>b.disabled=true);
 try{
  song=$('trackSelect').value;setSpeed(selectedRate);musicPlayer.currentTime=0;
  // Unlock this media element silently in the user's gesture; no audible music before countdown.
  const soundsReady=initAudio().catch(()=>{});const primed=prepareMusic(song,true).then(()=>{musicPlayer.pause();musicPlayer.currentTime=0;});
  await Promise.all([soundsReady,primed]);if(token!==flowToken)return;
  resizeCanvas();score=0;combo=0;particles=[];texts=[];flashUntil=0;updateScore();buildBeatSequence();
  // All gradients and number glyphs are painted once before the game starts.
  for(const n of notes)getNoteSprite(n);
  $('startScreen').classList.add('hidden');$('gameOverScreen').classList.add('hidden');$('pauseScreen').classList.add('hidden');
  $('countdownScreen').classList.remove('hidden');$('countdownText').classList.remove('pulse');$('startMessage').textContent='';$('pauseBtn').disabled=false;
  $('finalResult').classList.add('hidden');$('restartBtn').classList.add('hidden');
  state='countdown';countdownToken=token;countdownElapsed=0;countdownFrameTime=0;countdownLabel='';drawScene(-Infinity,0);
  cancelAnimationFrame(gameLoopId);gameLoopId=requestAnimationFrame(countFrame);
 }catch(e){if(token===flowToken){state='menu';stopMusic();soundError(e);}}
 finally{document.querySelectorAll('.level-btn').forEach(b=>b.disabled=false);}
}
function beginSuccess(){
 state='success';successStartedAt=musicTime();$('countdownScreen').classList.add('hidden');$('gameOverScreen').classList.remove('hidden');playFinish();status('特訓完成！');
}

function endGame(){state='ended';cancelAnimationFrame(gameLoopId);stopMusic();$('pauseBtn').disabled=true;$('gameOverScreen').classList.remove('hidden');$('finalScore').textContent=score;$('finalResult').classList.remove('hidden');$('restartBtn').classList.remove('hidden');status('特訓完成！');}
async function handleInput(type){if(['paused','loading','countdown','starting','ended','success'].includes(state))return;try{type==='don'?playDon():playKa();hitTarget(type);}catch(e){soundError(e);}}
function triggerBtn(id){$(id).classList.add('active-key');setTimeout(()=>$(id).classList.remove('active-key'),100);}
const buttons={'btn-don-left':'don','btn-don-right':'don','btn-ka-left':'ka','btn-ka-right':'ka'};
for(const [id,type] of Object.entries(buttons)){$(id).addEventListener('pointerdown',e=>{e.preventDefault();handleInput(type);triggerBtn(id);});$(id).addEventListener('click',e=>{if(e.detail===0){handleInput(type);triggerBtn(id);}});}
const keys={f:'btn-don-left',j:'btn-don-right',d:'btn-ka-left',k:'btn-ka-right'};
window.addEventListener('keydown',e=>{if(e.repeat||['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName))return;const id=keys[e.key.toLowerCase()];if(id){e.preventDefault();handleInput(buttons[id]);triggerBtn(id);}});
let pausedState='playing';
function pauseGame(){if(!['playing','success','countdown'].includes(state))return;pausedState=state;state='paused';cancelAnimationFrame(gameLoopId);$('pauseScreen').classList.remove('hidden');$('pauseBtn').disabled=true;musicPlayer.pause();stopDrums();status('已暫停');}
async function resumeGame(){if(state!=='paused')return;if(pausedState==='countdown'){state='countdown';countdownFrameTime=0;$('pauseScreen').classList.add('hidden');$('pauseBtn').disabled=false;gameLoopId=requestAnimationFrame(countFrame);return;}try{initAudio().catch(()=>{});await prepareMusic(song);state=pausedState;$('pauseScreen').classList.add('hidden');$('pauseBtn').disabled=false;gameLoopId=requestAnimationFrame(update);}catch(e){soundError(e);}}
function home(){flowToken++;state='menu';cancelAnimationFrame(gameLoopId);stopMusic();stopPreview();stopDrums();$('gameOverScreen').classList.add('hidden');$('pauseScreen').classList.add('hidden');$('countdownScreen').classList.add('hidden');$('startScreen').classList.remove('hidden');$('pauseBtn').disabled=true;notes=[];particles=[];texts=[];flashUntil=0;drawScene(0,0);status('揀首音樂，再挑戰！');}
$('speedSelect').addEventListener('change',e=>setSpeed(Number(e.target.value)));
musicPlayer.addEventListener('ratechange',()=>{playbackRate=musicPlayer.playbackRate;effectiveBPM=BASE_BPM*playbackRate;effectiveBeatDuration=60/effectiveBPM;});
musicPlayer.addEventListener('ended',()=>{if(state==='menu'){stopPreview();return;}if(state==='success')endGame();else if(state==='playing'){pauseGame();status('音樂已播完，請重新開始');}});
$('pauseBtn').addEventListener('click',pauseGame);$('resumeBtn').addEventListener('click',resumeGame);$('homeBtn').addEventListener('click',home);$('restartBtn').addEventListener('click',home);
document.querySelectorAll('.level-btn').forEach(btn=>btn.addEventListener('click',()=>startCountdown(Number(btn.dataset.rate))));
document.addEventListener('visibilitychange',()=>{if(document.hidden){stopPreview();pauseGame();}});
window.addEventListener('resize',()=>{resizeCanvas();if(window.innerHeight>window.innerWidth)pauseGame();});
resizeCanvas();
