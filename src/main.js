import './style.css';
import {readHand,createGestureGate} from './gesture.js';
import {loadDetector,drawHands} from './hand-camera.js';
import {enableAudio,muteAudio,playCrack,playPop} from './crack-audio.js';
import {createHandRouter} from './hand-routing.js';
import {specimens} from './specimens.js';
import {mountWax} from './wax-scene.js';

const $=id=>document.getElementById(id);
const camera=$('camera-toggle'), cameraLabel=camera.querySelector('span');
const video=$('camera-feed'), marks=$('landmarks'), preview=$('preview');
const state=$('camera-state'), guidance=$('guidance');
const sound=$('sound'), squeeze=$('squeeze'), reset=$('reset');
const steps=[...document.querySelectorAll('.steps li')];
const names=['','初裂','裂開','碎裂'];
const choices=[...document.querySelectorAll('input[name="squishy"]')];
const pair=$('stage-pair');
const first=pair.firstElementChild;
const second=first.cloneNode(true);
second.hidden=true;
pair.append(second);
const router=createHandRouter();
let quantity=1, pickerTarget=0;
let soundOn=false, live=null, pending=false, frame=0, session=0;
const initialItem=specimens[choices.find(choice=>choice.checked).value];
const slots=[first,second].map((root,index)=>{
  root.dataset.side=index===0?'left':'right';
  return {
    root, index, item:initialItem, stage:0, visual:null,
    gate:createGestureGate(), lastSeen:-Infinity,
    scene:root.querySelector('.scene'), figure:root.querySelector('.stage'),
    error:root.querySelector('.scene-error'), button:root.querySelector('.side-squeeze'),
  };
});

function activeSlots(){
  return slots.slice(0,quantity);
}
function mount(slot){
  if(slot.visual)return;
  try{
    slot.visual=mountWax(slot.scene,slot.item);
    slot.error.hidden=true;
  }catch(error){
    slot.error.hidden=false;
    console.warn('Squishy WebGL initialization:',error);
  }
}

function status(label,message){
  if(state.textContent!==label)state.textContent=label;
  if(guidance.textContent!==message)guidance.textContent=message;
}
function side(slot){
  return slot.index===0?'左顆':'右顆';
}
function canSqueeze(slot){
  return !slot.item.breakable||slot.stage<3;
}
function renderSlot(slot){
  const {item,stage,root}=slot;
  const name=stage ? names[stage] : item.name;
  root.querySelector('.specimen').textContent=quantity===2 ? item.name : name;
  root.querySelector('.stage-count').textContent=item.breakable ? '0'+stage+' / 03' : '柔軟回彈';
  root.querySelector('.plate').textContent=item.plate;
  const sideLabel=root.querySelector('.side-label');
  sideLabel.hidden=quantity===1;
  sideLabel.textContent=side(slot);
  slot.figure.dataset.item=item.id;
  slot.button.hidden=quantity===1;
  slot.button.disabled=!canSqueeze(slot);
  slot.button.textContent='手動捏'+side(slot);
  slot.scene.setAttribute('aria-label',(quantity===2?side(slot)+'，':'')+item.name+'，'+(item.breakable?(stage?name+'，第 '+stage+' 階段':'完整'):'柔軟回彈'));
}

