import './style.css';
import {readHand,createGestureGate} from './gesture.js';
import {loadDetector,drawHand} from './hand-camera.js';
import {enableAudio,muteAudio,playCrack,playPop} from './crack-audio.js';
import {specimens} from './specimens.js';
import {mountWax} from './wax-scene.js';

const $=id=>document.getElementById(id);
const camera=$('camera-toggle'), cameraLabel=camera.querySelector('span');
const video=$('camera-feed'), marks=$('landmarks'), preview=$('preview');
const state=$('camera-state'), guidance=$('guidance'), sceneHost=$('scene');
const sound=$('sound'), squeeze=$('squeeze'), reset=$('reset');
const steps=[...document.querySelectorAll('.steps li')];
const names=['','初裂','裂開','碎裂'];
const choices=document.querySelectorAll('input[name="squishy"]');
let item=specimens[document.querySelector('input[name="squishy"]:checked').value];
const gate=createGestureGate();
let stage=0, soundOn=false, live=null, pending=false, frame=0, session=0, visual;
try{
  visual=mountWax(sceneHost,item);
}catch(error){
  $('scene-error').hidden=false;
  console.warn('Waxball WebGL initialization:',error);
}
sceneHost.addEventListener('webglcontextlost',()=>{ $('scene-error').hidden=false; },true);
sceneHost.addEventListener('webglcontextrestored',()=>{ $('scene-error').hidden=true; },true);

function status(label,message){
  if(state.textContent!==label)state.textContent=label;
  if(guidance.textContent!==message)guidance.textContent=message;
}
function renderStage(value,announce=true){
  stage=value;
  visual?.setStage(value);
  const name=value ? names[value] : item.name;
  $('specimen').textContent=name;
  $('stage-count').textContent=item.breakable ? '0'+value+' / 03' : '柔軟回彈';
  sceneHost.setAttribute('aria-label',item.breakable ? item.name+'，'+(value?name+'，第 '+value+' 階段':'完整') : item.name+'，柔軟回彈');
  squeeze.disabled=item.breakable && value===3;
  reset.disabled=!value;
  steps.forEach((item,i)=>{
    item.dataset.done=String(i+1<value);
    if(i+1===value)item.setAttribute('aria-current','step');
    else item.removeAttribute('aria-current');
  });
  if(announce)$('announcement').textContent=value?'第 '+value+' 階段：'+name:'已重置'+item.name+'。';
}
function showItem(){
  $('stage').dataset.item=item.id;
  $('plate').textContent=item.plate;
  $('figure').textContent='FIG. '+item.figure;
  $('steps').hidden=!item.breakable;
  $('feel').hidden=item.breakable;
  $('feel').textContent=item.feel||'';
  $('footer-gesture').textContent=item.breakable?'握拳 → 張手 → 再握拳':'握拳壓扁 · 張手回彈';
  reset.hidden=!item.breakable;
  if(item.breakable)steps.forEach((step,i)=>{step.querySelector('small').textContent=item.steps[i];});
  renderStage(0,false);
}
for(const choice of choices){
  choice.addEventListener('change',()=>{
    item=specimens[choice.value];
    gate.reset();
    visual?.setItem(item);
    showItem();
    if(live&&!pending)status('追蹤中',readyHint());
    $('announcement').textContent='已換成'+item.name+'。';
  });
}
function readyHint(){
  return item.breakable ? '先張開手掌，再握拳。' : '握拳捏扁，張手讓它回彈。';
}
function advance(){
  if(stage>=3)return;
  renderStage(stage+1);
  if(soundOn)playCrack(stage,item.id);
  if(stage===3 && live)status('已完成','還能握緊或鬆手改變內芯形狀，按「重置」可再玩。');
}
function manualSqueeze(){
  if(item.breakable)advance();
  else{
    visual?.pulse();
    if(soundOn)playPop(item.id);
  }
}
showItem();
squeeze.addEventListener('click',manualSqueeze);
reset.addEventListener('click',()=>{
  gate.reset();
  visual?.setGrip(0);
  renderStage(0);
  if(live)status('追蹤中','先張開手掌，再握拳。');
  // Keep focus usable when the reset control becomes disabled.
  squeeze.focus({preventScroll:true});
});
window.addEventListener('keydown',event=>{
  if(event.code!=='Space'||event.repeat||event.altKey||event.ctrlKey||event.metaKey)return;
  if(event.target instanceof Element && event.target.closest('button,a,input,textarea,select,[contenteditable]'))return;
  if(!squeeze.disabled){event.preventDefault();manualSqueeze();}
});
sound.addEventListener('click',async ()=>{
  if(soundOn)soundOn=false;
  else try{soundOn=await enableAudio();}catch{soundOn=false;}
  muteAudio(!soundOn);
  sound.setAttribute('aria-pressed',String(soundOn));
  sound.querySelector('use').setAttribute('href',soundOn?'#sound-icon':'#muted-icon');
});

