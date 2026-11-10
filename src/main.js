import './style.css';
import {readHand,createGestureGate} from './gesture.js';
import {loadDetector,drawHand} from './hand-camera.js';
import {enableAudio,playCrack} from './crack-audio.js';
import {mountWax} from './wax-scene.js';

const $=id=>document.getElementById(id);
const camera=$('camera-toggle'), cameraLabel=camera.querySelector('span');
const video=$('camera-feed'), marks=$('landmarks'), preview=$('preview');
const state=$('camera-state'), guidance=$('guidance'), sceneHost=$('scene');
const sound=$('sound'), squeeze=$('squeeze'), reset=$('reset');
const steps=[...document.querySelectorAll('.steps li')];
const names=['完整巧克力','初裂','裂開','碎裂'];
const gate=createGestureGate();
let stage=0, soundOn=false, live=null, pending=false, frame=0, session=0, visual;
try{
  visual=mountWax(sceneHost);
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
  $('specimen').textContent=names[value];
  $('stage-count').textContent='0'+value+' / 03';
  sceneHost.setAttribute('aria-label',names[value]+'，第 '+value+' 階段，共 3 階段');
  squeeze.disabled=value===3;
  reset.disabled=value===0;
  steps.forEach((item,i)=>{
    item.dataset.done=String(i+1<value);
    if(i+1===value)item.setAttribute('aria-current','step');
    else item.removeAttribute('aria-current');
  });
  if(announce)$('announcement').textContent=value?'第 '+value+' 階段：'+names[value]:'已重置巧克力。';
}
function advance(){
  if(stage>=3)return;
  renderStage(stage+1);
  if(soundOn)playCrack(stage);
  if(stage===3 && live)status('已完成','還能握緊或鬆手改變內芯形狀，按「重置」可再玩。');
}
renderStage(0,false);
squeeze.addEventListener('click',advance);
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
  if(!squeeze.disabled){event.preventDefault();advance();}
});
sound.addEventListener('click',async ()=>{
  if(soundOn)soundOn=false;
  else try{soundOn=await enableAudio();}catch{soundOn=false;}
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
        if(reading.trigger)advance();
        if(stage!==3){
          if(!points && now-lastSeen>300)status('找不到手','讓一隻手完整入鏡，掌心朝向相機。');
          else if(reading.stable==='open')status('已張手','握拳，推進一個破裂階段。');
          else if(reading.stable==='fist')status('已握拳','握緊會壓得更扁。張手後，再握一次。');
          else if(points && !reading.armed)status('追蹤中','先張開手掌，再握拳。');
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
    status('追蹤中','先張開手掌，再握拳。');
    trackHand(detector,id);
  }catch(error){
    if(id!==session)return;
    console.warn('Waxball camera initialization:',error);
    stopCamera(cameraMessage(error),'未能開啟');
  }
});
window.addEventListener('pagehide',()=>{if(live||pending)stopCamera();});
