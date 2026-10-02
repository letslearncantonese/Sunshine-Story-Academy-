'use strict';
// EDITABLE SETTINGS: add only videos that actually exist in assets/.
const QUESTION_POOL = [2,3,4,5,6,7,8,9];
const QUESTIONS_PER_GAME = 5;
const EXERCISE_SECONDS = 10;
const TIMING = { revealFeedback: 4000, videoLoadTimeout: 15000 };
const exercises = [
  { name:'開合跳', file:'Ninja_performing_jumping_jacks_20260910172915.mp4' },
  { name:'高抬腿', file:'Ninja_marching_high_knees_20260910173258.mp4' },
  { name:'左右側步', file:'Ninja_side_stepping_repeatedly_20260910173408.mp4' },
  { name:'出拳', file:'Ninja_performing_alternating_pun…_20260910173419.mp4' },
  { name:'深蹲', file:'Ninja_performing_squats_20260910173705.mp4' },
  { name:'交替踢腳', file:'Ninja_performing_alternating_leg…_20260912205530.mp4' }
];
const FEEDBACK_VIDEOS = {
 correct: 'Ninja_jumping_in_cheer_20260910202511.mp4',
 wrong: 'Ninja_shaking_head_wrong_answer_20260910202713.mp4'
};
let feedbackPreloads=[];
// Optional replacement sound filenames, relative to index.html. Empty = synthesized effect.
const SOUND_FILES = { correct:'', wrong:'', exerciseStart:'', completion:'', final:'' };
const $ = id => document.getElementById(id);
let audioContext, soundOn=true, phase='start', round=0;
let questions=[], workoutPlan=[], positions=[], choices=[], videos=[];
let transitionTimeout, loadTimeout, frame, elapsed=0, clockStart=null, playAttempt=0;
const customSounds = {};
function unlockAudio(){try{audioContext ||= new (window.AudioContext||window.webkitAudioContext)();audioContext.resume().catch(()=>{});}catch{}}
function tone(freq,offset,length,volume=.12){if(!audioContext||!soundOn)return;const t=audioContext.currentTime+offset,o=audioContext.createOscillator(),g=audioContext.createGain();o.type='sine';o.frequency.value=freq;g.gain.setValueAtTime(.001,t);g.gain.exponentialRampToValueAtTime(volume,t+.015);g.gain.exponentialRampToValueAtTime(.001,t+length);o.connect(g);g.connect(audioContext.destination);o.start(t);o.stop(t+length+.01);}
function sound(name){if(!soundOn)return;if(SOUND_FILES[name]){const a=customSounds[name] ||= new Audio(SOUND_FILES[name]);a.currentTime=0;a.play().catch(()=>synthSound(name));}else synthSound(name);}
function synthSound(name){const notes={correct:[523,659,784],wrong:[260,220],exerciseStart:[440,880],completion:[659,880],final:[523,659,784,1047,1319]}[name];notes.forEach((f,i)=>tone(f,i*.105,name==='wrong'?.17:.22,name==='wrong'?.07:.12));}
function playCorrectSound(){sound('correct');} function playWrongSound(){sound('wrong');}
function playExerciseStartSound(){sound('exerciseStart');} function playCompletionSound(){sound('completion');} function playFinalSound(){sound('final');}
function shuffle(items){const a=[...items];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function selectPositions(){// Every position appears, none repeats consecutively.
 const first=shuffle([0,1,2]); const next=shuffle([0,1,2].filter(p=>p!==first[2]));return [...first,...next];
}
function makeAnswers(factor,position){const correct=4*factor;const wrong=shuffle([-8,-4,4,8].map(n=>correct+n).filter(n=>n>0)).slice(0,2);wrong.splice(position,0,correct);return wrong;}

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
 questions=shuffle(QUESTION_POOL).slice(0,QUESTIONS_PER_GAME);workoutPlan=shuffle(exercises).slice(0,QUESTIONS_PER_GAME);positions=selectPositions();round=0;showQuestion();
}
function showQuestion(){
 phase='question';showScreen('question');updateProgress(round);stopVideos();videos=[];elapsed=0;clockStart=null;
 // The shuffled game plan reserves one DISTINCT correct action per question.
 // Only distractors are sampled again; each card within a question is different.
 const correctAction=workoutPlan[round];
 const actions=shuffle(exercises.filter(action=>action.file!==correctAction.file)).slice(0,2);
 actions.splice(positions[round],0,correctAction);
 choices=makeAnswers(questions[round],positions[round]).map((value,i)=>({value,exercise:actions[i]}));
 $('questionProgress').textContent=`第 ${round+1} / ${QUESTIONS_PER_GAME} 題`;
 $('equation').textContent=`4 × ${questions[round]} = ?`;
 $('exerciseName').textContent='諗好答案，跟住做！';
 $('exercisePrompt').textContent='跟你心目中答案嘅動作郁';
 $('exerciseFeedback').textContent='準備好未？';$('feedback').textContent='';
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
  videos.push(v);media.append(v);
  const action=document.createElement('span');action.className='answerAction';action.textContent=choice.exercise.name;
  card.append(heading,media,action);card.setAttribute('aria-label',`${'ABC'[index]}，答案 ${choice.value}，${choice.exercise.name}`);$('answers').append(card);
 });
}
function beginExercise(){
 if(phase!=='question')return;
 unlockAudio();phase='loading';$('roundStart').disabled=true;$('roundStart').hidden=true;
 $('exerciseFeedback').textContent='一齊做，加油！';$('exercisePrompt').textContent='跟你心目中答案嘅動作做 10 秒';
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
 $('loading').hidden=true;$('retryVideo').hidden=false;$('exerciseFeedback').textContent='撳一下繼續';
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
 phase='reveal';playAttempt++;cancelAnimationFrame(frame);clockStart=null;clearTimeout(loadTimeout);stopVideos();
 const correct=questions[round]*4,index=choices.findIndex(c=>c.value===correct);
 $('answers').classList.add('revealed');$('answers').children[index].classList.add('correctAnswer');
 $('equation').textContent=`4 × ${questions[round]} = ${correct}`;
 $('exerciseName').textContent=`答案係 ${'ABC'[index]}：${correct}`;
 $('exercisePrompt').textContent='你諗啱咗未呀？';$('exerciseFeedback').textContent='完成！';
 $('feedback').textContent='';$('loading').hidden=true;$('retryVideo').hidden=true;
 playCompletionSound();updateProgress(round+1);
 const revealAttempt=playAttempt;
 const playback=videos.map((v,i)=>{
  const isCorrect=i===index,file=FEEDBACK_VIDEOS[isCorrect?'correct':'wrong'];
  v.loop=false;v.poster='assets/'+file.replace(/\.mp4$/i,'.jpg');v.src='assets/'+file;v.load();
  $('answers').children[i].querySelector('.answerAction').textContent=isCorrect?'✓ 正確答案':'呢個唔啱';
  return v.play();
 });
 // Let the supplied four-second cheer finish; a failed video cannot block the game.
 let readyTimeout;
 await Promise.race([Promise.allSettled(playback),new Promise(resolve=>{readyTimeout=setTimeout(resolve,4000);})]);
 clearTimeout(readyTimeout);
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
$('roundStart').onclick=beginExercise;
$('retryVideo').onclick=()=>{unlockAudio();videos.forEach(v=>{if(v.error)v.load();});$('exerciseFeedback').textContent='一齊做，加油！';startVideos();};
$('startButton').onclick=newGame;$('replay').onclick=newGame;
$('sound').onclick=()=>{unlockAudio();soundOn=!soundOn;$('sound').textContent=soundOn?'♪ 音效開':'♪ 音效關';$('sound').setAttribute('aria-pressed',String(!soundOn));$('sound').setAttribute('aria-label',soundOn?'關閉音效':'開啟音效');};