function stopCamera(message='開啟相機後，先張手，再握拳。',label='未開啟'){
  session++;
  cancelAnimationFrame(frame);
  live?.getTracks().forEach(track=>track.stop());
  live=null;pending=false;
  video.pause();
  video.srcObject=null;
  marks.getContext('2d').clearRect(0,0,marks.width,marks.height);
  preview.dataset.live='false';
  camera.dataset.active='false';
  cameraLabel.textContent='開啟相機';
  gate.reset();
  visual?.setGrip(0);
  status(label,message);
}
function cameraMessage(error){
  if(error.name==='NotAllowedError'||error.name==='SecurityError')return '相機權限未開啟。請在瀏覽器允許相機，或用下方按鈕試玩。';
  if(error.name==='NotFoundError')return '找不到相機。請接上相機，或用下方按鈕試玩。';
  if(error.name==='NotReadableError')return '相機目前無法使用。請關閉占用相機的程式再試。';
  return '手部追蹤無法啟動。請檢查網路後再試，或用下方按鈕試玩。';
}
function trackHand(detector,id){
  let lastFrame=-1,lastRun=-Infinity,lastSeen=-Infinity;
  function tick(now){
    if(id!==session || !live)return;
    if(video.readyState>=2 && lastFrame!==video.currentTime && now-lastRun>=42){
      lastFrame=video.currentTime;lastRun=now;
      try{
        const result=detector.detectForVideo(video,now);
        const points=result.landmarks[0];
        const {pose,grip}=readHand(points,result.worldLandmarks[0],video.videoWidth/video.videoHeight);
        drawHand(marks,video,points);
        if(pose!=='missing'){
          lastSeen=now;
          visual?.setGrip(grip);
        }
        const reading=gate.sample(pose,now);
        if(reading.trigger){
          if(item.breakable)advance();
          else if(soundOn)playPop(item.id);
        }
        if(stage!==3){
          if(!points && now-lastSeen>300)status('找不到手','讓一隻手完整入鏡，掌心朝向相機。');
          else if(reading.stable==='open')status('已張手',item.breakable?'握拳，推進一個破裂階段。':readyHint());
          else if(reading.stable==='fist')status('已握拳',item.breakable?'握緊會壓得更扁。張手後，再握一次。':'握緊會壓得更扁，鬆手就會回彈。');
          else if(points && !reading.armed)status('追蹤中',readyHint());
        }
      }catch(error){
        console.warn('Waxball camera frame:',error);
        stopCamera('手部追蹤中斷。請重新開啟相機，或用按鈕繼續。','已中斷');
        return;
      }
    }
    if(now-lastSeen>160)visual?.setGrip(0);
    frame=requestAnimationFrame(tick);
  }
  frame=requestAnimationFrame(tick);
}
camera.addEventListener('click',async ()=>{
  if(live||pending){stopCamera();return;}
  if(!window.isSecureContext||!navigator.mediaDevices?.getUserMedia){
    status('相機不可用','請用 HTTPS 或 localhost 開啟，或使用手動捏球。');return;
  }
  const id=++session;
  pending=true;
  camera.dataset.active='true';
  cameraLabel.textContent='取消開啟';
  status('等待相機','請允許瀏覽器使用相機。');
  try{
    const stream=await navigator.mediaDevices.getUserMedia({
      audio:false, video:{facingMode:'user',width:{ideal:640},height:{ideal:480},frameRate:{ideal:30,max:30}},
    });
    if(id!==session){stream.getTracks().forEach(t=>t.stop());return;}
    live=stream;
    stream.getVideoTracks().forEach(track=>track.addEventListener('ended',()=>{
      if(id===session)stopCamera('相機已斷開。請重新開啟相機，或用按鈕繼續。','已中斷');
    },{once:true}));
    video.srcObject=stream;
    await video.play();
    if(id!==session)return;
    preview.dataset.live='true';
    cameraLabel.textContent='關閉相機';
    status('載入追蹤','正在載入手部追蹤模型。');
    const detector=await loadDetector();
    if(id!==session)return;
    pending=false;
    status('追蹤中',readyHint());
    trackHand(detector,id);
  }catch(error){
    if(id!==session)return;
    console.warn('Waxball camera initialization:',error);
    stopCamera(cameraMessage(error),'未能開啟');
  }
});
window.addEventListener('pagehide',()=>{if(live||pending)stopCamera();});
