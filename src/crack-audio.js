let context;
let noise;
export async function enableAudio(){
  const Audio = window.AudioContext || window.webkitAudioContext;
  if(!Audio)return false;
  context ??= new Audio();
  await context.resume();
  return context.state==='running';
}
export function playCrack(stage){
  if(context?.state!=='running')return;
  if(!noise){
    noise=context.createBuffer(1,Math.floor(context.sampleRate*.3),context.sampleRate);
    const data=noise.getChannelData(0);
    for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;
  }
  for(let i=0;i<stage+1;i++){
    const start=context.currentTime+i*.032+Math.random()*.011;
    const src=context.createBufferSource(), filter=context.createBiquadFilter(), gain=context.createGain();
    src.buffer=noise;
    filter.type='bandpass';filter.frequency.value=1750+Math.random()*2400-stage*220;filter.Q.value=.8;
    gain.gain.setValueAtTime(.14/(1+i*.55),start);
    gain.gain.exponentialRampToValueAtTime(.001,start+.033+stage*.008);
    src.connect(filter).connect(gain).connect(context.destination);
    src.start(start,Math.random()*.14);
    src.stop(start+.065+stage*.01);
  }
}