function renderControls(){
  const active=activeSlots();
  squeeze.disabled=active.every(slot=>!canSqueeze(slot));
  squeeze.querySelector('span').textContent=quantity===2?'兩顆一起捏':'手動捏一次';
  reset.hidden=!active.some(slot=>slot.item.breakable);
  reset.disabled=!active.some(slot=>slot.stage);
  reset.lastChild.textContent=quantity===2?'重置兩顆':'重置';
  const {item,stage}=slots[pickerTarget];
  $('steps').hidden=!item.breakable;
  $('feel').hidden=item.breakable;
  $('feel').textContent=item.feel||'';
  $('steps').setAttribute('aria-label',quantity===2?side(slots[pickerTarget])+'破裂階段':'破裂階段');
  $('footer-gesture').textContent=quantity===2?'雙手各控制一顆':item.breakable?'握拳 → 張手 → 再握拳':'握拳壓扁 · 張手回彈';
  if(item.breakable)steps.forEach((step,i)=>{
    step.querySelector('small').textContent=item.steps[i];
    step.dataset.done=String(i+1<stage);
    if(i+1===stage)step.setAttribute('aria-current','step');
    else step.removeAttribute('aria-current');
  });
}
function selectPicker(index){
  pickerTarget=index;
  choices.find(choice=>choice.value===slots[index].item.id).checked=true;
  document.querySelector('input[name="picker-target"][value="'+index+'"]').checked=true;
  renderControls();
}
function resetTracking(){
  router.reset();
  for(const slot of slots){
    slot.gate.reset();
    slot.lastSeen=-Infinity;
    slot.visual?.setGrip(0);
  }
}
function readyHint(){
  if(quantity===2)return '雙手放進畫面，先張手，再各自握拳。';
  return slots[0].item.breakable ? '先張開手掌，再握拳。' : '握拳捏扁，張手讓它回彈。';
}
function setQuantity(value){
  if(value===quantity)return;
  quantity=value;
  pair.dataset.dual=String(value===2);
  second.hidden=value===1;
  $('picker-target').hidden=value===1;
  if(value===2&&!slots[1].visual){
    slots[1].item=slots[0].item;
    mount(slots[1]);
  }
  resetTracking();
  selectPicker(0);
  activeSlots().forEach(renderSlot);
  if(live&&!pending)status('追蹤中',readyHint());
  else if(!live&&!pending&&state.textContent==='未開啟')status('未開啟','開啟相機後，'+readyHint());
}
document.querySelectorAll('input[name="quantity"]').forEach(input=>{
  input.addEventListener('change',()=>setQuantity(Number(input.value)));
});
document.querySelectorAll('input[name="picker-target"]').forEach(input=>{
  input.addEventListener('change',()=>selectPicker(Number(input.value)));
});
for(const choice of choices){
  choice.addEventListener('change',()=>{
    const slot=slots[pickerTarget];
    slot.item=specimens[choice.value];
    slot.stage=0;
    slot.gate.reset();
    slot.visual?.setItem(slot.item);
    renderSlot(slot);
    renderControls();
    if(live&&!pending)status('追蹤中',readyHint());
    $('announcement').textContent=(quantity===2?side(slot):'')+'已換成'+slot.item.name+'。';
  });
}
function squeezeSlot(slot,manual=false){
  if(!canSqueeze(slot))return;
  const {item}=slot;
  if(item.breakable){
    slot.stage++;
    slot.visual?.setStage(slot.stage);
    renderSlot(slot);
    renderControls();
    $('announcement').textContent=(quantity===2?side(slot)+'，':'')+'第 '+slot.stage+' 階段：'+names[slot.stage]+'。';
    if(soundOn)playCrack(slot.stage,item.id);
    if(quantity===1 && slot.stage===3 && live)status('已完成','還能握緊或鬆手改變內芯形狀，按「重置」可再玩。');
  }else{
    if(manual)slot.visual?.pulse();
    if(soundOn)playPop(item.id);
  }
}
function manualSqueeze(){
  activeSlots().forEach(slot=>squeezeSlot(slot,true));
}
for(const slot of slots){
  slot.button.addEventListener('click',()=>squeezeSlot(slot,true));
  slot.scene.addEventListener('webglcontextlost',()=>{slot.error.hidden=false;},true);
  slot.scene.addEventListener('webglcontextrestored',()=>{slot.error.hidden=true;},true);
}
mount(slots[0]);
renderSlot(slots[0]);
renderControls();
const initialQuantity=Number(document.querySelector('input[name="quantity"]:checked').value);
if(initialQuantity===2)setQuantity(2);
squeeze.addEventListener('click',manualSqueeze);
reset.addEventListener('click',()=>{
  resetTracking();
  for(const slot of activeSlots()){
    slot.stage=0;
    slot.visual?.setStage(0);
    renderSlot(slot);
  }
  renderControls();
  $('announcement').textContent=quantity===2?'已重置兩顆。':'已重置'+slots[0].item.name+'。';
  if(live&&!pending)status('追蹤中',readyHint());
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

function stopCamera(message='開啟相機後，'+readyHint(),label='未開啟'){
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
  resetTracking();
  status(label,message);
}
function cameraMessage(error){
  if(error.name==='NotAllowedError'||error.name==='SecurityError')return '相機權限未開啟。請在瀏覽器允許相機，或用下方按鈕試玩。';
  if(error.name==='NotFoundError')return '找不到相機。請接上相機，或用下方按鈕試玩。';
  if(error.name==='NotReadableError')return '相機目前無法使用。請關閉占用相機的程式再試。';
  return '手部追蹤無法啟動。請檢查網路後再試，或用下方按鈕試玩。';
}
function cameraFeedback(mapped,readings,now){
  if(quantity===2){
    const count=mapped.filter(Boolean).length;
    if(count>0){
      const hints=mapped.map((hand,i)=>{
        if(!hand)return side(slots[i])+'待入鏡';
        if(!canSqueeze(slots[i]))return side(slots[i])+'已完成';
        return side(slots[i])+(readings[i].armed?'可捏':'先鬆手');
      });
      status(count===2?'雙手已入鏡':'偵測到一隻手',hints.join(' · '));
    }
    else status('找不到手','把雙手放進畫面，掌心朝向相機。');
    return;
  }
  const slot=slots[0];
  if(slot.stage===3)return;
  const reading=readings[0];
  if(!mapped[0] && now-slot.lastSeen>300)status('找不到手','讓一隻手完整入鏡，掌心朝向相機。');
  else if(reading.armed)status('已張手',slot.item.breakable?'可以握拳了。':'可以握拳捏扁，張手讓它回彈。');
  else if(reading.stable==='fist')status('已握拳',slot.item.breakable?'握緊會壓得更扁。張手後，再握一次。':'握緊會壓得更扁，鬆手就會回彈。');
  else if(mapped[0] && !reading.armed)status('追蹤中',readyHint());
}
function trackHand(detector,id){
  let lastFrame=-1,lastRun=-Infinity;
  function tick(now){
    if(id!==session || !live)return;
    if(video.readyState>=2 && lastFrame!==video.currentTime && now-lastRun>=30){
      lastFrame=video.currentTime;lastRun=now;
      try{
        const result=detector.detectForVideo(video,now);
        const hands=result.landmarks.map((points,index)=>{
          const label=result.handedness?.[index]?.[0];
          const {pose,grip}=readHand(points,result.worldLandmarks[index],video.videoWidth/video.videoHeight);
          return {points,pose,grip,x:1-points[0].x,y:points[0].y,label:label?.score>=.8?label.categoryName:null};
        }).filter(hand=>hand.pose!=='missing');
        const mapped=router.assign(hands,quantity);
        drawHands(marks,video,mapped);
        const readings=mapped.map((hand,index)=>{
          const slot=slots[index];
          if(hand){
            slot.lastSeen=now;
            slot.visual?.setGrip(hand.grip);
          }
          const reading=slot.gate.sample(hand?.pose||'missing',now,hand?.grip);
          if(reading.trigger)squeezeSlot(slot);
          return reading;
        });
        cameraFeedback(mapped,readings,now);
      }catch(error){
        console.warn('Squishy camera frame:',error);
        stopCamera('手部追蹤中斷。請重新開啟相機，或用按鈕繼續。','已中斷');
        return;
      }
    }
    for(const slot of activeSlots())if(now-slot.lastSeen>160)slot.visual?.setGrip(0);
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
