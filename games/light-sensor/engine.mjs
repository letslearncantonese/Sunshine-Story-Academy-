export const DURATION=60;
export function inside(x){return x>=50&&x<=65}
// Integrate only the fraction of each movement segment within the exact band.
export function successfulSlice(a,b,dt){if(a===b)return inside(a)?dt:0;const lo=Math.min(a,b),hi=Math.max(a,b);return dt*Math.max(0,Math.min(hi,65)-Math.max(lo,50))/(hi-lo)}
const DAY=[
{t:0,light:60,rain:0,cloud:0,wind:0,warm:.5,night:.1,label:'日出'},
{t:3,light:65,rain:0,cloud:0,wind:.1,warm:.2,night:0,label:'早上'},
{t:7,light:98,rain:0,cloud:0,wind:.1,warm:0,night:0,label:'猛烈陽光'},
{t:11,light:24,rain:.8,cloud:.9,wind:.8,warm:0,night:0,label:'驟雨'},
{t:15,light:88,rain:0,cloud:0,wind:.2,warm:0,night:0,label:'放晴'},
{t:20,light:14,rain:1,cloud:1,wind:1,warm:0,night:0,label:'狂風大雨'},
{t:25,light:94,rain:0,cloud:.05,wind:.2,warm:0,night:0,label:'雨過天晴'},
{t:30,light:32,rain:.65,cloud:.85,wind:.7,warm:0,night:0,label:'烏雲遮日'},
{t:35,light:99,rain:0,cloud:0,wind:.1,warm:.05,night:0,label:'陽光普照'},
{t:40,light:18,rain:1,cloud:1,wind:1,warm:0,night:0,label:'午後雷雨'},
{t:45,light:88,rain:0,cloud:.05,wind:.2,warm:.2,night:0,label:'再次放晴'},
{t:50,light:54,rain:0,cloud:.1,wind:.1,warm:.5,night:0,label:'黃昏'},
{t:55,light:30,rain:0,cloud:0,wind:.05,warm:.7,night:.25,label:'日落'},
{t:60,light:9,rain:0,cloud:0,wind:0,warm:.15,night:.8,label:'入夜'}
];
export function weatherState(t){t=Math.max(0,Math.min(60,t));let a=DAY[0],b=DAY[1];for(let i=0;i<DAY.length-1;i++){if(t>=DAY[i].t){a=DAY[i];b=DAY[i+1]}}let u=(t-a.t)/(b.t-a.t);u=Math.max(0,Math.min(1,u));const smooth=u*u*(3-2*u),state={label:t===60?b.label:a.label};for(const key of['light','rain','cloud','wind','warm','night'])state[key]=a[key]+(b[key]-a[key])*smooth;return state}
export function sceneBrightness(light){return .22+Math.max(0,Math.min(100,light))*.0128}
export function drift(t,phase,level=57.5){const w=weatherState(t);const rest=(t<10)||(t>=31&&t<34)||(t>=45&&t<48);if(rest)return .12*(57.5-level)+.65*Math.sin(t*.65+phase);return .25*(w.light-level)+(1.5+w.wind*2.4)*Math.sin(t*(.65+w.wind*.6)+phase)+Math.cos(t*1.5)}
export function forecast(t){const cues=[{at:3,text:'陽光增強！踎低關百葉簾 ↓',kind:'sun'},{at:7,text:'驟雨快到！趷高加光 ↑',kind:'wind'},{at:11,text:'就快放晴！踎低減光 ↓',kind:'sun'},{at:15,text:'風暴嚟喇！趷高開燈 ↑',kind:'wind'},{at:20,text:'烏雲散開！踎低減光 ↓',kind:'sun'},{at:25,text:'烏雲遮日！趷高加光 ↑',kind:'wind'},{at:30,text:'太陽出嚟！踎低減光 ↓',kind:'sun'},{at:35,text:'大雨快到！趷高開燈 ↑',kind:'wind'},{at:40,text:'就快放晴！踎低減光 ↓',kind:'sun'},{at:50,text:'太陽落山！趷高開燈 ↑',kind:'sun'}];return cues.find(c=>t>=c.at&&t<c.at+2)||null}
export function equipment(dial){const d=Math.max(0,Math.min(1,dial));return{open:Math.min(1,d/.55),lamp:Math.max(0,(d-.55)/.45)}}
export function sensedLight(t,dial,seed=0){const w=weatherState(t),e=equipment(dial);const ambient=Math.max(0,Math.min(100,w.light+(t<3?0:4*Math.sin(t*2.1+seed))));return Math.max(0,Math.min(100,ambient*(.1+.9*e.open)+75*e.lamp))}
export function motionStep(current,target,dt){return current+(target-current)*(1-Math.exp(-Math.max(0,dt)*7))}

