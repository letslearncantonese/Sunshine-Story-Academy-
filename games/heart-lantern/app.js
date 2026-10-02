'use strict';
document.addEventListener('selectstart',e=>e.preventDefault());
document.addEventListener('contextmenu',e=>e.preventDefault());
document.addEventListener('dragstart',e=>e.preventDefault());
const $=id=>document.getElementById(id),c=$('game'),g=c.getContext('2d'),fires=[...document.querySelectorAll('.fire')];
const good=[...'情悔怕忙快怪恨想忍忘急怒悲慈意感息怎'],bad=[...'清海伯亡決向很相刃安及努非滋音咸自作'];
let mode='menu',level=-1,x=640,score=0,time=60,elapsed=0,drops=[],ball=null,nextDrop=0,nextBall=7,water=0,buckets=0,bucketLive=false,out=0,correct=0,wrong=0,jumping=false,jumpLeft=0,action=false,last=0,count=0,audio,voice,ready=false,keys=new Set(),touches=new Map(),fx=[];
const fox=new Image(),sprite=document.createElement('canvas'),v=$('actionVideo');
const actionFrame=document.createElement('canvas');
actionFrame.width=455;actionFrame.height=256;
const actionContext=actionFrame.getContext('2d',{willReadFrequently:true});
let actionX=640,actionKind='',actionToken=0,pendingFire=null,splashDirection=1;
const JUMP_SECONDS=2.2,FIRE_TOTAL=6;
const art=new Image();art.onload=()=>{fires.forEach(b=>{b.classList.add('art');b.textContent=''});startReady()};art.src='game-art.png';
function fireStyle(b){b.textContent='';b.className='fire art';b.style.transform='';b.style.opacity=''}
function drawAsset(sx,sy,sw,sh,dx,dy,dw,dh){if(art.complete&&art.naturalWidth)g.drawImage(art,sx,sy,sw,sh,dx,dy,dw,dh)}
const waterCanvas=$('waterEffects'),wg=waterCanvas.getContext('2d');
let splashSound=false;
const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,n));
function splashSource(t){
  const marks=[[1.65,190,140],[2,157,99],[2.5,164,174],[2.85,190,192]];
  let i=0;while(i<marks.length-2&&t>marks[i+1][0])i++;
  const a=marks[i],b=marks[i+1],f=clamp((t-a[0])/(b[0]-a[0]));
  return {x:actionX+splashDirection*(245-a[1]-(b[1]-a[1])*f)*1.3,y:694-236*1.3+(a[2]+(b[2]-a[2])*f)*1.3};
}
function waterNoise(){if(!audio)return;const length=audio.sampleRate*.7,buffer=audio.createBuffer(1,length,audio.sampleRate),data=buffer.getChannelData(0);for(let i=0;i<length;i++)data[i]=(Math.random()*2-1)*(1-i/length);const source=audio.createBufferSource(),filter=audio.createBiquadFilter(),gain=audio.createGain();source.buffer=buffer;filter.type='lowpass';filter.frequency.value=1800;gain.gain.value=.32;source.connect(filter).connect(gain).connect(audio.destination);source.start()}
function drawWater(){
  wg.clearRect(0,0,1280,720);
  if(!action||actionKind!=='splash.mp4'||!pendingFire||v.readyState<2)return;
  const t=v.currentTime;if(t<1.65)return;
  if(!splashSound&&mode==='play'){splashSound=true;waterNoise()}
  const s=$('stage');
  const end={x:(pendingFire.offsetLeft+pendingFire.offsetWidth/2)*1280/s.clientWidth,y:(pendingFire.offsetTop+pendingFire.offsetHeight*.6)*720/s.clientHeight};
  // Source follows the bucket mouth in the supplied animation; mirrored with the fox.
  const start=splashSource(t),bend={x:(start.x+end.x)/2,y:Math.min(start.y,end.y)-110};
  const point=u=>({x:(1-u)**2*start.x+2*(1-u)*u*bend.x+u*u*end.x,y:(1-u)**2*start.y+2*(1-u)*u*bend.y+u*u*end.y});
  const head=clamp((t-1.65)/.65),tail=clamp((t-2.75)/.65);
  if(tail<head){
    for(const [width,color] of [[18,'#208bbf'],[12,'#55d3f5'],[5,'#dbfaff']]){wg.beginPath();for(let i=0;i<=48;i++){const p=point(tail+(head-tail)*i/48);i?wg.lineTo(p.x,p.y):wg.moveTo(p.x,p.y)}wg.lineWidth=width;wg.lineCap='round';wg.strokeStyle=color;wg.stroke()}
    for(let i=0;i<22;i++){const u=((t*1.5+i/22)%1);if(u<tail||u>head)continue;const p=point(u),offset=Math.sin(i*9+t*11)*15;wg.fillStyle=i%3?'#75ddfa':'#efffff';wg.beginPath();wg.ellipse(p.x+offset*.35,p.y+offset,3+i%3,6+i%4,-splashDirection*.5,0,Math.PI*2);wg.fill()}
  }
  const hit=clamp((t-2.3)/1.65);
  if(t>=2.3){pendingFire.classList.add('dousing');pendingFire.style.transform='scale('+(1-hit*.88)+')';pendingFire.style.opacity=String(1-hit*.7);
    for(let i=0;i<18;i++){const life=(t*1.6+i/18)%1,angle=i*2.399;wg.globalAlpha=(1-life)*clamp((3.9-t)*2);wg.fillStyle=i%2?'#c7f7ff':'#4fcdf3';wg.beginPath();wg.ellipse(end.x+Math.cos(angle)*life*65,end.y+Math.sin(angle)*life*42+life*life*35,3,6,angle,0,Math.PI*2);wg.fill()}wg.globalAlpha=1;
  }
}
function drawAction(){
  if(v.readyState<2){g.drawImage(sprite,actionX-65.625,400,131.25,300);return}
  actionContext.drawImage(v,0,0,455,256);
  const frame=actionContext.getImageData(0,0,455,256),p=frame.data;
  for(let i=0;i<p.length;i+=4){
    const excess=p[i+1]-Math.max(p[i],p[i+2]);
    if(excess>18){p[i+3]=Math.max(0,255-(excess-18)*12);p[i+1]=Math.min(p[i+1],Math.max(p[i],p[i+2])+18)}
  }
  actionContext.putImageData(frame,0,0);
  const isJump=actionKind==='jump.mp4',scale=isJump?1.12:1.3;
  const anchorX=isJump?227.5:245,anchorY=isJump?221:236;
  const lift=isJump?220*Math.sin(Math.PI*Math.min(1,v.currentTime/4)):0;
  g.save();g.translate(actionX,694-anchorY*scale-lift);if(!isJump&&splashDirection>0)g.scale(-1,1);g.drawImage(actionFrame,-anchorX*scale,0,455*scale,256*scale);g.restore();
}
fox.onload=()=>{sprite.width=420;sprite.height=960;let q=sprite.getContext('2d');q.drawImage(fox,565,0,420,960,0,0,420,960);let d=q.getImageData(0,0,420,960);for(let i=0;i<d.data.length;i+=4){let r=d.data[i],b=d.data[i+2],z=d.data[i+1]-Math.max(r,b);if(z>20){d.data[i+3]=Math.max(0,255-(z-20)*8)}}q.putImageData(d,0,0);ready=true;startReady()};fox.src='fox.jpeg';
function voices(){if(!speechSynthesis){$('voice').textContent='其他音效已準備好。';return}let a=speechSynthesis.getVoices();voice=a.find(z=>/^yue/i.test(z.lang))||a.find(z=>/^zh[-_]HK/i.test(z.lang))||a.find(z=>/Cantonese|廣東話|粵語/i.test(z.name));$('voice').textContent=voice?'廣東話讀字已準備好':'未偵測到廣東話聲音；其他音效仍然可以播放。'}voices();speechSynthesis?.addEventListener('voiceschanged',voices);
function say(s){if(!voice)return;speechSynthesis.cancel();let u=new SpeechSynthesisUtterance(s);u.voice=voice;u.lang=voice.lang;u.rate=.82;u.volume=1;speechSynthesis.speak(u)}
function unlock(){if(!audio){let A=window.AudioContext||window.webkitAudioContext;if(A)audio=new A()}audio?.resume();v.load()}
function beep(type){if(!audio)return;let seq={good:[880,1175],bad:[220,150],bucket:[520,700,920],splash:[300,420,550],jump:[380,620,900],hit:[150,100],out:[900,650,1100],warn:[620,620,820],tick:[520]}[type]||[520],t=audio.currentTime;seq.forEach((f,i)=>{let o=audio.createOscillator(),a=audio.createGain(),s=t+i*.1;o.type=type==='bad'||type==='hit'?'sawtooth':'sine';o.frequency.value=f;a.gain.setValueAtTime(.001,s);a.gain.linearRampToValueAtTime(.4,s+.015);a.gain.exponentialRampToValueAtTime(.001,s+.17);o.connect(a).connect(audio.destination);o.start(s);o.stop(s+.19)})}
function startReady(){$('start').disabled=level<0||!ready||!art.complete||!art.naturalWidth}document.querySelectorAll('[data-speed]').forEach(b=>b.onclick=()=>{level=+b.dataset.speed;document.querySelectorAll('[data-speed]').forEach(z=>z.classList.toggle('active',z===b));startReady()});
function hud(){$('score').textContent=score;$('time').textContent=Math.max(0,Math.ceil(time));$('water').textContent=water;$('fireCount').textContent=FIRE_TOTAL-out;$('waterTip').classList.toggle('hidden',water<1||out===FIRE_TOTAL||mode!=='play')}
function start(){unlock();say('準備');mode='count';count=3.8;score=elapsed=water=buckets=out=correct=wrong=0;time=60;x=640;drops=[];ball=null;nextDrop=.3;nextBall=7;bucketLive=jumping=action=false;fires.forEach(fireStyle);$('panel').classList.add('hidden');$('hud').classList.remove('hidden');$('fires').classList.remove('hidden');$('hint').classList.remove('hidden');$('jump').classList.toggle('hidden',!$('fireballs').checked);$('pause').textContent='暫停';hud();beep('tick')}
$('start').onclick=start;
$('again').onclick=()=>{mode='menu';$('result').classList.add('hidden');$('again').classList.add('hidden');['speeds','challenge','itemsHelp','voice','start'].forEach(id=>$(id).classList.remove('hidden'));$('intro').innerHTML='接住有「心、忄、⺗」嘅字！<br>接水桶，再撳火焰幫手救火。';$('hud').classList.add('hidden');$('fires').classList.add('hidden');$('jump').classList.add('hidden');$('hint').classList.add('hidden');$('waterTip').classList.add('hidden')};
function finish(){mode='end';stopVideo();$('panel').classList.remove('hidden');['speeds','challenge','itemsHelp','voice','start'].forEach(id=>$(id).classList.add('hidden'));$('result').classList.remove('hidden');$('again').classList.remove('hidden');$('result').textContent=score+' 分';$('intro').textContent='接啱 '+correct+' 個心字部字，救熄 '+out+' 堆火！';$('hud').classList.add('hidden');$('fires').classList.add('hidden');$('jump').classList.add('hidden');$('hint').classList.add('hidden');$('waterTip').classList.add('hidden');$('count').textContent='';window.speechSynthesis?.cancel()}
function pause(){if(mode==='play'){mode='paused';keys.clear();touches.clear();v.pause();$('count').textContent='暫停';$('pause').textContent='繼續'}else if(mode==='paused'){mode='play';if(action)v.play();$('count').textContent='';$('pause').textContent='暫停'}}$('pause').onclick=pause;
function feedback(t,px=x,py=390){fx.push({t,x:px,y:py,life:1.2})}
function playVideo(src){splashSound=false;action=true;actionX=x;actionKind=src;const token=++actionToken;keys.clear();touches.clear();v.src=src;v.currentTime=0;v.playbackRate=src==='jump.mp4'?4/JUMP_SECONDS:2;v.classList.remove('hidden');v.onended=()=>{if(token===actionToken)stopVideo(true)};v.onerror=()=>{if(token===actionToken)stopVideo()};v.play().catch(()=>{if(token===actionToken)stopVideo()})}
function stopVideo(completed=false){const target=pendingFire;pendingFire=null;wg.clearRect(0,0,1280,720);actionToken++;v.pause();v.classList.add('hidden');v.removeAttribute('src');v.load();action=false;jumping=false;x=actionX;if(target){if(completed){out++;score+=2;target.className='fire art out';target.textContent='';feedback('救熄咗！ +2',actionX,390);beep('out')}else{water++;fireStyle(target);target.classList.add('ready');feedback('未淋到，再試一次',actionX,390)}hud()}}
function jump(){if(mode!=='play'||jumping||action)return;unlock();jumping=true;jumpLeft=JUMP_SECONDS;beep('jump');playVideo('jump.mp4')}$('jump').onpointerdown=e=>{e.preventDefault();jump()};
fires.forEach((b,i)=>{b.setAttribute('aria-label',(i<3?'左邊':'右邊')+'第'+(i%3+1)+'個火種');b.onpointerdown=e=>{e.preventDefault();if(mode!=='play'||water<1||action||b.classList.contains('out'))return;unlock();water--;pendingFire=b;splashDirection=i<3?-1:1;if(!water)fires.forEach(z=>z.classList.remove('ready'));beep('splash');playVideo('splash.mp4');hud()}});
function spawn(){let kind='letter';if(buckets<FIRE_TOTAL&&!bucketLive&&elapsed>3+buckets*7){kind='bucket';bucketLive=true}else if(Math.random()<.065)kind='bomb';let ok=Math.random()<.58,a=ok?good:bad;drops.push({x:100+Math.random()*1080,y:-100,v:[100,137,180][level],kind,ok,char:a[Math.floor(Math.random()*a.length)]})}
function caught(a){if(a.kind==='bomb'){score-=3;feedback('−3');beep('bad')}else if(a.kind==='bucket'){water++;buckets++;bucketLive=false;feedback('接到水桶！');beep('bucket');fires.filter(b=>!b.classList.contains('out')).forEach(b=>b.classList.add('ready'))}else if(a.ok){score++;correct++;feedback(a.char+' +1');beep('good');say(a.char)}else{wrong++;feedback(a.char+'：唔係心字部！');beep('bad');say('唔係心字部！')}hud()}
function step(dt){fx.forEach(e=>{e.life-=dt;e.y-=42*dt});fx=fx.filter(e=>e.life>0);if(mode==='count'){let old=Math.ceil(count);count-=dt;let n=Math.ceil(count);$('count').textContent=n>1?n-1:'開始！';if(n!==old)beep('tick');if(count<=0){mode='play';$('count').textContent=''}return}if(mode!=='play'||(action&&!jumping))return;time-=dt;elapsed+=dt;if(time<=0){time=0;hud();finish();return}if(jumping){jumpLeft=Math.max(0,jumpLeft-dt)}let dir=(keys.has('ArrowRight')?1:0)-(keys.has('ArrowLeft')?1:0);for(let z of touches.values())dir+=z;x=Math.max(90,Math.min(1190,x+Math.sign(dir)*620*dt));nextDrop-=dt;if(nextDrop<=0&&drops.length<3){spawn();nextDrop=[2,1.5,1.15][level]}for(let a of drops){let was=a.y+50;a.y+=a.v*dt;if(was<=405&&a.y+50>=405&&Math.abs(a.x-x)<55){a.dead=true;caught(a)}if(a.y>800){a.dead=true;if(a.kind==='bucket'){bucketLive=false;feedback('水桶跌咗，再接！',640,350)}}}drops=drops.filter(a=>!a.dead);
if($('fireballs').checked){nextBall-=dt;if(!ball&&nextBall<=0&&Math.abs(x-640)<=200){ball={x:Math.random()<.5?-80:1360,y:650,vx:0,wait:1.8,r:0};ball.vx=ball.x<0?170:-170;$('warn').textContent=ball.vx>0?'左邊有火球！快啲跳高！':'右邊有火球！快啲跳高！';$('warn').classList.remove('hidden');beep('warn')}if(ball){ball.wait-=dt;if(ball.wait<=0){$('warn').classList.add('hidden');ball.x+=ball.vx*dt;if(Math.abs(ball.x-x)<70&&!jumping){score-=5;feedback('俾火球撞到！ −5',x,535);beep('hit');ball=null;nextBall=7+Math.random()*4}if(ball&&(ball.x< -160||ball.x>1440)){ball=null;nextBall=7+Math.random()*4}}}}hud()}
function txt(t,x,y,size,color='#fff'){g.font='900 '+size+'px system-ui,"PingFang HK"';g.textAlign='center';g.textBaseline='middle';g.lineJoin='round';g.lineWidth=5;g.strokeStyle='#623620';g.strokeText(t,x,y);g.fillStyle=color;g.fillText(t,x,y)}
function lantern(a){g.save();g.translate(a.x,a.y);drawAsset(0,0,627,665,-125.6,-118.6,240,254.5);g.font='500 68px "PingFang HK","Microsoft JhengHei",sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillStyle='#201510';g.fillText(a.char,0,2);g.restore()}
function draw(){g.fillStyle='#00ff00';g.fillRect(0,0,1280,720);if(ready&&!action){let menu=mode==='menu'||mode==='end',dx=menu?160:x,h=menu?400:300,w=h*420/960,y=700;g.drawImage(sprite,dx-w/2,y-h,w,h)}if(mode==='menu'||mode==='end')return;for(let a of drops){if(a.kind==='letter')lantern(a);else{g.save();g.translate(a.x,a.y);g.textAlign='center';g.textBaseline='middle';g.font='118px "Apple Color Emoji","Segoe UI Emoji"';if(a.kind==='bomb')g.fillText('💣',0,0);else drawAsset(627,0,627,627,-65,-65,130,130);g.restore()}}if(ball){g.save();g.translate(ball.x,ball.y);if(ball.vx<0)g.scale(-1,1);drawAsset(627,665,627,589,-77,-59,132,124);g.restore()}for(let e of fx){g.globalAlpha=Math.min(1,e.life*2);txt(e.t,Math.max(200,Math.min(1080,e.x)),e.y,32)}g.globalAlpha=1}
function frame(t){let dt=Math.min((t-last)/1000||0,.05);last=t;if(action){x=actionX;keys.clear();touches.clear()}step(dt);draw();if(action)drawAction();drawWater();requestAnimationFrame(frame)}requestAnimationFrame(frame);
$('stage').addEventListener('pointerdown',e=>{if(e.target.closest('button,input,label')||mode!=='play'||action)return;e.preventDefault();let r=$('stage').getBoundingClientRect();touches.set(e.pointerId,e.clientX<r.left+r.width/2?-1:1)});$('stage').addEventListener('pointermove',e=>{if(touches.has(e.pointerId)){let r=$('stage').getBoundingClientRect();touches.set(e.pointerId,e.clientX<r.left+r.width/2?-1:1)}});['pointerup','pointercancel','lostpointercapture'].forEach(n=>$('stage').addEventListener(n,e=>touches.delete(e.pointerId)));addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight',' '].includes(e.key)){e.preventDefault();keys.add(e.key);if(e.key===' '&&!e.repeat)jump()}});addEventListener('keyup',e=>keys.delete(e.key));document.addEventListener('visibilitychange',()=>{if(document.hidden&&mode==='play')pause()});
