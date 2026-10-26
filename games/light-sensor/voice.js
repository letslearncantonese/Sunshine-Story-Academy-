// Only explicitly Cantonese voices are eligible. Never fall back to Mandarin.
export function cantoneseVoice(voices){return voices.find(v=>/^yue(?:-|_|$)/i.test(v.lang))||voices.find(v=>/^zh[-_]HK$/i.test(v.lang))||voices.find(v=>/cantonese|廣東話|粵語/i.test(v.name))||null}
const synth=window.speechSynthesis;let voice=null,enabled=true,current=null;
function refresh(){voice=synth?cantoneseVoice(synth.getVoices()):null;const note=document.querySelector('.sound-note');if(note)note.textContent=voice?'廣東話語音提示 · 記得開啟裝置聲音':'裝置未提供廣東話聲音，會保留文字及提示音';}
if(synth)synth.addEventListener('voiceschanged',refresh);refresh();
export function stopVoice(){if(synth)synth.cancel();current=null}
export function setVoiceEnabled(value){enabled=value;if(!value)stopVoice()}
export function speakCantonese(text){refresh();if(!enabled||!voice||!synth)return false;stopVoice();synth.resume();current=new SpeechSynthesisUtterance(text);current.voice=voice;current.lang=voice.lang;current.rate=1.08;current.pitch=1.05;current.volume=1;current.onerror=()=>{current=null};current.onend=()=>{current=null};synth.speak(current);return true}
export function speakCue(cue){const text=cue.text.replace(/[↑↓]/g,'').replace(/！/g,'，').replace('踎低減光','踎低，調暗啲').replace('趷高加光','趷高，光啲');return speakCantonese(text)}
