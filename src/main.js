import './style.css';
import {readHand,createGestureGate} from './gesture.js';
import {loadDetector,drawHands} from './hand-camera.js';
import {enableAudio,muteAudio,playCrack,playPop} from './crack-audio.js';
import {createHandRouter} from './hand-routing.js';
import {specimens} from './specimens.js';
import {mountWax} from './wax-scene.js';
import {matchLocale,messages} from './locales.js';

const $=id=>document.getElementById(id);
const camera=$('camera-toggle'), cameraLabel=camera.querySelector('span');
const video=$('camera-feed'), marks=$('landmarks'), preview=$('preview');
const state=$('camera-state'), guidance=$('guidance');
const sound=$('sound'), squeeze=$('squeeze'), reset=$('reset');
const language=$('language');
const languageKey='crunch-lab-language';
let mode='system';
try{
  const saved=localStorage.getItem(languageKey);
  if(Object.hasOwn(messages,saved))mode=saved;
}catch{
  // The language switch still works when browser storage is unavailable.
}
let copy=messages.en;
let cameraStatus={label:'cameraOff'};
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

function renderCameraStatus(){
  const {label,hint,hands}=cameraStatus;
  const labelText=copy[label];
  const message=hands
    ? hands.map((hand,i)=>copy.handHint(copy.side[i],copy.sideState[hand])).join(' · ')
    : hint ? copy[hint] : copy.offHint(copy[readyHint()]);
  if(state.textContent!==labelText)state.textContent=labelText;
  if(guidance.textContent!==message)guidance.textContent=message;
}
function status(label,hint,hands){
  cameraStatus={label,hint,hands};
  renderCameraStatus();
}
function cameraAction(key){
  cameraLabel.dataset.copy=key;
  cameraLabel.textContent=copy[key];
}
function side(slot){
  return copy.side[slot.index];
}
function canSqueeze(slot){
  return !slot.item.breakable||slot.stage<3;
}
function renderSlot(slot){
  const {item,stage,root}=slot;
  const name=copy.items[item.id];
  const progress=item.breakable ? `${copy.stages[stage]} · ${stage}/3` : copy.release;
  root.querySelector('.specimen').textContent=name;
  root.querySelector('.stage-count').textContent=progress;
  root.querySelector('.plate').textContent=name;
  const sideLabel=root.querySelector('.side-label');
  sideLabel.hidden=quantity===1;
  sideLabel.textContent=side(slot);
  slot.figure.dataset.item=item.id;
  slot.button.hidden=quantity===1;
  slot.button.disabled=!canSqueeze(slot);
  slot.button.textContent=copy.manualSide[slot.index];
  slot.scene.setAttribute('aria-label',[quantity===2?side(slot):null,name,progress].filter(Boolean).join(', '));
}

