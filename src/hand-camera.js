const model = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';
const wasm = new URL(import.meta.env.BASE_URL + 'vision', document.baseURI).href;
let detector;

export function loadDetector(){
  detector ??= import('@mediapipe/tasks-vision').then(async ({FilesetResolver,HandLandmarker})=>{
    const files=await FilesetResolver.forVisionTasks(wasm);
    return HandLandmarker.createFromOptions(files,{
      baseOptions:{modelAssetPath:model,delegate:'CPU'},
      runningMode:'VIDEO',
      numHands:1,
      minHandDetectionConfidence:.55,
      minHandPresenceConfidence:.55,
      minTrackingConfidence:.55,
    });
  }).catch(error=>{detector=undefined;throw error;});
  return detector;
}

const links=[[0,1,2,3,4],[0,5,6,7,8],[5,9,10,11,12],[9,13,14,15,16],[13,17,18,19,20],[0,17]];

export function drawHand(canvas,video,points){
  const w=video.videoWidth, h=video.videoHeight;
  if(!w||!h)return;
  if(canvas.width!==w || canvas.height!==h){canvas.width=w;canvas.height=h;}
  const ctx=canvas.getContext('2d');
  ctx.clearRect(0,0,w,h);
  if(!points)return;
  ctx.lineCap='round';ctx.lineJoin='round';
  ctx.lineWidth=Math.max(2,w/210);
  ctx.strokeStyle='#ffd5aa';
  ctx.fillStyle='#fff0d9';
  for(const chain of links){
    ctx.beginPath();
    chain.forEach((i,j)=>{
      const p=points[i];
      if(j)ctx.lineTo(p.x*w,p.y*h);
      else ctx.moveTo(p.x*w,p.y*h);
    });
    ctx.stroke();
  }
  for(const p of points){
    ctx.beginPath();ctx.arc(p.x*w,p.y*h,Math.max(2,w/145),0,Math.PI*2);ctx.fill();
  }
}
