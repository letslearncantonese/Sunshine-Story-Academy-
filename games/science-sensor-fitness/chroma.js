'use strict';
// Keep original MP4s intact. Composite transparent frames at display time,
// including the still preview and both answer reactions. No alpha-codec dependency.
function removeGreen(data) {
 for(let i=0;i<data.length;i+=4){
  const r=data[i],g=data[i+1],b=data[i+2];
  if(g<=r*1.12||g<=b*1.06)continue;
  const amount=Math.max(0,Math.min(1,(g-Math.max(r,b)-6)/18));
  const matte=amount*amount*(3-2*amount);
  data[i+3]=Math.round(data[i+3]*(1-matte));
  // Remove green spill from soft, partially transparent edges.
  if(matte>0)data[i+1]=Math.round(g-(g-(r+b)/2)*matte);
 }
 return data;
}
function attachChromaVideo(video,container){
 const canvas=document.createElement('canvas');canvas.className='keyedVideo';
 canvas.setAttribute('aria-hidden','true');container.append(canvas);
 const ctx=canvas.getContext('2d',{willReadFrequently:true});
 if(!ctx){canvas.remove();return;}
 video.classList.add('chromaSource');
 let poster=null,posterURL='',lastTime=-1,lastSource='',lastDraw=0;
 function paint(source,width,height){
  if(!width||!height)return;
  const w=Math.min(640,width),h=Math.round(height*w/width);
  if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
  ctx.clearRect(0,0,w,h);ctx.drawImage(source,0,0,w,h);
  const pixels=ctx.getImageData(0,0,w,h);removeGreen(pixels.data);ctx.putImageData(pixels,0,0);
 }
 function loop(now){
  if(!video.isConnected)return;
  if(video.poster!==posterURL){
   posterURL=video.poster;const pending=new Image();poster=pending;
   pending.onload=()=>{if(poster===pending&&video.readyState<2)paint(pending,pending.naturalWidth,pending.naturalHeight);};
   pending.src=posterURL;lastTime=-1;lastSource='';
   ctx.clearRect(0,0,canvas.width,canvas.height);
  }
  // Limit CPU work to 30 fps; all three videos retain their native playback clock.
  if(!document.hidden&&now-lastDraw>=1000/30&&video.readyState>=2&&
    (video.currentTime!==lastTime||video.src!==lastSource)){
   paint(video,video.videoWidth,video.videoHeight);
   lastTime=video.currentTime;lastSource=video.src;lastDraw=now;
  }
  requestAnimationFrame(loop);
 }
 requestAnimationFrame(loop);
}
if(typeof module!=='undefined')module.exports={removeGreen};