function renderControls(){
  const active=activeSlots();
  squeeze.disabled=active.every(slot=>!canSqueeze(slot));
  squeeze.querySelector('span').textContent=quantity===2?copy.manualBoth:copy.manual;
  reset.hidden=!active.some(slot=>slot.item.breakable);
  reset.disabled=!active.some(slot=>slot.stage);
  reset.querySelector('span').textContent=quantity===2?copy.resetBoth:copy.reset;
  const {item}=slots[0];
  $('footer-gesture').textContent=quantity===2?copy.dualFooter:item.breakable?copy.crackFooter:copy.softFooter;
}
function selectPicker(index){
  pickerTarget=index;
  choices.find(choice=>choice.value===slots[index].item.id).checked=true;
  document.querySelector('input[name="picker-target"][value="'+index+'"]').checked=true;
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
  if(quantity===2)return 'readyDual';
  return slots[0].item.breakable ? 'readyCrack' : 'readySoft';
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
  renderControls();
  if(live&&!pending)status('tracking',readyHint());
  else if(cameraStatus.label==='cameraOff')renderCameraStatus();
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
    if(live&&!pending)status('tracking',readyHint());
    else if(cameraStatus.label==='cameraOff')renderCameraStatus();
    $('announcement').textContent=copy.switched(quantity===2?side(slot):'',copy.items[slot.item.id]);
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
    $('announcement').textContent=copy.stageChanged(quantity===2?side(slot):'',slot.stage,copy.stages[slot.stage]);
    if(soundOn)playCrack(slot.stage,item.id);
    if(quantity===1 && slot.stage===3 && live)status('finished','finishedHint');
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
function applyLanguage(){
  const preferred=navigator.languages?.length ? navigator.languages : [navigator.language];
  const locale=mode==='system' ? matchLocale(preferred) : mode;
  copy=messages[locale];
  document.documentElement.lang=locale;
  document.title=copy.title;
  document.querySelector('[data-copy-description]').content=copy.description;
  document.querySelectorAll('[data-copy]').forEach(el=>{el.textContent=copy[el.dataset.copy];});
  document.querySelectorAll('[data-copy-label]').forEach(el=>el.setAttribute('aria-label',copy[el.dataset.copyLabel]));
  document.querySelectorAll('[data-copy-title]').forEach(el=>{el.title=copy[el.dataset.copyTitle];});
  for(const choice of choices){
    choice.closest('label').querySelector('strong').textContent=copy.items[choice.value];
  }
  $('announcement').textContent='';
  activeSlots().forEach(renderSlot);
  renderControls();
  renderCameraStatus();
}
language.value=mode;
language.addEventListener('change',()=>{
  mode=language.value;
  try{
    if(mode==='system')localStorage.removeItem(languageKey);
    else localStorage.setItem(languageKey,mode);
  }catch{
    // Use the selection for this page even when the browser blocks storage.
  }
  applyLanguage();
});
window.addEventListener('languagechange',()=>{if(mode==='system')applyLanguage();});

mount(slots[0]);
applyLanguage();
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
  $('announcement').textContent=copy.resetMessage(quantity===2?null:copy.items[slots[0].item.id]);
  if(live&&!pending)status('tracking',readyHint());
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

function stopCamera(hint,label='cameraOff'){
  session++;
  cancelAnimationFrame(frame);
  live?.getTracks().forEach(track=>track.stop());
  live=null;pending=false;
  video.pause();
  video.srcObject=null;
  marks.getContext('2d').clearRect(0,0,marks.width,marks.height);
  preview.dataset.live='false';
  camera.dataset.active='false';
  cameraAction('startCamera');
  resetTracking();
  status(label,hint);
}
function cameraMessage(error){
  if(error.name==='NotAllowedError'||error.name==='SecurityError')return 'denied';
  if(error.name==='NotFoundError')return 'noCamera';
  if(error.name==='NotReadableError')return 'busyCamera';
  return 'modelFailed';
}
function cameraFeedback(mapped,readings,now){
  if(quantity===2){
    const count=mapped.filter(Boolean).length;
    if(count>0){
      const hints=mapped.map((hand,i)=>{
        if(!hand)return 'missing';
        if(!canSqueeze(slots[i]))return 'finished';
        return readings[i].armed?'ready':'release';
      });
      status(count===2?'twoVisible':'oneVisible',null,hints);
    }
    else status('lost','findBoth');
    return;
  }
  const slot=slots[0];
  if(slot.stage===3)return;
  const reading=readings[0];
  if(!mapped[0] && now-slot.lastSeen>300)status('lost','findOne');
  else if(reading.armed)status('opened',slot.item.breakable?'openCrack':'openSoft');
  else if(reading.stable==='fist')status('closed',slot.item.breakable?'closedCrack':'closedSoft');
  else if(mapped[0] && !reading.armed)status('tracking',readyHint());
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
        stopCamera('trackingStopped','interrupted');
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
    status('cameraUnavailable','secureCamera');return;
  }
  const id=++session;
  pending=true;
  camera.dataset.active='true';
  cameraAction('cancelCamera');
  status('waiting','allowCamera');
  try{
    const stream=await navigator.mediaDevices.getUserMedia({
      audio:false, video:{facingMode:'user',width:{ideal:640},height:{ideal:480},frameRate:{ideal:30,max:30}},
    });
    if(id!==session){stream.getTracks().forEach(t=>t.stop());return;}
    live=stream;
    stream.getVideoTracks().forEach(track=>track.addEventListener('ended',()=>{
      if(id===session)stopCamera('disconnected','interrupted');
    },{once:true}));
    video.srcObject=stream;
    await video.play();
    if(id!==session)return;
    preview.dataset.live='true';
    cameraAction('stopCamera');
    status('loading','loadingHint');
    const detector=await loadDetector();
    if(id!==session)return;
    pending=false;
    status('tracking',readyHint());
    trackHand(detector,id);
  }catch(error){
    if(id!==session)return;
    console.warn('Waxball camera initialization:',error);
    stopCamera(cameraMessage(error),'cameraFailed');
  }
});
window.addEventListener('pagehide',()=>{if(live||pending)stopCamera();});
