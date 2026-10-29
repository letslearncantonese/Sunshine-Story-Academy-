'use strict';
const QUESTION_POOL = [{"topic":"光線感測器","question":"小智發現，窗邊嘅光線感測器量到90%，但梳化旁邊只有50%。點解同一間房，會有兩個唔同數字？","answers":["因為唔同位置收到嘅光可能唔同。","因為光線感測器愈接近窗，數字就一定愈高，無論係日頭定夜晚。","因為房間入面嘅傢俬愈多，所有感測器量到嘅光度就一定愈低。"],"correctIndex":0,"explanation":"窗邊可能有陽光直接照入嚟，但梳化旁邊可能冇咁光！所以感測器放喺邊度，都會影響量度結果！"},{"topic":"溫度控制","question":"小智將目標溫度設定為22°C。房間原本有27°C，而家降到23°C。下一步應該點做？","answers":["立即停止量度，因為溫度已經下降。","繼續量度溫度，再按需要調整冷氣。","繼續用最大冷氣，直到房間降到18°C。"],"correctIndex":1,"explanation":"智能溫控系統唔係調整一次就算，而係會繼續量度，再按需要調整！"},{"topic":"PIR 動作感測器","question":"小智發現，P.I.R.動作感測器十分鐘都冇偵測到活動。咁係咪代表客廳一定冇人？","answers":["係！因為P.I.R.感測器可以直接數到房間有幾多人。","係！因為只要有人喺房間，感測器就一定會有反應。","唔一定！因為有人可能坐喺梳化度睇書，冇乜郁動。"],"correctIndex":2,"explanation":"P.I.R.感測器主要偵測紅外線嘅變化，唔係直接數人數！"},{"topic":"泥土水分","question":"花園嘅泥土水分已經達到60%，但小智話：「不如繼續灑水，灑到100%！咁小花一定會生長得更快！」你覺得小智講得啱唔啱呢？","answers":["正確！植物吸收愈多水，就一定生長得愈快。","唔一定！泥土太濕，可能令植物根部缺乏空氣。","正確！因為所有植物都需要泥土保持100%水分。"],"correctIndex":1,"explanation":"植物需要適量水分，唔係愈多就愈好！"},{"topic":"掃地機械人","question":"掃地機械人正向前行，突然發現前面有張櫈！但係佢未撞到張櫈，就已經識得轉方向！佢最可能用咗咩方法？","answers":["利用雷射或者其他感測器，提早偵測障礙物。","利用底部嘅防跌落感測器，專門辨認前面嘅櫈。","利用泥土水分感測器，量度櫈周圍嘅濕度。"],"correctIndex":0,"explanation":"有啲掃地機械人可以利用雷射或者其他感測器，喺撞到障礙物之前就發現佢，再調整路線！"}];
const EXERCISE_SECONDS = 10;
const QUESTIONS_PER_GAME = QUESTION_POOL.length;
const TIMING = { revealFeedback: 10000, videoLoadTimeout: 15000 };
const exercises = [
  { name:'開合跳', file:'copy_3AE27467-8FCE-4513-87EB-F45CD18C1A9F.mp4' },
  { name:'原地抬腿', file:'gemini_generated_video_E544055E.mp4' },
  { name:'左右側踢', file:'Robot_performing_side_kicks_workout_20260927055936.mp4' },
  { name:'原地跑步', file:'Robot_running_in_place_20260921211037(1).mp4' },
  { name:'交替前踢', file:'Robot_performing_front_kicks_wor…_20260927055919.mp4' },
  { name:'交替後踢', file:'Robot_performing_alternating_bac…_20260927062453.mp4' },
  { name:'交替出拳', file:'Character_performing_workout_vid…_1080p_202609041452.mp4' },
  { name:'深蹲', file:'robot-squats.mp4' },
  { name:'雙手出拳', file:'Robot_performing_double_punch_1080p_202608270844.mp4' }
];
const FEEDBACK_VIDEOS = {
 correct: 'gemini_generated_video_914A3FA6(1).mp4',
 wrong: 'gemini_generated_video_31FC8DFF(1).mp4'
};
let feedbackPreloads=[];
// Optional replacement sound filenames, relative to index.html. Empty = synthesized effect.
const SOUND_FILES = { correct:'', wrong:'', exerciseStart:'', completion:'', final:'' };
const $ = id => document.getElementById(id);
let audioContext, soundOn=true, phase='start', round=0;
let questions=[], workoutPlan=[], choices=[], videos=[];
let transitionTimeout, loadTimeout, frame, elapsed=0, clockStart=null, playAttempt=0;
const customSounds = {};
function unlockAudio(){try{audioContext ||= new (window.AudioContext||window.webkitAudioContext)();audioContext.resume().catch(()=>{});}catch{}}
function tone(freq,offset,length,volume=.12){if(!audioContext||!soundOn)return;const t=audioContext.currentTime+offset,o=audioContext.createOscillator(),g=audioContext.createGain();o.type='sine';o.frequency.value=freq;g.gain.setValueAtTime(.001,t);g.gain.exponentialRampToValueAtTime(volume,t+.015);g.gain.exponentialRampToValueAtTime(.001,t+length);o.connect(g);g.connect(audioContext.destination);o.start(t);o.stop(t+length+.01);}
function sound(name){if(!soundOn)return;if(SOUND_FILES[name]){const a=customSounds[name] ||= new Audio(SOUND_FILES[name]);a.currentTime=0;a.play().catch(()=>synthSound(name));}else synthSound(name);}
function synthSound(name){const notes={correct:[523,659,784],wrong:[260,220],exerciseStart:[440,880],completion:[659,880],final:[523,659,784,1047,1319]}[name];notes.forEach((f,i)=>tone(f,i*.105,name==='wrong'?.17:.22,name==='wrong'?.07:.12));}
function playCorrectSound(){sound('correct');} function playWrongSound(){sound('wrong');}
function playExerciseStartSound(){sound('exerciseStart');} function playCompletionSound(){sound('completion');} function playFinalSound(){sound('final');}
function shuffle(items){const a=[...items];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}

