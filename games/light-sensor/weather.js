import{weatherState,sceneBrightness,equipment}from'./engine.mjs';
const scene=document.getElementById('scene'),canvas=document.getElementById('weather'),ctx=canvas.getContext('2d'),label=document.getElementById('weather-label');
canvas.width=1536;canvas.height=864;
const room=new Image();room.src="assets/room.webp";const sun=new Image(),cloud=new Image();sun.src='assets/sun.png';cloud.src='assets/cloud.png';
export const weatherReady=Promise.all([sun.decode(),cloud.decode(),room.decode()]);
const drops=Array.from({length:180},(_,i)=>({x:((i*137.508)%1000)/1000,y:((i*71.31)%997)/997,s:.65+(i%11)/14}));
let lastTime=-1,lastLevel=-1;
// Window-only mask keeps rain, clouds and the moving sun outdoors.
function windowMask(){ctx.beginPath();ctx.rect(402,120,107,372);ctx.rect(526,120,180,372);ctx.rect(723,120,69,370);ctx.moveTo(809,119);ctx.lineTo(1060,119);ctx.lineTo(1060,300);ctx.lineTo(985,335);ctx.lineTo(985,490);ctx.lineTo(809,490);ctx.closePath();ctx.clip()}
export function renderWeather(t,light,force=false,dial=.52454){if(!force&&Math.abs(t-lastTime)<1/30&&Math.abs(light-lastLevel)<.1)return;lastTime=t;lastLevel=light;const w=weatherState(t);scene.style.filter='none';document.querySelector('.scene-image').style.filter='brightness('+sceneBrightness(light).toFixed(3)+')';label.textContent=w.label;ctx.clearRect(0,0,1536,864);
 ctx.save();windowMask();ctx.filter="brightness("+sceneBrightness(w.light).toFixed(3)+")";ctx.drawImage(room,0,0,1536,864);ctx.filter="none";
 // The sun completes an arc from the left horizon to the right horizon.
 const p=Math.min(1,t/58),x=575+p*425,y=310-Math.sin(p*Math.PI)*160;
 ctx.globalAlpha=Math.max(0,(1-w.cloud*.93)*(1-w.night));if(sun.complete&&sun.naturalWidth)ctx.drawImage(sun,x-65,y-65,130,130);
 ctx.globalAlpha=w.cloud*.94;if(cloud.complete&&cloud.naturalWidth){const sway=Math.sin(t*.43)*w.wind*32;ctx.drawImage(cloud,370+sway,40,850,360)}
 ctx.globalAlpha=1;
 if(w.rain>.01){ctx.lineWidth=1.8;ctx.strokeStyle='rgba(205,232,255,'+(w.rain*.76).toFixed(3)+')';ctx.beginPath();const count=Math.floor(drops.length*w.rain);for(let i=0;i<count;i++){const d=drops[i],fall=t*(.62+w.wind*.8)*d.s,dy=((d.y+fall)%1)*460+90,dx=470+((d.x+t*w.wind*.14)%1)*680,length=12+18*d.s;ctx.moveTo(dx,dy);ctx.lineTo(dx-length*w.wind*.9,dy+length)}ctx.stroke();
 // Long drifting streaks make strong gusts readable without obscuring controls.
 if(w.wind>.5){ctx.strokeStyle='rgba(233,244,255,'+(w.wind*.15).toFixed(3)+')';ctx.lineWidth=2;ctx.beginPath();for(let i=0;i<8;i++){const gx=430+((t*.34+i*.17)%1)*720,gy=170+i*42+Math.sin(t*2+i)*9;ctx.moveTo(gx,gy);ctx.quadraticCurveTo(gx+40,gy-13,gx+85,gy-6)}ctx.stroke()}}
 ctx.restore();
 if(w.warm>.001){ctx.fillStyle='rgba(255,133,49,'+(w.warm*.24).toFixed(3)+')';ctx.fillRect(0,0,1536,864)}
 if(w.night>.001){ctx.fillStyle='rgba(18,35,91,'+(w.night*.48).toFixed(3)+')';ctx.fillRect(0,0,1536,864)}
 const e=equipment(dial);ctx.save();windowMask();
 // Functional blind slats rotate closed smoothly; narrow gaps preserve the view.
 const closed=1-e.open,slatH=2+closed*20;
 for(let y=120;y<500;y+=23){const grad=ctx.createLinearGradient(0,y,0,y+slatH);grad.addColorStop(0,'#f0eee4');grad.addColorStop(.45,'#d2d8d7');grad.addColorStop(1,'#849898');ctx.fillStyle=grad;ctx.fillRect(396,y,685,slatH);ctx.fillStyle='rgba(20,40,50,.18)';ctx.fillRect(396,y+slatH,685,2)}
 ctx.strokeStyle='#e8e8dc';ctx.lineWidth=2;for(const x of[450,600,750,900,1030]){ctx.beginPath();ctx.moveTo(x,120);ctx.lineTo(x,500);ctx.stroke()}ctx.restore();
 // Warm pools of light brighten the existing ceiling fixtures and indoor floor.
 if(e.lamp>.001){ctx.save();ctx.beginPath();ctx.rect(0,0,1536,864);ctx.rect(396,115,680,390);ctx.clip('evenodd');ctx.globalCompositeOperation='screen';for(const [x,y]of[[370,90],[1140,95],[760,640]]){const g=ctx.createRadialGradient(x,y,4,x,y,y>500?330:180);g.addColorStop(0,'rgba(255,221,140,'+(e.lamp*.7)+')');g.addColorStop(1,'rgba(255,209,110,0)');ctx.fillStyle=g;ctx.fillRect(x-330,y-330,660,660)}ctx.restore()}
 document.getElementById('device-status').textContent='百葉簾 '+Math.round(closed*100)+'% 關閉 · 燈光 '+Math.round(e.lamp*100)+'%';
}