function showScreen(id){
 $('game').classList.toggle('boardMode',id==='question');
 ['start','question','finish'].forEach(s=>$(s).hidden=s!==id);
}
function updateProgress(completed){
 $('progress').innerHTML=Array.from({length:QUESTIONS_PER_GAME},(_,i)=>`<span class="dot ${i<completed?'done':i===round?'current':''}" aria-hidden="true">${i<completed?'★':'●'}</span>`).join('');
 $('progress').setAttribute('aria-label',`完成 ${completed} / ${QUESTIONS_PER_GAME} 題`);
}
function preloadFeedback(){
 if(feedbackPreloads.length)return;
 feedbackPreloads=Object.values(FEEDBACK_VIDEOS).map(file=>{
  const v=document.createElement('video');v.muted=true;v.playsInline=true;v.preload='auto';v.src='assets/'+file;v.load();return v;
 });
}
function stopVideos(){videos.forEach(v=>v.pause());}
function newGame(){
 phase='start';playAttempt++;clearTimeout(transitionTimeout);clearTimeout(loadTimeout);cancelAnimationFrame(frame);stopVideos();unlockAudio();
 preloadFeedback();
 questions=[...QUESTION_POOL];workoutPlan=shuffle(exercises).slice(0,QUESTIONS_PER_GAME);round=0;showQuestion();
}
function showQuestion(){
 phase='question';showScreen('question');updateProgress(round);stopVideos();videos=[];elapsed=0;clockStart=null;
 // The shuffled game plan reserves one DISTINCT correct action per question.
 // Only distractors are sampled again; each card within a question is different.
 const correctAction=workoutPlan[round];
 const actions=shuffle(exercises.filter(action=>action.file!==correctAction.file)).slice(0,2);
 actions.splice(questions[round].correctIndex,0,correctAction);
 choices=questions[round].answers.map((value,i)=>({value,exercise:actions[i]}));
 $('questionProgress').textContent=`第 ${round+1} / ${QUESTIONS_PER_GAME} 題`;
 $('topic').textContent=questions[round].topic;
 $('equation').textContent=questions[round].question;
 $('exerciseName').textContent='思考答案，跟隨動作！';
 $('exercisePrompt').textContent='不必點選答案卡';
 $('exerciseFeedback').textContent='準備好了嗎？';$('feedback').textContent='';
 $('loading').hidden=true;$('retryVideo').hidden=true;
 $('roundStart').hidden=false;$('roundStart').disabled=false;
 $('timer').textContent=formatTime(EXERCISE_SECONDS);$('timerFill').style.transform='scaleX(1)';
 $('answers').classList.remove('revealed');$('answers').replaceChildren();
 choices.forEach((choice,index)=>{
  // Informational cards only: no click handlers, button roles, or answer input.
  const card=document.createElement('div');card.className='answerCard';
  const heading=document.createElement('span');heading.className='cardHeading';
  const letter=document.createElement('span');letter.className='cardLetter';letter.textContent='ABC'[index];
  const number=document.createElement('span');number.className='answerNumber';number.textContent=choice.value;
  heading.append(letter,number);
  const media=document.createElement('span');media.className='cardMedia';
  const v=document.createElement('video');v.className='actionPreview';v.muted=true;v.loop=true;v.playsInline=true;v.preload='auto';v.setAttribute('playsinline','');v.setAttribute('aria-hidden','true');
  v.src='assets/'+choice.exercise.file;v.poster='assets/'+choice.exercise.file.replace(/\.mp4$/i,'.jpg');
  v.addEventListener('waiting',()=>{if(phase==='exercise'){pauseClock();$('loading').hidden=false;armLoadTimeout();}});
  v.addEventListener('playing',resumeClock);v.addEventListener('canplay',resumeClock);
  v.addEventListener('error',videoProblem);
  v.addEventListener('pause',()=>{if(phase==='exercise'){pauseClock();if(!document.hidden)videoProblem();}});
  videos.push(v);media.append(v);attachChromaVideo(v,media);
  const action=document.createElement('span');action.className='answerAction';action.textContent=choice.exercise.name;
  card.append(heading,media,action);card.setAttribute('aria-label',`${'ABC'[index]}，答案 ${choice.value}，${choice.exercise.name}`);$('answers').append(card);
 });
}
function beginExercise(){
 if(phase!=='question')return;
 unlockAudio();phase='loading';$('roundStart').disabled=true;$('roundStart').hidden=true;
 $('exerciseFeedback').textContent='一起動起來！';$('exercisePrompt').textContent='跟隨所選答案的動作，持續 10 秒';
 videos.forEach(v=>v.currentTime=0);elapsed=0;clockStart=null;startVideos();
}
function armLoadTimeout(){clearTimeout(loadTimeout);loadTimeout=setTimeout(videoProblem,TIMING.videoLoadTimeout);}
async function startVideos(){
 if(document.hidden||!['loading','exercise'].includes(phase))return;
 const attempt=++playAttempt;
 $('retryVideo').hidden=true;$('loading').hidden=false;armLoadTimeout();
 try{
  await Promise.all(videos.map(v=>v.play()));
  if(attempt!==playAttempt||document.hidden||!['loading','exercise'].includes(phase))return;
  if(phase==='loading'){phase='exercise';playExerciseStartSound();}
  resumeClock();
 }catch{if(attempt===playAttempt)videoProblem();}
}
function videoProblem(){
 if(!['loading','exercise'].includes(phase))return;
 pauseClock();phase='loading';playAttempt++;clearTimeout(loadTimeout);stopVideos();
 $('loading').hidden=true;$('retryVideo').hidden=false;$('exerciseFeedback').textContent='點按繼續播放';
}
function pauseClock(){if(clockStart!==null){elapsed+=performance.now()-clockStart;clockStart=null;}cancelAnimationFrame(frame);}
function resumeClock(){
 if(phase!=='exercise'||document.hidden||videos.some(v=>v.paused||v.readyState<3))return;
 clearTimeout(loadTimeout);$('loading').hidden=true;$('retryVideo').hidden=true;
 if(clockStart===null)clockStart=performance.now();cancelAnimationFrame(frame);tick();
}
function formatTime(seconds){return '00:'+String(seconds).padStart(2,'0');}
function tick(){
 if(phase!=='exercise'||clockStart===null)return;
 const remaining=Math.max(0,EXERCISE_SECONDS*1000-elapsed-performance.now()+clockStart);
 $('timer').textContent=formatTime(Math.ceil(remaining/1000));$('timerFill').style.transform=`scaleX(${remaining/(EXERCISE_SECONDS*1000)})`;
 if(remaining<=0){revealAnswer();return;}frame=requestAnimationFrame(tick);
}
async function revealAnswer(){
 const spoken=readCantonese('答案係——'+'ABC'[questions[round].correctIndex]+'！'+questions[round].explanation);
 phase='reveal';playAttempt++;cancelAnimationFrame(frame);clockStart=null;clearTimeout(loadTimeout);stopVideos();
 const index=questions[round].correctIndex;
 $('answers').classList.add('revealed');$('answers').children[index].classList.add('correctAnswer');
 $('exerciseName').textContent=`正確答案：${'ABC'[index]}`;
 $('exercisePrompt').textContent='你想對了嗎？';$('exerciseFeedback').textContent='答案揭曉！';
 $('feedback').textContent='';$('loading').hidden=true;$('retryVideo').hidden=true;
 playCompletionSound();updateProgress(round+1);
 const revealAttempt=playAttempt;
 const playback=videos.map((v,i)=>{
  const isCorrect=i===index,file=FEEDBACK_VIDEOS[isCorrect?'correct':'wrong'];
  v.loop=false;v.poster='assets/'+file.replace(/\.mp4$/i,'.jpg');v.src='assets/'+file;v.load();
  $('answers').children[i].querySelector('.answerAction').textContent=isCorrect?'✓ 正確答案':'✕ 不是這個答案';
  return v.play();
 });
 // Allow the full ten-second supplied celebration; failed media cannot block the game.
 let readyTimeout;
 await Promise.race([Promise.allSettled(playback),new Promise(resolve=>{readyTimeout=setTimeout(resolve,4000);})]);
 clearTimeout(readyTimeout);
 if(phase!=='reveal'||revealAttempt!==playAttempt)return;
 await spoken;
 if(phase!=='reveal'||revealAttempt!==playAttempt)return;
 transitionTimeout=setTimeout(()=>{
  stopVideos();round++;
  if(round===QUESTIONS_PER_GAME){phase='finish';showScreen('finish');updateProgress(round);playFinalSound();}
  else showQuestion();
 },TIMING.revealFeedback);
}
document.addEventListener('visibilitychange',()=>{
 if(document.hidden){if(['exercise','loading'].includes(phase)){pauseClock();playAttempt++;clearTimeout(loadTimeout);stopVideos();}}
 else if(['exercise','loading'].includes(phase))startVideos();
});
let narrating=false;
async function readCantonese(text){
 const synth=window.speechSynthesis;
 if(!synth){$('feedback').textContent='此瀏覽器未能提供廣東話朗讀。';return;}
 let voices=synth.getVoices();
 if(!voices.length){await new Promise(r=>setTimeout(r,500));voices=synth.getVoices();}
 const voice=voices.find(v=>/^(zh[-_]HK|yue)([-_]|$)/i.test(v.lang))||voices.find(v=>/cantonese|廣東話|粤语/i.test(v.name));
 if(!voice){$('feedback').textContent='未找到廣東話聲線，請在裝置加入香港中文語音。';return;}
 narrating=true;
 try{for(const part of text.replace(/(\d+)%/g,'百分之$1').replace(/(\d+)°C/g,'攝氏$1度').split(/(?<=[。！？])/).filter(Boolean)){
 await new Promise(resolve=>{const u=new SpeechSynthesisUtterance(part);u.voice=voice;u.lang=voice.lang;u.rate=.9;u.onend=resolve;u.onerror=()=>{$('feedback').textContent='朗讀未能完成，請檢查裝置語音設定。';resolve();};synth.speak(u);});
 }}finally{narrating=false;}
}
$('roundStart').textContent='讀題及開始 ▶';
$('roundStart').onclick=async()=>{
 if(phase!=='question'||narrating||$('roundStart').disabled)return;
 $('roundStart').disabled=true;const q=questions[round];
 await readCantonese(`第${round+1}題。${q.question}`+q.answers.map((a,i)=>'ABC'[i]+'，'+a).join(''));
 if(phase==='question')beginExercise();
};
$('retryVideo').onclick=()=>{unlockAudio();videos.forEach(v=>{if(v.error)v.load();});$('exerciseFeedback').textContent='一起動起來！';startVideos();};
$('startButton').onclick=newGame;$('replay').onclick=newGame;
$('sound').onclick=()=>{unlockAudio();soundOn=!soundOn;$('sound').textContent=soundOn?'♪ 音效開':'♪ 音效關';$('sound').setAttribute('aria-pressed',String(!soundOn));$('sound').setAttribute('aria-label',soundOn?'關閉音效':'開啟音效');};

// Optional browser agent access, sharing the same visible game state.
if(document.modelContext?.registerTool){
 const lifecycle=new AbortController();
 const tool={name:'read_science_challenge',description:'Read the current challenge and phase; answers are disclosed only during reveal or completion.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute(input){
  if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).length)throw new Error('Expected an empty object.');
  const q=questions[round];return {phase,questionNumber:Math.min(round+1,QUESTIONS_PER_GAME),total:QUESTIONS_PER_GAME,question:q?.question??null,choices:choices.map(c=>({answer:c.value,action:c.exercise.name})),correctLetter:phase==='reveal'?'ABC'[q.correctIndex]:null};
 }};
 try{Promise.resolve(document.modelContext.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{});}catch{}
 window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});
}
